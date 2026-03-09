import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationService } from '../services/notificationService';
import { useAuth } from './useAuth';

export function useNotifications(uid: string | undefined) {
  return useQuery({
    queryKey: ['notifications', uid],
    queryFn: () => (uid ? notificationService.getUserNotifications(uid) : Promise.resolve([])),
    enabled: !!uid,
    staleTime: 30 * 1000,
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async () => {
      if (!user?.uid) throw new Error('Sign in required');
      return notificationService.markAllRead(user.uid);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.uid] });
    },
  });
}

export function useCreateChallengeReminder() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { challengeId: string; challengeName: string; startDate: string; groupId?: string }) => {
      if (!user?.uid) throw new Error('Sign in required');
      return notificationService.addChallengeReminder({ uid: user.uid, ...input });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.uid] });
    },
  });
}
