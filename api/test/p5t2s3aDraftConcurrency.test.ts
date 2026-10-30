/**
 * TIIZI-FER-P5T-2-S3A-001 — conditional Template draft saves (`If-Match` +
 * revisionToken) and the caller-scoped capabilities endpoint. Runs on PGlite
 * (real PostgreSQL semantics, one connection); true two-connection concurrency
 * is proven separately by p5t2s3aRealPostgres.test.ts against a disposable cluster.
 */

import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { revisionTokenFor, updateTemplateDraft, normalizeTemplateContent, TemplateError } from '../src/challengeTemplates.js';
import { authHeaders, seedMember, stubVerifier, testDb } from './helpers.js';

let seq = 0;

async function world() {
  const db = testDb();
  const tag = `s3a${(seq += 1)}`;
  const ids = {
    author: await seedMember(db, `${tag}-author`),
    author2: await seedMember(db, `${tag}-author2`),
    reader: await seedMember(db, `${tag}-reader`),
    both: await seedMember(db, `${tag}-both`),
    revoked: await seedMember(db, `${tag}-revoked`),
    revokedReader: await seedMember(db, `${tag}-revokedreader`),
    member: await seedMember(db, `${tag}-member`),
  };
  for (const key of ['author', 'author2', 'both', 'revoked', 'revokedReader'] as const) {
    await db.query(`INSERT INTO platform_operator_template_authors (member_id, grant_reference) VALUES ($1, 'S3a test author grant')`, [ids[key]]);
  }
  for (const key of ['revoked', 'revokedReader'] as const) {
    await db.query(`UPDATE platform_operator_template_authors SET revoked_at = now(), revoked_reference = 'S3a test revocation' WHERE member_id = $1`, [ids[key]]);
  }
  for (const key of ['reader', 'both', 'revokedReader'] as const) {
    await db.query(`INSERT INTO platform_operator_console_readers (member_id, grant_reference) VALUES ($1, 'S3a test reader grant')`, [ids[key]]);
  }
  const tokens = Object.fromEntries(Object.keys(ids).map((key) => [key, `${tag}-${key.toLowerCase()}`])) as Record<keyof typeof ids, string>;
  const verifier = stubVerifier(Object.fromEntries(Object.values(tokens).map((t) => [t, t])));
  const app = buildApp({ db, verifier });
  return { app, db, ids, tokens };
}
type World = Awaited<ReturnType<typeof world>>;

async function call(w: World, method: 'GET' | 'POST' | 'PUT', url: string, token: string | null, payload?: unknown, headers: Record<string, string> = {}) {
  const response = await w.app.inject({
    method, url, headers: { ...(token ? authHeaders(token) : {}), ...headers },
    ...(payload !== undefined ? { payload: payload as Record<string, unknown> } : {}),
  });
  let json: any = null;
  try { json = response.json(); } catch { json = null; }
  return { status: response.statusCode, json, raw: response.body };
}

const draftBody = (title: string, extra: Record<string, unknown> = {}) => ({
  summary: 'A summary', durationDays: 14, focusTags: ['Strength'],
  composer: { title, challengeType: 'competitive', activities: [] },
  ...extra,
});

async function createDraft(w: World, token = w.tokens.author, title = 'Original title') {
  const created = await call(w, 'POST', '/api/operator/templates', token, draftBody(title));
  expect(created.status, created.raw).toBe(201);
  return created.json as { templateId: string; version: number };
}

async function tokenOf(w: World, templateId: string, version = 1, reader = w.tokens.author): Promise<string> {
  const detail = await call(w, 'GET', `/api/operator/templates/${templateId}`, reader);
  const found = detail.json.versions.find((v: any) => v.version === version);
  return found.revisionToken as string;
}

const save = (w: World, d: { templateId: string; version: number }, token: string | null, body: unknown, ifMatch: string | null) =>
  call(w, 'PUT', `/api/operator/templates/${d.templateId}/versions/${d.version}`, token, body, ifMatch === null ? {} : { 'if-match': ifMatch });

async function snapshot(w: World, templateId: string) {
  const version = (await w.db.query(`SELECT * FROM challenge_template_versions WHERE template_id = $1 ORDER BY version`, [templateId])).rows;
  const audit = (await w.db.query(`SELECT action, actor_member_id, version FROM challenge_template_audit_events WHERE template_id = $1 ORDER BY event_id`, [templateId])).rows;
  return { version: JSON.stringify(version), audit: JSON.stringify(audit), auditCount: audit.length };
}

/* ---------------- capabilities ---------------- */

describe('P5T-2 S3a capabilities endpoint', () => {
  it('reports exactly the caller’s own effective standing', async () => {
    const w = await world();
    const caps = async (token: string) => (await call(w, 'GET', '/api/operator/templates/capabilities', token));
    for (const [who, expected] of [
      ['author', { canAuthor: true, canRead: true }],
      ['author2', { canAuthor: true, canRead: true }],
      ['reader', { canAuthor: false, canRead: true }],
      ['both', { canAuthor: true, canRead: true }],
      ['revoked', { canAuthor: false, canRead: false }],
      ['revokedReader', { canAuthor: false, canRead: true }], // revoked author who still holds a Console-reader grant
      ['member', { canAuthor: false, canRead: false }],
    ] as const) {
      const response = await caps(w.tokens[who]);
      expect(response.status, who).toBe(200);
      expect(response.json, who).toEqual(expected);
    }
  });

  it('requires authentication and ignores any attempt to ask about someone else', async () => {
    const w = await world();
    expect((await call(w, 'GET', '/api/operator/templates/capabilities', null)).status).toBe(401);
    const probe = await call(w, 'GET', `/api/operator/templates/capabilities?memberId=${w.ids.author}&member_id=${w.ids.author}`, w.tokens.member);
    expect(probe.json).toEqual({ canAuthor: false, canRead: false });
    expect(Object.keys((await call(w, 'GET', '/api/operator/templates/capabilities', w.tokens.author)).json).sort()).toEqual(['canAuthor', 'canRead']);
  });

  it('is read-only: it grants nothing and no other method exists', async () => {
    const w = await world();
    const before = JSON.stringify([
      (await w.db.query(`SELECT * FROM platform_operator_template_authors ORDER BY member_id`)).rows,
      (await w.db.query(`SELECT * FROM platform_operator_console_readers ORDER BY member_id`)).rows,
    ]);
    await call(w, 'GET', '/api/operator/templates/capabilities', w.tokens.member);
    expect((await call(w, 'POST', '/api/operator/templates/capabilities', w.tokens.author, {})).status).toBeGreaterThanOrEqual(400);
    expect((await call(w, 'PUT', '/api/operator/templates/capabilities', w.tokens.author, {})).status).toBeGreaterThanOrEqual(400);
    const after = JSON.stringify([
      (await w.db.query(`SELECT * FROM platform_operator_template_authors ORDER BY member_id`)).rows,
      (await w.db.query(`SELECT * FROM platform_operator_console_readers ORDER BY member_id`)).rows,
    ]);
    expect(after).toBe(before);
    expect((await call(w, 'GET', '/api/operator/templates', w.tokens.member)).status).toBe(403);
  });

  it('is a static route that wins over the :templateId parameter route, which still works', async () => {
    const w = await world();
    const capability = await call(w, 'GET', '/api/operator/templates/capabilities', w.tokens.author);
    expect(capability.json.error).toBeUndefined();
    expect(capability.json).toHaveProperty('canAuthor');
    const draft = await createDraft(w);
    expect((await call(w, 'GET', `/api/operator/templates/${draft.templateId}`, w.tokens.author)).status).toBe(200);
    expect((await call(w, 'GET', '/api/operator/templates/not-a-uuid', w.tokens.author)).json.error.code).toBe('invalid_template_id');
    expect((await call(w, 'GET', '/api/operator/templates/adoption', w.tokens.author)).status).toBe(200);
  });
});

/* ---------------- conditional saves ---------------- */

describe('P5T-2 S3a conditional draft saves', () => {
  it('exposes a revisionToken for draft versions only', async () => {
    const w = await world();
    const d = await createDraft(w);
    const token = await tokenOf(w, d.templateId);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    // Publish by SQL (fixture only) to prove a published version carries no token.
    await w.db.query(`UPDATE challenge_template_versions SET state = 'published', published_by_member_id = $2, published_at = now() WHERE template_id = $1`, [d.templateId, w.ids.author]);
    const detail = await call(w, 'GET', `/api/operator/templates/${d.templateId}`, w.tokens.author);
    expect(detail.json.versions[0].revisionToken).toBeNull();
  });

  it('saves with the current token, returns the new token, and audits exactly one edit', async () => {
    const w = await world();
    const d = await createDraft(w);
    const token = await tokenOf(w, d.templateId);
    const before = await snapshot(w, d.templateId);
    const saved = await save(w, d, w.tokens.author2, draftBody('Edited title'), `"${token}"`);
    expect(saved.status, saved.raw).toBe(200);
    expect(saved.json.revisionToken).toMatch(/^[0-9a-f]{64}$/);
    expect(saved.json.revisionToken).not.toBe(token);
    expect(saved.json.revisionToken).toBe(await tokenOf(w, d.templateId));
    const after = await snapshot(w, d.templateId);
    expect(after.auditCount).toBe(before.auditCount + 1);
    expect(JSON.parse(after.audit).at(-1)).toMatchObject({ action: 'edit_draft', actor_member_id: w.ids.author2, version: 1 });
    const stored = (await w.db.query<any>(`SELECT title, last_edited_by_member_id FROM challenge_template_versions WHERE template_id = $1`, [d.templateId])).rows[0];
    expect(stored.title).toBe('Edited title');
    expect(String(stored.last_edited_by_member_id)).toBe(w.ids.author2);
  });

  it('requires the precondition: missing If-Match is 428 and writes nothing', async () => {
    const w = await world();
    const d = await createDraft(w);
    const before = await snapshot(w, d.templateId);
    const response = await save(w, d, w.tokens.author, draftBody('No precondition'), null);
    expect(response.status).toBe(428);
    expect(response.json.error.code).toBe('precondition_required');
    expect(await snapshot(w, d.templateId)).toEqual(before);
  });

  it('rejects malformed, wildcard, weak and multiple validators without writing', async () => {
    const w = await world();
    const d = await createDraft(w);
    const token = await tokenOf(w, d.templateId);
    const before = await snapshot(w, d.templateId);
    for (const bad of ['*', `W/"${token}"`, token, `"${token.slice(1)}"`, `"${token.toUpperCase()}"`, `"${token}", "${token}"`, '""', '"not-hex"']) {
      const response = await save(w, d, w.tokens.author, draftBody('Bad precondition'), bad);
      expect(response.status, bad).toBe(400);
      expect(response.json.error.code, bad).toBe('invalid_precondition');
    }
    expect(await snapshot(w, d.templateId)).toEqual(before);
  });

  it('refuses a stale token with 409 and the current draft, writing nothing; the returned token then succeeds', async () => {
    const w = await world();
    const d = await createDraft(w);
    const loaded = await tokenOf(w, d.templateId);
    // Another author saves first.
    const first = await save(w, d, w.tokens.author2, draftBody('Author two was first'), `"${loaded}"`);
    expect(first.status).toBe(200);
    const before = await snapshot(w, d.templateId);

    const stale = await save(w, d, w.tokens.author, draftBody('Author one stale save'), `"${loaded}"`);
    expect(stale.status).toBe(409);
    expect(stale.json.error.code).toBe('template_draft_changed');
    const current = stale.json.error.details.current;
    expect(current.revisionToken).toBe(first.json.revisionToken);
    expect(current.content.composer.title).toBe('Author two was first');
    expect(current.lastEditedByMemberId).toBe(w.ids.author2);
    expect(typeof current.lastEditedAt).toBe('string');
    expect(await snapshot(w, d.templateId)).toEqual(before); // no content change, no audit event

    // A deliberate follow-up with the token from the conflict is an explicit overwrite.
    const retry = await save(w, d, w.tokens.author, draftBody('Author one after review'), `"${current.revisionToken}"`);
    expect(retry.status).toBe(200);
  });

  it('rejects tokens from another Template and from another version of the same Template', async () => {
    const w = await world();
    const a = await createDraft(w, w.tokens.author, 'Same content');
    const b = await createDraft(w, w.tokens.author, 'Same content');
    const tokenB = await tokenOf(w, b.templateId);
    const before = await snapshot(w, a.templateId);
    const cross = await save(w, a, w.tokens.author, draftBody('Same content'), `"${tokenB}"`);
    expect(cross.status).toBe(409); // identical content, different Template identity
    expect(cross.json.error.code).toBe('template_draft_changed');

    // Same Template, other version: v1 published (fixture), v2 draft with IDENTICAL content.
    await w.db.query(`UPDATE challenge_template_versions SET state = 'published', published_by_member_id = $2, published_at = now() WHERE template_id = $1`, [a.templateId, w.ids.author]);
    await w.db.query(`UPDATE challenge_templates SET lifecycle = 'published', latest_published_version = 1, latest_published_at = now() WHERE template_id = $1`, [a.templateId]);
    const revision = await call(w, 'POST', `/api/operator/templates/${a.templateId}/revisions`, w.tokens.author, {});
    expect(revision.status, revision.raw).toBe(201);
    const v1Row = (await w.db.query<any>(`SELECT * FROM challenge_template_versions WHERE template_id = $1 AND version = 1`, [a.templateId])).rows[0];
    const v1Token = revisionTokenFor(v1Row);
    const v2Token = await tokenOf(w, a.templateId, 2);
    expect(v1Token).not.toBe(v2Token); // version identity is hashed in
    const wrongVersion = await save(w, { templateId: a.templateId, version: 2 }, w.tokens.author, draftBody('Same content'), `"${v1Token}"`);
    expect(wrongVersion.status).toBe(409);
    expect(before.auditCount).toBeGreaterThan(0);
  });

  it('documents token semantics: a no-op save keeps the token (still audited); content returning to an earlier state returns that token', async () => {
    const w = await world();
    const d = await createDraft(w);
    const t0 = await tokenOf(w, d.templateId);
    const noop = await save(w, d, w.tokens.author, draftBody('Original title'), `"${t0}"`);
    expect(noop.status).toBe(200);
    expect(noop.json.revisionToken).toBe(t0);
    expect((await snapshot(w, d.templateId)).auditCount).toBe(2); // create_draft + edit_draft (existing audit behaviour)

    const changed = await save(w, d, w.tokens.author, draftBody('Changed'), `"${t0}"`);
    const back = await save(w, d, w.tokens.author, draftBody('Original title'), `"${changed.json.revisionToken}"`);
    expect(back.json.revisionToken).toBe(t0);
  });

  it('keeps lifecycle protection first: published versions and retired Templates stay immutable even with a matching token', async () => {
    const w = await world();
    const published = await createDraft(w);
    const tokenP = await tokenOf(w, published.templateId);
    await w.db.query(`UPDATE challenge_template_versions SET state = 'published', published_by_member_id = $2, published_at = now() WHERE template_id = $1`, [published.templateId, w.ids.author]);
    const immutable = await save(w, published, w.tokens.author, draftBody('Edit published'), `"${tokenP}"`);
    expect(immutable.status).toBe(409);
    expect(immutable.json.error.code).toBe('template_version_immutable');

    const retired = await createDraft(w);
    const tokenR = await tokenOf(w, retired.templateId);
    expect((await call(w, 'POST', `/api/operator/templates/${retired.templateId}/retire`, w.tokens.author, {})).status).toBe(200);
    const blocked = await save(w, retired, w.tokens.author, draftBody('Edit retired'), `"${tokenR}"`);
    expect(blocked.status).toBe(409);
    expect(blocked.json.error.code).toBe('template_retired');
    expect(blocked.raw).not.toContain('Original title'); // no draft content in lifecycle refusals
  });

  it('never discloses draft content to anyone without current author authority', async () => {
    const w = await world();
    const d = await createDraft(w, w.tokens.author, 'Confidential draft title');
    const token = await tokenOf(w, d.templateId);
    // Make the token stale so a leaky conflict path would have something to return.
    await save(w, d, w.tokens.author, draftBody('Confidential second edit'), `"${token}"`);
    const before = await snapshot(w, d.templateId);
    for (const who of ['member', 'reader', 'revoked', 'revokedReader'] as const) {
      const response = await save(w, d, w.tokens[who], draftBody('Intrusion'), `"${token}"`);
      expect(response.status, who).toBe(403);
      expect(response.json.error.code, who).toBe('template_author_required');
      expect(response.raw, who).not.toMatch(/Confidential|revisionToken|current/);
    }
    expect((await save(w, d, null, draftBody('Anonymous'), `"${token}"`)).status).toBe(401);
    expect(await snapshot(w, d.templateId)).toEqual(before);
  });

  it('re-checks authority inside the write transaction: a revoked author gets no draft content, even from the domain function', async () => {
    const w = await world();
    const d = await createDraft(w, w.tokens.author, 'Confidential draft title');
    const stale = await tokenOf(w, d.templateId);
    await save(w, d, w.tokens.author, draftBody('Moved on'), `"${stale}"`);
    const before = await snapshot(w, d.templateId);
    // The route check passed earlier; the roster changed before the transaction.
    await w.db.query(`UPDATE platform_operator_template_authors SET revoked_at = now(), revoked_reference = 'S3a mid-flight revocation' WHERE member_id = $1`, [w.ids.author]);
    const attempt = updateTemplateDraft(w.db, w.ids.author, d.templateId, 1, normalizeTemplateContent(draftBody('Late save')), stale);
    await expect(attempt).rejects.toMatchObject({ statusCode: 403, code: 'template_author_required' });
    await attempt.catch((error: TemplateError) => expect(error.details).toBeUndefined());
    expect(await snapshot(w, d.templateId)).toEqual(before);
  });

  it('serializes two saves from the same token: exactly one wins, the other gets the winner as the conflict', async () => {
    const w = await world();
    const d = await createDraft(w);
    const token = await tokenOf(w, d.templateId);
    const [x, y] = await Promise.all([
      save(w, d, w.tokens.author, draftBody('Edit from author one'), `"${token}"`),
      save(w, d, w.tokens.author2, draftBody('Edit from author two'), `"${token}"`),
    ]);
    const statuses = [x.status, y.status].sort();
    expect(statuses).toEqual([200, 409]);
    const winner = x.status === 200 ? x : y;
    const loser = x.status === 200 ? y : x;
    expect(loser.json.error.details.current.revisionToken).toBe(winner.json.revisionToken);
    const stored = (await w.db.query<any>(`SELECT title FROM challenge_template_versions WHERE template_id = $1`, [d.templateId])).rows[0];
    expect(['Edit from author one', 'Edit from author two']).toContain(stored.title);
    expect((await snapshot(w, d.templateId)).auditCount).toBe(2); // create_draft + ONE edit
  });

  it('keeps the CORS preflight honest for the new request header', async () => {
    const previous = process.env.TIIZI_ALLOWED_ORIGINS;
    process.env.TIIZI_ALLOWED_ORIGINS = 'http://localhost:5198';
    try {
      const w = await world();
      const preflight = await w.app.inject({
        method: 'OPTIONS', url: '/api/operator/templates/00000000-0000-4000-8000-000000000001/versions/1',
        headers: { origin: 'http://localhost:5198', 'access-control-request-method': 'PUT', 'access-control-request-headers': 'authorization,content-type,if-match' },
      });
      expect(String(preflight.headers['access-control-allow-headers']).toLowerCase()).toContain('if-match');
    } finally {
      if (previous === undefined) delete process.env.TIIZI_ALLOWED_ORIGINS; else process.env.TIIZI_ALLOWED_ORIGINS = previous;
    }
  });
});
