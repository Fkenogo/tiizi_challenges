import type { QueryClient } from '@tanstack/react-query';

/**
 * S3a — canonical V2 Challenge query-key contract
 * (TIIZI-S3A-PARTICIPATION-ACCESS-001).
 *
 * Single source of truth for the V2 Challenge list/detail cache family
 * consumed by the S2b creation journey (`src/v2/challenges/*`) and the
 * S3a participation/access UX on the same screens. Mirrors the S2-G
 * membership contract (`src/v2/memberships/membershipQueryKeys.ts`).
 *
 * Before this contract two parallel families existed for the same
 * participation truth:
 * - canonical S2b screens: `v2-challenge-list` / `v2-challenge-detail`;
 * - legacy V1-shell hooks (`src/hooks/useV2Challenges.ts`):
 *   `v2-challenges` / `v2-challenge` (+ `v2-leaderboard`).
 *
 * A join/withdraw mutation invalidating only one family left the other
 * stale for up to its staleTime — a repeat of the S2-G/S2b stale-cache
 * defect. Participation mutations must invalidate through
 * `invalidateV2ChallengeReads` so BOTH families are marked stale; every
 * refetch remains authenticated server truth (`GET /v1/challenges`,
 * `GET /v1/challenges/:id`). No client-derived participation state is
 * ever injected — invalidation only marks entries stale.
 *
 * Key semantics:
 * - list scope `v2-challenge-list` + authenticated uid (per-user isolation);
 * - detail scope `v2-challenge-detail` + challengeId + uid;
 * - array literals must never be repeated in hooks: build keys only
 *   through `v2ChallengeListKey` / `v2ChallengeDetailKey`, invalidate
 *   only through `invalidateV2ChallengeReads`.
 */

/** Canonical cache family scope for the V2 Challenge list read. */
export const V2_CHALLENGE_LIST_SCOPE = 'v2-challenge-list';

/** Canonical cache family scope for one V2 Challenge detail read. */
export const V2_CHALLENGE_DETAIL_SCOPE = 'v2-challenge-detail';

/** Legacy family scopes (V1-shell hooks). Deprecated — invalidated only. */
export const V2_LEGACY_CHALLENGE_LIST_SCOPE = 'v2-challenges';
export const V2_LEGACY_CHALLENGE_SCOPE = 'v2-challenge';

/** Canonical key for the caller's visible-Challenge list. */
export function v2ChallengeListKey(uid: string | undefined): [string, string | undefined] {
  return [V2_CHALLENGE_LIST_SCOPE, uid];
}

/** Canonical key for one Challenge detail read. */
export function v2ChallengeDetailKey(
  challengeId: string | undefined,
  uid: string | undefined,
): [string, string | undefined, string | undefined] {
  return [V2_CHALLENGE_DETAIL_SCOPE, challengeId, uid];
}

/**
 * S3a success boundary: mark every V2 Challenge list/detail read stale
 * after a successful join/withdraw — canonical AND legacy families.
 * Never injects participation state client-side; the next read re-proves
 * `myParticipation` from the server.
 */
export async function invalidateV2ChallengeReads(
  queryClient: QueryClient,
  uid?: string,
  challengeId?: string,
): Promise<void> {
  const tasks: Array<Promise<unknown>> = [
    // Canonical S2b/S3a families (prefix invalidations cover all users
    // when uid is undefined, or one member when provided).
    queryClient.invalidateQueries({
      queryKey: uid === undefined ? [V2_CHALLENGE_LIST_SCOPE] : v2ChallengeListKey(uid),
    }),
    queryClient.invalidateQueries({
      queryKey:
        challengeId === undefined
          ? [V2_CHALLENGE_DETAIL_SCOPE]
          : uid === undefined
            ? [V2_CHALLENGE_DETAIL_SCOPE, challengeId]
            : v2ChallengeDetailKey(challengeId, uid),
    }),
    // Legacy V1-shell families — invalidated so the older detail screen
    // can never serve a pre-join/pre-withdraw snapshot after S3a acts.
    queryClient.invalidateQueries({ queryKey: [V2_LEGACY_CHALLENGE_LIST_SCOPE] }),
    queryClient.invalidateQueries({
      queryKey:
        challengeId === undefined
          ? [V2_LEGACY_CHALLENGE_SCOPE]
          : [V2_LEGACY_CHALLENGE_SCOPE, challengeId],
    }),
  ];
  await Promise.all(tasks);
}
