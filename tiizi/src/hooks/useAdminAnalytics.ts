import { useQuery } from '@tanstack/react-query';
import { adminAnalyticsService } from '../services/adminAnalyticsService';

export function useAdminOverviewMetrics() {
  return useQuery({
    queryKey: ['admin-analytics-overview'],
    queryFn: () => adminAnalyticsService.getOverviewMetrics(),
    staleTime: 30 * 1000,
  });
}

export function useAdminUserGrowth(days = 30) {
  return useQuery({
    queryKey: ['admin-analytics-user-growth', days],
    queryFn: () => adminAnalyticsService.getUserGrowth(days),
    staleTime: 30 * 1000,
  });
}

export function useAdminEngagement() {
  return useQuery({
    queryKey: ['admin-analytics-engagement'],
    queryFn: () => adminAnalyticsService.getEngagementMetrics(),
    staleTime: 30 * 1000,
  });
}

export function useAdminRevenue() {
  return useQuery({
    queryKey: ['admin-analytics-revenue'],
    queryFn: () => adminAnalyticsService.getRevenueMetrics(),
    staleTime: 30 * 1000,
  });
}
