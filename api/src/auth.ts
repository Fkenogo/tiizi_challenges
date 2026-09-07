import type { FastifyReply, FastifyRequest } from 'fastify';
import { applicationDefault, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { Db } from './db.js';
import { findMemberByAuth } from './members.js';

export interface VerifiedToken {
  uid: string;
}

export interface TokenVerifier {
  verify(bearerToken: string): Promise<VerifiedToken>;
}

export interface RequestMember {
  memberId: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    member?: RequestMember;
  }
}

export class AuthError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function extractBearerToken(header: string | undefined): string {
  if (!header) throw new AuthError(401, 'missing_token', 'Authorization Bearer token is required');
  const match = /^Bearer (.+)$/.exec(header.trim());
  if (!match) throw new AuthError(401, 'missing_token', 'Authorization Bearer token is required');
  return match[1];
}

/** Firebase Admin SDK adapter. The ONLY module allowed to import firebase-admin. */

/**
 * Thrown when the Firebase Admin SDK cannot be initialized or configured.
 * Never carries credential values or sensitive configuration in its message.
 */
export class FirebaseAdminInitError extends Error {
  readonly statusCode = 500;
  readonly code = 'firebase_admin_init_failed';

  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'FirebaseAdminInitError';
    if (options?.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

function resolveFirebaseProjectId(): string | undefined {
  const raw = process.env.FIREBASE_PROJECT_ID?.trim();
  return raw ? raw : undefined;
}

/**
 * Explicit, idempotent Firebase Admin initialization seam for the standalone API.
 *
 * - Reuses the default app when one already exists (CLI paths, tests, warm runtime).
 * - Otherwise initializes exactly once via Application Default Credentials, which
 *   honors GOOGLE_APPLICATION_CREDENTIALS locally and workload identity in production.
 * - Honors FIREBASE_PROJECT_ID when explicitly configured; never hard-codes a project.
 * - Never reads service-account JSON manually and never logs credential material.
 */
export function ensureFirebaseAdmin(): App {
  const existing = getApps();
  if (existing.length > 0) return existing[0] as App;
  const projectId = resolveFirebaseProjectId();
  try {
    return initializeApp({
      credential: applicationDefault(),
      ...(projectId ? { projectId } : {}),
    });
  } catch (error) {
    throw new FirebaseAdminInitError(
      'Firebase Admin initialization failed. Configure Application Default Credentials ' +
        'and FIREBASE_PROJECT_ID where required.',
      { cause: error },
    );
  }
}

export function createFirebaseVerifier(): TokenVerifier {
  // Fail fast at server startup so a misconfigured runtime never serves auth silently.
  ensureFirebaseAdmin();
  return {
    async verify(bearerToken: string): Promise<VerifiedToken> {
      // Re-resolve idempotently so the verifier stays safe even if it outlives
      // the app instance it was created with. Init failures propagate as-is
      // and are never mapped to invalid_token.
      const adminApp = ensureFirebaseAdmin();
      let decoded: { uid?: string };
      try {
        decoded = await getAuth(adminApp).verifyIdToken(bearerToken);
      } catch (error) {
        if (error instanceof AuthError) throw error;
        if (error instanceof FirebaseAdminInitError) throw error;
        throw new AuthError(401, 'invalid_token', 'Token verification failed');
      }
      if (!decoded.uid) throw new AuthError(401, 'invalid_token', 'Token has no subject');
      return { uid: decoded.uid };
    },
  };
}

export function requireAuth(db: Db, verifier: TokenVerifier) {
  return async function requireAuthHook(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const token = extractBearerToken(request.headers.authorization);
    const verified = await verifier.verify(token);
    const member = await findMemberByAuth(db, 'firebase', verified.uid);
    if (!member) {
      throw new AuthError(401, 'unknown_member', 'Authenticated identity is not linked to a Tiizi member');
    }
    request.member = { memberId: member.memberId };
  };
}

export function authenticatedMember(request: FastifyRequest): RequestMember {
  if (!request.member) throw new AuthError(401, 'missing_token', 'Authentication is required');
  return request.member;
}
