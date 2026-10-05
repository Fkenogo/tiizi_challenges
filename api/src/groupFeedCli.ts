/**
 * Bounded internal GF-02 outbox processing and projection-retention commands.
 * No scheduler, member route, or hosted queue is introduced here.
 *
 *   feed:process [--limit 50]
 *   feed:retry-blocked [--limit 50]
 *   feed:expire-projections [--limit 50]
 */

import { createPool, databaseUrl, type Db } from './db.js';
import {
  expireGroupFeedProjections,
  processGroupFeedOutboxBatch,
  retryBlockedGroupFeedOutbox,
} from './groupFeedPublication.js';

function cliFail(message: string): never {
  throw new Error(`group-feed: ${message}`);
}

function readLimit(args: string[]): number {
  const flag = args.indexOf('--limit');
  if (flag === -1) return 50;
  const raw = args[flag + 1];
  const limit = raw ? Number(raw) : NaN;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    cliFail('--limit must be an integer between 1 and 100');
  }
  return limit;
}

export async function runGroupFeedCommand(db: Db, argv: string[]): Promise<void> {
  const [command, ...rest] = argv;
  const limit = readLimit(rest);
  if (command === 'process') {
    const summary = await processGroupFeedOutboxBatch(db, { limit });
    console.log(`group-feed: process ${JSON.stringify(summary)}`);
    return;
  }
  if (command === 'retry-blocked') {
    const retried = await retryBlockedGroupFeedOutbox(db, { limit });
    console.log(`group-feed: retry-blocked ${JSON.stringify({ retried, limit })}`);
    return;
  }
  if (command === 'expire-projections') {
    const expired = await expireGroupFeedProjections(db, { limit });
    console.log(`group-feed: expire-projections ${JSON.stringify({ expired, limit })}`);
    return;
  }
  cliFail(`unknown command '${command ?? '(none)'}' (expected process|retry-blocked|expire-projections)`);
}

async function main(): Promise<void> {
  const db = createPool(databaseUrl());
  try {
    await runGroupFeedCommand(db, process.argv.slice(2));
  } finally {
    await db.close();
  }
}

const invokedAsCli = process.argv[1]?.endsWith('groupFeedCli.ts')
  || process.argv[1]?.endsWith('groupFeedCli.js');
if (invokedAsCli) {
  main().catch((error: unknown) => {
    console.error(`group-feed: failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
