import type { V2DiscoverableChallenge } from '../../api/challengeDiscoveryApi';
import type { V2ChallengeSummary } from '../../api/v2ChallengeApi';

/** Explicit participation, rather than Group hosting, defines My Challenges. */
export function myJoinedChallenges(challenges: V2ChallengeSummary[]): V2ChallengeSummary[] {
  return challenges.filter((challenge) => challenge.myParticipation?.status === 'active');
}

/**
 * Combine the member's Group-visible rows with cross-Group discovery. The
 * server's relevance order is retained for discovery rows; the member's own
 * Group rows follow in their existing API order. Explicitly joined rows belong
 * in My Challenges and are omitted here.
 */
export function findChallenges(
  groupVisible: V2ChallengeSummary[],
  discoverable: V2DiscoverableChallenge[],
): V2ChallengeSummary[] {
  const joinedIds = new Set(myJoinedChallenges(groupVisible).map(({ challengeId }) => challengeId));
  const seen = new Set<string>();
  const result: V2ChallengeSummary[] = [];
  for (const challenge of [...discoverable, ...groupVisible]) {
    if (joinedIds.has(challenge.challengeId) || seen.has(challenge.challengeId)) continue;
    seen.add(challenge.challengeId);
    result.push(challenge);
  }
  return result;
}
