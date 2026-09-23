import { apiFetch } from './apiClient';
import { fetchMyMemberships, type MyMembershipsResponse } from './membershipsApi';

/**
 * TIIZI S4a — V2 Group client seam (evolved from the S2-G establishment seam).
 *
 * Transport only. Creation submits the governed terms over the existing
 * governed Group authority (`POST /v1/groups`); reads come from the
 * governed contracts (`GET /v1/memberships/me`, `GET /v1/groups/:groupId`).
 * The client never writes Firestore or PostgreSQL directly and never decides
 * owner/steward authority, membership, counts, or settings.
 */

export interface CreateGroupInput {
  name: string;
  description?: string;
  /** Governed community setup (S4a): all three are existing authority fields. */
  isPrivate?: boolean;
  requireAdminApproval?: boolean;
  allowMemberChallenges?: boolean;
}

/**
 * Governed establishment result. `id` is the authoritative Tiizi Group UUID;
 * `legacyId` is a transitional Firestore lookup key that must never be
 * displayed or persisted as a domain identity.
 */
export interface CreatedGroup {
  id: string;
  legacyId: string;
  name: string;
  isPrivate: boolean;
  role: string;
  status: string;
}

/**
 * Establish a Group through the governed authority. Identity (name +
 * optional description) plus the governed Community Setup; every default —
 * creator role `owner`/Accountable Steward, admission Open,
 * challenge-creation permitted — is applied by the backend authority when
 * the client omits a field, never invented client-side.
 */
export function createGroup(input: CreateGroupInput): Promise<CreatedGroup> {
  const name = input.name.trim();
  const description = input.description?.trim() ?? '';
  return apiFetch<CreatedGroup>('/v1/groups', {
    method: 'POST',
    body: {
      name,
      // Omit the field entirely when empty so the authority's own default
      // (empty description) applies rather than a client-invented value.
      ...(description.length > 0 ? { description } : {}),
      ...(input.isPrivate !== undefined ? { isPrivate: input.isPrivate } : {}),
      ...(input.requireAdminApproval !== undefined
        ? { requireAdminApproval: input.requireAdminApproval }
        : {}),
      ...(input.allowMemberChallenges !== undefined
        ? { allowMemberChallenges: input.allowMemberChallenges }
        : {}),
    },
  });
}

/** The current member's Groups — the membership list read contract. */
export { fetchMyMemberships };
export type { MyMembershipsResponse };

/** Server-resolved viewer relationship — never client-declared. */
export type V2ViewerRelationship = 'steward' | 'member' | 'pending' | 'none';

/**
 * Canonical Group detail (`GET /v1/groups/:groupId`). Governed settings are
 * null on the discoverable subset (never leaked to outsiders); the steward
 * is singular and server-resolved, or null when unattributable.
 */
export interface V2GroupDetail {
  id: string;
  name: string;
  description: string;
  isPrivate: boolean;
  requireAdminApproval: boolean | null;
  allowMemberChallenges: boolean | null;
  memberCount: number | null;
  steward: { memberId: string } | null;
  viewerMembership: { status: string; role: string } | null;
  viewerRelationship: V2ViewerRelationship;
  createdAt: string | null;
}

/** Canonical Group detail read — Group Home's only truth source. */
export function fetchGroupDetail(groupId: string): Promise<V2GroupDetail> {
  return apiFetch<V2GroupDetail>(`/v1/groups/${groupId}`);
}

/** Governed membership join (`POST /v1/groups/:groupId/join`). Transport only. */
export function joinGroup(groupId: string): Promise<{ id: string; status: string; role: string }> {
  return apiFetch<{ id: string; status: string; role: string }>(`/v1/groups/${groupId}/join`, {
    method: 'POST',
    body: {},
  });
}
