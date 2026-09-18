import type { ApiMembership } from '../../api/membershipsApi';

/**
 * TIIZI-S3A-FOUNDER-PREVIEW-CORR-001 — V2 Groups view model (pure).
 *
 * The S3a Founder preview proved the Groups read contract correct and the
 * failure environmental (a superseded preview runtime served the screen and
 * rejected the session token): an authenticated zero-membership read
 * (`memberships: []`) MUST render an honest empty state with a discoverable
 * action into the EXISTING governed Group-creation route — never an error.
 *
 * This module is the single source of that branch contract so it can be
 * covered behaviorally. It manufactures nothing: no Group, no membership,
 * no Challenge, no participation. It only classifies the query state the
 * server already proved. Navigation targets the existing governed route.
 */

/** Existing governed Group-creation experience (S2-G). Single source for CTAs. */
export const V2_GROUPS_NEW_PATH = '/v2/groups/new';

export type GroupsViewState =
  | { kind: 'loading' }
  | { kind: 'idle' }
  | { kind: 'error' }
  | { kind: 'empty' }
  | { kind: 'list'; memberships: ApiMembership[] };

export interface GroupsQueryState {
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
  memberships: ApiMembership[] | undefined;
}

/**
 * Classify one memberships read into its experience branch. Branch
 * precedence mirrors the screen: loading, then genuine error, then the
 * success branches (honest empty state for zero memberships, list
 * otherwise). A disabled/pre-auth query stays idle and renders nothing.
 */
export function groupsViewFor(query: GroupsQueryState): GroupsViewState {
  if (query.isLoading) return { kind: 'loading' };
  if (query.isError) return { kind: 'error' };
  if (query.isSuccess) {
    const memberships = query.memberships ?? [];
    if (memberships.length === 0) return { kind: 'empty' };
    return { kind: 'list', memberships };
  }
  return { kind: 'idle' };
}
