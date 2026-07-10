# Phase 18I-5E — Audit and Harmonise Challenge Progress Display Source of Truth

**Date:** 2026-07-01
**Branch:** fix/p0-pre-deploy-blockers

---

## 1. Goal

Eliminate the bar/label mismatch on home challenge cards: the progress bar was driven by `completionRate` (correct, stored as an integer 0–100 in `challengeMembers`), while the progress label was driven by `cumulativeLoggedValue` which was never mapped from Firestore — so it was always 0 and produced labels like `"0 / 700 reps"` while the bar correctly showed 17%.

Secondary goal: ensure all three challenge types (competitive, streak, collective) produce type-appropriate progress copy instead of falling through to `"X% complete"`.

---

## 2. Root Cause

`getUserChallengeMembershipSummaries` read `challengeMembers` Firestore documents and mapped them to `ChallengeMembershipSummary`. That type only included `completionRate`, `activitiesCompleted`, `totalActivities`, and `totalPoints`. It did **not** include `cumulativeLoggedValue` or `currentStreak`, even though both fields are written to every `challengeMembers` document by the backend scoring logic.

In `useHomeScreen.ts`, the home card base loop then did:

```ts
// bar source
progress: Math.min(100, Math.round(membership?.completionRate ?? 0))  // e.g. 17

// label source (different field)
const compCumulative = membership?.cumulativeLoggedValue ?? 0  // always 0 → "0 / 700 reps"
```

Result: bar and label derived from different values → visible contradiction.

---

## 3. Changes Made

### 3a. `challengeService.ts` — extend `ChallengeMembershipSummary`

Made the type `export` and added two new fields:

```ts
export type ChallengeMembershipSummary = {
  status: ChallengeMember['status'];
  activitiesCompleted: number;
  totalActivities: number;
  completionRate: number;
  totalPoints: number;
  lastActivityAt?: string;
  cumulativeLoggedValue: number;   // ← NEW
  currentStreak: number;           // ← NEW
};
```

Updated the mapper in `getUserChallengeMembershipSummaries`:

```ts
index.set(data.challengeId, {
  ...existing fields...
  cumulativeLoggedValue: Number(data.cumulativeLoggedValue ?? 0),
  currentStreak: Number(data.currentStreak ?? 0),
});
```

### 3b. `challengeProgressDisplay.ts` — shared helper (NEW FILE)

Created `src/features/Challenges/challengeProgressDisplay.ts` exporting `buildChallengeProgress(challenge, membership)`.

The helper guarantees: **progress (bar) and primaryLabel (text) always derive from the same value.**

Display rules:

| Type | Label format | Bar source |
|------|-------------|------------|
| Competitive | `"120 / 700 reps"` | `cumulativeLoggedValue / Σ targetValues` |
| Competitive (no target) | `"17% of goal"` | `completionRate` |
| Streak (with required days) | `"Day 2 streak · 2 / 7 days"` or `"Start your streak — 7 days to go"` | `currentStreak / requiredConsecutiveDays` |
| Streak (no required days) | `"Day 2 streak"` or `"No streak yet"` | `completionRate` |
| Collective (with group target) | `"3,000 / 10,000 steps"` | `groupCurrentTotal / groupCumulativeTarget` |
| Collective (no target) | `"17% complete"` | `completionRate` |

Progress is clamped to [0, 100] via `Math.min(100, Math.max(0, Math.round(v)))`.

### 3c. `useHomeScreen.ts` — use shared helper for base cards

**Before:**
```ts
// ad-hoc per-type branching with different source variables for bar vs. label
progress: Math.min(100, Math.round(membership?.completionRate ?? 0))
progressLabel: `${compCumulative} / ${compTarget} ${compUnit}`  // always "0 / ..."
```

**After:**
```ts
const display = buildChallengeProgress(c, membership);
return {
  progress: display.progress,
  progressLabel: display.primaryLabel,
  ...
};
```

First-card live enrichment also updated to use `buildChallengeProgress` with the live `progressValue`:

```ts
const liveDisplay = buildChallengeProgress(
  { ...firstChallenge, groupCurrentTotal: firstChallenge.groupCurrentTotal ?? 0 },
  {
    completionRate: membership?.completionRate ?? 0,
    cumulativeLoggedValue: progressValue,
    currentStreak: membership?.currentStreak ?? 0,
  },
);
firstCard.progress = liveDisplay.progress;
firstCard.progressLabel = liveDisplay.primaryLabel;
```

The stale `formatMetric` function (now unused) was removed.

---

## 4. Files Changed

| File | Change |
|------|--------|
| `src/services/challengeService.ts` | Made `ChallengeMembershipSummary` export; added `cumulativeLoggedValue` and `currentStreak` fields and mapper |
| `src/features/Challenges/challengeProgressDisplay.ts` | CREATED — shared helper, all challenge types |
| `src/features/Home/useHomeScreen.ts` | Base cards + live enrichment now use `buildChallengeProgress`; removed `formatMetric` |
| `scripts/testScoringGuards.ts` | Guards 18I-5E-1 through 18I-5E-10 added |

---

## 5. Screens Not Changed

| Screen | Reason |
|--------|--------|
| `ChallengeDetailScreen` | Has its own per-activity progress display; no membership summary used |
| `ChallengeLeaderboardScreen` | Uses raw `cumulativeLoggedValue` directly from leaderboard entries |
| `ChallengeCompletedScreen` | Uses raw progress format from Phase 18I-5B |
| `SelectChallengeActivityScreen` | Shows per-activity progress inline; no base card |
| `HomeScreen.tsx` fallback (`fallbackMyChallenges`) | Day-based skeleton shown only during loading; lacks membership data. Left as `"X% complete"` intentionally |

---

## 6. Regression Guards (18I-5E-1 … 18I-5E-10)

| ID | What it guards |
|----|----------------|
| 18I-5E-1 | `challengeProgressDisplay.ts` exports `buildChallengeProgress` |
| 18I-5E-2 | Helper clamps progress using `Math.min(100)` and `Math.max(0)` |
| 18I-5E-3 | Competitive branch uses `cumulativeLoggedValue` and slash format |
| 18I-5E-4 | Streak branch produces `"Day N streak"` language |
| 18I-5E-5 | Collective branch uses `groupCurrentTotal` / `groupCumulativeTarget` |
| 18I-5E-6 | `useHomeScreen` uses `buildChallengeProgress` and `display.progress` / `display.primaryLabel` |
| 18I-5E-7 | `useHomeScreen` has no stale `compCumulative`, `compTarget`, `compUnit` variables |
| 18I-5E-8 | `useHomeScreen` does not produce `"X reps of Y reps"` format |
| 18I-5E-9 | `ChallengeMembershipSummary` includes `cumulativeLoggedValue: number` and `currentStreak: number` |
| 18I-5E-10 | `getUserChallengeMembershipSummaries` maps `cumulativeLoggedValue` from the Firestore doc |

---

## 7. Validation

```
npx tsc --noEmit                          → ✅ No errors
npm run build                             → ✅ Built in 3.15s
npm run test:scoring-guards               → ✅ All guards passed (incl. 18I-5E-1…10)
npm run test:home-challenge-feeds         → ✅ All guards passed
npm run audit:challenge-creation-payloads → ✅ All guards passed
```

---

## 8. Manual Check Steps

1. **Competitive home card** — should show `"120 / 700 reps"` (or whatever the user's actual logged total is), not `"0 / 700 reps"`. Bar and text should be consistent.

2. **Streak home card** — should show `"Day 2 streak · 2 / 7 days"` (or `"Start your streak — 7 days to go"` if streak = 0). Must not show `"X% complete"`.

3. **Collective home card** — should show `"3,000 / 10,000 steps"` with an optional `"You contributed N steps"` secondary label. Must not show `"X% complete"` when a group target is set.

4. **First-card live enrichment** — after logging a workout, the home card should immediately reflect the new cumulative total with matching bar and label.

---

## 9. Known Limitations

- `buildChallengeProgress` does not yet power `ChallengeDetailScreen`'s user progress bar. That screen reads from a live `useChallenge` query and has its own progress derivation. Harmonising it is out of scope for this phase.
- Collective `secondaryLabel` (`"You contributed N steps"`) is available in the return value but not yet displayed in `HomeScreen.tsx`'s card UI — the card layout only renders `progressLabel`. Adding it is a UI-only change when the card design accommodates it.
- The home screen loading skeleton (`fallbackMyChallenges`) still shows `"X% complete"` for all types. This is acceptable since it only appears briefly during initial load and is immediately replaced by real data.
