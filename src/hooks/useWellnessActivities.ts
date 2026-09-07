import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { tiiziKnowledgeAuthorityMode } from '../api/apiClient';
import { fetchKnowledgeById, fetchPublishedKnowledge, mapApiItemToWellnessActivity } from '../api/knowledgeApi';
import { allowsFirestoreFallback, isKnowledgeApiActive } from '../api/knowledgeAuthorityMode';
import { wellnessActivityService } from '../services/wellnessActivityService';
import type { WellnessActivity, WellnessCategory, WellnessDifficulty } from '../types/wellnessActivity';

export function useWellnessActivities(filters?: {
  category?: WellnessCategory | 'all';
  difficulty?: WellnessDifficulty | 'all';
  search?: string;
}) {
  const { user } = useAuth();
  // Phase B authority mode: firestore = legacy paths; transition/postgres =
  // API lists (published-only server-side, ids are Tiizi UUIDs).
  const mode = tiiziKnowledgeAuthorityMode();
  const apiActive = isKnowledgeApiActive(mode);
  return useQuery<WellnessActivity[]>({
    queryKey: [
      'wellness-activities',
      mode,
      user?.uid ?? 'anon',
      filters?.category ?? 'all',
      filters?.difficulty ?? 'all',
      filters?.search ?? '',
    ],
    queryFn: async () => {
      const all = apiActive
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
  const mode = tiiziKnowledgeAuthorityMode();
  const apiActive = isKnowledgeApiActive(mode);
  return useQuery({
    queryKey: ['wellness-activity', mode, user?.uid ?? 'anon', activityId ?? ''],
    queryFn: async () => {
      if (!activityId) return null;
      if (!apiActive) return wellnessActivityService.getActivityById(activityId);
      // API primary. Controlled Firestore fallback ONLY in transition mode.
      // In postgres mode API errors surface — Firestore must never
      // substitute for PG authority.
      try {
        const item = await fetchKnowledgeById(activityId);
        return item.kind === 'wellness' ? mapApiItemToWellnessActivity(item) : null;
      } catch (error) {
        if (!allowsFirestoreFallback(mode)) throw error;
        return wellnessActivityService.getActivityById(activityId);
      }
    },
    enabled: !!user?.uid && !!activityId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

