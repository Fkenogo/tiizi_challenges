import {
  useInfiniteQuery,
  useQuery,
  type QueryClient,
} from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { fetchMemberRecentActivity } from '../../api/memberRecentActivityApi';

import {
  V2_RECENT_ACTIVITY_PAGE_SIZE,
  V2_RECENT_ACTIVITY_PREVIEW_SIZE,
  V2_RECENT_ACTIVITY_SCOPE,
  v2RecentActivityKey,
  v2ChallengeRecentActivityKey,
} from './recentActivityQueryKeys';
export {
  V2_RECENT_ACTIVITY_PAGE_SIZE,
  V2_RECENT_ACTIVITY_PREVIEW_SIZE,
  V2_RECENT_ACTIVITY_SCOPE,
  v2ChallengeRecentActivityKey,
  v2RecentActivityKey,
};

export function useV2RecentActivityPreview() {
  const { user } = useAuth();
  return useQuery({
    queryKey: v2RecentActivityKey(user?.uid, V2_RECENT_ACTIVITY_PREVIEW_SIZE),
    queryFn: async () => {
      if (!user) throw new Error('Recent Activity requires an authenticated member');
      return fetchMemberRecentActivity(
        { limit: V2_RECENT_ACTIVITY_PREVIEW_SIZE },
        await user.getIdToken(),
      );
    },
    enabled: Boolean(user),
  });
}

/** Fetch the newest accepted contribution by the authenticated owner to one Challenge. */
export function useV2LatestChallengeActivity(challengeId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: v2ChallengeRecentActivityKey(user?.uid, challengeId),
    queryFn: async () => {
      if (!user) throw new Error('Recent Activity requires an authenticated member');
      const page = await fetchMemberRecentActivity(
        { limit: 1, challengeId },
        await user.getIdToken(),
      );
      return page.items[0] ?? null;
    },
    enabled: Boolean(user && challengeId),
  });
}


export function useV2RecentActivityHistory() {
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: v2RecentActivityKey(user?.uid, V2_RECENT_ACTIVITY_PAGE_SIZE),
    queryFn: async ({ pageParam }) => {
      if (!user) throw new Error('Recent Activity requires an authenticated member');
      return fetchMemberRecentActivity(
        {
          limit: V2_RECENT_ACTIVITY_PAGE_SIZE,
          ...(pageParam ? { cursor: pageParam } : {}),
        },
        await user.getIdToken(),
      );
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(user),
  });
}

export async function invalidateV2RecentActivity(
  queryClient: QueryClient,
  uid?: string,
): Promise<void> {
  if (!uid) return;
  await queryClient.invalidateQueries({ queryKey: [V2_RECENT_ACTIVITY_SCOPE, uid] });
}

export async function removeV2RecentActivity(
  queryClient: QueryClient,
  uid: string | undefined | null,
): Promise<void> {
  if (!uid) return;
  const queryKey = [V2_RECENT_ACTIVITY_SCOPE, uid];
  await queryClient.cancelQueries({ queryKey });
  queryClient.removeQueries({ queryKey });
}
