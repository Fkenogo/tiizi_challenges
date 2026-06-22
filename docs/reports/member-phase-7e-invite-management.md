# Member Phase 7E: Invite Management Layer

Date: 2026-06-11
Scope: invite management service, sanitized invite listing, analytics helpers, and migration tooling.
Deployment: not deployed.
UI changes: none.
Migration apply: not run.

## Files Changed

- `functions/src/groupInviteBackend.ts`
- `functions/src/index.ts`
- `src/services/groupInviteService.ts`
- `src/services/groupInviteUtils.ts`
- `scripts/testGroupInviteBackend.ts`
- `scripts/migrateInviteCodes.ts`
- `package.json`
- `firestore.indexes.json`
- `docs/reports/member-phase-7e-invite-management.md`

`firestore.rules` was validated but not intentionally changed in Phase 7E beyond existing Phase 7D rules already present in the working tree.

## Services Added

### `src/services/groupInviteService.ts`

Added service wrappers:

- `createGroupInvite(input)`
- `revokeGroupInvite(inviteId)`
- `listGroupInvites(groupId)`
- `getInviteAnalytics(groupId)`

The service uses Firebase callable functions in `us-central1`.

Important behavior:

- `createGroupInvite()` returns the raw token only immediately after creation.
- `listGroupInvites()` uses the new sanitized callable response.
- Listed invites include:
  - `status`
  - `type`
  - `maxUses`
  - `useCount`
  - `createdAt`
  - `expiresAt`
  - `revokedAt`
  - `lastUsedAt`
  - `note`
- Listed invites never expose `tokenHash`.

### `src/services/groupInviteUtils.ts`

Added pure helpers:

- `normalizeCreateGroupInviteInput()`
- `calculateGroupInviteAnalytics()`

Validation:

- `one_time` invites force `maxUses = 1`
- `multi_use` invites require `maxUses > 0`
- expiration must be a future date
- optional note is trimmed and capped at 500 characters

## Callable Functions Updated

Extended `functions/src/groupInviteBackend.ts`:

- `createGroupInviteCore()` now supports optional `note`
- added `listGroupInvitesCore()`
- added `listGroupInvitesCallable()`
- invite list output is sanitized and excludes `tokenHash`

Exported in `functions/src/index.ts`:

- `listGroupInvites`

Existing callable functions remain:

- `createGroupInvite`
- `revokeGroupInvite`
- `requestGroupJoin`
- `approveGroupJoinRequest`
- `rejectGroupJoinRequest`

## Invite Creation Options

Supported:

- `one_time`
- `multi_use`
- future expiration date
- max uses
- optional note

Rules enforced in service and callable core:

- `maxUses` must be positive for `multi_use`
- `one_time` always becomes `maxUses = 1`
- expiration must parse as a future timestamp
- note is optional and non-sensitive

## Invite Revocation

`revokeGroupInvite()` calls the callable function from Phase 7D.

Server behavior:

- sets `status: revoked`
- sets `revokedAt` with server timestamp
- writes `invite_revoked` audit log

Revoked invite redemption is still future work because token redemption is explicitly not part of Phase 7E.

## Invite Analytics

Added lightweight derived calculations:

- `activeInvites`
- `expiredInvites`
- `revokedInvites`
- `totalUses`

These are computed from sanitized invite rows returned by `listGroupInvites()`. No dashboard UI was added.

## Migration Tooling

Added:

- `scripts/migrateInviteCodes.ts`
- `npm run migrate:invite-codes`
- `npm run migrate:invite-codes:apply`

Behavior:

- Dry-run by default.
- Apply mode requires `CONFIRM_PROJECT_ID=tiizi-challenges` when targeting production.
- Reads groups with existing `inviteCode`.
- Proposes `groupInvites` records.
- Preserves original `groups.inviteCode`.
- Does not delete or modify group records.
- Apply mode creates `groupInvites` records only.

Proposed migrated invite shape:

- `groupId`
- `createdBy: "migration"`
- `createdAt`
- `expiresAt` 90 days from migration run
- `revokedAt: null`
- `status: active`
- `type: multi_use`
- `maxUses: 10000`
- `useCount: 0`
- `tokenHash` from SHA-256 of legacy invite code
- `lastUsedAt: null`
- `note`
- migration metadata

Dry-run command result in this shell:

```text
> tiizi@0.0.0 migrate:invite-codes
> tsx scripts/migrateInviteCodes.ts --dry-run

Invite code migration failed: Error: Missing required env var: GOOGLE_APPLICATION_CREDENTIALS
```

This is expected in the current shell. The script is guarded and did not read or write production. The pure migration-plan logic is covered by `npm run test:group-invite-backend`.

Production invite-code inventory from Phase 7D remains:

- groups read: 7
- groups with inviteCode: 7
- private groups with inviteCode: 2
- public groups with inviteCode: 5

Private legacy invite codes:

- `seed_group_trail_seekers` — `TRAIL-TEAM`
- `seed_group_zen_yoga` — `ZEN-YOGA`

## Indexes Added

Added composite index:

```json
{
  "collectionGroup": "groupInvites",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "groupId", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

Reason: `listGroupInvites` uses `where(groupId == ...)` plus `orderBy(createdAt desc)`.

## Test Results

Command:

```bash
npm run test:group-invite-backend
```

Result:

```text
> tiizi@0.0.0 test:group-invite-backend
> tsx scripts/testGroupInviteBackend.ts

Group invite backend security tests passed
```

Covered:

- invite creation
- invalid expiration
- invalid `maxUses`
- revoke invite
- list invites permissions
- sanitized listing excludes `tokenHash`
- invite analytics calculations
- migration plan generation
- unauthorized approval/rejection from Phase 7D remains covered

## Validation Output

### `npx tsc -b`

Passed with no output.

### `npm run build`

Passed.

```text
> tiizi@0.0.0 build
> tsc -b && vite build

vite v5.4.21 building for production...
✓ 1834 modules transformed.
✓ built in 2.85s
```

### `npm --prefix functions run build`

Passed with no output after:

```text
> build
> tsc -p tsconfig.json
```

### `npm --prefix functions run lint`

Passed with no output after:

```text
> lint
> tsc -p tsconfig.json --noEmit
```

### `firebase deploy --only firestore:rules --dry-run --project tiizi-challenges`

Passed.

```text
✔  cloud.firestore: rules file firestore.rules compiled successfully
✔  Dry run complete!
```

### Extra index validation

Command:

```bash
firebase deploy --only firestore:indexes --dry-run --project tiizi-challenges
```

Result:

```text
✔  cloud.firestore: rules file firestore.rules compiled successfully
✔  Dry run complete!
```

## Remaining Work Before UI Integration

Phase 7F/7G should handle:

1. Invite redemption callable:
   - accept raw token/code
   - hash and compare against `groupInvites.tokenHash`
   - enforce active status, expiry, revocation, `maxUses`, and one-time use
   - increment `useCount` transactionally
   - write `lastUsedAt`
2. Owner/moderator invite management UI.
3. Join request queue UI for approvals/rejections.
4. Replace current `groups.inviteCode` query flow only after redemption is deployed.
5. Run migration apply only after review:

```bash
CONFIRM_PROJECT_ID=tiizi-challenges npm run migrate:invite-codes:apply
```

No deployments were performed.
