/**
 * Boundary-guard regression fixture.
 *
 * `AGENTS.md` §3 / the Pass-001 brief require that the guard itself be proved
 * to FAIL when a prohibited dependency, a `/v1` active route, or a `/v1`
 * client target is deliberately introduced. A guard that cannot fail is not a
 * guard.
 *
 * This fixture runs the guard's own check functions against synthetic module
 * maps: once in a clean state (expect no violations) and once per prohibited
 * change (expect the specific violation). It also proves the checks are
 * transitive, not direct-import-only.
 *
 * Run: `npm run test:boundary-regression`
 */

import {
  checkV2RuntimeIsolation,
  checkNoLegacyFirestoreAuthority,
  checkNoV1ApiRoutes,
  checkNoV1ClientTargets,
  runtimeClosure,
} from './boundaryGuard/guard.mjs';

let failures = 0;
function check(name, condition, detail) {
  if (condition) console.log(`  ok: ${name}`);
  else {
    failures += 1;
    console.error(`  FAIL: ${name}${detail ? `\n      ${detail}` : ''}`);
  }
}

const V2_ROOT = 'src/v2/routes.tsx';
const V1_ROOT = 'src/App.tsx';
const API_ROOT = 'api/src/app.ts';

// ---------------------------------------------------------------------------
// A. Clean baseline — the guard must not fire on a compliant tree.
// ---------------------------------------------------------------------------

const cleanModules = new Map([
  [V1_ROOT, `import { V1Screen } from './features/Home/V1Screen';\nimport { V2Routes } from './v2/routes';\nexport default function App() { return null; }`],
  ['src/features/Home/V1Screen.tsx', `export const V1Screen = () => null;`],
  ['src/shared/auth.ts', `export const useAuth = () => null;`],
  [V2_ROOT, `import { useAuth } from '../shared/auth';\nimport { apiFetch } from '../api/apiClient';\nexport const V2Routes = () => null;`],
  ['src/api/apiClient.ts', `export const API_PREFIX = '/api';\nexport const apiFetch = () => null;`],
]);

const cleanViolations = checkV2RuntimeIsolation(cleanModules, { v2Root: V2_ROOT, v1Root: V1_ROOT });
check('A1 clean tree: V2 isolation reports no violations', cleanViolations.length === 0, cleanViolations.join('; '));

// ---------------------------------------------------------------------------
// B. Prohibited: V2 imports an archived Product V1 feature module.
// ---------------------------------------------------------------------------

const directV1Import = new Map(cleanModules);
directV1Import.set(
  V2_ROOT,
  `import { V1Screen } from '../features/Home/V1Screen';\nexport const V2Routes = () => null;`,
);
const directViolations = checkV2RuntimeIsolation(directV1Import, { v2Root: V2_ROOT, v1Root: V1_ROOT });
check(
  'B1 guard FAILS on a direct V2 → V1 feature import',
  directViolations.some((v) => v.includes('src/features/Home/V1Screen.tsx')),
  directViolations.join('; '),
);

// ---------------------------------------------------------------------------
// C. Prohibited: TRANSITIVE V2 → shared → V1 reuse (not a direct import).
// ---------------------------------------------------------------------------

const transitiveV1Import = new Map(cleanModules);
transitiveV1Import.set(
  V2_ROOT,
  `import { helper } from '../shared/helper';\nexport const V2Routes = () => null;`,
);
transitiveV1Import.set(
  'src/shared/helper.ts',
  `import { V1Screen } from '../features/Home/V1Screen';\nexport const helper = V1Screen;`,
);
const transitiveViolations = checkV2RuntimeIsolation(transitiveV1Import, { v2Root: V2_ROOT, v1Root: V1_ROOT });
check(
  'C1 guard FAILS on a TRANSITIVE V2 → V1 reuse (proves traversal, not direct-import matching)',
  transitiveViolations.some((v) => v.includes('src/features/Home/V1Screen.tsx')),
  transitiveViolations.join('; '),
);

// ---------------------------------------------------------------------------
// D. Prohibited: a V2 runtime module routes to an `/app/*` browser path.
// ---------------------------------------------------------------------------

const appRouteTarget = new Map(cleanModules);
appRouteTarget.set(
  V2_ROOT,
  `export const V2Routes = () => null;\nexport const detailPath = (id) => \`/app/challenge/v2/\${id}\`;`,
);
const appRouteViolations = checkV2RuntimeIsolation(appRouteTarget, { v2Root: V2_ROOT, v1Root: V1_ROOT });
check(
  'D1 guard FAILS when V2 emits an /app/* browser route target',
  appRouteViolations.some((v) => v.includes('/app/challenge/v2/')),
  appRouteViolations.join('; '),
);

// ---------------------------------------------------------------------------
// E. Prohibited: V2 runtime reaches Firestore.
// ---------------------------------------------------------------------------

const v2Firestore = new Map(cleanModules);
v2Firestore.set(
  V2_ROOT,
  `import { getFirestore } from 'firebase/firestore';\nexport const V2Routes = () => null;`,
);
const firestoreViolations = checkNoLegacyFirestoreAuthority(v2Firestore, { v2Root: V2_ROOT, apiRoot: API_ROOT });
check(
  'E1 guard FAILS when V2 runtime reaches Firestore',
  firestoreViolations.some((v) => v.includes('reaches Firestore')),
  firestoreViolations.join('; '),
);

// ---------------------------------------------------------------------------
// F. Prohibited: the active API composition root reaches legacy Firestore authority.
// ---------------------------------------------------------------------------

const apiFirestoreAuthority = new Map(cleanModules);
apiFirestoreAuthority.set(
  API_ROOT,
  `import { createGroup } from './firestoreGroupAuthority.js';\nexport const buildApp = () => createGroup;`,
);
apiFirestoreAuthority.set(
  'api/src/firestoreGroupAuthority.ts',
  `import { getFirestore } from 'firebase-admin/firestore';\nexport const createGroup = getFirestore;`,
);
const apiAuthorityViolations = checkNoLegacyFirestoreAuthority(apiFirestoreAuthority, { v2Root: V2_ROOT, apiRoot: API_ROOT });
check(
  'F1 guard FAILS when active API registration reaches legacy Firestore authority',
  apiAuthorityViolations.some((v) => v.includes('api/src/firestoreGroupAuthority.ts')),
  apiAuthorityViolations.join('; '),
);

// ---------------------------------------------------------------------------
// G. Prohibited: an active API route is registered under `/v1`.
// ---------------------------------------------------------------------------

const apiModules = new Map([
  ['api/src/app.ts', `import { API_PREFIX } from './apiPrefix.js';\napp.get('/api/groups', () => {});\napp.get('/health', () => {});\napp.addHook('onRequest', () => request.url.startsWith(\`\${API_PREFIX}/\`));`],
  ['api/src/apiPrefix.ts', `export const API_PREFIX = '/api';`],
]);

const cleanRouteViolations = checkNoV1ApiRoutes(apiModules, { apiPrefixModule: 'api/src/apiPrefix.ts', authModule: 'api/src/app.ts' });
check('G1 clean API registration: no violations', cleanRouteViolations.length === 0, cleanRouteViolations.join('; '));

// The canonical prefix may legitimately be used as a template literal. That IS
// the /api namespace, so the guard must accept it rather than report it as a
// non-/api route (the canonical value itself is asserted separately).
const templatePrefixModules = new Map(apiModules);
templatePrefixModules.set(
  'api/src/app.ts',
  `import { API_PREFIX } from './apiPrefix.js';\napp.get(\`\${API_PREFIX}/today\`, () => {});\napp.get(\`\${API_PREFIX}/groups/:groupId\`, () => {});\napp.get('/health', () => {});\napp.addHook('onRequest', () => request.url.startsWith(\`\${API_PREFIX}/\`));`,
);
const templatePrefixViolations = checkNoV1ApiRoutes(templatePrefixModules, { apiPrefixModule: 'api/src/apiPrefix.ts', authModule: 'api/src/app.ts' });
check(
  'G1b guard ACCEPTS a route registered through the canonical ${API_PREFIX} template',
  templatePrefixViolations.length === 0,
  templatePrefixViolations.join('; '),
);

const v1RouteModules = new Map(apiModules);
v1RouteModules.set(
  'api/src/app.ts',
  `import { API_PREFIX } from './apiPrefix.js';\napp.get('/api/groups', () => {});\napp.get('/v1/groups', () => {});\napp.addHook('onRequest', () => request.url.startsWith(\`\${API_PREFIX}/\`));`,
);
const v1RouteViolations = checkNoV1ApiRoutes(v1RouteModules, { apiPrefixModule: 'api/src/apiPrefix.ts', authModule: 'api/src/app.ts' });
check(
  'G2 guard FAILS when a /v1 API route is registered',
  v1RouteViolations.some((v) => v.includes('/v1/groups')),
  v1RouteViolations.join('; '),
);

const nonApiRouteModules = new Map(apiModules);
nonApiRouteModules.set(
  'api/src/app.ts',
  `import { API_PREFIX } from './apiPrefix.js';\napp.get('/graphql', () => {});\napp.addHook('onRequest', () => request.url.startsWith(\`\${API_PREFIX}/\`));`,
);
const nonApiRouteViolations = checkNoV1ApiRoutes(nonApiRouteModules, { apiPrefixModule: 'api/src/apiPrefix.ts', authModule: 'api/src/app.ts' });
check(
  'G3 guard FAILS when a domain route escapes the /api namespace',
  nonApiRouteViolations.some((v) => v.includes('/graphql')),
  nonApiRouteViolations.join('; '),
);

const v1AuthHookModules = new Map(apiModules);
v1AuthHookModules.set(
  'api/src/app.ts',
  `app.get('/api/groups', () => {});\napp.addHook('onRequest', () => request.url.startsWith('/v1/'));`,
);
const v1AuthHookViolations = checkNoV1ApiRoutes(v1AuthHookModules, { apiPrefixModule: 'api/src/apiPrefix.ts', authModule: 'api/src/app.ts' });
check(
  'G4 guard FAILS when the auth hook still gates on a /v1 literal',
  v1AuthHookViolations.some((v) => v.includes('auth')),
  v1AuthHookViolations.join('; '),
);

// ---------------------------------------------------------------------------
// H. Prohibited: an active V2 API client contains a `/v1` request target.
// ---------------------------------------------------------------------------

const cleanClients = new Map([
  ['src/api/apiClient.ts', `export const API_PREFIX = '/api';`],
  ['src/api/groupsApi.ts', `import { API_PREFIX } from './apiClient';\nexport const fetchGroups = () => apiFetch(\`\${API_PREFIX}/groups\`);`],
]);
const cleanClientViolations = checkNoV1ClientTargets(cleanClients);
check('H1 clean API clients: no violations', cleanClientViolations.length === 0, cleanClientViolations.join('; '));

const v1Client = new Map(cleanClients);
v1Client.set('src/api/groupsApi.ts', `export const fetchGroups = () => apiFetch('/v1/groups');`);
const v1ClientViolations = checkNoV1ClientTargets(v1Client);
check(
  'H2 guard FAILS when an active V2 API client targets /v1',
  v1ClientViolations.some((v) => v.includes('src/api/groupsApi.ts')),
  v1ClientViolations.join('; '),
);

// ---------------------------------------------------------------------------
// I. Sanity: traversal excludes `import type` (TypeScript erases it).
// ---------------------------------------------------------------------------

const typeOnly = new Map([
  ['src/api/thing.ts', `import type { X } from '../features/Home/V1Screen';\nexport const thing: X = 1;`],
  ['src/features/Home/V1Screen.tsx', `export type X = number;`],
]);
check(
  'I1 runtime closure excludes type-only imports (type contracts are not runtime coupling)',
  !runtimeClosure(typeOnly, 'src/api/thing.ts').files.has('src/features/Home/V1Screen.tsx'),
);

// ---------------------------------------------------------------------------

if (failures > 0) {
  console.error(`\nboundary-guard regression fixture: ${failures} failure(s) — the guard does not reliably fail.`);
  process.exitCode = 1;
} else {
  console.log('\nboundary-guard regression fixture: all passing (the guard provably fails on prohibited changes).');
}
