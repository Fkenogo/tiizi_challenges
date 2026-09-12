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
  /** EBC-04 frozen competitive rank (null unless finalized). */
  finalPosition: number | null;
  /** EBC-05 frozen terminal-day streak (null unless a finalized streak). */
  finalStreak: number | null;
}

export interface V2OwnParticipation {
  participationId: string;
  status: V2ParticipationStatus;
  joinedAt: string;
  joinedConfigVersion: number;
  progress: V2ParticipationProgress;
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
  /** EBC-03 governing Challenge timezone (IANA). */
  timezone: string;
  /** EBC-04 true once the terminal result is computed and frozen. */
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
  targetValue: number;
  unit: string;
  position: number;
}

export interface V2FinalResult {
  finalizedAt: string;
  configVersion: number;
  finalizationVersion: string;
  engineVersion: string;
  scoringVersion: string;
  result: Record<string, unknown>;
}

export interface V2ChallengeDetail extends V2ChallengeSummary {
  instructions: string;
  activatedAt: string | null;
  endedAt: string | null;
  /** EBC-04 finalization marker mirror (null = not finalized). */
  finalizedAt: string | null;
  /** EBC-04 frozen terminal result (null = not finalized). */
  finalResult: V2FinalResult | null;
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

export interface V2CreateActivity {
  activity_kind: 'fitness' | 'wellness';
  canonical_key: string;
  activity_variant?: string;
  metric: string;
  target_value: number;
  unit: string;
}

export interface V2CreateChallengeInput {
  group_id: string;
  challenge_type: V2ChallengeType;
  title: string;
  description?: string;
  instructions?: string;
  start_date: string;
  end_date: string;
  goal_value?: number;
  goal_unit?: string;
  required_consecutive_days?: number;
  timezone?: string;
  activities: V2CreateActivity[];
  activate?: boolean;
  join_creator?: boolean;
  idempotency_key?: string;
}

export interface V2CreateChallengeResponse {
  challengeId: string;
  groupId: string;
  status: string;
  configVersion: number;
  activated: boolean;
  creatorParticipationId: string | null;
  idempotentReplay: boolean;
}

/**
 * EBC-05 governed V2 Challenge establishment (POST /v1/challenges, the
 * EBC-01 creation authority). The ONLY client path that establishes V2
 * Challenges — no Firestore writes, no second config model.
 */
export function createChallengeV2(input: V2CreateChallengeInput): Promise<V2CreateChallengeResponse> {
  return apiFetch<V2CreateChallengeResponse>('/v1/challenges', {
    method: 'POST',
    body: input,
  });
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
