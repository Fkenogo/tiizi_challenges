import { API_PREFIX, apiFetch } from './apiClient';
import { groupFeedPagePath } from './groupFeedRequest';
import { GROUP_FEED_PRESENTATION_TITLES, type GroupFeedEventType } from './groupFeedContract';

export { GROUP_FEED_EVENT_TYPES, GROUP_FEED_PRESENTATION_TITLES, type GroupFeedEventType } from './groupFeedContract';

export interface GroupFeedEvent {
  feedEventId: string;
  eventType: GroupFeedEventType;
  challengeId: string;
  challengeTitle: string;
  presentationTitle: (typeof GROUP_FEED_PRESENTATION_TITLES)[GroupFeedEventType];
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
