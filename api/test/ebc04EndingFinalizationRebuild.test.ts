import { beforeEach, describe, expect, it } from 'vitest';
import {
  activateChallenge,
  createChallenge,
  endChallenge,
  type ChallengeCreationResolvers,
  type NewChallengeInput,
} from '../src/challenges.js';
import {
  addChallengeConfigVersion,
  type ActivityConfigInput,
} from '../src/challengeConfigs.js';
import {
  getChallengeDetail,
  getChallengeLeaderboard,
  listVisibleChallenges,
} from '../src/challengeReads.js';
import {
  ApplicationError,
  applyChallengeActivity,
  type ChallengeActivityResolvers,
  type NewChallengeActivityInput,
} from '../src/challengeActivityApplication.js';
import {
  ELIGIBILITY_REASON,
} from '../src/submissionIntents.js';
import {
  appendActivityEvent,
} from '../src/activityEvents.js';
import {
  FINALIZATION_VERSION,
  finalizeChallenge,
  getChallengeFinal,
  processExpiredChallenges,
  rebuildChallengeDerived,
} from '../src/challengeFinalization.js';
import {
  recomputeChallengeDerived,
} from '../src/derivedTruth.js';
import {
  seedGroup,
  seedMember,
  seedMembership,
  testDb,
  stubEligibility,
} from './helpers.js';
import type { Db } from '../src/db.js';

/**
 * EBC-04 Ending / Finalization / Rebuild / Stable History.
 *
 * Ending stops ordinary acceptance; finalization computes the authoritative
 * terminal truth once and freezes it (status='ended' + finalized_at + the
 * immutable finals rows). Streak completion is terminal-only; competitive
 * ranks freeze with standard competition ranking; collective aggregates
 * freeze with overshoot retained. Rebuild persists canonical truth before
 * finalization and verifies-only afterwards. The acceptance clock is driven
 * explicitly ({ now }) so window/terminal proofs are deterministic.
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

async function seedKnowledge(
  db: Db,
  name: string,
  kind: 'fitness' | 'wellness' = 'fitness',
): Promise<Pin> {
  const result = await db.query<{ knowledge_id: string; current_version: number }>(
    `INSERT INTO knowledge_items (kind, name, lifecycle) VALUES ($1, $2, $3)
     RETURNING knowledge_id, current_version`,
    [kind, name, 'published'],
  );
  return {
    knowledge_id: String(result.rows[0].knowledge_id),
    current_version: Number(result.rows[0].current_version),
  };
}

function resolversFor(
  pins: Record<string, Pin>,
  memberAuthority: { status: string; eligible: boolean } | null = { status: 'active', eligible: true },
): ChallengeActivityResolvers {
  return {
    resolveKnowledgePin: async (key) => pins[key] ?? null,
    resolveGroupMembershipAuthority: async () => memberAuthority,
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

const stubAuthority = () => ({
  resolveGroupMembershipAuthority: async () => ({ status: 'active', eligible: true }),
});

function pushUp(overrides?: Partial<ActivityConfigInput>): ActivityConfigInput {
  return { canonical_key: 'push-up', metric: 'repetitions', target_value: 20, unit: 'reps', ...overrides };
}

function water(overrides?: Partial<ActivityConfigInput>): ActivityConfigInput {
  return { canonical_key: 'water-intake', metric: 'quantity', target_value: 2000, unit: 'millilitres', ...overrides };
}

function sleep8h(overrides?: Partial<ActivityConfigInput>): ActivityConfigInput {
  return { canonical_key: 'sleep-8h', metric: 'duration', target_value: 8, unit: 'hours', ...overrides };
}

interface ChallengeSetup {
  groupId: string;
  memberId: string;
  challengeId: string;
  pins: Record<string, Pin>;
}

async function setupActiveChallenge(
  input: Omit<NewChallengeInput, 'group_id' | 'created_by_member_id' | 'title' | 'start_date' | 'end_date'> & {
    title?: string;
    start_date?: string;
    end_date?: string;
    kinds?: Record<string, 'fitness' | 'wellness'>;
  },
): Promise<ChallengeSetup> {
  const db = testDb();
  const tag = next('ebc04');
  const memberId = await seedMember(db, `member-${tag}`);
  const groupId = await seedGroup(db, { name: `EBC-04 Group ${tag}` });
  await seedMembership(db, groupId, memberId, { status: 'active' });
  const pins: Record<string, Pin> = {};
  for (const activity of input.activities) {
    const key = activity.canonical_key;
    if (!pins[key]) {
      pins[key] = await seedKnowledge(db, key, input.kinds?.[key] ?? 'fitness');
    }
  }
  const { challenge } = await createChallenge(
    db,
    {
      group_id: groupId,
      created_by_member_id: memberId,
      title: `EBC-04 ${tag}`,
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
  options: {
    challengeId: string;
    memberId: string;
    joinedAt: string;
    status?: 'active' | 'withdrawn' | 'removed';
    exitedAt?: string | null;
    exitReason?: 'withdrawn' | 'removed' | null;
  },
): Promise<string> {
  const result = await db.query<{ participation_id: string }>(
    `INSERT INTO challenge_participations
       (challenge_id, member_id, status, joined_at, joined_config_version, exited_at, exit_reason)
     VALUES ($1, $2, $3, $4, 1, $5, $6)
     RETURNING participation_id`,
    [
      options.challengeId,
      options.memberId,
      options.status ?? 'active',
      options.joinedAt,
      options.exitedAt ?? null,
      options.exitReason ?? null,
    ],
  );
  return String(result.rows[0].participation_id);
}

/** Clock-driven log for the setup member (or an explicit member). */
async function logAt(
  db: Db,
  setup: ChallengeSetup,
  partial: Partial<NewChallengeActivityInput> & { occurred_at: Date; client_key: string },
  nowIso: string,
  memberId?: string,
) {
  return applyChallengeActivity(
    db,
    memberId ?? setup.memberId,
    setup.challengeId,
    {
      activity_kind: 'fitness',
      canonical_key: 'push-up',
      value: 20,
      unit: 'reps',
      ...partial,
    },
    resolversFor(setup.pins),
    { now: T(nowIso) },
  );
}

async function applyErr(promise: Promise<unknown>): Promise<ApplicationError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ApplicationError);
    return error as ApplicationError;
  }
  throw new Error('expected the operation to reject');
}

async function challengeStatus(challengeId: string): Promise<{ status: string; finalized_at: string | null }> {
  const db = testDb();
  const result = await db.query<{ status: string; finalized_at: string | Date | null }>(
    'SELECT status, finalized_at FROM challenges WHERE challenge_id = $1',
    [challengeId],
  );
  const row = result.rows[0];
  return {
    status: String(row.status),
    finalized_at: row.finalized_at == null ? null : new Date(row.finalized_at).toISOString(),
  };
}

async function finalsCount(): Promise<{ challenges: number; participations: number }> {
  const db = testDb();
  const c = await db.query<{ count: string }>('SELECT COUNT(*) AS count FROM challenge_finalizations');
  const p = await db.query<{ count: string }>('SELECT COUNT(*) AS count FROM challenge_participation_finals');
  return { challenges: Number(c.rows[0].count), participations: Number(p.rows[0].count) };
}

describe('EBC-04 GENERAL ENDING', () => {
  it('1: active Challenge inside window stays active', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'competitive',
      activities: [pushUp({ target_value: 100 })],
    });
    await insertEpisode(db, {
      challengeId: setup.challengeId, memberId: setup.memberId, joinedAt: '2026-06-01T00:00:00Z',
    });
    const outcomes = await processExpiredChallenges(db, T('2026-06-10T12:00:00Z'));
    const outcome = outcomes.find((o) => o.challenge_id === setup.challengeId)!;
    expect(outcome.expired).toBe(false);
    expect(outcome.ended).toBe(false);
    expect(outcome.finalized).toBe(false);
    expect((await challengeStatus(setup.challengeId)).status).toBe('active');
  });

  it('2: expired active Challenge is ended by the maintenance seam', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'competitive',
      start_date: '2026-06-01',
      end_date: '2026-06-05',
      activities: [pushUp({ target_value: 100 })],
    });
    await insertEpisode(db, {
      challengeId: setup.challengeId, memberId: setup.memberId, joinedAt: '2026-06-01T00:00:00Z',
    });
    // No participant activity after expiry: the seam still ends + finalizes.
    const outcomes = await processExpiredChallenges(db, T('2026-06-10T12:00:00Z'));
    const outcome = outcomes.find((o) => o.challenge_id === setup.challengeId)!;
    expect(outcome.expired).toBe(true);
    expect(outcome.ended).toBe(true);
    expect(outcome.finalized).toBe(true);
    const state = await challengeStatus(setup.challengeId);
    expect(state.status).toBe('ended');
    expect(state.finalized_at).not.toBeNull();
  });

  it('3: ordinary logging after end is rejected', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'competitive',
      activities: [pushUp({ target_value: 100 })],
    });
    await insertEpisode(db, {
      challengeId: setup.challengeId, memberId: setup.memberId, joinedAt: '2026-06-01T00:00:00Z',
    });
    await endChallenge(db, setup.challengeId);
    const rejected = await applyErr(logAt(db, setup,
      { occurred_at: T('2026-06-10T12:00:00Z'), client_key: next('key') }, '2026-06-10T12:00:00Z'));
    expect(rejected.statusCode).toBe(422);
    expect(rejected.code).toBe('challenge_not_active');
  });

  it('4: ended Challenge cannot reopen', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'competitive',
      activities: [pushUp({ target_value: 100 })],
    });
    await endChallenge(db, setup.challengeId);
    const { activateChallenge: reactivate } = await import('../src/challenges.js');
    await expect(reactivate(db, setup.challengeId)).rejects.toThrow(/reopened/);
    await expect(addChallengeConfigVersion(db, setup.challengeId, {
      activities: [pushUp({ target_value: 100 })],
    }, creationResolvers(setup.pins))).rejects.toThrow(/historically complete/);
    expect((await challengeStatus(setup.challengeId)).status).toBe('ended');
  });

  it('5: duplicate ending call is idempotent', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'competitive',
      activities: [pushUp({ target_value: 100 })],
    });
    const first = await endChallenge(db, setup.challengeId);
    const second = await endChallenge(db, setup.challengeId);
    expect(second.status).toBe('ended');
    expect(second.ended_at).toBe(first.ended_at);
    expect((await finalsCount()).challenges).toBe(0);
  });
});

describe('EBC-04 COLLECTIVE finalization', () => {
  async function crossedSetup(): Promise<ChallengeSetup> {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'collective',
      goal_value: 100,
      goal_unit: 'reps',
      activities: [pushUp()],
    });
    await insertEpisode(db, {
      challengeId: setup.challengeId, memberId: setup.memberId, joinedAt: '2026-06-01T00:00:00Z',
    });
    // 60 + 50 = 110: the full crossing contribution counts (overshoot).
    await logAt(db, setup,
      { value: 60, occurred_at: T('2026-06-10T12:00:00Z'), client_key: next('key') },
      '2026-06-10T12:00:00Z');
    const crossing = await logAt(db, setup,
      { value: 50, occurred_at: T('2026-06-10T13:00:00Z'), client_key: next('key') },
      '2026-06-10T13:00:00Z');
    expect(crossing.completionTriggered).toBe(true);
    return setup;
  }

  it('6+7: goal-crossing contribution fully counts and ends the Challenge early', async () => {
    const db = testDb();
    const setup = await crossedSetup();
    expect((await challengeStatus(setup.challengeId)).status).toBe('ended');
    const recomputed = await recomputeChallengeDerived(db, setup.challengeId);
    expect(recomputed.challenge.collectiveTotal).toBe(110);
    expect(recomputed.challenge.collectiveGoalReached).toBe(true);
  });

  it('8: finalization freezes the final aggregate', async () => {
    const db = testDb();
    const setup = await crossedSetup();
    const result = await finalizeChallenge(db, setup.challengeId, T('2026-06-10T14:00:00Z'));
    expect(result.alreadyFinalized).toBe(false);
    expect(result.finalization.result.collective_total).toBe(110);
    expect(result.finalization.result.collective_goal_reached).toBe(true);
    expect(result.finalization.finalization_version).toBe(FINALIZATION_VERSION);
    expect(result.finalization.config_version).toBe(1);
    expect((await challengeStatus(setup.challengeId)).finalized_at).not.toBeNull();
    const stored = await getChallengeFinal(db, setup.challengeId);
    expect(stored?.result.collective_total).toBe(110);
  });

  it('9: later activity is rejected after finalization', async () => {
    const db = testDb();
    const setup = await crossedSetup();
    await finalizeChallenge(db, setup.challengeId, T('2026-06-10T14:00:00Z'));
    const rejected = await applyErr(logAt(db, setup,
      { value: 10, occurred_at: T('2026-06-10T15:00:00Z'), client_key: next('key') },
      '2026-06-10T15:00:00Z'));
    expect(rejected.code).toBe('challenge_not_active');
  });

  it('10: repeated finalization returns the stored result unchanged', async () => {
    const db = testDb();
    const setup = await crossedSetup();
    const first = await finalizeChallenge(db, setup.challengeId, T('2026-06-10T14:00:00Z'));
    const second = await finalizeChallenge(db, setup.challengeId, T('2026-06-11T14:00:00Z'));
    expect(second.alreadyFinalized).toBe(true);
    expect(second.finalization.finalized_at).toBe(first.finalization.finalized_at);
    expect(second.finalization.result).toEqual(first.finalization.result);
    expect(await finalsCount()).toEqual({ challenges: 1, participations: 1 });
  });
});

describe('EBC-04 COMPETITIVE finalization', () => {
  interface Racer {
    memberId: string;
    participationId: string;
  }

  async function raceSetup(memberCount: number): Promise<{ setup: ChallengeSetup; racers: Racer[] }> {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'competitive',
      start_date: '2026-06-01',
      end_date: '2026-06-05',
      activities: [pushUp({ target_value: 100 })],
    });
    const racers: Racer[] = [];
    for (let index = 0; index < memberCount; index += 1) {
      const memberId = index === 0
        ? setup.memberId
        : await seedMember(db, `racer-${next('m')}`);
      const participationId = await insertEpisode(db, {
        challengeId: setup.challengeId, memberId, joinedAt: '2026-06-01T00:00:00Z',
      });
      racers.push({ memberId, participationId });
    }
    return { setup, racers };
  }

  async function finish(
    db: Db,
    setup: ChallengeSetup,
    racer: Racer,
    atIso: string,
    value = 100,
  ) {
    return logAt(db, setup,
      { value, occurred_at: T(atIso), client_key: next('key') }, atIso, racer.memberId);
  }

  it('11: one finisher does not end the Challenge before window end', async () => {
    const db = testDb();
    const { setup, racers } = await raceSetup(2);
    const done = await finish(db, setup, racers[0], '2026-06-02T10:00:00Z');
    expect(done.participation.completionStatus).toBe('completed');
    expect((await challengeStatus(setup.challengeId)).status).toBe('active');
    // Finalizing an open window is refused: order is not final yet.
    const early = await applyErr(finalizeChallenge(db, setup.challengeId, T('2026-06-02T12:00:00Z')));
    expect(early.code).toBe('challenge_not_ended');
  });

  it('12: expiry ends the Competitive Challenge', async () => {
    const db = testDb();
    const { setup, racers } = await raceSetup(2);
    await finish(db, setup, racers[0], '2026-06-02T10:00:00Z');
    const outcomes = await processExpiredChallenges(db, T('2026-06-10T12:00:00Z'));
    const outcome = outcomes.find((o) => o.challenge_id === setup.challengeId)!;
    expect(outcome.expired).toBe(true);
    expect(outcome.ended).toBe(true);
    expect(outcome.finalized).toBe(true);
  });

  it('13+14: finalization assigns standard competition ranking (1,1,3)', async () => {
    const db = testDb();
    const { setup, racers } = await raceSetup(3);
    // A and B finish on the same instant (tie); C finishes later.
    await finish(db, setup, racers[0], '2026-06-02T10:00:00Z');
    await finish(db, setup, racers[1], '2026-06-02T10:00:00Z');
    await finish(db, setup, racers[2], '2026-06-03T10:00:00Z');
    const result = await finalizeChallenge(db, setup.challengeId, T('2026-06-10T12:00:00Z'));
    const byMember = new Map(result.participations.map((p) => [p.member_id, p]));
    expect(byMember.get(racers[0].memberId)?.final_position).toBe(1);
    expect(byMember.get(racers[1].memberId)?.final_position).toBe(1);
    expect(byMember.get(racers[2].memberId)?.final_position).toBe(3);
    expect(result.finalization.result.completions_count).toBe(3);
  });

  it('15: 1,2,2,4 proven (subsequent positions skip occupied places)', async () => {
    const db = testDb();
    const { setup, racers } = await raceSetup(4);
    await finish(db, setup, racers[0], '2026-06-02T10:00:00Z');
    await finish(db, setup, racers[1], '2026-06-03T10:00:00Z');
    await finish(db, setup, racers[2], '2026-06-03T10:00:00Z');
    await finish(db, setup, racers[3], '2026-06-04T10:00:00Z');
    const result = await finalizeChallenge(db, setup.challengeId, T('2026-06-10T12:00:00Z'));
    const positions = new Map(result.participations.map((p) => [p.member_id, p.final_position]));
    expect([...positions.values()].sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([1, 2, 2, 4]);
  });

  it('16: non-completer gets no rank', async () => {
    const db = testDb();
    const { setup, racers } = await raceSetup(2);
    await finish(db, setup, racers[0], '2026-06-02T10:00:00Z');
    // Partial effort only: never completes.
    await finish(db, setup, racers[1], '2026-06-03T10:00:00Z', 10);
    const result = await finalizeChallenge(db, setup.challengeId, T('2026-06-10T12:00:00Z'));
    const byMember = new Map(result.participations.map((p) => [p.member_id, p]));
    expect(byMember.get(racers[0].memberId)?.final_position).toBe(1);
    const alsoRan = byMember.get(racers[1].memberId)!;
    expect(alsoRan.completed).toBe(false);
    expect(alsoRan.final_position).toBeNull();
  });

  it('17: final rank is frozen and stable across reads', async () => {
    const db = testDb();
    const { setup, racers } = await raceSetup(3);
    await finish(db, setup, racers[0], '2026-06-02T10:00:00Z');
    await finish(db, setup, racers[1], '2026-06-02T10:00:00Z');
    await finish(db, setup, racers[2], '2026-06-03T10:00:00Z');
    await finalizeChallenge(db, setup.challengeId, T('2026-06-10T12:00:00Z'));
    const authority = stubAuthority();
    const first = await getChallengeLeaderboard(db, setup.memberId, setup.challengeId, {
      groupMembershipAuthority: authority,
    });
    const second = await getChallengeLeaderboard(db, setup.memberId, setup.challengeId, {
      groupMembershipAuthority: authority,
    });
    // Frozen 1,1,3 — identical on repeat reads, never recalculated live.
    expect(first.entries.map((e) => e.position).sort()).toEqual([1, 1, 3]);
    expect(second).toEqual(first);
    const detail = await getChallengeDetail(db, setup.memberId, setup.challengeId, {
      groupMembershipAuthority: authority,
    });
    expect(detail.finalized).toBe(true);
    expect(detail.finalResult?.configVersion).toBe(1);
  });
});

describe('EBC-04 STREAK finalization', () => {
  const WATER = { canonical_key: 'water-intake', value: 2000, unit: 'millilitres' };
  const SLEEP = {
    canonical_key: 'sleep-8h', activity_kind: 'wellness' as const, value: 8, unit: 'hours',
  };

  async function streakSetup(): Promise<ChallengeSetup> {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'streak',
      start_date: '2026-06-01',
      end_date: '2026-06-05',
      required_consecutive_days: 3,
      activities: [water(), sleep8h()],
      kinds: { 'sleep-8h': 'wellness' },
    });
    await insertEpisode(db, {
      challengeId: setup.challengeId, memberId: setup.memberId, joinedAt: '2026-06-01T00:00:00Z',
    });
    return setup;
  }

  async function completeDay(db: Db, setup: ChallengeSetup, day: string) {
    await logAt(db, setup,
      { ...WATER, occurred_at: T(`${day}T09:00:00Z`), client_key: next('key') }, `${day}T09:00:00Z`);
    return logAt(db, setup,
      { ...SLEEP, occurred_at: T(`${day}T21:00:00Z`), client_key: next('key') }, `${day}T21:00:00Z`);
  }

  /** Days 1-3 complete, Day 4 missed, Day 5 (terminal) partial. */
  async function runToTerminal(): Promise<{ setup: ChallengeSetup; db: Db }> {
    const db = testDb();
    const setup = await streakSetup();
    await completeDay(db, setup, '2026-06-01');
    await completeDay(db, setup, '2026-06-02');
    await completeDay(db, setup, '2026-06-03');
    await logAt(db, setup,
      { ...WATER, occurred_at: T('2026-06-05T09:00:00Z'), client_key: next('key') },
      '2026-06-05T09:00:00Z');
    return { setup, db };
  }

  it('18: expiry ends the Streak Challenge (full period, not early)', async () => {
    const { setup } = await runToTerminal();
    expect((await challengeStatus(setup.challengeId)).status).toBe('active');
    const outcomes = await processExpiredChallenges(testDb(), T('2026-06-10T12:00:00Z'));
    const outcome = outcomes.find((o) => o.challenge_id === setup.challengeId)!;
    expect(outcome.expired).toBe(true);
    expect(outcome.ended).toBe(true);
    expect(outcome.finalized).toBe(true);
  });

  it('19+20+21+22: terminal evaluation — missed terminal day breaks finalStreak, counters stand', async () => {
    const { setup, db } = await runToTerminal();
    const result = await finalizeChallenge(db, setup.challengeId, T('2026-06-10T12:00:00Z'));
    expect(result.alreadyFinalized).toBe(false);
    const [terminal] = result.participations;
    // Day 5 (terminal) never completed: final run is broken.
    expect(terminal.final_streak).toBe(0);
    expect(terminal.days_completed).toBe(3);
    expect(terminal.best_streak).toBe(3);
    // The historical 3-day run still satisfies the requirement terminally.
    expect(terminal.completed).toBe(true);
    expect(terminal.completed_at).toBe(result.finalization.finalized_at);
    // Days Completed and Best Streak survive the correction intact.
    const derived = await db.query<{ completion_status: string; days_completed: number; best_streak: number }>(
      `SELECT completion_status, days_completed, best_streak
       FROM challenge_participation_derived WHERE challenge_id = $1`,
      [setup.challengeId],
    );
    expect(derived.rows[0].completion_status).toBe('completed');
    expect(Number(derived.rows[0].days_completed)).toBe(3);
    expect(Number(derived.rows[0].best_streak)).toBe(3);
  });

  it('23: reaching requiredConsecutiveDays early does not end/finalize the Challenge', async () => {
    const db = testDb();
    const setup = await streakSetup();
    await completeDay(db, setup, '2026-06-01');
    await completeDay(db, setup, '2026-06-02');
    const third = await completeDay(db, setup, '2026-06-03');
    // Required run reached mid-period: still running, never finished early.
    expect(third.participation.completionStatus).toBe('in_progress');
    expect(third.participation.currentStreak).toBe(3);
    expect((await challengeStatus(setup.challengeId)).status).toBe('active');
    expect((await finalsCount()).challenges).toBe(0);
    // Terminal evaluation then records the historical success once.
    const result = await finalizeChallenge(db, setup.challengeId, T('2026-06-10T12:00:00Z'));
    expect(result.participations[0].completed).toBe(true);
    expect(result.participations[0].final_streak).toBe(0);
    expect(result.participations[0].best_streak).toBe(3);
  });

  it('24: no Streak rank exists (finals, progress, and leaderboard)', async () => {
    const { setup, db } = await runToTerminal();
    const result = await finalizeChallenge(db, setup.challengeId, T('2026-06-10T12:00:00Z'));
    for (const participation of result.participations) {
      expect(participation.final_position).toBeNull();
    }
    const authority = stubAuthority();
    const detail = await getChallengeDetail(db, setup.memberId, setup.challengeId, {
      groupMembershipAuthority: authority,
    });
    expect(detail.myParticipation?.progress.finalPosition).toBeNull();
    await expect(getChallengeLeaderboard(db, setup.memberId, setup.challengeId, {
      groupMembershipAuthority: authority,
    })).rejects.toMatchObject({ code: 'leaderboard_not_available' });
  });
});

describe('EBC-04 REBUILD — authoritative persisted recomputation', () => {
  async function liveSetup(): Promise<ChallengeSetup> {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'competitive',
      activities: [pushUp({ target_value: 100 })],
    });
    await insertEpisode(db, {
      challengeId: setup.challengeId, memberId: setup.memberId, joinedAt: '2026-06-01T00:00:00Z',
    });
    await logAt(db, setup,
      { value: 60, occurred_at: T('2026-06-10T12:00:00Z'), client_key: next('key') },
      '2026-06-10T12:00:00Z');
    return setup;
  }

  it('25: rebuild from accepted applications matches live derived state', async () => {
    const db = testDb();
    const setup = await liveSetup();
    const result = await rebuildChallengeDerived(db, setup.challengeId);
    expect(result.mode).toBe('rebuild');
    expect(result.recordsReplayed).toBe(1);
    expect(result.participationsPersisted).toBe(1);
    const recomputed = await recomputeChallengeDerived(db, setup.challengeId);
    const stored = await db.query(
      `SELECT cumulative_total, logs_accepted FROM challenge_participation_derived WHERE challenge_id = $1`,
      [setup.challengeId],
    );
    expect(Number(stored.rows[0].cumulative_total)).toBe(60);
    expect(Number(stored.rows[0].logs_accepted)).toBe(1);
    expect(recomputed.recordsReplayed).toBe(1);
  });

  it('26+27: rejected intents and raw Evidence never enter the rebuild', async () => {
    const db = testDb();
    const setup = await liveSetup();
    // Rejected submission (wrong unit): durable intent, no application.
    // (Clock driven so the expiry gate does not mask the unit check.)
    await applyErr(applyChallengeActivity(
      db, setup.memberId, setup.challengeId,
      {
        activity_kind: 'fitness', canonical_key: 'push-up', value: 10, unit: 'km',
        occurred_at: T('2026-06-10T12:00:00Z'), client_key: next('key'),
      },
      resolversFor(setup.pins),
      { now: T('2026-06-10T12:00:00Z') },
    ));
    // Raw Evidence appended directly: never applied to any Challenge.
    await appendActivityEvent(db, {
      member_id: setup.memberId,
      activity_kind: 'fitness',
      canonical_key: 'push-up',
      activity_variant: null,
      occurred_at: T('2026-06-10T12:00:00Z'),
      occurred_day: undefined,
      occurred_tz: null,
      value: 999,
      unit: 'reps',
      client_key: next('raw'),
    }, { resolveKnowledgePin: async () => setup.pins['push-up'] });
    const result = await rebuildChallengeDerived(db, setup.challengeId);
    expect(result.recordsReplayed).toBe(1);
    const stored = await db.query(
      `SELECT cumulative_total FROM challenge_participation_derived WHERE challenge_id = $1`,
      [setup.challengeId],
    );
    expect(Number(stored.rows[0].cumulative_total)).toBe(60);
  });

  it('28: pinned historical config/version governs each record', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'competitive',
      activities: [pushUp({ target_value: 100 })],
    });
    await insertEpisode(db, {
      challengeId: setup.challengeId, memberId: setup.memberId, joinedAt: '2026-06-01T00:00:00Z',
    });
    await logAt(db, setup,
      { value: 40, occurred_at: T('2026-06-10T12:00:00Z'), client_key: next('key') },
      '2026-06-10T12:00:00Z');
    // Mid-Challenge version change; later records pin v2.
    await addChallengeConfigVersion(db, setup.challengeId, {
      activities: [pushUp({ target_value: 200 })],
    }, creationResolvers(setup.pins));
    const second = await logAt(db, setup,
      { value: 150, occurred_at: T('2026-06-11T12:00:00Z'), client_key: next('key') },
      '2026-06-11T12:00:00Z');
    expect(second.record.config_version).toBe(2);
    const result = await rebuildChallengeDerived(db, setup.challengeId);
    expect(result.recordsReplayed).toBe(2);
    const versions = await db.query<{ config_version: number }>(
      `SELECT config_version FROM challenge_activity_records WHERE challenge_id = $1 ORDER BY accepted_at ASC`,
      [setup.challengeId],
    );
    // Rebuild never rewrites pins: v1 record stays v1, v2 stays v2.
    expect(versions.rows.map((row) => Number(row.config_version))).toEqual([1, 2]);
    const stored = await db.query(
      `SELECT cumulative_total FROM challenge_participation_derived WHERE challenge_id = $1`,
      [setup.challengeId],
    );
    expect(Number(stored.rows[0].cumulative_total)).toBe(190);
  });

  it('29: rebuild repairs a stale mutable derived projection', async () => {
    const db = testDb();
    const setup = await liveSetup();
    await db.query(
      `UPDATE challenge_participation_derived
       SET cumulative_total = 1, logs_accepted = 99, updated_at = now()
       WHERE challenge_id = $1`,
      [setup.challengeId],
    );
    const result = await rebuildChallengeDerived(db, setup.challengeId);
    expect(result.mode).toBe('rebuild');
    const stored = await db.query(
      `SELECT cumulative_total, logs_accepted FROM challenge_participation_derived WHERE challenge_id = $1`,
      [setup.challengeId],
    );
    expect(Number(stored.rows[0].cumulative_total)).toBe(60);
    expect(Number(stored.rows[0].logs_accepted)).toBe(1);
  });

  it('30: finalized rebuild is verify-only and cannot mutate history', async () => {
    const db = testDb();
    const setup = await liveSetup();
    await endChallenge(db, setup.challengeId);
    const finalized = await finalizeChallenge(db, setup.challengeId, T('2026-06-10T12:00:00Z'));
    const before = JSON.stringify(finalized.finalization);
    const result = await rebuildChallengeDerived(db, setup.challengeId);
    expect(result.mode).toBe('verify');
    expect(result.verified).toBe(true);
    expect(result.participationsPersisted).toBe(0);
    const after = await getChallengeFinal(db, setup.challengeId);
    expect(JSON.stringify(after)).toBe(before);
    // A governed repair mode does not exist: the request fails closed.
    const repair = await applyErr(rebuildChallengeDerived(db, setup.challengeId, {
      repairFinalized: true,
    }));
    expect(repair.code).toBe('finalized_repair_not_authorized');
  });

  it('31: deterministic repeated rebuild produces the same result', async () => {
    const db = testDb();
    const setup = await liveSetup();
    const first = await rebuildChallengeDerived(db, setup.challengeId);
    const second = await rebuildChallengeDerived(db, setup.challengeId);
    expect(second).toEqual(first);
  });
});

describe('EBC-04 CONCURRENCY / ATOMICITY', () => {
  it('32+34: duplicate and concurrent finalize converge to one result', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'competitive',
      start_date: '2026-06-01',
      end_date: '2026-06-05',
      activities: [pushUp({ target_value: 100 })],
    });
    await insertEpisode(db, {
      challengeId: setup.challengeId, memberId: setup.memberId, joinedAt: '2026-06-01T00:00:00Z',
    });
    await logAt(db, setup,
      { value: 100, occurred_at: T('2026-06-02T10:00:00Z'), client_key: next('key') },
      '2026-06-02T10:00:00Z');
    // Concurrent duplicate finalization: one winner, every caller converges.
    const [left, right] = await Promise.all([
      finalizeChallenge(db, setup.challengeId, T('2026-06-10T12:00:00Z')),
      finalizeChallenge(db, setup.challengeId, T('2026-06-10T12:00:00Z')),
    ]);
    expect(left.finalization.finalized_at).toBe(right.finalization.finalized_at);
    expect(left.finalization.result).toEqual(right.finalization.result);
    expect(await finalsCount()).toEqual({ challenges: 1, participations: 1 });
    // Sequential duplicates return the same stored result.
    const third = await finalizeChallenge(db, setup.challengeId, T('2026-06-11T12:00:00Z'));
    expect(third.alreadyFinalized).toBe(true);
    expect(third.finalization.finalized_at).toBe(left.finalization.finalized_at);
  });

  it('33: transaction failure leaves no partial finalization', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'competitive',
      activities: [pushUp({ target_value: 100 })],
    });
    // Unknown challenge: nothing persists anywhere.
    const missing = await applyErr(finalizeChallenge(db, '00000000-0000-4000-8000-000000000000'));
    expect(missing.statusCode).toBe(404);
    // Open window: refused before any write.
    const early = await applyErr(finalizeChallenge(db, setup.challengeId, T('2026-06-10T12:00:00Z')));
    expect(early.code).toBe('challenge_not_ended');
    expect(await finalsCount()).toEqual({ challenges: 0, participations: 0 });
    expect((await challengeStatus(setup.challengeId)).status).toBe('active');
    expect((await challengeStatus(setup.challengeId)).finalized_at).toBeNull();
  });
});

describe('EBC-04 REGRESSION — earlier slices and live semantics hold', () => {
  it('35: EBC-02 acceptance trace remains valid', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'competitive',
      activities: [pushUp({ target_value: 100 })],
    });
    await insertEpisode(db, {
      challengeId: setup.challengeId, memberId: setup.memberId, joinedAt: '2026-06-01T00:00:00Z',
    });
    const accepted = await logAt(db, setup,
      { value: 40, occurred_at: T('2026-06-10T12:00:00Z'), client_key: next('key') },
      '2026-06-10T12:00:00Z');
    expect(accepted.submission?.acceptance_status).toBe('accepted');
    const intents = await db.query<{ acceptance_status: string; acceptance_authority: string }>(
      `SELECT acceptance_status, acceptance_authority FROM activity_submission_intents`,
    );
    expect(intents.rows[0].acceptance_status).toBe('accepted');
    expect(intents.rows[0].acceptance_authority).toBe('automatic_system');
    // Rejected submissions still trace durably with no effect.
    // (Clock driven so the expiry gate does not mask the unit check.)
    const rejected = await applyErr(applyChallengeActivity(
      db, setup.memberId, setup.challengeId,
      {
        activity_kind: 'fitness', canonical_key: 'push-up', value: 10, unit: 'km',
        occurred_at: T('2026-06-10T12:00:00Z'), client_key: next('key'),
      },
      resolversFor(setup.pins),
      { now: T('2026-06-10T12:00:00Z') },
    ));
    expect(rejected.code).toBe('wrong_unit');
    expect((rejected as { eligibilityReason?: string }).eligibilityReason)
      .toBe(ELIGIBILITY_REASON.MEASUREMENT_NOT_COMPATIBLE);
  });

  it('36: EBC-03 timezone/late-logging behavior remains valid', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'streak',
      timezone: 'Africa/Nairobi',
      required_consecutive_days: 30,
      activities: [pushUp()],
    });
    await insertEpisode(db, {
      challengeId: setup.challengeId, memberId: setup.memberId, joinedAt: '2026-06-01T00:00:00Z',
    });
    // UTC 06-10 22:30 = Nairobi 06-11 01:30: Challenge day wins.
    const result = await logAt(db, setup,
      { occurred_at: T('2026-06-10T22:30:00Z'), client_key: next('key') },
      '2026-06-10T22:30:00Z');
    expect(result.record.occurred_day).toBe('2026-06-11');
    // Backdated closed-day logging still rejected.
    const late = await applyErr(logAt(db, setup,
      { occurred_at: T('2026-06-10T12:00:00Z'), client_key: next('key') },
      '2026-06-11T12:00:00Z'));
    expect(late.code).toBe('streak_day_closed');
  });

  it('37: live calculations unchanged before terminal state', async () => {
    const db = testDb();
    const collective = await setupActiveChallenge({
      challenge_type: 'collective',
      goal_value: 1000,
      goal_unit: 'reps',
      activities: [pushUp()],
    });
    await insertEpisode(db, {
      challengeId: collective.challengeId, memberId: collective.memberId, joinedAt: '2026-06-01T00:00:00Z',
    });
    const logged = await logAt(db, collective,
      { value: 600, occurred_at: T('2026-06-10T12:00:00Z'), client_key: next('key') },
      '2026-06-10T12:00:00Z');
    expect(logged.challenge.collectiveTotal).toBe(600);
    expect((await challengeStatus(collective.challengeId)).status).toBe('active');
    expect((await challengeStatus(collective.challengeId)).finalized_at).toBeNull();
    const visible = await listVisibleChallenges(db, collective.memberId, {
      groupMembershipAuthority: stubAuthority(),
    });
    expect(visible.find((s) => s.challengeId === collective.challengeId)?.finalized).toBe(false);
  });
});
