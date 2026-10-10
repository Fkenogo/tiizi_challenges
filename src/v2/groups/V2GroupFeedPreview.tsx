import { Link } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../../api/apiClient';
import { useAuth } from '../../hooks/useAuth';
import { V2Button } from '../components/V2Primitives';
import { removeV2GroupFeed } from './groupFeedQueryKeys';
import { v2GroupDetailKey } from './groupQueryKeys';
import { V2GroupFeedEvent } from './V2GroupFeedEvent';
import { useV2GroupFeed } from './useV2GroupFeed';

export function V2GroupFeedPreview({ groupId }: { groupId: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const feed = useV2GroupFeed(groupId, true, true);
  const handledDenied = useRef(false);
  const events = feed.data?.pages[0]?.events.slice(0, 3) ?? [];
  useEffect(() => {
    if (!(feed.error instanceof ApiError) || feed.error.status !== 404 || handledDenied.current) return;
    handledDenied.current = true;
    void removeV2GroupFeed(queryClient, groupId, user?.uid);
    void queryClient.invalidateQueries({ queryKey: v2GroupDetailKey(groupId, user?.uid), exact: true });
  }, [feed.error, groupId, queryClient, user?.uid]);
  return (
    <section aria-labelledby="group-activity-heading" className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h2 id="group-activity-heading" className="text-base font-black text-slate-900">Group activity</h2>
        <Link to={`/v2/groups/${encodeURIComponent(groupId)}/feed`} className="min-h-11 rounded-lg px-3 py-3 text-sm font-bold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          View all activity
        </Link>
      </div>
      {feed.isLoading && <p role="status" className="rounded-xl bg-white px-4 py-3 text-sm text-slate-500">Loading Group activity…</p>}
      {feed.isError && events.length === 0 && <div className="rounded-xl border border-slate-200 bg-white px-4 py-3" role="alert">
        <p className="text-sm text-slate-600">{feed.error instanceof ApiError && feed.error.status === 404 ? 'Group activity is unavailable.' : 'We could not load Group activity just now.'}</p>
        <V2Button variant="secondary" className="min-h-11" onClick={() => void feed.refetch()} disabled={feed.isFetching}>Try again</V2Button>
      </div>}
      {feed.isSuccess && !feed.isFetching && events.length === 0 && <p className="rounded-xl bg-white px-4 py-3 text-sm text-slate-500">Group activity will appear here as Challenges progress.</p>}
      {events.length > 0 && <ul className="space-y-2">{events.map((event) => <V2GroupFeedEvent key={event.feedEventId} event={event} groupId={groupId} />)}</ul>}
    </section>
  );
}
