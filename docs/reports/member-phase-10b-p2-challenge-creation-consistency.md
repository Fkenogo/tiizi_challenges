# Phase 10B-P2 - Challenge Creation Consistency

Date: 2026-06-14

## Status

PASS. The challenge creation flow now succeeds only when both the challenge document and creator `challengeMembers/{challengeId}_{uid}` document are created together.

No production deploy was run.

## Root Cause

`src/services/challengeService.ts` created the `challenges/{challengeId}` document first, then attempted creator auto-join through `joinChallenge()`.

That second step was a separate write path and failures were swallowed with:

`Challenge created but auto-join failed`

This allowed the UI to show a successful launch even when the creator was not actually joined to the challenge, which could later break logging/progress.

## Fix Implemented

Added a Firebase callable function:

`createChallengeWithCreatorMembership`

The callable validates:

- signed-in creator
- `createdBy` matches caller uid
- group exists
- group is active
- creator is active/joined group member, or is the group owner
- `groups.allowMemberChallenges`
- challenge field bounds and defaults

It writes in one Admin SDK transaction:

- `challenges/{challengeId}`
- `challengeMembers/{challengeId}_{creatorUid}`
- missing owner `groupMembers/{groupId}_{uid}` only when the caller is the group owner

It does not write derived counters:

- `groups.activeChallenges`
- `challenges.participantCount`

Existing server-owned counter triggers remain responsible for those fields.

## Files Changed

- `functions/src/challengeCreationBackend.ts`
- `functions/src/index.ts`
- `src/services/challengeService.ts`
- `src/hooks/useChallenges.ts`
- `src/features/Challenges/CreateChallengeWizard.tsx`
- `scripts/testChallengeCreationBackend.ts`
- `package.json`

## UI Behavior

Before:

- Challenge could be created.
- Auto-join could fail.
- UI still showed success and navigated to the challenge.

After:

- UI calls the callable once.
- No optimistic challenge is inserted into React Query cache.
- Success is shown only after the callable confirms challenge plus creator membership.
- Failures show friendly messages such as:
  - `Join this group before creating a challenge.`
  - `Only the group owner can create challenges in this group.`
  - `Check the challenge details and try again.`

## Rules / Functions / Indexes Impact

Firestore rules changed: No.

Functions changed: Yes. New callable export:

`createChallengeWithCreatorMembership`

Indexes changed: No.

Hosting changed: Yes. The client now calls the new callable, so the updated frontend must be deployed after the function exists.

## Regression Test Added

`npm run test:challenge-creation-backend`

Coverage:

- active group member creates challenge and creator membership atomically
- non-member creation fails without writing challenge or membership
- member-created challenges respect `allowMemberChallenges`
- group owner without membership gets owner membership plus challenge membership atomically
- challenge payload does not write server-owned `participantCount`

## Validation Output

`npm run test:challenge-creation-backend`

```text
challenge creation backend tests passed
```

`npm run test:group-invite-backend`

```text
Group invite backend security tests passed
```

`npx tsc -b --pretty false`

```text
passed with no output
```

`npm run build`

```text
✓ 1844 modules transformed.
✓ built in 2.94s
```

Build warning retained from existing bundle size:

```text
Some chunks are larger than 500 kB after minification.
```

`npm --prefix functions run build`

```text
passed with no output
```

`npm --prefix functions run lint`

```text
passed with no output
```

`firebase deploy --only firestore:rules --dry-run --project tiizi-challenges`

```text
cloud.firestore: rules file firestore.rules compiled successfully
Dry run complete
```

## Deployment Required

Required before testing this in production:

```bash
firebase deploy --only functions:createChallengeWithCreatorMembership --project tiizi-challenges
npm run build
firebase deploy --only hosting --project tiizi-challenges
```

Firestore rules deployment is not required for this phase.

## Remaining Risk

The callable creates the creator `challengeMembers` record even for donation-enabled draft challenges. Logging remains blocked until the challenge becomes active by existing activity rules. If product wants draft donation challenges to exclude the creator from participant counts until approval, the counter trigger should later be refined to consider challenge status.
