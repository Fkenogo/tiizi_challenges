# Phase 18I-4C — Fix SelectChallengeActivityScreen Progress Key Mismatch

**Date:** 2026-06-29
**Branch:** fix/p0-pre-deploy-blockers
**Fixes:** BUG-3-3 from Phase 18I-3 audit

---

## 1. Problem

`SelectChallengeActivityScreen` displayed 0 / 7,000 steps progress for a competitive wellness challenge even after the user had logged steps. The cumulative lookup was reading the wrong key from `membership.cumulativeValues`.

**Write path (engine):**
- `competitiveEngine.ts` writes `cumulativeValues[logEvent.activityId]`
- For wellness: `logEvent.activityId = input.activityId` (set in `wellnessLogService`)
- For fitness: `logEvent.activityId = input.exerciseId` (set in `workoutService`)

**Engine's own completion-rate read (lines 51–53):**
```ts
const primaryKey = act.activityId ?? act.exerciseId ?? '';   // activityId first
const fallbackKey = act.exerciseId ?? act.activityId ?? '';
const cumVal = newCumulativeValues[primaryKey] ?? newCumulativeValues[fallbackKey] ?? 0;
```

**Screen's read (before fix):**
```ts
const key = activity.exerciseId || activity.activityId || activity.exerciseName || '';
```

The screen used `exerciseId` first. For wellness challenges where the challenge activity has both `exerciseId` and `activityId` set, the screen looked up `cumulativeValues[exerciseId]` — but the engine wrote the value under `cumulativeValues[activityId]` — returning 0.

---

## 2. Root Cause

Key resolution order was reversed between the write path and the read path:

| Path | Order |
|------|-------|
| Engine writes | `activityId` (canonical) |
| Engine reads (completionRate) | `activityId ?? exerciseId` |
| Screen reads (progress bar) | `exerciseId \|\| activityId` ← **mismatch** |

---

## 3. Fix

### `src/features/Workouts/SelectChallengeActivityScreen.tsx`

**Added `resolveActivityKey` helper** (before `todayDateString`, after imports):
```ts
function resolveActivityKey(activity: {
  activityId?: string;
  exerciseId?: string;
  exerciseName?: string;
}): string {
  return activity.activityId ?? activity.exerciseId ?? activity.exerciseName ?? '';
}
```

This mirrors the engine's `primaryKey = act.activityId ?? act.exerciseId ?? ''` exactly.

**Fixed `competitiveActivities` useMemo** (was line 76):
```ts
// Before:
const key = activity.exerciseId || activity.activityId || activity.exerciseName || '';

// After:
const key = resolveActivityKey(activity);
```

**Removed dead `key` variable in JSX block** (was lines 331 + 338):
```ts
// Removed — variable was computed but immediately void'd and never used:
const key = activity.exerciseId || activityId || activity.exerciseName || '';
// ...
void key;
```
The JSX progress display already uses `found` from `competitiveActivities.find(...)`, which is driven by the now-correct useMemo. The dead code was vestigial.

---

## 4. Key Design Decision

The canonical `cumulativeValues` key is **`activityId` first, `exerciseId` as fallback**. This is dictated by the engine's write path and must be preserved in any consumer that reads `cumulativeValues`. The `resolveActivityKey` helper isolates this contract so it cannot diverge again silently.

---

## 5. What Was Not Changed

- `competitiveEngine.ts` — untouched ✅
- `wellnessLogService.ts` — untouched ✅
- `workoutService.ts` — untouched ✅
- `ChallengeDetailScreen.tsx` (mini-leaderboard) — untouched ✅
- `leaderboardSort.ts` — untouched ✅
- All other `SelectChallengeActivityScreen` logic (navigation, `handleLog`, streak/collective panels) — untouched ✅

---

## 6. Files Changed

| File | Change |
|------|--------|
| `src/features/Workouts/SelectChallengeActivityScreen.tsx` | Added `resolveActivityKey` helper; fixed `competitiveActivities` useMemo key lookup; removed dead `key`/`void key` code |
| `scripts/testScoringGuards.ts` | Added guards 18I-4C-1 through 18I-4C-5 |

---

## 7. Regression Guards

| ID | What it guards |
|----|---------------|
| 18I-4C-1 | `resolveActivityKey` helper function is defined in the screen |
| 18I-4C-2 | `resolveActivityKey` uses `activityId ?? exerciseId` order (activityId first) |
| 18I-4C-3 | `competitiveActivities` useMemo calls `resolveActivityKey(activity)` |
| 18I-4C-4 | The old exerciseId-first fallback string does not appear in the file |
| 18I-4C-5 | `membership.cumulativeValues` lookup is still present (not accidentally removed) |

---

## 8. Manual Retest Required

Yes — browser verification needed:

1. Open a v2 competitive challenge with wellness activities (e.g., "7-Day Race to 7,000 steps")
2. Log an activity (e.g., 2,500 steps)
3. Return to `SelectChallengeActivityScreen` for that challenge
4. Confirm the **My Progress** panel shows 2,500 / 7,000 (not 0 / 7,000)
5. Log again; confirm progress accumulates correctly

---

## 9. Validation

```
npx tsc --noEmit                → ✅ No errors
npm run test:scoring-guards     → ✅ All guards passed (incl. 18I-4C-1…5)
```
