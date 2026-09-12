import { beforeEach, describe, expect, it } from 'vitest';
import {
  activateChallenge,
  createChallenge,
  type ChallengeCreationResolvers,
  type NewChallengeInput,
} from '../src/challenges.js';
import {
  addChallengeConfigVersion,
  parseGoverningSnapshot,
  type ActivityConfigInput,
} from '../src/challengeConfigs.js';
import { getChallengeDetail, listVisibleChallenges } from '../src/challengeReads.js';
import {
  ApplicationError,
  applyChallengeActivity,
  type ChallengeActivityResolvers,
  type NewChallengeActivityInput,
} from '../src/challengeActivityApplication.js';
import {
  ELIGIBILITY_REASON,
  type SubmissionIntentRow,
} from '../src/submissionIntents.js';
import {
  normalizeParticipationDerived,
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
 * EBC-03 Streak temporal correctness (Stage F FR-V2-105..119 as reconciled):
 * one governing Challenge timezone defines the Challenge day; a day is DONE
 * only when ALL configured daily requirements are DONE; missed days reset
 * Current Streak without removing the participant; no ordinary grace period;
 * late join keeps the Challenge denominator; participation episodes own
 * eligibility; only accepted records move Streak truth; replay matches live.
 *
 * The acceptance clock is driven explicitly ({ now }) so day-boundary proofs
 * are deterministic. Production passes no clock (wall clock governs).
 */

beforeEach(async () => {
  await testDb().query(
    'TRUNCATE challenge_derived_state, challenge_participation_derived, challenge_activity_records, challenge_activity_configs, challenge_config_versions, challenge_participations, challenges, challenge_establishment_keys, member_activity_events, activity_submission_intents, challenge_finalizations, challenge_participation_finals',
  );
});

const T = (iso: string): Date => new Date(iso);
const NAIROBI = 'Africa/Nairobi';

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
  const tag = next('ebc03');
  const memberId = await seedMember(db, `member-${tag}`);
  const groupId = await seedGroup(db, { name: `EBC-03 Group ${tag}` });
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
      title: `EBC-03 ${tag}`,
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

/** Clock-driven streak log: the acceptance clock rides with the log's day. */
async function logAt(
  db: Db,
  setup: ChallengeSetup,
  partial: Partial<NewChallengeActivityInput> & { occurred_at: Date; client_key: string },
  nowIso: string,
) {
  return applyChallengeActivity(
    db,
    setup.memberId,
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
  throw new Error('expected applyChallengeActivity to reject');
}

async function counts(): Promise<{ events: number; records: number; intents: number }> {
  const db = testDb();
  const events = await db.query<{ count: string }>('SELECT COUNT(*) AS count FROM member_activity_events');
  const records = await db.query<{ count: string }>(
    'SELECT COUNT(*) AS count FROM challenge_activity_records',
  );
  const intents = await db.query<{ count: string }>(
    'SELECT COUNT(*) AS count FROM activity_submission_intents',
  );
  return {
    events: Number(events.rows[0].count),
    records: Number(records.rows[0].count),
    intents: Number(intents.rows[0].count),
  };
}

async function intentsFor(clientKey: string): Promise<SubmissionIntentRow[]> {
  const db = testDb();
  const result = await db.query(
    'SELECT * FROM activity_submission_intents WHERE client_key = $1 ORDER BY submitted_at ASC',
    [clientKey],
  );
  return result.rows as unknown as SubmissionIntentRow[];
}

async function episodeStatus(participationId: string): Promise<string> {
  const db = testDb();
  const result = await db.query<{ status: string }>(
    'SELECT status FROM challenge_participations WHERE participation_id = $1',
    [participationId],
  );
  return String(result.rows[0].status);
}

describe('EBC-03 TIMEZONE — one governing Challenge timezone', () => {
  it('1: activity before local midnight belongs to Day N', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'streak',
      timezone: NAIROBI,
      required_consecutive_days: 30,
      activities: [pushUp()],
    });
    await insertEpisode(db, {
      challengeId: setup.challengeId, memberId: setup.memberId, joinedAt: '2026-06-01T00:00:00Z',
    });
    // 20:55Z = 23:55 Nairobi on 2026-06-10: still Day 10 in Challenge time.
    const result = await logAt(db, setup,
      { occurred_at: T('2026-06-10T20:55:00Z'), client_key: next('key') },
      '2026-06-10T20:55:00Z');
    expect(result.record.occurred_day).toBe('2026-06-10');
    expect(result.participation.currentStreak).toBe(1);
  });

  it('2: activity after local midnight belongs to Day N+1', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'streak',
      timezone: NAIROBI,
      required_consecutive_days: 30,
      activities: [pushUp()],
    });
    await insertEpisode(db, {
      challengeId: setup.challengeId, memberId: setup.memberId, joinedAt: '2026-06-01T00:00:00Z',
    });
    // 21:05Z = 00:05 Nairobi on 2026-06-11: already Day 11 in Challenge time.
    const result = await logAt(db, setup,
      { occurred_at: T('2026-06-10T21:05:00Z'), client_key: next('key') },
      '2026-06-10T21:05:00Z');
    expect(result.record.occurred_day).toBe('2026-06-11');
    expect(result.participation.currentStreak).toBe(1);
  });

  it('3: UTC date differing from Challenge local date resolves to Challenge time', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'streak',
      timezone: NAIROBI,
      required_consecutive_days: 30,
      activities: [pushUp()],
    });
    await insertEpisode(db, {
      challengeId: setup.challengeId, memberId: setup.memberId, joinedAt: '2026-06-01T00:00:00Z',
    });
    // UTC day is 06-10; Nairobi day is 06-11. The Challenge day must win.
    const result = await logAt(db, setup,
      { occurred_at: T('2026-06-10T22:30:00Z'), client_key: next('key') },
      '2026-06-10T22:30:00Z');
    expect(result.record.occurred_day).toBe('2026-06-11');
    expect(result.event.occurred_day).toBe('2026-06-11');
  });

  it('4: client-supplied occurred_day cannot override the Challenge timezone day', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'streak',
      timezone: NAIROBI,
      required_consecutive_days: 30,
      activities: [pushUp()],
    });
    await insertEpisode(db, {
      challengeId: setup.challengeId, memberId: setup.memberId, joinedAt: '2026-06-01T00:00:00Z',
    });
    const before = await counts();
    // The UTC day (06-10) disagrees with the governing day (06-11): rejected.
    const rejected = await applyErr(logAt(db, setup,
      {
        occurred_at: T('2026-06-10T22:30:00Z'),
        occurred_day: '2026-06-10',
        client_key: next('key'),
      },
      '2026-06-10T22:30:00Z'));
    expect(rejected.statusCode).toBe(422);
    expect(rejected.code).toBe('occurred_day_mismatch');
    expect(await counts()).toEqual(before);
    // Agreement with the governing day proceeds.
    const accepted = await logAt(db, setup,
      {
        occurred_at: T('2026-06-10T22:30:00Z'),
        occurred_day: '2026-06-11',
        client_key: next('key'),
      },
      '2026-06-10T22:30:00Z');
    expect(accepted.record.occurred_day).toBe('2026-06-11');
  });

  it('5: invalid Challenge timezone fails closed', async () => {
    const db = testDb();
    // Establishment rejects an invalid timezone (nothing persists).
    await expect(setupActiveChallenge({
      challenge_type: 'streak',
      timezone: 'Mars/Olympus',
      required_consecutive_days: 30,
      activities: [pushUp()],
    })).rejects.toThrow(/timezone/i);
    // A persisted snapshot carrying an invalid timezone is unreadable.
    expect(() => parseGoverningSnapshot({
      challenge_type: 'streak',
      period: { start_date: '2026-06-01', end_date: '2026-06-30' },
      timezone: 'Not/AZone',
      type_params: { goal_value: null, goal_unit: null, required_consecutive_days: 30, reset_on_miss: true },
      activities: [{
        canonical_key: 'push-up', activity_variant: null, knowledge_id: 'x',
        knowledge_version: 1, metric: 'repetitions', target_value: 20, unit: 'reps',
        position: 0, conditions: {},
      }],
    })).toThrow(/timezone/i);
    // A mid-Challenge timezone change to an invalid value is rejected.
    const setup = await setupActiveChallenge({
      challenge_type: 'streak',
      timezone: NAIROBI,
      required_consecutive_days: 30,
      activities: [pushUp()],
    });
    await expect(addChallengeConfigVersion(db, setup.challengeId, {
      activities: [pushUp()],
      timezone: 'Bogus/Zone',
    }, creationResolvers(setup.pins))).rejects.toThrow(/timezone/i);
  });
});

describe('EBC-03 DAY COMPLETION — ALL configured daily requirements', () => {
  async function twoRequirementSetup(): Promise<ChallengeSetup> {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'streak',
      required_consecutive_days: 30,
      activities: [water(), sleep8h()],
      kinds: { 'sleep-8h': 'wellness' },
    });
    await insertEpisode(db, {
      challengeId: setup.challengeId, memberId: setup.memberId, joinedAt: '2026-06-01T00:00:00Z',
    });
    return setup;
  }

  const WATER = { canonical_key: 'water-intake', value: 2000, unit: 'millilitres' };
  const SLEEP = {
    canonical_key: 'sleep-8h', activity_kind: 'wellness' as const, value: 8, unit: 'hours',
  };

  it('6: one required activity missing -> day not DONE', async () => {
    const db = testDb();
    const setup = await twoRequirementSetup();
    const partial = await logAt(db, setup,
      { ...WATER, occurred_at: T('2026-06-10T12:00:00Z'), client_key: next('key') },
      '2026-06-10T12:00:00Z');
    expect(partial.participation.currentStreak).toBe(0);
    expect(partial.participation.daysCompleted).toBe(0);
    const states = partial.participation.dayStates as Record<string, { complete: boolean }>;
    expect(states['2026-06-10'].complete).toBe(false);
  });

  it('7+8: all configured daily requirements satisfied -> day DONE (multiple records)', async () => {
    const db = testDb();
    const setup = await twoRequirementSetup();
    await logAt(db, setup,
      { ...WATER, occurred_at: T('2026-06-10T09:00:00Z'), client_key: next('key') },
      '2026-06-10T09:00:00Z');
    const done = await logAt(db, setup,
      { ...SLEEP, occurred_at: T('2026-06-10T21:00:00Z'), client_key: next('key') },
      '2026-06-10T21:00:00Z');
    // Two accepted records jointly satisfy the one Challenge day.
    expect(done.participation.logsAccepted).toBe(2);
    expect(done.participation.currentStreak).toBe(1);
    expect(done.participation.bestStreak).toBe(1);
    expect(done.participation.daysCompleted).toBe(1);
    const states = done.participation.dayStates as Record<string, { complete: boolean }>;
    expect(states['2026-06-10'].complete).toBe(true);
  });

  it('9: duplicate/idempotent replay does not double-complete the day', async () => {
    const db = testDb();
    const setup = await twoRequirementSetup();
    const first = await logAt(db, setup,
      { ...WATER, occurred_at: T('2026-06-10T09:00:00Z'), client_key: 'dup-day' },
      '2026-06-10T09:00:00Z');
    expect(first.duplicate).toBe(false);
    await logAt(db, setup,
      { ...SLEEP, occurred_at: T('2026-06-10T21:00:00Z'), client_key: next('key') },
      '2026-06-10T21:00:00Z');
    // Exact retry of the first submission replays verbatim: no new effect.
    const replay = await logAt(db, setup,
      { ...WATER, occurred_at: T('2026-06-10T09:00:00Z'), client_key: 'dup-day' },
      '2026-06-10T09:00:00Z');
    expect(replay.duplicate).toBe(true);
    expect(replay.participation.currentStreak).toBe(1);
    expect(replay.participation.daysCompleted).toBe(1);
    expect(replay.participation.logsAccepted).toBe(2);
    // A same-day repeat under a fresh key is accepted but never advances twice.
    const repeat = await logAt(db, setup,
      { ...WATER, occurred_at: T('2026-06-10T22:00:00Z'), client_key: next('key') },
      '2026-06-10T22:00:00Z');
    expect(repeat.duplicate).toBe(false);
    expect(repeat.participation.currentStreak).toBe(1);
    expect(repeat.participation.daysCompleted).toBe(1);
  });
});

describe('EBC-03 STREAK STATE — current / best / daysCompleted', () => {
  async function twoRequirementSetup(): Promise<ChallengeSetup> {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'streak',
      required_consecutive_days: 30,
      activities: [water(), sleep8h()],
      kinds: { 'sleep-8h': 'wellness' },
    });
    await insertEpisode(db, {
      challengeId: setup.challengeId, memberId: setup.memberId, joinedAt: '2026-06-01T00:00:00Z',
    });
    return setup;
  }

  const WATER = { canonical_key: 'water-intake', value: 2000, unit: 'millilitres' };
  const SLEEP = {
    canonical_key: 'sleep-8h', activity_kind: 'wellness' as const, value: 8, unit: 'hours',
  };

  async function completeDay(db: Db, setup: ChallengeSetup, day: string) {
    await logAt(db, setup,
      { ...WATER, occurred_at: T(`${day}T09:00:00Z`), client_key: next('key') }, `${day}T09:00:00Z`);
    return logAt(db, setup,
      { ...SLEEP, occurred_at: T(`${day}T21:00:00Z`), client_key: next('key') }, `${day}T21:00:00Z`);
  }

  it('10+11: completed days build current/best cumulatively', async () => {
    const db = testDb();
    const setup = await twoRequirementSetup();
    const day1 = await completeDay(db, setup, '2026-06-10');
    expect(day1.participation.currentStreak).toBe(1);
    expect(day1.participation.bestStreak).toBe(1);
    expect(day1.participation.daysCompleted).toBe(1);
    await completeDay(db, setup, '2026-06-11');
    const day3 = await completeDay(db, setup, '2026-06-12');
    expect(day3.participation.currentStreak).toBe(3);
    expect(day3.participation.bestStreak).toBe(3);
    expect(day3.participation.daysCompleted).toBe(3);
  });

  it('12+13+14+15: miss resets current, new run rebuilds, best and daysCompleted stand', async () => {
    const db = testDb();
    const setup = await twoRequirementSetup();
    await completeDay(db, setup, '2026-06-10');
    await completeDay(db, setup, '2026-06-11');
    await completeDay(db, setup, '2026-06-12');
    // Day 13 is never completed (partial log only): the evaluated miss on
    // Day 14 resets Current Streak to 0. The participant stays in.
    await logAt(db, setup,
      { ...WATER, occurred_at: T('2026-06-13T09:00:00Z'), client_key: next('key') },
      '2026-06-13T09:00:00Z');
    const participationId = (await db.query<{ participation_id: string }>(
      'SELECT participation_id FROM challenge_participations WHERE challenge_id = $1',
      [setup.challengeId],
    )).rows[0].participation_id;
    const missed = await logAt(db, setup,
      { ...WATER, occurred_at: T('2026-06-14T09:00:00Z'), client_key: next('key') },
      '2026-06-14T09:00:00Z');
    expect(missed.participation.currentStreak).toBe(0);
    expect(missed.participation.bestStreak).toBe(3);
    expect(missed.participation.daysCompleted).toBe(3);
    expect(await episodeStatus(String(participationId))).toBe('active');
    // Completing Day 14 starts a fresh run at 1; best is preserved.
    const fresh = await logAt(db, setup,
      { ...SLEEP, occurred_at: T('2026-06-14T21:00:00Z'), client_key: next('key') },
      '2026-06-14T21:00:00Z');
    expect(fresh.participation.currentStreak).toBe(1);
    expect(fresh.participation.bestStreak).toBe(3);
    expect(fresh.participation.daysCompleted).toBe(4);
    // A later 4-day run (06-14..06-17) becomes the new best; daysCompleted
    // stays cumulative across the reset (3 + 4 = 7).
    await completeDay(db, setup, '2026-06-15');
    await completeDay(db, setup, '2026-06-16');
    const peak = await completeDay(db, setup, '2026-06-17');
    expect(peak.participation.currentStreak).toBe(4);
    expect(peak.participation.bestStreak).toBe(4);
    expect(peak.participation.daysCompleted).toBe(7);
  });
});

describe('EBC-03 LATE LOGGING — closed days never reopen', () => {
  it('16: backdated activity for an already-closed missed day cannot restore it', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'streak',
      timezone: NAIROBI,
      required_consecutive_days: 30,
      activities: [pushUp()],
    });
    await insertEpisode(db, {
      challengeId: setup.challengeId, memberId: setup.memberId, joinedAt: '2026-06-01T00:00:00Z',
    });
    // Day 10 complete; Day 11 missed (nothing logged); Day 12 complete.
    await logAt(db, setup,
      { occurred_at: T('2026-06-10T12:00:00Z'), client_key: next('key') }, '2026-06-10T12:00:00Z');
    const day12 = await logAt(db, setup,
      { occurred_at: T('2026-06-12T12:00:00Z'), client_key: next('key') }, '2026-06-12T12:00:00Z');
    expect(day12.participation.currentStreak).toBe(1);
    expect(day12.participation.bestStreak).toBe(1);
    const before = await counts();
    // A backdated Day-11 log arriving on Day 12 is rejected outright.
    const late = await applyErr(logAt(db, setup,
      { occurred_at: T('2026-06-11T12:00:00Z'), client_key: next('key') }, '2026-06-12T12:00:00Z'));
    expect(late.statusCode).toBe(422);
    expect(late.code).toBe('streak_day_closed');
    expect((late as { eligibilityReason?: string }).eligibilityReason)
      .toBe(ELIGIBILITY_REASON.STREAK_DAY_CLOSED);
    // No Streak mutation: Day 11 stays missed, the run stands, nothing stored.
    expect(await counts()).toEqual({ ...before, intents: before.intents + 1 });
    const stored = await db.query(
      'SELECT current_streak, best_streak, days_completed, day_states FROM challenge_participation_derived',
    );
    const row = stored.rows[0] as {
      current_streak: number; best_streak: number; days_completed: number; day_states: unknown;
    };
    expect(Number(row.current_streak)).toBe(1);
    expect(Number(row.best_streak)).toBe(1);
    expect(Number(row.days_completed)).toBe(2);
    const states = (typeof row.day_states === 'string' ? JSON.parse(row.day_states) : row.day_states) as Record<string, { complete: boolean }>;
    expect(states['2026-06-11']).toBeUndefined();
  });

  it('17: no grace-period behavior exists (one minute past midnight still rejects)', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'streak',
      timezone: NAIROBI,
      required_consecutive_days: 30,
      activities: [pushUp()],
    });
    await insertEpisode(db, {
      challengeId: setup.challengeId, memberId: setup.memberId, joinedAt: '2026-06-01T00:00:00Z',
    });
    // Activity at 23:59 Nairobi on Day 11, submitted at 00:01 on Day 12:
    // the Day-11 Challenge day has closed — no grace period admits it.
    const late = await applyErr(logAt(db, setup,
      { occurred_at: T('2026-06-11T20:59:00Z'), client_key: next('key') },
      '2026-06-11T21:01:00Z'));
    expect(late.code).toBe('streak_day_closed');
    expect((await counts()).events).toBe(0);
    expect((await counts()).records).toBe(0);
  });

  it('18: rejected late submission produces no Streak mutation', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'streak',
      required_consecutive_days: 30,
      activities: [pushUp()],
    });
    await insertEpisode(db, {
      challengeId: setup.challengeId, memberId: setup.memberId, joinedAt: '2026-06-01T00:00:00Z',
    });
    await logAt(db, setup,
      { occurred_at: T('2026-06-10T12:00:00Z'), client_key: next('key') }, '2026-06-10T12:00:00Z');
    const before = await counts();
    const key = next('late');
    const first = await applyErr(logAt(db, setup,
      { occurred_at: T('2026-06-09T12:00:00Z'), client_key: key }, '2026-06-10T12:00:00Z'));
    expect(first.code).toBe('streak_day_closed');
    // Identical retry replays the same rejection; nothing ever persists
    // except the single durable rejected intent.
    const retry = await applyErr(logAt(db, setup,
      { occurred_at: T('2026-06-09T12:00:00Z'), client_key: key }, '2026-06-10T12:00:00Z'));
    expect(retry.code).toBe('streak_day_closed');
    expect(await counts()).toEqual({ ...before, intents: before.intents + 1 });
    expect(await intentsFor(key)).toHaveLength(1);
    expect((await intentsFor(key))[0].eligibility_reason).toBe(ELIGIBILITY_REASON.STREAK_DAY_CLOSED);
  });
});

describe('EBC-03 LATE JOIN / PARTICIPATION — window governs, episodes own eligibility', () => {
  it('19: late join does not change the Challenge denominator', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'streak',
      required_consecutive_days: 30,
      activities: [pushUp()],
    });
    // Join on Day 8 of the 30-day Challenge (2026-06-01..2026-06-30).
    await insertEpisode(db, {
      challengeId: setup.challengeId, memberId: setup.memberId, joinedAt: '2026-06-08T00:00:00Z',
    });
    await logAt(db, setup,
      { occurred_at: T('2026-06-08T12:00:00Z'), client_key: next('key') }, '2026-06-08T12:00:00Z');
    const second = await logAt(db, setup,
      { occurred_at: T('2026-06-09T12:00:00Z'), client_key: next('key') }, '2026-06-09T12:00:00Z');
    expect(second.participation.currentStreak).toBe(2);
    expect(second.participation.daysCompleted).toBe(2);
    const detail = await getChallengeDetail(db, setup.memberId, setup.challengeId, {
      groupMembershipAuthority: { resolveGroupMembershipAuthority: async () => ({ status: 'active', eligible: true }) },
    });
    // Still a 30-day Challenge — never redefined as a personal 23-day one.
    expect(detail.startDate).toBe('2026-06-01');
    expect(detail.endDate).toBe('2026-06-30');
    expect(detail.config.requiredConsecutiveDays).toBe(30);
    expect(detail.timezone).toBe('UTC');
  });

  it('20: pre-join activity cannot count', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'streak',
      required_consecutive_days: 30,
      activities: [pushUp()],
    });
    await insertEpisode(db, {
      challengeId: setup.challengeId, memberId: setup.memberId, joinedAt: '2026-06-08T03:00:00Z',
    });
    // Same Challenge day, but the Evidence instant predates the join.
    const early = await applyErr(logAt(db, setup,
      { occurred_at: T('2026-06-08T01:00:00Z'), client_key: next('key') }, '2026-06-08T12:00:00Z'));
    expect(early.code).toBe('no_participation_episode');
    expect((await counts()).records).toBe(0);
  });

  it('21: participation gap activity cannot count', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'streak',
      required_consecutive_days: 30,
      activities: [pushUp()],
    });
    await insertEpisode(db, {
      challengeId: setup.challengeId,
      memberId: setup.memberId,
      joinedAt: '2026-06-01T00:00:00Z',
      status: 'withdrawn',
      exitedAt: '2026-06-05T00:00:00Z',
      exitReason: 'withdrawn',
    });
    const inGap = await applyErr(logAt(db, setup,
      { occurred_at: T('2026-06-06T12:00:00Z'), client_key: next('key') }, '2026-06-06T12:00:00Z'));
    expect(inGap.code).toBe('no_participation_episode');
    expect((await counts()).records).toBe(0);
  });

  it('22: rejoin does not retroactively heal missed days', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'streak',
      required_consecutive_days: 30,
      activities: [pushUp()],
    });
    const firstEpisode = await insertEpisode(db, {
      challengeId: setup.challengeId, memberId: setup.memberId, joinedAt: '2026-06-01T00:00:00Z',
    });
    await logAt(db, setup,
      { occurred_at: T('2026-06-10T12:00:00Z'), client_key: next('key') }, '2026-06-10T12:00:00Z');
    await logAt(db, setup,
      { occurred_at: T('2026-06-11T12:00:00Z'), client_key: next('key') }, '2026-06-11T12:00:00Z');
    // Leave on Day 12; rejoin on Day 13 (fresh episode, fresh truth).
    await db.query(
      `UPDATE challenge_participations SET status = 'withdrawn', exited_at = $2, exit_reason = 'withdrawn'
       WHERE participation_id = $1`,
      [firstEpisode, '2026-06-12T00:00:00Z'],
    );
    const secondEpisode = await insertEpisode(db, {
      challengeId: setup.challengeId, memberId: setup.memberId, joinedAt: '2026-06-13T00:00:00Z',
    });
    expect(secondEpisode).not.toBe(firstEpisode);
    await logAt(db, setup,
      { occurred_at: T('2026-06-13T12:00:00Z'), client_key: next('key') }, '2026-06-13T12:00:00Z');
    const resumed = await logAt(db, setup,
      { occurred_at: T('2026-06-14T12:00:00Z'), client_key: next('key') }, '2026-06-14T12:00:00Z');
    // The new episode builds its own run (no stitching across the gap and
    // no fabricated pre-join days); the missed Day 12 stays missed.
    expect(resumed.participation.currentStreak).toBe(2);
    expect(resumed.participation.bestStreak).toBe(2);
    expect(resumed.participation.daysCompleted).toBe(2);
    expect(Object.keys(resumed.participation.dayStates).sort()).toEqual(['2026-06-13', '2026-06-14']);
    expect(resumed.record.participation_id).toBe(secondEpisode);
  });
});

describe('EBC-03 REGRESSION — other families and the acceptance chain are unchanged', () => {
  it('23: collective behavior unchanged (backdated logs still accepted)', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'collective',
      goal_value: 1000,
      goal_unit: 'reps',
      activities: [pushUp()],
    });
    await insertEpisode(db, {
      challengeId: setup.challengeId, memberId: setup.memberId, joinedAt: '2026-06-01T00:00:00Z',
    });
    // EBC-04: clock driven to the log's day (expired windows refuse
    // ordinary logging regardless of family).
    const result = await applyChallengeActivity(
      db, setup.memberId, setup.challengeId,
      {
        activity_kind: 'fitness', canonical_key: 'push-up', value: 600, unit: 'reps',
        occurred_at: T('2026-06-10T12:00:00Z'), client_key: next('key'),
      },
      resolversFor(setup.pins),
      { now: T('2026-06-10T12:00:00Z') },
    );
    expect(result.duplicate).toBe(false);
    expect(result.record.occurred_day).toBe('2026-06-10');
    expect(result.challenge.collectiveTotal).toBe(600);
  });

  it('24: competitive behavior unchanged (backdated logs still accepted)', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'competitive',
      activities: [pushUp({ target_value: 100 })],
    });
    await insertEpisode(db, {
      challengeId: setup.challengeId, memberId: setup.memberId, joinedAt: '2026-06-01T00:00:00Z',
    });
    const first = await applyChallengeActivity(
      db, setup.memberId, setup.challengeId,
      {
        activity_kind: 'fitness', canonical_key: 'push-up', value: 60, unit: 'reps',
        occurred_at: T('2026-06-10T12:00:00Z'), client_key: next('key'),
      },
      resolversFor(setup.pins),
      { now: T('2026-06-10T12:00:00Z') },
    );
    const second = await applyChallengeActivity(
      db, setup.memberId, setup.challengeId,
      {
        activity_kind: 'fitness', canonical_key: 'push-up', value: 50, unit: 'reps',
        occurred_at: T('2026-06-11T12:00:00Z'), client_key: next('key'),
      },
      resolversFor(setup.pins),
      { now: T('2026-06-11T12:00:00Z') },
    );
    expect(second.participation.cumulativeTotal).toBe(
      first.participation.cumulativeTotal + 50,
    );
  });

  it('25: EBC-02 accepted/rejected/idempotency behavior unchanged', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'competitive',
      activities: [pushUp()],
    });
    await insertEpisode(db, {
      challengeId: setup.challengeId, memberId: setup.memberId, joinedAt: '2026-06-01T00:00:00Z',
    });
    const resolvers = resolversFor(setup.pins);
    const base = {
      activity_kind: 'fitness' as const, canonical_key: 'push-up', value: 20, unit: 'reps',
      occurred_at: T('2026-06-10T12:00:00Z'),
    };
    // Accepted + identical retry replays (duplicate, one intent, one record).
    // (Clock driven to the log's day throughout, per EBC-04 expiry rule.)
    const atLogDay = { now: T('2026-06-10T12:00:00Z') };
    const first = await applyChallengeActivity(
      db, setup.memberId, setup.challengeId, { ...base, client_key: 'ebc02-same' }, resolvers,
      atLogDay,
    );
    const replay = await applyChallengeActivity(
      db, setup.memberId, setup.challengeId, { ...base, client_key: 'ebc02-same' }, resolvers,
      atLogDay,
    );
    expect(replay.duplicate).toBe(true);
    expect(replay.record.record_id).toBe(first.record.record_id);
    // Same key + different payload conflicts (CORR-001 binding intact).
    const conflict = await applyErr(applyChallengeActivity(
      db, setup.memberId, setup.challengeId, { ...base, value: 25, client_key: 'ebc02-same' }, resolvers,
      atLogDay,
    ));
    expect(conflict.statusCode).toBe(409);
    // Rejected submissions still persist a rejected intent with no effect.
    const rejected = await applyErr(applyChallengeActivity(
      db, setup.memberId, setup.challengeId,
      { ...base, unit: 'km', client_key: 'ebc02-bad' }, resolvers,
      atLogDay,
    ));
    expect(rejected.code).toBe('wrong_unit');
    expect((await intentsFor('ebc02-bad'))[0].acceptance_status).toBe('rejected');
  });

  it('26: deterministic replay matches live Streak state', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'streak',
      timezone: NAIROBI,
      required_consecutive_days: 30,
      activities: [water(), sleep8h()],
      kinds: { 'sleep-8h': 'wellness' },
    });
    await insertEpisode(db, {
      challengeId: setup.challengeId, memberId: setup.memberId, joinedAt: '2026-06-01T00:00:00Z',
    });
    const WATER = { canonical_key: 'water-intake', value: 2000, unit: 'millilitres' };
    const SLEEP = {
      canonical_key: 'sleep-8h', activity_kind: 'wellness' as const, value: 8, unit: 'hours',
    };
    const day = async (date: string, parts: Array<'water' | 'sleep'>) => {
      for (const part of parts) {
        const input = part === 'water' ? WATER : SLEEP;
        await logAt(db, setup,
          { ...input, occurred_at: T(`${date}T12:00:00Z`), client_key: next('key') }, `${date}T12:00:00Z`);
      }
    };
    // Consecutive completes, a partial day, a missed day reset, a new run,
    // and a rejected late attempt on top.
    await day('2026-06-10', ['water', 'sleep']);
    await day('2026-06-11', ['water', 'sleep']);
    await day('2026-06-12', ['water']);
    await day('2026-06-14', ['water', 'sleep']);
    const late = await applyErr(logAt(db, setup,
      { ...SLEEP, occurred_at: T('2026-06-12T18:00:00Z'), client_key: next('key') },
      '2026-06-14T12:00:00Z'));
    expect(late.code).toBe('streak_day_closed');
    const recomputed = await recomputeChallengeDerived(db, setup.challengeId);
    expect(recomputed.recordsReplayed).toBe(7);
    const storedRows = await db.query(
      'SELECT * FROM challenge_participation_derived WHERE challenge_id = $1',
      [setup.challengeId],
    );
    expect(storedRows.rows).toHaveLength(1);
    const stored = normalizeParticipationDerived(storedRows.rows[0] as Record<string, unknown>);
    const onlyId = Object.keys(recomputed.participations)[0];
    expect(recomputed.participations[onlyId]).toEqual({
      logsAccepted: stored.logsAccepted,
      distinctDays: stored.distinctDays,
      totalPoints: stored.totalPoints,
      completionRate: stored.completionRate,
      cumulativeValues: stored.cumulativeValues,
      cumulativeTotal: stored.cumulativeTotal,
      currentStreak: stored.currentStreak,
      bestStreak: stored.bestStreak,
      lastCompletedDay: stored.lastCompletedDay,
      dayStates: stored.dayStates,
      daysCompleted: stored.daysCompleted,
      completionStatus: stored.completionStatus,
      completedAt: stored.completedAt,
    });
    // Live truth itself: 06-10, 06-11, 06-14 complete; 06-12 partial (missed),
    // 06-13 never logged; reset visible.
    expect(stored.currentStreak).toBe(1);
    expect(stored.bestStreak).toBe(2);
    expect(stored.daysCompleted).toBe(3);
    expect(stored.dayStates['2026-06-12'].complete).toBe(false);
    expect(stored.dayStates['2026-06-13']).toBeUndefined();
  });

  it('read model exposes governing timezone with Streak truth', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'streak',
      timezone: NAIROBI,
      required_consecutive_days: 30,
      activities: [pushUp()],
    });
    await insertEpisode(db, {
      challengeId: setup.challengeId, memberId: setup.memberId, joinedAt: '2026-06-01T00:00:00Z',
    });
    await logAt(db, setup,
      { occurred_at: T('2026-06-10T12:00:00Z'), client_key: next('key') }, '2026-06-10T12:00:00Z');
    const authority = {
      resolveGroupMembershipAuthority: async () => ({ status: 'active', eligible: true }),
    };
    const detail = await getChallengeDetail(db, setup.memberId, setup.challengeId, {
      groupMembershipAuthority: authority,
    });
    expect(detail.timezone).toBe(NAIROBI);
    expect(detail.config.timezone).toBe(NAIROBI);
    expect(detail.myParticipation?.progress.currentStreak).toBe(1);
    expect(detail.myParticipation?.progress.bestStreak).toBe(1);
    expect(detail.myParticipation?.progress.daysCompleted).toBe(1);
    const visible = await listVisibleChallenges(db, setup.memberId, { groupMembershipAuthority: authority });
    expect(visible.find((s) => s.challengeId === setup.challengeId)?.timezone).toBe(NAIROBI);
  });
});
