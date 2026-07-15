# Phase 18G-2C — Wellness Logging Auto-Join Parity

**Date:** 2026-06-29
**Branch:** fix/p0-pre-deploy-blockers
**Bug fixed:** BUG-G3 (MEDIUM)

---

## 1. Root Cause

`wellnessLogService.writeLog` threw immediately when no `challengeMembers` doc existed:

```ts
if (!membershipSnap.exists()) {
  throw new Error('Join challenge before logging wellness activity.');
}
```

`workoutService.createWorkout` had a self-heal path:

```ts
if (!membershipSnap.exists()) {
  await challengeService.joinChallenge(input.userId, input.challengeId);
  membershipSnap = await getDoc(membershipRef);
  if (!membershipSnap.exists()) {
    throw new Error('Join challenge before logging workouts');
  }
}
```

Any race condition where a group member taps "Log Activity" on a wellness challenge before their challenge membership write has fully propagated results in a hard error for wellness and a silent recovery for fitness. Same race, different outcome.

---

## 2. Fix

### `src/services/wellnessLogService.ts`

Added `challengeService` import and replaced the hard throw with the self-heal pattern:

**Before (line 78–80):**
```ts
if (!membershipSnap.exists()) {
  throw new Error('Join challenge before logging wellness activity.');
}
```

**After:**
```ts
if (!membershipSnap.exists()) {
  // Self-heal: attempt auto-join when group member hasn't joined the challenge yet.
  // Group membership was already validated above — only active group members reach here.
  await challengeService.joinChallenge(input.userId, input.challengeId);
  membershipSnap = await getDoc(membershipRef);
  if (!membershipSnap.exists()) {
    throw new Error('Join challenge before logging wellness activity.');
  }
}
```

### Security ordering preserved

The group membership check at lines 72-76 runs **before** the self-heal:

```ts
const groupMember = groupMemberSnap.exists() ? ... : null;
if (!groupMember || groupMember.userId !== input.userId || !['active', 'joined'].includes(groupMember.status ?? '')) {
  throw new Error('Not an active group member.');
}

// ← only active group members reach here
if (!membershipSnap.exists()) {
  await challengeService.joinChallenge(...)  // self-heal
```

A non-group-member can never trigger the auto-join path. `joinChallenge` itself also validates group membership independently, providing a second layer.

---

## 3. What `joinChallenge` does on self-heal

`challengeService.joinChallenge(userId, challengeId)`:
1. Reads the challenge doc to get `groupId`
2. Reads the user's `groupMembers` doc — throws if not an active member
3. Creates the `challengeMembers` doc with `status: 'active'`, streak reset if needed
4. Updates user stats `totalChallenges: increment(1)`
5. `participantCount` is NOT written client-side (Phase 18G-2B)

After `joinChallenge` returns, the re-fetch gives a fresh membership snapshot and logging proceeds.

---

## 4. Unchanged

- Scoring engines (`selectEngine`, `collectiveEngine`, `competitiveEngine`, `streakEngine`) — untouched
- `atomicCollectiveGroupUpdate` for collective challenges — untouched
- Group membership validation logic — preserved and runs before self-heal
- Firestore rules — no changes
- `workoutService` — untouched

---

## 5. Files Changed

| File | Change |
|---|---|
| `src/services/wellnessLogService.ts` | Added `challengeService` import; replaced hard throw with self-heal + re-fetch |
| `scripts/testScoringGuards.ts` | Added 8 guards (section 18G-2C) |

---

## 6. Regression Guards Added

| ID | What it guards |
|---|---|
| 18G-2C-1 | `wellnessLogService` imports `challengeService` |
| 18G-2C-2 | `wellnessLogService` calls `joinChallenge` on missing membership |
| 18G-2C-3 | `wellnessLogService` re-fetches `membershipSnap` after self-heal |
| 18G-2C-4 | Group membership check occurs before self-heal (ordering guard) |
| 18G-2C-5 | `workoutService` self-heal behavior unchanged |
| 18G-2C-6 | `wellnessLogService` still routes through `selectEngine` / `computeUpdate` |
| 18G-2C-7 | `wellnessLogService` still calls `atomicCollectiveGroupUpdate` for collective |
| 18G-2C-8 | `wellnessLogService` does not write `participantCount` |

---

## 7. Validation

```
npx tsc --noEmit          → ✅ No errors
npm run build             → ✅ Built in 4.02s
npm run test:scoring-guards → ✅ All guards passed (incl. new 18G-2C-1…18G-2C-8)
npm run test:home-challenge-feeds → ✅ All guards passed
```

No Firestore rules changes — deployment of rules not required for this phase.

---

## 8. Manual Test Checklist

| Scenario | Expected |
|---|---|
| Active group member logs wellness activity with existing challenge membership | ✅ Logs normally — no change |
| Active group member logs wellness activity with no challenge membership (race condition) | ✅ Auto-joins silently, log succeeds |
| Non-group-member attempts wellness log | ❌ "Not an active group member." — blocked before self-heal |
| Auto-join fails (e.g. challenge not found) | ❌ `joinChallenge` throws; error propagates; hard error surfaced to user |
| Active group member logs fitness activity with no challenge membership | ✅ Same self-heal — unchanged from before |
