import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../../api/apiClient';
import { V2Button, V2EmptyState, V2ErrorState, V2LoadingState, V2Page } from '../components/V2Primitives';
import { useAuth } from '../../hooks/useAuth';
import { useV2GroupId } from '../group/V2GroupScope';
import { V2GroupFeedEvent } from './V2GroupFeedEvent';
import { handleV2GroupFeedDenied, v2GroupFeedKey } from './groupFeedQueryKeys';
import { composeGroupFeedPages, groupFeedBlockingView, cursorRecoveryOnFreshPageSuccess, cursorRecoveryOnRefresh, recoverGroupFeedFromInvalidCursor } from './groupFeedClientPolicy';
import { useV2GroupFeed } from './useV2GroupFeed';

// Scroll position of the full Feed per Group, kept for the session so returning from a
// Challenge (Back to Group activity) lands where the member left off with loaded pages intact.
const feedScrollByGroup = new Map<string, number>();

export function V2GroupFeedScreen() {
  const groupId = useV2GroupId();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const feed = useV2GroupFeed(groupId);
  const recoveredCursor = useRef(false);
  const handledDenied = useRef(false);
  const queryKey = useMemo(() => [...v2GroupFeedKey(groupId ?? undefined, user?.uid), 'full'] as const, [groupId, user?.uid]);

  useEffect(() => {
    if (feed.isSuccess && !feed.isFetchingNextPage) recoveredCursor.current = cursorRecoveryOnFreshPageSuccess().attempted;
  }, [feed.isSuccess, feed.isFetchingNextPage]);

  // Any invalid_cursor on the full Feed (Load More, background/refocus refetch, remount) recovers
  // once per cycle by resetting to page one; a repeat in the same cycle is surfaced, never looped.
  useEffect(() => {
    if (!(feed.error instanceof ApiError)) return;
    recoveredCursor.current = recoverGroupFeedFromInvalidCursor(
      queryClient,
      queryKey,
      { attempted: recoveredCursor.current },
      feed.error.code,
    ).attempted;
  }, [feed.error, queryClient, queryKey]);

  useEffect(() => {
    if (feed.error instanceof ApiError && feed.error.status === 404 && !handledDenied.current) {
      handledDenied.current = true;
      void handleV2GroupFeedDenied(queryClient, groupId ?? '', user?.uid).then((destination) => {
        navigate(destination, { replace: true });
      });
    }
  }, [feed.error, groupId, navigate, queryClient, user?.uid]);

  const scrollKey = groupId ?? '';
  const restoredScroll = useRef(false);
  useLayoutEffect(() => {
    if (restoredScroll.current || !feed.data) return;
    restoredScroll.current = true;
    const saved = feedScrollByGroup.get(scrollKey);
    if (saved) window.scrollTo(0, saved);
  }, [feed.data, scrollKey]);
  // Layout-effect cleanup runs before the next route's DOM is committed, so the real offset is read.
  useLayoutEffect(() => () => { feedScrollByGroup.set(scrollKey, window.scrollY); }, [scrollKey]);

  if (feed.error instanceof ApiError && feed.error.status === 404) return null;
  const hasCachedPages = (feed.data?.pages.length ?? 0) > 0;
  const blocking = groupFeedBlockingView({ hasCachedPages, isPending: feed.isPending, isError: feed.isError });
  const cursorExpired = feed.error instanceof ApiError && feed.error.code === 'invalid_cursor';
  // Manual Refresh keeps every loaded event visible while it runs (no reset): the stored pages
  // are refetched in place and an expired cursor still takes the bounded page-one recovery.
  const refreshInPlace = () => {
    recoveredCursor.current = cursorRecoveryOnRefresh().attempted;
    void feed.refetch();
  };
  // Retry after exhausted recovery: a clean page-one cycle that never replays stored cursors.
  const refreshFromPageOne = () => {
    recoveredCursor.current = cursorRecoveryOnRefresh().attempted;
    void queryClient.resetQueries({ queryKey, exact: true });
  };
  // Recovery has not run yet for this error: show the refresh state instead of a transient error.
  if (blocking !== 'content' && cursorExpired && !recoveredCursor.current) {
    return <V2Page><V2LoadingState label="Refreshing Group activity…" /></V2Page>;
  }

  if (blocking === 'loading') return <V2Page><p className="mb-3"><Link to={`/v2/groups/${encodeURIComponent(groupId ?? '')}`} className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-bold text-slate-600 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">← Back to Group</Link></p><V2LoadingState label="Loading Group activity…" /></V2Page>;
  if (blocking === 'error' && !(feed.error instanceof ApiError && feed.error.status === 404)) {
    return <V2Page><p className="mb-3"><Link to={`/v2/groups/${encodeURIComponent(groupId ?? '')}`} className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-bold text-slate-600 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">← Back to Group</Link></p><V2ErrorState title="We could not load Group activity" message="Please check your connection and try again." onRetry={() => (cursorExpired ? refreshFromPageOne() : void feed.refetch())} /></V2Page>;
  }

  const events = composeGroupFeedPages(feed.data?.pages);
  const refreshing = feed.isFetching && !feed.isFetchingNextPage;
  return (
    <V2Page>
      <p className="mb-3"><Link to={`/v2/groups/${encodeURIComponent(groupId ?? '')}`} className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-bold text-slate-600 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">← Back to Group</Link></p>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-black tracking-tight text-slate-900">Group activity</h1>
        <V2Button variant="secondary" className="min-h-11" onClick={refreshInPlace} disabled={refreshing}>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </V2Button>
      </div>
      {feed.isSuccess && events.length === 0 && <V2EmptyState title="No Group activity is available yet." message="Activity will appear here as Challenges progress." />}
      {events.length > 0 && <ul className="space-y-2">{events.map((event) => <V2GroupFeedEvent key={event.feedEventId} event={event} groupId={groupId ?? ''} />)}</ul>}
      {feed.isError && hasCachedPages && !feed.isFetchNextPageError && !(cursorExpired && !recoveredCursor.current) && <V2ErrorState title="We could not refresh Group activity" message="Showing what was already loaded." onRetry={() => (cursorExpired ? refreshFromPageOne() : refreshInPlace())} />}
      {feed.isFetchNextPageError && <V2ErrorState title="We could not load more activity" message="Please try again." onRetry={() => void feed.fetchNextPage()} />}
      {feed.hasNextPage && !feed.isFetchNextPageError && <div className="flex justify-center pt-4 pb-4"><V2Button variant="secondary" className="min-h-11" disabled={feed.isFetchingNextPage} onClick={() => void feed.fetchNextPage()}>{feed.isFetchingNextPage ? 'Loading…' : 'Load more activity'}</V2Button></div>}
    </V2Page>
  );
}
