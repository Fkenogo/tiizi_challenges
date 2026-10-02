import { API_PREFIX, apiFetch } from './apiClient';
import { fetchMyMemberships, type MyMembershipsResponse } from './membershipsApi';

/**
 * TIIZI S4a — V2 Group client seam (evolved from the S2-G establishment seam).
 *
 * Transport only. Creation submits the governed terms over the existing
 * governed Group authority (`POST (/api/)groups`); reads come from the
 * governed contracts (`GET (/api/)memberships/me`, `GET (/api/)groups/:groupId`).
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
  /**
   * CORR-001 richer identity (all optional presentation-level authority
   * fields; omitted when empty so the server's own defaults apply).
   */
  coverId?: string;
  tagline?: string;
  location?: string;
  focusTags?: string[];
  rules?: string[];
  goalIds?: string[];
  customGoal?: string;
  communityNormIds?: string[];
  customCommunityNorm?: string;
}

/**
 * Governed establishment result. `id` is the authoritative Tiizi Group UUID.
 * `legacyId` is retained as an API compatibility field and currently echoes
 * that UUID; clients use `id` as the Group identity.
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
  return apiFetch<CreatedGroup>(`${API_PREFIX}/groups`, {
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
      // CORR-001 richer identity: only set values travel; the server
      // validates catalogue membership, lengths, and counts fail-closed.
      ...(input.coverId !== undefined ? { coverId: input.coverId } : {}),
      ...(input.tagline !== undefined ? { tagline: input.tagline } : {}),
      ...(input.location !== undefined ? { location: input.location } : {}),
      ...(input.focusTags !== undefined ? { focusTags: input.focusTags } : {}),
      ...(input.rules !== undefined ? { rules: input.rules } : {}),
      ...(input.goalIds !== undefined ? { goalIds: input.goalIds } : {}),
      ...(input.customGoal !== undefined ? { customGoal: input.customGoal } : {}),
      ...(input.communityNormIds !== undefined ? { communityNormIds: input.communityNormIds } : {}),
      ...(input.customCommunityNorm !== undefined ? { customCommunityNorm: input.customCommunityNorm } : {}),
    },
  });
}

/** The current member's Groups — the membership list read contract. */
export { fetchMyMemberships };
export type { MyMembershipsResponse };

/** Server-resolved viewer relationship — never client-declared. */
export type V2ViewerRelationship = 'steward' | 'member' | 'pending' | 'none';

/**
 * Canonical Group detail (`GET (/api/)groups/:groupId`). Governed settings are
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
  /** CORR-001 richer identity (rules stay member-only: null on the subset). */
  coverId: string | null;
  tagline: string;
  location: string;
  focusTags: string[];
  goalIds: string[];
  goals: string[];
  customGoal: string | null;
  communityNormIds: string[] | null;
  communityNorms: string[] | null;
  customCommunityNorm: string | null;
  rules: string[] | null;
  /** Included only when this viewer is an active Group member. */
  inviteCode?: string;
}

export type V2AdmissionMode = 'open' | 'approval';
export interface V2DiscoverableGroup {
  id: string;
  name: string;
  description: string;
  tagline: string;
  coverId: string | null;
  location: string;
  focusTags: string[];
  goals: string[];
  memberCount: number;
  admissionMode: V2AdmissionMode;
  viewerRelationship: V2ViewerRelationship;
}

export interface V2GroupOptions {
  focusAreas: Array<{ domain: 'Fitness' | 'Wellness'; label: string }>;
  goals: Array<{ id: string; label: string }>;
  communityNorms: Array<{ id: string; label: string }>;
}

export function fetchGroupOptions(): Promise<V2GroupOptions> {
  return apiFetch<V2GroupOptions>(`${API_PREFIX}/groups/options`);
}
export interface V2GroupDiscoveryPage { groups: V2DiscoverableGroup[]; nextCursor: string | null }
export function fetchDiscoverableGroups(options: { q?: string; cursor?: string; limit?: number } = {}): Promise<V2GroupDiscoveryPage> {
  const params = new URLSearchParams();
  if (options.q?.trim()) params.set('q', options.q.trim());
  if (options.cursor) params.set('cursor', options.cursor);
  if (options.limit !== undefined) params.set('limit', String(options.limit));
  const query = params.size > 0 ? `?${params.toString()}` : '';
  return apiFetch<V2GroupDiscoveryPage>(`${API_PREFIX}/groups/discover${query}`);
}

export interface V2InviteResolution extends V2DiscoverableGroup { isPrivate: boolean }
export function resolveGroupInvite(code: string): Promise<V2InviteResolution> {
  return apiFetch<V2InviteResolution>(`${API_PREFIX}/groups/resolve-invite`, { method: 'POST', body: { code } });
}

export type V2GroupSettingsPatch = Partial<Pick<V2GroupDetail, 'name' | 'description' | 'tagline' | 'location' | 'focusTags' | 'coverId' | 'isPrivate' | 'requireAdminApproval' | 'allowMemberChallenges'>>;
export function updateGroupSettings(groupId: string, patch: V2GroupSettingsPatch): Promise<unknown> {
  return apiFetch(`${API_PREFIX}/groups/${groupId}`, { method: 'PATCH', body: patch });
}

export interface V2PendingApplications { groupId: string; applicants: Array<{ memberId: string; requestedAt: string }> }
export function fetchPendingGroupApplications(groupId: string): Promise<V2PendingApplications> {
  return apiFetch<V2PendingApplications>(`${API_PREFIX}/groups/${groupId}/members/pending`);
}
export type V2AdmissionDecision = 'approve' | 'reject';
export function reviewGroupApplication(groupId: string, memberId: string, decision: V2AdmissionDecision): Promise<{ groupId: string; memberId: string; status: 'active' | 'rejected'; idempotent: boolean }> {
  return apiFetch(`${API_PREFIX}/groups/${groupId}/applications/${memberId}/${decision}`, { method: 'POST', body: {} });
}

/** Canonical Group detail read — Group Home's only truth source. */
export function fetchGroupDetail(groupId: string): Promise<V2GroupDetail> {
  return apiFetch<V2GroupDetail>(`${API_PREFIX}/groups/${groupId}`);
}

export interface V2GroupRoster { groupId: string; members: Array<{ memberId: string; relationship: 'steward' | 'member'; joinedAt: string | null }> }
export function fetchGroupRoster(groupId: string): Promise<V2GroupRoster> {
  return apiFetch<V2GroupRoster>(`${API_PREFIX}/groups/${groupId}/members`);
}
export function leaveGroupV2(groupId: string): Promise<{ id: string; status: 'left' | 'none' }> {
  return apiFetch<{ id: string; status: 'left' | 'none' }>(`${API_PREFIX}/groups/${groupId}/leave`, { method: 'POST', body: {} });
}

/** Governed membership join (`POST (/api/)groups/:groupId/join`). Transport only. */
export function joinGroup(groupId: string): Promise<{ id: string; status: string; role: string }> {
  return apiFetch<{ id: string; status: string; role: string }>(`${API_PREFIX}/groups/${groupId}/join`, {
    method: 'POST',
    body: {},
  });
}
