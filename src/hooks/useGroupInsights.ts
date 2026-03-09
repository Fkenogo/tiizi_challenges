import { useQuery } from '@tanstack/react-query';
import { groupInsightsService } from '../services/groupInsightsService';
import { useAuth } from './useAuth';

export function useGroupFeed(groupId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['group-feed', groupId, user?.uid],
    queryFn: () => (groupId ? groupInsightsService.getGroupFeed(groupId) : Promise.resolve([])),
    enabled: !!groupId && !!user?.uid,
    staleTime: 30 * 1000,
  });
}

export function useGroupMembers(groupId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['group-members', groupId, user?.uid],
    queryFn: () => (groupId ? groupInsightsService.getGroupMembers(groupId) : Promise.resolve([])),
    enabled: !!groupId && !!user?.uid,
    staleTime: 30 * 1000,
  });
}

export function useGroupLeaderboard(groupId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['group-leaderboard', groupId, user?.uid],
    queryFn: () => (groupId ? groupInsightsService.getGroupLeaderboard(groupId) : Promise.resolve([])),
    enabled: !!groupId && !!user?.uid,
    staleTime: 30 * 1000,
  });
}

export function useHighlightedChallenges(groupId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['group-highlighted-challenges', groupId, user?.uid],
    queryFn: () => (groupId ? groupInsightsService.getHighlightedChallenges(groupId) : Promise.resolve([])),
    enabled: !!groupId && !!user?.uid,
    staleTime: 30 * 1000,
  });
}
