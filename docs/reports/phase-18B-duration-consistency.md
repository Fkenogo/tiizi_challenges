# Phase 18B — Challenge Duration Calculation Consistency

**Date:** 2026-06-28
**Branch:** fix/p0-pre-deploy-blockers

---

## Problem

Manual testing reproduced:

```
requiredConsecutiveDays (7) cannot exceed durationDays (6)
```

when creating a 7-day streak challenge (Aug 1–Aug 7, `requiredConsecutiveDays: 7`).

Root cause: two different duration formulas were in use.

| Location | Formula | Aug 1–Aug 7 result |
|---|---|---|
| `CreateChallengeWizard.tsx` (client) | `Math.floor(diff / ms) + 1` | **7** ✅ |
| `CreateChallengeScreen.tsx` (client) | `Math.floor(diff / ms) + 1` | **7** ✅ |
| `challengeCreationBackend.ts` fallback | `Math.round(diff / ms)` | **6** ❌ |
| `challengeService.ts` legacy path | `Math.round(diff / ms)` | **6** ❌ |
| `ChallengeDetailScreen.tsx` display | `Math.ceil(diff / ms) + 1` | **7** ✅ |

The Wizard always sends `durationDays` explicitly alongside `startDate`/`endDate`, so the backend's exclusive fallback was never triggered in normal user flows. However any path that omits `durationDays` would hit the buggy formula and produce 6 instead of 7 for an Aug 1–Aug 7 challenge.

---

## Rule

> Challenge duration is **inclusive** of both startDate and endDate.
> Aug 1 → Aug 1 = 1 day. Aug 1 → Aug 7 = 7 days.
> Formula: `Math.floor((end - start) / msPerDay) + 1`

---

## Changes

### 1. New shared utility — `src/features/Challenges/utils/challengeDuration.ts` (created)

```ts
export function calculateInclusiveDurationDays(startDate: string, endDate: string): number | null {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return null;
  return Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
}
```

Single definition, single formula, imported by all frontend callers.

### 2. `src/features/Challenges/CreateChallengeWizard.tsx` (modified)

Removed inline `useMemo` formula. Now imports and uses `calculateInclusiveDurationDays`.

Before:
```ts
const challengeDurationDays = useMemo(() => {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (...) return null;
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1;
}, [startDate, endDate]);
```

After:
```ts
const challengeDurationDays = useMemo(
  () => calculateInclusiveDurationDays(startDate, endDate),
  [startDate, endDate],
);
```

### 3. `src/features/Admin/Challenges/CreateChallengeScreen.tsx` (modified)

Removed local `toDurationDays` function. Now imports and uses `calculateInclusiveDurationDays`.

Before:
```ts
function toDurationDays(startDate: string, endDate: string) {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (...) return null;
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1;
}
```

After: function removed; call site uses `calculateInclusiveDurationDays(startDate, endDate)`.

### 4. `functions/src/challengeCreationBackend.ts` (modified)

Backend fallback formula fixed to inclusive.

Before:
```ts
durationDays = explicitDuration
  ?? Math.max(1, Math.round((Date.parse(endDate) - Date.parse(startDate)) / MILLISECONDS_PER_DAY));
```

After:
```ts
durationDays = explicitDuration
  ?? Math.max(1, Math.floor((Date.parse(endDate) - Date.parse(startDate)) / MILLISECONDS_PER_DAY) + 1);
```

### 5. `src/services/challengeService.ts` (modified)

Legacy `createChallenge` path (ARCH-2 dead code) fixed to inclusive for consistency.

Before:
```ts
const durationDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
```

After:
```ts
const durationDays = Math.max(1, Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
```

### 6. `scripts/testChallengeCreationBackend.ts` (modified)

Added 4 new Phase 18B duration guards:

| Guard | Expected | Result |
|---|---|---|
| Aug 1 → Aug 2, no `durationDays` sent | `durationDays: 2` | ✅ |
| Aug 1 → Aug 7, no `durationDays` sent | `durationDays: 7` | ✅ |
| Streak: Aug 1–Aug 7, `requiredConsecutiveDays: 7`, no `durationDays` | Passes (no error) | ✅ |
| Streak: Aug 1–Aug 7, `requiredConsecutiveDays: 8`, no `durationDays` | Rejects with `invalid-argument` | ✅ |

---

## Test Results

| Suite | Result |
|---|---|
| `npx tsc --noEmit` | ✅ CLEAN |
| `npm run build` | ✅ 5.22s |
| `npm run test:challenge-creation-backend` | ✅ PASS (4 new guards added) |
| `npm run test:challenge-creation-6combos` | ✅ PASS (6 combos × 10 assertions) |
| `npm run test:scoring-guards` | ✅ PASS |
| `npm run test:home-challenge-feeds` | ✅ PASS |
| `npm run audit:challenge-creation-payloads` | ✅ PASS (8 guards) |

---

## Confirmation

A 7-day streak challenge (Aug 1–Aug 7) with `requiredConsecutiveDays: 7` and **no explicit `durationDays`** now passes backend validation. The backend fallback correctly computes `durationDays: 7` (inclusive), and the `requiredConsecutiveDays <= durationDays` check (7 ≤ 7) passes.

---

## Remaining Duration Risks

| Risk | Severity | Status |
|---|---|---|
| `ChallengeDetailScreen` uses `Math.ceil(...) + 1` instead of `Math.floor(...) + 1` | Low | Cosmetically different formula but produces the same result for exact midnight-to-midnight dates. No action needed unless time-zone edge cases arise. |
| `EditWellnessTemplateScreen` / `EditChallengeTemplateScreen` use a plain `durationDays` number field (not date-based) | None | Templates store duration as a day count directly — no formula is applied. Correct. |
| `challengeService.createChallenge` (ARCH-2 dead path) still exists | Low | Fixed to inclusive in this phase. Still unreachable from any user-facing flow — cleanup tracked as ARCH-2. |

---

## Files Changed

| File | Change |
|---|---|
| `src/features/Challenges/utils/challengeDuration.ts` | Created — shared inclusive duration utility |
| `src/features/Challenges/CreateChallengeWizard.tsx` | Uses shared utility, removed inline formula |
| `src/features/Admin/Challenges/CreateChallengeScreen.tsx` | Uses shared utility, removed `toDurationDays` function |
| `functions/src/challengeCreationBackend.ts` | Backend fallback: `Math.round` → `Math.floor + 1` |
| `src/services/challengeService.ts` | Legacy path: `Math.round` → `Math.floor + 1` |
| `scripts/testChallengeCreationBackend.ts` | 4 new Phase 18B duration guards |
