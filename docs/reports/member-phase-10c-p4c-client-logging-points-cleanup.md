# Phase 10C-P4C — Client Logging Points Cleanup

Date: 2026-06-17  
Branch: fix/p0-pre-deploy-blockers  
Status: COMPLETE — hardcoded points:10 removed, scoring engine wired in, no production writes

---

## Summary

This phase removes all hardcoded `points: 10` from client logging screens and routes point calculation through the `computeActivityScore()` engine created in P4B. The service now derives points from challenge type, target value, and logged value — not from a client-declared constant. Scoring metadata (`metTarget`, `scoringMethod`, `scoringVersion: 'v2'`) is stored on every new workout and wellnessLog document. Firestore rules are updated to allow the new fields.

---

## What Changed

### `src/services/activityLogSessionService.ts`

**Import:** Added `computeActivityScore, type ChallengeType` from `./scoringConfig`.

**`ActivitySessionEntry` type:** Added optional `targetValue?: number` to both `workout` and `wellness` variants. The existing `points?: number` field is now documented as a `basePoints` hint — passed to the engine as `basePoints`, never used directly as the final score.

**Challenge cast:** Extended to include `challengeType?: string`.

**Per-entry scoring (replaces line 237):**
```ts
const scoring = computeActivityScore({
  value: entry.value,
  targetValue: entry.targetValue ?? 0,
  challengeType: (challenge.challengeType as ChallengeType) ?? 'collective',
  activityType: entry.source === 'wellness' ? entry.activityType : undefined,
  basePoints: entry.points,
});
const points = Math.max(1, Math.min(ACTIVITY_WRITE_LIMITS.maxWellnessPoints, scoring.pointsEarned));
```

The `Math.max(1, ...)` floor preserves the existing Firestore rule requirement that wellness `points > 0`. The `Math.min(ACTIVITY_WRITE_LIMITS.maxWellnessPoints, ...)` cap is retained as a safety ceiling.

**Workout document writes:** Now include `points`, `metTarget`, `scoringMethod`, `scoringVersion: 'v2'`.

**WellnessLog document writes:** Now include `metTarget`, `scoringMethod`, `scoringVersion: 'v2'` alongside the existing `points` field.

---

### `src/features/Workouts/LogWorkoutScreen.tsx`

Imported `computeActivityScore, type ChallengeType` from `../../services/scoringConfig`.

In `handleSave()`, before navigating to the success screen:
```ts
const scoring = computeActivityScore({
  value,
  targetValue,
  challengeType: (challenge?.challengeType as ChallengeType) ?? 'collective',
});
```

Replaced `points: 10` in `buildActivitySuccessPath` with `points: scoring.pointsEarned`.

This is a display-only change (success screen UI). The workout document write goes through `useLogWorkout` → `workoutService.createWorkout`, which is a separate path not using `activityLogSessionService`. The success screen now reflects a score consistent with the engine.

---

### `src/features/Workouts/LogWellnessActivityScreen.tsx`

Same pattern as `LogWorkoutScreen`. Imported scoring engine. Added before navigation:
```ts
const scoring = computeActivityScore({
  value,
  targetValue,
  challengeType: (challenge?.challengeType as ChallengeType) ?? 'collective',
  activityType,
});
```

Replaced `points: 10` with `points: scoring.pointsEarned`.

---

### `src/features/Workouts/SelectChallengeActivityScreen.tsx`

Renamed `points` to `basePoints` locally and added `targetValue` to each session entry:
```ts
const basePoints = Number(optional.pointsPerCompletion ?? 10);
const entryTargetValue = Number(activity.targetValue ?? 0);
// ...
entries.push({ ..., points: basePoints, targetValue: entryTargetValue });
```

`pointsPerCompletion` from the activity config flows into the service as the `basePoints` hint. The service's `computeActivityScore` determines the actual points awarded.

---

### `firestore.rules`

**`workoutClientCreateFields()`** — added: `'points'`, `'metTarget'`, `'scoringMethod'`, `'scoringVersion'`

**`isValidWorkoutCreate()`** — added optional type validation for each new field:
- `points`: number, 0–10000 (range covers cumulative and competitive scoring)
- `metTarget`: bool
- `scoringMethod`: string
- `scoringVersion`: string

**`wellnessClientCreateFields()`** — added: `'metTarget'`, `'scoringMethod'`, `'scoringVersion'` (`'points'` was already present)

**`isValidWellnessCreate()`** — added optional type validation for `metTarget`, `scoringMethod`, `scoringVersion`. Existing `points > 0 && points <= 1000` constraint retained.

---

### `scripts/testScoringGuards.ts`

Added 6 new assertions (section 9 — P4C guards):

1. `LogWorkoutScreen` does NOT match `/points:\s*10[,\s]/`
2. `LogWorkoutScreen` imports and calls `computeActivityScore`
3. `LogWellnessActivityScreen` does NOT match `/points:\s*10[,\s]/`
4. `LogWellnessActivityScreen` imports and calls `computeActivityScore`
5. `activityLogSessionService` imports from `./scoringConfig`
6. `activityLogSessionService` does NOT contain `entry.points ?? 10`
7. `activityLogSessionService` calls `computeActivityScore`
8. `activityLogSessionService` contains `scoringVersion: 'v2'`

---

## Trust Boundary

| Layer | Points source | Status |
|-------|--------------|--------|
| `LogWorkoutScreen` success display | `computeActivityScore(value, targetValue, challengeType)` | ✅ engine |
| `LogWellnessActivityScreen` success display | `computeActivityScore(value, targetValue, challengeType, activityType)` | ✅ engine |
| `activityLogSessionService` Firestore writes | `computeActivityScore(entry)` — `entry.points` is basePoints hint only | ✅ engine |
| `challengeLeaderboards.score` (Cloud Function) | Raw value / wellness points field (unchanged) | unchanged — P4E |

`clientProvidedPoints` is still declared on `ScoringInput` and intentionally not used. The `entry.points` field in `ActivitySessionEntry` now carries the `pointsPerCompletion` config value as a `basePoints` hint, not a trusted final score.

---

## What Is Not Changed

| System | Status | Next phase |
|--------|--------|-----------|
| `workoutService.createWorkout` — no points field written | Unchanged | P4D |
| `wellnessLogService.log*` — separate path, not through session service | Unchanged | P4D |
| `functions/src/memberActivitySummaries.ts` — raw value scoring | Unchanged | P4E |
| `challengeLeaderboards.score` | Unchanged | P4E |
| Leaderboard backfill | Not started | P4H |

---

## Validation Results

```
npm run test:scoring-guards         → scoring guards passed   (48 assertions, 6 new P4C guards)
npm run test:home-challenge-feeds   → home challenge feed guards passed
npm run test:home-performance-guards → home performance guards passed
npm run test:pilot-ux-polish-guards → pilot UX polish guards passed
npx tsc -b --pretty false           → (no errors)
npm run build                       → ✓ built in 4.04s
```

---

## Files Changed

| File | Type | Description |
|------|------|-------------|
| `src/services/activityLogSessionService.ts` | Modified | Import scoring engine; derive points from engine; store metTarget/scoringMethod/scoringVersion/'v2' on docs |
| `src/features/Workouts/LogWorkoutScreen.tsx` | Modified | Replace `points: 10` with `computeActivityScore()` result |
| `src/features/Workouts/LogWellnessActivityScreen.tsx` | Modified | Replace `points: 10` with `computeActivityScore()` result |
| `src/features/Workouts/SelectChallengeActivityScreen.tsx` | Modified | Pass `targetValue` per entry; document `points` as basePoints hint |
| `firestore.rules` | Modified | Allow `points`, `metTarget`, `scoringMethod`, `scoringVersion` on workouts; allow `metTarget`, `scoringMethod`, `scoringVersion` on wellnessLogs |
| `scripts/testScoringGuards.ts` | Modified | 6 new P4C structural guards |

---

## Deployment Notes

- No Cloud Function changes.
- Firestore rules change is backwards-compatible: new fields are optional in `hasOnly()` — existing documents without them still pass all validation.
- `scoringVersion: 'v2'` on new documents distinguishes engine-scored logs from pre-P4C logs (which have no version field on workouts, or implicitly `'v1'`).
- Do not deploy until P4D–P4E wire the remaining scoring paths (workoutService, wellnessLogService, Cloud Functions).
