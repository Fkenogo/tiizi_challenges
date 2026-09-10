/**
 * Phase C3A atomic Challenge establishment seam (CORR-001).
 *
 * ONE establishment request commits or rolls back as ONE PostgreSQL
 * operation: challenge row + immutable config v1 (+ normalized activity
 * rows) + activation when requested + creator participation when requested.
 *
 * Transaction discipline (same as C2B):
 * - network/provider authority resolves OUTSIDE the transaction: Group
 *   liveness, creator Group Membership under LIVE authority, and Knowledge
 *   pins are all proven before transaction entry and carried in as trusted
 *   resolved values (a map-backed Knowledge resolver performs zero I/O
 *   inside the transaction);
 * - DB-controlled state revalidates INSIDE the transaction (challenge insert
 *   constraints, activation transition guards, participation uniqueness);
 * - all PostgreSQL persistence commits or rolls back together; there are no
 *   nested independent commits (insertChallengeWithConfig,
 *   activateChallenge and insertParticipationEpisode open no transaction of
 *   their own — the single db.transaction below owns atomicity).
 *
 * Authority race (explicit non-goal): creator membership is proven live
 * BEFORE the transaction; the seam does not re-hit Firestore inside it.
 * A membership revoked between the live check and commit is NOT
 * synchronized — atomicity across PostgreSQL + Firestore is not invented
 * here (no distributed transaction). The requirement met is atomicity of
 * PostgreSQL establishment. The stale PG group_memberships shadow is never
 * consulted for authorization at any point.
 *
 * Provider-neutral: pure domain + `Db`. No Firebase imports.
 */

import type { Db } from './db.js';
import {
  activateChallenge,
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
import type {
  ActivityConfigRow,
  ChallengeConfigResolvers,
  ConfigVersionRow,
} from './challengeConfigs.js';

export interface EstablishmentInput extends NewChallengeInput {
  /** establishment -> active inside the same transaction when true. */
  activate: boolean;
  /** Open a creator participation episode inside the same transaction. */
  joinCreator: boolean;
}

export interface EstablishmentResult {
  challenge: ChallengeRow;
  version: ConfigVersionRow;
  activities: ActivityConfigRow[];
  activated: boolean;
  creatorParticipationId: string | null;
}

function fail(message: string): never {
  throw new Error(`challenge-establishment: ${message}`);
}

/**
 * Establish a clean V2 Challenge atomically. Live authority failures,
 * unknown/unpublished Knowledge and invalid configs all reject BEFORE the
 * transaction opens (nothing persists); every PostgreSQL write after that
 * point belongs to the single transaction below.
 */
export async function establishChallengeV2(
  db: Db,
  input: EstablishmentInput,
  resolvers: ChallengeCreationResolvers,
): Promise<EstablishmentResult> {
  // Pure validation first (includes the C3A collective-unit invariant).
  const basis = validateNewChallenge(input);

  // Live Group authority, outside the transaction (fail closed).
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

  // Knowledge pins, outside the transaction. The map-backed resolver given
  // to the persistence path performs no I/O inside the transaction.
  const pins = new Map<string, { knowledge_id: string; current_version: number }>();
  for (const activity of input.activities) {
    if (pins.has(activity.canonical_key)) continue;
    const pin = await resolvers.resolveKnowledgePin(activity.canonical_key);
    if (!pin) {
      fail(`unknown or unpublished Knowledge for '${activity.canonical_key}' (pins are never invented)`);
    }
    pins.set(activity.canonical_key, pin);
  }
  const pinnedResolvers: ChallengeConfigResolvers = {
    resolveKnowledgePin: async (key: string) => pins.get(key) ?? null,
  };

  return db.transaction(async (tx) => {
    const created = await insertChallengeWithConfig(tx, input, basis, pinnedResolvers);
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
    return {
      challenge: { ...created.challenge, status },
      version: created.version,
      activities: created.activities,
      activated,
      creatorParticipationId,
    };
  });
}
