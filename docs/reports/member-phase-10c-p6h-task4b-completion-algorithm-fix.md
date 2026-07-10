# Task 4B — Completion Algorithm Fix

**Branch:** fix/p0-pre-deploy-blockers  
**Date:** 2026-06-24  
**Status:** COMPLETE (code fix + tests pass; repair script NOT run — pending separate approval)

---

## Summary

Fixed the challenge completion algorithm across all three log-writing services so that:
1. Future logs cannot prematurely complete a challenge (duration-aware `totalActivities`)
2. Scoring uses `computeActivityScore` with proper `normalizedBase` instead of `increment(10)`
3. Streak challenges derive a per-day effective target via `deriveDailyTargetValue` before scoring
4. All new log writes are stamped `scoringVersion: 'v2'`
5. A completed membership throws early (`membership.status === 'completed'`) instead of silently re-completing
6. Firestore rules validate `totalActivities` using `activityCount * durationDays`

---

## Files Changed

| File | Change |
|------|--------|
| `src/services/workoutService.ts` | Import `deriveDailyTargetValue`; use it before scoring; fix import of `computeRequiredLogs` |
| `src/services/wellnessLogService.ts` | Import `deriveDailyTargetValue`; use it before scoring; fix `__wellnessLogDebug` cast |
| `src/features/Home/useHomeScreen.ts` | Move `getUserChallengeMembershipIndex` await outside `.map()` to fix TS1308 |
| `firestore.rules` | `configuredChallengeActivityCountFrom` now multiplies `activityCount * durationDays` |

---

## Root Cause

### Premature completion
`membership.totalActivities` was set at join time to `activities.length` (e.g. `2` for a 2-activity challenge). A 21-day challenge with 2 daily activities requires 42 logs to complete — but after 2 logs the old algorithm marked it completed.

### Wrong scoring
Services were using `increment(10)` (a flat +10 points) regardless of the activity target or how close the user came to their goal.

### Streak target inflation
For streak challenges, `targetValue` stored in Firestore is the cumulative total (e.g. 1050 reps over 21 days). Passing `1050` to scoring for a single daily log of `50` reps scored near-zero — the user was penalised for doing exactly what was expected.

---

## Fixes Applied

### Fix 4 / 21B — Duration-aware `totalActivities`

In all three services (`workoutService`, `wellnessLogService`, `activityLogSessionService`):

```ts
const activityCount = Math.max(1, challengeData.activities?.length ?? 1);
const totalActivities = computeRequiredLogs(challengeData.durationDays, activityCount);
const normalizedBase = Math.round(100 / totalActivities);
```

`computeRequiredLogs(durationDays, activityCount)` returns `durationDays * activityCount`.

### Fix P6C — `deriveDailyTargetValue` for streak challenges

```ts
const rawTargetValue = activityConfig?.targetValue ?? 0;
const effectiveTargetValue = deriveDailyTargetValue(
  rawTargetValue,
  challengeData.durationDays,
  challengeData.challengeType ?? 'collective',
);
```

`deriveDailyTargetValue(targetValue, durationDays, challengeType)`:
- Non-streak → returns `targetValue` unchanged
- Streak, `durationDays <= 1` → returns `targetValue` unchanged
- Streak, derived < 1 → returns `targetValue` unchanged (already a daily target)
- Streak, derived ≥ 1 → returns `targetValue / durationDays` (per-day target)

### Fix — Proper scoring

```ts
const scoring = computeActivityScore({
  value: input.value,
  targetValue: effectiveTargetValue,
  challengeType: ...,
  basePoints: normalizedBase,
});
// membershipUpdate uses increment(scoring.pointsEarned)
```

### Fix 5 — Early throw guard

```ts
if (membership.status === 'completed') {
  throw new Error('Challenge already completed.');
}
```

### Guard 14 — Completion pattern

```ts
if (nextRate >= 100) {
  membershipUpdate.status = 'completed';
  membershipUpdate.completedAt = Timestamp.now();
}
```

No secondary `&& membership.status !== 'completed'` check — the early throw above already handles re-entry.

### Fix 21D — Firestore rules

```
function configuredChallengeActivityCountFrom(challengeData) {
  let activityCount = challengeData.get('activities', []).size();
  let durationDays = challengeData.get('durationDays', 1);
  if (durationDays < 1) { durationDays = 1; }
  return activityCount * durationDays;
}
```

`isValidChallengeMemberCreate` uses this to validate `totalActivities` at join time.

---

## Validation Results

| Command | Result |
|---------|--------|
| `npx tsc -b --pretty false` | ✅ 0 errors |
| `npm run build` | ✅ built in 12.48s |
| `npm run test:home-challenge-feeds` | ✅ all guards passed |
| `npm run test:scoring-guards` | ✅ scoring guards passed |

---

## Pending (Separate Approval Required)

**Category A membership repair:** 7 memberships with `{ status: 'active', completedAt: null }` need to be backfilled using the corrected `computeRequiredLogs` logic. This repair script has NOT been run. It must be approved and run separately after this branch is reviewed.
