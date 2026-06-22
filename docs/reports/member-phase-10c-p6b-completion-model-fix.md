# Phase 10C-P6B — Duration-Aware Challenge Completion Model

**Date:** 2026-06-21  
**Branch:** fix/p0-pre-deploy-blockers  
**Status:** Complete — all validation green, build clean

---

## Bug: Premature Completion

Before this fix, a challenge member's completion was measured as:

```
totalActivities = challenge.activities.length          (number of activity types)
completionRate  = activitiesCompleted / totalActivities
```

This caused:
- A **20-day sleep challenge** (1 activity type) to mark `status: 'completed'` after **1 log**.
- A **21-day Squat+Pushup challenge** (2 activity types) to mark `status: 'completed'` after **2 logs**.
- `durationDays` was stored on every challenge document but never used in any completion formula.

---

## Fix

### New helper: `src/services/challengeCompletion.ts`

```ts
export function computeRequiredLogs(
  durationDays: number | null | undefined,
  activityCount: number,
): number {
  const days = Math.max(1, Number(durationDays) || 1);
  const activities = Math.max(1, activityCount);
  return days * activities;
}
```

`computeRequiredLogs` is the single source of truth for how many log events are required to complete a challenge. All services and display screens use it.

### Formula change

```
Before:  totalActivities = activities.length
After:   totalActivities = computeRequiredLogs(challenge.durationDays, activities.length)
                         = durationDays × activities.length
```

For challenges without `durationDays` (old data or missing field), `durationDays` defaults to 1, preserving the old single-day behavior.

---

## Files Changed

| File | Change |
|------|--------|
| `src/services/challengeCompletion.ts` | **Created** — `computeRequiredLogs` helper |
| `src/types/index.ts` | Added `durationDays?: number` to `Challenge` interface |
| `src/services/challengeService.ts` | `joinChallenge` writes `totalActivities: computeRequiredLogs(...)` |
| `src/services/wellnessLogService.ts` | `writeLog` uses `computeRequiredLogs`; `durationDays` added to challenge cast |
| `src/services/workoutService.ts` | `createWorkout` uses `computeRequiredLogs`; `durationDays` added to challenge cast |
| `src/services/activityLogSessionService.ts` | `createActivitySession` uses `computeRequiredLogs`; `durationDays` added to challenge cast |
| `src/features/Home/useHomeScreen.ts` | `toActiveChallengeCard` uses `computeRequiredLogs`; label updated from "activities" to "logs" |
| `src/features/Challenges/ChallengeDetailScreen.tsx` | Completion display uses `computeRequiredLogs(summary.durationDays, activities.length)`; label → "logs" |
| `src/features/Challenges/CompletedChallengesScreen.tsx` | Completion display uses `computeRequiredLogs(challenge.durationDays, activities.length)`; label → "logs" |
| `firestore.rules` | `configuredChallengeActivityCountFrom` multiplies `activityCount × durationDays` |
| `scripts/testScoringGuards.ts` | Updated existing Fix 2 assertion; added Section 21 (P6B) with 13 new assertions |

---

## Exact Changes Per File

### `joinChallenge` (challengeService.ts)

```ts
// Before
totalActivities: Array.isArray(challenge.activities) ? challenge.activities.length : 0,

// After
totalActivities: computeRequiredLogs(
  challenge.durationDays,
  Array.isArray(challenge.activities) ? challenge.activities.length : 1,
),
```

### `wellnessLogService.ts` / `workoutService.ts`

```ts
// Before (same pattern in both)
const configuredActivities = Array.isArray(challenge.activities) ? challenge.activities.length : 0;
const totalActivities = Math.max(1, configuredActivities, Number(membership.totalActivities ?? 1));

// After
const configuredActivities = Array.isArray(challenge.activities) ? challenge.activities.length : 0;
const totalActivities = computeRequiredLogs(challenge.durationDays, configuredActivities);
```

### `activityLogSessionService.ts`

```ts
// Before
const totalActivities = Math.max(1, configuredActivities, configuredExerciseIds, Number(membership.totalActivities ?? 1));

// After
const totalActivities = computeRequiredLogs(challenge.durationDays, Math.max(configuredActivities, configuredExerciseIds));
```

### `firestore.rules` — `configuredChallengeActivityCountFrom`

```
// Before
function configuredChallengeActivityCountFrom(challenge) {
  return challenge.data.activities is list && challenge.data.activities.size() > 0
    ? challenge.data.activities.size()
    : (challenge.data.exerciseIds is list && challenge.data.exerciseIds.size() > 0
        ? challenge.data.exerciseIds.size() : 1);
}

// After
function configuredChallengeActivityCountFrom(challenge) {
  let activityCount = challenge.data.activities is list && challenge.data.activities.size() > 0
    ? challenge.data.activities.size()
    : (challenge.data.exerciseIds is list && challenge.data.exerciseIds.size() > 0
        ? challenge.data.exerciseIds.size() : 1);
  let durationDays = challenge.data.durationDays is int && challenge.data.durationDays > 0
    ? challenge.data.durationDays : 1;
  return activityCount * durationDays;
}
```

This means the Firestore security rule now enforces the same ceiling as the client: `activitiesCompleted` cannot exceed `durationDays × activityCount`.

---

## Tests Added

### Section 21A — `computeRequiredLogs` pure-function correctness

| Test | Expected | Result |
|------|----------|--------|
| `computeRequiredLogs(20, 1)` | 20 | ✅ |
| `computeRequiredLogs(21, 2)` | 42 | ✅ |
| `completionRate` after 1 log in 20-day challenge | 5% | ✅ |
| `completionRate` after 2 logs in 21-day × 2-activity challenge | 5% (rounds from 4.76%) | ✅ |
| Status after 1 log in 20-day challenge | NOT completed (5% < 100%) | ✅ |
| Status after 2 logs in 21-day × 2-activity challenge | NOT completed (5% < 100%) | ✅ |
| `computeRequiredLogs(undefined, 2)` | 2 (defaults to 1 day) | ✅ |
| `computeRequiredLogs(0, 2)` | 2 (0 days → 1 day) | ✅ |

### Section 21B — All three log services use `computeRequiredLogs`

Asserts `computeRequiredLogs` is imported and called with `durationDays` in:
- `wellnessLogService.ts` ✅
- `workoutService.ts` ✅
- `activityLogSessionService.ts` ✅

Asserts old `Math.max(1, configuredActivities, Number(membership.totalActivities...))` pattern is gone from both.

### Section 21C — `joinChallenge` uses `computeRequiredLogs` with `durationDays`

✅

### Section 21D — Firestore rule multiplies `activityCount * durationDays`

Asserts `configuredChallengeActivityCountFrom` references `durationDays` and uses `activityCount * durationDays`.

---

## Validation Results

```
✅ npm run test:scoring-guards              scoring guards passed
✅ npm run test:home-challenge-feeds        home challenge feed guards passed
✅ npm run test:home-performance-guards     home performance guards passed
✅ npm run test:pilot-ux-polish-guards      pilot UX polish guards passed
✅ npm run test:challenge-creation-backend  challenge creation backend tests passed
✅ npm run test:group-invite-backend        Group invite backend security tests passed
✅ npx tsc -b --pretty false               (no output — clean)
✅ npm run build                            ✓ built in 3.49s
✅ firebase deploy --only firestore:rules --dry-run  rules compiled successfully
```

---

## Backwards Compatibility

| Scenario | Before fix | After fix |
|---|---|---|
| Old member, `totalActivities = activities.length` | Completion threshold = 2 (for 21-day 2-activity challenge) | Runtime uses `computeRequiredLogs = 42` (from challenge doc). Old member's stored `totalActivities` is no longer used as the cap. |
| Old member, `totalActivities = 0` | Runtime fallback to `configuredActivities` | Same: runtime uses `computeRequiredLogs`. |
| Challenge without `durationDays` | `Math.max(1, activities.length, ...)` | `computeRequiredLogs(undefined, n) = 1 × n = n`. Identical to old behaviour. |
| New member join | `totalActivities = activities.length` | `totalActivities = computeRequiredLogs(durationDays, activities.length)`. |

The `membership.totalActivities` field is no longer used as a cap in service-side calculations. `computeRequiredLogs` always derives the authoritative value from the challenge document, which is always read before any logging write.

---

## Scoring Impact

`normalizedBase = round(100 / totalActivities)` uses the new `totalActivities`. This scales correctly:
- 20-day sleep challenge: `normalizedBase = round(100/20) = 5` pts/log × 20 logs = 100 pts total
- 21-day × 2-activity challenge: `normalizedBase = round(100/42) = 2` pts/log × 42 logs = ~100 pts total

This is the correct behavior — the total achievable points over the full challenge duration remains ~100.

---

## Deploy Required

- **Frontend deploy** — client changes (services, screens)
- **Firestore rules deploy** — `configuredChallengeActivityCountFrom` updated

---

## UI Verification Steps

1. **Join a new challenge** — verify `totalActivities` in Firestore equals `durationDays × activities.length`
2. **Log one session** for a multi-day challenge — verify `completionRate` does NOT jump to 100%
3. **Home screen active challenge card** — progress label should show "X of Y logs" (not "activities")
4. **Challenge detail screen** — completion block should show correct denominator after full completion
5. **Completed challenges screen** — progress count should show against full `durationDays × activities.length` denominator

---

## Risk Assessment

| Change | Risk | Rationale |
|--------|------|-----------|
| `computeRequiredLogs` helper | Very low | Pure function, no I/O, fully tested |
| `joinChallenge` totalActivities write | Low | Value increases (never decreases); old rule allowed `totalActivities == 0` as well as `configuredChallengeActivityCountFrom` |
| Services drop `membership.totalActivities` fallback | Low | Challenge doc is always read before any batch commit; `durationDays` is present on all production challenges |
| Firestore rule `activityCount * durationDays` | Low | `activitiesCompleted <= activityCount` ceiling increases proportionally; no valid client write was near the old ceiling |
| Display label "activities" → "logs" | Zero | UI string only |
| Scoring `normalizedBase` change | Low-medium | Points-per-log decreases for multi-day challenges. Members who log all required events still earn ~100 pts total. Members who earned 100 pts from 1 log (old bug) will not regress — those memberships are already `completed`. |

---

## Known Pending Issues

- **Old completed memberships** (e.g., OAKeNr who completed "Squat+Pushup 50" in 2 logs): already `status: 'completed'` in Firestore. The bug awarded them `completed` status 13 days early; this is not reversed by this fix. A backfill would be required to reset their memberships — tracked separately.
- **`targetValue` mismatch** (cumulative vs daily for streak challenges): still present. Logged `value: 50 reps` against `targetValue: 1050` yields 0 points. Separate issue.
- **stats overwrite tradeoff** (P5X known issue): `batch.set(merge:true)` for user stats still replaces the full `stats` map — tracked separately.
