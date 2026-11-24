import { createPool, databaseUrl } from './db.js';
import { cleanupMediaLifecycle } from './mediaService.js';
import { createR2ObjectStoreFromEnv } from './r2ObjectStore.js';

async function main() {
  const db = createPool(databaseUrl());
  try {
    const { store } = createR2ObjectStoreFromEnv();
    const report = await cleanupMediaLifecycle(db, store);
    console.log('Media cleanup completed:', report);
  } finally {
    await db.close();
  }
}

main().catch((err) => {
  console.error('Media cleanup failed:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
