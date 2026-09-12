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
  created_at: string;
}

export interface ChallengeGoverningBasis {
  start_date: string;
  end_date: string;
  goal_value: number | null;
  goal_unit: string | null;
  required_consecutive_days: number | null;
  reset_on_miss: boolean;
}

function fail(message: string): never {
  throw new Error(`challenge-configs: ${message}`);
}

/** Coerce a DATE column (string or driver Date) to YYYY-MM-DD. */
export function toDayString(value: string | Date): string {
  const day = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
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
  }>(
    `SELECT challenge_id, challenge_type, status, start_date, end_date,
            current_config_version, goal_value, goal_unit,
            required_consecutive_days, reset_on_miss
     FROM challenges WHERE challenge_id = $1`,
    [challengeId],
  );
  if (current.rows.length === 0) fail(`unknown challenge ${challengeId}`);
  const row = current.rows[0];
  if (row.status === 'ended') fail('ended challenges are historically complete: configuration cannot change');
  const basis: ChallengeGoverningBasis = {
    start_date: change.start_date ?? toDayString(row.start_date),
    end_date: change.end_date ?? toDayString(row.end_date),
    goal_value: change.goal_value !== undefined ? change.goal_value : row.goal_value,
    goal_unit: change.goal_unit !== undefined ? change.goal_unit : row.goal_unit,
    required_consecutive_days: change.required_consecutive_days !== undefined
      ? change.required_consecutive_days
      : row.required_consecutive_days,
    reset_on_miss: change.reset_on_miss ?? row.reset_on_miss,
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
           current_config_version = $8, updated_at = now()
       WHERE challenge_id = $1`,
      [
        challengeId, basis.start_date, basis.end_date,
        basis.goal_value, basis.goal_unit,
        basis.required_consecutive_days, basis.reset_on_miss,
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
}

export interface GoverningSnapshot {
  challenge_type: 'collective' | 'competitive' | 'streak';
  start_date: string;
  end_date: string;
  goal_value: number | null;
  goal_unit: string | null;
  required_consecutive_days: number | null;
  reset_on_miss: boolean;
  activities: GoverningSnapshotActivity[];
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
    activities,
  };
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
  }
}
