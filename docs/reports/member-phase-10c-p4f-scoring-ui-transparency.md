# Phase 10C-P4F — Points / Scoring UI Transparency

Date: 2026-06-17  
Branch: fix/p0-pre-deploy-blockers  
Status: COMPLETE — scoring visible and non-confusing in all member-facing screens; XP labels removed; 0-point and target-met copy in place

---

## Summary

P4C/P4D/P4E wired scoring into all logging and leaderboard paths. This phase makes scoring legible to members: every outcome state is labeled, leaderboard labels are consistent, and challenge detail explains how points work for each challenge type.

---

## What Changed

### `src/services/challengeActivityFlow.ts`

- `points: String(context.points ?? 10)` → `points: String(context.points ?? 0)` — removes the hardcoded 10-point fallback that would have been shown to members after a 0-point log.
- Added `metTarget?: boolean` to the `buildActivitySuccessPath` context type and to the URL querystring. Consumed by `WorkoutLoggedScreen` to determine which explanation label to show.

---

### `src/features/Workouts/LogWorkoutScreen.tsx`

Passes `metTarget: scoring.metTarget` into `buildActivitySuccessPath` so the success screen can show the correct label.

---

### `src/features/Workouts/LogWellnessActivityScreen.tsx`

Same — passes `metTarget: scoring.metTarget` through to the success path.

---

### `src/features/Workouts/WorkoutLoggedScreen.tsx`

**Points parsing fix:**

```ts
// Before — || 10 would return 10 when points param was absent, masking 0-point logs
const points = Number(params.get('points') || 10);

// After — null-safe; returns 0 when param absent
const pointsParam = params.get('points');
const points = pointsParam !== null ? Number(pointsParam) : 0;
const metTarget = params.get('metTarget') === 'true';
```

**Points display — before:**
```tsx
{totalPoints > 0 && <p className="mt-3 text-[12px] leading-[15px] font-bold text-primary">Points earned: {totalPoints}</p>}
```
Hidden when `totalPoints === 0`; no explanation shown for any outcome.

**Points display — after:**
```tsx
<div className="mt-3 flex items-center justify-between rounded-xl bg-[#fff7f1] px-3 py-2">
  <span className="text-[13px] leading-[16px] font-black text-[#1c120d]">Points earned</span>
  <span className="text-[13px] leading-[16px] font-black text-primary">{totalPoints}</span>
</div>
{loggedEntries.length === 0 && (
  <p className="mt-2 text-[12px] leading-[16px] font-medium text-[#5f5148]">
    {totalPoints === 0
      ? 'Below minimum effort for points.'
      : metTarget
      ? 'Target met.'
      : 'Partial points earned.'}
  </p>
)}
```

Points are always shown (including 0). Explanation text is shown for single-activity logs (direct logging path):
- `0 points` → "Below minimum effort for points."
- `metTarget === true` → "Target met."
- `metTarget === false && points > 0` → "Partial points earned."

Multi-activity sessions (entries JSON path) show total points only — per-entry explanation is omitted since there is no `metTarget` context per entry in the batch result.

---

### `src/features/Challenges/ChallengeLeaderboardScreen.tsx`

- Both "XP" labels replaced with "pts" (`{myEntry.score} pts`, `{row.score} pts`).
- Added helper text below the stats panel:

  > *"Points are based on challenge targets, not just logging activity."*

---

### `src/features/Groups/GroupLeaderboardScreen.tsx`

- "XP" label in the ranked list replaced with "pts".

---

### `src/features/Challenges/ChallengeDetailScreen.tsx`

Added a **"How Points Work"** card above the Leaderboard Snapshot. Copy varies by `challengeType`:

| Type | Copy |
|------|------|
| `competitive` | Higher activity earns more points, capped for fairness. Aim to meet or exceed the target. |
| `streak` | Points reward consistent daily completion. Each day you hit the target earns points. |
| `wellness` | Points depend on meeting your wellness activity target. Logging below 5% of the target earns no points. |
| `collective` (default) | Points scale with how close you get to the activity target. Reach the full target to maximize points. |

All paths include: *"Points are based on challenge targets, not just logging activity."*

---

### `scripts/testScoringGuards.ts` — Section 12 (P4F guards)

Added 10 new assertions:

1. `challengeActivityFlow` does not fall back to 10 points (`?? 10`)
2. `WorkoutLoggedScreen` does not use `|| 10` fallback for points parsing
3. `WorkoutLoggedScreen` contains "Below minimum effort for points." copy
4. `WorkoutLoggedScreen` contains "Target met." copy
5. `WorkoutLoggedScreen` contains "Partial points earned." copy
6. `ChallengeLeaderboardScreen` does not render `>XP<` label
7. `GroupLeaderboardScreen` does not render `>XP<` label
8. `ChallengeDetailScreen` contains "How Points Work" section
9. `ChallengeLeaderboardScreen` contains "Points are based on challenge targets" helper text
10. None of the four member UI files expose `scoringVersion`, `rawValue`, `scoringMethod`, or `anti-gaming` text

---

## Guardrails Verified

| Guardrail | Status |
|-----------|--------|
| No raw scoring metadata shown (`scoringVersion`, `rawValue`, `scoringMethod`) | ✅ |
| No Firebase/debug text in member screens | ✅ |
| No hardcoded "10 points" copy | ✅ |
| No claim that every logged activity earns points | ✅ (0-point case explicitly shown and labeled) |
| "XP" removed from leaderboard labels | ✅ |
| "Points" used consistently | ✅ |

---

## Validation Results

```
npm run test:scoring-guards          → scoring guards passed  (76 assertions, 10 new P4F guards)
npm run test:pilot-ux-polish-guards  → pilot UX polish guards passed
npm run test:home-challenge-feeds    → home challenge feed guards passed
npm run test:home-performance-guards → home performance guards passed
npx tsc -b --pretty false            → (no errors)
npm run build                        → ✓ built in 3.50s
```

---

## Files Changed

| File | Type | Description |
|------|------|-------------|
| `src/services/challengeActivityFlow.ts` | Modified | Fix `?? 10` → `?? 0`; add `metTarget` to context type and URL params |
| `src/features/Workouts/LogWorkoutScreen.tsx` | Modified | Pass `metTarget` to success path |
| `src/features/Workouts/LogWellnessActivityScreen.tsx` | Modified | Pass `metTarget` to success path |
| `src/features/Workouts/WorkoutLoggedScreen.tsx` | Modified | Fix points parsing; show 0 points; add outcome explanation labels |
| `src/features/Challenges/ChallengeLeaderboardScreen.tsx` | Modified | XP → pts; add helper text |
| `src/features/Groups/GroupLeaderboardScreen.tsx` | Modified | XP → pts |
| `src/features/Challenges/ChallengeDetailScreen.tsx` | Modified | Add "How Points Work" card per challenge type |
| `scripts/testScoringGuards.ts` | Modified | 10 new P4F UI transparency guards |

---

## Deployment Notes

- No Firestore changes.
- No Cloud Function changes.
- Purely client-side UI; fully backwards-compatible with existing logs (0-point explanation only shows on the direct-log success screen, not in history views).
- Do not deploy until sign-off on remaining P4x phases.
