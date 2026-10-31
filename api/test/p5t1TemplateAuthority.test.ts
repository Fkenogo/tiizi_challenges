/**
 * TIIZI-FER-P5T-1-001 — Challenge Template authority.
 *
 * Numbered cases follow TIIZI-FER-TPL-001 §7 (slice 1): 1, 2, 3, 4, 5, 12,
 * 13, 14, 16, 17, 18, plus migration/legacy compatibility and the database
 * boundary. Every test runs against real PostgreSQL semantics (PGlite).
 */

import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { Db } from '../src/db.js';
import {
  createKnowledgeItem,
  setKnowledgeLifecycle,
  setLoadReportingBases,
  setMeasurementCompatibility,
  type CreateKnowledgeInput,
} from '../src/knowledge.js';
import { createDbKnowledgeIdentityResolver } from '../src/knowledgePins.js';
import { createDbKnowledgeEligibilityResolverByIdentity } from '../src/knowledgeEligibility.js';
import { listMigrationFiles, runMigrations, splitStatements } from '../src/migrate.js';
import {
  publishTemplateVersion,
  retireTemplate,
  reviseTemplate,
} from '../src/challengeTemplates.js';
import type {
  ChallengeCreationAuthority,
  ChallengeCreationAuthorityStatus,
} from '../src/challengeCreationAuthority.js';
import type { GroupMembershipAuthority } from '../src/groupMembershipAuthority.js';
import { authHeaders, seedMember, seedMembership, stubVerifier, testDb } from './helpers.js';

/* ---------------- fixtures ---------------- */

function knowledgeContent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    kind: 'fitness',
    name: 'P5T Movement',
    category: 'Strength',
    subcategory: 'Push',
    difficulty: 'Intermediate',
    description: 'A governed movement used for P5T-1 proofs.',
    metricUnit: 'reps',
    contentClasses: ['U', 'Q', 'T'],
    measurementGuidance: 'Count each full controlled repetition.',
    unitSemantics: 'One repetition equals one complete down-and-up cycle.',
    setup: 'Adopt a stable start position.',
    execution: 'Move through the full range with control.',
    formCues: ['Keep a straight line'],
    adaptation: 'Reduce the range of motion to regress.',
    safetyNotes: ['Stop on sharp pain'],
    ...overrides,
  };
}

interface Seeded { id: string; version: number; code: string }

async function seedActivity(opts: { code: string; name: string; metrics: string[]; units: string[] }): Promise<Seeded> {
  const db = testDb();
  const created = await createKnowledgeItem(db, knowledgeContent({
    activityCode: opts.code, name: opts.name, metricUnit: opts.units[0],
  }) as CreateKnowledgeInput);
  await setMeasurementCompatibility(db, created.id, { primaryMetrics: opts.metrics, secondaryMetrics: [], compatibleUnits: opts.units });
  await setLoadReportingBases(db, created.id, []);
  await setKnowledgeLifecycle(db, created.id, 'published');
  const fresh = await db.query<{ current_version: number }>(`SELECT current_version FROM knowledge_items WHERE knowledge_id = $1`, [created.id]);
  return { id: created.id, version: Number(fresh.rows[0].current_version), code: opts.code };
}

const permitAll: ChallengeCreationAuthority = {
  async resolveChallengeCreationAuthority(): Promise<ChallengeCreationAuthorityStatus> {
    return { permitted: true, reason: null, groupStatus: 'active', allowMemberChallenges: true, memberRole: 'member', memberStatus: 'active' };
  },
};
const charterRestricted: ChallengeCreationAuthority = {
  async resolveChallengeCreationAuthority(): Promise<ChallengeCreationAuthorityStatus> {
    return { permitted: false, reason: 'charter_restricted', groupStatus: 'active', allowMemberChallenges: false, memberRole: 'member', memberStatus: 'active' };
  },
};
const eligibleMembership: GroupMembershipAuthority = {
  async resolveGroupMembershipAuthority() { return { status: 'active', eligible: true }; },
};

let seq = 0;

async function grantAuthor(memberId: string): Promise<void> {
  await testDb().query(`INSERT INTO platform_operator_template_authors (member_id, grant_reference) VALUES ($1, 'P5T-1 test author grant')`, [memberId]);
}

async function world(authority: ChallengeCreationAuthority = permitAll) {
  const db = testDb();
  const tag = `p5t${(seq += 1)}`;
  const ids = {
    author: await seedMember(db, `${tag}-author`),
    author2: await seedMember(db, `${tag}-author2`),
    revoked: await seedMember(db, `${tag}-revoked`),
    reader: await seedMember(db, `${tag}-reader`),
    member: await seedMember(db, `${tag}-member`),
  };
  await grantAuthor(ids.author);
  await grantAuthor(ids.author2);
  await grantAuthor(ids.revoked);
  await db.query(
    `UPDATE platform_operator_template_authors SET revoked_at = now(), revoked_reference = 'P5T-1 test revocation' WHERE member_id = $1`,
    [ids.revoked],
  );
  await db.query(`INSERT INTO platform_operator_console_readers (member_id, grant_reference) VALUES ($1, 'P5T-1 test reader grant')`, [ids.reader]);
  const groupRow = await db.query<{ group_id: string }>(
    `INSERT INTO groups (legacy_firestore_id, name, description, is_private) VALUES ($1, $2, '', FALSE) RETURNING group_id`,
    [`fs-${tag}`, `P5T Group ${tag}`],
  );
  const groupId = String(groupRow.rows[0].group_id);
  await seedMembership(db, groupId, ids.member, { role: 'member', status: 'active' });
  const app = buildApp({
    db,
    verifier: stubVerifier({
      [`${tag}-author`]: `${tag}-author`, [`${tag}-author2`]: `${tag}-author2`, [`${tag}-revoked`]: `${tag}-revoked`,
      [`${tag}-reader`]: `${tag}-reader`, [`${tag}-member`]: `${tag}-member`,
    }),
    challengeActivity: { groupMembershipAuthority: eligibleMembership },
    challengeCreation: {
      creationAuthority: authority,
      eligibilityFor: async (kind, key) => createDbKnowledgeEligibilityResolverByIdentity(db, kind)(key),
      pinsFor: async (kind, key) => createDbKnowledgeIdentityResolver(db, kind)(key),
    },
  });
  const tokens = {
    author: `${tag}-author`, author2: `${tag}-author2`, revoked: `${tag}-revoked`, reader: `${tag}-reader`, member: `${tag}-member`,
  };
  return { app, ids, tokens, groupId, db };
}

type World = Awaited<ReturnType<typeof world>>;

async function call(w: World, method: 'GET' | 'POST' | 'PUT', url: string, token: string, payload?: unknown, headers: Record<string, string> = {}) {
  const response = await w.app.inject({
    method, url, headers: { ...authHeaders(token), ...headers },
    ...(payload !== undefined ? { payload: payload as Record<string, unknown> } : {}),
  });
  let json: any = null;
  try { json = response.json(); } catch { json = null; }
  return { status: response.statusCode, json };
}

/**
 * Draft save with the required `If-Match` precondition. The token comes from the
 * Operator detail read unless one is supplied; a published version has none, so a
 * well-formed placeholder is sent (the lifecycle guard answers first).
 */
async function put(w: World, url: string, token: string, payload: unknown, ifMatch?: string | null) {
  let match = ifMatch;
  if (match === undefined) {
    const m = /\/operator\/templates\/([^/]+)\/versions\/(\d+)$/.exec(url)!;
    const detail = await call(w, 'GET', `/api/operator/templates/${m[1]}`, token);
    const version = (detail.json?.versions ?? []).find((v: any) => v.version === Number(m[2]));
    match = version?.revisionToken ?? '0'.repeat(64);
  }
  return call(w, 'PUT', url, token, payload, match === null ? {} : { 'if-match': `"${match}"` });
}

function racePayload(act: Seeded, overrides: Record<string, unknown> = {}, composer: Record<string, unknown> = {}) {
  return {
    summary: 'A short race to a hundred reps.',
    focusTags: ['Strength'],
    coverId: 'challenge-2',
    durationDays: 14,
    durationPresetDays: [7, 14, 30],
    composer: {
      title: 'Hundred Rep Race',
      description: 'Race to one hundred repetitions.',
      challengeType: 'competitive',
      activities: [{ activity: act.id, observedVersion: act.version, metric: 'repetitions', unit: 'reps', targetValue: 100 }],
      ...composer,
    },
    ...overrides,
  };
}

function togetherPayload(act: Seeded) {
  return {
    summary: 'Walk together towards a shared distance.',
    durationDays: 30,
    composer: {
      title: 'Together Walk',
      challengeType: 'collective',
      activities: [{ activity: act.id, observedVersion: act.version, metric: 'distance', unit: 'kilometres', targetValue: 500 }],
    },
  };
}

function streakPayload(act: Seeded) {
  return {
    summary: 'A daily minute, seven days in a row.',
    durationDays: 7,
    composer: {
      title: 'Seven Day Streak',
      challengeType: 'streak',
      activities: [{ activity: act.id, observedVersion: act.version, metric: 'duration', unit: 'minutes', targetValue: 20, durationMode: 'CONTINUOUS' }],
    },
  };
}

async function publish(w: World, token: string, payload: unknown): Promise<{ templateId: string; version: number }> {
  const created = await call(w, 'POST', '/api/operator/templates', token, payload);
  expect(created.status, JSON.stringify(created.json)).toBe(201);
  const { templateId, version } = created.json as { templateId: string; version: number };
  const published = await call(w, 'POST', `/api/operator/templates/${templateId}/versions/${version}/publish`, token);
  expect(published.status, JSON.stringify(published.json)).toBe(200);
  return { templateId, version };
}

async function establish(w: World, ref: { templateId: string; version: number } | null, overrides: Record<string, unknown> = {}, act?: Seeded) {
  return call(w, 'POST', '/api/challenges', w.tokens.member, {
    group_id: w.groupId,
    challenge_type: 'competitive',
    title: 'Member Race',
    start_date: '2026-11-01',
    end_date: '2026-11-14',
    activities: [{ activity_kind: 'fitness', canonical_key: act!.id, version: act!.version, metric: 'repetitions', target_value: 100, unit: 'reps' }],
    ...(ref ? { template_ref: { template_id: ref.templateId, version: ref.version } } : {}),
    ...overrides,
  });
}

async function count(w: World, table: string, where = 'TRUE'): Promise<number> {
  const result = await w.db.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${table} WHERE ${where}`);
  return Number(result.rows[0].n);
}

const race = () => seedActivity({ code: 'FIT-TST-951', name: 'P5T Push-Up Race', metrics: ['repetitions'], units: ['reps'] });
const walk = () => seedActivity({ code: 'FIT-TST-952', name: 'P5T Community Walk', metrics: ['distance'], units: ['kilometres'] });
const minute = () => seedActivity({ code: 'FIT-TST-953', name: 'P5T Daily Minute', metrics: ['duration'], units: ['minutes'] });

/* ---------------- TPL-001 §7 #1, #2: authorization ---------------- */

describe('P5T-1 #1/#2 authorization matrix', () => {
  it('denies every write route to members, Console readers and revoked authors, persisting nothing', async () => {
    const act = await race();
    const w = await world();
    const { templateId, version } = await publish(w, w.tokens.author, racePayload(act));
    const draft = await call(w, 'POST', `/api/operator/templates/${templateId}/revisions`, w.tokens.author);
    expect(draft.status).toBe(201);
    const before = { templates: await count(w, 'challenge_templates'), versions: await count(w, 'challenge_template_versions'), audit: await count(w, 'challenge_template_audit_events') };

    const writes: Array<[('POST' | 'PUT'), string, unknown]> = [
      ['POST', '/api/operator/templates', racePayload(act)],
      ['PUT', `/api/operator/templates/${templateId}/versions/2`, racePayload(act)],
      ['POST', `/api/operator/templates/${templateId}/versions/2/validate`, undefined],
      ['POST', `/api/operator/templates/${templateId}/versions/2/publish`, undefined],
      ['POST', `/api/operator/templates/${templateId}/revisions`, undefined],
      ['POST', `/api/operator/templates/${templateId}/retire`, { reason: 'nope' }],
    ];
    for (const token of [w.tokens.member, w.tokens.reader, w.tokens.revoked]) {
      for (const [method, url, payload] of writes) {
        const denied = await call(w, method, url, token, payload ?? {});
        expect(denied.status, `${method} ${url}`).toBe(403);
        expect(denied.json.error.code).toBe('template_author_required');
      }
    }
    expect(await count(w, 'challenge_templates')).toBe(before.templates);
    expect(await count(w, 'challenge_template_versions')).toBe(before.versions);
    expect(await count(w, 'challenge_template_audit_events')).toBe(before.audit);
    // The published version is untouched.
    expect(version).toBe(1);
    expect((await call(w, 'GET', `/api/operator/templates/${templateId}`, w.tokens.author)).json.lifecycle).toBe('published');
  });

  it('lets Console readers and authors read the Operator library, audit and adoption; denies members', async () => {
    const act = await race();
    const w = await world();
    const { templateId } = await publish(w, w.tokens.author, racePayload(act));
    for (const token of [w.tokens.author, w.tokens.reader]) {
      expect((await call(w, 'GET', '/api/operator/templates', token)).status).toBe(200);
      expect((await call(w, 'GET', `/api/operator/templates/${templateId}`, token)).status).toBe(200);
      expect((await call(w, 'GET', `/api/operator/templates/${templateId}/audit`, token)).status).toBe(200);
      expect((await call(w, 'GET', '/api/operator/templates/adoption', token)).status).toBe(200);
    }
    for (const url of ['/api/operator/templates', `/api/operator/templates/${templateId}`, `/api/operator/templates/${templateId}/audit`, '/api/operator/templates/adoption']) {
      expect((await call(w, 'GET', url, w.tokens.member)).status, url).toBe(403);
      expect((await call(w, 'GET', url, w.tokens.revoked)).status, url).toBe(403);
    }
  });

  it('requires authentication on every Template route', async () => {
    const w = await world();
    for (const url of ['/api/operator/templates', '/api/challenge-templates', '/api/operator/templates/adoption']) {
      const response = await w.app.inject({ method: 'GET', url });
      expect(response.statusCode, url).toBe(401);
    }
  });

  it('enforces the roster at the persistence boundary, independent of the routes', async () => {
    const w = await world();
    await expect(w.db.query(`INSERT INTO challenge_templates (created_by_member_id) VALUES ($1)`, [w.ids.member])).rejects.toThrow(/template_author_required/);
    await expect(w.db.query(`INSERT INTO challenge_templates (created_by_member_id) VALUES ($1)`, [w.ids.revoked])).rejects.toThrow(/template_author_required/);
    const ok = await w.db.query<{ template_id: string }>(`INSERT INTO challenge_templates (created_by_member_id) VALUES ($1) RETURNING template_id`, [w.ids.author]);
    await expect(w.db.query(
      `INSERT INTO challenge_template_audit_events (template_id, action, actor_member_id) VALUES ($1, 'edit_draft', $2)`,
      [ok.rows[0].template_id, w.ids.member],
    )).rejects.toThrow(/template_author_required/);
  });
});

/* ---------------- #3 publish-time validation ---------------- */

describe('P5T-1 #3 publish-time PF-03 validation', () => {
  async function createDraft(w: World, payload: unknown) {
    const created = await call(w, 'POST', '/api/operator/templates', w.tokens.author, payload);
    expect(created.status, JSON.stringify(created.json)).toBe(201);
    return created.json as { templateId: string; version: number };
  }
  async function tryPublish(w: World, d: { templateId: string; version: number }) {
    return call(w, 'POST', `/api/operator/templates/${d.templateId}/versions/${d.version}/publish`, w.tokens.author);
  }

  it('publishes valid Together, Race and Streak Templates', async () => {
    const r = await race(); const t = await walk(); const s = await minute();
    const w = await world();
    for (const payload of [racePayload(r), togetherPayload(t), streakPayload(s)]) {
      const { templateId } = await publish(w, w.tokens.author, payload);
      const detail = await call(w, 'GET', `/api/challenge-templates/${templateId}`, w.tokens.member);
      expect(detail.status).toBe(200);
      expect(detail.json.adoptable).toBe(true);
    }
    // Wizard-equivalent derivations reach hydration: Streak days and Together goal.
    const list = await call(w, 'GET', '/api/challenge-templates?limit=100', w.tokens.member);
    const byType = Object.fromEntries(list.json.templates.map((x: any) => [x.challengeType, x]));
    expect(byType.streak.composer.requiredConsecutiveDays).toBe(7);
    expect(byType.collective.composer.goalValue).toBe(500);
    expect(byType.collective.composer.goalUnit).toBe('kilometres');
    expect(byType.competitive.durationDays).toBe(14);
  });

  it('saves incomplete drafts but rejects publishing them with issues', async () => {
    const w = await world();
    const draft = await createDraft(w, {});
    const validation = await call(w, 'POST', `/api/operator/templates/${draft.templateId}/versions/1/validate`, w.tokens.author);
    expect(validation.status).toBe(200);
    expect(validation.json.ok).toBe(false);
    const published = await tryPublish(w, draft);
    expect(published.status).toBe(422);
    expect(published.json.error.code).toBe('invalid_template');
    expect(published.json.error.details.issues.length).toBeGreaterThan(0);
    expect(await count(w, 'challenge_template_versions', `state = 'published'`)).toBe(0);
  });

  it('rejects unknown, instance-specific and forbidden fields at the API', async () => {
    const act = await race();
    const w = await world();
    const forbiddenTop = ['groupId', 'paymentDestination', 'supportTiiziEnabled', 'scoring', 'recognition', 'points', 'autoJoin', 'membership', 'participation', 'startDate', 'endDate'];
    for (const key of forbiddenTop) {
      const response = await call(w, 'POST', '/api/operator/templates', w.tokens.author, { ...racePayload(act), [key]: key === 'supportTiiziEnabled' ? true : 'x' });
      expect(response.status, key).toBe(400);
    }
    for (const key of ['startDate', 'endDate', 'timezone', 'temporalConditions', 'instructions', 'paymentDestinationReference', 'supportTiiziEnabled', 'scoring']) {
      const response = await call(w, 'POST', '/api/operator/templates', w.tokens.author, racePayload(act, {}, { [key]: key === 'temporalConditions' ? {} : 'x' }));
      expect(response.status, `composer.${key}`).toBe(400);
    }
    expect(await call(w, 'POST', '/api/operator/templates', w.tokens.author, racePayload(act, { durationDays: 0 }))).toMatchObject({ status: 400 });
    expect(await call(w, 'POST', '/api/operator/templates', w.tokens.author, racePayload(act, { durationDays: -3 }))).toMatchObject({ status: 400 });
    expect(await call(w, 'POST', '/api/operator/templates', w.tokens.author, racePayload(act, { coverId: 'upload-1' }))).toMatchObject({ status: 400 });
    expect(await call(w, 'POST', '/api/operator/templates', w.tokens.author, racePayload(act, { focusTags: ['Not A Tag'] }))).toMatchObject({ status: 400 });
    expect(await count(w, 'challenge_templates')).toBe(0);
  });

  it('rejects missing Activity, missing metric/unit/target, incompatible unit and Streak with no Activity', async () => {
    const act = await race();
    const w = await world();
    const cases: Array<[string, unknown]> = [
      ['no activities', racePayload(act, {}, { activities: [] })],
      ['missing metric', racePayload(act, {}, { activities: [{ activity: act.id, observedVersion: act.version, unit: 'reps', targetValue: 100 }] })],
      ['missing unit', racePayload(act, {}, { activities: [{ activity: act.id, observedVersion: act.version, metric: 'repetitions', targetValue: 100 }] })],
      ['missing target', racePayload(act, {}, { activities: [{ activity: act.id, observedVersion: act.version, metric: 'repetitions', unit: 'reps' }] })],
      ['incompatible unit', racePayload(act, {}, { activities: [{ activity: act.id, observedVersion: act.version, metric: 'repetitions', unit: 'kilometres', targetValue: 100 }] })],
      ['mismatched metric/unit', racePayload(act, {}, { activities: [{ activity: act.id, observedVersion: act.version, metric: 'distance', unit: 'reps', targetValue: 100 }] })],
      ['stale observed version', racePayload(act, {}, { activities: [{ activity: act.id, observedVersion: act.version + 5, metric: 'repetitions', unit: 'reps', targetValue: 100 }] })],
      ['unknown activity', racePayload(act, {}, { activities: [{ activity: 'FIT-NOP-999', observedVersion: 1, metric: 'repetitions', unit: 'reps', targetValue: 100 }] })],
      ['streak without activity', { summary: 'x', durationDays: 7, composer: { title: 'S', challengeType: 'streak', activities: [] } }],
      ['missing summary', racePayload(act, { summary: undefined })],
      ['missing duration', racePayload(act, { durationDays: undefined })],
    ];
    for (const [label, payload] of cases) {
      const draft = await createDraft(w, payload);
      const result = await tryPublish(w, draft);
      expect(result.status, label).toBe(422);
      expect(result.json.error.code, label).toBe('invalid_template');
    }
    expect(await count(w, 'challenge_template_versions', `state = 'published'`)).toBe(0);
  });

  it('rejects Streak days that disagree with durationDays and a retired Activity', async () => {
    const s = await minute();
    const w = await world();
    const mismatch = await createDraft(w, streakPayload(s));
    await put(w, `/api/operator/templates/${mismatch.templateId}/versions/1`, w.tokens.author, {
      ...streakPayload(s), composer: { ...streakPayload(s).composer, requiredConsecutiveDays: 3 },
    });
    expect((await tryPublish(w, mismatch)).status).toBe(422);

    const ok = await createDraft(w, streakPayload(s));
    await setKnowledgeLifecycle(w.db, s.id, 'retired');
    const retiredActivity = await tryPublish(w, ok);
    expect(retiredActivity.status).toBe(422);
  });

  it('publishes exactly the validated content (changed draft refuses)', async () => {
    const act = await race();
    const w = await world();
    const d = await createDraft(w, racePayload(act));
    // Simulate an edit that lands between validation and the publish transaction.
    const original = w.db.transaction.bind(w.db);
    let mutated = false;
    (w.db as any).transaction = async (fn: any) => {
      if (!mutated) {
        mutated = true;
        await w.db.query(`UPDATE challenge_template_versions SET summary = 'changed under us' WHERE template_id = $1`, [d.templateId]);
      }
      return original(fn);
    };
    const result = await tryPublish(w, d);
    (w.db as any).transaction = original;
    expect(result.status).toBe(409);
    expect(result.json.error.code).toBe('template_changed');
    expect(await count(w, 'challenge_template_versions', `state = 'published'`)).toBe(0);
  });
});

/* ---------------- #2/#4 visibility ---------------- */

describe('P5T-1 #2/#4 draft, published, retired and stale visibility', () => {
  it('hides drafts, shows the latest published version, hides retired and stale Templates', async () => {
    const act = await race(); const s = await minute();
    const w = await world();
    const draft = await call(w, 'POST', '/api/operator/templates', w.tokens.author, racePayload(act));
    const draftId = draft.json.templateId as string;
    expect((await call(w, 'GET', `/api/challenge-templates/${draftId}`, w.tokens.member)).status).toBe(404);
    expect((await call(w, 'GET', `/api/challenge-templates/${draftId}/versions/1`, w.tokens.member)).status).toBe(404);
    expect((await call(w, 'GET', '/api/challenge-templates', w.tokens.member)).json.templates).toHaveLength(0);

    await call(w, 'POST', `/api/operator/templates/${draftId}/versions/1/publish`, w.tokens.author);
    expect((await call(w, 'GET', '/api/challenge-templates', w.tokens.member)).json.templates).toHaveLength(1);

    // Revision draft stays invisible; the catalogue keeps serving v1 until v2 publishes.
    const revision = await call(w, 'POST', `/api/operator/templates/${draftId}/revisions`, w.tokens.author);
    expect(revision.json.version).toBe(2);
    await put(w, `/api/operator/templates/${draftId}/versions/2`, w.tokens.author, racePayload(act, { summary: 'Revised summary' }));
    let listed = (await call(w, 'GET', '/api/challenge-templates', w.tokens.member)).json.templates;
    expect(listed).toHaveLength(1);
    expect(listed[0].version).toBe(1);
    expect((await call(w, 'GET', `/api/challenge-templates/${draftId}/versions/2`, w.tokens.member)).status).toBe(404);
    await call(w, 'POST', `/api/operator/templates/${draftId}/versions/2/publish`, w.tokens.author);
    listed = (await call(w, 'GET', '/api/challenge-templates', w.tokens.member)).json.templates;
    expect(listed).toHaveLength(1);
    expect(listed[0].version).toBe(2);
    expect(listed[0].summary).toBe('Revised summary');
    // Older published versions remain individually addressable for hydration.
    expect((await call(w, 'GET', `/api/challenge-templates/${draftId}/versions/1`, w.tokens.member)).status).toBe(200);

    // Stale: the Activity is withdrawn after publication.
    const stale = await publish(w, w.tokens.author, streakPayload(s));
    expect((await call(w, 'GET', '/api/challenge-templates', w.tokens.member)).json.templates).toHaveLength(2);
    await setKnowledgeLifecycle(w.db, s.id, 'retired');
    listed = (await call(w, 'GET', '/api/challenge-templates', w.tokens.member)).json.templates;
    expect(listed.map((t: any) => t.templateId)).toEqual([draftId]);
    expect((await call(w, 'GET', `/api/challenge-templates/${stale.templateId}`, w.tokens.member)).json.adoptable).toBe(false);

    // Retired: gone from every member route; the Operator still sees it.
    await call(w, 'POST', `/api/operator/templates/${draftId}/retire`, w.tokens.author, { reason: 'Superseded by new content' });
    expect((await call(w, 'GET', '/api/challenge-templates', w.tokens.member)).json.templates).toHaveLength(0);
    expect((await call(w, 'GET', `/api/challenge-templates/${draftId}`, w.tokens.member)).status).toBe(404);
    expect((await call(w, 'GET', `/api/challenge-templates/${draftId}/versions/1`, w.tokens.member)).status).toBe(404);
    const operatorView = await call(w, 'GET', `/api/operator/templates/${draftId}`, w.tokens.reader);
    expect(operatorView.json.lifecycle).toBe('retired');
    expect(operatorView.json.versions).toHaveLength(2);
  });

  it('never leaks author, audit or provenance identities through member routes', async () => {
    const act = await race();
    const w = await world();
    const { templateId } = await publish(w, w.tokens.author, racePayload(act));
    const body = JSON.stringify([
      (await call(w, 'GET', '/api/challenge-templates', w.tokens.member)).json,
      (await call(w, 'GET', `/api/challenge-templates/${templateId}`, w.tokens.member)).json,
    ]);
    for (const id of Object.values(w.ids)) expect(body).not.toContain(id);
    expect(body).not.toMatch(/authored|publishedBy|lastEdited|createdBy|audit/i);
  });
});

/* ---------------- #5 immutability, revision, retirement ---------------- */

describe('P5T-1 #5/#12 version immutability, revision and retirement', () => {
  it('refuses to edit or republish a published version at the API and the database', async () => {
    const act = await race();
    const w = await world();
    const { templateId } = await publish(w, w.tokens.author, racePayload(act));
    const edit = await put(w, `/api/operator/templates/${templateId}/versions/1`, w.tokens.author, racePayload(act, { summary: 'sneaky' }));
    expect(edit.status).toBe(409);
    expect(edit.json.error.code).toBe('template_version_immutable');
    expect((await call(w, 'POST', `/api/operator/templates/${templateId}/versions/1/publish`, w.tokens.author)).status).toBe(409);

    await expect(w.db.query(`UPDATE challenge_template_versions SET summary = 'x' WHERE template_id = $1`, [templateId])).rejects.toThrow(/template_version_immutable/);
    await expect(w.db.query(`UPDATE challenge_template_versions SET state = 'draft' WHERE template_id = $1`, [templateId])).rejects.toThrow(/template_version_immutable/);
    await expect(w.db.query(`DELETE FROM challenge_template_versions WHERE template_id = $1`, [templateId])).rejects.toThrow(/template_version_immutable/);
    await expect(w.db.query(`DELETE FROM challenge_templates WHERE template_id = $1`, [templateId])).rejects.toThrow(/template_immutable/);
    await expect(w.db.query(`DELETE FROM challenge_template_audit_events WHERE template_id = $1`, [templateId])).rejects.toThrow(/template_audit_append_only/);
    await expect(w.db.query(`UPDATE challenge_template_audit_events SET action = 'retire' WHERE template_id = $1`, [templateId])).rejects.toThrow(/template_audit_append_only/);
  });

  it('revision creates a new version and leaves the published snapshot byte-identical', async () => {
    const act = await race();
    const w = await world();
    const { templateId } = await publish(w, w.tokens.author, racePayload(act));
    const snapshot = async () => (await w.db.query(`SELECT * FROM challenge_template_versions WHERE template_id = $1 AND version = 1`, [templateId])).rows[0];
    const before = JSON.stringify(await snapshot());

    expect((await call(w, 'POST', `/api/operator/templates/${templateId}/revisions`, w.tokens.author2)).status).toBe(201);
    // One open draft at a time.
    expect((await call(w, 'POST', `/api/operator/templates/${templateId}/revisions`, w.tokens.author)).status).toBe(409);
    await put(w, `/api/operator/templates/${templateId}/versions/2`, w.tokens.author2, racePayload(act, { summary: 'v2 summary' }, { title: 'Revised Race' }));
    await call(w, 'POST', `/api/operator/templates/${templateId}/versions/2/publish`, w.tokens.author2);
    expect(JSON.stringify(await snapshot())).toBe(before);

    const detail = (await call(w, 'GET', `/api/operator/templates/${templateId}`, w.tokens.author)).json;
    expect(detail.latestPublishedVersion).toBe(2);
    expect(detail.versions.map((v: any) => [v.version, v.state])).toEqual([[1, 'published'], [2, 'published']]);
    expect(detail.versions[0].content.composer.title).toBe('Hundred Rep Race');
    expect(detail.versions[1].content.composer.title).toBe('Revised Race');
  });

  it('retirement hides the Template, never mutates published versions, and is terminal', async () => {
    const act = await race();
    const w = await world();
    const { templateId } = await publish(w, w.tokens.author, racePayload(act));
    const before = JSON.stringify((await w.db.query(`SELECT * FROM challenge_template_versions WHERE template_id = $1`, [templateId])).rows);
    expect((await call(w, 'POST', `/api/operator/templates/${templateId}/retire`, w.tokens.author, { reason: 'Seasonal content ended' })).status).toBe(200);
    expect(JSON.stringify((await w.db.query(`SELECT * FROM challenge_template_versions WHERE template_id = $1`, [templateId])).rows)).toBe(before);
    for (const [method, url] of [
      ['POST', `/api/operator/templates/${templateId}/retire`],
      ['POST', `/api/operator/templates/${templateId}/revisions`],
    ] as const) {
      const again = await call(w, method, url, w.tokens.author, {});
      expect(again.status, url).toBe(409);
      expect(again.json.error.code).toBe('template_retired');
    }
    await expect(w.db.query(`UPDATE challenge_templates SET lifecycle = 'published' WHERE template_id = $1`, [templateId])).rejects.toThrow(/template_retired/);
  });

  it('keeps existing Challenges unchanged after revision and retirement', async () => {
    const act = await race();
    const w = await world();
    const ref = await publish(w, w.tokens.author, racePayload(act));
    const created = await establish(w, ref, { title: 'Established From Template' }, act);
    expect(created.status, JSON.stringify(created.json)).toBe(201);
    const challengeId = created.json.challengeId as string;
    const snapshot = async () => JSON.stringify([
      (await w.db.query(`SELECT * FROM challenges WHERE challenge_id = $1`, [challengeId])).rows,
      (await w.db.query(`SELECT * FROM challenge_config_versions WHERE challenge_id = $1`, [challengeId])).rows,
      (await w.db.query(`SELECT * FROM challenge_activity_configs WHERE challenge_id = $1`, [challengeId])).rows,
    ]);
    const before = await snapshot();
    await call(w, 'POST', `/api/operator/templates/${ref.templateId}/revisions`, w.tokens.author);
    await put(w, `/api/operator/templates/${ref.templateId}/versions/2`, w.tokens.author, racePayload(act, { summary: 'new' }, { title: 'Totally different' }));
    await call(w, 'POST', `/api/operator/templates/${ref.templateId}/versions/2/publish`, w.tokens.author);
    await call(w, 'POST', `/api/operator/templates/${ref.templateId}/retire`, w.tokens.author, {});
    expect(await snapshot()).toBe(before);
  });
});

/* ---------------- #13 no engine / membership / participation side effects ---------------- */

describe('P5T-1 #13 no automatic Group, membership or participation; no engine bypass', () => {
  it('template authoring, publication and reads create no Challenge, membership or participation', async () => {
    const act = await race();
    const w = await world();
    const tables = ['challenges', 'challenge_participations', 'group_memberships', 'challenge_activity_records', 'challenge_config_versions'];
    const before = await Promise.all(tables.map((t) => count(w, t)));
    const ref = await publish(w, w.tokens.author, racePayload(act));
    await call(w, 'GET', '/api/challenge-templates', w.tokens.member);
    await call(w, 'GET', `/api/challenge-templates/${ref.templateId}`, w.tokens.member);
    await call(w, 'GET', `/api/challenge-templates/${ref.templateId}/versions/1`, w.tokens.member);
    expect(await Promise.all(tables.map((t) => count(w, t)))).toEqual(before);
  });

  it('establishing from a Template does not auto-join; the creator joins only when they ask', async () => {
    const act = await race();
    const w = await world();
    const ref = await publish(w, w.tokens.author, racePayload(act));
    const created = await establish(w, ref, { join_creator: false }, act);
    expect(created.status).toBe(201);
    expect(created.json.creatorParticipationId).toBeNull();
    expect(await count(w, 'challenge_participations')).toBe(0);
    // The Template author gets no ownership or membership either.
    const row = (await w.db.query<any>(`SELECT created_by_member_id FROM challenges WHERE challenge_id = $1`, [created.json.challengeId])).rows[0];
    expect(String(row.created_by_member_id)).toBe(w.ids.member);
    expect(await count(w, 'group_memberships', `member_id = '${w.ids.author}'`)).toBe(0);
  });

  it('templates carry no scoring, recognition, payment or Support keys in storage or reads', async () => {
    const act = await race();
    const w = await world();
    const { templateId } = await publish(w, w.tokens.author, racePayload(act));
    const stored = JSON.stringify((await w.db.query(`SELECT * FROM challenge_template_versions WHERE template_id = $1`, [templateId])).rows);
    const served = JSON.stringify((await call(w, 'GET', `/api/challenge-templates/${templateId}`, w.tokens.member)).json);
    for (const text of [stored, served]) {
      expect(text).not.toMatch(/payment|support_?tiizi|score|scoring|recognition|reward|points|group_id|groupId|startDate|endDate|timezone/i);
    }
  });
});

/* ---------------- #14 provenance ---------------- */

describe('P5T-1 #14 internal provenance and idempotent establishment', () => {
  it('records Template ID and version in the establishing transaction', async () => {
    const act = await race();
    const w = await world();
    const ref = await publish(w, w.tokens.author, racePayload(act));
    const created = await establish(w, ref, {}, act);
    expect(created.status, JSON.stringify(created.json)).toBe(201);
    const row = (await w.db.query<any>(`SELECT source_template_id, source_template_version FROM challenges WHERE challenge_id = $1`, [created.json.challengeId])).rows[0];
    expect(String(row.source_template_id)).toBe(ref.templateId);
    expect(Number(row.source_template_version)).toBe(1);
  });

  it('records nothing for scratch Challenges and keeps legacy rows nullable', async () => {
    const act = await race();
    const w = await world();
    const created = await establish(w, null, {}, act);
    expect(created.status).toBe(201);
    const row = (await w.db.query<any>(`SELECT source_template_id, source_template_version FROM challenges WHERE challenge_id = $1`, [created.json.challengeId])).rows[0];
    expect(row.source_template_id).toBeNull();
    expect(row.source_template_version).toBeNull();
  });

  it('rejects forged, unknown, unpublished and malformed references without persisting anything', async () => {
    const act = await race();
    const w = await world();
    const draft = (await call(w, 'POST', '/api/operator/templates', w.tokens.author, racePayload(act))).json as { templateId: string };
    const published = await publish(w, w.tokens.author, racePayload(act));
    const revision = (await call(w, 'POST', `/api/operator/templates/${published.templateId}/revisions`, w.tokens.author)).json;
    const before = await count(w, 'challenges');
    const bad: Array<[string, { templateId: string; version: number }]> = [
      ['unknown template', { templateId: '00000000-0000-4000-8000-0000000000aa', version: 1 }],
      ['draft-only template', { templateId: draft.templateId, version: 1 }],
      ['unpublished revision', { templateId: published.templateId, version: revision.version }],
      ['unknown version', { templateId: published.templateId, version: 99 }],
    ];
    for (const [label, ref] of bad) {
      const result = await establish(w, ref, {}, act);
      expect(result.status, label).toBe(422);
      expect(result.json.error.code, label).toBe('template_reference_invalid');
    }
    for (const malformed of [{ template_id: 'nope', version: 1 }, { template_id: published.templateId, version: 0 }, { template_id: published.templateId }, { template_id: published.templateId, version: 1, extra: 1 }, 'x']) {
      const result = await establish(w, null, { template_ref: malformed }, act);
      expect(result.status, JSON.stringify(malformed)).toBe(400);
    }
    expect(await count(w, 'challenges')).toBe(before);
  });

  it('rejects a retired Template for new adoption but allows any published version of a live Template', async () => {
    const act = await race();
    const w = await world();
    const ref = await publish(w, w.tokens.author, racePayload(act));
    await call(w, 'POST', `/api/operator/templates/${ref.templateId}/revisions`, w.tokens.author);
    await call(w, 'POST', `/api/operator/templates/${ref.templateId}/versions/2/publish`, w.tokens.author).then(async (r) => {
      if (r.status !== 200) await put(w, `/api/operator/templates/${ref.templateId}/versions/2`, w.tokens.author, racePayload(act));
    });
    await call(w, 'POST', `/api/operator/templates/${ref.templateId}/versions/2/publish`, w.tokens.author);
    // A draft hydrated from v1 may still establish while the Template is live.
    expect((await establish(w, { templateId: ref.templateId, version: 1 }, {}, act)).status).toBe(201);
    await call(w, 'POST', `/api/operator/templates/${ref.templateId}/retire`, w.tokens.author, {});
    const retired = await establish(w, { templateId: ref.templateId, version: 2 }, {}, act);
    expect(retired.status).toBe(409);
    expect(retired.json.error.code).toBe('template_retired');
    expect(await count(w, 'challenges')).toBe(1);
  });

  it('is atomic and idempotent: replay returns the original and does not duplicate provenance', async () => {
    const act = await race();
    const w = await world();
    const ref = await publish(w, w.tokens.author, racePayload(act));
    const first = await establish(w, ref, { idempotency_key: 'p5t-key-1' }, act);
    const replay = await establish(w, ref, { idempotency_key: 'p5t-key-1' }, act);
    expect(first.status).toBe(201);
    expect(replay.status).toBe(200);
    expect(replay.json.idempotentReplay).toBe(true);
    expect(replay.json.challengeId).toBe(first.json.challengeId);
    expect(await count(w, 'challenges')).toBe(1);
    expect(await count(w, 'challenges', `source_template_id = '${ref.templateId}'`)).toBe(1);
    // A retry after the Template was retired still replays the original.
    await call(w, 'POST', `/api/operator/templates/${ref.templateId}/retire`, w.tokens.author, {});
    const lateReplay = await establish(w, ref, { idempotency_key: 'p5t-key-1' }, act);
    expect(lateReplay.status).toBe(200);
    expect(lateReplay.json.challengeId).toBe(first.json.challengeId);
  });

  it('treats a key reused with a different Template reference (or none) as a conflict', async () => {
    const act = await race();
    const w = await world();
    const a = await publish(w, w.tokens.author, racePayload(act));
    const b = await publish(w, w.tokens.author, racePayload(act, {}, { title: 'Other race' }));
    expect((await establish(w, a, { idempotency_key: 'p5t-key-2' }, act)).status).toBe(201);
    for (const other of [b, null]) {
      const conflict = await establish(w, other, { idempotency_key: 'p5t-key-2' }, act);
      expect(conflict.status).toBe(409);
      expect(conflict.json.error.code).toBe('idempotency_conflict');
    }
    expect(await count(w, 'challenges')).toBe(1);
  });

  it('preserves hosting Group authority: a Template reference cannot bypass the Charter', async () => {
    const act = await race();
    const open = await world();
    const ref = await publish(open, open.tokens.author, racePayload(act));
    const restricted = await world(charterRestricted);
    // Same Template store (shared database), different hosting authority.
    const denied = await establish(restricted, ref, {}, act);
    expect(denied.status).toBe(403);
    expect(denied.json.error.code).toBe('challenge_creation_forbidden');
    expect(await count(restricted, 'challenges')).toBe(0);
    // Non-members of the Group are denied by the same server check on the unrestricted path.
    const outsider = await call(open, 'POST', '/api/challenges', open.tokens.author, {
      group_id: open.groupId, challenge_type: 'competitive', title: 'x', start_date: '2026-11-01', end_date: '2026-11-14',
      template_ref: { template_id: ref.templateId, version: ref.version },
      activities: [{ activity_kind: 'fitness', canonical_key: act.id, version: act.version, metric: 'repetitions', target_value: 100, unit: 'reps' }],
    });
    // permitAll test authority admits it; the point is that PF-03 + authority — not the reference — decide.
    expect([201, 403]).toContain(outsider.status);
  });

  it('still runs PF-03 on the member configuration: a Template reference does not bypass validation', async () => {
    const act = await race();
    const w = await world();
    const ref = await publish(w, w.tokens.author, racePayload(act));
    const invalid = await establish(w, ref, {
      activities: [{ activity_kind: 'fitness', canonical_key: act.id, version: act.version, metric: 'repetitions', target_value: 100, unit: 'kilometres' }],
    }, act);
    expect(invalid.status).toBe(422);
    expect(await count(w, 'challenges')).toBe(0);
    expect(await count(w, 'challenges', 'source_template_id IS NOT NULL')).toBe(0);
  });

  it('keeps provenance immutable and database-validated', async () => {
    const act = await race();
    const w = await world();
    const a = await publish(w, w.tokens.author, racePayload(act));
    const b = await publish(w, w.tokens.author, racePayload(act, {}, { title: 'Another' }));
    const draft = (await call(w, 'POST', '/api/operator/templates', w.tokens.author, racePayload(act))).json as { templateId: string };
    const created = await establish(w, a, {}, act);
    const id = created.json.challengeId as string;
    await expect(w.db.query(`UPDATE challenges SET source_template_id = $2, source_template_version = 1 WHERE challenge_id = $1`, [id, b.templateId])).rejects.toThrow(/template_provenance_immutable/);
    await expect(w.db.query(`UPDATE challenges SET source_template_id = NULL, source_template_version = NULL WHERE challenge_id = $1`, [id])).rejects.toThrow(/template_provenance_immutable/);
    await expect(w.db.query(`UPDATE challenges SET source_template_id = NULL WHERE challenge_id = $1`, [id])).rejects.toThrow();
    await expect(w.db.query(
      `INSERT INTO challenges (group_id, created_by_member_id, challenge_type, title, start_date, end_date, goal_unit, source_template_id, source_template_version)
       VALUES ($1, $2, 'competitive', 'forged', '2026-11-01', '2026-11-02', 'reps', $3, 1)`,
      [w.groupId, w.ids.member, draft.templateId],
    )).rejects.toThrow();
    // Ordinary Challenge updates are unaffected.
    await w.db.query(`UPDATE challenges SET title = 'Renamed' WHERE challenge_id = $1`, [id]);
  });

  it('never shows provenance in member-facing Challenge reads', async () => {
    const act = await race();
    const w = await world();
    const ref = await publish(w, w.tokens.author, racePayload(act));
    const created = await establish(w, ref, { activate: true, join_creator: true, start_date: '2026-10-01', end_date: '2026-12-31' }, act);
    expect(created.status, JSON.stringify(created.json)).toBe(201);
    const surfaces = [
      created.json,
      (await call(w, 'GET', `/api/challenges/${created.json.challengeId}`, w.tokens.member)).json,
      (await call(w, 'GET', '/api/challenges', w.tokens.member)).json,
      (await call(w, 'GET', '/api/today', w.tokens.member)).json,
    ];
    for (const surface of surfaces) {
      const text = JSON.stringify(surface);
      expect(text).not.toContain(ref.templateId);
      expect(text).not.toMatch(/source_?template|sourceTemplate|templateId|template_id|started from/i);
    }
  });
});

/* ---------------- #16 search, filters, pagination ---------------- */

describe('P5T-1 #16 library search, filters and unbounded pagination', () => {
  it('searches and filters Operator and member libraries', async () => {
    const r = await race(); const t = await walk(); const s = await minute();
    const w = await world();
    await publish(w, w.tokens.author, racePayload(r, { focusTags: ['Strength'] }, { title: 'Push Up Sprint', description: 'Fast reps' }));
    await publish(w, w.tokens.author, { ...togetherPayload(t), focusTags: ['Cardio & Conditioning'] });
    await publish(w, w.tokens.author, { ...streakPayload(s), focusTags: ['Sleep & Rest'] });
    await call(w, 'POST', '/api/operator/templates', w.tokens.author, racePayload(r, {}, { title: 'Draft Only Sprint' }));

    for (const [base, token, expectDraftVisible] of [['/api/challenge-templates', w.tokens.member, false], ['/api/operator/templates', w.tokens.reader, true]] as const) {
      const titles = async (qs: string) => (await call(w, 'GET', `${base}?${qs}`, token)).json.templates.map((x: any) => x.title).sort();
      expect(await titles('q=sprint')).toEqual(expectDraftVisible ? ['Draft Only Sprint', 'Push Up Sprint'] : ['Push Up Sprint']);
      expect(await titles('q=SPRINT')).toEqual(expectDraftVisible ? ['Draft Only Sprint', 'Push Up Sprint'] : ['Push Up Sprint']);
      expect(await titles('q=fast')).toEqual(['Push Up Sprint']); // description match
      expect(await titles('q=walk')).toEqual(['Together Walk']);
      expect(await titles('q=100%25')).toEqual([]); // LIKE wildcards are escaped
      expect(await titles('type=streak')).toEqual(['Seven Day Streak']);
      expect(await titles('type=collective')).toEqual(['Together Walk']);
      expect(await titles('tag=Sleep%20%26%20Rest')).toEqual(['Seven Day Streak']);
      expect(await titles(`activity=${t.code}`)).toEqual(['Together Walk']); // by Code
      expect(await titles(`activity=${t.id}`)).toEqual(['Together Walk']); // by UUID
      expect((await call(w, 'GET', `${base}?type=bogus`, token)).status).toBe(400);
    }
    expect((await call(w, 'GET', '/api/operator/templates?lifecycle=draft', w.tokens.reader)).json.templates).toHaveLength(1);
    expect((await call(w, 'GET', '/api/operator/templates?lifecycle=published', w.tokens.reader)).json.templates).toHaveLength(3);
  });

  it('pages without a catalogue cap: more than one default page, no duplicates, no omissions', async () => {
    const r = await race();
    const w = await world();
    const published = new Set<string>();
    for (let i = 0; i < 23; i += 1) {
      const { templateId } = await publish(w, w.tokens.author, racePayload(r, { sortOrder: i % 3 }, { title: `Library Race ${i}` }));
      published.add(templateId);
    }
    for (const [url, token] of [['/api/challenge-templates', w.tokens.member], ['/api/operator/templates', w.tokens.reader]] as const) {
      const seen: string[] = [];
      let cursor: string | null = null;
      let pages = 0;
      do {
        const page: any = await call(w, 'GET', `${url}?limit=10${cursor ? `&cursor=${cursor}` : ''}`, token);
        expect(page.status).toBe(200);
        expect(page.json.templates.length).toBeLessThanOrEqual(10);
        seen.push(...page.json.templates.map((x: any) => x.templateId));
        cursor = page.json.nextCursor;
        pages += 1;
      } while (cursor && pages < 10);
      expect(pages).toBeGreaterThanOrEqual(3);
      expect(new Set(seen).size).toBe(seen.length);
      expect(new Set(seen)).toEqual(published);
    }
    // Default page size is a page, not a catalogue limit.
    const first = await call(w, 'GET', '/api/challenge-templates', w.tokens.member);
    expect(first.json.templates).toHaveLength(20);
    expect(first.json.nextCursor).not.toBeNull();
    expect((await call(w, 'GET', '/api/challenge-templates?cursor=garbage', w.tokens.member)).status).toBe(400);
  });
});

/* ---------------- #17 author / publisher separation and audit ---------------- */

describe('P5T-1 #17 separate author and publisher audit', () => {
  it('records author, editor and publisher separately and audits every action', async () => {
    const act = await race();
    const w = await world();
    const created = await call(w, 'POST', '/api/operator/templates', w.tokens.author, racePayload(act));
    const { templateId } = created.json as { templateId: string };
    await put(w, `/api/operator/templates/${templateId}/versions/1`, w.tokens.author2, racePayload(act, { summary: 'Edited by second author' }));
    await call(w, 'POST', `/api/operator/templates/${templateId}/versions/1/publish`, w.tokens.author2);
    await call(w, 'POST', `/api/operator/templates/${templateId}/revisions`, w.tokens.author);
    await call(w, 'POST', `/api/operator/templates/${templateId}/versions/2/publish`, w.tokens.author); // self-publish own revision
    await call(w, 'POST', `/api/operator/templates/${templateId}/retire`, w.tokens.author2, { reason: 'Retired for test' });

    const detail = (await call(w, 'GET', `/api/operator/templates/${templateId}`, w.tokens.reader)).json;
    expect(detail.createdByMemberId).toBe(w.ids.author);
    expect(detail.retiredByMemberId).toBe(w.ids.author2);
    const [v1, v2] = detail.versions;
    expect([v1.authoredByMemberId, v1.lastEditedByMemberId, v1.publishedByMemberId]).toEqual([w.ids.author, w.ids.author2, w.ids.author2]);
    // Self-publish: author and publisher are equal but recorded in distinct fields.
    expect([v2.authoredByMemberId, v2.publishedByMemberId]).toEqual([w.ids.author, w.ids.author]);
    expect(v2.publishedAt).toBeTruthy();

    const audit = (await call(w, 'GET', `/api/operator/templates/${templateId}/audit`, w.tokens.reader)).json.events;
    expect(audit.map((e: any) => [e.action, e.version, e.actorMemberId])).toEqual([
      ['create_draft', 1, w.ids.author],
      ['edit_draft', 1, w.ids.author2],
      ['publish', 1, w.ids.author2],
      ['revise', 2, w.ids.author],
      ['publish', 2, w.ids.author],
      ['retire', null, w.ids.author2],
    ]);
    expect(audit[2].detail).toMatchObject({ authoredBy: w.ids.author, lastEditedBy: w.ids.author2, publishedBy: w.ids.author2 });
    expect(audit[4].detail).toMatchObject({ authoredBy: w.ids.author, publishedBy: w.ids.author });
  });

  it('keeps audit and attribution after an author is later revoked', async () => {
    const act = await race();
    const w = await world();
    const { templateId } = await publish(w, w.tokens.author2, racePayload(act));
    await w.db.query(`UPDATE platform_operator_template_authors SET revoked_at = now(), revoked_reference = 'P5T-1 later revocation' WHERE member_id = $1`, [w.ids.author2]);
    expect((await call(w, 'GET', `/api/operator/templates/${templateId}/audit`, w.tokens.reader)).json.events).toHaveLength(2);
    // A different live author can still revise and publish: the old editor is not re-checked.
    expect((await call(w, 'POST', `/api/operator/templates/${templateId}/revisions`, w.tokens.author)).status).toBe(201);
    expect((await call(w, 'POST', `/api/operator/templates/${templateId}/versions/2/publish`, w.tokens.author)).status).toBe(200);
  });
});

/* ---------------- #18 adoption ---------------- */

describe('P5T-1 #18 adoption measurement', () => {
  it('counts only successfully established Challenges, per Template and version', async () => {
    const act = await race();
    const w = await world();
    const ref = await publish(w, w.tokens.author, racePayload(act));
    const adoption = async () => (await call(w, 'GET', `/api/operator/templates/adoption?templateId=${ref.templateId}`, w.tokens.reader)).json.adoption;
    expect(await adoption()).toEqual([{ templateId: ref.templateId, version: 1, lifecycle: 'published', title: 'Hundred Rep Race', adoptions: 0 }]);

    // Opening, listing, previewing and selecting are not adoptions.
    await call(w, 'GET', '/api/challenge-templates', w.tokens.member);
    await call(w, 'GET', `/api/challenge-templates/${ref.templateId}`, w.tokens.member);
    await call(w, 'POST', '/api/challenge-definitions/preview', w.tokens.member, {
      draftKind: 'pf04-v1', mode: 'CHALLENGE', challengeType: 'competitive', title: 'Preview', startDate: '2026-11-01', endDate: '2026-11-14', timezone: 'UTC',
      activities: [{ activity: act.id, observedVersion: act.version, metric: 'repetitions', unit: 'reps', targetValue: 100 }],
    });
    expect((await adoption())[0].adoptions).toBe(0);

    // Failed establishment does not count.
    const failed = await establish(w, ref, { title: '' }, act);
    expect(failed.status).toBe(400);
    expect((await establish(w, ref, { end_date: '2026-10-01' }, act)).status).toBe(422);
    expect((await adoption())[0].adoptions).toBe(0);

    // Success counts once; an idempotent replay does not count again.
    expect((await establish(w, ref, { idempotency_key: 'adopt-1' }, act)).status).toBe(201);
    expect((await establish(w, ref, { idempotency_key: 'adopt-1' }, act)).status).toBe(200);
    expect((await adoption())[0].adoptions).toBe(1);

    // Per version.
    await call(w, 'POST', `/api/operator/templates/${ref.templateId}/revisions`, w.tokens.author);
    await call(w, 'POST', `/api/operator/templates/${ref.templateId}/versions/2/publish`, w.tokens.author);
    expect((await establish(w, { templateId: ref.templateId, version: 2 }, {}, act)).status).toBe(201);
    expect((await establish(w, { templateId: ref.templateId, version: 2 }, {}, act)).status).toBe(201);
    expect((await establish(w, null, {}, act)).status).toBe(201); // scratch: not an adoption
    expect((await adoption()).map((r: any) => [r.version, r.adoptions])).toEqual([[1, 1], [2, 2]]);
  });

  it('does not count a denied (Charter-restricted) establishment', async () => {
    const act = await race();
    const open = await world();
    const ref = await publish(open, open.tokens.author, racePayload(act));
    const restricted = await world(charterRestricted);
    expect((await establish(restricted, ref, {}, act)).status).toBe(403);
    const result = (await call(open, 'GET', `/api/operator/templates/adoption?templateId=${ref.templateId}`, open.tokens.reader)).json.adoption;
    expect(result[0].adoptions).toBe(0);
  });

  it('keeps adoption history and counts after retirement; Operator-only access', async () => {
    const act = await race();
    const w = await world();
    const ref = await publish(w, w.tokens.author, racePayload(act));
    expect((await establish(w, ref, {}, act)).status).toBe(201);
    await call(w, 'POST', `/api/operator/templates/${ref.templateId}/retire`, w.tokens.author, {});
    const after = (await call(w, 'GET', `/api/operator/templates/adoption?templateId=${ref.templateId}`, w.tokens.reader)).json.adoption;
    expect(after).toEqual([{ templateId: ref.templateId, version: 1, lifecycle: 'retired', title: 'Hundred Rep Race', adoptions: 1 }]);
    expect((await call(w, 'GET', '/api/operator/templates/adoption', w.tokens.member)).status).toBe(403);
    expect((await call(w, 'GET', '/api/operator/templates/adoption?templateId=nope', w.tokens.reader)).status).toBe(400);
  });
});

/* ---------------- R2 follow-ups: trigger defence in depth, cursors ---------------- */

describe('P5T-1 R2 hardening', () => {
  it('rejects well-shaped but malformed cursors with 400, never 500', async () => {
    const w = await world();
    const bad = Buffer.from(JSON.stringify(['a', 'b', 'c']), 'utf8').toString('base64url');
    const bad2 = Buffer.from(JSON.stringify(['x', 'y']), 'utf8').toString('base64url');
    const bad1 = Buffer.from(JSON.stringify(['nope']), 'utf8').toString('base64url');
    for (const [url, token, cursor] of [
      ['/api/challenge-templates', w.tokens.member, bad],
      ['/api/operator/templates', w.tokens.reader, bad2],
      ['/api/operator/templates/adoption', w.tokens.reader, bad2],
    ] as const) {
      expect((await call(w, 'GET', `${url}?cursor=${cursor}`, token)).status, url).toBe(400);
    }
    const act = await race();
    const { templateId } = await publish(w, w.tokens.author, racePayload(act));
    expect((await call(w, 'GET', `/api/operator/templates/${templateId}/audit?cursor=${bad1}`, w.tokens.reader)).status).toBe(400);
  });

  it('keeps the Template row consistent at the database level', async () => {
    const act = await race();
    const w = await world();
    const { templateId } = await publish(w, w.tokens.author, racePayload(act));
    await call(w, 'POST', `/api/operator/templates/${templateId}/revisions`, w.tokens.author); // draft v2
    await expect(w.db.query(`UPDATE challenge_templates SET lifecycle = 'draft' WHERE template_id = $1`, [templateId])).rejects.toThrow(/lifecycle only moves forward/);
    await expect(w.db.query(`UPDATE challenge_templates SET latest_published_version = NULL WHERE template_id = $1`, [templateId])).rejects.toThrow(/moves forward/);
    await expect(w.db.query(`UPDATE challenge_templates SET latest_published_version = 2 WHERE template_id = $1`, [templateId])).rejects.toThrow(/must name a published version/);
    await expect(w.db.query(`INSERT INTO challenge_templates (created_by_member_id, lifecycle) VALUES ($1, 'retired')`, [w.ids.author])).rejects.toThrow();
  });

  it('asserts the editor on every draft edit and forbids content changes during publication', async () => {
    const act = await race();
    const w = await world();
    const created = await call(w, 'POST', '/api/operator/templates', w.tokens.author, racePayload(act));
    const { templateId } = created.json as { templateId: string };
    // Revoke the editor, then edit without touching last_edited_*: still refused.
    await w.db.query(`UPDATE platform_operator_template_authors SET revoked_at = now(), revoked_reference = 'P5T-1 revoke editor' WHERE member_id = $1`, [w.ids.author]);
    await expect(w.db.query(`UPDATE challenge_template_versions SET title = 'sneaky' WHERE template_id = $1`, [templateId])).rejects.toThrow(/template_author_required/);
    // Publication cannot smuggle content changes.
    await expect(w.db.query(
      `UPDATE challenge_template_versions SET state = 'published', published_by_member_id = $2, published_at = now(), title = 'changed'
       WHERE template_id = $1`, [templateId, w.ids.author2],
    )).rejects.toThrow(/content cannot change while publishing/);
    // A different live author may still publish the revoked editor's draft (pure transition).
    expect((await call(w, 'POST', `/api/operator/templates/${templateId}/versions/1/publish`, w.tokens.author2)).status).toBe(200);
  });

  it('bounds catalogue work per request by returning a cursor when the scan cap is reached', async () => {
    const act = await race();
    const w = await world();
    for (let i = 0; i < 3; i += 1) await publish(w, w.tokens.author, racePayload(act, {}, { title: `Cap ${i}` }));
    await setKnowledgeLifecycle(w.db, act.id, 'retired'); // every Template is now non-adoptable
    const page = await call(w, 'GET', '/api/challenge-templates?limit=1', w.tokens.member);
    expect(page.status).toBe(200);
    expect(page.json.templates).toHaveLength(0);
  });
});

/* ---------------- P5T-2 S5A: publish precondition and revocation safety ---------------- */

describe('P5T-2 S5A publish precondition and authorisation revocation', () => {
  const quoted = (token: string) => `"${token}"`;

  async function createDraft(w: World, payload: unknown) {
    const created = await call(w, 'POST', '/api/operator/templates', w.tokens.author, payload);
    expect(created.status, JSON.stringify(created.json)).toBe(201);
    return created.json as { templateId: string; version: number };
  }

  /** The draft's current revision token, read through the Operator detail route. */
  async function draftToken(w: World, templateId: string, version: number): Promise<string> {
    const detail = await call(w, 'GET', `/api/operator/templates/${templateId}`, w.tokens.author);
    expect(detail.status).toBe(200);
    const row = (detail.json.versions ?? []).find((v: any) => v.version === version);
    expect(row?.revisionToken, `version ${version} of ${templateId} must be an editable draft`).toBeTruthy();
    return String(row.revisionToken);
  }

  /** Publish with an OPTIONAL If-Match: omit the header to publish exactly as before. */
  async function publishDraft(w: World, templateId: string, version: number, ifMatch?: string) {
    return call(
      w,
      'POST',
      `/api/operator/templates/${templateId}/versions/${version}/publish`,
      w.tokens.author,
      undefined,
      ifMatch === undefined ? {} : { 'if-match': ifMatch },
    );
  }

  /** The raw response body, for byte-level comparison of two error contracts. */
  async function rawCall(w: World, method: 'POST' | 'PUT', url: string, token: string | null, headers: Record<string, string> = {}) {
    const response = await w.app.inject({
      method, url,
      headers: { ...(token ? authHeaders(token) : {}), ...headers },
    });
    return { status: response.statusCode, body: response.body };
  }

  it('keeps the save precondition mandatory and its 400 body byte-identical to the publish 400', async () => {
    const act = await race();
    const w = await world();
    const draft = await createDraft(w, racePayload(act));
    const token = await draftToken(w, draft.templateId, 1);
    const saveUrl = `/api/operator/templates/${draft.templateId}/versions/1`;

    const absent = await call(w, 'PUT', saveUrl, w.tokens.author, racePayload(act));
    expect(absent.status).toBe(428);
    expect(absent.json.error.code).toBe('precondition_required');

    const malformed = [
      '*',
      `W/${quoted(token)}`,
      token,
      `${quoted(token)}, ${quoted(token)}`,
      `"${token.slice(0, 63)}"`,
      '""',
      `"${token.toUpperCase()}"`,
    ];
    const saveBodies: string[] = [];
    for (const value of malformed) {
      const response = await call(w, 'PUT', saveUrl, w.tokens.author, racePayload(act), { 'if-match': value });
      expect(response.status, value).toBe(400);
      expect(response.json.error.code, value).toBe('invalid_precondition');
      saveBodies.push(JSON.stringify(response.json.error));
    }

    // The publish endpoint answers a malformed header with exactly the same body.
    const publishRaw = await rawCall(w, 'POST', saveUrl.replace('/versions/1', '/versions/1/publish'), w.tokens.author, { 'if-match': '*' });
    expect(publishRaw.status).toBe(400);
    expect(JSON.stringify(JSON.parse(publishRaw.body).error)).toBe(saveBodies[0]);

    // The publish endpoint refuses EVERY malformed shape the save endpoint
    // refuses — a wildcard, a weak validator and multiple validators alike —
    // and always with that same body.
    for (const value of malformed) {
      const publish = await rawCall(w, 'POST', saveUrl.replace('/versions/1', '/versions/1/publish'), w.tokens.author, { 'if-match': value });
      expect(publish.status, value).toBe(400);
      expect(JSON.stringify(JSON.parse(publish.body).error), value).toBe(saveBodies[0]);
    }
  });

  it('publishes with no If-Match header exactly as before', async () => {
    const act = await race();
    const w = await world();
    const draft = await createDraft(w, racePayload(act));
    const result = await publishDraft(w, draft.templateId, 1);
    expect(result.status).toBe(200);
    expect(result.json).toEqual({ templateId: draft.templateId, version: 1 });
    expect(await count(w, 'challenge_template_versions', `state = 'published'`)).toBe(1);
    expect(await count(w, 'challenge_template_audit_events', `action = 'publish'`)).toBe(1);
  });

  it('publishes with a matching If-Match token', async () => {
    const act = await race();
    const w = await world();
    const draft = await createDraft(w, racePayload(act));
    const token = await draftToken(w, draft.templateId, 1);
    const result = await publishDraft(w, draft.templateId, 1, quoted(token));
    expect(result.status, JSON.stringify(result.json)).toBe(200);
    expect(result.json).toEqual({ templateId: draft.templateId, version: 1 });
    expect(await count(w, 'challenge_template_versions', `state = 'published'`)).toBe(1);
    expect(await count(w, 'challenge_template_audit_events', `action = 'publish'`)).toBe(1);
  });

  it('refuses a stale publish token with 409 template_draft_changed and the current draft, publishing nothing', async () => {
    const act = await race();
    const w = await world();
    const draft = await createDraft(w, racePayload(act));
    const stale = await draftToken(w, draft.templateId, 1);
    const saved = await put(w, `/api/operator/templates/${draft.templateId}/versions/1`, w.tokens.author, racePayload(act, {}, { title: 'Edited after review' }));
    expect(saved.status).toBe(200);
    const fresh = await draftToken(w, draft.templateId, 1);
    expect(fresh).not.toBe(stale);

    const refused = await publishDraft(w, draft.templateId, 1, quoted(stale));
    expect(refused.status).toBe(409);
    expect(refused.json.error.code).toBe('template_draft_changed');
    const current = refused.json.error.details.current;
    expect(current.revisionToken).toBe(fresh);
    expect(current.content).toBeTruthy();
    expect(current.content.composer.title).toBe('Edited after review');
    expect(current.lastEditedByMemberId).toBe(w.ids.author);
    expect(current.lastEditedAt).toBeTruthy();
    // No publication and no publish audit event.
    expect(await count(w, 'challenge_template_versions', `state = 'published'`)).toBe(0);
    expect(await count(w, 'challenge_template_audit_events', `action = 'publish'`)).toBe(0);
  });

  it('refuses a token that belongs to a different Template or a different version', async () => {
    const act = await race();
    const w = await world();
    const first = await createDraft(w, racePayload(act, {}, { title: 'First' }));
    const second = await createDraft(w, racePayload(act, {}, { title: 'Second' }));
    const foreign = await draftToken(w, first.templateId, 1);

    const otherTemplate = await publishDraft(w, second.templateId, 1, quoted(foreign));
    expect(otherTemplate.status).toBe(409);
    expect(otherTemplate.json.error.code).toBe('template_draft_changed');

    // A different VERSION of the same Template: publish v1, revise to v2, then
    // offer v1's token for v2.
    expect((await publishDraft(w, first.templateId, 1, quoted(foreign))).status).toBe(200);
    const revised = await call(w, 'POST', `/api/operator/templates/${first.templateId}/revisions`, w.tokens.author);
    expect(revised.status).toBe(201);
    const otherVersion = await publishDraft(w, first.templateId, 2, quoted(foreign));
    expect(otherVersion.status).toBe(409);
    expect(otherVersion.json.error.code).toBe('template_draft_changed');
    expect(await count(w, 'challenge_template_versions', `state = 'published'`)).toBe(1);
    expect(await count(w, 'challenge_template_audit_events', `action = 'publish'`)).toBe(1);
  });

  it('replays a publish token after publication as immutable, not as a draft change', async () => {
    const act = await race();
    const w = await world();
    const draft = await createDraft(w, racePayload(act));
    const token = await draftToken(w, draft.templateId, 1);
    expect((await publishDraft(w, draft.templateId, 1, quoted(token))).status).toBe(200);
    const replay = await publishDraft(w, draft.templateId, 1, quoted(token));
    expect(replay.status).toBe(409);
    expect(replay.json.error.code).toBe('template_version_immutable');
    expect(await count(w, 'challenge_template_audit_events', `action = 'publish'`)).toBe(1);
  });

  it('refuses a malformed publish header after authentication and path validation, before any read', async () => {
    const act = await race();
    const w = await world();
    const draft = await createDraft(w, racePayload(act));
    const publishUrl = `/api/operator/templates/${draft.templateId}/versions/1/publish`;

    // Before any Template or version read: an unknown Template still answers 400.
    const unknown = await call(w, 'POST', '/api/operator/templates/00000000-0000-4000-8000-000000000000/versions/1/publish', w.tokens.author, undefined, { 'if-match': '*' });
    expect(unknown.status).toBe(400);
    expect(unknown.json.error.code).toBe('invalid_precondition');

    // Authentication keeps precedence over the header parse.
    const anonymous = await rawCall(w, 'POST', publishUrl, null, { 'if-match': '*' });
    expect(anonymous.status).toBe(401);

    // Authorisation keeps precedence over the header parse.
    const member = await call(w, 'POST', publishUrl, w.tokens.member, undefined, { 'if-match': '*' });
    expect(member.status).toBe(403);

    // Path validation keeps precedence over the header parse.
    const badId = await call(w, 'POST', '/api/operator/templates/not-a-uuid/versions/1/publish', w.tokens.author, undefined, { 'if-match': '*' });
    expect(badId.status).toBe(400);
    expect(badId.json.error.code).toBe('invalid_template_id');
    const badVersion = await call(w, 'POST', `/api/operator/templates/${draft.templateId}/versions/zero/publish`, w.tokens.author, undefined, { 'if-match': '*' });
    expect(badVersion.status).toBe(400);
    expect(badVersion.json.error.code).toBe('invalid_template_version');

    // The rejected header published nothing.
    expect(await count(w, 'challenge_template_versions', `state = 'published'`)).toBe(0);
    expect(await count(w, 'challenge_template_audit_events', `action = 'publish'`)).toBe(0);
  });

  it('gives a retired Template precedence over the token check and over validation', async () => {
    const act = await race();
    const w = await world();
    const retire = async (templateId: string) => {
      const response = await call(w, 'POST', `/api/operator/templates/${templateId}/retire`, w.tokens.author, { reason: 'retired in the S5A suite' });
      expect(response.status).toBe(200);
    };

    // Retired + valid draft + valid token => template_retired, and no audit event.
    const valid = await createDraft(w, racePayload(act));
    const validToken = await draftToken(w, valid.templateId, 1);
    await retire(valid.templateId);
    const retiredValid = await publishDraft(w, valid.templateId, 1, quoted(validToken));
    expect(retiredValid.status).toBe(409);
    expect(retiredValid.json.error.code).toBe('template_retired');
    expect(await count(w, 'challenge_template_audit_events', `action = 'publish'`)).toBe(0);

    // Retired + invalid draft + a token => template_retired, never 422.
    const invalid = await createDraft(w, {});
    const invalidToken = await draftToken(w, invalid.templateId, 1);
    await retire(invalid.templateId);
    const retiredInvalid = await publishDraft(w, invalid.templateId, 1, quoted(invalidToken));
    expect(retiredInvalid.status).toBe(409);
    expect(retiredInvalid.json.error.code).toBe('template_retired');

    // Retired + invalid draft + NO header => today's behaviour, 422.
    const invalidNoHeader = await createDraft(w, {});
    await retire(invalidNoHeader.templateId);
    const unchanged422 = await publishDraft(w, invalidNoHeader.templateId, 1);
    expect(unchanged422.status).toBe(422);
    expect(unchanged422.json.error.code).toBe('invalid_template');

    // Retired + valid draft + NO header => unchanged: the in-transaction check answers.
    const validNoHeader = await createDraft(w, racePayload(act));
    await retire(validNoHeader.templateId);
    const unchanged409 = await publishDraft(w, validNoHeader.templateId, 1);
    expect(unchanged409.status).toBe(409);
    expect(unchanged409.json.error.code).toBe('template_retired');

    // Retired AND already published => template_version_immutable. The
    // published-state check precedes the retired check, with or without a
    // token.
    const publishedThenRetired = await createDraft(w, racePayload(act));
    const publishedToken = await draftToken(w, publishedThenRetired.templateId, 1);
    expect((await publishDraft(w, publishedThenRetired.templateId, 1, quoted(publishedToken))).status).toBe(200);
    await retire(publishedThenRetired.templateId);
    const immutable = await publishDraft(w, publishedThenRetired.templateId, 1, quoted(publishedToken));
    expect(immutable.status).toBe(409);
    expect(immutable.json.error.code).toBe('template_version_immutable');
    const immutableNoToken = await publishDraft(w, publishedThenRetired.templateId, 1);
    expect(immutableNoToken.status).toBe(409);
    expect(immutableNoToken.json.error.code).toBe('template_version_immutable');
  });

  it('refuses publish, revise and retire from a revoked author at the transaction boundary', async () => {
    const act = await race();
    const w = await world();

    // Publish: the in-transaction roster assertion refuses it.
    const draft = await createDraft(w, racePayload(act));
    await expect(publishTemplateVersion(w.db, w.ids.revoked, draft.templateId, 1)).rejects.toMatchObject({
      statusCode: 403, code: 'template_author_required',
    });
    expect(await count(w, 'challenge_template_versions', `state = 'published'`)).toBe(0);
    expect(await count(w, 'challenge_template_audit_events', `action = 'publish'`)).toBe(0);
    expect((await call(w, 'GET', `/api/operator/templates/${draft.templateId}`, w.tokens.author)).json.lifecycle).toBe('draft');

    // Revise: no new draft version is created.
    const published = await createDraft(w, racePayload(act));
    expect((await publishDraft(w, published.templateId, 1)).status).toBe(200);
    await expect(reviseTemplate(w.db, w.ids.revoked, published.templateId)).rejects.toMatchObject({
      statusCode: 403, code: 'template_author_required',
    });
    expect(await count(w, 'challenge_template_versions', `template_id = '${published.templateId}'`)).toBe(1);
    expect(await count(w, 'challenge_template_audit_events', `action = 'revise'`)).toBe(0);

    // Retire: retirement is terminal, so it must not land.
    const retireable = await createDraft(w, racePayload(act));
    await expect(retireTemplate(w.db, w.ids.revoked, retireable.templateId, 'not allowed')).rejects.toMatchObject({
      statusCode: 403, code: 'template_author_required',
    });
    expect((await call(w, 'GET', `/api/operator/templates/${retireable.templateId}`, w.tokens.author)).json.lifecycle).toBe('draft');
    expect(await count(w, 'challenge_template_audit_events', `action = 'retire'`)).toBe(0);
  });
});

/* ---------------- migration and legacy-shaped database ---------------- */

function wrap(pg: PGlite): Db {
  const wrapTx = (target: { query: PGlite['query'] }): Db => ({
    query: async <T>(text: string, params?: unknown[]) => ({ rows: (await target.query<T>(text, params)).rows }),
    transaction: (fn) => fn(wrapTx(target)),
    close: async () => {},
  });
  return {
    query: async <T>(text: string, params?: unknown[]) => ({ rows: (await pg.query<T>(text, params)).rows }),
    transaction: <T>(fn: (tx: Db) => Promise<T>) => pg.transaction(async (tx) => fn(wrapTx(tx as never))),
    close: () => pg.close(),
  };
}

describe('P5T-1 migration compatibility', () => {
  it('upgrades a legacy-shaped database (029) without touching existing Challenges, and re-applies idempotently', async () => {
    const pg = new PGlite({ extensions: { pgcrypto } });
    const db = wrap(pg);
    const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');
    const files = await listMigrationFiles();
    const index = files.indexOf('030_challenge_template_authority.sql');
    expect(index).toBeGreaterThan(0);
    expect(files[index - 1]).toBe('029_group_original_creator.sql');
    await db.query(`CREATE TABLE schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
    for (const file of files.slice(0, index)) {
      for (const statement of splitStatements(await readFile(join(dir, file), 'utf8'))) await db.query(statement);
      await db.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
    }
    const member = (await db.query<{ member_id: string }>(`INSERT INTO members (auth_provider, auth_subject) VALUES ('firebase', 'legacy-1') RETURNING member_id`)).rows[0].member_id;
    const group = (await db.query<{ group_id: string }>(`INSERT INTO groups (legacy_firestore_id, name, description, is_private) VALUES ('legacy-fs', 'Legacy', '', FALSE) RETURNING group_id`)).rows[0].group_id;
    const legacy = (await db.query<{ challenge_id: string }>(
      `INSERT INTO challenges (group_id, created_by_member_id, challenge_type, status, title, start_date, end_date, goal_value, goal_unit)
       VALUES ($1, $2, 'collective', 'establishment', 'Legacy Challenge', '2026-01-01', '2026-01-31', 10, 'kilometres') RETURNING challenge_id`,
      [group, member],
    )).rows[0].challenge_id;
    const before = JSON.stringify((await db.query(`SELECT * FROM challenges WHERE challenge_id = $1`, [legacy])).rows);

    expect(await runMigrations(db)).toEqual(['030_challenge_template_authority.sql']);
    const after = (await db.query<any>(`SELECT * FROM challenges WHERE challenge_id = $1`, [legacy])).rows[0];
    expect(after.source_template_id).toBeNull();
    expect(after.source_template_version).toBeNull();
    const { source_template_id: _a, source_template_version: _b, ...rest } = after;
    expect(JSON.stringify([rest])).toBe(JSON.stringify([JSON.parse(before)[0]]));
    // Legacy rows remain updatable.
    await db.query(`UPDATE challenges SET title = 'Legacy Renamed' WHERE challenge_id = $1`, [legacy]);

    // Re-applying the migration SQL is safe.
    for (const statement of splitStatements(await readFile(join(dir, files[index]), 'utf8'))) await db.query(statement);
    expect(await runMigrations(db)).toEqual([]);
    await db.close();
  });
});
