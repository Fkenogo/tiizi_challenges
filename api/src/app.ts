import Fastify, { type FastifyError } from 'fastify';
import cors from '@fastify/cors';
import { requireAuth, type TokenVerifier } from './auth.js';
import { allowedOriginsFromEnv } from './cors.js';
import type { Db } from './db.js';
import { registerGroupIdentityRoutes } from './groupIdentity.js';
import { registerKnowledgeRoutes } from './knowledge.js';
import { registerMembershipRoutes } from './memberships.js';
import {
  registerChallengeActivityRoutes,
  type ChallengeActivityRouteDeps,
} from './challengeActivityRoutes.js';
import { registerChallengeReadRoutes } from './challengeReads.js';
import { registerParticipationRoutes } from './challengeParticipationRoutes.js';
/* No member activity-history route in C1: Tiizi is not a personal activity
 * logger (Stage F), and no user-facing personal-history capability is
 * approved. The ledger is readable internally via listEffectiveEvents for
 * C2 application/replay. A product surface, if ever approved, is a C2+ API
 * decision — not an accident of this table existing. */

export interface AppDeps {
  db: Db;
  verifier: TokenVerifier;
  /** C2B runtime deps. Absent in tests unless the test wires them; requests
   * then fail closed (group authority unavailable) instead of authorizing. */
  challengeActivity?: ChallengeActivityRouteDeps;
}

export function buildApp(deps: AppDeps) {
  const app = Fastify({ logger: false });
  // Fail fast on invalid CORS configuration. An empty allowlist denies
  // cross-origin requests (same-origin only) — it never falls back to '*'.
  const allowedOrigins = allowedOriginsFromEnv();
  void app.register(cors, allowedOrigins.length > 0 ? { origin: allowedOrigins } : { origin: false });

  app.setErrorHandler((error: FastifyError, _request, reply) => {
    const statusCode = error.statusCode ?? 500;
    const code =
      error.code && error.code !== 'FST_ERR_VALIDATION'
        ? error.code
        : statusCode === 500
          ? 'internal_error'
          : 'request_error';
    if (statusCode >= 500) {
      reply.status(statusCode).send({ error: { code, message: 'Internal server error' } });
    } else {
      const details = (error as { details?: unknown }).details;
      reply.status(statusCode).send({
        error: {
          code,
          message: error.message,
          ...(details !== undefined ? { details } : {}),
        },
      });
    }
  });

  // Liveness only: never touches the database, never requires auth.
  app.get('/health', async () => ({ status: 'ok', service: 'tiizi-api' }));

  // Readiness: minimal PostgreSQL connectivity check. 200 only when the
  // database answers; 503 without leaking connection details when it does not.
  // Intentionally outside /v1/ and exempt from authentication below.
  app.get('/ready', async (_request, reply) => {
    try {
      await deps.db.query('SELECT 1');
      return { status: 'ok', service: 'tiizi-api' };
    } catch {
      return reply
        .status(503)
        .send({ error: { code: 'not_ready', message: 'Database unavailable' } });
    }
  });

  const auth = requireAuth(deps.db, deps.verifier);
  app.addHook('onRequest', async (request, reply) => {
    if (request.url === '/health' || request.url === '/ready' || !request.url.startsWith('/v1/')) return;
    await auth(request, reply);
  });

  registerMembershipRoutes(app, deps.db);
  registerGroupIdentityRoutes(app, deps.db);
  registerKnowledgeRoutes(app, deps.db);
  registerChallengeActivityRoutes(app, deps.db, deps.challengeActivity ?? {});
  // C3A V2 Challenge reads (list/detail/leaderboard). Same live authority
  // as C2B; absent authority fails closed per-route instead of authorizing.
  registerChallengeReadRoutes(app, deps.db, deps.challengeActivity ?? {});
  // C3B V2 participation mutations (join/withdraw). Same live authority as
  // C2B; absent authority fails closed per-route instead of authorizing.
  registerParticipationRoutes(app, deps.db, deps.challengeActivity ?? {});
  return app;
}
