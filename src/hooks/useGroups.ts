import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { groupService, type CreateGroupInput, type ReportGroupInput, type UpdateGroupInput } from '../services/groupService';
import { useAuth } from './useAuth';

export function useGroups() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['groups', user?.uid],
    queryFn: () => groupService.getGroups(),
    enabled: !!user?.uid,
    staleTime: 5 * 60 * 1000,
  });
}

export function useMyGroups() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-groups', user?.uid],
    queryFn: () => (user?.uid ? groupService.getMyGroups(user.uid) : Promise.resolve([])),
    enabled: !!user?.uid,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useGroup(id: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['group', id, user?.uid],
    queryFn: () => (id ? groupService.getGroupById(id) : Promise.resolve(null)),
    enabled: !!id && !!user?.uid,
    staleTime: 5 * 60 * 1000,
  });
}

export function useGroupMembershipStatus(groupId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['group-membership', groupId, user?.uid],
    queryFn: () =>
      groupId && user?.uid
        ? groupService.getMembershipStatus(groupId, user.uid)
        : Promise.resolve<'none'>('none'),
    enabled: !!groupId && !!user?.uid,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useGroupMemberCount(groupId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['group-member-count', groupId, user?.uid],
    queryFn: () => (groupId ? groupService.getGroupMemberCount(groupId) : Promise.resolve(0)),
    enabled: !!groupId && !!user?.uid,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateGroupInput) => groupService.createGroup(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ['groups'] });
      const previous = queryClient.getQueryData<Awaited<ReturnType<typeof groupService.getGroups>>>(['groups']);

      const optimistic = {
        id: `optimistic-${Date.now()}`,
        name: input.name,
        description: input.description,
        ownerId: input.ownerId,
        memberCount: 1,
        createdAt: new Date().toISOString(),
        coverImageUrl: input.coverImageUrl,
        isPrivate: !!input.isPrivate,
        requireAdminApproval: !!input.requireAdminApproval,
        allowMemberChallenges: input.allowMemberChallenges ?? true,
        activeChallenges: 0,
      };

      queryClient.setQueryData(['groups'], (old: typeof previous) => {
        const base = old ?? [];
        return [optimistic, ...base];
      });

      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['groups'], context.previous);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['my-groups'] });
    },
  });
}

export function useJoinGroup() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ groupId, inviteCode }: { groupId?: string; inviteCode?: string }) => {
      if (!user?.uid) throw new Error('User required');
      let result;
      if (groupId) result = await groupService.joinGroup(groupId, user.uid);
      else if (inviteCode) result = await groupService.joinGroupByInviteCode(inviteCode, user.uid);
      else throw new Error('Group identifier required');
      if (!result) throw new Error('Group not found or not active');
      return result;
    },
    retry: 1,
    retryDelay: 300,
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['my-groups'] });
      queryClient.invalidateQueries({ queryKey: ['home-screen-data', user?.uid] });
      const resolvedGroupId = result?.group?.id ?? variables.groupId;
      if (resolvedGroupId) {
        queryClient.invalidateQueries({ queryKey: ['group-member-count', resolvedGroupId] });
        queryClient.invalidateQueries({ queryKey: ['group-membership', resolvedGroupId, user?.uid] });
        queryClient.invalidateQueries({ queryKey: ['group', resolvedGroupId, user?.uid] });
      }
    },
  });
}

export function useLeaveGroup() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (groupId: string) => {
      if (!user?.uid) throw new Error('User required');
      return groupService.leaveGroup(groupId, user.uid);
    },
    onSuccess: (_result, groupId) => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['my-groups'] });
      queryClient.invalidateQueries({ queryKey: ['group-member-count', groupId] });
      queryClient.invalidateQueries({ queryKey: ['group-membership', groupId, user?.uid] });
      queryClient.invalidateQueries({ queryKey: ['group', groupId, user?.uid] });
      queryClient.invalidateQueries({ queryKey: ['home-screen-data', user?.uid] });
    },
  });
}

export function useUpdateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, patch }: { groupId: string; patch: UpdateGroupInput }) =>
      groupService.updateGroup(groupId, patch),
    onSuccess: (_result, { groupId }) => {
      queryClient.invalidateQueries({ queryKey: ['group', groupId] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['my-groups'] });
    },
  });
}

export function useReportGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ReportGroupInput) => groupService.reportGroup(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-group-moderation-queue'] });
    },
  });
}
