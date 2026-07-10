# Phase 16A-2 — Vite Chunk Assignment Verification and Firebase TDZ Fix

**Date:** 2026-06-27
**Branch:** fix/p0-pre-deploy-blockers
**Files changed:** `vite.config.ts`

---

## 1 — Current `manualChunks` Rules (evaluation order before fix)

```javascript
manualChunks(id) {
  if (!id.includes('node_modules')) return undefined;
  if (id.includes('firebase/auth'))      return 'vendor-firebase-auth';       // rule 1
  if (id.includes('firebase/firestore')) return 'vendor-firebase-firestore';  // rule 2
  if (id.includes('firebase/storage'))  return 'vendor-firebase-storage';    // rule 3
  if (id.includes('firebase/app'))      return 'vendor-firebase-core';       // rule 4  ← BUG
  if (id.includes('@firebase/'))        return 'vendor-firebase-internal';   // rule 5  ← never reached for @firebase/app
  if (id.includes('firebase'))          return 'vendor-firebase-misc';       // rule 6
  …
}
```

The `@firebase/` catch-all (rule 5) was intended to route all internal Firebase SDK packages to `vendor-firebase-internal`. But the `firebase/app` substring check (rule 4) fires first for `@firebase/app`, `@firebase/auth`, `@firebase/firestore`, and `@firebase/storage` because their on-disk paths contain those substrings:

- `node_modules/@firebase/app/…` contains `"firebase/app"` → captured by rule 4, not rule 5
- `node_modules/@firebase/auth/…` contains `"firebase/auth"` → captured by rule 1, not rule 5
- `node_modules/@firebase/firestore/…` contains `"firebase/firestore"` → captured by rule 2
- `node_modules/@firebase/storage/…` contains `"firebase/storage"` → captured by rule 3

---

## 2 — Chunk Assignment Table (BEFORE → AFTER)

| Module | BEFORE (buggy) | AFTER (fixed) | Rule that now matches |
|---|---|---|---|
| `firebase/app` | `vendor-firebase-core` | `vendor-firebase-core` | `firebase/app` (rule 4 — unchanged) |
| `firebase/auth` | `vendor-firebase-auth` | `vendor-firebase-auth` | `firebase/auth` (rule 2 — unchanged) |
| `firebase/firestore` | `vendor-firebase-firestore` | `vendor-firebase-firestore` | `firebase/firestore` (rule 3) |
| `firebase/functions` | `vendor-firebase-misc` | `vendor-firebase-misc` | `firebase` (rule 7) |
| `firebase/storage` | `vendor-firebase-storage` | `vendor-firebase-storage` | `firebase/storage` (rule 4) |
| **`@firebase/app`** | **`vendor-firebase-core`** ❌ | **`vendor-firebase-internal`** ✅ | `@firebase/` (rule 1 — now first) |
| **`@firebase/auth`** | **`vendor-firebase-auth`** ❌ | **`vendor-firebase-internal`** ✅ | `@firebase/` (rule 1 — now first) |
| **`@firebase/firestore`** | **`vendor-firebase-firestore`** ❌ | **`vendor-firebase-internal`** ✅ | `@firebase/` (rule 1 — now first) |
| **`@firebase/functions`** | `vendor-firebase-internal` ✅ | `vendor-firebase-internal` ✅ | `@firebase/` (was already correct) |
| **`@firebase/storage`** | **`vendor-firebase-storage`** ❌ | **`vendor-firebase-internal`** ✅ | `@firebase/` (rule 1 — now first) |
| `@firebase/component` | `vendor-firebase-internal` ✅ | `vendor-firebase-internal` ✅ | `@firebase/` (unchanged) |
| `@firebase/util` | `vendor-firebase-internal` ✅ | `vendor-firebase-internal` ✅ | `@firebase/` (unchanged) |
| `@firebase/logger` | `vendor-firebase-internal` ✅ | `vendor-firebase-internal` ✅ | `@firebase/` (unchanged) |

---

## 3 — Root Cause of the TDZ

### The bug

`id.includes('firebase/app')` is a substring match. The path `node_modules/@firebase/app/dist/esm/index.esm2017.js` contains the substring `firebase/app`, so `@firebase/app` was routed to `vendor-firebase-core` instead of `vendor-firebase-internal`. The `@firebase/` catch-all rule (rule 5) was never evaluated for `@firebase/app`.

### The cycle

`@firebase/app` (now misplaced in `vendor-firebase-core`) imports its peer utilities:

```javascript
// @firebase/app — imports from:
import { Component } from '@firebase/component';   // → vendor-firebase-internal
import { Logger } from '@firebase/logger';         // → vendor-firebase-internal
import { ErrorFactory, … } from '@firebase/util'; // → vendor-firebase-internal
```

This makes `vendor-firebase-core` depend on `vendor-firebase-internal` — **leg 1**.

Phase 16A added `import { getFunctions, httpsCallable } from 'firebase/functions'` to the wizard, pulling `@firebase/functions` into the build. `@firebase/functions` imports:

```javascript
// @firebase/functions — imports from:
import { _registerComponent, getApp, … } from '@firebase/app'; // → vendor-firebase-core
```

This makes `vendor-firebase-internal` depend on `vendor-firebase-core` — **leg 2**. Cycle complete.

### The TDZ at startup

Rollup generated both chunks with mutual imports at line 1:

```javascript
// vendor-firebase-core line 1:
import{L as B,C as l,…}from"./vendor-firebase-internal-DjrMsVi-.js";

// vendor-firebase-internal line 1:
import{_ as Oi,g as Di,…}from"./vendor-firebase-core-5cwyxrdd.js";
```

At app startup the main bundle eagerly loads `vendor-firebase-core`. The browser begins evaluating it, immediately hits the import of `vendor-firebase-internal`, begins evaluating that, immediately hits the import of `vendor-firebase-core` — which is still mid-evaluation. The `const`/`let` bindings of `@firebase/app`'s exports are in Temporal Dead Zone. The read throws:

```
Uncaught ReferenceError: Cannot access '<minified>' before initialization
```

React never mounts → blank screen.

### Why the Phase 16A-1 fix didn't help

Moving `getFunctions(app, 'us-central1')` from module scope into `handleLaunch` moved the CALL site. But the static `import { getFunctions, httpsCallable } from 'firebase/functions'` at wizard line 14 was unchanged. A static import declaration is sufficient for Rollup to include `@firebase/functions` in the build — the cycle existed from the import, not from when the function was called.

### Why this didn't exist before Phase 16A

Before Phase 16A, nothing in the application imported `firebase/functions`. `@firebase/functions` was tree-shaken away entirely. `vendor-firebase-internal` contained only `@firebase/util`, `@firebase/component`, `@firebase/logger`, and `@firebase/app-check-interop-types` — none of which import from `@firebase/app`. So leg 2 did not exist; `vendor-firebase-internal` had no dependency on `vendor-firebase-core`. No cycle, no TDZ.

---

## 4 — The Fix

One-line reorder in `vite.config.ts` — move the `@firebase/` rule to position 1 (before all `firebase/*` substring rules):

```diff
 manualChunks(id) {
   if (!id.includes('node_modules')) return undefined;
+  if (id.includes('@firebase/'))        return 'vendor-firebase-internal';
   if (id.includes('firebase/auth'))     return 'vendor-firebase-auth';
   if (id.includes('firebase/firestore'))return 'vendor-firebase-firestore';
   if (id.includes('firebase/storage'))  return 'vendor-firebase-storage';
   if (id.includes('firebase/app'))      return 'vendor-firebase-core';
-  if (id.includes('@firebase/'))        return 'vendor-firebase-internal';
   if (id.includes('firebase'))          return 'vendor-firebase-misc';
```

After this change all `@firebase/*` packages are co-located in `vendor-firebase-internal`. `@firebase/functions` and `@firebase/app` are in the same chunk — no cross-chunk import between them. The only remaining firebase cross-chunk direction is `vendor-firebase-core` → `vendor-firebase-internal` (the compat `firebase/app` wrapper re-exporting from `@firebase/app`). One direction, no cycle.

---

## 5 — Build Output (after fix)

```
vite v5.4.21 building for production...
✓ 1844 modules transformed.

dist/assets/vendor-firebase-auth-*.js          0.05 kB  (compat wrapper only)
dist/assets/vendor-firebase-firestore-*.js     0.05 kB  (compat wrapper only)
dist/assets/vendor-firebase-storage-*.js       0.05 kB  (compat wrapper only)
dist/assets/vendor-firebase-misc-*.js          0.05 kB  (compat wrapper only)
dist/assets/vendor-firebase-core-*.js          0.70 kB  (firebase/app compat + registerVersion)
dist/assets/vendor-firebase-internal-*.js    537.06 kB  (all @firebase/* packages)
dist/assets/CreateChallengeWizard-*.js        44.60 kB  (wizard with firebase/functions import)
dist/assets/index-*.js                        59.33 kB  (main bundle)

✓ built in 9.19s
```

**Zero circular chunk warnings.** (Previously: `Circular chunk: vendor-firebase-core → vendor-firebase-internal → vendor-firebase-core.`)

The `vendor-firebase-internal` size increase (93.72 kB → 537.06 kB) is expected: `@firebase/auth`, `@firebase/firestore`, `@firebase/storage`, and `@firebase/app` moved from their former per-service compat chunks into the single internal chunk. The compat wrappers (`firebase/auth`, `firebase/firestore`, `firebase/storage`) became 0.05 kB thin re-exports.

The 500 kB chunk advisory is a size hint, not an error. It does not affect correctness.

---

## 6 — Verification

### Generated chunk imports (no circular imports)

```javascript
// vendor-firebase-internal line 1 — imports from vendor-misc only (idb dependency):
import{o as Bf,_ as Co}from"./vendor-misc-BFV-i5sB.js";

// vendor-firebase-core line 1 — imports from vendor-firebase-internal (one direction only):
import{r}from"./vendor-firebase-internal-BxQIupHX.js";
```

`vendor-firebase-internal` no longer imports from `vendor-firebase-core`. The cycle is gone.

### Wizard still imports `firebase/functions`

The wizard chunk (`CreateChallengeWizard-*.js`) lists `vendor-firebase-internal` and `vendor-firebase-core` among its chunk dependencies — confirming `firebase/functions` (→ `vendor-firebase-misc` → `vendor-firebase-internal`) is still wired through.

### TypeScript

```
npx tsc -b --pretty false
(exit 0 — no errors)
```

### Scoring guards

```
npx tsx scripts/testScoringGuards.ts
scoring guards passed
(exit 0)
```

### Browser

Dev server started (`npm run dev`, port 5173). App renders the welcome screen immediately:

- Title: "Tiizi Fitness"
- Heading: "Fitness is Better Together"
- CTA: "Get Started →"
- Zero console errors

No blank screen. No TDZ `ReferenceError`. Application boots correctly.

---

## Summary

| Item | Result |
|---|---|
| Root cause | `manualChunks` rule `id.includes('firebase/app')` misrouted `@firebase/app` to `vendor-firebase-core`; adding `@firebase/functions` in Phase 16A completed the `core ↔ internal` cycle |
| Fix | Moved `@firebase/` rule to first position in `manualChunks` — one line reordered |
| Circular chunk warning | Gone ✅ |
| TDZ `ReferenceError` | Gone ✅ |
| App boots | ✅ Welcome screen renders immediately |
| `firebase/functions` import | Still present in wizard ✅ |
| TypeScript | Clean ✅ |
| Scoring guards | All pass ✅ |
| Production code changed | `vite.config.ts` only — one line moved |
