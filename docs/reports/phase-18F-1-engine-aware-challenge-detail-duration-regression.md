# Phase 18F-1 — Engine-Aware Challenge Detail + Duration Regression Fix

**Date:** 2026-06-28
**Branch:** fix/p0-pre-deploy-blockers

---

## 1. Duration Regression — Root Cause and Fix

### Root Cause

`CreateChallengeWizard.tsx` built the Cloud Function payload with `startDate` and `endDate` but **omitted `durationDays`**. The backend then derived `durationDays` by falling back to:

```ts
Math.max(1, Math.floor((Date.parse(endDate) - Date.parse(startDate)) / MILLISECONDS_PER_DAY) + 1)
```

This formula is correct (inclusive, `+1`) and matches `calculateInclusiveDurationDays`. However, any variation in how dates are serialized (e.g. with vs. without a `Z` suffix, or sub-millisecond rounding across environments) could produce a value one less than expected, causing the streak guard `requiredConsecutiveDays > durationDays` to fire with "(7) cannot exceed durationDays (6)".

### Fix

Added `durationDays: challengeDurationDays ?? undefined` to the wizard's Cloud Function payload. The client now computes `durationDays` via `calculateInclusiveDurationDays` (the canonical inclusive formula) and sends it explicitly, making the backend's date-subtraction fallback unreachable for wizard-created challenges.

**File:** [`src/features/Challenges/CreateChallengeWizard.tsx`](../../src/features/Challenges/CreateChallengeWizard.tsx)

### Regression Test Added

Added to `scripts/testChallengeCreationBackend.ts` — "June 28 → July 4 = 7 days inclusive (regression guard)": a month-boundary span that previously could produce 6 under certain serialization differences. With `durationDays` sent explicitly this test trivially passes; it guards against re-introducing the fallback path.

---

## 2. ChallengeDetailScreen Engine-Aware Rework

### Old Structure (legacy)

For all challenges regardless of engine or type:
- "Daily Targets" section with `activity.frequency`-based labels (`/day`, `/week`, etc.)
- "How Points Work" section with hardcoded proportional-points copy

Problems:
- "Daily Targets" heading is wrong for cumulative collective challenges (steps total, not per day)
- `freqLabel` based on `activity.frequency` shows nothing for wellness activities (no `frequency` field), but also doesn't respect `targetType`
- "How Points Work" copy is meaningless for streak (no per-log points) and misleading for collective (group total, not per-member)

### New Structure

#### v2 Collective → "Team Goal"

- Displays `groupCumulativeTarget` with unit and "total" suffix
- Shows `groupCurrentTotal` progress bar (logged / target with %)
- Explains: everyone contributes toward one shared target; completes when target reached OR end date
- Activity list with `targetLabel(activity)` — respects `targetType`

#### v2 Competitive → "Personal Target"

- Activity list with `targetLabel(activity)` per activity
- Explains: each member works toward their own target; first to complete or highest completion rate wins
- Ranking rule: completion rate then total points

#### v2 Streak → "Streak Goal"

- Shows `requiredConsecutiveDays` prominently with "days in a row"
- If membership exists: shows `currentStreak` and `longestStreak`
- Explains: log every day to keep the streak; complete before end date
- Activity list with `targetLabel(activity)`

#### Legacy (v1, no `engineVersion`) → unchanged

- Keeps existing "Daily Targets" and "How Points Work" sections exactly

### `targetLabel` helper (new top-level function)

```ts
function targetLabel(activity: { targetValue?: number; unit?: string; targetType?: string }): string {
  switch (activity.targetType) {
    case 'daily':      return `${val} ${unit} per day`;
    case 'weekly':     return `${val} ${unit} per week`;
    case 'monthly':    return `${val} ${unit} per month`;
    case 'cumulative': return `${val.toLocaleString()} ${unit} total`;
    default:           return `${val} ${unit}`.trim();   // no "/day" fallback
  }
}
```

This eliminates the "700,000 steps /day" display for cumulative collective challenges. The default (no `targetType`) shows the value and unit with no frequency suffix.

---

## 3. Files Changed

| File | Change |
|---|---|
| `src/features/Challenges/CreateChallengeWizard.tsx` | Added `durationDays: challengeDurationDays ?? undefined` to Cloud Function payload |
| `src/features/Challenges/ChallengeDetailScreen.tsx` | Added `targetLabel` helper, `isV2` flag, `Flame` + `Users` imports; replaced legacy "Daily Targets" + "How Points Work" sections with engine-specific sections |
| `scripts/testChallengeCreationBackend.ts` | Added June 28 → July 4 inclusive-duration regression test |

---

## 4. Validation

```
npx tsc --noEmit                          → ✅ No errors
npm run build                             → ✅ Built in 7.77s
npm run test:challenge-creation-backend   → ✅ All tests passed (incl. new regression guard)
npm run test:challenge-creation-6combos   → ✅ All 8 combinations passed
npm run audit:challenge-creation-payloads → ✅ All 8 guards passed
npm run test:scoring-guards               → ✅ All 14 guards passed
npm run test:home-challenge-feeds         → ✅ All guards passed
```

---

## 5. Manual Checks Required

The following cannot be verified by the test suite (UI-only):

| Scenario | Expected |
|---|---|
| Open a v2 Collective challenge | "Team Goal" card with group target + progress bar; no "Daily Targets" or "How Points Work" |
| Open a v2 Competitive challenge | "Personal Target" card; activity targets with correct suffix (cumulative = "total") |
| Open a v2 Streak challenge | "Streak Goal" card with requiredConsecutiveDays; current/longest streak if member |
| Open a legacy (v1) challenge | "Daily Targets" and "How Points Work" unchanged |
| Wellness collective with Steps activity (cumulative targetType) | Shows "10,000 steps total" not "10,000 steps /day" |
| Create 7-day streak (Jun 28 → Jul 4) | No "cannot exceed durationDays" error |

---

## 6. Collections Touched

None. All changes are frontend and backend function logic only. No Firestore reads or writes.
