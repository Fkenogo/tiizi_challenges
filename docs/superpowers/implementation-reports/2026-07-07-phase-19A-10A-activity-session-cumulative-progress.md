# Phase 19A-10A — Fix Multi-Activity Wellness Session Progress Source of Truth

**Date:** 2026-07-07
**Branch:** fix/p0-pre-deploy-blockers

---

## 1. Files Modified

| File | Change |
|------|--------|
| `src/services/activityLogSessionService.ts` | Added `cumulativeLoggedValue: nextCumulativeLoggedValue` to the `challengeMembers` membership update |
| `scripts/testChallengePerformanceSourceOfTruthGuards.ts` | **New** — 9 guard assertions |

---

## 2. Code Diff Summary

**`src/services/activityLogSessionService.ts`** — lines 371–382 (before → after):

Before:
```typescript
const membershipUpdate: Record<string, unknown> = {
  activitiesCompleted: nextCompleted,
  totalPoints: increment(totalPoints),
  lastActivityAt: serverTimestamp(),
  completionRate: nextRate,
};
```

After:
```typescript
const sessionContributionTotal = summaryEntries.reduce((s, e) => s + Math.max(0, e.value), 0);
const nextCumulativeLoggedValue = Math.max(0, Number(membership.cumulativeLoggedValue ?? 0)) + sessionContributionTotal;
const membershipUpdate: Record<string, unknown> = {
  activitiesCompleted: nextCompleted,
  totalPoints: increment(totalPoints),
  lastActivityAt: serverTimestamp(),
  completionRate: nextRate,
  cumulativeLoggedValue: nextCumulativeLoggedValue,
};
```

**Why these choices:**
- `summaryEntries` is built inside the `entries.forEach` loop using the exact values written to Firestore activity documents (`workouts` and `wellnessLogs`). Using it as the contribution source guarantees the membership total matches what was actually persisted.
- `Math.max(0, Number(membership.cumulativeLoggedValue ?? 0))` coerces missing/null/NaN to 0, matching the pattern used by `competitiveEngine.ts` and `wellnessLogService.ts`.
- Absolute write (not `FieldValue.increment`) matches the ownership model: `challengeMembers.cumulativeLoggedValue` is client-engine-owned. An increment would cause double-counting if the CF also incremented it (which it no longer does after Phase 19A-8D).

---

## 3. Source-of-Truth Behavior After Fix

| Challenge type | Field | Owner | Written by | How |
|----------------|-------|-------|-----------|-----|
| All | `challengeMembers.cumulativeLoggedValue` | Client engine | `workoutService`, `wellnessLogService`, `activityLogSessionService` (now fixed) | Absolute: `(prev ?? 0) + sessionTotal` |
| Collective | `challengeActivitySummaries.totalValue` | Cloud Function | `memberActivitySummaries` CF | `FieldValue.increment(value)` per log |
| Competitive ranking | `challengeLeaderboards.score` | Cloud Function | `memberActivitySummaries` CF | `FieldValue.increment(score)` per log |
| Streak | `challengeMembers.currentStreak` | Client streakEngine | `workoutService` / `wellnessLogService` | Absolute per session |

All three client-side write paths (`workoutService`, `wellnessLogService`, `activityLogSessionService`) now consistently write `cumulativeLoggedValue` as an absolute value derived from `(previous + sessionTotal)`.

---

## 4. Commands Executed

```bash
npx tsx scripts/testChallengePerformanceSourceOfTruthGuards.ts  # ✅ 9 assertions passed
npx tsc --noEmit                                                 # ✅ 0 errors
npm run build                                                    # ✅ built in 3.36s
npx tsx scripts/testGroupFeedProgressSnapshotGuards.ts          # ✅ passed
npx tsx scripts/testGroupFeedProgressGuards.ts                  # ✅ passed
npx tsx scripts/testGroupFeedFinalQaGuards.ts                   # ✅ passed
npx tsx scripts/testGroupFeedLiveStatsGuards.ts                 # ✅ passed
npx tsx scripts/testGroupFeedCardUiGuards.ts                    # ✅ passed
```

**Total guard assertions: 142, all passing.**

---

## 5. Validation Results

All builds clean, all guards pass. No regressions in feed, live stats, or snapshot paths.

---

## 6. Dependencies Added

None.

---

## 7. Config Changes

None. No Firestore indexes, rules, or function configuration changed.

---

## 8. Risks

1. **`summaryEntries` value vs. capped scoring value.** `summaryEntries` stores `entry.value` (the raw user-submitted value), not `scoring.rawValue` or `scoring.capped`. This matches `wellnessLogService.ts` behavior exactly (`cumulativeLoggedValue: (membership.cumulativeLoggedValue ?? 0) + input.value`). If the scoring model later changes to cap stored values, this derivation would need updating alongside `wellnessLogService`.

2. **CF snapshot reads `challengeMembers.cumulativeLoggedValue` post-batch.** The CF trigger fires after the batch commits. Since the session writes `challengeMembers` (via `batch.set(..., { merge: true })`), the CF will read the updated cumulative value. This is the correct, intended behavior established in Phase 19A-8D.

3. **No migration for existing `challengeMembers` docs.** Historical docs from wellness multi-session users before this fix have `cumulativeLoggedValue = 0` or missing. The next session write will set the correct cumulative going forward but will not back-fill past sessions. This is acceptable — the alternative (reading all past logs to compute a backfill total) would require a migration script.

---

## 9. Rollback Instructions

Revert the three added lines in `src/services/activityLogSessionService.ts`:

```diff
-   const sessionContributionTotal = summaryEntries.reduce((s, e) => s + Math.max(0, e.value), 0);
-   const nextCumulativeLoggedValue = Math.max(0, Number(membership.cumulativeLoggedValue ?? 0)) + sessionContributionTotal;
    const membershipUpdate: Record<string, unknown> = {
      activitiesCompleted: nextCompleted,
      totalPoints: increment(totalPoints),
      lastActivityAt: serverTimestamp(),
      completionRate: nextRate,
-     cumulativeLoggedValue: nextCumulativeLoggedValue,
    };
```

Delete `scripts/testChallengePerformanceSourceOfTruthGuards.ts`.
