import type { MemberRecentActivityItem } from '../../api/memberRecentActivityApi';
import { V2ErrorState } from '../components/V2Primitives';
import { useV2LatestChallengeActivity } from '../member/recentActivityQuery';

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

function Contribution({ item }: { item: MemberRecentActivityItem }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="break-words text-sm font-black text-slate-900">{item.activityName}</h3>
          <p className="mt-1 text-base font-bold text-slate-800">{item.value} {item.unit}</p>
        </div>
        <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-bold text-violet-900">Private to you</span>
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
    </article>
  );
}

export function V2LatestChallengeContribution({ challengeId }: { challengeId: string }) {
  const activity = useV2LatestChallengeActivity(challengeId);

  return (
    <section aria-labelledby="latest-challenge-contribution-title" className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <h2 id="latest-challenge-contribution-title" className="text-sm font-black text-slate-900">Your latest contribution</h2>
      <p className="mt-1 text-xs leading-5 text-slate-600">Personal Activity is private to you and is not automatically published to a Feed.</p>
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
      {activity.isSuccess && !activity.isFetching && activity.data === null && (
        <p className="mt-3 text-sm text-slate-600">No accepted Activity from you in this Challenge yet.</p>
      )}
      {activity.isSuccess && !activity.isFetching && activity.data && (
        <div className="mt-3">
          <Contribution item={activity.data} />
        </div>
      )}
    </section>
  );
}
