import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { wellnessTemplateService, type WellnessCategory, type WellnessDifficulty, type UpdateWellnessTemplateInput } from '../services/wellnessTemplateService';
import type { WellnessTemplate } from '../types';

const QUERY_KEY = 'wellness-templates';
const ADMIN_QUERY_KEY = 'admin-wellness-templates-all';

function invalidateAll(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: [QUERY_KEY] }),
    queryClient.invalidateQueries({ queryKey: [ADMIN_QUERY_KEY] }),
  ]);
}

// User-facing: published only.
export function useWellnessTemplates(filters?: { category?: WellnessCategory; difficulty?: WellnessDifficulty }) {
  const { user } = useAuth();
  return useQuery<WellnessTemplate[]>({
    queryKey: [QUERY_KEY, user?.uid, filters?.category ?? 'all', filters?.difficulty ?? 'all'],
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

// Admin: all non-deleted templates.
export function useAllAdminWellnessTemplates() {
  const { user } = useAuth();
  return useQuery<WellnessTemplate[]>({
    queryKey: [ADMIN_QUERY_KEY, user?.uid],
    queryFn: () => wellnessTemplateService.getAllTemplatesAdmin(),
    enabled: !!user?.uid,
    staleTime: 30 * 1000,
  });
}

export function useCreateWellnessTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof wellnessTemplateService.createTemplate>[0]) =>
      wellnessTemplateService.createTemplate(payload),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useUpdateWellnessTemplate() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({ templateId, payload }: { templateId: string; payload: UpdateWellnessTemplateInput }) =>
      wellnessTemplateService.updateTemplate(templateId, user?.uid ?? '', payload),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function usePublishWellnessTemplate() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (templateId: string) =>
      wellnessTemplateService.publishTemplate(templateId, user?.uid ?? ''),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useUnpublishWellnessTemplate() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (templateId: string) =>
      wellnessTemplateService.unpublishTemplate(templateId, user?.uid ?? ''),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useArchiveWellnessTemplate() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (templateId: string) =>
      wellnessTemplateService.archiveTemplate(templateId, user?.uid ?? ''),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useRestoreWellnessTemplate() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (templateId: string) =>
      wellnessTemplateService.restoreTemplate(templateId, user?.uid ?? ''),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useDeleteWellnessTemplate() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (templateId: string) =>
      wellnessTemplateService.deleteTemplate(templateId, user?.uid ?? ''),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useDuplicateWellnessTemplate() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (templateId: string) =>
      wellnessTemplateService.duplicateTemplate(templateId, user?.uid ?? ''),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useFeatureWellnessTemplate() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (templateId: string) =>
      wellnessTemplateService.featureTemplate(templateId, user?.uid ?? ''),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useUnfeatureWellnessTemplate() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (templateId: string) =>
      wellnessTemplateService.unfeatureTemplate(templateId, user?.uid ?? ''),
    onSuccess: () => invalidateAll(queryClient),
  });
}
