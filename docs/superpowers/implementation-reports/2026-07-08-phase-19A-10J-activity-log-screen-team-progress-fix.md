# Phase 19A-10J — Align Activity Log Screen Team Progress Source

**Date:** 2026-07-08
**Branch:** fix/p0-pre-deploy-blockers
**Status:** ✅ Complete

---

## Problem

`LogWorkoutScreen` and `LogWellnessActivityScreen` both rendered their pre-submit collective
progress banner using `resolveChallengeProgress` with **no `activitySummaryTotal` and no
`priorTeamTotal`** — so the resolver received four zeroes and displayed:

> Team is at 0 / 10,000 · 0% — every rep counts.

…even when the true team total (visible on ChallengeDetail, SelectActivity, Group Feed, etc.)
was, for example, 650 reps.

**Root cause:** Both log screens called:
```typescript
const _rp = resolveChallengeProgress({ challenge: challenge ?? null, membership: membership ?? null });
```
with no `challengeActivitySummaries` query and no `groupCurrentTotal` passed as the optimistic
floor. Every other screen was fixed in phases 10G–10I; these two were missed.

---

## Fix

### `LogWorkoutScreen.tsx` and `LogWellnessActivityScreen.tsx` (same change pattern)

1. **Import `useChallengeSummary`** from `../../hooks/useChallenges`
2. **Add hook call:** `const { data: challengeSummary } = useChallengeSummary(challengeId);`
3. **Update resolver call** to pass:
   - `activitySummaryTotal: challengeSummary?.totalValue` — CF-maintained canonical team total
   - `priorTeamTotal: challenge?.groupCurrentTotal` — optimistic team-level floor before CF fires
4. **Upgrade collective banner** from a single-line sentence to a small team progress card:
   - "Team Progress" label with Users icon
   - `X / Y unit · Z%` value line
   - Thin progress bar (`h-1.5`)
   - "Every contribution moves the team closer." helper copy
   - "Your contribution: W unit total" sub-line (shown only when `userContributionTotal > 0`)

The banner upgrade is purely presentational — it reads from the same resolved values.

---

## Files Modified

| File | Change |
|------|--------|
| `src/features/Workouts/LogWorkoutScreen.tsx` | Add `useChallengeSummary`; pass `activitySummaryTotal` + `priorTeamTotal`; upgrade collective banner |
| `src/features/Workouts/LogWellnessActivityScreen.tsx` | Same as above |
| `scripts/testCollectiveTeamProgressRegressionGuards.ts` | Added 10J assertions for both log screens |

---

## Priority order inside the resolver (unchanged from 10I)

```
groupTotal = Math.max(activitySummaryFloor, memberSumFloor, logSumFloor, optimisticTeamFloor)
```

| Input | Source | When available |
|---|---|---|
| `activitySummaryFloor` | `challengeActivitySummaries.totalValue` | After CF fires (1–5 s) |
| `optimisticTeamFloor` | `challenge.groupCurrentTotal` | From challenge doc (possibly stale by 1-5s) |
| `memberSumFloor` | Sum of all `challengeMembers.cumulativeLoggedValue` | Only on detail screens |
| `logSumFloor` | Raw log sum | Never passed on these screens |

User's `membership.cumulativeLoggedValue` is **NOT** used as a team floor — only displayed separately.

---

## Guard assertions added (10J)

For each log screen (`LogWorkoutScreen`, `LogWellnessActivityScreen`):
- Must use `useChallengeSummary`
- Must pass `activitySummaryTotal` from `challengeSummary?.totalValue`
- Must pass `priorTeamTotal` from `challenge?.groupCurrentTotal`
- Resolver call must not be the bare `{ challenge, membership }` form

---

## Validation

```
npx tsx scripts/testCollectiveTeamProgressRegressionGuards.ts   → ✅ All guards passed
npx tsx scripts/testCollectiveDoubleCountGuards.ts               → ✅ All guards passed
npx tsx scripts/testChallengePerformanceFinalRegressionGuards.ts → ✅ All guards passed
npx tsx scripts/testChallengePerformanceSourceOfTruthGuards.ts   → ✅ All guards passed
npx tsx scripts/testGroupFeedProgressSnapshotGuards.ts           → ✅ All guards passed
npx tsc --noEmit                                                 → ✅ Clean
npm run build                                                    → ✅ Clean
cd functions && npm run build                                    → ✅ Clean
```

---

## Risks

- **`challenge.groupCurrentTotal` stale on first render:** the challenge doc may not have
  re-fetched yet. `priorTeamTotal` will be the pre-session team total — still a valid team
  aggregate, not a user value. Once `challengeActivitySummaries` updates (1-5 s), the CF
  value supersedes it.
- **No double-counting risk:** `priorTeamTotal` is a `Math.max` floor; it never adds to
  `activitySummaryFloor`. When CF fires, `activitySummaryFloor` takes over automatically.

---

## Rollback

Revert the two log screen files and guard script to their pre-10J state:
- Remove `useChallengeSummary` import and call
- Revert resolver call to `{ challenge, membership }` only
- Revert banner to the single-line `<p>` form

---

## Manual Test Checklist

- [ ] Open a collective challenge with known team total (e.g., 650 / 10,000 reps)
- [ ] Confirm ChallengeDetailScreen shows 650 / 10,000
- [ ] Tap "Log Workout" → open a specific exercise log screen
- [ ] Confirm banner shows **Team Progress / 650 / 10,000 reps / [progress bar]** (not 0)
- [ ] Confirm "Your contribution: X reps total" sub-line appears if you've logged before
- [ ] Tap "Log Activity" for a wellness challenge → same verification
- [ ] Submit a log (e.g., 50 reps)
- [ ] On WorkoutLoggedScreen: confirm team progress shows ≥ 650 / 10,000
- [ ] Wait ~5 s (CF fires) → confirm it updates to 700 / 10,000
- [ ] Return to Home → card shows 700 / 10,000
- [ ] Return to ChallengeDetail → shows 700 / 10,000
- [ ] Group Feed → shows 700 / 10,000
- [ ] Re-open Log Workout → banner shows 700 / 10,000
