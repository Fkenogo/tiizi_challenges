# Phase 18I-6N — Profile Metrics & Analytics Audit

**Date:** 2026-07-03
**Branch:** fix/p0-pre-deploy-blockers
**Type:** Audit only — no implementation

---

## 1. Profile Page Metrics

**File:** `src/features/Profile/ProfileScreen.tsx`

---

### 1.1 Groups

| Field | Value |
|-------|-------|
| Hook | `useMyGroups()` |
| Collection | `groupMembers` (userId == uid, joined/active) → `groups` |
| Nature | **Real** — live Firestore query |
| Updates after log? | Yes (group membership rarely changes) |
| Accuracy risk | Low |

✅ Reliable.

---

### 1.2 Wins

| Field | Value |
|-------|-------|
| Computation | `challenges.filter(c => myChallengeIds.has(c.id) && c.status === 'completed').length` |
| Source hook | `useChallenges()` → `challengeService.getUserAccessibleChallenges()` |
| Accuracy risk | **CRITICAL BUG — always 0** |

**Root cause:** `getUserAccessibleChallenges` explicitly filters challenges to `status === 'active'` (or own drafts) at the query level:
```ts
.filter((item) => item.status === 'active' || (item.createdBy === userId && item.status === 'draft'))
```
A completed challenge has `status = 'completed'` and is never returned. The client-side filter `c.status === 'completed'` can never match anything in this array.

**Wins will always display 0.**

---

### 1.3 Streak

| Field | Value |
|-------|-------|
| Hook | `useUserStreak(userId)` → `streakService.calculateUserStreak()` |
| Collections | `workouts` (where userId, date >= 30 days ago) + `wellnessLogs` (where userId, date >= 30 days ago) |
| Nature | **Real** — both fitness and wellness logs included |
| staleTime | **1 hour** — will not update immediately after a log |
| Updates after log? | Cache invalidated by `useLogWorkout`/`useLogWellnessActivity` via `['streak', 'user', userId]` — **yes** |
| Accuracy risk | Medium — 30-day window only; streaks longer than 30 days will truncate |

⚠️ 30-day lookback cap means streaks > 30 days are under-counted. Functionally correct for most users.

---

### 1.4 Goal Completion %

| Field | Value |
|-------|-------|
| Hook | `useDailyGoalsAnalytics(uid)` |
| Collection | `users/:uid` — reads `dailyGoalsAnalytics` counter sub-object |
| Nature | **Real** — persisted counter updated on every `saveTodayGoals` call |
| Covers challenge logs? | **No** |
| Covers workout logs? | **No** |
| Updates after log? | Only when user saves daily goals (separate feature) |
| Accuracy risk | **Misleading label** — "Goal completion" refers to a separate manual daily checklist, not challenge or workout goals |

⚠️ The "Goal completion" row implies the user's overall performance but measures a separate, optional daily text-checkbox feature. A user with no daily goals set will always show 0%.

---

### 1.5 "Top 5% Contributor" badge

| Field | Value |
|-------|-------|
| Computation | `myGroups.length > 0 ? 'Top 5% Contributor' : 'New Member'` |
| Nature | **Hardcoded** — no rank calculation |
| Accuracy risk | **CRITICAL** — everyone in at least one group is labeled "Top 5% Contributor" |

This is a false claim displayed to all group members. It should be removed or replaced with a real earned label.

---

### 1.6 "Community Leader" subtitle

| Field | Value |
|-------|-------|
| Value | `"Community Leader • Member since {year}"` |
| Nature | **Hardcoded** — always "Community Leader" |
| Accuracy risk | **High** — misleading; no logic gates this label |

---

## 2. Reports & Analytics Metrics

**File:** `src/features/Profile/ProfileAnalyticsScreen.tsx`

---

### 2.1 Current Streak / Best Streak

| Field | Source | Fitness? | Wellness? | Challenge? | Daily Goals? |
|-------|--------|----------|-----------|------------|--------------|
| Current streak | `useUserStreak()` → `streakService.calculateUserStreak()` | ✅ | ✅ | n/a | ❌ |
| Best streak | Same | ✅ | ✅ | n/a | ❌ |

- **staleTime: 1 hour** — after logging a workout, the streak card will not update for up to 1 hour (unless the query is invalidated; it is invalidated by `useLogWorkout`/`useLogWellnessActivity`, so in practice it refreshes quickly after a log).
- 30-day window only — accurate for recent streaks, misleading for historical bests.
- ✅ Includes both `workouts` + `wellnessLogs` correctly.

---

### 2.2 Workouts (7d) / Workouts (30d)

| Field | Source |
|-------|--------|
| Hook | `useUserWorkouts(userId)` → `workoutService.getWorkoutsByUser()` |
| Query | `where('userId', '==', userId)` — **no date filter, no limit** |
| Client filter | `isWithinDays(item.completedAt, 7)` / `isWithinDays(item.completedAt, 30)` |
| Includes wellness logs? | **No** |
| Performance risk | **High** — loads entire workout history into client memory |

**Issues:**
1. **Wellness logs excluded** — a user who only logs wellness activities will see 0 for both fields.
2. **No cache invalidation** — `useLogWorkout` and `useLogWellnessActivity` both call `queryClient.invalidateQueries` but **neither invalidates `['user-workouts', userId]`**. The profile counts are stale until the 2-minute staleTime expires.
3. **No date filter on query** — `getWorkoutsByUser` fetches all workouts ever for the user with no `orderBy` or `limit`. This becomes a performance problem as workout history grows.
4. **Label mismatch** — calls them "Workouts" but the feature also logs wellness activities.

---

### 2.3 Active Challenges

| Field | Source |
|-------|--------|
| Computation | `challenges.filter(c => c.status === 'active' && now >= start && now <= end).length` |
| Source | `useChallenges()` → already pre-filtered to `status === 'active'` |

The double `status === 'active'` filter is redundant but harmless. Date bounds filter is correct.
✅ Reasonably accurate for currently running challenges.

---

### 2.4 Upcoming Challenges

| Field | Source |
|-------|--------|
| Computation | `challenges.filter(c => Date.parse(c.startDate) > Date.now()).length` |
| Source | `useChallenges()` |

`useChallenges()` already returns only `active` status challenges. An `active` challenge with `startDate > now` is possible (challenge activated before it begins). Count is low-accuracy but not harmful.

⚠️ Conceptually confusing: if a challenge is `active` but hasn't started, it appears both "upcoming" and in `useChallenges()`. Completed and historical upcoming challenges not counted.

---

### 2.5 Total Challenges

| Field | Source |
|-------|--------|
| Computation | `challenges.length` |
| Source | `useChallenges()` — returns `active` + own `drafts` only |

**This is not the user's total challenge count.** It excludes:
- All completed challenges
- All past challenges the user participated in
- Any challenge from a group they have since left

⚠️ Highly misleading. A user who has participated in 20 challenges will see a much smaller number — possibly 1–3 currently active ones.

---

### 2.6 Goals Section (Completion Rate, Days Tracked, Goals Completed, Goals Planned)

| Field | Source | Nature |
|-------|--------|--------|
| All four | `useDailyGoalsAnalytics()` → `users/:uid.dailyGoalsAnalytics` | **Real but misnamed** |

The `dailyGoalsAnalytics` object is a running counter stored in the user document. It is updated atomically when the user saves their daily checklist (up to 3 text items).

- **Does not cover challenge goals** — a user who completes every challenge activity will still see 0% here if they never used the daily goals checklist.
- **Does not cover workout targets** — no connection to `workouts` or `wellnessLogs`.
- Counter can drift if the `saveTodayGoals` call is retried or called multiple times for the same day. The code guards against same-day re-counting but is fragile.

⚠️ The section title "Goals" implies challenge/workout goal tracking. It is actually a separate optional micro-habit feature. This should be labeled "Daily Habits" or removed from the analytics view if the feature is not well-adopted.

---

### 2.7 Groups

✅ Real count from `useMyGroups()`. Accurate.

---

## 3. Current Gaps Summary

### 🔴 Critical (wrong/broken data)

| # | Issue | Location |
|---|-------|----------|
| C1 | **Wins always shows 0** — `getUserAccessibleChallenges` excludes completed challenges at query level | `ProfileScreen`, `challengeService` |
| C2 | **"Top 5% Contributor" badge is hardcoded** — assigned to everyone in ≥1 group | `ProfileScreen` line 122 |
| C3 | **"Community Leader" is hardcoded** — no logic | `ProfileScreen` line 127 |

### 🟠 Significant (inaccurate or misleading)

| # | Issue | Location |
|---|-------|----------|
| S1 | **Workouts 7d/30d excludes wellness logs** — fitness-only count labeled as general workouts | `ProfileAnalyticsScreen`, `useUserWorkouts` |
| S2 | **Total Challenges is not total** — only active challenges in current groups | `ProfileAnalyticsScreen` |
| S3 | **"Goal completion" is daily habits, not challenge/workout goals** — misleading label | Both screens |
| S4 | **`['user-workouts', userId]` not invalidated on log** — stale for up to 2 min after logging | `useWorkouts.ts` |
| S5 | **Streak staleTime = 1 hour** — slow to reflect new streaks on profile | `useStreak.ts` |

### 🟡 Minor (performance / maintenance)

| # | Issue | Location |
|---|-------|----------|
| M1 | **`getWorkoutsByUser` has no date filter** — loads full history, no limit | `workoutService.ts` line 277–281 |
| M2 | **Streak lookback capped at 30 days** — best streak may be under-counted for long users | `streakService.ts` line 93 |
| M3 | **`useChallenges` staleTime = 5 min** — "Active Challenges" count lags up to 5 min | `useChallenges.ts` |
| M4 | **`useDailyGoalsAnalytics` counter can drift** — same-day re-saves increment carefully but fragile | `dailyGoalsService.ts` |
| M5 | **Duplicate `useChallenges` + `useMyGroups` calls** — both screens load same data independently | Both screens |

---

## 4. Recommended User Analytics Model (MVP)

### Profile Page — Identity + Meaningful Summary

Remove hardcoded badges. Show only real earned data.

| Metric | Source | Notes |
|--------|--------|-------|
| Groups | `useMyGroups()` | ✅ Keep as-is |
| Active Challenges | `useChallenges()` filtered to `active + started` | Replace "Wins" |
| Wins (completed challenges) | New query: `challengeMembers` where `userId == uid AND status == 'completed'` count | Fix C1 |
| Current Streak | `useUserStreak()` | ✅ Keep, reduce staleTime to 5 min |
| Total logs (workouts + wellness) | New combined count | Replace "Goal completion %" |
| Remove "Top 5% Contributor" | — | Remove C2 |
| Remove "Community Leader" | — | Remove C3 |

### Reports & Analytics — Help User Improve

| Section | Metrics | Source |
|---------|---------|--------|
| **Consistency** | Current streak, Best streak, Logs this week, Logs this month | `streakService` + combined workout/wellness count |
| **Activity** | Total fitness logs, Total wellness logs, Most logged activity (name) | `workouts` + `wellnessLogs` query with date range |
| **Challenges** | Active challenges, Completed challenges, Win rate (completed / total joined) | `challengeMembers where userId == uid` |
| **Community** | Groups joined, Challenges with teammates | `groupMembers` |
| **Daily Habits** (optional, relabeled) | Habit streak, Completion rate | `dailyGoalsAnalytics` — **renamed from "Goals"** |

Remove: Upcoming Challenges count (not actionable), "Total Challenges" from current broken query.

---

## 5. Proposed Architecture

### Canonical `userAnalyticsService` / `useUserAnalytics` hook

One service + hook that collects all user-scoped analytics. Screens consume a single hook instead of 5 separate ones.

**Sources it should use:**
1. `groupMembers` — group count
2. `challengeMembers where userId == uid` — completed count, active count, total joined (this is the RIGHT source for wins and total challenges — not `challenges` collection)
3. `workouts where userId == uid, date >= 90 days` — fitness log count, recent trend
4. `wellnessLogs where userId == uid, date >= 90 days` — wellness log count, recent trend
5. `streakService.calculateUserStreak()` — streak (reuse existing, reduce staleTime)
6. `users/:uid.dailyGoalsAnalytics` — habit data (optional, relabeled)

**Fields it should return:**
```ts
type UserAnalytics = {
  groupsCount: number;
  activeChallengesCount: number;
  completedChallengesCount: number;       // from challengeMembers — fixes C1
  totalChallengesJoinedCount: number;     // from challengeMembers
  currentStreak: number;
  longestStreak: number;
  fitnessLogsLast7d: number;
  fitnessLogsLast30d: number;
  wellnessLogsLast7d: number;
  wellnessLogsLast30d: number;
  totalLogsLast30d: number;               // fitness + wellness combined
  mostLoggedActivityName?: string;
  // Optional daily habits section
  habitCompletionRate: number;
  habitDaysTracked: number;
};
```

**queryKey:** `['user-analytics', userId]`
**staleTime:** 2 minutes
**Invalidated by:** `useLogWorkout.onSuccess`, `useLogWellnessActivity.onSuccess`

### What to remove from UI

| Remove | Why |
|--------|-----|
| "Top 5% Contributor" badge | Hardcoded, false for most users |
| "Community Leader" subtitle | Hardcoded |
| "Wins" (current broken implementation) | Always 0 |
| "Total Challenges" (from `useChallenges`) | Not the user's total — only current active |
| "Goals Completed / Planned" in analytics | Daily habits micro-feature, misleading as "Goals" |
| "Upcoming Challenges" count | Not actionable; low accuracy |

### What to rename

| Current | Rename to |
|---------|-----------|
| "Workouts (7d)" | "Logs (7d)" or "Activity (7d)" |
| "Workouts (30d)" | "Logs (30d)" |
| "Goal completion" (profile) | "Habit completion" or remove |
| "Goals" section (analytics) | "Daily Habits" |
| "Days Tracked" | "Habit days tracked" |

### What can remain

- Groups count — ✅ correct source
- Current/Best streak — ✅ correct source, needs staleTime reduction to 5 min
- Active challenges count — correct once filtered properly
- Profile photo, display name, member since year — ✅ correct

---

## 6. Files Likely to Change

| File | Change Type |
|------|-------------|
| `src/features/Profile/ProfileScreen.tsx` | Remove hardcoded badges; replace Wins with real source; replace Goal completion label |
| `src/features/Profile/ProfileAnalyticsScreen.tsx` | Replace multiple data hooks with `useUserAnalytics`; fix Total Challenges; relabel sections |
| `src/hooks/useWorkouts.ts` | Add `['user-workouts', userId]` invalidation to both log mutation `onSuccess` handlers |
| `src/hooks/useStreak.ts` | Reduce staleTime from 1 hour to 5 minutes |
| `src/services/workoutService.ts` | Add date filter to `getWorkoutsByUser` (90-day window) |
| `src/hooks/useUserAnalytics.ts` | **New** — canonical analytics hook |
| `src/services/userAnalyticsService.ts` | **New** — canonical analytics resolver |

---

## 7. Validation Commands (for implementation phase)

```bash
npx tsc --noEmit
npm run build
npm run test:home-challenge-feeds
npm run test:scoring-guards
npm run test:challenge-activity-model
# New test to add:
npm run test:profile-analytics-guards
```

New guards to write when implementing:
- `ProfileScreen` does not contain `'Top 5% Contributor'` (hardcoded string)
- `ProfileScreen` does not contain `'Community Leader'` (hardcoded string)
- `useLogWorkout.onSuccess` invalidates `['user-workouts', userId]`
- `useLogWellnessActivity.onSuccess` invalidates `['user-workouts', userId]` (or the combined analytics key)
- `useUserStreak` staleTime is ≤ 5 minutes
- `getWorkoutsByUser` query includes a date filter
- `useUserAnalytics` hook exists
- `ProfileAnalyticsScreen` uses `useUserAnalytics` not `useUserWorkouts` directly

---

## 8. Summary of Findings

| Severity | Count | Examples |
|----------|-------|---------|
| 🔴 Critical | 3 | Wins always 0, "Top 5% Contributor" hardcoded, "Community Leader" hardcoded |
| 🟠 Significant | 5 | Wellness logs excluded from counts, Total Challenges broken, misleading "Goals" label, stale after log, cache invalidation missing |
| 🟡 Minor | 5 | Full history loaded, streak 30-day cap, duplicate hook calls, stale challenge count, counter fragility |

**No implementation changes in this phase.** This report is the input for the 18I-6N implementation plan.
