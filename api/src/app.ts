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
import { registerChallengeDiscoveryRoutes } from './challengeDiscovery.js';
import { registerTodayRoutes } from './today.js';
import { registerGroupReadRoutes } from './groupReads.js';
import {
  registerParticipationRoutes,
  type ParticipationRouteDeps,
} from './challengeParticipationRoutes.js';
import {
  registerChallengeCreationRoutes,
  type ChallengeCreationRouteDeps,
} from './challengeCreationRoutes.js';
import {
  registerGroupMutationRoutes,
  type GroupMutationRouteDeps,
} from './groupMutationRoutes.js';
import { registerChallengeCreationSeamRoutes } from './challengeCreationSeamRoutes.js';
import { createPostgresGroupReadStore } from './postgresGroupReadStore.js';
import { registerSocialCauseApprovalRoutes, type SocialCauseApprovalDeps } from './socialCauseApprovalRoutes.js';
import { registerOperatorConsoleRoutes } from './operatorConsoleRoutes.js';
import { registerChallengeTemplateRoutes } from './challengeTemplateRoutes.js';
import { registerGroupFeedRoutes } from './groupFeedReads.js';
// CF-2/CF-3 (S1): Challenge-local Activity Share publication + Challenge
// Feed read. Own storage (never group_feed_*); no automatic publication.
import { registerChallengeFeedRoutes } from './challengeFeedShares.js';
import { API_PREFIX } from './apiPrefix.js';
import { isMemberBootstrapRequest, registerMemberBootstrapRoutes } from './memberBootstrap.js';
import { registerMemberProfileRoutes } from './memberProfileRoutes.js';
import { registerMemberRecentActivityRoutes } from './memberRecentActivity.js';
import { registerMemberTimelineRoutes } from './memberTimeline.js';
import { registerMemberPreferenceRoutes } from './memberPreferences.js';
import { registerMediaRoutes, type MediaRouteDeps } from './mediaRoutes.js';
import { createR2ObjectStoreFromEnv } from './r2ObjectStore.js';
/* AEC-005A owner-only Personal Recent Activity reads accepted V2 applications
 * and their valid correction/reversal lineage. It does not read or publish Feed events. */

export interface AppDeps {
  db: Db;
  socialCauseApproval?: SocialCauseApprovalDeps;
  verifier: TokenVerifier;
  /** C2B runtime deps. Absent in tests unless the test wires them; requests
   * then fail closed (group authority unavailable) instead of authorizing. */
  challengeActivity?: ChallengeActivityRouteDeps;
  /**
   * C3B participation-mutation deps (join/withdraw). Optional; falls back to
   * `challengeActivity` so existing wiring keeps working. Carries the
   * CORR-001 server clock for deterministic lifecycle tests.
   */
  participation?: ParticipationRouteDeps;
  /** EBC-01 governed Group mutation boundary. Absent: routes fail closed. */
  groupMutation?: GroupMutationRouteDeps;
  /** EBC-01 governed Challenge establishment. Absent: route fails closed. */
  challengeCreation?: ChallengeCreationRouteDeps;
  /** Durable media storage (Cloudflare R2 in runtime, or test double). */
  media?: MediaRouteDeps;
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
      const reason = (error as { eligibilityReason?: string }).eligibilityReason;
      reply.status(statusCode).send({
        error: {
          code,
          message: error.message,
          ...(reason !== undefined ? { reason } : {}),
          ...(details !== undefined ? { details } : {}),
        },
      });
    }
  });

  // Liveness only: never touches the database, never requires auth.
  app.get('/health', async () => ({ status: 'ok', service: 'tiizi-api' }));

  // Readiness: minimal PostgreSQL connectivity check. 200 only when the
  // database answers; 503 without leaking connection details when it does not.
  // Intentionally outside the API namespace and exempt from authentication
  // below.
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
    if (request.url === '/health' || request.url === '/ready' || !request.url.startsWith(`${API_PREFIX}/`)) return;
    // MC-1: the single explicit provisioning seam verifies the token itself.
    if (isMemberBootstrapRequest(request.method, request.url)) return;
    await auth(request, reply);
  });

  const mediaDeps: MediaRouteDeps = deps.media ?? (() => {
    const r2 = createR2ObjectStoreFromEnv();
    return { objectStore: r2.store, readUrlTtlSeconds: r2.readUrlTtlSeconds };
  })();

  registerMemberBootstrapRoutes(app, deps.db, deps.verifier);
  registerMemberRecentActivityRoutes(app, deps.db);
  registerMemberTimelineRoutes(app, deps.db);
  registerMemberProfileRoutes(app, deps.db, mediaDeps);
  registerMediaRoutes(app, deps.db, mediaDeps);
  registerMemberPreferenceRoutes(app, deps.db);
  registerMembershipRoutes(app, deps.db, mediaDeps);
  registerGroupIdentityRoutes(app, deps.db);
  registerKnowledgeRoutes(app, deps.db);
  registerChallengeActivityRoutes(app, deps.db, deps.challengeActivity ?? {});
  // C3A V2 Challenge reads (list/detail/leaderboard). Same live authority
  // as C2B; absent authority fails closed per-route instead of authorizing.
  // S4a: the governed `groupId` list filter shares the EBC-01 Group store.
  const groupReadStore = createPostgresGroupReadStore(deps.db);
  registerChallengeReadRoutes(app, deps.db, {
    ...(deps.challengeActivity ?? {}),
    groupStore: groupReadStore,
    mediaDeps,
  });
  registerChallengeDiscoveryRoutes(app, deps.db, mediaDeps);
  registerTodayRoutes(app, deps.db, {
    ...(deps.challengeActivity ?? {}),
    mediaDeps,
  });
  // S4a governed Group detail read (Group Home). Same live store seam as
  // the governed mutations; absent store fails closed per-route.
  registerGroupReadRoutes(app, deps.db, { store: groupReadStore, mediaDeps });
  // GF-03 member Feed read: current PostgreSQL Group membership remains the
  // only audience authority; a missing seam fails closed.
  registerGroupFeedRoutes(app, deps.db, {
    groupMembershipAuthority: deps.challengeActivity?.groupMembershipAuthority,
  });
  // CF-3 Challenge Feed read + CF-2 S1 Share publication/withdrawal. Same
  // live authority seam; absent authority fails closed per-route. The
  // Group Feed contract above is untouched by this registration.
  registerChallengeFeedRoutes(app, deps.db, {
    groupMembershipAuthority: deps.challengeActivity?.groupMembershipAuthority,
    mediaDeps,
  });
  // C3B V2 participation mutations (join/withdraw). Same live authority as
  // C2B; absent authority fails closed per-route instead of authorizing.
  registerParticipationRoutes(app, deps.db, deps.participation ?? deps.challengeActivity ?? {});
  // V2 Group mutations use the PostgreSQL authority directly; database
  // failures fail closed and never fall back to a legacy Firestore adapter.
  registerGroupMutationRoutes(app, deps.db);
  // EBC-01 governed V2 Challenge establishment. Authenticated actor,
  // charter-aware live creation authority, KCS-ready + tuple validation;
  // absent deps fail closed instead of establishing.
  registerChallengeCreationRoutes(app, deps.db, deps.challengeCreation ?? {});
  registerSocialCauseApprovalRoutes(app, deps.db, deps.socialCauseApproval ?? {});
  registerOperatorConsoleRoutes(app, deps.db);
  // P5T-1 governed Challenge Template authority (Operator writes + member published reads).
  registerChallengeTemplateRoutes(app, deps.db);
  // S2a challenge-creation API seam (read-only, transport only): Composer
  // activity options + Composer draft preview through the single PF-03
  // validator. Additive; persists nothing; no new domain authority.
  registerChallengeCreationSeamRoutes(app, deps.db);
  return app;
}
