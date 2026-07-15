# Member Phase 7A: Security Hardening Implementation

Date: 2026-06-11
Scope: Critical and High findings from `docs/reports/member-phase-7-group-challenge-policy-audit.md`.
Deployment: not deployed.

## Files Changed

- `firestore.rules`
- `src/services/groupService.ts`
- `src/services/challengeService.ts`
- `docs/reports/member-phase-7a-security-hardening-implementation.md`

No notifications, feeds, or unrelated UX flows were modified.

## Rules Changed

### groupMembers

Added:

- `groupMemberCreateFields()`
- `groupMemberUpdateFields()`
- `isValidGroupMemberCreate()`
- `isValidGroupMemberUpdate()`

New behavior:

- Membership document ID must be `{groupId}_{uid}`.
- `groupId` must point to an existing group.
- `userId` must equal `request.auth.uid`.
- User-created role must be exactly `member`.
- User-created `owner`, `admin`, and `moderator` roles are blocked.
- Public groups without approval allow initial `status: active`.
- Private or approval-required groups allow initial `status: pending`.
- User-created approval/moderation fields are blocked.
- Member self-update is limited to leaving via `status: left` plus `leftAt`.
- Membership delete is admin-only.

### groups

Added:

- `groupClientCreateFields()`
- `groupOwnerEditableFields()`
- `isValidGroupCreate()`
- `isValidGroupOwnerUpdate()`
- `canReadGroup()`

New behavior:

- Group create payload is field-allowlisted.
- Client-sent lifecycle fields are only accepted as rule-enforced safe defaults:
  - `memberCount == 1`
  - `activeChallenges == 0`
  - `status == active`
  - `moderationStatus == pending_review`
  - `reviewStatus == pending_review`
  - `isVerified == false`
- Group owner updates are limited to profile/settings fields:
  - `name`
  - `description`
  - `coverImageUrl`
  - `isPrivate`
  - `visibility`
  - `requireAdminApproval`
  - `allowMemberChallenges`
  - `inviteCode`
- Owners cannot update lifecycle/count/moderation verification fields.
- Group delete is admin/moderator-only.
- Private groups are no longer broadly readable by every authenticated user.

### challenges

Added:

- `challengeClientCreateFields()`
- `challengeOwnerEditableFields()`
- `isValidChallengeCreate()`
- `isValidChallengeUpdate()`
- `canCreateChallengeInGroup()`
- `canReadChallenge()`

New behavior:

- Challenge create requires an existing active group.
- Creator must be the group owner/admin or an active group member where `allowMemberChallenges == true`.
- If `allowMemberChallenges == false`, only the group owner or admin can create challenges.
- Client-created challenge fields are allowlisted.
- `createdBy`, `groupId`, `createdAt`, `visibility`, `groupVisibility`, `participantCount`, `status`, and `moderationStatus` are rule-constrained.
- Non-donation challenges must be created as `status: active` and `moderationStatus: approved`.
- Donation-enabled challenges must be created as `status: draft`, `moderationStatus: pending`, `approvalStatus: pending`, `approvalRequired: true`, and `acceptingDonations: false`.
- Owner updates cannot change protected lifecycle, visibility, donation approval, participant count, creator, or group fields.
- Challenge delete is admin/moderator-only.

### challengeMembers

Added:

- `challengeMemberDocId()`
- `isValidChallengeMemberCreate()`

New behavior:

- Membership document ID must be `{challengeId}_{uid}`.
- Challenge must exist.
- Challenge must be active.
- `groupId` must match the challenge document.
- User must be an active/joined group member.
- Initial values are forced:
  - `status: active`
  - `activitiesCompleted: 0`
  - `totalActivities: 0`
  - `totalPoints: 0`
  - `completionRate: 0`
  - `joinedAt == request.time`

### Challenge Reads

Public challenge reads now require:

- challenge `status == active`
- group is public
- group is active
- group is approved/reviewed/verified or `isVerified == true`

Members can still read challenges in groups they belong to. Admin/moderator access is retained.

## Services Changed

### `src/services/groupService.ts`

- Group creator membership now writes `role: member`, not `role: owner`.
- Client no longer writes `approvedAt` during owner membership create.
- Joining an existing legacy `joined` membership no longer self-upgrades it to `active` with approval fields.
- New group join writes no user-controlled approval timestamp.

Ownership is now represented by `groups.ownerId`, not by a client-created privileged membership role.

### `src/services/challengeService.ts`

- Challenge membership create now writes `joinedAt: serverTimestamp()`.
- Initial challenge member `totalActivities` is `0` to match rules.
- Auto-created creator membership fallback now writes `role: member`, not `role: owner`.
- Challenge create checks `groups.allowMemberChallenges`; when false, only the group owner can create from the member client.
- Removed the client-side post-create `participantCount: 1` update. Participant counts remain a server/admin-owned aggregate.

## Before vs After

Before:

- Any signed-in user could self-create a `groupMembers` document for any group if `userId` matched their UID.
- Self-created memberships could contain privileged roles/statuses.
- `isGroupMember()` trusted those documents for challenge reads, challenge creation, challenge joins, and summary reads.
- Group owners could update lifecycle/count/moderation fields.
- Normal active members could create active challenges even when group policy should restrict them.
- Challenge memberships did not prove the challenge existed, was active, or matched the supplied group.
- Public challenge reads did not require active/approved group and challenge lifecycle checks.

After:

- Membership creation is constrained by document ID, group existence, role, status, and group privacy/approval settings.
- Privileged membership roles are no longer client-creatable.
- Private group reads are rule-protected.
- Group lifecycle/count/moderation fields are protected from owner/client updates.
- Challenge creation respects group `allowMemberChallenges`.
- Challenge protected fields are constrained by rules.
- Challenge membership creation is tied to an existing active challenge and exact group.
- Public challenge reads require active public approved group context plus active challenge status.

## Breaking Changes / Pilot Notes

- Private group invite/join by invite code may need a trusted invite lookup flow. The new privacy rule blocks broad private group reads by non-members, which is intentional for security.
- Client-side `groups.memberCount` updates during `joinGroup()` / `leaveGroup()` are still present and can fail under the existing owner/admin-only group update rule. This was not reworked in Phase 7A because Part 7 asked for design/recommendation only.
- Group creator membership now uses `role: member`; owner authority is `groups.ownerId`.
- Challenge creator delete is now admin/moderator-only.
- Owner edits to donation approval/lifecycle fields are blocked.
- Some public challenges in groups that are still `pending_review` may no longer be readable as public challenge detail until the group is reviewed/verified or admin-approved.

## Remaining Medium Findings

- Member-created group reports still need a safe create rule if normal members should be able to report groups.
- `memberCount`, `activeChallenges`, and `participantCount` should move fully to trusted server aggregation.
- Invite-code join should be redesigned around a server callable or a minimal invite document that does not expose private group metadata.
- Member challenge discovery still reads all memberships for a user; acceptable for pilot, but should be materialized or paginated for heavy users.

## memberCount Ownership Recommendation

Current `joinGroup()` and `leaveGroup()` can write membership successfully and then fail on `groups/{groupId}.memberCount` because group updates are owner/admin-only. This can create partial success and stale counts.

Recommended design:

1. Keep client writes limited to `groupMembers`.
2. Add Cloud Functions triggers:
   - `onGroupMemberCreated`
   - `onGroupMemberUpdated`
3. Functions update `groups.memberCount` via Admin SDK when status transitions into or out of active membership.
4. Optionally rebuild counts with a dry-run/apply script before deployment.
5. Remove `memberCount` client updates from `joinGroup()` and `leaveGroup()`.

This keeps derived counts server-owned and avoids granting broad client update access to group documents.

## Validation Output

### `npx tsc -b`

Result: passed with no output.

### `npm run build`

Result: passed.

Key output:

```text
> tiizi@0.0.0 build
> tsc -b && vite build

vite v5.4.21 building for production...
✓ 1834 modules transformed.
✓ built in 2.74s
```

### `firebase deploy --only firestore:rules --dry-run --project tiizi-challenges`

Result: passed.

Key output:

```text
=== Deploying to 'tiizi-challenges'...
i  deploying firestore
i  firestore: reading indexes from firestore.indexes.json...
i  cloud.firestore: checking firestore.rules for compilation errors...
✔  cloud.firestore: rules file firestore.rules compiled successfully
✔  Dry run complete!
```

## Deploy Commands After Review

Rules only:

```bash
firebase deploy --only firestore:rules --project tiizi-challenges
```

If hosting is desired for aligned service behavior:

```bash
npm run build
firebase deploy --only hosting,firestore:rules --project tiizi-challenges
```
