import 'dotenv/config';
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { createPool, databaseUrl } from './db.js';
import { createAdminKnowledgeSource, runKnowledgeImport } from './knowledgeImport.js';

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  if (!apply && !process.argv.includes('--dry-run')) {
    console.log('Usage: npm run knowledge:import -- --dry-run | --apply');
    console.log('  --dry-run reads Firestore and reports planned writes without touching PostgreSQL.');
    process.exit(2);
  }
  if (getApps().length === 0) {
    initializeApp({ credential: applicationDefault() });
  }
  const db = createPool(databaseUrl());
  try {
    const report = await runKnowledgeImport(db, createAdminKnowledgeSource(), { dryRun: !apply });
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await db.close();
  }
}

const invokedAsCli =
  process.argv[1]?.endsWith('knowledgeImportCli.ts') ||
  process.argv[1]?.endsWith('knowledgeImportCli.js');
if (invokedAsCli) void main();
