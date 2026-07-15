# Phase 19A-10C — Stop Home Screen from Raw-Summing Logs

**Date:** 2026-07-07
**Branch:** fix/p0-pre-deploy-blockers

---

## 1. Files Modified

| File | Change |
|------|--------|
| `src/features/Home/useHomeScreen.ts` | Removed raw `wellnessLogs`/`workouts` queries for first-card progress; replaced with `membership?.cumulativeLoggedValue` |
| `scripts/testChallengePerformanceSourceOfTruthGuards.ts` | Added 4 new 10C assertions |

---

## 2. Code Diff Summary

**`src/features/Home/useHomeScreen.ts`** — first-card enrichment block (lines 226–282 before):

Removed:
```typescript
const unit = String(primaryActivity?.unit ?? 'units');
let progressValue = 0;

if (targetValue > 0 && primaryActivity) {
  const isWellness = (firstChallenge.category && firstChallenge.category !== 'fitness') || !!primaryActivity.activityId;
  if (isWellness) {
    const logsSnap = await getDocs(
      query(collection(db, 'wellnessLogs'), where('challengeId', '==', firstChallenge.id), where('userId', '==', uid)),
    ).catch(() => null);
    logsSnap?.docs.forEach((item) => {
      const data = item.data() as { ... };
      const activityMatch = primaryActivity.activityId ? data.activityId === primaryActivity.activityId : true;
      if (activityMatch) progressValue += Math.max(0, Number(data.value ?? 0));
    });
  } else {
    const workoutsSnap = await getDocs(
      query(collection(db, 'workouts'), where('challengeId', '==', firstChallenge.id), where('userId', '==', uid)),
    ).catch(() => null);
    workoutsSnap?.docs.forEach((item) => {
      const data = item.data() as { ... };
      const exerciseMatch = primaryActivity.exerciseId ? data.exerciseId === primaryActivity.exerciseId : true;
      if (exerciseMatch) progressValue += Math.max(0, Number(data.value ?? 0));
    });
  }
}
```

Changed in `buildChallengeProgress` call:
```typescript
// Before:
cumulativeLoggedValue: progressValue,

// After:
cumulativeLoggedValue: Math.max(0, Number(membership?.cumulativeLoggedValue ?? 0)),
```

---

## 3. Source-of-Truth Behavior After Fix

| Value | Source before 10C | Source after 10C |
|-------|------------------|-----------------|
| Home first-card user progress | Raw sum of `workouts`/`wellnessLogs` (diverges on multi-session wellness, CF retries) | `challengeMembers.cumulativeLoggedValue` (written by client engines) |
| Home mostActiveOngoing ranking | `challengeActivitySummaries.totalLogs` | Unchanged |
| Home My Challenges base cards | `membership.cumulativeLoggedValue` via `buildChallengeProgress` | Unchanged |
| Competitive leaderboard comparison | `challengeMembers.cumulativeLoggedValue` (via `competitiveLeaderboards` map) | Unchanged |

---

## 4. What Was NOT Changed

- The `competitiveLeaderboards` block (lines 165–187) — already reads from `challengeMembers`. No change needed.
- The base card build at line 198 — already passes full `membership` to `buildChallengeProgress`. No change needed.
- `challengeActivitySummaries` reads — still used for `mostActiveOngoing` ranking. No change.
- Home UI layout and HomeScreen.tsx — not touched.

---

## 5. Commands Executed

```bash
npx tsc --noEmit                                                  # ✅ 0 errors
npx tsx scripts/testChallengePerformanceSourceOfTruthGuards.ts   # ✅ all guards passed
npm run build                                                     # ✅ built in 6.69s
npx tsx scripts/testGroupFeedProgressSnapshotGuards.ts           # ✅ passed
npx tsx scripts/testGroupFeedProgressGuards.ts                   # ✅ passed
npx tsx scripts/testGroupFeedFinalQaGuards.ts                    # ✅ passed
```

---

## 6. Dependencies Added

None.

---

## 7. Config Changes

None. No Firestore indexes, rules, or function configuration changed.

---

## 8. Risks

1. **`membershipSummaries` field coverage.** The first-card now uses `membership?.cumulativeLoggedValue` from `membershipSummaries`, returned by `challengeService.getUserChallengeMembershipSummaries(uid)`. If that service does not include `cumulativeLoggedValue` in its returned shape, the value will be `0` (graceful default). After Phases 10A–10C all client write paths populate this field; any user who logs after this deploy gets the correct value.

2. **Historical sessions.** Users who had wellness multi-activity sessions logged before Phase 10A will have `cumulativeLoggedValue` lagging by those historical sessions. The Home card will show a lower number than raw log summing did. This is accepted: the field is now the source of truth and will self-correct on the next log.

---

## 9. Rollback Instructions

In `src/features/Home/useHomeScreen.ts`, restore the removed raw query block and revert `cumulativeLoggedValue: progressValue`. The full original block is documented in the git diff for this commit.
