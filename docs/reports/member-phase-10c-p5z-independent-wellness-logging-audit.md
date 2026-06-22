# Phase 10C-P5Z — Independent Wellness Logging Permission Audit

**Date:** 2026-06-20  
**Scope:** cold review of production wellness logging permission failure  
**Status:** audit complete; no fix implemented

## Executive Summary

The reported production error is a client batch failure from `wellnessLogService`:

1. `wellnessLogs/{autoId}` create
2. `challengeMembers/{challengeId}_{uid}` update
3. `users/{uid}` update

I independently evaluated the exact provided sleep payload against the currently deployed Firestore rules and live production document state for:

- `challenges/yv1EGn1flBo8euOwQ5Ww`
- `challengeMembers/yv1EGn1flBo8euOwQ5Ww_sMfC7PsPp7cpGwnr3tGvsKSEOB32`
- `groupMembers/seed_group_early_birds_sMfC7PsPp7cpGwnr3tGvsKSEOB32`
- `users/sMfC7PsPp7cpGwnr3tGvsKSEOB32`

Result: **all three individual writes are allowed, and the full 3-write batch is allowed, under the deployed ruleset.**

Therefore, I cannot honestly name one of the three listed writes as the current rules blocker for the exact payload supplied. The audit falsifies the leading theories that the exact `wellnessLogs` create, exact `challengeMembers` completion update, nested `users.stats` update, `serverTimestamp`, `increment`, status transition, affected keys, or missing allowlist keys are denied by the current deployed rules.

The remaining possibilities are:

- the runtime payload differs from the summarized console payload,
- the failing user/challenge is not the `sMfC7...` membership state audited here,
- the browser is executing a different path or stale cached code,
- the failure was captured before the current deployed bundle/rules were live,
- or a production-only condition not represented in the provided log is involved.

## Exact Failing Write

**No exact failing write was reproduced under the current deployed ruleset.**

The exact candidates evaluated were:

- `wellnessLogs/{autoId}` create: **ALLOW**
- `challengeMembers/yv1EGn1flBo8euOwQ5Ww_sMfC7PsPp7cpGwnr3tGvsKSEOB32` update: **ALLOW**
- `users/sMfC7PsPp7cpGwnr3tGvsKSEOB32` update: **ALLOW**
- Full 3-write batch: **ALLOW**

This is a material audit finding: naming any one of those writes as the blocker would be unsupported by the current rule evaluation evidence.

## Exact Payload Causing Denial

**No denial was produced by the supplied payload.** The payload below was accepted by the emulator with the deployed rules and production-export fixture:

```js
{
  challengeId: 'yv1EGn1flBo8euOwQ5Ww',
  groupId: 'seed_group_early_birds',
  activityId: 'sleep-8hr-nightly',
  logType: 'sleep',
  value: 8,
  unit: 'hours',
  points: 100,
  targetValue: 8,
  completionRate: 100,
  scoringVersion: 'v2',
  membershipStatus: 'active'
}
```

The production denial therefore requires a missing detail outside this summarized payload, a different user/challenge state, or a different executed write shape/path.

## Deployed Rules Check

I fetched the live Firebase Rules ruleset via the Firebase Rules API.

- Latest deployed ruleset: `9885b78c-f5b8-4f09-9190-c08f1689c0fa`
- Created: `2026-06-19T15:51:46.364335Z`
- Diff against local `firestore.rules`: **no differences**

This is not a Firestore rules deployment drift issue.

## Production Data Checked

For the provided example:

```txt
challengeId: yv1EGn1flBo8euOwQ5Ww
groupId: seed_group_early_birds
activityId: sleep-8hr-nightly
```

Production state:

- Challenge exists, `status: active`, `groupId: seed_group_early_birds`, `challengeType: streak`, one configured activity.
- Only challenge member found for that challenge: `sMfC7PsPp7cpGwnr3tGvsKSEOB32`.
- Challenge membership exists, `status: active`, `activitiesCompleted: 0`, `totalActivities: 1`, `totalPoints: 0`.
- Group membership exists for the same UID, `status: joined`, `groupId` and `userId` match.
- User document exists.

## Writes In The Wellness Batch

### Write 1 — `wellnessLogs` Create

Payload evaluated:

```js
{
  userId: 'sMfC7PsPp7cpGwnr3tGvsKSEOB32',
  groupId: 'seed_group_early_birds',
  challengeId: 'yv1EGn1flBo8euOwQ5Ww',
  activityId: 'sleep-8hr-nightly',
  logType: 'sleep',
  value: 8,
  unit: 'hours',
  points: 100,
  rawValue: 8,
  targetValue: 8,
  metTarget: true,
  scoringMethod: 'target_completion',
  capped: false,
  scoringVersion: 'v2',
  notes: '',
  date: '2026-06-20',
  createdAt: request.time,
  loggedAt: request.time,
  metadata: {}
}
```

Rule path:

- `match /wellnessLogs/{logId}`
- `allow create: if isValidWellnessCreate()`
- `isValidWellnessCreate()`
- `isValidActivityContext(request.resource.data)`
- `isValidActivityTimestamps(request.resource.data)`

Actual emulator result with production-export fixture: **ALLOW**

Conclusion: the exact supplied `wellnessLogs` create is not blocked by `isValidWellnessCreate`.

### Write 2 — `challengeMembers` Update

Payload evaluated:

```js
{
  activitiesCompleted: 1,
  totalPoints: increment(100),
  lastActivityAt: request.time,
  completionRate: 100,
  status: 'completed',
  completedAt: request.time
}
```

Rule path:

- `match /challengeMembers/{membershipId}`
- `allow update`
- `resource.data.userId == request.auth.uid`
- `isSafeChallengeProgressUpdate()`

Actual emulator result with production-export fixture: **ALLOW**

Conclusion: the exact completion/status/points update is not blocked by `isSafeChallengeProgressUpdate`.

### Write 3 — `users` Stats Update

Current production bundle and local source both use:

```js
{
  stats: {
    totalPoints: increment(100),
    totalWorkouts: increment(1)
  },
  lastWorkoutAt: request.time
}
```

Rule path:

- `match /users/{userId}`
- `allow update`
- `isSafeUserUpdate(userId)`

Actual emulator result with production-export fixture: **ALLOW**

Conclusion: the current nested `users.stats` update is not the reproduced rules blocker.

## Batch Evaluation Result

I replayed the complete `wellnessLogService` 3-write batch in the Firestore/Auth emulator using:

- deployed/local matching rules,
- production-export challenge, challenge member, group member, and user docs,
- auth UID `sMfC7PsPp7cpGwnr3tGvsKSEOB32`,
- exact provided sleep payload.

Results:

```txt
wellnessLogs create exact payload: ALLOW
challengeMembers completion update exact payload: ALLOW
users stats update with nested increments: ALLOW
full wellnessLogService 3-write batch exact payload: ALLOW
2-write batch without users stats: ALLOW
```

## Comparison Against Workout Logging

`workoutService.createWorkout` still writes:

1. `workouts/{autoId}`
2. `users/{uid}` stats update
3. `challengeMembers/{challengeId}_{uid}` progress update

`activityLogSessionService.createActivitySession`, the newer unified logging path, writes:

1. one or more `workouts/{autoId}` or `wellnessLogs/{autoId}` docs
2. one `challengeMembers/{challengeId}_{uid}` progress update

It intentionally **does not write `users/{uid}`**. Server functions already listen to `workouts` and `wellnessLogs` creates:

- `onWorkoutCreatedUpdateMemberSummaries`
- `onWellnessLogCreatedUpdateMemberSummaries`

Those functions update member activity summaries and refresh derived user metrics. This is the safer direction: raw activity creates should trigger server-owned summaries, not rely on client-maintained counters.

## Checks Requested

| Question | Finding |
|---|---|
| Does `wellnessLogs` create allow the exact production payload? | Yes. |
| Does `challengeMembers` update allow exact completion/status/points update? | Yes. |
| Is `users.stats` the reproduced blocker? | No, not with current deployed rules and current nested merge payload. |
| Is this caused by `serverTimestamp`? | No. Timestamp fields evaluating as `request.time` pass. |
| Is this caused by `increment`? | No. `totalPoints`, `stats.totalPoints`, and `stats.totalWorkouts` increments pass. |
| Is this caused by nested `stats`? | No rules denial reproduced. It is still a data integrity smell. |
| Is this caused by status transition to `completed`? | No. `status` plus `completedAt` pairing passes. |
| Is this caused by `affectedKeys()`? | No denial reproduced for the current payload. |
| Is this caused by allowlist keys? | No. All current payload keys are allowlisted. |

## Why Previous Fixes Failed

### P5U

P5U fixed real join/read problems:

- `totalActivities` at challenge-member create time.
- `challengeMembers` `get` on missing docs.

Those fixes do not explain the current batch failure because the audited production membership exists and is readable.

### P5W

P5W improved diagnostics and briefly moved the user stats write toward dotted field paths. The diagnostics were useful, but the stats-write change was not the right long-term architectural direction because `users.stats` is a client-owned legacy counter surface.

### P5X

P5X concluded the user write was blocked by dotted `affectedKeys()` and reverted to nested `set(..., { merge: true })`. The current deployed bundle now uses that nested merge shape, and I verified it is allowed.

I also tested a dotted-path `batch.update` variant in the emulator; it was allowed under the current rules engine. So P5X may have addressed a real runtime mismatch at the time, but I do not find evidence that it remains the blocker under the current deployed rules and bundle.

## Recommended Safest Fix

Remove the `users/{uid}` stats update from `wellnessLogService.writeLog` entirely and make the single wellness path match `activityLogSessionService`:

```txt
wellnessLogs create
challengeMembers update
```

Rationale:

- It reduces the client batch from three writes to two.
- It aligns wellness single logging with the newer unified logging path.
- It removes a legacy client-owned counter write from the critical path.
- It avoids overwriting the whole `stats` map with `set(..., { merge: true })`.
- It lets Cloud Functions own summaries and derived metrics from the raw `wellnessLogs` create.

If the product still needs `users.stats.totalPoints` or `users.stats.totalWorkouts` specifically, that should be updated by a Cloud Function, not by the client. Prefer `userMetrics`, `memberHome`, and activity summary documents as the canonical derived surfaces.

## Deploy Impact

For the smallest client-batch cleanup:

- **Hosting deploy:** required.
- **Firestore rules deploy:** not required.
- **Functions deploy:** not required if the UI can rely on existing server-owned derived metrics.

If legacy `users.stats` must continue to be updated:

- **Functions deploy:** required for a server-owned stats updater.
- **Hosting deploy:** likely required if UI reads are moved from `users.stats` to `userMetrics`/`memberHome`.
- **Firestore rules deploy:** not required for the current recommended direction.

## Smallest Safe Fix Proposal

1. In `src/services/wellnessLogService.ts`, delete `userRef`, `userStatsUpdate`, the debug write entry for `users stats update`, the `users update` planned-write label, and `batch.set(userRef, userStatsUpdate, { merge: true })`.
2. Keep `wellnessLogs` create and `challengeMembers` update unchanged.
3. Add an emulator test that asserts the exact production sleep payload passes as:
   - individual `wellnessLogs` create,
   - individual `challengeMembers` completion update,
   - 2-write batch.
4. Deploy hosting.

This is the smallest safe change because it removes the least necessary write from the failing batch without weakening Firestore rules or changing scoring/progress behavior.
