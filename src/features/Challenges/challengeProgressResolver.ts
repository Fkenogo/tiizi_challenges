/**
 * Canonical challenge progress resolver.
 *
 * ALL screens that display challenge progress must call resolveChallengeProgress()
 * and render from its output. No screen may independently derive:
 *   - group totals / percentages
 *   - user contribution totals
 *   - streak progress
 *   - competitive gap to leader
 *   - formatted labels
 *
 * Source-of-truth decisions (documented here once):
 *   groupTotal            = max(activitySummaryTotal, memberSumContribution, logSumValue, priorTeamTotal)
 *                           Collective-only: activitySummaryTotal is the CF-maintained canonical
 *                           source (challengeActivitySummaries.totalValue, written via FieldValue.increment).
 *                           memberSumContribution and logSumValue are lower-bound floors when callers
 *                           have the full member list or raw logs.
 *                           priorTeamTotal is a legacy fallback floor (challenge.groupCurrentTotal)
 *                           for optimistic display before CF fires — a team-level value, never
 *                           the individual user's contribution. It NEVER overrides activitySummaryTotal.
 *   userContributionTotal = membership.cumulativeLoggedValue  (per-user Firestore total)
 *   sessionDelta          = caller-supplied URL param; shown as "+N today" only, NEVER added to totals
 *
 * The sessionDelta is kept separate to avoid double-counting: after a workout is logged
 * the React Query cache is invalidated and re-fetches, at which point groupCurrentTotal
 * and cumulativeLoggedValue already include the new value. Adding sessionDelta again
 * produces the "400 / 5,000 vs 200 / 5,000" discrepancy observed pre-5G.
 */

/** All the numeric inputs the resolver needs. Missing/NaN fields are coerced to 0. */
export interface ProgressInput {
  challenge: {
    challengeType?: 'collective' | 'competitive' | 'streak';
    activities?: Array<{ targetValue?: number; unit?: string }>;
    groupCurrentTotal?: number;
    groupCumulativeTarget?: number;
    requiredConsecutiveDays?: number;
    durationDays?: number;
  } | null;
  membership: {
    completionRate?: number;
    cumulativeLoggedValue?: number;
    currentStreak?: number;
    longestStreak?: number;
    cumulativeValues?: Record<string, number>;
    /** Firestore membership status — 'completed' means the member personally finished. */
    status?: string;
  } | null;
  /** Top entries from challengeMembers, sorted by score descending. */
  leaderboard?: Array<{ userId: string; score: number }>;
  currentUserId?: string;
  /**
   * The delta from the just-completed logging session (from URL params).
   * Displayed as "+N reps today". NEVER added to groupTotal or userContributionTotal
   * because those fields are already written to Firestore before navigation.
   */
  sessionDelta?: number;
  /**
   * Sum of cumulativeLoggedValue across ALL challenge members (collective only).
   * Passed by screens that already have the full member list (detail, leaderboard, completed).
   * Provides a tighter floor than any single member's contribution when the aggregate is stale.
   */
  memberSumContribution?: number;
  /**
   * Sum of workout + wellness log values across all raw logs for this challenge (collective only).
   * Passed by the audit script and screens that compute it.
   * Provides the highest-fidelity floor when the aggregate and member docs are both stale.
   */
  logSumValue?: number;
  /**
   * challengeActivitySummaries.totalValue — CF-maintained canonical collective team total.
   * Written via FieldValue.increment on every actual log; never double-counts.
   * This is the PREFERRED source for collective team progress display.
   * Callers should query doc(db, 'challengeActivitySummaries', challengeId) and pass totalValue here.
   */
  activitySummaryTotal?: number;
  /**
   * Best-known team total before the CF has updated challengeActivitySummaries.
   * Pass challenge.groupCurrentTotal here — it is a team-level aggregate (not an individual user
   * value) that may already reflect the current log (if the client engine wrote it) or may be
   * the pre-log value (if the challenge doc hasn't re-fetched yet). Either way it is always a
   * valid lower-bound for the team total and NEVER overrides activitySummaryTotal.
   * Use case: prevents 0-flash on WorkoutLoggedScreen and Home before CF fires.
   */
  priorTeamTotal?: number;
}

export interface ResolvedProgress {
  challengeType: 'collective' | 'competitive' | 'streak';
  unit: string;

  // ── User ──────────────────────────────────────────────────────────────────
  /** Member's total logged value across all sessions (membership.cumulativeLoggedValue). */
  userTotal: number;
  /** Just-logged delta shown as "today" marker only. Not included in userTotal. */
  sessionDelta: number;
  /**
   * True when this member has personally completed their challenge goal.
   * Competitive: completionRate >= 100 or all-activity targets met.
   * Collective: group has reached or exceeded groupCumulativeTarget.
   * Streak: currentStreak >= requiredConsecutiveDays.
   */
  isUserCompleted: boolean;

  // ── Collective ────────────────────────────────────────────────────────────
  /**
   * Authoritative group aggregate, floored by all available sources.
   * Equals max(activitySummaryTotal, memberSumContribution, logSumValue, priorTeamTotal)
   * so that a stale CF aggregate never shows less than what any other team-level source confirms.
   */
  groupTotal: number;
  groupTarget: number;
  groupRemaining: number;
  /** 0–100 integer for progress bar. */
  groupPercent: number;
  /** membership.cumulativeLoggedValue — the user's personal share of the group total. */
  userContributionTotal: number;

  // ── Competitive ───────────────────────────────────────────────────────────
  competitiveLeaderTotal: number;
  competitiveGap: number;
  isCurrentUserLeading: boolean;
  /**
   * Human-readable leader comparison label for competitive challenges.
   * "You are leading 🏆" | "N unit behind leader" | undefined (no leaderboard data).
   */
  leaderLabel?: string;

  // ── Streak ────────────────────────────────────────────────────────────────
  streakCurrentDays: number;
  streakTargetDays: number;

  // ── Formatted ─────────────────────────────────────────────────────────────
  primaryLabel: string;
  secondaryLabel?: string;
  /** 0–100 integer for progress bar; always same source as primaryLabel. */
  progressPercent: number;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Coerces any value to a finite number; returns 0 for undefined/null/NaN/Infinity. */
export function safeNum(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function clamp(v: number): number {
  return Math.min(100, Math.max(0, Math.round(safeNum(v))));
}

function primaryUnit(challenge: ProgressInput['challenge']): string {
  return challenge?.activities?.[0]?.unit ?? '';
}

function totalActivityTarget(challenge: ProgressInput['challenge']): number {
  return safeNum(
    (challenge?.activities ?? []).reduce((s, a) => s + safeNum(a.targetValue), 0),
  );
}

// ── Main resolver ──────────────────────────────────────────────────────────────

export function resolveChallengeProgress(input: ProgressInput): ResolvedProgress {
  const { challenge, membership, leaderboard = [], currentUserId, sessionDelta: rawDelta, memberSumContribution, logSumValue, activitySummaryTotal, priorTeamTotal } = input;

  const type = challenge?.challengeType ?? 'collective';
  const unit = primaryUnit(challenge);
  const sessionDelta = safeNum(rawDelta);

  const userTotal = safeNum(membership?.cumulativeLoggedValue);
  const completionRate = safeNum(membership?.completionRate);

  // ── Collective ──────────────────────────────────────────────────────────
  const userContributionTotal = safeNum(membership?.cumulativeLoggedValue);
  const memberSumFloor = safeNum(memberSumContribution);
  const logSumFloor = safeNum(logSumValue);
  // CF-maintained canonical collective total (challengeActivitySummaries.totalValue).
  // This is the preferred and highest-priority source; all other floors only apply when it is 0.
  const activitySummaryFloor = safeNum(activitySummaryTotal);
  // Team-level optimistic floor: challenge.groupCurrentTotal passed by callers that have it.
  // This is a team aggregate (not the individual user's value) so it is always safe to use as a
  // floor. It may already include the current log (if the client engine wrote it) or may be the
  // pre-log value. It NEVER overrides activitySummaryTotal — Math.max ensures that.
  const optimisticTeamFloor = safeNum(priorTeamTotal);
  const groupTotal = Math.max(activitySummaryFloor, memberSumFloor, logSumFloor, optimisticTeamFloor);
  const groupTarget = safeNum(challenge?.groupCumulativeTarget);
  const groupRemaining = Math.max(0, groupTarget - groupTotal);
  const groupPercent = groupTarget > 0 ? clamp((groupTotal / groupTarget) * 100) : 0;

  // ── Competitive leader ──────────────────────────────────────────────────
  const myLeaderboardScore = leaderboard.find((e) => e.userId === currentUserId)?.score ?? userTotal;
  const competitiveLeader = leaderboard[0];
  const isCurrentUserLeading = !!competitiveLeader && competitiveLeader.userId === currentUserId;
  const competitiveLeaderTotal = safeNum(competitiveLeader?.score ?? userTotal);
  const competitiveGap = isCurrentUserLeading ? 0 : Math.max(0, competitiveLeaderTotal - safeNum(myLeaderboardScore));

  let leaderLabel: string | undefined;
  if (type === 'competitive' && leaderboard.length > 0) {
    leaderLabel = isCurrentUserLeading
      ? 'You are leading 🏆'
      : `${competitiveGap.toLocaleString()}${unit ? ` ${unit}` : ''} behind leader`;
  }

  // ── Streak ──────────────────────────────────────────────────────────────
  const streakCurrentDays = safeNum(membership?.currentStreak);
  const streakTargetDays = safeNum(challenge?.requiredConsecutiveDays ?? challenge?.durationDays);

  // ── isUserCompleted ─────────────────────────────────────────────────────
  // Firestore status='completed' is the authoritative signal; fall back to rate/count checks
  // so the resolver stays correct even when the status write hasn't propagated yet.
  const memberStatusCompleted = String(membership?.status ?? '').toLowerCase() === 'completed';
  let isUserCompleted: boolean;
  if (type === 'competitive') {
    const target = totalActivityTarget(challenge);
    isUserCompleted = memberStatusCompleted || completionRate >= 100 || (target > 0 && userTotal >= target);
  } else if (type === 'streak') {
    isUserCompleted = memberStatusCompleted || (streakTargetDays > 0 && streakCurrentDays >= streakTargetDays);
  } else {
    // collective — the group, not the individual, completes
    isUserCompleted = memberStatusCompleted || (groupTarget > 0 && groupTotal >= groupTarget);
  }

  // ── Labels + progressPercent ────────────────────────────────────────────
  let primaryLabel: string;
  let secondaryLabel: string | undefined;
  let progressPercent: number;

  if (type === 'competitive') {
    const target = totalActivityTarget(challenge);
    if (target > 0) {
      primaryLabel = `${userTotal.toLocaleString()} / ${target.toLocaleString()}${unit ? ` ${unit}` : ''}`;
      progressPercent = clamp((userTotal / target) * 100);
    } else {
      primaryLabel = `${completionRate}% of goal`;
      progressPercent = clamp(completionRate);
    }
    if (leaderLabel) secondaryLabel = leaderLabel;
  } else if (type === 'streak') {
    const streak = streakCurrentDays;
    const required = streakTargetDays;
    if (required > 0) {
      primaryLabel = streak > 0
        ? `Day ${streak} streak · ${streak} / ${required} days`
        : `Start your streak — ${required} days to go`;
      progressPercent = clamp((streak / required) * 100);
    } else {
      primaryLabel = streak > 0 ? `Day ${streak} streak` : 'No streak yet';
      progressPercent = clamp(completionRate);
    }
  } else {
    // collective
    if (groupTarget > 0) {
      primaryLabel = `${groupTotal.toLocaleString()} / ${groupTarget.toLocaleString()}${unit ? ` ${unit}` : ''}`;
      progressPercent = groupPercent;
      if (userContributionTotal > 0) {
        secondaryLabel = `You contributed ${userContributionTotal.toLocaleString()}${unit ? ` ${unit}` : ''}`;
      }
    } else {
      primaryLabel = `${completionRate}% complete`;
      progressPercent = clamp(completionRate);
    }
  }

  return {
    challengeType: type,
    unit,
    userTotal,
    sessionDelta,
    isUserCompleted,
    groupTotal,
    groupTarget,
    groupRemaining,
    groupPercent,
    userContributionTotal,
    competitiveLeaderTotal,
    competitiveGap,
    isCurrentUserLeading,
    leaderLabel,
    streakCurrentDays,
    streakTargetDays,
    primaryLabel,
    secondaryLabel,
    progressPercent,
  };
}
