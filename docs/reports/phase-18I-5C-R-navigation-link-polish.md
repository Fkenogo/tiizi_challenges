# Phase 18I-5C-R — Navigation Link Polish

**Date:** 2026-07-01
**Branch:** fix/p0-pre-deploy-blockers
**Prior phase:** 18I-5C (navigation links added but too subtle + wrong route)

---

## 1. Issues Fixed

| # | Issue | Root Cause | Fix |
|---|-------|-----------|-----|
| 1 | Group link too subtle (plain text) | Used `hover:underline` on plain `<p>` — invisible on mobile | Replaced with orange chip: `border-primary/30 bg-primary/10` pill, `Users` icon, "View Group: {name}" label |
| 2 | "View exercise guide" hidden (grey underline) | `text-slate-500 underline` styling invisible against white card | Replaced with orange chip matching group link style, `Info`/`BookOpen` icon, "View Exercise Guide" label |
| 3 | "Add to Challenge" opened wrong page | Route was `/app/challenges/create` — this path is unregistered | Fixed to `/app/create-challenge` (the real `CreateChallengeWizard` route in App.tsx) |

---

## 2. Files Changed

| File | Change |
|------|--------|
| `src/features/Challenges/ChallengeDetailScreen.tsx` | Group link: wrapped in `<div className="mx-4 mt-3">`, button now uses `inline-flex rounded-full border border-primary/30 bg-primary/10` chip; label reads "View Group: {name}" |
| `src/features/Workouts/SelectChallengeActivityScreen.tsx` | Exercise guide: chip styling `border-primary/30 bg-primary/10` with `Info` icon; label "View Exercise Guide" |
| `src/features/Workouts/LogWorkoutScreen.tsx` | Added `BookOpen` import; chip styling `border-primary/30 bg-primary/10`; label "View Exercise Guide" |
| `src/features/Exercises/ExerciseDetailScreen.tsx` | `handleAddToChallenge`: route fixed from `/app/challenges/create?` → `/app/create-challenge?` |
| `scripts/testScoringGuards.ts` | Updated guards 18I-5C-1 through 18I-5C-9 (renamed some, added App.tsx route guard 18I-5C-8, renumbered wizard guard to 18I-5C-9) |

---

## 3. Exact Route Fixed

**Before (wrong):**
```ts
navigate(`/app/challenges/create?exerciseId=${exercise.id}`);
```

**After (correct):**
```ts
navigate(`/app/create-challenge?exerciseId=${exercise.id}`);
```

**App.tsx registration (line ~271):**
```tsx
<Route path="/app/create-challenge" element={
  <ProtectedRoute><RequireGroupRoute><CreateChallengeWizard /></RequireGroupRoute></ProtectedRoute>
} />
```
`/app/challenges/create` is not registered anywhere — navigating there would land on the 404/catch-all screen.

---

## 4. Visual Changes

### Group chip (ChallengeDetailScreen)
```
[ 👥 View Group: Fit 50s ]   ← orange pill, clearly tappable
```
Style: `inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5`

### Exercise guide chip (SelectChallengeActivityScreen + LogWorkoutScreen)
```
[ ⓘ View Exercise Guide ]   ← orange pill, below activity progress
```
Style: `inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1` (SelectActivity) / `px-3 py-1.5` (LogWorkout)

Both use the same `text-primary font-bold` label for consistency with the group chip.

---

## 5. Guards (18I-5C-1 … 18I-5C-9)

| ID | What it guards |
|----|----------------|
| 18I-5C-1 | ChallengeDetailScreen group link navigates to `/app/group/:groupId` |
| 18I-5C-2 | ChallengeDetailScreen uses `Users size={13}` icon and "View Group:" label |
| 18I-5C-3 | SelectChallengeActivityScreen has "View Exercise Guide" chip → exercise detail |
| 18I-5C-4 | LogWorkoutScreen has "View Exercise Guide" chip → exercise detail |
| 18I-5C-5 | ExerciseDetailScreen does NOT contain "START EXERCISE" |
| 18I-5C-6 | ExerciseDetailScreen uses "Add to Challenge" CTA |
| 18I-5C-7 | ExerciseDetailScreen links to `/app/create-challenge?exerciseId=<id>` (not `/app/challenges/create`) |
| 18I-5C-8 | App.tsx maps `/app/create-challenge` to `CreateChallengeWizard` |
| 18I-5C-9 | CreateChallengeWizard reads `exerciseId` param and applies prefill once |

---

## 6. Validation

```
npx tsc --noEmit                         → ✅ No errors
npm run build                            → ✅ Built in 3.02s
npm run test:scoring-guards              → ✅ All guards passed (incl. 18I-5C-1…9)
npm run test:home-challenge-feeds        → ✅ All guards passed
npm run audit:challenge-creation-payloads → ✅ All guards passed
```

---

## 7. Manual Check Steps

1. **Group chip** — Open any challenge that belongs to a group. Below the stats row, confirm an orange pill reads "View Group: {group name}" with a people icon. Tap it → Group Detail screen opens.

2. **Exercise guide chip (Select Activity)** — Open a fitness challenge → Select Activity. Each fitness activity card shows an orange "View Exercise Guide" chip below the progress line. Tap it → Exercise Detail opens for that exercise; `challengeId` and `groupId` are in the URL.

3. **Exercise guide chip (Log Workout)** — Navigate to the Log Workout screen with `exerciseId` in URL. Confirm the orange "View Exercise Guide" chip appears below the unit label. Tap it → Exercise Detail opens.

4. **Add to Challenge (no challenge context)** — Browse to any exercise without `?challengeId=` in the URL. Bottom button reads "Add to Challenge". Tap it → `/app/create-challenge?exerciseId=<id>` opens the real CreateChallengeWizard with the first activity row pre-filled with that exercise.

5. **Log Workout (in-challenge context)** — Navigate to exercise detail with `?challengeId=...` in the URL. Bottom button reads "Log Workout". Tap → Log Workout screen opens correctly.

6. **Challenge creation without exerciseId** — Open `/app/create-challenge` directly. Wizard opens normally with blank first activity row.

---

## 8. No Deploy Required

All changes are frontend-only (UI styling + route string fix). No Firestore rules, indexes, or Cloud Functions changed.
