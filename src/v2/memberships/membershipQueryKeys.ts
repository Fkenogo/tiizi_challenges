import type { QueryClient } from '@tanstack/react-query';

/**
 * Canonical V2 membership query-key contract (TIIZI-S2B-S2G-CORR-001).
 *
 * Single source of truth for the current member's `GET /v1/memberships/me`
 * cache family, shared by the S2-G Groups read and the S2b Challenge
 * creation host read. Before this contract the two journeys used different
 * key families (`v2-memberships` vs `v2-create-memberships`), so the S2-G
 * post-creation invalidation never reached the S2b host read and a newly
 * created Group stayed invisible there for up to 60 seconds.
 *
 * Key semantics:
 * - family scope `v2-memberships` for every current-member memberships read;
 * - the authenticated uid as the second segment, so each signed-in user's
 *   cache entry is isolated and one user's reads can never serve another's;
 * - array literals must never be repeated in hooks: build keys only through
 *   `v2MembershipsKey`, invalidate only through `invalidateV2Memberships`.
 */

/** Cache family scope for the current member's memberships. */
export const V2_MEMBERSHIPS_SCOPE = 'v2-memberships';

/** Canonical key for one member's memberships read. */
export function v2MembershipsKey(uid: string | undefined): [string, string | undefined] {
  return [V2_MEMBERSHIPS_SCOPE, uid];
}

/**
 * S2-G success boundary: mark the canonical memberships read stale so the
 * server re-proves it on the next read. Called after a successful
 * `POST /v1/groups` — never injects the created Group client-side.
 *
 * Without a uid the family prefix is invalidated (covers the current
 * member); with a uid exactly that member's entry is invalidated. Either
 * form only marks entries stale — cached data is never merged across
 * users, and every refetch remains authenticated per signed-in user.
 */
export async function invalidateV2Memberships(
  queryClient: QueryClient,
  uid?: string,
): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey: uid === undefined ? [V2_MEMBERSHIPS_SCOPE] : v2MembershipsKey(uid),
  });
}
