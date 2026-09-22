import type { V2ChallengeDetail } from '../../api/v2ChallengeApi';
import { statusLabel } from './challengeCreationDraft';

/**
 * S3d — Challenge end-state derivation (pure, React-free so it is directly
 * testable — same convention as `participationView.ts` / `loggingView.ts` /
 * `progressView.ts`).
 *
 * The detail page must distinguish honestly between four lifecycle states
 * (TIIZI-S3D-PREIMPLEMENTATION-READINESS-001 §2.4):
 *
 *   'live'          active and inside its window → existing S3c live surfaces;
 *   'ended-pending' ended, OR window-expired-but-unprocessed (status still
 *                   `active` while the server governing day is past endDate)
 *                   → neutral "results are being confirmed", no fabricated
 *                   results and no logging;
 *   'finalized'     ended + frozen terminal truth → sealed S3d results.
 *
 * The window-expired test uses ONLY server-projected values
 * (`governingToday`, `endDate`); it never reads the device clock, mirroring
 * the S3c server-day convention. No results are ever derived here.
 */
export type V2ChallengeEndState = 'live' | 'ended-pending' | 'finalized';

export function endStateFor(detail: V2ChallengeDetail): V2ChallengeEndState {
  if (detail.finalized) return 'finalized';
  if (detail.status === 'ended') return 'ended-pending';
  // Window-expired but not yet processed: `active` under a server day past
  // the pinned end date. Both are YYYY-MM-DD, so string comparison is the
  // governing-day comparison (`isWindowExpired` server-side).
  if (detail.status === 'active' && detail.governingToday > detail.endDate) {
    return 'ended-pending';
  }
  return 'live';
}

/**
 * Logging is a live-only affordance. Ended, ended-pending (window-expired
 * unprocessed) and finalized Challenges never offer logging, even when the
 * server still exposes `status: 'active'` for an unprocessed window.
 */
export function loggingAvailableForEndState(state: V2ChallengeEndState): boolean {
  return state === 'live';
}

/** Hero Leave action is offered only while the Challenge is genuinely live. */
export function participationMutableForEndState(state: V2ChallengeEndState): boolean {
  return state === 'live';
}

/**
 * CORR-002 — participant-facing lifecycle label for the detail metadata line.
 *
 * A window-expired-but-unprocessed Challenge is still served `status: 'active'`
 * (the engine has not processed the ending yet), which previously rendered
 * "Running" next to "Challenge ended / Final results are being confirmed".
 * The label is therefore derived from the already server-governed end state,
 * never the raw status alone and never the device clock: anything the server
 * has effectively ended (ended-pending or finalized) reads as "Finished",
 * consistent with the existing Tiizi vocabulary. No lifecycle status is added
 * to the domain and no status is mutated for presentation.
 */
export function statusLabelForEndState(
  status: string | null | undefined,
  endState: V2ChallengeEndState,
): string {
  if (endState !== 'live') return 'Finished';
  return statusLabel(status);
}
