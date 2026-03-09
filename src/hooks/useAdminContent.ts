import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  adminContentService,
  type AdminBookInput,
  type ContentPageInput,
  type InterestGoalInput,
  type NotificationTemplateInput,
} from '../services/adminContentService';

export function useInterestsGoals() {
  return useQuery({
    queryKey: ['admin-content-interests-goals'],
    queryFn: () => adminContentService.getInterestsAndGoals(),
    staleTime: 60 * 1000,
  });
}

export function useOnboardingContent() {
  return useQuery({
    queryKey: ['admin-content-onboarding'],
    queryFn: () => adminContentService.getOnboardingContent(),
    staleTime: 60 * 1000,
  });
}

export function useNotificationTemplates() {
  return useQuery({
    queryKey: ['admin-content-notification-templates'],
    queryFn: () => adminContentService.getNotificationTemplates(),
    staleTime: 30 * 1000,
  });
}

export function useUpsertInterestGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ input, actorUid }: { input: InterestGoalInput; actorUid: string }) =>
      adminContentService.upsertInterestGoal(input, actorUid),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-content-interests-goals'] });
    },
  });
}

export function useDeleteInterestGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ type, id }: { type: 'interest' | 'goal'; id: string }) =>
      adminContentService.deleteInterestGoal(type, id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-content-interests-goals'] });
    },
  });
}

export function useUpsertNotificationTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ input, actorUid }: { input: NotificationTemplateInput; actorUid: string }) =>
      adminContentService.upsertNotificationTemplate(input, actorUid),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-content-notification-templates'] });
    },
  });
}

export function usePublishNotificationTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, actorUid }: { id: string; actorUid: string }) =>
      adminContentService.publishNotificationTemplate(id, actorUid),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-content-notification-templates'] });
    },
  });
}

export function useDeleteNotificationTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminContentService.deleteNotificationTemplate(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-content-notification-templates'] });
    },
  });
}

export function useContentPages() {
  return useQuery({
    queryKey: ['admin-content-pages'],
    queryFn: () => adminContentService.getContentPages(),
    staleTime: 30 * 1000,
  });
}

export function useUpsertContentPage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ input, actorUid }: { input: ContentPageInput; actorUid: string }) =>
      adminContentService.upsertContentPage(input, actorUid),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-content-pages'] });
    },
  });
}

export function useDeleteContentPage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminContentService.deleteContentPage(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-content-pages'] });
    },
  });
}

export function useAdminBooks() {
  return useQuery({
    queryKey: ['admin-content-books'],
    queryFn: () => adminContentService.getBooks(),
    staleTime: 30 * 1000,
  });
}

export function useUpsertAdminBook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ input, actorUid }: { input: AdminBookInput; actorUid: string }) =>
      adminContentService.upsertBook(input, actorUid),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-content-books'] }),
        queryClient.invalidateQueries({ queryKey: ['books'] }),
      ]);
    },
  });
}
