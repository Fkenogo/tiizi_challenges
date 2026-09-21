/**
 * TIIZI-S3C-LIVE-PROGRESS-001 — real-seam live progress / type-state tests.
 *
 * These tests connect the actual seams end to end (never pure engine folds
 * alone — the S3b lesson: identity-route mismatch and PostgreSQL DATE
 * projection both escaped unit coverage):
 *
 *   governed establishment -> participation episode -> POST-equivalent
 *   applyChallengeActivity (production path, identity pins, server scoring,
 *   governing-day derivation) -> persisted Derived Truth
 *   (challenge_participation_derived / challenge_derived_state)
 *   -> actual V2 read model (getChallengeDetail / getChallengeLeaderboard /
 *   getChallengeContributors) -> recompute oracle agreement.
 *
 * Collective: two members prove shared-total advance, own cumulative,
 * contributor projection values + share-of-total, goal/unit, overshoot,
 * goalReached, no rank semantics, leaderboard unavailable.
 *
 * Competitive: three finishers (a same-instant tie pair) + one
 * non-completer prove live server positions 1,1,3 + null, agreement with
 * computeFinishingPositions, and no client ranking.
 *
 * Streak (Africa/Nairobi): server-projected governing day, current/best,
 * dayStates, daysCompleted, partial-day no-advance, same-day no-double,
 * miss reset preserving best, STREAK_DAY_CLOSED fail-closed with unchanged
 * truth, live never terminally complete, timezone-boundary correctness.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  activateChallenge,
  createChallenge,
  type ChallengeCreationResolvers,
  type NewChallengeInput,
} from '../src/challenges.js';
import {
  applyChallengeActivity,
  type ChallengeActivityResolvers,
  type NewChallengeActivityInput,
} from '../src/challengeActivityApplication.js';
import type { GroupMembershipAuthority } from '../src/groupMembershipAuthority.js';
import {
  computeFinishingPositions,
  recomputeChallengeDerived,
} from '../src/derivedTruth.js';
import {
  getChallengeContributors,
  getChallengeDetail,
  getChallengeLeaderboard,
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
    'TRUNCATE challenge_derived_state, challenge_participation_derived, challenge_activity_records, challenge_activity_configs, challenge_config_versions, challenge_participations, challenges, challenge_establishment_keys, member_activity_events, activity_submission_intents, challenge_finalizations, challenge_participation_finals',
  );
});

const T = (iso: string): Date => new Date(iso);
let seq = 0;
const next = (prefix: string): string => `${prefix}-${(seq += 1)}`;

interface Pin {
  knowledge_id: string;
  current_version: number;
}

async function seedKnowledge(db: Db, name: string): Promise<Pin> {
  const result = await db.query<{ knowledge_id: string; current_version: number }>(
    `INSERT INTO knowledge_items (kind, name, lifecycle) VALUES ('fitness', $1, 'published')
     RETURNING knowledge_id, current_version`,
    [`${name}-${seq}`],
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

function stubAuthority(eligibleGroups: Set<string>): GroupMembershipAuthority {
  return {
    resolveGroupMembershipAuthority: async (groupId: string) => {
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
    start_date?: string;
    end_date?: string;
  },
): Promise<Fixture> {
  const db = testDb();
  const tag = next('s3c');
  const memberId = await seedMember(db, `${uid}-${tag}`);
  const groupId = await seedGroup(db, { name: `S3C Group ${tag}` });
  await seedMembership(db, groupId, memberId, { status: 'active' });
  const pins: Record<string, Pin> = {};
  for (const activity of input.activities) {
    const key = activity.canonical_key;
    if (!pins[key]) pins[key] = await seedKnowledge(db, key);
  }
  const { challenge } = await createChallenge(
    db,
    {
      group_id: groupId,
      created_by_member_id: memberId,
      title: `S3C ${tag}`,
      start_date: input.start_date ?? '2026-06-01',
      end_date: input.end_date ?? '2026-06-30',
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
  now?: Date,
): Promise<void> {
  await applyChallengeActivity(
    db,
    memberId,
    challengeId,
    input,
    activityResolvers(pins, async () => ({ status: 'active', eligible: true })),
    // Default the acceptance clock to the log's own occurred instant so
    // historical June fixtures stay eligible under the window-expiry rule.
    now === undefined ? { now: input.occurred_at } : { now },
  );
}

describe('s3c collective live progress (Together)', () => {
  it('two members advance the shared total; contributors expose values + shares with no rank', async () => {
    const db = testDb();
    const fx = await setupChallenge('s3c-coll', {
      challenge_type: 'collective',
      goal_value: 100,
      goal_unit: 'reps',
      activities: [{ canonical_key: 'push-up', metric: 'repetitions', target_value: 20, unit: 'reps' }],
    });
    const rival = await seedMember(db, `coll-rival-${next('m')}`);
    await seedMembership(db, fx.groupId, rival, { status: 'active' });
    await insertEpisode(db, fx.challengeId, fx.memberId, '2026-06-01T00:00:00Z');
    await insertEpisode(db, fx.challengeId, rival, '2026-06-01T00:00:00Z');

    await log(db, fx.memberId, fx.challengeId, fx.pins, logInput({ value: 60 }));
    await log(
      db, rival, fx.challengeId, fx.pins,
      logInput({ value: 70, client_key: next('key'), occurred_at: T('2026-06-11T12:00:00Z') }),
    );

    const authority = stubAuthority(new Set([fx.groupId]));
    const deps = { groupMembershipAuthority: authority };

    // Persisted derived truth: exact sum, overshoot retained, goal reached.
    const oracle = await recomputeChallengeDerived(db, fx.challengeId);
    expect(oracle.challenge.collectiveTotal).toBe(130);
    expect(oracle.challenge.collectiveGoalReached).toBe(true);
    expect(oracle.recordsReplayed).toBe(2);

    // GET detail returns the same truth + own cumulative contribution.
    const detail = await getChallengeDetail(db, fx.memberId, fx.challengeId, deps);
    expect(detail.collectiveTotal).toBe(130);
    expect(detail.collectiveGoalReached).toBe(true);
    expect(detail.goalValue).toBe(100);
    expect(detail.goalUnit).toBe('reps');
    expect(detail.completionsCount).toBe(2);
    expect(detail.myParticipation?.progress.cumulativeTotal).toBe(60);

    // Bounded contributor projection: authoritative values + shares.
    const rollup = await getChallengeContributors(db, fx.memberId, fx.challengeId, deps);
    expect(rollup.challengeType).toBe('collective');
    expect(rollup.collectiveTotal).toBe(130);
    expect(rollup.contributors).toHaveLength(2);
    const byMember = Object.fromEntries(rollup.contributors.map((c) => [c.memberId, c]));
    expect(byMember[fx.memberId].contributionTotal).toBe(60);
    expect(byMember[rival].contributionTotal).toBe(70);
    expect(byMember[fx.memberId].share).toBeCloseTo(60 / 130, 10);
    expect(byMember[rival].share).toBeCloseTo(70 / 130, 10);
    expect(byMember[fx.memberId].share as number + (byMember[rival].share as number)).toBeCloseTo(1, 10);

    // Contribution visibility is NOT a leaderboard: no rank vocabulary.
    for (const entry of rollup.contributors) {
      expect(entry).not.toHaveProperty('position');
      expect(entry).not.toHaveProperty('rank');
      expect(entry).not.toHaveProperty('winner');
    }
    expect(JSON.stringify(rollup)).not.toMatch(/position|rank|winner|podium/i);

    // The competitive leaderboard remains unavailable for Collective.
    await expect(getChallengeLeaderboard(db, fx.memberId, fx.challengeId, deps)).rejects.toMatchObject({
      statusCode: 404,
      code: 'leaderboard_not_available',
    });
  });
});

describe('s3c competitive live state (Race)', () => {
  it('same-instant finishers tie 1,1,3; non-completers null; server positions only', async () => {
    const db = testDb();
    const fx = await setupChallenge('s3c-race', {
      challenge_type: 'competitive',
      activities: [{ canonical_key: 'push-up', metric: 'repetitions', target_value: 50, unit: 'reps' }],
    });
    const tied = await seedMember(db, `race-tie-${next('m')}`);
    const third = await seedMember(db, `race-third-${next('m')}`);
    const open = await seedMember(db, `race-open-${next('m')}`);
    for (const m of [tied, third, open]) await seedMembership(db, fx.groupId, m, { status: 'active' });
    for (const m of [fx.memberId, tied, third, open]) {
      await insertEpisode(db, fx.challengeId, m, '2026-06-01T00:00:00Z');
    }

    // A and tied finish at the SAME acceptance instant -> shared position 1.
    // (Same occurred_at too: the tie is forged by identical accepted_at,
    // which is the documented completion-order authority.)
    const tieInstant = T('2026-06-10T10:00:00Z');
    await log(db, fx.memberId, fx.challengeId, fx.pins,
      logInput({ value: 50, occurred_at: T('2026-06-10T10:00:00Z') }), tieInstant);
    await log(
      db, tied, fx.challengeId, fx.pins,
      logInput({ value: 50, client_key: next('key'), occurred_at: T('2026-06-10T10:00:00Z') }),
      tieInstant,
    );
    await log(
      db, third, fx.challengeId, fx.pins,
      logInput({ value: 50, client_key: next('key'), occurred_at: T('2026-06-10T12:00:00Z') }),
      T('2026-06-10T12:00:00Z'),
    );
    await log(
      db, open, fx.challengeId, fx.pins,
      logInput({ value: 10, client_key: next('key'), occurred_at: T('2026-06-10T13:00:00Z') }),
      T('2026-06-10T13:00:00Z'),
    );

    const deps = { groupMembershipAuthority: stubAuthority(new Set([fx.groupId])) };
    const board = await getChallengeLeaderboard(db, fx.memberId, fx.challengeId, deps);
    expect(board.entries).toHaveLength(4);
    const byMember = Object.fromEntries(board.entries.map((e) => [e.memberId, e]));
    // Standard competition ranking 1,1,3 — NOT dense 1,2,2.
    expect(byMember[fx.memberId].position).toBe(1);
    expect(byMember[tied].position).toBe(1);
    expect(byMember[third].position).toBe(3);
    expect(byMember[open].position).toBeNull();
    expect(byMember[fx.memberId].completionStatus).toBe('completed');
    expect(byMember[open].completionStatus).toBe('in_progress');

    // The pure resolver agrees with the served seam (no client ranking needed).
    const episodes = await db.query<{ participation_id: string; member_id: string }>(
      `SELECT participation_id, member_id FROM challenge_participations WHERE challenge_id = $1`,
      [fx.challengeId],
    );
    const derived = await db.query<{ participation_id: string; completion_status: string; completed_at: string | null }>(
      `SELECT participation_id, completion_status, completed_at FROM challenge_participation_derived`,
    );
    const derivedByEpisode = new Map(derived.rows.map((r) => [String(r.participation_id), r]));
    const expected = computeFinishingPositions(
      episodes.rows.map((e) => {
        const row = derivedByEpisode.get(String(e.participation_id));
        return {
          participation_id: String(e.participation_id),
          completed_at: row && row.completion_status === 'completed' ? String(row.completed_at) : null,
        };
      }),
      episodes.rows.map((e) => String(e.participation_id)),
    );
    for (const e of episodes.rows) {
      const pid = String(e.participation_id);
      expect(byMember[String(e.member_id)].position).toBe(expected[pid]);
    }

    // Own accumulation vs target is visible on detail without a leaderboard.
    const detail = await getChallengeDetail(db, open, fx.challengeId, deps);
    expect(detail.myParticipation?.progress.cumulativeTotal).toBe(10);
    expect(detail.myParticipation?.progress.completionStatus).toBe('in_progress');

    // Contributor rollup (collective-only) stays unavailable for Race.
    await expect(getChallengeContributors(db, fx.memberId, fx.challengeId, deps)).rejects.toMatchObject({
      statusCode: 404,
      code: 'contributors_not_available',
    });
  });
});

describe('s3c streak live state (Daily Streak, Africa/Nairobi)', () => {
  async function streakFixture() {
    const fx = await setupChallenge('s3c-streak', {
      challenge_type: 'streak',
      required_consecutive_days: 3,
      timezone: 'Africa/Nairobi',
      activities: [
        { canonical_key: 'push-up', metric: 'repetitions', target_value: 10, unit: 'reps' },
        { canonical_key: 'bodyweight-squat', metric: 'repetitions', target_value: 10, unit: 'reps' },
      ],
    });
    await insertEpisode(testDb(), fx.challengeId, fx.memberId, '2026-06-01T00:00:00Z');
    return fx;
  }

  function squat(overrides?: Partial<NewChallengeActivityInput>): NewChallengeActivityInput {
    return logInput({ canonical_key: 'bodyweight-squat', client_key: next('key'), ...overrides });
  }

  it('governing today is server-derived in the Challenge timezone, not UTC', async () => {
    const db = testDb();
    const fx = await streakFixture();
    const deps = { groupMembershipAuthority: stubAuthority(new Set([fx.groupId])) };
    // 21:30Z June 10 is 00:30 June 11 in Nairobi: UTC day and governing day differ.
    const detail = await getChallengeDetail(db, fx.memberId, fx.challengeId, {
      ...deps,
      now: T('2026-06-10T21:30:00Z'),
    });
    expect(detail.timezone).toBe('Africa/Nairobi');
    expect(detail.governingToday).toBe('2026-06-11');
    expect(detail.serverNow).toBe(T('2026-06-10T21:30:00Z').toISOString());
  });

  it('partial days do not advance; same-day repeats do not double; miss resets but preserves best', async () => {
    const db = testDb();
    const fx = await streakFixture();
    const deps = { groupMembershipAuthority: stubAuthority(new Set([fx.groupId])) };
    const progress = async () =>
      (await getChallengeDetail(db, fx.memberId, fx.challengeId, deps)).myParticipation?.progress;

    // Day 1 partial (one of two requirements): open but not Done, streak stays 0.
    await log(db, fx.memberId, fx.challengeId, fx.pins,
      logInput({ value: 10, occurred_at: T('2026-06-10T09:00:00Z') }), T('2026-06-10T09:00:00Z'));
    let p = await progress();
    expect(p?.dayStates['2026-06-10']?.complete).toBe(false);
    expect(p?.currentStreak).toBe(0);

    // Day 1 complete (second requirement): streak 1, daysCompleted 1.
    await log(db, fx.memberId, fx.challengeId, fx.pins,
      squat({ value: 10, occurred_at: T('2026-06-10T10:00:00Z') }), T('2026-06-10T10:00:00Z'));
    p = await progress();
    expect(p?.dayStates['2026-06-10']?.complete).toBe(true);
    expect(p?.currentStreak).toBe(1);
    expect(p?.bestStreak).toBe(1);
    expect(p?.daysCompleted).toBe(1);

    // Same-day repeat: accepted (logsAccepted grows) but never double-advances.
    await log(db, fx.memberId, fx.challengeId, fx.pins,
      logInput({ value: 10, client_key: next('key'), occurred_at: T('2026-06-10T11:00:00Z') }),
      T('2026-06-10T11:00:00Z'));
    p = await progress();
    expect(p?.currentStreak).toBe(1);
    expect(p?.daysCompleted).toBe(1);
    expect(p?.logsAccepted).toBe(3);

    // Day 2 complete: consecutive advance to 2.
    await log(db, fx.memberId, fx.challengeId, fx.pins,
      logInput({ value: 10, client_key: next('key'), occurred_at: T('2026-06-11T09:00:00Z') }),
      T('2026-06-11T09:00:00Z'));
    await log(db, fx.memberId, fx.challengeId, fx.pins,
      squat({ value: 10, occurred_at: T('2026-06-11T10:00:00Z') }), T('2026-06-11T10:00:00Z'));
    p = await progress();
    expect(p?.currentStreak).toBe(2);
    expect(p?.bestStreak).toBe(2);

    // Skip June 12 entirely; June 13 resets current to 1, preserves best, daysCompleted cumulative.
    await log(db, fx.memberId, fx.challengeId, fx.pins,
      logInput({ value: 10, client_key: next('key'), occurred_at: T('2026-06-13T09:00:00Z') }),
      T('2026-06-13T09:00:00Z'));
    await log(db, fx.memberId, fx.challengeId, fx.pins,
      squat({ value: 10, occurred_at: T('2026-06-13T10:00:00Z') }), T('2026-06-13T10:00:00Z'));
    p = await progress();
    expect(p?.currentStreak).toBe(1);
    expect(p?.bestStreak).toBe(2);
    expect(p?.daysCompleted).toBe(3);

    // Drive to the required 3 consecutive (13th, 14th, 15th): live NEVER terminally complete.
    for (const day of ['2026-06-14', '2026-06-15']) {
      await log(db, fx.memberId, fx.challengeId, fx.pins,
        logInput({ value: 10, client_key: next('key'), occurred_at: T(`${day}T09:00:00Z`) }),
        T(`${day}T09:00:00Z`));
      await log(db, fx.memberId, fx.challengeId, fx.pins,
        squat({ value: 10, occurred_at: T(`${day}T10:00:00Z`) }), T(`${day}T10:00:00Z`));
    }
    p = await progress();
    expect(p?.currentStreak).toBe(3);
    expect(p?.completionStatus).toBe('in_progress');
    expect(p?.completedAt).toBeNull();
  });

  it('closed-day logging is fail-closed with no derived effect', async () => {
    const db = testDb();
    const fx = await streakFixture();
    const deps = { groupMembershipAuthority: stubAuthority(new Set([fx.groupId])) };
    await log(db, fx.memberId, fx.challengeId, fx.pins,
      logInput({ value: 10, occurred_at: T('2026-06-10T09:00:00Z') }), T('2026-06-10T09:00:00Z'));
    await log(db, fx.memberId, fx.challengeId, fx.pins,
      squat({ value: 10, occurred_at: T('2026-06-10T10:00:00Z') }), T('2026-06-10T10:00:00Z'));
    const before = await getChallengeDetail(db, fx.memberId, fx.challengeId, deps);

    // June 10 has closed (acceptance clock June 12): late logging rejected.
    await expect(
      log(db, fx.memberId, fx.challengeId, fx.pins,
        logInput({ value: 10, client_key: next('key'), occurred_at: T('2026-06-10T11:00:00Z') }),
        T('2026-06-12T09:00:00Z')),
    ).rejects.toMatchObject({ statusCode: 422, code: 'streak_day_closed' });

    const after = await getChallengeDetail(db, fx.memberId, fx.challengeId, deps);
    expect(after.myParticipation?.progress).toEqual(before.myParticipation?.progress);
    expect(after.myParticipation?.progress.logsAccepted).toBe(2);
  });
});

describe('s3c contributors HTTP route', () => {
  function appFor(tokens: Record<string, string>, authority: GroupMembershipAuthority) {
    return buildTestApp(tokens, { challengeActivity: { groupMembershipAuthority: authority } });
  }

  it('serves contributors for collective; 404 for competitive and streak', async () => {
    const db = testDb();
    const coll = await setupChallenge('s3c-http-coll', {
      challenge_type: 'collective',
      goal_value: 50,
      goal_unit: 'reps',
      activities: [{ canonical_key: 'push-up', metric: 'repetitions', target_value: 10, unit: 'reps' }],
    });
    await insertEpisode(db, coll.challengeId, coll.memberId, '2026-06-01T00:00:00Z');
    await log(db, coll.memberId, coll.challengeId, coll.pins, logInput({ value: 25 }));

    const comp = await setupChallenge('s3c-http-comp', {
      challenge_type: 'competitive',
      activities: [{ canonical_key: 'push-up', metric: 'repetitions', target_value: 10, unit: 'reps' }],
    });
    const streak = await setupChallenge('s3c-http-streak', {
      challenge_type: 'streak',
      required_consecutive_days: 5,
      activities: [{ canonical_key: 'push-up', metric: 'repetitions', target_value: 10, unit: 'reps' }],
    });

    const subject = await db.query<{ auth_subject: string }>(
      `SELECT auth_subject FROM members WHERE member_id = $1`,
      [coll.memberId],
    );
    const app = appFor(
      { 'token-s3c': String(subject.rows[0].auth_subject) },
      stubAuthority(new Set([coll.groupId])),
    );
    const ok = await app.inject({
      method: 'GET',
      url: `/v1/challenges/${coll.challengeId}/contributors`,
      headers: authHeaders('token-s3c'),
    });
    expect(ok.statusCode).toBe(200);
    const body = ok.json() as {
      challengeType: string;
      collectiveTotal: number;
      contributors: Array<Record<string, unknown>>;
    };
    expect(body.challengeType).toBe('collective');
    expect(body.collectiveTotal).toBe(25);
    expect(body.contributors).toHaveLength(1);
    expect(body.contributors[0]).not.toHaveProperty('position');

    // Admit the member to all three groups (PG shadow + live stub) so the
    // type gate itself is proven: 404 contributors_not_available, not a
    // visibility 404.
    await seedMembership(db, comp.groupId, coll.memberId, { status: 'active' });
    await seedMembership(db, streak.groupId, coll.memberId, { status: 'active' });
    const appAll = appFor(
      { 'token-s3c': String(subject.rows[0].auth_subject) },
      stubAuthority(new Set([coll.groupId, comp.groupId, streak.groupId])),
    );
    for (const id of [comp.challengeId, streak.challengeId]) {
      const res = await appAll.inject({
        method: 'GET',
        url: `/v1/challenges/${id}/contributors`,
        headers: authHeaders('token-s3c'),
      });
      expect(res.statusCode).toBe(404);
      expect(String(res.body)).toContain('contributors_not_available');
    }
  });
});
