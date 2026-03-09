import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dailyGoalsService, type DailyGoalItem } from '../services/dailyGoalsService';
import { useAuth } from './useAuth';

export function useDailyGoals(uid: string | undefined) {
  return useQuery({
    queryKey: ['daily-goals', uid],
    queryFn: () => (uid ? dailyGoalsService.getTodayGoals(uid) : Promise.resolve([])),
    enabled: !!uid,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useSaveDailyGoals() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (items: DailyGoalItem[]) => {
      if (!user?.uid) throw new Error('Sign in required');
      return dailyGoalsService.saveTodayGoals(user.uid, items);
    },
    onSuccess: (items) => {
      queryClient.setQueryData(['daily-goals', user?.uid], items);
      queryClient.invalidateQueries({ queryKey: ['daily-goals-analytics', user?.uid] });
    },
  });
}

export function useDailyGoalsAnalytics(uid: string | undefined) {
  return useQuery({
    queryKey: ['daily-goals-analytics', uid],
    queryFn: () => (uid ? dailyGoalsService.getAnalytics(uid) : Promise.resolve({
      totalDaysTracked: 0,
      totalGoalsPlanned: 0,
      totalGoalsCompleted: 0,
      completionRate: 0,
    })),
    enabled: !!uid,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
