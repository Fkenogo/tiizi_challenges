import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { workoutService, type CreateWorkoutInput } from '../services/workoutService';
import { challengeService } from '../services/challengeService';
import { useAuth } from './useAuth';
import { wellnessLogService } from '../services/wellnessLogService';

export function useChallengeWorkouts(challengeId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['challenge-workouts', challengeId, user?.uid],
    queryFn: () => (challengeId ? workoutService.getWorkoutsByChallenge(challengeId) : Promise.resolve([])),
    enabled: !!challengeId && !!user?.uid,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useUserWorkouts(userId: string | undefined) {
  return useQuery({
    queryKey: ['user-workouts', userId],
    queryFn: () => (userId ? workoutService.getWorkoutsByUser(userId) : Promise.resolve([])),
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useChallengeProgress(challengeId: string | undefined, userId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['challenge-progress', challengeId, userId, user?.uid],
    queryFn: async () => {
      if (!challengeId) return { totalLogs: 0, myLogs: 0, uniqueParticipants: 0 };
      const [workouts, uniqueParticipants] = await Promise.all([
        workoutService.getWorkoutsByChallenge(challengeId),
        challengeService.getChallengeParticipantCount(challengeId),
      ]);
      const totalLogs = workouts.length;
      const myLogs = userId ? workouts.filter((w) => w.userId === userId).length : 0;
      return { totalLogs, myLogs, uniqueParticipants };
    },
    enabled: !!challengeId && !!user?.uid,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useLogWorkout() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (input: CreateWorkoutInput) => workoutService.createWorkout(input),
    onSuccess: async (workout) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['challenge-workouts', workout.challengeId] }),
        queryClient.invalidateQueries({ queryKey: ['challenge-progress', workout.challengeId] }),
        queryClient.invalidateQueries({ queryKey: ['challenge-membership', workout.challengeId, workout.userId] }),
        queryClient.invalidateQueries({ queryKey: ['group-leaderboard', workout.groupId] }),
        queryClient.invalidateQueries({ queryKey: ['group-members', workout.groupId] }),
        queryClient.invalidateQueries({ queryKey: ['streak', 'user', workout.userId] }),
        queryClient.invalidateQueries({ queryKey: ['streak', 'challenge', workout.userId, workout.challengeId] }),
        queryClient.invalidateQueries({ queryKey: ['home-screen-data', user?.uid] }),
        queryClient.invalidateQueries({ queryKey: ['challenges', user?.uid] }),
      ]);
    },
  });
}

type WellnessLogMutationInput = {
  userId: string;
  challengeId: string;
  groupId: string;
  activityId: string;
  activityType: string;
  value: number;
  unit: string;
  notes?: string;
  metadata?: Record<string, unknown>;
};

export function useLogWellnessActivity() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: WellnessLogMutationInput) => {
      const normalized = input.activityType.toLowerCase();
      if (normalized === 'fasting') {
        await wellnessLogService.logFasting(input);
      } else if (normalized === 'hydration' || normalized === 'water') {
        await wellnessLogService.logHydration({ ...input, intakeMl: input.value });
      } else if (normalized === 'sleep') {
        await wellnessLogService.logSleep(input);
      } else if (normalized === 'meditation' || normalized === 'mindfulness' || normalized === 'breathing') {
        await wellnessLogService.logMeditation(input);
      } else {
        await wellnessLogService.logMeditation({ ...input, metadata: { ...(input.metadata ?? {}), mappedFrom: normalized } });
      }
      return input;
    },
    onSuccess: async (input) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['challenge-workouts', input.challengeId] }),
        queryClient.invalidateQueries({ queryKey: ['challenge-progress', input.challengeId] }),
        queryClient.invalidateQueries({ queryKey: ['challenge-membership', input.challengeId, input.userId] }),
        queryClient.invalidateQueries({ queryKey: ['group-leaderboard', input.groupId] }),
        queryClient.invalidateQueries({ queryKey: ['group-members', input.groupId] }),
        queryClient.invalidateQueries({ queryKey: ['home-screen-data', user?.uid] }),
        queryClient.invalidateQueries({ queryKey: ['challenges', user?.uid] }),
      ]);
    },
  });
}
