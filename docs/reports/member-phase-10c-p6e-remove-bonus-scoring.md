# P6E — Remove Bonus Scoring and Finalize Percentage Points
**Date:** 2026-06-21  
**Branch:** fix/p0-pre-deploy-blockers  
**Phase:** Member Phase 10C — P6E

---

## Problem Statement

P6D introduced `proportional_capped` scoring for streak and wellness-binary activities. However, `scoreStreakActivity` still applied a streak bonus (`+5 pts` per 7-day run) on top of the proportional points. This violated the product rule: **MVP points must be percentage-equivalent against the daily target only — no addends.**

The bonus was also permanently ineffective in production because `currentStreak` was never persisted on `challengeMembers`, but the code path existed and could be triggered unexpectedly if the field were ever populated.

---

## Final Formula

```
pointsEarned = round(min(value / dailyTargetValue, 1) × dailyBasePoints)
```

No `+ streakBonus`. No overperformance. No bonus conditions.

---

## Changes

### `src/services/scoringConfig.ts` and `functions/src/scoringConfig.ts`

**`SCORING_CONSTANTS.STREAK_BONUS_PER_WEEK`** — changed from `5` to `0`. Kept in the constant object so callers referencing it don't break at compile time, but the value is permanently neutralized.

**`scoreStreakActivity` — `currentStreak` parameter** — renamed to `_currentStreak` (leading underscore = ignored). The bonus computation (`streakWeeks`, `streakBonus`) is removed entirely. The function now evaluates exactly the formula above.

Before (P6D):
```ts
const streakWeeks = metTarget ? Math.floor(currentStreak / STREAK_FULL_PERIOD) : 0;
const streakBonus = streakWeeks * STREAK_BONUS_PER_WEEK;
const pointsEarned = Math.round(cappedRatio * basePoints) + streakBonus;
reason: streakBonus > 0 ? `target_met_streak_bonus_${streakBonus}pts` : ...
```

After (P6E):
```ts
const pointsEarned = Math.round(cappedRatio * basePoints);
reason: metTarget ? 'target_met' : 'partial'
```

**`ScoringInput.currentStreak`** — marked `@deprecated` with a note that it is accepted for call-site compatibility but ignored.

**`BINARY_WELLNESS_TYPES` comment** — updated to document that `'binary'` mode no longer means all-or-nothing; it selects the `proportional_capped` path (cap at 1×, no overperformance).

Both files updated identically.

---

## Test Coverage — Section 24

| # | Test | Result |
|---|------|--------|
| 24A-1 | `scoreWellnessActivity(4, 8, 'binary') === 50`, `metTarget false` | ✓ |
| 24A-2 | `scoreWellnessActivity(8, 8, 'binary') === 100`, `metTarget true` | ✓ |
| 24A-3 | `scoreStreakActivity(10, 50) === 20`, `metTarget false` | ✓ |
| 24A-4 | `scoreStreakActivity(50, 50) === 100`, `metTarget true` | ✓ |
| 24A-5 | `scoreStreakActivity(75, 50) === 100` (capped), no bonus | ✓ |
| 24B-1 | `currentStreak=0` and `currentStreak=7` produce identical points | ✓ |
| 24B-2 | `currentStreak=28` produces identical points | ✓ |
| 24C | No `proportional_capped` scorer returns more than `basePoints` | ✓ (3 cases) |
| 24D-1 | Neither file uses `+ streakBonus` | ✓ |
| 24D-2 | Both files have `STREAK_BONUS_PER_WEEK: 0` | ✓ |
| 24D-3 | Both files use `_currentStreak` (ignored param) | ✓ |
| 24E | Client file documents `binary` mode → `proportional_capped` | ✓ |

Sections 3, 23B also updated: bonus tests replaced with no-bonus proofs.

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

---

## Remaining Risks

- **`STREAK_BONUS_PER_WEEK` is still in the constants object** (value `0`). If a future engineer sets it back to `5`, the function won't use it — the parameter is `_currentStreak` and the bonus computation is gone. The constant is now dead weight. A future cleanup phase could remove it entirely.
- **`WellnessScoringMode: 'binary'`** — the type and `wellnessScoringModeFor` return value are still `'binary'`. The mode name is misleading but harmless now that it routes to `proportional_capped` behavior. Renaming to `'proportional_capped'` would require updating `WellnessScoringMode` type and all callers — deferred.
- **`currentStreak` field on `ScoringInput`** — still accepted (ignored). Callers that pass it will compile cleanly. No action needed.
