import type {
  V2ChallengeContributors,
  V2ChallengeDetail,
  V2ContributorEntry,
  V2LeaderboardEntry,
} from '../../api/v2ChallengeApi';

/**
 * S3c — live progress / type-state view derivation (pure, React-free so it
 * is directly testable — same convention as `participationView.ts` and
 * `loggingView.ts`).
 *
 * Derives member-facing progress views ONLY from authoritative reads:
 * - shared/own numbers come from the detail read (`collectiveTotal`,
 *   `goalValue/goalUnit`, `myParticipation.progress`, `completionsCount`);
 * - contributor shares come from the bounded contributors seam;
 * - competitive positions come from the leaderboard seam (server only);
 * - the streak day comes from the server-projected `governingToday`.
 *
 * Never infers progress from unrelated fields; never manufactures
 * canonical state; never determines the Challenge day from the device
 * clock; never ranks (no position is computed here — positions are
 * read from the leaderboard seam).
 */

// ─── Collective (Together) ───────────────────────────────────────────────

export interface S3cCollectiveView {
  total: number;
  goal: number | null;
  unit: string | null;
  /** Rounded percent; may exceed 100 (overshoot is preserved honestly). Null without a goal. */
  percent: number | null;
  /** Remaining to goal (0 once reached); null without a goal. */
  remaining: number | null;
  goalReached: boolean;
  completionsCount: number;
  ownContribution: number;
  /** Own share of the current total; null while the total is 0. */
  ownShare: number | null;
  hasJoined: boolean;
}

export function collectiveProgressFor(detail: V2ChallengeDetail): S3cCollectiveView {
  const total = detail.collectiveTotal;
  const goal = detail.goalValue;
  const hasJoined = detail.myParticipation?.status === 'active';
  const ownContribution = detail.myParticipation?.progress.cumulativeTotal ?? 0;
  return {
    total,
    goal,
    unit: detail.goalUnit,
    percent: goal !== null && goal > 0 ? Math.round((total / goal) * 100) : null,
    remaining: goal !== null && goal > 0 ? Math.max(0, goal - total) : null,
    goalReached: detail.collectiveGoalReached,
    completionsCount: detail.completionsCount,
    ownContribution,
    ownShare: total > 0 ? ownContribution / total : null,
    hasJoined,
  };
}

/** True for the contributor row belonging to the viewer's display episode. */
export function isOwnContributor(
  entry: V2ContributorEntry,
  detail: V2ChallengeDetail,
): boolean {
  const ownId = detail.myParticipation?.participationId;
  return ownId !== undefined && entry.participationId === ownId;
}

/**
 * Guard proof that contribution visibility is NOT a leaderboard: the
 * contributors payload must carry no placing vocabulary anywhere in its
 * serialized form.
 */
export function contributorsCarryNoRanking(contributors: V2ChallengeContributors): boolean {
  return !/position|rank|winner|podium/i.test(JSON.stringify(contributors));
}

// ─── Competitive (Race) ──────────────────────────────────────────────────

export interface S3cCompetitiveView {
  ownTotal: number;
  /** Sum of configured activity targets (the member's finish line). */
  target: number;
  unit: string;
  /** Rounded percent toward target; null without a target. */
  percent: number | null;
  qualified: boolean;
  completedAt: string | null;
  /** Authoritative live position (server seam only); null until finished. */
  position: number | null;
  hasJoined: boolean;
}

export function competitiveProgressFor(
  detail: V2ChallengeDetail,
  entries: V2LeaderboardEntry[],
): S3cCompetitiveView {
  const progress = detail.myParticipation?.progress;
  const target = detail.config.activities.reduce((sum, a) => sum + a.targetValue, 0);
  const unit = detail.config.activities[0]?.unit ?? '';
  const ownId = detail.myParticipation?.participationId;
  const ownEntry = ownId !== undefined ? entries.find((e) => e.participationId === ownId) : undefined;
  return {
    ownTotal: progress?.cumulativeTotal ?? 0,
    target,
    unit,
    percent: target > 0 ? Math.min(100, Math.round(((progress?.cumulativeTotal ?? 0) / target) * 100)) : null,
    qualified: progress?.completionStatus === 'completed',
    completedAt: progress?.completedAt ?? null,
    // Server positions only — never computed here. Null until finished.
    position: ownEntry?.position ?? null,
    hasJoined: detail.myParticipation?.status === 'active',
  };
}

export interface S3cRaceBoard {
  finished: V2LeaderboardEntry[];
  progressing: V2LeaderboardEntry[];
  finishedCount: number;
  participantCount: number;
}

/**
 * Splits served leaderboard entries into qualified finishers (positioned
 * by the server) and participants still progressing (position null).
 * Entry ORDER within each group is the server's; no re-ranking here.
 */
export function raceBoardFor(entries: V2LeaderboardEntry[]): S3cRaceBoard {
  const finished = entries.filter((e) => e.position !== null);
  const progressing = entries.filter((e) => e.position === null);
  return {
    finished,
    progressing,
    finishedCount: finished.length,
    participantCount: entries.length,
  };
}

/** True for the leaderboard row belonging to the viewer's display episode. */
export function isOwnBoardEntry(entry: V2LeaderboardEntry, detail: V2ChallengeDetail): boolean {
  const ownId = detail.myParticipation?.participationId;
  return ownId !== undefined && entry.participationId === ownId;
}

/**
 * CORR-001 Blocker 2 — S3c query enablement for the competitive
 * leaderboard. S3c consumes LIVE positions only: the query is enabled
 * exactly while the Challenge is competitive AND unfinalized. Once
 * finalized the route switches to frozen final_position authority
 * (reserved for S3d), so the S3c query must not run — disabling beats
 * hiding text after final data was already consumed. Other families
 * never have a leaderboard.
 */
export function competitiveLeaderboardEnabledForS3c(
  challengeType: string | undefined,
  finalized: boolean,
): boolean {
  return challengeType === 'competitive' && !finalized;
}

// ─── Streak (Daily Streak) ───────────────────────────────────────────────

export interface S3cStreakRequirement {
  canonicalKey: string;
  activityVariant: string | null;
  targetValue: number;
  unit: string;
  doneToday: boolean;
}

export interface S3cStreakView {
  /** Server-projected governing day (formatted by the caller, never derived here). */
  governingToday: string;
  timezone: string;
  currentStreak: number;
  bestStreak: number;
  daysCompleted: number;
  requiredDays: number | null;
  todayComplete: boolean;
  todayActivities: string[];
  requirements: S3cStreakRequirement[];
  hasJoined: boolean;
}

export function streakProgressFor(detail: V2ChallengeDetail): S3cStreakView {
  const progress = detail.myParticipation?.progress;
  // The Challenge day is taken from the server projection on the read.
  // This module never touches the device clock to determine the day.
  const today = detail.governingToday;
  const state = progress?.dayStates[today];
  const doneSet = new Set(state?.activities ?? []);
  return {
    governingToday: today,
    timezone: detail.timezone,
    currentStreak: progress?.currentStreak ?? 0,
    bestStreak: progress?.bestStreak ?? 0,
    daysCompleted: progress?.daysCompleted ?? 0,
    requiredDays: detail.config.requiredConsecutiveDays,
    todayComplete: state?.complete ?? false,
    todayActivities: state ? [...state.activities] : [],
    requirements: detail.config.activities.map((a) => ({
      canonicalKey: a.canonicalKey,
      activityVariant: a.activityVariant,
      targetValue: a.targetValue,
      unit: a.unit,
      doneToday: doneSet.has(`${a.canonicalKey}::${a.activityVariant ?? ''}`)
        || doneSet.has(a.canonicalKey),
    })),
    hasJoined: detail.myParticipation?.status === 'active',
  };
}
