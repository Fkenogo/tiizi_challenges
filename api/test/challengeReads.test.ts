/**
 * Phase C3A V2 Challenge read API tests.
 *
 * Proves the minimum read surface (list / detail / competitive leaderboard)
 * serves V2 PostgreSQL truth with live Group-Membership authorization:
 * - authenticated list scoping (participation history + live-eligible groups);
 * - unauthorized challenges never leak (404, not 403);
 * - detail renders the CURRENT immutable governing config;
 * - participation/Derived Truth correctness (incl. collective overshoot);
 * - competitive ties 1,2,2,4; non-completers unranked;
 * - streak progress without a streak leaderboard;
 * - authority outages fail closed (503);
 * - zero V1/Firestore progress fallback in any response.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  activateChallenge,
  createChallenge,
  type ChallengeCreationResolvers,
  type NewChallengeInput,
} from '../src/challenges.js';
import { addChallengeConfigVersion } from '../src/challengeConfigs.js';
import {
  applyChallengeActivity,
  type ChallengeActivityResolvers,
  type NewChallengeActivityInput,
} from '../src/challengeActivityApplication.js';
import type { GroupMembershipAuthority } from '../src/groupMembershipAuthority.js';
import {
  getChallengeDetail,
  getChallengeLeaderboard,
  listVisibleChallenges,
} from '../src/challengeReads.js';
import {
  authHeaders,
  buildTestApp,
  seedGroup,
  seedMember,
  seedMembership,
  testDb,
  stubEligibility,
} from './helpers.js';
import type { Db } from '../src/db.js';

beforeEach(async () => {
  await testDb().query(
    'TRUNCATE challenge_derived_state, challenge_participation_derived, challenge_activity_records, challenge_activity_configs, challenge_config_versions, challenge_participations, challenges, challenge_establishment_keys, member_activity_events',
  );
});

const T = (iso: string): Date => new Date(iso);
let seq = 0;
const next = (prefix: string): string => `${prefix}-${(seq += 1)}`;

interface Pin {
  knowledge_id: string;
  current_version: number;
}

async function seedKnowledge(
  db: Db,
  name: string,
  kind: 'fitness' | 'wellness' = 'fitness',
): Promise<Pin> {
  const result = await db.query<{ knowledge_id: string; current_version: number }>(
    `INSERT INTO knowledge_items (kind, name, lifecycle) VALUES ($1, $2, 'published')
     RETURNING knowledge_id, current_version`,
    [kind, `${name}-${seq}`],
  );
  return {
    knowledge_id: String(result.rows[0].knowledge_id),
    current_version: Number(result.rows[0].current_version),
  };
}

function creationResolvers(pins: Record<string, Pin>): ChallengeCreationResolvers {
  return {
    resolveKnowledgePin: async (key) => pins[key] ?? null,
    resolveKnowledgeEligibility: async () => stubEligibility(),
    resolveGroupAuthority: async () => ({ status: 'active' }),
    resolveGroupMembershipAuthority: async () => ({ status: 'active', eligible: true }),
  };
}

function activityResolvers(
  pins: Record<string, Pin>,
  authority: GroupMembershipAuthority['resolveGroupMembershipAuthority'],
): ChallengeActivityResolvers {
  return {
    resolveKnowledgePin: async (key) => pins[key] ?? null,
    resolveGroupMembershipAuthority: authority,
  };
}

/** Live authority stub scoped by eligible group set; optionally throws. */
function stubAuthority(
  eligibleGroups: Set<string>,
  options: { throwError?: string } = {},
): GroupMembershipAuthority {
  return {
    resolveGroupMembershipAuthority: async (groupId: string) => {
      if (options.throwError) throw new Error(options.throwError);
      if (eligibleGroups.has(groupId)) return { status: 'active', eligible: true };
      return { status: 'no_membership', eligible: false };
    },
  };
}

interface Fixture {
  groupId: string;
  memberId: string;
  challengeId: string;
  pins: Record<string, Pin>;
}

async function setupChallenge(
  uid: string,
  input: Omit<NewChallengeInput, 'group_id' | 'created_by_member_id' | 'title' | 'start_date' | 'end_date'> & {
    kinds?: Record<string, 'fitness' | 'wellness'>;
  },
): Promise<Fixture> {
  const db = testDb();
  const tag = next('c3a');
  const memberId = await seedMember(db, `${uid}-${tag}`);
  const groupId = await seedGroup(db, { name: `C3A Group ${tag}` });
  await seedMembership(db, groupId, memberId, { status: 'active' });
  const pins: Record<string, Pin> = {};
  for (const activity of input.activities) {
    const key = activity.canonical_key;
    if (!pins[key]) pins[key] = await seedKnowledge(db, key, input.kinds?.[key] ?? 'fitness');
  }
  const { challenge } = await createChallenge(
    db,
    {
      group_id: groupId,
      created_by_member_id: memberId,
      title: `C3A ${tag}`,
      start_date: '2026-06-01',
      end_date: '2026-06-30',
      ...input,
    } as NewChallengeInput,
    creationResolvers(pins),
  );
  await activateChallenge(db, challenge.challenge_id);
  return { groupId, memberId, challengeId: challenge.challenge_id, pins };
}

async function insertEpisode(
  db: Db,
  challengeId: string,
  memberId: string,
  joinedAt: string,
): Promise<string> {
  const result = await db.query<{ participation_id: string }>(
    `INSERT INTO challenge_participations
       (challenge_id, member_id, status, joined_at, joined_config_version)
     VALUES ($1, $2, 'active', $3, 1)
     RETURNING participation_id`,
    [challengeId, memberId, joinedAt],
  );
  return String(result.rows[0].participation_id);
}

function logInput(overrides?: Partial<NewChallengeActivityInput>): NewChallengeActivityInput {
  return {
    activity_kind: 'fitness',
    canonical_key: 'push-up',
    value: 10,
    unit: 'reps',
    occurred_at: T('2026-06-10T12:00:00Z'),
    client_key: next('key'),
    ...overrides,
  };
}

async function log(
  db: Db,
  memberId: string,
  challengeId: string,
  pins: Record<string, Pin>,
  input: NewChallengeActivityInput,
): Promise<void> {
  await applyChallengeActivity(
    db,
    memberId,
    challengeId,
    input,
    activityResolvers(pins, async () => ({ status: 'active', eligible: true })),
  );
}

describe('challenge list', () => {
  it('returns challenges from own participation history with progress', async () => {
    const db = testDb();
    const fx = await setupChallenge('c3a-list', {
      challenge_type: 'competitive',
      activities: [{ canonical_key: 'push-up', metric: 'repetitions', target_value: 100, unit: 'reps' }],
    });
    await insertEpisode(db, fx.challengeId, fx.memberId, '2026-06-01T00:00:00Z');
    await log(db, fx.memberId, fx.challengeId, fx.pins, logInput({ value: 40 }));
    const authority = stubAuthority(new Set([fx.groupId]));
    const summaries = await listVisibleChallenges(db, fx.memberId, { groupMembershipAuthority: authority });
    expect(summaries).toHaveLength(1);
    expect(summaries[0].challengeId).toBe(fx.challengeId);
    expect(summaries[0].myParticipation?.progress.logsAccepted).toBe(1);
    expect(summaries[0].myParticipation?.progress.cumulativeTotal).toBe(40);
  });

  it('includes group challenges without participation when live-eligible, excludes otherwise', async () => {
    const db = testDb();
    const fx = await setupChallenge('c3a-list-scope', {
      challenge_type: 'collective',
      goal_value: 500,
      goal_unit: 'reps',
      activities: [{ canonical_key: 'push-up', metric: 'repetitions', target_value: 20, unit: 'reps' }],
    });
    const outsider = await seedMember(db, `outsider-${next('m')}`);
    // Candidate set comes from the PG shadow; live authority confirms.
    // A shadow row alone authorizes nothing (stale shadows fail closed).
    await seedMembership(db, fx.groupId, outsider, { status: 'active' });
    // Eligible: group challenge visible even with no participation episode.
    const eligible = await listVisibleChallenges(
      db, outsider, { groupMembershipAuthority: stubAuthority(new Set([fx.groupId])) },
    );
    expect(eligible.map((s) => s.challengeId)).toContain(fx.challengeId);
    expect(eligible.find((s) => s.challengeId === fx.challengeId)?.myParticipation).toBeNull();
    // Ineligible and no history: not visible.
    const hidden = await listVisibleChallenges(
      db, outsider, { groupMembershipAuthority: stubAuthority(new Set()) },
    );
    expect(hidden.map((s) => s.challengeId)).not.toContain(fx.challengeId);
  });

  it('fails closed when live authority is unreachable', async () => {
    const db = testDb();
    const fx = await setupChallenge('c3a-list-down', {
      challenge_type: 'streak',
      required_consecutive_days: 10,
      activities: [{ canonical_key: 'push-up', metric: 'repetitions', target_value: 10, unit: 'reps' }],
    });
    await expect(
      listVisibleChallenges(db, fx.memberId, {
        groupMembershipAuthority: stubAuthority(new Set(), { throwError: 'firestore down' }),
      }),
    ).rejects.toMatchObject({ statusCode: 503, code: 'group_authority_unavailable' });
  });
});

describe('challenge detail', () => {
  it('renders current immutable governing config after a version change', async () => {
    const db = testDb();
    const fx = await setupChallenge('c3a-detail', {
      challenge_type: 'competitive',
      activities: [{ canonical_key: 'push-up', metric: 'repetitions', target_value: 100, unit: 'reps' }],
    });
    await insertEpisode(db, fx.challengeId, fx.memberId, '2026-06-01T00:00:00Z');
    await log(db, fx.memberId, fx.challengeId, fx.pins, logInput({ value: 25 }));
    await addChallengeConfigVersion(
      db,
      fx.challengeId,
      {
        end_date: '2026-07-31',
        activities: [{ canonical_key: 'push-up', metric: 'repetitions', target_value: 150, unit: 'reps' }],
      },
      creationResolvers(fx.pins),
    );
    const authority = stubAuthority(new Set([fx.groupId]));
    const detail = await getChallengeDetail(db, fx.memberId, fx.challengeId, {
      groupMembershipAuthority: authority,
    });
    expect(detail.currentConfigVersion).toBe(2);
    expect(detail.config.version).toBe(2);
    expect(detail.config.period.endDate).toBe('2026-07-31');
    expect(detail.config.activities).toHaveLength(1);
    expect(detail.config.activities[0]).toMatchObject({ canonicalKey: 'push-up', targetValue: 150, unit: 'reps' });
    // Progress survives the version transition (stable canonical identity).
    expect(detail.myParticipation?.progress.logsAccepted).toBe(1);
    expect(detail.myParticipation?.progress.cumulativeTotal).toBe(25);
  });

  it('does not leak unauthorized challenges (404, not 403)', async () => {
    const db = testDb();
    const fx = await setupChallenge('c3a-detail-hidden', {
      challenge_type: 'competitive',
      activities: [{ canonical_key: 'push-up', metric: 'repetitions', target_value: 100, unit: 'reps' }],
    });
    const stranger = await seedMember(db, `stranger-${next('m')}`);
    await expect(
      getChallengeDetail(db, stranger, fx.challengeId, {
        groupMembershipAuthority: stubAuthority(new Set()),
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('exposes activityKind=fitness for fitness-configured activities', async () => {
    const db = testDb();
    const fx = await setupChallenge('c3a-kind-fitness', {
      challenge_type: 'competitive',
      activities: [{ canonical_key: 'push-up', metric: 'repetitions', target_value: 100, unit: 'reps' }],
      kinds: { 'push-up': 'fitness' },
    });
    await insertEpisode(db, fx.challengeId, fx.memberId, '2026-06-01T00:00:00Z');
    const detail = await getChallengeDetail(db, fx.memberId, fx.challengeId, {
      groupMembershipAuthority: stubAuthority(new Set([fx.groupId])),
    });
    expect(detail.config.activities[0].activityKind).toBe('fitness');
  });

  it('exposes activityKind=wellness for wellness-configured activities', async () => {
    const db = testDb();
    const fx = await setupChallenge('c3a-kind-wellness', {
      challenge_type: 'streak',
      required_consecutive_days: 30,
      activities: [{ canonical_key: 'deep-rest', metric: 'duration', target_value: 8, unit: 'hours' }],
      kinds: { 'deep-rest': 'wellness' },
    });
    await insertEpisode(db, fx.challengeId, fx.memberId, '2026-06-01T00:00:00Z');
    const detail = await getChallengeDetail(db, fx.memberId, fx.challengeId, {
      groupMembershipAuthority: stubAuthority(new Set([fx.groupId])),
    });
    // The canonical key 'deep-rest' carries none of the old heuristic
    // keywords — kind must still be wellness because the config says so.
    expect(detail.config.activities[0].activityKind).toBe('wellness');
  });

  it('mixed fitness+wellness config preserves each exact kind', async () => {
    const db = testDb();
    const fx = await setupChallenge('c3a-kind-mixed', {
      challenge_type: 'competitive',
      activities: [
        { canonical_key: 'push-up', metric: 'repetitions', target_value: 100, unit: 'reps' },
        { canonical_key: 'quiet-time', metric: 'duration', target_value: 20, unit: 'minutes' },
      ],
      kinds: { 'push-up': 'fitness', 'quiet-time': 'wellness' },
    });
    await insertEpisode(db, fx.challengeId, fx.memberId, '2026-06-01T00:00:00Z');
    const detail = await getChallengeDetail(db, fx.memberId, fx.challengeId, {
      groupMembershipAuthority: stubAuthority(new Set([fx.groupId])),
    });
    const byKey = Object.fromEntries(detail.config.activities.map((a) => [a.canonicalKey, a.activityKind]));
    expect(byKey['push-up']).toBe('fitness');
    expect(byKey['quiet-time']).toBe('wellness');
  });

  it('collective overshoot is preserved in derived truth', async () => {
    const db = testDb();
    const fx = await setupChallenge('c3a-overshoot', {
      challenge_type: 'collective',
      goal_value: 100,
      goal_unit: 'reps',
      activities: [{ canonical_key: 'push-up', metric: 'repetitions', target_value: 20, unit: 'reps' }],
    });
    await insertEpisode(db, fx.challengeId, fx.memberId, '2026-06-01T00:00:00Z');
    await log(db, fx.memberId, fx.challengeId, fx.pins, logInput({ value: 60 }));
    await log(db, fx.memberId, fx.challengeId, fx.pins, logInput({ value: 60, client_key: next('key'), occurred_at: T('2026-06-11T12:00:00Z') }));
    const detail = await getChallengeDetail(db, fx.memberId, fx.challengeId, {
      groupMembershipAuthority: stubAuthority(new Set([fx.groupId])),
    });
    expect(detail.collectiveTotal).toBe(120);
    expect(detail.collectiveGoalReached).toBe(true);
  });

  it('streak progress renders without a leaderboard', async () => {
    const db = testDb();
    const fx = await setupChallenge(
      'c3a-streak',
      {
        challenge_type: 'streak',
        required_consecutive_days: 30,
        activities: [{ canonical_key: 'push-up', metric: 'repetitions', target_value: 10, unit: 'reps' }],
      },
    );
    await insertEpisode(db, fx.challengeId, fx.memberId, '2026-06-01T00:00:00Z');
    await log(db, fx.memberId, fx.challengeId, fx.pins, logInput({ value: 10, occurred_at: T('2026-06-10T12:00:00Z') }));
    const authority = stubAuthority(new Set([fx.groupId]));
    const detail = await getChallengeDetail(db, fx.memberId, fx.challengeId, {
      groupMembershipAuthority: authority,
    });
    expect(detail.myParticipation?.progress.currentStreak).toBe(1);
    expect(detail.myParticipation?.progress.daysCompleted).toBe(1);
    await expect(
      getChallengeLeaderboard(db, fx.memberId, fx.challengeId, { groupMembershipAuthority: authority }),
    ).rejects.toMatchObject({ statusCode: 404, code: 'leaderboard_not_available' });
  });

  it('collective challenges have no leaderboard', async () => {
    const db = testDb();
    const fx = await setupChallenge('c3a-coll-lb', {
      challenge_type: 'collective',
      goal_value: 100,
      goal_unit: 'reps',
      activities: [{ canonical_key: 'push-up', metric: 'repetitions', target_value: 20, unit: 'reps' }],
    });
    await expect(
      getChallengeLeaderboard(db, fx.memberId, fx.challengeId, {
        groupMembershipAuthority: stubAuthority(new Set([fx.groupId])),
      }),
    ).rejects.toMatchObject({ statusCode: 404, code: 'leaderboard_not_available' });
  });
});

describe('competitive leaderboard', () => {
  async function seedDerivedCompletion(
    db: Db,
    challengeId: string,
    memberId: string,
    completedAt: string | null,
    totalPoints: number,
  ): Promise<string> {
    const participationId = await insertEpisode(db, challengeId, memberId, '2026-06-01T00:00:00Z');
    await db.query(
      `INSERT INTO challenge_participation_derived
         (participation_id, challenge_id, member_id, logs_accepted, total_points,
          completion_status, completed_at, scoring_version)
       VALUES ($1, $2, $3, 1, $4, $5, $6, 'computeActivityScore/v1')`,
      [
        participationId, challengeId, memberId, totalPoints,
        completedAt ? 'completed' : 'in_progress', completedAt,
      ],
    );
    return participationId;
  }

  it('ties share positions 1,2,2,4 and non-completers are unranked', async () => {
    const db = testDb();
    const fx = await setupChallenge('c3a-ties', {
      challenge_type: 'competitive',
      activities: [{ canonical_key: 'push-up', metric: 'repetitions', target_value: 100, unit: 'reps' }],
    });
    const authority = stubAuthority(new Set([fx.groupId]));
    const deps = { groupMembershipAuthority: authority };
    const second = await seedMember(db, `tie-b-${next('m')}`);
    const third = await seedMember(db, `tie-c-${next('m')}`);
    const fourth = await seedMember(db, `tie-d-${next('m')}`);
    const fifth = await seedMember(db, `tie-e-${next('m')}`);
    await seedDerivedCompletion(db, fx.challengeId, fx.memberId, '2026-06-10T10:00:00.000Z', 100);
    await seedDerivedCompletion(db, fx.challengeId, second, '2026-06-11T10:00:00.000Z', 100);
    await seedDerivedCompletion(db, fx.challengeId, third, '2026-06-11T10:00:00.000Z', 90);
    await seedDerivedCompletion(db, fx.challengeId, fourth, '2026-06-12T10:00:00.000Z', 80);
    await seedDerivedCompletion(db, fx.challengeId, fifth, null, 10);
    const board = await getChallengeLeaderboard(db, fx.memberId, fx.challengeId, deps);
    const byMember = Object.fromEntries(board.entries.map((e) => [e.memberId, e.position]));
    expect(byMember[fx.memberId]).toBe(1);
    expect(byMember[second]).toBe(2);
    expect(byMember[third]).toBe(2);
    expect(byMember[fourth]).toBe(4);
    expect(byMember[fifth]).toBeNull();
  });

  it('ranking derives from completion order after real application', async () => {
    const db = testDb();
    const fx = await setupChallenge('c3a-rank', {
      challenge_type: 'competitive',
      activities: [{ canonical_key: 'push-up', metric: 'repetitions', target_value: 50, unit: 'reps' }],
    });
    const rival = await seedMember(db, `rival-${next('m')}`);
    await seedMembership(db, fx.groupId, rival, { status: 'active' });
    await insertEpisode(db, fx.challengeId, fx.memberId, '2026-06-01T00:00:00Z');
    await insertEpisode(db, fx.challengeId, rival, '2026-06-01T00:00:00Z');
    await log(db, fx.memberId, fx.challengeId, fx.pins, logInput({ value: 50 }));
    await log(db, rival, fx.challengeId, fx.pins, logInput({ value: 10, client_key: next('key') }));
    const board = await getChallengeLeaderboard(db, fx.memberId, fx.challengeId, {
      groupMembershipAuthority: stubAuthority(new Set([fx.groupId])),
    });
    expect(board.entries).toHaveLength(2);
    expect(board.entries[0].memberId).toBe(fx.memberId);
    expect(board.entries[0].position).toBe(1);
    expect(board.entries[0].completionStatus).toBe('completed');
    expect(board.entries[1].position).toBeNull();
  });
});

describe('read routes (HTTP)', () => {
  function appFor(tokens: Record<string, string>, authority: GroupMembershipAuthority) {
    return buildTestApp(tokens, { challengeActivity: { groupMembershipAuthority: authority } });
  }

  it('serves list, detail and leaderboard for the authenticated member', async () => {
    const db = testDb();
    const fx = await setupChallenge('c3a-http', {
      challenge_type: 'competitive',
      activities: [{ canonical_key: 'push-up', metric: 'repetitions', target_value: 100, unit: 'reps' }],
    });
    await insertEpisode(db, fx.challengeId, fx.memberId, '2026-06-01T00:00:00Z');
    // Wire the stub token to the seeded firebase subject.
    const subject = await db.query<{ auth_subject: string }>(
      `SELECT auth_subject FROM members WHERE member_id = $1`,
      [fx.memberId],
    );
    const app2 = appFor(
      { 'token-http': String(subject.rows[0].auth_subject) },
      stubAuthority(new Set([fx.groupId])),
    );
    const list = await app2.inject({ method: 'GET', url: '/v1/challenges', headers: authHeaders('token-http') });
    expect(list.statusCode).toBe(200);
    const listBody = list.json() as { challenges: Array<{ challengeId: string }> };
    expect(listBody.challenges.map((c) => c.challengeId)).toContain(fx.challengeId);

    const detail = await app2.inject({
      method: 'GET',
      url: `/v1/challenges/${fx.challengeId}`,
      headers: authHeaders('token-http'),
    });
    expect(detail.statusCode).toBe(200);

    const board = await app2.inject({
      method: 'GET',
      url: `/v1/challenges/${fx.challengeId}/leaderboard`,
      headers: authHeaders('token-http'),
    });
    expect(board.statusCode).toBe(200);
  });

  it('rejects unauthenticated reads and hides foreign challenges', async () => {
    const db = testDb();
    const fx = await setupChallenge('c3a-http-auth', {
      challenge_type: 'competitive',
      activities: [{ canonical_key: 'push-up', metric: 'repetitions', target_value: 100, unit: 'reps' }],
    });
    const app = appFor({ 'token-x': 'uid-x' }, stubAuthority(new Set()));
    const anon = await app.inject({ method: 'GET', url: '/v1/challenges' });
    expect(anon.statusCode).toBe(401);
    const hidden = await app.inject({
      method: 'GET',
      url: `/v1/challenges/${fx.challengeId}`,
      headers: authHeaders('token-x'),
    });
    // Unknown member (no linked Tiizi member) fails at auth, never reaching reads.
    expect([401, 404]).toContain(hidden.statusCode);
  });

  it('responses carry V2 truth only — no V1/Firestore progress fallback', async () => {
    const db = testDb();
    const fx = await setupChallenge('c3a-http-pure', {
      challenge_type: 'collective',
      goal_value: 100,
      goal_unit: 'reps',
      activities: [{ canonical_key: 'push-up', metric: 'repetitions', target_value: 20, unit: 'reps' }],
    });
    await insertEpisode(db, fx.challengeId, fx.memberId, '2026-06-01T00:00:00Z');
    await log(db, fx.memberId, fx.challengeId, fx.pins, logInput({ value: 10 }));
    const subject = await db.query<{ auth_subject: string }>(
      `SELECT auth_subject FROM members WHERE member_id = $1`,
      [fx.memberId],
    );
    const app = appFor(
      { 'token-pure': String(subject.rows[0].auth_subject) },
      stubAuthority(new Set([fx.groupId])),
    );
    const headers = authHeaders('token-pure');
    const bodies = [
      (await app.inject({ method: 'GET', url: '/v1/challenges', headers })).body,
      (await app.inject({ method: 'GET', url: `/v1/challenges/${fx.challengeId}`, headers })).body,
    ];
    for (const body of bodies) {
      expect(body).not.toMatch(/workouts|wellnessLogs|challengeMembers|challengeActivitySummaries|groupActivityFeed/);
    }
  });
});
