# Phase 18I-6K — Log Activity Leaderboard Data Unification

**Date:** 2026-07-03
**Branch:** fix/p0-pre-deploy-blockers
**Commit:** 377659c

---

## Problem Statement

Home and Challenge Detail both showed the correct challenge progress (e.g., Competitive: 120/500 min, Collective: 210/30,000 min). However, navigating Home → My Challenges → Log Activity showed 0/target, no leaderboard, no rankings, and no rank context for all engine types.

---

## Root Cause

### 1. Missing leaderboard query

`SelectChallengeActivityScreen` called `resolveChallengeProgress` with only `{ challenge, membership }`. No leaderboard data was fetched.

`ChallengeDetailScreen` runs:
```ts
useQuery({
  queryKey: ['challenge-leaderboard-snapshot', id, engineVersion, challengeType],
  staleTime: 60 * 1000,
})
```
This computes `memberSumContribution` — the sum of `cumulativeLoggedValue` across ALL challenge members. It is then passed to the resolver as a high-fidelity floor for `groupTotal`.

### 2. Collective groupTotal = 0

The resolver computes:
```ts
groupTotal = Math.max(storedGroupTotal, memberSumFloor, logSumFloor, userContributionTotal)
```

Without `memberSumContribution`, `memberSumFloor = 0`. If `challenge.groupCurrentTotal` was stale at 0 in the 5-minute cache AND the current user had not personally logged yet (`cumulativeLoggedValue = 0`), then `groupTotal = 0`.

`ChallengeDetailScreen` passes `memberSumContribution = 210` → `groupTotal = max(0, 210, 0, 0) = 210`.

### 3. Missing UI elements

`_rp.secondaryLabel` (leader gap for competitive; user contribution for collective) was computed by the resolver but never rendered. No leaderboard section existed on the screen.

---

## Previous Data Flow

```
SelectChallengeActivityScreen:
  useChallenge (staleTime 5 min)
  useChallengeMembership (staleTime 60s)
  resolveChallengeProgress({ challenge, membership })
    → groupTotal = max(staleGroupCurrentTotal, 0, 0, userContributionTotal)
    → no leaderLabel, no competitiveGap (leaderboard=[])
  UI: progress bar + text only; no leaderboard; no secondaryLabel rendered
```

---

## New Unified Data Flow

```
SelectChallengeActivityScreen:
  useChallenge (staleTime 5 min)
  useChallengeMembership (staleTime 60s)
  useQuery ['challenge-leaderboard-snapshot', id, engineVersion, type]  ← NEW (staleTime 60s, shared cache with ChallengeDetailScreen)
    → entries (top 5, ranked), memberSumContribution
  useQuery ['challenge-participant-names', ids.join(',')]                ← NEW (staleTime 5 min, shared cache)
    → Map<uid, displayName>
  resolveChallengeProgress({ challenge, membership, leaderboard, memberSumContribution, currentUserId })
    → groupTotal = max(staleGroupCurrentTotal, 210, 0, userContributionTotal) = 210 ✅
    → leaderLabel, competitiveGap computed correctly
  UI:
    - progress bar + primaryLabel (correct values)
    - secondaryLabel below progress bar (leader gap / user contribution)
    - compact leaderboard: rank badges, names from leaderboardNames, scores
    - empty state: "No activity logged yet. Be the first!"
```

**Cache sharing:** When the user navigates ChallengeDetailScreen → SelectChallengeActivityScreen, both queries are served from the TanStack Query cache instantly (same queryKey, staleTime 60s). Cold navigation triggers a fresh Firestore read.

---

## Engine Coverage

| Engine | Progress fix | secondaryLabel | Leaderboard entries |
|--------|-------------|----------------|---------------------|
| Collective | ✅ groupTotal via memberSumContribution | ✅ "You contributed N min" | ✅ per-member cumulativeLoggedValue |
| Competitive | ✅ userTotal via membership (unchanged); leaderLabel now rendered | ✅ "N min behind leader" | ✅ ranked by cumulativeLoggedValue |
| Streak | ✅ currentStreak/target (unchanged) | N/A (streak has no leaderLabel) | ✅ ranked by currentStreak |
| Wellness | ✅ collective path (wellness uses cumulativeLoggedValue) | ✅ same as collective | ✅ same as collective |

---

## Scenarios Validated

**Scenario A — Competitive, user has logged (120/500 min):**
- `membership.cumulativeLoggedValue = 120`
- `resolveChallengeProgress` → `primaryLabel = "120 / 500 minutes"`, `progressPercent = 24`
- Leaderboard shows ranked entries; secondaryLabel shows "N min behind leader" or "You are leading 🏆"

**Scenario B — Collective, user has not logged (team total 210/30,000 min):**
- `challenge.groupCurrentTotal = 0` (stale cache)
- `leaderboardMemberSum = 210` (fresh 60s-stale query)
- `resolveChallengeProgress` → `groupTotal = 210`, `primaryLabel = "210 / 30,000 minutes"`, `groupPercent = 1`
- secondaryLabel suppressed (userContributionTotal = 0)

**Scenario C — Post-log refresh:**
- After logging, TanStack Query invalidates `challenge`, `challenge-membership`, and the log queries
- `challenge-leaderboard-snapshot` has 60s staleTime — it refetches on the next navigation to either screen
- Both SelectChallengeActivityScreen and ChallengeDetailScreen show the same updated values on next load

---

## Files Changed

| File | Change |
|------|--------|
| `src/features/Workouts/SelectChallengeActivityScreen.tsx` | Add leaderboard query, names query, updated resolver call, secondaryLabel render, compact leaderboard section |
| `scripts/testChallengeActivityModel.ts` | 9 new Phase 18I-6K guards (53 total) |
| `scripts/testScoringGuards.ts` | 18I-4C block updated — old guards enforced deprecated `cumulativeValues` path; new guards enforce canonical resolver+leaderboard approach |
| `scripts/testGroupUxPolish.ts` | Issue A guard narrowed to `membership?.cumulativeValues` pattern so it does not false-positive on Firestore data reads in the leaderboard queryFn |
| `docs/reports/member-phase-10c-change-log.md` | Phase 18I-6K CHANGELOG entry |

---

## Validation Results

```
npm run test:group-ux-polish      ✅ 13/13 passed
npm run test:home-challenge-feeds ✅ all guards passed
npm run test:scoring-guards       ✅ all passed
npm run test:challenge-activity-model ✅ 53/53 passed (9 new Phase 18I-6K guards)
npx tsc --noEmit                  ✅ clean
npm run build                     ✅ built in 3.67s
```

---

## Constraints Respected

- No deployment
- No production writes
- No Cloud Function changes
- No schema changes
- No new packages
- No unrelated changes bundled
