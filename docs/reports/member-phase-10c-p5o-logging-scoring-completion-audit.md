# Phase 10C-P5O — Challenge Logging, Scoring & Completion Integrity Audit

Date: 2026-06-19  
Branch: fix/p0-pre-deploy-blockers  
Status: AUDIT COMPLETE — implementation in progress

---

## Issue 1 — Wellness Challenge Permission Failure ("Missing or insufficient permissions")

### Root Cause

The Firestore `allow create: if isValidWellnessCreate()` rule for `/wellnessLogs/{logId}` calls `isValidActivityContext(data)`, which does three `get()` calls:

```
let challenge     = get(/databases/…/challenges/$(data.challengeId));
let groupMember   = get(/databases/…/groupMembers/$(data.groupId + '_' + request.auth.uid));
let challengeMember = get(/databases/…/challengeMembers/$(data.challengeId + '_' + request.auth.uid));
```

The rule then requires:

```
&& groupMember.data.userId == request.auth.uid
&& (groupMember.data.status == 'active' || groupMember.data.status == 'joined')
```

If the `groupMembers/{groupId}_{uid}` document (a) does not exist, (b) lacks a `userId` field, or (c) has a `status` other than 'active'/'joined' (e.g., 'pending', 'invited'), the rule returns false and the `wellnessLogs` batch write fails with `permission-denied`. Because all three writes (wellnessLogs + challengeMembers + users) are in a single `writeBatch`, a failure on any one write rolls back the entire batch.

The `workoutService.logWorkout` writes to `activityLogs`, whose rule is `isValidWorkoutCreate()`, which also calls `isValidActivityContext()`. If workouts succeed but wellness logging fails, the distinction is likely that workout-path users navigate from a context where `groupId` is always correctly in scope, while wellness-path users may land on `LogWellnessActivityScreen` with a `groupId` derived differently (see activityType routing below).

### Secondary Factor — activityType Routing

In `challengeActivityFlow.ts: buildActivityLogPath` (line 55), if `optional.activityType` is absent and `activity.activityType` is not set, `challenge.category` is used. If `challenge.category = 'wellness'` (a valid category), then `activityType = 'wellness'` is placed in the URL. In `useLogWellnessActivity`, `normalizedWellnessType('wellness')` falls through to 'meditation', so:

- "Get 8 Hours of Sleep" challenge (category='wellness', no activity.activityType) → logs with `logType: 'meditation'`
- "8-Hour Sleep Streak" (same situation) → logs with `logType: 'meditation'`

This is a data accuracy bug (wrong logType stored) but does NOT cause a permission error because 'meditation' is in the allowed list. The permission failure is separate from the logType routing issue.

### Definitive Diagnosis Requires

Because `wellnessLogService.writeLog` has no per-write debug mode (unlike `activityLogSessionService`, which has `dryRun` support), the exact failing write cannot be confirmed from static analysis. Adding a debug mode that fires individual writes and catches each separately would pinpoint which of the three writes triggers the denial.

### Fix Plan

1. Add individual-write debug path to `wellnessLogService.writeLog` (commit writes one at a time in a try-catch when `debug: true` is passed) — not a production change; used for diagnosis only.
2. Fix `buildActivityLogPath` to always set `activityType` from `activity.activityType` when available, falling back to category-specific values rather than the generic 'wellness'.
3. If diagnosis confirms groupMember status is the blocker, update `isValidActivityContext` to allow 'member' or any status the group join flow writes.

**Files to change for activityType routing fix:**
- `src/services/challengeActivityFlow.ts` — improve fallback logic for `activityType` derivation

---

## Issue 2 — Scoring Wrong: Competitive Challenge Returns Raw Value as Points

### Root Cause

`scoreCompetitiveActivity` in `src/services/scoringConfig.ts` (line 147):

```ts
pointsEarned: Math.max(0, Math.round(cappedValue)),
```

`cappedValue = Math.min(value, targetValue * 3)`. This uses the **raw activity value** as points — not a normalized percentage. A competitive challenge where the target is 50 reps logs:

- 100 reps → cappedValue = min(100, 150) = 100 → **100 points**
- 105 seconds → cappedValue = min(105, 150) = 105 → **105 points**
- Total: **205 points** (reported by user)

Every other scorer (`scoreCumulativeActivity`, `scoreWellnessActivity`, `scoreStreakActivity`) uses `basePoints` to normalize. `scoreCompetitiveActivity` ignores `basePoints` entirely.

### Expected Behavior (Product Decision)

Max 100 points per challenge total, distributed proportionally:
- Per activity: `pointsEarned = (cappedValue / cap) × basePoints` where `cap = targetValue × 3`
- A 2-activity challenge: `basePoints = 50` per activity; max = 100

### Fix

Fix `scoreCompetitiveActivity` to accept `basePoints` and normalize:

```ts
export function scoreCompetitiveActivity(
  value: number,
  targetValue: number,
  basePoints: number = SCORING_CONSTANTS.BASE_POINTS_PER_TARGET,
): ScoringResult {
  const cap = targetValue > 0
    ? targetValue * SCORING_CONSTANTS.COMPETITIVE_VALUE_CAP_RATIO
    : SCORING_CONSTANTS.BASE_POINTS_PER_TARGET * SCORING_CONSTANTS.COMPETITIVE_VALUE_CAP_RATIO;
  const cappedValue = Math.min(value, cap);
  const capped = value > cap;
  const metTarget = targetValue > 0 ? value >= targetValue : value > 0;
  const ratio = cap > 0 ? cappedValue / cap : 0;
  const pointsEarned = Math.max(0, Math.round(ratio * basePoints));
  ...
}
```

Update `computeActivityScore` to pass `basePoints` to `scoreCompetitiveActivity`.

**Files to change:**
- `src/services/scoringConfig.ts` — fix `scoreCompetitiveActivity` and update `computeActivityScore` call

---

## Issue 3 — Scoring Normalization: Max 100 Points Per Challenge

### Root Cause

`SCORING_CONSTANTS.BASE_POINTS_PER_TARGET = 10` caps each activity at ~15 points (10 × 1.5 overperformance cap), resulting in ~30 total points for a 2-activity challenge. No code normalizes across activities to a per-challenge maximum.

The Firestore rule `isSafeChallengeProgressUpdate` caps `totalPoints` at `existingChallengePoints() + activityCount * 1000`, which is very permissive and will not reject inflated points.

### Product Decision

Points per activity = `Math.round(100 / numActivities)`, distributed proportionally. For a 1-activity challenge: 100 points max. For a 5-activity challenge: 20 points per activity, 100 total max.

### Fix Plan

Pass `basePoints = Math.round(100 / totalActivities)` from `wellnessLogService.writeLog` and from `activityLogSessionService.logSession` to `computeActivityScore`. This requires:
1. `wellnessLogService.writeLog` to use `Math.round(100 / totalActivities)` as `basePoints` instead of `input.points ?? BASE_POINTS_PER_TARGET`
2. `activityLogSessionService.logSession` (not examined this session) to similarly pass `100 / entries.length` per activity

Also update `SCORING_CONSTANTS.BASE_POINTS_PER_TARGET` from 10 to 100 so the per-activity default is correct for single-activity challenges.

**Files to change:**
- `src/services/scoringConfig.ts` — `BASE_POINTS_PER_TARGET: 100`
- `src/services/wellnessLogService.ts` — pass correct `basePoints` to `computeActivityScore`

---

## Issue 4 — Completion History Shows 100%: Two Separate Bugs

### Bug 4A — WorkoutLoggedScreen Always Shows 100%

**Root cause** in `src/features/Workouts/SelectChallengeActivityScreen.tsx` (lines 238–242):

```ts
navigate(buildActivitySuccessPath({
  ...
  value: result.entries.reduce((sum, entry) => sum + entry.value, 0),
  targetValue: result.entries.reduce((sum, entry) => sum + entry.value, 0),  // BUG
  ...
}));
```

`targetValue` is set to the same sum as `value` (sum of what the user logged). `WorkoutLoggedScreen` computes:
```ts
const completion = Math.round((progressValue / Math.max(target, 1)) * 100);
```
→ `value / value = 100%` always, regardless of how much the user did relative to their goal.

**Fix:** Replace `targetValue` with the sum of configured target values from the challenge activities, so completion reflects actual progress against goal. For mixed-unit activities (reps + seconds), pass the fraction of activities where the target was met instead of a raw sum.

### Bug 4B — ChallengeCompletedScreen Uses Custom Formula Ignoring Scoring Engine

**Root cause** in `src/features/Challenges/ChallengeCompletedScreen.tsx`:

```ts
const points = Math.max(0, Math.round(totalValue * 0.4 + uniqueDays * 8));
```

This custom formula completely ignores `membership.totalPoints` from Firestore. It also uses `useChallengeWorkouts` which only loads fitness workouts — wellness-only challenges will have 0 workouts → 0 points displayed.

Additionally:
```ts
const completionPct = Math.max(0, Math.min(100, Math.round((uniqueDays / Math.max(totalDays, 1)) * 100)));
```
This measures "days with a workout / challenge total days", not actual activity completion rate. A user who completed all activities in 3 out of 30 days shows the same as one who completed only 3 activities.

**Fix:** Replace the custom `points` formula with `membership.totalPoints` from `useChallengeMembership`. Replace `completionPct` with `membership.completionRate`. Use `membership.activitiesCompleted` and `membership.totalActivities` for the display.

**Files to change:**
- `src/features/Workouts/SelectChallengeActivityScreen.tsx` — fix targetValue in navigate call
- `src/features/Challenges/ChallengeCompletedScreen.tsx` — use membership data instead of custom formulas

---

## Issue 5 — Profile "Wins" UX Inconsistency

### Root Cause

In `src/features/Profile/ProfileScreen.tsx`, the "Wins" stat card is a `<button>` that navigates to `/app/challenges/history`. However it is styled identically to the "Groups" and "Streak" stat cards, which are non-interactive `<article>` elements. There is no visual affordance (no chevron, no underline, no distinct border color, no hover state) indicating the card is clickable.

```tsx
<button className="rounded-[20px] border border-slate-200 bg-white py-5 flex flex-col justify-center items-center"
  onClick={() => navigate('/app/challenges/history')}>
  <p ...>{wins}</p>
  <p ...>Wins</p>
</button>
// vs. non-interactive:
<article className="rounded-[20px] border border-slate-200 bg-white py-5 flex flex-col justify-center items-center">
```

### Fix

Add a visual affordance to distinguish the "Wins" button from non-clickable cards. Options:
1. Add a right-pointing chevron icon (`›` or `ChevronRight`) inside the card
2. Change the label to "Completed ›" or "View History"
3. Add a distinct border color or bottom-border underline on hover

Chosen fix: add a small `ChevronRight` icon below the "Wins" label and a hover state (`hover:border-primary`).

**Files to change:**
- `src/features/Profile/ProfileScreen.tsx`

---

## Implementation Plan (Priority Order)

| Priority | Issue | Fix | Risk |
|----------|-------|-----|------|
| P0 | 2 | Fix `scoreCompetitiveActivity` to normalize (not raw value) | Medium — changes scoring engine output; existing stored points not retroactively corrected |
| P0 | 3 | `BASE_POINTS_PER_TARGET` 10→100; pass `basePoints` per activity | Medium — all challenge types affected |
| P0 | 4A | Fix `SelectChallengeActivityScreen.targetValue` bug | Low — UI-only display fix |
| P0 | 4B | Fix `ChallengeCompletedScreen` to use membership data | Low — replaces incorrect display with correct source of truth |
| P1 | 5 | Profile Wins UX affordance | Low |
| P2 | 1 | Add debug mode; fix activityType routing | Medium — needs production diagnosis first |

---

## Guard Tests to Add (`scripts/testScoringCompletionGuards.ts`)

| # | What it checks |
|---|----------------|
| 1 | `scoreCompetitiveActivity` receives a `basePoints` parameter and does NOT use `cappedValue` directly as `pointsEarned` |
| 2 | `SCORING_CONSTANTS.BASE_POINTS_PER_TARGET` >= 100 |
| 3 | `SelectChallengeActivityScreen` navigate call `targetValue` is NOT identical to `value` computation |
| 4 | `ChallengeCompletedScreen` does NOT contain the custom formula `totalValue * 0.4` |
| 5 | `ChallengeCompletedScreen` contains `membership.totalPoints` or `membership?.totalPoints` |
| 6 | `ProfileScreen` Wins card contains `ChevronRight` or `chevron` or `›` |
| 7 | `wellnessLogService.writeLog` passes a computed `basePoints` to `computeActivityScore` |
