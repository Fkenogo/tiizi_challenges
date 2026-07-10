/**
 * Guard script: static analysis for the Share Tiizi / Install screen feature.
 *
 * Checks:
 * 1. Android instructions include all label variants (Install, Install app,
 *    Install and create shortcut, Add to Home screen)
 * 2. Manufacturer/browser variability note is present
 * 3. Native install button text "Install Tiizi" exists
 * 4. beforeinstallprompt is handled
 * 5. iOS instructions are not removed
 * 6. Share Tiizi entry points (Profile, WorkoutLogged, GroupDetail) import
 *    ShareTiiziCard and route to the install page
 * 7. ShareTiiziCard itself uses the canonical install URL
 * 8. /install route is registered in App.tsx as a public route (no ProtectedRoute wrapper)
 *
 * Run: npx tsx scripts/testShareTiiziInstallGuards.ts
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, details?: string) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label}${details ? ` — ${details}` : ''}`);
    failed++;
  }
}

const install    = read('src/features/Install/InstallScreen.tsx');
const shareTiizi = read('src/components/ShareTiiziCard.tsx');
const profile    = read('src/features/Profile/ProfileScreen.tsx');
const workout    = read('src/features/Workouts/WorkoutLoggedScreen.tsx');
const group      = read('src/features/Groups/GroupDetailScreen.tsx');
const app        = read('src/App.tsx');

// ── 1: Android label variants ─────────────────────────────────────────────────
console.log('\n[1] Android instructions include all install label variants');
assert(
  'Mentions "Install" (bare)',
  /Install[^a-zA-Z]/.test(install),
  'Must include bare "Install" option',
);
assert(
  'Mentions "Install app"',
  install.includes('Install app'),
  'Must include "Install app" as a label variant',
);
assert(
  'Mentions "Install and create shortcut"',
  install.includes('Install and create shortcut'),
  'Must include "Install and create shortcut" for Samsung devices',
);
assert(
  'Mentions "Add to Home screen" in Android section',
  install.includes('Add to Home screen'),
  'Must include "Add to Home screen" as a label variant',
);

// ── 2: Variability note ───────────────────────────────────────────────────────
console.log('\n[2] Manufacturer / browser variability note');
assert(
  'Contains variability note',
  /Menu names may vary/.test(install) ||
  /may vary depending on your Android/.test(install),
  'Must mention that menu names vary by phone/browser/manufacturer',
);
assert(
  'References manufacturer',
  /manufacturer/.test(install),
  'Variability note must mention "manufacturer"',
);

// ── 3: Native install prompt ──────────────────────────────────────────────────
console.log('\n[3] Native install prompt (beforeinstallprompt)');
assert(
  'Listens for beforeinstallprompt',
  install.includes('beforeinstallprompt'),
  'Must add event listener for beforeinstallprompt',
);
assert(
  'Calls prompt() on the stored event',
  /\.prompt\(\)/.test(install),
  'Must call .prompt() on the deferred event',
);
assert(
  'Native install button text "Install Tiizi" exists',
  install.includes('Install Tiizi'),
  'Must render a button labelled "Install Tiizi"',
);
assert(
  'Clears deferred prompt after resolution',
  /deferredPrompt\.current\s*=\s*null/.test(install),
  'Must clear the stored event after the prompt resolves',
);

// ── 4: Reassurance copy ───────────────────────────────────────────────────────
console.log('\n[4] Reassurance copy after install');
assert(
  'Contains "appear like any other app"',
  install.includes('appear like any other app'),
  'Must reassure user that Tiizi will appear like any other app',
);
assert(
  'Contains "Home Screen" (reassurance)',
  install.includes('Home Screen'),
  'Must mention opening from the Home Screen',
);

// ── 5: iOS instructions preserved ────────────────────────────────────────────
console.log('\n[5] iOS Safari instructions not removed');
assert(
  'iOS branch still present',
  install.includes("platform === 'ios'"),
  'iOS platform branch must still exist',
);
assert(
  'iOS "Add to Home Screen" step still present',
  install.includes('Add to Home Screen'),
  'iOS step "Add to Home Screen" must be present',
);
assert(
  'iOS "Share icon" step still present',
  install.includes('Share icon'),
  'iOS step mentioning the Share icon must be present',
);

// ── 6: Entry points import ShareTiiziCard ────────────────────────────────────
console.log('\n[6] Share Tiizi entry points wire up ShareTiiziCard');
assert(
  'ProfileScreen imports ShareTiiziCard',
  profile.includes('ShareTiiziCard'),
  'ProfileScreen must import and render ShareTiiziCard',
);
assert(
  'WorkoutLoggedScreen imports ShareTiiziCard',
  workout.includes('ShareTiiziCard'),
  'WorkoutLoggedScreen must import and render ShareTiiziCard',
);
assert(
  'GroupDetailScreen imports ShareTiiziCard',
  group.includes('ShareTiiziCard'),
  'GroupDetailScreen must import and render ShareTiiziCard',
);
assert(
  'GroupDetailScreen guards ShareTiiziCard behind membershipStatus === joined',
  group.includes("membershipStatus === 'joined'") && group.includes('ShareTiiziCard'),
  'ShareTiiziCard in GroupDetail must be gated on joined membership',
);

// ── 7: ShareTiiziCard uses canonical install URL ──────────────────────────────
console.log('\n[7] ShareTiiziCard uses canonical install URL');
assert(
  'ShareTiiziCard has tiizichallenges.com/install URL',
  shareTiizi.includes('tiizichallenges.com/install'),
  'Must share the /install URL, not the app root',
);
assert(
  'ShareTiiziCard uses navigator.share',
  shareTiizi.includes('navigator.share'),
  'Must attempt navigator.share before clipboard fallback',
);
assert(
  'ShareTiiziCard has clipboard fallback',
  shareTiizi.includes('navigator.clipboard.writeText'),
  'Must fall back to clipboard copy when navigator.share is unavailable',
);

// ── 8: /install is a public route ────────────────────────────────────────────
console.log('\n[8] /install registered as a public route in App.tsx');
assert(
  'App.tsx imports InstallScreen',
  app.includes('InstallScreen'),
  'App.tsx must lazy-import InstallScreen',
);
// The /install route must appear without ProtectedRoute wrapping it.
// Check that the route line itself does not include ProtectedRoute inline.
const installRouteLine = app
  .split('\n')
  .find((l) => l.includes('path="/install"'));
assert(
  '/install route exists',
  !!installRouteLine,
  'A route with path="/install" must be registered',
);
assert(
  '/install route is not wrapped in ProtectedRoute',
  !!installRouteLine && !installRouteLine.includes('ProtectedRoute'),
  '/install must be a public route — no ProtectedRoute on the same line',
);

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n────────────────────────────────────────`);
console.log(`  ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error(`\n  ✗ Guard checks failed — fix the issues above.`);
  process.exit(1);
} else {
  console.log(`\n  ✓ All Share Tiizi / Install guards passed.`);
}
