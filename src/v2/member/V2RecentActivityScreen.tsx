import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { MemberRecentActivityItem } from '../../api/memberRecentActivityApi';
import type { PersonalTimelineItem } from '../../api/memberTimelineApi';
import {
  V2ActivityShareChoices,
  shareSourceFromTimelineItem,
} from '../components/V2ActivityShareChoices';
import {
  V2Button,
  V2EmptyState,
  V2ErrorState,
  V2LoadingState,
  V2Page,
  V2SectionHeader,
} from '../components/V2Primitives';
import { useV2PersonalTimelineHistory } from './personalTimelineQuery';
import { useV2RecentActivityPreview } from './recentActivityQuery';

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

function formatTimelineTime(value: string, timezone: string | null): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    ...(timezone ? { timeZone: timezone } : {}),
  }).format(new Date(value));
}

function formatResultSummary(item: PersonalTimelineItem): string | null {
  if (!item.navigation.accessible || !item.result) return null;
  const parts: string[] = [];
  const { result } = item;

  if (result.finalPosition !== null) {
    parts.push(`Rank #${result.finalPosition}`);
  }
  if (result.collectiveGoalReached === true) {
    parts.push('Goal reached');
  } else if (result.collectiveGoalReached === false) {
    parts.push('Goal not reached');
  } else if (result.completed === true) {
    parts.push('Completed');
  } else if (result.completed === false) {
    parts.push('Not completed');
  }
  if (result.daysCompleted !== null) {
    parts.push(`${result.daysCompleted} ${result.daysCompleted === 1 ? 'day' : 'days'} completed`);
  }
  if (result.bestStreak !== null) {
    parts.push(`Best streak: ${result.bestStreak} ${result.bestStreak === 1 ? 'day' : 'days'}`);
  }
  if (result.collectiveTotal !== null) {
    const unitSuffix = result.goalUnit ? ` ${result.goalUnit}` : '';
    const totalText = `${new Intl.NumberFormat().format(result.collectiveTotal)}${unitSuffix}`;
    if (result.goalValue !== null) {
      parts.push(`${totalText} / ${new Intl.NumberFormat().format(result.goalValue)}${unitSuffix}`);
    } else {
      parts.push(totalText);
    }
  }

  return parts.length > 0 ? parts.join(' · ') : null;
}

function timelineCardHeading(item: PersonalTimelineItem): string {
  if (!item.navigation.accessible) {
    return item.label;
  }
  if (item.eventType === 'activity_logged' && item.activity) {
    const base = item.activity.revisionState === 'reversed' ? 'Reversed Activity' : item.label;
    const parts = [base];
    if (item.activity.activityName) parts.push(item.activity.activityName);
    if (item.activity.value !== null && item.activity.unit) {
      parts.push(`${new Intl.NumberFormat().format(item.activity.value)} ${item.activity.unit}`);
    }
    return parts.join(' · ');
  }
  if (item.category === 'group' && item.group?.name) {
    return `${item.label} · ${item.group.name}`;
  }
  if (item.challenge?.title) {
    return `${item.label} · ${item.challenge.title}`;
  }
  return item.label;
}

function ActivityTimeline({
  items,
}: {
  items: MemberRecentActivityItem[];
}) {
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
          </article>
        </li>
      ))}
    </ol>
  );
}

function PersonalTimelineList({
  items,
}: {
  items: PersonalTimelineItem[];
}) {
  const [shareActivityId, setShareActivityId] = useState<string | null>(null);

  return (
    <ol className="space-y-3">
      {items.map((item) => {
        const shareSource = shareSourceFromTimelineItem(item);
        const resultSummary = formatResultSummary(item);
        const revisionState = item.navigation.accessible ? item.activity?.revisionState : undefined;
        const canNavigate = Boolean(item.navigation.accessible && item.navigation.path);
        const navLabel = item.navigation.kind === 'group' && item.group?.name
          ? `View Group details: ${item.group.name}`
          : item.navigation.kind === 'challenge' && item.challenge?.title
            ? `View Challenge details: ${item.challenge.title}`
            : null;
        const navText = item.navigation.kind === 'group' && item.group?.name
          ? `Group: ${item.group.name} · View Group`
          : item.navigation.kind === 'challenge' && item.challenge?.title
            ? `Challenge: ${item.challenge.title} · View details`
            : null;

        return (
          <li key={item.timelineEventId}>
            <article className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                <p className="min-w-0 flex-1 break-words text-sm font-bold text-slate-900">
                  {timelineCardHeading(item)}
                </p>
                {revisionState && revisionState !== 'current' && (
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    revisionState === 'updated' ? 'bg-amber-50 text-amber-900' : 'bg-slate-100 text-slate-700'
                  }`}>
                    {revisionState === 'updated' ? 'Updated' : 'Reversed'}
                  </span>
                )}
              </div>

              {resultSummary && (
                <p className="mt-1.5 break-words text-xs font-semibold text-slate-700">
                  {resultSummary}
                </p>
              )}

              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs leading-5 text-slate-600">
                {item.eventType === 'activity_logged' && item.navigation.accessible && item.performedAt && (
                  <span>
                    <span className="font-bold text-slate-700">Performed</span>{' '}
                    <time dateTime={item.performedAt}>{formatTimelineTime(item.performedAt, item.displayTimezone)}</time>
                  </span>
                )}
                <span>
                  <span className="font-bold text-slate-700">Recorded</span>{' '}
                  <time dateTime={item.recordedAt}>{formatTimelineTime(item.recordedAt, item.displayTimezone)}</time>
                </span>
              </div>

              {item.navigation.accessible && (
                <p className="mt-1 break-words text-[11px] text-slate-500">
                  {item.displayTimezone ? `Times shown in ${item.displayTimezone}` : 'Times shown in your local time'}
                </p>
              )}

              {canNavigate && item.navigation.path && navLabel && navText && (
                <div>
                  <Link
                    to={item.navigation.path}
                    className="mt-1 inline-flex min-h-11 max-w-full items-center break-words text-xs font-bold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    aria-label={navLabel}
                  >
                    {navText}
                  </Link>
                </div>
              )}

              {shareSource && (
                <>
                  <div>
                    <V2Button
                      variant="secondary"
                      onClick={() => setShareActivityId(shareSource.activityId)}
                      className="mt-2 min-h-11 max-w-full break-words"
                    >
                      Share {shareSource.activityName} activity
                    </V2Button>
                  </div>
                  {shareActivityId === shareSource.activityId && (
                    <V2ActivityShareChoices
                      mode="later"
                      source={shareSource}
                      onClose={() => setShareActivityId(null)}
                    />
                  )}
                </>
              )}
            </article>
          </li>
        );
      })}
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
  const history = useV2PersonalTimelineHistory();
  const items = history.data?.pages.flatMap((page) => page.items) ?? [];

  if (history.isLoading) {
    return <V2Page><V2LoadingState label="Loading your Personal History…" /></V2Page>;
  }
  if (!history.data && history.isError) {
    return (
      <V2Page>
        <V2ErrorState
          title="We couldn't load your Personal History"
          message="Please try again."
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
        description="Your private history of Groups, Challenges, Activity, and results, newest first."
        action={<Link to="/v2/today" className="text-sm font-bold text-primary hover:underline">Back to Today</Link>}
      />
      {items.length === 0 ? (
        <V2EmptyState
          title="No history yet"
          message="Your Groups, Challenges, Activity, and results will appear here."
        />
      ) : (
        <>
          <PersonalTimelineList items={items} />
          {history.isFetchNextPageError && (
            <div className="mt-4" role="alert">
              <V2ErrorState
                title="We couldn't load more history"
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
                className="min-h-11"
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
            title="We couldn't refresh your Personal History"
            message="The history shown may be out of date. Please try again."
            onRetry={() => void history.refetch()}
          />
        </div>
      )}
    </V2Page>
  );
}
