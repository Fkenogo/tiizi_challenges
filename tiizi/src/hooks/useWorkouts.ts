import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { workoutService, type CreateWorkoutInput } from '../services/workoutService';
import { useAuth } from './useAuth';

export function useChallengeWorkouts(challengeId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['challenge-workouts', challengeId, user?.uid],
    queryFn: () => (challengeId ? workoutService.getWorkoutsByChallenge(challengeId) : Promise.resolve([])),
    enabled: !!challengeId && !!user?.uid,
    staleTime: 30 * 1000,
  });
}

export function useUserWorkouts(userId: string | undefined) {
  return useQuery({
    queryKey: ['user-workouts', userId],
    queryFn: () => (userId ? workoutService.getWorkoutsByUser(userId) : Promise.resolve([])),
    enabled: !!userId,
    staleTime: 30 * 1000,
  });
}

export function useChallengeProgress(challengeId: string | undefined, userId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['challenge-progress', challengeId, userId, user?.uid],
    queryFn: async () => {
      if (!challengeId) return { totalLogs: 0, myLogs: 0, uniqueParticipants: 0 };
      const workouts = await workoutService.getWorkoutsByChallenge(challengeId);
      const totalLogs = workouts.length;
      const myLogs = userId ? workouts.filter((w) => w.userId === userId).length : 0;
      const uniqueParticipants = new Set(workouts.map((w) => w.userId)).size;
      return { totalLogs, myLogs, uniqueParticipants };
    },
    enabled: !!challengeId && !!user?.uid,
    staleTime: 30 * 1000,
  });
}

export function useLogWorkout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWorkoutInput) => workoutService.createWorkout(input),
    onSuccess: async (workout) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['challenge-workouts', workout.challengeId] }),
        queryClient.invalidateQueries({ queryKey: ['challenge-progress', workout.challengeId] }),
      ]);
    },
  });
}
