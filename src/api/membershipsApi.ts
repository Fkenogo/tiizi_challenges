import { apiFetch } from './apiClient';

export interface ApiMembershipGroup {
  id: string;
  name: string;
  description: string;
  isPrivate: boolean;
  /** S4a CORR-001 richer identity (server mirror; absent on legacy rows). */
  coverId?: string | null;
  tagline?: string;
  location?: string;
  focusTags?: string[];
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
