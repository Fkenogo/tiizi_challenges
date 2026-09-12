/**
 * Phase C2B Derived Truth — server-owned, recomputable challenge outcome state.
 *
 * Stage F (M): Derived Truth is calculated from Challenge-specific records
 * only, automatically recalculated when underlying records change, and never
 * authored by clients. These structures cover all three families:
 *
 * - participation-derived state: volume (logs/days/points/rate), per-activity
 *   cumulative values, streak current/best/day-state, completion status/time;
 * - challenge-level state: collective actual total (exact sum, overshoot
 *   retained), goal completion, completions count.
 *
 * Recomputability: every transition is a pure fold over accepted
 * challenge_activity_records (ordered by accepted_at, record_id) plus
 * immutable configs. `recomputeChallengeDerived` replays that fold without
 * writing; the transactional seam persists each step identically. A future
 * governed correction (ACT-03/ACT-04, deferred) only changes which records
 * are effective (committed Evidence) — history rows are never mutated.
 *
 * Competitive finishing position (Stage F K.6/K.8/K.10) is derived at read
 * time from participation completed_at order (ties share; no artificial
 * tie-breaker) via computeFinishingPositions — it is not stored.
 *
 * No Firebase. No routes. Pure domain + `Db`.
 */

import type { Db } from './db.js';
import { selectEngine, type ChallengeContext, type LogEvent, type MembershipSnapshot } from './engine/index.js';
import { isParticipationActiveAt, type ParticipationRow } from './challengeParticipations.js';
import {
  canonicalActivityIdentity,
  getGoverningVersion,
  type ActivityConfigRow,
  type GoverningSnapshot,
} from './challengeConfigs.js';

export const DERIVED_ENGINE_VERSION = 'v2';
export const DERIVED_SCORING_VERSION = 'computeActivityScore/v1';

export type ParticipationCompletion = 'in_progress' | 'completed';

export interface DayState {
  complete: boolean;
  activities: string[];
}

/** Fold state for one participation episode (JSON-friendly; mirrors the table). */
export interface ParticipationTruthState {
  logsAccepted: number;
  distinctDays: number;
  totalPoints: number;
  completionRate: number;
  cumulativeValues: Record<string, number>;
  cumulativeTotal: number;
  currentStreak: number;
  bestStreak: number;
  lastCompletedDay: string | null;
  dayStates: Record<string, DayState>;
  daysCompleted: number;
  completionStatus: ParticipationCompletion;
  completedAt: string | null;
}

/** Fold state for one challenge (JSON-friendly; mirrors the table). */
export interface ChallengeTruthState {
  collectiveTotal: number;
  collectiveGoalReached: boolean;
  goalCompletedAt: string | null;
  completionsCount: number;
}

export interface ParticipationDerivedRow extends ParticipationTruthState {
  participation_id: string;
  challenge_id: string;
  member_id: string;
  engine_version: string;
  scoring_version: string;
  updated_at: string;
}

export interface ChallengeDerivedRow extends ChallengeTruthState {
  challenge_id: string;
  challenge_type: string;
  engine_version: string;
  scoring_version: string;
  updated_at: string;
}

export function emptyParticipationState(): ParticipationTruthState {
  return {
    logsAccepted: 0,
    distinctDays: 0,
    totalPoints: 0,
    completionRate: 0,
    cumulativeValues: {},
    cumulativeTotal: 0,
    currentStreak: 0,
    bestStreak: 0,
    lastCompletedDay: null,
    dayStates: {},
    daysCompleted: 0,
    completionStatus: 'in_progress',
    completedAt: null,
  };
}

export function emptyChallengeState(): ChallengeTruthState {
  return {
    collectiveTotal: 0,
    collectiveGoalReached: false,
    goalCompletedAt: null,
    completionsCount: 0,
  };
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function fail(message: string): never {
  throw new Error(`derived-truth: ${message}`);
}

/** Inclusive calendar days in [start, end] (YYYY-MM-DD). */
export function periodDays(startDate: string, endDate: string): number {
  if (!DAY_RE.test(startDate) || !DAY_RE.test(endDate)) fail('challenge period must be YYYY-MM-DD');
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  const days = Math.round((end - start) / 86_400_000) + 1;
  if (!Number.isFinite(days) || days < 1) fail('challenge period must span at least one day');
  return days;
}

function targetTypeFor(challengeType: string): ChallengeContext['targetType'] {
  if (challengeType === 'collective') return 'group-pool';
  if (challengeType === 'competitive') return 'cumulative';
  if (challengeType === 'streak') return 'daily';
  fail(`unknown challenge_type '${challengeType}'`);
}

/**
 * Adapt ONE immutable governing version into the engine's pure input.
 * Every governing value comes from the pinned snapshot — never from the
 * mutable challenges mirrors. Engine activity identity is the stable
 * canonical (key + variant) identity, NOT the per-version activity_config_id:
 * versions mint new config rows, so per-row keys would silently reset
 * cumulative progress and streak day-sets on any config change (even a pure
 * extension, whose history Stage F preserves). The activity_config_id stays
 * the record's pinned application anchor; progress keys stay comparable.
 */
export function toChallengeContext(
  challengeId: string,
  snapshot: GoverningSnapshot,
  activities: ActivityConfigRow[],
): ChallengeContext {
  return {
    challengeId,
    challengeType: snapshot.challenge_type,
    engineVersion: 'v2',
    targetType: targetTypeFor(snapshot.challenge_type),
    durationDays: periodDays(snapshot.start_date, snapshot.end_date),
    activities: activities.map((a) => ({
      activityId: canonicalActivityIdentity(a.canonical_key, a.activity_variant),
      exerciseId: canonicalActivityIdentity(a.canonical_key, a.activity_variant),
      exerciseName: a.canonical_key,
      targetValue: a.target_value,
      unit: a.unit,
    })),
    startDate: snapshot.start_date,
    endDate: snapshot.end_date,
    groupCumulativeTarget: snapshot.goal_value ?? undefined,
    autoCompleteOnGroupTarget: true,
    requiredConsecutiveDays: snapshot.required_consecutive_days ?? undefined,
    streakResetOnMiss: snapshot.reset_on_miss,
  };
}

/** Adapt current derived state into the engine's membership snapshot. */
export function toMembershipSnapshot(
  state: ParticipationTruthState,
  memberId: string,
  challengeId: string,
  totalActivities: number,
): MembershipSnapshot {
  // The streak engine accumulates the current day's logged requirements in
  // dailyCompletedActivities/dailyTargetDate. Without feeding the latest
  // logged day back in, multi-activity days could never complete and
  // same-day repeats would advance twice. The latest day with accepted logs
  // is the accumulation basis; the engine resets it when the day changes.
  const loggedDays = Object.keys(state.dayStates).sort();
  const latestDay = loggedDays.length > 0 ? loggedDays[loggedDays.length - 1] : undefined;
  return {
    userId: memberId,
    challengeId,
    status: state.completionStatus === 'completed' ? 'completed' : 'active',
    activitiesCompleted: state.logsAccepted,
    totalActivities,
    completionRate: state.completionRate,
    totalPoints: state.totalPoints,
    cumulativeLoggedValue: state.cumulativeTotal,
    cumulativeValues: { ...state.cumulativeValues },
    lastLogDate: state.lastCompletedDay ?? undefined,
    currentStreak: state.currentStreak,
    longestStreak: state.bestStreak,
    dailyCompletedActivities: latestDay ? [...state.dayStates[latestDay].activities] : [],
    dailyTargetDate: latestDay,
    engineVersion: 'v2',
  };
}

export interface AcceptedRecordInput {
  record_id: string;
  activity_config_id: string;
  value: number;
  unit: string;
  occurred_day: string;
  points_awarded: number;
  accepted_at: string;
}

export interface RecordUpdateInput {
  challenge_id: string;
  /** The record's PINNED immutable governing version (snapshot = authority). */
  snapshot: GoverningSnapshot;
  memberId: string;
  /** Governing-version activity rows (same version as the snapshot). */
  activities: ActivityConfigRow[];
  prevPart: ParticipationTruthState;
  prevChallenge: ChallengeTruthState;
  record: AcceptedRecordInput;
}

export interface RecordUpdate {
  part: ParticipationTruthState;
  challenge: ChallengeTruthState;
  /** True when this record newly triggered completion (first crossing). */
  completionTriggered: boolean;
}

/**
 * Pure per-record fold: previous derived state + one accepted record ->
 * next derived state. Shared by the transactional seam and recomputation,
 * so replay reproduces the stored outcome exactly.
 */
export function applyAcceptedRecord(input: RecordUpdateInput): RecordUpdate {
  const { challenge_id, snapshot, memberId, activities, prevPart, prevChallenge, record } = input;
  const context = toChallengeContext(challenge_id, snapshot, activities);
  const totalActivities = Math.max(1, context.durationDays * Math.max(1, activities.length));
  const engine = selectEngine({ engineVersion: 'v2', challengeType: snapshot.challenge_type });
  const recordRow = activities.find((a) => a.activity_config_id === record.activity_config_id);
  if (!recordRow) fail('record activity_config is not part of the governing version');
  const activityIdentity = canonicalActivityIdentity(recordRow.canonical_key, recordRow.activity_variant);
  const logEvent: LogEvent = {
    userId: memberId,
    challengeId: challenge_id,
    activityId: activityIdentity,
    value: record.value,
    unit: record.unit,
    date: record.occurred_day,
    loggedAt: new Date(record.accepted_at),
    pointsEarned: record.points_awarded,
  };
  const membership = toMembershipSnapshot(prevPart, memberId, challenge_id, totalActivities);
  const result = engine.computeUpdate(context, membership, logEvent, {
    groupCurrentTotal: prevChallenge.collectiveTotal,
  });
  const mu = result.membershipUpdate;

  // Day-state merge, keyed by stable canonical activity identity (comparable
  // across versions). Streak days are Done only when ALL governing-version
  // requirements are logged (engine tracks the set; the flag below mirrors
  // it so recomputation agrees without re-reading the engine internals). A
  // day once Done stays Done: later versions' changed requirements never
  // un-complete history, and backdated logs only add to the day's set.
  const requiredIds = new Set(
    activities.map((a) => canonicalActivityIdentity(a.canonical_key, a.activity_variant)),
  );
  const prevDay = prevPart.dayStates[record.occurred_day] ?? { complete: false, activities: [] };
  let dayActivities: string[];
  let newlyComplete: boolean;
  if (snapshot.challenge_type === 'streak') {
    const engineSet = mu.dailyCompletedActivities ?? [...prevDay.activities, activityIdentity];
    dayActivities = [...new Set(engineSet)].sort();
    newlyComplete = requiredIds.size === 0 || [...requiredIds].every((id) => dayActivities.includes(id));
  } else {
    dayActivities = [...new Set([...prevDay.activities, activityIdentity])].sort();
    newlyComplete = true;
  }
  const dayComplete = prevDay.complete || newlyComplete;
  const dayStates: Record<string, DayState> = {
    ...prevPart.dayStates,
    [record.occurred_day]: { complete: dayComplete, activities: dayActivities },
  };
  const distinctDays = Object.keys(dayStates).length;
  const daysCompleted = snapshot.challenge_type === 'streak'
    ? Object.values(dayStates).filter((d) => d.complete).length
    : distinctDays;

  // Cumulative maps keyed by stable canonical identity so progress survives
  // version transitions. Engines that track them return them; otherwise the
  // fold maintains the exact sum so every family keeps a truthful total.
  const cumulativeValues: Record<string, number> = mu.cumulativeValues
    ? { ...mu.cumulativeValues }
    : {
      ...prevPart.cumulativeValues,
      [activityIdentity]: (prevPart.cumulativeValues[activityIdentity] ?? 0) + record.value,
    };
  const cumulativeTotal = mu.cumulativeLoggedValue ?? (prevPart.cumulativeTotal + record.value);

  // EBC-04: streak completion is a FINALIZATION-time terminal evaluation
  // (Stage F FR-V2-112: reaching requiredConsecutiveDays must not finish a
  // participant early). Live streak records therefore never flip completion
  // here — not in the seam and not in replay (this fold is shared, so parity
  // holds by construction). finalizeChallenge evaluates terminal completion
  // from bestStreak against the governing requiredConsecutiveDays.
  const engineCompleted = mu.status === 'completed' && prevPart.completionStatus === 'in_progress';
  const newlyCompleted = snapshot.challenge_type === 'streak' ? false : engineCompleted;
  const part: ParticipationTruthState = {
    logsAccepted: prevPart.logsAccepted + 1,
    distinctDays,
    totalPoints: mu.totalPoints,
    completionRate: mu.completionRate,
    cumulativeValues,
    cumulativeTotal,
    currentStreak: mu.currentStreak ?? prevPart.currentStreak,
    bestStreak: mu.longestStreak ?? prevPart.bestStreak,
    lastCompletedDay: mu.lastLogDate ?? prevPart.lastCompletedDay,
    dayStates,
    daysCompleted,
    completionStatus: newlyCompleted ? 'completed' : prevPart.completionStatus,
    completedAt: newlyCompleted ? new Date(record.accepted_at).toISOString() : prevPart.completedAt,
  };

  let challengeState = prevChallenge;
  let completionTriggered = newlyCompleted && snapshot.challenge_type !== 'collective';
  if (snapshot.challenge_type === 'collective') {
    const goal = snapshot.goal_value ?? 0;
    const newTotal = prevChallenge.collectiveTotal + record.value;
    const reached = goal > 0 && newTotal >= goal;
    const newlyReached = reached && !prevChallenge.collectiveGoalReached;
    challengeState = {
      ...prevChallenge,
      collectiveTotal: newTotal,
      collectiveGoalReached: prevChallenge.collectiveGoalReached || reached,
      goalCompletedAt: newlyReached
        ? new Date(record.accepted_at).toISOString()
        : prevChallenge.goalCompletedAt,
    };
    completionTriggered = newlyReached;
  }
  return { part, challenge: challengeState, completionTriggered };
}

/**
 * Finishing positions for completed participations (competitive; Stage F
 * K.6/K.8/K.10): ordered by governed completion time, earlier = higher.
 * Identical completion instants share the position with no artificial
 * tie-breaker (standard competition ranking: 1, 1, 3, ...). Non-completers
 * receive no position (null).
 */
export function computeFinishingPositions(
  completions: Array<{ participation_id: string; completed_at: string | null }>,
  allIds: string[],
): Record<string, number | null> {
  const positions: Record<string, number | null> = {};
  for (const id of allIds) positions[id] = null;
  const done = completions
    .filter((c) => c.completed_at != null)
    .map((c) => ({ id: c.participation_id, at: Date.parse(c.completed_at as string) }))
    .filter((c) => Number.isFinite(c.at))
    .sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  let rank = 0;
  let prevAt: number | null = null;
  for (const [index, entry] of done.entries()) {
    if (prevAt == null || entry.at !== prevAt) rank = index + 1;
    positions[entry.id] = rank;
    prevAt = entry.at;
  }
  return positions;
}

// ─── Persistence (seam-owned; clients never write these tables) ────────────

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (value == null) return {};
  if (typeof value === 'string') return JSON.parse(value) as Record<string, unknown>;
  return value as Record<string, unknown>;
}

function asDayStates(value: unknown): Record<string, DayState> {
  const raw = parseJsonObject(value);
  const out: Record<string, DayState> = {};
  for (const [day, entry] of Object.entries(raw)) {
    if (!DAY_RE.test(day)) continue;
    const state = entry as Partial<DayState>;
    out[day] = {
      complete: state.complete === true,
      activities: Array.isArray(state.activities)
        ? (state.activities as unknown[]).map(String).sort()
        : [],
    };
  }
  return out;
}

function asNumberMap(value: unknown): Record<string, number> {
  const raw = parseJsonObject(value);
  const out: Record<string, number> = {};
  for (const [key, entry] of Object.entries(raw)) {
    const n = Number(entry);
    if (Number.isFinite(n)) out[key] = n;
  }
  return out;
}

function toDayOrNull(value: string | Date | null | undefined): string | null {
  if (value == null) return null;
  const day = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
  return DAY_RE.test(day) ? day : null;
}

export function normalizeParticipationDerived(row: Record<string, unknown>): ParticipationDerivedRow {
  return {
    participation_id: String(row.participation_id),
    challenge_id: String(row.challenge_id),
    member_id: String(row.member_id),
    logsAccepted: Number(row.logs_accepted ?? 0),
    distinctDays: Number(row.distinct_days ?? 0),
    totalPoints: Number(row.total_points ?? 0),
    completionRate: Number(row.completion_rate ?? 0),
    cumulativeValues: asNumberMap(row.cumulative_values),
    cumulativeTotal: Number(row.cumulative_total ?? 0),
    currentStreak: Number(row.current_streak ?? 0),
    bestStreak: Number(row.best_streak ?? 0),
    lastCompletedDay: toDayOrNull(row.last_completed_day as string | Date | null),
    dayStates: asDayStates(row.day_states),
    daysCompleted: Number(row.days_completed ?? 0),
    completionStatus: row.completion_status === 'completed' ? 'completed' : 'in_progress',
    completedAt: row.completed_at == null ? null : new Date(row.completed_at as string).toISOString(),
    engine_version: String(row.engine_version ?? DERIVED_ENGINE_VERSION),
    scoring_version: String(row.scoring_version ?? DERIVED_SCORING_VERSION),
    updated_at: new Date(row.updated_at as string).toISOString(),
  };
}

export function normalizeChallengeDerived(row: Record<string, unknown>): ChallengeDerivedRow {
  return {
    challenge_id: String(row.challenge_id),
    challenge_type: String(row.challenge_type),
    collectiveTotal: Number(row.collective_total ?? 0),
    collectiveGoalReached: Boolean(row.collective_goal_reached),
    goalCompletedAt: row.goal_completed_at == null
      ? null
      : new Date(row.goal_completed_at as string).toISOString(),
    completionsCount: Number(row.completions_count ?? 0),
    engine_version: String(row.engine_version ?? DERIVED_ENGINE_VERSION),
    scoring_version: String(row.scoring_version ?? DERIVED_SCORING_VERSION),
    updated_at: new Date(row.updated_at as string).toISOString(),
  };
}

/** Ensure the participation derived row exists, then lock it. */
export async function lockParticipationDerived(
  tx: Db,
  participationId: string,
  challengeId: string,
  memberId: string,
): Promise<ParticipationDerivedRow> {
  await tx.query(
    `INSERT INTO challenge_participation_derived
       (participation_id, challenge_id, member_id, scoring_version)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (participation_id) DO NOTHING`,
    [participationId, challengeId, memberId, DERIVED_SCORING_VERSION],
  );
  const result = await tx.query(
    `SELECT * FROM challenge_participation_derived WHERE participation_id = $1 FOR UPDATE`,
    [participationId],
  );
  if (result.rows.length === 0) fail(`derived row missing for participation ${participationId}`);
  return normalizeParticipationDerived(result.rows[0] as Record<string, unknown>);
}

/** Ensure the challenge derived row exists, then lock it. */
export async function lockChallengeDerived(
  tx: Db,
  challengeId: string,
  challengeType: string,
): Promise<ChallengeDerivedRow> {
  await tx.query(
    `INSERT INTO challenge_derived_state (challenge_id, challenge_type, scoring_version)
     VALUES ($1, $2, $3)
     ON CONFLICT (challenge_id) DO NOTHING`,
    [challengeId, challengeType, DERIVED_SCORING_VERSION],
  );
  const result = await tx.query(
    `SELECT * FROM challenge_derived_state WHERE challenge_id = $1 FOR UPDATE`,
    [challengeId],
  );
  if (result.rows.length === 0) fail(`derived row missing for challenge ${challengeId}`);
  return normalizeChallengeDerived(result.rows[0] as Record<string, unknown>);
}

export async function persistParticipationDerived(
  tx: Db,
  participationId: string,
  state: ParticipationTruthState,
): Promise<void> {
  await tx.query(
    `UPDATE challenge_participation_derived
     SET logs_accepted = $2, distinct_days = $3, total_points = $4,
         completion_rate = $5, cumulative_values = $6, cumulative_total = $7,
         current_streak = $8, best_streak = $9, last_completed_day = $10,
         day_states = $11, days_completed = $12,
         completion_status = $13, completed_at = $14, updated_at = now()
     WHERE participation_id = $1`,
    [
      participationId,
      state.logsAccepted, state.distinctDays, state.totalPoints,
      state.completionRate, JSON.stringify(state.cumulativeValues), state.cumulativeTotal,
      state.currentStreak, state.bestStreak, state.lastCompletedDay,
      JSON.stringify(state.dayStates), state.daysCompleted,
      state.completionStatus, state.completedAt,
    ],
  );
}

export async function persistChallengeDerived(
  tx: Db,
  challengeId: string,
  state: ChallengeTruthState,
): Promise<void> {
  await tx.query(
    `UPDATE challenge_derived_state
     SET collective_total = $2, collective_goal_reached = $3,
         goal_completed_at = $4, completions_count = $5, updated_at = now()
     WHERE challenge_id = $1`,
    [
      challengeId,
      state.collectiveTotal, state.collectiveGoalReached,
      state.goalCompletedAt, state.completionsCount,
    ],
  );
}

// ─── Recompute seam (correction readiness; also the test oracle) ────────────

export interface RecomputedTruth {
  participations: Record<string, ParticipationTruthState>;
  challenge: ChallengeTruthState;
  recordsReplayed: number;
}

interface ReplayRecord extends AcceptedRecordInput {
  participation_id: string;
  challenge_id: string;
  member_id: string;
  config_version: number;
}

/**
 * Founder product rule (replay side): recomputation MUST use each record's
 * PINNED immutable governing version — never the current challenges mirrors.
 * A later version can change type params, period, or requirements; replaying
 * historical records under it would rewrite accepted history. The challenges
 * row below serves stable identity/existence only.
 *
 * Replay every effective accepted record for a challenge in acceptance
 * order and fold the same pure transition the seam persists. Effective =
 * the Evidence event is still committed (a superseded event's application
 * stays historical but no longer feeds Derived Truth). Collective goal
 * crossings complete all episodes active at the crossing instant, matching
 * the seam. Writes nothing; the caller compares the result to stored rows.
 */
export async function recomputeChallengeDerived(
  db: Db,
  challengeId: string,
): Promise<RecomputedTruth> {
  const challengeResult = await db.query<{ challenge_id: string }>(
    `SELECT challenge_id FROM challenges WHERE challenge_id = $1`,
    [challengeId],
  );
  if (challengeResult.rows.length === 0) fail(`unknown challenge ${challengeId}`);

  const episodeResult = await db.query(
    `SELECT * FROM challenge_participations WHERE challenge_id = $1
     ORDER BY joined_at ASC, participation_id ASC`,
    [challengeId],
  );
  const episodes = (episodeResult.rows as unknown as ParticipationRow[]).map((row) => ({
    participation_id: String(row.participation_id),
    member_id: String(row.member_id),
    joined_at: String(row.joined_at),
    exited_at: row.exited_at == null ? null : String(row.exited_at),
  }));

  const recordResult = await db.query(
    `SELECT r.*, e.member_id AS event_member_id, e.status AS event_status
     FROM challenge_activity_records r
     JOIN member_activity_events e ON e.event_id = r.event_id
     WHERE r.challenge_id = $1 AND e.status = 'committed'
     ORDER BY r.accepted_at ASC, r.record_id ASC`,
    [challengeId],
  );
  const records = (recordResult.rows as Record<string, unknown>[]).map((row) => ({
    record_id: String(row.record_id),
    participation_id: String(row.participation_id),
    challenge_id: String(row.challenge_id),
    member_id: String(row.event_member_id),
    config_version: Number(row.config_version),
    activity_config_id: String(row.activity_config_id),
    value: Number(row.value),
    unit: String(row.unit),
    occurred_day: String((row.occurred_day as string | Date) instanceof Date
      ? (row.occurred_day as Date).toISOString().slice(0, 10)
      : String(row.occurred_day)).slice(0, 10),
    points_awarded: Number(row.points_awarded),
    accepted_at: new Date(row.accepted_at as string).toISOString(),
  })) as ReplayRecord[];

  // One immutable governing bundle per pinned version. A challenge may hold
  // accepted records from several versions; each replays under its own
  // snapshot — versions are never collapsed onto the latest configuration.
  const bundles = new Map<number, { snapshot: GoverningSnapshot; activities: ActivityConfigRow[] }>();
  const bundleFor = async (version: number) => {
    const cached = bundles.get(version);
    if (cached) return cached;
    const bundle = await getGoverningVersion(db, challengeId, version);
    bundles.set(version, bundle);
    return bundle;
  };

  const partStates: Record<string, ParticipationTruthState> = {};
  for (const episode of episodes) partStates[episode.participation_id] = emptyParticipationState();
  let challengeState = emptyChallengeState();

  for (const record of records) {
    const { snapshot, activities } = await bundleFor(record.config_version);
    const prevPart = partStates[record.participation_id] ?? emptyParticipationState();
    partStates[record.participation_id] = prevPart;
    const update = applyAcceptedRecord({
      challenge_id: challengeId,
      snapshot,
      memberId: record.member_id,
      activities,
      prevPart,
      prevChallenge: challengeState,
      record,
    });
    partStates[record.participation_id] = update.part;
    challengeState = update.challenge;
    if (update.completionTriggered && snapshot.challenge_type === 'collective') {
      const at = new Date(record.accepted_at);
      for (const episode of episodes) {
        if (!isParticipationActiveAt(
          { joined_at: episode.joined_at, exited_at: episode.exited_at } as ParticipationRow, at,
        )) continue;
        const sibling = partStates[episode.participation_id];
        if (sibling.completionStatus === 'in_progress') {
          sibling.completionStatus = 'completed';
          sibling.completedAt = new Date(record.accepted_at).toISOString();
        }
      }
    }
  }
  challengeState.completionsCount = Object.values(partStates)
    .filter((s) => s.completionStatus === 'completed').length;
  return { participations: partStates, challenge: challengeState, recordsReplayed: records.length };
}
