import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createPool, databaseUrl } from './db.js';
import { importS6Catalogue } from './knowledgeCatalogueImport.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--apply' && arg !== '--dry-run')) {
    throw new Error('Accepted flags are --dry-run and --apply');
  }
  if (args.includes('--apply') && args.includes('--dry-run')) throw new Error('Choose either --dry-run or --apply');
  const mode = args.includes('--apply') ? 'apply' : 'dry-run';
  const candidatePath = resolve(process.cwd(), '../docs/programme/working/s6-content/tiizi-118-activity-reconciled-content.json');
  const inventoryPath = resolve(process.cwd(), '../docs/programme/working/s6-content/activity-master-inventory.json');
  const [candidateText, inventoryText] = await Promise.all([readFile(candidatePath, 'utf8'), readFile(inventoryPath, 'utf8')]);
  const db = createPool(databaseUrl());
  try {
    const report = await importS6Catalogue(db, JSON.parse(candidateText), JSON.parse(inventoryText), mode);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (!report.readyForIngestion) process.exitCode = 1;
  } finally {
    await db.close();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
