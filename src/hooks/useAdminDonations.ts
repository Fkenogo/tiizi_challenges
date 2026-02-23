import { useQuery } from '@tanstack/react-query';
import { adminDonationService } from '../services/adminDonationService';

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
