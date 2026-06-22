# Phase 10C-P5T — Resolve P5S Challenge Logging Smoke Findings

**Date:** 2026-06-19  
**Branch:** fix/p0-pre-deploy-blockers  
**Status:** Complete — all validation green

---

## Summary

Fixed all five findings confirmed in the P5S static smoke test. No new product behavior was introduced beyond correcting the identified bugs.

---

## Changes Made

### Fix 1 (HIGH) — Wrong wellness activityType in SelectChallengeActivityScreen

**File:** `src/features/Workouts/SelectChallengeActivityScreen.tsx`

- Imported `resolveWellnessActivityType` from `../../services/challengeActivityFlow`
- Replaced the multi-activity wellness entry construction:
  ```ts
  // Before (bug):
  activityType: String(optional.activityType ?? challenge.category ?? 'wellness'),

  // After:
  activityType: resolveWellnessActivityType(optional.activityType, label, challenge.category),
  ```
- `resolveWellnessActivityType` never returns `'wellness'`; it infers the correct Firestore-accepted type (`fasting`, `hydration`, `sleep`, `meditation`) from name keywords and category. Prevents Firestore `logType` rule rejections and wrong data stored as `'meditation'` (the `normalizedWellnessType` fallback).

---

### Fix 2 (MEDIUM) — challengeMembers.totalActivities initialized to 0

**File:** `src/services/challengeService.ts` — `joinChallenge`

- Changed:
  ```ts
  // Before (bug):
  totalActivities: 0,

  // After:
  totalActivities: Array.isArray(challenge.activities) ? challenge.activities.length : 0,
  ```
- Firestore rule `isSafeChallengeProgressUpdate` does not allow updating `totalActivities` after creation, so this field must be correct at join time. The previous `0` caused the completed-challenge banner to read "N of 0 activities."

---

### Fix 3 (LOW) — Completed challenges show "Join" in Trending

**File:** `src/features/Home/useHomeScreen.ts`

- Added `challengeService.getUserChallengeMembershipIndex(input.uid)` to the parallel `Promise.all` fetch. This returns all challenge memberships regardless of status (active + completed).
- Replaced `joinedChallengeIds: Set<string>` with `membershipIndex: Map<string, ChallengeMember['status']>` passed to `toTrendingChallenge`.
- Updated `toTrendingChallenge` to:
  - Set `joined = memberStatus !== undefined` (any membership status counts)
  - Set `completed = memberStatus === 'completed'`
  - Map `completed → actionLabel = 'View'` (previously showed `'Join'` for completed challenges)
- `primaryActiveChallenge` from memberHome is backfilled into `membershipIndex` as `'active'` (preserves existing behaviour).

---

### Fix 4 (LOW) — workoutService scoring not normalized for multi-activity challenges

**File:** `src/services/workoutService.ts`

- Moved `computeActivityScore` call to after the membership read (was before, couldn't use `totalActivities`)
- Added `normalizedBase = Math.round(100 / totalActivities)` and passed `basePoints: normalizedBase`:
  ```ts
  const normalizedBase = Math.round(100 / totalActivities);
  const scoring = computeActivityScore({
    value: input.value,
    targetValue: input.targetValue ?? 0,
    challengeType: ...,
    basePoints: normalizedBase,
  });
  ```
- Consistent with `wellnessLogService` and `activityLogSessionService` which already used `normalizedBase`.

---

### Fix 5 (LOW) — Re-logging completed challenges accumulates points

**Files:** `src/services/wellnessLogService.ts`, `src/services/activityLogSessionService.ts`, `src/services/workoutService.ts`

Added early guard after membership read in all three log services:
```ts
if (membership.status === 'completed') {
  throw new Error('You have already completed this challenge.');
}
```

Firestore `isSafeChallengeProgressUpdate` allowed `activitiesCompleted` to stay capped while `totalPoints` incremented on re-log. This guard prevents that.

**Collateral simplification:** The downstream completion-update checks `membership.status !== 'completed'` in each service became vacuously true after the guard. Simplified to `if (nextRate >= 100)` (wellness: `if (completionRate >= 100)`). TypeScript's narrowing detected these as type-unreachable comparisons. The `activityCreatesRequireCompletedParticipantAllowed` debug field in `activityLogSessionService` was set to the literal `false` (it was `membership.status === 'completed'` — always false after the guard).

---

## Guard Tests Added

**File:** `scripts/testScoringGuards.ts` — Section 18 (P5T, 9 assertions)

| # | Assertion |
|---|-----------|
| 1 | `SelectChallengeActivityScreen` imports and calls `resolveWellnessActivityType` |
| 2 | `SelectChallengeActivityScreen` does not fall back to literal `'wellness'` |
| 3 | `joinChallenge` does not hardcode `totalActivities: 0` |
| 4 | `joinChallenge` derives `totalActivities` from `activities.length` |
| 5 | `useHomeScreen` calls `getUserChallengeMembershipIndex` |
| 6 | `useHomeScreen` checks `memberStatus === 'completed'` |
| 7 | `workoutService` computes `normalizedBase` and passes it as `basePoints` |
| 8 | `workoutService` computes `normalizedBase = Math.round(100 / totalActivities)` |
| 9 | All 3 log services contain the `membership.status === 'completed'` guard |

**Updated:** Section 14 pattern assertions updated to match new simplified completion-update pattern (`membership.status !== 'completed'` check removed — superseded by early throw).

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
✅ npm run build                            ✓ built in 3.08s
```

---

## Risk Assessment

| Fix | Risk | Rationale |
|-----|------|-----------|
| Fix 1 — activityType routing | Low | `resolveWellnessActivityType` was already used in `buildActivityLogPath`; same logic applied to multi-activity path |
| Fix 2 — totalActivities at join | Low | Field cannot be updated after join (Firestore rule); correct value must be written on create. No existing data affected — existing members keep their stored value |
| Fix 3 — Trending completed state | Low | Extra Firestore read (`getUserChallengeMembershipIndex`) added to home load; same data the progress query returns. UI change: completed challenges now show "View" instead of "Join" |
| Fix 4 — workout scoring normalization | Low | Single-activity challenges: `normalizedBase = 100` (same as old `BASE_POINTS_PER_TARGET`). Multi-activity: now correctly proportional. New scores may differ for multi-activity workout challenges |
| Fix 5 — completed re-log guard | Low | No Firestore rule change; client-side guard only. Users see a friendly error instead of silently accumulating points |
