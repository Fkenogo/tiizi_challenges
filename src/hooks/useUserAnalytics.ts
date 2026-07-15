import { useQuery, useQueryClient } from '@tanstack/react-query';
import { userAnalyticsService } from '../services/userAnalyticsService';
import { useAuth } from './useAuth';

export const USER_ANALYTICS_QUERY_KEY = (userId: string) => ['user-analytics', userId] as const;

export function useUserAnalytics() {
  const { user } = useAuth();
  return useQuery({
    queryKey: USER_ANALYTICS_QUERY_KEY(user?.uid ?? ''),
    queryFn: () => userAnalyticsService.getUserAnalytics(user!.uid),
    enabled: !!user?.uid,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useInvalidateUserAnalytics() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return () => {
    if (user?.uid) {
      queryClient.invalidateQueries({ queryKey: USER_ANALYTICS_QUERY_KEY(user.uid) });
    }
  };
}
