import type { Db } from './db.js';

/**
 * EBC-01 Challenge-creation authority contract (provider-neutral).
 *
 * Challenge establishment requires more than "any live membership": the
 * target Group must be live under current Group authority AND the actor must
 * hold current valid authority in that Group under the existing approved
 * Group Membership rules — including the stored Group Charter flag
 * `allowMemberChallenges`. When a Group restricts Challenge creation to its
 * stewards, only a live owner/admin may establish; otherwise any live
 * member may. No new roles, governance, or invitation semantics are
 * introduced here: the flag, the roles, and the default (permitted) are the
 * existing product semantics (see groupLifecycle.buildGroupDefaults).
 *
 * Deliberately narrow: this contract transports the PostgreSQL authority
 * decision (permitted + attribution) for V2 Challenge establishment only.
 *
 * No Firebase import here (contract only). No routes. No tables.
 */

export type ChallengeCreationDenialReason =
  | 'group_unmapped'
  | 'group_missing'
  | 'group_inactive'
  | 'no_membership'
  | 'membership_inactive'
  | 'charter_restricted';

export interface ChallengeCreationAuthorityStatus {
  /** Whether the actor may establish a Challenge in the Group right now. */
  permitted: boolean;
  /** Machine-readable reason when permitted === false. */
  reason: ChallengeCreationDenialReason | null;
  /** Authority-reported group status (opaque to the domain). */
  groupStatus: string | null;
  /** Stored Charter flag; absent (legacy docs) counts as permitted. */
  allowMemberChallenges: boolean;
  /** Live membership role (owner|admin|member) or null when no membership. */
  memberRole: string | null;
  /** Authority-reported membership status (opaque to the domain). */
  memberStatus: string | null;
}

export interface ChallengeCreationAuthority {
  /**
   * Resolve CURRENT Challenge-creation authority for a member in a group
   * under the configured Group authority. Returns null when the Group cannot host new
   * Challenges at all (unmapped or missing); returns permitted:false with a
   * reason otherwise. Throws on authority failure so callers fail closed
   * ("authority unreachable") instead of treating it as a denial.
   */
  resolveChallengeCreationAuthority: (
    groupId: string,
    memberId: string,
  ) => Promise<ChallengeCreationAuthorityStatus | null>;

  /**
   * Resolve authority while participating in the Challenge write transaction.
   * PostgreSQL implementations must lock Group authority before membership
   * authority and retain those locks until the transaction completes. Other
   * adapters may omit this capability; governed Challenge writes fail closed
   * when it is absent.
   */
  resolveChallengeCreationAuthorityInTransaction?: (
    tx: Db,
    groupId: string,
    memberId: string,
  ) => Promise<ChallengeCreationAuthorityStatus | null>;
}

function fail(message: string): never {
  throw new Error(`challenge-creation-authority: ${message}`);
}

/**
 * Gate helper: require current Challenge-creation authority for an action.
 * Rejects when the authority is unreachable, unmapped/missing, or reports
 * permitted === false.
 */
export async function requireChallengeCreationAuthority(
  authority: ChallengeCreationAuthority,
  groupId: string,
  memberId: string,
  action: string,
): Promise<ChallengeCreationAuthorityStatus> {
  let result: ChallengeCreationAuthorityStatus | null;
  try {
    result = await authority.resolveChallengeCreationAuthority(groupId, memberId);
  } catch (error) {
    fail(`${action} refused: creation authority unreachable (${(error as Error).message})`);
  }
  return requirePermittedChallengeCreationAuthority(result, action);
}
/** Require the locked, transaction-scoped authority used by Challenge writes. */
export async function requireChallengeCreationAuthorityInTransaction(
  authority: ChallengeCreationAuthority,
  tx: Db,
  groupId: string,
  memberId: string,
  action: string,
): Promise<ChallengeCreationAuthorityStatus> {
  if (!authority.resolveChallengeCreationAuthorityInTransaction) {
    fail(`${action} refused: transaction-time creation authority is unavailable`);
  }
  let result: ChallengeCreationAuthorityStatus | null;
  try {
    result = await authority.resolveChallengeCreationAuthorityInTransaction(tx, groupId, memberId);
  } catch (error) {
    fail(`${action} refused: transaction-time creation authority unavailable (${(error as Error).message})`);
  }
  return requirePermittedChallengeCreationAuthority(result, action);
}

function requirePermittedChallengeCreationAuthority(
  result: ChallengeCreationAuthorityStatus | null,
  action: string,
): ChallengeCreationAuthorityStatus {
  if (!result) {
    fail(`${action} refused: group is not available for challenge establishment under current Group authority`);
  }
  if (result.permitted !== true) {
    fail(`${action} refused: actor holds no current Challenge-creation authority (${result.reason ?? 'denied'})`);
  }
  return result;
}
