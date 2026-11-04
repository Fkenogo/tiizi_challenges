import type { V2DiscoverableChallenge } from '../../api/challengeDiscoveryApi';
import type { V2DiscoverableGroup } from '../../api/groupsApi';
import { hasRelevance } from '../challenges/discoveryRelevance';

export function recommendedGroups(groups: V2DiscoverableGroup[]): V2DiscoverableGroup[] {
  const eligible = groups.filter((group) => group.viewerRelationship === 'none' || group.viewerRelationship === 'pending');
  const matched = eligible.filter((group) => hasRelevance(group.relevance));
  return matched.length ? matched : eligible;
}

export function recommendedChallenges(challenges: V2DiscoverableChallenge[]): V2DiscoverableChallenge[] {
  const matched = challenges.filter((challenge) => hasRelevance(challenge.relevance));
  return matched.length ? matched : challenges;
}

export function recommendationReason(relevance: { interests: string[]; goals: string[]; domains?: string[] } | undefined): string | null {
  if (!relevance) return null;
  const reasons = [
    ...relevance.interests.map((item) => `interest: ${item}`),
    ...relevance.goals.map((item) => `goal: ${item}`),
    ...(relevance.domains ?? []).map((item) => `${item === 'wellness' ? 'Wellness' : 'Fitness'} activity`),
  ];
  return reasons.length ? `Suggested because it matches your ${reasons.join(' and ')}.` : null;
}

export function showTodayDiscoveryRecommendations(activeChallengeCount: number): boolean {
  return activeChallengeCount === 0;
}
