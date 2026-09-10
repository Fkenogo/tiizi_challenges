/**
 * Phase C2A Challenge lifecycle seam — identity + lifecycle shell.
 *
 * A Challenge belongs to exactly one Group for its entire lifecycle
 * (non-transferable), is created by a Member (historical attribution, never
 * governance), and moves establishment -> active -> ended with no
 * same-identity reopening. Governing evaluation configuration lives in
 * immutable versions (see challengeConfigs.ts); this module owns the
 * lifecycle transitions and the current-value columns that mirror the
 * current version.
 *
 * Type-specific governing params (Stage F + engine model):
 * - collective: shared goal_value + goal_unit (may exceed 100%; full
 *   crossing contribution; expiry reports actuals without failure labels).
 * - competitive: race to configured per-activity targets; no
 *   highest-performance mode; window closes at period end.
 * - streak: daily consistency over the period; required_consecutive_days +
 *   reset_on_miss; Done is binary (no partial-credit carry).
 *
 * No Derived Truth here: no counters, totals, positions, or streak states.
 * No routes. No Firebase. Pure domain + `Db`.
 *
 * TRANSITIONAL GROUP INVARIANT: the FK makes the PG Group UUID the
 * referential anchor, but Group operational authority still lives in
 * Firestore and the PG groups row is a shadow that can go stale (deleted
 * groups leave rows behind; status refreshes only on import runs). A stale
 * shadow row alone must therefore never authorize establishment: creation
 * requires an injected current-authority group check
 * (ChallengeCreationResolvers.resolveGroupAuthority). The later
 * Group-authority migration removes that seam; the FK stays.
 */

import type { Db } from './db.js';
import {
  assertCollectiveUnitHomogeneity,
  insertConfigVersion,
  toDayString,
  type ActivityConfigInput,
  type ActivityConfigRow,
  type ChallengeConfigResolvers,
  type ChallengeGoverningBasis,
  type ConfigVersionRow,
} from './challengeConfigs.js';
import {
  requireCurrentGroupMember,
  type GroupMembershipAuthority,
} from './groupMembershipAuthority.js';

export interface ChallengeCreationResolvers extends ChallengeConfigResolvers, GroupMembershipAuthority {
  /**
   * TRANSITIONAL current-authority Group check. Confirm the group is live
   * (exists and active) under whatever authority currently governs Groups.
   * Return null when the group must not host new Challenges. Removed when
   * Group authority migrates to PostgreSQL.
   */
  resolveGroupAuthority: (groupId: string) => Promise<{ status: string } | null>;
}

export type ChallengeType = 'collective' | 'competitive' | 'streak';

export type ChallengeStatus = 'establishment' | 'active' | 'ended';

export interface ChallengeRow {
  challenge_id: string;
  group_id: string;
  created_by_member_id: string;
  challenge_type: ChallengeType;
  status: ChallengeStatus;
  title: string;
  description: string;
  instructions: string;
  start_date: string;
  end_date: string;
  current_config_version: number;
  goal_value: number | null;
  goal_unit: string | null;
  required_consecutive_days: number | null;
  reset_on_miss: boolean;
  activated_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewChallengeInput {
  group_id: string;
  created_by_member_id: string;
  challenge_type: ChallengeType;
  title: string;
  description?: string;
  instructions?: string;
  start_date: string;
  end_date: string;
  /** Collective only. */
  goal_value?: number;
  goal_unit?: string;
  /** Streak only. */
  required_consecutive_days?: number;
  reset_on_miss?: boolean;
  activities: ActivityConfigInput[];
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function fail(message: string): never {
  throw new Error(`challenges: ${message}`);
}

function day(value: string, field: string): string {
  if (!DAY_RE.test(value)) fail(`${field} must be YYYY-MM-DD`);
  return value;
}

export function validateNewChallenge(input: NewChallengeInput): ChallengeGoverningBasis {
  if (!UUID_RE.test(input.group_id)) fail('group_id must be a Tiizi group UUID (never a Firestore document id)');
  if (!UUID_RE.test(input.created_by_member_id)) fail('created_by_member_id must be a member UUID');
  if (input.challenge_type !== 'collective'
    && input.challenge_type !== 'competitive'
    && input.challenge_type !== 'streak') {
    fail('invalid challenge_type (must be collective|competitive|streak)');
  }
  if (!input.title || input.title.length > 200) fail('title is required (1..200 chars)');
  const start = day(input.start_date, 'start_date');
  const end = day(input.end_date, 'end_date');
  if (end < start) fail('end_date must be on or after start_date');
  const basis: ChallengeGoverningBasis = {
    start_date: start,
    end_date: end,
    goal_value: null,
    goal_unit: null,
    required_consecutive_days: null,
    reset_on_miss: input.reset_on_miss ?? true,
  };
  if (input.challenge_type === 'collective') {
    if (input.goal_value === undefined || !Number.isFinite(input.goal_value) || input.goal_value <= 0) {
      fail('collective challenges require a shared goal_value > 0');
    }
    if (!input.goal_unit || input.goal_unit.length > 40) fail('collective challenges require goal_unit (1..40 chars)');
    if (input.required_consecutive_days !== undefined) fail('required_consecutive_days belongs to streak challenges only');
    basis.goal_value = input.goal_value;
    basis.goal_unit = input.goal_unit;
  } else if (input.challenge_type === 'streak') {
    if (input.required_consecutive_days === undefined
      || !Number.isInteger(input.required_consecutive_days)
      || input.required_consecutive_days < 1) {
      fail('streak challenges require required_consecutive_days (integer >= 1)');
    }
    if (input.goal_value !== undefined || input.goal_unit !== undefined) {
      fail('goal_value/goal_unit belong to collective challenges only');
    }
    basis.required_consecutive_days = input.required_consecutive_days;
  } else {
    if (input.goal_value !== undefined || input.goal_unit !== undefined) {
      fail('goal_value/goal_unit belong to collective challenges only');
    }
    if (input.required_consecutive_days !== undefined) fail('required_consecutive_days belongs to streak challenges only');
  }
  // C3A collective-unit invariant, checked early (before any authority I/O)
  // so malformed collective configs fail fast; insertConfigVersion re-checks
  // defensively on every version path (v1 + later versions).
  assertCollectiveUnitHomogeneity(input.challenge_type, basis.goal_unit, input.activities);
  return basis;
}

export function normalizeChallengeRow(row: {
  challenge_id: unknown;
  group_id: unknown;
  created_by_member_id: unknown;
  challenge_type: ChallengeType;
  status: ChallengeStatus;
  title: unknown;
  description: unknown;
  instructions: unknown;
  start_date: string | Date;
  end_date: string | Date;
  current_config_version: unknown;
  goal_value: unknown;
  goal_unit: unknown;
  required_consecutive_days: unknown;
  reset_on_miss: unknown;
  activated_at: string | Date | null;
  ended_at: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date;
}): ChallengeRow {
  return {
    challenge_id: String(row.challenge_id),
    group_id: String(row.group_id),
    created_by_member_id: String(row.created_by_member_id),
    challenge_type: row.challenge_type,
    status: row.status,
    title: String(row.title),
    description: row.description == null ? '' : String(row.description),
    instructions: row.instructions == null ? '' : String(row.instructions),
    start_date: toDayString(row.start_date),
    end_date: toDayString(row.end_date),
    current_config_version: Number(row.current_config_version),
    goal_value: row.goal_value == null ? null : Number(row.goal_value),
    goal_unit: row.goal_unit == null ? null : String(row.goal_unit),
    required_consecutive_days: row.required_consecutive_days == null
      ? null
      : Number(row.required_consecutive_days),
    reset_on_miss: Boolean(row.reset_on_miss),
    activated_at: row.activated_at == null ? null : new Date(row.activated_at).toISOString(),
    ended_at: row.ended_at == null ? null : new Date(row.ended_at).toISOString(),
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
  };
}

/**
 * Create a Challenge with its version-1 governing configuration, atomically:
 * challenge row (establishment) + config snapshot + activity rows.
 * Establishment proves, before anything persists: (1) the Group is live
 * under current Group authority, and (2) the creator currently holds
 * qualifying Group Membership under live membership authority (V2 chain:
 * Member -> Group Membership -> Challenge creation). No Charter-role
 * restrictions are applied here (deferred).
 */
export async function createChallenge(
  db: Db,
  input: NewChallengeInput,
  resolvers: ChallengeCreationResolvers,
): Promise<{ challenge: ChallengeRow; version: ConfigVersionRow; activities: ActivityConfigRow[] }> {
  const basis = validateNewChallenge(input);
  const authority = await resolvers.resolveGroupAuthority(input.group_id);
  if (!authority || authority.status !== 'active') {
    fail('group is not available for challenge establishment under current Group authority');
  }
  await requireCurrentGroupMember(
    resolvers,
    input.group_id,
    input.created_by_member_id,
    'challenge establishment',
  );
  return db.transaction(async (tx) => {
    let challenge: ChallengeRow;
    try {
      const inserted = await tx.query(
        `INSERT INTO challenges
           (group_id, created_by_member_id, challenge_type, title, description,
            instructions, start_date, end_date,
            goal_value, goal_unit, required_consecutive_days, reset_on_miss)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [
          input.group_id, input.created_by_member_id, input.challenge_type,
          input.title, input.description ?? '', input.instructions ?? '',
          basis.start_date, basis.end_date,
          basis.goal_value, basis.goal_unit,
          basis.required_consecutive_days, basis.reset_on_miss,
        ],
      );
      challenge = normalizeChallengeRow(inserted.rows[0] as never);
    } catch (error) {
      fail(`challenge insert rejected: ${(error as Error).message}`);
    }
    const { activities } = await insertConfigVersion(
      tx,
      challenge!.challenge_id,
      1,
      { activities: input.activities, basis, challengeType: input.challenge_type },
      resolvers,
    );
    const versionRow = await tx.query(
      `SELECT * FROM challenge_config_versions WHERE challenge_id = $1 AND version = 1`,
      [challenge!.challenge_id],
    );
    return {
      challenge: challenge!,
      version: {
        challenge_id: challenge!.challenge_id,
        version: 1,
        snapshot: (typeof versionRow.rows[0].snapshot === 'string'
          ? JSON.parse(versionRow.rows[0].snapshot)
          : versionRow.rows[0].snapshot) as Record<string, unknown>,
        created_at: new Date(
          (versionRow.rows[0] as { created_at: string | Date }).created_at,
        ).toISOString(),
      },
      activities,
    };
  });
}

async function readChallenge(db: Db, challengeId: string): Promise<ChallengeRow> {
  const result = await db.query(`SELECT * FROM challenges WHERE challenge_id = $1`, [challengeId]);
  if (result.rows.length === 0) fail(`unknown challenge ${challengeId}`);
  return normalizeChallengeRow(result.rows[0] as never);
}

/** establishment -> active. Records activation for C2B window reasoning. */
export async function activateChallenge(db: Db, challengeId: string): Promise<ChallengeRow> {
  const current = await readChallenge(db, challengeId);
  if (current.status === 'active') fail('challenge is already active');
  if (current.status === 'ended') fail('ended challenges cannot be reopened under the same identity');
  const result = await db.query(
    `UPDATE challenges SET status = 'active', activated_at = now(), updated_at = now()
     WHERE challenge_id = $1 RETURNING *`,
    [challengeId],
  );
  return normalizeChallengeRow(result.rows[0] as never);
}

/** active (or establishment) -> ended. Terminal: history stays put. */
export async function endChallenge(db: Db, challengeId: string): Promise<ChallengeRow> {
  const current = await readChallenge(db, challengeId);
  if (current.status === 'ended') fail('challenge is already ended');
  const result = await db.query(
    `UPDATE challenges SET status = 'ended', ended_at = now(), updated_at = now()
     WHERE challenge_id = $1 RETURNING *`,
    [challengeId],
  );
  return normalizeChallengeRow(result.rows[0] as never);
}

export async function getChallenge(db: Db, challengeId: string): Promise<ChallengeRow> {
  return readChallenge(db, challengeId);
}
