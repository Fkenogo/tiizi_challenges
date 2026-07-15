# Phase 17F-3 — Refactor Fitness Template Edit to Shared Activity Section

**Date:** 2026-06-28
**Branch:** fix/p0-pre-deploy-blockers
**Scope:** `EditChallengeTemplateScreen.tsx` — activity UI replaced with `ChallengeActivitySection`. No other files changed.

---

## Problem (BUG-2 from Phase 17F-1 audit)

`EditChallengeTemplateScreen` was the only creation/editing screen that had not been refactored to use `ChallengeActivitySection`. It retained:
- A local minimal `ActivityRow = { query, exerciseId, targetValue, unit }` type (4 fields vs the canonical 18-field export)
- An inline search `<input>` with live `onChange` autocomplete and `<datalist>` (old pre-Phase-17D pattern)
- An inline exercise picker modal duplicating the shared component's picker UI
- Unused imports: `Plus`, `Search`, `X`

---

## Changes Made

### `src/features/Admin/Challenges/EditChallengeTemplateScreen.tsx`

| What | Before | After |
|---|---|---|
| Local `ActivityRow` type | 4-field local definition | Removed — imports `ActivityRow` from `ChallengeActivitySection` |
| Activity UI | Inline `<div className="st-card p-4">` with `<datalist>` search + `<select>` unit | `<ChallengeActivitySection>` shared component |
| Exercise picker modal | Inline `{pickerIndex !== null && (...)}` modal at bottom of JSX | Handled internally by `ChallengeActivitySection` |
| `pickerTier` state | Missing | Added |
| `activityTierOptions` memo | Missing | Added (matches `CreateChallengeScreen` pattern) |
| `pickerExercises` memo | `pickerResults` — no tier filter, slice(0,60) | `pickerExercises` — tier + search filter, slice(0,60) |
| `addActivity` handler | Inline in JSX button `onClick` | Extracted as named handler |
| `removeActivity` handler | Inline in JSX button `onClick` | Extracted as named handler |
| `openFitnessPicker` / `closeFitnessPicker` / `pickFitnessExercise` | Implicit in JSX / old inline modal | Extracted as named handlers |
| Imports removed | `Plus`, `Search`, `X` from lucide-react | All three removed |
| Imports added | — | `ChallengeActivitySection`, `ActivityRow` (type), `CatalogExercise` (type) |
| `isExercisesError` | Not destructured | Added to `useExercises()` destructure |

### Unchanged

- `resolvedActivities` useMemo — still maps `activities → { exerciseId, exerciseName, targetValue, unit }` for save payload
- `buildPayload()` — unchanged
- `onSaveDraft()` / `onSaveAndPublish()` — unchanged
- All cover image, info, challenge type, difficulty/duration, engine settings, version info, and actions JSX — unchanged
- Firestore schema, services, validation rules, template lifecycle logic — unchanged

---

## Shared Component Usage Confirmation

```tsx
<ChallengeActivitySection
  isWellnessMode={false}           // fitness-only screen
  challengeType={challengeType}    // drives frequency field visibility
  activities={activities}
  onUpdateActivity={updateActivity}
  onAddActivity={addActivity}
  onRemoveActivity={removeActivity}
  exercises={exercises}
  isExercisesLoading={isExercisesLoading}
  isExercisesError={isExercisesError}
  // Wellness props — inert stubs (fitness-only screen)
  wellnessActivities={[]}
  isWellnessActivitiesLoading={false}
  isWellnessActivitiesError={false}
  // Fitness picker
  fitnessPicker={pickerIndex !== null}
  fitnessPickerIndex={pickerIndex}
  fitnessPickerSearch={pickerSearch}
  onFitnessPickerSearchChange={setPickerSearch}
  fitnessPickerExercises={pickerExercises}
  fitnessPickerTierOptions={activityTierOptions}
  fitnessPickerTier={pickerTier}
  onFitnessPickerTierChange={setPickerTier}
  onOpenFitnessPicker={openFitnessPicker}
  onCloseFitnessPicker={closeFitnessPicker}
  onPickFitnessExercise={pickFitnessExercise}
  // Wellness picker — inert stubs
  wellnessPickerOpen={false}
  wellnessPickerIndex={null}
  wellnessPickerSearch=""
  onWellnessPickerSearchChange={() => {}}
  wellnessPickerCategoryFilter="all"
  onWellnessPickerCategoryFilterChange={() => {}}
  isWellnessPickerLoading={false}
  onOpenWellnessPicker={() => {}}
  onCloseWellnessPicker={() => {}}
  onPickWellnessActivity={() => {}}
/>
```

Activity pick populates `exerciseId`, `query`, `unit` via `pickFitnessExercise`. `targetValue` remains independently editable via `onUpdateActivity`.

---

## Removed Legacy UI Summary

| Removed element | Lines (before) |
|---|---|
| `<datalist>` autocomplete search input | 297–315 |
| Inline "Target Value" / "Unit" fields per row | 316–331 |
| Inline "+ Add Another Activity" button | 334–336 |
| Inline `{pickerIndex !== null && (...)}` exercise picker modal | 359–381 |
| `pickerResults` useMemo (replaced by `pickerExercises`) | 104–108 |
| Local `ActivityRow` type (4-field) | 15–20 |
| `normalize` function | kept — still used by `resolvedActivities` |

---

## All Four Screens: Shared Activity Section Status

| Screen | Uses `ChallengeActivitySection` |
|---|---|
| `CreateChallengeWizard` | ✅ |
| `CreateChallengeScreen` (Admin) | ✅ |
| `EditChallengeTemplateScreen` (Admin fitness) | ✅ ← fixed this phase |
| `EditWellnessTemplateScreen` (Admin wellness) | ✅ |

---

## Build Output

```
npx tsc --noEmit  →  CLEAN (zero errors)
npm run build     →  ✓ built in 7.27s (pre-existing vendor chunk warning only)
```

---

## Remaining Inconsistencies

**BUG-3 (Low — unchanged):** `CreateChallengeWizard` and `CreateChallengeScreen` still define local `ActivityRow` types rather than importing the exported canonical type from `ChallengeActivitySection`. TypeScript catches mismatches at the props boundary so this is not a runtime issue. Addressed in a future cleanup phase.

No other inconsistencies remain in the activity section across all four screens.
