/**
 * TIIZI S1 CORR-001 — V2 return-path resolver.
 *
 * After authentication the V2 experience returns the member to the
 * requested V2 route only. Anything that is not a V2 route (V1
 * journeys, foreign origins, absolute URLs, protocol tricks) falls
 * back to the V2 Today entry. There is deliberately no onboarding
 * gate here: S1 returns to the requested V2 route once the session
 * requirement is satisfied.
 */

/** V2 entry used whenever no safe requested route exists. */
export const V2_DEFAULT_NEXT = '/v2/today';

/**
 * Resolve a `next` query value to a safe V2 return path.
 * Accepts `/v2` or `/v2/...` (with optional query/hash); rejects
 * everything else.
 */
export function resolveV2NextPath(raw: string | null | undefined): string {
  if (!raw) return V2_DEFAULT_NEXT;
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return V2_DEFAULT_NEXT;
  }
  if (!/^\/v2(\/[^?#]*)?([?#].*)?$/.test(decoded)) return V2_DEFAULT_NEXT;
  if (/[\\\r\n]/.test(decoded)) return V2_DEFAULT_NEXT;
  if (decoded === '/v2' || decoded === '/v2/') return V2_DEFAULT_NEXT;
  return decoded;
}

/** Preserve the return path when linking between V2 auth screens. */
export function v2NextQuery(next: string): string {
  if (!next || next === V2_DEFAULT_NEXT) return '';
  return `?next=${encodeURIComponent(next)}`;
}
