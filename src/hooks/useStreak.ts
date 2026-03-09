import { useQuery } from '@tanstack/react-query';
import { streakService } from '../services/streakService';

export function useUserStreak(userId: string | undefined) {
  return useQuery({
    queryKey: ['streak', 'user', userId],
    queryFn: () => (userId ? streakService.calculateUserStreak(userId) : Promise.resolve({ current: 0, longest: 0 })),
    staleTime: 60 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
    enabled: !!userId,
  });
}

export function useChallengeStreak(userId: string | undefined, challengeId: string | undefined) {
  return useQuery({
    queryKey: ['streak', 'challenge', userId, challengeId],
    queryFn: () =>
      userId && challengeId
        ? streakService.calculateChallengeStreak(userId, challengeId)
        : Promise.resolve({ current: 0, longest: 0 }),
    staleTime: 60 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
    enabled: !!userId && !!challengeId,
  });
}
