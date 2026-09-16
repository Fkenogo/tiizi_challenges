/**
 * TIIZI S1 CORR-003 — reset the deterministic V2 local-preview identity.
 *
 * Usage:
 *   export TIIZI_V2_PREVIEW_PASSWORD='...'
 *   npm run preview:v2-auth:reset [-- --project <id>] [-- --host 127.0.0.1] [-- --port 9099]
 *
 * LOCAL Auth emulator only (loopback, fail-closed). Prints email/uid/
 * project/target for the preview report. NEVER prints the password.
 */
import {
  resolveEmulatorTarget,
  resolveProjectId,
  resetPreviewAccount,
} from './previewV2Auth.js';

function flagValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const target = resolveEmulatorTarget({
    host: flagValue('--host'),
    port: flagValue('--port'),
    nodeEnv: process.env.NODE_ENV,
  });
  const projectId = resolveProjectId({ cliProject: flagValue('--project') });
  const report = await resetPreviewAccount({
    projectId,
    target,
    password: process.env.TIIZI_V2_PREVIEW_PASSWORD,
  });

  console.log('V2 preview identity reset (LOCAL Auth emulator only)');
  console.log(`  emulator : ${report.target}`);
  console.log(`  project  : ${report.projectId}`);
  console.log(`  email    : ${report.email}`);
  console.log(`  uid      : ${report.uid}`);
  console.log(`  replaced : ${report.replaced ? 'yes (stale account removed)' : 'no (fresh create)'}`);
  console.log('  password : supplied via TIIZI_V2_PREVIEW_PASSWORD (not shown)');
  console.log('Next: npm run dev with VITE_USE_FIREBASE_EMULATORS=true, open /v2/today and sign in.');
}

main().catch((error: unknown) => {
  console.error(`preview:v2-auth:reset failed: ${(error as Error).message}`);
  process.exit(1);
});
