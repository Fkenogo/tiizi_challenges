import type { QueryClient } from '@tanstack/react-query';

/**
 * S5b — canonical Today query-key contract.
 *
 * One cache family for the member-scoped `GET /api/today` read. The
 * authenticated uid is the second segment so each signed-in member's
 * projection is isolated: one member's Today can never be served to another
 * from cache. Cache keys are built only through `v2TodayKey` and invalidated
 * only through `invalidateV2Today`.
 */
export const V2_TODAY_SCOPE = 'v2-today';

/** Canonical key for one member's Today projection read. */
export function v2TodayKey(uid: string | undefined): [string, string | undefined] {
  return [V2_TODAY_SCOPE, uid];
}

/**
 * Mark the Today projection stale so the server re-proves it on next read.
 * Called after a governed mutation that can change Today's content (activity
 * application, participation join/withdraw, Challenge establishment).
 * Cached data is never merged across members.
 */
export async function invalidateV2Today(
  queryClient: QueryClient,
  uid?: string,
): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey: uid === undefined ? [V2_TODAY_SCOPE] : v2TodayKey(uid),
  });
}
