# Phase 18I-5D — Copy and UI Polish

**Date:** 2026-07-01
**Branch:** fix/p0-pre-deploy-blockers

---

## 1. Goal

Polish inconsistent copy and labels across the challenge logging flow after phases 18I-5A/B/C. No scoring logic, Firestore writes, leaderboard calculations, or feed generation logic changed.

---

## 2. Changes Made

### 2a. Home screen live progress: "of" → "/" separator

**File:** `src/features/Home/useHomeScreen.ts` (line 230)

**Before:**
```ts
firstCard.progressLabel = `${formatMetric(progressValue, unit)} of ${formatMetric(targetValue, unit)}`;
// Rendered as: "100 reps of 700 reps"
```

**After:**
```ts
firstCard.progressLabel = `${formatMetric(progressValue, unit)} / ${formatMetric(targetValue, unit)}`;
// Rendered as: "100 reps / 700 reps"
```

The fallback `progressLabel` for competitive challenges (set from membership data, not live logs) was already using slash format from Phase 18I-5B. This brings the live-log enrichment path into alignment.

---

### 2b. WorkoutLoggedScreen competitive headline: raw progress, not percentage

**File:** `src/features/Workouts/WorkoutLoggedScreen.tsx` (line 89)

**Before:**
```ts
headline = `Great work. You're now ${overallCompetitivePct}% complete.`
// "Great work. You're now 14% complete." — confusing since we removed % from leaderboard
```

**After:**
```ts
headline = `${exerciseName}: ${value.toLocaleString()} ${unit} logged!`
// "Squats: 100 reps logged!" — consistent with raw progress display everywhere else
```

The raw per-activity progress cards below the headline still show `X / Y unit` format, so the user sees their full picture in the progress section.

---

### 2c. LogWorkoutScreen competitive CTA: "Log My Progress" → "Log Workout"

**File:** `src/features/Workouts/LogWorkoutScreen.tsx` (line 146)

**Before:**
```ts
: isV2 && challengeType === 'competitive' ? 'Log My Progress'
```

**After:**
```ts
: isV2 && challengeType === 'competitive' ? 'Log Workout'
```

"Log My Progress" was redundant — the screen header already says "Log {exerciseName}" and the surrounding UI makes the context clear. "Log Workout" is consistent with collective and legacy flows.

---

### 2d. Group feed workout copy: "Completed X in" → "Logged X for"

**File:** `src/services/groupInsightsService.ts` (line 198)

**Before:**
```ts
text: `Completed ${w.value} ${w.unit} in ${challengeMap.get(w.challengeId)?.name || 'group challenge'}.`
// "Completed 100 reps in 7-Day Squat Sprint."
```

**After:**
```ts
text: `Logged ${w.value} ${w.unit} for ${challengeMap.get(w.challengeId)?.name || 'group challenge'}.`
// "Logged 100 reps for 7-Day Squat Sprint."
```

"Logged" is consistent with the wellness log feed copy (already used "Logged") and matches the app's verb for recording activity. "Completed" implied finishing the challenge. The preposition changes from "in" to "for" to read more naturally with "Logged".

---

### 2e. ChallengeDetailScreen competitive rules description

**File:** `src/features/Challenges/ChallengeDetailScreen.tsx` (line 475)

**Before:**
```
"First to complete wins, or highest completion rate at the end. Rankings are based on completion rate, then total points."
```

**After:**
```
"Race to hit your targets first. Rankings are based on total progress logged, then points."
```

Removes the stale "completion rate" language that was inconsistent with Phase 18I-5B which switched the leaderboard to raw progress values.

---

## 3. Files Changed

| File | Change |
|------|--------|
| `src/features/Home/useHomeScreen.ts` | Live progress label: `" of "` → `" / "` |
| `src/features/Workouts/WorkoutLoggedScreen.tsx` | Competitive headline: percentage → raw exercise name + value |
| `src/features/Workouts/LogWorkoutScreen.tsx` | Competitive save label: `"Log My Progress"` → `"Log Workout"` |
| `src/services/groupInsightsService.ts` | Workout feed text: `"Completed X in"` → `"Logged X for"` |
| `src/features/Challenges/ChallengeDetailScreen.tsx` | Competitive rules copy: removes "completion rate" reference |
| `scripts/testScoringGuards.ts` | Guards 18I-5D-1 through 18I-5D-7 added |

---

## 4. Screens Not Changed

| Screen | Reason |
|--------|--------|
| `ChallengeLeaderboardScreen` | Already uses raw `cumulativeLoggedValue` and `/ target unit` format from Phase 18I-5B |
| `ChallengeCompletedScreen` | Already uses raw progress format from Phase 18I-5B |
| `SelectChallengeActivityScreen` | Already shows raw progress; guide links added in 18I-5C-R |
| `GroupFeedScreen` | Renders `text` field from service — fixed at the service layer (2d above) |
| `ExerciseDetailScreen` | CTA already fixed in 18I-5C-R; no copy changes needed |
| `CreateChallengeWizard` | Exercise prefill copy is clear; no further changes needed |

---

## 5. Regression Guards (18I-5D-1 … 18I-5D-7)

| ID | What it guards |
|----|----------------|
| 18I-5D-1 | `useHomeScreen` live progressLabel uses `"/"` separator, not `"of"` |
| 18I-5D-2 | `WorkoutLoggedScreen` competitive headline does not show `overallCompetitivePct}% complete` |
| 18I-5D-3 | `LogWorkoutScreen` does not use `"Log My Progress"` |
| 18I-5D-4 | `LogWorkoutScreen` competitive CTA is `"Log Workout"` |
| 18I-5D-5 | Group feed workout text uses `"Logged"` not `"Completed"` |
| 18I-5D-6 | `ExerciseDetailScreen` does not contain `"START EXERCISE"` |
| 18I-5D-7 | `ChallengeDetailScreen` competitive description references `"total progress logged"` not `"completion rate"` |

---

## 6. Validation

```
npx tsc --noEmit                          → ✅ No errors
npm run build                             → ✅ Built in 3.48s
npm run test:scoring-guards               → ✅ All guards passed (incl. 18I-5D-1…7)
npm run test:home-challenge-feeds         → ✅ All guards passed
npm run audit:challenge-creation-payloads → ✅ All guards passed
```

---

## 7. Manual Check Steps

1. **Home challenge card** — competitive challenge should show `"100 / 700 reps"` not `"100 reps of 700 reps"`.

2. **Workout Logged (competitive)** — headline should read `"Squats: 100 reps logged!"` not `"You're now 14% complete."`. Per-activity progress cards below still show `X / Y unit`.

3. **Log Workout (competitive)** — bottom button reads `"Log Workout"` not `"Log My Progress"`.

4. **Group feed** — workout feed items read `"Logged 100 reps for 7-Day Squat Sprint."` not `"Completed 100 reps in ..."`.

5. **Challenge Detail (competitive)** — rules note below activity targets reads `"Race to hit your targets first. Rankings are based on total progress logged, then points."`.

6. **Exercise Detail** — bottom CTA reads `"Add to Challenge"` (no challenge context) or `"Log Workout"` (with challenge context). No `"START EXERCISE"` anywhere.

---

## 8. Known Limitations

- The `overallCompetitivePct` variable is still computed in `WorkoutLoggedScreen` (used by `showCompletion` flag that gates the "View Results" CTA). Its removal from the headline does not affect that logic.
- `firstCard.progressLabel` on the home card uses `"% complete"` as fallback when `targetValue <= 0`. This is intentional — it only appears for challenges with no configured target, where a slash format would render `"0 / 0"`. No change needed.
- Group feed `"Logged"` copy applies to new entries only. Existing Firestore documents are not mutated (feed text is generated at read time from the `text` field set by `getGroupFeed`, which runs fresh on each query).
