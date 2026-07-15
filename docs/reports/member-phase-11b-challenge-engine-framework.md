# Phase 11B — Challenge Engine Framework
**Branch:** `fix/p0-pre-deploy-blockers`  
**Date:** 2026-06-25  
**Status:** Complete — all validation commands passed

---

## 1. Files Modified

### New files created (6 total)

| File | Purpose |
|---|---|
| `src/services/challengeEngine/types.ts` | Shared interfaces: `ChallengeEngine`, `ChallengeContext`, `MembershipSnapshot`, `LogEvent`, `EngineResult`, `EngineVersion`, `ChallengeType`, `TargetType`, `ActivityConfig` |
| `src/services/challengeEngine/legacyEngine.ts` | `LegacyEngine` — wraps current v1 frequency-counter logic; does not call Firestore |
| `src/services/challengeEngine/streakEngine.ts` | `StreakEngine` — stub with `throw "not wired yet"` on `computeUpdate`; `computeStreakUpdate` static helper for unit testing |
| `src/services/challengeEngine/competitiveEngine.ts` | `CompetitiveEngine` — stub + `computeCompetitiveUpdate` static helper |
| `src/services/challengeEngine/collectiveEngine.ts` | `CollectiveEngine` — stub + `computeCollectiveUpdate` static helper |
| `src/services/challengeEngine/index.ts` | `selectEngine(challenge)` — routes by `engineVersion` + `challengeType`; re-exports all types and classes |

### Modified files (1)

| File | Change |
|---|---|
| `scripts/testScoringGuards.ts` | Added Section 25 (9 guards: file existence, selectEngine routing, throw guard, no live wiring, interface compliance, types completeness) |

### Files NOT modified

- `src/services/workoutService.ts` — unchanged
- `src/services/wellnessLogService.ts` — unchanged
- `src/features/Challenges/ChallengeDetailScreen.tsx` — unchanged
- `src/features/Challenges/CreateChallengeWizard.tsx` — unchanged
- `firestore.rules` — unchanged
- All other application files — unchanged

---

## 2. Code Diff Summary

### `selectEngine` routing logic

```typescript
export function selectEngine(challenge: EngineSelector): ChallengeEngine {
  if (challenge.engineVersion !== 'v2') return new LegacyEngine();   // all existing challenges

  switch (challenge.challengeType) {
    case 'streak':       return new StreakEngine();
    case 'competitive':  return new CompetitiveEngine();
    case 'collective':   return new CollectiveEngine();
    default:             return new LegacyEngine();
  }
}
```

### `LegacyEngine.computeUpdate` — v1 behavior preserved

```typescript
const nextCompleted = Math.min(alreadyCompleted + 1, totalActivities);
const nextRate = Math.min(100, Math.round((nextCompleted / Math.max(1, totalActivities)) * 100));
const isCompleted = nextRate >= 100;
```

Identical logic to the inline block currently in `workoutService.createWorkout`. Not yet called from that service — integration is Phase 11C.

### v2 engines — stub pattern

```typescript
computeUpdate(...): EngineResult {
  throw new Error('StreakEngine.computeUpdate: Engine not wired yet. ...');
}
static computeStreakUpdate(...): EngineResult { /* full pure implementation */ }
```

The `computeUpdate` method on `StreakEngine`, `CompetitiveEngine`, and `CollectiveEngine` throws until Phase 11C wires them. The `static compute*Update` helpers contain the full pure logic and are ready for unit testing.

### New guard tests (Section 25, 9 assertions)

- 25A: All 6 engine files exist and are non-empty
- 25B: `selectEngine` routes `engineVersion !== 'v2'` to LegacyEngine
- 25C: `selectEngine` routes `'streak'` to StreakEngine
- 25D: `selectEngine` routes `'competitive'` to CompetitiveEngine
- 25E: `selectEngine` routes `'collective'` to CollectiveEngine
- 25F: v2 `computeUpdate` methods throw `"not wired yet"`
- 25G: `workoutService` and `wellnessLogService` do NOT import `selectEngine`
- 25H: `LegacyEngine` declares `implements ChallengeEngine`
- 25I: `types.ts` defines all 6 required interfaces/types

---

## 3. Commands Executed

```
npx tsc -b --pretty false      → 0 errors (exit 0)
npm run build                  → ✓ built in 4.67s
npm run test:scoring-guards    → scoring guards passed
npm run test:home-challenge-feeds → all guards passed
```

---

## 4. Dependencies Added

None. The engine framework uses only TypeScript and existing project patterns. No new npm packages.

---

## 5. Config Changes

None. No changes to `tsconfig.json`, `vite.config.ts`, `package.json`, `firestore.indexes.json`, or any config file.

---

## 6. Risks

**None introduced.** This is a framework-only addition:

- No logging service imports `challengeEngine/` — guard 25G verifies this.
- No Firestore reads or writes.
- No behavior changes for any existing code path.
- The `throw "not wired yet"` guards in v2 engines ensure accidental integration is immediately visible (error thrown at call site, not silent data corruption).
- `LegacyEngine` duplicates the completion logic from `workoutService` as a pure function — there is no drift risk at this stage because it is not yet called. Drift risk begins at Phase 11C (integration), not here.

---

## 7. Rollback Instructions

```bash
rm -rf src/services/challengeEngine/
git checkout HEAD -- scripts/testScoringGuards.ts
```

No other files to revert. The change-log update is documentation-only.

---

## 8. Confirmation — No Behavior Changed

- `workoutService.createWorkout` — unmodified, calls no engine
- `wellnessLogService.writeLog` — unmodified, calls no engine
- All UI screens — unmodified
- All Firestore rules — unmodified
- All challenge creation flows — unmodified
- Scoring formula (`computeActivityScore`) — unmodified
- All existing guard tests (Sections 1–24) — continue to pass with zero changes

The new Section 25 guards are additive assertions on the framework files. They cannot fail for pre-existing code because they only assert on files that did not exist before this phase.

---

## 9. Architecture Notes for Phase 11C

The integration task for Phase 11C is surgical:

**In `workoutService.createWorkout`**, replace the inline completion block:
```typescript
// TODO Phase 11C: replace this block
const nextCompleted = Math.min(alreadyCompleted + 1, totalActivities);
const nextRate = ...;
if (nextRate >= 100) { membershipUpdate.status = 'completed'; ... }
```
with:
```typescript
const engine = selectEngine(challengeData);
const result = engine.computeUpdate(context, membershipSnapshot, logEvent);
// apply result.membershipUpdate to batch
// if result.challengeUpdate: batch.update(challengeRef, { groupCurrentTotal: FieldValue.increment(delta) })
// if result.isCompleted + CollectiveEngine: trigger cascade
```

The same pattern applies in `wellnessLogService.writeLog`.

`LegacyEngine.computeUpdate` produces the exact same output as the current inline block, so Phase 11C for v1 challenges is a zero-behavior-change refactor. The v2 engines only activate when `engineVersion === 'v2'` is set by the new creation wizard (Phase 11E).
