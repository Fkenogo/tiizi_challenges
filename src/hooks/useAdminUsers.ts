import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminUserService, type AdminUserStatus, type SupportTicketStatus } from '../services/adminUserService';

export function useAdminUsers() {
  return useQuery({
    queryKey: ['admin-users'],
    queryFn: () => adminUserService.getUsers(),
    staleTime: 30 * 1000,
  });
}

export function useAdminUser(uid: string | undefined) {
  return useQuery({
    queryKey: ['admin-user', uid],
    queryFn: () => (uid ? adminUserService.getUserDetail(uid) : Promise.resolve(null)),
    enabled: !!uid,
    staleTime: 30 * 1000,
  });
}

export function useSetAdminUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ uid, status, adminUid }: { uid: string; status: AdminUserStatus; adminUid: string }) =>
      adminUserService.setUserStatus(uid, status, adminUid),
    onSuccess: async (_data, vars) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-user', vars.uid] }),
      ]);
    },
  });
}

export function useAdminUserAnalytics() {
  return useQuery({
    queryKey: ['admin-user-analytics'],
    queryFn: () => adminUserService.getUserAnalytics(),
    staleTime: 30 * 1000,
  });
}

export function useSupportTickets() {
  return useQuery({
    queryKey: ['admin-support-tickets'],
    queryFn: () => adminUserService.getSupportTickets(),
    staleTime: 15 * 1000,
  });
}

export function useSetSupportTicketStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ticketId, status, actorUid }: { ticketId: string; status: SupportTicketStatus; actorUid: string }) =>
      adminUserService.setSupportTicketStatus(ticketId, status, actorUid),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-support-tickets'] });
    },
  });
}
