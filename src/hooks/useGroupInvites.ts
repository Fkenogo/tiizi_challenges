import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  groupInviteService,
  type CreatedGroupInvite,
  type GroupJoinRequest,
} from '../services/groupInviteService';
import { type CreateGroupInviteInput } from '../services/groupInviteUtils';
import { useAuth } from './useAuth';

export function useGroupInvites(groupId: string | undefined, enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['group-invites', groupId, user?.uid],
    queryFn: () => (groupId ? groupInviteService.listGroupInvites(groupId) : Promise.resolve([])),
    enabled: !!groupId && !!user?.uid && enabled,
    staleTime: 60 * 1000,
  });
}

export function useGroupJoinRequests(groupId: string | undefined, enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['group-join-requests', groupId, user?.uid],
    queryFn: () => (groupId ? groupInviteService.listGroupJoinRequests(groupId) : Promise.resolve([])),
    enabled: !!groupId && !!user?.uid && enabled,
    staleTime: 30 * 1000,
  });
}

export function useCreateGroupInvite(groupId: string | undefined) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (input: CreateGroupInviteInput): Promise<CreatedGroupInvite> =>
      groupInviteService.createGroupInvite(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-invites', groupId, user?.uid] });
    },
  });
}

export function useRevokeGroupInvite(groupId: string | undefined) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (inviteId: string) => groupInviteService.revokeGroupInvite(inviteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-invites', groupId, user?.uid] });
    },
  });
}

export function useRedeemGroupInvite() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (token: string) => groupInviteService.redeemGroupInvite(token),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['my-groups'] });
      queryClient.invalidateQueries({ queryKey: ['group', result.groupId, user?.uid] });
      queryClient.invalidateQueries({ queryKey: ['group-membership', result.groupId, user?.uid] });
      queryClient.invalidateQueries({ queryKey: ['group-membership-detail', result.groupId, user?.uid] });
    },
  });
}

export function useRequestGroupJoin(groupId: string | undefined) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: () => {
      if (!groupId) throw new Error('Group is required.');
      return groupInviteService.requestGroupJoin(groupId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-join-requests', groupId, user?.uid] });
    },
  });
}

export function useApproveGroupJoinRequest(groupId: string | undefined) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (request: GroupJoinRequest) => groupInviteService.approveGroupJoinRequest(request.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-join-requests', groupId, user?.uid] });
      queryClient.invalidateQueries({ queryKey: ['group-member-count', groupId] });
    },
  });
}

export function useRejectGroupJoinRequest(groupId: string | undefined) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({ request, reason }: { request: GroupJoinRequest; reason?: string }) =>
      groupInviteService.rejectGroupJoinRequest(request.id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-join-requests', groupId, user?.uid] });
    },
  });
}
