import { useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../../api/apiClient';
import { V2Button, V2EmptyState, V2ErrorState, V2LoadingState, V2Page } from '../components/V2Primitives';
import { useAuth } from '../../hooks/useAuth';
import { useV2GroupId } from '../group/V2GroupScope';
import { V2GroupFeedEvent } from './V2GroupFeedEvent';
import { handleV2GroupFeedDenied, v2GroupFeedKey } from './groupFeedQueryKeys';
import { composeGroupFeedPages, cursorRecoveryOnFreshPageSuccess, cursorRecoveryOnPageError, cursorRecoveryOnRefresh } from './groupFeedClientPolicy';
import { useV2GroupFeed } from './useV2GroupFeed';

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

  useEffect(() => {
    const decision = cursorRecoveryOnPageError(
      { attempted: recoveredCursor.current },
      feed.error instanceof ApiError ? feed.error.code : undefined,
      feed.isFetchNextPageError,
    );
    if (!decision.resetToFirstPage) return;
    recoveredCursor.current = decision.state.attempted;
    void queryClient.resetQueries({ queryKey, exact: true });
  }, [feed.error, feed.isFetchNextPageError, queryClient, queryKey]);

  useEffect(() => {
    if (feed.error instanceof ApiError && feed.error.status === 404 && !handledDenied.current) {
      handledDenied.current = true;
      void handleV2GroupFeedDenied(queryClient, groupId ?? '', user?.uid).then((destination) => {
        navigate(destination, { replace: true });
      });
    }
  }, [feed.error, groupId, navigate, queryClient, user?.uid]);

  if (feed.error instanceof ApiError && feed.error.status === 404) return null;
  if (feed.isFetching && !feed.isFetchingNextPage) return <V2Page><V2LoadingState label="Refreshing Group activity…" /></V2Page>;
  if (feed.isFetchNextPageError && feed.error instanceof ApiError && feed.error.code === 'invalid_cursor') {
    return <V2Page><V2LoadingState label="Refreshing Group activity…" /></V2Page>;
  }

  if (feed.isLoading) return <V2Page><p className="mb-3"><Link to={`/v2/groups/${encodeURIComponent(groupId ?? '')}`} className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-bold text-slate-600 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">← Back to Group</Link></p><V2LoadingState label="Loading Group activity…" /></V2Page>;
  if (feed.isError && !(feed.error instanceof ApiError && feed.error.status === 404)) {
    return <V2Page><p className="mb-3"><Link to={`/v2/groups/${encodeURIComponent(groupId ?? '')}`} className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-bold text-slate-600 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">← Back to Group</Link></p><V2ErrorState title="We could not load Group activity" message="Please check your connection and try again." onRetry={() => void feed.refetch()} /></V2Page>;
  }

  const events = composeGroupFeedPages(feed.data?.pages);
  return (
    <V2Page>
      <p className="mb-3"><Link to={`/v2/groups/${encodeURIComponent(groupId ?? '')}`} className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-bold text-slate-600 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">← Back to Group</Link></p>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-black tracking-tight text-slate-900">Group activity</h1>
        <V2Button variant="secondary" className="min-h-11" onClick={() => { recoveredCursor.current = cursorRecoveryOnRefresh().attempted; void queryClient.resetQueries({ queryKey, exact: true }); }} disabled={feed.isFetching}>
          {feed.isFetching ? 'Refreshing…' : 'Refresh'}
        </V2Button>
      </div>
      {feed.isSuccess && events.length === 0 && <V2EmptyState title="No Group activity is available yet." message="Activity will appear here as Challenges progress." />}
      {events.length > 0 && <ul className="space-y-2">{events.map((event) => <V2GroupFeedEvent key={event.feedEventId} event={event} groupId={groupId ?? ''} />)}</ul>}
      {feed.isFetchNextPageError && <V2ErrorState title="We could not load more activity" message="Please try again." onRetry={() => void feed.fetchNextPage()} />}
      {feed.hasNextPage && !feed.isFetchNextPageError && <div className="flex justify-center pt-4 pb-4"><V2Button variant="secondary" className="min-h-11" disabled={feed.isFetchingNextPage} onClick={() => void feed.fetchNextPage()}>{feed.isFetchingNextPage ? 'Loading…' : 'Load more activity'}</V2Button></div>}
    </V2Page>
  );
}
