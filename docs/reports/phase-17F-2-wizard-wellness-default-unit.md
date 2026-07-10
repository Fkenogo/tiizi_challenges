# Phase 17F-2 — Fix Wizard Wellness Add Activity Default Unit

**Date:** 2026-06-28
**Branch:** fix/p0-pre-deploy-blockers
**Scope:** One-line fix in `CreateChallengeWizard.tsx` — no other changes.

---

## Problem (BUG-1 from Phase 17F-1 audit)

`addActivity` in `CreateChallengeWizard` hardcoded `unit: 'Reps'` for every new activity row regardless of mode. In wellness mode, the correct default unit is `'count'` — this is what the wellness library picker sets on pick, and what `CreateChallengeScreen` (Admin Create) already uses.

---

## Fix

**File:** `src/features/Challenges/CreateChallengeWizard.tsx` line 342

**Before:**
```ts
setActivities((prev) => [...prev, { query: '', exerciseId: undefined, targetValue: '', unit: 'Reps' }]);
```

**After:**
```ts
setActivities((prev) => [...prev, { query: '', exerciseId: undefined, targetValue: '', unit: isWellnessMode ? 'count' : 'Reps' }]);
```

`isWellnessMode` is already in scope at this call site (`= challengeCategory !== 'fitness'`, derived at line 288).

---

## What Was Not Changed

- Picker logic (open/close/populate) — unchanged
- Validation — unchanged
- Payload mapping — unchanged
- Cloud Functions, Firestore, services — unchanged

---

## Files Changed

| File | Change |
|---|---|
| `src/features/Challenges/CreateChallengeWizard.tsx` | `unit: 'Reps'` → `unit: isWellnessMode ? 'count' : 'Reps'` in `addActivity` |

---

## Behaviour After Fix

| Mode | "+ Add Activity" default unit |
|---|---|
| Fitness | `'Reps'` |
| Wellness | `'count'` |

The unit is still overwritten on wellness library pick (`activity.defaultMetricUnit`), so this fix only affects the pre-pick placeholder value visible in the unit field before the user selects an activity.

---

## Build Output

```
npx tsc --noEmit  →  CLEAN (zero errors)
npm run build     →  ✓ built in 11.95s (pre-existing vendor chunk warning only)
```
