import type { QueryClient } from '@tanstack/react-query';
import { invalidateV2Memberships } from '../memberships/membershipQueryKeys';

/**
 * TIIZI S4a — canonical V2 Group read query-key contract.
 *
 * Single source of truth for Group Home reads, mirroring the membership
 * contract (`src/v2/memberships/membershipQueryKeys.ts`) and the Challenge
 * contract (`src/v2/challenges/challengeQueryKeys.ts`):
 *
 * - detail scope `v2-group-detail` + groupId + uid (`GET /v1/groups/:groupId`);
 * - hosted-challenges scope `v2-group-challenges` + groupId + uid
 *   (`GET /v1/challenges?groupId=`);
 * - the authenticated uid isolates each signed-in user's entries;
 * - array literals must never be repeated in hooks: build keys only through
 *   `v2GroupDetailKey` / `v2GroupChallengesKey`, invalidate only through
 *   `invalidateV2GroupReads` (plus the Challenge contract, which also covers
 *   the hosted-challenges family after join/withdraw/log/establish).
 */

/** Canonical cache family scope for one Group detail read. */
export const V2_GROUP_DETAIL_SCOPE = 'v2-group-detail';

/** Canonical cache family scope for one Group's hosted Challenges. */
export const V2_GROUP_CHALLENGES_SCOPE = 'v2-group-challenges';

/** Canonical key for one Group detail read. */
export function v2GroupDetailKey(
  groupId: string | undefined,
  uid: string | undefined,
): [string, string | undefined, string | undefined] {
  return [V2_GROUP_DETAIL_SCOPE, groupId, uid];
}

/** Canonical key for one Group's hosted-Challenge read. */
export function v2GroupChallengesKey(
  groupId: string | undefined,
  uid: string | undefined,
): [string, string | undefined, string | undefined] {
  return [V2_GROUP_CHALLENGES_SCOPE, groupId, uid];
}

/**
 * S4a success boundary: mark the Group Home reads stale (and the
 * memberships family, whose relationship projection they share) so the
 * server re-proves them on the next read. Never injects Group, membership,
 * count, or Challenge state client-side.
 */
export async function invalidateV2GroupReads(
  queryClient: QueryClient,
  uid?: string,
  groupId?: string,
): Promise<void> {
  const detailKey =
    groupId === undefined
      ? [V2_GROUP_DETAIL_SCOPE]
      : uid === undefined
        ? [V2_GROUP_DETAIL_SCOPE, groupId]
        : v2GroupDetailKey(groupId, uid);
  const challengesKey =
    groupId === undefined
      ? [V2_GROUP_CHALLENGES_SCOPE]
      : uid === undefined
        ? [V2_GROUP_CHALLENGES_SCOPE, groupId]
        : v2GroupChallengesKey(groupId, uid);
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: detailKey }),
    queryClient.invalidateQueries({ queryKey: challengesKey }),
    invalidateV2Memberships(queryClient, uid),
  ]);
}
