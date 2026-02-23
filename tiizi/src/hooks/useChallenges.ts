import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { challengeService } from '../services/challengeService';
import type { CreateChallengeInput } from '../services/challengeService';
import { useAuth } from './useAuth';

export function useChallenges() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['challenges', user?.uid],
    queryFn: () => challengeService.getChallenges(),
    enabled: !!user?.uid,
    staleTime: 5 * 60 * 1000,
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

export function useCreateChallenge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateChallengeInput) => challengeService.createChallenge(input),
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
        status: 'active' as const,
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
    },
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
