import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminChallengeService } from '../services/adminChallengeService';

export function usePendingChallenges() {
  return useQuery({
    queryKey: ['admin-pending-challenges'],
    queryFn: () => adminChallengeService.getPendingChallenges(),
    staleTime: 30 * 1000,
  });
}

export function useApprovedChallenges() {
  return useQuery({
    queryKey: ['admin-approved-challenges'],
    queryFn: () => adminChallengeService.getApprovedChallenges(),
    staleTime: 30 * 1000,
  });
}

export function useActiveChallenges() {
  return useQuery({
    queryKey: ['admin-active-challenges'],
    queryFn: () => adminChallengeService.getActiveChallenges(),
    staleTime: 30 * 1000,
  });
}

export function useChallengeTemplates() {
  return useQuery({
    queryKey: ['admin-challenge-templates'],
    queryFn: () => adminChallengeService.getTemplates(),
    staleTime: 60 * 1000,
  });
}

export function useChallengeAnalytics() {
  return useQuery({
    queryKey: ['admin-challenge-analytics'],
    queryFn: () => adminChallengeService.getChallengeAnalytics(),
    staleTime: 30 * 1000,
  });
}

export function useCreateAdminChallenge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      category?: 'fitness' | 'wellness' | 'fasting' | 'hydration' | 'sleep' | 'mindfulness' | 'nutrition' | 'habits' | 'stress' | 'social';
      name: string;
      description: string;
      challengeType: 'collective' | 'competitive' | 'streak';
      startDate: string;
      endDate: string;
      createdBy: string;
      coverImageUrl?: string;
      activities?: Array<{
        exerciseId?: string;
        activityId?: string;
        activityType?: string;
        exerciseName?: string;
        description?: string;
        category?: string;
        difficulty?: string;
        icon?: string;
        protocolSteps?: string[];
        benefits?: string[];
        guidelines?: string[];
        warnings?: string[];
        frequency?: 'daily' | 'weekly' | '3x-week' | 'custom';
        instructions?: string[];
        pointsPerCompletion?: number;
        dailyFrequency?: number;
        targetValue: number;
        unit: string;
      }>;
      donation?: {
        enabled: boolean;
        causeName?: string;
        causeDescription?: string;
        targetAmountKes?: number;
        contributionStartDate?: string;
        contributionEndDate?: string;
        contributionPhoneNumber?: string;
        contributionCardUrl?: string;
        disclaimer?: string;
      };
    }) => adminChallengeService.createChallengeFromAdmin(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-active-challenges'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-challenge-analytics'] }),
        queryClient.invalidateQueries({ queryKey: ['challenges'] }),
      ]);
    },
  });
}

export function useApproveChallenge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ challengeId, moderatorUid }: { challengeId: string; moderatorUid: string }) =>
      adminChallengeService.approveChallenge(challengeId, moderatorUid),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-pending-challenges'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-approved-challenges'] }),
        queryClient.invalidateQueries({ queryKey: ['challenges'] }),
      ]);
    },
  });
}

export function useRequestChallengeChanges() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ challengeId, moderatorUid, note }: { challengeId: string; moderatorUid: string; note: string }) =>
      adminChallengeService.requestChallengeChanges(challengeId, moderatorUid, note),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-pending-challenges'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-approved-challenges'] }),
        queryClient.invalidateQueries({ queryKey: ['challenges'] }),
      ]);
    },
  });
}
