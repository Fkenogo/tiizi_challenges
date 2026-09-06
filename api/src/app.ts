import Fastify, { type FastifyError } from 'fastify';
import cors from '@fastify/cors';
import { requireAuth, type TokenVerifier } from './auth.js';
import type { Db } from './db.js';
import { registerMembershipRoutes } from './memberships.js';

export interface AppDeps {
  db: Db;
  verifier: TokenVerifier;
}

export function buildApp(deps: AppDeps) {
  const app = Fastify({ logger: false });
  void app.register(cors);

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
      reply.status(statusCode).send({ error: { code, message: error.message } });
    }
  });

  app.get('/health', async () => ({ status: 'ok', service: 'tiizi-api' }));

  const auth = requireAuth(deps.db, deps.verifier);
  app.addHook('onRequest', async (request, reply) => {
    if (request.url === '/health' || !request.url.startsWith('/v1/')) return;
    await auth(request, reply);
  });

  registerMembershipRoutes(app, deps.db);
  return app;
}
