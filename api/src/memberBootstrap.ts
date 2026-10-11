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
 * Actor identity comes solely from the verified token. The query and every
 * body field are ignored, so none can supply a Firebase UID, member id, role
 * or any authority — with ONE exception: the OPTIONAL body field
 * `displayName`, used insert-only on first creation (an existing member's name
 * is never touched). Response is minimal: `{ memberId, created }`.
 */
export const MEMBER_BOOTSTRAP_PATH = apiPath('/members/bootstrap');

/** Exact method + path match; query string is ignored, nothing else is exempt. */
export function isMemberBootstrapRequest(method: string, url: string): boolean {
  return method === 'POST' && url.split('?')[0] === MEMBER_BOOTSTRAP_PATH;
}

/**
 * Transport/storage safety bound for the optional first-create display name.
 * NOT Product Truth: no governed display-name length rule exists yet (MC-2).
 */
export const DISPLAY_NAME_MAX_LENGTH = 120;

export class InvalidDisplayNameError extends Error {
  readonly statusCode = 400;
  readonly code = 'invalid_display_name';

  constructor() {
    super(`displayName must be 1-${DISPLAY_NAME_MAX_LENGTH} characters of plain text`);
  }
}

/**
 * Reads ONLY `displayName` from the body; every other field is ignored.
 * Absent/null -> no name. Supplied -> trimmed (Unicode preserved, NFC) and
 * rejected if empty, too long, or containing control characters.
 */
export function parseBootstrapDisplayName(body: unknown): string | null {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return null;
  const raw = (body as Record<string, unknown>).displayName;
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') throw new InvalidDisplayNameError();
  const name = raw.trim().normalize('NFC');
  if (name.length === 0 || [...name].length > DISPLAY_NAME_MAX_LENGTH || /\p{Cc}/u.test(name)) {
    throw new InvalidDisplayNameError();
  }
  return name;
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
    const displayName = parseBootstrapDisplayName(request.body);
    const member = await bootstrapMember(db, 'firebase', verified.uid, displayName);
    return { memberId: member.memberId, created: member.created };
  });
}
