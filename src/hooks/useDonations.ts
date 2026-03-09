import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { donationService } from '../services/donationService';
import { useAuth } from './useAuth';

export function useSupportPreference() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['support-donation-preference', user?.uid],
    queryFn: () => (user?.uid ? donationService.getSupportPreference(user.uid) : Promise.resolve(null)),
    enabled: !!user?.uid,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSupportDonations() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['support-donations', user?.uid],
    queryFn: () => (user?.uid ? donationService.getUserSupportDonations(user.uid) : Promise.resolve([])),
    enabled: !!user?.uid,
    staleTime: 30 * 1000,
  });
}

export function useCreateSupportDonation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      amountKes: number;
      frequency: 'monthly' | 'annual' | 'goal_triggered' | 'one_time';
      trigger: 'manual' | 'challenge_completion' | 'streak_milestone';
      paymentMethod: 'mobile_money' | 'card';
      paymentDestination: { mobileNumber?: string; cardUrl?: string };
      ussdCode?: string;
      challengeId?: string;
    }) => {
      if (!user?.uid) throw new Error('Sign in required');
      return donationService.createSupportDonation({ ...input, userId: user.uid });
    },
    onSuccess: async (_data, variables) => {
      if (!user?.uid) return;
      await Promise.all([
        donationService.saveSupportPreference({
          userId: user.uid,
          preferredFrequency:
            variables.frequency === 'one_time' ? 'goal_triggered' : variables.frequency,
          preferredTrigger: variables.trigger,
        }),
        queryClient.invalidateQueries({ queryKey: ['support-donations', user.uid] }),
        queryClient.invalidateQueries({ queryKey: ['support-donation-preference', user.uid] }),
      ]);
    },
  });
}

export function useConfirmSupportDonation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { donationId: string; transactionId?: string }) => {
      if (!user?.uid) throw new Error('Sign in required');
      return donationService.confirmSupportDonation({
        donationId: input.donationId,
        userId: user.uid,
        transactionId: input.transactionId,
      });
    },
    onSuccess: async () => {
      if (!user?.uid) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['support-donations', user.uid] }),
        queryClient.invalidateQueries({ queryKey: ['support-donation-preference', user.uid] }),
      ]);
    },
  });
}

export function useChallengeContribution(challengeId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['challenge-contribution', challengeId, user?.uid],
    queryFn: () =>
      challengeId && user?.uid
        ? donationService.getUserChallengeContribution(challengeId, user.uid)
        : Promise.resolve(null),
    enabled: !!challengeId && !!user?.uid,
    staleTime: 30 * 1000,
  });
}

export function useCreateChallengeContribution() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      challengeId: string;
      groupId: string;
      amountKes: number;
      timingStartDate?: string;
      timingEndDate?: string;
      paymentPhoneNumber?: string;
      status: 'pledged' | 'skipped';
    }) => {
      if (!user?.uid) throw new Error('Sign in required');
      return donationService.createChallengeContribution({
        ...input,
        userId: user.uid,
      });
    },
    onSuccess: async (_data, variables) => {
      if (!user?.uid) return;
      await queryClient.invalidateQueries({
        queryKey: ['challenge-contribution', variables.challengeId, user.uid],
      });
    },
  });
}
