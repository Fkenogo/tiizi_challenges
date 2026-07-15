# Phase 7G Blank Screen Root Cause Audit

Date: 2026-06-11

## Executive Summary

The production blank page is caused by Vite/Rollup manual chunking of Firebase packages, not by a TypeScript/source-level circular import in the Phase 7G UI code.

The build creates this generated JavaScript cycle:

```text
vendor-firebase-core-*.js
  -> imports vendor-firebase-internal-*.js
    -> imports vendor-firebase-core-*.js
```

That directly matches the build warning:

```text
Circular chunk:
vendor-firebase-core
-> vendor-firebase-internal
-> vendor-firebase-core
```

It also explains the browser runtime failure:

```text
ReferenceError: Cannot access 'u' before initialization
```

This is a module initialization / temporal-dead-zone failure caused by splitting Firebase's tightly coupled ESM internals into separate manual chunks.

## Files Audited

Phase 7G files reviewed:

- `src/features/Groups/GroupDetailScreen.tsx`
- `src/features/Groups/JoinGroupScreen.tsx`
- `src/features/Groups/components/GroupInviteManagementPanel.tsx`
- `src/hooks/useGroupInvites.ts`
- `src/hooks/useGroups.ts`
- `src/services/groupInviteService.ts`
- `src/services/groupInviteUtils.ts`
- `src/services/groupService.ts`

Build configuration reviewed:

- `vite.config.ts`

Built output reviewed:

- `dist/assets/vendor-firebase-core-*.js`
- `dist/assets/vendor-firebase-internal-*.js`
- `dist/assets/vendor-firebase-firestore-*.js`
- `dist/assets/vendor-firebase-auth-*.js`
- `dist/assets/useGroupInvites-*.js`
- `dist/assets/index-*.js`

## Source Import Findings

Static import-cycle analysis over `src/**/*.ts` and `src/**/*.tsx` found:

```json
{
  "totalCycles": 0,
  "focusedCycles": 0
}
```

No direct or indirect source-level cycle was found involving:

- Firebase local modules
- `groupInviteService`
- `useGroupInvites`
- `useGroups`
- `groupService`

The Phase 7G source graph is one-way:

```text
GroupDetailScreen
  -> useGroupInvites
    -> groupInviteService
      -> firebase/functions
      -> firebase/firestore
      -> src/lib/firebase

GroupDetailScreen
  -> useGroups
    -> groupService
      -> firebase/firestore
      -> src/lib/firebase

JoinGroupScreen
  -> useGroupInvites
    -> groupInviteService
      -> firebase/functions
      -> firebase/firestore
      -> src/lib/firebase

GroupInviteManagementPanel
  -> useGroupInvites
    -> groupInviteService
      -> firebase/functions
      -> firebase/firestore
      -> src/lib/firebase
```

There is no reverse import from services back into hooks or components.

## Firebase Module Findings

Local Firebase modules are also acyclic:

```text
src/lib/firebase.ts
  -> firebaseApp
  -> firebaseAuth
  -> firebaseDb

firebaseAuth
  -> firebase/auth
  -> firebaseApp

firebaseDb
  -> firebase/firestore
  -> firebaseApp

firebaseApp
  -> firebase/app
```

The issue appears after bundling.

## Built Chunk Dependency Graph

Generated chunk graph from `dist/assets`:

```text
vendor-firebase-auth-*.js
  -> vendor-firebase-core-*.js
  -> vendor-firebase-internal-*.js
  -> vendor-misc-*.js

vendor-firebase-firestore-*.js
  -> vendor-firebase-core-*.js
  -> vendor-firebase-internal-*.js

vendor-firebase-storage-*.js
  -> vendor-firebase-core-*.js
  -> vendor-firebase-internal-*.js

vendor-firebase-core-*.js
  -> vendor-firebase-internal-*.js
  -> vendor-misc-*.js

vendor-firebase-internal-*.js
  -> vendor-firebase-core-*.js
```

Exact direct cycle:

```text
vendor-firebase-core-C4wLl9rc.js
  -> vendor-firebase-internal-wbZDx0NR.js
  -> vendor-firebase-core-C4wLl9rc.js
```

The generated chunk headers confirm this:

```js
// vendor-firebase-core-*.js
import { ... } from "./vendor-firebase-internal-*.js";

// vendor-firebase-internal-*.js
import { ... } from "./vendor-firebase-core-*.js";
```

## Vite Manual Chunk Root Cause

Current `vite.config.ts` manually splits Firebase packages:

```ts
if (id.includes('firebase/auth')) return 'vendor-firebase-auth';
if (id.includes('firebase/firestore')) return 'vendor-firebase-firestore';
if (id.includes('firebase/storage')) return 'vendor-firebase-storage';
if (id.includes('firebase/app')) return 'vendor-firebase-core';
if (id.includes('@firebase/')) return 'vendor-firebase-internal';
if (id.includes('firebase')) return 'vendor-firebase-misc';
```

This forces `firebase/app` into `vendor-firebase-core` and `@firebase/*` internals into `vendor-firebase-internal`.

Firebase's published ESM modules are tightly coupled:

- `firebase/app` wraps and re-exports pieces of `@firebase/app`.
- `@firebase/*` internals import app registration/provider helpers.
- Auth, Firestore, Storage, and Functions all share internal component registration.

Splitting those internals across separate manual chunks creates an initialization cycle that Rollup warns about and the browser trips over at runtime.

## Phase 7G Relationship

Phase 7G introduced or activated this chain:

```text
JoinGroupScreen / GroupDetailScreen
  -> useGroupInvites
    -> groupInviteService
      -> firebase/functions
      -> firebase/firestore
```

The `useGroupInvites` built chunk imports:

```text
vendor-firebase-internal-*.js
vendor-firebase-firestore-*.js
```

That increases the number of routes depending on the fragile split. However, the exact blank-screen root cause is still the manual Firebase chunk split, not a Phase 7G source import cycle.

The main app chunk already imports Firebase auth, core, and Firestore at startup:

```text
index-*.js
  -> vendor-firebase-auth-*.js
  -> vendor-firebase-core-*.js
  -> vendor-firebase-firestore-*.js
```

Because `vendor-firebase-core` and `vendor-firebase-internal` import each other, any initial route can fail before React renders.

## Direct vs Indirect Cycles

### A. Direct Circular Imports

No direct source-level circular imports found in Phase 7G files.

Direct generated chunk cycle found:

```text
vendor-firebase-core
  -> vendor-firebase-internal
  -> vendor-firebase-core
```

### B. Indirect Circular Imports

No indirect source-level circular imports found involving:

- `groupInviteService`
- `useGroupInvites`
- `useGroups`
- `groupService`
- `src/lib/firebase*`

Indirect generated Firebase chunk dependencies exist through Auth/Firestore/Storage/Functions, but the critical cycle is the direct two-node chunk cycle above.

## Exact Root Cause

Root cause:

`vite.config.ts` manually chunks Firebase public packages and `@firebase/*` internals into separate chunks even though those modules depend on each other during top-level initialization.

This causes Rollup to produce cyclic generated chunks:

```text
vendor-firebase-core <-> vendor-firebase-internal
```

The browser then evaluates one chunk while the other chunk's exported binding is still uninitialized, producing:

```text
ReferenceError: Cannot access 'u' before initialization
```

## Recommended Smallest Safe Fix

Smallest safe fix:

Collapse all Firebase packages into one manual chunk, or remove Firebase-specific manual chunking entirely.

Recommended minimal config change:

```ts
manualChunks(id) {
  if (!id.includes('node_modules')) return undefined;
  if (id.includes('firebase') || id.includes('@firebase/')) return 'vendor-firebase';
  if (id.includes('@tanstack/react-query')) return 'vendor-query';
  if (id.includes('react-router') || id.includes('@remix-run')) return 'vendor-router';
  if (id.includes('lucide-react')) return 'vendor-icons';
  if (id.includes('react') || id.includes('scheduler')) return 'vendor-react';
  return 'vendor-misc';
}
```

Even safer:

Remove all Firebase manual chunk rules and let Rollup decide Firebase chunk boundaries.

## Why This Is Safer Than Touching Phase 7G Code

Changing Phase 7G imports would only move when Firebase modules are loaded. It would not remove the generated Firebase cycle because the app already imports Firebase auth and Firestore at startup.

Fixing `vite.config.ts` addresses the actual generated cycle and keeps the Phase 7G invite UI behavior intact.

## Risk Assessment

Risk level: Critical

Impact:

- App can render a blank page before React mounts.
- Error occurs in vendor chunk initialization, so app-level error boundaries may not catch it.
- Any route depending on Firebase can trigger the broken cycle.

Fix risk:

- Low if all Firebase packages are collapsed into a single vendor chunk.
- Bundle size may shift, but runtime initialization order becomes safe.
- No Firestore rules, Functions, or data migrations are involved.

## Validation Performed

Commands / checks run:

```text
Static source import-cycle scan:
totalCycles: 0
focusedCycles: 0
```

```text
Generated dist chunk graph:
vendor-firebase-core-C4wLl9rc.js -> vendor-firebase-internal-wbZDx0NR.js -> vendor-firebase-core-C4wLl9rc.js
```

```text
vite.config.ts manualChunks reviewed and identified as the chunk split source.
```

No code fix was applied in this audit.

