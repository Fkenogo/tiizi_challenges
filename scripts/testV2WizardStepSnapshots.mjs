/**
 * TIIZI-FER-P5T-2-S1 behaviour-preservation gate (run: npm run test:v2-wizard-snapshots).
 * Renders the member Wizard steps over fixed Together/Race/Streak states and
 * compares to the golden generated from the pre-extraction Wizard.
 * `--update` rewrites the golden (only for an intentional member-Wizard change).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const golden = join(root, 'scripts', 'fixtures', 'wizardStepSnapshots.golden.json');
for (const key of ['API_KEY', 'AUTH_DOMAIN', 'PROJECT_ID', 'STORAGE_BUCKET', 'MESSAGING_SENDER_ID', 'APP_ID']) {
  process.env[`VITE_FIREBASE_${key}`] ??= 'harness-placeholder';
}
const originalError = console.error;
console.error = (...args) => { if (!String(args[0]).includes('useLayoutEffect does nothing on the server')) originalError(...args); };
const server = await createServer({
  root, configFile: false, appType: 'custom', logLevel: 'error', server: { middlewareMode: true },
  resolve: { alias: [{ find: /^(\.\.?\/)+hooks\/useAuth$/, replacement: join(root, 'scripts/fixtures/wizardHarnessAuthStub.ts') }] },
  esbuild: { jsx: 'automatic' },
});
let snapshots;
try {
  snapshots = (await server.ssrLoadModule('/scripts/wizardStepSnapshots.tsx')).buildSnapshots();
} finally {
  await server.close();
}
const actual = JSON.stringify(snapshots, null, 1) + '\n';
if (process.argv.includes('--update')) {
  writeFileSync(golden, actual);
  console.log(`wizard snapshots: golden written (${Object.keys(snapshots).length} entries)`);
  process.exit(0);
}
if (!existsSync(golden)) { console.error('wizard snapshots: golden missing'); process.exit(1); }
const expected = JSON.parse(readFileSync(golden, 'utf8'));
const diffs = [];
for (const key of new Set([...Object.keys(expected), ...Object.keys(snapshots)])) {
  if (JSON.stringify(expected[key]) !== JSON.stringify(snapshots[key])) diffs.push(key);
}
if (diffs.length) {
  console.error(`wizard snapshots: ${diffs.length} entries differ from the pre-extraction golden:\n  ${diffs.slice(0, 20).join('\n  ')}`);
  process.exit(1);
}
console.log(`wizard snapshots: all ${Object.keys(snapshots).length} entries identical to the pre-extraction golden`);
