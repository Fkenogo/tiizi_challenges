# Member Phase 7F: Invite Redemption Engine

Date: 2026-06-11
Scope: secure invite redemption backend only.
Deployment: not deployed.
UI changes: none.
Migration apply: not run.

## Files Changed

- `functions/src/groupInviteBackend.ts`
- `functions/src/index.ts`
- `src/services/groupInviteService.ts`
- `scripts/testGroupInviteBackend.ts`
- `scripts/auditInviteMigrationReadiness.ts`
- `package.json`
- `docs/reports/member-phase-7f-invite-redemption-engine.md`

## Redemption Architecture

Added callable:

- `redeemGroupInvite`

Input:

- `token` or `code`

Server flow:

1. Require authenticated caller.
2. Trim and hash supplied token/code with SHA-256.
3. Query `groupInvites` by `tokenHash`.
4. Compare stored `tokenHash` against computed hash.
5. Run all validation and writes inside a Firestore transaction.
6. Create `groupMembers/{groupId}_{uid}` with active member status.
7. Increment invite usage and set `lastUsedAt`.
8. Write `invite_redeemed` audit log.
9. Return only `{ inviteId, groupId, status: "joined" }`.

The raw token is never stored. `tokenHash` is never returned to clients.

## Security Protections

Redemption rejects with explicit Firebase callable error codes:

- `unauthenticated`: caller is not signed in
- `invalid-argument`: token/code missing
- `not-found`: no invite matches the supplied token hash
- `failed-precondition`: invite is inactive, revoked, expired, exhausted, missing group context, group is inactive/missing, or user is already active member

Validation checks:

- `status == active`
- `revokedAt` is empty
- `expiresAt` is valid and not in the past
- `useCount < maxUses`
- one-time invites use `maxUses = 1`
- group exists
- group status is active
- user is not already active/joined in the group

Membership writes remain server-owned through the callable/Admin SDK path.

## Concurrency Protections

Redemption uses `db.runTransaction()`.

Inside the transaction:

- the invite is read
- current `useCount` is validated
- existing membership is checked
- invite `useCount` is incremented
- `lastUsedAt` is set
- membership is written
- audit log is written

Because the invite document is read and updated in the same transaction, concurrent redemptions re-check `useCount` before commit and cannot exceed `maxUses`.

## Audit Logging

Added audit action:

- `invite_redeemed`

Audit log fields:

- `groupId`
- `actorUid`
- `targetUid`
- `action`
- `metadata.inviteId`
- `createdAt`

Existing Phase 7D/7E audit events remain:

- `invite_created`
- `invite_revoked`
- `join_requested`
- `join_approved`
- `join_rejected`

## Service Wrapper

Updated `src/services/groupInviteService.ts`:

- added `redeemGroupInvite(token)`

No screen imports or UI wiring were added.

## Migration Readiness Utility

Added:

- `scripts/auditInviteMigrationReadiness.ts`
- `npm run audit:invite-migration-readiness`

Read-only report includes:

- legacy invite code count
- migrated invite record count
- private/public legacy code split
- missing mappings
- orphaned invite records

Local command result:

```text
Invite migration readiness audit failed: Error: Missing required env var: GOOGLE_APPLICATION_CREDENTIALS
```

This is expected in the current shell. The script refused to read production without Admin SDK credentials.

Read-only Firebase connector inspection found:

- `groups` read: 7
- legacy `groups.inviteCode`: 7
- private legacy invite codes: 2
- public legacy invite codes: 5
- `groupInvites` records: 0
- missing mappings: 7
- orphaned invite records: 0

No records were modified.

## Security Test Results

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

Coverage added/confirmed:

- valid invite redemption
- invalid invite token
- expired invite
- revoked invite
- exhausted invite
- one-time invite reuse
- max-use protection
- duplicate active membership attempt
- invite usage increment
- membership creation
- `invite_redeemed` audit log
- migration readiness missing/orphaned mapping calculation

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
✓ built in 3.25s
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

### `firebase deploy --only firestore:indexes --dry-run --project tiizi-challenges`

Passed.

```text
✔  cloud.firestore: rules file firestore.rules compiled successfully
✔  Dry run complete!
```

## Remaining Work Before UI Integration

1. Deploy functions/rules/indexes after review.
2. Run `npm run audit:invite-migration-readiness` with `GOOGLE_APPLICATION_CREDENTIALS`.
3. Run migration dry-run with credentials.
4. Only after review, run:

```bash
CONFIRM_PROJECT_ID=tiizi-challenges npm run migrate:invite-codes:apply
```

5. Build owner/moderator invite management UI.
6. Replace `JoinGroupScreen` legacy `groups.inviteCode` lookup with `redeemGroupInvite`.
7. Add user-facing error copy mapped from callable error codes.

No deployments were performed.
