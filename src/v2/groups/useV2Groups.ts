import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import {
  invalidateV2Memberships,
  v2MembershipsKey,
} from '../memberships/membershipQueryKeys';
import {
  createGroup,
  fetchGroupDetail,
  fetchMyMemberships,
  joinGroup,
  type CreateGroupInput,
  type CreatedGroup,
  type MyMembershipsResponse,
  type V2GroupDetail,
} from '../../api/groupsApi';
import { listGroupChallengesV2, type V2ChallengeSummary } from '../../api/v2ChallengeApi';
import {
  invalidateV2GroupReads,
  v2GroupChallengesKey,
  v2GroupDetailKey,
} from './groupQueryKeys';

/**
 * TIIZI S4a — V2 Groups read/write hooks (evolved from the S2-G hooks).
 *
 * Reads:
 * - `GET /v1/memberships/me` — the member's Groups (the SAME contract the
 *   Challenge creation journey consumes);
 * - `GET /v1/groups/:groupId` — canonical Group detail (Group Home's only
 *   truth source; server-derived relationship, steward, count, settings);
 * - `GET /v1/challenges?groupId=` — the Group's hosted Challenges, scoped
 *   server-side under the existing Challenge visibility authority.
 *
 * Writes go through the governed authorities only (`POST /v1/groups`,
 * `POST /v1/groups/:groupId/join`) and then invalidate the reads so
 * persistence is proven by the server, never by client state.
 */

export { v2GroupDetailKey, v2GroupChallengesKey, invalidateV2GroupReads };

/** The authenticated member's Groups (server read; the membership list source). */
export function useV2Groups() {
  const { user } = useAuth();
  return useQuery<MyMembershipsResponse>({
    queryKey: v2MembershipsKey(user?.uid),
    queryFn: () => fetchMyMemberships(),
    enabled: !!user,
  });
}

/** Canonical Group detail for Group Home. Disabled until signed in with an id. */
export function useV2GroupDetail(groupId: string | null) {
  const { user } = useAuth();
  return useQuery<V2GroupDetail>({
    queryKey: v2GroupDetailKey(groupId ?? undefined, user?.uid),
    queryFn: () => fetchGroupDetail(groupId as string),
    enabled: !!user && !!groupId,
  });
}

/** The Group's hosted Challenges, scoped server-side. Disabled until signed in with an id. */
export function useV2GroupChallenges(groupId: string | null) {
  const { user } = useAuth();
  return useQuery<{ memberId: string; groupId: string; challenges: V2ChallengeSummary[] }>({
    queryKey: v2GroupChallengesKey(groupId ?? undefined, user?.uid),
    queryFn: () => listGroupChallengesV2(groupId as string),
    enabled: !!user && !!groupId,
  });
}

/** Governed Group establishment; refetches the reads on success. */
export function useCreateGroup() {
  const queryClient = useQueryClient();
  return useMutation<CreatedGroup, unknown, CreateGroupInput>({
    mutationFn: (input) => createGroup(input),
    onSuccess: async () => {
      await invalidateV2Memberships(queryClient);
    },
  });
}

/** Governed Group join from Group Home (existing join authority, new binding). */
export function useJoinGroup(groupId: string | null) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation<{ id: string; status: string; role: string }, unknown, void>({
    mutationFn: () => joinGroup(groupId as string),
    onSuccess: async () => {
      await invalidateV2GroupReads(queryClient, user?.uid, groupId ?? undefined);
    },
  });
}
