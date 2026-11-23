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

/** How the immediate post-log sheet completed, for the returning screen. */
export interface V2ShareOutcome {
  shared?: boolean;
  withdrawn?: boolean;
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
      /** Post-log context: the originating Challenge the return path opens. */
      challengeTitle: string;
      onKeepPrivate: (outcome?: V2ShareOutcome) => void;
    }
  | {
      source: V2ActivityShareSource;
      mode: 'later';
      onClose: () => void;
    };

function publishErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'source_reversed') return 'This Activity was reversed and cannot be shared.';
    if (error.code === 'source_changed') return 'This Activity changed since you previewed it. Preview the current version and confirm again.';
    if (error.code === 'share_withdrawn') return 'This Share was withdrawn. Confirm again to share it.';
    if (error.code === 'share_state_changed') return 'This Share state changed. Review the current state and confirm again.';
    if (error.code === 'share_suppressed') return 'This Share was removed and cannot be republished.';
    if (error.code === 'feed_expired') return 'This Challenge Feed has expired.';
  }
  return 'Sharing failed. Please try again.';
}

function withdrawErrorMessage(): string {
  return 'Removing your Share failed. Please try again.';
}

function initialsOf(name: string | null): string {
  if (!name) return '?';
  return name.trim().charAt(0).toUpperCase() || '?';
}

const CONFIRMATION_PAUSE_MS = 1400;

/**
 * The compact sharing sheet (Founder direction, 2026-11-22; visual authority
 * docs/ui-reference/log_activity/activity_sharing_modal.html).
 *
 * The real CF-2/S1 publication contract is unchanged: self-only, explicit,
 * preview-bound and withdrawable. The sheet shows exactly what the Feed
 * preview will contain, the single primary Share action, and the Keep-private
 * default. A successful publication shows a brief confirmation and returns
 * to the originating Challenge; a withdrawal closes the sheet with a brief
 * confirmation — never another full choice screen.
 */
export function V2ActivityShareChoices(props: V2ActivityShareChoicesProps) {
  const { source } = props;
  // The post-log transition replaces the focused Done button while the
  // sheet stays open; the sheet's own initial-focus effect does not re-run,
  // so the immediate panel takes focus itself when it mounts. Share-later
  // panels never take focus: remounts must not steal keyboard focus.
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

  const [confirmation, setConfirmation] = useState<null | 'shared' | 'withdrawn'>(null);
  const confirmationRef = useRef<HTMLParagraphElement | null>(null);
  const autoActionRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (confirmation !== null) confirmationRef.current?.focus({ preventScroll: true });
  }, [confirmation]);
  // Cancel a pending auto-return on unmount (never on a confirmation
  // transition, which would clear the just-scheduled timer).
  useEffect(() => () => {
    if (autoActionRef.current) clearTimeout(autoActionRef.current);
  }, []);
  const scheduleAutoAction = (action: () => void) => {
    // A second success can never leave the first timer dangling: clear
    // before reschedule so exactly ONE pending return exists at a time.
    if (autoActionRef.current) clearTimeout(autoActionRef.current);
    autoActionRef.current = setTimeout(action, CONFIRMATION_PAUSE_MS);
  };

  const previewName = displayName ?? 'Your display name';

  const confirmShare = () => {
    setConfirmation(null);
    // A fresh explicit choice, bound to the observed Share generation and
    // to exactly what the preview showed.
    const clientKey = (globalThis.crypto?.randomUUID?.() ?? `choice-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    publish.mutate(
      {
        activityEventId: source.activityId,
        clientKey,
        previewedValue: source.value,
        previewedUnit: source.unit,
        expectedGeneration: state?.shareGeneration ?? 0,
      },
      {
        onSuccess: () => {
          setConfirmation('shared');
          scheduleAutoAction(() => {
            if (props.mode === 'immediate') props.onKeepPrivate({ shared: true });
            else props.onClose();
          });
        },
      },
    );
  };

  const confirmWithdraw = () => {
    setConfirmation(null);
    withdraw.mutate(source.activityId, {
      onSuccess: () => {
        setConfirmation('withdrawn');
        scheduleAutoAction(() => {
          if (props.mode === 'immediate') props.onKeepPrivate({ withdrawn: true });
          else props.onClose();
        });
      },
    });
  };

  const notShareable =
    source.revisionState === 'reversed'
    || hiddenReason === 'reversed'
    || hiddenReason === 'suppressed'
    || hiddenReason === 'expired';

  return (
    <section
      ref={panelRef}
      tabIndex={-1}
      aria-labelledby="activity-share-title"
      className="space-y-4"
    >
      {/* Header: success confirmation and status */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600" aria-hidden="true">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 id="activity-share-title" className="text-base font-extrabold tracking-tight text-slate-900">
              Activity Recorded
            </h3>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                shared
                  ? 'bg-emerald-100 text-emerald-800'
                  : stateKnown
                    ? 'bg-slate-100 text-slate-600'
                    : 'bg-amber-100 text-amber-900'
              }`}
            >
              {shared ? 'Shared' : stateKnown ? 'Private' : 'Checking'}
            </span>
          </div>
          <p className="mt-0.5 text-xs font-semibold text-slate-600">
            {source.activityName} &bull; {source.value} {source.unit}
          </p>
        </div>
      </div>

      {/* Compact Feed preview */}
      <div className="space-y-2.5 rounded-2xl border border-slate-200/80 bg-slate-50 p-3.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Challenge Feed preview
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
              shared || confirmation === 'shared'
                ? 'bg-emerald-100 text-emerald-800'
                : stateKnown
                  ? 'bg-amber-100 text-amber-900'
                  : 'bg-slate-100 text-slate-500'
            }`}
          >
            {shared || confirmation === 'shared'
              ? 'Shared to Feed'
              : stateKnown ? 'Not shared yet' : 'Checking your Share…'}
          </span>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white"
            aria-hidden="true"
          >
            {initialsOf(displayName)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-slate-900">{previewName}</p>
            <p className="truncate text-xs text-slate-500">
              {source.activityName} &bull; {source.value} {source.unit}
            </p>
          </div>
        </div>
      </div>

      {/* Brief completion confirmation */}
      {confirmation === 'shared' && (
        <p
          ref={confirmationRef}
          tabIndex={-1}
          role="status"
          className="rounded-xl bg-emerald-600 p-3 text-center text-xs font-bold text-white"
        >
          Shared to Challenge Feed!{props.mode === 'immediate' ? ' Returning to details…' : ''}
        </p>
      )}
      {confirmation === 'withdrawn' && (
        <p
          ref={confirmationRef}
          tabIndex={-1}
          role="status"
          className="rounded-xl bg-slate-900 p-3 text-center text-xs font-bold text-white"
        >
          Share removed!{props.mode === 'immediate' ? ' Returning to details…' : ''}
        </p>
      )}

      {mutationPending && !confirmation && (
        <p role="status" className="rounded-xl bg-slate-100 p-2.5 text-center text-xs font-bold text-slate-600">
          {publish.isPending ? 'Sharing…' : 'Removing…'}
        </p>
      )}
      {publishError && !confirmation && (
        <p role="alert" className="rounded-xl bg-red-50 p-2.5 text-center text-xs font-bold text-red-800">
          {publishErrorMessage(publishError)}
        </p>
      )}
      {withdrawError && !confirmation && (
        <p role="alert" className="rounded-xl bg-red-50 p-2.5 text-center text-xs font-bold text-red-800">
          {withdrawErrorMessage()}
        </p>
      )}
      {shareState.isError && (
        <p role="alert" className="rounded-xl bg-red-50 p-2.5 text-center text-xs font-bold text-red-800">
          Couldn&apos;t confirm your Share state.{' '}
          <button type="button" onClick={() => void shareState.refetch()} className="underline">
            Retry
          </button>
        </p>
      )}

      {/* Action stack: an unconfirmed or failed state read never offers a
      Share action — the server state must be known before any choice. A
      showing confirmation renders no further actions until it completes. */}
      {shareState.isError || confirmation !== null ? null : (
      <div className="space-y-2.5 pt-1">
        {!stateKnown ? (
          <>
            <p role="status" className="rounded-xl bg-slate-100 p-3 text-center text-xs font-bold text-slate-500">
              Checking your current Share…
            </p>
            {props.mode === 'immediate' ? (
              <V2Button variant="secondary" onClick={() => props.onKeepPrivate()} className="min-h-11 w-full">
                Continue without sharing
              </V2Button>
            ) : (
              <V2Button variant="secondary" onClick={props.onClose} className="min-h-11 w-full">
                Close
              </V2Button>
            )}
          </>
        ) : notShareable ? (
          <>
            <p className="rounded-xl bg-slate-100 p-3 text-center text-xs font-bold text-slate-600">
              {source.revisionState === 'reversed' || hiddenReason === 'reversed'
                ? 'This Activity was reversed and cannot be shared.'
                : hiddenReason === 'suppressed'
                  ? 'This Share was removed and cannot be republished.'
                  : 'This Challenge Feed has expired.'}
            </p>
            {props.mode === 'immediate' ? (
              <V2Button variant="secondary" onClick={() => props.onKeepPrivate()} className="min-h-11 w-full">
                Continue to {props.challengeTitle}
              </V2Button>
            ) : (
              <V2Button variant="secondary" onClick={props.onClose} className="min-h-11 w-full">
                Close
              </V2Button>
            )}
          </>
        ) : shared ? (
          <>
            <V2Button variant="secondary" onClick={confirmWithdraw} disabled={mutationPending} className="min-h-11 w-full">
              {withdraw.isPending ? 'Removing…' : 'Withdraw Share'}
            </V2Button>
            {props.mode === 'immediate' ? (
              <V2Button variant="ghost" onClick={() => props.onKeepPrivate()} disabled={mutationPending} className="min-h-11 w-full">
                Continue to {props.challengeTitle}
              </V2Button>
            ) : (
              <V2Button variant="ghost" onClick={props.onClose} className="min-h-11 w-full">
                Close
              </V2Button>
            )}
          </>
        ) : (
          <>
            <V2Button onClick={confirmShare} disabled={mutationPending} className="min-h-11 w-full">
              {publish.isPending ? 'Sharing…' : 'Share to Challenge Feed'}
            </V2Button>
            {props.mode === 'immediate' ? (
              <V2Button variant="secondary" onClick={() => props.onKeepPrivate()} disabled={mutationPending} className="min-h-11 w-full">
                Keep private and continue
              </V2Button>
            ) : (
              <V2Button variant="secondary" onClick={props.onClose} disabled={mutationPending} className="min-h-11 w-full">
                Close sharing options
              </V2Button>
            )}
          </>
        )}
      </div>
      )}
    </section>
  );
}
