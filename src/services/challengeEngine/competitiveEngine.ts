/**
 * Competitive Engine — v2
 *
 * Completion model: every required activity reaches 100% of its cumulative target.
 * Progress metric:  average per-activity completion rate (each capped at 100%).
 * Leaderboard:      sorted by completionRate (or cumulativeLoggedValue) descending.
 *
 * Wired in Phase 11E via selectEngine() for v2 competitive challenges.
 *
 * Key behaviors:
 * - Each activity tracks its own cumulative value in cumulativeValues[activityId].
 * - cumulativeLoggedValue = total across all activities (analytics / backward compat).
 * - activitiesCompleted increments per log for analytics but does NOT drive completion.
 * - Completion fires individually per member; the challenge remains active for others.
 * - Activities with targetValue = 0 are excluded from completion calculations.
 *
 * See: docs/architecture/challenge-engine-spec.md — "Engine 2 — Competitive Engine"
 */

import type { ChallengeContext, ChallengeEngine, EngineResult, LogEvent, MembershipSnapshot } from './types';

export class CompetitiveEngine implements ChallengeEngine {
  computeUpdate(
    context: ChallengeContext,
    membership: MembershipSnapshot,
    logEvent: LogEvent,
  ): EngineResult {
    return CompetitiveEngine.computeCompetitiveUpdate(context, membership, logEvent);
  }

  /** Pure helper — can be called directly in tests without instantiating the class. */
  static computeCompetitiveUpdate(
    context: ChallengeContext,
    membership: MembershipSnapshot,
    logEvent: LogEvent,
  ): EngineResult {
    // Update per-activity cumulative for the activity being logged
    const prevCumulativeValues: Record<string, number> = membership.cumulativeValues ?? {};
    const prevForActivity = prevCumulativeValues[logEvent.activityId] ?? 0;
    const newCumulativeValues: Record<string, number> = {
      ...prevCumulativeValues,
      [logEvent.activityId]: prevForActivity + logEvent.value,
    };

    // Total cumulative across all activities (for analytics / backward compat field)
    const newTotalCumulative = (membership.cumulativeLoggedValue ?? 0) + logEvent.value;

    // Per-activity completion rates — activities with no target are excluded
    const trackedActivities = context.activities.filter((a) => a.targetValue > 0);
    const activityRates = trackedActivities.map((act) => {
      const primaryKey = act.activityId ?? act.exerciseId ?? '';
      const fallbackKey = act.exerciseId ?? act.activityId ?? '';
      const cumVal = newCumulativeValues[primaryKey] ?? newCumulativeValues[fallbackKey] ?? 0;
      return Math.min(100, Math.round((cumVal / act.targetValue) * 100));
    });

    const numActivities = activityRates.length;
    const overallRate = numActivities > 0
      ? Math.round(activityRates.reduce((sum, r) => sum + r, 0) / numActivities)
      : 0;

    // Completion: every required activity must reach 100%
    const isCompleted = numActivities > 0 && activityRates.every((r) => r >= 100);

    // activitiesCompleted still increments for analytics (does not drive completion)
    const alreadyCompleted = membership.activitiesCompleted ?? 0;
    const nextCompleted = Math.min(alreadyCompleted + 1, membership.totalActivities);

    return {
      membershipUpdate: {
        activitiesCompleted: nextCompleted,
        totalPoints: (membership.totalPoints ?? 0) + logEvent.pointsEarned,
        completionRate: isCompleted ? 100 : overallRate,
        lastActivityAt: logEvent.loggedAt,
        cumulativeLoggedValue: newTotalCumulative,
        cumulativeValues: newCumulativeValues,
        engineVersion: 'v2',
        ...(isCompleted ? { status: 'completed', completedAt: logEvent.loggedAt } : {}),
      },
      isCompleted,
      completionReason: isCompleted ? 'competitive_complete_all_activities' : undefined,
    };
  }
}
