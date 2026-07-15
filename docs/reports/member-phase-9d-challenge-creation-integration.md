# Phase 9D - Challenge Creation & Catalog Integration

Date: 2026-06-12
Scope: Browse Challenges, Create Challenge Wizard, and wellness/catalog integration after Phase 9B. No deployment was run.

## Root Cause Findings

### Browse Challenges Empty State

Root cause:

- `BrowseChallengesScreen` uses `useVisibleChallengesPage()`.
- `challengeService.getVisibleChallengesForUserPage()` queried public challenges using only:
  - `status == active`
  - `visibility == public`
  - `orderBy(startDate desc)`
- Some production/legacy challenge docs and member UI paths still use `groupVisibility == public` as the public-discovery signal.
- When `visibility` is missing, stale, or not yet backfilled, otherwise valid active public challenges are skipped.
- The screen then showed a generic empty state: `No public challenges available right now.`

Phase 9B catalog fields were not the direct cause. The affected fields are challenge discovery fields from earlier discovery hardening:

- `visibility`
- `groupVisibility`
- `status`
- `startDate`

Index behavior:

- Existing index covered `status + visibility + startDate`.
- Phase 9D adds the matching compatibility index for `status + groupVisibility + startDate`.
- If the new index is building, the UI now reports that challenge browsing is warming up instead of showing a false empty state.

### Wellness Activity Loading

Current path:

- `CreateChallengeWizard` uses `useWellnessActivities()`.
- `useWellnessActivities()` now uses `wellnessActivityService.getActivitiesPage()` through Phase 9B service changes.
- Queries require:
  - `isPublished == true`
  - `status == active`
  - `visibility == public`
  - `orderBy(sortName)`
  - optional category/search filters

Finding:

- Query shape is compatible with Phase 9B indexes.
- Existing production wellness activity docs need the Phase 9B catalog backfill before deployment because the dry-run found 60 wellness activity docs missing lifecycle/search fields.
- Empty/error copy in the wizard now points to catalog backfill/index readiness instead of telling members/admins to seed data.

## Files Changed

- `src/services/challengeService.ts`
- `src/features/Challenges/BrowseChallengesScreen.tsx`
- `src/features/Challenges/CreateChallengeWizard.tsx`
- `firestore.indexes.json`
- `docs/reports/member-phase-9d-challenge-creation-integration.md`

## Browse Challenge Fix

Service changes:

- `getVisibleChallengesForUserPage()` now queries public candidates using both:
  - `visibility == public`
  - `groupVisibility == public`
- Results are merged and deduped before sorting/pagination.
- Member-group challenge reads remain bounded by group chunks and status.

UI changes:

- Added distinct states for:
  - permission/access failure
  - missing/building Firestore index
  - generic query failure
  - no active public challenges
  - search has no matches in loaded rows
- Added retry action for query failures.
- Removed the misleading one-size-fits-all empty copy.

Index added:

- `challenges`: `status ASC`, `groupVisibility ASC`, `startDate DESC`

Additional dry-run:

- `firebase deploy --only firestore:indexes --dry-run --project tiizi-challenges`
- Result: PASS, dry run complete.

## Create Challenge UX

Added first-step choice when opening `/app/create-challenge` without a selected template and without `mode=custom`.

Options:

- Start From Template
  - Challenge Templates
  - Wellness Templates
- Build Custom Challenge
  - Continues into the existing Create Challenge Wizard with `mode=custom`

Template routes:

- Challenge Templates route to `/app/challenges/suggested`, preserving `groupId` when present.
- Wellness Templates route to `/app/challenges/wellness`, preserving `groupId` when present.
- Existing template selection continues to route back to `/app/create-challenge?templateId=...` or `?wellnessTemplateId=...`.

Prefill behavior retained:

- title/name
- description
- activities
- challenge type
- duration via start/end dates
- wellness category and activity metadata

Route preservation:

- The wizard now preserves `mode=custom` when returning from the exercise picker, avoiding a bounce back to the first-step chooser.

## Wellness Activity Fix

No schema or service rewrite was required in this phase because Phase 9B already moved wellness activities to bounded indexed catalog reads.

Updated member/admin-facing messages in Create Challenge Wizard:

- Exercise load errors now mention catalog index readiness.
- Empty exercise/wellness states now mention applying the catalog backfill.
- Wellness picker empty state now points to backfill readiness when applicable.

## Deployment Requirements

Recommended order:

1. Deploy Firestore indexes, including the new `groupVisibility` challenge discovery index.
2. Apply Phase 9B catalog backfill:
   - `CONFIRM_PROJECT_ID=tiizi-challenges npm run backfill:catalog-template-fields:apply`
3. Deploy Firestore rules from Phase 9B.
4. Deploy hosting/app code for Phase 9B/9D together.

Do not deploy app/rules before the Phase 9B backfill unless you accept temporary empty catalog/template/wellness lists for normal members.

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
- Build completed in 2.87s.
- Warning only: `vendor-firebase-DX9I8gMV.js` is larger than 500 kB after minification.

Additional index validation:

`firebase deploy --only firestore:indexes --dry-run --project tiizi-challenges`

- Result: PASS
- Output: dry run complete.

## Remaining Risks

- Existing production challenge docs should still be audited/backfilled so `visibility` and `groupVisibility` are consistently set.
- While the new `groupVisibility` index is building after deployment, Browse Challenges can show the new index-building state.
- Create Challenge Wizard still uses bounded first-page catalog results for inline exercise/wellness suggestions. A full infinite picker would be a future UX enhancement, not a Phase 9D blocker.
