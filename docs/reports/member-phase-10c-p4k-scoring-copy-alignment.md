# Phase 10C-P4K — Scoring Result Copy Alignment

Date: 2026-06-18  
Branch: fix/p0-pre-deploy-blockers  
Status: COMPLETE — copy aligned, guards added, all validation passes

---

## Problem

P4J identified that `WorkoutLoggedScreen` showed "Below minimum effort for points." for **all** 0-point logs. This was accurate for proportional/collective challenges (where the 5% effort floor applies) but misleading for streak challenges, where scoring is binary: you either meet the daily target (full points) or you don't (0 points) — there is no proportional floor concept.

Example: A streak challenge with a 1,400-unit daily target. A user logs 100 units. They get 0 points not because of an effort floor but because they simply didn't meet the target. Showing "Below minimum effort" implies they were close but not quite — the real message is "Target not met."

---

## Fix

### 1. `src/services/challengeActivityFlow.ts`

Added `scoringMethod?: string` to the `buildActivitySuccessPath` context type and included it as a URL query param.

```ts
// context type
scoringMethod?: string;

// URL params
if (context.scoringMethod) qs.set('scoringMethod', context.scoringMethod);
```

### 2. `src/features/Workouts/LogWorkoutScreen.tsx`

Passes `scoring.scoringMethod` to `buildActivitySuccessPath`:

```ts
scoringMethod: scoring.scoringMethod,
```

### 3. `src/features/Workouts/LogWellnessActivityScreen.tsx`

Same — passes `scoring.scoringMethod` to `buildActivitySuccessPath`:

```ts
scoringMethod: scoring.scoringMethod,
```

### 4. `src/features/Workouts/WorkoutLoggedScreen.tsx`

Reads `scoringMethod` from URL params and uses it in the 0-point copy branch:

```ts
const scoringMethod = params.get('scoringMethod') ?? '';
```

```tsx
{totalPoints === 0
  ? scoringMethod === 'streak_binary'
    ? 'Target not met.'
    : 'Below minimum effort for points.'
  : metTarget
  ? 'Target met.'
  : 'Partial points earned.'}
```

---

## Copy Matrix (after fix)

| Scenario | `totalPoints` | `scoringMethod` | `metTarget` | Copy shown |
|----------|--------------|-----------------|-------------|------------|
| Streak target not met | 0 | `streak_binary` | false | **Target not met.** |
| Collective/competitive below 5% floor | 0 | `proportional` / other | false | **Below minimum effort for points.** |
| Partial progress, no target | > 0 | any | false | **Partial points earned.** |
| Target met | > 0 | any | true | **Target met.** |

The copy is only shown on the single-activity path (`loggedEntries.length === 0`). Multi-activity sessions (which use the `entries` URL param) do not show per-activity copy — that path is unchanged.

---

## Guard Update — `scripts/testScoringGuards.ts`

The existing Section 12 guard banned `scoringMethod` from all member-facing screens. Since `WorkoutLoggedScreen` now legitimately uses `scoringMethod` as a logic variable (to select copy text, never rendered as visible text), the guard was split:

- `ChallengeLeaderboardScreen`, `GroupLeaderboardScreen`, `ChallengeDetailScreen`: still forbidden from having `scoringVersion`, `rawValue`, `scoringMethod`, or `anti-gaming`.
- `WorkoutLoggedScreen`: `scoringVersion` and `rawValue` still forbidden; `scoringMethod` allowed but must not be rendered as visible JSX text.

### Section 15 — P4K guards (8 new assertions)

1. `challengeActivityFlow` accepts `scoringMethod`
2. `challengeActivityFlow` sets `scoringMethod` on the URL query string
3. `LogWorkoutScreen` passes `scoring.scoringMethod` to `buildActivitySuccessPath`
4. `LogWellnessActivityScreen` passes `scoring.scoringMethod` to `buildActivitySuccessPath`
5. `WorkoutLoggedScreen` reads `scoringMethod` from URL params
6. `WorkoutLoggedScreen` shows "Target not met." for `streak_binary` 0-point logs
7. `WorkoutLoggedScreen` branches on `scoringMethod` before showing "Below minimum effort" copy
8. `WorkoutLoggedScreen` has no `|| 10` fallback on points

---

## Validation Results

```
npm run test:scoring-guards          → scoring guards passed
npm run test:home-challenge-feeds    → home challenge feed guards passed
npm run test:home-performance-guards → home performance guards passed
npm run test:pilot-ux-polish-guards  → pilot UX polish guards passed
npx tsc -b --pretty false            → (no errors)
npm run build                        → ✓ built in 2.94s
```

Also fixed an unrelated TS error in `scripts/inspectScoringDocs.ts` (P4J dev tool) that was caught by the tsc run: incorrect named import `credential` from `firebase-admin/app`.

---

## Files Changed

| File | Change |
|------|--------|
| `src/services/challengeActivityFlow.ts` | Added `scoringMethod` to context type + URL params |
| `src/features/Workouts/LogWorkoutScreen.tsx` | Passes `scoring.scoringMethod` to success path |
| `src/features/Workouts/LogWellnessActivityScreen.tsx` | Passes `scoring.scoringMethod` to success path |
| `src/features/Workouts/WorkoutLoggedScreen.tsx` | Reads `scoringMethod` param; `streak_binary` shows "Target not met." |
| `scripts/testScoringGuards.ts` | Split Section 12 guard; added Section 15 (8 new assertions) |
| `scripts/inspectScoringDocs.ts` | Fixed stray TS import error |

---

## Deployment Notes

No Firestore or rules changes. Deploys with the rest of the branch. The fix is purely a URL param + display logic change — no data migration needed.
