# Phase 10C-P5Q — Scoring Model Consolidation Audit

**Date:** 2026-06-19  
**Branch:** fix/p0-pre-deploy-blockers  
**Type:** Audit only — no production code changed  
**Validation:** scoring guards ✅ · TypeScript clean ✅ · build clean ✅

---

## Executive Summary

The scoring engine (v2) is fully normalized: every log path computes `pointsEarned` from `normalizedBase = Math.round(100 / totalActivities)`, ignoring `pointsPerCompletion`. However, `pointsPerCompletion` is still:

- **written to Firestore** on every challenge/template create or update (via both member and admin flows)
- **displayed as an editable input** in both `CreateChallengeWizard` and admin `CreateChallengeScreen`
- **passed into `ActivitySessionEntry.points`** by `SelectChallengeActivityScreen`, though that field is now ignored by `activityLogSessionService`

Three secondary reward constructs (`bonusConditions`, `STREAK_BONUS_PER_WEEK`, `streakBonus`) are defined but **never wired** into any live log path.

**Recommendation: Option B — remove `pointsPerCompletion` from UI and creation flows.** The field is inert in scoring; keeping the UI input creates a misleading admin experience. The field can remain in the Firestore data model as `optional` for backwards compatibility with existing challenge docs.

---

## 1. Complete Dependency Map

### 1.1 `pointsPerCompletion`

| File | Role | Category |
|------|------|----------|
| `src/types/index.ts:108` | `Challenge.activities[].pointsPerCompletion?: number` | B — data model |
| `src/types/index.ts:178` | `ChallengeTemplate.activities[].pointsPerCompletion?: number` | B — data model |
| `functions/src/challengeCreationBackend.ts:40,199` | Validated and passed through to Firestore when challenge is created/updated | B — persisted |
| `src/services/challengeTemplateService.ts:46,94,160` | Typed and mapped in template CRUD | B — persisted |
| `src/services/challengeService.ts:56` | Typed in `ChallengeActivity` | B — data model |
| `src/services/adminChallengeService.ts:57,280,356,394,608` | Read from Firestore, forwarded in CRUD payloads | B — persisted |
| `src/services/wellnessTemplateService.ts:100` | Defaults to `10` when persisting wellness template | B — persisted |
| `src/hooks/useAdminChallenges.ts:139` | Typed in admin challenge hook | B — data model |
| `src/features/Challenges/CreateChallengeWizard.tsx:36,232,347,507,934,935` | Local state; written to challenge payload; rendered as `<input>` in UI | A+B — UI + persisted |
| `src/features/Admin/Challenges/CreateChallengeScreen.tsx:36,57,145,231,335,537,631,632` | Same as above, admin variant | A+B — UI + persisted |
| `src/features/Admin/Challenges/ChallengeTemplatesScreen.tsx:26` | Hardcoded to `10` in template seed data | A — UI default |
| `src/features/Workouts/SelectChallengeActivityScreen.tsx:19,195,207,220` | Read from activity; set as `entry.points`; **no longer used by scoring engine** | E — legacy/dead |
| `scripts/diagnoseProductionActivitySession.mjs:112` | Diagnostic script uses it as a points hint | E — script only |
| `scripts/diagnoseActivitySessionRules.ts:30` | Typed in diagnostic script | E — script only |

### 1.2 `defaultPoints`

| File | Role | Category |
|------|------|----------|
| `src/types/wellnessActivity.ts:69` | `WellnessActivity.defaultPoints: number` | B — data model |
| `src/data/wellnessActivitiesCatalog.ts:73` | Hardcoded `10` on every catalog entry | B — seeded data |
| `src/services/wellnessActivityService.ts:52` | Read from Firestore, mapped to type | B — persisted read |
| `src/features/Admin/Wellness/WellnessActivityForm.tsx:138,139` | Rendered as editable `<input>` | A — UI only |
| `src/features/Admin/Wellness/wellnessActivityFormUtils.ts:40` | Default value `10` in form init | A — UI default |
| `src/features/Challenges/CreateChallengeWizard.tsx:347` | Maps `activity.defaultPoints` → `pointsPerCompletion` when applying wellness template | A+B — bridges to pointsPerCompletion |
| `src/features/Admin/Challenges/CreateChallengeScreen.tsx:231,537` | Same — `defaultPoints` → `pointsPerCompletion` bridge | A+B — bridges to pointsPerCompletion |

### 1.3 `basePoints` (scoring engine internal)

| File | Role | Category |
|------|------|----------|
| `src/services/scoringConfig.ts:30` | `ComputeActivityScoreInput.basePoints?: number` | C — runtime scoring |
| `src/services/scoringConfig.ts` (all scorers) | Passed through all score functions; defaults to `BASE_POINTS_PER_TARGET = 100` | C — runtime scoring |
| `src/services/wellnessLogService.ts` | `normalizedBase = Math.round(100 / totalActivities)` → passed as `basePoints` | C — runtime scoring |
| `src/services/activityLogSessionService.ts` | Same normalization formula; replaced `entry.points` in P5P | C — runtime scoring |
| `src/services/workoutService.ts` | **NOT passed** — uses `computeActivityScore` with no `basePoints`, defaults to `BASE_POINTS_PER_TARGET = 100` | C — runtime scoring (unnormalized) |

**Note on `workoutService`:** The single-workout log path (`workoutService.logWorkout`) calls `computeActivityScore` with no `basePoints`, so it always uses `BASE_POINTS_PER_TARGET = 100`. For single-activity challenges this is correct. For multi-activity challenges logged one at a time through the direct workout flow, the scoring is not normalized by `totalActivities`. This is a **known gap** but low risk because the direct workout flow is used infrequently for multi-activity challenges (those use `SelectChallengeActivityScreen` → `activityLogSessionService`).

### 1.4 `totalPoints`

| File | Role | Category |
|------|------|----------|
| `src/types/index.ts:47,231` | `ChallengeMember.totalPoints` | B — authoritative Firestore field |
| `src/services/challengeService.ts:104,267,367,396,452` | Read and initialized to `0` on join | B — persisted read |
| `src/services/wellnessLogService.ts` | `increment(points)` on every wellness log | B — persisted write |
| `src/services/activityLogSessionService.ts` | `increment(totalPoints)` on session save | B — persisted write |
| `src/services/workoutService.ts` | `increment(points)` on every direct workout | B — persisted write |
| `src/features/Challenges/ChallengeCompletedScreen.tsx:56` | Read from membership → displayed | D — display |
| `src/features/Challenges/ChallengeDetailScreen.tsx:341` | Read from membership → displayed | D — display |
| `src/features/Challenges/CompletedChallengesScreen.tsx:52` | Read from membership → displayed | D — display |
| `src/services/activityLogSessionService.ts:382` | Logged in debug output | D — display/debug |
| `functions/src/challengeCreationBackend.ts:339` | Initialized to `0` in join payload | B — persisted write |
| `src/services/activityLogMetrics.ts:65` | Read from individual log doc `points` field (not `totalPoints`) for metrics | D — display |

### 1.5 Reward / Bonus Points

| Field | Defined | Wired | Category |
|-------|---------|-------|----------|
| `STREAK_BONUS_PER_WEEK: 5` | `scoringConfig.ts` | **Not wired** — `currentStreak` never passed to any `computeActivityScore` call | E — dead code |
| `streakBonus` in `scoreStreakActivity` | `scoringConfig.ts` | **Not wired** — function exists but `currentStreak` arg is never supplied | E — dead code |
| `bonusConditions` on `WellnessActivity` | `wellnessActivitiesCatalog.ts`, `wellnessActivityService.ts` | **Not wired** — read from Firestore and typed, but never evaluated in any log path | E — dead code |
| Completion reward (100% → `status: 'completed'`) | All three log services | **Active** — sets `status='completed'` and `completedAt` when `completionRate >= 100` | C — active |
| Milestone rewards (e.g., "7-day streak = 50 pts") | `bonusConditions` array in catalog | **Not wired** — no evaluator exists | E — dead code |

---

## 2. Firestore Field Inventory

### Fields still written to `challenges.activities[]`:
- `pointsPerCompletion` — written by both member (`CreateChallengeWizard`) and admin (`CreateChallengeScreen`, `adminChallengeService`) creation flows. Validated and stored by `challengeCreationBackend` Cloud Function.

### Fields still written to `challengeMembers`:
- `totalPoints` — incremented by all three log services on every activity log (**active, authoritative**)
- `activitiesCompleted` — incremented on every log (**active**)
- `completionRate` — recomputed on every log (**active**)
- `status` → `'completed'` — set when `completionRate >= 100` (**active**)

### Fields still written to `wellnessLogs` / `workouts`:
- `points` — the scored value stored per-document. Read by `memberActivitySummaries` Cloud Function to compute leaderboard scores. **Active and required.**

### Fields read but ignored by scoring engine:
- `challenges.activities[].pointsPerCompletion` — read by `SelectChallengeActivityScreen` into `entry.points`, but `activityLogSessionService` now ignores `entry.points` and uses `normalizedBase` instead. **Ignored at runtime.**
- `wellnessLogs.points` / `workouts.points` as `entry.points` hint passed to session service — **ignored** since P5P.

### Fields that would break existing challenges if removed:
None. `pointsPerCompletion` is optional (`?:`) in all TypeScript types and its absence would simply cause the scoring default (`100 / totalActivities`) to apply, which is the desired behavior. Challenge docs already on Firestore with stored `pointsPerCompletion` values are unaffected because the scoring engine never reads them.

---

## 3. Full Trace: Where `pointsPerCompletion` Enters and Stops

```
CreateChallengeWizard / CreateChallengeScreen
  → local state: activity.pointsPerCompletion (from user input, default 10)
  → challenge payload: activities[].pointsPerCompletion
  → challengeCreationBackend (Cloud Function)
      → validates range [0, 100000]
      → writes to Firestore: challenges/{id}.activities[].pointsPerCompletion
  
Challenge retrieval (challengeService / adminChallengeService)
  → reads activities[].pointsPerCompletion from Firestore
  → types it in ChallengeActivity

SelectChallengeActivityScreen
  → reads activity.pointsPerCompletion → sets entry.points = pointsPerCompletion ?? 10
  → passes entries to activityLogSessionService

activityLogSessionService                       ← SCORING ENGINE IGNORES entry.points
  → computes normalizedBase = Math.round(100 / totalActivities)
  → computeActivityScore({ basePoints: normalizedBase })     ← entry.points NEVER READ
  → writes workouts/{id}.points = scoring.pointsEarned       ← normalized value
  → increments challengeMembers.totalPoints

wellnessLogService / workoutService (direct paths)
  → do NOT read pointsPerCompletion at all
  → compute normalizedBase from challenge.activities.length and membership.totalActivities
  → computeActivityScore({ basePoints: normalizedBase })
  → writes log.points = scoring.pointsEarned                 ← normalized value

memberActivitySummaries (Cloud Function trigger)
  → reads log.points (the normalized value)                  ← ignores pointsPerCompletion
  → writes activitySummaries for leaderboard

leaderboard / ChallengeDetailScreen
  → reads activitySummaries or challengeMembers.totalPoints  ← ignores pointsPerCompletion

ChallengeCompletedScreen
  → reads membership.totalPoints                             ← ignores pointsPerCompletion
```

**`pointsPerCompletion` stops affecting anything after being written to Firestore.** It is stored but never read by the scoring engine, log services, Cloud Functions, leaderboard, or completion screen.

---

## 4. Wellness Rewards Audit

| Reward | Mechanism | Status | Detail |
|--------|-----------|--------|--------|
| `defaultPoints` per activity | `WellnessActivity.defaultPoints = 10` | **Partially active** | Written to Firestore, bridged to `pointsPerCompletion` in challenge creation — but scoring engine ignores it |
| Streak bonus | `scoreStreakActivity` + `STREAK_BONUS_PER_WEEK = 5` | **Unused** | `currentStreak` parameter never passed; no log service reads or passes streak state |
| Challenge completion bonus | `status = 'completed'` when `completionRate >= 100` | **Active** | All three log services set this; no extra point bonus attached (completion is a status change only) |
| Milestone rewards (7-day = 50 pts, completion = 150 pts) | `bonusConditions` array on `WellnessActivity` | **Unused** | Defined in catalog, stored in Firestore, but no evaluator in any log path |
| 1.5× cap on over-delivery | `CUMULATIVE_VALUE_CAP_RATIO = 1.5` in `scoreCumulativeActivity` | **Active** | Limits cumulative scoring to 150% of base |
| 3× cap on competitive over-delivery | `COMPETITIVE_VALUE_CAP_RATIO = 3` | **Active** | Value capped at 3× target before ratio scoring |

**Summary:** Only the completion-status transition and the value caps are truly active. Streak bonuses and milestone bonuses are dead code — defined but never invoked.

---

## 5. Recommended Architecture: Option B — Remove `pointsPerCompletion` from UI

### Option A: Keep as admin weighting tool

**What it would require:** Re-wire `pointsPerCompletion` into `computeActivityScore` as the `basePoints` argument in all three log services. Remove the `normalizedBase` formula. Admin sets per-activity weight (e.g., "Sleep = 60 pts, Hydration = 40 pts") for a combined 100.

**Pros:** Admin flexibility; activity-specific weighting.  
**Cons:** Complexity; admin must ensure weights sum to 100; easy to misconfigure; the normalization guarantee breaks.

### Option B: Remove from UI; keep field as inert data

**What it means:** Remove the "Points" input from both `CreateChallengeWizard` and `CreateChallengeScreen`. Remove `defaultPoints` input from `WellnessActivityForm`. Keep the type declarations and Firestore pass-through so existing documents with stored values aren't rejected. Scoring stays on `100 / totalActivities`.

**Pros:**
- Eliminates the most confusing UI affordance (admin sets "10 points" but the engine ignores it and uses 100)
- Zero risk to existing challenges — the field is optional and unused at runtime
- Simplifies both creation wizards by removing one form row per activity
- Aligns UI with actual scoring behavior immediately

**Cons:** Loss of per-activity weighting capability (not currently implemented anyway). Would need to be reinstated if Option A is ever chosen.

**Recommendation: Option B.** The field is already inert. Showing a "Points: 10" input that has no effect is actively misleading to admins. Removal eliminates the confusion with zero scoring impact.

---

## 6. Removal Risk Assessment

| Item | Risk on removal | Mitigation |
|------|----------------|-----------|
| `pointsPerCompletion` from UI inputs | None — scoring engine ignores it | Remove inputs in `CreateChallengeWizard` and `CreateChallengeScreen` |
| `pointsPerCompletion` from Firestore writes | None — Cloud Function strips undefined; existing docs unaffected | Type field as `optional`, omit from payload |
| `pointsPerCompletion` from TypeScript types | None if kept as `?: number` | Leave in types for backwards compatibility with existing Firestore docs |
| `entry.points` field in `ActivitySessionEntry` | None — ignored by `activityLogSessionService` since P5P | Can remove field or keep as deprecated hint |
| `defaultPoints` from `WellnessActivity` | None in scoring; removes from admin form display | Keep type declaration; remove form input |
| `bonusConditions` array | None — never evaluated | Safe to remove from catalog and type; removes dead Firestore writes |
| `STREAK_BONUS_PER_WEEK` in `scoringConfig` | None — never invoked | Safe to remove; cleanup only |
| `workoutService` missing `normalizedBase` | Low risk — correct for single-activity challenges | Track as follow-up: pass `normalizedBase` to `workoutService.logWorkout` for consistency |

---

## 7. Files Requiring Change in Option B Implementation

| File | Change |
|------|--------|
| `src/features/Challenges/CreateChallengeWizard.tsx` | Remove "Points" `<input>` row; remove `pointsPerCompletion` from local state type; remove from challenge payload |
| `src/features/Admin/Challenges/CreateChallengeScreen.tsx` | Same |
| `src/features/Admin/Wellness/WellnessActivityForm.tsx` | Remove `defaultPoints` form input |
| `src/features/Admin/Wellness/wellnessActivityFormUtils.ts` | Remove `defaultPoints: 10` default |
| `src/features/Workouts/SelectChallengeActivityScreen.tsx` | Remove `basePoints = Number(optional.pointsPerCompletion ?? 10)` and `points: basePoints` from entries |
| `src/services/scoringConfig.ts` | Remove `basePoints` comment `// from activity.pointsPerCompletion`; optionally remove `STREAK_BONUS_PER_WEEK` if streak is confirmed dead |
| `src/data/wellnessActivitiesCatalog.ts` | Remove `defaultPoints: 10` and `bonusConditions` from catalog entries (optional, low priority) |

**Do not change:**
- `src/types/index.ts` — keep `pointsPerCompletion?: number` for backwards compat
- `functions/src/challengeCreationBackend.ts` — keep validation pass-through (harmless if field is absent)
- All log services — scoring is already correct
- `totalPoints` anywhere — it is the authoritative Firestore field

---

## 8. Validation Results

```
✅ npm run test:scoring-guards    scoring guards passed
✅ npx tsc -b --pretty false      (no output — clean)
✅ npm run build                  ✓ built in 3.11s
```

No code changes made in this phase.
