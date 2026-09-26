/**
 * Provider-neutral contract for current Group Membership authority.
 * V2 production injects the PostgreSQL implementation; legacy Firestore
 * adapters remain outside the active V2 runtime. Challenge and Participation
 * domain code consume the same interface without choosing a provider.
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
   * Resolve current membership under the configured Group authority.
   * Returns null when the authority reports no membership.
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
