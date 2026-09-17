/**
 * Phase C2A Challenge configuration versions — immutable governing snapshots.
 *
 * Reproducibility invariant: a future challenge_activity_record must identify
 * the exact activity/configuration version under which Evidence was accepted
 * and scored. Governing configuration therefore lives ONLY in append-only
 * version rows (snapshot JSONB = authority; activity rows = queryable
 * projection). Mutable current columns on challenges may change solely
 * together with a version bump (DB trigger enforces).
 *
 * Canonical Knowledge answers "what activity is this"; these rows answer
 * "how does THIS Challenge use that activity" (target, unit, variant,
 * conditions, ordering). Knowledge content is never duplicated here — only
 * the resolved pin (id + version) plus Challenge-specific terms.
 *
 * Provider-neutral seam: pure domain + `Db`. Knowledge resolution is
 * injected (server-side); unknown canonical keys are rejected, never
 * invented. No Firebase, no routes.
 */

import type { Db } from './db.js';
import { isCanonicalMetric } from './measurementVocabulary.js';
import {
  assertActivityMeasurementCompatible,
  type KnowledgeEligibilityResolver,
} from './knowledgeEligibility.js';

export interface KnowledgePin {
  knowledge_id: string;
  current_version: number;
}

export interface ChallengeConfigResolvers {
  resolveKnowledgePin: (canonicalKey: string) => Promise<KnowledgePin | null>;
  /**
   * EBC-01 CORR-001 REQUIRED establishment gate. Every version path
   * (initial establishment AND later versions) proves each activity's
   * (Activity, Metric, Unit) tuple through this resolver with the single
   * authoritative validator below — no code path may persist an unproven
   * tuple. Product entries wire the database readiness gate; tests wire
   * explicit fixtures (permit-all only where the test is not about
   * compatibility).
   */
  resolveKnowledgeEligibility: KnowledgeEligibilityResolver;
}

export interface ActivityConfigInput {
  canonical_key: string;
  activity_variant?: string | null;
  /**
   * EBC-01 governing Metric for this activity undertaking. Required on every
   * NEW configuration version: together with the resolved Knowledge item and
   * `unit` it forms the governed (Activity, Metric, Unit) tuple proven at
   * establishment time. Pre-EBC-01 rows predate it (see migration 009).
   */
  metric: string;
  target_value: number;
  unit: string;
  position?: number;
  conditions?: Record<string, unknown>;
}

export interface ConfigVersionRow {
  challenge_id: string;
  version: number;
  snapshot: Record<string, unknown>;
  created_at: string;
}

export interface ActivityConfigRow {
  activity_config_id: string;
  challenge_id: string;
  version: number;
  canonical_key: string;
  activity_variant: string | null;
  knowledge_id: string;
  knowledge_version: number;
  /** Governing Metric. Null ONLY on pre-EBC-01 rows (see migration 009). */
  metric: string | null;
  target_value: number;
  unit: string;
  position: number;
  conditions: Record<string, unknown>;
  /** PF-03 immutable Activity Code pin. Null ONLY on pre-PF-03 rows. */
  activity_code: string | null;
  /** PF-03 pinned required Component ids ([] when the version declares none). */
  required_components: string[];
  /** PF-03 Component relationship ('ALL_REQUIRED' exactly when pinned). */
  component_relationship: string | null;
  /** PF-03 explicit Load Reporting Basis (Weight configurations only). */
  load_reporting_basis: string | null;
  /** PF-03 Duration mode (Duration configurations only). */
  duration_mode: string | null;
  /** PF-03 Completion occurrence (Completion configurations only). */
  completion_occurrence: string | null;
  created_at: string;
}

export interface ChallengeGoverningBasis {
  start_date: string;
  end_date: string;
  goal_value: number | null;
  goal_unit: string | null;
  required_consecutive_days: number | null;
  reset_on_miss: boolean;
  /**
   * EBC-03 governing Challenge timezone (IANA, e.g. 'Africa/Nairobi').
   * The single timezone that defines the Challenge day for Streak temporal
   * evaluation (Stage F FR-V2-119). 'UTC' for pre-EBC-03 configurations.
   */
  timezone: string;
}

/** EBC-03 fail-closed IANA timezone check (Challenge/config authority). */
export function assertValidTimezone(timezone: unknown): string {
  if (typeof timezone !== 'string' || timezone.length < 1 || timezone.length > 100) {
    fail('timezone must be an IANA identifier string (1..100 chars)');
  }
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date(0));
  } catch {
    fail(`invalid timezone '${timezone}' (must be an IANA timezone identifier)`);
  }
  return timezone;
}

function fail(message: string): never {
  throw new Error(`challenge-configs: ${message}`);
}

/**
 * Coerce a DATE column (string or driver Date) to YYYY-MM-DD.
 *
 * A PostgreSQL DATE is a calendar date, not an instant, and drivers hand it
 * to Node as a midnight Date — but disagree on whose midnight: node-pg uses
 * server-local midnight while PGlite (tests) uses UTC midnight. An instant
 * exactly at UTC midnight is therefore the UTC calendar day; any other
 * midnight is the server-local calendar day. Either branch recovers exactly
 * the stored day on every process timezone (they coincide when the server
 * timezone is UTC). No arithmetic, no timezone special-casing, and never a
 * UTC projection of a local midnight (which shifted the day on UTC+ servers).
 */
export function toDayString(value: string | Date): string {
  let day: string;
  if (value instanceof Date) {
    const pad = (part: number): string => String(part).padStart(2, '0');
    day = value.getUTCHours() === 0
      && value.getUTCMinutes() === 0
      && value.getUTCSeconds() === 0
      && value.getUTCMilliseconds() === 0
      ? `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`
      : `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  } else {
    day = String(value).slice(0, 10);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) fail(`invalid day value '${String(value)}'`);
  return day;
}

export function validateActivityInputs(activities: ActivityConfigInput[]): void {
  if (!Array.isArray(activities) || activities.length === 0) {
    fail('at least one activity configuration is required');
  }
  if (activities.length > 50) fail('at most 50 activities per challenge version');
  const seen = new Set<string>();
  for (const [index, activity] of activities.entries()) {
    if (!activity.canonical_key || activity.canonical_key.length > 200) {
      fail(`activities[${index}].canonical_key is required (1..200 chars)`);
    }
    if (activity.activity_variant != null
      && (activity.activity_variant.length === 0 || activity.activity_variant.length > 120)) {
      fail(`activities[${index}].activity_variant must be 1..120 chars when present`);
    }
    const identity = `${activity.canonical_key}::${activity.activity_variant ?? ''}`;
    if (seen.has(identity)) fail(`duplicate activity configuration for '${identity}'`);
    seen.add(identity);
    if (!isCanonicalMetric(activity.metric)) {
      fail(
        `activities[${index}].metric must be a canonical Metric `
        + `(completion|repetitions|duration|distance|weight|quantity)`,
      );
    }
    if (!Number.isFinite(activity.target_value) || activity.target_value < 0) {
      fail(`activities[${index}].target_value must be a finite number >= 0`);
    }
    if (!activity.unit || activity.unit.length > 40) {
      fail(`activities[${index}].unit is required (1..40 chars)`);
    }
    if (activity.position !== undefined
      && (!Number.isInteger(activity.position) || activity.position < 0)) {
      fail(`activities[${index}].position must be an integer >= 0 when present`);
    }
  }
}

/**
 * Phase C3A collective-unit invariant (single shared predicate).
 *
 * A collective Challenge pools raw activity values into one unit-blind total
 * that is compared against goal_unit. Only exact canonical unit equality
 * keeps that total meaningful, so EVERY configured activity unit must exactly
 * equal the collective goal_unit. No conversion or equivalence is inferred:
 * minutes != hours, kilometres != metres, kilograms != anything else.
 *
 * Competitive and streak Challenges keep per-activity units (progress is
 * tracked per activity, never pooled) and are unaffected by this rule.
 */
export function assertCollectiveUnitHomogeneity(
  challengeType: string,
  goalUnit: string | null,
  activities: Array<{ unit: string }>,
): void {
  if (challengeType !== 'collective') return;
  if (!goalUnit) fail('collective challenges require goal_unit before activity units can be checked');
  for (const [index, activity] of activities.entries()) {
    if (activity.unit !== goalUnit) {
      fail(
        `collective activities[${index}] unit '${activity.unit}' `
        + `must exactly equal goal_unit '${goalUnit}' (no unit conversion is inferred)`,
      );
    }
  }
}

/** Canonical snapshot: complete governing config, JSON-stable key order. */
export function buildConfigSnapshot(
  challengeType: string,
  basis: ChallengeGoverningBasis,
  resolved: Array<{ input: ActivityConfigInput; pin: KnowledgePin; position: number }>,
): Record<string, unknown> {
  return {
    challenge_type: challengeType,
    period: { start_date: basis.start_date, end_date: basis.end_date },
    // EBC-03: the governing timezone is pinned per version, so historical
    // records replay under the terms that accepted them.
    timezone: basis.timezone,
    type_params: {
      goal_value: basis.goal_value,
      goal_unit: basis.goal_unit,
      required_consecutive_days: basis.required_consecutive_days,
      reset_on_miss: basis.reset_on_miss,
    },
    activities: resolved.map(({ input, pin, position }) => ({
      canonical_key: input.canonical_key,
      activity_variant: input.activity_variant ?? null,
      knowledge_id: pin.knowledge_id,
      knowledge_version: pin.current_version,
      metric: input.metric,
      target_value: input.target_value,
      unit: input.unit,
      position,
      conditions: input.conditions ?? {},
    })),
  };
}

async function resolvePins(
  activities: ActivityConfigInput[],
  resolvers: ChallengeConfigResolvers,
): Promise<KnowledgePin[]> {
  const pins: KnowledgePin[] = [];
  for (const activity of activities) {
    const pin = await resolvers.resolveKnowledgePin(activity.canonical_key);
    if (!pin) {
      fail(`unknown activity '${activity.canonical_key}' (no canonical Knowledge; pins are never invented)`);
    }
    pins.push(pin);
  }
  return pins;
}

function normalizeVersionRow(row: {
  challenge_id: unknown;
  version: unknown;
  snapshot: unknown;
  created_at: string | Date;
}): ConfigVersionRow {
  return {
    challenge_id: String(row.challenge_id),
    version: Number(row.version),
    snapshot: (typeof row.snapshot === 'string' ? JSON.parse(row.snapshot) : row.snapshot) as Record<string, unknown>,
    created_at: new Date(row.created_at).toISOString(),
  };
}

function normalizeActivityRow(row: {
  activity_config_id: unknown;
  challenge_id: unknown;
  version: unknown;
  canonical_key: unknown;
  activity_variant: unknown;
  knowledge_id: unknown;
  knowledge_version: unknown;
  metric: unknown;
  target_value: unknown;
  unit: unknown;
  position: unknown;
  conditions: unknown;
  activity_code?: unknown;
  required_components?: unknown;
  component_relationship?: unknown;
  load_reporting_basis?: unknown;
  duration_mode?: unknown;
  completion_occurrence?: unknown;
  created_at: string | Date;
}): ActivityConfigRow {
  return {
    activity_config_id: String(row.activity_config_id),
    challenge_id: String(row.challenge_id),
    version: Number(row.version),
    canonical_key: String(row.canonical_key),
    activity_variant: row.activity_variant == null ? null : String(row.activity_variant),
    knowledge_id: String(row.knowledge_id),
    knowledge_version: Number(row.knowledge_version),
    metric: row.metric == null ? null : String(row.metric),
    target_value: Number(row.target_value),
    unit: String(row.unit),
    position: Number(row.position),
    conditions: (typeof row.conditions === 'string'
      ? JSON.parse(row.conditions)
      : (row.conditions ?? {})) as Record<string, unknown>,
    // PF-03 pins: null-tolerant so pre-PF-03 rows (NULL/defaults) stay
    // interpretable without backfill or fabrication.
    activity_code: row.activity_code == null ? null : String(row.activity_code),
    required_components: Array.isArray(row.required_components)
      ? row.required_components.map(String)
      : [],
    component_relationship: row.component_relationship == null
      ? null
      : String(row.component_relationship),
    load_reporting_basis: row.load_reporting_basis == null
      ? null
      : String(row.load_reporting_basis),
    duration_mode: row.duration_mode == null ? null : String(row.duration_mode),
    completion_occurrence: row.completion_occurrence == null
      ? null
      : String(row.completion_occurrence),
    created_at: new Date(row.created_at).toISOString(),
  };
}

export interface VersionInsert {
  activities: ActivityConfigInput[];
  basis: ChallengeGoverningBasis;
  challengeType: string;
}

/**
 * Insert one immutable version + its activity rows. Caller owns the
 * transaction and the challenges.current_config_version bump.
 */
export async function insertConfigVersion(
  tx: Db,
  challengeId: string,
  version: number,
  insert: VersionInsert,
  resolvers: ChallengeConfigResolvers,
): Promise<{ snapshot: Record<string, unknown>; activities: ActivityConfigRow[] }> {
  validateActivityInputs(insert.activities);
  // CORR-001 centralized invariant: EVERY version path (initial AND later)
  // proves each activity's exact (Activity, Metric, Unit) tuple through the
  // single authoritative validator before anything persists. Initial
  // establishment additionally pre-checks with the same function (fail
  // fast); this in-version enforcement is what later versions cannot
  // bypass. Unresolvable/ineligible Knowledge rejects here, never invents.
  for (const [index, activity] of insert.activities.entries()) {
    const eligibility = await resolvers.resolveKnowledgeEligibility(activity.canonical_key);
    if (!eligibility) {
      fail(
        `unknown, unpublished, or not KCS-ready Knowledge for '${activity.canonical_key}' `
        + `(eligibility is never invented; only the current KCS-ready version establishes)`,
      );
    }
    assertActivityMeasurementCompatible(eligibility, activity, index);
  }
  assertCollectiveUnitHomogeneity(insert.challengeType, insert.basis.goal_unit, insert.activities);
  const pins = await resolvePins(insert.activities, resolvers);
  const resolved = insert.activities.map((input, index) => ({
    input,
    pin: pins[index],
    position: input.position ?? index,
  }));
  const snapshot = buildConfigSnapshot(insert.challengeType, insert.basis, resolved);
  await tx.query(
    `INSERT INTO challenge_config_versions (challenge_id, version, snapshot)
     VALUES ($1, $2, $3)`,
    [challengeId, version, JSON.stringify(snapshot)],
  );
  const activities: ActivityConfigRow[] = [];
  for (const { input, pin, position } of resolved) {
    const result = await tx.query(
      `INSERT INTO challenge_activity_configs
         (challenge_id, version, canonical_key, activity_variant,
          knowledge_id, knowledge_version, metric, target_value, unit, position, conditions)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        challengeId, version, input.canonical_key, input.activity_variant ?? null,
        pin.knowledge_id, pin.current_version, input.metric, input.target_value, input.unit,
        position, JSON.stringify(input.conditions ?? {}),
      ],
    );
    activities.push(normalizeActivityRow(result.rows[0] as never));
  }
  return { snapshot, activities };
}

export interface ConfigChangeInput {
  /** Complete activity list for the new version (configs are snapshots, not diffs). */
  activities: ActivityConfigInput[];
  start_date?: string;
  end_date?: string;
  goal_value?: number | null;
  goal_unit?: string | null;
  required_consecutive_days?: number | null;
  reset_on_miss?: boolean;
  /** EBC-03: replacement governing timezone (absent = carry forward). */
  timezone?: string;
}

/**
 * Append a new governing version (e.g. Active-period extension with a new
 * end_date) and move the challenge's current columns to it atomically.
 * Ended challenges cannot change configuration: history must stay put.
 */
export async function addChallengeConfigVersion(
  db: Db,
  challengeId: string,
  change: ConfigChangeInput,
  resolvers: ChallengeConfigResolvers,
): Promise<{ version: ConfigVersionRow; activities: ActivityConfigRow[] }> {
  const current = await db.query<{
    challenge_id: string;
    challenge_type: string;
    status: string;
    start_date: string | Date;
    end_date: string | Date;
    current_config_version: number;
    goal_value: number | null;
    goal_unit: string | null;
    required_consecutive_days: number | null;
    reset_on_miss: boolean;
    timezone: string | null;
    finalized_at: string | Date | null;
  }>(
    `SELECT challenge_id, challenge_type, status, start_date, end_date,
            current_config_version, goal_value, goal_unit,
            required_consecutive_days, reset_on_miss, timezone, finalized_at
     FROM challenges WHERE challenge_id = $1`,
    [challengeId],
  );
  if (current.rows.length === 0) fail(`unknown challenge ${challengeId}`);
  const row = current.rows[0];
  if (row.status === 'ended') fail('ended challenges are historically complete: configuration cannot change');
  // PF-03: finalized terminal truth is frozen (EBC-04). Finalization never
  // reverses, and no definition mutation may touch a finalized Challenge.
  if (row.finalized_at != null) {
    fail('finalized challenges are frozen: configuration cannot change');
  }
  // PF-03: reset_on_miss=false is not a valid V2 option (a missed day
  // resets Current Streak; no ordinary grace period). Legacy rows keep
  // their stored value; new versions can never introduce false.
  if (change.reset_on_miss === false) {
    fail('reset_on_miss=false is not a valid V2 option (missed days reset Current Streak)');
  }
  const basis: ChallengeGoverningBasis = {
    start_date: change.start_date ?? toDayString(row.start_date),
    end_date: change.end_date ?? toDayString(row.end_date),
    goal_value: change.goal_value !== undefined ? change.goal_value : row.goal_value,
    goal_unit: change.goal_unit !== undefined ? change.goal_unit : row.goal_unit,
    required_consecutive_days: change.required_consecutive_days !== undefined
      ? change.required_consecutive_days
      : row.required_consecutive_days,
    reset_on_miss: change.reset_on_miss ?? row.reset_on_miss,
    // EBC-03: a replacement timezone is validated fail-closed; otherwise the
    // current governing value carries forward (pre-EBC-03 mirrors read UTC).
    timezone: change.timezone !== undefined
      ? assertValidTimezone(change.timezone)
      : (row.timezone ?? 'UTC'),
  };
  const nextVersion = Number(row.current_config_version) + 1;
  return db.transaction(async (tx) => {
    const { activities } = await insertConfigVersion(
      tx,
      challengeId,
      nextVersion,
      { activities: change.activities, basis, challengeType: String(row.challenge_type) },
      resolvers,
    );
    await tx.query(
      `UPDATE challenges
       SET start_date = $2, end_date = $3,
           goal_value = $4, goal_unit = $5,
           required_consecutive_days = $6, reset_on_miss = $7,
           timezone = $8,
           current_config_version = $9, updated_at = now()
       WHERE challenge_id = $1`,
      [
        challengeId, basis.start_date, basis.end_date,
        basis.goal_value, basis.goal_unit,
        basis.required_consecutive_days, basis.reset_on_miss,
        basis.timezone,
        nextVersion,
      ],
    );
    const versionRow = await tx.query(
      `SELECT * FROM challenge_config_versions WHERE challenge_id = $1 AND version = $2`,
      [challengeId, nextVersion],
    );
    return {
      version: normalizeVersionRow(versionRow.rows[0] as never),
      activities,
    };
  });
}

/** Read one version (default: current) with its activity rows in order. */
export async function getChallengeConfig(
  db: Db,
  challengeId: string,
  version?: number,
): Promise<{ version: ConfigVersionRow; activities: ActivityConfigRow[] }> {
  let resolvedVersion = version;
  if (resolvedVersion === undefined) {
    const current = await db.query<{ current_config_version: number }>(
      `SELECT current_config_version FROM challenges WHERE challenge_id = $1`,
      [challengeId],
    );
    if (current.rows.length === 0) fail(`unknown challenge ${challengeId}`);
    resolvedVersion = Number(current.rows[0].current_config_version);
  }
  const versionRow = await db.query(
    `SELECT * FROM challenge_config_versions WHERE challenge_id = $1 AND version = $2`,
    [challengeId, resolvedVersion],
  );
  if (versionRow.rows.length === 0) fail(`unknown config version ${resolvedVersion} for challenge ${challengeId}`);
  const activities = await db.query(
    `SELECT * FROM challenge_activity_configs
     WHERE challenge_id = $1 AND version = $2 ORDER BY position ASC, canonical_key ASC`,
    [challengeId, resolvedVersion],
  );
  return {
    version: normalizeVersionRow(versionRow.rows[0] as never),
    activities: (activities.rows as never[]).map(normalizeActivityRow),
  };
}

// ─── Governing snapshots for version-pinned application (C2B) ───────────────
// The snapshot JSONB is the immutable authority for a version; activity rows
// are its queryable projection. C2B acceptance and recomputation MUST build
// every governing value (type, period, type params, activities) from the
// pinned snapshot, never from the mutable challenges mirrors.

/** Stable cross-version activity identity (canonical key + variant). */
export function canonicalActivityIdentity(canonicalKey: string, variant: string | null): string {
  return `${canonicalKey}::${variant ?? ''}`;
}

export interface GoverningSnapshotActivity {
  canonical_key: string;
  activity_variant: string | null;
  knowledge_id: string;
  knowledge_version: number;
  /**
   * Governing Metric. Present on every snapshot written by EBC-01+ code;
   * absent ONLY on historical pre-EBC-01 snapshots (parsed as null so old
   * configurations stay interpretable).
   */
  metric: string | null;
  target_value: number;
  unit: string;
  position: number;
  conditions: Record<string, unknown>;
  /**
   * PF-03 definition pins. Present on snapshots written by PF-03 code;
   * absent (null) ONLY on historical pre-PF-03 snapshots (parsed as null
   * so old configurations stay interpretable without backfill).
   */
  activity_code: string | null;
  required_components: string[];
  component_relationship: string | null;
  load_reporting_basis: string | null;
  duration_mode: string | null;
  completion_occurrence: string | null;
}

export interface TemporalConditionWindow {
  start: string;
  end: string;
}

export interface GoverningTemporalConditions {
  at: string | null;
  before: string | null;
  after: string | null;
  within: TemporalConditionWindow | null;
}

export interface GoverningSnapshot {
  challenge_type: 'collective' | 'competitive' | 'streak';
  start_date: string;
  end_date: string;
  goal_value: number | null;
  goal_unit: string | null;
  required_consecutive_days: number | null;
  reset_on_miss: boolean;
  /**
   * EBC-03 governing Challenge timezone. 'UTC' on historical pre-EBC-03
   * snapshots (parsed default so old configurations stay interpretable).
   */
  timezone: string;
  activities: GoverningSnapshotActivity[];
  /**
   * PF-03 definition marker + Challenge-level temporal conditions.
   * definition_kind is 'pf03-v1' on PF-03 snapshots, null on historical
   * pre-PF-03 snapshots. temporal_conditions is null when the definition
   * carries none.
   */
  definition_kind: string | null;
  temporal_conditions: GoverningTemporalConditions | null;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function snapshotFail(message: string): never {
  throw new Error(`challenge-configs: corrupt governing snapshot (${message})`);
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) snapshotFail('not an object');
  return value as Record<string, unknown>;
}

/** Validate + normalize one immutable version snapshot (fail closed). */
export function parseGoverningSnapshot(raw: unknown): GoverningSnapshot {
  const snapshot = asRecord(raw);
  const challengeType = snapshot.challenge_type;
  if (challengeType !== 'collective' && challengeType !== 'competitive' && challengeType !== 'streak') {
    snapshotFail('challenge_type must be collective|competitive|streak');
  }
  const period = asRecord(snapshot.period);
  const startDate = period.start_date;
  const endDate = period.end_date;
  if (typeof startDate !== 'string' || !DAY_RE.test(startDate)
    || typeof endDate !== 'string' || !DAY_RE.test(endDate) || endDate < startDate) {
    snapshotFail('period must be valid YYYY-MM-DD with end_date >= start_date');
  }
  const params = asRecord(snapshot.type_params);
  const goalValue = params.goal_value;
  const goalUnit = params.goal_unit;
  const requiredDays = params.required_consecutive_days;
  const resetOnMiss = params.reset_on_miss;
  if (challengeType === 'collective') {
    if (typeof goalValue !== 'number' || !(goalValue > 0)) snapshotFail('collective goal_value must be > 0');
    if (typeof goalUnit !== 'string' || goalUnit.length < 1 || goalUnit.length > 40) {
      snapshotFail('collective goal_unit is required (1..40 chars)');
    }
    if (requiredDays !== null) snapshotFail('collective must not carry required_consecutive_days');
  } else {
    if (goalValue !== null) snapshotFail('non-collective snapshot must not carry goal_value');
    if (goalUnit !== null) snapshotFail('non-collective snapshot must not carry goal_unit');
  }
  if (challengeType === 'streak') {
    if (!Number.isInteger(requiredDays) || (requiredDays as number) < 1) {
      snapshotFail('streak required_consecutive_days must be an integer >= 1');
    }
  } else if (requiredDays !== null) {
    snapshotFail('only streak snapshots carry required_consecutive_days');
  }
  if (typeof resetOnMiss !== 'boolean') snapshotFail('reset_on_miss must be boolean');
  // EBC-03: the governing timezone pins per version. Historical pre-EBC-03
  // snapshots carry no timezone and stay interpretable as UTC (no backfill,
  // no fabrication). A present timezone must be a valid IANA identifier —
  // acceptance and replay fail closed on an invalid/unreadable value.
  let timezone = 'UTC';
  if (snapshot.timezone !== undefined) {
    try {
      timezone = assertValidTimezone(snapshot.timezone);
    } catch {
      snapshotFail('timezone must be a valid IANA timezone identifier');
    }
  }
  if (!Array.isArray(snapshot.activities) || snapshot.activities.length === 0) {
    snapshotFail('at least one snapshot activity is required');
  }
  const activities: GoverningSnapshotActivity[] = (snapshot.activities as unknown[]).map((entry, index) => {
    const activity = asRecord(entry);
    if (typeof activity.canonical_key !== 'string'
      || activity.canonical_key.length < 1 || activity.canonical_key.length > 200) {
      snapshotFail(`activities[${index}].canonical_key is required (1..200 chars)`);
    }
    const variant = activity.activity_variant;
    if (variant !== null && (typeof variant !== 'string' || variant.length < 1 || variant.length > 120)) {
      snapshotFail(`activities[${index}].activity_variant must be null or 1..120 chars`);
    }
    if (typeof activity.knowledge_id !== 'string' || activity.knowledge_id.length === 0) {
      snapshotFail(`activities[${index}].knowledge_id is required`);
    }
    if (!Number.isInteger(activity.knowledge_version) || (activity.knowledge_version as number) < 1) {
      snapshotFail(`activities[${index}].knowledge_version must be an integer >= 1`);
    }
    if (typeof activity.target_value !== 'number' || activity.target_value < 0) {
      snapshotFail(`activities[${index}].target_value must be a number >= 0`);
    }
    if (typeof activity.unit !== 'string' || activity.unit.length < 1 || activity.unit.length > 40) {
      snapshotFail(`activities[${index}].unit is required (1..40 chars)`);
    }
    // Historical pre-EBC-01 snapshots carry no metric (parsed as null so
    // they stay interpretable); a present metric must be canonical.
    const metric = activity.metric;
    if (metric !== undefined && metric !== null && !isCanonicalMetric(metric)) {
      snapshotFail(`activities[${index}].metric must be a canonical Metric when present`);
    }
    // PF-03 pins: absent (null) ONLY on historical pre-PF-03 snapshots
    // (parsed as null so old configurations stay interpretable); present
    // values are lightly validated (strict validation lives in the PF-03
    // definition validator — snapshots are never invented here).
    const activityCode = activity.activity_code;
    if (activityCode !== undefined && activityCode !== null
      && (typeof activityCode !== 'string' || !/^[A-Z]{3}-[A-Z]{3}-[0-9]{3}$/.test(activityCode))) {
      snapshotFail(`activities[${index}].activity_code must be a governed Activity Code when present`);
    }
    const requiredComponents = activity.required_components;
    if (requiredComponents !== undefined && requiredComponents !== null
      && (!Array.isArray(requiredComponents) || requiredComponents.some((c) => typeof c !== 'string'))) {
      snapshotFail(`activities[${index}].required_components must be a string array when present`);
    }
    const relationship = activity.component_relationship;
    if (relationship !== undefined && relationship !== null && relationship !== 'ALL_REQUIRED') {
      snapshotFail(`activities[${index}].component_relationship must be ALL_REQUIRED when present`);
    }
    const basis = activity.load_reporting_basis;
    if (basis !== undefined && basis !== null
      && (typeof basis !== 'string' || ![
        'TOTAL_LOADED_IMPLEMENT', 'PER_IMPLEMENT', 'SINGLE_IMPLEMENT', 'PER_SIDE',
        'MACHINE_DISPLAYED_LOAD',
      ].includes(basis))) {
      snapshotFail(`activities[${index}].load_reporting_basis must be an authorized basis when present`);
    }
    const durationMode = activity.duration_mode;
    if (durationMode !== undefined && durationMode !== null
      && durationMode !== 'CONTINUOUS' && durationMode !== 'ACCUMULATED') {
      snapshotFail(`activities[${index}].duration_mode must be CONTINUOUS|ACCUMULATED when present`);
    }
    const occurrence = activity.completion_occurrence;
    if (occurrence !== undefined && occurrence !== null
      && (typeof occurrence !== 'string' || occurrence.length < 1 || occurrence.length > 500)) {
      snapshotFail(`activities[${index}].completion_occurrence must be 1..500 chars when present`);
    }
    return {
      canonical_key: activity.canonical_key as string,
      activity_variant: variant as string | null,
      knowledge_id: activity.knowledge_id as string,
      knowledge_version: activity.knowledge_version as number,
      metric: (metric ?? null) as string | null,
      target_value: activity.target_value as number,
      unit: activity.unit as string,
      position: Number(activity.position ?? index),
      conditions: activity.conditions == null
        ? {}
        : asRecord(activity.conditions) as Record<string, unknown>,
      activity_code: (activityCode ?? null) as string | null,
      required_components: ((requiredComponents ?? []) as unknown[]).map(String),
      component_relationship: (relationship ?? null) as string | null,
      load_reporting_basis: (basis ?? null) as string | null,
      duration_mode: (durationMode ?? null) as string | null,
      completion_occurrence: (occurrence ?? null) as string | null,
    };
  });
  // C3A: a malformed collective snapshot already persisted in the DB must
  // fail closed when loaded as governing truth (never applied unit-blind).
  if (challengeType === 'collective') {
    if (typeof goalUnit !== 'string' || goalUnit.length === 0) {
      snapshotFail('collective snapshot carries no usable goal_unit');
    }
    for (const [index, activity] of activities.entries()) {
      if (activity.unit !== goalUnit) {
        snapshotFail(
          `collective snapshot activities[${index}] unit '${activity.unit}' `
          + `must exactly equal goal_unit '${goalUnit as string}'`,
        );
      }
    }
  }
  return {
    challenge_type: challengeType,
    start_date: startDate as string,
    end_date: endDate as string,
    goal_value: goalValue as number | null,
    goal_unit: goalUnit as string | null,
    required_consecutive_days: requiredDays as number | null,
    reset_on_miss: resetOnMiss as boolean,
    timezone,
    activities,
    definition_kind: typeof snapshot.definition_kind === 'string'
      ? snapshot.definition_kind as string
      : null,
    temporal_conditions: parseSnapshotTemporalConditions(snapshot.temporal_conditions),
  };
}

const SNAPSHOT_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * PF-03 Challenge-level temporal conditions inside a persisted snapshot.
 * Absent (null) on historical pre-PF-03 snapshots; lightly validated when
 * present (strict validation lives in the PF-03 definition validator).
 */
export function parseSnapshotTemporalConditions(value: unknown): GoverningTemporalConditions | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) {
    snapshotFail('temporal_conditions must be an object when present');
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (key !== 'at' && key !== 'before' && key !== 'after' && key !== 'within') {
      snapshotFail(`temporal_conditions key '${key}' is not authorized (at|before|after|within only)`);
    }
  }
  const asTime = (entry: unknown, field: string): string | null => {
    if (entry === undefined || entry === null) return null;
    if (typeof entry !== 'string' || !SNAPSHOT_TIME_RE.test(entry)) {
      snapshotFail(`temporal_conditions.${field} must be HH:MM when present`);
    }
    return entry;
  };
  const at = asTime(record.at, 'at');
  const before = asTime(record.before, 'before');
  const after = asTime(record.after, 'after');
  let within: TemporalConditionWindow | null = null;
  if (record.within !== undefined) {
    const w = record.within;
    if (typeof w !== 'object' || w === null || Array.isArray(w)) {
      snapshotFail('temporal_conditions.within must be an object when present');
    }
    const wr = w as Record<string, unknown>;
    const start = asTime(wr.start, 'within.start');
    const end = asTime(wr.end, 'within.end');
    if (start === null || end === null || end <= start) {
      snapshotFail('temporal_conditions.within requires start and end with end after start');
    }
    within = { start, end };
  }
  return { at, before, after, within };
}

export interface GoverningVersion {
  version: number;
  snapshot: GoverningSnapshot;
  activities: ActivityConfigRow[];
}

/**
 * Load ONE immutable governing version: snapshot authority + normalized
 * activity projection, cross-checked field by field. Throws fail-closed on
 * unknown versions, corrupt snapshots, or snapshot/row divergence — an
 * acceptance or replay must never mix terms from two versions.
 */
export async function getGoverningVersion(
  db: Db,
  challengeId: string,
  version: number,
): Promise<GoverningVersion> {
  if (!Number.isInteger(version) || version < 1) fail(`config version must be an integer >= 1`);
  const versionRow = await db.query<{ snapshot: unknown }>(
    `SELECT snapshot FROM challenge_config_versions WHERE challenge_id = $1 AND version = $2`,
    [challengeId, version],
  );
  if (versionRow.rows.length === 0) fail(`unknown config version ${version} for challenge ${challengeId}`);
  const raw = versionRow.rows[0].snapshot;
  const snapshot = parseGoverningSnapshot(
    typeof raw === 'string' ? JSON.parse(raw) : raw,
  );
  const activityResult = await db.query(
    `SELECT * FROM challenge_activity_configs
     WHERE challenge_id = $1 AND version = $2 ORDER BY position ASC, canonical_key ASC`,
    [challengeId, version],
  );
  const activities = (activityResult.rows as never[]).map(normalizeActivityRow);
  assertSnapshotActivitiesConsistent(version, snapshot, activities);
  return { version, snapshot, activities };
}

/** Every snapshot activity must project to exactly one normalized row. */
export function assertSnapshotActivitiesConsistent(
  version: number,
  snapshot: GoverningSnapshot,
  activities: ActivityConfigRow[],
): void {
  if (activities.length !== snapshot.activities.length) {
    fail(`version ${version}: snapshot carries ${snapshot.activities.length} activities but ${activities.length} rows exist`);
  }
  const byIdentity = new Map<string, ActivityConfigRow>();
  for (const row of activities) {
    if (row.version !== version || row.challenge_id === undefined) {
      fail(`version ${version}: activity row belongs to another version`);
    }
    byIdentity.set(canonicalActivityIdentity(row.canonical_key, row.activity_variant), row);
  }
  for (const expected of snapshot.activities) {
    const row = byIdentity.get(canonicalActivityIdentity(expected.canonical_key, expected.activity_variant));
    if (!row) fail(`version ${version}: snapshot activity '${expected.canonical_key}' has no row`);
    if (row.knowledge_id !== expected.knowledge_id
      || row.knowledge_version !== expected.knowledge_version
      || row.target_value !== expected.target_value
      || row.unit !== expected.unit) {
      fail(`version ${version}: activity row diverges from snapshot for '${expected.canonical_key}'`);
    }
    // PF-03 pins: compared exactly when the snapshot carries them
    // (pre-PF-03 snapshots carry none and stay interpretable).
    if (expected.activity_code != null && row.activity_code !== expected.activity_code) {
      fail(`version ${version}: activity_code diverges from snapshot for '${expected.canonical_key}'`);
    }
    if ([...expected.required_components].sort().join('\u0000')
      !== [...row.required_components].sort().join('\u0000')) {
      fail(`version ${version}: required_components diverge from snapshot for '${expected.canonical_key}'`);
    }
    if (expected.component_relationship != null
      && row.component_relationship !== expected.component_relationship) {
      fail(`version ${version}: component_relationship diverges from snapshot for '${expected.canonical_key}'`);
    }
    if (expected.load_reporting_basis != null
      && row.load_reporting_basis !== expected.load_reporting_basis) {
      fail(`version ${version}: load_reporting_basis diverges from snapshot for '${expected.canonical_key}'`);
    }
    if (expected.duration_mode != null && row.duration_mode !== expected.duration_mode) {
      fail(`version ${version}: duration_mode diverges from snapshot for '${expected.canonical_key}'`);
    }
    if (expected.completion_occurrence != null
      && row.completion_occurrence !== expected.completion_occurrence) {
      fail(`version ${version}: completion_occurrence diverges from snapshot for '${expected.canonical_key}'`);
    }
  }
}
