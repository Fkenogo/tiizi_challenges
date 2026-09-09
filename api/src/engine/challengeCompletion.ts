/**
 * Returns the total number of log events required to complete a challenge.
 * A multi-day streak challenge requires durationDays × activitiesPerDay completions,
 * not just one completion per activity type.
 */
export function computeRequiredLogs(
  durationDays: number | null | undefined,
  activityCount: number,
): number {
  const days = Math.max(1, Number(durationDays) || 1);
  const activities = Math.max(1, activityCount);
  return days * activities;
}

/**
 * Returns the effective per-session target value for scoring.
 *
 * Streak challenges sometimes store targetValue as the full-duration cumulative total
 * (e.g. 50 reps/day × 21 days = 1050).  A user logging 50 reps should meet the daily
 * target, not score 0 against 1050.
 *
 * When an activity carries explicit `targetType` metadata ('daily' | 'cumulative'), that
 * takes precedence — no heuristic needed.  When targetType is absent, the legacy
 * divide-and-clamp heuristic is used as a fallback so existing templates are unaffected.
 *
 * Non-streak challenges always use targetValue as-is (collective/competitive challenges
 * define their own per-session targets).
 */
export function deriveDailyTargetValue(
  targetValue: number,
  durationDays: number | null | undefined,
  challengeType: string,
  targetType?: 'daily' | 'cumulative',
): number {
  if (challengeType !== 'streak') return targetValue;

  // Explicit metadata path — no ambiguity.
  if (targetType === 'daily') return targetValue;
  if (targetType === 'cumulative') {
    const days = Math.max(1, Number(durationDays) || 1);
    return days <= 1 ? targetValue : targetValue / days;
  }

  // Heuristic fallback for existing templates without targetType.
  const days = Math.max(1, Number(durationDays) || 1);
  if (days <= 1) return targetValue;
  const derived = targetValue / days;
  return derived >= 1 ? derived : targetValue;
}
