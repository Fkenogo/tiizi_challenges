import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * TIIZI S1 — V2 experience boundary guard (CORR-001: runtime crossover).
 *
 * New V2 experience code (src/v2/**) must not import frozen V1
 * experience modules AND must never route a V2 journey through V1
 * Product Experience at runtime. The first S1 pass caught imports
 * but missed the runtime leak: the shared session gate sent
 * unauthenticated /v2/* visits to the V1 login experience.
 *
 * Allowed in src/v2/**:
 * - brand assets (public/ paths, src/v2/brand)
 * - neutral technical primitives (deep Screen/Section/LoadingSpinner,
 *   Mobile primitives, ErrorBoundary)
 * - governed infrastructure/domain modules (AuthContext, ProtectedRoute
 *   WITH an explicit V2 entry, useAuth, lib/, services/, api/)
 *
 * Forbidden: BottomNav, V1 Home/Groups/Challenges/Profile/Onboarding
 * composition, V1 auth screens (LoginScreen/SignupScreen via
 * src/features/Auth), V1 journey gates (RequireOnboardedRoute,
 * RequireOnboardingRoute, RequireGroupRoute, RequireProfileSetup),
 * V1 operator authority (AdminRoute), V1 challenge navigation screens.
 *
 * Forbidden at runtime: /app/login or /app/signup as V2 auth entry,
 * any /app/* return path emitted from V2 composition, any V2
 * navigation into V1 Home/Profile/Groups/Challenges journeys.
 */

const root = new URL('../', import.meta.url);
const rootPath = fileURLToPath(root);
const fromRoot = (path) => new URL(path, root);
const read = (path) => readFileSync(fromRoot(path), 'utf8');
const exists = (path) => existsSync(fromRoot(path));

let failures = 0;
const check = (name, condition, detail) => {
  if (condition) console.log(`  ok: ${name}`);
  else {
    failures += 1;
    console.error(`  FAIL: ${name}`);
    if (detail) console.error(detail);
  }
};

const walk = (directory) => {
  if (!exists(directory)) return [];
  return readdirSync(fromRoot(directory), { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
};

const v2Files = walk('src/v2').filter((path) => /\.(ts|tsx)$/.test(path));

// Frozen V1 experience manifest. `named` restricts the match to a binding;
// absence of `named` forbids any import from that path.
const FROZEN_V1_EXPERIENCE_IMPORTS = [
  { path: 'src/components/Layout', named: 'BottomNav' },
  { path: 'src/features/Home' },
  { path: 'src/features/Groups' },
  { path: 'src/features/Exercises' },
  { path: 'src/features/Wellness' },
  { path: 'src/features/Workouts' },
  { path: 'src/features/Profile' },
  { path: 'src/features/Onboarding' },
  { path: 'src/features/Welcome' },
  { path: 'src/features/QuickActions' },
  { path: 'src/features/Flows' },
  { path: 'src/features/Library' },
  { path: 'src/features/Notifications' },
  { path: 'src/features/Help' },
  { path: 'src/features/Share' },
  { path: 'src/features/Donate' },
  { path: 'src/features/Install' },
  { path: 'src/features/Mockups' },
  { path: 'src/features/Challenges/CreateChallengeWizard' },
  { path: 'src/features/Challenges/WellnessTemplate' },
  { path: 'src/features/Challenges/BrowseChallenges' },
  { path: 'src/features/Challenges/SuggestedChallenges' },
  { path: 'src/features/Challenges/ChallengePreview' },
  { path: 'src/features/Challenges/CompetitiveChallenge' },
  { path: 'src/features/Challenges/CollectiveChallenge' },
  { path: 'src/features/Challenges/StreakChallenge' },
  { path: 'src/features/Challenges/ChallengeLeaderboard' },
  { path: 'src/features/Challenges/ChallengeCompleted' },
  { path: 'src/features/Challenges/CompletedChallenges' },
  { path: 'src/features/Challenges/ChallengeDetailScreen' },
  { path: 'src/features/Challenges/V2ChallengeDetailScreen' },
  { path: 'src/features/Challenges/V2ChallengesScreen' },
  { path: 'src/features/Challenges/V2' },
  { path: 'src/components/Auth/RequireOnboardedRoute' },
  { path: 'src/components/Auth/RequireOnboardingRoute' },
  { path: 'src/components/Auth/RequireGroupRoute' },
  { path: 'src/components/Auth/RequireProfileSetup' },
  { path: 'src/components/Auth/AdminRoute' },
  // CORR-001: V1 auth screens are frozen experience, never V2 entry.
  { path: 'src/features/Auth' },
];

function frozenImportsFor(path) {
  const source = read(path);
  const imports = [...source.matchAll(/import\s+(?:type\s+)?([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g)];
  return imports.flatMap((match) => {
    const bindings = match[1];
    const importSource = match[2];
    if (!importSource.startsWith('.') && !importSource.startsWith('@/') && !importSource.startsWith('src/')) return [];
    const resolvedSource = importSource.startsWith('.')
      ? relative(rootPath, resolve(rootPath, dirname(path), importSource)).replaceAll('\\', '/')
      : importSource.replace(/^@\//, 'src/');
    return FROZEN_V1_EXPERIENCE_IMPORTS.flatMap((frozen) => {
      if (!(resolvedSource === frozen.path || resolvedSource.startsWith(`${frozen.path}/`))) return [];
      if (!frozen.named) return [`${path}::${frozen.path}::*`];
      return new RegExp(`\\b${frozen.named}\\b`).test(bindings)
        ? [`${path}::${frozen.path}::${frozen.named}`]
        : [];
    });
  });
}

console.log('S1 V2 experience boundary guard');

check('V2 composition root exists', exists('src/v2/routes.tsx'));
check(
  'V2 routes are mounted as a sibling of /app/* (never nested in the V1 shell)',
  read('src/App.tsx').includes('<Route path="/v2/*"'),
);
check(
  'V1 shell containment absent: no BottomNav reference inside src/v2',
  !v2Files.some((path) => /\bBottomNav\b/.test(read(path))),
);
check(
  'V1 return paths absent: no "/app/" route strings inside src/v2',
  !v2Files.some((path) => read(path).includes('"/app/') || read(path).includes("'/app/")),
);

// CORR-001 — runtime crossover: the import guard alone missed the
// unauthenticated redirect into the V1 login experience.
const v2Sources = v2Files.map((path) => ({ path, source: read(path) }));
const hasMatch = (pattern) => v2Sources.filter(({ source }) => pattern.test(source)).map(({ path }) => path);

const v1AuthEntries = hasMatch(/\/app\/login|\/app\/signup/);
check(
  'no V1 auth entry (/app/login, /app/signup) referenced from src/v2',
  v1AuthEntries.length === 0,
  v1AuthEntries.length > 0 ? `    references:\n${v1AuthEntries.map((v) => `    - ${v}`).join('\n')}` : undefined,
);

// Frozen V1 journey/gate identifiers must not appear in V2 composition
// at all (import or usage). Generic lowercase words in comments are
// fine; these PascalCase bindings are V1 experience surface.
const FROZEN_V1_IDENTIFIERS = [
  'LoginScreen',
  'SignupScreen',
  'WelcomeScreen',
  'OnboardingSlides',
  'RequireOnboardedRoute',
  'RequireOnboardingRoute',
  'RequireGroupRoute',
  'RequireProfileSetup',
  'AdminRoute',
];
const identifierViolations = FROZEN_V1_IDENTIFIERS.flatMap((name) => {
  const pattern = new RegExp(`\\b${name}\\b`);
  return hasMatch(pattern).map((path) => `${path}::${name}`);
});
check(
  'no frozen V1 journey/gate identifiers used inside src/v2',
  identifierViolations.length === 0,
  identifierViolations.length > 0 ? `    violations:\n${identifierViolations.map((v) => `    - ${v}`).join('\n')}` : undefined,
);

// V2 must own a complete visible auth entry boundary.
const v2RoutesSource = exists('src/v2/routes.tsx') ? read('src/v2/routes.tsx') : '';
check('V2 sign-in route exists (sign-in)', v2RoutesSource.includes('path="sign-in"'));
check('V2 sign-up route exists (sign-up)', v2RoutesSource.includes('path="sign-up"'));
check(
  'V2 auth entry is public (outside the authenticated scope)',
  v2RoutesSource.indexOf('path="sign-in"') < v2RoutesSource.indexOf('element={<V2ProtectedScope')
  && v2RoutesSource.indexOf('path="sign-up"') < v2RoutesSource.indexOf('element={<V2ProtectedScope'),
);
const v2GuardSource = exists('src/v2/auth/V2AuthGuard.tsx') ? read('src/v2/auth/V2AuthGuard.tsx') : '';
check(
  'V2 guard supplies its own entry (no V1 default)',
  v2GuardSource.includes("loginPath") && v2GuardSource.includes('/v2/sign-in'),
);

// The shared session gate must keep the configurable entry so V2 can
// supply its own without forking session truth. V1 default preserved.
const protectedRouteSource = exists('src/components/Auth/ProtectedRoute.tsx')
  ? read('src/components/Auth/ProtectedRoute.tsx')
  : '';
check(
  'shared session gate keeps a configurable entry (loginPath override)',
  protectedRouteSource.includes('loginPath'),
);

const violations = v2Files.flatMap(frozenImportsFor);
check(
  'zero frozen-V1 experience imports in new V2 shell',
  violations.length === 0,
  violations.length > 0 ? `    violations:\n${violations.map((v) => `    - ${v}`).join('\n')}` : undefined,
);

if (failures > 0) {
  console.error(`\nS1 V2 experience boundary guard: ${failures} failure(s).`);
  process.exitCode = 1;
} else {
  console.log('\nS1 V2 experience boundary guard: all passing.');
}
