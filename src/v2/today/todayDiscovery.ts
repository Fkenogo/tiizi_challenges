import type { V2DiscoverableChallenge } from '../../api/challengeDiscoveryApi';
import type { V2DiscoverableGroup } from '../../api/groupsApi';
import { endStateFor } from '../challenges/challengeEndState';
import { hasRelevance } from '../challenges/discoveryRelevance';

/** Maximum discoverable items per entity section on Today so Today never becomes a directory. */
export const TODAY_DISCOVERY_LIMIT = 2;

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
