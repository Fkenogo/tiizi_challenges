import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminContentService, type AdminBookInput } from '../services/adminContentService';

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
