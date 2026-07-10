# Phase 18I-6N Task 2 — ProfileScreen Metrics Cleanup

**Date:** 2026-07-03
**Branch:** fix/p0-pre-deploy-blockers

---

## What Changed

ProfileScreen migrated from 4 separate hooks to the canonical `useUserAnalytics` hook introduced in Task 1. Hardcoded vanity labels removed. Stats corrected.

---

## Removed

| Item | Reason |
|------|--------|
| `useChallenges` import + call | Replaced by `useUserAnalytics` |
| `useUserWorkouts` import + call | Replaced by `useUserAnalytics` |
| `useDailyGoalsAnalytics` import + call | Replaced by `useUserAnalytics` |
| `useUserStreak` import + call | Replaced by `useUserAnalytics` |
| `myChallengeIds` useMemo | Derived set no longer needed |
| `wins` useMemo | Broken (always 0 — see Task 1 audit) |
| `"Top 5% Contributor"` / `"New Member"` badge | Hardcoded, non-functional |
| `"Community Leader"` subtitle | Hardcoded, misleading |
| `"Goal completion: X%"` row | Sourced from `useDailyGoalsAnalytics` which was unreliable |

---

## Stat Card Mapping (before → after)

| Card | Before | After |
|------|--------|-------|
| Groups | `myGroups.length` | `analytics?.groupsCount ?? myGroups.length` |
| Wins | `wins` (always 0) | `analytics?.completedChallengesCount ?? 0` |
| Streak | `streak?.currentStreak ?? 0` | `analytics?.currentStreak ?? 0` |

**Wins fix:** `completedChallengesCount` comes from `challengeMembers where status == 'completed'` (Task 1). The old `wins` derived from `getUserAccessibleChallenges()` which hard-filters to `status === 'active'` — making Wins permanently 0.

---

## Activity Row

**Before:** `"Goal completion: {goalsAnalytics?.completionRate ?? 0}%"`
**After:** `"Activity this month: {analytics?.totalLogsLast30d ?? 0} logs"`

`totalLogsLast30d` combines fitness + wellness logs, 30-day window.

---

## What Was Kept

- `useMyGroups` — still needed for the "My Groups" list section
- `useMemo` import — still needed for `activeSupportEntries` / support pledge section
- Groups stat falls back to `myGroups.length` while analytics loads

---

## Files Changed

| File | Change |
|------|--------|
| `src/features/Profile/ProfileScreen.tsx` | Remove 4 hooks, add `useUserAnalytics`, remove badges, fix stats |
| `scripts/testProfileAnalyticsGuards.ts` | Add 4 ProfileScreen-specific guards |

---

## Guards Added

- ProfileScreen does not contain `"Top 5% Contributor"`
- ProfileScreen does not contain `"Community Leader"`
- ProfileScreen uses `useUserAnalytics`
- ProfileScreen Wins uses `completedChallengesCount`

---

## Validation

```
npx tsc --noEmit                      ✅ clean
npm run build                         ✅ built in 2.97s
npm run test:profile-analytics-guards ✅ all guards passed
```
