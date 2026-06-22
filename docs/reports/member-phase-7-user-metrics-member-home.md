# Member Phase 7: User Metrics + Member Home Summary

Date: 2026-06-10

## Summary

Phase 7 adds server-generated member summary documents for exact user-level analytics and lightweight home dashboard data:

- `userMetrics/{uid}`
- `memberHome/{uid}`

Clients can read only their own summary docs. Client writes are denied by Firestore rules. Cloud Functions and the Admin SDK backfill script are the trusted writers.

## Files Changed

- `functions/src/memberUserMetrics.ts`
- `functions/src/index.ts`
- `src/services/memberMetricsService.ts`
- `src/hooks/useMemberMetrics.ts`
- `src/hooks/useStreak.ts`
- `src/features/Home/HomeScreen.tsx`
- `src/features/Profile/ProfileScreen.tsx`
- `src/features/Profile/ProfileAnalyticsScreen.tsx`
- `scripts/backfillUserMetrics.ts`
- `package.json`
- `firestore.rules`
- `docs/reports/member-phase-7-user-metrics-member-home.md`

## New Collections

### `userMetrics/{uid}`

Fields generated:

- `totalWorkouts`
- `totalWellnessLogs`
- `totalActivitiesLogged`
- `workouts7d`
- `workouts30d`
- `wellness7d`
- `wellness30d`
- `currentStreak`
- `longestStreak`
- `activeChallengesCount`
- `completedChallengesCount`
- `joinedGroupsCount`
- `lastActivityAt`
- `updatedAt`
- `generatedBy`
- `sourceVersion`

### `memberHome/{uid}`

Fields generated:

- `primaryActiveChallenge`
- `activeChallengeCount`
- `completedChallengeCount`
- `joinedGroupCount`
- `recentActivityCount`
- `generatedAt`
- `generatedBy`
- `sourceVersion`

## Functions Added or Updated

New reusable function core:

- `rebuildUserMetricsForUser(db, uid, options)`
- `refreshUserMetricsFromRecord(db, data)`

Existing activity triggers were extended:

- `onWorkoutCreatedUpdateMemberSummaries`
- `onWellnessLogCreatedUpdateMemberSummaries`

New membership write triggers were added:

- `onGroupMemberWrittenUpdateUserMetrics`
- `onChallengeMemberWrittenUpdateUserMetrics`

Membership create summary triggers remain in place for the existing group/challenge summary architecture.

## Client Usage

Home:

- Uses `memberHome.primaryActiveChallenge` when available.
- Uses `memberHome.joinedGroupCount` for the empty-state action decision.
- Does not introduce any full collection fallback.

Profile:

- Uses `userMetrics.joinedGroupsCount`, `completedChallengesCount`, and `currentStreak` for top stat cards.
- Keeps the bounded `My Groups` read for rendering actual group rows.

Profile Analytics:

- Uses `userMetrics` for workouts, wellness logs, streaks, joined groups, active/completed challenges, and total activities.
- Removed local analytics calculations from loaded workout/challenge arrays.

Streak hook:

- `useUserStreak` now reads `userMetrics/{uid}`.
- Challenge-specific streaks keep the existing bounded challenge query path.

## Firestore Rules

Added:

```rules
match /userMetrics/{userId} {
  allow read: if isAuthenticated() && request.auth.uid == userId;
  allow create, update, delete: if false;
}

match /memberHome/{userId} {
  allow read: if isAuthenticated() && request.auth.uid == userId;
  allow create, update, delete: if false;
}
```

Normal users cannot create, update, or delete either summary collection.

## Indexes

No new Firestore indexes were added for Phase 7.

The function/backfill generator uses server/Admin SDK reads and simple `where('userId', '==', uid)` queries for each source collection.

## Backfill

Added scripts:

- `npm run backfill:user-metrics`
- `CONFIRM_PROJECT_ID=tiizi-challenges npm run backfill:user-metrics:apply`

Dry-run output:

```json
{
  "mode": "dry-run",
  "projectId": "tiizi-challenges",
  "durationMs": 56522,
  "usersProcessed": 30,
  "targetDocs": {
    "userMetrics": 30,
    "memberHome": 30
  },
  "readCounts": {
    "users": 30,
    "workouts": 517,
    "wellnessLogs": 0,
    "challengeMembers": 217,
    "groupMembers": 83,
    "challenges": 38
  },
  "writeCounts": {}
}
```

The first sandboxed run failed because `tsx` could not open its local IPC pipe. The dry-run was rerun with escalation and completed successfully with no writes.

## Validation Results

`npm run test:sentinels`

- Passed: 8 checks, 0 failed.

`npx tsc -b`

- Passed.

`npm run build`

- Passed.
- Vite production build completed successfully.

`npm --prefix functions run build`

- Passed.

`npm --prefix functions run lint`

- Passed.

`firebase deploy --only firestore:rules --dry-run --project tiizi-challenges`

- Passed.
- `firestore.rules` compiled successfully.

`firebase deploy --only firestore:indexes --dry-run --project tiizi-challenges`

- Passed.
- No Phase 7 index changes required.

`npm run backfill:user-metrics`

- Passed after sandbox escalation.
- Dry-run only; no writes applied.

## Deployment Required

Required after review:

```bash
firebase deploy --only functions:onWorkoutCreatedUpdateMemberSummaries,functions:onWellnessLogCreatedUpdateMemberSummaries,functions:onGroupMemberWrittenUpdateUserMetrics,functions:onChallengeMemberWrittenUpdateUserMetrics --project tiizi-challenges
firebase deploy --only firestore:rules --project tiizi-challenges
npm run build
firebase deploy --only hosting --project tiizi-challenges
CONFIRM_PROJECT_ID=tiizi-challenges npm run backfill:user-metrics:apply
```

Indexes do not need deployment for Phase 7 unless deploying all pending index file changes from earlier phases.

## Remaining Risks

- `userMetrics` and `memberHome` will be missing until the backfill apply command runs or the user creates/updates one of the trigger source documents.
- Per-user generator reads lifetime workout/wellness/activity membership history. This is acceptable for pilot-sized accounts and removes client analytics drift, but high-volume production accounts may later need incremental counters instead of per-trigger lifetime recomputation.
- `memberHome.primaryActiveChallenge.progress` currently uses challenge membership fields and does not read challenge activity summaries. If collective challenge progress must show global group progress on Home, add a trusted function-side join to `challengeActivitySummaries`.
