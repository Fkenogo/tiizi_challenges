import { useQuery } from '@tanstack/react-query';
import { getCompetitiveLeaderboardV2, type V2LeaderboardEntry } from '../../api/v2ChallengeApi';
import { useAuth } from '../../hooks/useAuth';
import { v2ChallengeLeaderboardKey } from './challengeQueryKeys';
import { finalizedStandingsEnabledForS3d } from './resultsView';

/**
 * S3d — frozen competitive standings for a FINALIZED Race Challenge.
 *
 * S3c deliberately disables the competitive leaderboard once a Challenge is
 * finalized (frozen truth belongs to S3d). S3d reads the same bounded route
 * exactly then: the server serves frozen `final_position` values. The query
 * is refetch-only (no `setQueryData`): final truth is never manufactured
 * client-side and always arrives through the canonical read.
 */
function apiConfigured(): boolean {
  const base = import.meta.env.VITE_TIIZI_API_BASE_URL as string | undefined;
  return typeof base === 'string' && base.trim().length > 0;
}

export function useFinalizedStandingsV2(
  challengeId: string | undefined,
  challengeType: string | undefined,
  finalized: boolean,
) {
  const { user } = useAuth();
  return useQuery<{ challengeId: string; challengeType: string; entries: V2LeaderboardEntry[] }>({
    queryKey: v2ChallengeLeaderboardKey(challengeId, user?.uid),
    queryFn: () => getCompetitiveLeaderboardV2(challengeId as string),
    enabled: !!user?.uid
      && apiConfigured()
      && !!challengeId
      && finalizedStandingsEnabledForS3d(challengeType, finalized),
    staleTime: 10 * 1000,
  });
}
