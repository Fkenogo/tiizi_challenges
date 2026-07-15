# Phase 11D — StreakEngine v2 Activation
**Branch:** `fix/p0-pre-deploy-blockers`  
**Date:** 2026-06-25  
**Status:** Complete — all validation commands passed

---

## 1. Files Modified

### Engine framework (2)

| File | Change |
|---|---|
| `src/services/challengeEngine/streakEngine.ts` | Replaced `throw` in `computeUpdate` with delegation to `StreakEngine.computeStreakUpdate`; updated file header comment |
| `src/services/challengeEngine/index.ts` | Changed `default` case from `return new LegacyEngine()` (silent v1 fallback) to `throw new Error(...)` (loud failure for unknown v2 types); updated JSDoc comment to reflect Phase 11D status |

### Application services (2)

| File | Change |
|---|---|
| `src/services/workoutService.ts` | Spread `engineResult.membershipUpdate` into batch (carries v2 streak fields to Firestore); added `currentStreak`, `longestStreak`, `lastLogDate` to `MembershipSnapshot` construction |
| `src/services/wellnessLogService.ts` | Same pattern as workoutService |

### Types (1)

| File | Change |
|---|---|
| `src/types/index.ts` | Added optional `currentStreak?`, `longestStreak?`, `lastLogDate?`, `engineVersion?` fields to `ChallengeMember` interface |

### Test script (1)

| File | Change |
|---|---|
| `scripts/testScoringGuards.ts` | Added `StreakEngine`, `CompetitiveEngine`, `CollectiveEngine`, `selectEngine` imports; updated guard 25F (StreakEngine no longer throws, kept Competitive/Collective checks); updated guard 26.8 (removed StreakEngine); added Section 27 (10 fixture tests) |

### Files NOT modified

- `src/services/challengeEngine/legacyEngine.ts` — unchanged
- `src/services/challengeEngine/types.ts` — unchanged
- `src/services/challengeEngine/competitiveEngine.ts` — still throws (unchanged)
- `src/services/challengeEngine/collectiveEngine.ts` — still throws (unchanged)
- All UI screens — unchanged
- Firestore rules — unchanged
- Creation wizard — unchanged

---

## 2. Code Diff Summary

### streakEngine.ts — `computeUpdate`

**Removed** (throw guard):
```typescript
computeUpdate(...): EngineResult {
  throw new Error(
    'StreakEngine.computeUpdate: Engine not wired yet. ...',
  );
}
```

**Added** (delegation to pure static helper):
```typescript
computeUpdate(...): EngineResult {
  return StreakEngine.computeStreakUpdate(context, membership, logEvent);
}
```

The pure logic (`computeStreakUpdate`) was already written in Phase 11B and is unchanged.

### index.ts — default case

**Removed** (silent v1 fallback for unknown v2 types):
```typescript
default:
  return new LegacyEngine();
```

**Added** (loud failure):
```typescript
default:
  throw new Error(
    `selectEngine: unknown v2 challengeType "${challenge.challengeType}". ` +
    'Set engineVersion to v1 or use a supported type (streak, competitive, collective).',
  );
```

### workoutService.ts + wellnessLogService.ts — membershipUpdate spread

**Removed** (explicit field copy):
```typescript
const membershipUpdate: Record<string, unknown> = {
  activitiesCompleted: engineResult.membershipUpdate.activitiesCompleted,
  totalPoints: increment(scoring.pointsEarned),
  lastActivityAt: Timestamp.now(),
  completionRate: engineResult.membershipUpdate.completionRate,
};
```

**Added** (full spread, Firestore-specific overrides):
```typescript
const membershipUpdate: Record<string, unknown> = {
  ...engineResult.membershipUpdate,           // carries currentStreak, longestStreak, lastLogDate, engineVersion
  totalPoints: increment(scoring.pointsEarned),  // atomic FieldValue, not absolute number
  lastActivityAt: Timestamp.now(),               // Firestore Timestamp, not Date
};
delete membershipUpdate['status'];
delete membershipUpdate['completedAt'];
if (engineResult.isCompleted) {
  membershipUpdate.status = 'completed';
  membershipUpdate.completedAt = Timestamp.now();
}
```

The `delete` removes `status` and `completedAt` from the engine's return (which uses `Date`) before re-adding them with proper `Timestamp.now()` values.

### MembershipSnapshot — streak fields passed in

```typescript
const membershipSnapshot: MembershipSnapshot = {
  // ...existing fields...
  currentStreak: membership.currentStreak,
  longestStreak: membership.longestStreak,
  lastLogDate: membership.lastLogDate,
};
```

These fields are `undefined` on all existing v1 memberships (which don't have them) — `computeStreakUpdate` handles this via `?? 0` / `?? null` defaults.

---

## 3. Commands Executed

```
npx tsc -b --pretty false      → 0 errors (exit 0)
npm run build                  → ✓ built in 2.88s
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

## 6. Section 27 — Fixture Test Coverage

10 deterministic fixtures added to `scripts/testScoringGuards.ts`:

| Fixture | Scenario | Key assertion |
|---|---|---|
| 27.1 | First day (no prior log) | `currentStreak = 1`, `longestStreak = 1`, `lastLogDate` set, `engineVersion = 'v2'` |
| 27.2 | Consecutive day (1-day gap) | `currentStreak = 2`, `longestStreak = 2`, `lastLogDate` updated |
| 27.3 | Same-day duplicate | `currentStreak = 2` (not advanced), `activitiesCompleted` still increments |
| 27.4 | Missed day + `streakResetOnMiss=true` | `currentStreak = 1` (reset), `longestStreak = 3` (preserved) |
| 27.5 | Missed day + `streakResetOnMiss=false` | `currentStreak = 4` (continued), `longestStreak = 4` (updated) |
| 27.6 | Completion day (streak reaches 7) | `isCompleted = true`, `status = 'completed'`, `completionRate = 100` |
| 27.7a | New streak < longestStreak | `longestStreak` unchanged at 5 |
| 27.7b | New streak > longestStreak | `longestStreak` updates to 6 |
| 27.8 | v1 streak challenge | `selectEngine({ engineVersion: undefined })` → LegacyEngine, no `currentStreak` |
| 27.9 | v2 + competitive | `CompetitiveEngine.computeUpdate` throws `"Engine not wired yet"` |
| 27.10 | v2 + collective | `CollectiveEngine.computeUpdate` throws `"Engine not wired yet"` |

---

## 7. Risks

**Low.** No existing challenges have `engineVersion: 'v2'` — the creation wizard (Phase 11E) is the only path to creating v2 challenges. All v1 challenges continue to use LegacyEngine unchanged, verified by:
- Guard 25B: `engineVersion !== 'v2'` → LegacyEngine
- Guard 26.9: LegacyEngine fixtures match prior inline math exactly
- Guard 27.8: v1 streak challenge → LegacyEngine (no streak fields emitted)

**Batch write safety:**
- `totalPoints` still uses `increment(scoring.pointsEarned)` — atomic concurrent writes preserved
- `lastActivityAt` still uses `Timestamp.now()` — no raw Date passed to Firestore
- `status` and `completedAt` are explicitly removed from the spread and re-added with `Timestamp.now()` — no Date leaks into Firestore

**Backward compatibility:**
- `MembershipSnapshot` streak fields (`currentStreak`, `longestStreak`, `lastLogDate`) default to `0` / `null` when undefined — StreakEngine handles this correctly for first-ever log on a v2 streak challenge

**No fallback for unknown v2 types:**
- The `default` case now throws loudly — any v2 challenge with an unrecognized type will fail at call time, not silently use LegacyEngine

---

## 8. Routing Table (Phase 11D state)

| `engineVersion` | `challengeType` | Engine selected | Behavior |
|---|---|---|---|
| `undefined` / `'v1'` | any | LegacyEngine | activitiesCompleted++ / completionRate calc |
| `'v2'` | `'streak'` | **StreakEngine** | streak advance / reset / completion |
| `'v2'` | `'competitive'` | CompetitiveEngine | throws "Engine not wired yet" |
| `'v2'` | `'collective'` | CollectiveEngine | throws "Engine not wired yet" |
| `'v2'` | unknown | — | throws loud selectEngine error |

---

## 9. Rollback Instructions

```bash
git checkout HEAD -- \
  src/services/challengeEngine/streakEngine.ts \
  src/services/challengeEngine/index.ts \
  src/services/workoutService.ts \
  src/services/wellnessLogService.ts \
  src/types/index.ts \
  scripts/testScoringGuards.ts
```

---

## 10. Guard Test Updates

| Section | Old check | New check | Reason |
|---|---|---|---|
| 25F | `StreakEngine` must throw "not wired yet" | `StreakEngine` must NOT throw; Competitive + Collective still must throw | Phase 11D wired StreakEngine |
| 26.8 | Streak + Competitive + Collective all throw | Competitive + Collective still throw (StreakEngine removed) | Same |
| Import | `{ LegacyEngine }` | `{ LegacyEngine, StreakEngine, CompetitiveEngine, CollectiveEngine, selectEngine }` | Section 27 needs them |
| Section 27 | (new) | 10 fixture tests covering all routing and streak behaviors | Phase 11D requirement |
