# Phase 18G-1 — Join, Leave, and Log Activity Audit for v2 Challenges

**Date:** 2026-06-28
**Branch:** fix/p0-pre-deploy-blockers
**Type:** Read-only audit — NO code changed

---

## 1. Scope

Full audit of the post-creation user flow:

1. Join challenge (new member and rejoin)
2. Leave challenge
3. Log fitness workout
4. Log wellness activity
5. Membership doc updates (streak reset, participantCount)
6. Collective group total update
7. Leaderboard / completion cascade

---

## 2. Files Inspected

| File | Purpose |
|---|---|
| `src/services/challengeService.ts` | `joinChallenge`, `leaveChallenge` |
| `src/services/workoutService.ts` | Fitness log path, engine dispatch, self-heal |
| `src/services/wellnessLogService.ts` | Wellness log path, group membership check |
| `src/services/collectiveGroupUpdate.ts` | `atomicCollectiveGroupUpdate` transaction |
| `src/services/scoringConfig.ts` | `computeActivityScore`, scoring method |
| `src/services/challengeEngine/streakEngine.ts` | v2 streak scoring |
| `src/services/challengeEngine/competitiveEngine.ts` | v2 competitive scoring |
| `src/services/challengeEngine/collectiveEngine.ts` | v2 collective scoring |
| `src/services/challengeCompletion.ts` | `deriveDailyTargetValue` |
| `functions/src/memberCounters.ts` | `updateParticipantCountForCreate/Update/Delete` |
| `functions/src/index.ts` | `onChallengeMemberCreated/Updated/Deleted` triggers |
| `firestore.rules` | All challenge-related rules |

---

## 3. Confirmed Bugs

### BUG-G6 — SEVERITY: CRITICAL — Collective challenge logging blocked by Firestore rule

**File:** `firestore.rules:171-178`

```
allow update, delete: if isAuthenticated() && (
  (
    resource.data.createdBy == request.auth.uid
    && !(resource.data.donation.enabled == true && request.resource.data.status == 'active')
    && !(request.resource.data.moderationStatus == 'approved')  // ← THE BUG
  )
  || canModerateChallenges()
);
```

**Root cause:** The condition `!(request.resource.data.moderationStatus == 'approved')` evaluates against the *merged* document after write. For an active challenge (which always has `moderationStatus: 'approved'`), any update that doesn't change `moderationStatus` still carries `moderationStatus: 'approved'` in `request.resource.data`. This makes the entire creator branch evaluate to `false`.

**Impact:**
- ALL client-side updates to active challenge documents are blocked — including `groupCurrentTotal` increments from `atomicCollectiveGroupUpdate`
- Even the challenge creator cannot update the document once it is approved
- Only `canModerateChallenges()` (admin role) can update an approved challenge
- `atomicCollectiveGroupUpdate` runs via the client Firestore SDK (`src/services/collectiveGroupUpdate.ts`), goes through rules, and is DENIED for every non-admin user
- **Collective challenges are completely non-functional for log processing in production**

**Likely intent:** Prevent non-moderators from un-approving a challenge by writing `moderationStatus: 'pending'`. The correct guard would check whether `moderationStatus` is being changed:
```
// Allow updates that do not change moderationStatus, OR allow if no approval has been set
&& (request.resource.data.moderationStatus == resource.data.moderationStatus
    || resource.data.moderationStatus != 'approved')
```

Or scope `groupCurrentTotal` writes to a specific member `allow update`:
```
allow update: if isAuthenticated()
              && resource.data.status == 'active'
              && isGroupMember(resource.data.groupId)
              && request.resource.data.diff(resource.data).affectedKeys()
                   .hasOnly(['groupCurrentTotal', 'status', 'completedAt']);
```

---

### BUG-G1 — SEVERITY: HIGH — participantCount double-write on join

**Files:** `src/services/challengeService.ts:246`, `functions/src/memberCounters.ts:106-110`

**Root cause:** Two independent paths both increment `participantCount` on every join:

1. **Client batch** (`challengeService.joinChallenge:246`):
   ```ts
   batch.set(challengeRef, { participantCount: increment(1) }, { merge: true });
   ```
2. **Cloud Function trigger** (`onChallengeMemberCreated → updateParticipantCountForCreate`):
   ```ts
   challengeRef.update({ participantCount: FieldValue.increment(delta) });
   ```

Both fire for every new `challengeMembers` document (and for status-change updates). Result: +2 per join. This is acknowledged in the code as "ARCH-1" (comment on `challengeService.ts`), but both paths remain active.

**Impact:** `participantCount` grows at 2× the true member count. Display is wrong; any quota or cap logic based on `participantCount` would fire at half the actual cap.

---

### BUG-G3 — SEVERITY: MEDIUM — wellnessLogService lacks auto-join self-heal

**Files:** `src/services/workoutService.ts:100-107`, `src/services/wellnessLogService.ts:78-79`

**workoutService self-heal:**
```ts
if (!membershipSnap.exists()) {
  await joinChallenge(input.challengeId, input.userId, input.groupId);
  // retry getDoc ...
}
```

**wellnessLogService (no self-heal):**
```ts
if (!membershipSnap.exists()) {
  throw new Error('Join challenge before logging wellness activity.');
}
```

**Impact:** Any race condition where a user's join hasn't propagated before their first wellness log results in a hard error. The same race for fitness logging recovers automatically.

---

### BUG-G2 — SEVERITY: MEDIUM — ChallengeContext.targetType hardcoded to 'daily'

**Files:** `src/services/workoutService.ts:163`, `src/services/wellnessLogService.ts:153`

Both services build `ChallengeContext` with `targetType: 'daily'` regardless of the challenge's actual target type. The per-activity `activityTargetType` is also not populated in the activities array within the context.

**Current impact:** None of the three v2 engines (`StreakEngine`, `CompetitiveEngine`, `CollectiveEngine`) read `context.targetType` — they rely on per-activity configuration passed directly to `deriveDailyTargetValue`. So no functional bug today, but this is misleading dead data.

**Future impact:** Any engine refactor that reads `context.targetType` will silently see `'daily'` for all challenges.

---

### BUG-G4 — SEVERITY: LOW — leaveChallenge allows leaving after logging

**File:** `src/services/challengeService.ts:266-294`

`leaveChallenge` checks `existing.status !== 'active'` (returns if already abandoned) but does NOT check whether the member has logged any activities. The UI protects via `progress?.myLogs === 0` before showing the Leave button, but the service is not guarded.

**Impact:** A user who bypasses the UI (or where `progress` is stale) can abandon a challenge they've already contributed to. Their logs remain, but their `participantCount` decrement is applied, causing under-count.

---

### BUG-G5 — SEVERITY: LOW — Firestore v1 wellnessLog create rule blocks 0-point logs

**File:** `firestore.rules:244-249`

```
allow create: if isAuthenticated()
              && request.resource.data.userId == request.auth.uid
              && (request.resource.data.scoringVersion == 'v2'
                  ? request.resource.data.points >= 0
                  : request.resource.data.points >= 1);
```

The v1 branch (`scoringVersion != 'v2'`) requires `points >= 1`. A v1 log with 0 points (e.g., logged below the 5% effort threshold) would be blocked. All new logs use `scoringVersion: 'v2'`, so this only affects legacy data or direct writes.

---

### ARCH-1 — DESIGN — Inconsistent group membership check between logging services

**Files:** `src/services/workoutService.ts`, `src/services/wellnessLogService.ts:72-76`

`wellnessLogService` explicitly validates group membership status before logging:
```ts
if (!groupMember || groupMember.userId !== input.userId || !['active', 'joined'].includes(groupMember.status ?? '')) {
  throw new Error('Not an active group member.');
}
```

`workoutService` does NOT check group membership — it only checks challenge membership, and auto-joins the challenge if needed.

**Impact:** A user who has been removed from a group but still has a `challengeMembers` doc can log fitness workouts but not wellness activities. Inconsistent enforcement.

---

## 4. Flow Analysis

### Join Challenge (`challengeService.joinChallenge`)

| Scenario | Result |
|---|---|
| New member, public group | ✅ Creates challengeMembers doc; streak reset applied; double-writes participantCount (BUG-G1) |
| New member, private group (active in groupMembers) | ✅ Same as above |
| New member, not a group member | ✅ Throws "Must be a group member"; correct |
| Existing member, status 'active' | ✅ Returns early, no write |
| Existing member, status 'abandoned' (rejoin) | ✅ Updates status; double-writes participantCount (BUG-G1) |
| Creator joins again | ✅ Returns early (already active from creation) |

### Leave Challenge (`challengeService.leaveChallenge`)

| Scenario | Result |
|---|---|
| Active member, no logs | ✅ Sets 'abandoned', decrements participantCount |
| Active member, has logs | ⚠️ Service allows it (BUG-G4); UI blocks it |
| Already abandoned | ✅ Returns early |

### Log Fitness Workout (`workoutService.createWorkout`)

| Scenario | Result |
|---|---|
| Active member, streak challenge | ✅ Engine computes streak update; championshipMembership updated |
| Active member, competitive challenge | ✅ Engine computes cumulative progress per activity |
| Active member, collective challenge | ❌ BUG-G6: `atomicCollectiveGroupUpdate` blocked by Firestore rules |
| No challenge membership | ✅ Auto-joins (self-heal), then logs |
| Not a group member (no challengeMembers) | ✅ Auto-join fails with "Must be a group member" |

### Log Wellness Activity (`wellnessLogService.writeLog`)

| Scenario | Result |
|---|---|
| Active member, any challenge type | ❌ BUG-G6 also applies to collective (same `atomicCollectiveGroupUpdate` call) |
| No challenge membership | ❌ Throws immediately (BUG-G3 — no self-heal) |
| Not an active group member | ✅ Throws "Not an active group member" |

---

## 5. Validation — Baseline (no code changes)

```
npx tsc --noEmit                          → ✅ No errors
npm run build                             → ✅ Built in 5.92s
npm run test:challenge-creation-backend   → ✅ All tests passed
npm run test:challenge-creation-6combos   → ✅ All 8 combinations passed
npm run audit:challenge-creation-payloads → ✅ All 8 guards passed
npm run test:scoring-guards               → ✅ All 14 guards passed
npm run test:home-challenge-feeds         → ✅ All guards passed
```

No regressions introduced by this audit phase (no files changed).

---

## 6. Phase 18G-2 Recommended Fix Order

| Priority | Bug | Fix |
|---|---|---|
| 1 | BUG-G6 (CRITICAL) | Fix Firestore challenge update rule to allow member `groupCurrentTotal` writes without blocking on `moderationStatus`; or move `atomicCollectiveGroupUpdate` to a Cloud Function (admin SDK bypasses rules) |
| 2 | BUG-G1 (HIGH) | Remove client-side `participantCount` increment from `challengeService.joinChallenge` and `leaveChallenge`; rely solely on Cloud Function triggers |
| 3 | BUG-G3 (MEDIUM) | Add auto-join self-heal to `wellnessLogService` (mirror `workoutService:100-107`) |
| 4 | BUG-G2 (MEDIUM) | Derive actual `targetType` from challenge activities in `ChallengeContext`; remove hardcoded `'daily'` |
| 5 | ARCH-1 (DESIGN) | Add group membership check to `workoutService` (or remove from `wellnessLogService`) for consistency |
| 6 | BUG-G4 (LOW) | Add `activitiesCompleted > 0` guard in `leaveChallenge` service layer |
| 7 | BUG-G5 (LOW) | Update Firestore rule for v1 wellnessLogs to allow `points >= 0` on the v1 path |

**BUG-G6 should be fixed before any production deployment.** All collective challenge logging fails silently or throws permission errors for non-admin users.
