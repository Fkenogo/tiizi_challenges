import { useContext, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { QueryClientContext } from '@tanstack/react-query';
import { ApiError } from '../../api/apiClient';
import type { ChallengeFeedItem } from '../../api/challengeFeedApi';
import { V2Button, V2ErrorState, V2LoadingState } from '../components/V2Primitives';
import { V2SignedImage } from '../media/V2SignedImage';
import {
  V2_CHALLENGE_FEED_SCOPE,
  useV2ChallengeFeedHistory,
  useV2ChallengeFeedPreview,
  useV2ToggleKudos,
  useV2WithdrawActivityShare,
} from './challengeFeedQuery';

/**
 * CF-3 — the Challenge Feed view (S1 activity_shares only).
 *
 * CF-01 v0.2 §3/§5/§6.2: a Challenge-local engagement surface that never
 * alters Challenge truth. The server rechecks Group membership and Challenge
 * visibility on every read; a FAILED read must never keep presenting cached
 * entries. Cards show the publishing member's permitted display name
 * (initials avatar; the generic fallback appears only for genuinely
 * unavailable identities), the shared Activity, a simple timestamp, and
 * three member actions: the single Founder-approved Kudos type, a simple
 * external Share (Web Share API, WhatsApp and Copy; text-only — no
 * recipient-safe Challenge URL exists yet, so none is invented), and
 * Withdraw for the publishing member only. Placement follows CF-01 §10:
 * a compact section on Challenge Detail with a View-all list.
 */

function isFeedUnavailable(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 404 || error.status === 503);
}

function formatFeedTime(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function initialsOf(name: string | null): string {
  if (!name) return '?';
  return name.trim().charAt(0).toUpperCase() || '?';
}

/** Recipient-safe external sharing text: member name, Activity, value and
 * unit only — never the Challenge title, notes, evidence or timestamps. */
function externalShareText(item: ChallengeFeedItem): string {
  const name = item.sharerDisplayName ?? 'A Tiizi member';
  return `${name} shared ${item.value} ${item.unit} of ${item.activityName} on Tiizi 🎉`;
}

export function ChallengeFeedEntries({
  challengeId,
  items,
  withdrawing,
  onWithdraw,
}: {
  challengeId: string;
  items: ChallengeFeedItem[];
  withdrawing?: boolean;
  onWithdraw?: (activityEventId: string) => void;
}) {
  const queryClient = useContext(QueryClientContext);
  const toggleKudos = useV2ToggleKudos(challengeId);
  const [copiedEntry, setCopiedEntry] = useState<string | null>(null);
  const [shareMenuEntry, setShareMenuEntry] = useState<string | null>(null);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [copyFailedEntry, setCopyFailedEntry] = useState<string | null>(null);
  const copiedNoticeRef = useRef<HTMLParagraphElement | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
  }, []);

  useEffect(() => {
    if (copiedEntry !== null) copiedNoticeRef.current?.focus({ preventScroll: true });
  }, [copiedEntry]);

  const nativeShareAvailable = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const shareExternally = async (item: ChallengeFeedItem) => {
    const text = externalShareText(item);
    if (nativeShareAvailable) {
      try {
        await navigator.share({ title: 'Tiizi', text });
        return;
      } catch {
        // A cancelled native sheet is not an error; fall through to the menu.
      }
    }
    setShareMenuEntry(item.feedItemId);
    setShareMenuOpen(true);
  };

  const copyShareText = async (item: ChallengeFeedItem) => {
    try {
      await navigator.clipboard.writeText(externalShareText(item));
      setShareMenuOpen(false);
      setCopyFailedEntry(null);
      setCopiedEntry(item.feedItemId);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopiedEntry(null), 2200);
    } catch {
      // Clipboard access denied or unavailable: keep the menu open and show
      // the selectable text instead of silently closing with nothing copied.
      setCopyFailedEntry(item.feedItemId);
    }
  };

  return (
    <ol className="space-y-3">
      {items.map((item) => (
        <li key={item.feedItemId}>
          <article className="rounded-2xl border border-slate-200 bg-white p-3">
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-900 text-xs font-bold text-white"
                aria-hidden="true"
              >
                {item.sharerProfileImage?.status === 'ready' ? (
                  <V2SignedImage
                    src={item.sharerProfileImage.url}
                    alt=""
                    className="h-full w-full object-cover"
                    refreshKey={`challenge-feed-${challengeId}`}
                    onExpired={() => void queryClient?.invalidateQueries({ queryKey: [V2_CHALLENGE_FEED_SCOPE] })}
                    fallback={initialsOf(item.sharerDisplayName)}
                  />
                ) : (
                  initialsOf(item.sharerDisplayName)
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-900">
                  {item.sharerDisplayName ?? 'Tiizi member'}
                </p>
                <p className="truncate text-xs text-slate-500">
                  shared {item.activityName} &bull; {item.value} {item.unit}
                </p>
              </div>
              <p className="shrink-0 text-[11px] font-semibold text-slate-400">
                {formatFeedTime(item.publishedAt)}
              </p>
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2.5">
              {!item.ownShare && (
                <V2Button
                  variant="ghost"
                  onClick={() => toggleKudos.mutate({ feedItemId: item.feedItemId, active: item.viewerKudos })}
                  disabled={toggleKudos.isPending}
                  className="min-h-9 rounded-full px-3 py-1.5"
                  pressed={item.viewerKudos}
                >
                  <span className="flex items-center gap-1.5">
                    <span aria-hidden="true">{item.viewerKudos ? '👏' : '🙌'}</span>
                    <span>Kudos</span>
                    <span className="rounded-full bg-slate-100 px-1.5 text-[11px] font-bold text-slate-600">
                      {item.kudosCount}
                    </span>
                  </span>
                </V2Button>
              )}
              {item.ownShare && (
                <span className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-slate-500">
                  <span aria-hidden="true">👏</span>
                  {item.kudosCount} Kudos
                </span>
              )}
              <V2Button
                variant="ghost"
                onClick={() => void shareExternally(item)}
                className="min-h-9 rounded-full px-3 py-1.5"
              >
                <span className="flex items-center gap-1.5">
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.3" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  Share
                </span>
              </V2Button>
              {item.ownShare && item.activityEventId && onWithdraw && (
                <V2Button
                  variant="ghost"
                  onClick={() => onWithdraw(item.activityEventId!)}
                  disabled={withdrawing}
                  className="min-h-9 rounded-full px-3 py-1.5 text-slate-500"
                >
                  Withdraw
                </V2Button>
              )}
            </div>

            {copiedEntry === item.feedItemId && (
              <p
                ref={copiedNoticeRef}
                tabIndex={-1}
                role="status"
                className="mt-2 rounded-xl bg-emerald-600 px-3 py-2 text-center text-xs font-bold text-white"
              >
                Copied! Paste it anywhere to share.
              </p>
            )}
            {shareMenuEntry === item.feedItemId && shareMenuOpen && (
              <div className="mt-2 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(externalShareText(item))}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-10 w-full items-center justify-center rounded-xl bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700"
                >
                  Share on WhatsApp
                </a>
                <V2Button variant="secondary" onClick={() => void copyShareText(item)} className="min-h-10 w-full">
                  Copy text
                </V2Button>
                {copyFailedEntry === item.feedItemId && (
                  <div role="alert" className="space-y-1.5 rounded-xl border border-amber-200 bg-amber-50 p-2.5">
                    <p className="text-xs font-bold text-amber-900">
                      Couldn&apos;t copy automatically — select and copy:
                    </p>
                    <p className="select-all break-words rounded-lg bg-white p-2 text-xs font-semibold text-slate-700">
                      {externalShareText(item)}
                    </p>
                  </div>
                )}
              </div>
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
  const withdraw = useV2WithdrawActivityShare(challengeId);
  // A failed read must not keep presenting cached entries as authorized.
  const items = feed.isSuccess ? feed.data.items : [];
  return (
    <section
      aria-labelledby="challenge-activity-title"
      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
    >
      <h2 id="challenge-activity-title" className="text-sm font-black text-slate-900">
        Challenge activity
      </h2>
      {feed.isPending && feed.isFetching && <V2LoadingState label="Checking shared Challenge activity…" />}
      {feed.isError && (
        <div className="mt-3" role="alert">
          <V2ErrorState
            title="Shared Challenge activity is unavailable"
            message={isFeedUnavailable(feed.error) ? 'This preview is not authorized to view this Feed.' : 'Please try again.'}
            onRetry={() => void feed.refetch()}
          />
        </div>
      )}
      {feed.isSuccess && items.length === 0 && (
        <p className="mt-2 text-sm text-slate-600">
          No shared Challenge activity yet. Members choose whether to Share their own logged Activity here.
        </p>
      )}
      {feed.isSuccess && items.length > 0 && (
        <>
          <div className="mt-3">
            <ChallengeFeedEntries
              challengeId={challengeId}
              items={items}
              withdrawing={withdraw.isPending}
              onWithdraw={(activityEventId) => withdraw.mutate(activityEventId)}
            />
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
  const withdrawnNoticeRef = useRef<HTMLParagraphElement | null>(null);
  const [withdrawnActivity, setWithdrawnActivity] = useState<string | null>(null);

  useEffect(() => {
    if (withdrawnActivity !== null) {
      withdrawnNoticeRef.current?.focus({ preventScroll: true });
    }
  }, [withdrawnActivity]);

  // A failed read must not keep presenting cached pages: after a membership
  // revocation the server denies, and the screen must show the denial, not
  // the previously fetched entries or their controls.
  const pages = feed.isError ? [] : feed.data?.pages ?? [];
  const items = pages.flatMap((page) => page.items);

  const handleWithdraw = (activityEventId: string) => {
    setWithdrawnActivity(null);
    withdraw.mutate(activityEventId, {
      onSuccess: () => setWithdrawnActivity(activityEventId),
    });
  };

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
        Members choose whether to Share their own logged Activity here.
      </p>
      {withdrawnActivity !== null && (
        <p
          ref={withdrawnNoticeRef}
          tabIndex={-1}
          role="status"
          className="mt-3 rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-white"
        >
          Share removed. Other members can no longer see it.
        </p>
      )}
      {withdraw.isError && (
        <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-800">
          Withdrawing your Share failed. Please try again.
        </p>
      )}
      {feed.isPending && feed.isFetching && <V2LoadingState label="Loading shared Challenge activity…" />}
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
      {feed.isSuccess && items.length > 0 && (
        <div className="mt-4">
          <ChallengeFeedEntries
            challengeId={challengeId}
            items={items}
            onWithdraw={handleWithdraw}
            withdrawing={withdraw.isPending}
          />
        </div>
      )}
      {feed.isSuccess && feed.hasNextPage && (
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
