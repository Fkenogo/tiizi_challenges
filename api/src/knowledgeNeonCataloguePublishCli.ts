import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPool, databaseUrl } from './db.js';
import type { S6Candidate, S6Inventory } from './knowledgeCatalogueImport.js';
import {
  executeRemoteNeonCataloguePublish,
  remoteNeonAllowlistFromEnv,
  validateRemoteNeonTarget,
  verifyAuthoritativeNeonTarget,
  verifyRemoteNeonBaseline,
  type RemoteNeonTargetConfirmation,
} from './knowledgeNeonCataloguePublish.js';

/**
 * Governed remote Neon S6 Catalogue publication CLI (TIIZI-COST-004A).
 *
 * Dry-run by default. Never prints connection strings, credentials, or secrets.
 *
 * Required environment allowlist:
 *   DATABASE_URL=... (direct Neon endpoint, sslmode=verify-full + CA)
 *   TIIZI_REMOTE_DB_HOST=...
 *   TIIZI_REMOTE_DB_PROJECT=...
 *   TIIZI_REMOTE_DB_PROJECT_ID=... (optional; required for project-scoped NEON_API_KEY)
 *   TIIZI_REMOTE_DB_BRANCH=...
 *   TIIZI_REMOTE_DB_NAME=...
 *
 * Authoritative project/branch verification (required for --apply):
 *   NEON_API_KEY (authenticated Neon REST API verification; mandatory for --apply)
 *   --provisioning-receipt <path> (or TIIZI_NEON_PROVISIONING_RECEIPT) optional audit evidence only
 *
 * Usage:
 *   npm run knowledge:neon-publish -- \
 *     --target-provider neon \
 *     --target-project <project> \
 *     --target-branch <branch> \
 *     --target-db <database> \
 *     --confirm-target neon:<project>:<branch>:<database> \
 *     [--provisioning-receipt <path>] \
 *     [--dry-run | --apply]
 */

function parseArgs(argv: string[]): {
  confirmation: RemoteNeonTargetConfirmation;
  mode: 'dry-run' | 'apply';
} {
  let provider = '';
  let project = '';
  let projectId = '';
  let branch = '';
  let database = '';
  let confirmTarget = '';
  let provisioningReceiptPath = '';
  let apply = false;
  let dryRun = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const readValue = (flag: string): string => {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        throw new Error(`Missing value for ${flag}`);
      }
      i += 1;
      return next;
    };
    switch (arg) {
      case '--target-provider':
        provider = readValue(arg);
        break;
      case '--target-project':
        project = readValue(arg);
        break;
      case '--target-project-id':
        projectId = readValue(arg);
        break;
      case '--target-branch':
        branch = readValue(arg);
        break;
      case '--target-db':
        database = readValue(arg);
        break;
      case '--confirm-target':
        confirmTarget = readValue(arg);
        break;
      case '--provisioning-receipt':
        provisioningReceiptPath = readValue(arg);
        break;
      case '--apply':
        apply = true;
        break;
      case '--dry-run':
        dryRun = true;
        break;
      default:
        throw new Error(
          `Unknown argument '${arg}'. Accepted flags: --target-provider, --target-project, --target-branch, --target-db, --confirm-target, --provisioning-receipt, --dry-run (default), --apply`,
        );
    }
  }

  if (apply && dryRun) {
    throw new Error('Choose either --dry-run or --apply');
  }

  return {
    confirmation: {
      provider,
      project,
      projectId: projectId || undefined,
      branch,
      database,
      confirmTarget,
      provisioningReceiptPath: provisioningReceiptPath || undefined,
    },
    mode: apply ? 'apply' : 'dry-run',
  };
}

async function main(): Promise<void> {
  const { confirmation, mode } = parseArgs(process.argv.slice(2));
  const rawUrl = databaseUrl();
  const allowlist = remoteNeonAllowlistFromEnv();

  // Fail closed before opening any database connection.
  const validatedParts = validateRemoteNeonTarget(rawUrl, confirmation, allowlist);
  const authStatus = await verifyAuthoritativeNeonTarget(validatedParts, mode, {
    projectId: confirmation.projectId,
    receiptPath: confirmation.provisioningReceiptPath,
  });

  const base = fileURLToPath(new URL('../../docs/programme/working/s6-content', import.meta.url));
  const [candidate, inventory] = await Promise.all([
    readFile(resolve(base, 'tiizi-118-activity-reconciled-content.json'), 'utf8').then(
      (text) => JSON.parse(text) as S6Candidate,
    ),
    readFile(resolve(base, 'activity-master-inventory.json'), 'utf8').then(
      (text) => JSON.parse(text) as S6Inventory,
    ),
  ]);
  const expectedCodes = new Set<string>(
    (candidate.records ?? []).map((record) => record.activityCode).filter(Boolean),
  );

  const db = createPool(rawUrl);
  try {
    const target = await verifyRemoteNeonBaseline(db, validatedParts, authStatus, expectedCodes);
    const result = await executeRemoteNeonCataloguePublish(db, target, candidate, inventory, mode);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

    if (!result.import.readyForIngestion) {
      process.exitCode = 1;
      return;
    }
    if ('errors' in result.publication && result.publication.errors.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    await db.close();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
