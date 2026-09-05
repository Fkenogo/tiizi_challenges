/**
 * Streak Engine — v2 (ALL-daily-requirements)
 *
 * Completion model: currentStreak >= requiredConsecutiveDays
 * Progress metric:  currentStreak / requiredConsecutiveDays
 *
 * A Challenge day counts as Done ONLY when ALL configured daily Activity
 * requirements have been logged for that calendar day:
 * - one completed requirement out of several MUST NOT advance Current Streak;
 * - excess quantity on one requirement cannot compensate for another missing;
 * - ALL configured requirements complete advances the day exactly once;
 * - repeated logs MUST NOT double-advance the same Challenge day;
 * - a missed day resets Current Streak (streakResetOnMiss=true) to 1 — the
 *   new valid day starts a fresh streak; the Participant remains in the
 *   Challenge (status is never changed by a reset) and later valid days
 *   keep building the new streak;
 * - no ordinary late-logging grace restores a missed day: the gap is measured
 *   from the last COMPLETED day, so partial-log days never bridge a miss.
 *
 * Daily completion boundary:
 * - membership.dailyCompletedActivities + dailyTargetDate track which
 *   requirement IDs were logged on the current streak day. The set resets
 *   when the calendar day changes.
 * - membership.lastLogDate records the last COMPLETED day only (never a
 *   partial-log day), so gap detection (daysBetween) always measures from
 *   the last day the streak actually advanced.
 * - challenges with no configured activity requirements fall back to legacy
 *   day-based behavior: any log completes the day.
 *
 * See: docs/programme/STAGE-F-TIIZI-V2-KNOWLEDGE-RUNTIME-CONTRACT-DRAFT.md
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

    // Last COMPLETED day (never a partial-log day).
    const prevLastLogDate = membership.lastLogDate ?? null;
    const prevStreak = membership.currentStreak ?? 0;
    const prevLongest = membership.longestStreak ?? 0;
    const today = logEvent.date; // YYYY-MM-DD

    // Configured daily requirement IDs.
    const requiredActivityIds = new Set(
      context.activities
        .map((a) => a.activityId ?? a.exerciseId)
        .filter((id): id is string => !!id),
    );
    const requirementsConfigured = requiredActivityIds.size > 0;

    // Today's accumulated completions (reset when the day changes).
    const prevDailyDate = membership.dailyTargetDate ?? null;
    const prevDailyCompleted = new Set(membership.dailyCompletedActivities ?? []);
    const dailyCompleted =
      prevDailyDate === today ? new Set(prevDailyCompleted) : new Set<string>();
    const loggedActivityId = logEvent.activityId;
    if (loggedActivityId) {
      dailyCompleted.add(loggedActivityId);
    }

    // The day is Done only when EVERY configured requirement is logged.
    // With no configured requirements, any log completes the day (legacy).
    const allRequirementsMet =
      !requirementsConfigured ||
      [...requiredActivityIds].every((id) => dailyCompleted.has(id));
    // The day was already Done before this log → never advance twice.
    const wereAllMetBefore = requirementsConfigured
      ? prevDailyDate === today &&
        [...requiredActivityIds].every((id) => prevDailyCompleted.has(id))
      : prevLastLogDate === today;

    let newStreak = prevStreak;
    if (allRequirementsMet && !wereAllMetBefore) {
      if (prevLastLogDate === null) {
        // First completed day ever.
        newStreak = 1;
      } else {
        const daysDiff = daysBetween(prevLastLogDate, today);
        if (daysDiff <= 0) {
          // Same-day completion recorded through an inconsistent state —
          // never advance twice.
          newStreak = prevStreak;
        } else if (daysDiff === 1) {
          // Consecutive completed day.
          newStreak = prevStreak + 1;
        } else if (streakResetOnMiss) {
          // Missed day(s) — reset; this valid day starts a new streak.
          // Status is untouched: the participant remains in the Challenge.
          newStreak = 1;
        } else {
          // Gap but no reset policy — streak continues.
          newStreak = prevStreak + 1;
        }
      }
    }
    // Requirements not fully met, or day already counted → streak does NOT advance.

    const newLongest = Math.max(prevLongest, newStreak);
    const isCompleted = newStreak >= requiredDays;

    const alreadyCompleted = membership.activitiesCompleted ?? 0;
    const nextCompleted = Math.min(alreadyCompleted + 1, membership.totalActivities);
    const nextRate = Math.min(100, Math.round((nextCompleted / Math.max(1, membership.totalActivities)) * 100));

    // lastLogDate advances ONLY on a completed day. On partial days the key is
    // omitted so merge-writes never poison gap detection (and never write
    // Firestore-illegal `undefined` values).
    const completedDateUpdate = allRequirementsMet ? { lastLogDate: today } : {};

    return {
      membershipUpdate: {
        activitiesCompleted: nextCompleted,
        totalPoints: (membership.totalPoints ?? 0) + logEvent.pointsEarned,
        completionRate: isCompleted ? 100 : Math.min(nextRate, Math.round((newStreak / requiredDays) * 100)),
        lastActivityAt: logEvent.loggedAt,
        currentStreak: newStreak,
        longestStreak: newLongest,
        ...completedDateUpdate,
        dailyCompletedActivities: [...dailyCompleted],
        dailyTargetDate: today,
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
