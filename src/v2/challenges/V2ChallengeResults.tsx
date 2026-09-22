import type { V2ChallengeDetail } from '../../api/v2ChallengeApi';
import type { V2ChallengeEndState } from './challengeEndState';
import { V2FinalizedCollectiveResult } from './V2FinalizedCollectiveResult';
import { V2FinalizedCompetitiveResult } from './V2FinalizedCompetitiveResult';
import { V2FinalizedStreakResult } from './V2FinalizedStreakResult';
import { V2ResultsPendingCard } from './V2ResultsPendingCard';

/**
 * S3d — terminal-state router for the Challenge detail progress slot.
 *
 * - 'ended-pending' → neutral "results are being confirmed" (never fabricated
 *   results, live standings or live streak presented as final);
 * - 'finalized'     → sealed, type-specific results:
 *     Together → final group total + contributions;
 *     Race     → final position + frozen standings;
 *     Streak   → personal days completed / best / Final Streak.
 *
 * The 'live' state is handled by the caller (the existing S3c surfaces). All
 * content comes from sealed authority; nothing is computed here.
 */
export function V2ChallengeResults({
  detail,
  endState,
}: {
  detail: V2ChallengeDetail;
  endState: V2ChallengeEndState;
}) {
  if (endState === 'ended-pending') return <V2ResultsPendingCard detail={detail} />;
  if (detail.challengeType === 'collective') return <V2FinalizedCollectiveResult detail={detail} />;
  if (detail.challengeType === 'competitive') return <V2FinalizedCompetitiveResult detail={detail} />;
  return <V2FinalizedStreakResult detail={detail} />;
}
