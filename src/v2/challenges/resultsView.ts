import type {
  V2ChallengeDetail,
  V2LeaderboardEntry,
  V2ParticipationFinal,
} from '../../api/v2ChallengeApi';

/**
 * S3d — finalized results derivation (pure, React-free so it is directly
 * testable — same convention as `progressView.ts`).
 *
 * Reads ONLY sealed authority:
 * - the frozen `finalResult` on the detail read (Collective terminal aggregate);
 * - the frozen per-participation `final` block (`challenge_participation_finals`)
 *   for streak finals and the governed finishing position;
 * - the frozen leaderboard entries served once a Challenge is finalized.
 *
 * It NEVER recomputes a rank, NEVER substitutes the live `currentStreak` for
 * the frozen Final Streak, NEVER caps overshoot and NEVER manufactures a
 * result. Percentages/shares are presentation arithmetic over projected
 * values only.
 */

// ─── Frozen-result accessors (never fall back to a live recomputation) ──────

function frozenResult(detail: V2ChallengeDetail): Record<string, unknown> {
  return detail.finalResult?.result ?? {};
}

function frozenNumber(detail: V2ChallengeDetail, key: string): number | null {
  const value = frozenResult(detail)[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function frozenBoolean(detail: V2ChallengeDetail, key: string): boolean | null {
  const value = frozenResult(detail)[key];
  return typeof value === 'boolean' ? value : null;
}

function frozenString(detail: V2ChallengeDetail, key: string): string | null {
  const value = frozenResult(detail)[key];
  return typeof value === 'string' ? value : null;
}

// ─── Together / Collective ─────────────────────────────────────────────────

export interface S3dCollectiveResult {
  /**
   * Sealed group total (class F). Null when no frozen result is available —
   * the live derived total is NEVER substituted (fail closed).
   */
  total: number | null;
  /** Authoritative governed goal (class I). */
  goal: number | null;
  unit: string | null;
  /** Rounded percent; may exceed 100 (overshoot preserved honestly). */
  percent: number | null;
  /** Remaining to goal (0 once reached); null without a goal. */
  remaining: number | null;
  /** Amount past the goal when total > goal; null when reached exactly or not reached. */
  overshoot: number | null;
  /** Sealed goal-reached flag (class F); null when frozen truth is absent. */
  goalReached: boolean | null;
  goalCompletedAt: string | null;
  /**
   * Own final contribution. Served per-participation progress is
   * reconstructed from immutable governed evidence for a finalized Challenge
   * (class I), so it cannot diverge from sealed Challenge truth.
   */
  ownContribution: number;
  ownShare: number | null;
  finalizedAt: string | null;
  hasTakenPart: boolean;
  /** True only when sealed terminal truth is present (fail-closed gate). */
  hasFinalTruth: boolean;
}

export function collectiveFinalResultFor(detail: V2ChallengeDetail): S3dCollectiveResult {
  // CORR-001: the sealed aggregate is the ONLY source of the final total and
  // goal-reached flag. There is deliberately no fallback to the mutable live
  // derived total: a finalized result without frozen truth renders nothing
  // rather than live-derived values.
  const total = frozenNumber(detail, 'collective_total');
  const goal = detail.goalValue;
  const goalReached = frozenBoolean(detail, 'collective_goal_reached');
  const ownContribution = detail.myParticipation?.progress.cumulativeTotal ?? 0;
  return {
    total,
    goal,
    unit: detail.goalUnit,
    percent: total !== null && goal !== null && goal > 0 ? Math.round((total / goal) * 100) : null,
    remaining: total !== null && goal !== null && goal > 0 ? Math.max(0, goal - total) : null,
    overshoot: total !== null && goal !== null && total > goal ? total - goal : null,
    goalReached,
    goalCompletedAt: frozenString(detail, 'goal_completed_at'),
    ownContribution,
    ownShare: total !== null && total > 0 ? ownContribution / total : null,
    finalizedAt: detail.finalizedAt,
    hasTakenPart: detail.myParticipation != null,
    hasFinalTruth: detail.finalized === true && detail.finalResult != null,
  };
}

// ─── Race / Competitive ────────────────────────────────────────────────────

export interface S3dCompetitiveResult {
  /**
   * Own progress at close. Served per-participation progress is reconstructed
   * from immutable governed evidence for a finalized Challenge (class I).
   */
  ownTotal: number;
  /** Sum of the pinned activity targets (the member's finish line). */
  target: number;
  unit: string;
  /** Rounded percent toward target; null without a target. */
  percent: number | null;
  /**
   * Sealed terminal completion (governing episode, class F). Null when frozen
   * truth is absent — the live completion status is NEVER substituted.
   */
  finished: boolean | null;
  /**
   * Sealed finishing position as served (standard competition ranking).
   * Rendered verbatim; null for a non-finisher or absent frozen truth.
   */
  position: number | null;
  completedAt: string | null;
  finalizedAt: string | null;
  hasTakenPart: boolean;
  /** True only when sealed terminal truth is present (fail-closed gate). */
  hasFinalTruth: boolean;
}

export function competitiveFinalResultFor(detail: V2ChallengeDetail): S3dCompetitiveResult {
  const progress = detail.myParticipation?.progress;
  const final: V2ParticipationFinal | null = detail.myParticipation?.final ?? null;
  const target = detail.config.activities.reduce((sum, a) => sum + a.targetValue, 0);
  const unit = detail.config.activities[0]?.unit ?? '';
  const ownTotal = progress?.cumulativeTotal ?? 0;
  return {
    ownTotal,
    target,
    unit,
    percent: target > 0 ? Math.round((ownTotal / target) * 100) : null,
    // CORR-001: sealed truth only — no fallback to the live completion status.
    finished: final ? final.completed : null,
    position: final ? final.finalPosition : null,
    completedAt: final ? final.completedAt : null,
    finalizedAt: detail.finalizedAt,
    hasTakenPart: detail.myParticipation != null,
    hasFinalTruth: detail.finalized === true && detail.finalResult != null && final != null,
  };
}

export interface S3dRaceStandings {
  finished: V2LeaderboardEntry[];
  progressing: V2LeaderboardEntry[];
  finishedCount: number;
  participantCount: number;
}

/**
 * Splits frozen standings entries into finishers (positioned by the server)
 * and participants who did not reach the target (position null). Entry ORDER
 * is the server's frozen order — no re-ranking, no client sort.
 */
export function raceStandingsFor(entries: V2LeaderboardEntry[]): S3dRaceStandings {
  const finished = entries.filter((entry) => entry.position !== null);
  const progressing = entries.filter((entry) => entry.position === null);
  return {
    finished,
    progressing,
    finishedCount: finished.length,
    participantCount: entries.length,
  };
}

/** True for the standings row belonging to the viewer's display episode. */
export function isOwnStandingsEntry(
  entry: V2LeaderboardEntry,
  detail: V2ChallengeDetail,
): boolean {
  const ownId = detail.myParticipation?.participationId;
  return ownId !== undefined && entry.participationId === ownId;
}

// ─── Streak (Daily Streak) ─────────────────────────────────────────────────

export interface S3dStreakResult {
  /** Sealed days completed (class F); null when sealed truth is absent. */
  daysCompleted: number | null;
  /** Inclusive Challenge-period length (L.12 denominator); null when unknown. */
  periodDays: number | null;
  /** Sealed best streak (class F); null when sealed truth is absent. */
  bestStreak: number | null;
  /**
   * Frozen terminal streak (`challenge_participation_finals.final_streak`).
   * Null when no sealed final block exists — never substituted by the live
   * `currentStreak`.
   */
  finalStreak: number | null;
  requiredDays: number | null;
  /** Frozen terminal completion; null when no sealed final block exists. */
  completed: boolean | null;
  completedAt: string | null;
  finalizedAt: string | null;
  /**
   * Per-day history. Served progress is reconstructed from immutable governed
   * evidence for a finalized Challenge (class I) — never mutable derived state.
   */
  dayStates: Record<string, { complete: boolean; activities: string[] }>;
  hasTakenPart: boolean;
  /** True only when sealed terminal truth is present (fail-closed gate). */
  hasFinalTruth: boolean;
}

export function streakFinalResultFor(detail: V2ChallengeDetail): S3dStreakResult {
  const final: V2ParticipationFinal | null = detail.myParticipation?.final ?? null;
  const progress = detail.myParticipation?.progress;
  return {
    // CORR-001: sealed counters only — no fallback to live progress values.
    daysCompleted: final ? final.daysCompleted : null,
    periodDays: inclusivePeriodDays(detail.config.period.startDate, detail.config.period.endDate),
    bestStreak: final ? final.bestStreak : null,
    // Sealed Final Streak only — the live currentStreak is never a substitute.
    finalStreak: final ? final.finalStreak : null,
    requiredDays: detail.config.requiredConsecutiveDays,
    completed: final ? final.completed : null,
    completedAt: final?.completedAt ?? null,
    finalizedAt: detail.finalizedAt,
    dayStates: progress?.dayStates ?? {},
    hasTakenPart: detail.myParticipation != null,
    hasFinalTruth: detail.finalized === true && detail.finalResult != null && final != null,
  };
}

/**
 * Inclusive day count for a YYYY-MM-DD period. Deterministic UTC arithmetic
 * over two served date values; never reads the device clock.
 */
export function inclusivePeriodDays(startDate: string, endDate: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return null;
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return Math.floor((end - start) / 86_400_000) + 1;
}

/** Inclusive ordered YYYY-MM-DD list for a period (empty when malformed). */
export function streakPeriodDays(startDate: string, endDate: string): string[] {
  const count = inclusivePeriodDays(startDate, endDate);
  if (count === null) return [];
  const start = Date.parse(`${startDate}T00:00:00Z`);
  return Array.from({ length: count }, (_, index) =>
    new Date(start + index * 86_400_000).toISOString().slice(0, 10),
  );
}

/**
 * S3d — S3c deliberately disables the competitive leaderboard once a
 * Challenge is finalized (frozen truth belongs to S3d). S3d enables it
 * exactly then: a finalized competitive Challenge reads its FROZEN
 * standings through the same route. Never enabled for other families or
 * unfinalized Challenges.
 */
export function finalizedStandingsEnabledForS3d(
  challengeType: string | undefined,
  finalized: boolean,
): boolean {
  return challengeType === 'competitive' && finalized === true;
}
