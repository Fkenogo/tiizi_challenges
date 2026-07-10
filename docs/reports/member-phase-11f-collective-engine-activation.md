# Phase 11F — CollectiveEngine v2 Activation
**Branch:** `fix/p0-pre-deploy-blockers`  
**Date:** 2026-06-25  
**Status:** Complete — all validation commands passed

---

## 1. Files Modified

### Engine framework (2)

| File | Change |
|---|---|
| `src/services/challengeEngine/collectiveEngine.ts` | Replaced `throw` in `computeUpdate` with delegation to `computeCollectiveUpdate`; updated header comment to reflect Phase 11F wiring |
| `src/services/challengeEngine/index.ts` | Updated JSDoc comment to reflect Phase 11F active status; updated decision table entry |

### Application services (2)

| File | Change |
|---|---|
| `src/services/workoutService.ts` | Added `groupCumulativeTarget`, `autoCompleteOnGroupTarget`, `groupCurrentTotal` to `challengeData` type cast; hoisted `challengeRef`; added fields to `context`; passed `challengeSnapshot` to `engine.computeUpdate`; added collective batch writes (`challengeRef` delta + cascade on completion) |
| `src/services/wellnessLogService.ts` | Same pattern as workoutService; also added missing imports: `getDocs, query, where` |

### Test script (1)

| File | Change |
|---|---|
| `scripts/testScoringGuards.ts` | Updated guard 25F (all three engines now active); updated guard 26.8 (collective no longer throws); updated guard 27.10 (collective active, not throwing); updated guard 28.8 (collective active, not throwing); added Section 29 (9 fixture tests) |

### Files NOT modified

- `src/services/challengeEngine/streakEngine.ts` — unchanged
- `src/services/challengeEngine/competitiveEngine.ts` — unchanged
- `src/services/challengeEngine/legacyEngine.ts` — unchanged
- `src/services/challengeEngine/types.ts` — unchanged
- `src/types/index.ts` — unchanged
- All UI screens — unchanged
- Firestore rules — unchanged
- Creation wizard — unchanged
- Challenge templates — unchanged
- Leaderboard UI — unchanged

---

## 2. Code Diff Summary

### collectiveEngine.ts — `computeUpdate`

**Removed** (throw guard):
```typescript
throw new Error(
  'CollectiveEngine.computeUpdate: Engine not wired yet. ...',
);
```

**Added** (delegation):
```typescript
computeUpdate(context, membership, logEvent, challengeSnapshot?): EngineResult {
  return CollectiveEngine.computeCollectiveUpdate(context, membership, logEvent, challengeSnapshot ?? {});
}
```

The pure `computeCollectiveUpdate` static helper was already implemented and correct — only the public `computeUpdate` method needed updating.

### Services — challengeRef + challengeSnapshot

Both services now capture `challengeRef` before the read phase:
```typescript
const challengeRef = doc(db, 'challenges', input.challengeId);
```

And pass `challengeSnapshot` as the 4th argument to `engine.computeUpdate`:
```typescript
const challengeSnapshot = { groupCurrentTotal: challengeData.groupCurrentTotal };
const engineResult = engine.computeUpdate(context, membershipSnapshot, logEvent, challengeSnapshot);
```

Non-collective engines (Legacy, Streak, Competitive) accept but ignore `challengeSnapshot` — backward-safe.

### Services — collective batch writes

After the membership batch.set, both services now apply:

1. **Group total delta** (always for collective; via `FieldValue.increment()` for atomicity):
```typescript
if (engineResult.challengeUpdate) {
  const challengeDocUpdate: Record<string, unknown> = {
    groupCurrentTotal: increment(engineResult.challengeUpdate.groupCurrentTotalDelta),
  };
  if (engineResult.isCompleted) {
    challengeDocUpdate.status = 'completed';
    challengeDocUpdate.completedAt = Timestamp.now();
  }
  batch.set(challengeRef, challengeDocUpdate, { merge: true });
}
```

2. **Cascade completion** (only when `isCompleted && challengeUpdate`):
```typescript
if (engineResult.isCompleted && engineResult.challengeUpdate) {
  const activeMembersSnap = await getDocs(
    query(
      collection(db, 'challengeMembers'),
      where('challengeId', '==', input.challengeId),
      where('status', '==', 'active'),
    ),
  );
  for (const memberDoc of activeMembersSnap.docs) {
    if (memberDoc.ref.path !== membershipRef.path) {
      batch.set(memberDoc.ref, { status: 'completed', completedAt: Timestamp.now() }, { merge: true });
    }
  }
}
```

The triggering member is excluded from the cascade loop (`ref.path !== membershipRef.path`) because their update is already in the batch via `membershipUpdate`.

---

## 3. Commands Executed

```
npx tsc -b --pretty false      → 0 errors (exit 0)
npm run build                  → ✓ built in 3.46s
npm run test:scoring-guards    → scoring guards passed
npm run test:home-challenge-feeds → all guards passed
```

---

## 4. Risks

**Low.** No existing challenges have `engineVersion: 'v2'` — the creation wizard (Phase 11G, not yet implemented) is the only path to create v2 collective challenges. All v1 challenges continue routing to LegacyEngine unchanged.

**Race condition on cascade:** `isCompleted` is estimated from the pre-batch `groupCurrentTotal` snapshot. In the concurrent case (two members log simultaneously both bringing the total past the target), both may see `isCompleted = true` and both trigger cascades. The cascade writes are idempotent (`status: 'completed'`) — the second cascade overwrites the first with identical values. Acceptable per spec.

**Batch size:** The cascade query returns all active members. Firestore batches support up to 500 document writes. Groups larger than ~498 members could exceed this limit. For Phase 11F scope (small groups), this is acceptable.

**`groupCurrentTotal` starts undefined:** On first log, `challengeData.groupCurrentTotal` is `undefined`. The engine defaults `prevGroupTotal = challengeSnapshot.groupCurrentTotal ?? 0`, so `estimatedNewTotal = 0 + logEvent.value`. Correct behavior.

**`FieldValue.increment()` atomicity:** The group total is always written as `increment(delta)`, never as an absolute value. This prevents the read-calculate-write race condition the spec forbids.

---

## 5. Rollback Instructions

```bash
git checkout HEAD -- \
  src/services/challengeEngine/collectiveEngine.ts \
  src/services/challengeEngine/index.ts \
  src/services/workoutService.ts \
  src/services/wellnessLogService.ts \
  scripts/testScoringGuards.ts
```

---

## 6. Behavior Matrix

| Engine | Status | Trigger |
|---|---|---|
| LegacyEngine | Active | `engineVersion !== 'v2'` (all existing challenges) |
| StreakEngine | Active | `v2 + streak` (Phase 11D) |
| CompetitiveEngine | Active | `v2 + competitive` (Phase 11E) |
| **CollectiveEngine** | **Active** | **`v2 + collective` (Phase 11F)** |

All four engines are now wired. The challenge engine framework is complete.

---

## 7. Section 29 Fixture Evidence

9 deterministic fixtures added to `scripts/testScoringGuards.ts`:

| Fixture | Scenario | Key assertions |
|---|---|---|
| 29.1 | Single member contribution | `groupCurrentTotalDelta=500`, `isCompleted=false`, `engineVersion='v2'` |
| 29.2 | Cumulative group state (prevTotal=15000) | `delta=500` (log value, not affected by prior total), `isCompleted=false` |
| 29.3 | Multi-activity (squats) | Full log value (800) goes to shared pool, `isCompleted=false` |
| 29.4 | Exact completion (19500+500=20000) | `isCompleted=true`, `status='completed'`, `delta=500` |
| 29.5 | Over-target (19500+1000=20500) | `isCompleted=true`, `delta=1000` (full, uncapped) |
| 29.6 | Atomic increment payload | `challengeUpdate !== undefined`, `delta=750`, no `cumulativeLoggedValue` in membership |
| 29.7 | Legacy routing (v1 collective) | LegacyEngine selected, `challengeUpdate === undefined` |
| 29.8 | Streak routing (v2+streak) | StreakEngine selected, `challengeUpdate === undefined`, `currentStreak=1` |
| 29.9 | Competitive routing (v2+competitive) | CompetitiveEngine selected, `challengeUpdate === undefined`, `cumulativeLoggedValue` present |

All 9 fixtures pass.

---

## 8. Guard Updates

| Guard | Before Phase 11F | After Phase 11F |
|---|---|---|
| 25F | Collective must throw; Streak+Competitive must not | All three engines must NOT throw |
| 26.8 | Collective must throw | Collective must NOT throw |
| 27.10 | `assert.throws` — collective throws | Active check — returns `engineVersion='v2'` + `challengeUpdate` |
| 28.8 | `assert.throws` — collective throws | Active check — returns `engineVersion='v2'` + `challengeUpdate` |

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

Only engine framework, service layer, and test script were modified.
