import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../api/apiClient';
import {
  fetchActivityShareState,
  fetchChallengeFeed,
  publishActivityShare,
  withdrawActivityShare,
  type ActivityShareState,
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

export function v2ChallengeFeedKey(uid: string | undefined, challengeId: string, limit: number) {
  return [V2_CHALLENGE_FEED_SCOPE, uid, challengeId, limit] as const;
}

export function v2ActivityShareStateKey(uid: string | undefined, challengeId: string, activityEventId: string) {
  return [V2_CHALLENGE_FEED_SCOPE, uid, challengeId, 'share-state', activityEventId] as const;
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

/**
 * The owner's EXACT current Share state for one source Activity, from the
 * server's dedicated state read. `null` means the server answered and there
 * is no Share; an error is surfaced so the UI can refuse to guess.
 */
export function useV2ActivityShareState(challengeId: string, activityEventId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: v2ActivityShareStateKey(user?.uid, challengeId, activityEventId),
    queryFn: async (): Promise<ActivityShareState | null> => {
      if (!user) throw new Error('Share state requires an authenticated member');
      try {
        return await fetchActivityShareState(challengeId, activityEventId, await user.getIdToken());
      } catch (error) {
        // "No Share row exists for this owner" is the ONLY 404 that means
        // "not shared" — its code is unknown_activity. An audience denial
        // (unknown_challenge) or any outage propagates so the UI never
        // guesses a hidden state as unshared.
        if (error instanceof ApiError && error.status === 404 && error.code === 'unknown_activity') {
          return null;
        }
        throw error;
      }
    },
    enabled: Boolean(user && challengeId && activityEventId),
  });
}

/**
 * Refetch every mounted Challenge Feed page and Share-state read after a
 * publication or withdrawal, so the Feed view and the sharing panel agree
 * with the server instead of showing stale cache.
 */
export function invalidateV2ChallengeFeed(queryClient: QueryClient): Promise<void> {
  // Cancel any in-flight reads first: an initial fetch started before a
  // mutation would otherwise land afterwards and be marked fresh, leaving
  // the pre-mutation response in place.
  void queryClient.cancelQueries({ queryKey: [V2_CHALLENGE_FEED_SCOPE] });
  return queryClient.invalidateQueries({ queryKey: [V2_CHALLENGE_FEED_SCOPE] });
}

/** Publish (or idempotently confirm) the caller's own explicit choice. */
export function useV2PublishActivityShare(challengeId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      activityEventId: string;
      clientKey: string;
      previewedValue: number;
      previewedUnit: string;
      expectedGeneration: number;
    }): Promise<ActivityShareState> => {
      if (!user) throw new Error('Sharing requires an authenticated member');
      return publishActivityShare(challengeId, input, await user.getIdToken());
    },
    onSuccess: async () => {
      await invalidateV2ChallengeFeed(queryClient);
    },
    onError: async (error) => {
      if (error instanceof ApiError && error.status === 409) {
        await invalidateV2ChallengeFeed(queryClient);
      }
    },
  });
}

/** Withdraw the caller's own Share; never touches the canonical Activity. */
export function useV2WithdrawActivityShare(challengeId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (activityEventId: string): Promise<ActivityShareState> => {
      if (!user) throw new Error('Withdrawing a Share requires an authenticated member');
      return withdrawActivityShare(challengeId, activityEventId, await user.getIdToken());
    },
    onSuccess: async () => {
      await invalidateV2ChallengeFeed(queryClient);
    },
  });
}
