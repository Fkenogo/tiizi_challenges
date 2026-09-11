import { describe, expect, it } from 'vitest';
import {
  deterministicKnowledgeId,
  normalizeLifecycle,
  normalizeVersion,
} from '../src/knowledge.js';
import {
  apiParityEntry,
  compareKnowledgeParity,
  firestoreParityEntry,
  knowledgeParityMatches,
  summarizeKnowledgeParity,
} from '../src/knowledgeParity.js';
import {
  forwardLifecycleTarget,
  normalizeKnowledgeRecord,
  runKnowledgeImport,
  type KnowledgeSource,
  type SourceKnowledgeItem,
} from '../src/knowledgeImport.js';
import { authHeaders, buildTestApp, seedMember, testDb } from './helpers.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fitnessPayload(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'fitness',
    name: 'Push-Ups',
    category: 'Upper Body',
    subcategory: 'Strength',
    difficulty: 'Beginner',
    metricUnit: 'reps',
    description: 'Classic push-ups',
    tags: ['chest'],
    details: { setup: ['Hands under shoulders'], execution: ['Lower and press'] },
    ...overrides,
  };
}

function wellnessPayload(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'wellness',
    name: '16:8 Fasting',
    category: 'fasting',
    difficulty: 'beginner',
    icon: '⏰',
    metricUnit: 'hours',
    targetValue: 16,
    targetType: 'daily',
    points: 20,
    description: 'Time-restricted eating',
    ...overrides,
  };
}

async function seedAdmin(subject: string, role = 'admin'): Promise<string> {
  const db = testDb();
  const memberId = await seedMember(db, subject);
  await db.query('UPDATE members SET role = $2 WHERE member_id = $1', [memberId, role]);
  return memberId;
}

function jsonHeaders(token: string): Record<string, string> {
  return { ...authHeaders(token), 'content-type': 'application/json' };
}

async function createAsAdmin(app: ReturnType<typeof buildTestApp>, payload: Record<string, unknown>) {
  return app.inject({
    method: 'POST',
    url: '/v1/admin/knowledge',
    headers: jsonHeaders('adm'),
    payload,
  });
}

describe('deterministicKnowledgeId (legacy Firestore ID → Tiizi UUID)', () => {
  it('matches the independent RFC 4122 v5 oracle', () => {
    // Vectors computed with Python uuid/hashlib (independent implementation).
    expect(deterministicKnowledgeId('catalogExercises', 'push-ups')).toBe(
      '1da8089a-4800-5165-896d-3cf8fbc52e5b',
    );
    expect(deterministicKnowledgeId('wellnessActivities', '16-8-fasting')).toBe(
      'fc6836d7-8053-554d-9e06-ababb2e3afa9',
    );
  });

  it('is stable and collection-scoped', () => {
    const first = deterministicKnowledgeId('catalogExercises', 'push-ups');
    expect(deterministicKnowledgeId('catalogExercises', 'push-ups')).toBe(first);
    expect(deterministicKnowledgeId('wellnessActivities', 'push-ups')).not.toBe(first);
    expect(first).toMatch(UUID_RE);
  });
});

describe('lifecycle/version normalization (legacy compatibility)', () => {
  it('treats missing lifecycle as published', () => {
    expect(normalizeLifecycle(undefined)).toBe('published');
    expect(normalizeLifecycle(null)).toBe('published');
    expect(normalizeLifecycle('published')).toBe('published');
    expect(normalizeLifecycle('draft')).toBe('draft');
    expect(normalizeLifecycle('retired')).toBe('retired');
    expect(normalizeLifecycle('bogus')).toBe('published');
  });

  it('normalizes missing/invalid versions to 1', () => {
    expect(normalizeVersion(undefined)).toBe(1);
    expect(normalizeVersion(null)).toBe(1);
    expect(normalizeVersion(0)).toBe(1);
    expect(normalizeVersion(-3)).toBe(1);
    expect(normalizeVersion(Number.NaN)).toBe(1);
    expect(normalizeVersion('7')).toBe(7);
    expect(normalizeVersion(2.9)).toBe(2);
  });
});

describe('normalizeKnowledgeRecord (Firestore → PostgreSQL mapping)', () => {
  const item = (
    collection: 'catalogExercises' | 'wellnessActivities',
    firestoreId: string,
    data: Record<string, unknown>,
  ): SourceKnowledgeItem => ({ firestoreId, collection, data });

  it('maps fitness records, defaulting missing lifecycle/version', () => {
    const result = normalizeKnowledgeRecord(item('catalogExercises', 'push-ups', {
      name: 'Push-Ups',
      tier_1: 'Upper Body',
      tier_2: 'Strength',
      difficulty: 'Beginner',
      metric: { type: 'count', unit: 'reps' },
      description: 'Classic',
      setup: ['s1'],
      equipment: ['none'],
    }));
    expect(result.malformed).toBeUndefined();
    expect(result.normalized).toMatchObject({
      kind: 'fitness',
      legacyId: 'push-ups',
      knowledgeId: '1da8089a-4800-5165-896d-3cf8fbc52e5b',
      lifecycle: 'published',
      version: 1,
      name: 'Push-Ups',
      category: 'Upper Body',
      subcategory: 'Strength',
      metricUnit: 'reps',
      points: 0,
    });
    expect(result.normalized?.details).toMatchObject({ setup: ['s1'], equipment: ['none'] });
  });

  it('maps wellness records preserving version and lifecycle', () => {
    const result = normalizeKnowledgeRecord(item('wellnessActivities', 'fast-16', {
      name: 'Fast',
      category: 'fasting',
      difficulty: 'beginner',
      lifecycleStatus: 'draft',
      knowledgeVersion: 4,
      defaultMetricUnit: 'hours',
      defaultTargetValue: 16,
      defaultPoints: 20,
    }));
    expect(result.normalized).toMatchObject({
      kind: 'wellness',
      lifecycle: 'draft',
      version: 4,
      metricUnit: 'hours',
      targetValue: 16,
      points: 20,
    });
  });

  it('reports records without a usable name as malformed', () => {
    const blank = normalizeKnowledgeRecord(item('catalogExercises', 'ghost', { tier_1: 'Core' }));
    expect(blank.normalized).toBeUndefined();
    expect(blank.malformed).toBe('missing name');
  });
});

describe('compareKnowledgeParity (pure semantics)', () => {
  const fsEntry = (legacyId: string, overrides = {}) =>
    firestoreParityEntry(legacyId, 'catalogExercises', {
      name: 'Push-Ups',
      lifecycleStatus: 'published',
      knowledgeVersion: 2,
      ...overrides,
    });
  const apiEntry = (legacyId: string, overrides = {}) =>
    apiParityEntry({
      legacy_firestore_id: legacyId,
      legacy_collection: 'catalogExercises',
      lifecycle: 'published',
      current_version: 2,
      name: 'Push-Ups',
      ...overrides,
    });

  it('matches identical normalized state and normalizes legacy gaps', () => {
    const report = summarizeKnowledgeParity(
      [firestoreParityEntry('a', 'catalogExercises', { name: 'A' })],
      [apiParityEntry({
        legacy_firestore_id: 'a',
        legacy_collection: 'catalogExercises',
        lifecycle: 'published',
        current_version: 1,
        name: 'A',
      })],
    );
    expect(knowledgeParityMatches(report)).toBe(true);
  });

  it('reports missing, drifted, and extra rows with kinds', () => {
    const differences = compareKnowledgeParity(
      [fsEntry('gone'), fsEntry('drift', { knowledgeVersion: 3 }), fsEntry('renamed', { name: 'Old' })],
      [apiEntry('drift', { current_version: 2 }), apiEntry('renamed', { name: 'New' }), apiEntry('extra')],
    );
    const kinds = differences.map((d) => `${d.kind}:${d.legacyId}`).sort();
    expect(kinds).toEqual([
      'missing_in_api:gone',
      'missing_in_firestore:extra',
      'name_mismatch:renamed',
      'version_mismatch:drift',
    ]);
  });
});

describe('knowledge admin authorization', () => {
  it('rejects unauthenticated and non-admin mutation', async () => {
    await seedMember(testDb(), 'member-uid');
    await seedAdmin('admin-uid');
    const app = buildTestApp({ m: 'member-uid', adm: 'admin-uid' });

    const anon = await app.inject({ method: 'POST', url: '/v1/admin/knowledge', payload: {} });
    expect(anon.statusCode).toBe(401);

    const forbidden = await app.inject({
      method: 'POST',
      url: '/v1/admin/knowledge',
      headers: jsonHeaders('m'),
      payload: fitnessPayload(),
    });
    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.json().error.code).toBe('forbidden');

    const adminList = await app.inject({
      method: 'GET',
      url: '/v1/admin/knowledge',
      headers: authHeaders('m'),
    });
    expect(adminList.statusCode).toBe(403);
  });

  it('lets every moderation role through and blocks plain members/support', async () => {
    await seedMember(testDb(), 'plain-uid');
    for (const [token, role] of Object.entries({
      a1: 'super_admin',
      a2: 'moderator',
      a3: 'content_manager',
    })) {
      await seedAdmin(token, role);
    }
    await seedAdmin('support-uid', 'support');
    const app = buildTestApp({ p: 'plain-uid', a1: 'a1', a2: 'a2', a3: 'a3', s: 'support-uid' });
    for (const token of ['a1', 'a2', 'a3']) {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/admin/knowledge',
        headers: authHeaders(token),
      });
      expect(res.statusCode).toBe(200);
    }
    for (const token of ['p', 's']) {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/admin/knowledge',
        headers: authHeaders(token),
      });
      expect(res.statusCode).toBe(403);
    }
  });
});

describe('knowledge admin writes (create / revise / lifecycle)', () => {
  it('creates at version 1 with a Tiizi UUID and ignores client versions', async () => {
    await seedAdmin('admin-uid');
    const app = buildTestApp({ adm: 'admin-uid' });
    const res = await createAsAdmin(app, {
      ...fitnessPayload(),
      knowledgeVersion: 99,
      lifecycle: undefined,
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.id).toMatch(UUID_RE);
    expect(body.knowledgeVersion).toBe(1);
    // PKG-2A safe default: omitted lifecycle creates a draft, never published.
    expect(body.lifecycle).toBe('draft');

    const history = await app.inject({
      method: 'GET',
      url: `/v1/knowledge/${body.id}/versions/1`,
      headers: authHeaders('adm'),
    });
    expect(history.statusCode).toBe(200);
    expect(history.json().name).toBe('Push-Ups');
  });

  it('supports explicit draft creation and rejects invalid input', async () => {
    await seedAdmin('admin-uid');
    const app = buildTestApp({ adm: 'admin-uid' });
    const draft = await createAsAdmin(app, { ...wellnessPayload(), lifecycle: 'draft' });
    expect(draft.statusCode).toBe(201);
    expect(draft.json().lifecycle).toBe('draft');

    for (const bad of [
      { ...fitnessPayload(), kind: 'cardio' },
      { ...fitnessPayload(), name: '  ' },
      { ...fitnessPayload(), category: 'Arms' },
      { ...fitnessPayload(), lifecycle: 'retired' },
    ]) {
      const res = await createAsAdmin(app, bad);
      expect(res.statusCode).toBe(400);
    }
  });

  it('revises content exactly once per call and preserves immutable history', async () => {
    await seedAdmin('admin-uid');
    const app = buildTestApp({ adm: 'admin-uid' });
    const created = (await createAsAdmin(app, fitnessPayload())).json();
    const headers = jsonHeaders('adm');

    const second = await app.inject({
      method: 'PATCH',
      url: `/v1/admin/knowledge/${created.id}`,
      headers,
      payload: fitnessPayload({ name: 'Push-Ups v2', description: 'Revised' }),
    });
    expect(second.statusCode).toBe(200);
    expect(second.json().knowledgeVersion).toBe(2);

    const third = await app.inject({
      method: 'PATCH',
      url: `/v1/admin/knowledge/${created.id}`,
      headers,
      payload: fitnessPayload({ name: 'Push-Ups v3', description: 'Revised again' }),
    });
    expect(third.json().knowledgeVersion).toBe(3);

    const first = await app.inject({
      method: 'GET',
      url: `/v1/knowledge/${created.id}/versions/1`,
      headers: authHeaders('adm'),
    });
    expect(first.json().name).toBe('Push-Ups');
    const middle = await app.inject({
      method: 'GET',
      url: `/v1/knowledge/${created.id}/versions/2`,
      headers: authHeaders('adm'),
    });
    expect(middle.json().name).toBe('Push-Ups v2');
    const missing = await app.inject({
      method: 'GET',
      url: `/v1/knowledge/${created.id}/versions/9`,
      headers: authHeaders('adm'),
    });
    expect(missing.statusCode).toBe(404);
  });

  it('keeps lifecycle-only transitions off the version counter', async () => {
    await seedAdmin('admin-uid');
    const app = buildTestApp({ adm: 'admin-uid' });
    const created = (
      await createAsAdmin(app, {
        ...wellnessPayload(),
        lifecycle: 'draft',
        measurementGuidance: 'Report fasting hours',
      })
    ).json();
    expect(created.knowledgeVersion).toBe(1);

    const published = await app.inject({
      method: 'POST',
      url: `/v1/admin/knowledge/${created.id}/publish`,
      headers: authHeaders('adm'),
    });
    expect(published.statusCode).toBe(200);
    expect(published.json()).toMatchObject({ lifecycle: 'published', knowledgeVersion: 1 });

    const retired = await app.inject({
      method: 'POST',
      url: `/v1/admin/knowledge/${created.id}/retire`,
      headers: authHeaders('adm'),
    });
    expect(retired.json()).toMatchObject({ lifecycle: 'retired', knowledgeVersion: 1 });

    const noSecondVersion = await app.inject({
      method: 'GET',
      url: `/v1/knowledge/${created.id}/versions/2`,
      headers: authHeaders('adm'),
    });
    expect(noSecondVersion.statusCode).toBe(404);
  });

  it('enforces forward-only lifecycle with idempotent repeats', async () => {
    await seedAdmin('admin-uid');
    const app = buildTestApp({ adm: 'admin-uid' });
    const created = (
      await createAsAdmin(app, {
        ...fitnessPayload(),
        measurementGuidance: 'Count full-range repetitions',
        safetyNotes: ['Stop on sharp pain'],
      })
    ).json();
    const headers = authHeaders('adm');

    const republish = await app.inject({
      method: 'POST',
      url: `/v1/admin/knowledge/${created.id}/publish`,
      headers,
    });
    expect(republish.statusCode).toBe(200);

    await app.inject({ method: 'POST', url: `/v1/admin/knowledge/${created.id}/retire`, headers });
    const republishRetired = await app.inject({
      method: 'POST',
      url: `/v1/admin/knowledge/${created.id}/publish`,
      headers,
    });
    expect(republishRetired.statusCode).toBe(409);
    expect(republishRetired.json().error.code).toBe('invalid_lifecycle_transition');

    const reRetire = await app.inject({
      method: 'POST',
      url: `/v1/admin/knowledge/${created.id}/retire`,
      headers,
    });
    expect(reRetire.statusCode).toBe(200);
  });

  it('serializes concurrent revisions into distinct versions', async () => {
    await seedAdmin('admin-uid');
    const app = buildTestApp({ adm: 'admin-uid' });
    const created = (await createAsAdmin(app, fitnessPayload())).json();
    const headers = jsonHeaders('adm');

    const [first, second] = await Promise.all([
      app.inject({
        method: 'PATCH',
        url: `/v1/admin/knowledge/${created.id}`,
        headers,
        payload: fitnessPayload({ name: 'Concurrent A' }),
      }),
      app.inject({
        method: 'PATCH',
        url: `/v1/admin/knowledge/${created.id}`,
        headers,
        payload: fitnessPayload({ name: 'Concurrent B' }),
      }),
    ]);
    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    const versions = [first.json().knowledgeVersion, second.json().knowledgeVersion].sort();
    expect(versions).toEqual([2, 3]);

    const current = await app.inject({
      method: 'GET',
      url: `/v1/knowledge/${created.id}`,
      headers: authHeaders('adm'),
    });
    expect(current.json().knowledgeVersion).toBe(3);
  });

  it('rejects direct mutation of immutable version history', async () => {
    const db = testDb();
    await seedAdmin('admin-uid');
    const app = buildTestApp({ adm: 'admin-uid' });
    const created = (await createAsAdmin(app, fitnessPayload())).json();

    await expect(
      db.query('UPDATE knowledge_item_versions SET name = $1 WHERE item_id = $2', ['Hacked', created.id]),
    ).rejects.toThrow();
    await expect(
      db.query('DELETE FROM knowledge_item_versions WHERE item_id = $1', [created.id]),
    ).rejects.toThrow();

    const intact = await app.inject({
      method: 'GET',
      url: `/v1/knowledge/${created.id}/versions/1`,
      headers: authHeaders('adm'),
    });
    expect(intact.statusCode).toBe(200);
    expect(intact.json().name).toBe('Push-Ups');
  });
});

describe('knowledge runtime reads (published-only listing, compat lookup)', () => {
  it('lists only published records, filterable by kind and search', async () => {
    await seedAdmin('admin-uid');
    await seedMember(testDb(), 'member-uid');
    const app = buildTestApp({ adm: 'admin-uid', m: 'member-uid' });

    const pub = (
      await createAsAdmin(app, {
        ...fitnessPayload({ name: 'Alpha Press' }),
        measurementGuidance: 'Count full-range repetitions',
        safetyNotes: ['Stop on sharp pain'],
      })
    ).json();
    await app.inject({
      method: 'POST',
      url: `/v1/admin/knowledge/${pub.id}/publish`,
      headers: authHeaders('adm'),
    });
    await createAsAdmin(app, { ...fitnessPayload({ name: 'Beta Draft' }), lifecycle: 'draft' });
    const retiring = (
      await createAsAdmin(app, {
        ...wellnessPayload({ name: 'Gamma Fast' }),
        measurementGuidance: 'Report fasting hours',
      })
    ).json();
    await app.inject({
      method: 'POST',
      url: `/v1/admin/knowledge/${retiring.id}/publish`,
      headers: authHeaders('adm'),
    });
    await app.inject({
      method: 'POST',
      url: `/v1/admin/knowledge/${retiring.id}/retire`,
      headers: authHeaders('adm'),
    });

    const headers = authHeaders('m');
    const all = await app.inject({ method: 'GET', url: '/v1/knowledge', headers });
    expect(all.statusCode).toBe(200);
    expect(all.json().items.map((item: { name: string }) => item.name)).toEqual(['Alpha Press']);

    const fitness = await app.inject({ method: 'GET', url: '/v1/knowledge?kind=fitness', headers });
    expect(fitness.json().items).toHaveLength(1);

    const search = await app.inject({ method: 'GET', url: '/v1/knowledge?search=alpha', headers });
    expect(search.json().items.map((item: { name: string }) => item.name)).toEqual(['Alpha Press']);

    // Admin list sees every lifecycle state.
    const adminAll = await app.inject({
      method: 'GET',
      url: '/v1/admin/knowledge',
      headers: authHeaders('adm'),
    });
    expect(adminAll.json().items).toHaveLength(3);
    const retiredOnly = await app.inject({
      method: 'GET',
      url: '/v1/admin/knowledge?lifecycle=retired',
      headers: authHeaders('adm'),
    });
    expect(retiredOnly.json().items.map((item: { name: string }) => item.name)).toEqual([
      'Gamma Fast',
    ]);

    // By-ID reads stay unfiltered so retired history resolves.
    const retiredById = await app.inject({
      method: 'GET',
      url: `/v1/knowledge/${retiring.id}`,
      headers,
    });
    expect(retiredById.statusCode).toBe(200);
    expect(retiredById.json().lifecycle).toBe('retired');

    const unknown = await app.inject({
      method: 'GET',
      url: '/v1/knowledge/00000000-0000-0000-0000-000000000000',
      headers,
    });
    expect(unknown.statusCode).toBe(404);
    const notUuid = await app.inject({ method: 'GET', url: '/v1/knowledge/push-ups', headers });
    expect(notUuid.statusCode).toBe(404);
    void pub;
  });

  it('exposes Tiizi UUIDs as canonical ids and legacy ids only via compat', async () => {
    await seedAdmin('admin-uid');
    await seedMember(testDb(), 'member-uid');
    const app = buildTestApp({ adm: 'admin-uid', m: 'member-uid' });
    const created = (await createAsAdmin(app, fitnessPayload())).json();

    const list = await app.inject({
      method: 'GET',
      url: '/v1/knowledge',
      headers: authHeaders('m'),
    });
    for (const item of list.json().items as Array<{ id: string }>) {
      expect(item.id).toMatch(UUID_RE);
      expect(item.id).not.toContain('push');
    }

    // Non-legacy items have no compat mapping; lookup creates nothing.
    const compat = await app.inject({
      method: 'GET',
      url: `/v1/compat/knowledge-ids?id=${created.id}&legacyId=ghost-doc`,
      headers: authHeaders('m'),
    });
    expect(compat.statusCode).toBe(200);
    expect(compat.json()).toEqual({ mappings: [] });
  });
});

describe('runKnowledgeImport (read-only Firestore source → PostgreSQL)', () => {
  const source = (
    knowledge: SourceKnowledgeItem[],
    roles: Array<{ uid: string; role: string }> = [],
  ): KnowledgeSource => ({
    listKnowledge: async () => knowledge,
    listUserRoles: async () => roles,
  });

  const fitnessDoc = (firestoreId: string, data: Record<string, unknown> = {}) => ({
    firestoreId,
    collection: 'catalogExercises' as const,
    data: {
      name: 'Push-Ups',
      tier_1: 'Upper Body',
      tier_2: 'Strength',
      difficulty: 'Beginner',
      metric: { type: 'count', unit: 'reps' },
      description: 'Classic',
      ...data,
    },
  });

  const wellnessDoc = (firestoreId: string, data: Record<string, unknown> = {}) => ({
    firestoreId,
    collection: 'wellnessActivities' as const,
    data: {
      name: 'Fast',
      category: 'fasting',
      difficulty: 'beginner',
      defaultMetricUnit: 'hours',
      defaultTargetValue: 16,
      defaultPoints: 20,
      ...data,
    },
  });

  it('dry-runs without writing and reports malformed records', async () => {
    const db = testDb();
    const report = await runKnowledgeImport(
      db,
      source(
        [fitnessDoc('push-ups'), wellnessDoc('fast-16', { knowledgeVersion: 3 }), fitnessDoc('bad', { name: '  ' })],
        [{ uid: 'admin-uid', role: 'admin' }],
      ),
      { dryRun: true },
    );
    expect(report).toMatchObject({
      dryRun: true,
      fitnessSeen: 2,
      fitnessWritten: 0,
      wellnessSeen: 1,
      wellnessWritten: 0,
      rolesSeen: 1,
      rolesWritten: 0,
    });
    expect(report.malformed).toEqual([
      { legacyId: 'bad', collection: 'catalogExercises', reason: 'missing name' },
    ]);
    const count = await db.query<{ count: string }>('SELECT COUNT(*) AS count FROM knowledge_items');
    expect(Number(count.rows[0].count)).toBe(0);
  });

  it('applies deterministically and idempotently, syncing member roles', async () => {
    const db = testDb();
    const src = source(
      [
        fitnessDoc('push-ups'),
        wellnessDoc('fast-16', { lifecycleStatus: undefined, knowledgeVersion: undefined }),
        fitnessDoc('bad', { name: '' }),
      ],
      [
        { uid: 'admin-uid', role: 'admin' },
        { uid: 'plain-uid', role: 'bogus-role' },
      ],
    );
    const first = await runKnowledgeImport(db, src, { dryRun: false });
    expect(first.malformed).toHaveLength(1);
    expect(first.fitnessWritten).toBe(1);
    expect(first.wellnessWritten).toBe(1);
    expect(first.rolesSeen).toBe(2);
    expect(first.rolesWritten).toBe(2);

    // Imported legacy rows normalize to published/version 1 with stable UUIDs.
    const rows = await db.query<{
      knowledge_id: string;
      kind: string;
      legacy_firestore_id: string;
      lifecycle: string;
      current_version: number;
    }>('SELECT knowledge_id, kind, legacy_firestore_id, lifecycle, current_version FROM knowledge_items ORDER BY legacy_firestore_id');
    expect(rows.rows.map((r) => [
      String(r.knowledge_id),
      r.kind,
      r.legacy_firestore_id,
      r.lifecycle,
      Number(r.current_version),
    ])).toEqual([
      ['87ac8543-52e7-5a65-9174-e5960f76c538', 'wellness', 'fast-16', 'published', 1],
      ['1da8089a-4800-5165-896d-3cf8fbc52e5b', 'fitness', 'push-ups', 'published', 1],
    ]);

    // Unknown roles fall back to member; synced admins can mutate via the API.
    const roles = await db.query<{ auth_subject: string; role: string }>(
      "SELECT auth_subject, role FROM members WHERE auth_provider = 'firebase' ORDER BY auth_subject",
    );
    expect(roles.rows).toEqual([
      { auth_subject: 'admin-uid', role: 'admin' },
      { auth_subject: 'plain-uid', role: 'member' },
    ]);

    const app = buildTestApp({ adm: 'admin-uid', p: 'plain-uid' });
    const compat = await app.inject({
      method: 'GET',
      url: '/v1/compat/knowledge-ids?legacyId=push-ups',
      headers: authHeaders('adm'),
    });
    expect(compat.json()).toEqual({
      mappings: [{
        legacyId: 'push-ups',
        id: '1da8089a-4800-5165-896d-3cf8fbc52e5b',
        kind: 'fitness',
      }],
    });

    // Second apply: identical IDs, identical totals, no extra version rows.
    const second = await runKnowledgeImport(db, src, { dryRun: false });
    expect(second.fitnessWritten).toBe(1);
    expect(second.wellnessWritten).toBe(1);
    const versions = await db.query<{ count: string }>(
      'SELECT COUNT(*) AS count FROM knowledge_item_versions',
    );
    expect(Number(versions.rows[0].count)).toBe(2);
  });

  it('lets PostgreSQL win ties but follows strictly newer Firestore versions', async () => {
    const db = testDb();
    await seedAdmin('admin-uid');
    await runKnowledgeImport(db, source([fitnessDoc('push-ups')]), { dryRun: false });
    const app = buildTestApp({ adm: 'admin-uid' });
    const compat = await app.inject({
      method: 'GET',
      url: '/v1/compat/knowledge-ids?legacyId=push-ups',
      headers: authHeaders('adm'),
    });
    const id = compat.json().mappings[0].id as string;

    // API-side revision to version 2; re-import of Firestore version 1 must not regress it.
    // (PKG-2A-CORR: published revisions satisfy the KCS gate.)
    await app.inject({
      method: 'PATCH',
      url: `/v1/admin/knowledge/${id}`,
      headers: jsonHeaders('adm'),
      payload: fitnessPayload({
        name: 'API Revised',
        measurementGuidance: 'Count full-range repetitions',
        safetyNotes: ['Stop on sharp pain'],
      }),
    });
    await runKnowledgeImport(db, source([fitnessDoc('push-ups')]), { dryRun: false });
    const kept = await app.inject({
      method: 'GET',
      url: `/v1/knowledge/${id}`,
      headers: authHeaders('adm'),
    });
    expect(kept.json()).toMatchObject({ name: 'API Revised', knowledgeVersion: 2 });

    // Strictly newer Firestore version moves content forward and appends history.
    await runKnowledgeImport(
      db,
      source([fitnessDoc('push-ups', { knowledgeVersion: 5, name: 'Firestore v5' })]),
      { dryRun: false },
    );
    const moved = await app.inject({
      method: 'GET',
      url: `/v1/knowledge/${id}`,
      headers: authHeaders('adm'),
    });
    expect(moved.json()).toMatchObject({ name: 'Firestore v5', knowledgeVersion: 5 });
    const historic = await app.inject({
      method: 'GET',
      url: `/v1/knowledge/${id}/versions/5`,
      headers: authHeaders('adm'),
    });
    expect(historic.json().name).toBe('Firestore v5');
  });
});

describe('forwardLifecycleTarget (import lifecycle sync, version-independent)', () => {
  it('allows strict forward moves and blocks same-state/regressions', () => {
    expect(forwardLifecycleTarget('draft', 'published')).toBe('published');
    expect(forwardLifecycleTarget('draft', 'retired')).toBe('retired');
    expect(forwardLifecycleTarget('published', 'retired')).toBe('retired');
    expect(forwardLifecycleTarget('published', 'published')).toBeNull();
    expect(forwardLifecycleTarget('retired', 'published')).toBeNull();
    expect(forwardLifecycleTarget('retired', 'draft')).toBeNull();
    expect(forwardLifecycleTarget('published', 'draft')).toBeNull();
    expect(forwardLifecycleTarget('draft', 'draft')).toBeNull();
  });
});

describe('runKnowledgeImport lifecycle-only synchronization (Finding 1)', () => {
  const source = (knowledge: SourceKnowledgeItem[]): KnowledgeSource => ({
    listKnowledge: async () => knowledge,
    listUserRoles: async () => [],
  });

  const fitnessDoc = (
    firestoreId: string,
    data: Record<string, unknown>,
  ): SourceKnowledgeItem => ({
    firestoreId,
    collection: 'catalogExercises',
    data: {
      name: 'Push-Ups',
      tier_1: 'Upper Body',
      tier_2: 'Strength',
      difficulty: 'Beginner',
      metric: { type: 'count', unit: 'reps' },
      description: 'Classic',
      ...data,
    },
  });

  async function itemState(db: ReturnType<typeof testDb>, legacyId: string) {
    const rows = await db.query<{
      knowledge_id: string;
      lifecycle: string;
      current_version: number;
      name: string;
    }>(
      `SELECT knowledge_id, lifecycle, current_version, name FROM knowledge_items
       WHERE legacy_firestore_id = $1`,
      [legacyId],
    );
    const row = rows.rows[0];
    const versions = await db.query<{ count: string }>(
      'SELECT COUNT(*) AS count FROM knowledge_item_versions WHERE item_id = $1',
      [row.knowledge_id],
    );
    const versionContent = await db.query<{ name: string }>(
      `SELECT name FROM knowledge_item_versions
       WHERE item_id = $1 AND version = $2`,
      [row.knowledge_id, Number(row.current_version)],
    );
    return {
      lifecycle: row.lifecycle,
      version: Number(row.current_version),
      name: row.name,
      versionRows: Number(versions.rows[0].count),
      versionContentName: versionContent.rows[0]?.name,
    };
  }

  it('v3 published PG + v3 retired Firestore → retired, version stays 3', async () => {
    const db = testDb();
    await runKnowledgeImport(
      db,
      source([fitnessDoc('push-ups', { knowledgeVersion: 3 })]),
      { dryRun: false },
    );
    await runKnowledgeImport(
      db,
      source([fitnessDoc('push-ups', { knowledgeVersion: 3, lifecycleStatus: 'retired' })]),
      { dryRun: false },
    );
    const state = await itemState(db, 'push-ups');
    expect(state).toMatchObject({
      lifecycle: 'retired',
      version: 3,
      name: 'Push-Ups',
      versionRows: 1,
      versionContentName: 'Push-Ups',
    });
  });

  it('v3 draft PG + v3 published Firestore → published, version stays 3', async () => {
    const db = testDb();
    await runKnowledgeImport(
      db,
      source([fitnessDoc('push-ups', { knowledgeVersion: 3, lifecycleStatus: 'draft' })]),
      { dryRun: false },
    );
    await runKnowledgeImport(
      db,
      source([fitnessDoc('push-ups', { knowledgeVersion: 3 })]),
      { dryRun: false },
    );
    const state = await itemState(db, 'push-ups');
    expect(state).toMatchObject({ lifecycle: 'published', version: 3, versionRows: 1 });
  });

  it('v3 retired PG + v3 published Firestore → stays retired (never regress)', async () => {
    const db = testDb();
    await runKnowledgeImport(
      db,
      source([fitnessDoc('push-ups', { knowledgeVersion: 3, lifecycleStatus: 'retired' })]),
      { dryRun: false },
    );
    await runKnowledgeImport(
      db,
      source([fitnessDoc('push-ups', { knowledgeVersion: 3, name: 'Push-Ups Renamed' })]),
      { dryRun: false },
    );
    const state = await itemState(db, 'push-ups');
    expect(state).toMatchObject({
      lifecycle: 'retired',
      version: 3,
      name: 'Push-Ups',
      versionRows: 1,
      versionContentName: 'Push-Ups',
    });
  });

  it('equal-version lifecycle sync stays idempotent across repeated applies', async () => {
    const db = testDb();
    const first = source([fitnessDoc('push-ups', { knowledgeVersion: 2 })]);
    const second = source([
      fitnessDoc('push-ups', { knowledgeVersion: 2, lifecycleStatus: 'retired' }),
    ]);
    await runKnowledgeImport(db, first, { dryRun: false });
    await runKnowledgeImport(db, second, { dryRun: false });
    const synced = await itemState(db, 'push-ups');
    expect(synced).toMatchObject({ lifecycle: 'retired', version: 2, versionRows: 1 });
    const repeat = await runKnowledgeImport(db, second, { dryRun: false });
    expect(repeat.fitnessWritten).toBe(1);
    const stable = await itemState(db, 'push-ups');
    expect(stable).toEqual(synced);
  });
});
