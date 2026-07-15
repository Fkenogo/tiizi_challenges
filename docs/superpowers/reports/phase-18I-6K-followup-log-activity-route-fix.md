# Phase 18I-6K Follow-up — Route Home Log Activity to SelectChallengeActivityScreen

**Date:** 2026-07-03
**Branch:** fix/p0-pre-deploy-blockers
**Commit:** ce1cd87

---

## Problem

Phase 18I-6K updated `SelectChallengeActivityScreen` with the canonical leaderboard data source. However manual screenshots proved users were still seeing the OLD screen with:
- "No workout logs yet for this challenge."
- The legacy podium UI
- "TOTAL MINUTES 0 / 500"
- "+ LOG MINUTES" CTA

These elements appear in `CompetitiveChallengeScreen` and `StreakChallengeScreen` — NOT in `SelectChallengeActivityScreen`.

---

## Root Cause: The Actual Navigation Flow

```
ActiveChallengeCard (Home "My Challenges" card)
  └── "Log Workout" / "Log Activity" button
      onClick → navigate(`/app/challenges/${challengeType}?challengeId=...`)
                            ↓
      CompetitiveChallengeScreen   ← renders "No workout logs yet for this challenge."
      CollectiveChallengeScreen    ← renders weekly chart via useChallengeWorkouts
      StreakChallengeScreen        ← renders "No workout logs yet for this challenge."
                            ↓
      These screens had their own "+ Log" CTA that finally navigated to
      SelectChallengeActivityScreen — but the user sees the legacy screen first.
```

`SelectChallengeActivityScreen` was never the first screen in the Home → Log Activity flow. It was two navigation steps away from the card click.

---

## Fix

### 1. `ActiveChallengeCard` — Direct Log button to SelectChallengeActivityScreen

```tsx
// Before:
const detailPath = `/app/challenges/${challenge.challengeType}?${query.toString()}`;
onClick={() => navigate(detailPath)}  // ← Log Workout button

// After:
const logPath = `/app/workouts/select-activity?${query.toString()}`;
onClick={() => navigate(logPath)}  // ← Log Workout button routes to SelectChallengeActivityScreen
// detailPath still used for "View Challenge" (isUserCompleted state)
```

### 2. Legacy type screens — Redirect to ChallengeDetailScreen

`CompetitiveChallengeScreen`, `CollectiveChallengeScreen`, and `StreakChallengeScreen` each replaced with a 12-line redirect component:

```tsx
import { Navigate, useSearchParams } from 'react-router-dom';

function CompetitiveChallengeScreen() {
  const [params] = useSearchParams();
  const challengeId = params.get('challengeId');
  const groupId = params.get('groupId');
  if (!challengeId) return <Navigate replace to="/app/challenges" />;
  const qs = groupId ? `?groupId=${groupId}` : '';
  return <Navigate replace to={`/app/challenge/${challengeId}${qs}`} />;
}
```

This:
- Removes all duplicated leaderboard logic (`useChallengeWorkouts` + manual rank computation)
- Removes "No workout logs yet for this challenge." from 2 screens
- Consolidates all challenge detail views to `ChallengeDetailScreen` (canonical, with correct resolver + leaderboard)
- Any existing deep links or bookmarks to `/app/challenges/competitive?...` transparently redirect to `/app/challenge/:id`

### 3. `ChallengesScreen.handleJoinChallenge` — Navigate to ChallengeDetailScreen after join

```tsx
// Before:
navigate(`/app/challenges/${challengeType}?${query.toString()}`);

// After:
navigate(`/app/challenge/${challengeId}${qs}`);
```

---

## New Navigation Flow

```
ActiveChallengeCard (Home "My Challenges" card)
  └── "Log Workout" / "Log Activity" button
      onClick → navigate(`/app/workouts/select-activity?challengeId=...&groupId=...`)
                            ↓
      SelectChallengeActivityScreen  ← canonical resolver + leaderboard ✅
                            ↓
      User taps "Log" on an activity → LogWorkoutScreen / LogWellnessActivityScreen
                            ↓
      WorkoutLoggedScreen / ChallengeCompletedScreen
```

```
ActiveChallengeCard (isUserCompleted)
  └── "View Challenge" button
      onClick → navigate(`/app/challenges/${type}?...`)
                            ↓
      Legacy type screens → <Navigate replace to="/app/challenge/${challengeId}">
                            ↓
      ChallengeDetailScreen  ← canonical view ✅
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/Home/ActiveChallengeCard.tsx` | Log button uses `logPath` → select-activity; "View Challenge" retains `detailPath` |
| `src/features/Challenges/CompetitiveChallengeScreen.tsx` | Replaced with `<Navigate>` redirect (−144 lines) |
| `src/features/Challenges/CollectiveChallengeScreen.tsx` | Replaced with `<Navigate>` redirect (−195 lines) |
| `src/features/Challenges/StreakChallengeScreen.tsx` | Replaced with `<Navigate>` redirect (−194 lines) |
| `src/features/Challenges/ChallengesScreen.tsx` | `handleJoinChallenge` → navigate to `/app/challenge/:id` |
| `scripts/testGroupUxPolish.ts` | 7 new Phase 18I-6K follow-up guards (20 total) |

Net: −571 lines of duplicated, stale leaderboard logic removed.

---

## Guards (7 new, 20 total in testGroupUxPolish)

1. `ActiveChallengeCard` Log button navigates to `select-activity`
2. `ActiveChallengeCard` Log button uses `logPath` not `detailPath`
3. `CompetitiveChallengeScreen` does not render "No workout logs yet for this challenge."
4. `StreakChallengeScreen` does not render "No workout logs yet for this challenge."
5. `CompetitiveChallengeScreen` uses `<Navigate>` (confirms redirect approach)
6. `CollectiveChallengeScreen` uses `<Navigate>`
7. `StreakChallengeScreen` uses `<Navigate>`

---

## Validation

```
npm run test:group-ux-polish        ✅ 20/20 passed
npm run test:home-challenge-feeds   ✅ all guards passed
npm run test:challenge-activity-model ✅ 53/53 passed
npm run test:scoring-guards         ✅ all passed
npx tsc --noEmit                    ✅ clean
npm run build                       ✅ built in 5.71s
```
