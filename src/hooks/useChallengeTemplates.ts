import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  challengeTemplateService,
  type CreateSuggestedChallengeTemplateInput,
  type SuggestedChallengeTemplate,
  type UpdateTemplateInput,
} from '../services/challengeTemplateService';
import { useAuth } from './useAuth';

const QUERY_KEY = 'suggested-challenge-templates';
const ADMIN_QUERY_KEY = 'admin-challenge-templates-all';

function invalidateAll(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: [QUERY_KEY] }),
    queryClient.invalidateQueries({ queryKey: [ADMIN_QUERY_KEY] }),
    queryClient.invalidateQueries({ queryKey: ['admin-challenge-templates'] }),
  ]);
}

// User-facing: published only
export function useSuggestedChallengeTemplates() {
  const { user } = useAuth();
  return useQuery<SuggestedChallengeTemplate[]>({
    queryKey: [QUERY_KEY, user?.uid],
    queryFn: () => challengeTemplateService.getPublishedTemplates('fitness'),
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

// Admin: all non-deleted templates
export function useAllAdminTemplates() {
  const { user } = useAuth();
  return useQuery<SuggestedChallengeTemplate[]>({
    queryKey: [ADMIN_QUERY_KEY, user?.uid],
    queryFn: () => challengeTemplateService.getAllTemplatesAdmin(),
    enabled: !!user?.uid,
    staleTime: 30 * 1000,
  });
}

export function useCreateSuggestedChallengeTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSuggestedChallengeTemplateInput) =>
      challengeTemplateService.createTemplate(payload),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({ templateId, payload }: { templateId: string; payload: UpdateTemplateInput }) =>
      challengeTemplateService.updateTemplate(templateId, user?.uid ?? '', payload),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function usePublishTemplate() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (templateId: string) =>
      challengeTemplateService.publishTemplate(templateId, user?.uid ?? ''),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useUnpublishTemplate() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (templateId: string) =>
      challengeTemplateService.unpublishTemplate(templateId, user?.uid ?? ''),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useArchiveTemplate() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (templateId: string) =>
      challengeTemplateService.archiveTemplate(templateId, user?.uid ?? ''),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useRestoreTemplate() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (templateId: string) =>
      challengeTemplateService.restoreTemplate(templateId, user?.uid ?? ''),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (templateId: string) =>
      challengeTemplateService.deleteTemplate(templateId, user?.uid ?? ''),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useDuplicateTemplate() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (templateId: string) =>
      challengeTemplateService.duplicateTemplate(templateId, user?.uid ?? ''),
    onSuccess: () => invalidateAll(queryClient),
  });
}

// Alias kept for existing callers in useAdminChallenges
export function useChallengeTemplates() {
  return useSuggestedChallengeTemplates();
}

export function useFeatureTemplate() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (templateId: string) =>
      challengeTemplateService.featureTemplate(templateId, user?.uid ?? ''),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useUnfeatureTemplate() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (templateId: string) =>
      challengeTemplateService.unfeatureTemplate(templateId, user?.uid ?? ''),
    onSuccess: () => invalidateAll(queryClient),
  });
}
