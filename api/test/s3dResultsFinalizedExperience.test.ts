import { beforeEach, describe, expect, it } from 'vitest';
import {
  activateChallenge,
  createChallenge,
  endChallenge,
  type ChallengeCreationResolvers,
  type NewChallengeInput,
} from '../src/challenges.js';
import {
  applyChallengeActivity,
  type ChallengeActivityResolvers,
  type NewChallengeActivityInput,
} from '../src/challengeActivityApplication.js';
import {
  finalizeChallenge,
  getParticipationFinals,
} from '../src/challengeFinalization.js';
import {
  getChallengeDetail,
  getChallengeLeaderboard,
} from '../src/challengeReads.js';
import {
  authHeaders,
  buildTestApp,
  seedGroup,
  seedMember,
  seedMembership,
  stubEligibility,
  testDb,
} from './helpers.js';
import type { Db } from '../src/db.js';

/**
 * TIIZI-S3D-RESULTS-FINALIZED-EXPERIENCE-001 — finalized read-model regressions.
 *
 * Proves the S3d bounded read projection over real production seams:
 *   T-1  finalized Together read shape (total/goal/reached + frozen result),
 *        including goal-not-reached reported as the actual result (overshoot
 *        preserved when reached);
 *   T-2  finalized Streak read exposes the FROZEN final block, and the served
 *        live `currentStreak` is allowed to differ from the frozen
 *        `finalStreak` (never substituted);
 *   T-3  ended-not-finalized shape per type (finalResult null, final null);
 *   T-4  window-expired-unprocessed detail shape + logging rejected over HTTP;
 *   T-5  finalized Race detail: ties (1,1,3), non-finisher null, board keeps
 *        actual progress for positionless entries;
 *   T-8  no partial exposure before finalization (finalPosition/final null);
 *   PR#41 member identity: Race detail result comes from the governing
 *        (earliest completed) episode, one entry per member.
 *
 * T-6 (multi-episode finalization) and T-7 (finals immutability) are delivered
 * by PR #41 (api/test/s3dRaceMemberIdentity.test.ts) and are not duplicated.
 */

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
    [name],
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

function activityResolvers(pins: Record<string, Pin>): ChallengeActivityResolvers {
  return {
    resolveKnowledgePin: async (key) => pins[key] ?? null,
    resolveGroupMembershipAuthority: async () => ({ status: 'active', eligible: true }),
  };
}

const allEligible = { resolveGroupMembershipAuthority: async () => ({ status: 'active', eligible: true }) };
const auth = { groupMembershipAuthority: allEligible };

interface Setup {
  db: Db;
  groupId: string;
  challengeId: string;
  pins: Record<string, Pin>;
  members: Record<string, string>;
  tokens: Record<string, string>;
}

async function setupChallenge(
  input: Omit<NewChallengeInput, 'group_id' | 'created_by_member_id' | 'title' | 'start_date' | 'end_date'> & {
    title?: string;
    start_date?: string;
    end_date?: string;
    names: string[];
  },
): Promise<Setup> {
  const db = testDb();
  const { names, title, start_date, end_date, ...rest } = input;
  const tag = next('s3d-results');
  const members: Record<string, string> = {};
  const tokens: Record<string, string> = {};
  for (const name of names) {
    const subject = `${tag}-${name}`;
    members[name] = await seedMember(db, subject);
    tokens[`tok-${subject}`] = subject;
  }
  const groupId = await seedGroup(db, { name: `S3d Results Group ${tag}` });
  for (const memberId of Object.values(members)) {
    await seedMembership(db, groupId, memberId, { status: 'active' });
  }
  const pins: Record<string, Pin> = {};
  for (const activity of input.activities) {
    if (!pins[activity.canonical_key]) pins[activity.canonical_key] = await seedKnowledge(db, activity.canonical_key);
  }
  const { challenge } = await createChallenge(
    db,
    {
      group_id: groupId,
      created_by_member_id: members[names[0]],
      title: title ?? `S3d Results ${tag}`,
      start_date: start_date ?? '2026-06-01',
      end_date: end_date ?? '2026-06-05',
      ...rest,
    } as NewChallengeInput,
    creationResolvers(pins),
  );
  await activateChallenge(db, challenge.challenge_id);
  return { db, groupId, challengeId: challenge.challenge_id, pins, members, tokens };
}

async function insertEpisode(
  db: Db,
  challengeId: string,
  memberId: string,
  joinedAt = '2026-06-01T00:00:00Z',
  status: 'active' | 'withdrawn' | 'removed' = 'active',
): Promise<string> {
  const result = await db.query<{ participation_id: string }>(
    `INSERT INTO challenge_participations
       (challenge_id, member_id, status, joined_at, joined_config_version, exited_at, exit_reason)
     VALUES ($1, $2, $3, $4, 1, $5, $6)
     RETURNING participation_id`,
    [challengeId, memberId, status, joinedAt, status === 'active' ? null : joinedAt, status === 'active' ? null : 'withdrawn'],
  );
  return String(result.rows[0].participation_id);
}

async function log(
  setup: Setup,
  memberId: string,
  value: number,
  occurredAtIso: string,
  nowIso: string,
  activity = 'push-up',
): Promise<void> {
  await applyChallengeActivity(
    setup.db,
    memberId,
    setup.challengeId,
    {
      activity_kind: 'fitness',
      canonical_key: activity,
      value,
      unit: 'reps',
      occurred_at: T(occurredAtIso),
      client_key: next('key'),
    } as NewChallengeActivityInput,
    activityResolvers(setup.pins),
    { now: T(nowIso) },
  );
}

async function detailFor(setup: Setup, memberId: string) {
  return getChallengeDetail(setup.db, memberId, setup.challengeId, auth);
}

// ─── T-1 / T-8 Together ────────────────────────────────────────────────────

describe('S3d T-1 Together finalized read', () => {
  it('overshoot preserved, frozen aggregate exposed, own contribution projected', async () => {
    const setup = await setupChallenge({
      names: ['A'],
      challenge_type: 'collective',
      goal_value: 100,
      goal_unit: 'reps',
      activities: [{ canonical_key: 'push-up', metric: 'repetitions', target_value: 20, unit: 'reps' }],
    });
    const ep = await insertEpisode(setup.db, setup.challengeId, setup.members.A);
    await log(setup, setup.members.A, 60, '2026-06-02T12:00:00Z', '2026-06-02T12:00:00Z');
    await log(setup, setup.members.A, 50, '2026-06-02T13:00:00Z', '2026-06-02T13:00:00Z');
    await finalizeChallenge(setup.db, setup.challengeId, T('2026-06-10T12:00:00Z'));

    const detail = await detailFor(setup, setup.members.A);
    expect(detail.status).toBe('ended');
    expect(detail.finalized).toBe(true);
    expect(detail.finalizedAt).not.toBeNull();
    expect(detail.collectiveTotal).toBe(110);
    expect(detail.collectiveGoalReached).toBe(true);
    // Frozen terminal aggregate.
    expect(detail.finalResult?.result.collective_total).toBe(110);
    expect(detail.finalResult?.result.collective_goal_reached).toBe(true);
    expect(typeof detail.finalResult?.result.goal_completed_at).toBe('string');
    expect(detail.finalResult?.result.completions_count).toBe(1);
    // Frozen per-participation block over the display episode.
    expect(detail.myParticipation?.participationId).toBe(ep);
    expect(detail.myParticipation?.progress.cumulativeTotal).toBe(110);
    expect(detail.myParticipation?.final?.completed).toBe(true);
    expect(detail.myParticipation?.final?.finalizedAt).toBe(detail.finalizedAt);
  });

  it('goal not reached at expiry reports the actual result (never a failure label)', async () => {
    const setup = await setupChallenge({
      names: ['A'],
      challenge_type: 'collective',
      goal_value: 100,
      goal_unit: 'reps',
      activities: [{ canonical_key: 'push-up', metric: 'repetitions', target_value: 20, unit: 'reps' }],
    });
    await insertEpisode(setup.db, setup.challengeId, setup.members.A);
    await log(setup, setup.members.A, 40, '2026-06-02T12:00:00Z', '2026-06-02T12:00:00Z');
    const result = await finalizeChallenge(setup.db, setup.challengeId, T('2026-06-10T12:00:00Z'));
    expect(result.challenge.status).toBe('ended');

    const detail = await detailFor(setup, setup.members.A);
    expect(detail.collectiveTotal).toBe(40);
    expect(detail.collectiveGoalReached).toBe(false);
    expect(detail.finalResult?.result.collective_total).toBe(40);
    expect(detail.finalResult?.result.collective_goal_reached).toBe(false);
    expect(detail.finalResult?.result.goal_completed_at ?? null).toBeNull();
  });
});

// ─── T-2 Streak finalized read ─────────────────────────────────────────────

describe('S3d T-2 Streak finalized read', () => {
  it('exposes frozen finalStreak; served currentStreak may differ and is never substituted', async () => {
    const setup = await setupChallenge({
      names: ['A'],
      challenge_type: 'streak',
      required_consecutive_days: 3,
      reset_on_miss: true,
      end_date: '2026-06-05',
      activities: [{ canonical_key: 'push-up', metric: 'repetitions', target_value: 20, unit: 'reps' }],
    });
    await insertEpisode(setup.db, setup.challengeId, setup.members.A);
    // Days 1–3 complete, then nothing logged: the terminal day (06-05) run is 0.
    await log(setup, setup.members.A, 20, '2026-06-01T12:00:00Z', '2026-06-01T12:00:00Z');
    await log(setup, setup.members.A, 20, '2026-06-02T12:00:00Z', '2026-06-02T12:00:00Z');
    await log(setup, setup.members.A, 20, '2026-06-03T12:00:00Z', '2026-06-03T12:00:00Z');
    await finalizeChallenge(setup.db, setup.challengeId, T('2026-06-10T12:00:00Z'));

    const detail = await detailFor(setup, setup.members.A);
    expect(detail.finalized).toBe(true);
    const final = detail.myParticipation?.final;
    expect(final).not.toBeNull();
    expect(final?.completed).toBe(true);
    expect(final?.completedAt).toBe(detail.finalizedAt);
    expect(final?.bestStreak).toBe(3);
    expect(final?.daysCompleted).toBe(3);
    // The frozen Final Streak is the governed terminal run — 0 here.
    expect(final?.finalStreak).toBe(0);
    // Regression: the LIVE currentStreak (3) can contradict the frozen final (0).
    expect(detail.myParticipation?.progress.currentStreak).toBe(3);
    expect(detail.myParticipation?.progress.currentStreak).not.toBe(final?.finalStreak);
    // Streaks carry no rank at all.
    expect(final?.finalPosition).toBeNull();
    expect(detail.myParticipation?.progress.finalPosition).toBeNull();
  });
});

// ─── T-3 / T-4 / T-8 lifecycle shapes ──────────────────────────────────────

describe('S3d lifecycle states', () => {
  it('T-3 ended-not-finalized: finalResult null and final block null (all types)', async () => {
    for (const type of ['collective', 'competitive', 'streak'] as const) {
      const setup = await setupChallenge({
        names: ['A'],
        challenge_type: type,
        ...(type === 'collective' ? { goal_value: 100, goal_unit: 'reps' } : {}),
        ...(type === 'streak' ? { required_consecutive_days: 3, reset_on_miss: true } : {}),
        activities: [{ canonical_key: 'push-up', metric: 'repetitions', target_value: 20, unit: 'reps' }],
      });
      await insertEpisode(setup.db, setup.challengeId, setup.members.A);
      await log(setup, setup.members.A, 20, '2026-06-02T12:00:00Z', '2026-06-02T12:00:00Z');
      await endChallenge(setup.db, setup.challengeId);
      const detail = await detailFor(setup, setup.members.A);
      expect(detail.status).toBe('ended');
      expect(detail.finalized).toBe(false);
      expect(detail.finalizedAt).toBeNull();
      expect(detail.finalResult).toBeNull();
      expect(detail.myParticipation?.final).toBeNull();
      expect(detail.myParticipation?.progress.finalPosition).toBeNull();
      if (type === 'streak') {
        // ended-unfinalized streak must not read as "not completed".
        expect(detail.myParticipation?.progress.completionStatus).toBe('in_progress');
      }
    }
  });

  it('T-4 window-expired-unprocessed: detail shape + HTTP logging rejection', async () => {
    const setup = await setupChallenge({
      names: ['A'],
      end_date: '2026-06-05',
      challenge_type: 'competitive',
      activities: [{ canonical_key: 'push-up', metric: 'repetitions', target_value: 20, unit: 'reps' }],
    });
    await insertEpisode(setup.db, setup.challengeId, setup.members.A);
    // Window is expired (server day 2026-06-10 > 2026-06-05) but not processed.
    const detail = await getChallengeDetail(
      setup.db, setup.members.A, setup.challengeId, { ...auth, now: T('2026-06-10T12:00:00Z') },
    );
    expect(detail.status).toBe('active');
    expect(detail.finalized).toBe(false);
    expect(detail.governingToday).toBe('2026-06-10');
    expect(detail.endDate).toBe('2026-06-05');
    expect(detail.governingToday > detail.endDate).toBe(true);
    expect(detail.finalResult).toBeNull();

    // Logging rejected over the real HTTP route with challenge_not_active.
    const app = buildTestApp(setup.tokens, { challengeActivity: { groupMembershipAuthority: allEligible } });
    const denied = await app.inject({
      method: 'POST',
      url: `/v1/challenges/${setup.challengeId}/activity`,
      headers: authHeaders(Object.keys(setup.tokens)[0]),
      payload: {
        activity_kind: 'fitness',
        canonical_key: setup.pins['push-up'].knowledge_id,
        value: 20,
        unit: 'reps',
        occurred_at: '2026-06-10T12:00:00Z',
        occurred_tz: 'UTC',
        client_key: next('http-key'),
      },
    });
    expect(denied.statusCode).toBe(422);
    expect((denied.json() as { error: { code: string } }).error.code).toBe('challenge_not_active');
  });

  it('T-8 no partial exposure: unfinalized detail never populates a final position', async () => {
    const setup = await setupChallenge({
      names: ['A', 'B'],
      challenge_type: 'competitive',
      activities: [{ canonical_key: 'push-up', metric: 'repetitions', target_value: 10, unit: 'reps' }],
    });
    await insertEpisode(setup.db, setup.challengeId, setup.members.A);
    await insertEpisode(setup.db, setup.challengeId, setup.members.B);
    await log(setup, setup.members.A, 10, '2026-06-02T12:00:00Z', '2026-06-02T12:00:00Z');
    const detail = await detailFor(setup, setup.members.A);
    expect(detail.finalized).toBe(false);
    expect(detail.myParticipation?.final).toBeNull();
    expect(detail.myParticipation?.progress.finalPosition).toBeNull();
    expect(detail.myParticipation?.progress.completionStatus).toBe('completed');
  });
});

// ─── T-5 Race finalized read (ties + non-finishers) ────────────────────────

describe('S3d T-5 Race finalized read', () => {
  it('ties rank 1,1,3; non-finishers have null position with actual progress kept', async () => {
    const setup = await setupChallenge({
      names: ['A', 'B', 'C', 'D'],
      end_date: '2026-06-30',
      challenge_type: 'competitive',
      activities: [{ canonical_key: 'push-up', metric: 'repetitions', target_value: 10, unit: 'reps' }],
    });
    await insertEpisode(setup.db, setup.challengeId, setup.members.A);
    await insertEpisode(setup.db, setup.challengeId, setup.members.B);
    await insertEpisode(setup.db, setup.challengeId, setup.members.C);
    await insertEpisode(setup.db, setup.challengeId, setup.members.D);
    // A and B tie on the same acceptance instant; C finishes later; D partial.
    await log(setup, setup.members.A, 10, '2026-06-02T10:00:00Z', '2026-06-02T10:00:00Z');
    await log(setup, setup.members.B, 10, '2026-06-02T10:00:00Z', '2026-06-02T10:00:00Z');
    await log(setup, setup.members.C, 10, '2026-06-02T11:00:00Z', '2026-06-02T11:00:00Z');
    await log(setup, setup.members.D, 4, '2026-06-02T12:00:00Z', '2026-06-02T12:00:00Z');
    await finalizeChallenge(setup.db, setup.challengeId, T('2026-07-10T12:00:00Z'));

    // Frozen per-participation positions: standard competition ranking.
    const finals = [...(await getParticipationFinals(setup.db, setup.challengeId)).values()];
    const positionByMember = new Map(finals.map((f) => [f.member_id, f.final_position]));
    expect(positionByMember.get(setup.members.A)).toBe(1);
    expect(positionByMember.get(setup.members.B)).toBe(1);
    expect(positionByMember.get(setup.members.C)).toBe(3);
    expect(positionByMember.get(setup.members.D)).toBeNull();

    const board = await getChallengeLeaderboard(setup.db, setup.members.A, setup.challengeId, auth);
    expect(board.entries).toHaveLength(4);
    const a = board.entries.find((e) => e.memberId === setup.members.A)!;
    const d = board.entries.find((e) => e.memberId === setup.members.D)!;
    expect(a.position).toBe(1);
    expect(d.position).toBeNull();
    expect(d.cumulativeTotal).toBe(4);
    expect(d.completionStatus).toBe('in_progress');
    // Served frozen standings are ordered: 1, 1, 3, then the non-finisher.
    expect(board.entries.map((e) => e.position)).toEqual([1, 1, 3, null]);

    // Own detail result for a non-finisher: no position, actual progress.
    const dDetail = await detailFor(setup, setup.members.D);
    expect(dDetail.myParticipation?.final?.completed).toBe(false);
    expect(dDetail.myParticipation?.final?.finalPosition).toBeNull();
    expect(dDetail.myParticipation?.progress.cumulativeTotal).toBe(4);
  });

  it('PR #41 member identity: result comes from the governing (earliest completed) episode', async () => {
    const setup = await setupChallenge({
      names: ['A', 'B', 'C'],
      end_date: '2026-06-30',
      challenge_type: 'competitive',
      activities: [{ canonical_key: 'push-up', metric: 'repetitions', target_value: 10, unit: 'reps' }],
    });
    const a1 = await insertEpisode(setup.db, setup.challengeId, setup.members.A, '2026-06-01T00:00:00Z');
    await insertEpisode(setup.db, setup.challengeId, setup.members.B);
    await insertEpisode(setup.db, setup.challengeId, setup.members.C);
    // A finishes in episode 1, leaves, rejoins (episode 2, unfinished).
    await log(setup, setup.members.A, 10, '2026-06-02T10:00:00Z', '2026-06-02T10:00:00Z');
    const withdrawn = await setup.db.query<{ participation_id: string }>(
      `UPDATE challenge_participations SET status = 'withdrawn', exited_at = now(), exit_reason = 'withdrawn'
       WHERE participation_id = $1 RETURNING participation_id`,
      [a1],
    );
    expect(withdrawn.rows).toHaveLength(1);
    await insertEpisode(setup.db, setup.challengeId, setup.members.A, '2026-06-02T11:00:00Z');
    await log(setup, setup.members.B, 10, '2026-06-02T12:00:00Z', '2026-06-02T12:00:00Z');
    await log(setup, setup.members.C, 4, '2026-06-02T13:00:00Z', '2026-06-02T13:00:00Z');
    await finalizeChallenge(setup.db, setup.challengeId, T('2026-07-10T12:00:00Z'));

    const detail = await detailFor(setup, setup.members.A);
    // One competitive identity: the governing episode's frozen result.
    expect(detail.myParticipation?.final?.completed).toBe(true);
    expect(detail.myParticipation?.final?.finalPosition).toBe(1);
    expect(detail.myParticipation?.progress.finalPosition).toBe(1);

    const board = await getChallengeLeaderboard(setup.db, setup.members.A, setup.challengeId, auth);
    const memberRows = board.entries.filter((e) => e.memberId === setup.members.A);
    expect(memberRows).toHaveLength(1);
    expect(memberRows[0].position).toBe(1);
    // The board's participationId is the member's CURRENT episode (identity),
    // not necessarily the episode that earned the result.
    expect(memberRows[0].participationId).not.toBe(a1);
    const completions = await setup.db.query<{ result: unknown }>(
      'SELECT result FROM challenge_finalizations WHERE challenge_id = $1',
      [setup.challengeId],
    );
    const payload = typeof completions.rows[0].result === 'string'
      ? JSON.parse(completions.rows[0].result as string)
      : (completions.rows[0].result as Record<string, unknown>);
    expect(payload.completions_count).toBe(2);
  });
});
