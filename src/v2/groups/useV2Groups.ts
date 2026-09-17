import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import {
  invalidateV2Memberships,
  v2MembershipsKey,
} from '../memberships/membershipQueryKeys';
import {
  createGroup,
  fetchMyMemberships,
  type CreateGroupInput,
  type CreatedGroup,
  type MyMembershipsResponse,
} from '../../api/groupsApi';

/**
 * TIIZI S2-G — V2 Groups read/write hooks.
 *
 * The read is `GET /v1/memberships/me` — the SAME contract the Challenge
 * creation journey consumes — so a Group established here is immediately
 * available to host a Challenge without any second Group integration.
 * Creation submits through the governed authority only and then invalidates
 * the read so persistence is proven by the server, not by client state.
 */

/** The authenticated member's Groups (server read; the only Group list source). */
export function useV2Groups() {
  const { user } = useAuth();
  return useQuery<MyMembershipsResponse>({
    queryKey: v2MembershipsKey(user?.uid),
    queryFn: () => fetchMyMemberships(),
    enabled: !!user,
  });
}

/** Governed Group establishment; refetches the read on success. */
export function useCreateGroup() {
  const queryClient = useQueryClient();
  return useMutation<CreatedGroup, unknown, CreateGroupInput>({
    mutationFn: (input) => createGroup(input),
    onSuccess: async () => {
      await invalidateV2Memberships(queryClient);
    },
  });
}
