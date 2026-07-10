# Phase 18B-1 — Fix Stale Duration Scoring Guard

**Date:** 2026-06-28
**Branch:** fix/p0-pre-deploy-blockers

---

## Diagnosis

`npm run test:scoring-guards` failed with:

```
AssertionError: 15E-1: durationDays must be derived from dates when endDate is provided — must not default to 14
```

Guard 15E-1 in `scripts/testScoringGuards.ts` (line 4196) used an exact string match against the old backend formula:

```ts
// Before Phase 18B — what guard 15E-1 checked for:
backend.includes('Math.max(1, Math.round((Date.parse(endDate) - Date.parse(startDate)) / MILLISECONDS_PER_DAY))')
```

Phase 18B changed the backend formula from `Math.round` (exclusive) to `Math.floor + 1` (inclusive). The production code was correct; the guard was stale.

**This was a stale test guard only. No production logic required fixing.**

---

## Fix

### `scripts/testScoringGuards.ts` — guard 15E-1 (lines 4193–4198)

**Before:**
```ts
// 15E-1: durationDays is derived from endDate - startDate when endDate is provided
// (never silently defaults to 14 when dates are available)
assert.ok(
  backend.includes('Math.max(1, Math.round((Date.parse(endDate) - Date.parse(startDate)) / MILLISECONDS_PER_DAY))'),
  '15E-1: durationDays must be derived from dates when endDate is provided — must not default to 14',
);
```

**After:**
```ts
// 15E-1: durationDays is derived from endDate - startDate when endDate is provided
// (never silently defaults to 14 when dates are available)
// Phase 18B: formula changed from Math.round (exclusive) to Math.floor + 1 (inclusive)
assert.ok(
  backend.includes('Math.max(1, Math.floor((Date.parse(endDate) - Date.parse(startDate)) / MILLISECONDS_PER_DAY) + 1)'),
  '15E-1: durationDays must be derived from dates inclusively (Math.floor + 1) when endDate is provided — must not default to 14',
);
```

The guard's intent is preserved: it still rejects any path that defaults to 14 when dates are present. It now matches the Phase 18B inclusive formula instead of the old exclusive one.

---

## Test Results

| Suite | Result |
|---|---|
| `npx tsc --noEmit` | ✅ CLEAN |
| `npm run build` | ✅ 9.69s |
| `npm run test:scoring-guards` | ✅ PASS (13 guards) |
| `npm run test:challenge-creation-backend` | ✅ PASS |
| `npm run test:challenge-creation-6combos` | ✅ PASS |
| `npm run audit:challenge-creation-payloads` | ✅ PASS |

---

## Verdict

Stale test guard only. No production code changed in this phase.
