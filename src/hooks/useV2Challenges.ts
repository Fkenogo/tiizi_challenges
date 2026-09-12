/**
 * Phase C3B V2 Challenge TanStack Query hooks.
 *
 * V2-only cache namespace ('v2-challenges', 'v2-challenge', 'v2-leaderboard'):
 * V2 mutations invalidate/update ONLY V2 queries — never Firestore/V1 caches
 * as a substitute for V2 truth. All queries are disabled unless the V2
 * feature boundary is explicitly enabled (default OFF).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createChallengeV2,
  getChallengeV2,
  getCompetitiveLeaderboardV2,
  joinChallengeV2,
  listChallengesV2,
  logChallengeActivityV2,
  withdrawChallengeV2,
  type V2ActivityPayload,
  type V2ActivityResult,
  type V2CreateChallengeInput,
  type V2CreateChallengeResponse,
} from '../api/v2ChallengeApi';
import { isV2ChallengesEnabled } from '../api/v2ChallengeMode';
import { useAuth } from './useAuth';
import {
  createGroupV2,
  fetchMyGroupsV2,
  joinGroupV2,
  type V2CreateGroupInput,
} from '../api/v2GroupsApi';
import {
  listEstablishmentKnowledge,
  type V2KnowledgeKind,
} from '../api/v2KnowledgeApi';

export function useV2ChallengeList() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['v2-challenges', user?.uid],
    queryFn: () => listChallengesV2(),
    enabled: !!user?.uid && isV2ChallengesEnabled(),
    staleTime: 60 * 1000,
  });
}

export function useV2ChallengeDetail(challengeId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['v2-challenge', challengeId, user?.uid],
    queryFn: () => getChallengeV2(challengeId as string),
    enabled: !!challengeId && !!user?.uid && isV2ChallengesEnabled(),
    staleTime: 30 * 1000,
  });
}

export function useV2CompetitiveLeaderboard(challengeId: string | undefined, challengeType: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['v2-leaderboard', challengeId, user?.uid],
    queryFn: () => getCompetitiveLeaderboardV2(challengeId as string),
    enabled: !!challengeId && !!user?.uid && isV2ChallengesEnabled() && challengeType === 'competitive',
    staleTime: 30 * 1000,
  });
}

export function useV2JoinChallenge() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (challengeId: string) => joinChallengeV2(challengeId),
    onSuccess: async (_data, challengeId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['v2-challenges'] }),
        queryClient.invalidateQueries({ queryKey: ['v2-challenge', challengeId] }),
      ]);
    },
  });
}

export function useV2WithdrawChallenge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (challengeId: string) => withdrawChallengeV2(challengeId),
    onSuccess: async (_data, challengeId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['v2-challenges'] }),
        queryClient.invalidateQueries({ queryKey: ['v2-challenge', challengeId] }),
      ]);
    },
  });
}

export interface V2LogVariables {
  challengeId: string;
  /** Caller-owned stable key: ONE per intentional action, reused on retry. */
  payload: V2ActivityPayload;
}

export function useV2LogActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    // No automatic retry: a retry must reuse the SAME client_key, which the
    // caller holds. TanStack mutations do not retry by default; keep it so.
    mutationFn: async (variables: V2LogVariables): Promise<V2ActivityResult> =>
      logChallengeActivityV2(variables.challengeId, variables.payload),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['v2-challenge', result.challengeId] }),
        queryClient.invalidateQueries({ queryKey: ['v2-challenges'] }),
        queryClient.invalidateQueries({ queryKey: ['v2-leaderboard', result.challengeId] }),
      ]);
    },
  });
}

/**
 * EBC-05 establishment + Group authority hooks. Same V2-only cache
 * namespace discipline: mutations invalidate V2 queries only.
 */

export function useV2CreateChallenge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: V2CreateChallengeInput): Promise<V2CreateChallengeResponse> =>
      createChallengeV2(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['v2-challenges'] });
    },
  });
}

export function useV2MyGroups() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['v2-groups', user?.uid],
    queryFn: () => fetchMyGroupsV2(),
    enabled: !!user?.uid && isV2ChallengesEnabled(),
    staleTime: 60 * 1000,
  });
}

export function useV2CreateGroup() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (input: V2CreateGroupInput) => createGroupV2(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['v2-groups', user?.uid] });
    },
  });
}

export function useV2JoinGroup() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (groupId: string) => joinGroupV2(groupId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['v2-groups', user?.uid] });
    },
  });
}

/** Server-authoritative published Knowledge for establishment pickers. */
export function useV2EstablishmentKnowledge(kind: V2KnowledgeKind | undefined, search: string) {
  const { user } = useAuth();
  const trimmed = search.trim();
  return useQuery({
    queryKey: ['v2-knowledge', kind ?? 'all', trimmed, user?.uid],
    queryFn: () =>
      listEstablishmentKnowledge({
        ...(kind ? { kind } : {}),
        ...(trimmed ? { search: trimmed } : {}),
      }),
    enabled: !!user?.uid && isV2ChallengesEnabled(),
    staleTime: 60 * 1000,
  });
}
