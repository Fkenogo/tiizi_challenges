# CRIT-3 Phase 3B — Focused Regression Audit

**Date:** 2026-06-24  
**Branch:** fix/p0-pre-deploy-blockers  
**Scope:** Post-Phase-3A regression audit covering challenge detail CTA logic, logging flow, challenge creation/templates, leaderboards, and bottom nav quick actions.

---

## 1. Validation Results

| Command | Result |
|---------|--------|
| `npx tsc -b --pretty false` | ✅ PASS (0 errors) |
| `npm run build` | ✅ PASS |
| `npm run test:home-challenge-feeds` | ✅ PASS |
| `npm run test:scoring-guards` | ✅ PASS |
| `cd functions && npm run build` | ✅ PASS |

No code changes made. All files read-only.

---

## 2. Executive Summary

Phase 3A fixed 3 of the most critical regressions but left behind a cluster of **related structural issues that were never implemented** — they were deferred, bypassed, or partially implemented in CRIT-3 Phase 2. No Phase 3A changes introduced new regressions. The issues below are pre-existing gaps in the working tree, not breakage caused by recent edits.

**Critical issues (blocking normal usage):**

1. **"Challenge already completed" blocks logging on active ongoing challenges** — the membership status is being set to `'completed'` after `activitiesCompleted >= totalActivities`, and the logging services refuse any further logs with that status. For challenges where `totalActivities` is small relative to `durationDays` (e.g. 1 activity × 30 days = 30 total, but a user logs 31 times they are blocked on day 2 of week 2), this fires mid-challenge.

2. **"Challenge Completed" CTA is shown for any member whose `activitiesCompleted >= totalActivities`** — even if the challenge is still 20 days active. The Phase 3A fix correctly separates `membership.status === 'completed'` from the join button, but the root cause (`status` being set too early because `totalActivities` is wrong for some memberships) remains unfixed.

3. **`My Logs > Total Logs` is still possible** — `myLogs` = raw count of individual workout + wellness documents (each log is 1). `totalLogs` = sum of `activitiesCompleted` across `challengeMembers` (each member field, not individual docs). These count different things and will diverge whenever a user logs multiple times.

4. **Frequency dropdown only appears in wellness mode** — fitness challenge activities have no frequency selector in the creation wizard, even though the type system and backend both support it.

5. **Quick action "Log Activity" shows "No challenge activities found"** — the path navigates to `SelectChallengeActivityScreen` with only a `groupId`, no `challengeId`. The screen then finds no activities because it has no challenge to load.

---

## 3. Regression Map by Feature

### 3.1 — Challenge Detail Screen CTA Logic

**Current state (post-Phase-3A, ChallengeDetailScreen.tsx lines 335–401):**

```
membership?.status === 'completed'         → 🎉 Challenge Completed  ← NEW in Phase 3A
(!membership || status !== 'active') && challengeIsOver  → "This challenge has ended."
!membership || status !== 'active'         → Join Challenge
requiresApproval                           → Awaiting Approval
hasEnded (calendar date)                   → Completed (disabled)
canLogWorkout                              → Log Workout / Log Activity
else                                       → Remind Me
```

**The `'completed'` branch fires incorrectly when:**
- `membership.status` is written as `'completed'` by `workoutService.ts` or `wellnessLogService.ts` at line 157 / 142 respectively, the condition is `nextRate >= 100`, i.e. `activitiesCompleted >= totalActivities`.
- `totalActivities` = `computeRequiredLogs(durationDays, activityCount)` = `durationDays × activityCount`.
- For a 30-day challenge with 1 activity/day = totalActivities 30. Once 30 logs are posted, status = 'completed'. If that happens on day 15 (2 logs/day), the challenge is still active for 15 more days and the CTA shows "🎉 Challenge Completed" and blocks the log button.
- **For memberships that had `totalActivities: 0` (the creator auto-join bug fixed in CRIT-3 Phase 2 for new challenges, but not backfilled for existing ones):** `Math.min(count + 1, 0)` = 0. But `computeRequiredLogs` recalculates fresh on each log write, so `totalActivities` in the `membershipUpdate` becomes correct for new logs. The status is set when `nextRate >= 100`, i.e. `nextCompleted / totalActivities >= 1` i.e. when `1 / totalActivities >= 1` i.e. totalActivities ≤ 1. A membership with `totalActivities: 0` that gets one log immediately receives `nextCompleted = min(0+1, 1) = 1`, `nextRate = min(100, round(1/1*100)) = 100`, so `status = 'completed'` **on the very first log.** This is the root cause of "Challenge already completed" on the first log attempt for the 7 Category A memberships.

**Missing fields on Challenge Detail page:**
The current ChallengeDetailScreen shows:
- ✅ status label (Scheduled / Ongoing / Completed based on calendar dates)
- ✅ start/end dates, duration in days
- ✅ activities list with target value and frequency label
- ✅ "How Points Work" text blurb
- ✅ My Logs / Total Logs / Participants
- ✅ Leaderboard Snapshot (now uses totalPoints — Phase 3A fix)
- ❌ **Challenge type** (collective / competitive / streak) — not displayed
- ❌ **Mode** (fitness / wellness) — not displayed
- ❌ **Current day** of the challenge (e.g. "Day 7 of 30")
- ❌ **Daily target per activity** clearly labelled as "per-session target" vs cumulative

### 3.2 — `My Logs > Total Logs`

**Root cause:**

`useChallengeProgress` (hooks/useWorkouts.ts lines 30–67):
- `myLogs` = raw Firestore document count from `workouts` + `wellnessLogs` for this user and challenge. Each log call = +1 document.
- `totalLogs` = sum of `challengeMembers[].activitiesCompleted`. Each member field is capped at `totalActivities` by `Math.min(alreadyCompleted + 1, totalActivities)`.

**Divergence scenario:** User logs 5 times (5 workout docs). Their `activitiesCompleted` field is capped at `totalActivities` (e.g. 3). `myLogs = 5`, `totalLogs` = sum of everyone's capped `activitiesCompleted`. If this user is the only participant, `totalLogs = 3` while `myLogs = 5`. My Logs > Total Logs.

**Fix required:** Either align the two counting methods, or clearly label them as different things ("My logs submitted" vs "Completions counted toward goal").

---

### 3.3 — Logging Flow

**Fitness challenge logging:**
- Entry point: `ChallengeDetailScreen` → "Log Workout" button → `/app/workouts/select-activity?challengeId=X&groupId=Y`
- `SelectChallengeActivityScreen.tsx` shows the list of challenge activities. Each "Log" button routes to either `/app/workouts/log` (fitness) or `/app/workouts/log-wellness` (wellness).
- `LogWorkoutScreen.tsx` — single activity per navigation. Uses `+/-` buttons, a numeric `<input type="number">`, and a native `<select>` with 1001 options as a "quick picker." **Three competing input methods.**

**Wellness challenge logging:**
- Same `SelectChallengeActivityScreen` entry. Detects wellness via `challenge.category !== 'fitness'` or presence of `activityType`. Routes to `/app/workouts/log-wellness`.
- `LogWellnessActivityScreen.tsx` — same value picker pattern: `+/-`, then `<select>` with unit-appropriate range. No `<input type="number">`.

**Multi-activity logging:**
- `SelectChallengeActivityScreen` tracks `loggedActivityIndexes` via URL params (`?loggedActivityIndexes=0,1`). After all activities are logged, a "View Session Results →" button appears (`handleSessionComplete`).
- **This is not rollback — this IS the multi-activity flow.** Each activity navigates away and returns to `SelectChallengeActivityScreen` (via `buildActivitySuccessPath` → back navigation). The tracking is done via URL params appended on success.
- **Gap:** After logging from `WorkoutLoggedScreen` or `ActivityLoggedScreen`, does the back path correctly include the accumulated `loggedActivityIndexes`? This depends on `buildActivitySuccessPath` appending those params.

**"Challenge already completed" on ongoing challenges:**
- `workoutService.ts:105` and `wellnessLogService.ts:84-85`: Guard `if (membership.status === 'completed') throw new Error('Challenge already completed.')`.
- Once `status` is set to `'completed'` (see §3.1 root cause above), any further log attempt from any screen hits this guard. The error bubbles up to `LogWorkoutScreen.handleSave` or `LogWellnessActivityScreen.handleSave` and shows as a toast: "Challenge already completed."
- **Root cause is the `totalActivities` calculation**, not the guard itself.

**Same-day logging:**
- No deduplication guard exists in either `workoutService.ts` or `wellnessLogService.ts`. A user can log the same activity multiple times per day, each write increments `activitiesCompleted` and earns more points.
- Intentionally deferred (Tier C). Not a regression.

**Value picker regression:**
- The agreed "scroll/drum picker" was **never committed** to this branch. The current state has always used `<select>` + `+/-` + `<input type="number">`. `LogWorkoutScreen.tsx` has three simultaneous input methods (line 127-167); `LogWellnessActivityScreen.tsx` has two (line 135-156: `+/-` + `<select>`).
- This is a gap from the original spec, not a regression introduced by Phase 3A.

---

### 3.4 — Challenge Creation / Template Flow

**Quick action → Create Challenge:**
- `QuickActionsScreen.tsx` line 55-79: "Create Challenge" → if 1 group, navigates directly to `/app/create-challenge?groupId=X`. If multiple groups, shows a group picker first.
- `/app/create-challenge` route opens `CreateChallengeWizard.tsx`.
- **There is no choice between "from template", "custom fitness", or "custom wellness"** at the quick action level. The wizard itself handles templates via `?templateId=` or `?wellnessTemplateId=` URL params, but the quick action entry point skips that selection entirely. Users must find templates through BrowseChallengesScreen, not through the quick action button.

**Template mode / challenge type form:**
- All in `CreateChallengeWizard.tsx`. The mode is set by `challengeCategory` state (line 113): defaults to `'fitness'`. `isWellnessMode = challengeCategory !== 'fitness'`. The UI shows a category selector that includes `'wellness'`, `'fasting'`, `'hydration'`, `'sleep'`, etc.
- The challenge type (collective / competitive / streak) is set via `typeOptions` selector at the top of the wizard.
- Both are present in the wizard but are not offered as a pre-selection on the quick action screen.

**Frequency — fitness vs wellness:**
- `CreateChallengeWizard.tsx` line 853: The frequency dropdown is inside `{isWellnessMode && (...)}` — **only rendered for wellness mode, not fitness mode.**
- Fitness activities have target value + unit only; no frequency.
- **This is the bug.** Both modes should support frequency. The type system (`ActivityRow['frequency']`) and all downstream types already include it.

**Points field:**
- ✅ No manual points input exists. Line 870: shows "Points — Auto-calculated based on challenge target." No editable field. Correct.

---

### 3.5 — Leaderboards

| Leaderboard | Component | Service | Data Source | Status |
|---|---|---|---|---|
| Group overall | `GroupLeaderboardScreen.tsx` | `groupInsightsService.getGroupLeaderboard()` | `challengeMembers.totalPoints` (summed across all challenges per user) | ✅ Correct |
| Full challenge leaderboard | `ChallengeLeaderboardScreen.tsx` | Inline `useQuery` → `challengeMembers.totalPoints` | ✅ Correct (Phase 2 fix) |
| Challenge detail snapshot | `ChallengeDetailScreen.tsx` | Inline `useQuery` → `challengeMembers.totalPoints` | ✅ Correct (Phase 3A fix) |
| Group challenge-specific | None exists | — | ❌ Missing |

**Group leaderboard is "overall only" — no per-challenge view:**
- `GroupLeaderboardScreen` shows aggregated points across all challenges in the group, per user. There is no way to filter by a specific challenge.
- `GroupDetailScreen` has a challenges tab showing individual challenges. Clicking through goes to `ChallengeDetailScreen` → "View Full Rankings" → `ChallengeLeaderboardScreen`. The challenge leaderboard IS accessible but only via the challenge detail path, not from the group leaderboard screen.

**"Generic/old" group leaderboard UI:**
- The UI at `GroupLeaderboardScreen.tsx` shows a podium (top 3) and a ranked list. It does work and uses real `totalPoints`. The "old" appearance is because the UI itself has not been redesigned — the underlying data is correct.

---

### 3.6 — Bottom Nav Quick Action

**Current quick actions (`QuickActionsScreen.tsx`):**
1. Create Group → `/app/create-group`
2. Create Challenge → `/app/create-challenge?groupId=X` (single group) or group picker (multi)
3. Log Activity → `/app/workouts/select-activity?groupId=X` (if defaultGroupId exists)
4. Browse Exercises → `/app/exercises`
5. Set Daily Goals → `/app/home?focusGoals=1`

**"Log Activity" → "No challenge activities found":**
- Root cause: `logActivityPath = /app/workouts/select-activity?groupId=${defaultGroupId}` — **no `challengeId` param is included.**
- `SelectChallengeActivityScreen.tsx` line 15: `const challengeId = params.get('challengeId') ?? undefined`. Without `challengeId`, `useChallenge(undefined)` returns null.
- Line 18-32: `activities` derived from `challenge?.activities` and `challenge?.exerciseIds` — both undefined when challenge is null. Result: `activities = []`.
- Line 211-214: Empty state renders "No challenge activities found yet. Ask your group admin to configure challenge activities."
- **The fix:** Quick action should either ask the user which challenge to log against, or navigate to a challenge picker first, then proceed to SelectChallengeActivityScreen with a valid `challengeId`.

**Missing quick actions (were they ever in scope?):**
- "Create from existing template" — never in QuickActionsScreen. It was always accessed via BrowseChallengesScreen → template card → CreateChallengeWizard.
- "Create custom fitness challenge" / "Create custom wellness challenge" — not separate quick actions. The wizard handles both modes via category selection internally.
- These are **design gaps, not regressions**.

---

## 4. Exact Files/Components/Services Involved

### CTA / Membership State
- `src/features/Challenges/ChallengeDetailScreen.tsx` — CTA logic, "completed" branch
- `src/services/workoutService.ts:105,150-158` — sets `status: 'completed'` when `nextRate >= 100`
- `src/services/wellnessLogService.ts:84-85,140-143` — same guard + status set
- `src/services/challengeCompletion.ts` — `computeRequiredLogs(durationDays, activityCount)`
- `functions/src/challengeCreationBackend.ts` — creator auto-join `totalActivities` (fixed for new; old memberships still affected)

### My Logs vs Total Logs
- `src/hooks/useWorkouts.ts:30-67` — `useChallengeProgress`: `myLogs` = raw doc count, `totalLogs` = capped `activitiesCompleted` sum

### Logging Flow
- `src/features/Workouts/LogWorkoutScreen.tsx` — three input methods; no scroll picker
- `src/features/Workouts/LogWellnessActivityScreen.tsx` — two input methods; no scroll picker
- `src/features/Workouts/SelectChallengeActivityScreen.tsx` — multi-activity session tracking via URL params

### Challenge Creation / Templates
- `src/features/Challenges/CreateChallengeWizard.tsx:853-873` — frequency only rendered in `isWellnessMode`
- `src/features/QuickActions/QuickActionsScreen.tsx:20-22,81-96` — "Log Activity" missing `challengeId`; no template selection step

### Leaderboards
- `src/services/groupInsightsService.ts:196-220` — group leaderboard, correct (totalPoints)
- `src/features/Challenges/ChallengeLeaderboardScreen.tsx` — challenge leaderboard, correct (totalPoints)
- `src/features/Challenges/ChallengeDetailScreen.tsx:67-84` — detail snapshot, correct (Phase 3A fix)
- No per-challenge view within group leaderboard screen

---

## 5. Which Issues Are Related and Must Be Fixed Together

### Cluster A — `totalActivities` / Completion State (fix together)
These all stem from the same root: `totalActivities` being wrong (0 or too small) on some memberships causes `status: 'completed'` to fire prematurely, which blocks the CTA (Phase 3A fixed the CTA display) and blocks further logging (service-level guard).

- Fix 1: Backfill `totalActivities` on the 7 Category A memberships (Task 4C repair — already validated, needs prod write approval)
- Fix 2: Add a `totalActivities <= 0` guard in the logging services so a membership with `totalActivities: 0` doesn't immediately complete
- Fix 3: Consider whether `status: 'completed'` should block re-logging at all, or just prevent the completion bonus being counted twice

These three cannot be partially fixed: fixing the guard without fixing the data leaves existing bad memberships broken; fixing the data without fixing the guard leaves future edge cases unprotected.

### Cluster B — `My Logs vs Total Logs` (standalone)
Independent of Cluster A. The two counts measure different things. Fix is either: (a) align `myLogs` to use `membership.activitiesCompleted` for the current user instead of raw doc count, or (b) rename and explain the discrepancy in the UI. Can be fixed alone without touching Cluster A.

### Cluster C — Frequency in Fitness Mode (standalone)
One-line change: remove `{isWellnessMode && (...)}` wrapper from the frequency `<div>` in `CreateChallengeWizard.tsx`. Independent of all other clusters.

### Cluster D — Quick Action "Log Activity" missing challengeId (standalone)
Requires a UX decision: show a challenge picker, or default to the user's most recently active challenge. Independent of all other clusters.

### Cluster E — Scroll picker (design decision required)
Cannot be implemented without a UX spec for the scroll/drum component. Not a code regression. Deferred until design is approved.

---

## 6. Which Issues Should Be Fixed Separately

| Issue | Fix Separately? | Reason |
|-------|-----------------|--------|
| `totalActivities` backfill (7 memberships) | YES — requires prod write approval | Cluster A root, but gated |
| `totalActivities: 0` guard in logging services | YES — safe code-only fix | Protects future bad data without prod writes |
| `My Logs > Total Logs` display | YES — isolated display fix | No service changes needed |
| Frequency dropdown in fitness mode | YES — 1-line change | No downstream effects |
| Quick action Log Activity missing challengeId | YES — UX decision needed first | Need to decide: challenge picker vs default |
| Scroll/drum value picker | YES — design decision needed | Not a code fix |
| "Create from template" in quick action | YES — product scope decision | Was never in quick action flow |
| Missing fields on challenge detail (type, mode, day N of M) | YES — additive display only | No logic changes |
| Per-challenge leaderboard in group leaderboard screen | YES — new feature, separate scope | Not a regression |

---

## 7. Recommended Fix Order

| Priority | Task | Cluster | Risk |
|----------|------|---------|------|
| 1 | Add `totalActivities <= 0` guard in `workoutService` and `wellnessLogService` so first log cannot mark completion | A | Low — pure guard, no data write |
| 2 | Fix `My Logs vs Total Logs`: align `myLogs` to use `membership.activitiesCompleted` for the current user | B | Low — read-only change in `useChallengeProgress` |
| 3 | Add missing challenge detail fields: type, mode, current day of challenge | Display | Low — additive UI only |
| 4 | Add frequency dropdown to fitness activities in CreateChallengeWizard | C | Low — remove one conditional wrapper |
| 5 | Fix Quick Action "Log Activity": navigate to challenge picker or most recent active challenge | D | Medium — requires UX decision |
| 6 | Backfill `totalActivities` on 7 Category A memberships | A | High — requires prod write approval |
| 7 | Scroll/drum value picker | E | Medium — design decision first |

---

## 8. First Recommended Task Prompt (do not execute)

> **Task: Add `totalActivities <= 0` guard in logging services**
>
> **File 1:** `src/services/workoutService.ts`  
> **File 2:** `src/services/wellnessLogService.ts`
>
> In both files, after `const totalActivities = computeRequiredLogs(...)` is calculated, add a guard:
> ```
> if (totalActivities <= 0) {
>   throw new Error('Challenge is not yet fully configured. Contact your group admin.');
> }
> ```
> This must be inserted BEFORE the `activitiesCompleted` increment and the `nextRate >= 100` completion check. It prevents a membership with `totalActivities: 0` from being marked `'completed'` on the very first log.
>
> Also: the `Math.min(alreadyCompleted + 1, totalActivities)` call should use the freshly computed `totalActivities`, not `membership.totalActivities`. Confirm this is already the case in both files (it is — both services recalculate `totalActivities` fresh on each call). No change needed there.
>
> After implementing:
> - Run `npx tsc -b --pretty false`
> - Run `npm run build`
> - Run `npm run test:scoring-guards`
> - Run `npm run test:home-challenge-feeds`
> - Confirm `workoutService.ts` and `wellnessLogService.ts` each contain the new guard
> - Do NOT apply the guard to `activityLogSessionService.ts` (different flow — audit separately)
>
> Do not fix `totalActivities: 0` in existing memberships — that is Task 4C and requires a separate prod write approval.

---

## Report Path

`docs/reports/member-phase-10c-p6h-crit3-regression-audit-phase3b.md`
