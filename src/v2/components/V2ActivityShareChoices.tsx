import { useEffect, useRef, useState } from 'react';
import type { V2ActivityResult } from '../../api/v2ChallengeApi';
import type {
  MemberRecentActivityItem,
  MemberRecentActivityRevisionState,
} from '../../api/memberRecentActivityApi';
import { ApiError } from '../../api/apiClient';
import { V2Button } from './V2Primitives';
import { useV2MemberIdentity } from '../profile/useV2MemberIdentity';
import {
  useV2ActivityShareState,
  useV2PublishActivityShare,
  useV2WithdrawActivityShare,
} from '../challenges/challengeFeedQuery';

export interface V2ActivityShareSource {
  /** Stable event identity shared with the owner's Personal Activity History. */
  activityId: string;
  /** Retained for a future authorized publication contract; never caller-selected authority. */
  challengeId: string;
  activityName: string;
  value: number;
  unit: string;
  revisionState: MemberRecentActivityRevisionState;
}

/** The accepted event ID, not the database record ID, is the history identity. */
export function shareSourceFromAcceptedActivity(
  result: Pick<V2ActivityResult, 'eventId' | 'challengeId' | 'value' | 'unit'>,
  activityName: string,
): V2ActivityShareSource {
  return {
    activityId: result.eventId,
    challengeId: result.challengeId,
    activityName,
    value: result.value,
    unit: result.unit,
    revisionState: 'current',
  };
}

/** Reuses the exact original accepted event identity and its effective history state. */
export function shareSourceFromHistoryItem(item: MemberRecentActivityItem): V2ActivityShareSource {
  return {
    activityId: item.activityId,
    challengeId: item.challenge.id,
    activityName: item.activityName,
    value: item.value,
    unit: item.unit,
    revisionState: item.revisionState,
  };
}

type V2ActivityShareChoicesProps =
  | {
      source: V2ActivityShareSource;
      mode: 'immediate';
      /** Post-log context: the originating Challenge the Keep-private path returns to. */
      challengeTitle: string;
      onKeepPrivate: () => void;
    }
  | {
      source: V2ActivityShareSource;
      mode: 'later';
      onClose: () => void;
    };

function publishErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'source_reversed') {
      return 'This Activity was reversed and cannot be shared.';
    }
    if (error.code === 'source_changed') {
      return 'This Activity changed since you previewed it. Preview the current version and confirm again.';
    }
    if (error.code === 'share_withdrawn') {
      return 'This Share was withdrawn. Confirm again to share it.';
    }
    if (error.code === 'share_state_changed') {
      return 'This Share state changed. Review the current state and confirm again.';
    }
    if (error.code === 'share_suppressed') {
      return 'This Share was removed and cannot be republished.';
    }
    if (error.code === 'feed_expired') {
      return 'This Challenge Feed has expired.';
    }
  }
  return 'Sharing to the Challenge Feed failed. Please try again.';
}

function withdrawErrorMessage(): string {
  return 'Withdrawing your Share failed. Please try again.';
}

/**
 * Shared immediate and share-later destination selector.
 *
 * CF-01 v0.2 §6.1 (Founder-authorized CF-2/S1): the Challenge Feed is a
 * FUNCTIONAL destination. Publication is an explicit, previewed, self-only,
 * withdrawable member action keyed to a fresh choice; only the S1 allow-list
 * is published (display name, Activity name, own accepted value, unit — the
 * Challenge title is preview-only and never published). Publication never
 * modifies Activity evidence or Challenge progress. The current Share state
 * comes from the server's exact owner read — an outage is never presented
 * as "not shared", and the Keep-private path is disabled while a Share
 * choice is in flight so a completed publication can never be described as
 * private.
 *
 * External sharing remains honestly unavailable; Group Feed is not a
 * destination for individual Activity.
 */
export function V2ActivityShareChoices(props: V2ActivityShareChoicesProps) {
  const { source } = props;
  // The post-log transition replaces the focused Done button while the
  // sheet stays open; the sheet's own initial-focus effect does not re-run,
  // so the immediate panel takes focus itself when it mounts. Share-later
  // panels never take focus: Challenge Details unmounts and remounts them
  // during background refreshes, and a remount must not pull keyboard
  // focus away from whatever unrelated control the member is using.
  const panelRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (props.mode !== 'immediate') return;
    panelRef.current?.focus({ preventScroll: true });
  }, []);

  const { displayName } = useV2MemberIdentity();
  const shareState = useV2ActivityShareState(source.challengeId, source.activityId);
  const publish = useV2PublishActivityShare(source.challengeId);
  const withdraw = useV2WithdrawActivityShare(source.challengeId);

  const stateKnown = shareState.isSuccess;
  const state = stateKnown ? shareState.data : null;
  const shared = state !== null && state.visible;
  const hiddenReason = state !== null && !state.visible ? state.hiddenReason : null;
  const mutationPending = publish.isPending || withdraw.isPending;
  const publishError = publish.error;
  const withdrawError = withdraw.error;

  // A withdrawal inside this panel removes the focused control; the outcome
  // is announced and takes focus so keyboard flow continues from the panel.
  const [withdrawnNotice, setWithdrawnNotice] = useState<string | null>(null);
  const withdrawnNoticeRef = useRef<HTMLParagraphElement | null>(null);
  useEffect(() => {
    if (withdrawnNotice !== null) withdrawnNoticeRef.current?.focus({ preventScroll: true });
  }, [withdrawnNotice]);

  const confirmShare = () => {
    setWithdrawnNotice(null);
    // A fresh explicit choice, bound to the observed Share generation and
    // to exactly what the preview showed: the request key makes retries
    // converge, expectedGeneration blocks stale replays across withdrawals
    // even after key pruning, and previewed value/unit prevent mismatch.
    const clientKey = (globalThis.crypto?.randomUUID?.() ?? `choice-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    publish.mutate({
      activityEventId: source.activityId,
      clientKey,
      previewedValue: source.value,
      previewedUnit: source.unit,
      expectedGeneration: state?.shareGeneration ?? 0,
    });
  };

  return (
    <section
      ref={panelRef}
      tabIndex={-1}
      aria-labelledby="activity-share-choices-title"
      className="mt-3 rounded-2xl border border-violet-200 bg-violet-50 p-4"
    >
      <p className="text-xs font-black uppercase tracking-wide text-violet-800">Private by default</p>
      <h3 id="activity-share-choices-title" className="mt-1 text-base font-black text-slate-900">
        Sharing destinations
      </h3>
      <p className="mt-1 break-words text-sm font-semibold text-slate-800">
        {source.activityName} · {source.value} {source.unit}
      </p>
      {props.mode === 'immediate' && (
        <p className="mt-1 text-sm leading-6 text-slate-700">
          Your Activity has been recorded. Keeping it private will return you to {props.challengeTitle} Details with refreshed progress.
        </p>
      )}
      {source.revisionState === 'updated' && (
        <p className="mt-1 text-sm text-amber-900">Updated Activity — showing the current effective value.</p>
      )}
      {source.revisionState === 'reversed' && (
        <p className="mt-1 text-sm text-slate-700">Reversed Activity — kept in your history, not active toward progress.</p>
      )}

      <div className="mt-3 space-y-2">
        <div className="rounded-xl border border-violet-200 bg-white p-3">
          <p className="text-sm font-black text-slate-900">Challenge Feed</p>
          {withdrawnNotice !== null && !shared && (
            <p
              ref={withdrawnNoticeRef}
              tabIndex={-1}
              role="status"
              className="mt-1 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800"
            >
              Your Share is withdrawn. Other members can no longer see it.
            </p>
          )}
          {!stateKnown && !shareState.isError ? (
            <p className="mt-1 text-sm text-slate-600" role="status">Checking your current Share…</p>
          ) : shareState.isError ? (
            <div>
              <p className="mt-1 text-sm text-slate-600">
                We couldn&apos;t confirm whether this Activity is shared. Sharing stays blocked until the state is known.
              </p>
              <V2Button
                variant="secondary"
                onClick={() => void shareState.refetch()}
                className="mt-2 min-h-11"
              >
                Retry
              </V2Button>
            </div>
          ) : hiddenReason === 'reversed' ? (
            <p className="mt-1 text-sm text-slate-700">
              This Activity was reversed and cannot be shared.
            </p>
          ) : hiddenReason === 'suppressed' ? (
            <p className="mt-1 text-sm text-slate-700">
              This Share was removed and cannot be republished.
            </p>
          ) : hiddenReason === 'expired' ? (
            <p className="mt-1 text-sm text-slate-700">
              This Challenge Feed has expired.
            </p>
          ) : source.revisionState === 'reversed' ? (
            <p className="mt-1 text-sm text-slate-700">
              This Activity was reversed and cannot be shared.
            </p>
          ) : shared ? (
            <div>
              <p className="mt-1 text-sm text-emerald-800" role="status">
                Shared with the Challenge Feed.
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Withdrawing hides it from other members. Your Activity stays in your private history and nothing about your progress changes.
              </p>
              <V2Button
                variant="secondary"
                onClick={() => {
                  setWithdrawnNotice(null);
                  withdraw.mutate(source.activityId, {
                    onSuccess: () => setWithdrawnNotice(source.activityId),
                  });
                }}
                disabled={mutationPending}
                className="mt-2 min-h-11"
              >
                {withdraw.isPending ? 'Withdrawing…' : 'Withdraw Share'}
              </V2Button>
              {withdrawError && (
                <p role="alert" className="mt-2 text-sm font-medium text-red-800">
                  {withdrawErrorMessage()}
                </p>
              )}
            </div>
          ) : (
            <div>
              <p className="mt-1 text-sm font-bold text-slate-800">Preview — not shared yet</p>
              <p className="mt-1 break-words text-sm leading-6 text-slate-700">
                Other members of this Challenge would see:{' '}
                <strong>{displayName ?? 'Your display name'}</strong> · {source.activityName} ·{' '}
                {source.value} {source.unit}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Only your display name, the Activity name and your own accepted value and unit are published. The Challenge title is not published.
              </p>
              <V2Button
                variant="secondary"
                onClick={confirmShare}
                disabled={mutationPending}
                className="mt-2 min-h-11"
              >
                {publish.isPending ? 'Sharing…' : 'Share to Challenge Feed'}
              </V2Button>
              {publishError && (
                <p role="alert" className="mt-2 text-sm font-medium text-red-800">
                  {publishErrorMessage(publishError)}
                </p>
              )}
            </div>
          )}
        </div>
        <div>
          <V2Button variant="secondary" disabled className="min-h-11 w-full">
            External sharing — unavailable
          </V2Button>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            External sharing is not available; no public link or external post is created.
          </p>
        </div>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-600">
        Group Feed is not a destination for individual Activity. Viewing these options creates no Activity and does not change Challenge progress.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {props.mode === 'immediate' ? (
          <V2Button
            onClick={props.onKeepPrivate}
            disabled={mutationPending}
            className="min-h-11 w-full"
          >
            {mutationPending
              ? 'Completing your choice…'
              : shared
                ? `Continue to ${props.challengeTitle}`
                : 'Keep private and continue'}
          </V2Button>
        ) : (
          <V2Button
            variant="secondary"
            onClick={props.onClose}
            className="min-h-11"
          >
            Close sharing options
          </V2Button>
        )}
      </div>
    </section>
  );
}
