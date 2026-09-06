import type { FastifyReply, FastifyRequest } from 'fastify';
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
export function createFirebaseVerifier(): TokenVerifier {
  return {
    async verify(bearerToken: string): Promise<VerifiedToken> {
      const { getAuth } = await import('firebase-admin/auth');
      try {
        const decoded = await getAuth().verifyIdToken(bearerToken);
        if (!decoded.uid) throw new AuthError(401, 'invalid_token', 'Token has no subject');
        return { uid: decoded.uid };
      } catch (error) {
        if (error instanceof AuthError) throw error;
        throw new AuthError(401, 'invalid_token', 'Token verification failed');
      }
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
