# Phase 13C — Atomic Collective Completion

**Date:** 2026-06-26  
**Branch:** fix/p0-pre-deploy-blockers  
**Scope:** BUG-001 only — collective completion race condition  
**Code changes:** 4 files modified, 2 files created  
**Schema changes:** None  
**Firestore rules changes:** None

---

## Summary

Fixed a critical race condition in collective challenge completion (BUG-001 from Phase 13A QA). Two users logging simultaneously could both miss the group target threshold, leaving a completed challenge permanently stuck in `active`.

---

## Root Cause

### The Bug

The collective logging flow in `workoutService` and `wellnessLogService` read `groupCurrentTotal` from Firestore before any write, then used `FieldValue.increment(delta)` in a batch to atomically bump the total. However, the **completion decision** was made against the pre-read stale snapshot — not the post-increment value.

```
User A reads groupCurrentTotal = 970   (target = 1000)
User B reads groupCurrentTotal = 970   (target = 1000)

User A: 970 + 20 = 990 < 1000 → engine says isCompleted = false
User B: 970 + 20 = 990 < 1000 → engine says isCompleted = false

User A's batch commits: Firestore writes 970 → 990
User B's batch commits: Firestore writes 990 → 1010 (clamped by FieldValue, but no completion was flagged)

Actual Firestore total = 1010 ≥ 1000
Challenge status      = 'active'  ← stuck forever
```

`FieldValue.increment()` is atomic at the field level, but the read-then-decide pattern is not — concurrent reads both see the pre-write state.

### Why Batches Cannot Fix This

Firestore batches are atomic for their own writes but cannot "read and decide" — there is no retry-on-conflict mechanism. Only `runTransaction` provides the serialized read-then-write guarantee.

---

## Fix

### New File: `src/utils/collectiveGroupTransition.ts`

Pure, side-effect-free function extracted for deterministic testing:

```typescript
export function computeGroupTransition(
  input: GroupTransitionInput,
  delta: number,
): GroupTransitionResult {
  if (input.status === 'completed') {
    return { isAlreadyCompleted: true, clampedTotal: input.groupCurrentTotal, shouldComplete: false };
  }
  const newTotal = input.groupCurrentTotal + delta;
  const target = Number(input.groupCumulativeTarget ?? 0);
  const clampedTotal = target > 0 ? Math.min(newTotal, target) : newTotal;
  const autoComplete = input.autoCompleteOnGroupTarget ?? true;
  const shouldComplete = autoComplete && target > 0 && newTotal >= target;
  return { isAlreadyCompleted: false, clampedTotal, shouldComplete };
}
```

No Firebase imports — can be tested directly in `tsx` scripts without Firestore initialization.

### New File: `src/services/collectiveGroupUpdate.ts`

```typescript
export async function atomicCollectiveGroupUpdate(
  challengeId: string,
  delta: number,
  triggeringMemberRef: DocumentReference,
): Promise<{ wasAlreadyCompleted: boolean; nowCompleted: boolean }> {
  const challengeRef = doc(db, 'challenges', challengeId);
  let result: GroupTransitionResult = { ... };

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(challengeRef);
    result = computeGroupTransition(snap.data() as GroupTransitionInput, delta);
    if (result.isAlreadyCompleted) return;  // exit without writes

    tx.update(challengeRef, {
      groupCurrentTotal: result.clampedTotal,
      ...(result.shouldComplete ? { status: 'completed', completedAt: Timestamp.now() } : {}),
    });
  });

  const triggered = result.shouldComplete && !result.isAlreadyCompleted;
  if (triggered) {
    await updateDoc(triggeringMemberRef, { status: 'completed', completedAt: Timestamp.now() });
    await cascadeCollectiveCompletion(challengeId, triggeringMemberRef);
  }
  return { wasAlreadyCompleted: result.isAlreadyCompleted, nowCompleted: triggered };
}
```

### Changed: `workoutService.ts` and `wellnessLogService.ts`

**Before (racing):**
```typescript
// In batch — challenge doc update based on stale snapshot
batch.set(challengeRef, { groupCurrentTotal: increment(delta) }, { merge: true });
if (engineResult.isCompleted) { ... mark challenge completed in batch ... }

await batch.commit();
if (engineResult.isCompleted && engineResult.challengeUpdate) {
  await cascadeCollectiveCompletion(...);
}
```

**After (atomic):**
```typescript
// Batch no longer touches challenge doc for collective challenges
const isCollective = !!engineResult.challengeUpdate;
if (engineResult.isCompleted && !isCollective) {
  membershipUpdate.status = 'completed';  // only for non-collective engines
}
batch.set(membershipRef, membershipUpdate, { merge: true });
await batch.commit();

if (isCollective) {
  await atomicCollectiveGroupUpdate(challengeId, delta, membershipRef);
  // Internally: runTransaction → completion gate → cascadeCollectiveCompletion
}
```

---

## Concurrency Model

```
Transaction A (first to commit):
  reads  groupCurrentTotal = 970
  writes groupCurrentTotal = 990  (970 + 20, < 1000 → no completion)

Transaction B (retries after A commits):
  reads  groupCurrentTotal = 990  ← live value, not stale
  writes groupCurrentTotal = 1000 (990 + 20 = 1010, clamped → completion fires)

Transaction C (arrives after B):
  reads  status = 'completed'
  exits  without writes  ← idempotent
```

Only B triggers the cascade. A and C are silent. No double-completion. No stuck challenge.

---

## Clamping

`groupCurrentTotal` is now clamped to `groupCumulativeTarget`:

```
clampedTotal = min(currentTotal + delta, target)
```

This prevents the stored total from ever exceeding the configured target (e.g., storing 1010 when target is 1000). The total faithfully reflects participation effort up to the goal ceiling.

---

## Regression Guards (13C-1 through 13C-6)

| Guard | What it tests |
|---|---|
| 13C-1 | `collectiveGroupUpdate.ts` uses `runTransaction`; exports `atomicCollectiveGroupUpdate` and re-exports `computeGroupTransition` |
| 13C-2 | `computeGroupTransition`: clamping logic; under-target, at-target, overshoot, autoComplete=false |
| 13C-3 | Already-completed: `isAlreadyCompleted=true`, `shouldComplete=false`, `clampedTotal` unchanged |
| 13C-4 | Exactly-once: first cross sets `shouldComplete=true`; second call with `status='completed'` does not |
| 13C-5 | Concurrent fixture: A reads 970+20=990 (no complete); B retries to 990+20=1010 (completes, clamped to 1000); C reads completed (exit) |
| 13C-6 | Both services call `atomicCollectiveGroupUpdate`; neither calls `cascadeCollectiveCompletion` directly; both gate on `isCollective` flag |

---

## Validation Results

```
npx tsc -b --pretty false          → 0 errors ✅
npm run build                      → ✓ built in 2.87s ✅
npm run test:scoring-guards        → scoring guards passed ✅
npm run test:home-challenge-feeds  → all guards passed ✅
```

---

## Remaining BUGs from Phase 13A

BUG-001, BUG-002, BUG-003, BUG-004, BUG-013 are now resolved.

| Bug | Status |
|---|---|
| BUG-001 | ✅ Fixed — Phase 13C |
| BUG-002 | ✅ Fixed — Phase 13B-1 |
| BUG-003 | ✅ Fixed — Phase 13B-2 |
| BUG-004 | ✅ Fixed — Phase 13B-2 |
| BUG-005–BUG-012 | Unaddressed (lower severity) |
| BUG-013 | ✅ Fixed — Phase 13B-1 |

---

## What Was NOT Changed

- `CollectiveEngine.computeUpdate` — still returns `isCompleted` based on snapshot estimate; that field is now ignored for collective challenges (completion is transaction-driven)
- `cascadeCollectiveCompletion` — unchanged; still does chunked fan-out to active members
- Firestore rules — no changes
- Firestore indexes — no changes
- All non-collective engines (Legacy, Competitive, Streak) — completion path unchanged
