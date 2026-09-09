/**
 * Transitional Group Membership authority contract (C2A close).
 *
 * Group operational authority still lives in Firestore; the PostgreSQL
 * groups/group_memberships rows are shadows that can go stale between
 * imports (a removed Firestore member can linger as apparently active).
 * The shadow must therefore never INDEPENDENTLY authorize:
 * - Challenge establishment (creator membership), or
 * - Challenge joining (participant membership).
 *
 * This module defines the narrowest provider-neutral contract for CURRENT
 * Group membership authority. The resolver is injected at the
 * application/runtime boundary: while Firestore remains Group authority,
 * the production implementation queries Firestore/server-side authority;
 * when Group authority migrates to PostgreSQL, the implementation changes
 * without changing the Challenge/Participation domain contract. C2B reuses
 * this same seam wherever product rules require current Group Membership.
 *
 * Deliberately policy-free: the authority implementation decides what
 * counts as eligible (the `eligible` flag); this contract transports that
 * decision plus the authority-reported status for attribution. No
 * Charter roles, steward rules, reinstatement policy, or exit-consequence
 * policy live here.
 *
 * No Firebase import here (contract only). No routes. No tables.
 */

export interface GroupMembershipAuthorityStatus {
  /** Authority-reported membership status (opaque to the domain). */
  status: string;
  /** Whether the member currently qualifies as a Group Member. */
  eligible: boolean;
}

export interface GroupMembershipAuthority {
  /**
   * Resolve CURRENT membership of a member in a group under live Group
   * authority. Returns null when the authority reports no membership.
   * TRANSITIONAL: replaced by a PostgreSQL-local read when Group
   * authority migrates; the domain call sites do not change.
   */
  resolveGroupMembershipAuthority: (
    groupId: string,
    memberId: string,
  ) => Promise<GroupMembershipAuthorityStatus | null>;
}

function fail(message: string): never {
  throw new Error(`group-membership-authority: ${message}`);
}

/**
 * Gate helper: require current Group Membership for an action.
 * Rejects when the authority reports no membership or eligible === false.
 * The PG shadow row is never consulted here by design.
 */
export async function requireCurrentGroupMember(
  authority: GroupMembershipAuthority,
  groupId: string,
  memberId: string,
  action: string,
): Promise<GroupMembershipAuthorityStatus> {
  let result: GroupMembershipAuthorityStatus | null;
  try {
    result = await authority.resolveGroupMembershipAuthority(groupId, memberId);
  } catch (error) {
    fail(`${action} refused: membership authority unreachable (${(error as Error).message})`);
  }
  if (!result || result.eligible !== true) {
    fail(`${action} refused: no current Group Membership under live Group authority`);
  }
  return result;
}
