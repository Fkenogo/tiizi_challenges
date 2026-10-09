import type { QueryClient, QueryKey } from '@tanstack/react-query';
import type { GroupFeedPage } from '../../api/groupFeedApi';

export interface CursorRecoveryState {
  attempted: boolean;
}

/**
 * Bounded recovery from an expired/invalid cursor. ANY full-feed request that fails with
 * `invalid_cursor` qualifies — Load More, a background/refocus refetch (which replays every
 * stored cursor) or a remount — not only a Load More. The first one in a cycle resets the
 * accumulated pagination to page one (no cursor is replayed); a second one in the same cycle
 * is not retried, so recovery can never loop. Any other error leaves pagination untouched.
 */
export function cursorRecoveryOnPageError(
  state: CursorRecoveryState,
  errorCode: string | undefined,
): { state: CursorRecoveryState; resetToFirstPage: boolean } {
  if (errorCode !== 'invalid_cursor' || state.attempted) {
    return { state, resetToFirstPage: false };
  }
  return { state: { attempted: true }, resetToFirstPage: true };
}

/**
 * Applies the recovery decision: discards every stored page and cursor for this exact
 * Feed key, which refetches page one with no cursor. Returns the next recovery state.
 */
export function recoverGroupFeedFromInvalidCursor(
  queryClient: QueryClient,
  queryKey: QueryKey,
  state: CursorRecoveryState,
  errorCode: string | undefined,
): CursorRecoveryState {
  const decision = cursorRecoveryOnPageError(state, errorCode);
  if (decision.resetToFirstPage) void queryClient.resetQueries({ queryKey, exact: true });
  return decision.state;
}

export function cursorRecoveryOnFreshPageSuccess(): CursorRecoveryState {
  return { attempted: false };
}

export function cursorRecoveryOnRefresh(): CursorRecoveryState {
  return { attempted: false };
}

/** Pages and events are rendered in the exact order supplied by GF-03. */
export function composeGroupFeedPages(pages: readonly GroupFeedPage[] | undefined) {
  return pages?.flatMap((page) => page.events) ?? [];
}
