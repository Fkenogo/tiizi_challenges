# Phase 18I-5F — Fix Collective Challenge Progress Engine and Complete Progress UX

**Date:** 2026-07-01
**Branch:** fix/p0-pre-deploy-blockers

---

## 1. Root Cause Analysis

### Why NaN appeared

`computeGroupTransition` in `src/utils/collectiveGroupTransition.ts` contained:

```ts
const newTotal = input.groupCurrentTotal + delta;
```

The TypeScript type declared `groupCurrentTotal: number`, but Firestore returns `undefined` for any field that was never written to a document. For collective challenges created before `groupCurrentTotal` was first set (e.g. a brand-new challenge before anyone logged anything), the transaction read `undefined` from Firestore and passed it through as-is.

`undefined + 100 = NaN`. Firestore then stored `NaN` as the field value. From that point on:

- On every subsequent transaction: `NaN + delta = NaN` — NaN was compounded
- On every read: `challenge.groupCurrentTotal` = `NaN`
- `NaN ?? 0` = `NaN` (nullish coalescing only catches `null` / `undefined`, **not** `NaN`)
- `NaN.toLocaleString()` = `"NaN"` — displayed to the user

This explains:
- `"NaN / 2,000 reps"` — group total was NaN
- `"NaN logged"` — same field
- `"NaN%"` — `NaN / target * 100` = NaN
- Write path was correct (the logged value was saved) but the aggregate total was corrupt

### Why the completion screen showed correct values

`WorkoutLoggedScreen` displays `+{value}` from URL query params, not from the Firestore aggregate — so "You added 100 reps" was always correct. But `groupCurrentTotal` (stale even when not NaN) came from the React Query cache which was not invalidated after logging.

---

## 2. Architecture: Progress Data Flow

```
Firestore (challenges doc)
  └── groupCurrentTotal    ← atomicCollectiveGroupUpdate writes here
  └── groupCumulativeTarget

Firestore (challengeMembers doc)
  └── cumulativeLoggedValue  ← user's personal total
  └── completionRate

challengeProgressDisplay.ts::buildChallengeProgress(challenge, membership)
  ├── Collective: groupCurrentTotal / groupCumulativeTarget
  │   └── secondaryLabel: "You contributed N unit" from membership.cumulativeLoggedValue
  ├── Competitive: membership.cumulativeLoggedValue / Σ(activities.targetValue)
  └── Streak: membership.currentStreak / requiredConsecutiveDays

Consumed by:
  useHomeScreen.ts → ActiveChallengeCard (home cards)
  ChallengeDetailScreen (inline progress blocks)
  WorkoutLoggedScreen (post-log screen)
  ChallengeLeaderboardScreen (group header)
  ChallengeCompletedScreen
  LogWorkoutScreen / LogWellnessActivityScreen / SelectChallengeActivityScreen
```

All screens now share the same `safeNum` guard. No screen independently re-computes percentages from raw field values.

---

## 3. Changes Made

### 3a. Root cause fix — `src/utils/collectiveGroupTransition.ts`

**Before:**
```ts
const newTotal = input.groupCurrentTotal + delta;  // NaN if field missing
```

**After:**
```ts
const rawPrev = Number(input.groupCurrentTotal ?? 0);
const prevTotal = Number.isFinite(rawPrev) ? rawPrev : 0;
const newTotal = prevTotal + delta;
```

Guards both `undefined` (field never written) and `NaN` (already-stored bad value). The transaction now always writes a finite `clampedTotal`.

### 3b. Defensive read guard — `src/features/Challenges/challengeProgressDisplay.ts`

Added `safeNum` (exported so all screens can use it):

```ts
export function safeNum(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}
```

The `clamp()` function now routes through `safeNum`. All numeric inputs (`groupCurrentTotal`, `groupCumulativeTarget`, `cumulativeLoggedValue`, `currentStreak`) are passed through `safeNum` before any arithmetic.

### 3c. Query cache invalidation — `src/hooks/useWorkouts.ts`

Added `['challenge', challengeId]` to both `useLogWorkout.onSuccess` and `useLogWellnessActivity.onSuccess`. Previously only `['challenges', uid]` (plural) was invalidated — the singular `useChallenge` query key `['challenge', id, uid]` was never cleared, so `WorkoutLoggedScreen` always showed pre-workout data.

### 3d. Optimistic collective total — `src/features/Workouts/WorkoutLoggedScreen.tsx`

```ts
const cachedGroupTotal = safeNum(challenge?.groupCurrentTotal);
const groupCurrentTotal = challengeType === 'collective' ? cachedGroupTotal + value : cachedGroupTotal;
```

The cached total (which may be slightly stale due to re-fetch latency) is immediately augmented by this log's contribution so the screen shows the correct new total without waiting for Firestore to respond.

### 3e. Full collective UX — WorkoutLoggedScreen

Replaced the old progress section with the spec-compliant layout:

```
TEAM PROGRESS          [header]
3,100 / 5,000 reps     [group total / target]
████████░░ 62%         [bar + pct]
900 reps remaining

YOUR CONTRIBUTION
+100 reps today
750 reps total
```

### 3f. Full collective UX — ChallengeDetailScreen

Replaced the "Team Goal" card with a "Team Progress" card:
- Shows `groupTotal / groupTarget unit`
- Progress bar
- `XX% · N remaining`
- "You contributed N unit" from `membership.cumulativeLoggedValue` (conditional on membership existing and value > 0)

### 3g. Competitive leader comparison — ChallengeDetailScreen

Leaderboard snapshot is already fetched in this screen. A new block below "Personal Target":
- If user is rank 1: "You are leading 🏆"
- Otherwise: leader value / total target, gap in units behind leader

### 3h. Home card secondary label — `ActiveChallengeCard` + `useHomeScreen.ts`

- `ActiveChallengeCard` now accepts `secondaryLabel?: string` and renders it below the progress bar
- `useHomeScreen.ts` passes `display.secondaryLabel` from `buildChallengeProgress` to the card
- For collective challenges this shows "You contributed N unit" directly on the home card

### 3i. `safeNum` applied to all collective screens

| File | Change |
|------|--------|
| `LogWorkoutScreen.tsx` | `groupCurrentTotal = safeNum(...)` |
| `LogWellnessActivityScreen.tsx` | `groupCurrentTotal = safeNum(...)` |
| `SelectChallengeActivityScreen.tsx` | `groupCurrentTotal = safeNum(...)` |
| `ChallengeLeaderboardScreen.tsx` | `groupCurrentTotal = safeNum(...)` |
| `ChallengeCompletedScreen.tsx` | `groupCurrentTotal = safeNum(...)`, `safeNum(cumulativeLoggedValue)` |

---

## 4. Files Changed

| File | Change |
|------|--------|
| `src/utils/collectiveGroupTransition.ts` | NaN root-cause fix in `computeGroupTransition` |
| `src/features/Challenges/challengeProgressDisplay.ts` | `safeNum` added and exported; used in all numeric paths |
| `src/hooks/useWorkouts.ts` | Invalidate `['challenge', id]` on log success (both hooks) |
| `src/features/Workouts/WorkoutLoggedScreen.tsx` | Optimistic total; Team Progress + Your Contribution UX |
| `src/features/Challenges/ChallengeDetailScreen.tsx` | Team Progress section; leader comparison for competitive |
| `src/components/Home/ActiveChallengeCard.tsx` | Render `secondaryLabel` |
| `src/features/Home/useHomeScreen.ts` | Pass `secondaryLabel` from `buildChallengeProgress` |
| `src/features/Workouts/LogWorkoutScreen.tsx` | `safeNum` for collective fields |
| `src/features/Workouts/LogWellnessActivityScreen.tsx` | `safeNum` for collective fields |
| `src/features/Workouts/SelectChallengeActivityScreen.tsx` | `safeNum` for collective fields |
| `src/features/Challenges/ChallengeLeaderboardScreen.tsx` | `safeNum` for collective fields |
| `src/features/Challenges/ChallengeCompletedScreen.tsx` | `safeNum` for collective fields |
| `scripts/testScoringGuards.ts` | Guards 18I-5F-1 through 18I-5F-15 |

---

## 5. Regression Guards (18I-5F-1 … 18I-5F-15)

| ID | What it guards |
|----|----------------|
| 18I-5F-1 | `computeGroupTransition` finite output when `groupCurrentTotal` is `undefined` |
| 18I-5F-2 | `computeGroupTransition` finite output when `groupCurrentTotal` is `NaN` |
| 18I-5F-3a–e | `safeNum` correctly handles undefined, null, NaN, Infinity, and normal numbers |
| 18I-5F-4 | `buildChallengeProgress` collective never produces NaN in label or progress |
| 18I-5F-5 | Collective secondary label includes user contribution value |
| 18I-5F-5b | Collective primary label shows group total / target |
| 18I-5F-6 | Competitive primary label never contains NaN |
| 18I-5F-7 | WorkoutLoggedScreen uses `safeNum` |
| 18I-5F-8 | WorkoutLoggedScreen computes optimistic total as `cachedGroupTotal + value` |
| 18I-5F-9 | WorkoutLoggedScreen renders "Team Progress" header |
| 18I-5F-10 | WorkoutLoggedScreen renders "Your Contribution" section |
| 18I-5F-11 | Both log hooks invalidate `['challenge', challengeId]` |
| 18I-5F-12 | `ActiveChallengeCard` accepts and renders `secondaryLabel` |
| 18I-5F-13 | `ChallengeDetailScreen` uses `safeNum` for collective math |
| 18I-5F-14 | `ChallengeDetailScreen` displays "You contributed" |
| 18I-5F-15 | `ChallengeDetailScreen` shows leader comparison for competitive |

---

## 6. Validation

```
npx tsc --noEmit                          → ✅ No errors
npm run build                             → ✅ Built in 3.00s
npm run test:scoring-guards               → ✅ All guards passed (incl. 18I-5F-1…15)
npm run test:home-challenge-feeds         → ✅ All guards passed
npm run audit:challenge-creation-payloads → ✅ All guards passed
```

---

## 7. Manual Test Checklist

### Collective challenge (NaN fix)
1. Open a collective challenge that previously showed "NaN / 2,000 reps"
2. Detail screen → "Team Progress" card should now show `0 / 2,000 reps` (or real total if already logged)
3. Log a workout → WorkoutLoggedScreen should show "Team Progress: 100 / 2,000 reps", "Your Contribution: +100 reps today"
4. Return to Home → challenge card should show updated team total and "You contributed N reps" below bar
5. Return to Detail → "You contributed N reps" appears below progress bar

### Competitive leader comparison
6. Open a competitive challenge with other members
7. Detail screen "Personal Target" card → if not leading: "Leader: N / T reps · X reps behind leader"; if leading: "You are leading 🏆"

### NaN should never appear
8. No screen should show any NaN in progress labels or percentages

---

## 8. Known Limitations

- **Existing NaN in Firestore**: Challenges that already have `NaN` stored as `groupCurrentTotal` will continue to display `0 / target` until a new workout is logged (the transaction fix clears NaN on next write). A one-time data migration script could fix these immediately but is out of scope for this phase (no production writes).
- **WorkoutLoggedScreen optimistic total**: The optimistic total adds `value` once; if the user refreshes before the Firestore re-fetch completes, they may briefly see the correct total then have it update again. This is acceptable behavior.
- **Leader comparison on home card**: Not implemented — would require an extra Firestore read per competitive challenge on the home screen. Available in ChallengeDetailScreen where the leaderboard is already loaded.
- **Group highlights / GroupDetailScreen**: These use `groupCurrentTotal` from the challenge object passed via existing service calls, which are now guarded by `safeNum` in their respective screens. No separate changes needed.
