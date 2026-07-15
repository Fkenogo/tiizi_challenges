# P6C — Daily Target Scoring Model Fix
**Date:** 2026-06-21  
**Branch:** fix/p0-pre-deploy-blockers  
**Phase:** Member Phase 10C — P6C

---

## Problem Statement

All challenge activities for multi-day streak challenges stored a **cumulative** `targetValue` in Firestore (e.g., 50 reps/day × 21 days = `targetValue: 1050`). When a user logged 50 reps, `computeActivityScore` compared `value: 50` against `targetValue: 1050`, producing 0 points — despite the user meeting their daily goal.

This affected every streak challenge with `durationDays > 1`:
- **Squat + Pushup 50** (21-day): target stored as 1050, user logs 50 → 0 pts
- Any streak challenge with a cumulative numeric target

---

## Root Cause

`computeActivityScore` receives `targetValue` directly from the logging call inputs. The inputs come from the challenge's activity definition, which stores the cumulative value. No layer was adjusting from cumulative → daily before scoring.

---

## Fix: `deriveDailyTargetValue`

Added a single helper in `src/services/challengeCompletion.ts`:

```ts
export function deriveDailyTargetValue(
  targetValue: number,
  durationDays: number | null | undefined,
  challengeType: string,
): number {
  if (challengeType !== 'streak') return targetValue;
  const days = Math.max(1, Number(durationDays) || 1);
  if (days <= 1) return targetValue;
  const derived = targetValue / days;
  return derived >= 1 ? derived : targetValue;
}
```

**Decision logic:**
| Condition | Action | Rationale |
|-----------|--------|-----------|
| Not a streak challenge | Return as-is | Collective/competitive targets are per-session |
| `durationDays <= 1` | Return as-is | No division possible |
| `targetValue / durationDays >= 1` | Return quotient | Cumulative target — divide to get daily |
| `targetValue / durationDays < 1` | Return as-is | Already a daily target (e.g. 8 hrs sleep / 20 days = 0.4) |

---

## Files Changed

### `src/services/challengeCompletion.ts`
Added `deriveDailyTargetValue` export.

### `src/services/wellnessLogService.ts`
```ts
const effectiveTargetValue = deriveDailyTargetValue(
  input.targetValue ?? 0, challenge.durationDays, challengeType
);
const scoring = computeActivityScore({
  value: input.value,
  targetValue: effectiveTargetValue,
  ...
});
```

### `src/services/workoutService.ts`
Same pattern. `effectiveTargetValue` replaces raw `input.targetValue` passed to `computeActivityScore`.

### `src/services/activityLogSessionService.ts`
Same pattern per-entry in `input.entries.forEach`.

### `src/features/Workouts/LogWorkoutScreen.tsx`
Client-side scoring preview updated to derive daily target before computing points shown to the user.

### `src/features/Workouts/LogWellnessActivityScreen.tsx`
Same — preview scoring uses `deriveDailyTargetValue` so success screen shows accurate points.

### `src/features/Challenges/ChallengeDetailScreen.tsx`
Activity target display updated:
```tsx
• target {deriveDailyTargetValue(activity.targetValue, durationDays, challengeType)} {unit}/day
```
Cumulative targets are no longer shown to users as their daily goal.

---

## Test Coverage — Section 22 (Guard Tests)

Added to `scripts/testScoringGuards.ts`:

| # | Test | Result |
|---|------|--------|
| 22A-1 | `deriveDailyTargetValue(1050, 21, 'streak') === 50` | ✓ |
| 22A-2 | `deriveDailyTargetValue(8, 20, 'streak') === 8` (quotient < 1, keep) | ✓ |
| 22A-3 | `deriveDailyTargetValue(1, 7, 'streak') === 1` (quotient < 1, keep) | ✓ |
| 22A-4 | `deriveDailyTargetValue(1050, 21, 'collective') === 1050` (non-streak unchanged) | ✓ |
| 22A-5 | `deriveDailyTargetValue(1050, 21, 'competitive') === 1050` (non-streak unchanged) | ✓ |
| 22A-6 | `deriveDailyTargetValue(100, 1, 'streak') === 100` (single-day, no divide) | ✓ |
| 22A-7 | `deriveDailyTargetValue(100, undefined, 'streak') === 100` (missing days, no divide) | ✓ |
| 22B-1 | `scoreStreakActivity(50, 1050).pointsEarned === 0` (confirms bug is real) | ✓ |
| 22B-2 | `scoreStreakActivity(50, 50).pointsEarned > 0` (fix earns points) | ✓ |
| 22B-3 | `scoreStreakActivity(50, 50).metTarget === true` | ✓ |
| 22B-4 | `scoreStreakActivity(25, 50).pointsEarned === 0` (partial still earns 0 — streak_binary) | ✓ |
| 22C | `scoreWellnessActivity(8, 8, 'binary').pointsEarned > 0` | ✓ |
| 22D | All 3 services import and use `deriveDailyTargetValue` | ✓ |
| 22D | All 3 services pass `durationDays` to `deriveDailyTargetValue` | ✓ |
| 22E | No service passes raw `input.targetValue` directly to `computeActivityScore` | ✓ |
| 22E | All services pass `effectiveTargetValue` to `computeActivityScore` | ✓ |

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
| `firebase deploy --only firestore:rules --dry-run` | ✅ compiled |

---

## Backwards Compatibility

- Existing `challengeMembers` documents are not touched. `deriveDailyTargetValue` is a pure computation applied at log time; it does not modify stored data.
- Old challenge documents that stored a genuine daily `targetValue` (quotient < 1) are handled: the value is returned unchanged.
- Collective and competitive challenges are fully unaffected.
- No Firestore rules changes required for P6C (the daily target derivation is client-side logic only).

---

## Known Remaining Issues (Out of Scope for P6C)

- **New challenge creation still stores cumulative targets** — `CreateChallengeScreen` writes `targetValue = dailyTarget × durationDays`. This is a P6D concern (fix the write path, not the read/score path).
- **Wellness permission failure** — `activityType: 'social'` maps to `logType: 'meditation'`, still blocked by Firestore rules for social challenges. Identified in P6A; deferred to its own phase.
