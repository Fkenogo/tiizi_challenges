import { apiFetch } from './apiClient';

export interface ApiMembershipGroup {
  id: string;
  name: string;
  description: string;
  isPrivate: boolean;
}

export interface ApiMembership {
  groupId: string;
  role: string;
  status: string;
  joinedAt: string;
  group: ApiMembershipGroup;
}

export interface MyMembershipsResponse {
  memberId: string;
  memberships: ApiMembership[];
}

/** Current user's group memberships from the Tiizi API (PostgreSQL shadow). */
export function fetchMyMemberships(): Promise<MyMembershipsResponse> {
  return apiFetch<MyMembershipsResponse>('/v1/memberships/me');
}
