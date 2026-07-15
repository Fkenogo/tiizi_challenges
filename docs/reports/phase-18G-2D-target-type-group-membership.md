# Phase 18G-2D — Target Type + Group Membership Consistency

**Date:** 2026-06-29
**Branch:** fix/p0-pre-deploy-blockers

---

## 1. Problems Fixed

### Problem A — Hardcoded `targetType: 'daily'`

Both `workoutService` and `wellnessLogService` built `ChallengeContext` with:

```ts
targetType: 'daily',
```

This ignored the per-activity `targetType` field stored in `challenge.activities[]`. For cumulative challenges (e.g. a 30-day step challenge where `targetType: 'cumulative'`), the engine received `'daily'` and scored accordingly — causing `deriveDailyTargetValue` to divide the target by `durationDays` even for challenges that should accumulate without division.

### Problem B — workoutService missing group membership check

`wellnessLogService.writeLog` validated that the caller is an active group member before writing:

```ts
if (!groupMember || groupMember.userId !== input.userId || !['active', 'joined'].includes(groupMember.status ?? '')) {
  throw new Error('Not an active group member.');
}
```

`workoutService.createWorkout` had no equivalent check — any authenticated user who guessed a `challengeId` + `groupId` could write workout logs into a group challenge, because `joinChallenge` would auto-create their `challengeMembers` doc.

---

## 2. Fixes

### `src/services/workoutService.ts`

**Change 1 — Group membership validation (new):**

Added a parallel read of `groupMembers/${groupId}_${userId}` alongside the challenge membership read, then validated the result before allowing the log to proceed:

```ts
const [initialMembershipSnap, groupMemberSnap] = await Promise.all([
  getDoc(membershipRef),
  groupMemberId ? getDoc(doc(db, 'groupMembers', groupMemberId)) : Promise.resolve(null),
]);

if (groupMemberId && groupMemberSnap) {
  const groupMember = groupMemberSnap.exists()
    ? (groupMemberSnap.data() as { userId?: string; status?: string })
    : null;
  if (
    !groupMember ||
    groupMember.userId !== input.userId ||
    !['active', 'joined'].includes(groupMember.status ?? '')
  ) {
    throw new Error('Not an active group member.');
  }
}
```

The check is scoped to group challenges only (`groupId` present). Non-group workout logging is unchanged. The parallel read adds no extra latency.

**Change 2 — `targetType` derivation:**

```ts
// Before:
targetType: 'daily',

// After:
targetType: activityConfig?.targetType ?? 'daily',
```

`activityConfig` is already derived from `challengeData.activities` four lines earlier, so no new reads required.

### `src/services/wellnessLogService.ts`

**Change — `targetType` derivation (same as workout):**

```ts
// Before:
targetType: 'daily',

// After:
targetType: activityConfig?.targetType ?? 'daily',
```

`activityConfig` is already derived from `challengeData.activities` in the lines preceding `ChallengeContext` construction.

---

## 3. What Was Not Changed

- Scoring engines — untouched
- `deriveDailyTargetValue` logic — untouched (now receives correct `targetType`)
- Firestore rules — no changes
- `participantCount` — not touched
- `atomicCollectiveGroupUpdate` path — intact in both services
- `engineResult.membershipUpdate` spread — intact in both services (streak fields preserved)
- `wellnessLogService` group membership validation — unchanged, still present

---

## 4. Files Changed

| File | Change |
|---|---|
| `src/services/workoutService.ts` | Added group membership validation; derived `targetType` from `activityConfig` |
| `src/services/wellnessLogService.ts` | Derived `targetType` from `activityConfig` |
| `scripts/testScoringGuards.ts` | Added 7 regression guards (section 18G-2D) |

---

## 5. Regression Guards Added

| ID | What it guards |
|---|---|
| 18G-2D-1 | `workoutService` does not hardcode `targetType: 'daily'` |
| 18G-2D-2 | `wellnessLogService` does not hardcode `targetType: 'daily'` |
| 18G-2D-3 | Both services derive `targetType` from `activityConfig?.targetType` |
| 18G-2D-4 | `workoutService` validates active group membership when `groupId` is present |
| 18G-2D-5 | `wellnessLogService` retains active group membership validation |
| 18G-2D-6 | Both services still use `atomicCollectiveGroupUpdate` for collective challenges |
| 18G-2D-7 | Both services still spread `engineResult.membershipUpdate` (streak fields) |

---

## 6. Validation

```
npx tsc --noEmit              → ✅ No errors
npm run build                 → ✅ Built in 4.62s
npm run test:scoring-guards   → ✅ All guards passed (incl. new 18G-2D-1…18G-2D-7)
npm run test:home-challenge-feeds → ✅ All guards passed
```
