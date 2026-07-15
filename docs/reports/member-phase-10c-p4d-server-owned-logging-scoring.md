# Phase 10C-P4D — Server-Side Logging Scoring Enforcement

Date: 2026-06-17  
Branch: fix/p0-pre-deploy-blockers  
Status: COMPLETE — scoring engine wired into all direct logging paths, 0-point floor removed, full metadata on all log documents

---

## Summary

This phase completes scoring engine coverage across all member activity logging paths. P4C wired `activityLogSessionService` (the multi-activity batch path) but left `workoutService` and `wellnessLogService` (the direct single-activity paths from `LogWorkoutScreen` and `LogWellnessActivityScreen`) untouched and still hardcoded. This phase corrects that. It also removes the `Math.max(1, scoring.pointsEarned)` floor that was incorrectly preventing the engine's anti-gaming 0-point floor from taking effect.

---

## What Changed

### `src/services/activityWriteGuards.ts`

Added `maxWorkoutPoints: 10000` constant, matching the Firestore rule cap established in P4C. Used by `workoutService` to clamp computed points.

---

### `src/types/index.ts` — `Workout` interface

Added optional scoring metadata fields so `workoutService.createWorkout` can write them without TypeScript errors:
- `points?: number`
- `rawValue?: number`
- `targetValue?: number`
- `metTarget?: boolean`
- `scoringMethod?: string`
- `capped?: boolean`
- `scoringVersion?: string`

---

### `src/services/workoutService.ts`

**Before:** `totalPoints: increment(10)` — hardcoded, never computed from challenge data.  
**After:** scoring engine called immediately after date validation:

```ts
const scoring = computeActivityScore({
  value: input.value,
  targetValue: input.targetValue ?? 0,
  challengeType: (challengeData.challengeType as ChallengeType) ?? 'collective',
});
const points = Math.min(ACTIVITY_WRITE_LIMITS.maxWorkoutPoints, Math.max(0, scoring.pointsEarned));
```

- `CreateWorkoutInput` extended with `targetValue?: number`
- Challenge cast extended with `challengeType?: string`
- Workout document now includes: `points`, `rawValue`, `targetValue`, `metTarget`, `scoringMethod`, `capped`, `scoringVersion: 'v2'`
- `totalPoints: increment(points)` — driven by engine result, not hardcoded

---

### `src/services/wellnessLogService.ts`

**Before:** `const points = Number(input.points ?? 10)` — hardcoded fallback; separate `assertSafeActivityValue(points, ...)` that would throw on 0.

**After:**

```ts
const scoring = computeActivityScore({
  value: input.value,
  targetValue: input.targetValue ?? 0,
  challengeType: (challenge.challengeType as ChallengeType) ?? 'collective',
  activityType: logType,
  basePoints: input.points,
});
const points = Math.min(ACTIVITY_WRITE_LIMITS.maxWellnessPoints, Math.max(0, scoring.pointsEarned));
```

- `logType` (already `'fasting' | 'hydration' | 'sleep' | 'meditation'`) passed as `activityType` — routes to binary or proportional automatically
- `input.points` (from `pointsPerCompletion`) used as `basePoints` hint only
- `assertSafeActivityValue(points, ...)` on the points value removed — replaced by engine-computed clamped value
- WellnessLog document now includes: `rawValue`, `targetValue`, `metTarget`, `scoringMethod`, `capped`, `scoringVersion: 'v2'` (alongside existing `points`)
- `BaseWellnessLogInput` extended with `targetValue?: number`
- Challenge cast extended with `challengeType?: string`

---

### `src/services/activityLogSessionService.ts`

Removed `Math.max(1, ...)` floor that was blocking the engine's 0-point anti-gaming behavior:

```ts
// Before (P4C)
const points = Math.max(1, Math.min(ACTIVITY_WRITE_LIMITS.maxWellnessPoints, scoring.pointsEarned));

// After (P4D)
const points = Math.min(ACTIVITY_WRITE_LIMITS.maxWellnessPoints, Math.max(0, scoring.pointsEarned));
```

Added `rawValue`, `targetValue`, `capped` to both workout and wellness write payloads (these were missing in P4C — only `metTarget`, `scoringMethod`, `scoringVersion` were stored).

---

### `src/hooks/useWorkouts.ts`

`WellnessLogMutationInput` extended with `targetValue?: number`, threaded through to all `wellnessLogService.log*` dispatch branches.

---

### `src/features/Workouts/LogWorkoutScreen.tsx`

Passes `targetValue` to `logWorkout.mutateAsync` so `workoutService.createWorkout` can score against the activity target:

```ts
await logWorkout.mutateAsync({ ..., targetValue });
```

---

### `src/features/Workouts/LogWellnessActivityScreen.tsx`

Passes `targetValue` to `logWellness.mutateAsync` so `wellnessLogService.writeLog` can score against the activity target:

```ts
await logWellness.mutateAsync({ ..., targetValue });
```

---

### `firestore.rules`

**Both `workoutClientCreateFields()` and `wellnessClientCreateFields()`** extended with `'rawValue'`, `'targetValue'`, `'capped'` (completing the full scoring metadata field set).

**`isValidWorkoutCreate()`** — added optional type validation for `rawValue` (`number >= 0`), `targetValue` (`number >= 0`), `capped` (`bool`).

**`isValidWellnessCreate()`:**
- Added optional type validation for `rawValue`, `targetValue`, `capped`
- **Key change:** `points > 0` relaxed to allow 0 for v2 documents:

```
&& (
  (request.resource.data.keys().hasAny(['scoringVersion']) && request.resource.data.scoringVersion == 'v2')
    ? request.resource.data.points >= 0
    : request.resource.data.points > 0
)
```

Pre-P4D wellness logs (no `scoringVersion`) still require `points > 0`. New v2 logs may have `points = 0` (below-minimum-effort anti-gaming floor).

---

### `scripts/testScoringGuards.ts`

Added 10 new assertions (section 10 — P4D guards):

1. `workoutService` calls `computeActivityScore`
2. `workoutService` does NOT contain `increment(10)`
3. `workoutService` stamps `scoringVersion: 'v2'`
4. `wellnessLogService` calls `computeActivityScore`
5. `wellnessLogService` does NOT use `input.points ?? 10`
6. `wellnessLogService` stamps `scoringVersion: 'v2'`
7. `activityLogSessionService` does NOT use `Math.max(1, Math.min|scoring)` pattern
8. `activityLogSessionService` uses `Math.max(0, ...)` for 0-point floor
9. `firestore.rules` contains `scoringVersion == 'v2'` condition
10. `firestore.rules` contains `points >= 0` condition

---

## Scoring Coverage — All Paths

| Logging path | Points source | Full metadata | Status |
|-------------|--------------|--------------|--------|
| `LogWorkoutScreen` → `workoutService.createWorkout` | `computeActivityScore(value, targetValue, challengeType)` | ✅ | ✅ wired |
| `LogWellnessActivityScreen` → `wellnessLogService.writeLog` | `computeActivityScore(value, targetValue, challengeType, logType)` | ✅ | ✅ wired |
| `SelectChallengeActivityScreen` → `activityLogSessionService` | `computeActivityScore(entry)` | ✅ | ✅ wired (P4C+P4D) |
| `challengeLeaderboards.score` (Cloud Function) | Raw value / wellness points (unchanged) | — | P4E |

---

## What Is Not Changed

| System | Status | Next phase |
|--------|--------|-----------|
| `functions/src/memberActivitySummaries.ts` | Unchanged | P4E |
| `challengeLeaderboards.score` | Unchanged | P4E |
| Leaderboard backfill | Not started | P4H |
| `workoutService` premature-completion guard (`!endAt`) | Out of scope — P3C fix was scoped to `activityLogSessionService` | separate |

---

## Validation Results

```
npm run test:scoring-guards          → scoring guards passed   (58 assertions, 10 new P4D guards)
npm run test:home-challenge-feeds    → home challenge feed guards passed
npm run test:home-performance-guards → home performance guards passed
npm run test:pilot-ux-polish-guards  → pilot UX polish guards passed
npx tsc -b --pretty false            → (no errors)
npm run build                        → ✓ built in 3.53s
firebase deploy --only firestore:rules --dry-run --project tiizi-challenges
                                     → rules compiled successfully ✓
```

---

## Files Changed

| File | Type | Description |
|------|------|-------------|
| `src/services/activityWriteGuards.ts` | Modified | Added `maxWorkoutPoints: 10000` |
| `src/types/index.ts` | Modified | Added scoring metadata fields to `Workout` interface |
| `src/services/workoutService.ts` | Modified | Wire scoring engine; store full metadata; use computed points for `totalPoints` increment |
| `src/services/wellnessLogService.ts` | Modified | Wire scoring engine; remove hardcoded 10 fallback; store full metadata |
| `src/services/activityLogSessionService.ts` | Modified | Remove `Math.max(1,...)` floor; add `rawValue`, `targetValue`, `capped` to payloads |
| `src/hooks/useWorkouts.ts` | Modified | Add `targetValue?` to `WellnessLogMutationInput` |
| `src/features/Workouts/LogWorkoutScreen.tsx` | Modified | Pass `targetValue` to service mutation |
| `src/features/Workouts/LogWellnessActivityScreen.tsx` | Modified | Pass `targetValue` to service mutation |
| `firestore.rules` | Modified | Add `rawValue`, `targetValue`, `capped` to allowed fields; allow `points >= 0` for v2 wellness docs |
| `scripts/testScoringGuards.ts` | Modified | 10 new P4D guards (58 total) |

---

## Deployment Notes

- Firestore rules change is backwards-compatible: `points > 0` still enforced for pre-v2 wellness logs; v2 relaxes to `>= 0`.
- No Cloud Function changes.
- No data migration needed — old documents without scoring metadata are unaffected.
- Do not deploy until P4E wires the Cloud Function leaderboard path.
