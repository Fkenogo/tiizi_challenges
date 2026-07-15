# Phase 11C — LegacyEngine Integration
**Branch:** `fix/p0-pre-deploy-blockers`  
**Date:** 2026-06-25  
**Status:** Complete — all validation commands passed

---

## 1. Files Modified

### Application services (2)

| File | Change |
|---|---|
| `src/services/workoutService.ts` | Added `selectEngine` import; added `engineVersion?` to `challengeData` type; replaced inline `nextCompleted`/`nextRate`/`if (nextRate >= 100)` block with `engine.computeUpdate()` call |
| `src/services/wellnessLogService.ts` | Added `selectEngine` import; added `engineVersion?`/`startDate?`/`endDate?` to `challengeData` type; replaced inline `completed`/`completionRate`/`if (completionRate >= 100)` block with `engine.computeUpdate()` call |

### Test script (1)

| File | Change |
|---|---|
| `scripts/testScoringGuards.ts` | Added `LegacyEngine` import; added Section 26 (9 guards: service wiring, engine call, inline removal, v2 isolation, fixture equivalence); updated Section 14 completion guard patterns for Phase 11C; updated Section 21C guard ordering check (guard-before-engine-call instead of guard-before-inline-increment); updated Section 25G from "not yet wired" to "now wired" assertion |

### Files NOT modified

- `src/services/challengeEngine/` — all 6 framework files unchanged
- All UI screens — unchanged
- Firestore rules — unchanged
- All other services — unchanged

---

## 2. Code Diff Summary

### workoutService.ts

**Removed** (inline completion block):
```typescript
const alreadyCompleted = membership.activitiesCompleted ?? 0;
const nextCompleted = Math.min(alreadyCompleted + 1, totalActivities);
const nextRate = Math.min(100, Math.round((nextCompleted / totalActivities) * 100));
// ...
if (nextRate >= 100) {
  membershipUpdate.status = 'completed';
  membershipUpdate.completedAt = Timestamp.now();
}
```

**Added** (engine-based):
```typescript
const engine = selectEngine(challengeData);           // → LegacyEngine for all v1 challenges
const engineResult = engine.computeUpdate(context, membershipSnapshot, logEvent);
// ...
if (engineResult.isCompleted) {
  membershipUpdate.status = 'completed';
  membershipUpdate.completedAt = Timestamp.now();
}
```

**Batch writes unchanged**: `increment(scoring.pointsEarned)` for `totalPoints`, `Timestamp.now()` for timestamps, same document targets, same batch ordering (`workoutRef` → `users/{uid}` → `membershipRef`).

### wellnessLogService.ts

**Removed**:
```typescript
const completed = Math.min(Number(membership.activitiesCompleted ?? 0) + 1, totalActivities);
const completionRate = Math.min(100, Math.round((completed / totalActivities) * 100));
// ...
if (completionRate >= 100) {
  membershipUpdate.status = 'completed';
  membershipUpdate.completedAt = now;
}
```

**Added** (same engine pattern):
```typescript
const engine = selectEngine(challengeData);
const engineResult = engine.computeUpdate(context, membershipSnapshot, logEvent);
// ...
if (engineResult.isCompleted) {
  membershipUpdate.status = 'completed';
  membershipUpdate.completedAt = now;
}
```

**Batch writes unchanged**: `increment(points)`, `Timestamp.now()`, same document targets, same batch ordering (`logRef` → `membershipRef`).

---

## 3. Commands Executed

```
npx tsc -b --pretty false      → 0 errors (exit 0)
npm run build                  → ✓ built in 3.37s
npm run test:scoring-guards    → scoring guards passed
npm run test:home-challenge-feeds → all guards passed
```

---

## 4. Dependencies Added

None.

---

## 5. Config Changes

None.

---

## 6. Risks

**Low.** The refactor is a mechanical extraction with no behavioral change for v1 challenges:

- `selectEngine(challengeData)` with `engineVersion !== 'v2'` always returns `LegacyEngine` — verified by Section 25B guard.
- `LegacyEngine.computeUpdate` replicates the former inline logic exactly — verified by Section 26.9 fixture tests (4 fixtures covering mid-progress, final completion, at-cap overflow, and 1-day challenge).
- All Firestore writes use the same FieldValues (`increment`, `Timestamp.now()`) and the same batch ordering as before.
- `totalActivities` in the `MembershipSnapshot` is set to the freshly-computed value (not the stale membership doc value) — identical to the previous inline behavior which also used the freshly-computed `totalActivities`.

**v2 engine guard**: Guard 26.8 verifies `StreakEngine`, `CompetitiveEngine`, and `CollectiveEngine` still throw `"not wired yet"`. Any challenge document with `engineVersion: 'v2'` (none exist in production today) would cause a runtime throw at the call site — a loud, immediate error, not silent data corruption.

---

## 7. Rollback Instructions

```bash
git checkout HEAD -- src/services/workoutService.ts src/services/wellnessLogService.ts scripts/testScoringGuards.ts
```

The engine framework files (`src/services/challengeEngine/`) are unmodified and do not need rollback.

---

## 8. Evidence — LegacyEngine Produces Identical Behavior

Section 26.9 runs 4 deterministic fixtures proving byte-for-byte equivalence to the previous inline calculation:

| Fixture | Scenario | `activitiesCompleted` | `completionRate` | `isCompleted` |
|---|---|---|---|---|
| A | 5 of 30 complete, 75 pts | `min(5+1, 30) = 6` | `round(6/30 × 100) = 20` | `false` |
| B | 29 of 30 complete — final log | `min(29+1, 30) = 30` | `100` | `true` |
| C | Already at cap (30 of 30) | `min(30+1, 30) = 30` | `100` | `true` |
| D | Single-log 1-day challenge | `min(0+1, 1) = 1` | `100` | `true` |

All 4 fixtures: LegacyEngine output === previous inline formula. No behavioral drift.

**Identical Firestore writes:**

| Field | Before | After | Same? |
|---|---|---|---|
| `activitiesCompleted` | `nextCompleted` (Math.min inline) | `engineResult.membershipUpdate.activitiesCompleted` | ✅ identical value |
| `completionRate` | `nextRate` (Math.round inline) | `engineResult.membershipUpdate.completionRate` | ✅ identical value |
| `totalPoints` | `increment(scoring.pointsEarned)` | `increment(scoring.pointsEarned)` | ✅ unchanged |
| `lastActivityAt` | `Timestamp.now()` | `Timestamp.now()` | ✅ unchanged |
| `status` | `'completed'` when `nextRate >= 100` | `'completed'` when `engineResult.isCompleted` | ✅ identical condition |
| `completedAt` | `Timestamp.now()` on completion | `Timestamp.now()` on completion | ✅ unchanged |

---

## 9. Confirmation — v2 Engines Remain Inactive

Guard 26.8 verifies at test time:
- `StreakEngine.computeUpdate` throws `"Engine not wired yet"`
- `CompetitiveEngine.computeUpdate` throws `"Engine not wired yet"`
- `CollectiveEngine.computeUpdate` throws `"Engine not wired yet"`

Guards 26.5, 26.6, 26.7 verify:
- `workoutService` does NOT import `StreakEngine`
- `workoutService` does NOT import `CompetitiveEngine`
- `workoutService` does NOT import `CollectiveEngine`
- Same for `wellnessLogService`

No production challenge document has `engineVersion: 'v2'` — the new creation wizard (Phase 11E, not yet implemented) is the only path to creating v2 challenges.

---

## 10. Guard Test Updates

Three existing guard sections were updated to reflect Phase 11C reality:

| Section | Old check | New check | Reason |
|---|---|---|---|
| Section 14 | `if (nextRate >= 100)` pattern in workoutService | `if (engineResult.isCompleted)` pattern | Inline replaced by engine result |
| Section 14 | `if (completionRate >= 100)` in wellnessLogService | `if (engineResult.isCompleted)` | Same |
| Section 21C | Guard before `Math.min(alreadyCompleted + 1` | Guard before `engine.computeUpdate(` | Increment moved inside LegacyEngine |
| Section 25G | `doesNotMatch(workoutSrc, /selectEngine/)` | `match(workoutSrc, /selectEngine/)` | Phase 11C wired the services |
