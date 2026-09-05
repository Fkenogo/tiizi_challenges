import { useQuery } from '@tanstack/react-query';
import { isTiiziApiEnabled } from '../api/apiClient';
import { fetchMyMemberships } from '../api/membershipsApi';
import { useAuth } from './useAuth';

/**
 * Phase A proof slice: the current user's group memberships via the Tiizi API
 * instead of Firestore. Gated by VITE_TIIZI_API_ENABLED; the existing
 * Firestore path (useMyGroups) remains the default and the authority.
 */
export function useApiMemberships() {
  const { user } = useAuth();
  const enabled = isTiiziApiEnabled();
  return useQuery({
    queryKey: ['api-memberships', user?.uid],
    queryFn: fetchMyMemberships,
    enabled: enabled && !!user?.uid,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
