/**
 * Phase C3B typed V2 Challenge API client.
 *
 * Extends the existing apiFetch seam (authenticated Firebase ID-token
 * transport); screens must use these operations, never raw fetch. Contracts
 * mirror the C3A V2 read API and the C2B activity application route. No
 * DATABASE_URL or server credential ever appears client-side.
 */
import { apiFetch } from './apiClient';

export type V2ChallengeType = 'collective' | 'competitive' | 'streak';
export type V2ChallengeStatus = 'establishment' | 'active' | 'ended';
export type V2ParticipationStatus = 'active' | 'withdrawn' | 'removed';
export type V2CompletionStatus = 'in_progress' | 'completed';

export interface V2ParticipationProgress {
  logsAccepted: number;
  distinctDays: number;
  totalPoints: number;
  completionRate: number;
  cumulativeValues: Record<string, number>;
  cumulativeTotal: number;
  currentStreak: number;
  bestStreak: number;
  lastCompletedDay: string | null;
  dayStates: Record<string, { complete: boolean; activities: string[] }>;
  daysCompleted: number;
  completionStatus: V2CompletionStatus;
  completedAt: string | null;
  /**
   * EBC-04 frozen standard-competition finishing position, served from sealed
   * finals. Null for non-finishers, streaks and unfinalized Challenges. The
   * client renders this value verbatim and never computes a rank (S3c/S3d).
   */
  finalPosition: number | null;
}

/**
 * S3d — frozen per-participation final block (projected read-only from
 * `challenge_participation_finals`). Null while the Challenge is unfinalized.
 * For Race this is the member's governing (earliest completed) episode result.
 * `finalStreak` is the frozen terminal streak and MUST be preferred over the
 * live `currentStreak` for the final Streak result.
 */
export interface V2ParticipationFinal {
  completed: boolean;
  completedAt: string | null;
  daysCompleted: number;
  bestStreak: number;
  /** Frozen terminal streak (`challenge_participation_finals.final_streak`). */
  finalStreak: number;
  /** Frozen finishing position; null for non-finishers and streaks. */
  finalPosition: number | null;
  finalizedAt: string;
}

export interface V2OwnParticipation {
  participationId: string;
  status: V2ParticipationStatus;
  joinedAt: string;
  joinedConfigVersion: number;
  progress: V2ParticipationProgress;
  /** S3d — frozen final block (null while unfinalized). */
  final: V2ParticipationFinal | null;
}

/** S3d — frozen terminal result for an ended + finalized Challenge. */
export interface V2FinalResult {
  finalizedAt: string;
  configVersion: number;
  finalizationVersion: string;
  engineVersion: string;
  scoringVersion: string;
  /** Type-specific terminal payload (collective aggregate, completions). */
  result: Record<string, unknown>;
}

export interface V2ChallengeSummary {
  challengeId: string;
  groupId: string;
  title: string;
  description: string;
  challengeType: V2ChallengeType;
  status: V2ChallengeStatus;
  startDate: string;
  endDate: string;
  /** Governing Challenge timezone (friendly label rendered client-side). */
  timezone: string;
  /** EBC-04: true once the terminal result is computed and frozen (already
   * served by GET /v1/challenges list/detail; typed here for S3a
   * read-only gating — no server change). */
  finalized: boolean;
  currentConfigVersion: number;
  goalValue: number | null;
  goalUnit: string | null;
  collectiveTotal: number;
  collectiveGoalReached: boolean;
  completionsCount: number;
  myParticipation: V2OwnParticipation | null;
}

export interface V2ConfigActivity {
  canonicalKey: string;
  activityVariant: string | null;
  activityKind: 'fitness' | 'wellness';
  /** Governing Metric of the configuration (null only on pre-PF-03 rows). */
  metric?: string | null;
  targetValue: number;
  unit: string;
  position: number;
  /** PF-03 pinned required Component ids ([] when the Activity declares none). */
  requiredComponents?: string[];
  loadReportingBasis?: string | null;
  durationMode?: string | null;
  completionOccurrence?: string | null;
}

export interface V2ChallengeDetail extends V2ChallengeSummary {
  instructions: string;
  activatedAt: string | null;
  endedAt: string | null;
  /**
   * S3d — EBC-04 finalization marker (null while unfinalized). The client
   * uses it to render the sealed results experience only when frozen truth
   * exists; it never fabricates results before this is set.
   */
  finalizedAt: string | null;
  /** S3d — frozen terminal result (null while unfinalized). */
  finalResult: V2FinalResult | null;
  /**
   * S3c — server-authoritative governing Challenge day (YYYY-MM-DD in the
   * Challenge timezone at read time). Format it; never determine the
   * Challenge day from the device clock.
   */
  governingToday: string;
  /** S3c — server wall-clock instant (ISO) the governing day derives from. */
  serverNow: string;
  config: {
    version: number;
    period: { startDate: string; endDate: string };
    requiredConsecutiveDays: number | null;
    activities: V2ConfigActivity[];
  };
}

export interface V2LeaderboardEntry {
  memberId: string;
  participationId: string;
  totalPoints: number;
  cumulativeTotal: number;
  logsAccepted: number;
  completionStatus: V2CompletionStatus;
  completedAt: string | null;
  position: number | null;
}

/**
 * S3c — bounded collective contributor projection. Contribution
 * visibility, NOT a leaderboard: no position, no rank, no winner.
 * CORR-001: identity is member-level — contributionTotal aggregates the
 * member's governed accepted contribution across all of their episodes;
 * participationId is their current episode (for "You" behaviour).
 */
export interface V2ContributorEntry {
  memberId: string;
  participationId: string;
  participationStatus: V2ParticipationStatus;
  contributionTotal: number;
  share: number | null;
  logsAccepted: number;
}

export interface V2ChallengeContributors {
  challengeId: string;
  challengeType: 'collective';
  collectiveTotal: number;
  goalValue: number | null;
  goalUnit: string | null;
  contributors: V2ContributorEntry[];
}

export interface V2ParticipationResponse {
  participationId: string;
  challengeId: string;
  memberId: string;
  status: V2ParticipationStatus;
  joinedAt: string;
  joinedConfigVersion: number;
  exitedAt: string | null;
  exitReason: string | null;
}

export interface V2ActivityResult {
  recordId: string;
  eventId: string;
  participationId: string;
  challengeId: string;
  activityConfigId: string;
  configVersion: number;
  acceptedAt: string;
  occurredDay: string;
  value: number;
  unit: string;
  pointsAwarded: number;
  scoringMethod: string;
  completionTriggered: boolean;
  duplicate: boolean;
  participation: {
    logsAccepted: number;
    distinctDays: number;
    totalPoints: number;
    completionRate: number;
    cumulativeTotal: number;
    currentStreak: number;
    bestStreak: number;
    daysCompleted: number;
    completionStatus: V2CompletionStatus;
    completedAt: string | null;
  };
  challenge: {
    collectiveTotal: number;
    collectiveGoalReached: boolean;
    completionsCount: number;
  };
}

export interface V2ActivityPayload {
  activity_kind: 'fitness' | 'wellness';
  canonical_key: string;
  activity_variant?: string;
  value: number;
  unit: string;
  occurred_at: string;
  occurred_day?: string;
  occurred_tz?: string;
  client_key: string;
}

export function listChallengesV2(): Promise<{ memberId: string; challenges: V2ChallengeSummary[] }> {
  return apiFetch<{ memberId: string; challenges: V2ChallengeSummary[] }>('/v1/challenges');
}

export function getChallengeV2(challengeId: string): Promise<V2ChallengeDetail> {
  return apiFetch<V2ChallengeDetail>(`/v1/challenges/${challengeId}`);
}

export function getCompetitiveLeaderboardV2(
  challengeId: string,
): Promise<{ challengeId: string; challengeType: string; entries: V2LeaderboardEntry[] }> {
  return apiFetch(`/v1/challenges/${challengeId}/leaderboard`);
}

export function getChallengeContributorsV2(challengeId: string): Promise<V2ChallengeContributors> {
  return apiFetch<V2ChallengeContributors>(`/v1/challenges/${challengeId}/contributors`);
}

export function joinChallengeV2(challengeId: string): Promise<V2ParticipationResponse> {
  return apiFetch<V2ParticipationResponse>(`/v1/challenges/${challengeId}/join`, { method: 'POST' });
}

export function withdrawChallengeV2(challengeId: string): Promise<V2ParticipationResponse> {
  return apiFetch<V2ParticipationResponse>(`/v1/challenges/${challengeId}/withdraw`, { method: 'POST' });
}

export function logChallengeActivityV2(
  challengeId: string,
  payload: V2ActivityPayload,
): Promise<V2ActivityResult> {
  return apiFetch<V2ActivityResult>(`/v1/challenges/${challengeId}/activity`, {
    method: 'POST',
    body: payload,
  });
}
