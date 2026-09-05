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
if (invokedAsCli) void main();

export type { Db };
