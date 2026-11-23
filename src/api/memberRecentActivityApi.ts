import { apiFetch, apiPath } from './apiClient';

export type MemberRecentActivityRevisionState = 'current' | 'updated' | 'reversed';

export interface MemberRecentActivityItem {
  activityId: string;
  activityName: string;
  value: number;
  unit: string;
  occurredAt: string;
  recordedAt: string;
  acceptedAt: string;
  displayTimezone: string;
  revisionState: MemberRecentActivityRevisionState;
  challenge: { id: string; title: string };
}

export interface MemberRecentActivityPage {
  items: MemberRecentActivityItem[];
  nextCursor: string | null;
}

export interface MemberRecentActivityRequest {
  limit: number;
  cursor?: string;
  challengeId?: string;
}

/** Authenticated owner-only read; the client never selects an owner. */
export function fetchMemberRecentActivity(
  request: MemberRecentActivityRequest,
  bearerToken: string,
): Promise<MemberRecentActivityPage> {
  const params = new URLSearchParams({ limit: String(request.limit) });
  if (request.cursor) params.set('cursor', request.cursor);
  if (request.challengeId) params.set('challengeId', request.challengeId);
  return apiFetch<MemberRecentActivityPage>(`${apiPath('/me/activity')}?${params.toString()}`, { bearerToken });
}
