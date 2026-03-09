import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminGroupService, type AdminGroupStatus } from '../services/adminGroupService';

export function useAdminGroups() {
  return useQuery({
    queryKey: ['admin-groups'],
    queryFn: () => adminGroupService.getGroups(),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useAdminGroup(id: string | undefined) {
  return useQuery({
    queryKey: ['admin-group', id],
    queryFn: () => (id ? adminGroupService.getGroupDetail(id) : Promise.resolve(null)),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useSetAdminGroupStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, status, adminUid }: { groupId: string; status: AdminGroupStatus; adminUid: string }) =>
      adminGroupService.setGroupModerationStatus(groupId, status, adminUid),
    onSuccess: async (_data, vars) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-groups'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-group', vars.groupId] }),
        queryClient.invalidateQueries({ queryKey: ['groups'] }),
      ]);
    },
  });
}

export function useSetAdminGroupFeatured() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, isFeatured, adminUid }: { groupId: string; isFeatured: boolean; adminUid: string }) =>
      adminGroupService.setGroupFeatured(groupId, isFeatured, adminUid),
    onSuccess: async (_data, vars) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-groups'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-group', vars.groupId] }),
        queryClient.invalidateQueries({ queryKey: ['groups'] }),
      ]);
    },
  });
}

export function useGroupModerationQueue() {
  return useQuery({
    queryKey: ['admin-group-moderation-queue'],
    queryFn: () => adminGroupService.getModerationQueue(),
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useSetGroupModerationQueueStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reportId, status, adminUid }: { reportId: string; status: 'open' | 'reviewed' | 'resolved'; adminUid: string }) =>
      adminGroupService.setModerationQueueStatus(reportId, status, adminUid),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-group-moderation-queue'] });
    },
  });
}

export function useSuspendAdminGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, adminUid }: { groupId: string; adminUid: string }) =>
      adminGroupService.suspendGroup(groupId, adminUid),
    onSuccess: async (_data, vars) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-groups'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-group', vars.groupId] }),
        queryClient.invalidateQueries({ queryKey: ['admin-group-moderation-queue'] }),
        queryClient.invalidateQueries({ queryKey: ['groups'] }),
      ]);
    },
  });
}

export function useActivateAdminGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, adminUid }: { groupId: string; adminUid: string }) =>
      adminGroupService.activateGroup(groupId, adminUid),
    onSuccess: async (_data, vars) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-groups'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-group', vars.groupId] }),
        queryClient.invalidateQueries({ queryKey: ['admin-group-moderation-queue'] }),
        queryClient.invalidateQueries({ queryKey: ['groups'] }),
      ]);
    },
  });
}

export function useSuspendGroupMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, userId, adminUid }: { groupId: string; userId: string; adminUid: string }) =>
      adminGroupService.suspendMemberInGroup(groupId, userId, adminUid),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-groups'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-group-moderation-queue'] }),
        queryClient.invalidateQueries({ queryKey: ['group-members'] }),
      ]);
    },
  });
}
