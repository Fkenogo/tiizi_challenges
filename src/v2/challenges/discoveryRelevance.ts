/**
 * TIIZI-FER-P2-001 — pure presentation helpers for preference-ranked
 * discovery. The server decides the order; these only describe it honestly:
 * a "matched to you" claim is made ONLY when ranking was applied AND at least
 * one listed item actually matched.
 */
export interface DiscoveryRelevance { interests: string[]; goals: string[]; domains?: string[] }

export type DiscoveryOrdering = 'relevance' | 'general';

export function hasRelevance(relevance: DiscoveryRelevance | undefined): boolean {
  return !!relevance && (relevance.interests.length > 0 || relevance.goals.length > 0 || (relevance.domains?.length ?? 0) > 0);
}

export type DiscoveryCaption =
  | { kind: 'matched'; text: string }
  | { kind: 'unmatched'; text: string }
  | { kind: 'no-preferences'; text: string }
  | { kind: 'general'; text: string };

/**
 * `applied` is the server's `ranking.applied`. Never claims relevance unless
 * something matched.
 */
export function discoveryCaption(
  ordering: DiscoveryOrdering,
  applied: boolean | undefined,
  items: Array<{ relevance?: DiscoveryRelevance }>,
  noun: 'Groups' | 'Challenges',
): DiscoveryCaption {
  if (ordering === 'general') {
    return { kind: 'general', text: `Showing all ${noun} in the default order.` };
  }
  if (!applied) {
    return { kind: 'no-preferences', text: `Showing all ${noun} in the default order. Choose your interests and goals to see the most relevant ${noun} first.` };
  }
  if (items.some((item) => hasRelevance(item.relevance))) {
    return { kind: 'matched', text: `Ordered by your interests and goals. Every ${noun.slice(0, -1)} is still shown.` };
  }
  return { kind: 'unmatched', text: `None of these ${noun} match your interests or goals yet, so they are in the default order.` };
}

/** Short, label-only badge text, e.g. "Your interests: Strength · Your goals: Build strength". */
export function relevanceBadges(relevance: DiscoveryRelevance | undefined): string[] {
  if (!relevance) return [];
  const badges: string[] = [];
  if (relevance.interests.length > 0) badges.push(`Your interests: ${relevance.interests.join(' · ')}`);
  if (relevance.goals.length > 0) badges.push(`Your goals: ${relevance.goals.join(' · ')}`);
  if ((relevance.domains?.length ?? 0) > 0 && badges.length === 0) {
    badges.push(`Matches your ${relevance.domains!.map((d) => (d === 'wellness' ? 'Wellness' : 'Fitness')).join(' & ')} interests`);
  }
  return badges;
}

export type DiscoveryRelationship = 'steward' | 'member' | 'pending' | 'none';

/**
 * The member's relationship to the hosting Group for one row.
 *
 * The server read is the authority. A join mutation's own response is shown
 * ONLY until a discovery read newer than that submission has landed; after
 * that, fresh server state (e.g. a steward rejected the request → 'none')
 * always supersedes it, so the member can ask again.
 */
export function effectiveRelationship(
  server: DiscoveryRelationship,
  mutation: { status: string; submittedAt: number; resultStatus?: string } | null,
  discoveryUpdatedAt: number,
): DiscoveryRelationship {
  if (!mutation || mutation.status !== 'success') return server;
  if (discoveryUpdatedAt >= mutation.submittedAt) return server;
  return mutation.resultStatus === 'pending' ? 'pending' : 'member';
}

/**
 * When did a discovery read last REFRESH what the member's rows say?
 *
 * `dataUpdatedAt` of a cursor-paged query also moves when Load more appends a
 * page, but appending never re-reads an earlier row's relationship. Treating it
 * as a refresh would let a failed post-join refetch be "papered over" by Load
 * more, reverting a pending row to an actionable Join. Feed this every render;
 * an update that arrives after a next-page fetch was in flight is an append and
 * does not advance the refresh time. Idempotent per input.
 */
export function createRefreshTracker() {
  let lastUpdatedAt = 0;
  let sawNextPage = false;
  let refreshedAt = 0;
  return {
    observe(dataUpdatedAt: number, isFetchingNextPage: boolean): number {
      if (isFetchingNextPage) sawNextPage = true;
      if (dataUpdatedAt !== lastUpdatedAt) {
        if (!sawNextPage) refreshedAt = dataUpdatedAt;
        sawNextPage = false;
        lastUpdatedAt = dataUpdatedAt;
      }
      return refreshedAt;
    },
  };
}

/** Flatten cursor pages, keeping the first occurrence of any id (defensive; the server never repeats one). */
export function flattenDiscoveryPages<T extends { challengeId: string }>(pages: Array<{ challenges: T[] }> | undefined): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const page of pages ?? []) {
    for (const item of page.challenges) {
      if (seen.has(item.challengeId)) continue;
      seen.add(item.challengeId);
      out.push(item);
    }
  }
  return out;
}

/** Honest note about the returned window; empty when everything reachable is already shown. */
export function discoveryWindowNote(count: number, hasMore: boolean, noun: 'Groups' | 'Challenges'): string | null {
  if (!hasMore) return null;
  return `Showing the first ${count} ${noun}. Load more to see the rest.`;
}
