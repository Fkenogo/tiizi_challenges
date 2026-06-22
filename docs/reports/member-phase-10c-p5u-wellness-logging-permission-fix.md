# Phase 10C-P5U — Wellness Logging Permission Debug + Fix

**Date:** 2026-06-19  
**Branch:** fix/p0-pre-deploy-blockers  
**Status:** Complete — all validation green, rules dry-run clean

---

## Issue

Wellness challenges ("8-Hour Sleep Streak", "7-Day Daily Hydration Challenge (2L)") fail on
**Save Activity** with: `Missing or insufficient permissions.`

---

## Root Cause Analysis

### Failed Firestore Path

`wellnessLogService.writeLog` → `getDoc(challengeMembers/{challengeId}_{userId})`

When the `challengeMembers` document does **not exist** (due to Root Cause A below), this
`getDoc` call throws "Missing or insufficient permissions" — not the client-side guard
("Join challenge before logging wellness activity").

### Root Cause A — P5T Fix 2 broke challenge joins (regression)

**File:** `src/services/challengeService.ts` — `joinChallenge`

P5T Fix 2 changed `totalActivities` at join time from `0` to `challenge.activities.length`
(e.g., `1` for a single-activity challenge). The Firestore rule `isValidChallengeMemberCreate`
(line 580 before fix) required:

```
&& request.resource.data.totalActivities == 0
```

For any challenge with `activities.length > 0`, the batch write was denied → no
`challengeMembers` document was created → subsequent wellness logging failed.

### Root Cause B — `challengeMembers` GET rule denied reads on non-existent docs

**File:** `firestore.rules` — `allow get` on `challengeMembers/{membershipId}`

The pre-fix rule:
```
allow get: if isAuthenticated()
             && (resource.data.userId == request.auth.uid
                 || isGroupMember(resource.data.groupId)
                 || canModerateChallenges());
```

When the document does not exist, `resource.data` is `null`. Accessing `null.userId` in
Firestore rules causes the evaluation to return `false` → the `getDoc()` call is **denied**
with "Missing or insufficient permissions" instead of returning `exists() === false`.

This means even if Root Cause A is fixed (doc now exists), a user who joined before P5T
was applied but whose join was somehow missed would surface this confusing error instead of
the informative "Join challenge before logging wellness activity."

---

## Fixes Applied

### Fix A — Relax `isValidChallengeMemberCreate` to accept activities.length

**File:** `firestore.rules`

```
// Before (line 580):
&& request.resource.data.totalActivities == 0

// After:
&& (request.resource.data.totalActivities == 0
    || request.resource.data.totalActivities == configuredChallengeActivityCountFrom(challenge))
```

Allows both:
- `totalActivities: 0` (old client code, existing members unaffected)
- `totalActivities: activities.length` (P5T Fix 2's correct value)

The `challenge` variable is already in scope (read earlier in the function). No extra
`get()` call is needed. `configuredChallengeActivityCountFrom` returns
`challenge.data.activities.size()` for challenges with a non-empty `activities` list.

### Fix B — Allow `getDoc()` on non-existent `challengeMembers` docs

**File:** `firestore.rules`

```
// Before:
allow get: if isAuthenticated()
             && (resource.data.userId == request.auth.uid
                 || isGroupMember(resource.data.groupId)
                 || canModerateChallenges());

// After:
allow get: if isAuthenticated()
             && (resource.data == null
                 || resource.data.userId == request.auth.uid
                 || isGroupMember(resource.data.groupId)
                 || canModerateChallenges());
```

`resource.data == null` is true when the document does not exist. This allows any
authenticated user to call `getDoc()` on any `challengeMembers` path to check existence.
When the doc doesn't exist, no data is exposed. When it does exist, the existing
`userId`/`groupId`/moderator checks still apply.

---

## Guard Tests Added

**File:** `scripts/testScoringGuards.ts` — Section 19 (P5U, 2 assertions)

| # | Assertion |
|---|-----------|
| 1 | `isValidChallengeMemberCreate` must not restrict `totalActivities == 0` alone; must accept `configuredChallengeActivityCountFrom` |
| 2 | `challengeMembers allow get` must include `resource.data == null` check |

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
✅ npm run build                            ✓ built in 3.24s
✅ firebase deploy --only firestore:rules --dry-run --project tiizi-challenges
                                            rules compiled successfully — Dry run complete!
```

---

## Risk Assessment

| Fix | Risk | Rationale |
|-----|------|-----------|
| Fix A — relax `totalActivities` constraint | Low | Backwards-compatible: still accepts `0`. Adds acceptance of `activities.size()` — the value P5T Fix 2 already writes. No other collections affected. |
| Fix B — allow GET on non-existent docs | Very low | Non-existent docs contain no data. Allows authenticated users to call `getDoc()` on any `challengeMembers` path to check existence — same data visible via list queries scoped to `userId`. When doc exists, existing access controls are unchanged. |

---

## What Was NOT Changed

- `src/services/challengeService.ts` — P5T Fix 2's `totalActivities: activities.length` is correct and remains.
- `src/services/wellnessLogService.ts` — no changes; pre-flight logic and batch writes are correct.
- Scoring, browse, group layout, invite UI, completed challenge flows — untouched.
- No Firestore rules were weakened broadly; changes are narrowly scoped to `isValidChallengeMemberCreate` and the `challengeMembers` GET path.
