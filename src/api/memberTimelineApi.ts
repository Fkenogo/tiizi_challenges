import { apiFetch, apiPath } from './apiClient';
import type { MemberRecentActivityRevisionState } from './memberRecentActivityApi';

export type PersonalTimelineEventType =
  | 'group_created'
  | 'group_joined'
  | 'group_left'
  | 'challenge_created'
  | 'challenge_joined'
  | 'challenge_exited'
  | 'activity_logged'
  | 'challenge_finalized';

export type PersonalTimelineCategory = 'group' | 'challenge' | 'activity' | 'result';

export interface PersonalTimelineNavigation {
  kind: 'group' | 'challenge' | 'none';
  path: string | null;
  accessible: boolean;
}

export interface PersonalTimelineGroupContext {
  id: string | null;
  name: string | null;
  isPrivate: boolean;
  accessible: boolean;
}

export interface PersonalTimelineChallengeContext {
  id: string | null;
  title: string | null;
  challengeType: 'collective' | 'competitive' | 'streak' | null;
  accessible: boolean;
}

export interface PersonalTimelineActivityPayload {
  activityId: string;
  activityName: string | null;
  value: number | null;
  unit: string | null;
  acceptedAt: string;
  revisionState: MemberRecentActivityRevisionState;
}

export interface PersonalTimelineExitPayload {
  participationId: string;
  exitReason: 'withdrawn' | 'removed';
}

export interface PersonalTimelineResultPayload {
  participationId: string;
  completed: boolean | null;
  completedAt: string | null;
  finalPosition: number | null;
  daysCompleted: number | null;
  bestStreak: number | null;
  finalStreak: number | null;
  collectiveTotal: number | null;
  collectiveGoalReached: boolean | null;
  goalValue: number | null;
  goalUnit: string | null;
}

export interface PersonalTimelineItem {
  timelineEventId: string;
  eventType: PersonalTimelineEventType;
  category: PersonalTimelineCategory;
  label: string;
  recordedAt: string;
  performedAt: string | null;
  displayTimezone: string | null;
  navigation: PersonalTimelineNavigation;
  group?: PersonalTimelineGroupContext;
  challenge?: PersonalTimelineChallengeContext;
  activity?: PersonalTimelineActivityPayload;
  exit?: PersonalTimelineExitPayload;
  result?: PersonalTimelineResultPayload;
}

export interface PersonalTimelinePage {
  items: PersonalTimelineItem[];
  nextCursor: string | null;
}

export interface PersonalTimelineRequest {
  limit: number;
  cursor?: string;
  types?: PersonalTimelineEventType[];
  challengeId?: string;
}

/** Authenticated owner-only unified timeline read; the server derives the owner from auth. */
export function fetchMemberTimeline(
  request: PersonalTimelineRequest,
  bearerToken: string,
): Promise<PersonalTimelinePage> {
  const params = new URLSearchParams({ limit: String(request.limit) });
  if (request.cursor) params.set('cursor', request.cursor);
  if (request.types && request.types.length > 0) params.set('types', request.types.join(','));
  if (request.challengeId) params.set('challengeId', request.challengeId);
  return apiFetch<PersonalTimelinePage>(`${apiPath('/me/timeline')}?${params.toString()}`, { bearerToken });
}
