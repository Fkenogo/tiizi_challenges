# Phase 19A-10F — Final Regression Guard + Screen Verification Matrix

**Date:** 2026-07-08
**Branch:** fix/p0-pre-deploy-blockers

---

## 1. Files Inspected

| File | Finding |
|------|---------|
| `src/features/Home/useHomeScreen.ts` | ✅ Uses `membership?.cumulativeLoggedValue` for first-card progress. No raw log queries for progress. |
| `src/features/Challenges/ChallengeCompletedScreen.tsx` | ✅ All four branches (collective, competitive, streak, legacy v1) display `cumulativeLoggedValue`. `totalValue` not rendered as user total. |
| `src/features/Groups/FeedCard.tsx` | ✅ Prefers `feedProgressSnapshot` via `SnapshotProgress`; fallback for older docs. |
| `src/services/feedLiveStatsService.ts` | ✅ Reads `cumulativeLoggedValue` from `challengeMembers`; uses `challengeLeaderboards` only for score/rank. |
| `src/services/workoutService.ts` | ✅ Writes `cumulativeLoggedValue` to `challengeMembers`. |
| `src/services/wellnessLogService.ts` | ✅ Writes `cumulativeLoggedValue` to `challengeMembers`. |
| `src/services/activityLogSessionService.ts` | ✅ Writes `cumulativeLoggedValue` as `nextCumulativeLoggedValue = prev + sessionTotal` (10A fix). |
| `functions/src/memberActivitySummaries.ts` | ✅ Does NOT write `cumulativeLoggedValue` to `challengeLeaderboards` (10B fix). Does NOT write to `challengeMembers`. Writes `feedProgressSnapshot` and `challengeActivitySummaries.totalValue`. |
| `src/hooks/useWorkouts.ts` | ✅ Both `useLogWorkout` and `useLogWellnessActivity` invalidate `challenge-leaderboard-snapshot` (10E). |
| `src/features/Challenges/ChallengeDetailScreen.tsx` | ✅ Uses `challenge-leaderboard-snapshot` query key (prefix matched by invalidations). |
| `src/features/Workouts/SelectChallengeActivityScreen.tsx` | ✅ Uses same `challenge-leaderboard-snapshot` query key shape. |
| `firestore.rules` | ✅ No source-of-truth workarounds present. |

---

## 2. Files Modified

| File | Change |
|------|--------|
| `scripts/testChallengePerformanceFinalRegressionGuards.ts` | **New** — 20 assertions covering all locked source-of-truth rules |
| `docs/superpowers/manual-test-matrices/2026-07-08-phase-19A-performance-source-of-truth-manual-test-matrix.md` | **New** — 5-scenario manual test matrix |

---

## 3. Gaps Found

None. All locked source-of-truth rules are correctly enforced across all inspected screens and services.

---

## 4. Fixes Made

None in 10F — this was a QA-only phase.

---

## 5. Final Source-of-Truth Confirmation

| Rule | Authoritative field | Write path | Read path |
|------|--------------------|-----------|----|
| User cumulative contribution | `challengeMembers.cumulativeLoggedValue` | `workoutService`, `wellnessLogService`, `activityLogSessionService` | Home first card, ChallengeDetailScreen, ChallengeCompletedScreen, feedLiveStatsService |
| Collective team total | `challengeActivitySummaries.totalValue` | Cloud Function (`memberActivitySummaries`) | `feedLiveStatsService`, `challengeProgressResolver` |
| Competitive ranking score | `challengeLeaderboards.score` | Cloud Function | `feedLiveStatsService` (ordering), ChallengeLeaderboardScreen |
| Streak progress | `challengeMembers.currentStreak` | Client `streakEngine` (via `workoutService`/`wellnessLogService`) | Home, ChallengeCompletedScreen, ChallengeDetailScreen |
| Days remaining | Derived from `challenge.endDate` | N/A | FeedCard, ChallengeDetailScreen |

---

## 6. Commands Executed and Results

```bash
npx tsx scripts/testChallengePerformanceFinalRegressionGuards.ts   # ✅ 20 assertions passed
npx tsx scripts/testChallengePerformanceSourceOfTruthGuards.ts     # ✅ passed
npx tsx scripts/testGroupFeedProgressSnapshotGuards.ts             # ✅ passed
npx tsx scripts/testGroupFeedProgressGuards.ts                     # ✅ passed
npx tsx scripts/testGroupFeedFinalQaGuards.ts                      # ✅ passed
npx tsx scripts/testGroupFeedLiveStatsGuards.ts                    # ✅ passed
npx tsx scripts/testGroupFeedCardUiGuards.ts                       # ✅ passed
npx tsc --noEmit                                                   # ✅ 0 errors
npm run build                                                      # ✅ built in 4.54s
cd functions && npm run build                                      # ✅ tsc clean
```

---

## 7. Manual Test Matrix Path

`docs/superpowers/manual-test-matrices/2026-07-08-phase-19A-performance-source-of-truth-manual-test-matrix.md`

Covers 5 scenarios (A–E): collective, competitive, streak, multi-activity wellness, legacy documents. 28 individual test steps with expected results and source field being verified.

---

## 8. Remaining Risks

1. **`uniqueDays` in ChallengeCompletedScreen streak view** — still derived from raw `workouts` collection. For wellness-only streak challenges, "Active Days" and "Missed Days" may undercount. Deferred; not a source-of-truth conflict for the value totals fixed in this phase.

2. **Historical `cumulativeLoggedValue = 0`** — users who logged multi-activity wellness sessions before 10A have `cumulativeLoggedValue = 0`. Their Home and Completed screens will show `0` until next log. Accepted; no migration script in scope.

3. **CF retry double-counting on `score`/`activityCount`** — both still use `FieldValue.increment` in CF, which can double-count on retried triggers. This was a pre-existing risk independent of Phase 19A and is not addressed here.

4. **`activityLogSessionService` not wired to React Query** — cache invalidation after multi-activity sessions depends on whatever calls this service also triggering invalidation. If a new call site is added without invalidation, leaderboard snapshots will go stale. The 10E guard locks the current call sites but a future integration would need its own hook.
