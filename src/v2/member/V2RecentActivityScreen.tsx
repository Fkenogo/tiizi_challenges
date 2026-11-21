import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { MemberRecentActivityItem } from '../../api/memberRecentActivityApi';
import {
  V2ActivityShareChoices,
  shareSourceFromHistoryItem,
} from '../components/V2ActivityShareChoices';
import {
  V2Button,
  V2Card,
  V2EmptyState,
  V2ErrorState,
  V2LoadingState,
  V2Page,
  V2SectionHeader,
} from '../components/V2Primitives';
import {
  useV2RecentActivityHistory,
  useV2RecentActivityPreview,
} from './recentActivityQuery';

function formatActivityTime(value: string, timezone: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  }).format(new Date(value));
}

function ActivityTimeline({
  items,
  shareLater = false,
}: {
  items: MemberRecentActivityItem[];
  shareLater?: boolean;
}) {
  const [shareActivityId, setShareActivityId] = useState<string | null>(null);
  return (
    <ol className="space-y-3">
      {items.map((item) => (
        <li key={item.activityId}>
          <article className="rounded-2xl border border-slate-200 bg-white p-3">
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
              <p className="min-w-0 flex-1 break-words text-sm font-bold text-slate-900">
                {item.revisionState === 'reversed' ? 'Reversed Activity' : 'Activity logged'}
                {' · '}{item.activityName}{' · '}{new Intl.NumberFormat().format(item.value)}{' '}{item.unit}
              </p>
              {item.revisionState !== 'current' && (
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  item.revisionState === 'updated' ? 'bg-amber-50 text-amber-900' : 'bg-slate-100 text-slate-700'
                }`}>
                  {item.revisionState === 'updated' ? 'Updated' : 'Reversed'}
                </span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs leading-5 text-slate-600">
              <span>
                <span className="font-bold text-slate-700">Performed</span>{' '}
                <time dateTime={item.occurredAt}>{formatActivityTime(item.occurredAt, item.displayTimezone)}</time>
              </span>
              <span>
                <span className="font-bold text-slate-700">Recorded</span>{' '}
                <time dateTime={item.recordedAt}>{formatActivityTime(item.recordedAt, item.displayTimezone)}</time>
              </span>
            </div>
            <p className="mt-1 break-words text-[11px] text-slate-500">Times shown in {item.displayTimezone}</p>
            <Link
              to={`/v2/challenges/${encodeURIComponent(item.challenge.id)}`}
              className="mt-2 inline-flex max-w-full break-words text-xs font-bold text-primary hover:underline"
              aria-label={`View Challenge details: ${item.challenge.title}`}
            >
              Challenge: {item.challenge.title} · View details
            </Link>
            {shareLater && (
              <>
                <div>
                  <V2Button
                    variant="secondary"
                    onClick={() => setShareActivityId(item.activityId)}
                    className="mt-2 min-h-11 max-w-full break-words"
                  >
                    Share {item.activityName} activity
                  </V2Button>
                </div>
                {shareActivityId === item.activityId && (
                  <V2ActivityShareChoices
                    mode="later"
                    source={shareSourceFromHistoryItem(item)}
                    onClose={() => setShareActivityId(null)}
                  />
                )}
              </>
            )}
          </article>
        </li>
      ))}
    </ol>
  );
}

/** Compact private timeline entry point on Today, backed by accepted server records. */
export function V2RecentActivityPreview() {
  const recent = useV2RecentActivityPreview();
  const items = recent.data?.items ?? [];
  const previewItems = items.length > 2 ? items.slice(0, 2) : items;

  return (
    <section aria-labelledby="recent-activity-preview" className="mt-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="recent-activity-preview" className="text-base font-black text-slate-900">Recent Activity</h2>
        <Link to="/v2/activity" className="text-sm font-bold text-primary hover:underline">View all activity</Link>
      </div>
      {recent.isLoading ? (
        <V2LoadingState label="Loading Recent Activity…" />
      ) : recent.isError ? (
        <V2ErrorState
          title="We couldn't load Recent Activity"
          message="Your history is private to you. Please try again."
          onRetry={() => void recent.refetch()}
        />
      ) : items.length === 0 ? (
        <V2EmptyState
          compact
          title="No Activity logged yet"
          message="Accepted Activity logs will appear here. Your history is private to you."
        />
      ) : (
        <ActivityTimeline items={previewItems} />
      )}
    </section>
  );
}

/** Protected, paginated owner history; the server derives its owner from auth. */
export function V2RecentActivityScreen() {
  const history = useV2RecentActivityHistory();
  const items = history.data?.pages.flatMap((page) => page.items) ?? [];

  if (history.isLoading) {
    return <V2Page><V2LoadingState label="Loading your Recent Activity…" /></V2Page>;
  }
  if (!history.data && history.isError) {
    return (
      <V2Page>
        <V2ErrorState
          title="We couldn't load Recent Activity"
          message="Please try again. Your Activity history is private to you."
          onRetry={() => void history.refetch()}
        />
      </V2Page>
    );
  }

  return (
    <V2Page>
      <V2SectionHeader
        eyebrow="Personal history"
        title="Recent Activity"
        description="Accepted Activity logs, newest performed first. Updated entries show the current effective value; reversed entries stay visible but do not count as active progress."
        action={<Link to="/v2/today" className="text-sm font-bold text-primary hover:underline">Back to Today</Link>}
      />
      <p className="mb-4 text-xs leading-5 text-slate-600">
        Performed and Recorded times are distinct. Each entry shows its recorded time zone, or the saved Challenge time zone when the Activity did not include one. This history is private to you.
      </p>
      {items.length === 0 ? (
        <V2EmptyState
          title="No Activity logged yet"
          message="Accepted Activity logs will appear here. They are not automatically shared to a Feed."
        />
      ) : (
        <>
          <ActivityTimeline items={items} shareLater />
          {history.isFetchNextPageError && (
            <div className="mt-4" role="alert">
              <V2ErrorState
                title="We couldn't load more Activity"
                message="Your earlier entries are still available. Please try again."
                onRetry={() => void history.fetchNextPage()}
              />
            </div>
          )}
          {history.hasNextPage && !history.isFetchNextPageError && (
            <div className="mt-4 flex justify-center">
              <V2Button
                variant="secondary"
                disabled={history.isFetchingNextPage}
                onClick={() => void history.fetchNextPage()}
              >
                {history.isFetchingNextPage ? 'Loading…' : 'Load more'}
              </V2Button>
            </div>
          )}
        </>
      )}
      {history.isError && !history.isFetchNextPageError && (
        <div className="mt-4" role="alert">
          <V2ErrorState
            title="We couldn't refresh Recent Activity"
            message="The history shown may be out of date. Please try again."
            onRetry={() => void history.refetch()}
          />
        </div>
      )}
      <V2Card className="mt-5 border-dashed bg-slate-50 p-3">
        <p className="text-xs leading-5 text-slate-600">Recent Activity is separate from Group Feed and Challenge Feed publishing. Sharing is not part of this history.</p>
      </V2Card>
    </V2Page>
  );
}
