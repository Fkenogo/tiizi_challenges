import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { fetchTodayProjection, type V2TodayProjection } from '../../api/todayApi';
import { v2TodayKey } from './todayQueryKeys';

export { v2TodayKey, invalidateV2Today, V2_TODAY_SCOPE } from './todayQueryKeys';

/**
 * S5b — the member's Today projection (`GET /api/today`).
 *
 * One authenticated server read. The hook performs no derivation of domain
 * truth: it does not compute the governing day, streak state, progress,
 * ranking, or joinability. Disabled until a member is signed in, so
 * unauthenticated visits never issue the request.
 */
export function useV2Today() {
  const { user } = useAuth();
  return useQuery<V2TodayProjection>({
    queryKey: v2TodayKey(user?.uid),
    queryFn: () => fetchTodayProjection(),
    enabled: !!user,
  });
}
