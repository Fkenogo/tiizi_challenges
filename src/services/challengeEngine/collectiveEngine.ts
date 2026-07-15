/**
 * Collective Engine — v2
 *
 * Completion model: groupCurrentTotal >= groupCumulativeTarget (group-level, not individual)
 * Progress metric:  groupCurrentTotal / groupCumulativeTarget (shared pool)
 * Leaderboard:      group progress bar (primary) + individual totalPoints (secondary)
 *
 * Wired in Phase 11F via selectEngine() for v2 collective challenges.
 *
 * IMPORTANT — atomicity contract:
 *   challengeUpdate.groupCurrentTotalDelta must be applied via FieldValue.increment(),
 *   NOT by reading groupCurrentTotal and writing an absolute value.
 *   This prevents race conditions when two members log simultaneously.
 *
 * When isCompleted === true, the service layer must also:
 *   1. Update challenges/{challengeId}.status = 'completed'
 *   2. Update all active challengeMembers for this challenge → status = 'completed'
 *   (The engine handles only the triggering member's update.)
 *
 * See: docs/architecture/challenge-engine-spec.md — "Engine 3 — Collective Engine"
 */

import type { ChallengeContext, ChallengeEngine, EngineResult, LogEvent, MembershipSnapshot } from './types';

export class CollectiveEngine implements ChallengeEngine {
  computeUpdate(
    context: ChallengeContext,
    membership: MembershipSnapshot,
    logEvent: LogEvent,
    challengeSnapshot?: { groupCurrentTotal?: number },
  ): EngineResult {
    return CollectiveEngine.computeCollectiveUpdate(context, membership, logEvent, challengeSnapshot ?? {});
  }

  /** Pure helper — exported for unit testing before full integration. */
  static computeCollectiveUpdate(
    context: ChallengeContext,
    membership: MembershipSnapshot,
    logEvent: LogEvent,
    challengeSnapshot: { groupCurrentTotal?: number },
  ): EngineResult {
    const groupTarget = context.groupCumulativeTarget ?? 0;
    const prevGroupTotal = challengeSnapshot.groupCurrentTotal ?? 0;
    const estimatedNewTotal = prevGroupTotal + logEvent.value;

    // isCompleted uses the estimated total; actual Firestore total may differ slightly
    // due to concurrent writes (acceptable — FieldValue.increment handles atomicity).
    const autoComplete = context.autoCompleteOnGroupTarget ?? true;
    const isCompleted = autoComplete && groupTarget > 0 && estimatedNewTotal >= groupTarget;

    const alreadyCompleted = membership.activitiesCompleted ?? 0;
    const nextCompleted = Math.min(alreadyCompleted + 1, membership.totalActivities);
    const nextRate = Math.min(100, Math.round((nextCompleted / Math.max(1, membership.totalActivities)) * 100));

    return {
      membershipUpdate: {
        activitiesCompleted: nextCompleted,
        totalPoints: (membership.totalPoints ?? 0) + logEvent.pointsEarned,
        completionRate: nextRate,
        cumulativeLoggedValue: (membership.cumulativeLoggedValue ?? 0) + logEvent.value,
        lastActivityAt: logEvent.loggedAt,
        engineVersion: 'v2',
        ...(isCompleted ? { status: 'completed', completedAt: logEvent.loggedAt } : {}),
      },
      // Return a delta, not an absolute — caller applies via FieldValue.increment()
      challengeUpdate: {
        groupCurrentTotalDelta: logEvent.value,
      },
      isCompleted,
      completionReason: isCompleted
        ? `collective_complete_group_${estimatedNewTotal}_of_${groupTarget}`
        : undefined,
    };
  }
}
