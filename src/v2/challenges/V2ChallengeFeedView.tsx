import { Link, useParams } from 'react-router-dom';
import { ApiError } from '../../api/apiClient';
import { V2Button, V2ErrorState, V2LoadingState } from '../components/V2Primitives';
import type { ChallengeFeedItem } from '../../api/challengeFeedApi';
import {
  useV2ChallengeFeedHistory,
  useV2ChallengeFeedPreview,
  useV2WithdrawActivityShare,
} from './challengeFeedQuery';

function isFeedUnavailable(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 404 || error.status === 503);
}

/**
 * CF-3 — the minimal Challenge Feed view (S1 activity_shares only).
 *
 * CF-01 v0.2 §3/§5: this is a Challenge-local engagement surface. It is
 * never Challenge truth: every entry is a member's explicit, withdrawable
 * Share of their own accepted Activity; the server rechecks Group
 * membership and Challenge visibility on every read. Placement follows the
 * CF-01 §10 direction: a compact section on Challenge Detail with a
 * "View all" list; final placement is a later CF-4 experience decision.
 */

function formatFeedTime(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export function ChallengeFeedEntries({
  items,
  onWithdraw,
  withdrawing,
}: {
  items: ChallengeFeedItem[];
  onWithdraw?: (activityEventId: string) => void;
  withdrawing?: boolean;
}) {
  return (
    <ol className="space-y-3">
      {items.map((item) => (
        <li key={item.feedItemId}>
          <article className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="break-words text-sm font-bold text-slate-900">
              {item.sharerDisplayName ?? 'A member'} shared {item.activityName}
            </p>
            <p className="mt-1 break-words text-sm text-slate-700">
              {item.value} {item.unit} · {item.activityName}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Shared {formatFeedTime(item.publishedAt)}
            </p>
            {item.ownShare && onWithdraw && (
              <V2Button
                variant="secondary"
                onClick={() => onWithdraw(item.activityEventId)}
                disabled={withdrawing}
                className="mt-2 min-h-11"
              >
                Withdraw Share
              </V2Button>
            )}
          </article>
        </li>
      ))}
    </ol>
  );
}

/** Compact "Challenge activity" section on Challenge Details. */
export function V2ChallengeFeedSection({ challengeId }: { challengeId: string }) {
  const feed = useV2ChallengeFeedPreview(challengeId);
  return (
    <section
      aria-labelledby="challenge-activity-title"
      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
    >
      <h2 id="challenge-activity-title" className="text-sm font-black text-slate-900">
        Challenge activity
      </h2>
      {feed.isLoading && <V2LoadingState label="Checking shared Challenge activity…" />}
      {feed.isError && (
        <div className="mt-3" role="alert">
          <V2ErrorState
            title="Shared Challenge activity is unavailable"
            message={isFeedUnavailable(feed.error) ? 'This preview is not authorized to view this Feed.' : 'Please try again.'}
            onRetry={() => void feed.refetch()}
          />
        </div>
      )}
      {feed.isSuccess && feed.data.items.length === 0 && (
        <p className="mt-2 text-sm text-slate-600">
          No shared Challenge activity yet. Members choose whether to Share their own logged Activity here.
        </p>
      )}
      {feed.isSuccess && feed.data.items.length > 0 && (
        <>
          <div className="mt-3">
            <ChallengeFeedEntries items={feed.data.items} />
          </div>
          <Link
            to={`/v2/challenges/${encodeURIComponent(challengeId)}/feed`}
            className="mt-3 inline-block text-sm font-bold text-primary hover:underline"
          >
            View all Challenge activity
          </Link>
        </>
      )}
    </section>
  );
}

/** The full "View all" Challenge Feed screen. */
export function V2ChallengeFeedScreen() {
  const params = useParams<{ challengeId: string }>();
  const challengeId = params.challengeId ?? '';
  const feed = useV2ChallengeFeedHistory(challengeId);
  const withdraw = useV2WithdrawActivityShare(challengeId);

  const pages = feed.data?.pages ?? [];
  const items = pages.flatMap((page) => page.items);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-black text-slate-900">Challenge activity</h1>
        <Link
          to={`/v2/challenges/${encodeURIComponent(challengeId)}`}
          className="text-sm font-bold text-primary hover:underline"
        >
          Back to Challenge details
        </Link>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        Members choose whether to Share their own logged Activity here. Entries never change Challenge progress or results.
      </p>
      {feed.isLoading && <V2LoadingState label="Loading shared Challenge activity…" />}
      {feed.isError && (
        <div className="mt-4" role="alert">
          <V2ErrorState
            title="Shared Challenge activity is unavailable"
            message={isFeedUnavailable(feed.error) ? 'This preview is not authorized to view this Feed.' : 'Please try again.'}
            onRetry={() => void feed.refetch()}
          />
        </div>
      )}
      {feed.isSuccess && items.length === 0 && (
        <p className="mt-4 text-sm text-slate-600">No shared Challenge activity yet.</p>
      )}
      {items.length > 0 && (
        <div className="mt-4">
          <ChallengeFeedEntries
            items={items}
            onWithdraw={(activityEventId) => void withdraw.mutateAsync(activityEventId)}
            withdrawing={withdraw.isPending}
          />
        </div>
      )}
      {feed.hasNextPage && (
        <div className="mt-4">
          <V2Button
            variant="secondary"
            onClick={() => void feed.fetchNextPage()}
            disabled={feed.isFetchingNextPage}
            className="min-h-11"
          >
            {feed.isFetchingNextPage ? 'Loading…' : 'Load more'}
          </V2Button>
        </div>
      )}
    </div>
  );
}
