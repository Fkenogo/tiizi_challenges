import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { PersonalTimelineItem } from '../../api/memberTimelineApi';
import {
  V2ActivityShareChoices,
  shareSourceFromTimelineItem,
  type V2ActivityShareSource,
} from '../components/V2ActivityShareChoices';
import {
  V2Button,
  V2EmptyState,
  V2ErrorState,
  V2LoadingState,
  V2Page,
  V2SectionHeader,
} from '../components/V2Primitives';
import { useV2ActivityShareState } from '../challenges/challengeFeedQuery';
import {
  V2_PERSONAL_TIMELINE_PREVIEW_SIZE,
  useV2PersonalTimelineHistory,
  useV2PersonalTimelinePreview,
} from './personalTimelineQuery';

const MAX_EAGER_SHARE_STATE_CHECKS = 5;

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

function TimelineShareControl({
  source,
  eagerCheck,
  isOpen,
  onOpen,
  onClose,
}: {
  source: V2ActivityShareSource;
  eagerCheck: boolean;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const shareState = useV2ActivityShareState(
    source.challengeId,
    source.activityId,
    eagerCheck || isOpen,
  );
  const state = shareState.isSuccess ? shareState.data : null;
  const shared = state !== null && state.visible;
  const hiddenReason = state !== null && !state.visible ? state.hiddenReason : null;

  if (hiddenReason === 'suppressed') {
    return (
      <p className="mt-2 text-xs text-slate-600">
        This Share was removed and cannot be republished.
      </p>
    );
  }
  if (hiddenReason === 'expired') {
    return (
      <p className="mt-2 text-xs text-slate-600">
        This Challenge Feed has expired.
      </p>
    );
  }
  if (hiddenReason === 'reversed') {
    return null;
  }

  return (
    <>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {shared && (
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
            Shared
          </span>
        )}
        <V2Button
          variant="secondary"
          onClick={onOpen}
          aria-label={shared ? `Manage Share for ${source.activityName}` : undefined}
          className="min-h-11 max-w-full break-words"
        >
          {shared ? 'Manage Share' : `Share ${source.activityName} activity`}
        </V2Button>
      </div>
      {isOpen && (
        <V2ActivityShareChoices
          mode="later"
          source={source}
          onClose={onClose}
        />
      )}
    </>
  );
}

function PersonalTimelineList({
  items,
  allowShare = true,
  compact = false,
}: {
  items: PersonalTimelineItem[];
  allowShare?: boolean;
  compact?: boolean;
}) {
  const [shareActivityId, setShareActivityId] = useState<string | null>(null);
  let eligibleShareIndex = 0;

  return (
    <ol className="space-y-3">
      {items.map((item) => {
        const shareSource = allowShare ? shareSourceFromTimelineItem(item) : null;
        const eagerShareCheck = shareSource !== null && eligibleShareIndex < MAX_EAGER_SHARE_STATE_CHECKS;
        if (shareSource !== null) {
          eligibleShareIndex += 1;
        }
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
            <article className={`rounded-2xl border border-slate-200 bg-white ${compact ? 'p-3' : 'p-4'}`}>
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
                <TimelineShareControl
                  source={shareSource}
                  eagerCheck={eagerShareCheck}
                  isOpen={shareActivityId === shareSource.activityId}
                  onOpen={() => setShareActivityId(shareSource.activityId)}
                  onClose={() => setShareActivityId(null)}
                />
              )}
            </article>
          </li>
        );
      })}
    </ol>
  );
}

/** Compact private timeline entry point on Today (up to 3 latest events). */
export function V2RecentActivityPreview() {
  const recent = useV2PersonalTimelinePreview();
  const items = recent.data?.items ?? [];
  const previewItems = items.slice(0, V2_PERSONAL_TIMELINE_PREVIEW_SIZE);

  return (
    <section aria-labelledby="recent-activity-preview" className="mt-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="recent-activity-preview" className="text-base font-black text-slate-900">Recent Activity</h2>
        <Link
          to="/v2/activity"
          className="inline-flex min-h-11 items-center text-sm font-bold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          View all activity
        </Link>
      </div>
      {recent.isLoading ? (
        <V2LoadingState label="Loading Recent Activity…" />
      ) : recent.isError ? (
        <V2ErrorState
          title="We couldn't load Recent Activity"
          message="Please try again."
          onRetry={() => void recent.refetch()}
        />
      ) : previewItems.length === 0 ? (
        <V2EmptyState
          compact
          title="No recent activity yet"
          message="Your Groups, Challenges, Activity, and results will appear here."
        />
      ) : (
        <PersonalTimelineList items={previewItems} allowShare={false} compact />
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
