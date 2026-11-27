import { useState } from 'react';
import type { ActivityShareState } from '../../api/challengeFeedApi';
import type { MemberRecentActivityItem } from '../../api/memberRecentActivityApi';
import { V2ActivityShareChoices, shareSourceFromHistoryItem } from '../components/V2ActivityShareChoices';
import { V2Button, V2ErrorState } from '../components/V2Primitives';
import { useV2LatestChallengeActivity } from '../member/recentActivityQuery';
import { useV2ActivityShareState } from './challengeFeedQuery';

export type ContributionShareStatus =
  | 'loading'
  | 'error'
  | 'private'
  | 'shared'
  | 'withdrawn'
  | 'reversed'
  | 'suppressed'
  | 'expired';

export function classifyContributionShareStatus(
  item: Pick<MemberRecentActivityItem, 'revisionState'>,
  shareState: {
    isLoading: boolean;
    isError: boolean;
    isSuccess: boolean;
    data?: ActivityShareState | null;
  },
): ContributionShareStatus {
  if (shareState.isError) return 'error';
  if (shareState.isLoading || !shareState.isSuccess) return 'loading';

  const state = shareState.data ?? null;
  if (item.revisionState === 'reversed' || state?.hiddenReason === 'reversed') return 'reversed';
  if (state?.hiddenReason === 'suppressed') return 'suppressed';
  if (state?.hiddenReason === 'expired') return 'expired';
  if (state !== null && state.visible) return 'shared';
  if (state !== null && !state.visible && state.hiddenReason === 'withdrawn') return 'withdrawn';
  return 'private';
}

function formatActivityTime(value: string, timezone: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(new Date(value));
}

function RevisionStatus({ item }: { item: MemberRecentActivityItem }) {
  if (item.revisionState === 'updated') {
    return <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">Updated — showing the current effective value.</p>;
  }
  if (item.revisionState === 'reversed') {
    return <p className="mt-2 rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">Reversed — kept in your history, but not active toward Challenge progress.</p>;
  }
  return null;
}

function ShareStatusBadge({ status }: { status: ContributionShareStatus }) {
  if (status === 'shared') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
        <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        Shared to Feed
      </span>
    );
  }
  if (status === 'private') {
    return <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-bold text-violet-900">Private to you</span>;
  }
  if (status === 'withdrawn') {
    return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">No longer shared</span>;
  }
  if (status === 'error') {
    return <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900">Share status unavailable</span>;
  }
  if (status === 'loading') {
    return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">Checking status…</span>;
  }
  if (status === 'suppressed') {
    return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">Removed from Feed</span>;
  }
  if (status === 'expired') {
    return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">Feed expired</span>;
  }
  return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">Reversed</span>;
}

function Contribution({
  item,
  onShare,
}: {
  item: MemberRecentActivityItem;
  onShare: () => void;
}) {
  const shareState = useV2ActivityShareState(item.challenge.id, item.activityId);
  const status = classifyContributionShareStatus(item, shareState);
  const canShare = status === 'private' || status === 'withdrawn';

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="break-words text-sm font-black text-slate-900">{item.activityName}</h3>
          <p className="mt-1 text-base font-bold text-slate-800">{item.value} {item.unit}</p>
        </div>
        <div className="flex items-center gap-2">
          <ShareStatusBadge status={status} />
          {canShare && (
            <button
              type="button"
              onClick={onShare}
              aria-label={`Share ${item.activityName} to Challenge Feed`}
              title="Share to Challenge Feed"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </button>
          )}
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-semibold text-slate-600">Performed</dt>
          <dd className="break-words text-slate-800">
            <time dateTime={item.occurredAt}>{formatActivityTime(item.occurredAt, item.displayTimezone)}</time>
            <span className="block text-xs text-slate-500">{item.displayTimezone}</span>
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-600">Recorded</dt>
          <dd className="break-words text-slate-800">
            <time dateTime={item.recordedAt}>{formatActivityTime(item.recordedAt, item.displayTimezone)}</time>
            <span className="block text-xs text-slate-500">{item.displayTimezone}</span>
          </dd>
        </div>
      </dl>
      <RevisionStatus item={item} />
      {status === 'error' && (
        <div role="status" className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <span>We could not check whether this Activity is shared yet.</span>
          <V2Button variant="secondary" onClick={() => void shareState.refetch()} className="min-h-9 px-3 py-1 text-xs">
            Retry
          </V2Button>
        </div>
      )}
      {status === 'suppressed' && (
        <p className="mt-2 text-xs text-slate-600">This Share was removed and cannot be republished.</p>
      )}
      {status === 'expired' && (
        <p className="mt-2 text-xs text-slate-600">This Challenge Feed has expired.</p>
      )}
    </article>
  );
}

export function V2LatestChallengeContribution({ challengeId }: { challengeId: string }) {
  const activity = useV2LatestChallengeActivity(challengeId);
  const [shareActivityId, setShareActivityId] = useState<string | null>(null);
  const latestActivity = activity.data;

  return (
    <section aria-labelledby="latest-challenge-contribution-title" className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <h2 id="latest-challenge-contribution-title" className="text-sm font-black text-slate-900">Your latest contribution</h2>
      {activity.isLoading && <p role="status" className="mt-3 text-sm text-slate-600">Loading your latest Activity…</p>}
      {activity.isFetching && !activity.isLoading && <p role="status" className="mt-3 text-sm text-slate-600">Refreshing your latest Activity…</p>}
      {activity.isError && (
        <div className="mt-3">
          <V2ErrorState
            title="We could not load your latest Activity"
            message="Your recorded Activity is still saved. Retry this read without submitting it again."
            onRetry={() => void activity.refetch()}
          />
        </div>
      )}
      {activity.isSuccess && !activity.isFetching && latestActivity === null && (
        <p className="mt-3 text-sm text-slate-600">No accepted Activity from you in this Challenge yet.</p>
      )}
      {activity.isSuccess && !activity.isFetching && latestActivity && (
        <div className="mt-3">
          <Contribution
            key={latestActivity.activityId}
            item={latestActivity}
            onShare={() => setShareActivityId(latestActivity.activityId)}
          />
          {shareActivityId === latestActivity.activityId && (
            <V2ActivityShareChoices
              mode="later"
              source={shareSourceFromHistoryItem(latestActivity)}
              onClose={() => setShareActivityId(null)}
            />
          )}
        </div>
      )}
    </section>
  );
}
