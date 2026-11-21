import { useEffect, useRef } from 'react';
import type { V2ActivityResult } from '../../api/v2ChallengeApi';
import type {
  MemberRecentActivityItem,
  MemberRecentActivityRevisionState,
} from '../../api/memberRecentActivityApi';
import { V2Button } from './V2Primitives';

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

/**
 * Shared immediate and share-later destination selector. In the immediate
 * post-log mode the destinations are shown directly after Done (Founder
 * direction: sharing options appear immediately after logging, with Keep
 * private as the default continuation). No destination has an authorized,
 * implemented Activity publication contract yet, so this UI reports that
 * boundary and never simulates a share.
 */
export function V2ActivityShareChoices(props: V2ActivityShareChoicesProps) {
  const { source } = props;
  // The post-log transition replaces the focused Done button while the
  // sheet stays open; the sheet's own initial-focus effect does not re-run,
  // so this panel takes focus itself when it mounts.
  const panelRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    panelRef.current?.focus({ preventScroll: true });
  }, []);
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
      <p className="mt-1 text-sm leading-6 text-slate-700">
        This Activity remains private. No sharing destination is connected in this preview, so nothing will be published.
      </p>
      <div className="mt-3 space-y-2">
        <div>
          <V2Button variant="secondary" disabled className="min-h-11 w-full">
            Challenge Feed — unavailable
          </V2Button>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Challenge Feed Activity sharing requires a separately authorized publication service.
          </p>
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
          <V2Button onClick={props.onKeepPrivate} className="min-h-11 w-full">
            Keep private and continue
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
