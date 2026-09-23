import type { V2GroupDetail } from '../../api/groupsApi';

/**
 * TIIZI S4a — Group Home view model (pure).
 *
 * Classifies one Group detail read into its experience branch so the
 * behaviour is covered without a DOM, mirroring `groupsView.ts`:
 *
 * - loading → skeleton;
 * - 404 (unknown, inactive, or private-to-outsider — the API deliberately
 *   does not distinguish) → honest not-found with a way back to Groups;
 * - genuine failure → error with retry (never masked as not-found);
 * - success with the server's own detail → home.
 *
 * This module manufactures nothing: no Group, no membership, no count, no
 * Challenge. It only classifies the query state the server already proved.
 */

export type GroupHomeViewState =
  | { kind: 'loading' }
  | { kind: 'idle' }
  | { kind: 'error' }
  | { kind: 'notFound' }
  | { kind: 'home'; detail: V2GroupDetail };

export interface GroupHomeQueryState {
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
  /** HTTP status of the query error, when the error carries one. */
  errorStatus?: number | null;
  detail: V2GroupDetail | undefined;
}

/**
 * HTTP status from a query error, without importing the transport client:
 * ApiError carries `status`, and this stays dependency-free (like
 * groupsView) so guards can import it under plain tsx. Null when the error
 * carries no numeric HTTP status.
 */
export function groupHomeErrorStatus(error: unknown): number | null {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status: unknown }).status;
    return typeof status === 'number' ? status : null;
  }
  return null;
}

/**
 * Classify one Group detail read into its experience branch. Branch
 * precedence mirrors the screen: loading, then genuine error, then the
 * 404 not-found subset, then the success home. A disabled/pre-auth query
 * stays idle and renders nothing.
 */
export function groupHomeViewFor(query: GroupHomeQueryState): GroupHomeViewState {
  if (query.isLoading) return { kind: 'loading' };
  if (query.isError) {
    if (query.errorStatus === 404) return { kind: 'notFound' };
    return { kind: 'error' };
  }
  if (query.isSuccess) {
    if (query.detail) return { kind: 'home', detail: query.detail };
    return { kind: 'error' };
  }
  return { kind: 'idle' };
}

/**
 * Whether the viewer may be offered Challenge creation from Group Home.
 * Bound to the server's own projection: members where creation is open,
 * plus the steward under a steward restriction. The Challenge authority
 * re-enforces this server-side at establishment — this only gates the CTA.
 */
export function viewerMayCreateChallenge(detail: V2GroupDetail): boolean {
  if (detail.viewerRelationship !== 'member' && detail.viewerRelationship !== 'steward') return false;
  if (detail.allowMemberChallenges === false) return detail.viewerRelationship === 'steward';
  return true;
}
