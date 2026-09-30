import type { V2ChallengeSummary } from '../../api/v2ChallengeApi';
import { challengeTypeLabel } from './challengeCreationDraft';
import { endStateFor } from './challengeEndState';

export type ChallengeLifecycleFilter = 'all' | 'active' | 'upcoming' | 'completed';
export type ChallengeTypeFilter = 'all' | 'collective' | 'competitive' | 'streak';
export type ChallengeDomainFilter = 'all' | 'fitness' | 'wellness';

export interface ChallengeDiscoveryFilters {
  search: string;
  lifecycle: ChallengeLifecycleFilter;
  type: ChallengeTypeFilter;
  domain: ChallengeDomainFilter;
}

export function lifecycleBucket(challenge: Pick<V2ChallengeSummary, 'status' | 'finalized' | 'governingToday' | 'endDate' | 'startDate'>): Exclude<ChallengeLifecycleFilter, 'all'> {
  if (endStateFor(challenge) !== 'live') return 'completed';
  if (challenge.status === 'establishment' || challenge.governingToday < challenge.startDate) return 'upcoming';
  return 'active';
}

export function filterChallengeDiscovery(
  challenges: V2ChallengeSummary[],
  filters: ChallengeDiscoveryFilters,
): V2ChallengeSummary[] {
  const query = filters.search.trim().toLocaleLowerCase();
  return challenges.filter((challenge) => {
    if (filters.lifecycle !== 'all' && lifecycleBucket(challenge) !== filters.lifecycle) return false;
    if (filters.type !== 'all' && challenge.challengeType !== filters.type) return false;
    if (filters.domain !== 'all' && !challenge.activities.some((activity) => activity.domain === filters.domain)) return false;
    if (!query) return true;
    const searchable = [
      challenge.title,
      challenge.description,
      challenge.groupName ?? '',
      challengeTypeLabel(challenge.challengeType),
      ...challenge.activities.flatMap((activity) => [activity.name, activity.domain, activity.category, activity.subcategory]),
    ].join(' ').toLocaleLowerCase();
    return searchable.includes(query);
  });
}
