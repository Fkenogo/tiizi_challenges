# Phase 18I-5C — Navigation Links: Challenges, Groups, and Exercise Library

**Date:** 2026-07-01
**Branch:** fix/p0-pre-deploy-blockers

---

## 1. Goal

Add navigation links so users can move fluidly between:
- Challenge Detail → Group Detail (clickable group name)
- Select Activity / Log Workout → Exercise Detail ("View exercise guide")
- Exercise Detail → Challenge Creation ("Add to Challenge")
- CreateChallengeWizard can be pre-populated with an exercise via `?exerciseId=<id>`

No scoring logic, Firestore data models, or logging writes were changed.

---

## 2. Files Changed

| File | Change |
|------|--------|
| `src/features/Challenges/ChallengeDetailScreen.tsx` | Group link: replaced dot + plain text with `<button>` + `Users` icon; navigates to `/app/group/:groupId` |
| `src/features/Workouts/SelectChallengeActivityScreen.tsx` | Activity cards: added "View exercise guide" button when `match?.id` exists; links to `/app/exercises/:id?challengeId=&groupId=` |
| `src/features/Workouts/LogWorkoutScreen.tsx` | Added "View exercise guide" link below unit label when `exerciseId` is in URL params |
| `src/features/Exercises/ExerciseDetailScreen.tsx` | Replaced `START EXERCISE` → `Add to Challenge` (no challengeId context) or `Log Workout` (within challenge context); added `handleAddToChallenge` and `handleLogWorkout` |
| `src/features/Challenges/CreateChallengeWizard.tsx` | Added `exerciseIdParam` read from query params + `exercisePrefillAppliedRef` effect that pre-populates first activity row when exercises load |
| `scripts/testScoringGuards.ts` | Added guards 18I-5C-1 through 18I-5C-8 |

---

## 3. Routes Used

| From | To | Route |
|------|----|-------|
| ChallengeDetailScreen group name | GroupDetailScreen | `/app/group/:groupId` |
| SelectChallengeActivityScreen activity card | ExerciseDetailScreen | `/app/exercises/:id?challengeId=&groupId=` |
| LogWorkoutScreen | ExerciseDetailScreen | `/app/exercises/:exerciseId?challengeId=&groupId=` |
| ExerciseDetailScreen (no challenge context) | CreateChallengeWizard | `/app/challenges/create?exerciseId=<id>` |
| ExerciseDetailScreen (in challenge context) | LogWorkoutScreen | `/app/workouts/log?exerciseId=...&challengeId=...&groupId=...` |

---

## 4. How exerciseId Is Preserved

### ExerciseDetailScreen → back context
ExerciseDetailScreen already reads `challengeId` and `groupId` from query params and builds `backPath` with them:
```ts
const backPath = `/app/exercises${challengeId ? `?challengeId=${challengeId}${groupId ? `&groupId=${groupId}` : ''}` : ''}`;
```
The back button returns to the exercise list with the correct context preserved.

### SelectChallengeActivityScreen → ExerciseDetailScreen → back
"View exercise guide" passes `challengeId` and `groupId` to the exercise detail URL. Back button on ExerciseDetailScreen returns to the exercise list screen (not select-activity), so the user taps back again to return to the challenge flow. This is the simplest safe implementation — adding a direct back-to-challenge return path would require tracking referer state, which is deferred.

### LogWorkoutScreen → ExerciseDetailScreen → back
Same pattern: challenge/group context passed. Back button on ExerciseDetailScreen returns to exercise list, not directly to LogWorkout. Deferred: deep return-to-log context.

### ExerciseDetailScreen → CreateChallengeWizard prefill
`handleAddToChallenge` navigates to `/app/challenges/create?exerciseId=${exercise.id}`.

In `CreateChallengeWizard`, a new `useEffect` runs once after exercises load:
```ts
const exerciseIdParam = params.get('exerciseId') ?? undefined;
const exercisePrefillAppliedRef = useRef(false);
useEffect(() => {
  if (!exerciseIdParam || exercises.length === 0 || exercisePrefillAppliedRef.current) return;
  const match = exercises.find((e) => e.id === exerciseIdParam);
  if (!match) return;
  exercisePrefillAppliedRef.current = true;
  setActivities([{ query: match.name, exerciseId: match.id, targetValue: '', unit: match.metric.unit }]);
}, [exerciseIdParam, exercises]);
```

The ref flag prevents re-applying if the user edits the activity row and exercises re-render. If the `exerciseId` param is absent or not found in the catalog, the wizard opens with a blank activity row — same behavior as before.

---

## 5. Behavior Summary

### ChallengeDetailScreen group link
- **Before:** dot + plain text `challengeGroup.name`
- **After:** `<button>` with `Users` icon + underline-hover → navigates to `/app/group/:normalizedGroupId`
- **Safe fallback:** if `normalizedGroupId` is falsy, nothing renders (unchanged behavior)

### SelectChallengeActivityScreen activity cards
- **Before:** activity name, subtitle, progress — no exercise guide link
- **After:** when `match?.id` exists (fitness exercise matched in catalog), a small underlined "View exercise guide" appears below the progress label
- **Log button unchanged**

### LogWorkoutScreen
- **Before:** metric type label + unit label, then value input
- **After:** same + small "View exercise guide" link below the unit label when `exerciseId` is present in params

### ExerciseDetailScreen
- **Before:** fixed "START EXERCISE" button → always went to `/app/workouts/log`
- **After:**
  - With `?challengeId=` in URL: "Log Workout" → same log path (in-challenge context)
  - Without `challengeId`: "Add to Challenge" → `/app/challenges/create?exerciseId=<id>`

### CreateChallengeWizard
- **Before:** always opened with blank first activity row
- **After:** if `?exerciseId=<id>` is in URL and the exercise exists in catalog, first activity row is pre-filled with exercise name, id, and unit. User can still edit or clear it. No other wizard state is changed.

---

## 6. Regression Guards (18I-5C-1 … 18I-5C-8)

| ID | What it guards |
|----|----------------|
| 18I-5C-1 | ChallengeDetailScreen group link navigates to `/app/group/:groupId` |
| 18I-5C-2 | ChallengeDetailScreen uses `Users` icon for group link |
| 18I-5C-3 | SelectChallengeActivityScreen includes "View exercise guide" → exercise detail |
| 18I-5C-4 | LogWorkoutScreen includes "View exercise guide" → exercise detail |
| 18I-5C-5 | ExerciseDetailScreen does NOT contain "START EXERCISE" |
| 18I-5C-6 | ExerciseDetailScreen uses "Add to Challenge" CTA |
| 18I-5C-7 | ExerciseDetailScreen "Add to Challenge" links to `/app/challenges/create?exerciseId=<id>` |
| 18I-5C-8 | CreateChallengeWizard reads `exerciseId` param and applies prefill guard |

---

## 7. Validation

```
npx tsc --noEmit                    → ✅ No errors
npm run build                       → ✅ Built in 3.06s
npm run test:scoring-guards         → ✅ All guards passed (incl. 18I-5C-1…8)
npm run test:home-challenge-feeds   → ✅ All guards passed
npm run audit:challenge-creation-payloads → ✅ All guards passed
```

---

## 8. Manual Check Steps

1. **Challenge Detail → Group**
   - Open any challenge with a `groupId`
   - Tap the group name (shows `Users` icon)
   - Confirm you land on the Group Detail screen

2. **Select Activity → Exercise Guide**
   - Open a fitness challenge and tap "Select Activity"
   - Each fitness activity card should show "View exercise guide" below the progress
   - Tap it → confirm Exercise Detail screen opens with the correct exercise
   - Tap back → confirm you return to the exercise list (not select-activity directly)

3. **Log Workout → Exercise Guide**
   - Navigate to log a fitness workout (from select-activity or direct URL with `exerciseId`)
   - "View exercise guide" link appears below the unit label
   - Tap it → Exercise Detail opens with `challengeId` + `groupId` preserved

4. **Exercise Detail → Add to Challenge**
   - Browse to an exercise without a `challengeId` in the URL
   - Bottom button reads "Add to Challenge" (not "START EXERCISE")
   - Tap → Challenge creation wizard opens with first activity pre-filled

5. **Exercise Detail → Log Workout (in-challenge context)**
   - Navigate to exercise detail FROM a challenge (URL has `?challengeId=...`)
   - Bottom button reads "Log Workout"
   - Tap → Log workout screen opens correctly

6. **Challenge creation still works without exerciseId**
   - Open `/app/challenges/create` directly
   - Wizard opens normally with blank first activity row

---

## 9. Risks and Limitations

- **Back navigation gap:** "View exercise guide" from SelectChallengeActivity or LogWorkout takes users to ExerciseDetailScreen, whose back button returns to the *exercise list*, not to the challenge flow. Users need an extra tap to return. Deep return-context routing is deferred.
- **Prefill only for catalog exercises:** If an activity uses a `activityId` (wellness type) instead of an `exerciseId`, the guide link does not appear (correct — wellness activities don't have exercise detail pages).
- **No required deploys:** All changes are frontend-only. No Firestore rules or indexes changed.
