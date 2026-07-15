/**
 * Streak Engine — v2
 *
 * Completion model: currentStreak >= requiredConsecutiveDays
 * Progress metric:  currentStreak / requiredConsecutiveDays
 * Leaderboard:      sorted by currentStreak descending
 *
 * Wired in Phase 11D via selectEngine() for v2 streak challenges.
 *
 * Key behaviors:
 * - Same calendar day → points earned, activitiesCompleted++, streak NOT advanced
 * - Next calendar day → streak++, lastLogDate updated
 * - Gap ≥ 2 days + streakResetOnMiss=true → currentStreak resets to 1
 * - Gap ≥ 2 days + streakResetOnMiss=false → currentStreak++
 *
 * See: docs/architecture/challenge-engine-spec.md — "Engine 1 — Streak Engine"
 */

import type { ChallengeContext, ChallengeEngine, EngineResult, LogEvent, MembershipSnapshot } from './types';

export class StreakEngine implements ChallengeEngine {
  computeUpdate(
    context: ChallengeContext,
    membership: MembershipSnapshot,
    logEvent: LogEvent,
  ): EngineResult {
    return StreakEngine.computeStreakUpdate(context, membership, logEvent);
  }

  /** Pure helper — exported for unit testing before full integration. */
  static computeStreakUpdate(
    context: ChallengeContext,
    membership: MembershipSnapshot,
    logEvent: LogEvent,
  ): EngineResult {
    const streakResetOnMiss = context.streakResetOnMiss ?? true;
    const requiredDays = context.requiredConsecutiveDays ?? context.durationDays;

    const prevLastLogDate = membership.lastLogDate ?? null;
    const prevStreak = membership.currentStreak ?? 0;
    const prevLongest = membership.longestStreak ?? 0;
    const today = logEvent.date; // YYYY-MM-DD

    let newStreak = prevStreak;

    if (prevLastLogDate === null) {
      // First log ever
      newStreak = 1;
    } else if (prevLastLogDate === today) {
      // Already logged today — do not advance streak
      newStreak = prevStreak;
    } else {
      const daysDiff = daysBetween(prevLastLogDate, today);
      if (daysDiff === 1) {
        // Consecutive day
        newStreak = prevStreak + 1;
      } else if (streakResetOnMiss) {
        // Gap — reset
        newStreak = 1;
      } else {
        // Gap but no reset policy
        newStreak = prevStreak + 1;
      }
    }

    const newLongest = Math.max(prevLongest, newStreak);
    const isCompleted = newStreak >= requiredDays;

    const alreadyCompleted = membership.activitiesCompleted ?? 0;
    const nextCompleted = Math.min(alreadyCompleted + 1, membership.totalActivities);
    const nextRate = Math.min(100, Math.round((nextCompleted / Math.max(1, membership.totalActivities)) * 100));

    return {
      membershipUpdate: {
        activitiesCompleted: nextCompleted,
        totalPoints: (membership.totalPoints ?? 0) + logEvent.pointsEarned,
        completionRate: isCompleted ? 100 : Math.min(nextRate, Math.round((newStreak / requiredDays) * 100)),
        lastActivityAt: logEvent.loggedAt,
        currentStreak: newStreak,
        longestStreak: newLongest,
        lastLogDate: today,
        engineVersion: 'v2',
        ...(isCompleted ? { status: 'completed', completedAt: logEvent.loggedAt } : {}),
      },
      isCompleted,
      completionReason: isCompleted ? `streak_complete_${newStreak}_days` : undefined,
    };
  }
}

/** Returns the number of calendar days between two YYYY-MM-DD strings. */
function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00Z`).getTime();
  const b = new Date(`${to}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}
