import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  challengeTemplateService,
  type CreateSuggestedChallengeTemplateInput,
  type SuggestedChallengeTemplate,
} from '../services/challengeTemplateService';
import { useAuth } from './useAuth';

export function useSuggestedChallengeTemplates() {
  const { user } = useAuth();
  return useQuery<SuggestedChallengeTemplate[]>({
    queryKey: ['suggested-challenge-templates', user?.uid],
    queryFn: () => challengeTemplateService.getPublishedTemplates(),
    enabled: !!user?.uid,
    staleTime: 60 * 1000,
  });
}

export function useSuggestedChallengeTemplate(templateId?: string | null) {
  const { user } = useAuth();
  return useQuery<SuggestedChallengeTemplate | null>({
    queryKey: ['suggested-challenge-template', templateId, user?.uid],
    queryFn: () => challengeTemplateService.getTemplateById(String(templateId)),
    enabled: !!templateId && !!user?.uid,
    staleTime: 60 * 1000,
  });
}

export function useCreateSuggestedChallengeTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSuggestedChallengeTemplateInput) =>
      challengeTemplateService.createTemplate(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['suggested-challenge-templates'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-challenge-templates'] }),
      ]);
    },
  });
}

export function useChallengeTemplates() {
  return useSuggestedChallengeTemplates();
}
