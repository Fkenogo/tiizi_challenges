/**
 * TIIZI S1 CORR-003 — safe inspection of local V2 preview identities.
 *
 * Usage:
 *   npm run preview:v2-auth:list [-- --project <id>]
 *
 * LOCAL Auth emulator only. Displays email/uid/disabled status.
 * NEVER displays passwords, hashes, tokens, or secrets.
 */
import {
  listPreviewAccounts,
  resolveEmulatorTarget,
  resolveProjectId,
} from './previewV2Auth.js';

function flagValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const target = resolveEmulatorTarget({ nodeEnv: process.env.NODE_ENV });
  const projectId = resolveProjectId({ cliProject: flagValue('--project') });
  const accounts = await listPreviewAccounts({ projectId, target });

  console.log(`V2 preview accounts on ${target.url} (project ${projectId})`);
  if (accounts.length === 0) {
    console.log('  (none — run npm run preview:v2-auth:reset first)');
    return;
  }
  for (const account of accounts) {
    console.log(`  ${account.email}  uid=${account.uid}  disabled=${account.disabled}`);
  }
}

main().catch((error: unknown) => {
  console.error(`preview:v2-auth:list failed: ${(error as Error).message}`);
  process.exit(1);
});
