# CRIT-3 Phase 2 — Regression Audit Report

**Date:** 2026-06-24  
**Branch:** fix/p0-pre-deploy-blockers  
**Scope:** Post-CRIT-3 Phase 2 regression check across challenge membership state, CTA logic, progress model, logging flow, leaderboard, and template consistency.

---

## Validation Results

| Command | Result |
|---------|--------|
| `git status` | 28 modified tracked files (all unstaged CRIT-3 Phase 2 changes) |
| `git log --oneline -10` | Last commit: `039e96d fix(p6h-task1): restore getChallengesByGroup` |
| `git diff HEAD --stat` | 928 insertions, 439 deletions across 28 files |
| `npx tsc -b --pretty false` | ✅ PASS (0 type errors) |
| `npm run build` | ✅ PASS (built in ~10s) |
| `npm run test:home-challenge-feeds` | ✅ PASS |
| `npm run test:scoring-guards` | ❌ FAIL — 1 guard (see Section 1 below) |
| `cd functions && npm run build` | ✅ PASS |

---

## Section 1 — test:scoring-guards Failure (Root Cause)

### Failing Guard
```
AssertionError: P6B: firestore.rules must multiply activityCount * durationDays
  in configuredChallengeActivityCountFrom
```

### Root Cause
The CRIT-3 Phase 2 fixed a Firestore rules syntax error. The original invalid code:
```
if (durationDays < 1) { durationDays = 1; }  // invalid — Firestore rules cannot reassign
return activityCount * durationDays;
```
Was corrected to:
```
let effectiveDays = durationDays < 1 ? 1 : durationDays;
return activityCount * effectiveDays;
```
The rules logic is **semantically correct**. However, the test guard at `scripts/testScoringGuards.ts:1138` uses a literal regex:
```ts
assert.match(rules, /activityCount\s*\*\s*durationDays/, '...')
```
The variable was renamed from `durationDays` to `effectiveDays` in the expression, so the regex no longer matches.

### Fix Required (Safe — no logic change)
Update the guard regex in `scripts/testScoringGuards.ts` ~line 1138 to accept either form:
```ts
assert.match(rules, /activityCount\s*\*\s*(durationDays|effectiveDays)/, '...')
```

---

## Section 2 — ChallengeDetailScreen: CTA Bug for Completed Members

### Observed Issue
When a user has `membership.status === 'completed'` and the challenge is still ongoing, the CTA shows **"Join Challenge"** instead of a completed/disabled state.

### Root Cause
`ChallengeDetailScreen.tsx` lines 326–352:
```tsx
{(!membership || membership.status !== 'active') && challengeIsOver ? (
  <div>This challenge has ended.</div>
) : !membership || membership.status !== 'active' ? (
  <button>Join Challenge</button>   // ← BUG: fires for status='completed' too
) : ...}
```
The condition `membership.status !== 'active'` catches `status === 'completed'` members. Because the challenge is still ongoing (`challengeIsOver = false`), the second branch (`!membership || membership.status !== 'active'`) is entered and "Join Challenge" is rendered.

### Fix Required
Add an explicit guard for `completed` membership before the join button:
```tsx
{membership?.status === 'completed' ? (
  <button disabled>🎉 Challenge Completed</button>
) : (!membership || membership.status !== 'active') && challengeIsOver ? (
  <div>This challenge has ended.</div>
) : !membership || membership.status !== 'active' ? (
  <button>Join Challenge</button>
) : ...}
```

---

## Section 3 — ChallengeDetailScreen: Leaderboard Snapshot Uses Wrong Data Source

### Observed Issue
The inline leaderboard snapshot on the Challenge Detail page ranks users by summed `workout.value` from the `workouts` collection — not by `totalPoints` from `challengeMembers`. This was NOT fixed by CRIT-3 Phase 2.

### Root Cause
`ChallengeDetailScreen.tsx` lines 65–74:
```ts
const leaderboard = useMemo(() => {
  const scoreMap = new Map<string, number>();
  workouts.forEach((item) => {
    scoreMap.set(item.userId, (scoreMap.get(item.userId) ?? 0) + Math.max(1, Math.round(item.value)));
  });
  return Array.from(scoreMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([userId, score], index) => ({ rank: index + 1, userId, score }));
}, [workouts]);
```
CRIT-3 Phase 2 correctly fixed `ChallengeLeaderboardScreen.tsx` (the dedicated full-screen leaderboard) to use `challengeMembers.totalPoints`. However, the inline snapshot inside `ChallengeDetailScreen.tsx` was left unchanged and still reads from the `workouts` collection via `useChallengeWorkouts`.

### Impact
- Leaderboard snapshot shows raw `value` totals (e.g., reps summed across sessions), not points.
- Ranking can differ significantly from the authoritative leaderboard.
- `My Logs > Total Logs` is impossible when computed correctly from `challengeMembers.activitiesCompleted`; it can appear when the inline leaderboard mixes raw value sums.

### Fix Required
Replace the `useChallengeWorkouts`-based leaderboard in `ChallengeDetailScreen.tsx` with a `challengeMembers.totalPoints` query, same pattern as `ChallengeLeaderboardScreen.tsx`. This does not need to be a hook — a `useQuery` inline suffices.

---

## Section 4 — Progress Model Consistency Audit

### Home "My Challenges" (`useHomeScreen.ts`)
- **Source:** `membership.completionRate` (from Firestore `challengeMembers` doc), with live enrichment for the first card using cumulative value vs target.
- **Risk:** If `membership.completionRate === 100` (all required logs submitted) but the challenge is still ongoing, it displays "100% complete" — which is accurate but may appear misleading.
- **Assessment:** This is technically correct log-count-based behaviour. Not a bug. No action needed unless the product wants a different label for "completed your logs but challenge still running."

### Challenge Detail Screen (`ChallengeDetailScreen.tsx`)
- **Source:** `useChallengeProgress` → `totalLogs` and `myLogs`.
- `totalLogs` = sum of `activitiesCompleted` across all `challengeMembers`, falling back to raw `workouts` count.
- `myLogs` = count of user's own workouts + wellness logs.
- `My Logs > Total Logs` impossible in the new model (total = sum of all members). However, with the fallback to raw `workouts.size()` the totals can be inconsistent. No immediate action beyond the leaderboard fix.

### Workout Success Screen (`WorkoutLoggedScreen.tsx`)
- Shows `activitiesCompleted` and `totalActivities` from the membership. Correct.

### Challenge Leaderboard Screen (`ChallengeLeaderboardScreen.tsx`)
- ✅ Fixed in CRIT-3 Phase 2: queries `challengeMembers.totalPoints`.

---

## Section 5 — Logging Flow

### Scroll/Drum Picker
- **Current state:** `LogWorkoutScreen.tsx` uses a native `<select>` with 1001 options as a "quick value picker", plus a numeric `<input type="number">`. There is NO scroll/drum picker implemented.
- **Assessment:** If a scroll-number picker was agreed on previously, it was never committed to this branch. The `<select>` approach is functional but not the intended UX.
- **Action:** Audit/design decision required — do not rebuild until approved.

### Multi-Activity Logging
- `SelectChallengeActivityScreen.tsx` shows all challenge activities and allows the user to pick one per session. Each tap navigates to `LogWorkoutScreen` or `LogWellnessActivityScreen` for a single activity.
- This is **single-activity-per-navigation** logging. Multi-activity logging in a single form/session does not appear to have been implemented.
- **Assessment:** Not a regression from CRIT-3 Phase 2. This was the existing design.

### Same-Day Log Deduplication
- **Current state:** No deduplication guard exists. A user can log the same activity multiple times per day.
- **Assessment:** Deferred to Tier C per the approved CRIT-3 Phase 2 scope. Not a regression.

---

## Section 6 — Leaderboard

### Group Leaderboard
- `groupInsightsService.ts` `getGroupLeaderboard()` ✅ correctly aggregates `totalPoints` from `challengeMembers` across the group.
- `GroupLeaderboardScreen.tsx` uses `useGroupLeaderboard` which calls this service.
- **Assessment:** Group leaderboard is correct post-Phase 2.

### Challenge Leaderboard Screen
- `ChallengeLeaderboardScreen.tsx` ✅ uses inline `useQuery` against `challengeMembers` sorted by `totalPoints`.

### Challenge Detail Inline Snapshot
- ❌ Still uses `useChallengeWorkouts` + raw `value` sum. See Section 3.

---

## Section 7 — Template Consistency

### Challenge Types
Only three types are used throughout:
- `'collective'` ✅
- `'competitive'` ✅
- `'streak'` ✅
No other types found in type definitions or UI.

### Frequency Options
Both fitness and wellness activities support `'daily' | 'weekly' | '2x-week' | '3x-week' | '5x-week' | 'custom'` in:
- `src/types/index.ts` ✅
- `src/services/challengeService.ts` ✅
- `src/services/challengeTemplateService.ts` ✅
- `src/features/Challenges/CreateChallengeWizard.tsx` ✅ (dropdown includes all 6 options)

### Wellness Points — Manual Entry
- `CreateChallengeWizard.tsx` line ~870: Points field shows "Auto-calculated based on challenge target" — **no manual input field**. ✅ Correct.

### Fitness Frequency in Templates
`challengeTemplateService.ts` type definition includes `frequency?` for activities. Fitness templates can now include frequency. ✅

---

## Summary — Issues Found

| # | Severity | Area | Issue | File | Fix Required |
|---|----------|------|-------|------|--------------|
| 1 | **High** | test:scoring-guards | Guard regex expects `activityCount * durationDays` but rules use `effectiveDays` | `scripts/testScoringGuards.ts:1138` | Update regex to `/activityCount\s*\*\s*(durationDays\|effectiveDays)/` |
| 2 | **High** | ChallengeDetailScreen CTA | `membership.status === 'completed'` members see "Join Challenge" on ongoing challenges | `src/features/Challenges/ChallengeDetailScreen.tsx:326-352` | Add completed-membership branch before join button |
| 3 | **High** | ChallengeDetailScreen Leaderboard | Inline leaderboard snapshot still sums `workout.value`, not `totalPoints` | `src/features/Challenges/ChallengeDetailScreen.tsx:65-74` | Replace with `challengeMembers.totalPoints` query |
| 4 | Low | LogWorkoutScreen | Native `<select>` used instead of scroll/drum picker | `src/features/Workouts/LogWorkoutScreen.tsx:156-167` | Design decision needed before implementation |
| 5 | Deferred | Logging | No same-day deduplication guard | `wellnessLogService.ts`, `workoutService.ts` | Approved as Tier C — separate approval |

---

## Proposed Repair Sequence

### Phase 3A — Safe Now (3 targeted fixes, no approval needed)

**Task 1: Fix test guard for effectiveDays (1-line)**
- File: `scripts/testScoringGuards.ts:1138`
- Change: `/activityCount\s*\*\s*durationDays/` → `/activityCount\s*\*\s*(durationDays|effectiveDays)/`
- Verify: `npm run test:scoring-guards` passes

**Task 2: Fix CTA for completed membership state**
- File: `src/features/Challenges/ChallengeDetailScreen.tsx:326`
- Change: Add `membership?.status === 'completed'` check as the first branch before the join button
- Verify: Manual test — complete a challenge, confirm CTA shows "🎉 Challenge Completed" and not "Join Challenge"

**Task 3: Fix challenge detail inline leaderboard data source**
- File: `src/features/Challenges/ChallengeDetailScreen.tsx:65-74`
- Change: Replace `useChallengeWorkouts`-based leaderboard with `useQuery` against `challengeMembers.totalPoints` (same pattern as `ChallengeLeaderboardScreen.tsx`)
- Remove: Import of `useChallengeWorkouts` if no longer needed elsewhere in this file
- Verify: Challenge detail leaderboard snapshot shows same ranking as the full leaderboard screen

### Phase 3B — Needs Separate Approval

- **Scroll/drum picker:** UX decision — approve design before implementation
- **Multi-activity logging in single session:** Product decision
- **Same-day deduplication (Tier C):** Already deferred
- **Task 4C membership repair (7 Category A memberships):** Requires production write approval

---

## Files Changed in CRIT-3 Phase 2 (Unstaged)

All changes are unstaged (working tree modified). The 28 affected files are:

- `docs/reports/member-phase-10c-change-log.md`
- `firestore.rules`
- `scripts/testHomeChallengeFeeds.ts`
- `src/features/Admin/Challenges/CreateChallengeScreen.tsx`
- `src/features/Challenges/BrowseChallengesScreen.tsx`
- `src/features/Challenges/ChallengeCompletedScreen.tsx`
- `src/features/Challenges/ChallengeDetailScreen.tsx`
- `src/features/Challenges/ChallengeLeaderboardScreen.tsx`
- `src/features/Challenges/ChallengesScreen.tsx`
- `src/features/Challenges/CreateChallengeWizard.tsx`
- `src/features/Groups/GroupDetailScreen.tsx`
- `src/features/Groups/GroupLeaderboardScreen.tsx`
- `src/features/Home/HomeScreen.tsx`
- `src/features/Home/useHomeScreen.ts`
- `src/features/Profile/ProfileScreen.tsx`
- `src/features/Workouts/LogWellnessActivityScreen.tsx`
- `src/features/Workouts/LogWorkoutScreen.tsx`
- `src/features/Workouts/SelectChallengeActivityScreen.tsx`
- `src/features/Workouts/WorkoutLoggedScreen.tsx`
- `src/hooks/useAdminChallenges.ts`
- `src/hooks/useWorkouts.ts`
- `src/services/adminChallengeService.ts`
- `src/services/challengeService.ts`
- `src/services/challengeTemplateService.ts`
- `src/services/groupInsightsService.ts`
- `src/services/wellnessLogService.ts`
- `src/services/workoutService.ts`
- `src/types/index.ts`

No prior fixes in committed history were overwritten. All CRIT-3 Phase 2 changes are unstaged working tree modifications on top of commit `039e96d`.
