/**
 * S5b — typed client for the S5a `GET /api/today` member projection.
 *
 * This client performs ONE authenticated read of the server-composed Today
 * projection and does no domain work of its own: no lifecycle, participation,
 * progress, streak, ranking, or joinability authority lives here. Every value
 * is rendered as served.
 *
 * Boundaries carried from the S5a contract (see
 * `docs/experience/TIIZI-S5A-TODAY-MEMBER-PROJECTION-001.md`):
 * - the governing Challenge day is server-derived and never computed from the
 *   device clock here;
 * - `joinability` is `'not_asserted'` — this client must never present an
 *   unconditional Join affordance on the strength of the projection alone;
 * - there is no countdown: the projection emits no day-end instant while
 *   governing-day boundary equivalence remains unproven;
 * - `unsupportedSections` reports absent capability explicitly so the UI can
 *   omit rather than fabricate.
 *
 * `/api` is the canonical active namespace (see `AGENTS.md` §2).
 */
import { API_PREFIX, apiFetch } from './apiClient';

export type V2TodayChallengeType = 'collective' | 'competitive' | 'streak';
export type V2TodayLifecycleState = 'establishment' | 'active' | 'ended';
export type V2TodayRequirementState = 'completed' | 'pending';

export interface V2TodayGroupRef {
  groupId: string;
  name: string;
}

export interface V2TodayTimezoneContext {
  challengeId: string;
  timezone: string;
  governingToday: string;
}

export interface V2TodayContext {
  serverNow: string;
  activeChallengeCount: number;
  timezoneContexts: V2TodayTimezoneContext[];
}

/** One governing-day required Activity for a Streak Challenge. */
export interface V2TodayRequirement {
  /** Canonical activity identity (never a display label). */
  activity: string;
  label?: string;
  targetValue: number;
  unit: string;
  state: V2TodayRequirementState;
}

export interface V2TodayStreakState {
  currentStreak: number;
  bestStreak: number;
  daysCompleted: number;
  lastCompletedDay: string | null;
  completionStatus: 'in_progress' | 'completed';
  /** The governed day state for `governingToday`, when present. */
  dayState: { complete: boolean; activities: string[] } | null;
}

/** A Streak Challenge with required Activities on the governing day. */
export interface V2TodayRequiredChallenge {
  challengeId: string;
  title: string;
  challengeType: V2TodayChallengeType;
  group: V2TodayGroupRef;
  lifecycleState: V2TodayLifecycleState;
  governingToday: string;
  timezone: string;
  detailPath: string;
  requirements: V2TodayRequirement[];
  streak: V2TodayStreakState;
}

export interface V2TodayTogetherProgress {
  groupTotal: number | null;
  target: number | null;
  unit: string | null;
  goalReached: boolean;
  memberContribution: number;
}

export interface V2TodayRaceProgressActivity {
  activity: string;
  label?: string;
  memberProgress: number;
  targetValue: number;
  unit: string;
}

export interface V2TodayRaceProgress {
  completionStatus: 'in_progress' | 'completed';
  completedAt: string | null;
  /** Frozen finishing position; null unless the Challenge is finalized. */
  finalPosition: number | null;
  activities: V2TodayRaceProgressActivity[];
}

export interface V2TodayStreakProgress {
  currentStreak: number;
  bestStreak: number;
  daysCompleted: number;
  completionStatus: 'in_progress' | 'completed';
}

interface V2TodayJoinedChallengeBase {
  challengeId: string;
  title: string;
  group: V2TodayGroupRef;
  lifecycleState: V2TodayLifecycleState;
  governingToday: string;
  timezone: string;
  startDate: string;
  endDate: string;
  detailPath: string;
}

export type V2TodayJoinedChallenge =
  | (V2TodayJoinedChallengeBase & { challengeType: 'collective'; progress: V2TodayTogetherProgress })
  | (V2TodayJoinedChallengeBase & { challengeType: 'competitive'; progress: V2TodayRaceProgress })
  | (V2TodayJoinedChallengeBase & { challengeType: 'streak'; progress: V2TodayStreakProgress });

/** A Group-contextual Challenge the member could take part in. */
export interface V2TodayOpportunity {
  challengeId: string;
  title: string;
  challengeType: V2TodayChallengeType;
  group: V2TodayGroupRef;
  lifecycleState: V2TodayLifecycleState;
  startDate: string;
  endDate: string;
  timezone: string;
  governingToday: string;
  activities: Array<{ domain?: string; name?: string }>;
  detailPath: string;
  /**
   * Always `'not_asserted'` under the current projection: the server does not
   * assert that the member may join. The UI must therefore offer discovery,
   * never an unconditional Join CTA.
   */
  joinability: 'not_asserted';
}

export interface V2TodayUpcoming {
  challengeId: string;
  title: string;
  kind: 'starts' | 'ends';
  lifecycleDate: string;
  timezone: string;
  detailPath: string;
}

export interface V2TodayFinalizedResult {
  challengeId: string;
  title: string;
  finalized: true;
  detailPath: string;
}

export interface V2TodayUnsupportedSection {
  available: false;
  disposition: 'deferred';
}

export interface V2TodayProjection {
  todayContext: V2TodayContext;
  requiredToday: V2TodayRequiredChallenge[];
  joinedChallengeProgress: V2TodayJoinedChallenge[];
  groupChallengeOpportunities: V2TodayOpportunity[];
  upcoming: V2TodayUpcoming[];
  finalizedResults: V2TodayFinalizedResult[];
  unsupportedSections: {
    invitations: V2TodayUnsupportedSection;
    communityMoments: V2TodayUnsupportedSection;
    notifications: V2TodayUnsupportedSection;
  };
  projection: {
    authority: 'existing_challenge_reads';
    countdown: 'omitted_boundary_equivalence_unproven';
  };
}

/** Authenticated `GET /api/today`. Read-only; owns no authority. */
export function fetchTodayProjection(): Promise<V2TodayProjection> {
  return apiFetch<V2TodayProjection>(`${API_PREFIX}/today`);
}
