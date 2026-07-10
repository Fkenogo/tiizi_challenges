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
 * Legacy:      totalPoints DESC
 * Competitive: completionRate DESC → totalPoints DESC
 * Streak:      currentStreak DESC → longestStreak DESC → totalPoints DESC
 * Collective:  cumulativeLoggedValue DESC
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
  if (isV2 && challengeType === 'streak') {
    return [...rows].sort((a, b) =>
      b.currentStreak !== a.currentStreak
        ? b.currentStreak - a.currentStreak
        : b.longestStreak !== a.longestStreak
          ? b.longestStreak - a.longestStreak
          : b.totalPoints - a.totalPoints,
    );
  }
  return [...rows].sort((a, b) => b.totalPoints - a.totalPoints);
}
