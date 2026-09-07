import { createPool, databaseUrl, type Db } from './db.js';
import { runMigrations } from './migrate.js';

async function main(): Promise<void> {
  const db = createPool(databaseUrl());
  try {
    const applied = await runMigrations(db);
    if (applied.length === 0) {
      console.log('migrate: already up to date');
    } else {
      for (const name of applied) console.log(`migrate: applied ${name}`);
    }
  } finally {
    await db.close();
  }
}

const invokedAsCli =
  process.argv[1]?.endsWith('migrateCli.ts') || process.argv[1]?.endsWith('migrateCli.js');
if (invokedAsCli) {
  // Explicit non-zero exit for Cloud Run Job / pre-deploy gating.
  // Only the failure message is logged (never connection strings).
  main().catch((error: unknown) => {
    console.error(`migrate: failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}

export type { Db };
