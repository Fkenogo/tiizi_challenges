import type { V2ChallengeDetail } from '../../api/v2ChallengeApi';
import { endStateFor, loggingAvailableForEndState } from '../challenges/challengeEndState';
import { loggingViewFor } from '../challenges/loggingView';

/**
 * TIIZI-FER-P3-CORR-001 — the logging gate Today applies to a FRESH Challenge
 * detail. It is exactly the Challenge page's gate (live end-state AND a
 * loggable view for the member's current participation), so an ended,
 * window-expired, finalized, withdrawn or otherwise ineligible context never
 * opens the form — Today shows a read-only explanation instead.
 */
export function todayLoggingOpen(detail: V2ChallengeDetail): boolean {
  return loggingAvailableForEndState(endStateFor(detail)) && loggingViewFor(detail).kind === 'loggable';
}
