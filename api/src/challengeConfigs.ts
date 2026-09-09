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

export interface KnowledgePin {
  knowledge_id: string;
  current_version: number;
}

export interface ChallengeConfigResolvers {
  resolveKnowledgePin: (canonicalKey: string) => Promise<KnowledgePin | null>;
}

export interface ActivityConfigInput {
  canonical_key: string;
  activity_variant?: string | null;
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
          knowledge_id, knowledge_version, target_value, unit, position, conditions)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        challengeId, version, input.canonical_key, input.activity_variant ?? null,
        pin.knowledge_id, pin.current_version, input.target_value, input.unit,
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
