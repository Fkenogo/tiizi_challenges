import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { groupService, type CreateGroupInput } from '../services/groupService';
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
    staleTime: 30 * 1000,
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
    staleTime: 15 * 1000,
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
      if (groupId) return groupService.joinGroup(groupId, user.uid);
      if (inviteCode) return groupService.joinGroupByInviteCode(inviteCode, user.uid);
      throw new Error('Group identifier required');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['my-groups'] });
    },
  });
}
