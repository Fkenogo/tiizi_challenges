# Phase 11E — CompetitiveEngine v2 Activation
**Branch:** `fix/p0-pre-deploy-blockers`  
**Date:** 2026-06-25  
**Status:** Complete — all validation commands passed

---

## 1. Files Modified

### Engine framework (3)

| File | Change |
|---|---|
| `src/services/challengeEngine/competitiveEngine.ts` | Replaced `throw` in `computeUpdate` with delegation to `computeCompetitiveUpdate`; rewrote pure helper with full multi-activity per-activity cumulative tracking |
| `src/services/challengeEngine/types.ts` | Added `cumulativeValues?: Record<string, number>` to `MembershipSnapshot` and to `EngineResult.membershipUpdate` |
| `src/services/challengeEngine/index.ts` | Updated JSDoc comment to reflect Phase 11E active status |

### Application services (2)

| File | Change |
|---|---|
| `src/services/workoutService.ts` | Added `cumulativeLoggedValue` and `cumulativeValues` to `MembershipSnapshot` construction |
| `src/services/wellnessLogService.ts` | Same pattern as workoutService |

### Types (1)

| File | Change |
|---|---|
| `src/types/index.ts` | Added `cumulativeLoggedValue?` and `cumulativeValues?` to `ChallengeMember` interface |

### Test script (1)

| File | Change |
|---|---|
| `scripts/testScoringGuards.ts` | Updated guard 25F (CompetitiveEngine now active); updated guard 26.8 (only CollectiveEngine check remains); updated guard 27.9 (competitive no longer throws — verifies active behavior); added Section 28 (8 fixture tests) |

### Files NOT modified

- `src/services/challengeEngine/streakEngine.ts` — unchanged
- `src/services/challengeEngine/collectiveEngine.ts` — unchanged (still throws)
- `src/services/challengeEngine/legacyEngine.ts` — unchanged
- All UI screens — unchanged
- Firestore rules — unchanged
- Creation wizard — unchanged
- Challenge templates — unchanged
- Leaderboard UI — unchanged

---

## 2. Code Diff Summary

### competitiveEngine.ts — `computeUpdate`

**Removed** (throw guard):
```typescript
throw new Error('CompetitiveEngine.computeUpdate: Engine not wired yet. ...');
```

**Added** (delegation):
```typescript
computeUpdate(...): EngineResult {
  return CompetitiveEngine.computeCompetitiveUpdate(context, membership, logEvent);
}
```

### competitiveEngine.ts — `computeCompetitiveUpdate` (complete rewrite)

**Old implementation** (single-activity only, used `activities[0]`):
```typescript
const cumulativeTarget = context.activities[0]?.targetValue ?? 0;
const prevCumulative = membership.cumulativeLoggedValue ?? 0;
const newCumulative = prevCumulative + logEvent.value;
// single completionRate, single isCompleted
```

**New implementation** (multi-activity, per-activity tracking):
```typescript
// Per-activity cumulative map — keyed by logEvent.activityId
const newCumulativeValues = { ...prevCumulativeValues, [logEvent.activityId]: prevForActivity + logEvent.value };

// Filter activities with a target, compute per-activity rates capped at 100%
const trackedActivities = context.activities.filter((a) => a.targetValue > 0);
const activityRates = trackedActivities.map((act) => {
  const cumVal = newCumulativeValues[act.activityId ?? ''] ?? newCumulativeValues[act.exerciseId ?? ''] ?? 0;
  return Math.min(100, Math.round((cumVal / act.targetValue) * 100));
});

// Completion requires ALL activities at 100%
const overallRate = Math.round(sum(activityRates) / numActivities);
const isCompleted = numActivities > 0 && activityRates.every((r) => r >= 100);
```

**Fields written:**
- `cumulativeValues` — per-activity map (new v2 field)
- `cumulativeLoggedValue` — total across all activities (analytics / backward compat)
- `completionRate` — average per-activity rate, capped at 100 on completion
- `activitiesCompleted` — still incremented for analytics (does NOT drive completion)
- `engineVersion: 'v2'`
- `status: 'completed'` / `completedAt` only when `isCompleted`

### Services — snapshot additions

```typescript
const membershipSnapshot: MembershipSnapshot = {
  // ...existing fields...
  cumulativeLoggedValue: membership.cumulativeLoggedValue,  // added Phase 11E
  cumulativeValues: membership.cumulativeValues,             // added Phase 11E
};
```

These are `undefined` on all v1 memberships — CompetitiveEngine handles this via `?? 0` / `?? {}` defaults.

---

## 3. Commands Executed

```
npx tsc -b --pretty false      → 0 errors (exit 0)
npm run build                  → ✓ built in 2.74s
npm run test:scoring-guards    → scoring guards passed
npm run test:home-challenge-feeds → all guards passed
```

---

## 4. Risks

**Low.** No existing challenges have `engineVersion: 'v2'` — the creation wizard (Phase 11E, not yet implemented) is the only path. All v1 challenges continue routing to LegacyEngine unchanged.

**Batch write safety:**
- `totalPoints` still uses `increment(scoring.pointsEarned)` (atomic FieldValue from service layer)
- `lastActivityAt` still uses `Timestamp.now()` (Firestore Timestamp from service layer)
- `cumulativeValues` is a plain Firestore map — Firestore handles nested objects natively
- `status`/`completedAt` come from the service's `if (isCompleted)` block, not the engine return

**`activitiesCompleted` semantics change for competitive v2:** In LegacyEngine, `activitiesCompleted` drives completion. In CompetitiveEngine v2, it's incremented for analytics but `cumulativeValues` drives completion. This is correct per spec — guard 28.1 verifies `activitiesCompleted` still increments.

**Multi-activity ID resolution:** The engine tries `act.activityId` then falls back to `act.exerciseId` for the per-activity lookup. Activities logged with `logEvent.activityId = exerciseId` (workout service pattern) are correctly matched.

**Activities with `targetValue = 0`:** Filtered out of completion calculations. A challenge with all zero-target activities cannot complete (`isCompleted = false`). This is safe — such a challenge would be misconfigured.

---

## 5. Rollback Instructions

```bash
git checkout HEAD -- \
  src/services/challengeEngine/competitiveEngine.ts \
  src/services/challengeEngine/types.ts \
  src/services/challengeEngine/index.ts \
  src/services/workoutService.ts \
  src/services/wellnessLogService.ts \
  src/types/index.ts \
  scripts/testScoringGuards.ts
```

---

## 6. Behavior Matrix

| Engine | Status | Trigger |
|---|---|---|
| LegacyEngine | Active | `engineVersion !== 'v2'` (all existing challenges) |
| StreakEngine | Active | `v2 + streak` (Phase 11D) |
| **CompetitiveEngine** | **Active** | **`v2 + competitive` (Phase 11E)** |
| CollectiveEngine | Disabled | `v2 + collective` — still throws "Engine not wired yet" |

---

## 7. Section 28 Fixture Evidence

8 deterministic fixtures added to `scripts/testScoringGuards.ts`:

| Fixture | Scenario | Key assertions |
|---|---|---|
| 28.1 | Single activity, first log (100 of 1000) | `cumulativeLoggedValue=100`, `cumulativeValues={pushups:100}`, `completionRate=10`, `isCompleted=false`, `engineVersion='v2'` |
| 28.2 | Multi-activity (2 activities), log one | After pushups 500/1000=50%, bearhold 0/500=0% → `completionRate=25`, `isCompleted=false` |
| 28.3 | Partial: one done, one halfway | pushups 100%, bearhold 50% → `completionRate=75`, `isCompleted=false` |
| 28.4 | Completion on final activity | Both reach 100% → `isCompleted=true`, `status='completed'`, `completionRate=100`, `completedAt instanceof Date` |
| 28.5 | Over-target capped at 100% | 1400 logged against target 1000 → rate=100, `isCompleted=true`, `cumulativeLoggedValue=1400` (uncapped total) |
| 28.6 | Legacy routing (v1 competitive) | `selectEngine({ engineVersion: undefined })` → LegacyEngine, no `cumulativeValues`, no `cumulativeLoggedValue` |
| 28.7 | Streak routing (v2+streak → StreakEngine) | `selectEngine({ v2, streak })` → StreakEngine, `currentStreak=1`, no `cumulativeLoggedValue` |
| 28.8 | Collective still throws | `selectEngine({ v2, collective })` → CollectiveEngine throws "Engine not wired yet" |

All 8 fixtures pass.

---

## 8. Change-Log Entry

See update to `docs/reports/member-phase-10c-change-log.md` below.

---

## 9. Confirmation — No UI or Template Code Modified

The following files were NOT touched:

- `src/features/Challenges/ChallengeDetailScreen.tsx` ✓
- `src/features/Challenges/CreateChallengeWizard.tsx` ✓
- `src/features/Admin/Challenges/CreateChallengeScreen.tsx` ✓
- `src/features/Challenges/ChallengeLeaderboardScreen.tsx` ✓
- `src/features/Groups/GroupLeaderboardScreen.tsx` ✓
- `firestore.rules` ✓
- `firestore.indexes.json` ✓
- Any challenge template files ✓

Only engine framework, service layer, types, and test script were modified.
