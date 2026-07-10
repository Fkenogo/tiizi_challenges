/**
 * Legacy Engine — v1 behavior wrapper
 *
 * Preserves the existing completion model for all challenges where
 * engineVersion is undefined or not 'v2':
 *   activitiesCompleted++ (capped at totalActivities)
 *   completionRate = activitiesCompleted / totalActivities × 100
 *   isCompleted = completionRate >= 100
 *
 * Wired in Phase 11C via selectEngine() for all challenges where engineVersion !== 'v2'.
 *
 * See: docs/architecture/challenge-engine-spec.md — "Shared Engine Interface"
 */

import type { ChallengeContext, ChallengeEngine, EngineResult, LogEvent, MembershipSnapshot } from './types';

export class LegacyEngine implements ChallengeEngine {
  computeUpdate(
    context: ChallengeContext,
    membership: MembershipSnapshot,
    logEvent: LogEvent,
  ): EngineResult {
    const totalActivities = membership.totalActivities;

    const alreadyCompleted = membership.activitiesCompleted ?? 0;
    const nextCompleted = Math.min(alreadyCompleted + 1, totalActivities);
    const nextRate = Math.min(100, Math.round((nextCompleted / Math.max(1, totalActivities)) * 100));
    const isCompleted = nextRate >= 100;

    return {
      membershipUpdate: {
        activitiesCompleted: nextCompleted,
        totalPoints: (membership.totalPoints ?? 0) + logEvent.pointsEarned,
        completionRate: nextRate,
        lastActivityAt: logEvent.loggedAt,
        ...(isCompleted ? { status: 'completed', completedAt: logEvent.loggedAt } : {}),
      },
      isCompleted,
      completionReason: isCompleted ? 'legacy_frequency_complete' : undefined,
    };
  }
}
