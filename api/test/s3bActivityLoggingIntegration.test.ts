/**
 * TIIZI-S3B-FOUNDER-PREVIEW-CORR-002 — real-route activity-application
 * regression (corrects the DEFECT-001 unknown_activity integration gap).
 *
 * These tests exercise the real application seams end to end (no mocked
 * resolver around the route):
 *
 *   governed identity-based Challenge establishment (POST /v1/challenges)
 *     -> persisted Challenge pinned to immutable Knowledge identity
 *     -> active participation (join_creator)
 *     -> POST /v1/challenges/:id/activity
 *     -> production route resolver (identity-first)
 *     -> applyChallengeActivity
 *     -> accepted activity record
 *
 * Cases:
 *   1. Activity-Code-pinned activity succeeds.
 *   2. UUID-pinned activity succeeds (equivalent to the Founder defect).
 *   3. Unknown immutable identity fails closed as `unknown_activity`.
 *   4. A valid, published, NON-configured Knowledge identity cannot be
 *      applied to the Challenge (`wrong_activity`), never accepted.
 *   5. Legacy name-pinned configs remain supported by the narrowly bounded
 *      exact-name fallback (historical pre-PF-01 contract) — identity keys
 *      are never reinterpreted as names.
 *
 * DEFECT-001 root cause (corrected): the activity route injected the
 * quarantined exact-NAME resolver (`createDbKnowledgeResolver`), while V2
 * establishment/read/client use immutable identity (UUID / Activity Code),
 * so every identity-pinned V2 activity resolved to no pin and was rejected
 * `unknown_activity`. The route now uses the identity-first resolver.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { activateChallenge, createChallenge, type NewChallengeInput } from '../src/challenges.js';
import {
  authHeaders,
  seedGroup,
  seedMember,
  stubEligibility,
  stubVerifier,
  testDb,
} from './helpers.js';
import type { ChallengeCreationAuthority } from '../src/challengeCreationAuthority.js';
import type { GroupMembershipAuthority } from '../src/groupMembershipAuthority.js';
import { createDbKnowledgeEligibilityResolverByIdentity } from '../src/knowledgeEligibility.js';
import { createDbKnowledgeIdentityResolver } from '../src/knowledgePins.js';
import {
  createKnowledgeItem,
  setKnowledgeLifecycle,
  setMeasurementCompatibility,
} from '../src/knowledge.js';
import {
  BREATHING_PRACTICE_CONTRACT,
  PUSH_UP_ACTIVITY_CODE,
  PUSH_UP_CONTRACT,
  breathingPracticeExemplarInput,
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
  memberId: string;
  token: string;
  uid: string;
  pushUpId: string;
  breathingId: string;
}

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

function eligibleMembership(): GroupMembershipAuthority {
  return {
    async resolveGroupMembershipAuthority() {
      return { status: 'active', eligible: true };
    },
  };
}

/** Production composition mirror: identity deps + the live activity route. */
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
    challengeActivity: {
      groupMembershipAuthority: eligibleMembership(),
    },
  });
}

async function world(): Promise<World> {
  const db = testDb();
  const tag = `s3bcorr002${(seq += 1)}`;
  const uid = `s3b-corr-002-uid-${tag}`;
  const memberId = await seedMember(db, uid);
  const groupId = await seedGroup(db, { name: `S3b CORR-002 Group ${tag}` });

  const pushUp = await createKnowledgeItem(db, pushUpExemplarInput());
  await setMeasurementCompatibility(db, pushUp.id, PUSH_UP_CONTRACT);
  await setKnowledgeLifecycle(db, pushUp.id, 'published');

  const breathing = await createKnowledgeItem(db, breathingPracticeExemplarInput());
  await setMeasurementCompatibility(db, breathing.id, BREATHING_PRACTICE_CONTRACT);
  await setKnowledgeLifecycle(db, breathing.id, 'published');

  return {
    groupId,
    memberId,
    token: `token-${tag}`,
    uid,
    pushUpId: pushUp.id,
    breathingId: breathing.id,
  };
}

/** A wide window that contains "now" (the defect is window-independent). */
function establishmentBody(w: World, canonicalKey: string) {
  return {
    group_id: w.groupId,
    challenge_type: 'collective',
    title: `S3b CORR-002 challenge ${w.token}`,
    start_date: '2025-01-01',
    end_date: '2035-12-31',
    goal_value: 100,
    goal_unit: 'reps',
    activities: [
      {
        activity_kind: 'fitness',
        canonical_key: canonicalKey,
        metric: 'repetitions',
        target_value: 20,
        unit: 'reps',
      },
    ],
    activate: true,
    join_creator: true,
  };
}

async function establish(app: ReturnType<typeof productionApp>, w: World, canonicalKey: string) {
  const response = await app.inject({
    method: 'POST',
    url: '/v1/challenges',
    headers: authHeaders(w.token),
    payload: establishmentBody(w, canonicalKey),
  });
  expect(response.statusCode).toBe(201);
  const { challengeId } = response.json() as { challengeId: string };
  return challengeId;
}

/**
 * Legacy (pre-PF-01) name-pinned Challenge: established through the C2A
 * domain seam with a display-name canonical_key, exactly like historical
 * configs/fixtures. The V2 activity-application contract must still apply it
 * via the bounded exact-name fallback.
 */
async function establishLegacyNamePinned(w: World, canonicalKey: string): Promise<string> {
  const db = testDb();
  const cv = await db.query<{ current_version: number }>(
    `SELECT current_version FROM knowledge_items WHERE knowledge_id = $1`,
    [w.pushUpId],
  );
  const pin = { knowledge_id: w.pushUpId, current_version: Number(cv.rows[0].current_version) };
  const { challenge } = await createChallenge(
    db,
    {
      group_id: w.groupId,
      created_by_member_id: w.memberId,
      challenge_type: 'competitive',
      title: `Legacy name-pinned ${w.token}`,
      start_date: '2025-01-01',
      end_date: '2035-12-31',
      activities: [{ canonical_key: canonicalKey, metric: 'repetitions', target_value: 20, unit: 'reps' }],
    } as NewChallengeInput,
    {
      resolveKnowledgePin: async (key) => (key === canonicalKey ? pin : null),
      resolveKnowledgeEligibility: async () => stubEligibility(),
      resolveGroupAuthority: async () => ({ status: 'active' }),
      resolveGroupMembershipAuthority: async () => ({ status: 'active', eligible: true }),
    },
  );
  await activateChallenge(db, challenge.challenge_id);
  await db.query(
    `INSERT INTO challenge_participations
       (challenge_id, member_id, status, joined_at, joined_config_version)
     VALUES ($1, $2, 'active', now() - interval '1 hour', 1)`,
    [challenge.challenge_id, w.memberId],
  );
  return challenge.challenge_id;
}

async function submit(
  app: ReturnType<typeof productionApp>,
  w: World,
  challengeId: string,
  payload: {
    activity_kind: 'fitness' | 'wellness';
    canonical_key: string;
    value: number;
    unit: string;
  },
) {
  return app.inject({
    method: 'POST',
    url: `/v1/challenges/${challengeId}/activity`,
    headers: { ...authHeaders(w.token), 'content-type': 'application/json' },
    payload: {
      ...payload,
      occurred_at: new Date().toISOString(),
      client_key: `s3b-corr-002-${(seq += 1)}`,
    },
  });
}

async function recordCount(): Promise<number> {
  const result = await testDb().query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM challenge_activity_records`,
  );
  return Number(result.rows[0].count);
}

describe('TIIZI-S3B-FOUNDER-PREVIEW-CORR-002 — identity resolver on the activity route', () => {
  it('1. accepts the Challenge\'s own configured activity pinned by Activity Code', async () => {
    const w = await world();
    const app = productionApp(w.token, w.uid);
    const challengeId = await establish(app, w, PUSH_UP_ACTIVITY_CODE);

    const response = await submit(app, w, challengeId, {
      activity_kind: 'fitness',
      canonical_key: PUSH_UP_ACTIVITY_CODE,
      value: 20,
      unit: 'reps',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      value: 20,
      unit: 'reps',
      duplicate: false,
      occurredDay: expect.any(String),
    });
    expect((response.json() as { pointsAwarded: number }).pointsAwarded).toBeGreaterThan(0);
    expect(await recordCount()).toBe(1);
  });

  it('2. accepts the Challenge\'s own configured activity pinned by immutable UUID (Founder case)', async () => {
    const w = await world();
    const app = productionApp(w.token, w.uid);
    const challengeId = await establish(app, w, w.pushUpId);

    const response = await submit(app, w, challengeId, {
      activity_kind: 'fitness',
      canonical_key: w.pushUpId,
      value: 20,
      unit: 'reps',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      value: 20,
      unit: 'reps',
      duplicate: false,
      occurredDay: expect.any(String),
    });
    expect(await recordCount()).toBe(1);
  });

  it('3. an unknown immutable identity still fails closed as unknown_activity', async () => {
    const w = await world();
    const app = productionApp(w.token, w.uid);
    const challengeId = await establish(app, w, PUSH_UP_ACTIVITY_CODE);

    const response = await submit(app, w, challengeId, {
      activity_kind: 'fitness',
      canonical_key: '00000000-0000-4000-8000-0000000000ff',
      value: 20,
      unit: 'reps',
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({
      error: expect.objectContaining({ code: 'unknown_activity' }),
    });
    expect(await recordCount()).toBe(0);
  });

  it('4. a valid, published, non-configured Knowledge identity cannot be applied', async () => {
    const w = await world();
    const app = productionApp(w.token, w.uid);
    const challengeId = await establish(app, w, PUSH_UP_ACTIVITY_CODE);

    const response = await submit(app, w, challengeId, {
      activity_kind: 'wellness',
      canonical_key: w.breathingId,
      value: 20,
      unit: 'reps',
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({
      error: expect.objectContaining({ code: 'wrong_activity' }),
    });
    expect(await recordCount()).toBe(0);
  });

  it('5. legacy name-pinned configs remain applicable via the bounded exact-name fallback', async () => {
    const w = await world();
    const app = productionApp(w.token, w.uid);
    const challengeId = await establishLegacyNamePinned(w, 'Push-Up');

    const response = await submit(app, w, challengeId, {
      activity_kind: 'fitness',
      canonical_key: 'Push-Up',
      value: 20,
      unit: 'reps',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ value: 20, unit: 'reps', duplicate: false });
    expect(await recordCount()).toBe(1);
  });
});
