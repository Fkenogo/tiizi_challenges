import type { V2DiscoverableChallenge } from '../../api/challengeDiscoveryApi';
import type { V2DiscoverableGroup } from '../../api/groupsApi';
import { endStateFor } from '../challenges/challengeEndState';
import { hasRelevance } from '../challenges/discoveryRelevance';

export function recommendedGroups(groups: V2DiscoverableGroup[]): V2DiscoverableGroup[] {
  const seen = new Set<string>();
  const eligible = groups.filter((group) => {
    if (seen.has(group.id)) return false;
    seen.add(group.id);
    return group.viewerRelationship === 'none' || group.viewerRelationship === 'pending';
  });
  const matched = eligible.filter((group) => hasRelevance(group.relevance));
  return matched.length ? matched : eligible;
}

export function recommendedChallenges(challenges: V2DiscoverableChallenge[]): V2DiscoverableChallenge[] {
  const eligible = challenges.filter((challenge) => (
    (challenge.status === 'active' || challenge.status === 'establishment')
    && challenge.governingToday <= challenge.endDate
    && endStateFor(challenge) === 'live'
  ));
  const matched = eligible.filter((challenge) => hasRelevance(challenge.relevance));
  return matched.length ? matched : eligible;
}

export function showTodayDiscoveryRecommendations(activeChallengeCount: number): boolean {
  return activeChallengeCount === 0;
}

/**
 * TIIZI-V2-UX-008 — one suggestion card, either entity type.
 *
 * The card is presentation only. It never asserts joinability: the Challenge
 * projection reports `joinability: 'not_asserted'`, so a Challenge suggestion
 * offers discovery and defers joining to the governed Group and Challenge
 * surfaces.
 */
export type TodaySuggestion =
  | { kind: 'group'; group: V2DiscoverableGroup }
  | { kind: 'challenge'; challenge: V2DiscoverableChallenge };

/**
 * TIIZI-V2-UX-008 — Groups and Challenges in ONE coherent list.
 *
 * Ranking authority is unchanged: the order WITHIN each entity type is exactly
 * the server's relevance order (see `recommendedGroups` /
 * `recommendedChallenges`). Only the interleaving of the two lists is a
 * presentation decision, so neither type dominates the first viewport. The
 * list is bounded (three of each at most) so Today never becomes a directory.
 */
export function buildSuggestions(
  groups: V2DiscoverableGroup[],
  challenges: V2DiscoverableChallenge[],
  groupLimit = 3,
  challengeLimit = 3,
): TodaySuggestion[] {
  const groupRows = groups.slice(0, groupLimit);
  const challengeRows = challenges.slice(0, challengeLimit);
  const suggestions: TodaySuggestion[] = [];
  const longest = Math.max(groupRows.length, challengeRows.length);
  for (let index = 0; index < longest; index += 1) {
    const challenge = challengeRows[index];
    if (challenge) suggestions.push({ kind: 'challenge', challenge });
    const group = groupRows[index];
    if (group) suggestions.push({ kind: 'group', group });
  }
  return suggestions;
}

export function relevanceOf(suggestion: TodaySuggestion): { interests: string[]; goals: string[]; domains?: string[] } | undefined {
  return suggestion.kind === 'group' ? suggestion.group.relevance : suggestion.challenge.relevance;
}

export type TodaySuggestionCaption =
  | { kind: 'matched'; text: string }
  | { kind: 'unmatched'; text: string }
  | { kind: 'no-preferences'; text: string };

/**
 * One explanation for the whole section. TIIZI-V2-UX-008 removed the
 * per-card matching sentence; the matching basis
 * is stated once here and each card carries only label-level badges.
 */
export function suggestionCaption(
  suggestions: TodaySuggestion[],
  applied: { groups?: boolean; challenges?: boolean },
): TodaySuggestionCaption {
  if (applied.groups === false || applied.challenges === false) {
    return {
      kind: 'no-preferences',
      text: 'Showing all suggestions in the default order. Choose your interests and goals to see the most relevant first.',
    };
  }
  if (suggestions.some((suggestion) => hasRelevance(relevanceOf(suggestion)))) {
    return {
      kind: 'matched',
      text: 'Ordered by your interests and goals. You can browse everything at any time.',
    };
  }
  return {
    kind: 'unmatched',
    text: 'None of these suggestions match your interests or goals yet, so they are in the default order.',
  };
}
