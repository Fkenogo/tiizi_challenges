# Phase 18I-6N Task 3 — Reports & Analytics Screen Alignment

**Date:** 2026-07-03
**Branch:** fix/p0-pre-deploy-blockers

---

## What Changed

`ProfileAnalyticsScreen` was migrated from 5 separate hooks to the single `useUserAnalytics` hook. Sections were restructured to match the new canonical analytics shape; misleading and broken metrics removed.

---

## Removed

| Item | Reason |
|------|--------|
| `useChallenges` import + call | Replaced by `analytics.activeChallengesCount` / `totalChallengesJoinedCount` |
| `useUserWorkouts` import + call | Replaced by `analytics.fitnessLogsLast*` fields |
| `useUserStreak` import + call | Replaced by `analytics.currentStreak` / `longestStreak` |
| `useDailyGoalsAnalytics` import + call | Moved to optional "Daily Habits" section, shown only when `habitDaysTracked > 0` |
| `useMyGroups` import + call | Replaced by `analytics.groupsCount` |
| `isWithinDays` helper function | Date math done in service layer; not needed in UI |
| `insights` useMemo | All values come directly from `analytics` object |
| `"Workouts (7d)"` / `"Workouts (30d)"` tiles | Fitness-only label; replaced with `fitnessLogsLast30d` + `wellnessLogsLast30d` |
| `"Goals"` section header | Ambiguous; replaced with `"Daily Habits"` (shown conditionally) |
| `"Goals Completed"` / `"Goals Planned"` tiles | Moved under Daily Habits, only shown when data exists |
| `"Upcoming Challenges"` tile | Derived from `challenges` array client-side — unreliable; removed |
| `"Total Challenges"` tile (from `challenges.length`) | `challenges` query returns active-only; replaced with `totalChallengesJoinedCount` |

---

## New Section Structure

### Consistency
| Tile | Source |
|------|--------|
| Current Streak | `analytics.currentStreak` |
| Best Streak | `analytics.longestStreak` |
| Logs this week | `fitnessLogsLast7d + wellnessLogsLast7d` |
| Logs this month | `analytics.totalLogsLast30d` |

### Activity
| Tile | Source |
|------|--------|
| Fitness logs (30d) | `analytics.fitnessLogsLast30d` |
| Wellness logs (30d) | `analytics.wellnessLogsLast30d` |
| Most logged activity | `analytics.mostLoggedActivityName` |

### Challenges
| Tile | Source |
|------|--------|
| Active | `analytics.activeChallengesCount` |
| Completed | `analytics.completedChallengesCount` |
| Total joined | `analytics.totalChallengesJoinedCount` |
| Completion rate | `completed / totalJoined * 100` (client calc) |

### Community
| Tile | Source |
|------|--------|
| Groups joined | `analytics.groupsCount` |

### Daily Habits *(conditional — only shown when `habitDaysTracked > 0`)*
| Tile | Source |
|------|--------|
| Completion rate | `analytics.habitCompletionRate` |
| Days tracked | `analytics.habitDaysTracked` |

---

## Architecture Notes

- `StatTile` and `SectionCard` extracted as local helper components — reduces repetition, consistent visual treatment
- `useMemo` removed entirely — all derived values are either simple arithmetic or come directly from `analytics`
- `useAuth` removed — not needed; `useUserAnalytics` resolves the user internally via its own `useAuth` call

---

## Files Changed

| File | Change |
|------|--------|
| `src/features/Profile/ProfileAnalyticsScreen.tsx` | Full rewrite — 5 hooks → `useUserAnalytics`, new section layout |
| `scripts/testProfileAnalyticsGuards.ts` | Add 7 ProfileAnalyticsScreen-specific guards |

---

## Guards Added

- `ProfileAnalyticsScreen` uses `useUserAnalytics`
- Does not use `useUserWorkouts` directly
- Does not reference `useDailyGoalsAnalytics`
- Does not label any section `"Goals"` (ambiguous)
- Displays `fitnessLogsLast30d`
- Displays `wellnessLogsLast30d`
- `totalChallengesJoinedCount` used for "Total joined" (challengeMembers-derived)

---

## Validation

```
npx tsc --noEmit                      ✅ clean
npm run build                         ✅ built in 2.85s
npm run test:profile-analytics-guards ✅ all guards passed
```
