import type { Challenge } from '../types';

const ACTIVE_STATUS = 'active';
const EXCLUDED_DISCOVERY_STATUSES = new Set(['completed', 'archived', 'cancelled', 'canceled', 'expired', 'suspended']);

function isDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function parseChallengeStartMs(value: unknown): number | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Date.parse(isDateOnly(value) ? `${value}T00:00:00.000` : value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function parseChallengeEndMs(value: unknown): number | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Date.parse(isDateOnly(value) ? `${value}T23:59:59.999` : value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function isChallengeExpired(challenge: Pick<Challenge, 'endDate'>, nowMs = Date.now()): boolean {
  const endMs = parseChallengeEndMs(challenge.endDate);
  return endMs !== null && nowMs > endMs;
}

export function isChallengeOngoing(challenge: Pick<Challenge, 'status' | 'startDate' | 'endDate'>, nowMs = Date.now()): boolean {
  const status = String(challenge.status ?? '').toLowerCase();
  if (status !== ACTIVE_STATUS || EXCLUDED_DISCOVERY_STATUSES.has(status)) return false;

  const startMs = parseChallengeStartMs(challenge.startDate);
  if (startMs !== null && nowMs < startMs) return false;

  return !isChallengeExpired(challenge, nowMs);
}

export function isDiscoverableTrendingChallenge(
  challenge: Pick<Challenge, 'status' | 'startDate' | 'endDate' | 'visibility' | 'groupVisibility'>,
  nowMs = Date.now(),
): boolean {
  if (!isChallengeOngoing(challenge, nowMs)) return false;
  return challenge.visibility === 'public' || challenge.groupVisibility === 'public';
}
