/**
 * Challenge Engine — Shared Types
 *
 * Integrated into workoutService.createWorkout + wellnessLogService.writeLog.
 * Only the v2 engine is supported — legacy (v1) challenges were removed in
 * Phase 5 (pre-beta legacy cleanup) and are rejected before an engine is selected.
 *
 * See: docs/architecture/challenge-engine-spec.md
 */

export type EngineVersion = 'v2';

export type ChallengeType = 'collective' | 'competitive' | 'streak';

export type TargetType = 'daily' | 'cumulative' | 'group-pool';

/** Per-activity configuration passed to the engine. Mirrors Challenge.activities[] shape. */
export interface ActivityConfig {
  exerciseId?: string;
  activityId?: string;
  activityType?: string;
  exerciseName?: string;
  targetValue: number;
  unit: string;
  frequency?: 'daily' | 'weekly' | '2x-week' | '3x-week' | '5x-week' | 'custom';
  dailyFrequency?: number;
  // v2 additive fields (undefined = not yet set on this challenge)
  activityTargetType?: TargetType;
  activityCumulativeTarget?: number;
}

/**
 * All challenge metadata the engine needs to compute a log update.
 * Constructed by the service layer from the Firestore challenge document.
 */
export interface ChallengeContext {
  challengeId: string;
  challengeType: ChallengeType;
  engineVersion: EngineVersion;
  targetType: TargetType;
  durationDays: number;
  activities: ActivityConfig[];
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  // Collective-only
  groupCumulativeTarget?: number;
  autoCompleteOnGroupTarget?: boolean;
  // Streak-only
  requiredConsecutiveDays?: number;
  streakResetOnMiss?: boolean;
}

/**
 * Current state of a challengeMembers document.
 * Passed into the engine; the engine never reads Firestore directly.
 */
export interface MembershipSnapshot {
  userId: string;
  challengeId: string;
  status: 'active' | 'completed' | 'abandoned';
  activitiesCompleted: number;
  totalActivities: number;
  completionRate: number;
  totalPoints: number;
  lastActivityAt?: Date;
  completedAt?: Date;
  // v2 fields — undefined for v1 memberships
  cumulativeLoggedValue?: number;
  /** Per-activity cumulative values map — keyed by activityId/exerciseId. CompetitiveEngine v2. */
  cumulativeValues?: Record<string, number>;
  lastLogDate?: string; // YYYY-MM-DD
  currentStreak?: number;
  longestStreak?: number;
  /** Set of activity IDs completed on the current streak day. Streak v2 ALL-requirements. */
  dailyCompletedActivities?: string[];
  /** The date these daily completions belong to. Resets when date changes. */
  dailyTargetDate?: string; // YYYY-MM-DD
  engineVersion?: 'v2';
}

/**
 * A single log event after scoring has already been applied.
 * pointsEarned is computed by computeActivityScore before the engine is called.
 */
export interface LogEvent {
  userId: string;
  challengeId: string;
  activityId: string;
  value: number;
  unit: string;
  /** YYYY-MM-DD — the calendar day in the user's local timezone. */
  date: string;
  loggedAt: Date;
  /** Pre-computed by computeActivityScore before engine invocation. */
  pointsEarned: number;
}

/**
 * What the service layer must write to Firestore after calling computeUpdate().
 * The engine is pure — it returns a result, the service applies it via batch.
 */
export interface EngineResult {
  /**
   * Fields to merge into challengeMembers/{challengeId}_{userId}.
   * Always includes activitiesCompleted, totalPoints, lastActivityAt.
   * v2 engines add type-specific fields (currentStreak, cumulativeLoggedValue, etc.).
   */
  membershipUpdate: {
    activitiesCompleted: number;
    totalPoints: number;
    completionRate: number;
    lastActivityAt: Date;
    status?: 'completed';
    completedAt?: Date;
    // Streak v2 fields
    currentStreak?: number;
    longestStreak?: number;
    lastLogDate?: string;
    /** Updated set of activity IDs completed on the current streak day. */
    dailyCompletedActivities?: string[];
    /** Date for the daily completion tracking. */
    dailyTargetDate?: string;
    // Competitive v2 fields
    cumulativeLoggedValue?: number;
    /** Per-activity cumulative values map. Written by CompetitiveEngine v2. */
    cumulativeValues?: Record<string, number>;
    engineVersion?: 'v2';
  };

  /**
   * Fields to merge into challenges/{challengeId}.
   * Only populated by CollectiveEngine — uses FieldValue.increment on groupCurrentTotal.
   * undefined = no challenge document update needed.
   */
  challengeUpdate?: {
    /** Delta to add to groupCurrentTotal via FieldValue.increment. NOT the new total. */
    groupCurrentTotalDelta: number;
  };

  /**
   * True when the completion condition is met.
   * When true, the service layer must also set:
   *   membershipUpdate.status = 'completed'
   *   membershipUpdate.completedAt = now
   * For CollectiveEngine, the service must additionally cascade to the challenge document
   * and all other active memberships.
   */
  isCompleted: boolean;

  /** Human-readable completion reason for analytics/logging. */
  completionReason?: string;
}

/**
 * The contract every engine must satisfy.
 * computeUpdate is a pure function: same inputs → same output, no side effects.
 */
export interface ChallengeEngine {
  /**
   * Compute what the service layer must write after a single log event.
   *
   * @param context     - Immutable challenge configuration
   * @param membership  - Current member state (read from Firestore before calling)
   * @param logEvent    - The log being processed (with pre-computed pointsEarned)
   * @param challengeSnapshot - Optional challenge-level state (required by CollectiveEngine)
   */
  computeUpdate(
    context: ChallengeContext,
    membership: MembershipSnapshot,
    logEvent: LogEvent,
    challengeSnapshot?: { groupCurrentTotal?: number },
  ): EngineResult;
}
