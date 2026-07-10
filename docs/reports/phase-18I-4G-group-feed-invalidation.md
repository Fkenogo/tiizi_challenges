# Phase 18I-4G — Invalidate Group Feed After Activity Log

**Date:** 2026-06-29
**Branch:** fix/p0-pre-deploy-blockers
**Fixes:** BUG-3-7 from Phase 18I-3 audit

---

## 1. Problem

After logging a workout or wellness activity, the group feed (`GroupFeedScreen`) continued to show stale data until its React Query cache expired naturally. The `group-feed` query key was never invalidated by either mutation handler in `useWorkouts.ts`, despite the feed being populated from the same `workouts` and `wellnessLogs` collections that logging writes to.

---

## 2. Fix

### `src/hooks/useWorkouts.ts`

Added `queryClient.invalidateQueries({ queryKey: ['group-feed'] })` to the `Promise.all` block in **both** mutation handlers.

**`useLogWorkout` — after (line ~93):**
```ts
queryClient.invalidateQueries({ queryKey: ['challenge-leaderboard-snapshot'] }),
queryClient.invalidateQueries({ queryKey: ['group-feed'] }),   // ← added
```

**`useLogWellnessActivity` — after (line ~141):**
```ts
queryClient.invalidateQueries({ queryKey: ['challenge-leaderboard-snapshot'] }),
queryClient.invalidateQueries({ queryKey: ['group-feed'] }),   // ← added
```

The key `['group-feed']` is intentionally broad — it invalidates all cached group feed instances regardless of `groupId` or `userId` suffix. This is consistent with how `['challenge-leaderboard-snapshot']` was added in Phase 18I-4A: a broadcast invalidation ensures correctness across all open feed views without needing to know which group the log belongs to.

---

## 3. Query Key Mapping

| Query key registered in hook | Where it's consumed |
|------------------------------|---------------------|
| `['group-feed', groupId, user?.uid]` | `src/hooks/useGroupInsights.ts:8` → `GroupFeedScreen` |

The partial key `['group-feed']` matches all entries with that prefix, so `invalidateQueries({ queryKey: ['group-feed'] })` refetches every active group feed regardless of which group or user it belongs to.

---

## 4. What Was Not Changed

- Scoring formulas — untouched ✅
- Firestore writes — untouched ✅
- Leaderboard logic — untouched ✅
- `challenge-leaderboard-snapshot` invalidation from Phase 18I-4A — intact ✅
- No `core-blast` re-introduced ✅
- No scoring engine fallback added ✅

---

## 5. Files Changed

| File | Change |
|------|--------|
| `src/hooks/useWorkouts.ts` | Added `['group-feed']` invalidation to `useLogWorkout` and `useLogWellnessActivity` `onSuccess` handlers |
| `scripts/testScoringGuards.ts` | Added guards 18I-4G-1 through 18I-4G-5 |

---

## 6. Regression Guards

| ID | What it guards |
|----|---------------|
| 18I-4G-1 | `useLogWorkout` invalidates `group-feed` |
| 18I-4G-2 | `useLogWellnessActivity` invalidates `group-feed` (combined check: ≥2 occurrences) |
| 18I-4G-3 | `challenge-leaderboard-snapshot` invalidation still present in both handlers |
| 18I-4G-4 | No `core-blast` in `useWorkouts.ts` |
| 18I-4G-5 | No scoring engine references added to `useWorkouts.ts` |

---

## 7. Manual Retest Steps

1. Open the app and navigate to a group feed (`/app/group/:id/feed`).
2. Log a workout or wellness activity for a challenge in that group.
3. After the success screen, return to the group feed.
4. Confirm the newly logged activity appears immediately — no stale content, no manual refresh needed.
5. Repeat for both a **workout** log and a **wellness** log to verify both mutation paths.

---

## 8. Validation

```
npx tsc --noEmit                          → ✅ No errors
npm run build                             → ✅ Built in 8.01s
npm run test:scoring-guards               → ✅ All guards passed (incl. 18I-4G-1…5)
npm run test:home-challenge-feeds         → ✅ All guards passed
npm run audit:challenge-creation-payloads → ✅ All guards passed
```
