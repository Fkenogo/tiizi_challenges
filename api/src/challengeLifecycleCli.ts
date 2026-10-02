/**
 * Challenge lifecycle CLI — deterministic scheduled-start and
 * expiry/finalization/rebuild seams. No scheduler is deployed here; S9 may
 * invoke `process-lifecycle` as its governed job command.
 *
 * Usage:
 *   tsx src/challengeLifecycleCli.ts process-lifecycle [--now <ISO>]
 *   tsx src/challengeLifecycleCli.ts process-scheduled [--now <ISO>]
 *   tsx src/challengeLifecycleCli.ts process-expired [--now <ISO>] # compatibility alias for process-lifecycle
 *   tsx src/challengeLifecycleCli.ts finalize <challengeId> [--now <ISO>]
 *   tsx src/challengeLifecycleCli.ts rebuild <challengeId> [--repair-finalized]
 *
 * `--now` drives the acceptance/period clock explicitly (deterministic runs
 * and tests); absent it means wall clock. Exit non-zero on failure for
 * Cloud Run Job / pre-deploy gating. Only failure/summary lines are logged
 * (never connection strings).
 */

import { createPool, databaseUrl, type Db } from './db.js';
import {
  finalizeChallenge,
  processExpiredChallenges,
  processScheduledChallengeStarts,
  rebuildChallengeDerived,
} from './challengeFinalization.js';

function cliFail(message: string): never {
  throw new Error(`challenge-lifecycle: ${message}`);
}

function readNow(args: string[]): Date {
  const flag = args.indexOf('--now');
  if (flag === -1) return new Date();
  const raw = args[flag + 1];
  const at = raw ? new Date(raw) : new Date(NaN);
  if (Number.isNaN(at.getTime())) cliFail('--now must be a valid ISO timestamp');
  return at;
}

export async function runLifecycleCommand(db: Db, argv: string[]): Promise<void> {
  const [command, ...rest] = argv;
  if (command === 'process-scheduled') {
    const outcomes = await processScheduledChallengeStarts(db, readNow(rest));
    for (const outcome of outcomes) {
      console.log(
        `lifecycle: ${outcome.challenge_id} due=${outcome.due} `
        + `activated=${outcome.activated} blockedBy=${outcome.blockedBy ?? 'none'}`,
      );
    }
    return;
  }
  if (command === 'process-lifecycle' || command === 'process-expired') {
    const now = readNow(rest);
    const starts = await processScheduledChallengeStarts(db, now);
    for (const outcome of starts) {
      console.log(
        `lifecycle: ${outcome.challenge_id} due=${outcome.due} `
        + `activated=${outcome.activated} blockedBy=${outcome.blockedBy ?? 'none'}`,
      );
    }
    const outcomes = await processExpiredChallenges(db, now);
    for (const outcome of outcomes) {
      console.log(
        `lifecycle: ${outcome.challenge_id} expired=${outcome.expired} `
        + `ended=${outcome.ended} finalized=${outcome.finalized} `
        + `already=${outcome.alreadyFinalized}`,
      );
    }
    return;
  }
  if (command === 'finalize') {
    const challengeId = rest.find((arg) => !arg.startsWith('--'));
    if (!challengeId) cliFail('finalize requires a challengeId');
    const result = await finalizeChallenge(db, challengeId as string, readNow(rest));
    console.log(
      `lifecycle: finalized ${result.challenge.challenge_id} `
      + `already=${result.alreadyFinalized} records=${result.recordsReplayed}`,
    );
    return;
  }
  if (command === 'rebuild') {
    const challengeId = rest.find((arg) => !arg.startsWith('--'));
    if (!challengeId) cliFail('rebuild requires a challengeId');
    const result = await rebuildChallengeDerived(db, challengeId as string, {
      repairFinalized: rest.includes('--repair-finalized'),
    });
    console.log(
      `lifecycle: rebuild ${challengeId} mode=${result.mode} `
      + `records=${result.recordsReplayed} persisted=${result.participationsPersisted}`
      + (result.verified === undefined ? '' : ` verified=${result.verified}`),
    );
    if (result.verified === false) {
      for (const mismatch of result.mismatches ?? []) console.log(`lifecycle: mismatch ${mismatch}`);
      cliFail('finalized-history verification failed');
    }
    return;
  }
  cliFail(`unknown command '${command ?? '(none)'}' (expected process-lifecycle|process-scheduled|finalize|rebuild)`);
}

async function main(): Promise<void> {
  const db = createPool(databaseUrl());
  try {
    await runLifecycleCommand(db, process.argv.slice(2));
  } finally {
    await db.close();
  }
}

const invokedAsCli =
  process.argv[1]?.endsWith('challengeLifecycleCli.ts')
  || process.argv[1]?.endsWith('challengeLifecycleCli.js');
if (invokedAsCli) {
  main().catch((error: unknown) => {
    console.error(`lifecycle: failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
