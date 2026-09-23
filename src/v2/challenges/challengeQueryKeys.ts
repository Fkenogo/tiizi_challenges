import type { QueryClient } from '@tanstack/react-query';
import { V2_GROUP_CHALLENGES_SCOPE } from '../groups/groupQueryKeys';

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

/**
 * S3c — canonical cache family scope for the collective contributor
 * projection (`GET /v1/challenges/:id/contributors`).
 */
export const V2_CHALLENGE_CONTRIBUTORS_SCOPE = 'v2-challenge-contributors';

/**
 * S3c — canonical cache family scope for the competitive leaderboard
 * (`GET /v1/challenges/:id/leaderboard`) as consumed by V2 S3c screens.
 */
export const V2_CHALLENGE_LEADERBOARD_SCOPE = 'v2-challenge-leaderboard';

/** Legacy family scopes (V1-shell hooks). Deprecated — invalidated only. */
export const V2_LEGACY_CHALLENGE_LIST_SCOPE = 'v2-challenges';
export const V2_LEGACY_CHALLENGE_SCOPE = 'v2-challenge';
export const V2_LEGACY_LEADERBOARD_SCOPE = 'v2-leaderboard';

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

/** S3c — canonical key for one Challenge contributor projection. */
export function v2ChallengeContributorsKey(
  challengeId: string | undefined,
  uid: string | undefined,
): [string, string | undefined, string | undefined] {
  return [V2_CHALLENGE_CONTRIBUTORS_SCOPE, challengeId, uid];
}

/** S3c — canonical key for one Challenge competitive leaderboard read. */
export function v2ChallengeLeaderboardKey(
  challengeId: string | undefined,
  uid: string | undefined,
): [string, string | undefined, string | undefined] {
  return [V2_CHALLENGE_LEADERBOARD_SCOPE, challengeId, uid];
}

/**
 * S3a success boundary (extended by S3b/S3c/S4a): mark every V2 Challenge
 * list/detail read stale after a successful join/withdraw/log — canonical
 * AND legacy families, plus the S3c contributor/leaderboard reads and the
 * S4a Group-hosted-Challenge family (a Home showing hosted Challenges must
 * never serve a pre-join snapshot after acting elsewhere).
 * Never injects participation state client-side; the next read re-proves
 * `myParticipation` and progress from the server.
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
    queryClient.invalidateQueries({ queryKey: [V2_LEGACY_LEADERBOARD_SCOPE] }),
    // S3c live-progress families (same contract — no independent family).
    queryClient.invalidateQueries({
      queryKey:
        challengeId === undefined
          ? [V2_CHALLENGE_CONTRIBUTORS_SCOPE]
          : [V2_CHALLENGE_CONTRIBUTORS_SCOPE, challengeId],
    }),
    queryClient.invalidateQueries({
      queryKey:
        challengeId === undefined
          ? [V2_CHALLENGE_LEADERBOARD_SCOPE]
          : [V2_CHALLENGE_LEADERBOARD_SCOPE, challengeId],
    }),
    // S4a Group-hosted-Challenge family (same contract — no independent family).
    queryClient.invalidateQueries({ queryKey: [V2_GROUP_CHALLENGES_SCOPE] }),
  ];
  await Promise.all(tasks);
}
