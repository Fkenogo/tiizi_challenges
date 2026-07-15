/**
 * Thin compatibility shim — delegates entirely to the canonical resolver.
 *
 * All new code should import from challengeProgressResolver.ts directly.
 * This file exists so that existing callers (useHomeScreen.ts) continue to work
 * without a separate migration step.
 */

export { safeNum } from './challengeProgressResolver';
export type { ResolvedProgress } from './challengeProgressResolver';
import { resolveChallengeProgress } from './challengeProgressResolver';

export type ChallengeProgressDisplay = {
  primaryLabel: string;
  secondaryLabel?: string;
  /** Bar width: 0–100, always derived from the same source as primaryLabel. */
  progress: number;
  isUserCompleted: boolean;
};

type ChallengeSnapshot = {
  challengeType?: 'collective' | 'competitive' | 'streak';
  activities?: Array<{ targetValue?: number; unit?: string }>;
  groupCurrentTotal?: number;
  groupCumulativeTarget?: number;
  requiredConsecutiveDays?: number;
  durationDays?: number;
};

type MembershipSnapshot = {
  completionRate: number;
  cumulativeLoggedValue: number;
  currentStreak: number;
  status?: string;
};

/** Delegates to resolveChallengeProgress; returns the subset used by home cards. */
export function buildChallengeProgress(
  challenge: ChallengeSnapshot,
  membership: MembershipSnapshot | null,
  leaderboard?: Array<{ userId: string; score: number }>,
  currentUserId?: string,
  activitySummaryTotal?: number,
  priorTeamTotal?: number,
): ChallengeProgressDisplay {
  const resolved = resolveChallengeProgress({
    challenge,
    membership,
    leaderboard,
    currentUserId,
    activitySummaryTotal,
    priorTeamTotal: priorTeamTotal ?? challenge.groupCurrentTotal,
  });
  return {
    primaryLabel: resolved.primaryLabel,
    secondaryLabel: resolved.secondaryLabel,
    progress: resolved.progressPercent,
    isUserCompleted: resolved.isUserCompleted,
  };
}
