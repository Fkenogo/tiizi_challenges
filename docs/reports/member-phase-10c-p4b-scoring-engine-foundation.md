# Phase 10C-P4B — Scoring Engine Foundation

Date: 2026-06-17  
Branch: fix/p0-pre-deploy-blockers  
Status: COMPLETE — scoring module created, tests pass, no production changes

---

## Summary

This phase creates the scoring engine foundation for Tiizi challenges. A single, system-owned module (`src/services/scoringConfig.ts`) replaces the fragmented hardcoded-10 / raw-value dual-scoring system identified in the P4A audit. No production logging flows were changed. No Firestore writes were made. The module is ready to be wired into `activityLogSessionService` (P4D) and the Cloud Function `memberActivitySummaries` (P4E).

---

## What Was Created

### `src/services/scoringConfig.ts`

The canonical scoring engine for the client app.

**Exported types:**
- `ChallengeType` — `'collective' | 'competitive' | 'streak'`
- `ScoringMethod` — `'proportional' | 'binary' | 'competitive_value' | 'streak_binary' | 'fixed'`
- `WellnessScoringMode` — `'binary' | 'proportional'`
- `ScoringResult` — `{ pointsEarned, rawValue, targetValue, metTarget, scoringMethod, capped, reason }`
- `ScoringInput` — `{ value, targetValue, challengeType, activityType?, currentStreak?, basePoints?, clientProvidedPoints? }`
- `ActivityScoringEntry` — `ScoringInput & { activityId }`
- `SessionScoringResult` — `{ totalPointsEarned, activities[], allTargetsMet }`

**Exported constants (`SCORING_CONSTANTS`):**

| Constant | Value | Purpose |
|----------|-------|---------|
| `BASE_POINTS_PER_TARGET` | 10 | Points awarded for exactly meeting the activity target |
| `MIN_EFFORT_RATIO` | 0.05 | Minimum effort (5 % of target) required to earn any points |
| `MAX_OVERPERFORMANCE_MULTIPLIER` | 1.5 | Cap at 150 % of base points for over-delivery |
| `COMPETITIVE_VALUE_CAP_RATIO` | 3.0 | Competitive leaderboard score capped at 3× activity target |
| `STREAK_BONUS_PER_WEEK` | 5 | Bonus points per completed 7-day streak run |
| `STREAK_FULL_PERIOD` | 7 | Days for one full streak bonus cycle |

**Exported functions:**

| Function | Type | Behaviour |
|----------|------|-----------|
| `scoreCumulativeActivity(value, target, base?)` | Collective | Proportional: `min(value/target, 1.5) × base`. Zero if ≤ 5 % of target. |
| `scoreCompetitiveActivity(value, target)` | Competitive | Raw value capped at `3 × target`. |
| `scoreStreakActivity(value, target, streak?, base?)` | Streak | Binary: full `base` if met, 0 if not. Adds `floor(streak/7) × 5` bonus pts. |
| `scoreWellnessActivity(value, target, mode, base?)` | Wellness | Binary (fasting/sleep/meditation) or proportional (hydration). |
| `wellnessScoringModeFor(activityType)` | Helper | Returns `'binary'` for fasting/sleep/meditation/mindfulness; `'proportional'` otherwise. |
| `computeActivityScore(input)` | Dispatcher | Routes to the correct scorer by `challengeType` and `activityType`. Ignores `clientProvidedPoints`. |
| `computeSessionScore(entries[])` | Multi-activity | Scores each activity independently; returns total and `allTargetsMet`. |

### `functions/src/scoringConfig.ts`

Standalone copy for Cloud Functions. Cloud Functions use NodeNext module resolution and cannot import from the client `src/` tree. Both files contain identical scoring logic. When updating scoring rules, update both files together.

### `scripts/testScoringGuards.ts`

42 assertions covering:

1. **Cumulative floor**: 1 rep and 2 reps (≤ 5 % of 40-rep target) earn 0 points
2. **Partial**: 20 reps on 40-rep target earns 5 points (50 % of base)
3. **Target met**: 40 reps earns exactly `BASE_POINTS_PER_TARGET` (10)
4. **At cap**: 60 reps (1.5×) earns max 15 points, `capped=false`
5. **Over cap**: 100 reps (2.5×) earns max 15 points, `capped=true`
6. **No target**: falls back to fixed base points
7. **Competitive cap**: 200 reps on 40-rep target → capped at 120 (3×40)
8. **Streak binary**: below target earns 0; meeting target earns base; 7-day streak adds 5-pt bonus; 14-day adds 10-pt bonus
9. **Wellness mode detection**: fasting/sleep/meditation → binary; hydration → proportional
10. **Wellness binary**: below target → 0, meeting target → base, exceeding → still base (not scaled)
11. **Wellness proportional**: 50 % value → 50 % points
12. **Dispatcher routing**: collective → proportional, fasting in collective → binary, competitive → competitive_value, streak → streak_binary
13. **Client points ignored**: `clientProvidedPoints: 999` produces same result as not providing it; `clientProvidedPoints: 10000` cannot rescue a below-minimum-effort log
14. **Session scoring**: 2-activity session totals correctly; one below-minimum activity does not poison the other
15. **Structural guards**: both source files declare `clientProvidedPoints` as an ignored field with explicit documentation

### `package.json`

Added script: `"test:scoring-guards": "tsx scripts/testScoringGuards.ts"`

---

## Design Decisions

### Why `clientProvidedPoints` is on `ScoringInput` but ignored

The field is declared and documented to create an explicit API contract: callers that previously sent `points: 10` can pass it in the input object without errors, but the value is destructured and never referenced. This is the named trust boundary — future code reviews can grep for `clientProvidedPoints` to verify no code path reads it.

### Why `MIN_EFFORT_RATIO` uses `<=` (not `<`)

Logging exactly 5 % of target (e.g., 2 reps on a 40-rep target) rounds to 0 points anyway (`Math.round(10 × 0.05) = 1`), but semantically "at the floor" should still earn 0. The `<=` guard makes the anti-gaming floor inclusive.

### Why the functions copy is a file, not a shared package

A shared package would require a monorepo tooling change (workspaces, path aliases in functions `tsconfig`). That is out of scope for this phase. The file copy is safe because:
1. Both files are created together in this PR
2. Tests run against `src/services/scoringConfig.ts` (the canonical source)
3. The functions copy is clearly documented as a mirror

### Wellness scoring modes

| Activity type | Mode | Rationale |
|--------------|------|-----------|
| `fasting` | binary | 16h fast is a binary commitment; 10h partial is not 62.5 % credit |
| `sleep` | binary | Sleep quality isn't linear with hours beyond a threshold |
| `meditation` | binary | Same rationale — threshold completion is the goal |
| `mindfulness` | binary | Same as meditation |
| `hydration` | proportional | Drinking 1.5L toward a 2L target is genuinely 75 % of the goal |

---

## What Is Not Changed

| System | Status | Next phase |
|--------|--------|-----------|
| `activityLogSessionService` — still uses hardcoded 10 | Unchanged | P4D |
| `LogWorkoutScreen` — still passes `points: 10` | Unchanged | P4C |
| `LogWellnessActivityScreen` — still passes `points: 10` | Unchanged | P4C |
| `functions/src/memberActivitySummaries.ts` — still uses raw value scoring | Unchanged | P4E |
| `challengeLeaderboards.score` — still based on raw value | Unchanged | P4H (backfill) |
| `challengeMembers.totalPoints` — still incremented at 10/session | Unchanged | P4D |
| Firestore rules | Unchanged | P4D |
| Data migration / backfill | Not started | P4H |

---

## Validation Results

```
npm run test:scoring-guards         → scoring guards passed   (42 assertions)
npm run test:home-challenge-feeds   → home challenge feed guards passed
npm run test:home-performance-guards → home performance guards passed
npm run test:pilot-ux-polish-guards → pilot UX polish guards passed
npx tsc -b --pretty false           → (no errors)
npm run build                       → ✓ built in 3.29s
```

---

## Files Changed

| File | Type | Description |
|------|------|-------------|
| `src/services/scoringConfig.ts` | New | Canonical scoring engine module |
| `functions/src/scoringConfig.ts` | New | Standalone copy for Cloud Functions |
| `scripts/testScoringGuards.ts` | New | 42-assertion scoring logic test suite |
| `package.json` | Modified | Added `test:scoring-guards` script |

---

## Deployment Notes

- No Firestore reads or writes.
- No Cloud Function changes.
- No production scoring paths changed.
- `src/services/scoringConfig.ts` is importable but not yet imported by any live code.
- Do not deploy until P4C–P4E wire the engine into the logging flows.
