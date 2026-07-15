# Phase 10C-P5V — Wellness Logging Permission Root-Cause Diagnostic Audit

**Date:** 2026-06-19  
**Branch:** fix/p0-pre-deploy-blockers  
**Status:** Diagnostic Complete — exact failing write unresolved through static analysis; instrumentation fix recommended

---

## Executive Summary

After P5U was deployed and confirmed live, "Missing or insufficient permissions" on wellness activity save persists.
Static analysis of every Firestore read/write, every rule, and all production data for the test user shows
**no detectable rule violation**. The exact failing operation cannot be isolated without runtime error context.

The primary finding: **`wellnessLogService` and `activityLogSessionService` both lack per-getDoc and batch-commit
error logging that is always on in production.** The debug flags (`window.__wellnessLogDebug` and
`window.__activitySessionDebug`) are the only diagnostic hooks, and they require deliberate console activation.
Because the batch commit failure is not logged with any write-level context in production, the error is invisible.

The recommended fix is a targeted instrumentation change to both services so the next failed attempt
automatically prints which write failed, the exact code, and the full payload keys to the browser console.

---

## 1. Code Paths Confirmed

Two distinct code paths can log a wellness activity. Both are in production.

### Path A — `LogWellnessActivityScreen` → `wellnessLogService.writeLog`

Route: `ChallengeDetailScreen` → `SelectChallengeActivityScreen.handleLog` → `/app/workouts/log-wellness` → `LogWellnessActivityScreen.handleSave` → `useLogWellnessActivity` → `wellnessLogService.logHydration/logSleep/logFasting/logMeditation` → `writeLog`.

Debug flag: `window.__wellnessLogDebug = true`

### Path B — `SelectChallengeActivityScreen.handleSaveAll` → `activityLogSessionService`

Route: User taps "Save Activities" in `SelectChallengeActivityScreen` without navigating to the individual log screen.

Debug flag: `window.__activitySessionDebug = true`

**Gap identified:** The user confirmed enabling `window.__wellnessLogDebug`. If the actual save went through Path B, the debug flag had no effect — explaining "no useful console output."

---

## 2. All Firestore Reads Executed (Path A — `wellnessLogService`)

| # | Operation | Path | Rule | Allows? |
|---|-----------|------|------|---------|
| 1 | `getDoc` (client) | `challenges/{challengeId}` | `allow get: if canReadChallenge(resource.data)` | ✅ challenge is active + public visibility |
| 2 | `getDoc` (client) | `groupMembers/{groupId}_{userId}` | `allow read: if isAuthenticated()` | ✅ |
| 3 | `getDoc` (client) | `challengeMembers/{challengeId}_{userId}` | `allow get: resource.data == null \|\| resource.data.userId == request.auth.uid \|\| ...` | ✅ doc exists, userId matches |

If ANY of (1)–(3) fails, the error is raised BEFORE debug mode runs. Debug mode prints nothing.

---

## 3. All Firestore Reads Executed (Path B — `activityLogSessionService`)

| # | Operation | Path | Rule | Allows? |
|---|-----------|------|------|---------|
| 1 | `getDoc` (client) | `challenges/{challengeId}` | `allow get: if canReadChallenge(resource.data)` | ✅ |
| 2 | `getDoc` (client) | `groupMembers/{groupId}_{userId}` | `allow read: if isAuthenticated()` | ✅ |
| 3 | `getDoc` (client) | `challengeMembers/{challengeId}_{userId}` | `allow get: resource.data == null \|\| ...` | ✅ |

---

## 4. All Firestore Writes in the Batch (Path A — `wellnessLogService`)

### Write 1: `wellnessLogs/{autoId}` (create, no merge)

**Rule:** `allow create: if isValidWellnessCreate()`

Payload keys written:
```
userId, challengeId, groupId, activityId, logType, value, unit, points,
rawValue, targetValue, metTarget, scoringMethod, capped, scoringVersion,
date, createdAt, loggedAt, metadata
```

Checks traced:

| Check | Value | Passes? |
|-------|-------|---------|
| `keys().hasOnly(wellnessClientCreateFields())` | All keys in allowlist | ✅ |
| `!keys().hasAny(activityServerOnlyFields())` | None of those present | ✅ |
| `userId == request.auth.uid` | Same user | ✅ |
| `isValidActivityContext(data)` | See §5 below | ✅ (static analysis) |
| `logType in ['fasting','hydration','sleep','meditation']` | 'hydration' | ✅ |
| `value > 0 && value <= 10000` | 2000 | ✅ |
| `points >= 0` (v2) AND `points <= 1000` | Computed from scoring | ✅ |
| `metadata is map` | `{ intakeMl: 2000 }` | ✅ |
| `scoringVersion == 'v2'` | 'v2' | ✅ |

### Write 2: `challengeMembers/{challengeId}_{userId}` (set+merge)

**Rule:** `allow update: if isAuthenticated() && resource.data.userId == request.auth.uid && isSafeChallengeProgressUpdate()`

Payload written:
```js
{
  activitiesCompleted: 1,           // min(0+1, 1)
  totalPoints: increment(points),
  lastActivityAt: serverTimestamp(),
  completionRate: 100,
  status: 'completed',              // since completionRate >= 100
  completedAt: serverTimestamp(),
}
```

Checks traced (with production data: `activitiesCompleted: 0`, `totalActivities: 0`, `totalPoints: 0`):

| Check | Value | Passes? |
|-------|-------|---------|
| `resource.data.userId == request.auth.uid` | Match | ✅ |
| `affectedKeys().hasOnly([...])` | `activitiesCompleted, totalPoints, lastActivityAt, completionRate, status, completedAt` | ✅ |
| `activitiesCompleted >= existingActivitiesCompleted()` | `1 >= 0` | ✅ |
| `activitiesCompleted <= activityCount` (= 1) | `1 <= 1` | ✅ |
| `activitiesCompleted <= existingActivitiesCompleted() + activityCount` | `1 <= 0 + 1` | ✅ |
| `totalPoints >= existingChallengePoints()` (= 0) | ✅ | ✅ |
| `totalPoints <= 0 + (1 * 1000)` | ✅ | ✅ |
| `completionRate >= 0 && <= 100` | 100 | ✅ |
| `lastActivityAt == request.time` | serverTimestamp | ✅ |
| status → completedAt pairing | Both present | ✅ |

### Write 3: `users/{userId}` (set+merge) — **Path A only**

**Rule:** `allow update: if isSafeUserUpdate(userId)`

Payload written:
```js
{
  stats: { totalPoints: increment(points), totalWorkouts: increment(1) },
  lastWorkoutAt: serverTimestamp(),
}
```

Checks traced (with production data: `stats: { totalChallenges: 1 }`):

| Check | Value | Passes? |
|-------|-------|---------|
| `request.auth.uid == userId` | Match | ✅ |
| `affectedKeys().hasOnly(userSelfWritableFields())` | `['stats', 'lastWorkoutAt']` | ✅ |
| `!affectedKeys().hasAny(privilegedUserFields())` | Neither present | ✅ |
| `!affectedKeys().hasAny(['uid'])` | `uid` not changed | ✅ |
| `!affectedKeys().hasAny(['profile'])` | `profile` not changed | ✅ |

> **Note:** `setDoc(merge: true)` with `{ stats: {…} }` **replaces the entire `stats` map**, not just the nested
> fields. The existing `stats.totalChallenges: 1` is silently lost after the first wellness log. This is a data
> integrity defect — not a rules defect — and is tracked separately.

### Write 4: `wellnessLogs/{autoId}` (Path B, same collection) / `challengeMembers` (Path B, same update)

Path B's batch is identical to Writes 1–2 above, but **omits Write 3 (no `users` update)**. The `users` document
is never written in Path B.

---

## 5. `isValidActivityContext` — Rules-Internal Reads

`isValidWellnessCreate` → `isValidActivityContext(data)` performs 3 `get()` calls within the rules engine:

| # | Path | What it checks | Value | Passes? |
|---|------|----------------|-------|---------|
| A | `challenges/{challengeId}` | `status == 'active'`, `groupId == data.groupId` | `'active'`, `'zGO3H0GUZyKwQhbLuNyQ'` | ✅ |
| B | `groupMembers/{groupId}_{uid}` | `userId == uid`, `status in ['active','joined']`, `groupId == data.groupId` | `userId` present, `status: 'active'`, `groupId` matches | ✅ |
| C | `challengeMembers/{challengeId}_{uid}` | `isAllowedActivityMemberStatus(status)` | `'active'` | ✅ |

`isSafeChallengeProgressUpdate` performs 1 additional `get()` call:

| # | Path | What it reads | Value |
|---|------|---------------|-------|
| D | `challenges/{challengeId}` | `configuredChallengeActivityCountFrom` | `activities.size() = 1` |

**Total rules-engine `get()` calls per batch evaluation:**

| Write | get() count |
|-------|-------------|
| wellnessLogs create | 3 (A, B, C) |
| challengeMembers update | 1 (D) |
| users update | 0 |

4 calls total. Firestore budget is 10 per evaluation (or per document, depending on version). ✅

---

## 6. Production Data Verified

| Document | Confirmed | Relevant fields |
|----------|-----------|-----------------|
| `challenges/49ekaMejGaOfxwbIWpMh` | ✅ exists | `status: 'active'`, `groupId: 'zGO3H0GUZyKwQhbLuNyQ'`, `activities: [{activityId: 'water-2l-daily', activityType: 'water'}]` |
| `challengeMembers/49ekaMejGaOfxwbIWpMh_OAKeNrvRkbPOMPjwdKAjqC0tWQK2` | ✅ exists | `status: 'active'`, `activitiesCompleted: 0`, `totalActivities: 0` |
| `groupMembers/zGO3H0GUZyKwQhbLuNyQ_OAKeNrvRkbPOMPjwdKAjqC0tWQK2` | ✅ exists | `status: 'active'`, `userId` present |
| `users/OAKeNrvRkbPOMPjwdKAjqC0tWQK2` | ✅ exists | `stats: { totalChallenges: 1 }`, no `totalWorkouts` or `totalPoints` |
| `wellnessLogs` (any) | ❌ none exist | No successful wellness log has ever committed |

---

## 7. Why Previous Fixes Did Not Resolve It

### P5P
Fixed the `isValidChallengeMemberCreate` to allow the correct `activityType`. Did not address `totalActivities` mismatch or challengeMembers GET on null doc.

### P5U Fix A
Relaxed `isValidChallengeMemberCreate` to accept `totalActivities == configuredChallengeActivityCountFrom(challenge)`. This fixed the join regression so challengeMembers docs can now be created. **The test user's challengeMembers doc DOES exist** — so this fix was necessary for the join, not for the logging itself.

### P5U Fix B
Added `resource.data == null` to the challengeMembers GET rule. This allows `getDoc()` on non-existent docs. **The test user's doc exists**, so this fix does not apply to their specific case — but it prevents the confusing error for users whose join was never committed.

**Neither P5U fix altered the `wellnessLogs` create rule or the `users` update rule.** The error must be in one of those two writes, OR in a scenario that static analysis cannot resolve (auth token expiry, rule evaluation order, batch budget edge case, or a payload value computed at runtime that differs from the statically analyzed value).

---

## 8. Key Unknowns

1. **Which path is active?** If the user is on Path B (`activityLogSessionService`), enabling `window.__wellnessLogDebug` does nothing. The correct debug flag for Path B is `window.__activitySessionDebug`.

2. **Is the error before or after the batch?** If a `getDoc()` (Writes 1–3 in §2/§3) fails, debug mode never runs. If the batch commit fails, debug mode isolates which write fails — but only if enabled.

3. **Which write in the batch is rejected?** Firestore does not tell the client which document in a batch was denied.

4. **Points value at runtime.** `computeActivityScore` with `challengeType: 'streak'` returns 0 if `value < targetValue`. If a user entered `value < targetValue` (e.g., 1000 ml instead of 2000 ml), `points = 0`. With `scoringVersion: 'v2'`, the rule allows `points >= 0`. But if `scoringVersion` is somehow absent from the payload (e.g., due to a `removeUndefinedDeep` edge case), `points > 0` is required and `points = 0` would **deny**. This has not been ruled out.

---

## 9. Recommended Smallest Safe Fix

**Add always-on per-write error context to both services.** This is a pure diagnostic improvement — no rule or payload changes.

### Fix 1: Wrap individual `getDoc` calls in `wellnessLogService.writeLog`

Add per-call try-catch around each of the three `getDoc` calls (challenges, groupMembers, challengeMembers). On failure, log the collection name, document ID, and error code before re-throwing. This distinguishes "denied before batch" from "denied in batch."

### Fix 2: Add always-on batch commit error logging in `wellnessLogService.writeLog`

Remove the `if (import.meta.env.DEV || isDebugMode())` gate from the batch commit catch block. Always log:
- Which writes were planned (`wellnessLogs`, `challengeMembers`, `users`)
- The error code and message
- Key payload values (userId, challengeId, points, logType)

### Fix 3: Same always-on logging for `activityLogSessionService`

Same as Fix 2 but for the `activityLogSessionService` batch commit. The existing logging is gated behind `import.meta.env.DEV || isDebugMode()`.

### Fix 4: Note the correct debug flag in the app or docs

For Path B, the debug flag is `window.__activitySessionDebug`, not `window.__wellnessLogDebug`. Make this clear in both service files.

---

## 10. Data Integrity Issue Found (Out of Scope — Separate Track)

`wellnessLogService.writeLog` writes `stats: { totalPoints: increment(points), totalWorkouts: increment(1) }` with `setDoc(merge: true)`. Because `merge: true` merges at the TOP-LEVEL document field level only, the entire `stats` map is replaced. The existing `stats.totalChallenges: 1` will be lost after the first successful wellness log.

The fix is to use `updateDoc(userRef, { 'stats.totalPoints': increment(points), 'stats.totalWorkouts': increment(1), lastWorkoutAt: serverTimestamp() })` instead of `setDoc(merge: true)`.

This is NOT the cause of the "Missing or insufficient permissions" error, but it is a real data loss bug that should be fixed before first wellness log succeeds.

---

## 11. Commands Run

```
grep -n on firestore.rules (multiple)
Read: src/services/wellnessLogService.ts
Read: src/services/activityLogSessionService.ts
Read: src/features/Workouts/SelectChallengeActivityScreen.tsx
Read: src/services/challengeActivityFlow.ts
Firestore query: wellnessLogs (challengeId=49ekaMejGaOfxwbIWpMh)          → 0 documents
Firestore query: challenges (name='8-Hour Sleep Streak')                   → 1 document
Firestore get: challenges/49ekaMejGaOfxwbIWpMh
Firestore get: challengeMembers/49ekaMejGaOfxwbIWpMh_OAKeNrvRkbPOMPjwdKAjqC0tWQK2
Firestore get: groupMembers/zGO3H0GUZyKwQhbLuNyQ_OAKeNrvRkbPOMPjwdKAjqC0tWQK2
Firestore get: users/OAKeNrvRkbPOMPjwdKAjqC0tWQK2
Firebase: firebase_get_security_rules (confirmed P5U deployed)
```

---

## 12. Deliverables

- [x] This report: `docs/reports/member-phase-10c-p5v-wellness-permission-root-cause-audit.md`
- [ ] Update `docs/reports/member-phase-10c-change-log.md` — pending (update after fix is confirmed)
- [ ] Implement Fix 1–4 above (Phase P5W)
- [ ] Re-test with always-on logging enabled to identify the exact write
