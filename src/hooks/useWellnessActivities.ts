import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { wellnessActivityService } from '../services/wellnessActivityService';
import type { WellnessActivity, WellnessCategory, WellnessDifficulty } from '../types/wellnessActivity';

export function useWellnessActivities(filters?: {
  category?: WellnessCategory | 'all';
  difficulty?: WellnessDifficulty | 'all';
  search?: string;
}) {
  const { user } = useAuth();
  return useQuery<WellnessActivity[]>({
    queryKey: [
      'wellness-activities',
      user?.uid ?? 'anon',
      filters?.category ?? 'all',
      filters?.difficulty ?? 'all',
      filters?.search ?? '',
    ],
    queryFn: async () => {
      const all = filters?.search
        ? await wellnessActivityService.searchActivities(filters.search)
        : await wellnessActivityService.getAllActivities();
      return all
        .filter((item) => (filters?.category && filters.category !== 'all' ? item.category === filters.category : true))
        .filter((item) => (filters?.difficulty && filters.difficulty !== 'all' ? item.difficulty === filters.difficulty : true));
    },
    enabled: !!user?.uid,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useWellnessActivity(activityId?: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['wellness-activity', user?.uid ?? 'anon', activityId ?? ''],
    queryFn: () => (activityId ? wellnessActivityService.getActivityById(activityId) : Promise.resolve(null)),
    enabled: !!user?.uid && !!activityId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

