/**
 * Phase C3A atomic Challenge establishment seam (CORR-001) + EBC-01
 * governed establishment.
 *
 * ONE establishment request commits or rolls back as ONE PostgreSQL
 * operation: challenge row + immutable config v1 (+ normalized activity
 * rows) + idempotency-key claim + activation when requested + creator
 * participation when requested.
 *
 * Transaction discipline (same as C2B):
 * - network/provider authority resolves OUTSIDE the transaction: Group
 *   liveness, creator Challenge-creation authority under LIVE authority,
 *   Knowledge pins and establishment eligibility are all proven before
 *   transaction entry and carried in as trusted resolved values (map-backed
 *   resolvers perform zero I/O inside the transaction);
 * - DB-controlled state revalidates INSIDE the transaction (challenge insert
 *   constraints, idempotency-key uniqueness, activation transition guards,
 *   participation uniqueness);
 * - all PostgreSQL persistence commits or rolls back together; there are no
 *   nested independent commits (insertChallengeWithConfig,
 *   activateChallenge and insertParticipationEpisode open no transaction of
 *   their own — the single db.transaction below owns atomicity).
 *
 * EBC-01 establishment proofs (all outside the transaction, fail closed):
 * - creator Challenge-creation authority via the injected
 *   ChallengeCreationAuthority when wired (live group + live membership +
 *   existing Charter allowMemberChallenges rule). Without it, the legacy
 *   proofs apply (live group + any live membership) — the pre-EBC-01
 *   contract, preserved for non-product seams;
 * - per-activity current-version readiness AND the exact (Activity, Metric,
 *   Unit) governed tuple via the REQUIRED resolvers gate (CORR-001: the
 *   same authoritative validator insertConfigVersion enforces in-version).
 *   Pins for the persistence path resolve alongside and ride in as a map.
 *
 * Idempotency (bounded retry contract): when the input carries an
 * idempotency key, its claim row commits in the SAME transaction as the
 * Challenge it guards — a retry with the same key and the same request
 * returns the original establishment instead of minting a duplicate, and a
 * reused key with a DIFFERENT request is rejected (no silent aliasing).
 *
 * Authority race (explicit non-goal): creator authority is proven live
 * BEFORE the transaction; the seam does not re-hit Firestore inside it.
 * A membership revoked between the live check and commit is NOT
 * synchronized — atomicity across PostgreSQL + Firestore is not invented
 * here (no distributed transaction). The requirement met is atomicity of
 * PostgreSQL establishment. The stale PG group_memberships shadow is never
 * consulted for authorization at any point.
 *
 * Provider-neutral: pure domain + `Db`. No Firebase imports.
 */

import { createHash } from 'node:crypto';
import type { Db } from './db.js';
import {
  activateChallenge,
  getChallenge,
  insertChallengeWithConfig,
  validateNewChallenge,
  type ChallengeCreationResolvers,
  type ChallengeRow,
  type NewChallengeInput,
} from './challenges.js';
import { insertParticipationEpisode } from './challengeParticipations.js';
import {
  requireCurrentGroupMember,
} from './groupMembershipAuthority.js';
import {
  requireChallengeCreationAuthority,
  type ChallengeCreationAuthority,
} from './challengeCreationAuthority.js';
import {
  assertActivityMeasurementCompatible,
  type KnowledgeEligibility,
} from './knowledgeEligibility.js';
import {
  getChallengeConfig,
  type ActivityConfigRow,
  type ChallengeConfigResolvers,
  type ConfigVersionRow,
} from './challengeConfigs.js';

export interface EstablishmentInput extends NewChallengeInput {
  /** establishment -> active inside the same transaction when true. */
  activate: boolean;
  /** Open a creator participation episode inside the same transaction. */
  joinCreator: boolean;
  /**
   * Bounded retry contract. When present, the claim commits atomically with
   * the establishment: same key + same request replays the original result,
   * same key + different request is rejected. Absent: every call establishes
   * a new Challenge (pre-EBC-01 contract).
   */
  idempotencyKey?: string;
}

export interface EstablishmentResult {
  challenge: ChallengeRow;
  version: ConfigVersionRow;
  activities: ActivityConfigRow[];
  activated: boolean;
  creatorParticipationId: string | null;
  /** True when this result replays a previous establishment (same key). */
  idempotentReplay: boolean;
}

export interface EstablishmentOptions {
  /**
   * Charter-aware live creation authority (EBC-01 governed path). When
   * absent, the legacy proofs apply (live group + any live membership).
   */
  creationAuthority?: ChallengeCreationAuthority;
}

function fail(message: string): never {
  throw new Error(`challenge-establishment: ${message}`);
}

/** Carries an idempotency-key conflict out of the transaction for replay. */
class IdempotencyConflict extends Error {
  readonly key: string;

  constructor(key: string) {
    super(`challenge-establishment: idempotency key '${key}' is already claimed`);
    this.key = key;
  }
}

function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: unknown })?.code;
  if (code === '23505') return true;
  return /duplicate key|already exists/i.test((error as Error)?.message ?? '');
}

/**
 * Canonical request hash binding an idempotency key to ONE establishment
 * request. Governing inputs only, fixed key order — the same logical
 * request always hashes identically, any governing difference changes it.
 */
export function hashEstablishmentRequest(input: EstablishmentInput): string {
  const canonical = {
    group_id: input.group_id,
    created_by_member_id: input.created_by_member_id,
    challenge_type: input.challenge_type,
    title: input.title,
    description: input.description ?? '',
    instructions: input.instructions ?? '',
    start_date: input.start_date,
    end_date: input.end_date,
    goal_value: input.goal_value ?? null,
    goal_unit: input.goal_unit ?? null,
    required_consecutive_days: input.required_consecutive_days ?? null,
    reset_on_miss: input.reset_on_miss ?? true,
    timezone: input.timezone ?? 'UTC',
    activities: input.activities.map((activity) => ({
      canonical_key: activity.canonical_key,
      activity_variant: activity.activity_variant ?? null,
      metric: activity.metric,
      target_value: activity.target_value,
      unit: activity.unit,
      position: activity.position ?? null,
      conditions: activity.conditions ?? {},
    })),
    activate: input.activate,
    joinCreator: input.joinCreator,
  };
  return createHash('sha256').update(JSON.stringify(canonical), 'utf8').digest('hex');
}

function validateIdempotencyKey(key: string): string {
  if (typeof key !== 'string' || key.length < 1 || key.length > 100) {
    fail('idempotencyKey must be 1..100 chars when present');
  }
  return key;
}

interface KeyRow {
  idempotency_key: string;
  challenge_id: string;
  created_by_member_id: string;
  request_hash: string;
  creator_participation_id: string | null;
}

/** Replay a previously claimed establishment exactly (same result shape). */
async function replayEstablishment(
  db: Db,
  key: string,
  requestHash: string,
): Promise<EstablishmentResult> {
  const found = await db.query<KeyRow>(
    `SELECT idempotency_key, challenge_id, created_by_member_id, request_hash, creator_participation_id
     FROM challenge_establishment_keys WHERE idempotency_key = $1`,
    [key],
  );
  const row = found.rows[0];
  if (!row) fail(`idempotency key '${key}' has no recorded establishment`);
  if (row.request_hash !== requestHash) {
    fail('idempotency key was already used for a different establishment request (payload mismatch)');
  }
  const challenge = await getChallenge(db, String(row.challenge_id));
  const config = await getChallengeConfig(db, String(row.challenge_id));
  return {
    challenge,
    version: config.version,
    activities: config.activities,
    activated: challenge.status === 'active',
    creatorParticipationId: row.creator_participation_id == null
      ? null
      : String(row.creator_participation_id),
    idempotentReplay: true,
  };
}

/**
 * Establish a clean V2 Challenge atomically. Live authority failures,
 * unknown/unpublished/non-KCS-ready Knowledge, ungoverned measurement
 * tuples and invalid configs all reject BEFORE the transaction opens
 * (nothing persists); every PostgreSQL write after that point belongs to
 * the single transaction below.
 */
export async function establishChallengeV2(
  db: Db,
  input: EstablishmentInput,
  resolvers: ChallengeCreationResolvers,
  options: EstablishmentOptions = {},
): Promise<EstablishmentResult> {
  // Pure validation first (includes metric shape + C3A collective-unit invariant).
  const basis = validateNewChallenge(input);
  const idempotencyKey = input.idempotencyKey === undefined
    ? undefined
    : validateIdempotencyKey(input.idempotencyKey);
  const requestHash = idempotencyKey === undefined ? null : hashEstablishmentRequest(input);

  // Live Group authority, outside the transaction (fail closed).
  if (options.creationAuthority) {
    await requireChallengeCreationAuthority(
      options.creationAuthority,
      input.group_id,
      input.created_by_member_id,
      'challenge establishment',
    );
  } else {
    const groupAuthority = await resolvers.resolveGroupAuthority(input.group_id);
    if (!groupAuthority || groupAuthority.status !== 'active') {
      fail('group is not available for challenge establishment under current Group authority');
    }
    // Live creator-membership proof, outside the transaction (fail closed).
    // This same-request proof also covers the optional creator join below;
    // the transaction carries it forward without re-hitting Firestore.
    await requireCurrentGroupMember(
      resolvers,
      input.group_id,
      input.created_by_member_id,
      'challenge establishment',
    );
  }

  // Knowledge proofs, outside the transaction (fail fast, zero I/O in the
  // tx): every activity proves current-version readiness AND the exact
  // (Activity, Metric, Unit) tuple through the same authoritative validator
  // insertConfigVersion enforces in-version (CORR-001: one validator, two
  // call sites — pre-check here, enforcement there). Pins for the
  // persistence path resolve alongside, carried in as a map.
  const eligibility = new Map<string, KnowledgeEligibility>();
  for (const activity of input.activities) {
    if (eligibility.has(activity.canonical_key)) continue;
    const proven = await resolvers.resolveKnowledgeEligibility(activity.canonical_key);
    if (!proven) {
      fail(
        `unknown, unpublished, or not KCS-ready Knowledge for '${activity.canonical_key}' `
        + `(eligibility is never invented; only the current KCS-ready version establishes)`,
      );
    }
    eligibility.set(activity.canonical_key, proven);
  }
  input.activities.forEach((activity, index) => {
    assertActivityMeasurementCompatible(eligibility.get(activity.canonical_key)!, activity, index);
  });
  const pins = new Map<string, { knowledge_id: string; current_version: number }>();
  for (const activity of input.activities) {
    if (pins.has(activity.canonical_key)) continue;
    const pin = await resolvers.resolveKnowledgePin(activity.canonical_key);
    if (!pin) {
      fail(`unknown or unpublished Knowledge for '${activity.canonical_key}' (pins are never invented)`);
    }
    pins.set(activity.canonical_key, pin);
  }
  // Both maps ride INTO the transaction: insertConfigVersion's in-version
  // enforcement replays against the same proven eligibility with zero I/O
  // in the tx (never the live resolvers — PGlite serializes a transaction
  // and outer-DB I/O from inside it never resolves).
  const pinnedResolvers: ChallengeConfigResolvers = {
    resolveKnowledgePin: async (key: string) => pins.get(key) ?? null,
    resolveKnowledgeEligibility: async (key: string) => eligibility.get(key) ?? null,
  };

  try {
    return await db.transaction(async (tx) => {
      const created = await insertChallengeWithConfig(tx, input, basis, pinnedResolvers);
      if (idempotencyKey !== undefined && requestHash !== null) {
        try {
          await tx.query(
            `INSERT INTO challenge_establishment_keys
               (idempotency_key, challenge_id, created_by_member_id, request_hash)
             VALUES ($1, $2, $3, $4)`,
            [idempotencyKey, created.challenge.challenge_id, input.created_by_member_id, requestHash],
          );
        } catch (error) {
          if (isUniqueViolation(error)) throw new IdempotencyConflict(idempotencyKey);
          throw error;
        }
      }
      let status = created.challenge.status;
      let activated = false;
      if (input.activate && status !== 'active') {
        const next = await activateChallenge(tx, created.challenge.challenge_id);
        status = next.status;
        activated = true;
      }
      let creatorParticipationId: string | null = null;
      if (input.joinCreator) {
        // Eligibility was proven live above, in this request; DB guards
        // (challenge joinable, no duplicate active episode) revalidate here.
        const episode = await insertParticipationEpisode(
          tx,
          created.challenge.challenge_id,
          input.created_by_member_id,
          created.version.version,
        );
        creatorParticipationId = episode.participation_id;
      }
      if (idempotencyKey !== undefined) {
        await tx.query(
          `UPDATE challenge_establishment_keys
           SET creator_participation_id = $2 WHERE idempotency_key = $1`,
          [idempotencyKey, creatorParticipationId],
        );
      }
      return {
        challenge: { ...created.challenge, status },
        version: created.version,
        activities: created.activities,
        activated,
        creatorParticipationId,
        idempotentReplay: false,
      };
    });
  } catch (error) {
    if (error instanceof IdempotencyConflict) {
      return replayEstablishment(db, error.key, requestHash!);
    }
    throw error;
  }
}
