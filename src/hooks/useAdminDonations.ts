import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminDonationService, type PlatformSupportAction, type PlatformSupportDonation } from '../services/adminDonationService';
import type { DocumentSnapshot } from 'firebase/firestore';
import type { SupportDonationSettings } from '../types';

export function useDonationCampaigns() {
  return useQuery({
    queryKey: ['admin-donation-campaigns'],
    queryFn: () => adminDonationService.getCampaigns(),
    staleTime: 30 * 1000,
  });
}

export function useDonationTransactions() {
  return useQuery({
    queryKey: ['admin-donation-transactions'],
    queryFn: () => adminDonationService.getTransactions(),
    staleTime: 30 * 1000,
  });
}

export function useDonationReports() {
  return useQuery({
    queryKey: ['admin-donation-reports'],
    queryFn: () => adminDonationService.getReports(),
    staleTime: 30 * 1000,
  });
}

type PlatformSupportFilter = 'all' | PlatformSupportDonation['status'] | 'flagged';

export function usePlatformSupportSettings() {
  return useQuery({
    queryKey: ['admin-platform-support-settings'],
    queryFn: () => adminDonationService.getPlatformSupportSettings(),
    staleTime: 60 * 1000,
  });
}

export function usePlatformSupportReport() {
  const settings = usePlatformSupportSettings();
  return useQuery({
    queryKey: ['admin-platform-support-report'],
    queryFn: () => adminDonationService.getPlatformSupportReport(settings.data?.goalAmountKes ?? 0),
    staleTime: 30 * 1000,
  });
}

export function usePlatformSupportDonations({
  statusFilter,
  pageSize,
}: {
  statusFilter: PlatformSupportFilter;
  pageSize: number;
}) {
  return useInfiniteQuery({
    queryKey: ['admin-platform-support-donations', statusFilter, pageSize],
    queryFn: ({ pageParam }: { pageParam: DocumentSnapshot | undefined }) =>
      adminDonationService.getPlatformSupportDonations(statusFilter, pageSize, pageParam),
    initialPageParam: undefined as DocumentSnapshot | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 30 * 1000,
  });
}

export function useSavePlatformSupportSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ settings, adminUid }: { settings: SupportDonationSettings; adminUid: string }) =>
      adminDonationService.savePlatformSupportSettings(settings, adminUid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-platform-support-settings'] });
      queryClient.invalidateQueries({ queryKey: ['admin-platform-support-report'] });
    },
  });
}

export function useUpdatePlatformSupportDonation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      donationId,
      action,
      adminUid,
      note,
    }: {
      donationId: string;
      action: PlatformSupportAction;
      adminUid: string;
      note: string;
    }) => adminDonationService.updatePlatformSupportDonation(donationId, action, adminUid, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-platform-support-donations'] });
      queryClient.invalidateQueries({ queryKey: ['admin-platform-support-report'] });
    },
  });
}
