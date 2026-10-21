/**
 * MC-2C-1 — typed client for the governed own-member Profile (`/api/me`).
 *
 * This client performs no domain work of its own. The server is the sole
 * authority for the display name, its validation, the Group/Challenge
 * summaries and the derived active/history bucket. Every value is rendered
 * as served.
 *
 * Boundaries:
 * - the actor is bound by the authenticated transport; no member id, UID,
 *   role or email is ever sent in a request body;
 * - `PATCH /api/me` accepts exactly `displayName` and nothing else;
 * - email is deliberately absent: it is presented directly from Firebase
 *   `user.email`, never from this response and never from the local
 *   `AuthContext.profile` cache;
 * - Group and Challenge summaries paginate independently through
 *   `groupsLimit`/`groupsCursor` and `challengesLimit`/`challengesCursor`.
 *
 * `/api` is the canonical active namespace (see `AGENTS.md` §2).
 */
import { apiFetch, apiPath } from './apiClient';

export type V2ProfileChallengeStatus = 'active' | 'withdrawn' | 'removed';
export type V2ProfileChallengeBucket = 'active' | 'history';

export interface V2ProfileImageSlot {
  status: 'not_configured';
}

export interface V2ProfileGroupItem {
  groupId: string;
  name: string;
  role: string;
  status: string;
  joinedAt: string;
}

export interface V2ProfileGroupPage {
  count: number;
  items: V2ProfileGroupItem[];
  nextCursor: string | null;
}

export interface V2ProfileChallengeItem {
  challengeId: string;
  /** Canonical participation-episode identity; withdrawal + rejoin stay distinct. */
  participationId: string;
  title: string;
  status: V2ProfileChallengeStatus;
  /** Server-derived presentation bucket — never recomputed from dates here. */
  bucket: V2ProfileChallengeBucket;
  joinedAt: string;
  exitedAt: string | null;
}

export interface V2ProfileChallengePage {
  activeCount: number;
  historyCount: number;
  totalCount: number;
  items: V2ProfileChallengeItem[];
  nextCursor: string | null;
}

export interface V2Profile {
  memberId: string;
  displayName: string | null;
  profileImage: V2ProfileImageSlot;
  groups: V2ProfileGroupPage;
  challenges: V2ProfileChallengePage;
}

/** Independent pagination inputs. Only the requested section advances. */
export interface V2ProfilePageQuery {
  groupsLimit?: number;
  groupsCursor?: string;
  challengesLimit?: number;
  challengesCursor?: string;
}

function pagePath(query: V2ProfilePageQuery): string {
  const params = new URLSearchParams();
  if (query.groupsLimit !== undefined) params.set('groupsLimit', String(query.groupsLimit));
  if (query.groupsCursor !== undefined) params.set('groupsCursor', query.groupsCursor);
  if (query.challengesLimit !== undefined) {
    params.set('challengesLimit', String(query.challengesLimit));
  }
  if (query.challengesCursor !== undefined) {
    params.set('challengesCursor', query.challengesCursor);
  }
  const suffix = params.toString();
  return apiPath(`/me${suffix ? `?${suffix}` : ''}`);
}

/** Read the caller's own Profile and the requested summary pages. */
export async function fetchV2Profile(query: V2ProfilePageQuery = {}): Promise<V2Profile> {
  return apiFetch<V2Profile>(pagePath(query));
}

/**
 * Update the caller's own display name. The server may return a 500 after a
 * committed write when the post-commit summary read fails; callers must never
 * present that as "the name did not change".
 */
export async function updateV2DisplayName(displayName: string): Promise<V2Profile> {
  return apiFetch<V2Profile>(apiPath('/me'), {
    method: 'PATCH',
    body: { displayName },
  });
}
