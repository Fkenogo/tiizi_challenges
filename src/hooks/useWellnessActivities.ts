import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { isTiiziKnowledgeApiEnabled } from '../api/apiClient';
import { fetchKnowledgeById, fetchPublishedKnowledge, mapApiItemToWellnessActivity } from '../api/knowledgeApi';
import { wellnessActivityService } from '../services/wellnessActivityService';
import type { WellnessActivity, WellnessCategory, WellnessDifficulty } from '../types/wellnessActivity';

export function useWellnessActivities(filters?: {
  category?: WellnessCategory | 'all';
  difficulty?: WellnessDifficulty | 'all';
  search?: string;
}) {
  const { user } = useAuth();
  const apiEnabled = isTiiziKnowledgeApiEnabled();
  return useQuery<WellnessActivity[]>({
    queryKey: [
      'wellness-activities',
      apiEnabled ? 'api' : 'firestore',
      user?.uid ?? 'anon',
      filters?.category ?? 'all',
      filters?.difficulty ?? 'all',
      filters?.search ?? '',
    ],
    queryFn: async () => {
      // Phase B: API primary when flagged (published-only server-side, ids
      // are Tiizi UUIDs); legacy Firestore path otherwise.
      const all = apiEnabled
        ? (await fetchPublishedKnowledge('wellness', filters?.search || undefined))
          .map(mapApiItemToWellnessActivity)
        : filters?.search
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
  const apiEnabled = isTiiziKnowledgeApiEnabled();
  return useQuery({
    queryKey: ['wellness-activity', apiEnabled ? 'api' : 'firestore', user?.uid ?? 'anon', activityId ?? ''],
    queryFn: async () => {
      if (!activityId) return null;
      if (!apiEnabled) return wellnessActivityService.getActivityById(activityId);
      // Phase B by-ID: API primary, Firestore fallback for legacy slug ids
      // held by older screens/caches during transition.
      try {
        const item = await fetchKnowledgeById(activityId);
        return item.kind === 'wellness' ? mapApiItemToWellnessActivity(item) : null;
      } catch {
        return wellnessActivityService.getActivityById(activityId);
      }
    },
    enabled: !!user?.uid && !!activityId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

