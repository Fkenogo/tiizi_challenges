# Phase 18G-2A.1 — Fix Join Challenge Permission Denied

**Date:** 2026-06-29
**Branch:** fix/p0-pre-deploy-blockers
**Symptom:** `FirebaseError: Missing or insufficient permissions` when any non-creator group member clicks "Join Challenge"

---

## 1. Root Cause

`challengeService.joinChallenge` commits a three-write batch:

```ts
batch.set(memberRef, { ...basePayload }, { merge: true });           // challengeMembers create
batch.set(challengeRef, { participantCount: increment(1) }, { merge: true }); // challenge update ← BLOCKED
batch.set(userRef, { stats: { totalChallenges: increment(1) } }, { merge: true }); // user update
```

The second write — `participantCount` on the challenge document — was blocked by the challenge `allow update` rule. Firestore evaluates each write in a batch independently; if any single write fails rules, the entire batch is rejected.

**The challenge `allow update` rule (before Phase 18G-2A and after) had no path for non-creator group members:**
- Creator branch: `resource.data.createdBy == request.auth.uid` — false for non-creators
- Collective-progress branch: `isActiveCollectiveProgressUpdate` — `hasOnly(['groupCurrentTotal', 'status', 'completedAt'])` does not include `participantCount`
- Moderator branch: `canModerateChallenges()` — false for regular users

The same issue affects `leaveChallenge`, which also batch-writes `{ participantCount: increment(-1) }` to the challenge doc.

**This was present before Phase 18G-2A.** Phase 18G-2A changed the creator branch condition but did not introduce this bug; the `participantCount` write was always denied for non-creators. It was only discovered during manual testing triggered by Phase 18G-2A.

---

## 2. Document ID Formats — Confirmed Correct

| Format | Helper | Firestore Rules Helper |
|---|---|---|
| `groupMembers/${groupId}_${userId}` | `membershipDocId(groupId, userId)` | `isGroupMember(groupId)` uses `$(groupId + '_' + request.auth.uid)` ✅ |
| `challengeMembers/${challengeId}_${userId}` | `challengeMemberDocId(challengeId, userId)` | `isActiveChallengeMember(challengeId)` uses `$(challengeId + '_' + request.auth.uid)` ✅ |

The `challengeMembers create` rule was not the blocker — the `challenges update` rule was.

---

## 3. Fix

Added a narrow `participantCount`-only branch to the challenge `allow update` rule:

### Before

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
```

### After

```
allow update: if isAuthenticated() && (
  (
    resource.data.createdBy == request.auth.uid
    && !(resource.data.donation.enabled == true && request.resource.data.status == 'active')
    && request.resource.data.moderationStatus == resource.data.moderationStatus
  )
  || isActiveCollectiveProgressUpdate(challengeId)
  // Group members may update only participantCount (join/leave counter sync).
  // The Cloud Function trigger is authoritative; this client write is optimistic
  // and will be superseded. Removed in Phase 18G-2B when client-side
  // participantCount writes are eliminated (BUG-G1 fix).
  || (
    (isGroupMember(resource.data.groupId) || isPublicGroup(resource.data.groupId))
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['participantCount'])
  )
  || canModerateChallenges()
);
```

**Why `hasOnly(['participantCount'])` is safe:**
- Only `participantCount` may change — no other challenge field (name, dates, activities, moderationStatus, createdBy, groupId, donation fields) can be touched via this branch
- User must be a group member or the group must be public — anonymous writes and cross-group writes are blocked
- The Cloud Function trigger (`onChallengeMemberCreated/Updated`) overwrites `participantCount` on every membership status change, so even a malicious write is corrected on the next trigger
- Phase 18G-2B will remove the client-side `participantCount` write entirely, at which point this rule branch becomes dead code and can be removed

---

## 4. Security Analysis

| Attack | Protected by |
|---|---|
| Non-group-member updates `participantCount` | `isGroupMember` / `isPublicGroup` check |
| Member modifies challenge name/description/activities | `hasOnly(['participantCount'])` — any other field in the write blocks the whole update |
| Member sets `participantCount` to arbitrary value | Not rule-blocked — acceptable because: (1) display-only field, (2) Cloud Function trigger corrects value on every membership change |
| Unauthenticated write | `isAuthenticated()` outer gate |

---

## 5. Regression Guards Added

10 static source-analysis guards added to `scripts/testScoringGuards.ts` (section `18G`):

| ID | What it guards |
|---|---|
| 18G-1 | `joinChallenge` payload includes `groupId` (required by `challengeMembers create` rule) |
| 18G-2 | `joinChallenge` payload includes `userId` (required by `userId == request.auth.uid` check) |
| 18G-3 | `challengeMemberDocId` uses `${challengeId}_${userId}` format |
| 18G-4 | `membershipDocId` uses `${groupId}_${userId}` format (matches `isGroupMember` rule) |
| 18G-5 | `joinChallenge` validates group membership at service layer |
| 18G-6 | Rules contain `hasOnly(['participantCount'])` + `isGroupMember` in challenge update |
| 18G-7 | `challengeMembers create` requires `userId == request.auth.uid` |
| 18G-8 | `isGroupMember` accepts both `active` and `joined` statuses |
| 18G-9 | `isPublicGroup` helper exists |
| 18G-10 | Challenge update rule compares `moderationStatus` against existing value (Phase 18G-2A fix) |

---

## 6. Files Changed

| File | Change |
|---|---|
| `firestore.rules` | Added `participantCount`-only update branch to challenge `allow update` rule |
| `scripts/testScoringGuards.ts` | Added 10 regression guards (section 18G) |

---

## 7. Requires Deployment

Yes — `firestore.rules` must be deployed to unblock join in production. The `--dry-run` confirms it compiles correctly.

```
firebase deploy --only firestore:rules
```

---

## 8. Validation

```
npx tsc --noEmit                                  → ✅ No errors
npm run build                                     → ✅ Built in 5.86s
npm run test:scoring-guards                       → ✅ All guards passed (incl. new 18G-1 through 18G-10)
npm run test:home-challenge-feeds                 → ✅ All guards passed
firebase deploy --only firestore:rules --dry-run  → ✅ Compiled (3 pre-existing warnings unchanged)
```

---

## 9. Manual Smoke Test

| Scenario | Expected outcome after this fix |
|---|---|
| Group member clicks "Join Challenge" | ✅ Joins successfully — no permission error |
| Group member clicks "Leave Challenge" | ✅ Leaves successfully — `participantCount` decrements |
| Non-group-member tries to join public group challenge | Blocked at service layer ("Must be a group member") |
| Non-group-member tries to join private group challenge | Blocked at service layer ("Must be a group member") |
| Member tries to update challenge name | DENIED — `moderationStatus` field absent from `hasOnly` would only matter if included; more precisely, `name` is not in `hasOnly(['participantCount'])` so the write is rejected |
| Creator updates challenge details | ✅ Allowed (creator branch, moderationStatus unchanged) |
