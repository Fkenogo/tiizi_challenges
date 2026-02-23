import { useQuery } from '@tanstack/react-query';
import { groupInsightsService } from '../services/groupInsightsService';

export function useGroupFeed(groupId: string | undefined) {
  return useQuery({
    queryKey: ['group-feed', groupId],
    queryFn: () => (groupId ? groupInsightsService.getGroupFeed(groupId) : Promise.resolve([])),
    enabled: !!groupId,
    staleTime: 30 * 1000,
  });
}

export function useGroupMembers(groupId: string | undefined) {
  return useQuery({
    queryKey: ['group-members', groupId],
    queryFn: () => (groupId ? groupInsightsService.getGroupMembers(groupId) : Promise.resolve([])),
    enabled: !!groupId,
    staleTime: 30 * 1000,
  });
}

export function useGroupLeaderboard(groupId: string | undefined) {
  return useQuery({
    queryKey: ['group-leaderboard', groupId],
    queryFn: () => (groupId ? groupInsightsService.getGroupLeaderboard(groupId) : Promise.resolve([])),
    enabled: !!groupId,
    staleTime: 30 * 1000,
  });
}

export function useHighlightedChallenges(groupId: string | undefined) {
  return useQuery({
    queryKey: ['group-highlighted-challenges', groupId],
    queryFn: () => (groupId ? groupInsightsService.getHighlightedChallenges(groupId) : Promise.resolve([])),
    enabled: !!groupId,
    staleTime: 30 * 1000,
  });
}

