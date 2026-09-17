import { apiFetch } from './apiClient';
import { fetchMyMemberships, type MyMembershipsResponse } from './membershipsApi';

/**
 * TIIZI S2-G — V2 Group establishment client seam.
 *
 * Transport only. The client submits the minimum governing terms (name +
 * optional description) over the existing governed Group authority
 * (`POST /v1/groups`); it never writes Firestore or PostgreSQL directly and
 * never decides owner/steward authority. The creator's membership and
 * Accountable Stewardship are established server-side by the governed
 * authority (`createGovernedGroup`), which also applies all governed
 * defaults (open-by-default admission and challenge-creation capability).
 *
 * The Group read/list surface deliberately reuses the SAME contract the
 * Challenge creation journey already consumes — `GET /v1/memberships/me` —
 * so no second Group integration mechanism exists.
 */

export interface CreateGroupInput {
  name: string;
  description?: string;
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
 * Establish a Group through the governed authority. Only name and (optional)
 * description are submitted; every governed default — creator role
 * `owner`/Accountable Steward, admission Open, challenge creation permitted
 * — is applied by the backend authority, never by the client.
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
    },
  });
}

/** The current member's Groups — the one read contract for Group list/read. */
export { fetchMyMemberships };
export type { MyMembershipsResponse };
