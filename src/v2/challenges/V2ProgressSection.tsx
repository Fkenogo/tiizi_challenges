import type { V2ChallengeDetail } from '../../api/v2ChallengeApi';
import { V2CollectiveProgress } from './V2CollectiveProgress';
import { V2CompetitiveProgress } from './V2CompetitiveProgress';
import { V2StreakProgress } from './V2StreakProgress';

/**
 * S3c — live progress / type-state section.
 *
 * Routes the V2 Challenge detail to its per-type live truth:
 * - Together / Collective → shared total + contributor rollup (no rank);
 * - Race / Competitive → own-vs-target + server leaderboard positions;
 * - Daily Streak → server-day state (never terminally complete live).
 *
 * All state shown comes from authoritative reads (detail + the bounded
 * S3c seams); the section manufactures no canonical progress. Post-log
 * convergence arrives through the shared invalidation contract
 * (`invalidateV2ChallengeReads`) and canonical refetch. Deliberately NOT
 * sealed terminal presentation (that belongs to a later slice).
 */
export function V2ProgressSection({ detail }: { detail: V2ChallengeDetail }) {
  if (detail.challengeType === 'collective') {
    return <V2CollectiveProgress detail={detail} />;
  }
  if (detail.challengeType === 'competitive') {
    return <V2CompetitiveProgress detail={detail} />;
  }
  return <V2StreakProgress detail={detail} />;
}
