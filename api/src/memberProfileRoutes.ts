/**
 * MC-2B-3 — complete own-member Profile API assembly.
 *
 * `GET /api/me` and `PATCH /api/me` are transport composition over existing
 * governed capabilities:
 *
 * - identity/display-name read: `getMemberProfileIdentityById`
 * - display-name mutation: `updateOwnDisplayName` (row lock, history, no-op)
 * - Group and Challenge summaries: `getMemberProfileSummaries`
 *
 * No Profile, Group, participation, lifecycle or authorization authority is
 * created here. The actor comes only from the verified token via the global
 * `requireAuth` hook; no request-supplied member id, UID, role or email is
 * accepted.
 *
 * PATCH transaction boundary: the display-name mutation and its history row
 * commit atomically inside `updateOwnDisplayName`. The complete response is
 * composed from independent summary reads *after* that commit. If a summary
 * read fails, the request fails with the existing API error policy rather
 * than reporting a successful mutation; the committed edit is not rolled
 * back. Retrying the same PATCH is a safe no-op. No cross-request snapshot
 * isolation is claimed for the summary pages: they remain read-committed
 * reads, consistent with the MC-2B-2 contract.
 *
 * Pagination is the existing MC-2B-2 keyset contract. Query parameter names
 * are documented in the module and PR: `groupsLimit`, `groupsCursor`,
 * `challengesLimit`, `challengesCursor`. Cursors are scoped to member, summary
 * type and page size; invalid or mismatched cursors fail with 400.
 */

import type { FastifyInstance } from 'fastify';
import { authenticatedMember, type RequestMember } from './auth.js';
import { API_PREFIX } from './apiPrefix.js';
import type { Db } from './db.js';
import {
  getMemberProfileIdentityById,
  updateOwnDisplayName,
  type MemberProfileIdentity,
} from './memberProfileIdentity.js';
import {
  getMemberProfileSummaries,
  type MemberProfileSummaries,
  type MemberProfileSummaryOptions,
} from './memberProfileSummaries.js';

export interface MemberProfileQuery {
  groupsLimit?: unknown;
  groupsCursor?: unknown;
  challengesLimit?: unknown;
  challengesCursor?: unknown;
}

export interface MemberProfileResponse {
  memberId: string;
  displayName: string | null;
  profileImage: { status: 'not_configured' };
  groups: MemberProfileSummaries['groups'];
  challenges: MemberProfileSummaries['challenges'];
}

function summaryOptionsFromQuery(raw: unknown): MemberProfileSummaryOptions {
  const query = (raw !== null && typeof raw === 'object' ? raw : {}) as MemberProfileQuery;
  return {
    groups: { limit: query.groupsLimit, cursor: query.groupsCursor },
    challenges: { limit: query.challengesLimit, cursor: query.challengesCursor },
  };
}

function composeProfile(
  identity: MemberProfileIdentity,
  summaries: MemberProfileSummaries,
): MemberProfileResponse {
  return {
    memberId: identity.memberId,
    displayName: identity.displayName,
    profileImage: { status: 'not_configured' },
    groups: summaries.groups,
    challenges: summaries.challenges,
  };
}

async function readOwnProfile(
  db: Db,
  member: RequestMember,
  options: MemberProfileSummaryOptions,
): Promise<MemberProfileResponse> {
  const identity = await getMemberProfileIdentityById(db, member.memberId);
  const summaries = await getMemberProfileSummaries(db, member, options);
  return composeProfile(identity, summaries);
}

export function registerMemberProfileRoutes(app: FastifyInstance, db: Db): void {
  const path = `${API_PREFIX}/me`;

  app.get(path, async (request): Promise<MemberProfileResponse> => {
    const member = authenticatedMember(request);
    return readOwnProfile(db, member, summaryOptionsFromQuery(request.query));
  });

  app.patch(path, async (request): Promise<MemberProfileResponse> => {
    const member = authenticatedMember(request);
    // This commits the canonical value + history atomically before any
    // independent summary read below. A later read failure cannot undo it.
    const identity = await updateOwnDisplayName(db, member, request.body);
    const summaries = await getMemberProfileSummaries(db, member);
    return composeProfile(identity, summaries);
  });
}
