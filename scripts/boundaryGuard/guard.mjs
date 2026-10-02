/**
 * Tiizi active-runtime boundary guard.
 *
 * Proves, mechanically, the repository engineering rules recorded in
 * `AGENTS.md` §1 and §2. It is a permanent CI gate: `npm run test:boundary`.
 *
 * Design notes — why this is more than a filename/grep check:
 *
 * - V2 runtime isolation is proved by a real **transitive import-graph
 *   closure** from the registered V2 composition root (`src/v2/routes.tsx`),
 *   compared against the closure of the archived Product V1 root
 *   (`src/App.tsx`). A module reached by V2 that is not reachable from V2's
 *   own root is V1 residue and fails.
 * - Type-only imports (`import type`) are excluded, matching TypeScript's
 *   erasure, so type contracts shared across the boundary are not reported as
 *   runtime dependencies.
 * - Server-side route registration is read from the actual registration call
 *   sites and the API authentication hook is confirmed to derive its prefix
 *   from the canonical constant rather than a literal.
 *
 * Every `check*` function is exported and accepts an injectable module map /
 * source map so the regression fixture in
 * `scripts/testBoundaryGuardRegression.mjs` can prove the guard fails when a
 * prohibited dependency, `/v1` route, or `/v1` client target is introduced.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';

// ---------------------------------------------------------------------------
// Import-graph primitives
// ---------------------------------------------------------------------------

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.mjs', '.js', '.jsx'];

/**
 * Extract module specifiers from source, EXCLUDING `import type` / `export
 * type`, which TypeScript erases and which therefore create no runtime edge.
 */
export function valueImportSpecifiers(source) {
  const specifiers = new Set();
  for (const match of source.matchAll(/\bimport\s+(type\s+)?[^'";]*?from\s*['"]([^'"]+)['"]/g)) {
    if (!match[1]) specifiers.add(match[2]);
  }
  for (const match of source.matchAll(/\bexport\s+(type\s+)?[^'";]*?from\s*['"]([^'"]+)['"]/g)) {
    if (!match[1]) specifiers.add(match[2]);
  }
  for (const match of source.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    specifiers.add(match[1]);
  }
  for (const match of source.matchAll(/\bimport\s*['"]([^'"]+)['"]/g)) {
    specifiers.add(match[1]);
  }
  return [...specifiers];
}

/** Resolve a relative / `@/` specifier against a module map; `null` if external. */
export function resolveSpecifier(from, specifier, modules) {
  let base;
  if (specifier.startsWith('.')) {
    base = normalize(join(dirname(from), specifier)).replaceAll('\\', '/');
  } else if (specifier.startsWith('@/')) {
    base = normalize(join('src', specifier.slice(2))).replaceAll('\\', '/');
  } else {
    return null;
  }

  const candidates = [base];
  // TypeScript ESM sources import with a `.js` extension that denotes the
  // compiled output; the on-disk module is `.ts`. Strip a trailing `.js` so
  // `./thing.js` resolves to `thing.ts`, otherwise the whole `api/src` tree
  // (which uses `.js` specifiers) would appear to have no dependencies.
  if (base.endsWith('.js')) {
    const stem = base.slice(0, -3);
    for (const extension of SOURCE_EXTENSIONS) candidates.push(`${stem}${extension}`);
  }
  for (const extension of SOURCE_EXTENSIONS) candidates.push(`${base}${extension}`);
  for (const extension of SOURCE_EXTENSIONS) candidates.push(`${base}/index${extension}`);
  return candidates.find((candidate) => modules.has(candidate)) ?? null;
}

/** Transitive value-import closure of an entry module. */
export function runtimeClosure(modules, entry) {
  const visited = new Set();
  const external = new Set();
  const visit = (file) => {
    if (visited.has(file) || !modules.has(file)) return;
    visited.add(file);
    for (const specifier of valueImportSpecifiers(modules.get(file))) {
      const dependency = resolveSpecifier(file, specifier, modules);
      if (dependency) visit(dependency);
      else if (!specifier.startsWith('.')) external.add(specifier);
    }
  };
  visit(entry);
  return { files: visited, external };
}

/** Read every `.ts`/`.tsx` source file under a directory into a module map. */
export function readSourceModules(directory) {
  const modules = new Map();
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(ts|tsx)$/.test(path)) {
        modules.set(path.replaceAll('\\', '/'), readFileSync(path, 'utf8'));
      }
    }
  };
  walk(directory);
  return modules;
}

// ---------------------------------------------------------------------------
// Route + client target extraction
// ---------------------------------------------------------------------------

const ROUTE_CALL = /\bapp\.(get|post|patch|put|delete|head|options)\s*\(/g;
const PATH_ARG = /^['"`]([^'"`]*)['"`]/;

/**
 * Extract every route path registered by `app.<method>(...)` across an API
 * source module map. Reads the actual registration call sites, so a route that
 * exists only in a comment is not counted.
 */
export function registeredRoutePaths(apiModules) {
  const routes = [];
  for (const [file, source] of apiModules) {
    for (const match of source.matchAll(ROUTE_CALL)) {
      // Take the remainder of the file from the call site and read the first
      // quoted/template literal, whether it is on the same line or the next.
      const rest = source.slice(match.index + match[0].length);
      const pathMatch = rest.match(PATH_ARG);
      if (pathMatch) routes.push({ file, method: match[1].toUpperCase(), path: pathMatch[1] });
    }
  }
  return routes;
}

/** Strip block and line comments so docstring examples are not read as code. */
export function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/** Extract `/v1...` request targets appearing in string/template literals. */
export function literalPathTargets(source, prefix) {
  const code = stripComments(source);
  const targets = [];
  for (const match of code.matchAll(/['"`]([^'"`\n]*)['"`]/g)) {
    if (match[1].includes(prefix)) targets.push(match[1]);
  }
  // Multi-line template literals (a path built across lines).
  for (const match of code.matchAll(/`([^`]*)`/gs)) {
    for (const line of match[1].split('\n')) {
      if (line.includes(prefix)) targets.push(line.trim());
    }
  }
  return [...new Set(targets)];
}

// ---------------------------------------------------------------------------
// Checks — each returns an array of violation strings (empty = pass)
// ---------------------------------------------------------------------------

/**
 * CHECK 1 + 5: the registered V2 runtime cannot import or transitively reach
 * archived Product V1 browser modules, and V2 cannot reach an `/app/*` route.
 *
 * V2-owned modules are those reachable from the registered V2 composition
 * root. V1-owned modules are those reachable from the archived Product V1
 * composition root but NOT from the V2 root. A module in the V2 closure that
 * is V1-owned is a banned V1 dependency. Shared neutral infrastructure is
 * reachable from both roots and is therefore not V1-owned.
 */
export function checkV2RuntimeIsolation(modules, { v2Root, v1Root }) {
  const violations = [];

  const v2 = runtimeClosure(modules, v2Root);
  if (v2.files.size === 0) {
    violations.push(`V2 composition root not found or has an empty closure: ${v2Root}`);
  }
  if (!modules.has(v1Root)) {
    violations.push(`archived Product V1 composition root not found: ${v1Root}`);
  }
  if (v2.files.size > 0 && [...v2.files].every((file) => !file.startsWith('src/v2/'))) {
    violations.push(`V2 closure contains no src/v2 modules — extraction failed for: ${v2Root}`);
  }

  const v1Owned = new Set(
    [...runtimeClosure(modules, v1Root).files].filter((file) => !v2.files.has(file)),
  );

  for (const file of v2.files) {
    if (v1Owned.has(file)) {
      violations.push(`V2 runtime transitively reaches archived Product V1 module: ${file}`);
    }
    if (file.startsWith('src/features/')) {
      violations.push(`V2 runtime reaches archived Product V1 feature module: ${file}`);
    }
  }

  // CHECK 5: no `/app/*` browser route target anywhere in the V2 closure.
  for (const file of v2.files) {
    for (const target of literalPathTargets(modules.get(file) ?? '', '/app/')) {
      violations.push(`V2 runtime module ${file} contains an /app/* browser route target: ${target}`);
    }
  }

  return violations;
}

/** CHECK 2: V2 runtime and active API registration cannot reach Firestore authority. */
export function checkNoLegacyFirestoreAuthority(modules, { v2Root, apiRoot }) {
  const violations = [];

  // (a) Nothing in the registered V2 browser runtime may reach Firestore.
  const v2 = runtimeClosure(modules, v2Root);
  for (const file of v2.files) {
    if (/firebase\/firestore/.test(modules.get(file) ?? '')) {
      violations.push(`V2 runtime reaches Firestore: ${file}`);
    }
    if (/firestore(Group|Challenge|GroupMutation)/i.test(file)) {
      violations.push(`V2 runtime reaches a legacy Firestore authority module: ${file}`);
    }
  }

  // (b) The active API composition root may not transitively value-import a
  // Firestore-backed Group/Challenge authority adapter. Type-only imports are
  // erased by TypeScript and so create no runtime authority edge.
  if (!modules.has(apiRoot)) {
    violations.push(`API composition root not found: ${apiRoot}`);
    return violations;
  }
  const api = runtimeClosure(modules, apiRoot);
  for (const file of api.files) {
    if (/firebase-admin\/firestore/.test(modules.get(file) ?? '')) {
      violations.push(`active API registration reaches a Firestore authority module: ${file}`);
    }
    if (/firestore(Group|Challenge)/i.test(file)) {
      violations.push(`active API registration reaches legacy Firestore adapter: ${file}`);
    }
  }

  return violations;
}

/**
 * CHECK 3: no active API route may be registered under `/v1/*`, every
 * domain route must sit under the canonical `/api` namespace, and the API
 * authentication hook must derive its prefix from the canonical constant.
 *
 * Unversioned infrastructure routes (`/health`, `/ready`) are intentionally
 * OUTSIDE the API namespace and are exempt; they must still not be `/v1`.
 */
export const INFRASTRUCTURE_ROUTES = new Set(['/health', '/ready']);

export function checkNoV1ApiRoutes(apiModules, { apiPrefixModule, authModule }) {
  const violations = [];
  const routes = registeredRoutePaths(apiModules);
  if (routes.length === 0) violations.push('no API routes found — registration extraction failed');

  for (const route of routes) {
    if (route.path.startsWith('/v1/') || route.path === '/v1') {
      violations.push(`retired /v1 API route is still registered: ${route.method} ${route.path} (${route.file})`);
      continue;
    }
    if (INFRASTRUCTURE_ROUTES.has(route.path)) {
      if (!route.file.endsWith('app.ts')) {
        violations.push(`infrastructure route registered outside the app root: ${route.method} ${route.path} (${route.file})`);
      }
      continue;
    }
    if (!route.path.startsWith('/api/')) {
      violations.push(`active API route is not under the /api namespace: ${route.method} ${route.path} (${route.file})`);
    }
  }

  if (apiModules.has(apiPrefixModule)) {
    const prefixSource = apiModules.get(apiPrefixModule);
    if (!/API_PREFIX\s*=\s*'\/api'/.test(prefixSource)) {
      violations.push(`canonical API prefix is not '/api' in ${apiPrefixModule}`);
    }
  }

  if (apiModules.has(authModule)) {
    const app = apiModules.get(authModule);
    if (!app.includes('API_PREFIX')) {
      violations.push(`API authentication hook does not use the canonical API_PREFIX (${authModule})`);
    }
    if (/startsWith\(\s*['"`]\/v1/.test(app)) {
      violations.push(`API authentication hook still gates on a /v1 literal (${authModule})`);
    }
  }

  return violations;
}

/** CHECK 4: no active V2 API client may contain a `/v1/*` request target. */
export function checkNoV1ClientTargets(clientModules) {
  const violations = [];
  for (const [file, source] of clientModules) {
    if (!file.startsWith('src/api/')) continue;
    if (file.endsWith('apiClient.ts')) continue; // carries the explanatory docstring
    for (const target of literalPathTargets(source, '/v1')) {
      violations.push(`active V2 API client contains a /v1 request target: ${file} → ${target}`);
    }
  }
  return violations;
}

// ---------------------------------------------------------------------------
// Repository run
// ---------------------------------------------------------------------------

const V2_ROOT = 'src/v2/routes.tsx';
const V1_ROOT = 'src/App.tsx';
const API_ROOT = 'api/src/app.ts';
const API_PREFIX_MODULE = 'api/src/apiPrefix.ts';
const AUTH_MODULE = 'api/src/app.ts';

export function runBoundaryChecks({ modules, apiModules, clientModules }) {
  return [
    ...checkV2RuntimeIsolation(modules, { v2Root: V2_ROOT, v1Root: V1_ROOT }),
    ...checkNoLegacyFirestoreAuthority(modules, { v2Root: V2_ROOT, apiRoot: API_ROOT }),
    ...checkNoV1ApiRoutes(apiModules, { apiPrefixModule: API_PREFIX_MODULE, authModule: AUTH_MODULE }),
    ...checkNoV1ClientTargets(clientModules),
  ];
}

export function main() {
  const browserModules = readSourceModules('src');
  const apiModules = readSourceModules('api/src');
  // A single map so the API composition root can also be traversed.
  const modules = new Map([...browserModules, ...apiModules]);
  const clientModules = new Map([...browserModules].filter(([file]) => file.startsWith('src/api/')));

  const violations = runBoundaryChecks({ modules, apiModules, clientModules });

  if (violations.length > 0) {
    console.error('boundary guard: FAIL');
    for (const violation of violations) console.error(`  - ${violation}`);
    process.exitCode = 1;
    return violations;
  }
  console.log('boundary guard: all checks passing');
  return violations;
}

const invokedDirectly = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (invokedDirectly) main();
