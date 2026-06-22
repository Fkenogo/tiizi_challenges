# Phase 7G Blank Screen Fix

Date: 2026-06-12

## Summary

Fixed the Phase 7G production blank-screen regression caused by Firebase packages being split into mutually dependent generated vendor chunks.

No Phase 7G app UI code was changed.
No deployment was run.

## Exact `vite.config.ts` Change

Before, Firebase packages were split across multiple manual chunks:

```ts
if (id.includes('firebase/auth')) return 'vendor-firebase-auth';
if (id.includes('firebase/firestore')) return 'vendor-firebase-firestore';
if (id.includes('firebase/storage')) return 'vendor-firebase-storage';
if (id.includes('firebase/app')) return 'vendor-firebase-core';
if (id.includes('@firebase/')) return 'vendor-firebase-internal';
if (id.includes('firebase')) return 'vendor-firebase-misc';
```

After, all Firebase-related packages are kept in one chunk:

```ts
if (id.includes('firebase') || id.includes('@firebase/')) return 'vendor-firebase';
```

This covers:

- `firebase/*`
- `@firebase/*`

## Build Output

Command:

```bash
npm run build
```

Result: passed.

Relevant output:

```text
> tiizi@0.0.0 build
> tsc -b && vite build

vite v5.4.21 building for production...
✓ 1840 modules transformed.
rendering chunks...
computing gzip size...
dist/assets/vendor-firebase-Bb_TZsLe.js  528.33 kB │ gzip: 124.40 kB

(!) Some chunks are larger than 500 kB after minification.
✓ built in 3.17s
```

The Firebase circular chunk warning is gone.

The remaining warning is only Vite's size warning for the single Firebase vendor chunk.

## Dist Asset Verification

Command:

```bash
ls dist/assets | rg "vendor-firebase"
```

Output:

```text
vendor-firebase-Bb_TZsLe.js
```

Command:

```bash
rg -n "vendor-firebase-(core|internal|auth|firestore|storage|misc)" dist
```

Output: no matches.

Generated import graph check:

```json
{
  "firebaseChunks": [
    "vendor-firebase-Bb_TZsLe.js"
  ]
}
```

Confirmed there is no remaining `vendor-firebase-core` / `vendor-firebase-internal` split.

## Preview Verification

Command:

```bash
npm run preview -- --host 127.0.0.1 --port 4173
```

Preview server started:

```text
Local: http://127.0.0.1:4173/
```

Route check:

```bash
curl -s -I http://127.0.0.1:4173/app/join-group
```

Output:

```text
HTTP/1.1 200 OK
Content-Type: text/html
```

HTML check:

```html
<script type="module" crossorigin src="/assets/index-DfoTpYE5.js"></script>
<link rel="modulepreload" crossorigin href="/assets/vendor-firebase-Bb_TZsLe.js">
```

Firebase asset check:

```bash
curl -s -I http://127.0.0.1:4173/assets/vendor-firebase-Bb_TZsLe.js
```

Output:

```text
HTTP/1.1 200 OK
Content-Type: text/javascript
Content-Length: 528326
```

Note: this environment could verify preview serving over HTTP and the built dependency graph. It could not execute a full interactive browser render because the available local browser tooling did not expose navigation, and Playwright is not installed in this workspace.

## Regression Status

The confirmed root cause has been removed:

```text
Before:
vendor-firebase-core -> vendor-firebase-internal -> vendor-firebase-core

After:
vendor-firebase
```

The production bundle no longer contains the generated Firebase chunk cycle that caused:

```text
ReferenceError: Cannot access 'u' before initialization
```

## Remaining Risks

- The single Firebase chunk is larger than 500 kB after minification. This is a performance warning, not a runtime correctness warning.
- If future manual chunk rules split `firebase/*` and `@firebase/*` again, the same class of runtime initialization bug can return.
- A final visual browser smoke test should be run before deployment in an environment with browser automation or manual browser access.

## Deployment

No deployment was performed.

