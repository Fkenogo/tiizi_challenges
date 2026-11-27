import type { QueryClient } from '@tanstack/react-query';
import { invalidateV2ChallengeReads } from './challengeQueryKeys';
import { invalidateV2Today } from '../today/todayQueryKeys';
import { V2_RECENT_ACTIVITY_SCOPE } from '../member/recentActivityQueryKeys';
import { invalidateV2PersonalTimeline } from '../member/personalTimelineQueryKeys';

/**
 * TIIZI-FER-P3-CORR-001 — after the server ACCEPTS an activity, refresh the
 * read models that show it (the Challenge reads, Today and Personal Recent Activity).
 *
 * The refresh is a separate concern from the accepted submission: it never
 * throws, so a failing invalidation or refetch can never turn an accepted
 * outcome into an apparent failure (and so never leads to a replayed
 * submission under a new key). Query errors surface on the queries themselves
 * (e.g. Today's refresh notice with a retry that re-reads, not re-submits).
 * Nothing is patched into the cache: the server re-proves every read.
 */
export async function refreshAfterAcceptedLog(
  queryClient: QueryClient,
  uid: string | undefined,
  challengeId: string,
): Promise<{ refreshed: boolean }> {
  const results = await Promise.allSettled([
    invalidateV2ChallengeReads(queryClient, uid, challengeId),
    invalidateV2Today(queryClient, uid),
    uid
      ? queryClient.invalidateQueries({ queryKey: [V2_RECENT_ACTIVITY_SCOPE, uid] })
      : Promise.resolve(),
    uid ? invalidateV2PersonalTimeline(queryClient, uid) : Promise.resolve(),
  ]);
  return { refreshed: results.every((result) => result.status === 'fulfilled') };
}
