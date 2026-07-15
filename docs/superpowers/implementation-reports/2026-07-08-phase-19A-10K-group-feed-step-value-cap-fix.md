# Phase 19A-10K — Fix Group Feed Step Value Cap Above 10,000

**Date:** 2026-07-08
**Branch:** fix/p0-pre-deploy-blockers
**Status:** ✅ Complete

---

## Problem

Group Feed activity boxes displayed **10,000** for any wellness log (steps) above that threshold:

- User logs 16,700 steps → feed shows **10,000 steps** ❌
- User logs 18,000 steps → feed shows **10,000 steps** ❌
- User logs 8,500 steps → feed shows **8,500 steps** ✅ (under cap, correct)
- Walking distance, push-ups → correct (values were below 10,000)

Additionally, the feed progress snapshot line (`16,700 / 80,000 steps`) rendered correctly because
it reads from `challengeMembers.cumulativeLoggedValue` (written by the client engine, uncapped).
Only the **activity box** (`valueLabel`) was wrong — it used the CF-clamped value.

---

## Root Cause

`functions/src/memberActivitySummaries.ts` defined:

```typescript
const ACTIVITY_SUMMARY_LIMITS = {
  maxActivityValue: 10000,   // ← the culprit
  maxActivityScore: 1000,
  ...
} as const;
```

Both `summarizeWorkoutCreated` and `summarizeWellnessLogCreated` called:

```typescript
const value = clampNumber(numberValue(data, 'value'), 0, ACTIVITY_SUMMARY_LIMITS.maxActivityValue);
```

This truncated `value` to `10,000` before it was passed to:
1. `formatValue(input.value, input.unit)` → `valueLabel` written to `groupActivityFeed` → **feed activity box**
2. `groupActivityFeed.value` → numeric value on the feed doc
3. `challengeActivitySummaries.totalValue: FieldValue.increment(Math.max(0, input.value))` → **team total**

The cap of 10,000 was a sanity guard that predated step challenges where 16,000–25,000 steps per
session is a normal logged value.

---

## Fix

Single-line change in `functions/src/memberActivitySummaries.ts`:

```diff
-  maxActivityValue: 10000,
+  maxActivityValue: 1_000_000,
```

`1,000,000` covers all plausible human athletic values (steps, meters, reps, calories, ml) while
still protecting against obvious garbage data.

The **score cap** (`maxActivityScore: 1000`) is unchanged — scoring is independent and intentional.

---

## Files Modified

| File | Change |
|---|---|
| `functions/src/memberActivitySummaries.ts` | `maxActivityValue: 10000` → `maxActivityValue: 1_000_000` with explanatory comment |
| `scripts/testGroupFeedStepCapGuards.ts` | New guard script (7 assertions) |

---

## Guard Assertions (`testGroupFeedStepCapGuards.ts`)

1. `maxActivityValue` is > 10,000
2. `maxActivityScore` remains 1,000 (scoring cap unchanged)
3. Value clamp does not use hardcoded `10000`
4. Value clamp references `ACTIVITY_SUMMARY_LIMITS.maxActivityValue`
5. `valueLabel` is formatted from `input.value`
6. `challengeActivitySummaries.totalValue` increments by `input.value`
7. Both summarize functions use the same `maxActivityValue` clamp (≥ 2 occurrences)

---

## Validation

```
npx tsx scripts/testGroupFeedStepCapGuards.ts                   → ✅ All 7 guards passed
npx tsx scripts/testChallengePerformanceSourceOfTruthGuards.ts  → ✅ All guards passed
npx tsx scripts/testChallengePerformanceFinalRegressionGuards.ts → ✅ All guards passed
npx tsx scripts/testCollectiveTeamProgressRegressionGuards.ts   → ✅ All guards passed
npx tsx scripts/testGroupFeedProgressSnapshotGuards.ts          → ✅ All guards passed
npx tsx scripts/testGroupFeedProgressGuards.ts                  → ✅ All guards passed
npx tsx scripts/testGroupFeedLiveStatsGuards.ts                 → ✅ All guards passed
npx tsx scripts/testGroupFeedCardUiGuards.ts                    → ✅ All guards passed
npx tsc --noEmit                                                → ✅ Clean
npm run build                                                   → ✅ Clean
cd functions && npm run build                                   → ✅ Clean
```

---

## What is NOT affected

- Feed progress snapshot (correct both before and after — reads from `challengeMembers.cumulativeLoggedValue`)
- Scoring (`maxActivityScore: 1000` unchanged)
- Push-up, walking distance, hydration, fasting logs (their values are typically below 10,000)
- Workout logs (same clamp path in `summarizeWorkoutCreated`, same fix applies — no regressions)
- Any client-side display logic (resolver, Home, ChallengeDetail, etc.)

---

## Risks

- **Anti-abuse coverage reduced:** values up to 1,000,000 are now accepted. This covers legitimate
  athletic values but no longer blocks someone entering, say, 500,000 push-ups. The scoring cap
  (`maxActivityScore: 1000`) still prevents score manipulation — only the display/aggregate value
  changes. In practice, group members can see each other's logs and social accountability deters abuse.
- **`challengeActivitySummaries.totalValue` may be wrong for past logs:** existing feed documents
  for logs > 10,000 already have `value: 10000` and `valueLabel: "10000 steps"` stored. This fix
  applies to new logs only. Past logs are not backfilled — they would need a migration script.

---

## Rollback

Revert `maxActivityValue: 1_000_000` to `maxActivityValue: 10000` in
`functions/src/memberActivitySummaries.ts` and redeploy the Cloud Function.

---

## Manual Test Checklist

### Competitive steps > 10,000
- [ ] Open a competitive steps challenge
- [ ] Log 16,700 steps
- [ ] Group Feed activity box shows **16,700 steps** (not 10,000)
- [ ] Feed progress snapshot shows **16,700 / 80,000 steps** (or correct per-person target)

### Collective steps > 10,000
- [ ] Open a collective steps challenge
- [ ] Log 18,000 steps
- [ ] Group Feed activity box shows **18,000 steps**
- [ ] Team progress on ChallengeDetail reflects the full 18,000 contribution

### Streak steps > 10,000
- [ ] Open a streak steps challenge
- [ ] Log 12,000 steps
- [ ] Group Feed activity box shows **12,000 steps**

### Regression: steps ≤ 10,000
- [ ] Log 8,500 steps on any challenge type
- [ ] Group Feed activity box shows **8,500 steps** (unchanged behavior)

### Regression: other activities
- [ ] Log a walking distance activity (e.g., 5.2 km) → feed shows **5.2 km**
- [ ] Log push-ups (e.g., 100 reps) → feed shows **100 Reps**
- [ ] Log a workout (e.g., 200 Reps) → feed shows **200 Reps**
