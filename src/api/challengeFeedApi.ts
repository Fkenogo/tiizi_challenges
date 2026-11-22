import { apiFetch, apiPath } from './apiClient';

/**
 * CF-3 — Challenge Feed read contract (S1 activity_shares only).
 *
 * Transport only. Every field mirrors the server contract in
 * `api/src/challengeFeedShares.ts`; the server rechecks Group membership and
 * Challenge visibility on every read and never expands visibility.
 */
export interface ChallengeFeedItem {
  feedItemId: string;
  kind: 'activity_share';
  activityEventId: string;
  sharerDisplayName: string | null;
  activityName: string;
  value: number;
  unit: string;
  publishedAt: string;
  ownShare: boolean;
}

export interface ChallengeFeedPage {
  challengeId: string;
  items: ChallengeFeedItem[];
  nextCursor: string | null;
}

/**
 * CF-2 S1 — explicit Activity Share publication state. The server publishes
 * only the CF-01 S1 allow-list (display name, Activity name, own accepted
 * value, unit); publication is idempotent per source Activity.
 */
export interface ActivityShareState {
  shareId: string;
  challengeId: string;
  activityEventId: string;
  publishedAt: string;
  withdrawn: boolean;
}

export interface ChallengeFeedPageQuery {
  limit?: number;
  cursor?: string;
}

export function fetchChallengeFeed(
  challengeId: string,
  bearerToken: string,
  query: ChallengeFeedPageQuery = {},
): Promise<ChallengeFeedPage> {
  const params = new URLSearchParams();
  if (query.limit !== undefined) params.set('limit', String(query.limit));
  if (query.cursor !== undefined) params.set('cursor', query.cursor);
  const suffix = params.toString();
  return apiFetch<ChallengeFeedPage>(
    `${apiPath(`/challenges/${encodeURIComponent(challengeId)}/feed`)}${suffix ? `?${suffix}` : ''}`,
    { bearerToken },
  );
}

export function publishActivityShare(
  challengeId: string,
  activityEventId: string,
  bearerToken: string,
): Promise<ActivityShareState> {
  return apiFetch<ActivityShareState>(
    apiPath(`/challenges/${encodeURIComponent(challengeId)}/feed/activity-shares`),
    { method: 'POST', bearerToken, body: { activityEventId } },
  );
}

export function withdrawActivityShare(
  challengeId: string,
  activityEventId: string,
  bearerToken: string,
): Promise<ActivityShareState> {
  return apiFetch<ActivityShareState>(
    apiPath(`/challenges/${encodeURIComponent(challengeId)}/feed/activity-shares/${encodeURIComponent(activityEventId)}`),
    { method: 'DELETE', bearerToken },
  );
}
