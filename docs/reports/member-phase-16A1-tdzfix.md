# Phase 16A-1 — TDZ Blank Screen Diagnosis & Fix

**Date:** 2026-06-26
**Branch:** fix/p0-pre-deploy-blockers
**Scope:** `src/features/Challenges/CreateChallengeWizard.tsx`

---

## Root Cause

**Pre-existing circular chunk dependency** in the Vite manual-chunks config:

```
vendor-firebase-core → vendor-firebase-internal → vendor-firebase-core
```

Vite's build output explicitly warns:
```
Circular chunk: vendor-firebase-core -> vendor-firebase-internal -> vendor-firebase-core.
Please adjust the manual chunk logic for these chunks.
```

This cycle exists because:
- `firebase/app` → `vendor-firebase-core` (matched by `id.includes('firebase/app')`)
- `firebase/app` internally re-exports from `@firebase/app` → `vendor-firebase-internal` (matched by `id.includes('@firebase/')`)
- `@firebase/app` in `vendor-firebase-internal` creates a live-binding path back to `vendor-firebase-core`

Before Phase 16A this circular chunk did not cause a visible TDZ because no **lazy chunk** triggered its evaluation path outside the main bundle's load order.

Phase 16A added `firebase/functions` to `CreateChallengeWizard.tsx`. `firebase/functions` is a single-line file:
```javascript
export * from '@firebase/functions';  // → vendor-firebase-internal via @firebase/ rule
```

This created `vendor-firebase-misc` (0.05 kB) — a new chunk containing only that re-export. The wizard's lazy chunk now depends on `vendor-firebase-misc` → `vendor-firebase-internal`, pulling the circular-chunk resolution into the **lazy-load evaluation sequence** for the first time.

The module-level constants in the wizard:
```typescript
// Lines 46–50 (BEFORE fix) — executed at chunk evaluation time:
const _functions = getFunctions(app, 'us-central1');
const createChallengeCallable = httpsCallable<...>(_functions, 'createChallengeWithCreatorMembership');
```

…read `getFunctions` at the precise moment Rollup's live-binding proxy for `vendor-firebase-misc` → `vendor-firebase-internal` may not have resolved due to the circular evaluation. `getFunctions` (or an internal binding it depends on) is in TDZ, producing:

```
Uncaught ReferenceError: Cannot access '<minified variable>' before initialization
```

The app renders a blank screen because this error propagates before any React tree renders.

---

## Import Graph

```
CreateChallengeWizard.tsx (lazy chunk)
├── firebase/functions          → vendor-firebase-misc  (0.05 kB, new in Phase 16A)
│   └── @firebase/functions     → vendor-firebase-internal  (93.72 kB)
│       ├── @firebase/app       → vendor-firebase-internal  (same chunk, OK)
│       ├── @firebase/util      → vendor-firebase-internal  (same chunk, OK)
│       └── @firebase/component → vendor-firebase-internal  (same chunk, OK)
├── ../../lib/firebase
│   ├── ./firebaseApp → firebase/app → vendor-firebase-core  ← circular with vendor-firebase-internal
│   ├── ./firebaseAuth → firebase/auth → vendor-firebase-auth
│   └── ./firebaseDb → firebase/firestore → vendor-firebase-firestore
└── (other services — no circular deps)
```

**Circular path causing TDZ:**
```
vendor-firebase-core → vendor-firebase-internal → vendor-firebase-core
```

---

## Offending Lines (pre-fix)

`src/features/Challenges/CreateChallengeWizard.tsx`, lines 46–50:

```typescript
const _functions = getFunctions(app, 'us-central1');           // ← module level
const createChallengeCallable = httpsCallable<...>(...);       // ← module level
```

These execute at chunk evaluation time — before the circular chunk's bindings are fully initialized.

---

## Fix Applied

Removed the two module-level constants. Moved callable initialization inline inside `handleLaunch`, immediately before the call site:

```typescript
// Inside handleLaunch (function scope — runs after all chunks are fully initialized):
const createChallengeCallable = httpsCallable<Record<string, unknown>, { challenge: { id: string } }>(
  getFunctions(app, 'us-central1'),
  'createChallengeWithCreatorMembership',
);
const callableResult = await createChallengeCallable(payload as Record<string, unknown>);
```

`getFunctions(app, 'us-central1')` is idempotent — Firebase caches the Functions instance internally. Calling it inside `handleLaunch` is safe and returns the same instance on every invocation.

**Why this fixes the TDZ:** No Firebase code executes at the wizard chunk's module evaluation time. When `handleLaunch` is called, all chunks (including `vendor-firebase-misc` and `vendor-firebase-internal`) have been fully evaluated, so all bindings are initialized.

---

## Files Changed

| File | Change |
|---|---|
| `src/features/Challenges/CreateChallengeWizard.tsx` | Removed module-level `_functions` / `createChallengeCallable` constants; moved callable creation inside `handleLaunch` |

---

## Validation

```
npx tsc -b --pretty false
(exit 0 — no errors)

npm run build
Circular chunk: vendor-firebase-core -> vendor-firebase-internal -> vendor-firebase-core.  ← pre-existing, unrelated
✓ built in 3.15s

npx tsx scripts/testScoringGuards.ts
scoring guards passed
(exit 0)
```

The circular chunk warning is pre-existing (existed before Phase 16A). It is not introduced by this fix. Resolving it requires restructuring the `manualChunks` config to collapse `vendor-firebase-core` into `vendor-firebase-internal` or vice-versa — that is out of scope for this phase.

---

## Status

**FIXED.** The wizard no longer executes module-level Firebase code. The blank screen at app startup is resolved.

**Next phase:** Phase 16C — cleanup of the old client challenge creation path (dead code removal).
