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
      currency?: string;
      frequency: 'one_time' | 'occasional' | 'monthly' | 'annual';
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
          preferredFrequency: variables.frequency,
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

export function useChallengeContributions(challengeId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['challenge-contributions', challengeId, user?.uid],
    queryFn: () =>
      challengeId && user?.uid
        ? donationService.getUserChallengeContributions(challengeId, user.uid)
        : Promise.resolve([]),
    enabled: !!challengeId && !!user?.uid,
    staleTime: 30 * 1000,
  });
}

export function useChallengeTotalRaised(challengeId: string | undefined) {
  return useQuery({
    queryKey: ['challenge-total-raised', challengeId],
    queryFn: () =>
      challengeId ? donationService.getChallengeTotalRaised(challengeId) : Promise.resolve(0),
    enabled: !!challengeId,
    staleTime: 60 * 1000,
  });
}

export function useCreateChallengeContribution() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      challengeId: string;
      groupId: string;
      pledgedAmount: number;
      currency?: string;
      causeName?: string;
      timingStartDate?: string;
      timingEndDate?: string;
      paymentPhoneNumber?: string;
      status: 'pledged' | 'skipped';
    }) => {
      if (!user?.uid) throw new Error('Sign in required');
      return donationService.createChallengeContribution({ ...input, userId: user.uid });
    },
    onSuccess: async (_data, variables) => {
      if (!user?.uid) return;
      await queryClient.invalidateQueries({
        queryKey: ['challenge-contributions', variables.challengeId, user.uid],
      });
    },
  });
}

export function useConfirmChallengeContribution() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { pledgeId: string; challengeId: string }) => {
      if (!user?.uid) throw new Error('Sign in required');
      return donationService.confirmChallengeContribution(input.pledgeId, user.uid);
    },
    onSuccess: async (_data, variables) => {
      if (!user?.uid) return;
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['challenge-contributions', variables.challengeId, user.uid],
        }),
        queryClient.invalidateQueries({
          queryKey: ['challenge-total-raised', variables.challengeId],
        }),
      ]);
    },
  });
}
