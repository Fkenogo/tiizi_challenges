import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { doc, getDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, db } from '../lib/firebase';
import { challengeService } from '../services/challengeService';
import type { CreateChallengeInput } from '../services/challengeService';
import { useAuth } from './useAuth';

export function useChallenges() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['challenges', user?.uid],
    queryFn: () => (user?.uid ? challengeService.getUserAccessibleChallenges(user.uid) : Promise.resolve([])),
    enabled: !!user?.uid,
    staleTime: 5 * 60 * 1000,
  });
}

export function useChallengesByGroup(groupId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['challenges-by-group', groupId, user?.uid],
    queryFn: () => (groupId ? challengeService.getChallengesByGroup(groupId) : Promise.resolve([])),
    enabled: !!groupId && !!user?.uid,
    staleTime: 60 * 1000,
  });
}

export function useChallenge(id: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['challenge', id, user?.uid],
    queryFn: () => (id ? challengeService.getChallengeById(id) : Promise.resolve(null)),
    enabled: !!id && !!user?.uid,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCanAccessChallenge(challengeId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['challenge-access', challengeId, user?.uid],
    queryFn: () =>
      challengeId && user?.uid
        ? challengeService.canAccessChallenge(user.uid, challengeId)
        : Promise.resolve(false),
    enabled: !!challengeId && !!user?.uid,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useChallengeMembership(challengeId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['challenge-membership', challengeId, user?.uid],
    queryFn: () =>
      challengeId && user?.uid
        ? challengeService.getChallengeMembership(user.uid, challengeId)
        : Promise.resolve(null),
    enabled: !!challengeId && !!user?.uid,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Reads challengeActivitySummaries.totalValue — the CF-maintained canonical collective team total.
 * Use for collective challenge team progress display. Invalidated after every log mutation.
 */
export function useChallengeSummary(challengeId: string | undefined) {
  return useQuery({
    queryKey: ['challenge-activity-summary', challengeId],
    queryFn: async () => {
      if (!challengeId) return null;
      const snap = await getDoc(doc(db, 'challengeActivitySummaries', challengeId));
      if (!snap.exists()) return null;
      const data = snap.data() as { totalValue?: number };
      return { totalValue: Math.max(0, Number(data.totalValue ?? 0)) };
    },
    enabled: !!challengeId,
    staleTime: 30 * 1000,
  });
}

export function useJoinChallenge() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (challengeId: string) => {
      if (!user?.uid) throw new Error('User required');
      return challengeService.joinChallenge(user.uid, challengeId);
    },
    onSuccess: async (_data, challengeId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['challenges'] }),
        queryClient.invalidateQueries({ queryKey: ['challenge', challengeId] }),
        queryClient.invalidateQueries({ queryKey: ['challenge-membership', challengeId, user?.uid] }),
        queryClient.invalidateQueries({ queryKey: ['challenge-memberships-index', user?.uid] }),
        queryClient.invalidateQueries({ queryKey: ['challenge-access', challengeId, user?.uid] }),
        queryClient.invalidateQueries({ queryKey: ['challenge-participant-stats'] }),
        queryClient.invalidateQueries({ queryKey: ['home-screen-data', user?.uid] }),
      ]);
    },
  });
}

export function useLeaveChallenge() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (challengeId: string) => {
      if (!user?.uid) throw new Error('User required');
      return challengeService.leaveChallenge(user.uid, challengeId);
    },
    onSuccess: async (_data, challengeId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['challenges'] }),
        queryClient.invalidateQueries({ queryKey: ['challenge', challengeId] }),
        queryClient.invalidateQueries({ queryKey: ['challenge-membership', challengeId, user?.uid] }),
        queryClient.invalidateQueries({ queryKey: ['challenge-memberships-index', user?.uid] }),
        queryClient.invalidateQueries({ queryKey: ['challenge-participant-stats'] }),
        queryClient.invalidateQueries({ queryKey: ['home-screen-data', user?.uid] }),
      ]);
    },
  });
}

export function useCreateChallenge() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    // CORR-2: ordinary creation routes through the server callable — the
    // trusted creation boundary. challengeService.createChallenge is retained
    // only as a rollback surface (it cannot bypass Firestore rules).
    mutationFn: async (input: CreateChallengeInput) => {
      if (!user?.uid) throw new Error('Sign in required');
      const callable = httpsCallable<Record<string, unknown>, { challenge: { id: string } }>(
        getFunctions(app, 'us-central1'),
        'createChallengeWithCreatorMembership',
      );
      const result = await callable({ ...input, actorUid: user.uid } as Record<string, unknown>);
      return result.data;
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ['challenges'] });
      const previous = queryClient.getQueryData<Awaited<ReturnType<typeof challengeService.getChallenges>>>(['challenges']);

      const now = new Date();
      const start = input.startDate ? new Date(input.startDate) : now;
      const end = input.endDate ? new Date(input.endDate) : (() => {
        const date = new Date(start);
        date.setDate(start.getDate() + (Number(input.durationDays) || 14));
        return date;
      })();

      const optimistic = {
        id: `optimistic-${Date.now()}`,
        name: input.name,
        description: input.description,
        groupId: input.groupId,
        exerciseIds: input.exerciseIds ?? [],
        challengeType: input.challengeType ?? 'collective',
        coverImageUrl: input.coverImageUrl,
        activities: input.activities ?? [],
        donation: input.donation,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        createdBy: input.createdBy,
        status: input.donation?.enabled ? ('draft' as const) : ('active' as const),
        participantCount: input.donation?.enabled ? 0 : 1,
        moderationStatus: input.donation?.enabled ? ('pending' as const) : ('approved' as const),
      };

      queryClient.setQueryData(['challenges'], (old: typeof previous) => {
        const base = old ?? [];
        return [optimistic, ...base];
      });

      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['challenges'], context.previous);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['challenges'] });
      queryClient.invalidateQueries({ queryKey: ['challenge-memberships-index', user?.uid] });
      queryClient.invalidateQueries({ queryKey: ['home-screen-data', user?.uid] });
      queryClient.invalidateQueries({ queryKey: ['my-groups', user?.uid] });
    },
  });
}

export function useCompletedChallengesForUser(maxResults?: number) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['completed-challenges', user?.uid, maxResults],
    queryFn: () =>
      user?.uid ? challengeService.getCompletedChallengesForUser(user.uid, maxResults) : Promise.resolve([]),
    enabled: !!user?.uid,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateChallengeStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'draft' | 'active' | 'completed' }) =>
      challengeService.updateChallengeStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['challenges'] });
    },
  });
}
