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
import { finalizeChallenge } from '../src/challengeFinalization.js';
import {
  ChallengeReadError,
  getChallengeContributors,
  getChallengeDetail,
  getChallengeLeaderboard,
} from '../src/challengeReads.js';
import type { GroupMembershipAuthority } from '../src/groupMembershipAuthority.js';
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
 * TIIZI-S3D-RESULTS-FINALIZED-EXPERIENCE-CORR-001 — blocking ITR-001 findings.
 *
 * A. an active-status Challenge whose governed server day is past endDate can
 *    no longer accept POST /join (and no participation episode is created);
 * B. a Challenge that is no longer participation-mutable (window-expired,
 *    ended, or finalized) can no longer accept POST /withdraw, and a rejected
 *    withdrawal leaves the episode unchanged;
 * F/G/H. a finalized result is sourced from sealed / immutable-reconstructed
 *    truth and cannot diverge when the mutable derived projection is tampered;
 * I. missing frozen truth fails closed instead of substituting live values.
 *
 * These are production-seam tests: real domain/read functions and real HTTP
 * routes over PGlite. They are discriminating — they FAIL against the
 * pre-correction PR #42 implementation.
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

const allEligible: GroupMembershipAuthority = {
  resolveGroupMembershipAuthority: async () => ({ status: 'active', eligible: true }),
};
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
  const tag = next('s3d-corr');
  const members: Record<string, string> = {};
  const tokens: Record<string, string> = {};
  for (const name of names) {
    const subject = `${tag}-${name}`;
    members[name] = await seedMember(db, subject);
    tokens[name] = subject;
  }
  const groupId = await seedGroup(db, { name: `S3d CORR Group ${tag}` });
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
      title: title ?? `S3d CORR ${tag}`,
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

async function log(
  setup: Setup,
  memberId: string,
  value: number,
  occurredAtIso: string,
  nowIso: string,
): Promise<void> {
  await applyChallengeActivity(
    setup.db,
    memberId,
    setup.challengeId,
    {
      activity_kind: 'fitness',
      canonical_key: 'push-up',
      value,
      unit: 'reps',
      occurred_at: T(occurredAtIso),
      client_key: next('key'),
    } as NewChallengeActivityInput,
    activityResolvers(setup.pins),
    { now: T(nowIso) },
  );
}

async function episodeRow(db: Db, participationId: string) {
  const result = await db.query<{ status: string; exited_at: string | Date | null }>(
    `SELECT status, exited_at FROM challenge_participations WHERE participation_id = $1`,
    [participationId],
  );
  return result.rows[0];
}

/** Tamper the mutable derived projections (the ITR-001 attack seam). */
async function tamperDerived(db: Db, challengeId: string, value: number): Promise<void> {
  await db.query(
    `UPDATE challenge_derived_state
     SET collective_total = $2::double precision, collective_goal_reached = true,
         completions_count = 999, goal_completed_at = now(), updated_at = now()
     WHERE challenge_id = $1`,
    [challengeId, value],
  );
  await db.query(
    `UPDATE challenge_participation_derived
     SET cumulative_total = $2::double precision, total_points = 999,
         current_streak = 999, best_streak = 999,
         day_states = '{"2026-06-01":{"complete":true,"activities":["999"]}}'::jsonb,
         updated_at = now()
     WHERE challenge_id = $1`,
    [challengeId, value],
  );
}

// ─── A. Join lifecycle authority ────────────────────────────────────────────

describe('CORR-001 A — server-authoritative join lifecycle', () => {
  it('rejects an active-status Challenge whose governed day is past endDate, creating no episode', async () => {
    const setup = await setupChallenge({
      names: ['A'],
      end_date: '2026-06-05',
      challenge_type: 'competitive',
      activities: [{ canonical_key: 'push-up', metric: 'repetitions', target_value: 10, unit: 'reps' }],
    });
    const app = buildTestApp(
      { 'token-a': setup.tokens.A },
      {
        participation: {
          groupMembershipAuthority: allEligible,
          now: T('2026-06-10T12:00:00Z'),
        },
      },
    );
    const response = await app.inject({
      method: 'POST',
      url: `/v1/challenges/${setup.challengeId}/join`,
      headers: authHeaders('token-a'),
    });
    expect(response.statusCode).toBe(422);
    expect((response.json() as { error: { code: string } }).error.code).toBe('challenge_ended');

    const rows = await setup.db.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM challenge_participations WHERE challenge_id = $1 AND member_id = $2`,
      [setup.challengeId, setup.members.A],
    );
    expect(Number(rows.rows[0].count)).toBe(0);
  });

  it('ordinary active/in-window join remains unchanged', async () => {
    const setup = await setupChallenge({
      names: ['A'],
      end_date: '2026-06-05',
      challenge_type: 'competitive',
      activities: [{ canonical_key: 'push-up', metric: 'repetitions', target_value: 10, unit: 'reps' }],
    });
    const app = buildTestApp(
      { 'token-a': setup.tokens.A },
      {
        participation: {
          groupMembershipAuthority: allEligible,
          now: T('2026-06-03T12:00:00Z'),
        },
      },
    );
    const response = await app.inject({
      method: 'POST',
      url: `/v1/challenges/${setup.challengeId}/join`,
      headers: authHeaders('token-a'),
    });
    expect(response.statusCode).toBe(200);
    expect((response.json() as { status: string }).status).toBe('active');
    const rows = await setup.db.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM challenge_participations WHERE challenge_id = $1 AND member_id = $2`,
      [setup.challengeId, setup.members.A],
    );
    expect(Number(rows.rows[0].count)).toBe(1);
  });
});

// ─── B. Withdrawal lifecycle authority ──────────────────────────────────────

describe('CORR-001 B — server-authoritative withdrawal lifecycle', () => {
  it('active/in-window withdrawal still succeeds', async () => {
    const setup = await setupChallenge({
      names: ['A'],
      end_date: '2026-06-05',
      challenge_type: 'competitive',
      activities: [{ canonical_key: 'push-up', metric: 'repetitions', target_value: 10, unit: 'reps' }],
    });
    const participationId = await insertEpisode(setup.db, setup.challengeId, setup.members.A);
    const app = buildTestApp(
      { 'token-a': setup.tokens.A },
      {
        participation: {
          groupMembershipAuthority: allEligible,
          now: T('2026-06-03T12:00:00Z'),
        },
      },
    );
    const response = await app.inject({
      method: 'POST',
      url: `/v1/challenges/${setup.challengeId}/withdraw`,
      headers: authHeaders('token-a'),
    });
    expect(response.statusCode).toBe(200);
    expect((response.json() as { status: string }).status).toBe('withdrawn');
    expect((await episodeRow(setup.db, participationId)).status).toBe('withdrawn');
  });

  it('active/window-expired withdrawal is rejected and leaves the episode unchanged', async () => {
    const setup = await setupChallenge({
      names: ['A'],
      end_date: '2026-06-05',
      challenge_type: 'competitive',
      activities: [{ canonical_key: 'push-up', metric: 'repetitions', target_value: 10, unit: 'reps' }],
    });
    const participationId = await insertEpisode(setup.db, setup.challengeId, setup.members.A);
    const app = buildTestApp(
      { 'token-a': setup.tokens.A },
      {
        participation: {
          groupMembershipAuthority: allEligible,
          now: T('2026-06-10T12:00:00Z'),
        },
      },
    );
    const response = await app.inject({
      method: 'POST',
      url: `/v1/challenges/${setup.challengeId}/withdraw`,
      headers: authHeaders('token-a'),
    });
    expect(response.statusCode).toBe(422);
    expect((response.json() as { error: { code: string } }).error.code).toBe('challenge_ended');
    const after = await episodeRow(setup.db, participationId);
    expect(after.status).toBe('active');
    expect(after.exited_at).toBeNull();
  });

  it('ended/not-finalized withdrawal is rejected and leaves the episode unchanged', async () => {
    const setup = await setupChallenge({
      names: ['A'],
      end_date: '2026-06-30',
      challenge_type: 'competitive',
      activities: [{ canonical_key: 'push-up', metric: 'repetitions', target_value: 10, unit: 'reps' }],
    });
    const participationId = await insertEpisode(setup.db, setup.challengeId, setup.members.A);
    await endChallenge(setup.db, setup.challengeId);
    const app = buildTestApp(
      { 'token-a': setup.tokens.A },
      {
        participation: {
          groupMembershipAuthority: allEligible,
          now: T('2026-06-15T12:00:00Z'),
        },
      },
    );
    const response = await app.inject({
      method: 'POST',
      url: `/v1/challenges/${setup.challengeId}/withdraw`,
      headers: authHeaders('token-a'),
    });
    expect(response.statusCode).toBe(422);
    expect((response.json() as { error: { code: string } }).error.code).toBe('challenge_ended');
    const after = await episodeRow(setup.db, participationId);
    expect(after.status).toBe('active');
    expect(after.exited_at).toBeNull();
  });

  it('finalized withdrawal is rejected and leaves the episode unchanged', async () => {
    const setup = await setupChallenge({
      names: ['A'],
      end_date: '2026-06-05',
      challenge_type: 'competitive',
      activities: [{ canonical_key: 'push-up', metric: 'repetitions', target_value: 10, unit: 'reps' }],
    });
    const participationId = await insertEpisode(setup.db, setup.challengeId, setup.members.A);
    await log(setup, setup.members.A, 10, '2026-06-02T10:00:00Z', '2026-06-02T10:00:00Z');
    await finalizeChallenge(setup.db, setup.challengeId, T('2026-06-10T12:00:00Z'));
    const app = buildTestApp(
      { 'token-a': setup.tokens.A },
      {
        participation: {
          groupMembershipAuthority: allEligible,
          now: T('2026-06-15T12:00:00Z'),
        },
      },
    );
    const response = await app.inject({
      method: 'POST',
      url: `/v1/challenges/${setup.challengeId}/withdraw`,
      headers: authHeaders('token-a'),
    });
    expect(response.statusCode).toBe(422);
    expect((response.json() as { error: { code: string } }).error.code).toBe('challenge_ended');
    const after = await episodeRow(setup.db, participationId);
    expect(after.status).toBe('active');
    expect(after.exited_at).toBeNull();
  });
});

// ─── F. Finalized Collective cannot diverge ─────────────────────────────────

describe('CORR-001 F — finalized Collective is sealed against mutable-derived tampering', () => {
  it('frozen total + reconstructed contributors stay at 40 after derived rows are tampered to 999', async () => {
    const setup = await setupChallenge({
      names: ['A', 'B'],
      challenge_type: 'collective',
      goal_value: 100,
      goal_unit: 'reps',
      activities: [{ canonical_key: 'push-up', metric: 'repetitions', target_value: 20, unit: 'reps' }],
    });
    await insertEpisode(setup.db, setup.challengeId, setup.members.A);
    await insertEpisode(setup.db, setup.challengeId, setup.members.B);
    await log(setup, setup.members.A, 25, '2026-06-02T12:00:00Z', '2026-06-02T12:00:00Z');
    await log(setup, setup.members.B, 15, '2026-06-02T13:00:00Z', '2026-06-02T13:00:00Z');
    await finalizeChallenge(setup.db, setup.challengeId, T('2026-06-10T12:00:00Z'));

    // ITR attack: recompute/alter the mutable derived projection to 999.
    await tamperDerived(setup.db, setup.challengeId, 999);

    const detail = await getChallengeDetail(setup.db, setup.members.A, setup.challengeId, auth);
    expect(detail.finalized).toBe(true);
    expect(detail.collectiveTotal).toBe(40);
    expect(detail.finalResult?.result.collective_total).toBe(40);
    expect(detail.myParticipation?.progress.cumulativeTotal).toBe(25);
    expect(detail.myParticipation?.final?.finalizedAt).toBe(detail.finalizedAt);

    const rollup = await getChallengeContributors(setup.db, setup.members.A, setup.challengeId, auth);
    expect(rollup.collectiveTotal).toBe(40);
    const byMember = Object.fromEntries(rollup.contributors.map((c) => [c.memberId, c.contributionTotal]));
    expect(byMember[setup.members.A]).toBe(25);
    expect(byMember[setup.members.B]).toBe(15);
    const sum = rollup.contributors.reduce((s, c) => s + c.contributionTotal, 0);
    expect(sum).toBe(rollup.collectiveTotal);
    const shareSum = rollup.contributors.reduce((s, c) => s + (c.share ?? 0), 0);
    expect(shareSum).toBeCloseTo(1, 10);
  });
});

// ─── G. Finalized Race cannot diverge ───────────────────────────────────────

describe('CORR-001 G — finalized Race is sealed against mutable-derived tampering', () => {
  it('frozen position + reconstructed progress survive a derived tamper to 999', async () => {
    const setup = await setupChallenge({
      names: ['A', 'B'],
      end_date: '2026-06-30',
      challenge_type: 'competitive',
      activities: [{ canonical_key: 'push-up', metric: 'repetitions', target_value: 10, unit: 'reps' }],
    });
    await insertEpisode(setup.db, setup.challengeId, setup.members.A);
    await insertEpisode(setup.db, setup.challengeId, setup.members.B);
    await log(setup, setup.members.A, 10, '2026-06-02T10:00:00Z', '2026-06-02T10:00:00Z');
    await log(setup, setup.members.B, 4, '2026-06-02T11:00:00Z', '2026-06-02T11:00:00Z');
    await finalizeChallenge(setup.db, setup.challengeId, T('2026-07-10T12:00:00Z'));

    await tamperDerived(setup.db, setup.challengeId, 999);

    const detailA = await getChallengeDetail(setup.db, setup.members.A, setup.challengeId, auth);
    expect(detailA.myParticipation?.final?.completed).toBe(true);
    expect(detailA.myParticipation?.final?.finalPosition).toBe(1);
    expect(detailA.myParticipation?.progress.cumulativeTotal).toBe(10);

    const detailB = await getChallengeDetail(setup.db, setup.members.B, setup.challengeId, auth);
    expect(detailB.myParticipation?.final?.completed).toBe(false);
    expect(detailB.myParticipation?.final?.finalPosition).toBeNull();
    expect(detailB.myParticipation?.progress.cumulativeTotal).toBe(4);

    const board = await getChallengeLeaderboard(setup.db, setup.members.A, setup.challengeId, auth);
    const byMember = Object.fromEntries(board.entries.map((e) => [e.memberId, e]));
    expect(byMember[setup.members.A].position).toBe(1);
    expect(byMember[setup.members.A].cumulativeTotal).toBe(10);
    expect(byMember[setup.members.B].position).toBeNull();
    expect(byMember[setup.members.B].cumulativeTotal).toBe(4);
    // 1,1,3 ranking rule preserved: only one finisher here, still #1.
    expect(board.entries.filter((e) => e.position !== null)).toHaveLength(1);
  });
});

// ─── H. Finalized Streak cannot diverge ─────────────────────────────────────

describe('CORR-001 H — finalized Streak is sealed against mutable-derived tampering', () => {
  it('frozen finalStreak 0 + reconstructed day history survive a derived tamper to 999', async () => {
    const setup = await setupChallenge({
      names: ['A'],
      challenge_type: 'streak',
      required_consecutive_days: 3,
      reset_on_miss: true,
      end_date: '2026-06-05',
      activities: [{ canonical_key: 'push-up', metric: 'repetitions', target_value: 20, unit: 'reps' }],
    });
    await insertEpisode(setup.db, setup.challengeId, setup.members.A);
    await log(setup, setup.members.A, 20, '2026-06-01T12:00:00Z', '2026-06-01T12:00:00Z');
    await log(setup, setup.members.A, 20, '2026-06-02T12:00:00Z', '2026-06-02T12:00:00Z');
    await log(setup, setup.members.A, 20, '2026-06-03T12:00:00Z', '2026-06-03T12:00:00Z');
    await finalizeChallenge(setup.db, setup.challengeId, T('2026-06-10T12:00:00Z'));

    await tamperDerived(setup.db, setup.challengeId, 999);

    const detail = await getChallengeDetail(setup.db, setup.members.A, setup.challengeId, auth);
    const final = detail.myParticipation?.final;
    expect(final?.finalStreak).toBe(0);
    expect(final?.bestStreak).toBe(3);
    expect(final?.daysCompleted).toBe(3);
    // The mutable derived currentStreak (tampered to 999) is never substituted.
    expect(detail.myParticipation?.progress.currentStreak).toBe(3);
    expect(detail.myParticipation?.progress.currentStreak).not.toBe(999);
    // Per-day history is reconstructed from immutable evidence, not the tamper.
    const dayStates = detail.myParticipation?.progress.dayStates ?? {};
    expect(dayStates['2026-06-01']?.complete).toBe(true);
    expect(dayStates['2026-06-02']?.complete).toBe(true);
    expect(dayStates['2026-06-03']?.complete).toBe(true);
    expect(dayStates['2026-06-01']?.activities).not.toContain('999');
    expect(final?.finalPosition).toBeNull();
  });
});

// ─── I. Missing frozen truth fails closed ───────────────────────────────────

describe('CORR-001 I — missing frozen truth never falls back to live derived truth', () => {
  it('detail and contributors fail closed when a finalized Challenge has no sealed finalization row', async () => {
    const setup = await setupChallenge({
      names: ['A'],
      challenge_type: 'collective',
      goal_value: 100,
      goal_unit: 'reps',
      activities: [{ canonical_key: 'push-up', metric: 'repetitions', target_value: 20, unit: 'reps' }],
    });
    await insertEpisode(setup.db, setup.challengeId, setup.members.A);
    await log(setup, setup.members.A, 40, '2026-06-02T12:00:00Z', '2026-06-02T12:00:00Z');

    // Simulate corrupt sealed truth: finalized marker present, no
    // challenge_finalizations row (frozen history is delete-protected).
    await endChallenge(setup.db, setup.challengeId);
    await setup.db.query(
      `UPDATE challenges SET finalized_at = now() WHERE challenge_id = $1`,
      [setup.challengeId],
    );

    const detailError = await getChallengeDetail(setup.db, setup.members.A, setup.challengeId, auth)
      .then(() => null, (error: unknown) => error as ChallengeReadError);
    expect(detailError).toBeInstanceOf(ChallengeReadError);
    expect(detailError?.statusCode).toBe(500);
    expect(detailError?.code).toBe('finalization_missing');

    const rollupError = await getChallengeContributors(setup.db, setup.members.A, setup.challengeId, auth)
      .then(() => null, (error: unknown) => error as ChallengeReadError);
    expect(rollupError).toBeInstanceOf(ChallengeReadError);
    expect(rollupError?.code).toBe('finalization_missing');
  });

  it('leaderboard fails closed when a finalized Race has no sealed finalization row', async () => {
    const setup = await setupChallenge({
      names: ['A'],
      end_date: '2026-06-30',
      challenge_type: 'competitive',
      activities: [{ canonical_key: 'push-up', metric: 'repetitions', target_value: 10, unit: 'reps' }],
    });
    await insertEpisode(setup.db, setup.challengeId, setup.members.A);
    await log(setup, setup.members.A, 10, '2026-06-02T10:00:00Z', '2026-06-02T10:00:00Z');
    await endChallenge(setup.db, setup.challengeId);
    await setup.db.query(
      `UPDATE challenges SET finalized_at = now() WHERE challenge_id = $1`,
      [setup.challengeId],
    );

    const error = await getChallengeLeaderboard(setup.db, setup.members.A, setup.challengeId, auth)
      .then(() => null, (e: unknown) => e as ChallengeReadError);
    expect(error).toBeInstanceOf(ChallengeReadError);
    expect(error?.code).toBe('finalization_missing');
  });
});
