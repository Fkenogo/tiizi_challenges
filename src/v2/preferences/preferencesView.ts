/**
 * TIIZI-FER-P1B-001 — pure selection helpers shared by onboarding and Profile.
 * No network, no storage: bounds are enforced here for UX and re-proved by
 * the server (and the database) on every save.
 */
import type { V2InterestOption } from '../../api/preferencesApi';

/** Toggle one ID, never exceeding `max`. Returns the same array when a toggle is refused. */
export function toggleSelection(selected: readonly string[], id: string, max: number): string[] {
  if (selected.includes(id)) return selected.filter((existing) => existing !== id);
  if (selected.length >= max) return [...selected];
  return [...selected, id];
}

export function atLimit(selected: readonly string[], max: number): boolean {
  return selected.length >= max;
}

/** Order-insensitive equality: selection order is not meaningful. */
export function sameSelection(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

export function groupInterestsByDomain(options: readonly V2InterestOption[]): Array<{ domain: string; items: V2InterestOption[] }> {
  const order: string[] = [];
  const byDomain = new Map<string, V2InterestOption[]>();
  for (const option of options) {
    if (!byDomain.has(option.domain)) { byDomain.set(option.domain, []); order.push(option.domain); }
    byDomain.get(option.domain)!.push(option);
  }
  return order.map((domain) => ({ domain, items: byDomain.get(domain)! }));
}

/** Default landing after personalization: discovery, unless the member asked for a specific page. */
export const PREFERENCES_DISCOVERY_PATH = '/v2/groups?tab=discover';
export function afterPreferencesPath(next: string): string {
  return next === '/v2/today' ? PREFERENCES_DISCOVERY_PATH : next;
}

export const PREFERENCES_PATH = '/v2/preferences';
