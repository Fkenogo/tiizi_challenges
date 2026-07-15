# Phase 10C-P5R — Remove Legacy Points UI and Vestigial Entry Hints

**Date:** 2026-06-19  
**Branch:** fix/p0-pre-deploy-blockers  
**Status:** Complete — all validation green

---

## Summary

Removed `pointsPerCompletion` and `defaultPoints` from all creation UIs, challenge payloads, and the session entry hint field. The scoring engine has used `normalizedBase = Math.round(100 / totalActivities)` since P5O/P5P and never read these fields at runtime; this phase removes the misleading admin-facing inputs that implied otherwise.

---

## Changes Made

### 1. `src/features/Challenges/CreateChallengeWizard.tsx`
- Removed `pointsPerCompletion?: number` from local `ActivityRow` state type
- Removed `pointsPerCompletion: activity.pointsPerCompletion` from wellness-template-applied mapping (line ~232)
- Removed `pointsPerCompletion: activity.defaultPoints` from wellness-activity-picker selection handler (line ~347)
- Removed `pointsPerCompletion: activity.pointsPerCompletion` from challenge submission payload (line ~507)
- Removed the "Points" `<div>` block containing the `<input type="number">` from the activity form rows (lines ~928–937)

### 2. `src/features/Admin/Challenges/CreateChallengeScreen.tsx`
- Removed `pointsPerCompletion?: number` from local `ActivityFormRow` type
- Removed `pointsPerCompletion?: number` from local `ResolvedActivity` type
- Removed `pointsPerCompletion: item.pointsPerCompletion ?? 10` from edit-mode initialization (line ~145)
- Removed `pointsPerCompletion: activity.defaultPoints` from wellness picker selection handler (line ~231)
- Removed `pointsPerCompletion: activity.pointsPerCompletion` from template-apply payload (line ~335)
- Removed `pointsPerCompletion: matched?.defaultPoints ?? activity.pointsPerCompletion ?? 10` from exercise-match handler (line ~537)
- Removed the "Points" `<div>` block from the activity configuration form (lines ~625–634)

### 3. `src/features/Admin/Wellness/WellnessActivityForm.tsx`
- Removed `<input type="number">` for `defaultPoints` from the 3-column grid
- Changed grid from `md:grid-cols-3` → `md:grid-cols-2` (Popular and Medical Supervision checkboxes remain)

### 4. `src/features/Admin/Wellness/wellnessActivityFormUtils.ts`
- Removed `defaultPoints: 10` from `defaultWellnessActivityInput`

### 5. `src/features/Workouts/SelectChallengeActivityScreen.tsx`
- Removed `pointsPerCompletion?: number` from local `ActivityRow` type
- Removed `const basePoints = Number(optional.pointsPerCompletion ?? 10)` 
- Removed `points: basePoints` from wellness `ActivitySessionEntry` construction
- Removed `points: basePoints` from workout `ActivitySessionEntry` construction
- `targetValue` and all activity identity fields (activityId, activityType, exerciseId, etc.) preserved

### 6. `src/services/scoringConfig.ts`
- Updated `basePoints` JSDoc comment: was `// from activity.pointsPerCompletion; defaults to BASE_POINTS_PER_TARGET`, now `// normalized: Math.round(100 / totalActivities); defaults to BASE_POINTS_PER_TARGET`

### 7. `src/types/wellnessActivity.ts`
- Changed `defaultPoints: number` → `defaultPoints?: number` for backwards compatibility with existing Firestore documents that may not have this field

### 8. `scripts/testScoringGuards.ts` — Section 17 (P5R guards, 7 assertions)
- `CreateChallengeWizard` must not render an editable Points input tied to `pointsPerCompletion`
- `CreateChallengeWizard` must not write `pointsPerCompletion` into the challenge payload
- Admin `CreateChallengeScreen` must not render an editable Points input
- Admin `CreateChallengeScreen` must not write `pointsPerCompletion` from activity or matched fields
- `SelectChallengeActivityScreen` must not read `optional.pointsPerCompletion`
- `SelectChallengeActivityScreen` must not set `entry.points` from `basePoints`
- `SelectChallengeActivityScreen` must not derive `basePoints` from `pointsPerCompletion`
- `scoringConfig` `basePoints` comment must not reference `pointsPerCompletion`

---

## What Was Preserved

| Item | Kept | Reason |
|------|------|--------|
| `pointsPerCompletion?: number` in `src/types/index.ts` | ✅ | Backwards compat — existing Firestore challenge docs may have the field |
| `defaultPoints?: number` in `src/types/wellnessActivity.ts` | ✅ (now optional) | `wellnessActivityService` reads it from Firestore with `?? 10` fallback |
| `defaultPoints` in `wellnessActivityService.ts` Firestore mapping | ✅ | Reads existing data; `Number(raw.defaultPoints ?? 10)` is safe |
| `pointsPerCompletion` pass-through in `challengeCreationBackend` | ✅ | Validates and stores if present in payload; harmless if absent |
| `totalPoints` everywhere | ✅ | Authoritative Firestore field; actively used |
| All scoring formulas | ✅ | No scoring logic changed |
| `entry.points?: number` field on `ActivitySessionEntry` type | ✅ | Type kept as optional hint; already ignored by scoring engine since P5P |

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
✅ npm run build                            ✓ built in 3.14s
```

---

## Remaining Legacy Points Items (not addressed in this phase)

| Item | Risk | Recommendation |
|------|------|----------------|
| `pointsPerCompletion` stored in existing Firestore challenge docs | None — never read by scoring engine | Leave in place; remove in a future data migration if desired |
| `entry.points?: number` field on `ActivitySessionEntry` type | None — ignored since P5P | Can remove in a future cleanup; kept for API surface compatibility |
| `bonusConditions` on `WellnessActivity` | None — never evaluated | Dead code; safe to remove in a separate cleanup |
| `STREAK_BONUS_PER_WEEK` in `scoringConfig` | None — `currentStreak` never passed to scorer | Dead code; safe to remove in a separate cleanup |
| `wellnessTemplateService.ts` writes `pointsPerCompletion: Number(item.pointsPerCompletion ?? 10)` | None — field is inert | Can be cleaned up alongside template admin forms |
