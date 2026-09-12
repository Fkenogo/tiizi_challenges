/**
 * EBC-05 V2 Founder Preview Group authority client.
 *
 * Group create/join for the V2 preview flow go ONLY through the governed
 * EBC-01 server boundary (POST /v1/groups, POST /v1/groups/:id/join) —
 * never direct client Firestore writes. Group listing reads the
 * PostgreSQL membership shadow (GET /v1/memberships/me), the
 * non-authoritative mirror of Firestore Group existence/lifecycle.
 */
import { apiFetch } from './apiClient';

export interface V2Group {
  id: string;
  name: string;
  description: string;
  isPrivate: boolean;
}

export interface V2Membership {
  groupId: string;
  role: string;
  status: string;
  joinedAt: string;
  group: V2Group;
}

export interface V2CreateGroupInput {
  name: string;
  description?: string;
  isPrivate?: boolean;
  requireAdminApproval?: boolean;
  allowMemberChallenges?: boolean;
}

export interface V2CreateGroupResponse {
  id: string;
  legacyId: string;
  name: string;
  isPrivate: boolean;
  role: string;
  status: string;
}

export interface V2JoinGroupResponse {
  id: string;
  legacyId: string;
  status: string;
  role: string;
}

export function createGroupV2(input: V2CreateGroupInput): Promise<V2CreateGroupResponse> {
  return apiFetch<V2CreateGroupResponse>('/v1/groups', {
    method: 'POST',
    body: input,
  });
}

export function joinGroupV2(groupId: string): Promise<V2JoinGroupResponse> {
  return apiFetch<V2JoinGroupResponse>(`/v1/groups/${groupId}/join`, {
    method: 'POST',
    body: {},
  });
}

export function fetchMyGroupsV2(): Promise<{ memberId: string; memberships: V2Membership[] }> {
  return apiFetch<{ memberId: string; memberships: V2Membership[] }>('/v1/memberships/me');
}
