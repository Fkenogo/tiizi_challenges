# Phase 7H - Invite Migration Cutover Readiness

Date: 2026-06-12

## Summary

This is an audit-only cutover readiness report for migrating from legacy `groups.inviteCode` to `groupInvites`.

No migration apply was run.
No deployment was run.
No legacy code was removed in this phase because the request explicitly ended with audit-only constraints.

Recommendation: **NO-GO for production cutover today**.

Reasons:

1. The required local Admin SDK scripts cannot run in this shell because `GOOGLE_APPLICATION_CREDENTIALS` is missing.
2. The migration apply script is not idempotent; rerunning apply would create duplicate `groupInvites`.
3. Live member-facing legacy invite paths still exist in `GroupsScreen`, `useGroups`, and `groupService`.
4. Firestore group rules still allow and validate client-controlled `inviteCode` fields on groups.

## Part 1 - Production Readiness Audit

Command requested:

```bash
npm run audit:invite-migration-readiness
```

First sandboxed run failed before script logic:

```text
Error: listen EPERM: operation not permitted ... /tsx-501/...pipe
```

Escalated rerun reached script logic and failed with:

```text
Invite migration readiness audit failed: Error: Missing required env var: GOOGLE_APPLICATION_CREDENTIALS
```

Because the local Admin SDK credential is missing, the script did not produce its JSON readiness output.

### Read-Only Connector Inspection

Used the Firebase connector in read-only mode to inspect production Firestore.

Production project:

```text
tiizi-challenges
```

`groups` documents inspected: 7

Groups with legacy `inviteCode`: 7

Private groups with legacy `inviteCode`: 2

- `seed_group_trail_seekers` - `TRAIL-TEAM`
- `seed_group_zen_yoga` - `ZEN-YOGA`

Public groups with legacy `inviteCode`: 5

- `seed_group_early_birds` - `EARLY-BIRDS`
- `seed_group_hydration_crew` - `HYDRATE-NOW`
- `seed_group_squad_254` - `SQUAD-254`
- `seed_group_strength_club` - `STRONG-CLUB`
- `zGO3H0GUZyKwQhbLuNyQ` - `FIT-50S-4O35`

`groupInvites` documents inspected: 0

Missing mappings: 7

Orphaned invite records: 0

## Part 2 - Migration Dry Run

Command requested:

```bash
npm run migrate:invite-codes
```

Actual output:

```text
> tiizi@0.0.0 migrate:invite-codes
> tsx scripts/migrateInviteCodes.ts --dry-run

Invite code migration failed: Error: Missing required env var: GOOGLE_APPLICATION_CREDENTIALS
```

The dry-run did not complete locally because the Admin SDK credential is missing.

### Expected Dry-Run Plan From Production Data

Based on read-only production data, the dry-run should plan 7 invite records:

| Group | Visibility | Legacy Code | Expected Invite Type |
| --- | --- | --- | --- |
| Early Birds Kenya | public | `EARLY-BIRDS` | `multi_use` |
| Hydration Crew | public | `HYDRATE-NOW` | `multi_use` |
| Squad 254 | public | `SQUAD-254` | `multi_use` |
| Strength Club | public | `STRONG-CLUB` | `multi_use` |
| Trail Seekers | private | `TRAIL-TEAM` | `multi_use` |
| Zen Yoga Community | private | `ZEN-YOGA` | `multi_use` |
| Fit 50s | public | `FIT-50S-4O35` | `multi_use` |

Expected shared fields from `scripts/migrateInviteCodes.ts`:

- `status: active`
- `type: multi_use`
- `maxUses: 10000`
- `useCount: 0`
- `tokenHash: sha256(groups.inviteCode)`
- `migratedFrom: groups.inviteCode`
- `createdBy: migration`
- original `groups.inviteCode` preserved
- expiry set to 90 days from migration run time

No duplicate legacy codes were observed in the 7 production group records.

No existing `groupInvites` records were observed, so there are currently no production mapping collisions.

## Part 3 - Migration Apply Safety Review

Reviewed:

- `scripts/migrateInviteCodes.ts`
- `scripts/auditInviteMigrationReadiness.ts`
- `scripts/testGroupInviteBackend.ts`

### Safety Controls Present

The migration script:

- defaults to dry-run through `npm run migrate:invite-codes`
- requires `--apply` for writes
- refuses production apply unless `CONFIRM_PROJECT_ID=tiizi-challenges`
- preserves original `groups.inviteCode`
- writes only to `groupInvites`
- does not delete or modify group documents
- batches writes in chunks of 450

### Safety Gaps

The migration script is **not idempotent**.

Current apply behavior:

```ts
const ref = db.collection('groupInvites').doc();
batch.set(ref, { ... });
```

Each apply run creates new random invite document IDs. The script does not:

- query existing `groupInvites` by `groupId`
- query existing `groupInvites` by `tokenHash`
- skip groups already migrated
- write deterministic IDs
- enforce one migrated invite per legacy group

Safe rerun behavior is therefore not guaranteed. A repeated production apply could create duplicate active invite records for the same legacy code.

### Rollback Strategy

Rollback is possible because migration-created docs include:

```text
migratedFrom: groups.inviteCode
migratedAt: server timestamp
createdBy: migration
```

Rollback procedure:

1. Query `groupInvites` where `migratedFrom == "groups.inviteCode"`.
2. Export those docs before deleting.
3. Delete only those migrated invite docs.
4. Preserve `groups.inviteCode`; the script intentionally does not remove it.

However, rollback should not be the substitute for idempotency. Apply should be made safe before production cutover.

## Part 4 - Legacy Dependency Audit

Search target:

```text
inviteCode
```

### Member-Facing Runtime References

`src/features/Groups/GroupsScreen.tsx`

- Still renders an `Invites` tab using `inviteCode` state.
- Still calls `joinGroup.mutateAsync({ inviteCode })`.
- This is still a legacy direct invite-code join path.

`src/hooks/useGroups.ts`

- `useJoinGroup()` still accepts `{ inviteCode }`.
- Still routes invite-code joins to `groupService.joinGroupByInviteCode()`.

`src/services/groupService.ts`

- `createGroup()` still generates `inviteCode`.
- `joinGroupByInviteCode()` still queries:

```ts
query(collection(db, 'groups'), where('inviteCode', '==', normalized), limit(1))
```

This is incompatible with the final cutover goal because new redemption should use `groupInvites.tokenHash` through callable `redeemGroupInvite`.

### Firestore Rules References

`firestore.rules`

- `groupClientCreateFields()` still includes `inviteCode`.
- `groupOwnerEditableFields()` still includes `inviteCode`.
- `isValidGroupCreate()` still requires `inviteCode is string`.

This means clients can still create and update legacy invite codes on group documents.

### Type References

`src/types/index.ts`

- `Group.inviteCode?: string`

This may remain temporarily for reading legacy records during migration, but should be removed or marked legacy after final cleanup.

### Seed/Test/Tooling References

These are expected until migration is complete:

- `scripts/migrateInviteCodes.ts`
- `scripts/auditInviteMigrationReadiness.ts`
- `scripts/auditGroupInviteCodes.ts`
- `scripts/testGroupInviteBackend.ts`
- `scripts/seedAppData.ts`

Seed data still creates legacy invite codes. After cutover, seed scripts should either create `groupInvites` records or explicitly label `inviteCode` as legacy-only test data.

## Part 5 - Production Cutover Plan

### 1. Backup

Before any apply:

1. Export Firestore or at minimum export:
   - `groups`
   - `groupInvites`
   - `groupJoinRequests`
   - `groupAuditLogs`
   - `groupMembers`
2. Save a JSON copy of all groups with non-empty `inviteCode`.
3. Save a JSON copy of all existing `groupInvites`.

### 2. Fix Migration Idempotency

Before production apply, update `scripts/migrateInviteCodes.ts` to prevent duplicates:

Recommended approach:

- Use deterministic document ID:

```text
legacy_{groupId}
```

or

- Query existing invites where:

```text
groupId == groupId
migratedFrom == "groups.inviteCode"
```

and skip existing mappings.

Also check `tokenHash` collisions before apply.

### 3. Dry Run

Run:

```bash
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
FIREBASE_PROJECT_ID=tiizi-challenges \
npm run audit:invite-migration-readiness
```

Then:

```bash
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
FIREBASE_PROJECT_ID=tiizi-challenges \
npm run migrate:invite-codes
```

Verify:

- `writesPlanned == missingMappings`
- no unexpected public/private counts
- no duplicate `tokenHash`
- no duplicate `groupId` mappings

### 4. Migration Apply

Only after dry-run is correct:

```bash
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
FIREBASE_PROJECT_ID=tiizi-challenges \
CONFIRM_PROJECT_ID=tiizi-challenges \
npm run migrate:invite-codes:apply
```

### 5. Post-Apply Validation

Run:

```bash
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
FIREBASE_PROJECT_ID=tiizi-challenges \
npm run audit:invite-migration-readiness
```

Expected:

- `legacyInviteCodes == 7` until legacy fields are removed
- `migratedInviteRecords >= 7`
- `missingMappings == []`
- `orphanedInviteRecords == []`

### 6. Legacy Removal

After migrated invites are validated:

1. Remove legacy invite UI from `GroupsScreen` or route it to `redeemGroupInvite`.
2. Remove `inviteCode` branch from `useJoinGroup`.
3. Remove `joinGroupByInviteCode()` from `groupService`.
4. Stop generating `inviteCode` in `createGroup()`.
5. Remove `inviteCode` from group client create/update rules.
6. Update seed scripts to create `groupInvites` through server tooling or mark legacy fields as test-only.
7. Deploy hosting and Firestore rules after validation.

### 7. Monitoring

Monitor after deployment:

- callable errors for `redeemGroupInvite`
- callable errors for `createGroupInvite`
- callable errors for `requestGroupJoin`
- Firestore permission errors on `groupInvites` and `groupJoinRequests`
- support reports for invalid invite codes

## Part 6 - Post-Migration Validation Checklist

Manual verification after apply and deploy:

- Owner creates one-time invite.
- Owner creates multi-use invite.
- Invite code is shown only once.
- Invite list does not show `tokenHash`.
- One-time invite redemption succeeds once.
- Second one-time invite redemption fails.
- Multi-use invite increments `useCount`.
- Exhausted invite fails.
- Revoked invite fails.
- Expired invite fails.
- Private group invite redemption creates active membership.
- Approval-required join request creates `groupJoinRequests/{groupId_uid}`.
- Owner/moderator approves request.
- Owner/moderator rejects request.
- Non-owner cannot create invite.
- Non-moderator cannot revoke invite.
- Non-moderator cannot approve/reject requests.
- `groupAuditLogs` records:
  - `invite_created`
  - `invite_revoked`
  - `invite_redeemed`
  - `join_requested`
  - `join_approved`
  - `join_rejected`
- Invite analytics show active / expired / revoked / total uses correctly.

## Supporting Validation

Command:

```bash
npm run test:group-invite-backend
```

Result:

```text
Group invite backend security tests passed
```

This confirms the backend helper tests still pass, but it does not replace the blocked production migration dry run.

## Go / No-Go Recommendation

Recommendation: **NO-GO** for production cutover.

Blockers to resolve first:

1. Provide `GOOGLE_APPLICATION_CREDENTIALS` and rerun both required scripts successfully.
2. Make `scripts/migrateInviteCodes.ts` idempotent.
3. Remove or reroute live member-facing legacy invite joins.
4. Harden Firestore rules so clients no longer create/update `groups.inviteCode`.
5. Re-run readiness audit and dry-run after those changes.

Once those blockers are resolved, cutover can proceed with the backup, apply, validation, deploy, and monitoring sequence above.

