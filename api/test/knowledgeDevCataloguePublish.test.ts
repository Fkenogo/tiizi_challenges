import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { importS6Catalogue } from '../src/knowledgeCatalogueImport.js';
import { listKnowledgeForAdmin } from '../src/knowledge.js';
import {
  DISPOSABLE_DB_MARKER_PREFIX,
  EXPECTED_CATALOGUE,
  publishDevCatalogue,
  validateDisposableTargetUrl,
  verifyDisposableTarget,
} from '../src/knowledgeDevCataloguePublish.js';
import type { Db } from '../src/db.js';
import { testDb } from './helpers.js';

const readJson = async (path: string) => JSON.parse(await readFile(resolve(process.cwd(), path), 'utf8')) as Record<string, any>;
const base = '../docs/programme/working/s6-content/';

describe('dev catalogue publication — target safety', () => {
  it('accepts only loopback, matching, disposable-pattern database names', () => {
    expect(validateDisposableTargetUrl('postgresql://u:p@127.0.0.1:15450/tiizi_p0_preview', 'tiizi_p0_preview'))
      .toEqual({ host: '127.0.0.1', port: '15450', database: 'tiizi_p0_preview' });
    for (const [url, db, msg] of [
      ['postgresql://u:p@127.0.0.1:15433/tiizi', 'tiizi', 'protected'],
      ['postgresql://u:p@db.example.com:5432/tiizi_p0_preview', 'tiizi_p0_preview', 'not loopback'],
      ['postgresql://u:p@127.0.0.1:5432/tiizi_p0_preview', 'tiizi_other_preview', 'does not equal'],
      ['postgresql://u:p@127.0.0.1:5432/tiizi_prod_preview', 'tiizi_prod_preview', 'protected'],
      ['postgresql://u:p@127.0.0.1:5432/tiizi_development_preview', 'tiizi_development_preview', 'protected'],
      ['postgresql://u:p@127.0.0.1:5432/customers', 'customers', 'naming pattern'],
      ['postgresql://u:p@127.0.0.1:5432/tiizi_p0_preview', '', 'required'],
    ] as const) {
      expect(() => validateDisposableTargetUrl(url, db), `${url}`).toThrow(msg);
    }
  });

  it('refuses a database without the disposable marker or with a mismatched identity', async () => {
    const fake = (row: Record<string, unknown>): Db => ({
      query: async () => ({ rows: [row] }),
      transaction: async <T,>(fn: (tx: Db) => Promise<T>) => fn(fake(row)),
      close: async () => {},
    }) as unknown as Db;
    const url = 'postgresql://u:p@127.0.0.1:15450/tiizi_p0_preview';
    await expect(verifyDisposableTarget(fake({ db: 'tiizi_p0_preview', usr: 'u', port: '5432', marker: null }), url, 'tiizi_p0_preview'))
      .rejects.toThrow('marker');
    await expect(verifyDisposableTarget(fake({ db: 'tiizi', usr: 'u', port: '5432', marker: `${DISPOSABLE_DB_MARKER_PREFIX}p0` }), url, 'tiizi_p0_preview'))
      .rejects.toThrow('does not equal');
    await expect(verifyDisposableTarget(fake({ db: 'tiizi_p0_preview', usr: 'u', port: '5432', marker: `${DISPOSABLE_DB_MARKER_PREFIX}p0` }), url, 'tiizi_p0_preview'))
      .resolves.toMatchObject({ connectedDatabase: 'tiizi_p0_preview', marker: `${DISPOSABLE_DB_MARKER_PREFIX}p0` });
  });
});

describe('dev catalogue publication — governed lifecycle', () => {
  it('is dry-run safe, publishes only through the governed path, preserves versions, and is idempotent', async () => {
    const db = testDb();
    const [candidate, inventory] = await Promise.all([readJson(`${base}tiizi-118-activity-reconciled-content.json`), readJson(`${base}activity-master-inventory.json`)]);
    const codes = new Set<string>(candidate.records.map((r: { activityCode: string }) => r.activityCode));
    expect(codes.size).toBe(EXPECTED_CATALOGUE.total);

    const missing = await publishDevCatalogue(db, codes, 'dry-run');
    expect(missing.errors.some((e) => e.includes('missing'))).toBe(true);

    const imported = await importS6Catalogue(db, candidate, inventory, 'apply');
    expect(imported.readyForIngestion).toBe(true);

    const before = await listKnowledgeForAdmin(db, {});
    const versions = new Map(before.map((i) => [i.activityCode, i.knowledgeVersion]));

    const dry = await publishDevCatalogue(db, codes, 'dry-run');
    expect(dry.errors).toEqual([]);
    expect(dry.published).toBe(0);
    expect((await listKnowledgeForAdmin(db, {})).filter((i) => i.lifecycle === 'published').length).toBe(before.filter((i) => i.lifecycle === 'published').length);

    const applied = await publishDevCatalogue(db, codes, 'apply');
    expect(applied.errors).toEqual([]);
    expect(applied.verification).toMatchObject({ total: 118, published: 118, composerSelectable: 118, duplicateCodes: 0, byKind: { fitness: 84, wellness: 34 } });

    const after = await listKnowledgeForAdmin(db, {});
    expect(after.filter((i) => i.activityCode).length).toBe(118);
    for (const item of after) expect(item.knowledgeVersion).toBe(versions.get(item.activityCode));

    const rerun = await publishDevCatalogue(db, codes, 'apply');
    expect(rerun.errors).toEqual([]);
    expect(rerun.published).toBe(0);
    expect(rerun.toPublish).toBe(0);
  });

  it('fails closed on an unexpected code set without mutating', async () => {
    const db = testDb();
    const short = new Set(['FIT-STR-001']);
    const report = await publishDevCatalogue(db, short, 'apply');
    expect(report.errors.join('\n')).toContain('not 118');
    expect(report.published).toBe(0);
  });
});
