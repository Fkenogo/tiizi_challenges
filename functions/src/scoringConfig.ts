/**
 * Scoring engine — functions copy.
 * Kept in sync with src/services/scoringConfig.ts.
 * Cloud Functions use NodeNext module resolution and cannot import from the
 * client src/ tree, so this file is a standalone duplicate.
 * When updating scoring logic, update both files identically.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChallengeType = 'collective' | 'competitive' | 'streak';

export type ScoringMethod =
  | 'proportional_capped'  // all types: score ∝ min(value/target, 1) × 100, hard-capped at 100 pts
  | 'fixed'                // fallback when no targetValue is defined
  // legacy values kept for backwards-compat with stored data — no longer emitted by new code:
  | 'proportional'
  | 'competitive_value'
  | 'binary'
  | 'streak_binary';

export type ScoringResult = {
  pointsEarned: number;
  rawValue: number;
  targetValue: number;
  metTarget: boolean;
  scoringMethod: ScoringMethod;
  capped: boolean;
  reason: string;
};

export type ScoringInput = {
  value: number;
  targetValue: number;
  challengeType: ChallengeType;
  /** Intentionally ignored — system owns point calculation. */
  clientProvidedPoints?: number;
};

export type ActivityScoringEntry = ScoringInput & { activityId: string };

export type SessionScoringResult = {
  totalPointsEarned: number;
  activities: Array<{ activityId: string; result: ScoringResult }>;
  allTargetsMet: boolean;
};

// ─── Constants ────────────────────────────────────────────────────────────────

export const SCORING_CONSTANTS = {
  BASE_POINTS_PER_TARGET: 100,

  // Below 5 % of target → 0 pts. Prevents gaming via 1-rep logs.
  MIN_EFFORT_RATIO: 0.05,
} as const;

// ─── Unified scorer ───────────────────────────────────────────────────────────

/**
 * Compute the points a single activity log should earn.
 * Formula: round(min(value / dailyTargetValue, 1) × 100), capped at 100.
 * Applies uniformly to all challenge types (collective, competitive, streak).
 */
export function computeActivityScore(input: ScoringInput): ScoringResult {
  const { value, targetValue } = input;

  if (targetValue <= 0) {
    return {
      pointsEarned: SCORING_CONSTANTS.BASE_POINTS_PER_TARGET,
      rawValue: value,
      targetValue: 0,
      metTarget: value > 0,
      scoringMethod: 'fixed',
      capped: false,
      reason: 'no_target_defined',
    };
  }

  const ratio = value / targetValue;

  if (ratio <= SCORING_CONSTANTS.MIN_EFFORT_RATIO) {
    return {
      pointsEarned: 0,
      rawValue: value,
      targetValue,
      metTarget: false,
      scoringMethod: 'proportional_capped',
      capped: false,
      reason: 'below_minimum_effort',
    };
  }

  const cappedRatio = Math.min(ratio, 1);
  const metTarget = ratio >= 1.0;
  const pointsEarned = Math.round(cappedRatio * SCORING_CONSTANTS.BASE_POINTS_PER_TARGET);

  return {
    pointsEarned,
    rawValue: value,
    targetValue,
    metTarget,
    scoringMethod: 'proportional_capped',
    capped: ratio > 1,
    reason: metTarget ? 'target_met' : 'partial',
  };
}

// ─── Multi-activity session scorer ───────────────────────────────────────────

export function computeSessionScore(entries: ActivityScoringEntry[]): SessionScoringResult {
  const activities = entries.map((entry) => ({
    activityId: entry.activityId,
    result: computeActivityScore(entry),
  }));
  const totalPointsEarned = activities.reduce(
    (sum, item) => sum + item.result.pointsEarned,
    0,
  );
  const allTargetsMet = activities.every((item) => item.result.metTarget);
  return { totalPointsEarned, activities, allTargetsMet };
}
