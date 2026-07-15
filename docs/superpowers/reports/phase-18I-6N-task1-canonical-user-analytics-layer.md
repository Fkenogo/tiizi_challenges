# Phase 18I-6N Task 1 — Canonical User Analytics Layer

**Date:** 2026-07-03
**Branch:** fix/p0-pre-deploy-blockers

---

## What Was Built

A single canonical data layer for all user analytics. Screens will consume `useUserAnalytics()` instead of the scattered 5-hook pattern used today.

---

## `src/services/userAnalyticsService.ts`

Single `getUserAnalytics(userId)` method. All six Firestore reads fire in parallel via `Promise.all` to minimise latency:

| Read | Collection / Source | Purpose |
|------|---------------------|---------|
| `groupMembers where userId == uid AND status in [joined, active]` | `groupMembers` | `groupsCount` |
| `challengeMembers where userId == uid` | `challengeMembers` | `completedChallengesCount`, `activeChallengesCount`, `totalChallengesJoinedCount` |
| `workouts where userId == uid AND date >= 90dAgo` | `workouts` | `fitnessLogsLast7d`, `fitnessLogsLast30d`, `mostLoggedActivityName` |
| `wellnessLogs where userId == uid AND date >= 90dAgo` | `wellnessLogs` | `wellnessLogsLast7d`, `wellnessLogsLast30d` |
| `streakService.calculateUserStreak(userId)` | `workouts` + `wellnessLogs` (internal) | `currentStreak`, `longestStreak` |
| `users/:uid` | `users` | `habitCompletionRate`, `habitDaysTracked` |

**Key fix:** `completedChallengesCount` is derived from `challengeMembers where status == 'completed'` — not from `getUserAccessibleChallenges()` which hard-filters out completed challenges. This fixes the Wins-always-0 bug identified in the audit.

**Key fix:** `fitnessLogsLast7d/30d` and `wellnessLogsLast7d/30d` are tracked separately and summed for `totalLogsLast30d`. The old `useUserWorkouts` only queried the `workouts` collection, leaving wellness users seeing zero.

**Date filtering:** 90-day window on both workouts and wellnessLogs queries — avoids full-history scans.

---

## `src/hooks/useUserAnalytics.ts`

```ts
queryKey: ['user-analytics', userId]
staleTime: 2 * 60 * 1000   // 2 minutes
gcTime:   10 * 60 * 1000
```

Also exports `useInvalidateUserAnalytics()` — a stable callback that invalidates the cache for the current user, usable in mutation `onSuccess` handlers.

---

## `src/hooks/useWorkouts.ts` — Invalidation fix

Both `useLogWorkout.onSuccess` and `useLogWellnessActivity.onSuccess` now invalidate `USER_ANALYTICS_QUERY_KEY(userId)`. Previously neither did, leaving profile analytics stale after every log until the 2-minute staleTime expired.

---

## `scripts/testProfileAnalyticsGuards.ts`

Guards verified:
- `userAnalyticsService` exported and exposes `getUserAnalytics`
- `challengeMembers` collection queried (not `challenges`)
- `status === 'completed'` filter present
- `challenges` collection NOT queried (blocked — always returns active-only)
- `workouts` collection queried with `date >=` filter
- `wellnessLogs` collection queried
- All 14 required fields present in service
- `useUserAnalytics` hook exported with correct queryKey prefix
- `staleTime` is 2 minutes
- `USER_ANALYTICS_QUERY_KEY` appears ≥2 times in `useWorkouts.ts` (one per mutation)

Registered as `npm run test:profile-analytics-guards`.

---

## Files Changed

| File | Change |
|------|--------|
| `src/services/userAnalyticsService.ts` | **New** — canonical analytics resolver |
| `src/hooks/useUserAnalytics.ts` | **New** — TanStack Query wrapper, queryKey export |
| `src/hooks/useWorkouts.ts` | Add `USER_ANALYTICS_QUERY_KEY` invalidation to both log mutation `onSuccess` handlers |
| `src/package.json` | Register `test:profile-analytics-guards` |
| `scripts/testProfileAnalyticsGuards.ts` | **New** — 20+ guards |

No UI changes in this task. Profile and Analytics screens still use the old hooks — Task 2 will migrate them.

---

## Validation

```
npx tsc --noEmit                      ✅ clean
npm run build                         ✅ built in 3.17s
npm run test:profile-analytics-guards ✅ all guards passed
```
