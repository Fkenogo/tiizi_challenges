import { API_PREFIX, apiFetch } from './apiClient';
import { groupFeedPagePath } from './groupFeedRequest';

export type GroupFeedEventType =
  | 'challenge_established'
  | 'challenge_started'
  | 'together_goal_achieved'
  | 'challenge_ended'
  | 'challenge_finalized';

export interface GroupFeedEvent {
  feedEventId: string;
  eventType: GroupFeedEventType;
  challengeId: string;
  challengeTitle: string;
  presentationTitle: string;
  occurredAt: string;
  navigationTarget: { type: 'challenge'; challengeId: string };
}

export interface GroupFeedPage {
  groupId: string;
  events: GroupFeedEvent[];
  nextCursor: string | null;
}

/** Transport-only client for the accepted GF-03 member read contract. */
export function fetchGroupFeedPage(
  groupId: string,
  options: { limit?: number; cursor?: string } = {},
): Promise<GroupFeedPage> {
  return apiFetch<GroupFeedPage>(groupFeedPagePath(API_PREFIX, groupId, options));
}
