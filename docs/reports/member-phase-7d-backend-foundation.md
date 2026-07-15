# Member Phase 7D: Private Group Invite Backend Foundation

Date: 2026-06-11
Scope: secure backend foundation only.
Deployment: not deployed.
UI changes: none.
Backfill applies: none.

## Files Changed

- `firestore.rules`
- `functions/src/groupInviteBackend.ts`
- `functions/src/index.ts`
- `scripts/testGroupInviteBackend.ts`
- `scripts/auditGroupInviteCodes.ts`
- `package.json`
- `docs/reports/member-phase-7d-backend-foundation.md`

## New Schemas

### `groupInvites/{inviteId}`

Server-owned invite document. It is not directly writable by browser clients.

| Field | Type | Notes |
| --- | --- | --- |
| `groupId` | string | Target group. |
| `createdBy` | string | UID of owner/moderator/admin creating the invite. |
| `createdAt` | timestamp | Server timestamp. |
| `expiresAt` | string ISO timestamp | Validated as future timestamp by callable. |
| `revokedAt` | timestamp/null | Set when revoked. |
| `status` | `active | revoked` | Phase 7D creates/revokes only. Expiry enforcement is for redemption phase. |
| `type` | `one_time | multi_use` | One-time forces `maxUses = 1`. |
| `maxUses` | number | Positive integer, capped at 10000. |
| `useCount` | number | Starts at 0. Redemption not implemented in this phase. |
| `tokenHash` | string | SHA-256 hash of generated token. Raw token is returned only from create callable. |
| `lastUsedAt` | timestamp/null | Reserved for Phase 7E/7F redemption. |

### `groupJoinRequests/{requestId}`

Request ID is currently `{groupId}_{uid}`.

| Field | Type | Notes |
| --- | --- | --- |
| `groupId` | string | Target group. |
| `userId` | string | Requesting user. |
| `status` | `pending | approved | rejected` | Direct browser approval writes are denied. |
| `requestedAt` | timestamp | Server timestamp. |
| `source` | `request | invite` | Invite redemption is not implemented yet. |
| `inviteId` | string/null | Optional invite reference. |
| `approvedBy` | string/null | Set by approval callable. |
| `approvedAt` | timestamp/null | Set by approval callable. |
| `rejectedBy` | string/null | Set by rejection callable. |
| `rejectedAt` | timestamp/null | Set by rejection callable. |
| `rejectionReason` | string/null | Optional, capped in callable. |

### `groupAuditLogs/{auditId}`

Append-only from callable/Admin SDK flows.

| Field | Type | Notes |
| --- | --- | --- |
| `groupId` | string | Related group. |
| `actorUid` | string | User or admin performing the action. |
| `targetUid` | string/null | Target member where applicable. |
| `action` | string enum | `invite_created`, `invite_revoked`, `join_requested`, `join_approved`, `join_rejected`. |
| `metadata` | map | Non-sensitive context such as invite/request IDs. |
| `createdAt` | timestamp | Server timestamp. |

## New Callable Functions

Added in `functions/src/groupInviteBackend.ts` and exported from `functions/src/index.ts`:

- `createGroupInvite`
- `revokeGroupInvite`
- `requestGroupJoin`
- `approveGroupJoinRequest`
- `rejectGroupJoinRequest`

Permission model:

- Callable functions require Firebase Auth.
- Group owners can create/revoke invites and approve/reject requests.
- Group membership roles `owner`, `admin`, or `moderator` with active/joined status can manage invites/requests.
- Global admins/moderators from `admins/{uid}` can manage invites/requests.
- Target group must exist and be `status: active`.
- Private group data is not exposed unnecessarily; invite creation returns `inviteId` and the raw one-time token only for the manager who created it.
- Every callable writes one audit log record.

Audit actions implemented:

- `invite_created`
- `invite_revoked`
- `join_requested`
- `join_approved`
- `join_rejected`

Invite token redemption is intentionally not implemented in Phase 7D.

## Firestore Rules Added

Added helper rules:

- `isGroupManagerMember(groupId)`
- `canManageSpecificGroup(groupId)`
- `canReadGroupInvite(data)`
- `canReadGroupJoinRequest(data)`
- `canReadGroupAuditLog(data)`

Added match blocks:

```text
groupInvites/{inviteId}
- read: authorized group managers only
- create/update/delete: false

groupJoinRequests/{requestId}
- read: own request or authorized group manager
- create/update/delete: false

groupAuditLogs/{auditId}
- read: authorized group managers only
- create/update/delete: false
```

This preserves the Phase 7C recommendation: private group metadata stays private, and browser clients cannot directly create invites, approve requests, reject requests, or write audit logs.

## Security Tests

Added:

- `scripts/testGroupInviteBackend.ts`
- `npm run test:group-invite-backend`

Covered cases:

- Unauthorized invite creation fails.
- Owner invite creation succeeds.
- Moderator invite creation succeeds.
- Unauthorized approval fails.
- Unauthorized rejection fails.
- Owner approval writes active membership and audit log.
- Moderator rejection succeeds.
- Moderator invite revocation succeeds.
- Static rules assertions confirm direct client writes are denied for:
  - `groupInvites`
  - `groupJoinRequests`
  - `groupAuditLogs`

Test result:

```text
> tiizi@0.0.0 test:group-invite-backend
> tsx scripts/testGroupInviteBackend.ts

Group invite backend security tests passed
```

Note: the first sandboxed run hit local `tsx` IPC restrictions. Rerun with approved command execution passed.

## inviteCode Migration Audit

Added read-only script:

- `scripts/auditGroupInviteCodes.ts`
- `npm run audit:group-invite-codes`

The script requires `GOOGLE_APPLICATION_CREDENTIALS` and refused to run without it, as intended:

```text
Error: Missing required env var: GOOGLE_APPLICATION_CREDENTIALS
```

Production read-only collection inspection was completed through the Firebase connector. No records were modified.

Result:

```json
{
  "groupsRead": 7,
  "groupsWithInviteCode": 7,
  "privateGroupsWithInviteCode": 2,
  "publicGroupsWithInviteCode": 5
}
```

Private groups using `inviteCode`:

- `seed_group_trail_seekers` — `TRAIL-TEAM`
- `seed_group_zen_yoga` — `ZEN-YOGA`

Public groups using `inviteCode`:

- `seed_group_early_birds` — `EARLY-BIRDS`
- `seed_group_hydration_crew` — `HYDRATE-NOW`
- `seed_group_squad_254` — `SQUAD-254`
- `seed_group_strength_club` — `STRONG-CLUB`
- `zGO3H0GUZyKwQhbLuNyQ` — `FIT-50S-4O35`

Migration recommendation:

1. Do not keep using `groups.inviteCode` as the private invite mechanism.
2. In Phase 7E, create `groupInvites` documents for current active private invite codes via a dry-run/apply migration.
3. Store only token/code hashes on invite documents.
4. Use callable redemption so private group metadata stays private.
5. After UI migration, stop querying `groups.inviteCode` for private joins.

## Validation Output

### `npx tsc -b`

Passed with no output.

### `npm run build`

Passed.

Key output:

```text
> tiizi@0.0.0 build
> tsc -b && vite build

vite v5.4.21 building for production...
✓ 1834 modules transformed.
✓ built in 2.91s
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
=== Deploying to 'tiizi-challenges'...

i  deploying firestore
i  firestore: ensuring required API firestore.googleapis.com is enabled...
i  firestore: reading indexes from firestore.indexes.json...
i  cloud.firestore: checking firestore.rules for compilation errors...
✔  cloud.firestore: rules file firestore.rules compiled successfully

✔  Dry run complete!
```

## Remaining Work for Phase 7E

Phase 7E should implement invite management and migration:

1. Add callable invite redemption:
   - validate raw token/code
   - hash and compare against `groupInvites.tokenHash`
   - enforce status, expiry, max use count, one-time use, and revoked state
   - transactionally increment `useCount`
2. Add owner/moderator invite listing and revocation service.
3. Add dry-run/apply migration from existing `groups.inviteCode` to `groupInvites`.
4. Decide whether private groups should allow open join requests without invite proof.
5. Add callable/rules tests for expired, revoked, over-used, one-time, and invalid invites.
6. Only after backend verification, wire UI in Phase 7G.

No deployments were performed.
