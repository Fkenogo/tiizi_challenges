import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  establishChallengeV2,
  fetchActivityOptions,
  fetchComposerSelectableKnowledge,
  previewChallengeDefinition,
  type ActivityOptionsResponse,
  type ChallengeComposerDraft,
  type ComposerPreviewResult,
  type EstablishChallengeBody,
  type EstablishChallengeResponse,
} from '../../api/challengeCreationApi';
import { fetchMyMemberships, type MyMembershipsResponse } from '../../api/membershipsApi';
import { v2MembershipsKey } from '../memberships/membershipQueryKeys';
import {
  getChallengeV2,
  joinChallengeV2,
  listChallengesV2,
  withdrawChallengeV2,
  type V2ChallengeDetail,
  type V2ChallengeSummary,
  type V2ParticipationResponse,
} from '../../api/v2ChallengeApi';
import {
  invalidateV2ChallengeReads,
  V2_CHALLENGE_LIST_SCOPE,
  v2ChallengeDetailKey,
  v2ChallengeListKey,
} from './challengeQueryKeys';
import { useAuth } from '../../hooks/useAuth';

/**
 * S2b — V2 Challenge Creation query/mutation hooks.
 *
 * Every read/write goes through the authenticated typed api seam. The V2
 * cache namespace ('v2-*') is invalidated only inside V2 — a V2 mutation never
 * touches a Firestore/V1 cache as a substitute for V2 truth. Queries are
 * enabled only when the API base URL is configured and a session exists.
 */

function apiConfigured(): boolean {
  const base = import.meta.env.VITE_TIIZI_API_BASE_URL as string | undefined;
  return typeof base === 'string' && base.trim().length > 0;
}

/** The authenticated member's real Group memberships (host candidates). */
export function useV2Memberships() {
  const { user } = useAuth();
  return useQuery<MyMembershipsResponse>({
    queryKey: v2MembershipsKey(user?.uid),
    queryFn: () => fetchMyMemberships(),
    enabled: !!user?.uid && apiConfigured(),
    staleTime: 60 * 1000,
  });
}

/** Composer-selectable canonical catalogue (published, coded, eligible). */
export function useComposerCatalogue(kind?: 'fitness' | 'wellness', search?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['v2-create-catalogue', kind ?? 'all', search ?? ''],
    queryFn: () => fetchComposerSelectableKnowledge(kind, search),
    enabled: !!user?.uid && apiConfigured(),
    staleTime: 5 * 60 * 1000,
    placeholderData: (previous) => previous,
  });
}

/** Governed options (Metric/Unit/Components/Load bases) for one Activity. */
export function useActivityOptions(activityId: string | null) {
  const { user } = useAuth();
  return useQuery<ActivityOptionsResponse>({
    queryKey: ['v2-create-options', activityId],
    queryFn: () => fetchActivityOptions(activityId as string),
    enabled: !!user?.uid && apiConfigured() && !!activityId,
    staleTime: 5 * 60 * 1000,
  });
}

/** Server preview/validation seam (never a second validator). */
export function usePreviewDraft() {
  return useMutation<ComposerPreviewResult, Error, ChallengeComposerDraft>({
    mutationFn: (draft) => previewChallengeDefinition(draft),
  });
}

/** Governed establishment (the only creation path). */
export function useEstablishChallenge() {
  const queryClient = useQueryClient();
  return useMutation<EstablishChallengeResponse, Error, EstablishChallengeBody>({
    mutationFn: (body) => establishChallengeV2(body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [V2_CHALLENGE_LIST_SCOPE] });
    },
  });
}

/** V2 Challenges visible to the caller (list/read state). */
export function useChallengeListV2() {
  const { user } = useAuth();
  return useQuery({
    queryKey: v2ChallengeListKey(user?.uid),
    queryFn: () => listChallengesV2(),
    enabled: !!user?.uid && apiConfigured(),
    staleTime: 30 * 1000,
  });
}

/** One V2 Challenge from persisted truth (created context / refresh proof). */
export function useChallengeDetailV2(challengeId: string | undefined) {
  const { user } = useAuth();
  return useQuery<V2ChallengeDetail>({
    queryKey: v2ChallengeDetailKey(challengeId, user?.uid),
    queryFn: () => getChallengeV2(challengeId as string),
    enabled: !!user?.uid && apiConfigured() && !!challengeId,
    staleTime: 10 * 1000,
  });
}

/**
 * S3a — governed join over the existing `POST /v1/challenges/:id/join`
 * seam. The server is the sole authority; success only marks the
 * canonical + legacy Challenge reads stale (see `challengeQueryKeys.ts`)
 * so the authoritative refetch determines final `myParticipation` state.
 * No optimistic canonical participation state is manufactured.
 */
export function useJoinChallengeV2() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation<V2ParticipationResponse, Error, string>({
    mutationFn: (challengeId) => joinChallengeV2(challengeId),
    onSuccess: async (_data, challengeId) => {
      await invalidateV2ChallengeReads(queryClient, user?.uid, challengeId);
    },
  });
}

/**
 * S3a — governed withdraw over the existing
 * `POST /v1/challenges/:id/withdraw` seam. Closes the caller's active
 * episode; history is preserved server-side. Same refetch-only truth
 * contract as join: no client-derived participation state.
 */
export function useWithdrawChallengeV2() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation<V2ParticipationResponse, Error, string>({
    mutationFn: (challengeId) => withdrawChallengeV2(challengeId),
    onSuccess: async (_data, challengeId) => {
      await invalidateV2ChallengeReads(queryClient, user?.uid, challengeId);
    },
  });
}

export type { V2ChallengeSummary, V2ChallengeDetail };
