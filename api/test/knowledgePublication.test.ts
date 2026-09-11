import { describe, expect, it } from 'vitest';
import {
  assessPublicationReadiness,
  createKnowledgeItem,
  getKnowledgeById,
  getKnowledgeVersion,
  getLocalizedKnowledge,
  listKnowledgeTexts,
  listPublishedKnowledge,
  reviseKnowledgeItem,
  setKnowledgeLifecycle,
  setKnowledgeText,
  validateLocale,
  type KcsClass,
} from '../src/knowledge.js';
import { runMigrations } from '../src/migrate.js';
import { authHeaders, buildTestApp, seedMember, testDb } from './helpers.js';

/**
 * PKG-2A Knowledge Publication Readiness (KCS gate, T2 FR-V2-213/214).
 *
 * Fixtures prove representative class combinations only — they are NOT the
 * 118 catalogue: one U+Q item, one U+Q+T+S physical activity, one U+P+C
 * wellness practice. All fixtures are test-scoped.
 */

function baseFitness(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'fitness',
    name: 'Test Push-Up',
    category: 'Upper Body',
    subcategory: 'Strength',
    difficulty: 'Beginner',
    metricUnit: 'reps',
    description: 'A test pressing movement',
    ...overrides,
  };
}

function baseWellness(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'wellness',
    name: 'Test Water Intake',
    category: 'hydration',
    difficulty: 'beginner',
    metricUnit: 'ml',
    description: 'A test hydration practice',
    ...overrides,
  };
}

/** Minimal U+Q item content (wellness, so no automatic S). */
function simpleUQ(overrides: Record<string, unknown> = {}) {
  return baseWellness({
    contentClasses: ['Q'],
    measurementGuidance: 'Report millilitres drunk',
    unitSemantics: 'One unit is one millilitre of water or equivalent drink',
    ...overrides,
  });
}

/** Full U+Q+T+S physical activity (S automatic for fitness). */
function fullPhysical(overrides: Record<string, unknown> = {}) {
  return baseFitness({
    contentClasses: ['Q', 'T'],
    measurementGuidance: 'Count full-range repetitions',
    unitSemantics: 'One rep is one full down-and-press cycle',
    setup: 'Hands under shoulders, body straight',
    execution: 'Lower chest, press back up',
    formCues: ['Keep hips level'],
    adaptation: 'Start on knees to scale down',
    safetyNotes: ['Stop on sharp pain'],
    ...overrides,
  });
}

/** Full U+P+C wellness practice (protocol + completion, no auto-S). */
function fullPractice(overrides: Record<string, unknown> = {}) {
  return baseWellness({
    name: 'Test Breathing Practice',
    category: 'mindfulness',
    metricUnit: 'minutes',
    contentClasses: ['P', 'C'],
    measurementGuidance: 'Report minutes practiced',
    protocolSteps: ['Sit comfortably', 'Breathe in 4 counts, out 6 counts'],
    sessionFraming: 'Seated, quiet setting',
    completionMeaning: 'Done means one full timed session completed',
    ...overrides,
  });
}

function jsonHeaders(token: string): Record<string, string> {
  return { ...authHeaders(token), 'content-type': 'application/json' };
}

async function seedAdmin(subject: string): Promise<void> {
  const db = testDb();
  const memberId = await seedMember(db, subject);
  await db.query('UPDATE members SET role = $2 WHERE member_id = $1', [memberId, 'admin']);
}

describe('PKG-2A publication readiness', () => {
  it('1. new items default to draft and are never grandfathered', async () => {
    const db = testDb();
    const item = await createKnowledgeItem(db, simpleUQ());
    expect(item.lifecycle).toBe('draft');
    expect(item.grandfathered).toBe(false);
    expect(item.defaultLocale).toBe('en');
    expect(item.contentClasses).toEqual(['Q']);
  });

  it('2. cannot publish an incomplete U item (422 kcs_not_ready)', async () => {
    const db = testDb();
    // Missing description + measurementGuidance: U minimum unmet.
    const item = await createKnowledgeItem(db, baseWellness({ contentClasses: [], description: '' }));
    let fields: string[] = [];
    try {
      await setKnowledgeLifecycle(db, item.id, 'published');
      throw new Error('publication should have been rejected');
    } catch (error) {
      if ((error as Error).message === 'publication should have been rejected') throw error;
      const err = error as { statusCode?: number; code?: string; details?: { missing?: Array<{ field: string }> } };
      expect(err.statusCode).toBe(422);
      expect(err.code).toBe('kcs_not_ready');
      fields = (err.details?.missing ?? []).map((m) => m.field);
      expect(fields).toContain('description');
      expect(fields).toContain('measurementGuidance');
    }
    // Still a draft: failed publication never half-applies.
    expect((await getKnowledgeById(db, item.id))?.lifecycle).toBe('draft');
  });

  it('3. Q requires governed unit semantics', async () => {
    const issues = assessPublicationReadiness(
      'wellness',
      ['Q'],
      {
        name: 'X',
        description: 'X',
        category: 'hydration',
        metricUnit: 'ml',
        measurementGuidance: 'Report ml',
        unitSemantics: '',
        setup: '',
        execution: '',
        techniqueReference: '',
        formCues: [],
        commonMistakes: [],
        equipment: '',
        environment: '',
        adaptation: '',
        protocolSteps: [],
        sessionFraming: '',
        completionMeaning: '',
        avoidanceCondition: '',
        semanticDefinition: '',
        safetyNotes: [],
      },
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ field: 'unitSemantics', class: 'Q' });
  });

  it('4. T requirements enforced (setup/execution/cues/adaptation)', async () => {
    const db = testDb();
    const item = await createKnowledgeItem(
      db,
      baseFitness({ contentClasses: ['T'], measurementGuidance: 'Count reps' }),
    );
    await expect(setKnowledgeLifecycle(db, item.id, 'published')).rejects.toMatchObject({
      code: 'kcs_not_ready',
    });
  });

  it('5. P requirements enforced (protocol steps)', async () => {
    const db = testDb();
    const item = await createKnowledgeItem(
      db,
      baseWellness({
        name: 'Test Practice',
        category: 'mindfulness',
        contentClasses: ['P'],
        measurementGuidance: 'Report minutes',
      }),
    );
    await expect(setKnowledgeLifecycle(db, item.id, 'published')).rejects.toMatchObject({
      code: 'kcs_not_ready',
    });
  });

  it('6. C requirements enforced (completion meaning)', async () => {
    const db = testDb();
    const item = await createKnowledgeItem(
      db,
      baseWellness({
        name: 'Test Bedtime',
        category: 'sleep',
        contentClasses: ['C'],
        measurementGuidance: 'Attest completion',
      }),
    );
    await expect(setKnowledgeLifecycle(db, item.id, 'published')).rejects.toMatchObject({
      code: 'kcs_not_ready',
    });
  });

  it('7. M requirements enforced (semantic definition)', async () => {
    const db = testDb();
    const item = await createKnowledgeItem(
      db,
      baseWellness({
        name: 'Test Fruit Intake',
        category: 'nutrition',
        metricUnit: 'servings',
        contentClasses: ['M'],
        measurementGuidance: 'Report servings',
      }),
    );
    await expect(setKnowledgeLifecycle(db, item.id, 'published')).rejects.toMatchObject({
      code: 'kcs_not_ready',
    });
  });

  it('8. S enforced for fitness by default (physical), not for plain wellness', async () => {
    const db = testDb();
    // Fitness without safetyNotes: S applies automatically → blocked.
    const physical = await createKnowledgeItem(db, fullPhysical());
    await db.query('UPDATE knowledge_items SET safety_notes = $2 WHERE knowledge_id = $1', [
      physical.id,
      '{}',
    ]);
    await expect(setKnowledgeLifecycle(db, physical.id, 'published')).rejects.toMatchObject({
      code: 'kcs_not_ready',
    });
    // Plain wellness U+Q with no safety content: publishable.
    const simple = await createKnowledgeItem(db, simpleUQ());
    const published = await setKnowledgeLifecycle(db, simple.id, 'published');
    expect(published.lifecycle).toBe('published');
  });

  it('9. composed classes use union-of-minima (all gaps reported)', async () => {
    const db = testDb();
    const item = await createKnowledgeItem(
      db,
      baseFitness({
        contentClasses: ['Q', 'T', 'M'],
        measurementGuidance: 'Count reps',
        description: 'Partial physical item',
      }),
    );
    try {
      await setKnowledgeLifecycle(db, item.id, 'published');
      throw new Error('publication should have been rejected');
    } catch (error) {
      if ((error as Error).message === 'publication should have been rejected') throw error;
      const details = (error as { details?: { missing?: Array<{ field: string; class: KcsClass }> } })
        .details;
      const classes = new Set((details?.missing ?? []).map((m) => m.class));
      // Q unit semantics, T setup/execution, M definition, S safety (auto) all missing.
      expect(classes.has('Q')).toBe(true);
      expect(classes.has('T')).toBe(true);
      expect(classes.has('M')).toBe(true);
      expect(classes.has('S')).toBe(true);
    }
  });

  it('10. publishes when every applicable minimum is satisfied', async () => {
    const db = testDb();
    for (const fixture of [simpleUQ(), fullPhysical(), fullPractice()]) {
      const item = await createKnowledgeItem(db, fixture);
      const published = await setKnowledgeLifecycle(db, item.id, 'published');
      expect(published.lifecycle).toBe('published');
      const listed = await listPublishedKnowledge(db, {});
      expect(listed.map((entry) => entry.id)).toContain(item.id);
    }
  });

  it('11. retired cannot return to published', async () => {
    const db = testDb();
    const item = await createKnowledgeItem(db, simpleUQ());
    await setKnowledgeLifecycle(db, item.id, 'published');
    await setKnowledgeLifecycle(db, item.id, 'retired');
    await expect(setKnowledgeLifecycle(db, item.id, 'published')).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('12. locale texts attach to the same canonical identity', async () => {
    const db = testDb();
    const item = await createKnowledgeItem(db, simpleUQ());
    const entry = await setKnowledgeText(db, item.id, 'fr', 'description', 'Pratique de test');
    expect(entry).toMatchObject({ locale: 'fr', field: 'description' });
    const texts = await listKnowledgeTexts(db, item.id);
    expect(texts).toHaveLength(1);
    // Canonical record unchanged; no second identity created.
    const base = await getKnowledgeById(db, item.id);
    expect(base?.id).toBe(item.id);
    expect(base?.description).toBe('A test hydration practice');
  });

  it('13. locale fallback is deterministic per field', async () => {
    const db = testDb();
    const item = await createKnowledgeItem(db, simpleUQ());
    await setKnowledgeText(db, item.id, 'fr', 'description', 'Pratique de test');
    const localized = await getLocalizedKnowledge(db, item.id, 'fr');
    expect(localized?.resolvedLocale).toBe('fr');
    expect(localized?.localeFallback).toBe(true);
    expect(localized?.description).toBe('Pratique de test');
    expect(localized?.name).toBe('Test Water Intake');
    // No locale requested: default locale, no fallback flag.
    const plain = await getLocalizedKnowledge(db, item.id, undefined);
    expect(plain?.resolvedLocale).toBe('en');
    expect(plain?.localeFallback).toBe(false);
  });

  it('14. grandfathered published records remain readable without revalidation', async () => {
    const db = testDb();
    await db.query(
      `INSERT INTO knowledge_items
         (kind, lifecycle, current_version, grandfathered, name, category, metric_unit)
       VALUES ('wellness', 'published', 1, TRUE, 'Legacy Sleep', 'sleep', 'hours')`,
    );
    const listed = await listPublishedKnowledge(db, {});
    const legacy = listed.find((entry) => entry.name === 'Legacy Sleep');
    expect(legacy?.grandfathered).toBe(true);
    // Idempotent lifecycle call on an already-published grandfathered item succeeds.
    const again = await setKnowledgeLifecycle(db, legacy!.id, 'published');
    expect(again.lifecycle).toBe('published');
  });

  it('15. version history and pins remain resolvable', async () => {
    const db = testDb();
    const item = await createKnowledgeItem(db, simpleUQ());
    const revised = await reviseKnowledgeItem(
      db,
      item.id,
      simpleUQ({ description: 'Revised hydration practice', unitSemantics: 'One ml, revised' }),
    );
    void revised;
    const current = await getKnowledgeById(db, item.id);
    expect(current?.knowledgeVersion).toBe(2);
    expect(current?.description).toBe('Revised hydration practice');
    const historic = await getKnowledgeVersion(db, item.id, 1);
    expect(historic?.knowledgeVersion).toBe(1);
    expect(historic?.description).toBe('A test hydration practice');
    expect(historic?.unitSemantics).toContain('equivalent drink');
  });

  it('16. malformed structured content is rejected', async () => {
    const db = testDb();
    await expect(
      createKnowledgeItem(db, baseWellness({ protocolSteps: 'not-an-array' })),
    ).rejects.toMatchObject({ statusCode: 400, code: 'invalid_knowledge' });
    await expect(
      createKnowledgeItem(db, baseWellness({ protocolSteps: [123] })),
    ).rejects.toMatchObject({ statusCode: 400, code: 'invalid_knowledge' });
    await expect(
      createKnowledgeItem(db, baseWellness({ protocolSteps: [{ nope: true }] })),
    ).rejects.toMatchObject({ statusCode: 400, code: 'invalid_knowledge' });
    await expect(
      createKnowledgeItem(db, baseWellness({ contentClasses: ['T'], protocolSteps: [{ text: '  ' }] })),
    ).rejects.toMatchObject({ statusCode: 400, code: 'invalid_knowledge' });
  });

  it('17. publication validation cannot be bypassed through API payload shape', async () => {
    await seedAdmin('admin-uid');
    const app = buildTestApp({ adm: 'admin-uid' });
    const headers = jsonHeaders('adm');
    // Asking for published at creation with incomplete content → 422, nothing stored as published.
    const direct = await app.inject({
      method: 'POST',
      url: '/v1/admin/knowledge',
      headers,
      payload: { ...baseFitness({ contentClasses: ['T'] }), lifecycle: 'published' },
    });
    expect(direct.statusCode).toBe(422);
    const directBody = direct.json() as { error: { code: string; details?: { missing?: unknown[] } } };
    expect(directBody.error.code).toBe('kcs_not_ready');
    expect(Array.isArray(directBody.error.details?.missing)).toBe(true);
    // Draft first, then publish attempt → still 422 (no backdoor via PATCH-then-publish
    // without content, and no silent publish).
    const created = await app.inject({
      method: 'POST',
      url: '/v1/admin/knowledge',
      headers,
      payload: baseFitness({ contentClasses: ['T'] }),
    });
    expect(created.statusCode).toBe(201);
    const createdBody = created.json() as { lifecycle: string; id: string };
    expect(createdBody.lifecycle).toBe('draft');
    const publish = await app.inject({
      method: 'POST',
      url: `/v1/admin/knowledge/${createdBody.id}/publish`,
      headers: authHeaders('adm'),
    });
    expect(publish.statusCode).toBe(422);
    // Locale on a missing item → 404, not a bypass vector.
    const missing = await app.inject({
      method: 'PUT',
      url: '/v1/admin/knowledge/00000000-0000-0000-0000-000000000000/texts',
      headers,
      payload: { locale: 'fr', field: 'description', value: 'x' },
    });
    expect(missing.statusCode).toBe(404);
  });
});

describe('PKG-2A-CORR publication integrity', () => {
  async function publishFullPhysical(db: ReturnType<typeof testDb>) {
    const item = await createKnowledgeItem(db, fullPhysical());
    return setKnowledgeLifecycle(db, item.id, 'published');
  }

  it('1+2. published item cannot be revised into KCS-invalid content; prior version unchanged', async () => {
    const db = testDb();
    const published = await publishFullPhysical(db);
    expect(published.lifecycle).toBe('published');
    try {
      await reviseKnowledgeItem(db, published.id, fullPhysical({ setup: '', execution: '' }));
      throw new Error('revision should have been rejected');
    } catch (error) {
      if ((error as Error).message === 'revision should have been rejected') throw error;
      const err = error as { statusCode?: number; code?: string };
      expect(err.statusCode).toBe(422);
      expect(err.code).toBe('kcs_not_ready');
    }
    const current = await getKnowledgeById(db, published.id);
    expect(current?.knowledgeVersion).toBe(1);
    expect(current?.lifecycle).toBe('published');
    expect(current?.setup).toBe('Hands under shoulders, body straight');
  });

  it('3. valid published revision succeeds and versions', async () => {
    const db = testDb();
    const published = await publishFullPhysical(db);
    const revised = await reviseKnowledgeItem(
      db,
      published.id,
      fullPhysical({ description: 'Revised pressing movement' }),
    );
    expect(revised.knowledgeVersion).toBe(2);
    expect(revised.lifecycle).toBe('published');
    expect(revised.description).toBe('Revised pressing movement');
  });

  it('4+5. grandfathered item stays readable, but its new revision is KCS-gated', async () => {
    const db = testDb();
    await db.query(
      `INSERT INTO knowledge_items
         (kind, lifecycle, current_version, grandfathered, name, category, metric_unit)
       VALUES ('wellness', 'published', 1, TRUE, 'Legacy Rest', 'sleep', 'hours')`,
    );
    const listed = await listPublishedKnowledge(db, {});
    const legacy = listed.find((entry) => entry.name === 'Legacy Rest');
    expect(legacy?.grandfathered).toBe(true);
    // Incomplete new content → rejected, published version untouched.
    try {
      await reviseKnowledgeItem(db, legacy!.id, {
        name: 'Legacy Rest',
        category: 'sleep',
        difficulty: 'beginner',
        metricUnit: 'hours',
        description: 'Still incomplete',
      });
      throw new Error('revision should have been rejected');
    } catch (error) {
      if ((error as Error).message === 'revision should have been rejected') throw error;
      expect((error as { code?: string }).code).toBe('kcs_not_ready');
    }
    expect((await getKnowledgeById(db, legacy!.id))?.knowledgeVersion).toBe(1);
    // Complete new content → accepted as version 2; grandfathered provenance preserved.
    const revised = await reviseKnowledgeItem(db, legacy!.id, {
      name: 'Legacy Rest',
      category: 'sleep',
      difficulty: 'beginner',
      metricUnit: 'hours',
      description: 'A rest practice',
      measurementGuidance: 'Report rest hours',
    });
    expect(revised.knowledgeVersion).toBe(2);
    expect(revised.lifecycle).toBe('published');
    expect(revised.grandfathered).toBe(true);
  });

  it('6+7. invalid and non-string content classes are rejected, not dropped', async () => {
    const db = testDb();
    await expect(
      createKnowledgeItem(db, baseWellness({ contentClasses: ['Q', 'X'] })),
    ).rejects.toMatchObject({ statusCode: 400, code: 'invalid_knowledge' });
    await expect(
      createKnowledgeItem(db, baseWellness({ contentClasses: ['Q', 5] })),
    ).rejects.toMatchObject({ statusCode: 400, code: 'invalid_knowledge' });
    await expect(
      createKnowledgeItem(db, baseWellness({ contentClasses: 'Q' })),
    ).rejects.toMatchObject({ statusCode: 400, code: 'invalid_knowledge' });
  });

  it('8. duplicate valid classes normalize deterministically', async () => {
    const db = testDb();
    const item = await createKnowledgeItem(db, baseWellness({ contentClasses: ['Q', 'Q', 'T'] }));
    expect(item.contentClasses).toEqual(['Q', 'T']);
  });

  it('9. locale behavior matches the documented bounded-subset contract', async () => {
    for (const locale of ['en', 'fr', 'fr-FR', 'sw-KE']) {
      expect(validateLocale(locale)).toBe(locale);
    }
    for (const bad of ['e', 'eng', 'en_us', 'EN', 'en-Latn-US', '', 'e1']) {
      expect(() => validateLocale(bad)).toThrow(expect.objectContaining({ code: 'invalid_knowledge' }));
    }
    const db = testDb();
    const item = await createKnowledgeItem(db, simpleUQ());
    await expect(setKnowledgeText(db, item.id, 'en-Latn-US', 'description', 'x')).rejects.toMatchObject({
      code: 'invalid_knowledge',
    });
  });

  it('10. version/class history remains reconstructable', async () => {
    const db = testDb();
    const item = await createKnowledgeItem(db, fullPhysical());
    await setKnowledgeLifecycle(db, item.id, 'published');
    await reviseKnowledgeItem(
      db,
      item.id,
      fullPhysical({
        contentClasses: ['Q', 'T', 'M'],
        semanticDefinition: 'A governed strength meaning',
      }),
    );
    const v1 = await getKnowledgeVersion(db, item.id, 1);
    const v2 = await getKnowledgeVersion(db, item.id, 2);
    expect(v1?.contentClasses).toEqual(['Q', 'T']);
    expect(v2?.contentClasses).toEqual(['Q', 'T', 'M']);
    expect(v2?.semanticDefinition).toBe('A governed strength meaning');
  });
});

describe('PKG-2A migration 007', () => {
  it('applies idempotently and preserves row counts', async () => {
    const db = testDb();
    const before = await db.query<{ count: string }>(
      'SELECT COUNT(*) AS count FROM knowledge_items',
    );
    await runMigrations(db);
    const after = await db.query<{ count: string }>(
      'SELECT COUNT(*) AS count FROM knowledge_items',
    );
    expect(after.rows[0].count).toBe(before.rows[0].count);
    const columns = await db.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'knowledge_items' AND column_name IN
         ('content_classes', 'grandfathered', 'protocol_steps', 'safety_notes')`,
    );
    expect(columns.rows).toHaveLength(4);
    const tables = await db.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_name = 'knowledge_item_texts'`,
    );
    expect(tables.rows).toHaveLength(1);
  });
});
