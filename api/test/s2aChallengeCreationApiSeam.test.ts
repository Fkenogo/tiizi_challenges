/**
 * S2a — Challenge creation API seam (transport only) — focused proofs.
 *
 * - GET  /v1/knowledge/:id/options returns Knowledge-derived Composer
 *   choices (Metrics, Units, Components, supported Load Reporting Bases)
 *   through the already-merged PF-04 authority.
 * - POST /v1/challenge-definitions/preview runs the Composer draft through
 *   the single PF-03 validator and writes nothing.
 * - GET  /v1/knowledge?composerSelectable=true filters to NEW-V2
 *   Composer-selectable candidates without changing plain listing.
 *
 * The seam owns no semantics: every governance decision below is made by the
 * existing Composer (PF-04) and validator (PF-03).
 */

import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import {
  createKnowledgeItem,
  setKnowledgeLifecycle,
  setMeasurementCompatibility,
  type CreateKnowledgeInput,
} from '../src/knowledge.js';
import {
  BREATHING_PRACTICE_CONTRACT,
  breathingPracticeExemplarInput,
  pushUpExemplarInput,
  PUSH_UP_CONTRACT,
} from '../src/pf01Exemplars.js';
import { authHeaders, seedMember, stubVerifier, testDb } from './helpers.js';

function holdContent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    kind: 'fitness',
    name: 'S2a Options Hold',
    category: 'Strength',
    subcategory: 'Hold',
    difficulty: 'Intermediate',
    description: 'A governed static hold for options tests.',
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

function readApp(token: string, uid: string) {
  return buildApp({ db: testDb(), verifier: stubVerifier({ [token]: uid }) });
}

async function readWorld(token: string) {
  const uid = `${token}-uid`;
  await seedMember(testDb(), uid);
  return readApp(token, uid);
}

async function seedPublishedHold(code: string) {
  const db = testDb();
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

async function countRows(table: string): Promise<number> {
  const result = await testDb().query<{ count: string }>(`SELECT COUNT(*) AS count FROM ${table}`);
  return Number(result.rows[0].count);
}

describe('S2a activity options seam', () => {
  it('returns Knowledge-derived choices for a published Activity', async () => {
    const created = await seedPublishedHold('FIT-TST-931');
    const app = await readWorld('opt-token');
    const byUuid = await app.inject({
      method: 'GET',
      url: `/v1/knowledge/${created.id}/options`,
      headers: authHeaders('opt-token'),
    });
    expect(byUuid.statusCode).toBe(200);
    expect(byUuid.json()).toMatchObject({
      knowledgeId: created.id,
      activityCode: 'FIT-TST-931',
      kind: 'fitness',
      primaryMetrics: ['duration'],
      compatibleUnits: ['seconds'],
      supportedLoadBases: [],
    });
    const body = byUuid.json() as { components: Array<{ componentId: string }> };
    expect(body.components.map((c) => c.componentId)).toEqual(['LEFT', 'RIGHT']);
    // The immutable Activity Code resolves to the same canonical identity.
    const byCode = await app.inject({
      method: 'GET',
      url: `/v1/knowledge/FIT-TST-931/options`,
      headers: authHeaders('opt-token'),
    });
    expect(byCode.statusCode).toBe(200);
    expect(byCode.json()).toEqual(byUuid.json());
  });

  it('404s unknown, draft, malformed identities — and display names', async () => {
    const app = await readWorld('opt2-token');
    const unknown = await app.inject({
      method: 'GET',
      url: `/v1/knowledge/00000000-0000-4000-8000-000000000001/options`,
      headers: authHeaders('opt2-token'),
    });
    expect(unknown.statusCode).toBe(404);
    expect((unknown.json() as { error: { code: string } }).error.code).toBe('knowledge_not_found');

    const db = testDb();
    const draft = await createKnowledgeItem(
      db,
      holdContent({ activityCode: 'FIT-TST-932' }) as CreateKnowledgeInput,
    );
    const draftResponse = await app.inject({
      method: 'GET',
      url: `/v1/knowledge/${draft.id}/options`,
      headers: authHeaders('opt2-token'),
    });
    expect(draftResponse.statusCode).toBe(404);

    // Display names never resolve (identity is UUID/Code only).
    const byName = await app.inject({
      method: 'GET',
      url: `/v1/knowledge/S2a%20Options%20Hold/options`,
      headers: authHeaders('opt2-token'),
    });
    expect(byName.statusCode).toBe(404);
  });
});

describe('S2a composer-selectable catalogue boundary', () => {
  async function seedCatalogueMatrix() {
    const db = testDb();
    // 1. Coded, published, ready, contracted fitness Activity: candidate.
    const ready = await createKnowledgeItem(
      db,
      holdContent({ activityCode: 'FIT-TST-941', name: 'Selectable Hold' }) as CreateKnowledgeInput,
    );
    await setMeasurementCompatibility(db, ready.id, {
      primaryMetrics: ['duration'],
      secondaryMetrics: [],
      compatibleUnits: ['seconds'],
    });
    await setKnowledgeLifecycle(db, ready.id, 'published');
    // 2. Coded draft: excluded.
    await createKnowledgeItem(
      db,
      holdContent({ activityCode: 'FIT-TST-942', name: 'Draft Hold' }) as CreateKnowledgeInput,
    );
    // 3. Coded retired: excluded.
    const retired = await createKnowledgeItem(
      db,
      holdContent({ activityCode: 'FIT-TST-943', name: 'Retired Hold' }) as CreateKnowledgeInput,
    );
    await setMeasurementCompatibility(db, retired.id, {
      primaryMetrics: ['duration'],
      secondaryMetrics: [],
      compatibleUnits: ['seconds'],
    });
    await setKnowledgeLifecycle(db, retired.id, 'published');
    await setKnowledgeLifecycle(db, retired.id, 'retired');
    // 4. Coded but KCS-thin legacy content: excluded (readiness fails).
    await db.query(
      `INSERT INTO knowledge_items
         (kind, name, activity_code, lifecycle, grandfathered, description, category,
          metric_unit, measurement_guidance, safety_notes,
          primary_metrics, secondary_metrics, compatible_units)
       VALUES ('fitness', 'Thin Hold', 'FIT-TST-944', 'published', TRUE,
         '', '', '', '', '{}', '{}', '{}', '{}')`,
    );
    // 5. Codeless legacy V1 row: excluded (quarantined whatever its state).
    await db.query(
      `INSERT INTO knowledge_items
         (kind, name, lifecycle, grandfathered, description, category,
          metric_unit, measurement_guidance, safety_notes,
          primary_metrics, secondary_metrics, compatible_units)
       VALUES ('fitness', 'Legacy V1 Press', 'published', TRUE,
         'Pre-PF-01 evidence row.', 'Core', 'reps',
         'Count reps.', ARRAY['Be careful'],
         ARRAY['repetitions'], ARRAY[]::TEXT[], ARRAY['reps'])`,
    );
    // 6+7. Wellness domain: pushed via API so version history matches
    // production authoring exactly.
    const pushUp = await createKnowledgeItem(db, pushUpExemplarInput());
    await setMeasurementCompatibility(db, pushUp.id, PUSH_UP_CONTRACT);
    await setKnowledgeLifecycle(db, pushUp.id, 'published');
    const breathing = await createKnowledgeItem(db, breathingPracticeExemplarInput());
    await setMeasurementCompatibility(db, breathing.id, BREATHING_PRACTICE_CONTRACT);
    await setKnowledgeLifecycle(db, breathing.id, 'published');
  }

  async function candidateCodes(kind?: string): Promise<string[]> {
    const token = `cat-${kind ?? 'all'}`;
    const app = await readWorld(token);
    const query = new URLSearchParams({ composerSelectable: 'true' });
    if (kind) query.set('kind', kind);
    const response = await app.inject({
      method: 'GET',
      url: `/v1/knowledge?${query.toString()}`,
      headers: authHeaders(token),
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { items: Array<{ activityCode: string | null; name: string }> };
    return body.items.map((item) => item.activityCode ?? item.name);
  }

  it('lists only NEW-V2 candidates across both domains', async () => {
    await seedCatalogueMatrix();
    const codes = await candidateCodes();
    expect(codes).toContain('FIT-TST-941');
    expect(codes).toContain('FIT-STR-001');
    expect(codes).toContain('WEL-MND-003');
    expect(codes).not.toContain('FIT-TST-942');
    expect(codes).not.toContain('FIT-TST-943');
    expect(codes).not.toContain('FIT-TST-944');
    expect(codes).not.toContain('Legacy V1 Press');
    const wellness = await candidateCodes('wellness');
    expect(wellness).toContain('WEL-MND-003');
    expect(wellness).not.toContain('FIT-STR-001');
    const fitness = await candidateCodes('fitness');
    expect(fitness).toContain('FIT-TST-941');
    expect(fitness).toContain('FIT-STR-001');
  });

  it('plain published listing is unchanged (boundary is opt-in)', async () => {
    await seedCatalogueMatrix();
    const app = await readWorld('cat-plain-x');
    const response = await app.inject({
      method: 'GET',
      url: `/v1/knowledge?kind=fitness`,
      headers: authHeaders('cat-plain-x'),
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { items: Array<{ name: string }> };
    const names = body.items.map((item) => item.name);
    // Legacy/admin-visible rows still list without the boundary flag.
    expect(names).toContain('Legacy V1 Press');
  });
});

describe('S2a Composer preview seam', () => {
  it('valid draft previews to a normalized PF-03 definition and writes nothing', async () => {
    await seedPublishedHold('FIT-TST-933');
    const app = await readWorld('prev-token');
    const tables = [
      'challenges',
      'challenge_config_versions',
      'challenge_activity_configs',
      'challenge_participations',
    ];
    const before = await Promise.all(tables.map(countRows));
    const response = await app.inject({
      method: 'POST',
      url: '/v1/challenge-definitions/preview',
      headers: authHeaders('prev-token'),
      payload: {
        draftKind: 'pf04-v1',
        mode: 'CHALLENGE',
        challengeType: 'competitive',
        title: 'Preview check',
        startDate: '2026-10-01',
        endDate: '2026-10-31',
        activities: [{
          activity: 'FIT-TST-933',
          observedVersion: 2,
          kind: 'fitness',
          metric: 'duration',
          unit: 'seconds',
          targetValue: 60,
          durationMode: 'CONTINUOUS',
          componentIds: ['LEFT', 'RIGHT'],
        }],
      },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      ok: boolean;
      definition: { definitionKind: string; activities: Array<{ componentRelationship: string }> };
    };
    expect(body.ok).toBe(true);
    // The normalized PF-03 definition proves the validator was invoked.
    expect(body.definition.definitionKind).toBe('pf03-v1');
    expect(body.definition.activities[0].componentRelationship).toBe('ALL_REQUIRED');
    const after = await Promise.all(tables.map(countRows));
    expect(after).toEqual(before);
  });

  it('invalid draft fails through the existing authorities and writes nothing', async () => {
    await seedPublishedHold('FIT-TST-934');
    const app = await readWorld('prev2-token');
    const before = await countRows('challenges');

    // Incomplete draft: surfaced by the PF-04 composer (MISSING_FIELD).
    const missing = await app.inject({
      method: 'POST',
      url: '/v1/challenge-definitions/preview',
      headers: authHeaders('prev2-token'),
      payload: { draftKind: 'pf04-v1', mode: 'CHALLENGE', activities: [] },
    });
    expect(missing.statusCode).toBe(422);
    const missingBody = missing.json() as { ok: boolean; issues: Array<{ code: string }> };
    expect(missingBody.ok).toBe(false);
    expect(missingBody.issues.some((issue) => issue.code === 'MISSING_FIELD')).toBe(true);

    // Semantic failure: surfaced by the single PF-03 validator (PF03_SEMANTIC),
    // never reimplemented in the route.
    const semantic = await app.inject({
      method: 'POST',
      url: '/v1/challenge-definitions/preview',
      headers: authHeaders('prev2-token'),
      payload: {
        draftKind: 'pf04-v1',
        mode: 'CHALLENGE',
        challengeType: 'competitive',
        title: 'Preview semantic check',
        startDate: '2026-10-01',
        endDate: '2026-10-31',
        activities: [{
          activity: 'FIT-TST-934',
          observedVersion: 2,
          kind: 'fitness',
          metric: 'duration',
          unit: 'seconds',
          targetValue: 60,
          componentIds: ['LEFT'],
        }],
      },
    });
    expect(semantic.statusCode).toBe(422);
    const semanticBody = semantic.json() as { ok: boolean; issues: Array<{ code: string }> };
    expect(semanticBody.issues.some((issue) => issue.code === 'PF03_SEMANTIC')).toBe(true);

    // Non-object body: rejected by the transport, not the domain.
    const nonObject = await app.inject({
      method: 'POST',
      url: '/v1/challenge-definitions/preview',
      headers: authHeaders('prev2-token'),
      payload: [1, 2, 3],
    });
    expect(nonObject.statusCode).toBe(400);

    expect(await countRows('challenges')).toBe(before);
  });
});
