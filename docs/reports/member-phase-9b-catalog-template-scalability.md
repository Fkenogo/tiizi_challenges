# Phase 9B - Catalog / Template Scalability Implementation

Date: 2026-06-12
Scope: implementation only. No deploy was run. No apply backfill was run.

## Files Changed

- `src/services/catalogPagination.ts`
- `src/services/challengeTemplateService.ts`
- `src/services/wellnessTemplateService.ts`
- `src/services/exerciseService.ts`
- `src/services/wellnessActivityService.ts`
- `src/services/adminChallengeService.ts`
- `src/services/adminExerciseService.ts`
- `src/services/adminWellnessActivityService.ts`
- `src/hooks/useChallengeTemplates.ts`
- `src/hooks/useWellnessTemplates.ts`
- `src/hooks/useExercises.ts`
- `src/hooks/useWellnessActivities.ts`
- `src/features/Challenges/SuggestedChallengesScreen.tsx`
- `src/features/Challenges/WellnessTemplateGalleryScreen.tsx`
- `src/features/Exercises/ExerciseLibraryScreen.tsx`
- `firestore.rules`
- `firestore.indexes.json`
- `scripts/backfillCatalogTemplateFields.ts`
- `scripts/seedAppData.ts`
- `package.json`

## Key Decisions

- `catalogExercises` is now treated as authenticated catalog content, not public unauthenticated content. No current member landing page requires public exercise catalog reads.
- Member-readable catalog/template docs must be:
  - `status == "active"`
  - `visibility == "public"`
  - `isPublished == true`
- Admin/moderator/content roles retain read/write access for draft, private, archived, and unpublished catalog/template content.
- Member search is now bounded prefix search using normalized `sortName`. Full fuzzy search is deferred until a proper search backend exists.
- Existing array-returning hooks remain for compatibility, but now return bounded first-page data instead of full collection scans.
- Admin list pagination remains a follow-up for large content operations. This phase removed obvious admin create-path slug scans and normalized newly created admin records.

## New Query Model

All main member catalog/template reads now return cursor pages:

```ts
{
  items,
  nextCursor,
  hasMore
}
```

Implemented page methods:

- `challengeTemplateService.getPublishedTemplatesPage()`
- `wellnessTemplateService.getTemplatesPage()`
- `exerciseService.getExercisesPage()`
- `wellnessActivityService.getActivitiesPage()`

Member screens updated:

- Suggested challenge templates: cursor pages with `Load more`.
- Wellness template gallery: cursor pages with `Load more`.
- Exercise library: cursor pages with `Load more`.
- Exercise Library no longer loads all challenges/groups just to validate route context.
- Exercise Library filter icon was hidden because it had no implementation.
- Suggested challenge template preview now shows multiple activities instead of only `activities[0]`.

## Rules Changed

Added catalog read helpers:

- `isPublishedPublicCatalogContent(data)`
- `canReadCatalogContent(data)`
- `canReadChallengeTemplate(data)`
- `canReadWellnessCatalogContent(data)`

Updated collection rules:

- `catalogExercises/{exerciseId}`
  - read: admin/content roles or authenticated users reading active/public/published docs
  - write: `canManageExercises()`
- `challengeTemplates/{templateId}`
  - read: challenge moderators/content roles or active/public/published docs
  - write: `canModerateChallenges()`
- `wellnessTemplates/{templateId}`
  - read: challenge moderators/content roles or active/public/published docs
  - write: `canModerateChallenges()`
- `wellnessActivities/{activityId}`
  - read: challenge moderators/content roles or active/public/published docs
  - write: `canModerateChallenges()`

## Indexes Added

Added final-query indexes for:

- `catalogExercises`
  - published/status/visibility/sortName
  - published/status/visibility/tier_1/sortName
  - published/status/visibility/tier_1/tier_2/difficulty/sortName
- `challengeTemplates`
  - category/isPublished/status/visibility/sortName
- `wellnessTemplates`
  - templateSource/isPublished/status/visibility/sortName
  - templateSource/isPublished/status/visibility/category/sortName
  - templateSource/isPublished/status/visibility/category/difficulty/sortName
- `wellnessActivities`
  - isPublished/status/visibility/sortName
  - isPublished/status/visibility/category/sortName
  - isPublished/status/visibility/category/difficulty/sortName
  - isPublished/status/visibility/popular/sortName

Index JSON sanity check:

- Parsed successfully.
- Composite index count: 56.
- Duplicate composite definitions: 0.

## Backfill

Created:

- `scripts/backfillCatalogTemplateFields.ts`

NPM commands:

```bash
npm run backfill:catalog-template-fields
CONFIRM_PROJECT_ID=tiizi-challenges npm run backfill:catalog-template-fields:apply
```

Safety:

- Dry-run by default.
- Apply mode refuses to write to `tiizi-challenges` unless `CONFIRM_PROJECT_ID=tiizi-challenges`.
- Reports scanned docs, missing lifecycle/search fields, duplicate sort names, planned writes, applied writes, and warnings.
- Does not delete records.

Dry-run summary against `tiizi-challenges`:

- `challengeTemplates`: scanned 5, writes planned 5, writes applied 0.
- `wellnessTemplates`: scanned 8, writes planned 8, writes applied 0.
- `catalogExercises`: scanned 113, writes planned 113, writes applied 0.
- `wellnessActivities`: scanned 60, writes planned 60, writes applied 0.
- Duplicate sort names: none.
- Missing category/difficulty warnings: none.

Important deploy order:

1. Deploy indexes.
2. Run apply backfill.
3. Deploy rules and hosting/app code.

If rules/app code deploy before apply backfill, normal member reads may return empty catalog/template lists because existing production docs are missing `visibility`, `status`, `isPublished`, and/or `sortName`.

## Validation Output

`npm run test:group-invite-backend`

- Result: PASS
- Output: `Group invite backend security tests passed`

`npx tsc -b --pretty false`

- Result: PASS
- Output: no TypeScript errors.

`npm run build`

- Result: PASS
- Vite transformed 1843 modules.
- Build completed in 2.74s.
- Warning only: `vendor-firebase-DX9I8gMV.js` is larger than 500 kB after minification.

`firebase deploy --only firestore:rules --dry-run --project tiizi-challenges`

- Result: PASS
- Output: `firestore.rules compiled successfully`
- Dry run complete.

`firebase deploy --only firestore:indexes --dry-run --project tiizi-challenges`

- Result: PASS
- Output: `firestore.rules compiled successfully`
- Dry run complete.

`npm run backfill:catalog-template-fields`

- Initial sandbox run failed because `tsx` could not create its IPC pipe under the sandbox:
  - `listen EPERM ... /tsx-501/...pipe`
- Re-run with the same command outside the sandbox completed successfully.
- Result: PASS dry-run.
- Writes applied: 0.

## Remaining Risks

- Admin catalog/template list screens still use full-list reads for management tables. This is not member-facing pilot-critical, but should be paginated before large content operations.
- Exercise stats now avoid full collection aggregation and return safe defaults unless a future materialized catalog metadata document is added.
- Search is prefix-only on `sortName`; fuzzy search across muscles/equipment/tags should use a search service later.
- Existing production docs must be backfilled before member-safe rules and bounded queries are deployed.
- The local wellness fallback catalog remains for read failures, but production should rely on Firestore-backed active/public/published docs after backfill.

## Commands Needed Later

Do not run until ready for deployment/cutover:

```bash
firebase deploy --only firestore:indexes --project tiizi-challenges
CONFIRM_PROJECT_ID=tiizi-challenges npm run backfill:catalog-template-fields:apply
firebase deploy --only firestore:rules --project tiizi-challenges
npm run build
firebase deploy --only hosting --project tiizi-challenges
```
