import { apiFetch, apiPath } from './apiClient';

/**
 * CF-3 — Challenge Feed read contract (S1 activity_shares only).
 *
 * Transport only. Every field mirrors the server contract in
 * `api/src/challengeFeedShares.ts`; the server rechecks Group membership and
 * Challenge visibility on every read and never expands visibility. The
 * canonical Activity event ID is disclosed ONLY on the viewer's own Share.
 */
export interface ChallengeFeedItem {
  feedItemId: string;
  kind: 'activity_share';
  /** Withdrawal reference, present only on the viewer's own Share. */
  activityEventId?: string;
  sharerDisplayName: string | null;
  activityName: string;
  value: number;
  unit: string;
  publishedAt: string;
  ownShare: boolean;
  /** Aggregate Kudos count, visible to every Feed viewer (CF-01 §6.2). */
  kudosCount: number;
  /** Whether the VIEWER's own Kudos is active on this entry. */
  viewerKudos: boolean;
}

export interface ChallengeFeedPage {
  challengeId: string;
  items: ChallengeFeedItem[];
  nextCursor: string | null;
}

/**
 * CF-2 S1 — explicit Activity Share publication state. The server publishes
 * only the CF-01 S1 allow-list (display name, Activity name, own accepted
 * value, unit); publication is idempotent per explicit member choice
 * (`clientKey`): retries converge, and a withdrawn Share is only re-shared
 * by a fresh confirm.
 */
export interface ActivityShareState {
  shareId: string;
  challengeId: string;
  activityEventId: string;
  publishedAt: string;
  /** The member's own withdrawal action (audit fact, never inferred). */
  withdrawn: boolean;
  /** Whether the Share is currently visible in the Feed (read-time truth). */
  visible: boolean;
  /** Why a hidden Share is hidden; null while visible. */
  hiddenReason: 'withdrawn' | 'suppressed' | 'reversed' | 'expired' | null;
  /** Monotonic state generation (1 on first publish, +1 on each withdrawal and revival). */
  shareGeneration: number;
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

/** The owner's exact current Share state for one source Activity. */
export function fetchActivityShareState(
  challengeId: string,
  activityEventId: string,
  bearerToken: string,
): Promise<ActivityShareState> {
  return apiFetch<ActivityShareState>(
    apiPath(`/challenges/${encodeURIComponent(challengeId)}/feed/activity-shares/${encodeURIComponent(activityEventId)}`),
    { bearerToken },
  );
}

export function publishActivityShare(
  challengeId: string,
  input: {
    activityEventId: string;
    clientKey: string;
    /** The value/unit exactly as shown in the preview; the server refuses
     * to publish a value the member never previewed. */
    previewedValue: number;
    previewedUnit: string;
    /** Current Share generation observed before confirming (0 when unshared). */
    expectedGeneration: number;
  },
  bearerToken: string,
): Promise<ActivityShareState> {
  return apiFetch<ActivityShareState>(
    apiPath(`/challenges/${encodeURIComponent(challengeId)}/feed/activity-shares`),
    { method: 'POST', bearerToken, body: input },
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

export interface KudosState {
  feedItemId: string;
  kudosCount: number;
  viewerKudos: boolean;
}

/** CF-01 §6.2 — add the member's single Kudos to a visible entry (idempotent). */
export function addChallengeFeedKudos(
  challengeId: string,
  feedItemId: string,
  bearerToken: string,
): Promise<KudosState> {
  return apiFetch<KudosState>(
    apiPath(`/challenges/${encodeURIComponent(challengeId)}/feed/entries/${encodeURIComponent(feedItemId)}/kudos`),
    { method: 'POST', bearerToken },
  );
}

/** CF-01 §6.2 — remove the member's Kudos (idempotent; never deletes truth). */
export function removeChallengeFeedKudos(
  challengeId: string,
  feedItemId: string,
  bearerToken: string,
): Promise<KudosState> {
  return apiFetch<KudosState>(
    apiPath(`/challenges/${encodeURIComponent(challengeId)}/feed/entries/${encodeURIComponent(feedItemId)}/kudos`),
    { method: 'DELETE', bearerToken },
  );
}
