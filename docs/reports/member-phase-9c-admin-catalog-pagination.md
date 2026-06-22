# Phase 9C - Admin Catalog Pagination & Metadata Cleanup

Date: 2026-06-12

## Summary

Phase 9C completed the remaining pilot-safe admin catalog/template cleanup after Phase 9B. The target admin catalog screens now use bounded cursor pagination, and the exercise admin UI no longer scans live challenges to compute usage counts.

No deploy was run.

## Files Changed

- `src/services/catalogMetadata.ts`
- `src/services/adminChallengeService.ts`
- `src/services/adminExerciseService.ts`
- `src/services/adminWellnessActivityService.ts`
- `src/hooks/useAdminChallenges.ts`
- `src/hooks/useAdminExercises.ts`
- `src/hooks/useAdminWellnessActivities.ts`
- `src/features/Admin/Challenges/ChallengeTemplatesScreen.tsx`
- `src/features/Admin/Exercises/ExerciseListScreen.tsx`
- `src/features/Admin/Exercises/ExerciseStatsScreen.tsx`
- `src/features/Admin/Exercises/exerciseFormUtils.ts`
- `src/features/Admin/Wellness/WellnessActivityListScreen.tsx`
- `src/features/Admin/Wellness/wellnessActivityFormUtils.ts`

## Full-List Reads Removed

| Area | Old Pattern | New Pattern |
| --- | --- | --- |
| Challenge templates | `getDocs(collection(challengeTemplates))` plus `getDocs(collection(wellnessTemplates))` | Bounded `orderBy(sortName) + limit(pageSize) + startAfter(cursor)` reads per template collection |
| Exercise admin list | `getDocs(collection(catalogExercises))` | Bounded `orderBy(sortName) + limit(pageSize) + startAfter(cursor)` |
| Exercise usage counts | Full `catalogExercises` read plus full `challenges` read | Removed from client; usage marked unavailable until server-owned metric exists |
| Wellness activity admin list | `getDocs(collection(wellnessActivities))` | Bounded `orderBy(sortName) + limit(pageSize) + startAfter(cursor)` |

## UI Behavior

- `ChallengeTemplatesScreen` renders loaded template pages only and exposes `Load more`.
- `ExerciseListScreen` renders loaded exercise pages only and exposes `Load more`.
- `WellnessActivityListScreen` renders loaded wellness activity pages only and exposes `Load more`.
- Search, filters, and counts on these admin screens now clearly apply to loaded rows.
- Exercise usage sorting was removed because usage counts are not pilot-critical and should not be calculated by scanning live challenges.
- Exercise stats now reports total exercises using `getCountFromServer`; challenge usage ranking is marked unavailable.

## Metadata Cleanup

Added shared service-safe defaults in `catalogMetadata.ts` for:

- exercise tier 1 categories
- exercise tier 2 categories
- exercise difficulties
- wellness categories
- wellness difficulties
- wellness activity types
- template categories/statuses

Admin exercise and wellness forms now reuse these constants, and admin create/edit paths write:

- `status`
- `visibility`
- `isPublished`
- `sortName`
- `updatedAt`

Admin exercise create also writes `createdAt`.

## Index Impact

No new Firestore indexes were added in Phase 9C.

The new admin queries use single-field `sortName` ordering on:

- `challengeTemplates`
- `wellnessTemplates`
- `catalogExercises`
- `wellnessActivities`

These should be covered by Firestore single-field indexes. Phase 9B catalog composite indexes remain unchanged.

## Remaining Known Full-List Reads

The Phase 9C target paths were cleaned up.

One remaining full read was observed outside this phase's scope:

- `src/services/adminChallengeService.ts` `getChallengeAnalytics()` still reads `getDocs(collection(db, 'challenges'))` for admin challenge analytics.

Recommendation: move admin challenge analytics to materialized metrics in a separate analytics-focused phase.

## Validation Output

### `npm run test:group-invite-backend`

Passed.

```text
Group invite backend security tests passed
```

### `npx tsc -b`

Passed with no output.

### `npm run build`

Passed.

```text
✓ 1844 modules transformed.
✓ built in 3.17s
```

Build warning:

```text
vendor-firebase-DX9I8gMV.js 528.33 kB
Some chunks are larger than 500 kB after minification.
```

This warning is expected after collapsing Firebase into a single chunk to avoid the previous runtime circular chunk regression.

### `firebase deploy --only firestore:rules --dry-run --project tiizi-challenges`

Passed.

```text
cloud.firestore: rules file firestore.rules compiled successfully
Dry run complete!
```

### `firebase deploy --only firestore:indexes --dry-run --project tiizi-challenges`

Passed.

```text
cloud.firestore: rules file firestore.rules compiled successfully
Dry run complete!
```

## Deployment Notes

Deploy required for app changes:

```bash
npm run build
firebase deploy --only hosting --project tiizi-challenges
```

No rules or index deployment is required for Phase 9C because no `firestore.rules` or `firestore.indexes.json` changes were made in this phase.

## Remaining Risks

- Admin challenge analytics still contains a full challenge collection read and should be handled separately.
- Exercise usage analytics is intentionally unavailable until a server-owned/materialized metric exists.
- Catalog pages rely on Phase 9B backfill fields, especially `sortName`; run/apply the Phase 9B catalog backfill before expecting complete ordered admin pagination in production.
