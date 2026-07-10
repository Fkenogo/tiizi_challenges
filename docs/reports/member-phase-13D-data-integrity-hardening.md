# Phase 13D — Data Integrity Hardening

**Date:** 2026-06-26  
**Branch:** fix/p0-pre-deploy-blockers  
**Scope:** BUG-005, BUG-006, BUG-007, BUG-008 (Medium-severity findings from Phase 13A QA)  
**Code changes:** 4 files modified  
**Schema changes:** None  
**Firestore rules changes:** None

---

## What Was NOT Changed

- Legacy engine — unchanged
- Streak engine — unchanged
- Competitive engine — unchanged
- Collective engine — unchanged
- Collective completion transaction — unchanged
- Leaderboard ordering — unchanged
- Scoring formulas — unchanged
- Completion logic — unchanged
- Firestore schema — unchanged
- Firestore rules — unchanged

---

## BUG-005 — participantCount Never Maintained

### Root Cause

`joinChallenge()` wrote the membership document and the user stats document in a batch but never touched the challenge document's `participantCount`. A one-time `setDoc({ participantCount: 1 })` in `createChallenge()` set the count for the creator, but every subsequent join was invisible to the counter. `leaveChallenge()` did not decrement at all.

### Fix

`joinChallenge()` — added `participantCount: increment(1)` to the existing batch:

```typescript
// BUG-005: keep participantCount in sync — increment atomically on every (re)join.
batch.set(challengeRef, { participantCount: increment(1) }, { merge: true });
```

`leaveChallenge()` — converted from a single `setDoc` to a `writeBatch` that atomically marks membership abandoned and decrements the counter:

```typescript
batch.set(challengeRef, { participantCount: increment(-1) }, { merge: true });
```

The decrement is safe because `leaveChallenge` already guards with `if (membership.status !== 'active') return` — only confirmed active members (who were counted on join) can trigger it, so the value stays ≥ 0.

`createChallenge()` — removed the now-redundant manual `setDoc({ participantCount: 1 })` that immediately followed `this.joinChallenge(...)`. `joinChallenge` handles the increment.

---

## BUG-006 — User Statistics Inflate After Join/Leave Cycles

### Root Cause

`joinChallenge()` called `increment(1)` on `stats.totalChallenges` for every successful join — including rejoin of a previously abandoned membership. `leaveChallenge()` never decremented. The result: each leave→rejoin cycle increased the count by 1.

Example (pre-fix):
```
join  → totalChallenges = 1
leave → totalChallenges = 1  (no decrement)
rejoin→ totalChallenges = 2  (inflated)
```

### Fix

`leaveChallenge()` decrements `stats.totalChallenges` in the same batch as the membership and participantCount writes:

```typescript
// BUG-006: reverse the join-time increment so repeated join/leave cycles
// do not inflate totalChallenges beyond the number of active memberships.
batch.set(userRef, { stats: { totalChallenges: increment(-1) } }, { merge: true });
```

Post-fix sequence:
```
join  → totalChallenges = 1
leave → totalChallenges = 0  ✓
rejoin→ totalChallenges = 1  ✓
```

Multiple joins without leave are blocked by the existing early-return guard (`if (existing.status === 'active') return`) — no double-counting risk.

---

## BUG-007 — Mixed Units in Collective Challenges

### Root Cause

`createChallenge()` applied no validation on the unit consistency of activities in collective challenges. A collective challenge with activities measured in `minutes`, `km`, and `reps` would pool all values into a single `groupCurrentTotal` — a dimensionally meaningless number.

### Fix

Added validation at the top of `createChallenge()`, before any Firestore writes:

```typescript
if (
  input.challengeType === 'collective' &&
  input.activities &&
  input.activities.length > 1
) {
  const units = new Set(
    input.activities.map((a) => (a.unit ?? '').toLowerCase().trim()),
  );
  if (units.size > 1) {
    throw new Error(
      `Collective challenges must use a single measurement unit. Found mixed units: ${[...units].join(', ')}`,
    );
  }
}
```

- Single-activity collective challenges are unaffected (no mixed-unit issue possible).
- Competitive and streak challenges are unaffected (they don't pool values).
- Existing challenges in Firestore are read-only and unaffected — no migration required.
- Also added `targetType?: 'daily' | 'cumulative'` to the `CreateChallengeInput.activities` type (needed for BUG-008, shares the same block).

---

## BUG-008 — deriveDailyTargetValue Uses Only Heuristics

### Root Cause

`deriveDailyTargetValue(targetValue, durationDays, challengeType)` used a divide-and-clamp heuristic for streak challenges: divide by `durationDays`; if the result ≥ 1, treat the original as cumulative; if < 1, treat as per-session.

The heuristic is ambiguous for mid-range values. For example, `targetValue=15, durationDays=7` divides to 2.14 (≥ 1 → treated as cumulative). But if 15 was already a per-session target, the user would be scored against 2.14 instead of 15. The heuristic has no way to distinguish the two cases without explicit metadata.

### Fix

Added an optional `targetType?: 'daily' | 'cumulative'` parameter. When present, it takes priority over the heuristic. When absent, the existing heuristic runs unchanged — all existing templates continue to behave exactly as before.

```typescript
export function deriveDailyTargetValue(
  targetValue: number,
  durationDays: number | null | undefined,
  challengeType: string,
  targetType?: 'daily' | 'cumulative',   // NEW — explicit metadata
): number {
  if (challengeType !== 'streak') return targetValue;

  // Explicit metadata path — no ambiguity.
  if (targetType === 'daily') return targetValue;
  if (targetType === 'cumulative') {
    const days = Math.max(1, Number(durationDays) || 1);
    return days <= 1 ? targetValue : targetValue / days;
  }

  // Heuristic fallback — unchanged behaviour for existing templates.
  const days = Math.max(1, Number(durationDays) || 1);
  if (days <= 1) return targetValue;
  const derived = targetValue / days;
  return derived >= 1 ? derived : targetValue;
}
```

**Call sites updated** — `workoutService.ts` and `wellnessLogService.ts` now pass `activityConfig?.targetType` as the fourth argument. When the stored activity has no `targetType` field (all existing templates), the argument is `undefined` and the heuristic runs as before.

**Type updated** — the activities inline type in both services and `CreateChallengeInput` now includes `targetType?: 'daily' | 'cumulative'`. New challenges can carry this metadata; old ones are unaffected.

---

## Regression Guards (13D-1 through 13D-11)

| Guard | What it tests |
|---|---|
| 13D-1 | `joinChallenge` contains `participantCount: increment(1)` |
| 13D-2 | `leaveChallenge` contains `participantCount: increment(-1)` |
| 13D-3 | Decrement is gated on `status === 'active'` check (prevents negative counts) |
| 13D-4 | `leaveChallenge` contains `totalChallenges: increment(-1)` (enables join→leave→join = 1) |
| 13D-5 | `joinChallenge` early-returns for already-active members (no duplicate increments) |
| 13D-6 | `createChallenge` throws for mixed-unit collective challenges |
| 13D-7 | Unit guard uses `> 1` (single-unit collective is allowed) |
| 13D-8 | Unit validation is gated on `challengeType === 'collective'` (streak/competitive unaffected) |
| 13D-9 | `targetType='daily'` returns targetValue unchanged |
| 13D-10 | `targetType='cumulative'` divides by durationDays correctly |
| 13D-11 | Heuristic fallback unchanged: divides when result ≥ 1, keeps original when < 1; non-streak always unchanged |

---

## Validation Results

```
npx tsc -b --pretty false          → 0 errors ✅
npm run build                      → ✓ built in 3.17s ✅
npm run test:scoring-guards        → scoring guards passed (13D-1 through 13D-11) ✅
npm run test:home-challenge-feeds  → all guards passed ✅
```

---

## Files Changed

| File | Bugs |
|---|---|
| `src/services/challengeService.ts` | BUG-005, BUG-006, BUG-007 |
| `src/services/challengeCompletion.ts` | BUG-008 |
| `src/services/workoutService.ts` | BUG-008 (call site) |
| `src/services/wellnessLogService.ts` | BUG-008 (call site) |
| `scripts/testScoringGuards.ts` | Guards 13D-1 through 13D-11 |
