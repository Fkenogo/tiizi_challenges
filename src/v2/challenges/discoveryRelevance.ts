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
