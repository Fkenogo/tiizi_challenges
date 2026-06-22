# Phase 9A - Catalog / Template Scalability Audit

Date: 2026-06-12
Scope: audit only. No application code, rules, indexes, deployments, or data were changed.

## Current Architecture

Tiizi currently uses several overlapping catalog/template systems:

- `catalogExercises`: reusable fitness exercise catalog, seeded from `catalogExercises_CLEAN.json` by `scripts/seedAppData.ts`.
- `wellnessActivities`: reusable wellness activity catalog, with a local fallback in `src/data/wellnessActivitiesCatalog`.
- `challengeTemplates`: member-facing suggested fitness challenge templates and admin-managed fitness templates.
- `wellnessTemplates`: admin-managed wellness challenge templates.
- Live `challenges`: created from templates, selected exercises, selected wellness activities, or manual activity rows.

Primary member-facing entry points:

- `src/features/Challenges/SuggestedChallengesScreen.tsx`
- `src/features/Challenges/WellnessTemplateGalleryScreen.tsx`
- `src/features/Exercises/ExerciseLibraryScreen.tsx`
- `src/features/Challenges/CreateChallengeWizard.tsx`

Primary services/hooks:

- `src/services/challengeTemplateService.ts`
- `src/services/wellnessTemplateService.ts`
- `src/services/exerciseService.ts`
- `src/services/wellnessActivityService.ts`
- `src/hooks/useChallengeTemplates.ts`
- `src/hooks/useWellnessTemplates.ts`
- `src/hooks/useExercises.ts`
- `src/hooks/useWellnessActivities.ts`

Primary admin management entry points:

- `src/features/Admin/Challenges/ChallengeTemplatesScreen.tsx`
- `src/features/Admin/Challenges/CreateChallengeScreen.tsx`
- `src/features/Admin/Exercises/ExerciseListScreen.tsx`
- `src/features/Admin/Wellness/WellnessActivityListScreen.tsx`

## What Works Well

- Detail reads are direct document reads for templates and catalog items.
- Admin write access for template/catalog collections is restricted by Firestore rules:
  - `challengeTemplates`, `wellnessTemplates`, and `wellnessActivities` writes require `canModerateChallenges()`.
  - `catalogExercises` writes require `canManageExercises()`.
- React Query caching reduces repeated reads during one user session.
- Challenge creation snapshots selected activity data into challenge docs, so live challenges do not depend entirely on mutable catalog records.
- Seed loading for `catalogExercises` is guarded by an empty-collection check.
- Existing schema already has useful fields such as `category`, `difficulty`, `status`, `isPublished`, `templateSource`, `activityCount`, and `version`.

## Critical Issues

No Phase 9A finding is an immediate production outage by itself, but the following becomes critical if the pilot catalog grows beyond a small seed set.

### 1. Member Template Browsing Uses Full Collection Reads

Files:

- `src/services/challengeTemplateService.ts`
- `src/services/wellnessTemplateService.ts`
- `src/features/Challenges/SuggestedChallengesScreen.tsx`
- `src/features/Challenges/WellnessTemplateGalleryScreen.tsx`

Current behavior:

- `getPublishedTemplates()` reads all `challengeTemplates`, then filters and sorts client-side.
- `getTemplates()` reads all `wellnessTemplates`, then filters by source/status/category/difficulty client-side.
- Search and type/category filters are applied in the browser.

Risk:

- Firestore reads grow linearly with total template count.
- Draft, archived, unpublished, or invalid docs are still read by the client before filtering.
- No cursor pagination or server-side ordering exists.

Recommended Phase 9B fix:

- Add indexed paginated queries using `where('isPublished', '==', true)`, `where('status', '==', 'active')`, `where('category', '==', ...)`, `orderBy('sortName')`, and `limit(pageSize)`.
- Add `sortName` and `searchKeywords`/`searchPrefix` backfill fields.
- Keep search bounded to loaded rows or move to a proper search index later.

### 2. Firestore Rules Let Any Authenticated User Read All Template Docs

File: `firestore.rules`

Current rules:

- `challengeTemplates/{templateId}`: `allow read: if isAuthenticated();`
- `wellnessTemplates/{templateId}`: `allow read: if isAuthenticated();`
- `wellnessActivities/{activityId}`: `allow read: if isAuthenticated();`
- `catalogExercises/{exerciseId}`: `allow read: if true;`

Risk:

- Member clients can read draft/archived/unpublished templates if they query directly.
- Template lifecycle is enforced mostly in service code, not rules.
- Public unauthenticated exercise reads may be acceptable for a public catalog, but it should be an explicit policy decision.

Recommended Phase 9B fix:

- Add member-safe read helpers:
  - published/active/public templates readable by members.
  - draft/archived/private templates readable only by admins/content managers.
  - decide whether `catalogExercises` remains public or becomes authenticated-only.

## High Priority Issues

### 1. Exercise Catalog Search and Filter Options Scan the Full Catalog

Files:

- `src/services/exerciseService.ts`
- `src/hooks/useExercises.ts`
- `src/features/Exercises/ExerciseLibraryScreen.tsx`
- `src/features/Challenges/CreateChallengeWizard.tsx`

Current behavior:

- `getExercises()` without filters reads all `catalogExercises`.
- `searchExercises()` calls `getExercises()` and searches client-side.
- `getExerciseStats()` calls `getExercises()` and aggregates client-side.
- `getFilterOptions()` calls `getExercises()` and derives sets client-side.
- `ExerciseLibraryScreen` uses full catalog data for browsing, search suggestions, and filter options.
- `CreateChallengeWizard` loads all exercises to support inline activity suggestions.

Risk:

- Search cost equals full catalog size.
- Filter option reads duplicate data that should be materialized.
- Challenge creation becomes slower as catalog grows.

Recommended Phase 9B fix:

- Add `getExercisesPage({ tier1, tier2, difficulty, cursor, pageSize })`.
- Add `catalogMetadata/exercises` or `catalogFilterOptions/current` for categories, difficulties, and counts.
- Replace full-text browser search with prefix search over a normalized field or defer to Algolia/Meilisearch.
- Keep `getExercisesByIds()` only for small selected-ID snapshots.

### 2. Wellness Activity Catalog Reads Full Collection and Falls Back to Local Static Data

Files:

- `src/services/wellnessActivityService.ts`
- `src/hooks/useWellnessActivities.ts`
- `src/features/Challenges/CreateChallengeWizard.tsx`
- `src/features/Admin/Challenges/CreateChallengeScreen.tsx`

Current behavior:

- `getAllActivities()` reads all `wellnessActivities`.
- Category/search/popular helpers call `getAllActivities()` and filter client-side.
- If the Firestore read fails or is empty, it uses `WELLNESS_ACTIVITIES_CATALOG` local data.

Risk:

- Runtime behavior can differ between seeded Firestore data and bundled local fallback data.
- Large wellness catalogs will be fully downloaded for simple category/search workflows.

Recommended Phase 9B fix:

- Use indexed queries for `status`, `category`, `difficulty`, `popular`, and `sortName`.
- Keep fallback only for development or explicitly mark it as offline demo content.
- Add a backfill to ensure all wellness activities have `status`, `visibility`, `sortName`, and `searchKeywords`.

### 3. Admin Template and Catalog Management Uses Full Scans

Files:

- `src/services/adminChallengeService.ts`
- `src/services/adminExerciseService.ts`
- `src/services/adminWellnessActivityService.ts`
- `src/features/Admin/Challenges/ChallengeTemplatesScreen.tsx`
- `src/features/Admin/Exercises/ExerciseListScreen.tsx`
- `src/features/Admin/Wellness/WellnessActivityListScreen.tsx`

Current behavior:

- Admin challenge template management reads all `challengeTemplates` and all `wellnessTemplates`.
- Admin exercise management reads all `catalogExercises` and all `challenges` to compute usage counts.
- Creating an exercise reads all `catalogExercises` to check slug collisions.
- Admin wellness activity management reads all `wellnessActivities`.
- Admin screens do local filtering, sorting, pagination, export, and stats.

Risk:

- Admin screens can become slow and expensive as content grows.
- Exercise usage counts are not scalable because they scan live challenges.

Recommended Phase 9B fix:

- Use cursor pagination for admin lists.
- Use `getCountFromServer` or materialized admin catalog metrics for counts.
- Use deterministic slug doc reads for ID collision checks rather than reading all IDs.
- Materialize exercise usage counts through challenge create/update/delete functions if usage reporting is needed.

### 4. Missing Template/Catalog Indexes

File: `firestore.indexes.json`

Current state:

- Only one catalog-specific index exists:
  - `catalogExercises`: `tier_1 ASC`, `difficulty ASC`
- No template indexes exist for `challengeTemplates`, `wellnessTemplates`, or `wellnessActivities`.

Risk:

- Phase 9B server-side filters will require composite indexes.
- Current absence of indexes reflects the current full-scan model.

Likely Phase 9B indexes:

- `challengeTemplates`: `isPublished ASC`, `status ASC`, `category ASC`, `sortName ASC`
- `challengeTemplates`: `isPublished ASC`, `status ASC`, `challengeType ASC`, `sortName ASC`
- `wellnessTemplates`: `templateSource ASC`, `isPublished ASC`, `status ASC`, `category ASC`, `sortName ASC`
- `wellnessTemplates`: `templateSource ASC`, `isPublished ASC`, `status ASC`, `category ASC`, `difficulty ASC`, `sortName ASC`
- `catalogExercises`: `status ASC`, `tier_1 ASC`, `name ASC` or `sortName ASC`
- `catalogExercises`: `status ASC`, `tier_1 ASC`, `tier_2 ASC`, `difficulty ASC`, `sortName ASC`
- `wellnessActivities`: `status ASC`, `category ASC`, `difficulty ASC`, `sortName ASC`
- `wellnessActivities`: `status ASC`, `popular ASC`, `sortName ASC`

## Medium Priority Issues

### 1. Catalog Systems Are Duplicated and Inconsistent

Examples:

- `challengeTemplates` and `wellnessTemplates` both represent reusable challenge templates but use different field names.
- Admin `ChallengeTemplate` maps fitness and wellness documents into one UI type.
- Member suggested challenges currently read only fitness templates.
- Wellness templates are surfaced through a separate gallery.

Risk:

- Admin and member behavior can drift.
- Backfill/index work must be duplicated across two schemas.

Recommendation:

- Either unify reusable templates into `challengeTemplates` with `category/type` and migrate wellness templates, or formalize `wellnessTemplates` as a separate collection with equivalent lifecycle/search fields.

### 2. Hardcoded and Seed/Demo Content Still Drives Catalog Experience

Files:

- `scripts/seedAppData.ts`
- `src/features/Exercises/ExerciseLibraryScreen.tsx`
- `src/services/wellnessActivityService.ts`

Examples:

- Seed challenge templates include fixed popularity copy such as `2.4k joined`.
- Exercise cards use alternating hardcoded Unsplash images instead of catalog media fields.
- Wellness activity fallback comes from bundled static data.
- Admin creation screens use hardcoded category/difficulty option sets.

Risk:

- Pilot users may see demo-like popularity or imagery.
- Catalog behavior depends partly on seed state.

Recommendation:

- Mark seed templates clearly or replace demo popularity fields with real aggregate-safe fields.
- Add catalog media fields or use neutral visual fallback.
- Move category/difficulty option lists into metadata docs or shared constants with backfilled validation.

### 3. Member Exercise Library Has a Nonfunctional Filter Icon

File: `src/features/Exercises/ExerciseLibraryScreen.tsx`

Current behavior:

- The `SlidersHorizontal` header button has no `onClick`.

Risk:

- Minor UX confusion.

Recommendation:

- Hide the button until advanced filters exist, or wire it to an implemented filter sheet.

### 4. Template Preview Underrepresents Multi-Activity Templates

File: `src/features/Challenges/SuggestedChallengesScreen.tsx`

Current behavior:

- Preview modal displays only `activities[0]`.

Risk:

- Multi-activity templates can be misunderstood before creation.

Recommendation:

- Show a compact list of all activities or the first few with an activity count.

## Query Inventory

| Area | File/function | Collection | Current pattern | Risk |
|---|---|---:|---|---|
| Suggested challenges | `challengeTemplateService.getPublishedTemplates` | `challengeTemplates` | Full read, client filter/sort | High |
| Wellness template gallery | `wellnessTemplateService.getTemplates` | `wellnessTemplates` | Full read, client filter/sort | High |
| Exercise browsing | `exerciseService.getExercises` | `catalogExercises` | Full read when no filters; filtered query without limit otherwise | High |
| Exercise search | `exerciseService.searchExercises` | `catalogExercises` | Full read, client search | High |
| Exercise stats/options | `getExerciseStats`, `getFilterOptions` | `catalogExercises` | Full read, client aggregate | High |
| Wellness activity browsing | `wellnessActivityService.getAllActivities` | `wellnessActivities` | Full read, local fallback | High |
| Wellness activity search | `wellnessActivityService.searchActivities` | `wellnessActivities` | Full read, client search | High |
| Admin templates | `adminChallengeService.getTemplates` | `challengeTemplates`, `wellnessTemplates` | Full reads, merged client-side | High |
| Admin exercises | `adminExerciseService.getAdminExercises` | `catalogExercises`, `challenges` | Full reads, usage aggregate client-side | High |
| Admin wellness activities | `adminWellnessActivityService.getAdminWellnessActivities` | `wellnessActivities` | Full read, client sort | Medium |
| Seed exercise pool | `scripts/seedAppData.ts getExercisePool` | `catalogExercises` | Bounded `limit(200)` seed-only read | Low |

## Recommended Phase 9B Implementation Plan

1. Define catalog lifecycle and visibility fields.
   - Add or standardize `status`, `visibility`, `isPublished`, `reviewStatus`, `templateSource`, `sortName`, `searchKeywords`, `createdAt`, and `updatedAt`.
   - Decide whether `catalogExercises` is public or authenticated-member-only.

2. Harden Firestore rules for catalog/template visibility.
   - Members should read only active/published/public templates.
   - Admin/content managers retain full read/write.
   - Draft/archived/private content should not rely on client filtering.

3. Add paginated service methods.
   - `getPublishedChallengeTemplatesPage`
   - `getWellnessTemplatesPage`
   - `getExercisesPage`
   - `getWellnessActivitiesPage`
   - Add cursor response shape: `{ items, nextCursor, hasMore }`.

4. Replace full-scan member hooks/screens.
   - Suggested challenge browsing.
   - Wellness template browsing.
   - Exercise library browsing/search.
   - Challenge creation exercise/wellness pickers.

5. Create catalog metadata documents.
   - `catalogMetadata/exercises`
   - `catalogMetadata/wellnessActivities`
   - `catalogMetadata/templates`
   - Use these for filter option lists and counts.

6. Add dry-run/apply backfill tooling.
   - Backfill lifecycle fields and normalized sort/search fields.
   - Report duplicate templates and missing media/status/category fields.
   - Dry-run default; apply only with explicit project confirmation.

7. Add Firestore indexes.
   - Add only the composite indexes required by the final Phase 9B queries.
   - Run `firebase deploy --only firestore:indexes --dry-run --project tiizi-challenges`.

8. Rework admin catalog management.
   - Cursor-paginate admin template, exercise, and wellness activity lists.
   - Move usage counts and stats to materialized metrics if they remain important.

## Exact Files Likely Needing Changes In Phase 9B

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
- `src/hooks/useAdminChallenges.ts`
- `src/hooks/useAdminExercises.ts`
- `src/hooks/useAdminWellnessActivities.ts`
- `src/features/Challenges/SuggestedChallengesScreen.tsx`
- `src/features/Challenges/WellnessTemplateGalleryScreen.tsx`
- `src/features/Exercises/ExerciseLibraryScreen.tsx`
- `src/features/Challenges/CreateChallengeWizard.tsx`
- `src/features/Admin/Challenges/ChallengeTemplatesScreen.tsx`
- `src/features/Admin/Challenges/CreateChallengeScreen.tsx`
- `src/features/Admin/Exercises/ExerciseListScreen.tsx`
- `src/features/Admin/Wellness/WellnessActivityListScreen.tsx`
- `firestore.rules`
- `firestore.indexes.json`
- `scripts/seedAppData.ts`
- New script: `scripts/backfillCatalogTemplateFields.ts`

## Pilot Readiness Recommendation

Phase 9B should be completed before pilot if Tiizi expects admins to add a meaningful template/exercise/wellness catalog before or during pilot.

If pilot catalog size remains close to the current seed size, these issues are not immediate launch blockers, but they are visible architectural debt. The highest-value pre-pilot fixes are:

1. Harden member reads so draft/archived/unpublished templates are not readable by normal users.
2. Add server-side pagination for member template galleries.
3. Replace exercise/wellness search full scans in challenge creation with bounded picker queries.
4. Backfill normalized `status`, `visibility`, and `sortName` fields.

## Validation Commands

Requested validation:

```bash
npx tsc -b
npm run build
```

Recommended Phase 9B validation after implementation:

```bash
npx tsc -b
npm run build
firebase deploy --only firestore:rules --dry-run --project tiizi-challenges
firebase deploy --only firestore:indexes --dry-run --project tiizi-challenges
npm run backfill:catalog-template-fields
```

## Validation Output

`npx tsc -b`

- Result: PASS
- Output: no TypeScript errors.

`npm run build`

- Result: PASS
- Output summary:
  - `tsc -b && vite build`
  - Vite transformed 1842 modules.
  - Build completed successfully in 3.19s.
  - Generated a single Firebase bundle: `dist/assets/vendor-firebase-DX9I8gMV.js`.
  - Warning: `vendor-firebase-DX9I8gMV.js` is larger than 500 kB after minification. This is a size warning only; no circular Firebase chunk warning was reported.
