# UX-2 — Engine-aware Activity Logging Experience
**Branch:** `fix/p0-pre-deploy-blockers`  
**Date:** 2026-06-25  
**Status:** Complete — all validation commands passed

---

## 1. Objective

Redesign the activity logging UX to reflect the behavioural differences between Streak, Competitive and Collective v2 challenges. This is presentation, workflow, and copy only. No engine logic, no scoring algorithms were modified.

---

## 2. Files Modified

| File | Change |
|---|---|
| `src/features/Workouts/SelectChallengeActivityScreen.tsx` | Engine context panel, "already logged today" banner, per-activity competitive progress, streak stats grid |
| `src/features/Workouts/LogWorkoutScreen.tsx` | Engine context banner, engine-aware save button label |
| `src/features/Workouts/LogWellnessActivityScreen.tsx` | Engine context banner, engine-aware save button label |
| `src/features/Workouts/WorkoutLoggedScreen.tsx` | Full engine-specific success experience per type |

**Files confirmed NOT modified:**
- All engine files (`collectiveEngine.ts`, `competitiveEngine.ts`, `streakEngine.ts`, `legacyEngine.ts`, `index.ts`)
- `src/services/workoutService.ts`
- `src/services/wellnessLogService.ts`
- `src/services/scoringConfig.ts`
- `firestore.rules`

---

## 3. Validation

```
npx tsc -b --pretty false          → 0 errors
npm run build                      → ✓ built in 2.83s
npm run test:scoring-guards        → scoring guards passed
npm run test:home-challenge-feeds  → all guards passed
```

---

## 4. Changes in Detail

### 4.1 SelectChallengeActivityScreen — Engine Context Panel

Added `useChallengeMembership(challengeId)` to access membership state.

**Collective:** Shows a group progress card with a progress bar, `groupCurrentTotal / groupCumulativeTarget`, and percentage. Caption: "Every contribution moves the team closer."

**Competitive:** Shows per-activity cumulative progress (from `membership.cumulativeValues`). Each activity gets a labelled progress bar showing `cumulative / target (unit) · pct%`. Overall completion rate shown below.

**Streak:** Shows a 3-cell grid: Current Streak / Best Streak / Days To Go. Includes a streak progress bar and `Day X of Y · Resets/Pauses on miss` label.

**All types:** "Already logged today" banner appears when `membership.lastLogDate === todayDate`. For streak challenges, adds the note "They won't advance your streak."

**Challenge subtitle** updated per engine type:
- Collective: "Contribute to the team's goal."
- Competitive: "My race toward completion."
- Streak: "Keep the streak alive."
- Legacy: unchanged ("Pick an activity to log your progress")

Activity cards show engine-specific sub-labels:
- Competitive: `cumulative / target unit · pct%` for the matching activity
- Collective: `Target: X unit`
- Streak: "Log daily to keep your streak"

### 4.2 LogWorkoutScreen — Engine Context Banner

Added `useChallengeMembership` and engine detection.

**Banner above the value picker (v2 challenges only):**
- Collective: `👥 Team is at X / Y · Z% — every rep counts.`
- Competitive: `🏆 {activityName}: X / Y unit so far`
- Streak: `🔥 Day X streak · Y days to go`

**Save button label per engine:**
- Collective: "Contribute to Team"
- Competitive: "Log My Progress"
- Streak: "Log Today"
- Legacy/unknown: "Save Workout"

### 4.3 LogWellnessActivityScreen — Engine Context Banner

Same banner and button-label pattern as LogWorkoutScreen. Uses `activityId` key for competitive cumulative lookup. Collective uses `challenge.groupCurrentTotal / challenge.groupCumulativeTarget`.

### 4.4 WorkoutLoggedScreen — Engine-specific Success Experience

Replaces the single generic success card with three distinct engine-aware experiences:

#### Collective
- Headline: "You added X unit to the team's goal!"
- Sub-copy: "Your team is Z% toward its shared goal."
- Card: Group progress bar + `groupCurrentTotal / groupCumulativeTarget · Z%` + remaining amount + "Your contribution this session: +X unit" + "Every contribution moves the team closer."
- Icon: Users

#### Competitive
- Headline: "Great work. You're now Z% complete."
- Sub-copy: "Keep going — you're making progress on every activity."
- Cards: One per activity with name, progress bar, `cumulative / target unit`. The just-logged activity is highlighted with a "just logged" badge.
- Icon: Trophy

#### Streak
- Headline: "Day X completed. {Your streak continues. | Challenge complete!}"
- Sub-copy: Days remaining or congratulatory copy.
- Card: 3-cell grid (Current / Best / To Go) + streak progress bar + `Day X of Y · Reset/Pause rule` + 7-day milestone celebration (`🔥 X-day milestone!`)
- Icon: Flame

#### Legacy (v1)
- Unchanged. Existing "Level Up!" card preserved. "Target met." / "Target not met." / "Partial points earned." strings kept (required by scoring guards).

---

## 5. UX Comparison

| Screen | Before | After |
|---|---|---|
| Select Activity | Generic "Pick an activity" text | Engine context panel + per-engine progress + today banner |
| Log Workout/Wellness | No engine context | Engine banner with live team/cumulative/streak data |
| Save button | "Save Workout" / "Save Activity" | Engine-aware: "Contribute to Team" / "Log My Progress" / "Log Today" |
| Success screen | Single generic card | Three unique engine experiences |
| Success headline | "Workout Logged!" always | "You added X to the team's goal!" / "You're now Z% complete." / "Day X completed." |
| Group progress | Not shown | Collective: animated progress bar with running total |
| Per-activity progress | Not shown | Competitive: individual bars per activity |
| Streak tracking | Not shown | Streak: grid + bar + milestone celebrations |

---

## 6. Design Decisions

**No daily target for Collective:** The collective panel shows only group totals, not per-member daily targets. `completionRate` on collective memberships reflects log frequency, not group progress (per Phase 11G note R-3). Group progress reads from `challenge.groupCurrentTotal / challenge.groupCumulativeTarget`.

**Multiple logs per day:** The "already logged today" banner is informational — it does NOT block logging. Additional sessions are allowed and improve cumulative totals. For streak challenges, the banner clarifies they won't advance the streak.

**Competitive activity key:** `cumulativeValues` is keyed by `activity.exerciseId || activity.activityId || activity.exerciseName`. The select screen and success screen use the same key resolution.

**v1 backwards compatibility:** All v1 challenges (no `engineVersion`) show the unchanged legacy experience. The new engine UX is gated on `challenge.engineVersion === 'v2'`.

---

## 7. Remaining Gaps

| Gap | Notes |
|---|---|
| Animated group progress increase on success | The progress bar renders from Firestore state after the log. Firebase query cache may not reflect the just-committed increment immediately. A 300ms delay or optimistic update would improve perceived animation. Low priority — data will refresh on next focus. |
| Competitive "Add another session" modal | Spec mentions an explicit Add another / Cancel dialog for already-logged-today. Implemented as an informational banner instead (non-blocking). Full modal can be added in a later UX pass. |
| Streak milestone at non-7 intervals | Currently celebrates multiples of 7. Could be extended to 14, 21, 30 etc. |
