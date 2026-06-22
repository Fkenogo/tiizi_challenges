# P6D — Percentage-Equivalent Daily Points
**Date:** 2026-06-21  
**Branch:** fix/p0-pre-deploy-blockers  
**Phase:** Member Phase 10C — P6D

---

## Problem Statement

Two scoring methods produced results that were not percentage-equivalent against the daily target:

1. **`streak_binary`** (`scoreStreakActivity`): awarded 0 pts for any partial effort (`value < targetValue`), full `basePoints` only when target was met exactly.  
   - A user logging 25 out of 50 required reps earned **0 points** despite completing 50% of the goal.

2. **`binary` wellness** (`scoreWellnessActivity` with `mode: 'binary'`): same all-or-nothing behavior for sleep, fasting, and meditation activities.  
   - A user sleeping 4 of 8 target hours earned **0 points** despite completing 50% of the goal.

Both methods were also inconsistent with the stated design: "points are percentage-equivalent against the daily target."

A secondary concern: `scoreStreakActivity(105, 50)` previously awarded 105 + streakBonus points — raw value, not percentage. Under the new capped model, it awards exactly 100.

---

## Scoring Formula — P6D

```
pointsEarned = round(min(value / dailyTargetValue, 1) × dailyBasePoints) + streakBonus
```

Three properties are now cleanly separated:

| Property | Rule |
|----------|------|
| `pointsEarned` | Proportional to `value / target`, capped at `1×` (no overperformance) |
| `metTarget` | `value >= targetValue` |
| Streak continuation | Only when `metTarget === true` |
| Streak bonus | Only when `metTarget === true`; `+5 pts` per completed 7-day run |

---

## Changes

### `src/services/scoringConfig.ts` and `functions/src/scoringConfig.ts`

**`ScoringMethod` type** — added `'proportional_capped'`. Legacy values `'binary'` and `'streak_binary'` remain in the union for backwards compatibility with stored data but are no longer emitted by any code path.

**`scoreStreakActivity`** — replaced binary all-or-nothing with proportional_capped:

```ts
// Before (streak_binary):
if (!metTarget) return { pointsEarned: 0, ... };
return { pointsEarned: basePoints + streakBonus, ... };

// After (proportional_capped):
const cappedRatio = Math.min(value / targetValue, 1);
const pointsEarned = Math.round(cappedRatio * basePoints) + (metTarget ? streakBonus : 0);
return { pointsEarned, scoringMethod: 'proportional_capped', ... };
```

**`scoreWellnessActivity` (binary mode)** — replaced all-or-nothing with proportional_capped:

```ts
// Before:
return { pointsEarned: metTarget ? basePoints : 0, scoringMethod: 'binary', ... };

// After:
const cappedRatio = Math.min(value / targetValue, 1);
return { pointsEarned: Math.round(cappedRatio * basePoints), scoringMethod: 'proportional_capped', ... };
```

Both files updated identically (functions copy is a standalone mirror per project convention).

### `src/features/Workouts/WorkoutLoggedScreen.tsx`

Removed the dead `streak_binary` copy branch. Simplified to three states:

```tsx
// Before:
totalPoints === 0
  ? scoringMethod === 'streak_binary'
    ? 'Target not met.'
    : 'Below minimum effort for points.'
  : metTarget ? 'Target met.' : 'Partial points earned.'

// After:
metTarget
  ? 'Target met.'
  : totalPoints === 0
    ? 'Target not met.'
    : 'Partial points earned.'
```

### `scripts/testScoringGuards.ts`

- **Section 3** (Streak): updated expectations from binary to proportional_capped. Added over-target cap test.
- **Section 4** (Wellness binary): updated expectations from binary to proportional_capped.
- **Section 5** (Dispatcher): updated `scoringMethod` expectations from `'streak_binary'`/`'binary'` to `'proportional_capped'`.
- **Lines 505–510** (`WorkoutLoggedScreen` copy guard): replaced "Below minimum effort" assertion with "Target not met." + `doesNotMatch` for old copy.
- **Lines 715–727** (`WorkoutLoggedScreen` `streak_binary` guards): replaced with `doesNotMatch(/streak_binary/)` guard and "Partial points earned." check.
- **Section 22B** (P6C regression): updated "bug confirmation" from `=== 0` to `< 10` (under P6D, 50/1050 earns ~5 pts proportionally — still near-zero, still wrong, still proves deriveDailyTargetValue is needed).
- **Section 23** (new P6D guards): 25+ assertions across 6 sub-sections (23A–23F).

---

## Test Coverage — Section 23

| # | Test | Result |
|---|------|--------|
| 23A-1 | `scoreWellnessActivity(4, 8, 'binary') === 50` | ✓ |
| 23A-2 | `scoreStreakActivity(10, 50) === 20` (reps) | ✓ |
| 23A-3 | `scoreStreakActivity(10, 50) === 20` (seconds, same formula) | ✓ |
| 23A-4 | `scoreStreakActivity(10, 50) !== 10` (raw value not used) | ✓ |
| 23A-5 | `scoreStreakActivity(25, 50) === 50` (was 0 under streak_binary) | ✓ |
| 23A-6 | `scoreStreakActivity(50, 50) === 100` | ✓ |
| 23A-7 | `scoreStreakActivity(75, 50) === 100` (capped) | ✓ |
| 23A-8 | `scoreStreakActivity(105, 50) !== 105` (raw value not used) | ✓ |
| 23A-9 | `scoreStreakActivity(105, 50) === 100` (capped) | ✓ |
| 23B-1 | `scoreStreakActivity(25, 50).metTarget === false` | ✓ |
| 23B-2 | `scoreStreakActivity(25, 50).pointsEarned > 0` (partial earns pts) | ✓ |
| 23B-3 | Streak bonus not awarded when target not met | ✓ |
| 23B-4 | Streak bonus awarded when target met | ✓ |
| 23C | Mixed-unit session: 10/50 reps + 4/8 hrs = 20+50 = 70 pts (not 10+4=14) | ✓ |
| 23D-1 | `scoreStreakActivity` returns `'proportional_capped'` | ✓ |
| 23D-2 | `scoreWellnessActivity(binary)` returns `'proportional_capped'` | ✓ |
| 23D-3 | `streak_binary` not emitted | ✓ |
| 23D-4 | `binary` not emitted | ✓ |
| 23E | `WorkoutLoggedScreen` has no `streak_binary` reference | ✓ |
| 23E | `WorkoutLoggedScreen` has "Partial points earned." | ✓ |
| 23F | Both scoringConfig files use `proportional_capped` | ✓ |
| 23F | Neither file emits `streak_binary` or `binary` | ✓ |

---

## Validation Results

| Check | Status |
|-------|--------|
| `npm run test:scoring-guards` | ✅ passed |
| `npm run test:home-challenge-feeds` | ✅ passed |
| `npm run test:home-performance-guards` | ✅ passed |
| `npm run test:pilot-ux-polish-guards` | ✅ passed |
| `npm run test:challenge-creation-backend` | ✅ passed |
| `npm run test:group-invite-backend` | ✅ passed |
| `npx tsc -b --pretty false` | ✅ no errors |
| `npm run build` | ✅ clean |

No Firestore rules changes — scoring is pure client-side computation.

---

## Remaining Risks

- **`wellnessScoringModeFor`** still returns `'binary'` for sleep/fasting/meditation. The *mode* is just a selector — the actual behavior is now proportional. If external code checks for `mode === 'binary'` and infers "earns 0 for partial", it will be wrong. No such code path exists today, but the mode name is now misleading.
- **Collective challenges with `activityType: 'sleep'`** now score proportionally. Previously they scored all-or-nothing. This is the intended P6D behavior but may surprise users migrated from old challenges.
- **Streak bonus (+5 pts/week)** is defined and wired, but `currentStreak` is not yet persisted on `challengeMembers`. Bonus is always 0 in practice until P6E tracks streak state.
