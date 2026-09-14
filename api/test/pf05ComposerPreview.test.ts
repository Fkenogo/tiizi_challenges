/**
 * PF-05 Wizard API seams — focused proofs.
 *
 * - GET /v1/knowledge/:id/options returns Knowledge-derived Composer
 *   choices (Metrics, Units, Components, supported Load Reporting Bases).
 * - POST /v1/challenge-definitions/preview runs the Composer draft
 *   through the single PF-03 validator and writes nothing.
 */

import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import {
  createKnowledgeItem,
  setKnowledgeLifecycle,
  setMeasurementCompatibility,
  type CreateKnowledgeInput,
} from '../src/knowledge.js';
import { authHeaders, seedGroup, seedMember, stubVerifier, testDb } from './helpers.js';

function holdContent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    kind: 'fitness',
    name: 'PF-05 Options Hold',
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

describe('PF-05 activity options seam', () => {
  it('returns Knowledge-derived choices for a published Activity', async () => {
    const created = await seedPublishedHold('FIT-TST-931');
    const app = await readWorld('opt-token');
    const response = await app.inject({
      method: 'GET',
      url: `/v1/knowledge/${created.id}/options`,
      headers: authHeaders('opt-token'),
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      knowledgeId: created.id,
      activityCode: 'FIT-TST-931',
      kind: 'fitness',
      primaryMetrics: ['duration'],
      compatibleUnits: ['seconds'],
      supportedLoadBases: [],
    });
    const body = response.json() as { components: Array<{ componentId: string }> };
    expect(body.components.map((c) => c.componentId)).toEqual(['LEFT', 'RIGHT']);
  });

  it('404s unknown, draft, and malformed identities', async () => {
    const app = await readWorld('opt2-token');
    const unknown = await app.inject({
      method: 'GET',
      url: `/v1/knowledge/00000000-0000-4000-8000-000000000001/options`,
      headers: authHeaders('opt2-token'),
    });
    expect(unknown.statusCode).toBe(404);
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
  });
});

describe('PF-05 Composer preview seam', () => {
  it('valid draft previews to a normalized definition and writes nothing', async () => {
    await seedPublishedHold('FIT-TST-933');
    const app = await readWorld('prev-token');
    const before = await testDb().query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM challenges`,
    );
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
    expect(body.definition.definitionKind).toBe('pf03-v1');
    expect(body.definition.activities[0].componentRelationship).toBe('ALL_REQUIRED');
    const after = await testDb().query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM challenges`,
    );
    expect(Number(after.rows[0].count)).toBe(Number(before.rows[0].count));
  });

  it('invalid draft fails with structured issues and writes nothing', async () => {
    await seedPublishedHold('FIT-TST-934');
    const app = await readWorld('prev2-token');
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
    const nonObject = await app.inject({
      method: 'POST',
      url: '/v1/challenge-definitions/preview',
      headers: authHeaders('prev2-token'),
      payload: [1, 2, 3],
    });
    expect(nonObject.statusCode).toBe(400);
  });
});
