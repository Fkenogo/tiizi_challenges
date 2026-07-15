import { useQuery } from '@tanstack/react-query';
import { memberMetricsService } from '../services/memberMetricsService';

export function useUserMetrics(userId: string | undefined) {
  return useQuery({
    queryKey: ['user-metrics', userId],
    queryFn: () => (userId ? memberMetricsService.getUserMetrics(userId) : Promise.resolve(null)),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: (failureCount) => failureCount < 2,
  });
}

export function useMemberHome(userId: string | undefined) {
  return useQuery({
    queryKey: ['member-home', userId],
    queryFn: () => (userId ? memberMetricsService.getMemberHome(userId) : Promise.resolve(null)),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: (failureCount) => failureCount < 2,
  });
}
