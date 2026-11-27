import { useInfiniteQuery } from '@tanstack/react-query';
import { ApiError } from '../../api/apiClient';
import { fetchMemberTimeline } from '../../api/memberTimelineApi';
import { useAuth } from '../../hooks/useAuth';
import {
  V2_PERSONAL_TIMELINE_PAGE_SIZE,
  V2_PERSONAL_TIMELINE_SCOPE,
  invalidateV2PersonalTimeline,
  removeV2PersonalTimeline,
  v2PersonalTimelineKey,
} from './personalTimelineQueryKeys';

export {
  V2_PERSONAL_TIMELINE_PAGE_SIZE,
  V2_PERSONAL_TIMELINE_SCOPE,
  invalidateV2PersonalTimeline,
  removeV2PersonalTimeline,
  v2PersonalTimelineKey,
};

export function useV2PersonalTimelineHistory() {
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: v2PersonalTimelineKey(user?.uid, V2_PERSONAL_TIMELINE_PAGE_SIZE),
    queryFn: async ({ pageParam }) => {
      if (!user) throw new Error('Personal History requires an authenticated member');
      return fetchMemberTimeline(
        {
          limit: V2_PERSONAL_TIMELINE_PAGE_SIZE,
          ...(pageParam ? { cursor: pageParam } : {}),
        },
        await user.getIdToken(),
      );
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(user),
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        return false;
      }
      return failureCount < 1;
    },
  });
}
