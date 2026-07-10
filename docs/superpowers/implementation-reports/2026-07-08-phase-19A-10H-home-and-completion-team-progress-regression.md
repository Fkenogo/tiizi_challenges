# Phase 19A-10H — Home & WorkoutLoggedScreen Collective Team Progress Regression

**Date:** 2026-07-08
**Branch:** fix/p0-pre-deploy-blockers
**Status:** ✅ Complete

---

## Problem

After Phase 19A-10G removed `challenges.groupCurrentTotal` and `userContributionTotal` from the
collective `Math.max` in `resolveChallengeProgress`, the Home My Challenges card and
WorkoutLoggedScreen displayed **0 / N** for collective team progress immediately after logging.

ChallengeDetailScreen, SelectChallengeActivityScreen, and Group Feed were correct because they
query all `challengeMembers` docs to compute `memberSumContribution` — giving `Math.max` a
non-zero floor before the Cloud Function fires. Home and WorkoutLoggedScreen had no such query.

**Root cause:** `challengeActivitySummaries` doc is created/updated by the Cloud Function
1–5 seconds after logging. Before the CF fires, both `activitySummaryFloor` and `memberSumFloor`
are 0 on those two screens, so `Math.max(0, 0, 0, 0) = 0`.

---

## Fix

### 1. `challengeProgressResolver.ts` — restore `userContribFloor` as a safe lower bound

Added `userContribFloor = safeNum(membership?.cumulativeLoggedValue)` to the collective `Math.max`.
This is the user's own cumulative contribution from `challengeMembers.cumulativeLoggedValue`, which
is written by the batch commit synchronously before navigation. It is NOT the team total — it is a
floor that guarantees the display never regresses below the user's own known contribution while
waiting for the CF.

```typescript
const userContribFloor = safeNum(membership?.cumulativeLoggedValue);
const groupTotal = Math.max(activitySummaryFloor, memberSumFloor, logSumFloor, userContribFloor);
```

Once the CF fires and `activitySummaryFloor` rises above `userContribFloor`, the canonical
CF-maintained value takes precedence automatically.

### 2. `challengeProgressDisplay.ts` — accept `activitySummaryTotal` parameter

The `buildChallengeProgress` shim (used by Home) did not accept `activitySummaryTotal`. Added it
as an optional 5th parameter and passed it through to `resolveChallengeProgress`.

### 3. `useHomeScreen.ts` — batch-read `challengeActivitySummaries` before card loop

Added an early read block that fetches `challengeActivitySummaries` docs for all ongoing member
challenge IDs (in chunks of 10 to respect the `in` query limit) and stores them in
`memberActivitySummaryMap`. Both `buildChallengeProgress` calls now receive
`memberActivitySummaryMap.get(id)?.totalValue` as `activitySummaryTotal`.

---

## Files Changed

| File | Change |
|------|--------|
| `src/features/Challenges/challengeProgressResolver.ts` | Restored `userContribFloor` lower-bound in collective `Math.max` |
| `src/features/Challenges/challengeProgressDisplay.ts` | Added `activitySummaryTotal?: number` param; passes through to resolver |
| `src/features/Home/useHomeScreen.ts` | Added `memberActivitySummaryMap` batch read; passes `activitySummaryTotal` to both `buildChallengeProgress` calls |

---

## Guard Script

`scripts/testCollectiveTeamProgressRegressionGuards.ts` — 13 assertions:

- Resolver uses `activitySummaryFloor` as first term in collective `Math.max`
- Resolver defines and includes `userContribFloor`
- Resolver does NOT include `storedGroupTotal` (`challenges.groupCurrentTotal`) in `Math.max`
- `buildChallengeProgress` accepts and forwards `activitySummaryTotal`
- Home builds `memberActivitySummaryMap` and reads `totalValue`
- Home passes `activitySummaryTotal` to `buildChallengeProgress`
- Home does NOT raw-sum `workouts` or `wellnessLogs` for progress
- Home references `cumulativeLoggedValue` from membership
- WorkoutLoggedScreen uses `useChallengeSummary` and passes `activitySummaryTotal`
- ChallengeDetail, SelectActivity, ChallengeCompleted still pass `activitySummaryTotal` (10G continuity)

---

## Validation

```
npx tsx scripts/testCollectiveTeamProgressRegressionGuards.ts  → ✅ All 13 guards passed
npx tsx scripts/testCollectiveDoubleCountGuards.ts              → ✅ All guards passed
npx tsx scripts/testChallengePerformanceFinalRegressionGuards.ts → ✅ All guards passed
npx tsx scripts/testChallengePerformanceSourceOfTruthGuards.ts  → ✅ All guards passed
npx tsx scripts/testGroupFeedProgressSnapshotGuards.ts          → ✅ All guards passed
npx tsc --noEmit                                                → ✅ Clean
npm run build                                                   → ✅ Clean (6.38s)
cd functions && npm run build                                   → ✅ Clean
```

---

## Source-of-Truth Guarantees (unchanged)

| Value | Source |
|-------|--------|
| Collective team total | `challengeActivitySummaries.totalValue` (CF-maintained) |
| User contribution | `challengeMembers.cumulativeLoggedValue` (client batch commit) |
| Lower-bound floor | `userContribFloor` = `membership.cumulativeLoggedValue` (prevents 0-flash) |

`challenges.groupCurrentTotal` is NOT used anywhere in display logic.
