import { useQuery } from '@tanstack/react-query';
import { adminAnalyticsService } from '../services/adminAnalyticsService';

export function useAdminDashboard() {
  return useQuery({
    queryKey: ['admin-dashboard-overview'],
    queryFn: () => adminAnalyticsService.getOverviewMetrics(),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
