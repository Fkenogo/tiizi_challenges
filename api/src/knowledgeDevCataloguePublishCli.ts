import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createPool, databaseUrl } from './db.js';
import { importS6Catalogue } from './knowledgeCatalogueImport.js';
import { disposableTargetSpecFromEnv, openGuardedDisposableDb } from './disposableDbGuard.js';
import { publishDevCatalogue } from './knowledgeDevCataloguePublish.js';

/**
 * DEVELOPMENT-ONLY: import (existing S6 importer) and publish (governed
 * `setKnowledgeLifecycle`) the 118-Activity catalogue in a verified DISPOSABLE
 * database. Dry-run by default.
 *
 *   DATABASE_URL=... TIIZI_DISPOSABLE_DB_HOST=127.0.0.1 TIIZI_DISPOSABLE_DB_PORT=<port> npm run knowledge:dev-catalogue -- --target-db tiizi_p0_preview [--apply]
 *
 * Refuses unless the explicit host/port allow-list matches, the database is loopback, matches --target-db, matches the
 * disposable naming pattern, is not a protected name, and carries the
 * `tiizi-disposable-preview:*` database comment marker.
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const idx = args.indexOf('--target-db');
  const targetDb = idx >= 0 ? args[idx + 1] ?? '' : '';
  const known = new Set(['--apply', '--dry-run', '--target-db', targetDb]);
  if (args.some((arg) => !known.has(arg))) throw new Error('Accepted flags: --target-db <name> (required), --dry-run (default), --apply');
  if (apply && args.includes('--dry-run')) throw new Error('Choose either --dry-run or --apply');

  const url = databaseUrl();
  // Also requires TIIZI_DISPOSABLE_DB_HOST / _PORT (explicit allow-list; port 5432 is never accepted).
  const spec = { ...disposableTargetSpecFromEnv(url), databaseName: targetDb };
  const { db, identity } = await openGuardedDisposableDb(spec, (u) => createPool(u));
  try {
    process.stdout.write(`${JSON.stringify({ target: identity }, null, 2)}\n`);
    const base = resolve(process.cwd(), '../docs/programme/working/s6-content');
    const [candidate, inventory] = await Promise.all([
      readFile(resolve(base, 'tiizi-118-activity-reconciled-content.json'), 'utf8').then(JSON.parse),
      readFile(resolve(base, 'activity-master-inventory.json'), 'utf8').then(JSON.parse),
    ]);
    const mode = apply ? 'apply' : 'dry-run';
    const imported = await importS6Catalogue(db, candidate, inventory, mode);
    const importSummary = {
      mode: imported.mode, expected: imported.expected, received: imported.received, created: imported.created,
      updated: imported.updated, unchanged: imported.unchanged, conflicts: imported.conflicts,
      applied: imported.applied, readyForIngestion: imported.readyForIngestion, errors: imported.errors,
    };
    process.stdout.write(`${JSON.stringify({ import: importSummary }, null, 2)}\n`);
    if (!imported.readyForIngestion) { process.exitCode = 1; return; }
    const codes = new Set<string>((candidate.records as Array<{ activityCode: string }>).map((r) => r.activityCode));
    if (mode === 'dry-run' && imported.created + imported.updated > 0) {
      // Publication can only be planned once the catalogue exists; the apply
      // run imports first and then publishes in the same invocation.
      process.stdout.write(`${JSON.stringify({ publication: { note: 'dry-run: publication is planned after import; re-run --dry-run after --apply for a full plan' } }, null, 2)}\n`);
      return;
    }
    const published = await publishDevCatalogue(db, codes, mode);
    process.stdout.write(`${JSON.stringify({ publication: published }, null, 2)}\n`);
    if (published.errors.length > 0) process.exitCode = 1;
  } finally {
    await db.close();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
