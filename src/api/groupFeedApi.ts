import { API_PREFIX, apiFetch } from './apiClient';

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
  const params = new URLSearchParams();
  if (options.limit !== undefined) params.set('limit', String(options.limit));
  if (options.cursor !== undefined) params.set('cursor', options.cursor);
  const query = params.size ? `?${params.toString()}` : '';
  return apiFetch<GroupFeedPage>(`${API_PREFIX}/groups/${encodeURIComponent(groupId)}/feed${query}`);
}
