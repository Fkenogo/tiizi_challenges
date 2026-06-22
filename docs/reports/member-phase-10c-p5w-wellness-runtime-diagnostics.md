# Phase 10C-P5W — Wellness Logging Runtime Diagnostics + Safe Stats Update

**Date:** 2026-06-20  
**Branch:** fix/p0-pre-deploy-blockers  
**Status:** Complete — all validation green, build clean

---

## Issue

Wellness logging ("Missing or insufficient permissions") persists after P5U rules fix. P5V static audit found no
rule violation. Root cause cannot be isolated without per-operation runtime error context.

Two secondary issues identified in P5V:
1. Both `wellnessLogService` and `activityLogSessionService` gate batch-commit error logging behind
   `import.meta.env.DEV || isDebugMode()` — production failures produce no diagnostic output.
2. `wellnessLogService.writeLog` uses `setDoc(userRef, { stats: { … } }, { merge: true })`, which replaces the
   entire `stats` map and silently drops `stats.totalChallenges`.

---

## Changes Applied

### Fix 1 — Per-`getDoc` error logging in `wellnessLogService`

**File:** `src/services/wellnessLogService.ts`

Each of the three pre-batch `getDoc` calls is now wrapped in a try/catch that always logs before rethrowing:

```
[wellnessLogService] getDoc failed  { op: 'challenges read', path, code, message }
[wellnessLogService] getDoc failed  { op: 'groupMembers read', path, code, message }
[wellnessLogService] getDoc failed  { op: 'challengeMembers read', path, code, message }
```

If the permission error is at a `getDoc` call (before the batch), this will identify it immediately.

### Fix 2 — Always-on batch commit logging in `wellnessLogService`

**File:** `src/services/wellnessLogService.ts`

Added try/catch around `batch.commit()` that always fires (no DEV gate):

```
[wellnessLogService] batch commit failed  {
  code, message,
  plannedWrites: ['wellnessLogs create', 'challengeMembers update', 'users update'],
  challengeId, groupId, activityId, logType, value, unit, points,
  scoringVersion, targetValue, completionRate, membershipStatus
}
```

No private notes, no user profile data logged.

### Fix 3 — Per-`getDoc` error logging in `activityLogSessionService`

**File:** `src/services/activityLogSessionService.ts`

Same pattern as Fix 1 for all three `getDoc` calls:

```
[activityLogSessionService] getDoc failed  { op: 'challenges read', path, code, message }
[activityLogSessionService] getDoc failed  { op: 'groupMembers read', path, code, message }
[activityLogSessionService] getDoc failed  { op: 'challengeMembers read', path, code, message }
```

### Fix 4 — Always-on batch commit logging in `activityLogSessionService`

**File:** `src/services/activityLogSessionService.ts`

Removed `if (import.meta.env.DEV || isDebugMode())` gate. Batch commit failures now always log:

```
[activityLogSessionService] batch commit failed  {
  code, message,
  plannedWrites,
  challengeId, groupId, entryCount,
  entryDiagnostics: [{ source, activityId, activityType, value, unit, targetValue }],
  ruleRiskChecks
}
```

No private notes logged.

### Fix 5 — Safe `stats` field update (data integrity fix)

**File:** `src/services/wellnessLogService.ts`

**Before:**
```ts
const userUpdate = {
  stats: {
    totalPoints: increment(points),
    totalWorkouts: increment(1),
  },
  lastWorkoutAt: serverTimestamp(),
};
// ...
batch.set(userRef, userUpdate, { merge: true });
```
`setDoc` with `merge: true` merges at the top-level document field level only. The entire `stats` map is
replaced, silently dropping `stats.totalChallenges`.

**After:**
```ts
const userStatsUpdate = {
  'stats.totalPoints': increment(points),
  'stats.totalWorkouts': increment(1),
  lastWorkoutAt: serverTimestamp(),
};
// ...
batch.update(userRef, userStatsUpdate);
```
`batch.update` with dotted field paths updates only the named nested fields, preserving all other `stats.*`
entries including `totalChallenges`.

---

## How to Use the New Diagnostics

Next time wellness logging fails, open the browser console. You will see one of:

**Case A — permission denied at a `getDoc` call (before batch):**
```
[wellnessLogService] getDoc failed  { op: 'challengeMembers read', code: 'permission-denied', ... }
```
→ Fix: the `allow get` rule for that collection is denying the read.

**Case B — permission denied at batch commit:**
```
[wellnessLogService] batch commit failed  { code: 'permission-denied', plannedWrites: [...], logType: 'hydration', ... }
```
→ Fix: enable `window.__wellnessLogDebug = true` to run each write individually and identify which one fails.

**Case C — Path B (activityLogSessionService):**
Look for `[activityLogSessionService] batch commit failed` or `[activityLogSessionService] getDoc failed`.
Note: Path B's debug flag is `window.__activitySessionDebug = true`, NOT `window.__wellnessLogDebug`.

---

## Guard Tests Added

**File:** `scripts/testScoringGuards.ts` — Section 20 (P5W, 9 assertions)

| # | Assertion |
|---|-----------|
| 1 | `wellnessLogService` has `[wellnessLogService] batch commit failed` (always-on) |
| 2 | `activityLogSessionService` has `[activityLogSessionService] batch commit failed` (always-on) |
| 3 | `activityLogSessionService` batch commit logging is NOT gated behind `import.meta.env.DEV` |
| 4 | `wellnessLogService` has `[wellnessLogService] getDoc failed` |
| 5 | `activityLogSessionService` has `[activityLogSessionService] getDoc failed` |
| 6 | `wellnessLogService` uses `batch.update(userRef)` for stats update |
| 7 | `wellnessLogService` does NOT use `batch.set(userRef, …stats:` |
| 8 | `wellnessLogService` uses dotted field `'stats.totalPoints'` |
| 9 | `wellnessLogService` uses dotted field `'stats.totalWorkouts'` |

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
✅ npm run build                            ✓ built in 3.54s
```

---

## Deploy Required?

**No new Firestore rules changes.** This is a client-side code change only (`wellnessLogService.ts` and
`activityLogSessionService.ts`). A frontend deploy is needed to activate the new logging in production.

The `batch.update` change (Fix 5) is a client-code change — no Firestore rules impact.

---

## Risk Assessment

| Fix | Risk | Rationale |
|-----|------|-----------|
| Per-getDoc try/catch | Very low | Catches and re-throws; no behavior change on success path |
| Always-on batch commit log | Very low | Adds console.error on failure only; no data logged on success |
| `batch.set` → `batch.update` | Low | `updateDoc` / `batch.update` requires the document to exist — user document is always created at sign-up. Safer than setDoc+merge for nested map fields. |

---

## What Was NOT Changed

- `firestore.rules` — no rule changes
- Scoring logic — untouched
- `challengeService`, `workoutService`, any other service — untouched
- UI components — untouched
