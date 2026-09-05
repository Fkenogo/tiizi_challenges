export interface SortableLeaderboardRow {
  totalPoints: number;
  completionRate: number;
  currentStreak: number;
  longestStreak: number;
  cumulativeLoggedValue: number;
}

/**
 * Engine-specific leaderboard sort — identical rules used by both
 * ChallengeLeaderboardScreen and the mini-leaderboard in ChallengeDetailScreen.
 *
 * v2 only:
 * Competitive: completionRate DESC → totalPoints DESC
 * Collective:  cumulativeLoggedValue DESC
 * Streak challenges do not produce ranked leaderboard rows (personal results only).
 *
 * Non-v2/unsupported challenges are never rendered (see the "not supported"
 * states in ChallengeDetailScreen/ChallengeLeaderboardScreen) — rows are
 * returned unsorted rather than computing a legacy points-based ranking.
 */
export function sortLeaderboardRows<T extends SortableLeaderboardRow>(
  rows: T[],
  engineVersion: string | undefined,
  challengeType: string | undefined,
): T[] {
  const isV2 = engineVersion === 'v2';

  if (isV2 && challengeType === 'collective') {
    return [...rows].sort((a, b) => b.cumulativeLoggedValue - a.cumulativeLoggedValue);
  }
  if (isV2 && challengeType === 'competitive') {
    return [...rows].sort((a, b) =>
      b.completionRate !== a.completionRate
        ? b.completionRate - a.completionRate
        : b.totalPoints - a.totalPoints,
    );
  }
  return rows;
}
