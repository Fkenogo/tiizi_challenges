# CRIT-3 Step 1 — totalActivities ≤ 0 Guard
**Branch:** `fix/p0-pre-deploy-blockers`
**Date:** 2026-06-24
**Status:** Complete

---

## 1. Files Modified

| File | Change |
|---|---|
| `src/services/workoutService.ts` | +4 lines: guard after `computeRequiredLogs` |
| `src/services/wellnessLogService.ts` | +4 lines: guard after `computeRequiredLogs` |
| `scripts/testScoringGuards.ts` | +55 lines: Section 21C with 6 structural assertions |
| `docs/reports/member-phase-10c-change-log.md` | Change log entry added |

---

## 2. Code Diff Summary

### `src/services/workoutService.ts`

```diff
   const activityCount = Math.max(1, challengeData.activities?.length ?? 1);
   const totalActivities = computeRequiredLogs(challengeData.durationDays, activityCount);

+  if (totalActivities <= 0) {
+    throw new Error('Challenge is not fully configured. Please contact your group admin.');
+  }
+
   const activityConfig = challengeData.activities?.find(
```

### `src/services/wellnessLogService.ts`

```diff
   const activityCount = Math.max(1, challengeData.activities?.length ?? 1);
   const totalActivities = computeRequiredLogs(challengeData.durationDays, activityCount);

+  if (totalActivities <= 0) {
+    throw new Error('Challenge is not fully configured. Please contact your group admin.');
+  }
+
   const activityConfig = challengeData.activities?.find(
```

### `scripts/testScoringGuards.ts`

Added Section 21C (between existing Section 21 and Section 22) with 6 assertions:

1. `workoutService` contains `if (totalActivities <= 0)` regex
2. `wellnessLogService` contains `if (totalActivities <= 0)` regex
3. Guard appears before `Math.min(alreadyCompleted + 1` in `workoutService` (ordering)
4. Guard appears before `Math.min(Number(membership.activitiesCompleted` in `wellnessLogService` (ordering)
5. Guard block in `workoutService` contains `throw new Error`
6. Guard block in `wellnessLogService` contains `throw new Error`

---

## 3. Commands Executed

```
npx tsc -b --pretty false
npm run build
npm run test:scoring-guards
npm run test:home-challenge-feeds
```

---

## 4. Test Results

| Command | Result |
|---|---|
| `npx tsc -b --pretty false` | ✅ 0 errors |
| `npm run build` | ✅ built in 8.66s |
| `npm run test:scoring-guards` | ✅ scoring guards passed |
| `npm run test:home-challenge-feeds` | ✅ all guards passed |

---

## 5. Dependencies Added

None.

---

## 6. Config Changes

None.

---

## 7. Risks

**Low.** The guard fires only when `computeRequiredLogs(durationDays, activityCount)` returns a value ≤ 0. The implementation of `computeRequiredLogs` floors both inputs at 1 (`max(1, days) × max(1, activityCount)`) — the minimum possible return value is 1. Therefore:

- For all correctly-configured challenges (any valid `durationDays` and at least one activity), the guard **never fires**.
- The guard only fires for challenge docs where both `durationDays` and `activities` are simultaneously missing or zero in ways that the floor logic cannot recover — an edge case that does not exist in the current production schema.
- The 7 known Category A memberships with `totalActivities: 0` **have valid challenge docs** (the membership field was set to 0 by a bug in the old auto-join code, not because the challenge itself is misconfigured). `computeRequiredLogs` called against their challenge docs returns the correct positive value, so the guard does **not** fire for those 7 users. They still need the Task 4C data repair, which is a separate step.

**User-facing:** if the guard did fire (hypothetical misconfigured challenge), the user sees an error toast: "Challenge is not fully configured. Please contact your group admin." No silent failure, no false completion.

---

## 8. Rollback Instructions

```bash
git diff HEAD src/services/workoutService.ts src/services/wellnessLogService.ts scripts/testScoringGuards.ts
# To revert only these three files:
git checkout HEAD~1 -- src/services/workoutService.ts src/services/wellnessLogService.ts scripts/testScoringGuards.ts
```

The guard is isolated to 4 added lines per service. There are no schema changes, no Firestore writes, and no UI changes — rollback is instant.

---

## 9. What Was NOT Done

Per task constraints:
- The 7 Category A memberships (`totalActivities: 0` in Firestore) were **not** repaired — that requires explicit prod write approval (Task 4C).
- No UI changes.
- No leaderboard, quick action, template, or challenge detail changes.
- No refactoring.
