# Phase 18I-4A — Fix ChallengeDetail Mini-Leaderboard Stale Cache

**Date:** 2026-06-29
**Branch:** fix/p0-pre-deploy-blockers
**Fixes:** BUG-3-1 from Phase 18I-3 audit

---

## 1. Problem

After a user logs a workout or wellness activity, the `challenge-leaderboard-snapshot` React Query cache was never invalidated. `ChallengeDetailScreen` uses this key for its mini-leaderboard with `staleTime: 60 * 1000`. Navigating back to the challenge detail screen after logging would serve the pre-log leaderboard data for up to 60 seconds, even though `challenge-membership` (which drives the progress display) was correctly invalidated and fresh.

---

## 2. Fix

### `src/hooks/useWorkouts.ts`

Added `challenge-leaderboard-snapshot` invalidation to the `onSuccess` handler in **both** mutation hooks:

**`useLogWorkout` (line ~92):**
```ts
queryClient.invalidateQueries({ queryKey: ['challenge-leaderboard-snapshot'] }),
```

**`useLogWellnessActivity` (line ~139):**
```ts
queryClient.invalidateQueries({ queryKey: ['challenge-leaderboard-snapshot'] }),
```

The key is intentionally broad (no sub-keys) so it invalidates every cached mini-leaderboard instance regardless of challenge ID. This is safe — the mini-leaderboard refetches instantly when the screen remounts, and the broader invalidation prevents stale data if the user switches between challenges.

---

## 3. What Was Not Changed

- Leaderboard sort logic (`leaderboardSort.ts`) — untouched ✅
- Mini-leaderboard display/score mapping (`ChallengeDetailScreen`) — untouched ✅
- `ChallengeLeaderboardScreen` — untouched ✅
- All other existing invalidation keys — preserved ✅

---

## 4. Files Changed

| File | Change |
|------|--------|
| `src/hooks/useWorkouts.ts` | Added `challenge-leaderboard-snapshot` invalidation to `useLogWorkout` and `useLogWellnessActivity` `onSuccess` |
| `scripts/testScoringGuards.ts` | Added guards 18I-4A-1, 18I-4A-2, 18I-4A-3 |

---

## 5. Regression Guards

| ID | What it guards |
|----|---------------|
| 18I-4A-1 | `challenge-leaderboard-snapshot` appears at least twice in `useWorkouts.ts` (once per mutation handler) |
| 18I-4A-2 | Invalidation is inside an `invalidateQueries` call with the correct key |
| 18I-4A-3 | Existing invalidations (`challenge-membership`, `home-screen-data`, `group-leaderboard`) remain intact |

---

## 6. Manual Retest Required

Yes — this is a React Query cache invalidation fix. Browser verification is needed to confirm:

1. Log a wellness activity on a competitive challenge
2. Navigate to `WorkoutLoggedScreen` (success screen) — mini-leaderboard not visible here
3. Navigate back to `ChallengeDetailScreen`
4. Confirm the mini-leaderboard shows the updated ranking (your entry should now appear or move)

The fix is correct by construction (the key matches exactly what `ChallengeDetailScreen` registers), but the end-to-end cache behaviour can only be confirmed in a live session.

---

## 7. Validation

```
npx tsc --noEmit                          → ✅ No errors
npm run build                             → ✅ Built in 4.20s
npm run test:scoring-guards               → ✅ All guards passed (incl. 18I-4A-1/2/3)
npm run test:home-challenge-feeds         → ✅ All guards passed
npm run audit:challenge-creation-payloads → ✅ All guards passed
```
