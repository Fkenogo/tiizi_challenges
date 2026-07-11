import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Phase 7: read-only static audit. Verifies every navigate()/<Link to>
// destination declared as a literal or template-string prefix resolves to a
// route actually registered in App.tsx (accounting for dynamic :param
// segments), and that the catch-all/legal/protected-route scaffolding is
// present. This never touches Firestore or a running app — it only reads
// source files.

const appTsx = readFileSync('src/App.tsx', 'utf8');

// ── Declared routes ───────────────────────────────────────────────────────
const declaredRoutes = [...appTsx.matchAll(/path="([^"]+)"/g)].map((m) => m[1]);
assert.ok(declaredRoutes.includes('*'), 'App.tsx must register a catch-all "*" route for unknown URLs');
assert.match(
  appTsx.split('\n').find((l) => l.includes('path="*"')) ?? '',
  /NotFoundScreen/,
  'Catch-all route must render NotFoundScreen',
);

const routePatterns = declaredRoutes
  .filter((r) => r !== '*')
  .map((r) => new RegExp('^' + r.replace(/:[a-zA-Z]+/g, '[^/]+').replace(/[.]/g, '\\.') + '$'));

function resolves(pathOnly: string): boolean {
  return routePatterns.some((p) => p.test(pathOnly));
}

// ── Collect navigate()/<Link to> destinations from src/ ──────────────────
function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, files);
    else if (/\.(tsx|ts)$/.test(entry)) files.push(full);
  }
  return files;
}

const sourceFiles = walk('src');
const destPattern = /navigate\(\s*[`'"]([^`'"]+)|to=[`'"]([^`'"]+)/g;
const knownJsDocFalsePositives = new Set(['/detail', '/exercises/push-ups', '/groups/create', '/settings']);
// The extraction regex above uses a simple non-quote character class, so it
// truncates early on template literals containing a *nested* template with
// its own quotes (e.g. `/app/signup${params.get('next') ? `?next=...` : ''}`).
// These were manually verified against App.tsx (see Phase 7 route audit) to
// resolve to declared routes (/app/signup, /app/login, /app/create-challenge,
// /app/challenges) with a query-string suffix — not a full JS parser's job.
const knownNestedTemplateFalsePositives = new Set([
  "/app/signup${params.get(",
  "/app/login${params.get(",
  '/app/create-challenge${cleanQuery ? ',
  '/app/challenges${activeGroupId ? ',
]);

let checked = 0;
const unresolved: string[] = [];

for (const file of sourceFiles) {
  const content = readFileSync(file, 'utf8');
  for (const match of content.matchAll(destPattern)) {
    const raw = match[1] ?? match[2];
    if (!raw || !raw.startsWith('/')) continue;
    if (knownJsDocFalsePositives.has(raw) || knownNestedTemplateFalsePositives.has(raw)) continue;
    // Replace every `${...}` template expression with a single dynamic path
    // segment placeholder, then drop the query string, so a destination like
    // `/app/challenge/${item.id}?groupId=${id}` becomes `/app/challenge/PARAM`
    // and can be matched against the declared `:id`-style route patterns.
    const normalized = raw
      .replace(/\$\{[^}]*\}/g, 'PARAM')
      .split('?')[0]
      .replace(/\/$/, '') || '/';
    checked += 1;
    // A trailing "PARAM" with no preceding "/" is a query-string suffix
    // (e.g. `/app/signup${params.get('next') ? '?next=...' : ''}`), not a
    // path segment — fall back to checking the path with that suffix
    // stripped entirely.
    const withoutTrailingSuffix = normalized.replace(/(?<!\/)PARAM$/, '');
    if (!resolves(normalized) && !resolves(withoutTrailingSuffix)) {
      unresolved.push(`${raw} (in ${file})`);
    }
  }
}

assert.equal(
  unresolved.length,
  0,
  `Found ${unresolved.length} navigate()/<Link to> destination(s) with no matching declared route:\n${unresolved.join('\n')}`,
);

// ── Legal / install / history routes must be public or correctly gated ────
const publicRoutes = ['/terms', '/privacy', '/install'];
for (const path of publicRoutes) {
  const line = appTsx.split('\n').find((l) => l.includes(`path="${path}"`));
  assert.ok(!!line, `Public route ${path} must be registered`);
  assert.ok(
    !!line && !line.includes('RequireOnboardedRoute') && !line.includes('RequireOnboardingRoute') && !line.includes('AdminRoute'),
    `${path} must remain public (no auth/onboarding/admin gate)`,
  );
}

const historyLine = appTsx.split('\n').find((l) => l.includes('path="/app/challenges/history"'));
assert.ok(!!historyLine, '/app/challenges/history must be registered');
assert.match(historyLine ?? '', /RequireOnboardedRoute/, '/app/challenges/history must require completed onboarding');

// ── Admin routes stay behind AdminRoute, never behind the plain onboarding gate ──
// Pure `<Navigate>` redirect stubs (e.g. a renamed admin page pointing at its
// new path) are exempt — the destination path they redirect to is itself
// checked below when it's declared as its own AdminRoute-gated route.
const adminLines = appTsx.split('\n').filter((l) => l.includes('path="/app/admin') && !l.includes('<Navigate'));
assert.ok(adminLines.length > 0, 'App.tsx must register admin routes');
for (const line of adminLines) {
  assert.match(line, /AdminRoute/, `Admin route line must be wrapped in AdminRoute: ${line.trim()}`);
}

console.log(`route-link audit passed (${checked} destinations checked, ${declaredRoutes.length - 1} routes declared)`);
