# Phase 11 — Challenge Type Model Architecture Audit
**Branch:** `fix/p0-pre-deploy-blockers`
**Date:** 2026-06-25
**Status:** Audit Only — No code changes made

---

## Executive Summary

The current implementation treats all three challenge types (Collective, Competitive, Streak) as **structurally and mechanically identical**. The `challengeType` field is stored and displayed in the UI but affects exactly one computation (`deriveDailyTargetValue`) and otherwise has no behavioral effect. Every membership completes via the same counter: `activitiesCompleted >= totalActivities = durationDays × activityCount`.

The audit identifies the following as root causes of the "all challenges behave like streak challenges" symptom:

1. `computeRequiredLogs = durationDays × activityCount` is universal — this is a frequency model, not a volume model.
2. Scoring (`computeActivityScore`) is identical for all types.
3. The data model has no pooled-total field for Collective, no ranked-first field for Competitive.
4. `targetValue` has no canonical semantic — it is simultaneously a per-session target, a daily target, and (for creators) possibly an overall challenge target.

---

## 1. Challenge Creation

### Supported Types

| Type | Enum value | Selection |
|---|---|---|
| Collective | `'collective'` | Toggle in CreateChallengeWizard + CreateChallengeScreen (admin) |
| Competitive | `'competitive'` | Same |
| Streak | `'streak'` | Same |

### Supported Modes

| Mode | Enum value | Set by |
|---|---|---|
| Fitness | `category = 'fitness'` | `challengeCategory` state; default |
| Wellness | `category = 'wellness'` or specific sub-category | User selects Wellness picker; templates apply category |

### Fields by type at creation time

All three types share **exactly the same form and fields**. The challenge type is a UI toggle (3 buttons) with no conditional field rendering — selecting Competitive or Streak does not unlock or hide any fields compared to Collective.

**Required fields (creation validation):**
- `name` (non-empty)
- `description` (length ≥ 8)
- `startDate`, `endDate` (valid range)
- `groupId` (user must be active member)
- At least one activity with `targetValue > 0`

**Stored per-activity fields:**
```
exerciseId / activityId / activityType / exerciseName
targetValue   ← single numeric value, semantics undefined
unit          ← display only
frequency     ← stored but never read by logging pipeline
dailyFrequency ← stored but never read by logging pipeline
pointsPerCompletion ← stored but never read (scoring ignores it)
```

**Notable gaps:**
- No "group target" field for Collective challenges (e.g., "20,000 total reps").
- No "personal target" vs "daily target" distinction in the schema.
- `frequency` is stored only for wellness activities; fitness challenges have no frequency picker in the wizard.
- All three types default `challengeType: 'collective'` in `challengeService.createChallenge()` when omitted.

---

## 2. Activity Targets

### How targetValue Is Used

| Location | How targetValue is read |
|---|---|
| `challengeCompletion.deriveDailyTargetValue` | For `streak` only: divides by `durationDays` if result ≥ 1 |
| `workoutService.createWorkout` | `activityConfig.targetValue` → `deriveDailyTargetValue` → `computeActivityScore` |
| `wellnessLogService.writeLog` | Same pattern |
| `ChallengeDetailScreen` | Displayed as "daily target X unit" |
| `WorkoutLoggedScreen` | `target = params.get('target') || totalDays` — reads URL param |
| `SelectChallengeActivityScreen` | Passes `targetValue` through URL to logging screens |

### Target Semantics

`targetValue` is interpreted as a **per-session target** in all scoring code. For non-streak challenges (`collective`, `competitive`), `targetValue` is passed directly to `computeActivityScore` unchanged. For `streak` challenges, `deriveDailyTargetValue` attempts to un-scale it if it appears to be a cumulative total.

**The fundamental problem:**
- A Collective challenge creator entering "20,000 Reps" likely intends that as the **group-wide cumulative target**.
- A Competitive challenge creator entering "1,200 Pushups" likely intends a **personal cumulative target**.
- A Streak challenge creator entering "100 Reps" likely intends a **daily per-session target**.

The current schema treats all three identically. There is no `totalGroupTarget`, `personalCumulativeTarget`, or `dailyTarget` field — only `targetValue`.

---

## 3. Logging Pipeline

### Fitness Workout Flow

```
User taps Log → SelectChallengeActivityScreen
  → Log Workout (LogWorkoutScreen)
  → workoutService.createWorkout()
      1. Validate challenge dates
      2. Auto-create membership if missing
      3. Compute totalActivities = computeRequiredLogs(durationDays, activityCount)
      4. Guard: totalActivities <= 0 → throw
      5. deriveDailyTargetValue(rawTargetValue, durationDays, challengeType)
      6. computeActivityScore(value, effectiveTarget, challengeType)
      7. Batch write:
         - workouts/{id}  ← stores value, unit, points, scoringVersion
         - challengeMembers/{challengeId}_{userId}:
             activitiesCompleted = min(prev + 1, totalActivities)
             totalPoints += pointsEarned
             completionRate = min(100, activitiesCompleted/totalActivities × 100)
             status = 'completed' if completionRate >= 100
         - users/{userId}.stats.totalWorkouts += 1
```

### Wellness Logging Flow

Identical to fitness, replacing `workoutService.createWorkout` with `wellnessLogService.writeLog`. Writes to `wellnessLogs/{id}` instead of `workouts/{id}`. Same `challengeMembers` update logic, same `computeRequiredLogs`/`computeActivityScore` chain.

### Key observations

- **`activitiesCompleted` is a counter, not a value sum.** Every log call increments it by 1, capped at `totalActivities`. The actual logged value (reps, ml, hours) is stored in the log document but not accumulated anywhere in `challengeMembers`.
- **`totalPoints` is a running sum** of `pointsEarned` from each log session. Points are proportional to `value / effectiveTarget` per session.
- **`frequency` is never read** during logging. A "daily" frequency activity is logged identically to a "3x-week" activity — both increment `activitiesCompleted` by 1.
- **No deduplication per day.** A user can log 5 times in one day and get `activitiesCompleted += 5`.

---

## 4. Scoring

### Formula (universal — all three types)

```
effectiveTarget = deriveDailyTargetValue(targetValue, durationDays, challengeType)
  # For streak:  effectiveTarget = targetValue / durationDays  (if result >= 1)
  # For all other types: effectiveTarget = targetValue  (no transformation)

ratio = loggedValue / effectiveTarget

if ratio <= 0.05: pointsEarned = 0  (MIN_EFFORT_RATIO)
else: pointsEarned = round(min(ratio, 1) × 100)  [0–100]
```

**Source:** `scoringConfig.ts → computeActivityScore`

**Key finding:** `computeActivityScore` receives `challengeType` as an input parameter but never branches on it. The type is passed through but ignored in the computation. The comment in `scoringConfig.ts` explicitly states: *"Applies uniformly to all challenge types (collective, competitive, streak)."*

### Points storage

`totalPoints` accumulates in `challengeMembers/{challengeId}_{userId}.totalPoints` via `increment(pointsEarned)` in the batch write. This is the source for:
- Challenge leaderboard (sorted by `totalPoints`, top 20)
- Group leaderboard (sum of `totalPoints` across all challenges for each user)

### What scoring does NOT model

- Collective cumulative group total (e.g., group has 18,000 of 20,000 target reps).
- Competitive rank-by-cumulative-volume (e.g., Alice has 800/1200 pushups, Bob has 950/1200).
- Streak continuity (no check for "did user log yesterday?").
- Bonus points for early completion or perfect streaks.

---

## 5. Progress Calculation

### Individual membership progress (`challengeMembers`)

```
activitiesCompleted  ← log count, capped at totalActivities
completionRate       ← activitiesCompleted / totalActivities × 100  (0–100)
totalPoints          ← running sum of per-session pointsEarned
```

**Same formula for all three types.**

### `useChallengeProgress` hook

```
totalLogs = sum(activitiesCompleted) across all challengeMembers for this challenge
myLogs    = current user's activitiesCompleted
uniqueParticipants = getChallengeParticipantCount()  (max of challenge.participantCount and live count)
```

No pooled-value total. No "group is N% toward shared target" calculation.

### Functions involved

| Function | File | Role |
|---|---|---|
| `computeRequiredLogs` | `challengeCompletion.ts` | Returns `durationDays × activityCount` for ALL types |
| `deriveDailyTargetValue` | `challengeCompletion.ts` | Rescales target for streak type only |
| `computeActivityScore` | `scoringConfig.ts` | Computes per-session points |
| `useChallengeProgress` | `useWorkouts.ts` | Fetches aggregate progress for UI |
| `getChallengeParticipantCount` | `challengeService.ts` | Participant count |
| `getGroupLeaderboard` | `groupInsightsService.ts` | Sums totalPoints across all group challenges per user |

---

## 6. Completion Logic

### What triggers completion (all three types)

```typescript
// workoutService.ts and wellnessLogService.ts — identical:
const nextCompleted = Math.min(alreadyCompleted + 1, totalActivities);
const nextRate = Math.min(100, Math.round((nextCompleted / totalActivities) * 100));
if (nextRate >= 100) {
  membershipUpdate.status = 'completed';
  membershipUpdate.completedAt = Timestamp.now();
}
```

**Completion fires when `activitiesCompleted` reaches `totalActivities = durationDays × activityCount`.**

This is a log-frequency model: if the challenge is 30 days × 1 activity, completion requires 30 log events. This is inherently a streak model regardless of the selected `challengeType`.

### Per-type completion analysis

| Type | Current behavior | Intended behavior |
|---|---|---|
| **Streak** | ✅ Correct intent — requires durationDays logs | Requires N logs, one per day (but daily constraint not enforced) |
| **Competitive** | ❌ Wrong — completion is 30 logs, not "first to N reps" | Should complete when cumulative logged value ≥ personalTarget |
| **Collective** | ❌ Wrong — each member independently logs 30× | Should complete when group's sum of logged values ≥ groupTarget |

### Who completes

- Currently: individual membership status only.
- Challenge-level `status` is never auto-updated to `'completed'` by any logging service (only by `updateChallengeStatus` called manually from admin).
- There is no mechanism for a Collective challenge to auto-complete when the group hits the pooled target.

---

## 7. Leaderboards

### Challenge Leaderboard (`ChallengeLeaderboardScreen`)

| Attribute | Value |
|---|---|
| Data source | `challengeMembers` where `challengeId == X` |
| Metric | `totalPoints` per member |
| Sort | Descending by `totalPoints` |
| Display | Top 20, user labeled by `userId` prefix (no display name lookup from challenge leaderboard directly) |
| Challenge awareness | Yes — filtered by `challengeId` |
| Group awareness | Uses `groupId` from URL to resolve group members for display names |

**Issue:** The challenge leaderboard sorts by accumulated points — which is the right metric for Competitive. But for Collective, the leaderboard should show group-wide cumulative progress, not individual point totals. For Streak, the leaderboard shows accumulated points which may correctly reflect daily performance.

### Group Leaderboard (`GroupLeaderboardScreen` / `groupInsightsService`)

| Attribute | Value |
|---|---|
| Data source | `challengeMembers` where `groupId == X` |
| Metric | Sum of `totalPoints` across ALL challenges in this group per user |
| Sort | Descending |
| Display | Top 20 with display name lookup from `users` collection |
| Challenge awareness | No — aggregates across all challenges in the group |
| Group awareness | Yes |

The group leaderboard is challenge-type-agnostic and simply adds up all points a user has ever earned across all group challenges.

---

## 8. UI Interpretation of Targets

| Screen | Target interpretation | Type assumption |
|---|---|---|
| `ChallengeDetailScreen` | "Daily Targets" label, shows `targetValue unit freqLabel` | Assumes **daily** |
| `ChallengeLeaderboardScreen` | Points label: "log closer to your **daily** goal" | Hardcoded **daily** |
| `WorkoutLoggedScreen` | `target = params.get('target') \|\| totalDays` — bar tracks cumulative raw value vs target | Uses cumulative vs total-days, not per-session |
| `ChallengeCompletedScreen` | `completionPct = uniqueDays / totalDays` — counts unique active days | **Streak** model hardcoded |
| `ChallengeCompletedScreen` | "Total Reps" = sum of `workout.value` for all user's workouts in challenge | Raw value sum |
| `SelectChallengeActivityScreen` | Passes `targetValue` to log screen; does not adapt for type | No type adaptation |
| `ChallengeCard` / `ChallengesScreen` | Shows completion rate from `membership.completionRate` | Agnostic |
| `HomeScreen` | Shows active challenges using completion rate | Agnostic |

**Key UI regressions identified:**

1. **`WorkoutLoggedScreen` completion bar**: `completion = totalValue / target` where `target = params.get('target') || totalDays`. The fallback `totalDays` makes no unit sense (comparing reps to days). The intent was to show "how close you are to the overall target" but `totalValue` is the raw logged-value sum and `target` is a number of days. This is a Tier A regression.

2. **`ChallengeCompletedScreen` completion pct**: `uniqueDays / totalDays` — this is a streak-specific model. For a Competitive challenge where someone logged 1,200 out of 1,200 target pushups across 2 days, `uniqueDays = 2`, `totalDays = 30`, `completionPct = 7%` — incorrect.

---

## 9. Templates

### Fitness templates (`challengeTemplates` collection)

All templates have `challengeType` as one of the three values. But template activities store the same undifferentiated `targetValue` field. No template has a `groupTarget` or `cumulativeTarget` variant. Activities in fitness templates have no `frequency` field.

**Fitness templates default assumption:** per-session target (e.g., "100 reps per log session").

### Wellness templates (`wellnessTemplates` collection)

Wellness templates have `frequency` per activity (`daily`, `weekly`, etc.) but this is only cosmetically used. Template duration drives `computeRequiredLogs`. Activities store `targetValue` as a per-session value.

**Wellness template assumption:** daily per-session target (e.g., "2,000 ml of water daily").

### Template type coverage

- Templates span all three `challengeType` values.
- No template varies its activity structure by challenge type.
- All templates store `targetValue` as what a user should hit in a single session.

---

## 10. Firestore Data Model

### `challenges/{id}` document

```
id                  string
name                string
description         string
groupId             string
category            'fitness' | 'wellness' | sub-category
challengeType       'collective' | 'competitive' | 'streak'   ← label only
status              'draft' | 'active' | 'completed' | 'expired'
startDate           ISO string
endDate             ISO string
durationDays        number (optional — derived from date diff in UI)
exerciseIds         string[]  (legacy)
activities[]        {
  exerciseId?       string
  activityId?       string
  activityType?     string
  exerciseName?     string
  targetValue       number     ← per-session target (no type qualifier)
  unit              string
  frequency?        'daily' | 'weekly' | '2x-week' | '3x-week' | '5x-week' | 'custom'
  dailyFrequency?   number
  pointsPerCompletion? number  ← stored but never used by scoring
}
participantCount    number (denormalized)
donation            { enabled, ... }
moderationStatus    'pending' | 'approved' | 'needs_changes'
coverImageUrl       string?
visibility          'public' | 'private'?
groupVisibility     'public' | 'private'?
```

**Missing fields for a full 3-type model:**
- No `groupTarget` (Collective cumulative goal)
- No `personalTarget` (Competitive individual goal)
- No `targetType: 'daily' | 'session' | 'cumulative' | 'group-pool'`
- No `currentGroupTotal` (Collective running total)
- No `lastLogDate` per member (Streak streak-break detection)

### `challengeMembers/{challengeId}_{userId}` document

```
challengeId         string
userId              string
groupId             string
joinedAt            Timestamp
status              'active' | 'completed' | 'abandoned'
activitiesCompleted number   ← log event count, capped at totalActivities
totalActivities     number   ← durationDays × activityCount (same for all types)
completionRate      number   ← activitiesCompleted / totalActivities × 100
totalPoints         number   ← running sum of per-session pointsEarned
lastActivityAt      Timestamp?
completedAt         Timestamp?
```

**Missing fields for a full 3-type model:**
- No `cumulativeLoggedValue` per activity (Competitive needs this for "N/1200 reps" display)
- No `streakDays`, `lastLogDate`, `currentStreak`, `longestStreak` (Streak-specific)
- No contribution to group-level pool (Collective-specific)

### `workouts/{id}` document

```
userId              string
challengeId         string
exerciseId          string
value               number   ← the logged amount
unit                string
groupId             string?
date                YYYY-MM-DD string
completedAt         ISO timestamp
loggedAt            Timestamp
points              number
scoringVersion      'v2'
verified            boolean
notes               string?
```

No aggregation at challenge level. The raw logs are the only source of cumulative value truth — there is no denormalized challenge-level or membership-level cumulative sum.

### `wellnessLogs/{id}` document

```
userId, groupId, challengeId, activityId
logType             'fasting' | 'hydration' | 'sleep' | 'meditation'
value, unit, points
date                YYYY-MM-DD
loggedAt            Timestamp
scoringVersion      'v2'
metadata            { logType-specific fields }
```

Same structure as workouts for challenge tracking purposes.

---

## Architecture Diagram — Current Data Flow

```
Challenge Creator
  │
  ├─ challengeType: 'collective' | 'competitive' | 'streak'
  ├─ activities[].targetValue  ← single number, no type qualifier
  └─ activities[].frequency    ← stored, never read by pipeline
  
  → challenges/{id}  (type is a label only)

Logging User
  │
  ├─ Selects activity → enters value
  │
  ├─ workoutService.createWorkout() / wellnessLogService.writeLog()
  │     ├─ computeRequiredLogs(durationDays, activityCount)  ← SAME for all types
  │     ├─ deriveDailyTargetValue(targetValue, days, type)   ← streak only divides
  │     ├─ computeActivityScore(value, target, type)          ← type ignored in calc
  │     └─ batch write:
  │           workouts | wellnessLogs → raw log stored
  │           challengeMembers → activitiesCompleted++, totalPoints+=pts
  │
  └─ UI reads challengeMembers for progress/leaderboard

Group Leaderboard
  └─ sum(challengeMembers.totalPoints) per user, all challenges in group

Challenge Leaderboard
  └─ challengeMembers.totalPoints, sorted descending, filtered by challengeId
```

---

## Design Review: Can the Architecture Support Three Different Models?

### Can. It. Work. — Per type:

**A. Streak Challenge — Current architecture: ADEQUATE WITH GAPS**

What works:
- `durationDays × activityCount` as `totalActivities` is exactly what a streak challenge needs.
- Per-session proportional scoring is appropriate.
- `activitiesCompleted` counter is correct.

What's missing:
- No daily uniqueness check. Users can "front-load" 30 logs in day 1 and complete a 30-day streak challenge immediately.
- `deriveDailyTargetValue` partially addresses target ambiguity but is a heuristic, not a reliable fix.

**B. Competitive Challenge — Current architecture: FUNDAMENTALLY WRONG**

The core model is broken:
- Competitive means "first to accumulate X units wins." The current counter (`activitiesCompleted`) counts how many times someone logged, not how much they've logged cumulatively.
- There is no `cumulativeLoggedValue` field in `challengeMembers` to show "I've done 800 of 1,200 target pushups."
- Completion is triggered by `durationDays × activityCount` log events, not by reaching a personal cumulative target.
- Leaderboard by `totalPoints` (proportional per session) is a proxy for value-logged but is not the correct metric.

**C. Collective Challenge — Current architecture: FUNDAMENTALLY WRONG**

The core model is broken:
- Collective means "group contributes to a shared pool." There is no group-level pooled value in the data model.
- Each member's `activitiesCompleted` is tracked independently.
- There is no `groupCurrentTotal` field to show "the group has logged 14,000 of 20,000 target reps."
- Challenge cannot auto-complete when the group total reaches the target.
- Individual members completing (30 log events each) has nothing to do with group completion.

---

## Final Recommendations

### 1. Architecture Strengths

- The `challenges` collection is cleanly structured and extensible.
- `challengeMembers` per-user tracking is sound for individual progress.
- `scoringConfig.ts` is well-isolated; scoring can be extended without touching service code.
- `computeRequiredLogs` and `deriveDailyTargetValue` are pure functions — easy to replace.
- The three-collection (challenges, challengeMembers, workouts/wellnessLogs) structure is correct.

### 2. Architecture Weaknesses

1. `challengeType` is a label; no branching logic uses it in the progress/completion pipeline.
2. `targetValue` has no canonical semantic tag (`per-session` vs `cumulative` vs `group-pool`).
3. `computeRequiredLogs = durationDays × activityCount` is a hardcoded streak formula applied to all types.
4. `activitiesCompleted` counts log events, not cumulative logged value — useless for Competitive.
5. No group-pool aggregate field for Collective.
6. No daily uniqueness enforcement for Streak.
7. `frequency` and `dailyFrequency` are stored but never read by any pipeline.
8. `ChallengeCompletedScreen` and `WorkoutLoggedScreen` have hardcoded streak/ambiguous assumptions.

### 3. Required Database Changes

**Minimal (additive — no migrations required for existing challenges):**

```
challenges/{id}:
+ targetType: 'daily' | 'cumulative' | 'group-pool'   ← disambiguates targetValue semantic
+ groupCumulativeTarget: number?                        ← Collective: group-wide goal

challengeMembers/{id}:
+ cumulativeLoggedValue: number?                        ← Competitive: running raw value sum
+ lastLogDate: string?                                  ← Streak: date of last log (YYYY-MM-DD)
+ currentStreak: number?                                ← Streak: consecutive days
```

**For Collective group-pool total:**
Either a new subcollection or a denormalized field on the challenge document:
```
challenges/{id}.groupCurrentTotal: number   ← sum of all members' cumulativeLoggedValue
```
(Updated atomically in same batch as individual log writes.)

### 4. Required Service Changes

| Service | Change |
|---|---|
| `challengeCompletion.ts` | Replace `computeRequiredLogs` with type-aware functions |
| `workoutService.createWorkout` | Branch completion logic by `challengeType` |
| `wellnessLogService.writeLog` | Same as above |
| New: `challengeProgressService` | Compute group pool total for Collective |

**Type-specific completion logic:**

```
Streak:   activitiesCompleted >= totalActivities  (current)
          + enforce: lastLogDate must be today (no double-logging for streak credit)

Competitive:  cumulativeLoggedValue >= personalTarget
              + store cumulativeLoggedValue in challengeMembers
              + completion = individual reaches their target
              + leaderboard = ranked by cumulativeLoggedValue (not totalPoints)

Collective:   groupCurrentTotal >= groupCumulativeTarget
              + no individual completion (all members share status)
              + update challenges/{id}.groupCurrentTotal in batch
              + completion = challenge-level, not membership-level
```

### 5. Required UI Changes

| Screen | Change |
|---|---|
| `ChallengeDetailScreen` | Show type-appropriate progress: pool bar for Collective, personal bar for Competitive, streak calendar for Streak |
| `WorkoutLoggedScreen` | Replace `totalValue / totalDays` bar with type-aware progress |
| `ChallengeCompletedScreen` | Replace `uniqueDays / totalDays` with type-aware `completionPct` |
| `ChallengeLeaderboardScreen` | Collective: show group progress, not individual points |
| Creation wizard | Separate target field label/hint per type; add "group target" field for Collective |

### 6. Required Template Changes

- Add `targetType` field to template activities (per-session vs cumulative).
- For Collective templates, add `groupCumulativeTarget` at template level.
- Review existing templates' `targetValue` values for semantic correctness once `targetType` is established.

### 7. Recommended Implementation Order

1. **Schema extension**: add `targetType` to `activities[]` and `groupCumulativeTarget` to challenges. (Non-breaking — existing data uses existing behavior.)
2. **Streak fix**: add `lastLogDate` to `challengeMembers`; enforce daily uniqueness in logging services.
3. **Competitive fix**: add `cumulativeLoggedValue` to `challengeMembers`; change completion trigger.
4. **Collective fix**: add `groupCurrentTotal` to challenges; change completion to group-level; update leaderboard.
5. **UI updates**: update detail, logged, completed, leaderboard screens per type.
6. **Template audit**: verify targetValues make sense with new `targetType` semantics.

### 8. Risk Assessment

| Risk | Severity | Notes |
|---|---|---|
| Schema extension breaks existing challenges | Low | Additive fields — old records use old behavior |
| Daily uniqueness breaks existing "streak" completions | Medium | Users who front-loaded logs would lose completion status |
| Collective group-pool counter consistency | High | Needs atomic batch writes; concurrent logs could race |
| Migration of existing `targetValue` data | Medium | Need to decide semantic for each existing challenge's activities |
| Leaderboard semantics change | Medium | Points remain valid for Streak; Competitive needs raw-value sort |

### 9. Migration Strategy for Existing Challenges

1. **Active challenges**: do not change completion logic retroactively. Grandfather existing memberships under current rules.
2. **New challenges after release**: apply type-specific logic from creation date.
3. **`targetType` backfill**: default `targetType = 'daily'` for all existing activities (matching current behavior). Group admins can re-configure when creating new challenges.
4. **No Firestore batch migration required** if defaulting to 'daily' — existing scoring remains valid.

### 10. Implementation Classification

**Verdict: Moderate Refactor**

- Not a small extension: branching completion logic, new fields, new service methods.
- Not a major redesign: the 3-collection schema is correct; `challengeMembers` is salvageable; no need to rebuild the Firestore model from scratch.
- The scoring formula (`computeActivityScore`) is correct and can remain unchanged for Streak. It needs minor adaptation for Competitive (score by cumulative value vs personal target) and is irrelevant for Collective (no individual scoring in pool model).
- Estimated scope: 4–6 focused implementation tasks, each independently testable.

---

## Files Inspected

| File | Purpose |
|---|---|
| `src/types/index.ts` | Challenge, ChallengeMember, Workout, WellnessLog type definitions |
| `src/services/challengeService.ts` | Challenge CRUD, join/leave, participant counts |
| `src/services/workoutService.ts` | Fitness logging pipeline, completion logic |
| `src/services/wellnessLogService.ts` | Wellness logging pipeline |
| `src/services/challengeCompletion.ts` | `computeRequiredLogs`, `deriveDailyTargetValue` |
| `src/services/scoringConfig.ts` | `computeActivityScore`, `computeSessionScore` |
| `src/services/challengeTemplateService.ts` | Suggested template CRUD |
| `src/services/adminChallengeService.ts` | Admin challenge management |
| `src/services/groupInsightsService.ts` | Group leaderboard, group feed |
| `src/features/Challenges/CreateChallengeWizard.tsx` | Member-facing challenge creation |
| `src/features/Admin/Challenges/CreateChallengeScreen.tsx` | Admin template creation |
| `src/features/Challenges/ChallengeDetailScreen.tsx` | Detail screen with CTA + progress |
| `src/features/Challenges/ChallengeLeaderboardScreen.tsx` | Challenge-level leaderboard |
| `src/features/Challenges/ChallengeCompletedScreen.tsx` | Post-completion screen |
| `src/features/Groups/GroupLeaderboardScreen.tsx` | Group-level leaderboard |
| `src/features/Workouts/WorkoutLoggedScreen.tsx` | Post-logging confirmation |
| `src/features/Workouts/SelectChallengeActivityScreen.tsx` | Activity picker + session routing |
| `src/hooks/useWorkouts.ts` | `useChallengeProgress` hook |
