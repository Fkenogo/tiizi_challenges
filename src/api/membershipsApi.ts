import { API_PREFIX, apiFetch } from './apiClient';

export interface ApiMembershipGroup {
  id: string;
  name: string;
  description: string;
  isPrivate: boolean;
  allowMemberChallenges?: boolean;
  /** S4a CORR-001 richer identity (server mirror; absent on legacy rows). */
  coverId?: string | null;
  tagline?: string;
  location?: string;
  focusTags?: string[];
  /** Canonical Goal labels and the Group's optional bounded custom Goal. */
  goals?: string[];
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
  /** Present when at least one server-side pending application exists. */
  pendingMemberships?: Array<{
    groupId: string;
    requestedAt: string;
    group: ApiMembershipGroup;
  }>;
}

/** Current user's authoritative Group memberships from the Tiizi API/PostgreSQL. */
export function fetchMyMemberships(): Promise<MyMembershipsResponse> {
  return apiFetch<MyMembershipsResponse>(`${API_PREFIX}/memberships/me`);
}
