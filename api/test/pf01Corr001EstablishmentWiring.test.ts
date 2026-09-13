/**
 * PF-01-CORR-001 — identity wiring in the normal V2 establishment runtime.
 *
 * Independent review finding: PF-01 proved
 * createDbKnowledgeEligibilityResolverByIdentity in isolation, but the
 * normal API composition (api/src/index.ts) still wired the quarantined
 * exact-name resolver, and POST /v1/challenges defaulted pins to exact
 * display-name resolution.
 *
 * This suite proves the CORRECTED composition through the real
 * application/runtime path (buildApp + POST /v1/challenges with the same
 * identity deps index.ts wires — stubbed creation authority standing in
 * for Firestore):
 *
 * A. canonical_key as Activity Code establishes (201);
 * B. the config pins the expected Knowledge UUID/version;
 * C. canonical_key as UUID identity also establishes (201);
 * D. a display name alone does NOT establish (422, no state);
 * E. Metric/Unit tuple validation remains enforced (422, no state);
 * F. historical/name-based seams remain available only where intentionally
 *    supported (legacy functions intact; the V2 route does not use them).
 *
 * A second composition proves the route DEFAULT pinsFor is identity-based:
 * with no pinsFor injected, code keys establish and name keys fail.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { authHeaders, seedGroup, seedMember, stubVerifier, testDb } from './helpers.js';
import type { ChallengeCreationAuthority } from '../src/challengeCreationAuthority.js';
import { createDbKnowledgeIdentityResolver } from '../src/knowledgePins.js';
import {
  resolveKnowledgePinByName,
} from '../src/knowledgePins.js';
import {
  createDbKnowledgeEligibilityResolver,
  createDbKnowledgeEligibilityResolverByIdentity,
} from '../src/knowledgeEligibility.js';
import {
  createKnowledgeItem,
  setKnowledgeLifecycle,
  setMeasurementCompatibility,
} from '../src/knowledge.js';
import {
  PUSH_UP_ACTIVITY_CODE,
  PUSH_UP_CONTRACT,
  pushUpExemplarInput,
} from '../src/pf01Exemplars.js';

beforeEach(async () => {
  await testDb().query(
    'TRUNCATE challenge_derived_state, challenge_participation_derived, challenge_activity_records, challenge_activity_configs, challenge_config_versions, challenge_participations, challenges, challenge_establishment_keys, member_activity_events, activity_submission_intents, challenge_finalizations, challenge_participation_finals',
  );
});

let seq = 0;

interface World {
  groupId: string;
  token: string;
  uid: string;
  knowledgeId: string;
}

/** Permit-all creation authority (stands in for the live Firestore authority). */
function permitAuthority(): ChallengeCreationAuthority {
  return {
    async resolveChallengeCreationAuthority() {
      return {
        permitted: true as const,
        reason: null,
        groupStatus: 'active',
        allowMemberChallenges: true,
        memberRole: 'member',
        memberStatus: 'active',
      };
    },
  };
}

/**
 * Production composition mirror: the exact identity deps api/src/index.ts
 * wires for normal runtime establishment (creationAuthority differs only in
 * that tests stub the Firestore adapter).
 */
function productionApp(token: string, uid: string) {
  return buildApp({
    db: testDb(),
    verifier: stubVerifier({ [token]: uid }),
    challengeCreation: {
      creationAuthority: permitAuthority(),
      eligibilityFor: async (kind, key) =>
        createDbKnowledgeEligibilityResolverByIdentity(testDb(), kind)(key),
      pinsFor: async (kind, key) => createDbKnowledgeIdentityResolver(testDb(), kind)(key),
    },
  });
}

/** Route-default composition: no pinsFor injected — the route default applies. */
function defaultPinsApp(token: string, uid: string) {
  return buildApp({
    db: testDb(),
    verifier: stubVerifier({ [token]: uid }),
    challengeCreation: {
      creationAuthority: permitAuthority(),
      eligibilityFor: async (kind, key) =>
        createDbKnowledgeEligibilityResolverByIdentity(testDb(), kind)(key),
    },
  });
}

async function world(): Promise<World> {
  const db = testDb();
  const tag = `corr${(seq += 1)}`;
  const uid = `corr-uid-${tag}`;
  await seedMember(db, uid);
  const groupId = await seedGroup(db, { name: `Corr Group ${tag}` });
  const created = await createKnowledgeItem(db, pushUpExemplarInput());
  await setMeasurementCompatibility(db, created.id, PUSH_UP_CONTRACT);
  await setKnowledgeLifecycle(db, created.id, 'published');
  return { groupId, token: `token-${tag}`, uid, knowledgeId: created.id };
}

function body(w: World, activity: Record<string, unknown>, title = 'Identity-governed challenge') {
  return {
    group_id: w.groupId,
    challenge_type: 'collective',
    title: `${title} ${w.token}`,
    start_date: '2026-06-01',
    end_date: '2026-06-30',
    goal_value: 100,
    goal_unit: 'reps',
    activities: [
      {
        activity_kind: 'fitness',
        canonical_key: PUSH_UP_ACTIVITY_CODE,
        metric: 'repetitions',
        target_value: 20,
        unit: 'reps',
        ...activity,
      },
    ],
    activate: true,
    join_creator: true,
  };
}

async function challengeCount(): Promise<number> {
  const result = await testDb().query<{ count: string }>(`SELECT COUNT(*) AS count FROM challenges`);
  return Number(result.rows[0].count);
}

describe('PF-01-CORR-001 production establishment wiring', () => {
  it('A. establishes with canonical_key as Activity Code through the real route', async () => {
    const w = await world();
    const app = productionApp(w.token, w.uid);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers: authHeaders(w.token),
      payload: body(w, {}),
    });
    expect(response.statusCode).toBe(201);
    const created = response.json() as { challengeId: string; configVersion: number };
    expect(created.configVersion).toBe(1);
    expect(await challengeCount()).toBe(1);
  });

  it('B. pins the expected Knowledge UUID/version in the persisted config', async () => {
    const w = await world();
    const app = productionApp(w.token, w.uid);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers: authHeaders(w.token),
      payload: body(w, {}),
    });
    expect(response.statusCode).toBe(201);
    const { challengeId } = response.json() as { challengeId: string };
    const configs = await testDb().query<{
      canonical_key: string;
      knowledge_id: string;
      knowledge_version: number;
      metric: string | null;
      target_value: number;
      unit: string;
    }>(
      `SELECT canonical_key, knowledge_id, knowledge_version, metric, target_value, unit
       FROM challenge_activity_configs WHERE challenge_id = $1`,
      [challengeId],
    );
    expect(configs.rows).toHaveLength(1);
    expect(configs.rows[0]).toMatchObject({
      canonical_key: PUSH_UP_ACTIVITY_CODE,
      knowledge_id: w.knowledgeId,
      knowledge_version: 1,
      metric: 'repetitions',
      target_value: 20,
      unit: 'reps',
    });
  });

  it('C. establishes with canonical_key as UUID identity', async () => {
    const w = await world();
    const app = productionApp(w.token, w.uid);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers: authHeaders(w.token),
      payload: body(w, { canonical_key: w.knowledgeId }),
    });
    expect(response.statusCode).toBe(201);
    const { challengeId } = response.json() as { challengeId: string };
    const configs = await testDb().query<{ knowledge_id: string; knowledge_version: number }>(
      `SELECT knowledge_id, knowledge_version FROM challenge_activity_configs WHERE challenge_id = $1`,
      [challengeId],
    );
    expect(String(configs.rows[0].knowledge_id)).toBe(w.knowledgeId);
    expect(Number(configs.rows[0].knowledge_version)).toBe(1);
  });

  it('D. display name alone does NOT establish (no V1 identity on the V2 path)', async () => {
    const w = await world();
    const app = productionApp(w.token, w.uid);
    const before = await challengeCount();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers: authHeaders(w.token),
      payload: body(w, { canonical_key: 'Push-Up' }),
    });
    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({
      error: expect.objectContaining({ code: 'knowledge_not_eligible' }),
    });
    expect(await challengeCount()).toBe(before);
  });

  it('E. Metric/Unit tuple validation remains enforced on the identity path', async () => {
    const w = await world();
    const app = productionApp(w.token, w.uid);
    const before = await challengeCount();
    // goal_unit matches so the collective-unit gate passes and the governed
    // Knowledge (Activity, Metric, Unit) tuple gate decides: duration is not
    // permitted for the repetitions-only Push-Up contract.
    const response = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers: authHeaders(w.token),
      payload: {
        ...body(w, { metric: 'duration', target_value: 10, unit: 'minutes' }),
        goal_unit: 'minutes',
      },
    });
    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({
      error: expect.objectContaining({ code: 'incompatible_measurement' }),
    });
    expect(await challengeCount()).toBe(before);
  });

  it('F. historical name seams stay available where intentionally supported — not on the V2 route', async () => {
    const w = await world();
    // The quarantined functions remain intact for historical compatibility:
    // exact-name pin and eligibility resolution still work when called
    // directly (historical reads/replay/tests).
    expect(
      (await resolveKnowledgePinByName(testDb(), 'fitness', 'Push-Up'))?.knowledge_id,
    ).toBe(w.knowledgeId);
    expect(
      (await createDbKnowledgeEligibilityResolver(testDb(), 'fitness')('Push-Up'))?.knowledgeId,
    ).toBe(w.knowledgeId);
    // ...but the production V2 route provably does not consult them (proof
    // D above: the published display name alone fails closed).
  });

  it('route default pinsFor is identity-based: codes establish, names fail', async () => {
    const w = await world();
    const uid = w.uid;
    const app = defaultPinsApp(w.token, uid);
    const byCode = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers: authHeaders(w.token),
      payload: body(w, {}, 'Default-pins code'),
    });
    expect(byCode.statusCode).toBe(201);
    const byName = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers: authHeaders(w.token),
      payload: body(w, { canonical_key: 'Push-Up' }, 'Default-pins name'),
    });
    expect(byName.statusCode).toBe(422);
  });
});
