import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { fetchDiscoverableChallenges, type V2ChallengeDiscovery } from '../../api/challengeDiscoveryApi';
import type { V2DiscoveryRank } from '../../api/groupsApi';
import { v2ChallengeDiscoveryKey } from './challengeQueryKeys';

function apiConfigured(): boolean {
  const base = import.meta.env.VITE_TIIZI_API_BASE_URL as string | undefined;
  return typeof base === 'string' && base.trim().length > 0;
}

/** Cross-Group Challenge discovery; preferences only order it. */
export function useV2ChallengeDiscovery(rank: V2DiscoveryRank = 'relevance') {
  const { user } = useAuth();
  return useQuery<V2ChallengeDiscovery>({
    queryKey: v2ChallengeDiscoveryKey(user?.uid, rank),
    queryFn: () => fetchDiscoverableChallenges(rank),
    enabled: !!user?.uid && apiConfigured(),
    staleTime: 30 * 1000,
  });
}
