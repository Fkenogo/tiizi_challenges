# Phase 7H - Invite Migration & Legacy Invite Removal Implementation

Date: 2026-06-12

## Summary

Implemented the Phase 7H cutover code changes without running migration apply and without deploying.

The member app no longer joins groups by querying `groups.inviteCode`. New groups no longer create legacy invite codes. Firestore client group create/update rules no longer allow `inviteCode`. The migration script now plans deterministic `groupInvites/legacy_{groupId}` records and skips already migrated records.

## Files Changed

- `scripts/migrateInviteCodes.ts`
- `scripts/testGroupInviteBackend.ts`
- `scripts/seedAppData.ts`
- `src/features/Groups/GroupsScreen.tsx`
- `src/hooks/useGroups.ts`
- `src/services/groupService.ts`
- `firestore.rules`
- `docs/reports/member-phase-7h-invite-migration-implementation.md`

## Legacy Paths Removed or Rerouted

### Removed

- `groupService.createGroup()` no longer generates or writes `groups.inviteCode`.
- `groupService.joinGroupByInviteCode()` was removed.
- `useJoinGroup()` no longer accepts or routes invite-code joins.
- `GroupsScreen` no longer calls `joinGroup.mutateAsync({ inviteCode })`.
- Firestore `groupClientCreateFields()` no longer includes `inviteCode`.
- Firestore `groupOwnerEditableFields()` no longer includes `inviteCode`.
- `isValidGroupCreate()` no longer requires `request.resource.data.inviteCode`.

### Rerouted

- The `GroupsScreen` invite tab now calls `useRedeemGroupInvite()`.
- Invite redemption now uses the callable `redeemGroupInvite()` via `groupInviteService`.
- User-facing invite errors are normalized through `getGroupInviteErrorMessage()`.

## Migration Script Idempotency

`scripts/migrateInviteCodes.ts` now:

- uses deterministic document IDs: `groupInvites/legacy_{groupId}`
- reads existing `groupInvites`
- skips records where the deterministic ID already exists for the same legacy mapping
- skips records where `groupId + migratedFrom == "groups.inviteCode"` already exists with the same token hash
- skips records where the same token hash already exists for the same legacy mapping
- reports collisions for deterministic ID, group mapping, or token hash mismatches
- refuses apply when collisions exist
- preserves original `groups.inviteCode` fields

## Idempotency Proof

`npm run test:group-invite-backend` now covers:

- first migration plan detects missing legacy mappings
- proposed records use deterministic `legacy_{groupId}` document IDs
- a second plan with existing migrated records creates no duplicates
- token hash collisions are reported instead of written
- legacy client join path is no longer present in `groupService`, `useGroups`, or `GroupsScreen`
- Firestore client group rules no longer allow `'inviteCode'`

Result:

```text
Group invite backend security tests passed
```

## Migration Dry-Run Output

Local dry-run could not complete because Admin SDK credentials are intentionally required and missing in this shell.

Command:

```bash
npm run migrate:invite-codes
```

Escalated output after bypassing the local `tsx` IPC sandbox limitation:

```text
> tiizi@0.0.0 migrate:invite-codes
> tsx scripts/migrateInviteCodes.ts --dry-run

Invite code migration failed: Error: Missing required env var: GOOGLE_APPLICATION_CREDENTIALS
```

This is the expected safe failure mode until local Admin SDK credentials are exported.

## Readiness Audit Output

Command:

```bash
npm run audit:invite-migration-readiness
```

Escalated output:

```text
Invite migration readiness audit failed: Error: Missing required env var: GOOGLE_APPLICATION_CREDENTIALS
```

## Required Local Credential Setup

Use:

```bash
export GOOGLE_APPLICATION_CREDENTIALS="/Users/theo/secure-keys/tiizi-challenges-firebase-adminsdk-fbsvc-0887feecee.json"
export FIREBASE_PROJECT_ID=tiizi-challenges
```

Then rerun:

```bash
npm run audit:invite-migration-readiness
npm run migrate:invite-codes
```

## Remaining Legacy InviteCode Fields in Production

No migration apply was run, and legacy group fields are intentionally preserved in this phase.

From `docs/reports/member-phase-7h-cutover-readiness.md`, production still had 7 `groups.inviteCode` fields:

- `seed_group_early_birds` - `EARLY-BIRDS`
- `seed_group_hydration_crew` - `HYDRATE-NOW`
- `seed_group_squad_254` - `SQUAD-254`
- `seed_group_strength_club` - `STRONG-CLUB`
- `seed_group_trail_seekers` - `TRAIL-TEAM`
- `seed_group_zen_yoga` - `ZEN-YOGA`
- `zGO3H0GUZyKwQhbLuNyQ` - `FIT-50S-4O35`

Expected migrated IDs:

- `legacy_seed_group_early_birds`
- `legacy_seed_group_hydration_crew`
- `legacy_seed_group_squad_254`
- `legacy_seed_group_strength_club`
- `legacy_seed_group_trail_seekers`
- `legacy_seed_group_zen_yoga`
- `legacy_zGO3H0GUZyKwQhbLuNyQ`

## Seed Data

`scripts/seedAppData.ts` still contains legacy invite codes, but they are now explicitly marked as legacy migration test data for verifying `groups.inviteCode -> groupInvites` cutover behavior.

## Validation Results

```text
npm run test:group-invite-backend
PASS - Group invite backend security tests passed
```

```text
npx tsc -b
PASS
```

```text
npm run build
PASS - Vite production build completed
```

```text
npm --prefix functions run build
PASS
```

```text
npm --prefix functions run lint
PASS
```

```text
firebase deploy --only firestore:rules --dry-run --project tiizi-challenges
PASS - rules compiled successfully, dry run complete
```

```text
firebase deploy --only firestore:indexes --dry-run --project tiizi-challenges
PASS - dry run complete
```

## Deploy Commands

After review:

```bash
firebase deploy --only firestore:rules --project tiizi-challenges
npm run build
firebase deploy --only hosting --project tiizi-challenges
```

If the invite callables are not already deployed in the target environment:

```bash
firebase deploy --only functions:createGroupInvite,functions:listGroupInvites,functions:revokeGroupInvite,functions:redeemGroupInvite,functions:requestGroupJoin,functions:approveGroupJoinRequest,functions:rejectGroupJoinRequest --project tiizi-challenges
```

## Migration Apply Command

Do not run until rules/hosting/functions are reviewed and ready:

```bash
export GOOGLE_APPLICATION_CREDENTIALS="/Users/theo/secure-keys/tiizi-challenges-firebase-adminsdk-fbsvc-0887feecee.json"
export FIREBASE_PROJECT_ID=tiizi-challenges
export CONFIRM_PROJECT_ID=tiizi-challenges
npm run migrate:invite-codes:apply
```

## Rollback Notes

The migration preserves `groups.inviteCode`, so rollback is straightforward:

1. Query `groupInvites` where `migratedFrom == "groups.inviteCode"`.
2. Export those docs for audit history.
3. Delete only migrated invite docs if rollback is required.
4. Legacy group fields remain available until the later database cleanup phase.

Because the member app has been rerouted to callable redemption, application rollback would require reverting hosting to the previous release if migrated invite docs are removed.

## Remaining Risks

- Local migration dry-run still needs Admin SDK credentials before production apply.
- Existing `groups.inviteCode` fields remain in production by design until the cleanup phase.
- `JoinGroupScreen` still uses the user-facing term "Invite Code", but it redeems through the secure callable path and does not query `groups.inviteCode`.

## Recommendation

Code cutover is ready for review. Do not apply migration until credentials are configured and `npm run migrate:invite-codes` produces the expected deterministic 7-record dry-run plan.
