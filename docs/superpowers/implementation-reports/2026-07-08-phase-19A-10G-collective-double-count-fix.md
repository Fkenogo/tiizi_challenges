# Phase 19A-10G — Fix Collective Challenge Double Counting

**Date:** 2026-07-08
**Branch:** fix/p0-pre-deploy-blockers

---

## 1. Problem

Manual testing showed collective challenge progress double-counting on three screens:

- **Broken (showing 2×):** WorkoutLoggedScreen (confirmation), SelectChallengeActivityScreen, ChallengeDetailScreen, ChallengeCompletedScreen
- **Correct (showing 1×):** Home screen, Group Feed

Symptom: logging 100 reps displayed 200/10,000 instead of 100/10,000 on the affected screens.

---

## 2. Root Cause

The canonical progress resolver (`challengeProgressResolver.ts`) computed collective `groupTotal` as:

```typescript
const groupTotal = Math.max(storedGroupTotal, memberSumFloor, logSumFloor, userContributionTotal);
// storedGroupTotal = challenge.groupCurrentTotal (client-maintained via atomic transaction)
```

`challenges.groupCurrentTotal` is written by `atomicCollectiveGroupUpdate` (a Firestore transaction using an **absolute value write**: `read prevTotal → write prevTotal + delta`). This write is client-side and can be stale or misaligned with the CF-maintained canonical total.

The correct collective total lives in `challengeActivitySummaries.totalValue`, which the CF writes via `FieldValue.increment` (server-side, atomic, never double-counts). Home and Group Feed already used this source (Home via `membership.cumulativeLoggedValue`, Feed via `feedProgressSnapshot.teamCumulativeValue`) — which is why they were correct.

---

## 3. Files Modified

| File | Change |
|------|--------|
| `src/features/Challenges/challengeProgressResolver.ts` | Added `activitySummaryTotal` input; changed collective `groupTotal = max(activitySummaryFloor, memberSumFloor, logSumFloor)` — removed `storedGroupTotal` and `userContributionTotal` from collective floor |
| `src/hooks/useChallenges.ts` | Added `useChallengeSummary(challengeId)` hook — reads `challengeActivitySummaries.totalValue` with `challenge-activity-summary` query key |
| `src/hooks/useWorkouts.ts` | Added `challenge-activity-summary` invalidation to both `useLogWorkout.onSuccess` and `useLogWellnessActivity.onSuccess` |
| `src/features/Workouts/WorkoutLoggedScreen.tsx` | Added `useChallengeSummary`; passes `activitySummaryTotal: challengeSummary?.totalValue` to resolver |
| `src/features/Challenges/ChallengeDetailScreen.tsx` | Added `useChallengeSummary`; passes `activitySummaryTotal` to resolver |
| `src/features/Workouts/SelectChallengeActivityScreen.tsx` | Added `useChallengeSummary`; passes `activitySummaryTotal` to resolver |
| `src/features/Challenges/ChallengeCompletedScreen.tsx` | Added `useChallengeSummary`; passes `activitySummaryTotal` to resolver |
| `scripts/testGroupFeedProgressSnapshotGuards.ts` | Fixed stale guard: replaced incorrect assertion that CF increments `cumulativeLoggedValue` on `challengeLeaderboards` (removed in 10B) with correct 10B assertion |
| `scripts/testCollectiveDoubleCountGuards.ts` | **New** — 11 assertions for 10G fix |

---

## 4. Resolver Change Detail

### Before
```typescript
const storedGroupTotal = safeNum(challenge?.groupCurrentTotal);
const memberSumFloor = safeNum(memberSumContribution);
const logSumFloor = safeNum(logSumValue);
const groupTotal = Math.max(storedGroupTotal, memberSumFloor, logSumFloor, userContributionTotal);
```

### After
```typescript
const memberSumFloor = safeNum(memberSumContribution);
const logSumFloor = safeNum(logSumValue);
const activitySummaryFloor = safeNum(activitySummaryTotal);
// CF-maintained canonical collective total; memberSumFloor/logSumFloor are lower-bound guards.
// challenges.groupCurrentTotal intentionally NOT used — see module docblock.
const groupTotal = Math.max(activitySummaryFloor, memberSumFloor, logSumFloor);
```

The `userContributionTotal` floor was also removed from collective `groupTotal` — for a collective challenge, the current user's personal total is NOT the team total. It remains available as `rp.userContributionTotal` for "You contributed N" labels.

---

## 5. Source-of-Truth Rules (updated)

| Value | Authoritative field | Owner |
|-------|--------------------|----|
| User cumulative contribution | `challengeMembers.cumulativeLoggedValue` | Client engines |
| Collective team total | `challengeActivitySummaries.totalValue` | Cloud Function (`memberActivitySummaries`) |
| Competitive ranking score | `challengeLeaderboards.score` | Cloud Function |
| Streak progress | `challengeMembers.currentStreak` | Client `streakEngine` |
| Days remaining | Derived from `challenge.endDate` | N/A |

**`challenges.groupCurrentTotal` is used only for completion detection** (`atomicCollectiveGroupUpdate`) — not for display.

---

## 6. Commands Executed and Results

```bash
npx tsx scripts/testCollectiveDoubleCountGuards.ts                 # ✅ 11 assertions passed
npx tsx scripts/testChallengePerformanceFinalRegressionGuards.ts   # ✅ 20 assertions passed
npx tsx scripts/testChallengePerformanceSourceOfTruthGuards.ts     # ✅ passed
npx tsx scripts/testGroupFeedProgressSnapshotGuards.ts             # ✅ passed
npx tsx scripts/testGroupFeedProgressGuards.ts                     # ✅ passed
npx tsx scripts/testGroupFeedFinalQaGuards.ts                      # ✅ passed
npx tsx scripts/testGroupFeedLiveStatsGuards.ts                    # ✅ passed
npx tsx scripts/testGroupFeedCardUiGuards.ts                       # ✅ passed
npx tsc --noEmit                                                   # ✅ 0 errors
npm run build                                                      # ✅ built in 3.88s
```

---

## 7. Manual Test Checklist

| # | Step | Expected | Screen |
|---|------|----------|--------|
| G1 | Fresh collective challenge — log 100 reps | Confirmation shows 100/10,000 | WorkoutLoggedScreen |
| G2 | Navigate to Challenge Detail | Detail shows 100/10,000 | ChallengeDetailScreen |
| G3 | Navigate to Select Activity | Shows 100/10,000 | SelectChallengeActivityScreen |
| G4 | Navigate to Home → My Challenges | Shows 100/10,000 | Home |
| G5 | Open Group Feed | Feed card shows 100/10,000 | FeedCard / feedProgressSnapshot |
| G6 | Log 50 more reps | All screens now show 150/10,000 | All |
| G7 | Second member logs 100 | Team total = 250/10,000; My contribution = 150 | ChallengeDetailScreen |
| G8 | Complete screen (force complete) | Shows CF total, not doubled | ChallengeCompletedScreen |

---

## 8. Risks

1. **Transient 0 before CF writes** — `challengeActivitySummaries` doc is created on first CF trigger. If the cache re-fetches before the CF fires, screens show 0 until next invalidation. This is a brief flash (typically <2s) and is preferable to showing 2× the correct value.

2. **`memberSumFloor` as backup** — screens that compute `memberSumContribution` (ChallengeDetailScreen, SelectChallengeActivityScreen) still pass it as a lower-bound guard. If CF is delayed, the member sum provides a correct floor.

3. **`challenges.groupCurrentTotal` still used for completion** — `atomicCollectiveGroupUpdate` still increments this field for the exactly-once completion cascade. This is correct and separate from the display path.

---

## 9. Stale Guard Fix

`scripts/testGroupFeedProgressSnapshotGuards.ts` line 58 previously asserted that the CF increments `cumulativeLoggedValue` on `challengeLeaderboards`. This write was removed in phase 10B. The guard was not updated at that time. Updated in 10G to assert the inverse (the correct 10B rule).
