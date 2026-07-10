# Phase 18I-2A — wellnessLogService Undefined Payload Fix

**Date:** 2026-06-29
**Branch:** fix/p0-pre-deploy-blockers
**Fixes:** BUG-I-2 from Phase 18I-1 audit

---

## 1. Problem

`wellnessLogService.writeLog` called `batch.set(logRef, logPayload)` without sanitizing `undefined` values. Optional fields such as `notes`, `moodBefore`, `moodAfter`, `startTime`, `endTime`, `intakeMl`, `bedtime`, `wakeTime`, and `quality` could be `undefined` when not provided by the caller. Firestore rejects `undefined` field values with:

> `WriteBatch.set() called with invalid data. Unsupported field value: undefined`

The `metadata` objects built in `logFasting`, `logHydration`, `logSleep`, and `logMeditation` spread these optional inputs directly, so undefined propagated into the top-level payload passed to `batch.set`.

`workoutService` was already protected by `removeUndefinedDeep`; `wellnessLogService` was not.

---

## 2. Fix

### `src/services/wellnessLogService.ts`

Added `removeUndefinedDeep` function (identical implementation to `workoutService.ts`) as a module-level helper:

```ts
function removeUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => removeUndefinedDeep(item)) as T;
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .map(([key, item]) => [key, removeUndefinedDeep(item)]),
    ) as T;
  }
  return value;
}
```

Changed `batch.set(logRef, logPayload)` to:

```ts
batch.set(logRef, removeUndefinedDeep(logPayload));
```

This sanitizes both the top-level payload (e.g. `notes: undefined`) and nested metadata objects (e.g. `metadata.moodBefore: undefined`) in a single call.

### Why not export from workoutService?

`removeUndefinedDeep` in `workoutService.ts` is a module-private function. Exporting it and importing it in `wellnessLogService` would create a cross-service dependency for a pure utility. Duplicating the small function keeps both services self-contained, matching the existing pattern.

---

## 3. What Was Not Changed

- Scoring engines — untouched
- Firestore rules — untouched
- `workoutService` — untouched (guard 18I-2A-5 verifies)
- All four log methods (`logFasting`, `logHydration`, `logSleep`, `logMeditation`) — still build metadata objects identically; `removeUndefinedDeep` strips undefined at write time
- Phase 18H streak UX changes — untouched

---

## 4. Files Changed

| File | Change |
|------|--------|
| `src/services/wellnessLogService.ts` | Added `removeUndefinedDeep`; applied to `batch.set(logRef, ...)` |
| `scripts/testScoringGuards.ts` | Updated existing guard (line ~1038) to match sanitized call; added guards 18I-2A-1 through 18I-2A-5 |

---

## 5. Regression Guards

| ID | What it guards |
|----|---------------|
| 18I-2A-1 | `wellnessLogService` defines `removeUndefinedDeep` |
| 18I-2A-2 | `batch.set(logRef, ...)` wraps payload with `removeUndefinedDeep` |
| 18I-2A-3 | Raw `logPayload` is NOT passed directly to `batch.set` |
| 18I-2A-4 | All four log methods still present |
| 18I-2A-5 | `workoutService` sanitized payload pattern remains intact |

Also updated: pre-existing guard that checked `batch.set(logRef, logPayload)` — updated to match the new `batch.set(logRef, removeUndefinedDeep(logPayload))` form.

---

## 6. Validation

```
npx tsc --noEmit                          → ✅ No errors
npm run build                             → ✅ Built in 3.94s
npm run test:scoring-guards               → ✅ All guards passed (incl. 18I-2A-1…5)
npm run test:home-challenge-feeds         → ✅ All guards passed
npm run audit:challenge-creation-payloads → ✅ All guards passed
```
