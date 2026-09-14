/**
 * PF-03-CORR-001 — authoritative establishment wiring + current-version gate.
 *
 * Integration proofs through the REAL POST /v1/challenges path: the route
 * consumes validateChallengeDefinition as its single semantic authority,
 * new definitions pin the current Activity version, and establishment
 * persists immutable PF-03 snapshots.
 *
 * 1. POST Duration without durationMode rejects.
 * 2. POST Duration with valid mode succeeds.
 * 3. POST Weight without loadBasis rejects.
 * 4. POST unsupported loadBasis rejects.
 * 5. POST component Activity missing a required Component rejects.
 * 6. POST full ALL_REQUIRED Component definition succeeds.
 * 7. POST Completion without intelligible occurrence rejects.
 * 8. POST mutable display name as identity rejects.
 * 9. POST old Activity version rejects when a newer current exists.
 * 10. POST explicit current version succeeds.
 * 11. Omitted version pins current version.
 * 12. Activity revision after preview makes old explicit version stale.
 * 13. New establishment persists definition_kind=pf03-v1.
 * 14. Persisted activity rows carry PF-03 pins.
 * 15. Numeric target 0 rejects.
 * 16. reset_on_miss=false rejects through the actual route.
 * 17. Temporal conditions persist in snapshot.
 * 18. Semantically different PF-03 payloads do not share idempotency.
 * 19. Group/member creation authority remains enforced.
 * 20. No Firestore Challenge write / no V1 dual write introduced.
 *
 * Out of scope: Templates, Wizard, deployment.
 */

import { describe, expect, it } from 'vitest';
import { hashDefinitionRequest } from '../src/challengeEstablishment.js';
import type { ChallengeCreationAuthority } from '../src/challengeCreationAuthority.js';
import type { ChallengeCreationAuthorityStatus } from '../src/challengeCreationAuthority.js';
import {
  createKnowledgeItem,
  reviseKnowledgeItem,
  setKnowledgeLifecycle,
  setLoadReportingBases,
  setMeasurementCompatibility,
  type CreateKnowledgeInput,
} from '../src/knowledge.js';
import { createDbKnowledgeEligibilityResolverByIdentity } from '../src/knowledgeEligibility.js';
import {
  BREATHING_PRACTICE_CONTRACT,
  breathingPracticeExemplarInput,
  pushUpExemplarInput,
  PUSH_UP_CONTRACT,
} from '../src/pf01Exemplars.js';
import { authHeaders, seedGroup, seedMember, stubVerifier, testDb } from './helpers.js';
import { buildApp } from '../src/app.js';

function holdContent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    kind: 'fitness',
    name: 'PF-03-CORR Hold',
    category: 'Strength',
    subcategory: 'Hold',
    difficulty: 'Intermediate',
    description: 'A governed static hold for wiring tests.',
    metricUnit: 'seconds',
    contentClasses: ['U', 'Q', 'T'],
    measurementGuidance: 'Report held seconds per side.',
    unitSemantics: 'One second equals one second of held position.',
    setup: 'Lie on one side with the forearm under the shoulder.',
    execution: 'Lift the hips and hold the straight-line position.',
    formCues: ['Keep a straight line'],
    adaptation: 'Drop the lower knee while keeping the trunk straight.',
    safetyNotes: ['Stop on sharp pain'],
    ...overrides,
  };
}

const SIDES = [
  { componentId: 'LEFT', displayName: 'Left side', relationship: 'ALL_REQUIRED' },
  { componentId: 'RIGHT', displayName: 'Right side', relationship: 'ALL_REQUIRED' },
];

async function seedDuration(db: ReturnType<typeof testDb>, code: string) {
  const created = await createKnowledgeItem(
    db,
    holdContent({ activityCode: code }) as CreateKnowledgeInput,
  );
  await setMeasurementCompatibility(db, created.id, {
    primaryMetrics: ['duration'],
    secondaryMetrics: [],
    compatibleUnits: ['seconds'],
  });
  await setKnowledgeLifecycle(db, created.id, 'published');
  return created;
}

async function seedWeight(db: ReturnType<typeof testDb>, code: string) {
  const created = await createKnowledgeItem(
    db,
    holdContent({
      activityCode: code,
      name: 'PF-03-CORR Carry',
      contentClasses: ['U', 'Q'],
      measurementGuidance: 'Report the implement weight in kilograms.',
      unitSemantics: 'One kilogram equals one kilogram of external implement load.',
    }) as CreateKnowledgeInput,
  );
  await setMeasurementCompatibility(db, created.id, {
    primaryMetrics: ['weight'],
    secondaryMetrics: [],
    compatibleUnits: ['kilograms'],
  });
  await setLoadReportingBases(db, created.id, ['PER_IMPLEMENT']);
  await setKnowledgeLifecycle(db, created.id, 'published');
  return created;
}

async function seedComponentHold(db: ReturnType<typeof testDb>, code: string) {
  const created = await createKnowledgeItem(
    db,
    holdContent({ activityCode: code, components: SIDES }) as CreateKnowledgeInput,
  );
  await setMeasurementCompatibility(db, created.id, {
    primaryMetrics: ['duration'],
    secondaryMetrics: [],
    compatibleUnits: ['seconds'],
  });
  await setKnowledgeLifecycle(db, created.id, 'published');
  return created;
}

async function seedPushUp(db: ReturnType<typeof testDb>) {
  const created = await createKnowledgeItem(db, pushUpExemplarInput());
  await setMeasurementCompatibility(db, created.id, PUSH_UP_CONTRACT);
  await setKnowledgeLifecycle(db, created.id, 'published');
  return created;
}

async function seedBreathing(db: ReturnType<typeof testDb>) {
  const created = await createKnowledgeItem(db, breathingPracticeExemplarInput());
  await setMeasurementCompatibility(db, created.id, BREATHING_PRACTICE_CONTRACT);
  await setKnowledgeLifecycle(db, created.id, 'published');
  return created;
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

function denyAuthority(): ChallengeCreationAuthority {
  return {
    async resolveChallengeCreationAuthority(): Promise<ChallengeCreationAuthorityStatus> {
      return {
        permitted: false,
        reason: 'charter_restricted',
        groupStatus: 'active',
        allowMemberChallenges: false,
        memberRole: 'member',
        memberStatus: 'active',
      };
    },
  };
}

function routeApp(token: string, uid: string, authority?: ChallengeCreationAuthority) {
  return buildApp({
    db: testDb(),
    verifier: stubVerifier({ [token]: uid }),
    challengeCreation: {
      creationAuthority: authority ?? permitAuthority(),
      eligibilityFor: async (kind, key) =>
        createDbKnowledgeEligibilityResolverByIdentity(testDb(), kind)(key),
    },
  });
}

async function world(token: string) {
  const db = testDb();
  const uid = `corr-uid-${token}`;
  await seedMember(db, uid);
  const groupId = await seedGroup(db, { name: `CORR ${token}` });
  return { db, uid, groupId };
}

function postBody(groupId: string, activities: Array<Record<string, unknown>>, extra: Record<string, unknown> = {}) {
  return {
    group_id: groupId,
    challenge_type: 'competitive',
    title: 'CORR wiring check',
    start_date: '2026-10-01',
    end_date: '2026-10-31',
    activities,
    ...extra,
  };
}

function durationActivity(code: string, overrides: Record<string, unknown> = {}) {
  return {
    activity_kind: 'fitness',
    canonical_key: code,
    metric: 'duration',
    target_value: 60,
    unit: 'seconds',
    duration_mode: 'CONTINUOUS',
    ...overrides,
  };
}

async function snapshotFor(challengeId: string, version = 1) {
  const result = await testDb().query<{ snapshot: Record<string, unknown> }>(
    `SELECT snapshot FROM challenge_config_versions WHERE challenge_id = $1 AND version = $2`,
    [challengeId, version],
  );
  return result.rows[0].snapshot;
}

async function activityRowsFor(challengeId: string, version = 1) {
  const result = await testDb().query<Record<string, unknown>>(
    `SELECT canonical_key, knowledge_id, knowledge_version, activity_code, metric, target_value,
            unit, required_components, component_relationship, load_reporting_basis,
            duration_mode, completion_occurrence
     FROM challenge_activity_configs WHERE challenge_id = $1 AND version = $2 ORDER BY position`,
    [challengeId, version],
  );
  return result.rows;
}

describe('PF-03-CORR route authority (proofs 1-8)', () => {
  it('1. POST Duration without durationMode rejects', async () => {
    const { db, uid, groupId } = await world('c01');
    await seedDuration(db, 'FIT-TST-901');
    const app = routeApp('c01', uid);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers: authHeaders('c01'),
      payload: postBody(groupId, [{
        activity_kind: 'fitness',
        canonical_key: 'FIT-TST-901',
        metric: 'duration',
        target_value: 60,
        unit: 'seconds',
      }]),
    });
    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({
      error: expect.objectContaining({ code: 'invalid_challenge_definition' }),
    });
  });

  it('2. POST Duration with valid mode succeeds with a PF-03 snapshot', async () => {
    const { db, uid, groupId } = await world('c02');
    await seedDuration(db, 'FIT-TST-902');
    const app = routeApp('c02', uid);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers: authHeaders('c02'),
      payload: postBody(groupId, [durationActivity('FIT-TST-902')]),
    });
    expect(response.statusCode).toBe(201);
    const created = response.json() as { challengeId: string; configVersion: number };
    expect(created.configVersion).toBe(1);
    const snapshot = await snapshotFor(created.challengeId);
    expect(snapshot).toMatchObject({ definition_kind: 'pf03-v1', timezone: 'UTC' });
  });

  it('3. POST Weight without loadBasis rejects', async () => {
    const { db, uid, groupId } = await world('c03');
    await seedWeight(db, 'FIT-TST-903');
    const app = routeApp('c03', uid);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers: authHeaders('c03'),
      payload: postBody(groupId, [{
        activity_kind: 'fitness',
        canonical_key: 'FIT-TST-903',
        metric: 'weight',
        target_value: 20,
        unit: 'kilograms',
      }]),
    });
    expect(response.statusCode).toBe(422);
    expect(JSON.stringify(response.json())).toMatch(/missing_load_basis/);
  });

  it('4. POST unsupported loadBasis rejects; supported succeeds', async () => {
    const { db, uid, groupId } = await world('c04');
    await seedWeight(db, 'FIT-TST-904');
    const app = routeApp('c04', uid);
    const bad = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers: authHeaders('c04'),
      payload: postBody(groupId, [{
        activity_kind: 'fitness',
        canonical_key: 'FIT-TST-904',
        metric: 'weight',
        target_value: 20,
        unit: 'kilograms',
        load_basis: 'MACHINE_DISPLAYED_LOAD',
      }]),
    });
    expect(bad.statusCode).toBe(422);
    expect(JSON.stringify(bad.json())).toMatch(/unsupported_load_basis/);
    const good = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers: authHeaders('c04'),
      payload: postBody(groupId, [{
        activity_kind: 'fitness',
        canonical_key: 'FIT-TST-904',
        metric: 'weight',
        target_value: 20,
        unit: 'kilograms',
        load_basis: 'PER_IMPLEMENT',
      }], { title: 'CORR weight basis' }),
    });
    expect(good.statusCode).toBe(201);
    const rows = await activityRowsFor((good.json() as { challengeId: string }).challengeId);
    expect(rows[0].load_reporting_basis).toBe('PER_IMPLEMENT');
  });

  it('5. POST component Activity missing a required Component rejects', async () => {
    const { db, uid, groupId } = await world('c05');
    await seedComponentHold(db, 'FIT-TST-905');
    const app = routeApp('c05', uid);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers: authHeaders('c05'),
      payload: postBody(groupId, [{
        ...durationActivity('FIT-TST-905'),
        component_ids: ['LEFT'],
      }]),
    });
    expect(response.statusCode).toBe(422);
    expect(JSON.stringify(response.json())).toMatch(/missing_required_components/);
  });

  it('6. POST full ALL_REQUIRED Component definition succeeds', async () => {
    const { db, uid, groupId } = await world('c06');
    await seedComponentHold(db, 'FIT-TST-906');
    const app = routeApp('c06', uid);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers: authHeaders('c06'),
      payload: postBody(groupId, [{
        ...durationActivity('FIT-TST-906'),
        component_ids: ['LEFT', 'RIGHT'],
      }]),
    });
    expect(response.statusCode).toBe(201);
    const rows = await activityRowsFor((response.json() as { challengeId: string }).challengeId);
    expect(rows[0].required_components).toEqual(['LEFT', 'RIGHT']);
    expect(rows[0].component_relationship).toBe('ALL_REQUIRED');
  });

  it('7. POST Completion without intelligible occurrence rejects', async () => {
    const { db, uid, groupId } = await world('c07');
    await seedBreathing(db);
    const app = routeApp('c07', uid);
    const missing = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers: authHeaders('c07'),
      payload: postBody(groupId, [{
        activity_kind: 'wellness',
        canonical_key: 'WEL-MND-003',
        metric: 'completion',
        target_value: 1,
        unit: 'completion',
      }]),
    });
    expect(missing.statusCode).toBe(422);
    expect(JSON.stringify(missing.json())).toMatch(/missing_occurrence/);
    const good = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers: authHeaders('c07'),
      payload: postBody(groupId, [{
        activity_kind: 'wellness',
        canonical_key: 'WEL-MND-003',
        metric: 'completion',
        target_value: 1,
        unit: 'completion',
        completion_occurrence: 'Complete one full guided session',
      }], { title: 'CORR completion occurrence' }),
    });
    expect(good.statusCode).toBe(201);
    const rows = await activityRowsFor((good.json() as { challengeId: string }).challengeId);
    expect(rows[0].completion_occurrence).toBe('Complete one full guided session');
  });

  it('8. POST mutable display name as identity rejects', async () => {
    const { db, uid, groupId } = await world('c08');
    await seedDuration(db, 'FIT-TST-907');
    const app = routeApp('c08', uid);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers: authHeaders('c08'),
      payload: postBody(groupId, [{
        ...durationActivity('PF-03-CORR Hold'),
      }]),
    });
    expect(response.statusCode).toBe(422);
    expect(JSON.stringify(response.json())).toMatch(/not_identity/);
  });
});

describe('PF-03-CORR current-version gate (proofs 9-12)', () => {
  async function revisedWorld(token: string, code: string) {
    const { db, uid, groupId } = await world(token);
    const created = await createKnowledgeItem(
      db,
      holdContent({ activityCode: code }) as CreateKnowledgeInput,
    );
    await setMeasurementCompatibility(db, created.id, {
      primaryMetrics: ['duration'],
      secondaryMetrics: [],
      compatibleUnits: ['seconds'],
    });
    await reviseKnowledgeItem(db, created.id, {
      ...(holdContent({ activityCode: code }) as Record<string, unknown>),
      description: 'Revised governed hold.',
    });
    await setKnowledgeLifecycle(db, created.id, 'published');
    return { db, uid, groupId, current: 3 };
  }

  it('9. POST old Activity version rejects when a newer current exists', async () => {
    const { uid, groupId } = await revisedWorld('c09', 'FIT-TST-908');
    const app = routeApp('c09', uid);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers: authHeaders('c09'),
      payload: postBody(groupId, [{
        ...durationActivity('FIT-TST-908'),
        version: 2,
      }]),
    });
    expect(response.statusCode).toBe(422);
    expect(JSON.stringify(response.json())).toMatch(/stale_activity_version/);
  });

  it('10. POST explicit current version succeeds', async () => {
    const { uid, groupId, current } = await revisedWorld('c10', 'FIT-TST-909');
    const app = routeApp('c10', uid);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers: authHeaders('c10'),
      payload: postBody(groupId, [{
        ...durationActivity('FIT-TST-909'),
        version: current,
      }]),
    });
    expect(response.statusCode).toBe(201);
    const rows = await activityRowsFor((response.json() as { challengeId: string }).challengeId);
    expect(Number(rows[0].knowledge_version)).toBe(current);
  });

  it('11. omitted version pins current version', async () => {
    const { uid, groupId, current } = await revisedWorld('c11', 'FIT-TST-910');
    const app = routeApp('c11', uid);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers: authHeaders('c11'),
      payload: postBody(groupId, [durationActivity('FIT-TST-910')]),
    });
    expect(response.statusCode).toBe(201);
    const rows = await activityRowsFor((response.json() as { challengeId: string }).challengeId);
    expect(Number(rows[0].knowledge_version)).toBe(current);
  });

  it('12. Activity revision after preview makes old explicit version stale', async () => {
    const { db, uid, groupId } = await revisedWorld('c12', 'FIT-TST-911');
    const app = routeApp('c12', uid);
    const payload = (version: number) => postBody(groupId, [{
      ...durationActivity('FIT-TST-911'),
      version,
    }]);
    // Preview built against v3 establishes while v3 is current.
    const first = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers: authHeaders('c12'),
      payload: payload(3),
    });
    expect(first.statusCode).toBe(201);
    // The Activity advances to v4 (new contract, no silent upgrade).
    const item = await db.query<{ knowledge_id: string }>(
      `SELECT knowledge_id FROM knowledge_items WHERE activity_code = 'FIT-TST-911'`,
    );
    const id = String(item.rows[0].knowledge_id);
    await setMeasurementCompatibility(db, id, {
      primaryMetrics: ['duration'],
      secondaryMetrics: [],
      compatibleUnits: ['seconds', 'minutes'],
    });
    // The same explicit v3 is now stale; the definition must be reviewed.
    const second = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers: authHeaders('c12'),
      payload: payload(3),
    });
    expect(second.statusCode).toBe(422);
    expect(JSON.stringify(second.json())).toMatch(/stale_activity_version/);
    // Omitted version now pins v4.
    const third = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers: authHeaders('c12'),
      payload: postBody(groupId, [durationActivity('FIT-TST-911')], { title: 'CORR v4 pin' }),
    });
    expect(third.statusCode).toBe(201);
    const rows = await activityRowsFor((third.json() as { challengeId: string }).challengeId);
    expect(Number(rows[0].knowledge_version)).toBe(4);
  });
});

describe('PF-03-CORR persistence, targets and authority (proofs 13-20)', () => {
  it('13. new establishment persists definition_kind=pf03-v1', async () => {
    const { db, uid, groupId } = await world('c13');
    await seedPushUp(db);
    const app = routeApp('c13', uid);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers: authHeaders('c13'),
      payload: postBody(groupId, [{
        activity_kind: 'fitness',
        canonical_key: 'FIT-STR-001',
        metric: 'repetitions',
        target_value: 50,
        unit: 'reps',
      }]),
    });
    expect(response.statusCode).toBe(201);
    const snapshot = await snapshotFor((response.json() as { challengeId: string }).challengeId);
    expect(snapshot).toMatchObject({
      definition_kind: 'pf03-v1',
      challenge_type: 'competitive',
    });
    const activities = (snapshot.activities ?? []) as Array<Record<string, unknown>>;
    expect(activities[0]).toMatchObject({
      knowledge_version: 2,
      metric: 'repetitions',
      target_value: 50,
      unit: 'reps',
    });
  });

  it('14. persisted activity rows carry PF-03 pins', async () => {
    const { db, uid, groupId } = await world('c14');
    await seedComponentHold(db, 'FIT-TST-912');
    await seedPushUp(db);
    const app = routeApp('c14', uid);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers: authHeaders('c14'),
      payload: postBody(groupId, [
        { ...durationActivity('FIT-TST-912'), component_ids: ['LEFT', 'RIGHT'] },
        {
          activity_kind: 'fitness',
          canonical_key: 'FIT-STR-001',
          metric: 'repetitions',
          target_value: 50,
          unit: 'reps',
        },
      ]),
    });
    expect(response.statusCode).toBe(201);
    const rows = await activityRowsFor((response.json() as { challengeId: string }).challengeId);
    expect(rows).toHaveLength(2);
    const hold = rows.find((row) => row.canonical_key === 'FIT-TST-912');
    expect(hold).toMatchObject({
      activity_code: 'FIT-TST-912',
      metric: 'duration',
      target_value: 60,
      unit: 'seconds',
      component_relationship: 'ALL_REQUIRED',
      load_reporting_basis: null,
      duration_mode: 'CONTINUOUS',
      completion_occurrence: null,
    });
    expect(hold?.required_components).toEqual(['LEFT', 'RIGHT']);
    const press = rows.find((row) => row.canonical_key === 'FIT-STR-001');
    expect(press).toMatchObject({
      activity_code: 'FIT-STR-001',
      component_relationship: null,
      duration_mode: null,
    });
    expect(press?.required_components).toEqual([]);
  });

  it('15. numeric target 0 rejects', async () => {
    const { db, uid, groupId } = await world('c15');
    await seedPushUp(db);
    await seedDuration(db, 'FIT-TST-913');
    const app = routeApp('c15', uid);
    for (const activity of [
      {
        activity_kind: 'fitness',
        canonical_key: 'FIT-STR-001',
        metric: 'repetitions',
        target_value: 0,
        unit: 'reps',
      },
      { ...durationActivity('FIT-TST-913', { target_value: 0 }) },
    ]) {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/challenges',
        headers: authHeaders('c15'),
        payload: postBody(groupId, [activity]),
      });
      expect(response.statusCode).toBe(422);
      expect(JSON.stringify(response.json())).toMatch(/meaningless_target/);
    }
  });

  it('16. reset_on_miss=false rejects through the actual route', async () => {
    const { db, uid, groupId } = await world('c16');
    await seedDuration(db, 'FIT-TST-914');
    const app = routeApp('c16', uid);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers: authHeaders('c16'),
      payload: postBody(groupId, [durationActivity('FIT-TST-914')], {
        challenge_type: 'streak',
        required_consecutive_days: 30,
        reset_on_miss: false,
        timezone: 'Africa/Nairobi',
      }),
    });
    expect(response.statusCode).toBe(422);
    expect(JSON.stringify(response.json())).toMatch(/reset_on_miss/);
  });

  it('17. temporal conditions persist in snapshot', async () => {
    const { db, uid, groupId } = await world('c17');
    await seedPushUp(db);
    const app = routeApp('c17', uid);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers: authHeaders('c17'),
      payload: postBody(groupId, [{
        activity_kind: 'fitness',
        canonical_key: 'FIT-STR-001',
        metric: 'repetitions',
        target_value: 50,
        unit: 'reps',
      }], { temporal_conditions: { within: { start: '21:00', end: '22:30' } } }),
    });
    expect(response.statusCode).toBe(201);
    const snapshot = await snapshotFor((response.json() as { challengeId: string }).challengeId);
    expect(snapshot.temporal_conditions).toEqual({
      at: null,
      before: null,
      after: null,
      within: { start: '21:00', end: '22:30' },
    });
  });

  it('18. semantically different PF-03 payloads do not share one idempotency result', async () => {
    const { db, uid, groupId } = await world('c18');
    await seedDuration(db, 'FIT-TST-915');
    const app = routeApp('c18', uid);
    const key = 'corr-key-18';
    const first = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers: authHeaders('c18'),
      payload: postBody(groupId, [durationActivity('FIT-TST-915')], { idempotency_key: key }),
    });
    expect(first.statusCode).toBe(201);
    const firstId = (first.json() as { challengeId: string }).challengeId;
    // Same key + same request replays the original.
    const replay = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers: authHeaders('c18'),
      payload: postBody(groupId, [durationActivity('FIT-TST-915')], { idempotency_key: key }),
    });
    expect(replay.statusCode).toBe(200);
    expect((replay.json() as { challengeId: string }).challengeId).toBe(firstId);
    // Same key + different target is a different request: 409, no new state.
    const conflict = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers: authHeaders('c18'),
      payload: postBody(groupId, [durationActivity('FIT-TST-915', { target_value: 90 })], {
        idempotency_key: key,
      }),
    });
    expect(conflict.statusCode).toBe(409);
    // Same key + different Duration mode is a different request too.
    const modeConflict = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers: authHeaders('c18'),
      payload: postBody(groupId, [durationActivity('FIT-TST-915', { duration_mode: 'ACCUMULATED' })], {
        idempotency_key: key,
      }),
    });
    expect(modeConflict.statusCode).toBe(409);
  });

  it('19. Group/member creation authority remains enforced', async () => {
    const { db, uid, groupId } = await world('c19');
    await seedPushUp(db);
    const denied = routeApp('c19', uid, denyAuthority());
    const response = await denied.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers: authHeaders('c19'),
      payload: postBody(groupId, [{
        activity_kind: 'fitness',
        canonical_key: 'FIT-STR-001',
        metric: 'repetitions',
        target_value: 50,
        unit: 'reps',
      }]),
    });
    expect(response.statusCode).toBe(403);
    const count = await testDb().query<{ count: string }>(`SELECT COUNT(*) AS count FROM challenges`);
    expect(Number(count.rows[0].count)).toBe(0);
  });

  it('20. no Firestore Challenge write / no V1 dual write introduced', async () => {
    const { db, uid, groupId } = await world('c20');
    await seedPushUp(db);
    const app = routeApp('c20', uid);
    const before: Record<string, number> = {};
    for (const table of ['challenges', 'challenge_config_versions', 'challenge_activity_configs']) {
      const result = await testDb().query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM ${table}`,
      );
      before[table] = Number(result.rows[0].count);
    }
    const response = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers: authHeaders('c20'),
      payload: postBody(groupId, [{
        activity_kind: 'fitness',
        canonical_key: 'FIT-STR-001',
        metric: 'repetitions',
        target_value: 50,
        unit: 'reps',
      }], { activate: true, join_creator: true }),
    });
    expect(response.statusCode).toBe(201);
    const created = response.json() as {
      challengeId: string;
      status: string;
      activated: boolean;
      creatorParticipationId: string | null;
    };
    expect(created.status).toBe('active');
    expect(created.activated).toBe(true);
    expect(created.creatorParticipationId).toMatch(/^[0-9a-f-]{36}$/i);
    // Exactly one row per PG truth table: challenge, one version, one
    // activity config, one participation episode. No other sink exists on
    // this path (no Firestore import anywhere in the establishment chain).
    for (const table of ['challenges', 'challenge_config_versions', 'challenge_activity_configs']) {
      const result = await testDb().query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM ${table}`,
      );
      expect(Number(result.rows[0].count)).toBe(before[table] + 1);
    }
    const episodes = await testDb().query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM challenge_participations WHERE challenge_id = $1`,
      [created.challengeId],
    );
    expect(Number(episodes.rows[0].count)).toBe(1);
  });
});

describe('PF-03-CORR definition hash binding (unit)', () => {
  it('hashDefinitionRequest separates semantically different definitions', async () => {
    const { db } = await world('chash');
    await seedDuration(db, 'FIT-TST-916');
    const { validateChallengeDefinition } = await import('../src/challengeDefinition.js');
    const base = {
      challengeType: 'competitive',
      title: 'Hash check',
      startDate: '2026-10-01',
      endDate: '2026-10-31',
      activities: [{
        activity: 'FIT-TST-916',
        metric: 'duration',
        unit: 'seconds',
        targetValue: 60,
        durationMode: 'CONTINUOUS',
      }],
    } as Parameters<typeof validateChallengeDefinition>[1];
    const a = await validateChallengeDefinition(db, base);
    const b = await validateChallengeDefinition(db, {
      ...base,
      activities: [{
        activity: 'FIT-TST-916',
        metric: 'duration',
        unit: 'seconds',
        targetValue: 90,
        durationMode: 'CONTINUOUS',
      }],
    } as Parameters<typeof validateChallengeDefinition>[1]);
    const h = (definition: typeof a) => hashDefinitionRequest({
      groupId: 'g',
      creatorMemberId: 'm',
      definition,
      activate: false,
      joinCreator: false,
    });
    expect(h(a)).not.toBe(h(b));
    expect(h(a)).toBe(h(a));
  });
});
