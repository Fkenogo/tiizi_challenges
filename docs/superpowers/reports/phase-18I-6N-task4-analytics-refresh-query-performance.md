# Phase 18I-6N Task 4 — Analytics Refresh + Query Performance

**Date:** 2026-07-03
**Branch:** fix/p0-pre-deploy-blockers

---

## Summary

Four performance and freshness improvements to the analytics data layer. Two of the five spec tasks were already complete from Task 1; the remaining three are addressed here.

---

## Status per Spec Task

| Task | Status | Notes |
|------|--------|-------|
| 1. `useLogWorkout` invalidates `user-analytics` | ✅ Already done (Task 1) | `USER_ANALYTICS_QUERY_KEY(workout.userId)` in `onSuccess` |
| 2. `useLogWellnessActivity` invalidates `user-analytics` | ✅ Already done (Task 1) | `USER_ANALYTICS_QUERY_KEY(input.userId)` in `onSuccess` |
| 3. Invalidate `user-workouts` if `useUserWorkouts` still used | ✅ N/A | No remaining callers in UI after Tasks 2–3 |
| 4. Reduce `useUserStreak` staleTime to ≤ 5 minutes | ✅ Fixed here | 60 min → 5 min |
| 5. `getWorkoutsByUser` date filter / new method | ✅ Added here | `getWorkoutsByUserSince(userId, sinceDate)` |

---

## Changes

### `src/hooks/useStreak.ts`

Both `useUserStreak` and `useChallengeStreak` had a 60-minute `staleTime`. After a user logs a workout or wellness activity, the streak query is now invalidated (via the `['streak', 'user', userId]` key already in both log mutation `onSuccess` handlers), but a 60-minute staleTime meant the next navigation to Profile or Analytics would not re-fetch even if the cache was warm. Reduced to 5 minutes to match the analytics layer.

```ts
// before
staleTime: 60 * 60 * 1000   // 60 minutes

// after
staleTime: 5 * 60 * 1000    // 5 minutes
```

### `src/services/workoutService.ts`

Added `getWorkoutsByUserSince(userId, sinceDate)` — a date-bounded variant of `getWorkoutsByUser`. Takes a local ISO date string (same format as `toLocalIsoDate`) and filters with `where('date', '>=', sinceDate)`.

The original `getWorkoutsByUser` is retained unchanged (still needed for challenge-scoped full-history queries). `userAnalyticsService` already performs its own date-filtered Firestore query inline; this method makes the pattern reusable without touching that service.

---

## Guards Added (Task 4)

| Guard | Assertion |
|-------|-----------|
| `useLogWorkout` invalidates `user-analytics` | `USER_ANALYTICS_QUERY_KEY` appears in `useWorkouts.ts` |
| `useLogWellnessActivity` invalidates `user-analytics` | `USER_ANALYTICS_QUERY_KEY` appears ≥2 times |
| `useUserStreak` staleTime ≤ 5 min | Matches `5 * 60 * 1000` in `useStreak.ts` |
| `workoutService` has date-filtered method | `getWorkoutsByUserSince` present |
| `userAnalyticsService` workout query has date filter | `where('date', '>=',` present in service |

---

## Files Changed

| File | Change |
|------|--------|
| `src/hooks/useStreak.ts` | `staleTime` 60 min → 5 min on both hooks |
| `src/services/workoutService.ts` | Add `getWorkoutsByUserSince(userId, sinceDate)` |
| `scripts/testProfileAnalyticsGuards.ts` | Add 5 Task 4 guards |

---

## Validation

```
npx tsc --noEmit                      ✅ clean
npm run build                         ✅ built in 3.42s
npm run test:profile-analytics-guards ✅ all guards passed
npm run test:scoring-guards           ✅ scoring guards passed
```
