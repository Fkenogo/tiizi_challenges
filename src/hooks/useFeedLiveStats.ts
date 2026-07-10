import { useQuery } from '@tanstack/react-query';
import type { GroupActivityFeedSummary } from '../types';
import { feedLiveStatsService, type FeedLiveStats } from '../services/feedLiveStatsService';

export function useFeedLiveStats(items: GroupActivityFeedSummary[]) {
  const key = items.map((i) => i.id).join(',');
  return useQuery<Map<string, FeedLiveStats>>({
    queryKey: ['feed-live-stats', key],
    queryFn: () => feedLiveStatsService.getStatsMap(items),
    enabled: items.length > 0,
    staleTime: 60 * 1000,
  });
}
