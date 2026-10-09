import type { GroupFeedPage } from '../../api/groupFeedApi';

export interface CursorRecoveryState {
  attempted: boolean;
}

export function cursorRecoveryOnPageError(
  state: CursorRecoveryState,
  errorCode: string | undefined,
  isNextPageError: boolean,
): { state: CursorRecoveryState; resetToFirstPage: boolean } {
  if (!isNextPageError || errorCode !== 'invalid_cursor' || state.attempted) {
    return { state, resetToFirstPage: false };
  }
  return { state: { attempted: true }, resetToFirstPage: true };
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
