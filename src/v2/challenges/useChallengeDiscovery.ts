import { useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { fetchDiscoverableChallenges } from '../../api/challengeDiscoveryApi';
import type { V2DiscoveryRank } from '../../api/groupsApi';
import { v2ChallengeDiscoveryKey } from './challengeQueryKeys';

function apiConfigured(): boolean {
  const base = import.meta.env.VITE_TIIZI_API_BASE_URL as string | undefined;
  return typeof base === 'string' && base.trim().length > 0;
}

/** Challenges per Load more window (server maximum is 60). */
export const CHALLENGE_DISCOVERY_PAGE_SIZE = 20;

/** Cross-Group Challenge discovery; preferences only order it. Cursor-paged: Load more reaches every eligible Challenge. */
export function useV2ChallengeDiscovery(rank: V2DiscoveryRank = 'relevance') {
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: v2ChallengeDiscoveryKey(user?.uid, rank),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => fetchDiscoverableChallenges({ rank, cursor: pageParam, limit: CHALLENGE_DISCOVERY_PAGE_SIZE }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!user?.uid && apiConfigured(),
    staleTime: 30 * 1000,
  });
}
