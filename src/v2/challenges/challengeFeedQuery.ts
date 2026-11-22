import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import {
  fetchChallengeFeed,
  publishActivityShare,
  withdrawActivityShare,
  type ActivityShareState,
  type ChallengeFeedItem,
} from '../../api/challengeFeedApi';

/**
 * CF-3 — Challenge Feed read + withdrawal client hooks (S1 activity_shares).
 *
 * Every read rechecks Group membership and Challenge visibility on the
 * server; a 404 simply means "not visible", never a client-side hint about
 * the Challenge's existence.
 */
export const V2_CHALLENGE_FEED_SCOPE = 'v2-challenge-feed';
export const V2_CHALLENGE_FEED_PREVIEW_SIZE = 5;
export const V2_CHALLENGE_FEED_PAGE_SIZE = 20;
/** The share panel scans one bounded page for the owner's own active Share. */
export const V2_CHALLENGE_FEED_SHARE_SCAN_SIZE = 50;

export function v2ChallengeFeedKey(uid: string | undefined, challengeId: string, limit: number) {
  return [V2_CHALLENGE_FEED_SCOPE, uid, challengeId, limit] as const;
}

export function useV2ChallengeFeedPreview(challengeId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: v2ChallengeFeedKey(user?.uid, challengeId, V2_CHALLENGE_FEED_PREVIEW_SIZE),
    queryFn: async () => {
      if (!user) throw new Error('Challenge Feed requires an authenticated member');
      return fetchChallengeFeed(
        challengeId,
        await user.getIdToken(),
        { limit: V2_CHALLENGE_FEED_PREVIEW_SIZE },
      );
    },
    enabled: Boolean(user && challengeId),
  });
}

export function useV2ChallengeFeedHistory(challengeId: string) {
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: v2ChallengeFeedKey(user?.uid, challengeId, V2_CHALLENGE_FEED_PAGE_SIZE),
    queryFn: async ({ pageParam }: { pageParam?: string }) => {
      if (!user) throw new Error('Challenge Feed requires an authenticated member');
      return fetchChallengeFeed(
        challengeId,
        await user.getIdToken(),
        { limit: V2_CHALLENGE_FEED_PAGE_SIZE, cursor: pageParam },
      );
    },
    enabled: Boolean(user && challengeId),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage): string | undefined => lastPage.nextCursor ?? undefined,
  });
}

/** Find the owner's own active Share for one Activity within a bounded page. */
export function useV2OwnActivityShare(challengeId: string, activityEventId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [V2_CHALLENGE_FEED_SCOPE, user?.uid, challengeId, 'own-share', activityEventId] as const,
    queryFn: async (): Promise<ChallengeFeedItem | null> => {
      if (!user) throw new Error('Challenge Feed requires an authenticated member');
      const page = await fetchChallengeFeed(
        challengeId,
        await user.getIdToken(),
        { limit: V2_CHALLENGE_FEED_SHARE_SCAN_SIZE },
      );
      return page.items.find(
        (item) => item.ownShare && item.activityEventId === activityEventId,
      ) ?? null;
    },
    enabled: Boolean(user && challengeId && activityEventId),
  });
}

/** Invalidate every cached Challenge Feed page (publication or withdrawal). */
export function invalidateV2ChallengeFeed(queryClient: QueryClient, challengeId: string): Promise<void> {
  return Promise.resolve(
    queryClient.removeQueries({ queryKey: [V2_CHALLENGE_FEED_SCOPE] }),
  );
}

/** Publish (or idempotently confirm) the caller's own Share. */
export function useV2PublishActivityShare(challengeId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (activityEventId: string): Promise<ActivityShareState> => {
      if (!user) throw new Error('Sharing requires an authenticated member');
      return publishActivityShare(challengeId, activityEventId, await user.getIdToken());
    },
    onSuccess: async () => {
      await invalidateV2ChallengeFeed(queryClient, challengeId);
    },
  });
}

/** Withdraw the caller's own Share; never touches the canonical Activity. */
export function useV2WithdrawActivityShare(challengeId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (activityEventId: string) => {
      if (!user) throw new Error('Withdrawing a Share requires an authenticated member');
      return withdrawActivityShare(challengeId, activityEventId, await user.getIdToken());
    },
    onSuccess: async () => {
      await invalidateV2ChallengeFeed(queryClient, challengeId);
    },
  });
}
