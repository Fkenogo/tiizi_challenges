# Phase 7G - Private Group Invite & Join Management UI

Date: 2026-06-11

## Summary

Phase 7G connects the Phase 7D-7F invite backend to the member application without changing Firestore rules, Cloud Functions, migration data, or production deployment state.

No migration apply was run.
No deployment was run.
No UI was added to admin screens.

## Screens Updated

- `src/features/Groups/GroupDetailScreen.tsx`
  - Adds owner/moderator invite management access.
  - Uses `requestGroupJoin` callable for private or approval-required groups.

- `src/features/Groups/JoinGroupScreen.tsx`
  - Replaces legacy `groups.inviteCode` lookup with `redeemGroupInvite`.
  - Removes preview-toggle legacy flow.
  - Routes to the joined group after successful redemption.

- `src/features/Groups/components/GroupInviteManagementPanel.tsx`
  - New member-side owner/moderator management panel.

## Invite Management UX

Owners and active group moderators can:

- create one-time invites
- create multi-use invites
- set expiry date/time
- set max uses for multi-use invites
- add optional manager note
- list existing invites
- revoke active invites

The generated invite token is shown only immediately after creation with the warning:

> This code will only be shown once.

Invite listing displays:

- invite type
- status
- use count
- max uses
- expiry
- creation date
- note

The UI never displays `tokenHash`.

## Join Request UX

Members viewing private or approval-required groups now submit a request via the `requestGroupJoin` callable instead of directly writing or joining through the legacy path.

Owners and moderators can review pending requests from the group detail invite management panel:

- requester user ID
- request date
- source
- approve action
- reject action with optional reason

Approval and rejection use the existing Phase 7D callable functions:

- `approveGroupJoinRequest`
- `rejectGroupJoinRequest`

## Error Handling Mappings

Added reusable invite error mapping in `src/services/groupInviteUtils.ts`.

Mapped examples:

- `not-found` -> `Invalid invite code.`
- expired invite -> `Invite has expired.`
- revoked invite -> `Invite is no longer valid.`
- exhausted invite -> `Invite usage limit reached.`
- already active member -> `You are already a member.`
- unauthenticated -> `Please sign in to continue.`
- permission denied -> `You do not have permission to manage this group.`

Raw Firebase callable errors are not shown in the UI.

## Services And Hooks Added

- `src/services/groupInviteService.ts`
  - `redeemGroupInvite`
  - `requestGroupJoin`
  - `approveGroupJoinRequest`
  - `rejectGroupJoinRequest`
  - `listGroupJoinRequests`

- `src/hooks/useGroupInvites.ts`
  - `useGroupInvites`
  - `useGroupJoinRequests`
  - `useCreateGroupInvite`
  - `useRevokeGroupInvite`
  - `useRedeemGroupInvite`
  - `useRequestGroupJoin`
  - `useApproveGroupJoinRequest`
  - `useRejectGroupJoinRequest`

- `src/hooks/useGroups.ts`
  - `useGroupMembership`

- `src/services/groupService.ts`
  - `getMembership`

## Security Validation

Backend enforcement remains the source of truth:

- non-owners cannot create invites
- non-moderators cannot revoke invites
- non-moderators cannot approve or reject requests
- invite redemption uses the server-side token hash flow
- private group membership creation happens through callable/Admin SDK logic
- clients still cannot directly write `groupInvites`, `groupJoinRequests`, or `groupAuditLogs`

The management panel is UI-gated to:

- group owner
- active group member with role `owner`
- active group member with role `admin`
- active group member with role `moderator`

This UI gate is convenience only; callable functions still enforce permissions server-side.

## Validation Results

`npm run test:group-invite-backend`

Result: passed

Output:

```text
Group invite backend security tests passed
```

`npx tsc -b`

Result: passed

`npm run build`

Result: passed

Notes:

```text
Circular chunk: vendor-firebase-core -> vendor-firebase-internal -> vendor-firebase-core.
✓ built in 3.28s
```

The circular chunk message is a Vite manual chunk warning and did not fail the build.

`npm --prefix functions run build`

Result: passed

`npm --prefix functions run lint`

Result: passed

## Remaining Work Before Migration Cutover

1. Deploy the already-created Phase 7D-7F callable functions, including `redeemGroupInvite`, before enabling this UI in production.
2. Run the invite-code migration dry run again after deploy readiness.
3. Apply invite-code migration only with explicit approval.
4. Decide whether to keep or remove `groups.inviteCode` after migrated invites are verified.
5. Add a deep-link route for invite URLs if desired.
6. Consider replacing requester user IDs with display names using a bounded lookup for the visible request page only.

## Deployment Status

No deployment was performed.

