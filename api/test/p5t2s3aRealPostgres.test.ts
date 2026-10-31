/**
 * TIIZI-FER-P5T-2-S3A-001 — REAL PostgreSQL concurrency for conditional draft saves.
 *
 * PGlite serializes transactions on one connection, so it cannot show a lost
 * update race. This suite uses independent pooled connections against a
 * DISPOSABLE local cluster and is skipped unless explicitly pointed at one:
 *
 *   TIIZI_REAL_PG_URL=postgres://postgres@127.0.0.1:5549/tiizi_p5_preview_s3a \
 *   TIIZI_REAL_PG_DB=tiizi_p5_preview_s3a \
 *   TIIZI_DISPOSABLE_DB_HOST=127.0.0.1 TIIZI_DISPOSABLE_DB_PORT=5549 \
 *   npx vitest run test/p5t2s3aRealPostgres.test.ts
 *
 * The target must pass the disposable-database guard (`disposableDbGuard.ts`):
 * explicit allowed host/port/name, loopback, not port 5432, disposable name and
 * the `tiizi-disposable-preview:*` database comment, all checked before any
 * mutation. It is never run in CI and never against a shared database.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db.js';
import { createPool } from '../src/db.js';
import { disposableTargetSpecFromEnv, openGuardedDisposableDb } from '../src/disposableDbGuard.js';
import { runMigrations } from '../src/migrate.js';
import {
  createTemplateDraft,
  getOperatorTemplate,
  normalizeTemplateContent,
  retireTemplate,
  updateTemplateDraft,
} from '../src/challengeTemplates.js';

const url = process.env.TIIZI_REAL_PG_URL;
const target = process.env.TIIZI_REAL_PG_DB;
const ITERATIONS = 60;

const body = (title: string) => normalizeTemplateContent({
  summary: 'Concurrency fixture', durationDays: 14, composer: { title, challengeType: 'competitive', activities: [] },
});

describe.skipIf(!url || !target)('P5T-2 S3a real PostgreSQL concurrency (disposable cluster only)', () => {
  let db: Db;
  const authors: string[] = [];

  beforeAll(async () => {
    const spec = { ...disposableTargetSpecFromEnv(url), databaseName: target };
    ({ db } = await openGuardedDisposableDb(spec, (u) => createPool(u, { max: 12 })));
    await runMigrations(db);
    await db.query('TRUNCATE challenge_templates, platform_operator_template_authors, members CASCADE');
    for (let i = 0; i < 4; i += 1) {
      const member = await db.query<{ member_id: string }>(`INSERT INTO members (auth_provider, auth_subject) VALUES ('firebase', $1) RETURNING member_id`, [`pg-author-${i}`]);
      const id = String(member.rows[0].member_id);
      await db.query(`INSERT INTO platform_operator_template_authors (member_id, grant_reference) VALUES ($1, 'S3a real-PG disposable grant')`, [id]);
      authors.push(id);
    }
  });

  afterAll(async () => { if (db) await db.close(); });

  async function fresh(title = 'Start') {
    const { templateId } = await createTemplateDraft(db, authors[0], body(title));
    const detail = await getOperatorTemplate(db, templateId);
    return { templateId, token: detail.versions[0].revisionToken as string };
  }
  const editCount = async (templateId: string) =>
    Number((await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM challenge_template_audit_events WHERE template_id = $1 AND action = 'edit_draft'`, [templateId])).rows[0].n);
  const titleOf = async (templateId: string) =>
    String((await db.query<{ title: string }>(`SELECT title FROM challenge_template_versions WHERE template_id = $1`, [templateId])).rows[0].title);
  const noPgFailure = (results: PromiseSettledResult<unknown>[]) => {
    for (const result of results) {
      if (result.status === 'rejected') {
        const code = (result.reason as { code?: string }).code;
        expect(['template_draft_changed', 'template_retired', 'template_author_required']).toContain(code); // never 40P01 / 40001 / other
      }
    }
  };

  it(`two competing saves from the same token: exactly one wins, ${ITERATIONS} runs, no deadlock`, async () => {
    for (let i = 0; i < ITERATIONS; i += 1) {
      const { templateId, token } = await fresh();
      const results = await Promise.allSettled([
        updateTemplateDraft(db, authors[0], templateId, 1, body(`A-${i}`), token),
        updateTemplateDraft(db, authors[1], templateId, 1, body(`B-${i}`), token),
      ]);
      noPgFailure(results);
      const won = results.filter((r) => r.status === 'fulfilled');
      expect(won, `iteration ${i}`).toHaveLength(1);
      const winnerIndex = results.findIndex((r) => r.status === 'fulfilled');
      expect(await titleOf(templateId)).toBe(winnerIndex === 0 ? `A-${i}` : `B-${i}`);
      expect(await editCount(templateId)).toBe(1);
      const lost = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
      expect((lost.reason as { code: string }).code).toBe('template_draft_changed');
      const current = (lost.reason as { details: { current: { revisionToken: string } } }).details.current;
      expect(current.revisionToken).toBe((won[0] as PromiseFulfilledResult<{ revisionToken: string }>).value.revisionToken);
    }
  }, 120_000);

  it('four competing saves from one token: exactly one wins', async () => {
    for (let i = 0; i < 20; i += 1) {
      const { templateId, token } = await fresh();
      const results = await Promise.allSettled(authors.map((author, index) => updateTemplateDraft(db, author, templateId, 1, body(`W${index}-${i}`), token)));
      noPgFailure(results);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(await editCount(templateId)).toBe(1);
    }
  }, 120_000);

  it('a chain of saves with fresh tokens all succeed; a stale holder is refused each time', async () => {
    const { templateId, token } = await fresh();
    let current = token;
    for (let i = 0; i < 10; i += 1) {
      const saved = await updateTemplateDraft(db, authors[i % 2], templateId, 1, body(`step-${i}`), current);
      await expect(updateTemplateDraft(db, authors[2], templateId, 1, body('stale'), current)).rejects.toMatchObject({ code: 'template_draft_changed' });
      current = saved.revisionToken;
    }
    expect(await editCount(templateId)).toBe(10);
    expect(await titleOf(templateId)).toBe('step-9');
  }, 60_000);

  it('save racing retirement: never a deadlock, never a write after retirement', async () => {
    for (let i = 0; i < 30; i += 1) {
      const { templateId, token } = await fresh();
      const results = await Promise.allSettled([
        updateTemplateDraft(db, authors[0], templateId, 1, body(`late-${i}`), token),
        retireTemplate(db, authors[1], templateId, 'race'),
      ]);
      noPgFailure(results);
      expect(results[1].status).toBe('fulfilled');
      const lifecycle = String((await db.query<{ lifecycle: string }>(`SELECT lifecycle FROM challenge_templates WHERE template_id = $1`, [templateId])).rows[0].lifecycle);
      expect(lifecycle).toBe('retired');
      const saved = results[0].status === 'fulfilled';
      expect(await titleOf(templateId)).toBe(saved ? `late-${i}` : 'Start');
      expect(await editCount(templateId)).toBe(saved ? 1 : 0);
      if (!saved) expect(((results[0] as PromiseRejectedResult).reason as { code: string }).code).toBe('template_retired');
    }
  }, 120_000);

  it('save racing author revocation: the save either commits before the revocation or is refused with no disclosure', async () => {
    for (let i = 0; i < 30; i += 1) {
      const member = await db.query<{ member_id: string }>(`INSERT INTO members (auth_provider, auth_subject) VALUES ('firebase', $1) RETURNING member_id`, [`pg-racer-${i}-${Date.now()}`]);
      const racer = String(member.rows[0].member_id);
      await db.query(`INSERT INTO platform_operator_template_authors (member_id, grant_reference) VALUES ($1, 'S3a racer grant')`, [racer]);
      const { templateId, token } = await fresh();
      const [saveResult] = await Promise.allSettled([
        updateTemplateDraft(db, racer, templateId, 1, body(`racer-${i}`), token),
        db.query(`UPDATE platform_operator_template_authors SET revoked_at = now(), revoked_reference = 'S3a racer revocation' WHERE member_id = $1`, [racer]),
      ]);
      const revokedAt = (await db.query<{ revoked_at: Date | null }>(`SELECT revoked_at FROM platform_operator_template_authors WHERE member_id = $1`, [racer])).rows[0].revoked_at;
      expect(revokedAt).not.toBeNull();
      if (saveResult.status === 'rejected') {
        const reason = saveResult.reason as { code?: string; details?: unknown };
        expect(reason.code).toBe('template_author_required');
        expect(reason.details).toBeUndefined();
        expect(await titleOf(templateId)).toBe('Start');
      } else {
        expect(await titleOf(templateId)).toBe(`racer-${i}`);
      }
    }
  }, 120_000);
});
