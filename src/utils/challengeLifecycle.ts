import type { Challenge } from '../types';

/**
 * A challenge is "ongoing" when it has started, not yet ended by date, and
 * its status is not completed/cancelled/expired/draft.
 *
 * This guards against stale Firestore documents where `status === 'active'`
 * but `endDate` is already in the past.
 */
export function isChallengeOngoing(c: Pick<Challenge, 'startDate' | 'endDate' | 'status'>, now = Date.now()): boolean {
  const start = Date.parse(c.startDate ?? '');
  const end = Date.parse(c.endDate ?? '');
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  const inWindow = now >= start && now <= end;
  const notTerminal = c.status !== 'completed' && c.status !== 'expired' && c.status !== 'draft';
  return inWindow && notTerminal;
}

export function isChallengeUpcoming(c: Pick<Challenge, 'startDate' | 'status'>, now = Date.now()): boolean {
  const start = Date.parse(c.startDate ?? '');
  if (Number.isNaN(start)) return false;
  return now < start && c.status !== 'draft';
}

export function isChallengeCompletedOrExpired(c: Pick<Challenge, 'endDate' | 'status'>, now = Date.now()): boolean {
  const end = Date.parse(c.endDate ?? '');
  const pastEndDate = !Number.isNaN(end) && now > end;
  return pastEndDate || c.status === 'completed' || c.status === 'expired';
}
