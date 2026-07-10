# Phase X — TDZ Root Cause Investigation

**Date:** 2026-06-27
**Branch:** fix/p0-pre-deploy-blockers
**Status:** Investigation complete — no production code changed.

---

## Why the Previous Fix Failed

The Phase 16A-1 fix moved `getFunctions(app, 'us-central1')` and `httpsCallable(...)` from module scope into the body of `handleLaunch`. That prevented those function CALLS from running at chunk evaluation time, but it left the static import unchanged:

```typescript
// CreateChallengeWizard.tsx line 14 — still present after Phase 16A-1
import { getFunctions, httpsCallable } from 'firebase/functions';
```

A static `import` declaration is all Rollup needs to include the imported module in the bundle. The location of the CALL does not affect whether the MODULE is included. As long as that import is present, `@firebase/functions` enters the production build, which is the root cause of the crash — not the location of the call.

---

## Root Cause

### The `manualChunks` bug

The `vite.config.ts` `manualChunks` function routes modules using substring checks:

```javascript
if (id.includes('firebase/app')) return 'vendor-firebase-core';   // ← BUG
if (id.includes('@firebase/')) return 'vendor-firebase-internal';
```

The rule for `'firebase/app'` is checked BEFORE the rule for `'@firebase/'`. The path for `@firebase/app` is:

```
node_modules/@firebase/app/dist/esm/index.esm2017.js
```

This path contains `firebase/app` as a substring (at position `@firebase/app`). Therefore `@firebase/app` is routed to `vendor-firebase-core` instead of `vendor-firebase-internal`.

**Confirmed by simulation:**

| Module path | Rule that matches | Chunk assigned |
|---|---|---|
| `@firebase/app/...` | `id.includes('firebase/app')` (WRONG) | `vendor-firebase-core` |
| `@firebase/auth/...` | `id.includes('firebase/auth')` (wrong) | `vendor-firebase-auth` |
| `@firebase/functions/...` | `id.includes('@firebase/')` | `vendor-firebase-internal` |
| `@firebase/util/...` | `id.includes('@firebase/')` | `vendor-firebase-internal` |
| `@firebase/component/...` | `id.includes('@firebase/')` | `vendor-firebase-internal` |
| `firebase/app/...` | `id.includes('firebase/app')` | `vendor-firebase-core` |
| `firebase/functions/...` | `id.includes('firebase')` | `vendor-firebase-misc` |

The core bug: **`@firebase/app` is placed in `vendor-firebase-core` but it should be in `vendor-firebase-internal`.**

---

### How this creates the circular chunk dependency

**`@firebase/app` imports from `vendor-firebase-internal`:**

```javascript
// @firebase/app/dist/esm/index.esm2017.js
import { Component, ComponentContainer } from '@firebase/component';   // → vendor-firebase-internal
import { Logger, ... } from '@firebase/logger';                        // → vendor-firebase-internal
import { ErrorFactory, ... } from '@firebase/util';                    // → vendor-firebase-internal
```

So `vendor-firebase-core` (which contains `@firebase/app`) depends on `vendor-firebase-internal`. **Direction: core → internal.**

**`@firebase/functions` imports from `@firebase/app`:**

```javascript
// @firebase/functions/dist/esm/index.esm2017.js
import { _isFirebaseServerApp, _registerComponent, registerVersion, _getProvider, getApp } from '@firebase/app';
//      @firebase/app is in vendor-firebase-core
```

So `vendor-firebase-internal` (which contains `@firebase/functions`) depends on `vendor-firebase-core`. **Direction: internal → core.**

**The cycle:**
```
vendor-firebase-core  →  vendor-firebase-internal  →  vendor-firebase-core
      (@firebase/app uses @firebase/util etc.)   (@firebase/functions uses @firebase/app)
```

This is confirmed in the actual Rollup-generated chunk files:

```javascript
// vendor-firebase-core-*.js — line 1:
import{L as B,C as l,E as O,...}from"./vendor-firebase-internal-DjrMsVi-.js";

// vendor-firebase-internal-*.js — line 1:
import{_ as Oi,g as Di,a as ki,...}from"./vendor-firebase-core-5cwyxrdd.js";
```

Both chunks import from each other at the very top of their files — module evaluation time.

---

### Why this crashes at app startup

When the browser loads the production app:

1. `index-*.js` (main bundle) is the entry point
2. The main bundle imports eagerly from `vendor-firebase-core` (via `challengeService → lib/firebase → firebase/app`)
3. The browser starts evaluating `vendor-firebase-core`
4. `vendor-firebase-core` line 1: import from `vendor-firebase-internal`
5. The browser starts evaluating `vendor-firebase-internal`
6. `vendor-firebase-internal` line 1: import from `vendor-firebase-core`
7. `vendor-firebase-core` is still being evaluated — its `const`/`let` exports are in **Temporal Dead Zone**
8. `vendor-firebase-internal` tries to read those bindings → **`Uncaught ReferenceError: Cannot access '<minified>' before initialization`**
9. The top-level script throws before React mounts → **blank screen**

The error occurs at startup, not at the create-challenge navigation, because the circular import is in the EAGERLY loaded main-bundle dependency chain.

---

### Why this was not present before Phase 16A

Before Phase 16A, nothing in the application imported `firebase/functions`. `@firebase/functions` was tree-shaken away entirely (it appeared in neither `vendor-firebase-internal` nor any other chunk). The `vendor-firebase-internal` chunk therefore contained only utility/infrastructure packages (`@firebase/util`, `@firebase/component`, `@firebase/logger`, etc.). **None of these import from `@firebase/app`.** So `vendor-firebase-internal` had no dependency on `vendor-firebase-core`. No cycle.

The `vendor-firebase-internal` chunk grew from **81.13 kB → 93.72 kB** after Phase 16A. The ~12 kB addition is `@firebase/functions`. `@firebase/functions` imports from `@firebase/app` (in `vendor-firebase-core`), creating the `internal → core` direction for the first time.

---

## Circular Dependency Graph (complete)

```
src/main.tsx
  └─ src/App.tsx (eager)
       ├─ src/services/challengeService.ts (eager)
       │    └─ src/lib/firebase.ts
       │         └─ src/lib/firebaseApp.ts
       │              └─ firebase/app  →  vendor-firebase-core
       │                   └─ @firebase/app  →  vendor-firebase-core (WRONG chunk — should be internal)
       │                        ├─ @firebase/util  →  vendor-firebase-internal
       │                        ├─ @firebase/component  →  vendor-firebase-internal
       │                        └─ @firebase/logger  →  vendor-firebase-internal
       │                             ↑ vendor-firebase-core → vendor-firebase-internal (leg 1)
       │
       └─ (lazy) CreateChallengeWizard.tsx
            └─ firebase/functions  →  vendor-firebase-misc (side-effect only in output)
                 └─ @firebase/functions  →  vendor-firebase-internal
                      └─ @firebase/app  →  vendor-firebase-core (in wrong chunk)
                           ↑ vendor-firebase-internal → vendor-firebase-core (leg 2 — NEW in Phase 16A)

CYCLE: vendor-firebase-core ↔ vendor-firebase-internal
```

**No circular dependencies exist in application source code** (`src/`). Zero cycles found by static analysis. The cycle is entirely in the Vite chunk configuration.

---

## Disabled `manualChunks` test result

With `manualChunks` completely disabled, `npm run build` produces:
- ✓ Zero circular chunk warnings
- ✓ Zero TDZ errors
- ✓ Build succeeds

This confirms the cycle is introduced solely by the `manualChunks` configuration, not by any application code or Firebase SDK internal structure.

---

## Offending Configuration Line

**`vite.config.ts` line 20:**
```javascript
if (id.includes('firebase/app')) return 'vendor-firebase-core';
```

This single line misroutes `@firebase/app` (and any other `@firebase/X` package whose name contains `firebase/app` as a substring) into `vendor-firebase-core` instead of `vendor-firebase-internal`. Combined with the Phase 16A addition of `@firebase/functions` (which imports `@firebase/app`), it creates the fatal cycle.

---

## What the Runtime Error Maps To

The minified variable in `Uncaught ReferenceError: Cannot access '<variable>' before initialization` is one of the 5 named exports from `vendor-firebase-core` that `vendor-firebase-internal` tries to read at line 1:

```javascript
// vendor-firebase-internal line 1 (minified):
import{_ as Oi,g as Di,a as ki,r as xn,b as Ri}from"./vendor-firebase-core-5cwyxrdd.js";
```

In source terms (via `vendor-firebase-core.js.map`), these are exports from `@firebase/app`:
- `_` → likely `_FirebaseAppImpl` or similar internal class
- `g` → likely `getApp` or `getApps`
- `a` → likely `initializeApp` or `_initializeFirebase`
- `r` → likely `registerVersion`
- `b` → likely `_registerComponent` or `_addOrOverwriteComponent`

When `vendor-firebase-internal` evaluates and tries to destructure these from `vendor-firebase-core`, `vendor-firebase-core` is still mid-evaluation and those bindings are undefined/TDZ. The specific variable shown in the minified error is whichever of these `@firebase/functions` first reads at module scope.

---

## Smallest Safe Fix

The fix is a one-line reorder in `vite.config.ts`: move the `@firebase/` rule to come BEFORE the `firebase/*` service-specific rules, so `@firebase/app` is correctly routed to `vendor-firebase-internal` before the `firebase/app` substring rule can misroute it.

**`vite.config.ts` — proposed change:**

```javascript
manualChunks(id) {
  if (!id.includes('node_modules')) return undefined;
  // @firebase/ check FIRST — prevents @firebase/app, @firebase/auth, etc.
  // from being misrouted by the firebase/* substring rules below
  if (id.includes('@firebase/')) return 'vendor-firebase-internal';
  if (id.includes('firebase/auth')) return 'vendor-firebase-auth';
  if (id.includes('firebase/firestore')) return 'vendor-firebase-firestore';
  if (id.includes('firebase/storage')) return 'vendor-firebase-storage';
  if (id.includes('firebase/app')) return 'vendor-firebase-core';
  if (id.includes('firebase')) return 'vendor-firebase-misc';
  // ... rest unchanged
}
```

After this change:
- `@firebase/app` → `vendor-firebase-internal` (no longer misrouted to `vendor-firebase-core`)
- `@firebase/functions` → `vendor-firebase-internal` (same chunk as `@firebase/app`, no cross-chunk dep)
- `firebase/app` → `vendor-firebase-core` (compat wrapper only, thin re-export of `vendor-firebase-internal`)
- Cycle eliminated: `vendor-firebase-internal` no longer imports from `vendor-firebase-core`

This change affects chunk assignments (hashes will change, sizes will shift) but does not change any application behavior. The `vendor-firebase-core` chunk becomes thinner (compat wrapper only); `vendor-firebase-internal` grows to absorb `@firebase/app`.

**This fix is sufficient on its own. The Phase 16A-1 change (moving the call to `handleLaunch`) is harmless but not the solution.**

---

## Summary

| Question | Answer |
|---|---|
| What is the root cause? | `vite.config.ts` `manualChunks` string rule `id.includes('firebase/app')` incorrectly routes `@firebase/app` to `vendor-firebase-core` instead of `vendor-firebase-internal` |
| What creates the cycle? | `@firebase/app` (in `vendor-firebase-core`) imports `@firebase/util`/`@firebase/component` (in `vendor-firebase-internal`) AND `@firebase/functions` (in `vendor-firebase-internal`) imports `@firebase/app` (in `vendor-firebase-core`) |
| Why only after Phase 16A? | Before Phase 16A, `@firebase/functions` was tree-shaken away. Phase 16A added `import { getFunctions, httpsCallable } from 'firebase/functions'` to the wizard, pulling `@firebase/functions` into `vendor-firebase-internal` and completing the cycle. |
| Why at startup (not lazy load)? | The circular chunks are in the main bundle's EAGER dependency chain (`App.tsx → challengeService → firebase/app`), not in any lazy chunk. |
| Why did moving to `handleLaunch` not fix it? | The static `import` at line 14 of the wizard is what causes `@firebase/functions` to enter the build. The call location is irrelevant. |
| What is the offending line? | `vite.config.ts` line 20: `if (id.includes('firebase/app')) return 'vendor-firebase-core';` |
| What is the fix? | Move the `@firebase/` rule before all `firebase/*` rules so `@firebase/` packages are routed correctly before the substring check misroutes them. One-line reorder. |
| Does disabling `manualChunks` fix it? | Yes — zero circular warnings, zero TDZ errors. Confirms the bug is entirely in the chunk config. |
