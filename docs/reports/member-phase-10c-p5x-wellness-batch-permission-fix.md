# Phase 10C-P5X — Wellness Batch Permission Fix

**Date:** 2026-06-20  
**Branch:** fix/p0-pre-deploy-blockers  
**Status:** Complete — all validation green, build clean

---

## Production Error

```
[wellnessLogService] batch commit failed
{
  code: "permission-denied",
  message: "Missing or insufficient permissions.",
  plannedWrites: ["wellnessLogs create", "challengeMembers update", "users update"],
  challengeId: "pyOO8M1SIBDBV3HCiiuP",
  groupId: "zGO3H0GUZyKwQhbLuNyQ",
  activityId: "social-interaction-daily",
  logType: "meditation",
  value: 1,
  unit: "interactions",
  points: 100,
  targetValue: 1,
  completionRate: 100,
  scoringVersion: "v2",
  membershipStatus: "active"
}
```

---

## Isolation: Which Write Failed

Three writes in the batch: `wellnessLogs create`, `challengeMembers update`, `users update`.

**`wellnessLogs create`** — traced against `isValidWellnessCreate` / `isValidActivityContext`:
- `logType: 'meditation'` in allowlist ✅
- `value: 1 > 0 && <= 10000` ✅
- `points: 100, scoringVersion: 'v2'` → `points >= 0 && <= 1000` ✅
- `activityId: 'social-interaction-daily'` is non-empty string ✅
- All payload keys in `wellnessClientCreateFields()` ✅
- `isValidActivityContext`: client-side getDoc calls all succeeded (no `getDoc failed` logs),
  challenge status active, groupMember status active, challengeMember status active ✅

**`challengeMembers update`** — traced against `isSafeChallengeProgressUpdate`:
- `affectedKeys().hasOnly(['activitiesCompleted','totalPoints','lastActivityAt','completionRate','status','completedAt'])` ✅
- `activitiesCompleted: 1 <= activityCount (1)` ✅
- `totalPoints: increment(100) → 100 <= 1000` ✅
- `completionRate: 100, status: 'completed', completedAt: serverTimestamp()` — valid
  completion pairing ✅

**`users update`** — **ROOT CAUSE**. See below.

---

## Root Cause

P5W replaced `batch.set(userRef, { stats: {...} }, { merge: true })` with
`batch.update(userRef, { 'stats.totalPoints': increment(100), 'stats.totalWorkouts': increment(1), lastWorkoutAt })`.

**Firestore security rule behavior difference:**

| Operation | `diff().affectedKeys()` in rules | Passes `userSelfWritableFields()`? |
|-----------|-----------------------------------|------------------------------------|
| `batch.set(ref, { stats: {...} }, { merge: true })` | `{'stats', 'lastWorkoutAt'}` | ✅ `'stats'` is in the list |
| `batch.update(ref, { 'stats.totalPoints': ... })` | `{'stats.totalPoints', 'stats.totalWorkouts', 'lastWorkoutAt'}` | ❌ dotted paths NOT in the list |

`isSafeUserUpdate` (firestore.rules line 156) checks:
```
request.resource.data.diff(resource.data).affectedKeys().hasOnly(userSelfWritableFields())
```

`userSelfWritableFields()` contains `'stats'` (the top-level map key) but not `'stats.totalPoints'` or
`'stats.totalWorkouts'`. When `batch.update` uses dotted field paths, Firestore rules surfaces the
literal path strings in `affectedKeys()` rather than the computed top-level diff key. The
`hasOnly(...)` check returns `false` → `isSafeUserUpdate` returns `false` → `users update` is denied
→ the entire batch is rejected with `permission-denied`.

**Debug mode was also broken:** `runWellnessDebugWrites` called `setDoc(ref, { 'stats.totalPoints': ... }, { merge: true })`. With `setDoc`, dotted keys are treated as *literal field names* (not field paths), testing a completely different operation than the batch. The debug step would always fail even if the batch would have succeeded on that write.

---

## Fix Applied

**File:** `src/services/wellnessLogService.ts`

Reverted `batch.update(userRef, dotted paths)` → `batch.set(userRef, ..., { merge: true })` with a
nested `stats` map. Also removed `updateDoc` from imports (unused after revert). Fixed the debug mode
payload to match.

**Before (P5W — broken):**
```ts
const userStatsUpdate = {
  'stats.totalPoints': increment(points),
  'stats.totalWorkouts': increment(1),
  lastWorkoutAt: serverTimestamp(),
};
// ...
batch.update(userRef, userStatsUpdate);
```

**After (P5X — fixed):**
```ts
const userStatsUpdate = {
  stats: {
    totalPoints: increment(points),
    totalWorkouts: increment(1),
  },
  lastWorkoutAt: serverTimestamp(),
};
// ...
batch.set(userRef, userStatsUpdate, { merge: true });
```

With `batch.set(merge: true)` and a top-level `stats` key:
- `diff().affectedKeys()` = `{'stats', 'lastWorkoutAt'}`
- Both keys are in `userSelfWritableFields()` → `isSafeUserUpdate` passes → batch commits ✅

**Known tradeoff:** `setDoc(merge: true)` replaces the entire `stats` map. If the user document has
`stats.totalChallenges`, this write will overwrite it with only `{ totalPoints, totalWorkouts }`.
This pre-existing data integrity issue (noted in P5V) is separate from this P0 fix and is tracked
as a follow-up.

---

## Guard Tests Updated

**File:** `scripts/testScoringGuards.ts` — Section 20, assertions 6–9 (P5W Fix 5 guards reversed)

| # | Assertion | Change |
|---|-----------|--------|
| 6 | `wellnessLogService` uses `batch.set(userRef` | `match` (was: `batch.update`) |
| 7 | `wellnessLogService` does NOT use `batch.update(userRef` | `doesNotMatch` (was: `doesNotMatch batch.set`) |
| 8 | `userStatsUpdate` definition contains `stats:` map | `match` (was: `match 'stats.totalPoints'`) |
| 9 | `wellnessLogService` does NOT contain `'stats.totalPoints'` | `doesNotMatch` (was: `match`) |

---

## Files Changed

| File | Change |
|------|--------|
| `src/services/wellnessLogService.ts` | Revert users update to `batch.set(merge:true)` with nested stats; remove `updateDoc` import; fix debug label |
| `scripts/testScoringGuards.ts` | Update Section 20 Fix 5 assertions to match reverted approach |

No Firestore rules changes — client-only fix.

---

## Validation Results

```
✅ npm run test:scoring-guards              scoring guards passed
✅ npm run test:home-challenge-feeds        home challenge feed guards passed
✅ npm run test:home-performance-guards     home performance guards passed
✅ npm run test:pilot-ux-polish-guards      pilot UX polish guards passed
✅ npm run test:challenge-creation-backend  challenge creation backend tests passed
✅ npm run test:group-invite-backend        Group invite backend security tests passed
✅ npx tsc -b --pretty false               (no output — clean)
✅ npm run build                            ✓ built in 3.35s
✅ firebase deploy --only firestore:rules --dry-run  rules compiled successfully (no rules changes)
```

---

## Deploy Required

**Frontend deploy only.** No Firestore rules changes.

---

## Risk Assessment

| Change | Risk | Rationale |
|--------|------|-----------|
| `batch.set` ← `batch.update` | Very low | Reverts to approach confirmed to pass `isSafeUserUpdate`; same pattern used in `joinChallenge` |
| Remove `updateDoc` import | Zero | Unused after revert |
| Debug mode payload fix | Zero | Debug mode only runs when `window.__wellnessLogDebug = true` |
