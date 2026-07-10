# Phase 18I-6M — Wellness Activity Detail + Add to Challenge CTA

**Date:** 2026-07-03
**Branch:** fix/p0-pre-deploy-blockers

---

## Problem

The Wellness Activities Library listed activities in a static read-only list. Unlike Fitness Exercises, users could not:
1. Tap a wellness activity to view its details
2. Add a wellness activity directly to a challenge

---

## Audit: Exercise Library Pattern

The exercise flow works as:
1. `ExerciseLibraryScreen` → clicking a row navigates to `/app/exercises/:id`
2. `ExerciseDetailScreen` → "Add to Challenge" navigates to `/app/create-challenge?exerciseId=<id>`
3. `CreateChallengeWizard` → `?exerciseId` param triggers a `useEffect` that finds the exercise in the already-loaded `exercises` array and prefills the first activity row (name, id, unit)

---

## Implementation

### 1. `WellnessActivitiesLibraryScreen` — Clickable rows

Each activity card now wraps its content in a `<button>` that navigates to `/app/wellness-activities/${item.id}`. A chevron `›` is shown on the right to signal tappability.

### 2. `WellnessActivityDetailScreen` (new)

`src/features/Wellness/WellnessActivityDetailScreen.tsx`:
- Read-only. No Edit/Delete/Add admin actions.
- Uses `useWellnessActivity(id)` hook.
- Displays: cover image (or icon placeholder), name, category badge, difficulty + target chips, description, benefits (green card), guidelines (card with divider), protocol steps (numbered list), warnings/safety notes (amber card).
- Fixed bottom CTA: **"Add to Challenge"** — navigates to `/app/create-challenge?wellnessActivityId=<id>`.

### 3. `CreateChallengeWizard` — `wellnessActivityId` prefill

Added a new `useEffect` (mirroring the `exerciseId` prefill):
```ts
const wellnessActivityIdParam = params.get('wellnessActivityId') ?? undefined;
const wellnessPrefillAppliedRef = useRef(false);
useEffect(() => {
  if (!wellnessActivityIdParam || wellnessActivities.length === 0 || wellnessPrefillAppliedRef.current) return;
  const match = wellnessActivities.find((a) => a.id === wellnessActivityIdParam);
  if (!match) return;
  wellnessPrefillAppliedRef.current = true;
  setChallengeCategory(match.category);      // ← puts wizard in wellness mode
  setActivities([{
    query: match.name,
    activityId: match.id,
    activityType: match.activityType,
    description: match.description,
    category: match.category,
    difficulty: match.difficulty,
    icon: match.icon,
    protocolSteps: match.protocolSteps,
    benefits: match.benefits,
    guidelines: match.guidelines,
    warnings: match.warnings,
    targetValue: String(match.defaultTargetValue),
    unit: match.defaultMetricUnit,
    frequency: 'daily',
    dailyFrequency: match.suggestedFrequency,
  }]);
}, [wellnessActivityIdParam, wellnessActivities]);
```

`setChallengeCategory(match.category)` is the key call — it sets `isWellnessMode = true`, switching the wizard into wellness mode (no fitness exercise picker, wellness activity picker shown instead).

### 4. App.tsx routes

```
/app/wellness-activities        → WellnessActivitiesLibraryScreen  (already existed)
/app/wellness-activities/:id    → WellnessActivityDetailScreen      (new)
```

Both are `ProtectedRoute`, lazy-loaded.

---

## Files Changed

| File | Change |
|------|--------|
| `src/features/Wellness/WellnessActivitiesLibraryScreen.tsx` | Cards are now `<button>` that navigate to `/app/wellness-activities/:id` |
| `src/features/Wellness/WellnessActivityDetailScreen.tsx` | New — read-only detail screen with Add to Challenge CTA |
| `src/features/Challenges/CreateChallengeWizard.tsx` | `wellnessActivityId` URL param prefill (mirroring `exerciseId` pattern) |
| `src/App.tsx` | Register `/app/wellness-activities/:id` + lazy import |
| `scripts/testChallengesViewPolish.ts` | Expanded to 20 guards (was 15) |

---

## Guards (20 total, up from 15)

New guards in this phase:
- Library rows navigate to `/app/wellness-activities/${item.id}`
- Library has no admin actions
- `WellnessActivityDetailScreen` exists
- Detail screen renders description/guidelines/benefits
- Detail screen has no admin actions
- Detail screen has "Add to Challenge" CTA
- CTA passes `wellnessActivityId` to wizard
- Wizard handles `wellnessActivityId` param
- Wizard sets `challengeCategory` from activity category
- App.tsx registers `/app/wellness-activities/:id` route

---

## Validation

```
npx tsc --noEmit                        ✅ clean
npm run build                           ✅ built in 2.86s
npm run test:challenges-view-polish     ✅ 20/20 passed
npm run test:challenge-activity-model   ✅ 53/53 passed
npm run test:challenge-creation-6combos ✅ passed
npm run test:home-challenge-feeds       ✅ passed
npm run test:scoring-guards             ✅ passed
```

---

## Manual Test Checklist

- [ ] Wellness Activities Library → tapping any activity row opens detail screen
- [ ] Detail screen shows: name, category badge, difficulty, target value/unit
- [ ] Detail screen shows description (when available)
- [ ] Detail screen shows benefits (green card, when available)
- [ ] Detail screen shows guidelines (when available)
- [ ] Detail screen shows protocol steps (when available)
- [ ] Detail screen shows warnings/safety notes (amber card, when available)
- [ ] Detail screen shows cover image if `coverImage` URL set; otherwise shows icon placeholder
- [ ] No Edit / Delete / admin buttons visible on detail screen
- [ ] Tapping "Add to Challenge" opens the challenge wizard
- [ ] Wizard opens in wellness mode (wellness category pre-selected, not fitness)
- [ ] First activity row is pre-filled with the selected activity name, target, and unit
- [ ] Multi-activity challenge creation still works normally (not broken by this change)
