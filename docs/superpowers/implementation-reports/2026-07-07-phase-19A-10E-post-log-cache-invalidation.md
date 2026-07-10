# Phase 19A-10E — Add Missing Cache Invalidation After Logs

**Date:** 2026-07-07
**Branch:** fix/p0-pre-deploy-blockers

---

## 1. Files Modified

| File | Change |
|------|--------|
| `scripts/testChallengePerformanceSourceOfTruthGuards.ts` | Added 5 new 10E assertions |

**No application code was changed** — the required `challenge-leaderboard-snapshot` invalidations were already present in `src/hooks/useWorkouts.ts`.

---

## 2. Audit Finding — Pre-Existing State

The phase specification identified a potential gap: mutation `onSuccess` handlers might miss the `challenge-leaderboard-snapshot` cache key, causing `ChallengeDetailScreen` and `SelectChallengeActivityScreen` to show stale leaderboard data after a log.

Audit of `src/hooks/useWorkouts.ts` showed the invalidations were **already present**:

**`useLogWorkout` `onSuccess`** (line 94):
```typescript
queryClient.invalidateQueries({ queryKey: ['challenge-leaderboard-snapshot'] }),
```

**`useLogWellnessActivity` `onSuccess`** (line 145):
```typescript
queryClient.invalidateQueries({ queryKey: ['challenge-leaderboard-snapshot'] }),
```

Both mutations invalidate `['challenge-leaderboard-snapshot']` without further segments, which is correct. TanStack Query v5 `invalidateQueries` uses prefix matching — a query with key `['challenge-leaderboard-snapshot', challengeId, engineVersion, challengeType]` (the shape used by `ChallengeDetailScreen` and `SelectChallengeActivityScreen`) IS matched and invalidated.

**`activityLogSessionService`** is exported but not wired to any React Query mutation hook. It has no `onSuccess` handler and no `queryClient` access — it is a plain async service. No hook change was required.

---

## 3. Confirmed Invalidation Behavior After 10E

| Mutation | Key invalidated | Matches consuming screens |
|----------|----------------|--------------------------|
| `useLogWorkout` | `['challenge-leaderboard-snapshot']` (prefix) | `ChallengeDetailScreen`, `SelectChallengeActivityScreen` ✅ |
| `useLogWellnessActivity` | `['challenge-leaderboard-snapshot']` (prefix) | `ChallengeDetailScreen`, `SelectChallengeActivityScreen` ✅ |
| Both | `['challenge-membership', challengeId, userId]` | All membership-reading screens ✅ |

---

## 4. Commands Executed

```bash
npx tsx scripts/testChallengePerformanceSourceOfTruthGuards.ts   # ✅ all guards passed
npx tsc --noEmit                                                  # ✅ 0 errors
npm run build                                                     # ✅ built in 5.33s
npx tsx scripts/testGroupFeedProgressSnapshotGuards.ts           # ✅ passed
npx tsx scripts/testGroupFeedProgressGuards.ts                   # ✅ passed
npx tsx scripts/testGroupFeedFinalQaGuards.ts                    # ✅ passed
npx tsx scripts/testGroupFeedLiveStatsGuards.ts                  # ✅ passed
```

---

## 5. Dependencies Added

None.

---

## 6. Config Changes

None.

---

## 7. Risks

None for this phase — no application code was changed. The guard assertions lock the existing correct behavior against future regressions.

---

## 8. Rollback Instructions

Nothing to roll back — no application code was changed. To remove the guards, delete the 10E assertion block from `scripts/testChallengePerformanceSourceOfTruthGuards.ts`.
