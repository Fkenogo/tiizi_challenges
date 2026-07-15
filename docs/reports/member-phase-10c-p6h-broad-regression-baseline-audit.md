# Broad Regression Baseline Audit
**Branch:** `fix/p0-pre-deploy-blockers`
**Date:** 2026-06-24
**Scope:** Member-facing app — scoring model, completion logic, UI correctness, leaderboards, home feed, creation flows, navigation

> **Read-only audit. No code was modified.**

---

## Audit Summary

| Category | Count |
|---|---|
| Confirmed regressions (was working, now broken) | 3 |
| Confirmed missing features (never fully implemented on branch) | 5 |
| Confirmed correct (no action needed) | 9 |
| Data-only issues (require prod write approval) | 1 |

---

## 1. Scoring Model Integrity

### 1.1 Formula — CORRECT ✅
`scoringConfig.ts → computeActivityScore`: `round(min(value/target, 1) × 100)`, cap 100, floor at `MIN_EFFORT_RATIO (0.05)`. Matches the CRIT-3 Phase 2 unified formula.

### 1.2 workoutService.ts — CORRECT ✅
- Calls `computeRequiredLogs(durationDays, activityCount)` for `totalActivities`
- `nextCompleted = min(alreadyCompleted + 1, totalActivities)` — correctly capped
- `nextRate = min(100, round(nextCompleted / totalActivities * 100))`
- Guard: `if (membership.status === 'completed') throw` — prevents double-completion
- `scoringVersion: 'v2'` stamped on all log writes

### 1.3 wellnessLogService.ts — CORRECT ✅
Same scoring path as workoutService. Calls `computeActivityScore` and writes `totalPoints` increment identically.

### 1.4 firestore.rules totalActivities computation — CORRECT ✅
Uses `effectiveDays` intermediate variable (`let effectiveDays = durationDays < 1 ? 1 : durationDays;`) and multiplies `activityCount * effectiveDays`. Guard script regex updated in Phase 3A to accept either form.

---

## 2. Completion Logic

### 2.1 Category A memberships — DATA ISSUE ⚠️ (requires prod write approval)
7 memberships have `totalActivities: 0` from the creator auto-join bug (old code path). `workoutService` computes `nextCompleted = min(0+1, 1) = 1`, `nextRate = 100%` → `status: 'completed'` on first log.

- **Root cause:** old code path, not current code
- **Fix payload:** validated in `docs/reports/member-phase-10c-p6h-task4c-repair-payload-validation.md`
- **Status:** NOT applied — awaiting explicit prod write approval
- **Mitigation needed:** `totalActivities <= 0` guard in `workoutService.ts` and `wellnessLogService.ts` (safe, no prod write, prevents recurrence for future bad-state memberships)

### 2.2 computeRequiredLogs — CORRECT ✅
`max(1, days) × max(1, activityCount)` — floors both inputs at 1. Correct.

### 2.3 deriveDailyTargetValue — CORRECT ✅
Streak only: divides cumulative `targetValue / durationDays` if result ≥ 1. All other types return raw `targetValue`.

---

## 3. Post-Log Success Screen (WorkoutLoggedScreen)

### 3.1 Completion bar — REGRESSION ❌
**File:** `src/features/Workouts/WorkoutLoggedScreen.tsx`

`completion` is computed as `totalValue / target` where `totalValue = sum of workout.value` (raw cumulative value across all session logs). This uses the **old value-based model**, not the log-count model introduced in CRIT-3 Phase 2.

The correct computation should be `activitiesCompleted / totalActivities` (available on `membership`), matching what `workoutService` writes and what leaderboards display.

- **Impact:** progress bar can show > 100% (overperformance), or wildly incorrect % for unit-mismatched activities (e.g., reps vs. minutes)
- **Fix scope:** replace raw `sum(workout.value) / target` with `membership.activitiesCompleted / membership.totalActivities`

### 3.2 Points shown as text labels only — MISSING FEATURE (never implemented)
Points earned are passed as URL param but displayed only as qualitative labels ("Target met", "Partial points earned", "Target not met"). The numeric point value (e.g., "72 pts") is not shown. This was never implemented on the branch; no regression.

### 3.3 Points earned value — CORRECT ✅
`computeActivityScore` is called client-side in the log screens and the `points` URL param is written correctly. The value itself is accurate; only the display is missing.

---

## 4. Challenge Completed Screen (ChallengeCompletedScreen)

### 4.1 completionPct — REGRESSION ❌
**File:** `src/features/Challenges/ChallengeCompletedScreen.tsx`

`completionPct = uniqueDays / totalDays` — counts unique calendar days with any log, compared against the challenge's total day count. This is the old "streak days" model.

The correct computation is `membership.activitiesCompleted / membership.totalActivities × 100`, which aligns with what `workoutService` tracks and what triggered the `status: 'completed'` transition.

- **Impact:** for non-streak challenges (collective, competitive), the displayed % may not match how completion was actually determined
- **Fix scope:** replace unique-days calculation with `membership.activitiesCompleted / membership.totalActivities`

### 4.2 totalValue display — KNOWN MISMATCH (cosmetic only)
`totalValue = sum of workout.value` (raw reps/minutes) is displayed as a secondary stat. This is cosmetic context, not the completion criterion. Low priority.

### 4.3 points — CORRECT ✅
`membership.totalPoints` used directly. Correct.

---

## 5. Home Screen Feed

### 5.1 My Challenges progress — CORRECT ✅
Uses `membership.completionRate` (denormalized, written by workoutService on each log). Correct data source. Edge case: can show 100% while challenge is still ongoing if member submitted all required logs early — this is accurate, not a bug.

### 5.2 myChallenges filter — CORRECT ✅
Filtered by `isChallengeOngoing` AND membership status not `abandoned/left/rejected`. Up to 3. Correct.

### 5.3 Most Popular — "Log Workout" shown for completed members — REGRESSION ❌
**File:** `src/features/Home/useHomeScreen.ts`

`actionLabel` on Most Popular cards is determined by `membershipIndex.get(id) === 'active'`. Members with `status: 'completed'` return `false` from this check and fall through to the default label ("Log Workout" or "Join").

- **Impact:** a completed member sees "Log Workout" on Most Popular challenges they've already finished; tapping it will navigate to log flow which is gated by the service-layer guard (will throw), but the UX is incorrect
- **Fix scope:** extend `actionLabel` logic to check `membershipIndex.get(id) === 'completed'` → show "Completed" or "View Progress"

---

## 6. Leaderboards

### 6.1 ChallengeLeaderboardScreen — CORRECT ✅
Queries `challengeMembers.totalPoints` directly via `useChallengeLeaderboard`. Correct data source post-CRIT-3.

### 6.2 GroupLeaderboardScreen — CORRECT ✅
`useGroupLeaderboard` → `groupInsightsService.getGroupLeaderboard()` → sums `totalPoints` across all `challengeMembers` where `groupId == groupId`. Correct. No per-challenge filter tab (was never implemented — not a regression).

### 6.3 ChallengeDetailScreen inline leaderboard — CORRECT ✅ (fixed Phase 3A)
Now uses `useQuery` against `challengeMembers.totalPoints`. Fixed.

---

## 7. Challenge Creation Flows

### 7.1 Frequency picker — MISSING FEATURE (not a regression)
**File:** `src/features/Challenges/CreateChallengeWizard.tsx:853`

`{isWellnessMode && (...)}` wraps the frequency dropdown. Fitness activities (`isWellnessMode = false`) never see a frequency picker. This was never implemented for fitness on this branch. Needs a design decision before fixing.

### 7.2 Points input — CORRECT ✅
Points are auto-calculated ("Auto-calculated based on challenge target") — no manual input. Correct per CRIT-3 spec.

### 7.3 Admin CreateChallengeScreen — CORRECT ✅
Calls `adminChallengeService` which correctly sets `scoringMethod: 'proportional_capped'` and writes `durationDays`/`activityCount` for the completion formula.

---

## 8. Navigation & Quick Actions

### 8.1 Log Activity — missing challengeId — MISSING FEATURE (by design, needs UX decision)
**File:** `src/features/QuickActions/QuickActionsScreen.tsx:21`

`logActivityPath = /app/workouts/select-activity?groupId=${defaultGroupId}` — no `challengeId`. When `SelectChallengeActivityScreen` receives no `challengeId`, it shows "No challenge activities found."

Root cause: Quick Actions has no concept of "current challenge." Fixing requires either (a) picking the user's most recent active challenge, or (b) adding a challenge picker step. UX decision required.

### 8.2 SelectChallengeActivityScreen multi-activity tracking — CORRECT ✅
`loggedActivityIndexes` accumulated via URL params; `allLogged` gated on `loggedActivityIndexes.length >= activities.length`. Correct.

### 8.3 Routes — CORRECT ✅
All routes verified in `src/App.tsx`. No dead routes. All challenge/workout/leaderboard routes registered.

---

## 9. Build & Test Status

All checks passing at time of audit:

| Check | Result |
|---|---|
| `tsc --noEmit` | ✅ PASS (0 errors) |
| `vite build` | ✅ PASS |
| `test:home-challenge-feeds` | ✅ PASS |
| `test:scoring-guards` | ✅ PASS (Phase 3A regex fix applied) |
| `functions build` | ✅ PASS |

---

## 10. Prioritized Fix Queue

### Tier A — Regressions (no prod writes required)

| # | Issue | File | Risk |
|---|---|---|---|
| A1 | WorkoutLoggedScreen completion bar uses raw value sum | `src/features/Workouts/WorkoutLoggedScreen.tsx` | Low |
| A2 | ChallengeCompletedScreen completionPct uses uniqueDays model | `src/features/Challenges/ChallengeCompletedScreen.tsx` | Low |
| A3 | Home Most Popular shows "Log Workout" for completed members | `src/features/Home/useHomeScreen.ts` | Low |
| A4 | `totalActivities <= 0` guard missing in log services | `workoutService.ts`, `wellnessLogService.ts` | Low — prevents recurrence |

### Tier B — Missing features (needs design decision)

| # | Issue | File | Blocker |
|---|---|---|---|
| B1 | Frequency picker absent from fitness challenge creation | `CreateChallengeWizard.tsx` | Design decision |
| B2 | Quick Action "Log Activity" has no challengeId | `QuickActionsScreen.tsx` | UX decision (challenge picker?) |
| B3 | Points not shown as number on WorkoutLoggedScreen | `WorkoutLoggedScreen.tsx` | None — trivial |

### Tier C — Deferred (prod write or separate approval required)

| # | Issue | Owner |
|---|---|---|
| C1 | Repair 7 Category A memberships (totalActivities: 0) | Requires prod write approval |

---

## Confirmation

- No code was modified during this audit.
- All data was gathered from read-only file inspection and local test runs.
- Phase 3A fixes (scoring guard regex, CTA completed branch, leaderboard snapshot) are already applied and included in the "CORRECT" assessments above.
