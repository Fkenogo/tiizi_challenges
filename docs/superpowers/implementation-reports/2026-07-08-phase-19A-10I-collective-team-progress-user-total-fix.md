# Phase 19A-10I — Fix Collective Team Progress Showing User Total Instead of Team Total

**Date:** 2026-07-08
**Branch:** fix/p0-pre-deploy-blockers
**Status:** ✅ Complete

---

## Problem

After Phase 19A-10H restored `userContribFloor = safeNum(membership?.cumulativeLoggedValue)` as a
lower-bound floor in `resolveChallengeProgress`, the Home My Challenges card and WorkoutLoggedScreen
began displaying **the user's own cumulative contribution as the team total** for collective challenges.

Example:
- Team "The 10K Team Push" — target 10,000 reps, actual team total 600 reps
- User contribution: 200 reps (pre-new-log), 300 reps (after new log)
- Home showed: **200 / 10,000** ❌  (should show 600 / 10,000)
- WorkoutLoggedScreen showed: **300 / 10,000** ❌  (should show 600 / 10,000)
- ChallengeDetail, SelectActivity, Group Feed: ✅ 600 / 10,000 (correct — they pass `memberSumContribution`)

**Root cause:** On Home and WorkoutLoggedScreen, `memberSumFloor = 0` (no member list query) and
`activitySummaryFloor = 0` (CF hasn't fired yet). `userContribFloor` (= user's personal
cumulativeLoggedValue) was the only non-zero input to `Math.max`, so it "won" — but it's an
individual value, not the team total.

---

## Fix

### Core insight

The 10H fix used the wrong floor. The individual user's cumulative value is NOT a valid team floor:
on a team of 10 people each contributing 60 reps, the team total is 600 but each user's floor would
only be 60. The correct fallback is a **team-level aggregate** — `challenge.groupCurrentTotal`.

`challenge.groupCurrentTotal` is:
- Written by `atomicCollectiveGroupUpdate` in the client log engine
- A team aggregate (sum of all member logs), not a per-user value
- Possibly already updated to include the current log (if the engine wrote before CF fires)
- Or slightly stale (pre-log value) — both cases produce a valid team floor

### Changes

#### 1. `challengeProgressResolver.ts`

- Removed `userContribFloor` entirely
- Added `priorTeamTotal?: number` to `ProgressInput` with full docblock
- Computed `optimisticTeamFloor = safeNum(priorTeamTotal)` as the safe legacy floor
- New `Math.max`: `Math.max(activitySummaryFloor, memberSumFloor, logSumFloor, optimisticTeamFloor)`
- Updated module docblock and `groupTotal` field docblock

#### 2. `challengeProgressDisplay.ts`

- Added `priorTeamTotal?: number` as 6th parameter to `buildChallengeProgress`
- Forwarded to `resolveChallengeProgress`

#### 3. `WorkoutLoggedScreen.tsx`

- Added `priorTeamTotal: challenge?.groupCurrentTotal` to the `resolveChallengeProgress` call
- Added explanatory comment: this is a team-level aggregate, safe as an optimistic floor

#### 4. `useHomeScreen.ts`

- Base card loop: added `c.groupCurrentTotal` as 6th arg to `buildChallengeProgress`
- First-card enrichment: added `firstChallenge.groupCurrentTotal` as 6th arg

#### 5. `scripts/testCollectiveTeamProgressRegressionGuards.ts`

- Removed assertions checking for `userContribFloor` presence
- Added assertions verifying `userContribFloor` is ABSENT
- Added assertions verifying `optimisticTeamFloor` and `priorTeamTotal` are present
- Added assertion: `Math.max` includes `optimisticTeamFloor` (not `cumulativeLoggedValue`)
- Added assertion: Home passes `groupCurrentTotal` to `buildChallengeProgress`
- Added assertion: WorkoutLoggedScreen passes `priorTeamTotal: challenge.groupCurrentTotal`

---

## How the optimistic floor works in practice

| Scenario | `activitySummaryFloor` | `optimisticTeamFloor` | `groupTotal` |
|---|---|---|---|
| CF has fired (normal) | 600 (correct) | 500 (stale or updated) | **600** ✅ |
| CF not fired, client wrote `groupCurrentTotal` | 0 | 600 (already updated) | **600** ✅ |
| CF not fired, challenge doc still stale | 0 | 500 (pre-log) | **500** ✅ (stale but team-level) |
| New challenge, nobody logged yet | 0 | 0 | **0** ✅ (correct) |

In no scenario does a single user's `cumulativeLoggedValue` become the displayed team total.

---

## Files Modified

| File | Change |
|------|--------|
| `src/features/Challenges/challengeProgressResolver.ts` | Replace `userContribFloor` with `optimisticTeamFloor` from `priorTeamTotal` |
| `src/features/Challenges/challengeProgressDisplay.ts` | Add `priorTeamTotal?: number` 6th param; forward to resolver |
| `src/features/Workouts/WorkoutLoggedScreen.tsx` | Pass `priorTeamTotal: challenge?.groupCurrentTotal` |
| `src/features/Home/useHomeScreen.ts` | Pass `groupCurrentTotal` as `priorTeamTotal` to both `buildChallengeProgress` calls |
| `scripts/testCollectiveTeamProgressRegressionGuards.ts` | Updated for 10I contract |

---

## Validation

```
npx tsx scripts/testCollectiveTeamProgressRegressionGuards.ts   → ✅ All guards passed
npx tsx scripts/testCollectiveDoubleCountGuards.ts               → ✅ All guards passed
npx tsx scripts/testChallengePerformanceFinalRegressionGuards.ts → ✅ All guards passed
npx tsx scripts/testChallengePerformanceSourceOfTruthGuards.ts   → ✅ All guards passed
npx tsx scripts/testGroupFeedProgressSnapshotGuards.ts           → ✅ All guards passed
npx tsc --noEmit                                                 → ✅ Clean
npm run build                                                    → ✅ Clean
cd functions && npm run build                                    → ✅ Clean
```

---

## Risks

- **`challenge.groupCurrentTotal` may be slightly stale** on WorkoutLoggedScreen if the challenge
  doc hasn't re-fetched after logging. In this case the floor is the pre-log team total, which is
  still correct once CF fires and `activitySummaryFloor` takes over (within 1–5 s). This is
  preferable to showing 0 or showing the user's personal contribution.
- **No risk of double-counting**: `optimisticTeamFloor` is only a floor in `Math.max`. Once
  `activitySummaryFloor` rises above it (CF fires), the CF-maintained value takes over.

---

## Rollback

Revert the four source files to their 10H state:
- Restore `userContribFloor = safeNum(membership?.cumulativeLoggedValue)` in resolver
- Remove `priorTeamTotal` from resolver, display shim, WorkoutLoggedScreen, useHomeScreen
- Revert guard script to 10H version

---

## Manual Test Checklist — Collective Challenges

- [ ] Open a collective challenge as a team member (not the only member)
- [ ] Verify ChallengeDetailScreen shows correct team total (e.g., 600 / 10,000)
- [ ] Navigate to Home — verify My Challenges card shows the same team total (600 / 10,000), NOT your personal contribution
- [ ] Log an activity (e.g., 100 reps)
- [ ] On WorkoutLoggedScreen: verify team progress shows ≥ 600 / 10,000 (not 300 / 10,000)
- [ ] Wait 5 seconds (CF fires) — verify WorkoutLoggedScreen updates to show 700 / 10,000
- [ ] Navigate back to Home — verify card shows 700 / 10,000
- [ ] Verify "You contributed X reps" secondary label is separate from team total
- [ ] Verify Group Feed shows same team total as ChallengeDetail
- [ ] Verify SelectChallengeActivityScreen shows same team total before logging
