# Phase 18G-2A — Collective Challenge Firestore Update Rule Fix

**Date:** 2026-06-29
**Branch:** fix/p0-pre-deploy-blockers
**Bug fixed:** BUG-G6 (CRITICAL)

---

## 1. Root Cause Recap

`firestore.rules` line 171-178 (before fix):

```
allow update, delete: if isAuthenticated() && (
  (
    resource.data.createdBy == request.auth.uid
    && !(resource.data.donation.enabled == true && request.resource.data.status == 'active')
    && !(request.resource.data.moderationStatus == 'approved')   // ← BUG
  )
  || canModerateChallenges()
);
```

**The bug:** `!(request.resource.data.moderationStatus == 'approved')` checks the *post-write merged document*. Any update that does not explicitly change `moderationStatus` inherits the existing value from the stored document. All active challenges have `moderationStatus: 'approved'`, so this condition evaluates to `false` for every such update — freezing the challenge doc for everyone except moderators.

**Consequences:**
1. The creator cannot update their own approved challenge (wrong — originally intended to prevent re-approving, not to prevent all edits).
2. `atomicCollectiveGroupUpdate` (client-side SDK) cannot write `groupCurrentTotal` for any non-admin member → collective challenge logging silently fails or throws a permissions error in production.

---

## 2. Fix — Exact Before / After

### Rule: challenge `allow update` (before)

```
allow update, delete: if isAuthenticated() && (
  (
    resource.data.createdBy == request.auth.uid
    && !(resource.data.donation.enabled == true && request.resource.data.status == 'active')
    && !(request.resource.data.moderationStatus == 'approved')
  )
  || canModerateChallenges()
);
```

### Rule: challenge `allow update` and `allow delete` (after)

```
allow update: if isAuthenticated() && (
  (
    resource.data.createdBy == request.auth.uid
    && !(resource.data.donation.enabled == true && request.resource.data.status == 'active')
    && request.resource.data.moderationStatus == resource.data.moderationStatus
  )
  || isActiveCollectiveProgressUpdate(challengeId)
  || canModerateChallenges()
);
allow delete: if isAuthenticated() && (
  (
    resource.data.createdBy == request.auth.uid
    && !(resource.data.donation.enabled == true && resource.data.status == 'active')
    && resource.data.moderationStatus != 'approved'
  )
  || canModerateChallenges()
);
```

### Creator branch change

| | Old | New |
|---|---|---|
| Condition | `!(request.resource.data.moderationStatus == 'approved')` | `request.resource.data.moderationStatus == resource.data.moderationStatus` |
| Meaning | Deny if post-write doc has `moderationStatus: 'approved'` (always true for active challenges) | Deny if `moderationStatus` is **changed** by this write |
| Effect on approved challenges | Creator cannot update at all | Creator can update anything except `moderationStatus` |
| Protection preserved | ❌ Broken (too broad) | ✅ Creator cannot escalate to or from `'approved'`; only moderators can change `moderationStatus` |

### Delete branch change

Split from combined `update, delete` into a dedicated `allow delete`. The effective behavior is identical — the old conditions used `request.resource.data` for a delete, which is the same as `resource.data` for delete operations. Rewritten to use `resource.data` directly for clarity. No functional change.

---

## 3. New Helper Functions

Added before `match /databases/...`:

### `isActiveChallengeMember(challengeId)`

```
function isActiveChallengeMember(challengeId) {
  let membershipId = challengeId + '_' + request.auth.uid;
  return isAuthenticated()
    && exists(/databases/(default)/documents/challengeMembers/$(membershipId))
    && get(/databases/(default)/documents/challengeMembers/$(membershipId)).data.status in ['active', 'joined'];
}
```

Verifies the authenticating user holds an active `challengeMembers` document for this specific challenge. Uses the canonical ID format `${challengeId}_${userId}` (same format used by `challengeService.joinChallenge`). Restricts to `'active'` and `'joined'` statuses — not `'abandoned'` or `'completed'`.

### `isActiveCollectiveProgressUpdate(challengeId)`

```
function isActiveCollectiveProgressUpdate(challengeId) {
  return resource.data.engineVersion == 'v2'
    && resource.data.challengeType == 'collective'
    && resource.data.status == 'active'
    && isActiveChallengeMember(challengeId)
    && request.resource.data.diff(resource.data).affectedKeys()
         .hasOnly(['groupCurrentTotal', 'status', 'completedAt'])
    && (!request.resource.data.diff(resource.data).affectedKeys().hasAny(['status'])
        || request.resource.data.status == 'completed');
}
```

Returns true **only** when all conditions hold:

| Condition | Protects against |
|---|---|
| `engineVersion == 'v2'` | Legacy challenges untouched by this path |
| `challengeType == 'collective'` | Non-collective challenges cannot use this path |
| `resource.data.status == 'active'` | Cannot write to completed/cancelled challenges |
| `isActiveChallengeMember(challengeId)` | Non-members cannot update any challenge |
| `affectedKeys().hasOnly([...])` | Fields beyond `{groupCurrentTotal, status, completedAt}` cannot be changed — name, description, activities, groupId, createdBy, moderationStatus, donation fields, etc. are all blocked |
| Status change only to `'completed'` | Cannot set status to `'pending'`, `'active'`, `'cancelled'`, etc. |

---

## 4. Security Analysis

### What the new member branch allows

A member with an active challengeMembers doc can update a v2 active collective challenge, but **only** the fields `{groupCurrentTotal, status, completedAt}`. If they try to write any other field, `hasOnly()` rejects the entire write.

### What remains protected

| Field | Who can change it |
|---|---|
| `moderationStatus` | Moderators only |
| `createdBy` | Nobody (create-only) |
| `groupId` | Nobody (create-only) |
| `activities` | Creator (without `moderationStatus` change) or moderator |
| `donation.*` | Creator (subject to activation constraints) or moderator |
| `name`, `description`, `startDate`, `endDate` | Creator (without `moderationStatus` change) or moderator |
| `groupCurrentTotal` | Active member (v2 collective, active challenge) or moderator |
| `status` → `'completed'` | Active member (v2 collective, active challenge) or moderator |

### Pre-existing warnings (not introduced by this fix)

```
⚠  [W] 14:12 - Unused function: isValidChallengeMemberCreate.
⚠  [W] 15:12 - Invalid variable name: request.
⚠  [W] 16:10 - Invalid variable name: request.
```

These three warnings are in the pre-existing `isValidChallengeMemberCreate` function (lines 14–17). The function is defined but never referenced in any `match` block, and its `request.` variable references appear to be linted differently by the Firebase rules compiler. Not introduced by this phase.

---

## 5. Files Changed

| File | Change |
|---|---|
| `firestore.rules` | Added `isActiveChallengeMember` + `isActiveCollectiveProgressUpdate` helper functions; fixed creator `allow update` branch (moderationStatus comparison); split `allow update, delete` into separate rules for challenges |

---

## 6. Validation

```
npx tsc --noEmit                          → ✅ No errors
npm run build                             → ✅ Built in 4.28s
npm run test:scoring-guards               → ✅ All 14 guards passed
npm run test:home-challenge-feeds         → ✅ All guards passed
firebase deploy --only firestore:rules --dry-run
                                          → ✅ Rules compiled successfully
                                             ⚠ 3 pre-existing warnings (unchanged)
```

---

## 7. Manual Testing Ready?

**Collective log testing (fitness):** `workoutService → atomicCollectiveGroupUpdate` is unblocked for active challenge members. The Firestore rules no longer deny the transaction's `tx.update(challengeRef, writePayload)` call for non-admin users.

**Collective log testing (wellness):** Same — `wellnessLogService → atomicCollectiveGroupUpdate` path is also unblocked.

**Phase 18G-2B scope (remaining bugs from Phase 18G-1):**
- BUG-G1: `participantCount` double-write (requires removing client-side increment from `challengeService`)
- BUG-G3: `wellnessLogService` auto-join self-heal
- BUG-G2: `ChallengeContext.targetType` hardcoded
- ARCH-1: Inconsistent group membership check
- BUG-G4: Leave-after-log service guard

These are independent of BUG-G6 and do not block collective challenge testing.

**Manual collective challenge smoke test (cannot be done via existing test scripts):**

| Step | Expected |
|---|---|
| Create a v2 collective challenge in a public group | `moderationStatus: 'approved'`, `status: 'active'` |
| Join challenge as a second user | `challengeMembers/${challengeId}_${userId2}` created |
| Log a fitness activity for the challenge as user2 | `groupCurrentTotal` increments; no permission error |
| Log a wellness activity for the challenge as user2 | Same — no permission error |
| When cumulative target reached | `status` flips to `'completed'` in same transaction |
| Attempt to update challenge `name` as user2 | DENIED (non-creator, non-moderator, wrong fields) |
| Attempt to update `groupCurrentTotal` as user with no challengeMembers doc | DENIED |
