# Phase 19A-10D — Stop ChallengeCompletedScreen from Showing Dual Totals

**Date:** 2026-07-07
**Branch:** fix/p0-pre-deploy-blockers

---

## 1. Files Modified

| File | Change |
|------|--------|
| `src/features/Challenges/ChallengeCompletedScreen.tsx` | Legacy v1 "Total Reps" display replaced: `totalValue` → `cumulativeLoggedValue` |
| `scripts/testChallengePerformanceSourceOfTruthGuards.ts` | Added 4 new 10D assertions |

---

## 2. Audit Findings — Pre-Fix State

The file had **three rendering branches**:

| Branch | "User Total" source | Status |
|--------|--------------------|----|
| v2 collective | `cumulativeLoggedValue` (line 196) | ✅ Already correct |
| v2 competitive | `cumulativeLoggedValue` (lines 278, 303) | ✅ Already correct |
| v2 streak | `currentStreak` / day counts | ✅ Already correct |
| **Legacy v1** | `totalValue` = raw `workouts` sum (line 521) | ❌ Wrong source |

The audit-identified conflict was **exclusively in the legacy v1 branch**: line 521 displayed `totalValue.toLocaleString()` labelled "Total Reps" — a raw sum of the `workouts` collection — while all v2 branches already used `cumulativeLoggedValue` from `challengeMembers`.

`totalValue` (line 129) is also used to derive `averageValue` → `intensity` ("High"/"Medium"/"Light"), which remains in the legacy screen as a classification string — not a conflicting numeric total.

---

## 3. Code Diff Summary

**`src/features/Challenges/ChallengeCompletedScreen.tsx`** — legacy v1 "Your Achievements" section:

Before:
```tsx
<p className="text-[12px] ... font-bold text-primary">Total Reps</p>
<p className="mt-2 text-[22px] ... font-black text-slate-900">{totalValue.toLocaleString()}</p>
```

After:
```tsx
<p className="text-[12px] ... font-bold text-primary">Total</p>
<p className="mt-2 text-[22px] ... font-black text-slate-900">{cumulativeLoggedValue.toLocaleString()}</p>
```

Label changed from "Total Reps" to "Total" because `cumulativeLoggedValue` aggregates across all activity types (reps, minutes, km, etc.), not only reps.

---

## 4. What Was NOT Changed

- `useChallengeWorkouts` import and `myWorkouts` / `uniqueDays` computation — retained for day-counting in streak screen ("Active Days", "Missed Days") and legacy screen ("Days Active"). These are day counts, not value totals, and are not displayed as a conflicting "my total."
- `totalValue` / `averageValue` / `intensity` — still computed for the legacy "Avg Intensity" classification. This is a categorical string, not a numeric total, so it does not create a conflicting total display.
- All v2 branches (collective, competitive, streak) — already used correct sources; unchanged.
- `useFinalRank` hook — unchanged.

---

## 5. Source-of-Truth State After 10D

| Screen branch | User total displayed | Source |
|--------------|---------------------|--------|
| v2 collective — "Contributed" | `cumulativeLoggedValue` | `challengeMembers` ✅ |
| v2 competitive — "Progress" | `cumulativeLoggedValue` | `challengeMembers` ✅ |
| v2 streak — "Final Streak" | `currentStreak` | `challengeMembers` ✅ |
| Legacy v1 — "Total" | `cumulativeLoggedValue` | `challengeMembers` ✅ (fixed) |

No screen now renders a raw workout sum as a user challenge total.

---

## 6. Commands Executed

```bash
npx tsx scripts/testChallengePerformanceSourceOfTruthGuards.ts   # ✅ all guards passed
npx tsc --noEmit                                                  # ✅ 0 errors
npm run build                                                     # ✅ built in 13.22s
npx tsx scripts/testGroupFeedProgressSnapshotGuards.ts           # ✅ passed
npx tsx scripts/testGroupFeedProgressGuards.ts                   # ✅ passed
npx tsx scripts/testGroupFeedFinalQaGuards.ts                    # ✅ passed
```

---

## 7. Dependencies Added

None.

---

## 8. Config Changes

None.

---

## 9. Risks

1. **Legacy v1 challenges with no `cumulativeLoggedValue`.** If a v1 member never logged via a v2 engine write path, `membership?.cumulativeLoggedValue` will be `0`. Pre-fix, `totalValue` (raw workout sum) would have shown a non-zero number. After fix, "Total" shows `0` for these historical users. This is accepted — the field is the canonical source; a migration script to backfill would be a separate task.

2. **`totalValue` still computed from raw workouts.** `totalValue` remains in scope for `averageValue`/`intensity`. If `useChallengeWorkouts` is removed in a future cleanup, `intensity` must be removed or re-sourced at that time.

---

## 10. Rollback Instructions

In `src/features/Challenges/ChallengeCompletedScreen.tsx`, revert the legacy v1 "Your Achievements" section:
```tsx
<p ...>Total Reps</p>
<p ...>{totalValue.toLocaleString()}</p>
```
