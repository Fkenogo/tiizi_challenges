import { useInfiniteQuery } from '@tanstack/react-query';
import { ApiError } from '../../api/apiClient';
import { fetchGroupFeedPage } from '../../api/groupFeedApi';
import { useAuth } from '../../hooks/useAuth';
import { v2GroupFeedKey } from './groupFeedQueryKeys';

export function useV2GroupFeed(groupId: string | null, enabled = true, preview = false) {
  const { user } = useAuth();
  const limit = preview ? 3 : undefined;
  return useInfiniteQuery({
    queryKey: [...v2GroupFeedKey(groupId ?? undefined, user?.uid), preview ? 'preview' : 'full'],
    queryFn: async ({ pageParam }) => {
      const page = await fetchGroupFeedPage(groupId as string, {
        ...(limit !== undefined ? { limit } : {}),
        ...(pageParam ? { cursor: pageParam } : {}),
      });
      if (page.groupId !== groupId) throw new ApiError(404, 'group_feed_unavailable', 'Group activity is unavailable');
      return page;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!user && !!groupId && enabled,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    retry: (failureCount, error) => {
      const code = String((error as { code?: string } | null)?.code ?? '');
      return code !== 'invalid_cursor' && failureCount < 1;
    },
  });
}
