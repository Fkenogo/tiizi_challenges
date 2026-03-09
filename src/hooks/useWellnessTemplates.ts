import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { wellnessTemplateService, type WellnessCategory, type WellnessDifficulty } from '../services/wellnessTemplateService';
import type { WellnessTemplate } from '../types';

export function useWellnessTemplates(filters?: { category?: WellnessCategory; difficulty?: WellnessDifficulty }) {
  const { user } = useAuth();
  return useQuery<WellnessTemplate[]>({
    queryKey: ['wellness-templates', user?.uid, filters?.category ?? 'all', filters?.difficulty ?? 'all'],
    queryFn: () => wellnessTemplateService.getTemplates(filters),
    enabled: !!user?.uid,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useWellnessTemplate(templateId?: string | null) {
  const { user } = useAuth();
  return useQuery<WellnessTemplate | null>({
    queryKey: ['wellness-template', user?.uid, templateId],
    queryFn: () => wellnessTemplateService.getTemplateById(String(templateId)),
    enabled: !!user?.uid && !!templateId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
