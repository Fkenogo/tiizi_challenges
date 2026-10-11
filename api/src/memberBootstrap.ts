import type { FastifyInstance } from 'fastify';
import { extractBearerToken, type TokenVerifier } from './auth.js';
import { apiPath } from './apiPrefix.js';
import type { Db } from './db.js';
import { bootstrapMember } from './members.js';

/**
 * MC-1 — explicit V2 member bootstrap.
 *
 * POST /api/members/bootstrap
 *
 * The ONLY route that may provision a member mapping. It is exempt from the
 * strict `requireAuth` hook (which returns 401 unknown_member for unmapped
 * subjects everywhere else) and instead verifies the bearer token itself.
 *
 * Actor identity comes solely from the verified token. The request body and
 * query are ignored entirely: they can never supply a Firebase UID, member
 * id, role or any authority. Response is minimal: `{ memberId, created }`.
 */
export const MEMBER_BOOTSTRAP_PATH = apiPath('/members/bootstrap');

/** Exact method + path match; query string is ignored, nothing else is exempt. */
export function isMemberBootstrapRequest(method: string, url: string): boolean {
  return method === 'POST' && url.split('?')[0] === MEMBER_BOOTSTRAP_PATH;
}

export interface MemberBootstrapResponse {
  memberId: string;
  created: boolean;
}

export function registerMemberBootstrapRoutes(
  app: FastifyInstance,
  db: Db,
  verifier: TokenVerifier,
): void {
  app.post(MEMBER_BOOTSTRAP_PATH, async (request): Promise<MemberBootstrapResponse> => {
    const verified = await verifier.verify(extractBearerToken(request.headers.authorization));
    const member = await bootstrapMember(db, 'firebase', verified.uid);
    return { memberId: member.memberId, created: member.created };
  });
}
