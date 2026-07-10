/**
 * Guard script: pre-beta legal routing, 404 handling, and ErrorBoundary safety net.
 * Verifies:
 *   - /terms and /privacy are registered as public routes (no ProtectedRoute)
 *   - SignupScreen links to both
 *   - the catch-all route no longer silently redirects to /app/flow
 *   - NotFoundScreen exists and is used as the catch-all
 *   - ErrorBoundary is mounted around the routing subtree in App.tsx
 *   - ErrorBoundary's fallback has a reload action
 * Run: npx tsx scripts/testLegalRoutingAndSafetyGuards.ts
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

const appTsx = read('src/App.tsx');
const signupScreen = read('src/features/Auth/SignupScreen.tsx');
const notFoundScreen = read('src/features/NotFound/NotFoundScreen.tsx');
const errorBoundary = read('src/components/ErrorBoundary.tsx');
const termsScreen = read('src/features/Legal/TermsScreen.tsx');
const privacyScreen = read('src/features/Legal/PrivacyScreen.tsx');

// ── 1: /terms and /privacy are registered, public routes ─────────────────────
console.log('\n[1] /terms and /privacy routes exist and are public');

const termsRouteLine = appTsx.split('\n').find((l) => l.includes('path="/terms"'));
const privacyRouteLine = appTsx.split('\n').find((l) => l.includes('path="/privacy"'));

assert('App.tsx imports TermsScreen', appTsx.includes('TermsScreen'));
assert('App.tsx imports PrivacyScreen', appTsx.includes('PrivacyScreen'));
assert('/terms route exists', !!termsRouteLine, 'no route with path="/terms" found');
assert('/privacy route exists', !!privacyRouteLine, 'no route with path="/privacy" found');
assert(
  '/terms route is not wrapped in ProtectedRoute',
  !!termsRouteLine && !termsRouteLine.includes('ProtectedRoute'),
  '/terms must be public — no login required',
);
assert(
  '/privacy route is not wrapped in ProtectedRoute',
  !!privacyRouteLine && !privacyRouteLine.includes('ProtectedRoute'),
  '/privacy must be public — no login required',
);

// ── 2: SignupScreen links to Terms and Privacy ────────────────────────────────
console.log('\n[2] SignupScreen links to Terms and Privacy');
assert(
  'SignupScreen contains agreement copy',
  /agree to our/i.test(signupScreen),
  'must show "By signing up, you agree to our Terms and Privacy Policy."',
);
assert(
  "SignupScreen navigates to /terms",
  signupScreen.includes("navigate('/terms')"),
  'Terms must be a clickable link/button navigating to /terms',
);
assert(
  "SignupScreen navigates to /privacy",
  signupScreen.includes("navigate('/privacy')"),
  'Privacy Policy must be a clickable link/button navigating to /privacy',
);

// ── 3: Terms/Privacy copy is Tiizi-specific, not generic pilot boilerplate ───
console.log('\n[3] Terms/Privacy copy covers Tiizi-specific topics');
const termsCoverage = [
  /group/i, /challenge/i, /activity/i, /wellness/i, /install/i, /invite/i,
  /donation/i, /medical advice/i,
];
for (const pattern of termsCoverage) {
  assert(`TermsScreen mentions ${pattern}`, pattern.test(termsScreen));
}
const privacyCoverage = [
  /group/i, /challenge/i, /activity/i, /wellness/i, /profile/i,
  /retain|retention/i, /security/i, /contact|support@/i,
];
for (const pattern of privacyCoverage) {
  assert(`PrivacyScreen mentions ${pattern}`, pattern.test(privacyScreen));
}
assert(
  'TermsScreen flags founder/legal review is still required',
  /legal review|not.*legally certified|lawyer/i.test(termsScreen),
);
assert(
  'PrivacyScreen flags founder/legal review is still required',
  /legal review|not.*legally certified|lawyer/i.test(privacyScreen),
);

// ── 4: Catch-all no longer redirects to /app/flow ─────────────────────────────
console.log('\n[4] Catch-all route behavior');
const catchAllLine = appTsx.split('\n').find((l) => l.includes('path="*"'));
assert('Catch-all route exists', !!catchAllLine);
assert(
  'Catch-all no longer redirects to /app/flow',
  !!catchAllLine && !catchAllLine.includes('/app/flow'),
  'unknown URLs must not silently teleport to /app/flow',
);
assert(
  'Catch-all renders NotFoundScreen',
  !!catchAllLine && catchAllLine.includes('NotFoundScreen'),
);
assert('App.tsx imports NotFoundScreen', appTsx.includes('NotFoundScreen'));

// ── 5: NotFoundScreen exists and has the required content ────────────────────
console.log('\n[5] NotFoundScreen content');
assert('NotFoundScreen says "Page not found"', /Page not found/i.test(notFoundScreen));
assert('NotFoundScreen has a "Go to Tiizi" CTA', /Go to Tiizi/i.test(notFoundScreen));
assert(
  'NotFoundScreen routes based on auth state',
  notFoundScreen.includes('isAuthenticated'),
  'should route to /app/home when logged in, /app/welcome otherwise',
);

// ── 6: ErrorBoundary is mounted around the routing subtree ───────────────────
console.log('\n[6] ErrorBoundary is mounted in App.tsx');
assert('App.tsx imports ErrorBoundary', appTsx.includes('ErrorBoundary'));
assert(
  'ErrorBoundary wraps the Routes subtree',
  /<ErrorBoundary>[\s\S]*<Routes>[\s\S]*<\/Routes>[\s\S]*<\/ErrorBoundary>/.test(appTsx),
  'ErrorBoundary must wrap <Routes> so render crashes anywhere in routing are caught',
);
assert(
  'ErrorBoundary is mounted inside BrowserRouter (has router context)',
  /<BrowserRouter>[\s\S]*<ErrorBoundary>/.test(appTsx),
);
assert(
  'ErrorBoundary is mounted inside AuthProvider (does not break auth context)',
  /<AuthProvider>[\s\S]*<ErrorBoundary>/.test(appTsx),
);

// ── 7: ErrorBoundary fallback has a reload action ─────────────────────────────
console.log('\n[7] ErrorBoundary fallback quality');
assert(
  'ErrorBoundary fallback calls window.location.reload()',
  errorBoundary.includes('window.location.reload()'),
);
assert(
  'ErrorBoundary fallback has a "Reload app" action',
  /Reload app/i.test(errorBoundary),
);
assert(
  'ErrorBoundary fallback has a "Go home" action',
  /Go home/i.test(errorBoundary),
);
assert(
  'ErrorBoundary fallback shows a friendly message',
  /Something went wrong/i.test(errorBoundary),
);

// ── Summary ────────────────────────────────────────────────────────────────────
console.log(`\n────────────────────────────────────────`);
console.log(`  ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error(`\n  ✗ Guard checks failed — fix the issues above.`);
  process.exit(1);
} else {
  console.log(`\n  ✓ All legal routing / 404 / ErrorBoundary safety guards passed.`);
}
