/**
 * Active API namespace contract.
 *
 * Pass 001 replaced the retired `/v1` API prefix with the product-neutral
 * `/api` namespace. This suite proves, against the real Fastify application:
 *
 * 1. `/api/*` is the ACTIVE API contract — representative authenticated READ
 *    and WRITE operations succeed across the major current domains;
 * 2. the retired `/v1/*` namespace is NOT an active API surface — every old
 *    path fails to resolve, and there is deliberately no compatibility alias,
 *    redirect, proxy, duplicate registration, or fallback;
 * 3. the mandatory authentication boundary applies to `/api/*` and not to the
 *    unversioned `/health` and `/ready` infrastructure routes.
 *
 * This is the CI contract gate for the namespace correction; see
 * `docs/architecture/TIIZI-API-NAMESPACE-CORRECTION-001.md` and `AGENTS.md`.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { activateChallenge, createChallenge, type ChallengeCreationResolvers } from '../src/challenges.js';
import type { Db } from '../src/db.js';
import type { GroupMembershipAuthority } from '../src/groupMembershipAuthority.js';
import {
  authHeaders,
  seedGroup,
  seedMember,
  seedMembership,
  stubEligibility,
  stubVerifier,
  testDb,
} from './helpers.js';

let db: Db;
let sequence = 0;

/**
 * Eligible-only Group membership authority for the fixture. Production wires
 * the PostgreSQL authority; the namespace contract is not about membership
 * resolution, so a deterministic eligible authority keeps the focus on the
 * `/api` path contract.
 */
function stubAuthority(eligibleGroups: Set<string>): GroupMembershipAuthority {
  return {
    async resolveGroupMembershipAuthority(groupId: string) {
      if (eligibleGroups.has(groupId)) return { status: 'active', eligible: true };
      return { status: 'no_membership', eligible: false };
    },
  };
}

interface Pin {
  knowledge_id: string;
  current_version: number;
}

/**
 * One fixture spanning the domains the namespace carries: Group read +
 * mutation, Challenge read, participation, activity path, Operator Console
 * read, and Social Cause review authority.
 *
 * The Challenge is established through the REAL governed establishment path
 * and activated, so the read/participation/activity routes exercise a genuine
 * governing config version rather than a synthetic row.
 */
async function fixture() {
  const n = ++sequence;
  const owner = await seedMember(db, `contract-owner-${n}`);
  const operator = await seedMember(db, `contract-operator-${n}`);
  const groupId = await seedGroup(db, { name: `Contract Group ${n}` });
  await seedMembership(db, groupId, owner, { role: 'owner', status: 'active' });
  await db.query('UPDATE groups SET steward_member_id=$2 WHERE group_id=$1', [groupId, owner]);

  const knowledge = await db.query<{ knowledge_id: string; current_version: number }>(
    `INSERT INTO knowledge_items (kind, name, lifecycle) VALUES ('fitness', $1, 'published')
     RETURNING knowledge_id, current_version`,
    [`contract-activity-${n}`],
  );
  const pin: Pin = {
    knowledge_id: String(knowledge.rows[0].knowledge_id),
    current_version: Number(knowledge.rows[0].current_version),
  };
  const resolvers: ChallengeCreationResolvers = {
    resolveKnowledgePin: async () => pin,
    resolveKnowledgeEligibility: async () => stubEligibility(),
    resolveGroupAuthority: async () => ({ status: 'active' }),
    resolveGroupMembershipAuthority: async () => ({ status: 'active', eligible: true }),
  };
  const { challenge } = await createChallenge(
    db,
    {
      group_id: groupId,
      created_by_member_id: owner,
      title: `Contract Challenge ${n}`,
      description: 'Contract fixture',
      instructions: 'Contract instructions',
      challenge_type: 'collective',
      start_date: '2026-09-01',
      end_date: '2026-12-31',
      goal_value: 500,
      goal_unit: 'reps',
      activities: [{ canonical_key: pin.knowledge_id, metric: 'repetitions', target_value: 20, unit: 'reps' }],
    } as never,
    resolvers,
  );
  const challengeId = String(challenge.challenge_id);
  await activateChallenge(db, challengeId);

  await db.query(
    `INSERT INTO challenge_social_causes (challenge_id,title,description,purpose,beneficiary,payment_destination_reference,destination_owner)
     VALUES ($1,'Contract Cause','Cause description','Cause purpose','Contract Trust','beneficiary-ref','beneficiary')`,
    [challengeId],
  );
  await db.query(
    `INSERT INTO platform_operator_console_readers (member_id,grant_reference) VALUES ($1,'contract console grant')`,
    [operator],
  );
  await db.query(
    `INSERT INTO platform_operator_cause_reviewers (member_id,grant_reference) VALUES ($1,'contract cause grant')`,
    [operator],
  );

  const authority = stubAuthority(new Set([groupId]));
  const tokens = { owner: `contract-owner-token-${n}`, operator: `contract-operator-token-${n}` };
  const app = buildApp({
    db,
    verifier: stubVerifier({
      [tokens.owner]: `contract-owner-${n}`,
      [tokens.operator]: `contract-operator-${n}`,
    }),
    challengeActivity: { groupMembershipAuthority: authority },
    participation: { groupMembershipAuthority: authority },
    socialCauseApproval: { isPlatformOperator: async (memberId) => memberId === operator },
  });

  return {
    app,
    groupId,
    challengeId,
    activityKey: pin.knowledge_id,
    ownerAuth: authHeaders(tokens.owner),
    operatorAuth: authHeaders(tokens.operator),
  };
}

beforeEach(async () => {
  db = testDb();
  await db.query('TRUNCATE platform_operator_cause_reviewers, platform_operator_console_readers CASCADE');
  await db.query('TRUNCATE challenge_social_cause_decisions, challenge_social_causes CASCADE');
  await db.query('TRUNCATE challenge_derived_state, challenge_participation_derived, challenge_activity_records, challenge_activity_configs, challenge_config_versions, challenge_participations, challenge_establishment_keys, challenge_finalizations, challenge_participation_finals, challenges CASCADE');
});

// ---------------------------------------------------------------------------
// 1. `/api/*` is the active contract — representative authenticated operations
// ---------------------------------------------------------------------------

describe('active /api namespace contract — authenticated operations', () => {
  it('Group READ: GET /api/memberships/me returns the caller\'s Groups', async () => {
    const f = await fixture();
    const response = await f.app.inject({ method: 'GET', url: '/api/memberships/me', headers: f.ownerAuth });
    expect(response.statusCode).toBe(200);
    expect(response.json().memberId).toBeTruthy();
    expect(response.json().memberships.map((m: { groupId: string }) => m.groupId)).toContain(f.groupId);
  });

  it('Group READ: GET /api/groups/:groupId returns canonical Group detail', async () => {
    const f = await fixture();
    const response = await f.app.inject({ method: 'GET', url: `/api/groups/${f.groupId}`, headers: f.ownerAuth });
    expect(response.statusCode).toBe(200);
    expect(response.json().id).toBe(f.groupId);
  });

  it('Group READ: GET /api/groups/discover resolves the discovery contract', async () => {
    const f = await fixture();
    const response = await f.app.inject({ method: 'GET', url: '/api/groups/discover', headers: f.ownerAuth });
    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.json().groups)).toBe(true);
  });

  it('Group MUTATION: PATCH /api/groups/:groupId updates governed settings', async () => {
    const f = await fixture();
    const response = await f.app.inject({
      method: 'PATCH',
      url: `/api/groups/${f.groupId}`,
      headers: f.ownerAuth,
      payload: { name: 'Contract Group Renamed' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().name).toBe('Contract Group Renamed');
  });

  it('Group MUTATION: POST /api/groups/:groupId/leave closes the caller\'s own membership', async () => {
    const db2 = testDb();
    const n = ++sequence;
    const owner = await seedMember(db2, `contract-leave-owner-${n}`);
    const member = await seedMember(db2, `contract-leave-member-${n}`);
    const groupId = await seedGroup(db2, { name: `Contract Leave Group ${n}` });
    await seedMembership(db2, groupId, owner, { role: 'owner', status: 'active' });
    await seedMembership(db2, groupId, member, { role: 'member', status: 'active' });
    const app = buildApp({ db: db2, verifier: stubVerifier({ leave: `contract-leave-member-${n}` }) });
    const response = await app.inject({ method: 'POST', url: `/api/groups/${groupId}/leave`, headers: authHeaders('leave'), payload: {} });
    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('left');
  });

  it('Challenge READ: GET /api/challenges returns the visible Challenge list', async () => {
    const f = await fixture();
    const response = await f.app.inject({ method: 'GET', url: '/api/challenges', headers: f.ownerAuth });
    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.json().challenges)).toBe(true);
  });

  it('Challenge READ: GET /api/challenges/:challengeId returns Challenge detail', async () => {
    const f = await fixture();
    const response = await f.app.inject({ method: 'GET', url: `/api/challenges/${f.challengeId}`, headers: f.ownerAuth });
    expect(response.statusCode).toBe(200);
    expect(response.json().challengeId).toBe(f.challengeId);
  });

  it('Challenge MUTATION: POST /api/challenges/:challengeId/join opens a participation episode', async () => {
    const n = ++sequence;
    const owner = await seedMember(db, `contract-join-owner-${n}`);
    const joiner = await seedMember(db, `contract-join-member-${n}`);
    const groupId = await seedGroup(db, { name: `Contract Join Group ${n}` });
    await seedMembership(db, groupId, owner, { role: 'owner', status: 'active' });
    await seedMembership(db, groupId, joiner, { role: 'member', status: 'active' });
    await db.query('UPDATE groups SET steward_member_id=$2 WHERE group_id=$1', [groupId, owner]);

    const knowledge = await db.query<{ knowledge_id: string; current_version: number }>(
      `INSERT INTO knowledge_items (kind, name, lifecycle) VALUES ('fitness', $1, 'published')
       RETURNING knowledge_id, current_version`,
      [`contract-join-activity-${n}`],
    );
    const pin: Pin = {
      knowledge_id: String(knowledge.rows[0].knowledge_id),
      current_version: Number(knowledge.rows[0].current_version),
    };
    const { challenge } = await createChallenge(
      db,
      {
        group_id: groupId,
        created_by_member_id: owner,
        title: `Contract Join Challenge ${n}`,
        challenge_type: 'collective',
        start_date: '2026-09-01',
        end_date: '2026-12-31',
        goal_value: 500,
        goal_unit: 'reps',
        activities: [{ canonical_key: pin.knowledge_id, metric: 'repetitions', target_value: 20, unit: 'reps' }],
      } as never,
      {
        resolveKnowledgePin: async () => pin,
        resolveKnowledgeEligibility: async () => stubEligibility(),
        resolveGroupAuthority: async () => ({ status: 'active' }),
        resolveGroupMembershipAuthority: async () => ({ status: 'active', eligible: true }),
      },
    );
    const challengeId = String(challenge.challenge_id);
    await activateChallenge(db, challengeId);

    const authority = stubAuthority(new Set([groupId]));
    const app = buildApp({
      db,
      verifier: stubVerifier({ joiner: `contract-join-member-${n}` }),
      challengeActivity: { groupMembershipAuthority: authority },
      participation: { groupMembershipAuthority: authority },
    });
    const response = await app.inject({
      method: 'POST',
      url: `/api/challenges/${challengeId}/join`,
      headers: authHeaders('joiner'),
      payload: {},
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('active');
  });

  it('Activity path: join then POST /api/challenges/:challengeId/activity accepts a governed activity', async () => {
    const f = await fixture();
    // Evidence acceptance uses the governed server clock, so the sequence is
    // real: the member must own an active participation episode covering the
    // Evidence instant before an activity application can be accepted.
    const join = await f.app.inject({
      method: 'POST',
      url: `/api/challenges/${f.challengeId}/join`,
      headers: f.ownerAuth,
      payload: {},
    });
    expect(join.statusCode).toBe(200);

    // The evidence instant must follow the join instant: the join stores its
    // own wall-clock `joined_at`, and an owning episode is the interval
    // [joined_at, exited_at). Taking a fresh instant after the join keeps the
    // sequence honest without depending on the server clock's resolution.
    await new Promise((resolve) => setTimeout(resolve, 25));
    const response = await f.app.inject({
      method: 'POST',
      url: `/api/challenges/${f.challengeId}/activity`,
      headers: f.ownerAuth,
      payload: {
        activity_kind: 'fitness',
        canonical_key: f.activityKey,
        value: 10,
        unit: 'reps',
        occurred_at: new Date().toISOString(),
        client_key: `contract-activity-${f.challengeId}`,
      },
    });
    expect(response.statusCode).toBe(200);
  });

  it('Operator Console READ: GET /api/operator/console/overview returns the granted projection', async () => {
    const f = await fixture();
    const response = await f.app.inject({ method: 'GET', url: '/api/operator/console/overview', headers: f.operatorAuth });
    expect(response.statusCode).toBe(200);
  });

  it('Social Cause review authority: GET /api/operator/social-causes/pending returns the Operator queue', async () => {
    const f = await fixture();
    const response = await f.app.inject({ method: 'GET', url: '/api/operator/social-causes/pending', headers: f.operatorAuth });
    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.json().causes)).toBe(true);
  });

  it('Activity Library READ: GET /api/knowledge resolves the canonical Knowledge contract', async () => {
    const f = await fixture();
    const response = await f.app.inject({ method: 'GET', url: '/api/knowledge?canonicalOnly=true', headers: f.ownerAuth });
    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.json().items)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. The retired `/v1/*` namespace is not an active API contract
// ---------------------------------------------------------------------------

/**
 * Every formerly active `/v1` path, with the HTTP method it was registered
 * under. There must be no compatibility alias, so each must fail to resolve.
 */
const RETIRED_V1_ROUTES: Array<[string, string]> = [
  ['GET', '/v1/memberships/me'],
  ['GET', '/v1/groups'],
  ['POST', '/v1/groups'],
  ['GET', '/v1/groups/discover'],
  ['GET', '/v1/groups/options'],
  ['GET', '/v1/groups/resolve-invite'],
  ['POST', '/v1/groups/resolve-invite'],
  ['GET', '/v1/groups/00000000-0000-4000-8000-000000000001'],
  ['PATCH', '/v1/groups/00000000-0000-4000-8000-000000000001'],
  ['GET', '/v1/groups/00000000-0000-4000-8000-000000000001/members'],
  ['GET', '/v1/groups/00000000-0000-4000-8000-000000000001/members/pending'],
  ['POST', '/v1/groups/00000000-0000-4000-8000-000000000001/join'],
  ['POST', '/v1/groups/00000000-0000-4000-8000-000000000001/leave'],
  ['GET', '/v1/challenges'],
  ['POST', '/v1/challenges'],
  ['GET', '/v1/challenges/00000000-0000-4000-8000-000000000002'],
  ['GET', '/v1/challenges/00000000-0000-4000-8000-000000000002/leaderboard'],
  ['GET', '/v1/challenges/00000000-0000-4000-8000-000000000002/contributors'],
  ['POST', '/v1/challenges/00000000-0000-4000-8000-000000000002/join'],
  ['POST', '/v1/challenges/00000000-0000-4000-8000-000000000002/withdraw'],
  ['POST', '/v1/challenges/00000000-0000-4000-8000-000000000002/activity'],
  ['PUT', '/v1/challenges/00000000-0000-4000-8000-000000000002/social-cause'],
  ['DELETE', '/v1/challenges/00000000-0000-4000-8000-000000000002/social-cause'],
  ['POST', '/v1/challenges/00000000-0000-4000-8000-000000000002/social-cause/decision'],
  ['GET', '/v1/knowledge'],
  ['GET', '/v1/knowledge/code/push-up'],
  ['GET', '/v1/knowledge/00000000-0000-4000-8000-000000000003'],
  ['GET', '/v1/localisation-does-not-exist'],
  ['GET', '/v1/admin/knowledge'],
  ['POST', '/v1/admin/knowledge'],
  ['GET', '/v1/compat/group-ids'],
  ['GET', '/v1/compat/knowledge-ids'],
  ['GET', '/v1/challenge-definitions/preview'],
  ['POST', '/v1/challenge-definitions/preview'],
  ['GET', '/v1/operator/social-causes/pending'],
  ['GET', '/v1/operator/console/overview'],
  ['GET', '/v1/operator/console/health'],
  ['GET', '/v1/operator/console/audit'],
  ['GET', '/v1/today'],
];

describe('retired /v1 namespace is not an active API surface', () => {
  it.each(RETIRED_V1_ROUTES)('%s %s does not resolve', async (method, url) => {
    const app = buildApp({ db, verifier: stubVerifier({ legit: 'contract-ghost' }) });
    const response = await app.inject({
      method: method as 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
      url,
      headers: authHeaders('legit'),
    });
    expect(response.statusCode).toBe(404);
  });

  it('an unauthenticated /v1 request is not intercepted by the API auth hook', async () => {
    // Proof that /v1 is not merely unauthorised but entirely unregistered: the
    // API auth boundary gates `/api/*` only, so a /v1 request must reach the
    // 404 handler rather than returning 401.
    const app = buildApp({ db, verifier: stubVerifier({}) });
    const response = await app.inject({ method: 'GET', url: '/v1/memberships/me' });
    expect(response.statusCode).toBe(404);
  });

  it('the same operation succeeds on /api and fails on /v1 (no alias)', async () => {
    const f = await fixture();
    const active = await f.app.inject({ method: 'GET', url: '/api/memberships/me', headers: f.ownerAuth });
    const retired = await f.app.inject({ method: 'GET', url: '/v1/memberships/me', headers: f.ownerAuth });
    expect(active.statusCode).toBe(200);
    expect(retired.statusCode).toBe(404);
  });

  it('a /v1 path prefix is not caught by any catch-all API route', async () => {
    const app = buildApp({ db, verifier: stubVerifier({ legit: 'contract-ghost' }) });
    for (const url of ['/v1', '/v1/', '/v1/anything', '/v2/memberships/me', '/api']) {
      expect((await app.inject({ method: 'GET', url, headers: authHeaders('legit') })).statusCode).toBe(404);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Authentication boundary and infrastructure routes
// ---------------------------------------------------------------------------

describe('authentication boundary and infrastructure routes', () => {
  it('every /api domain route requires authentication', async () => {
    const app = buildApp({ db, verifier: stubVerifier({ legit: 'contract-ghost' }) });
    for (const url of ['/api/memberships/me', '/api/groups/discover', '/api/challenges', '/api/knowledge', '/api/operator/console/overview']) {
      expect((await app.inject({ method: 'GET', url })).statusCode).toBe(401);
    }
  });

  it('/health remains unauthenticated and outside the API namespace', async () => {
    const app = buildApp({ db, verifier: stubVerifier({}) });
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json().service).toBe('tiizi-api');
  });

  it('/ready remains unauthenticated and outside the API namespace', async () => {
    const app = buildApp({ db, verifier: stubVerifier({}) });
    // The PGlite test database answers, so readiness is 200. The contract
    // asserted here is that the route resolves without credentials.
    const response = await app.inject({ method: 'GET', url: '/ready' });
    expect(response.statusCode).toBe(200);
  });
});
