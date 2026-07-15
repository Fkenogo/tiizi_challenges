# Phase 7I - Post-Migration Invite Cutover Validation

Date: 2026-06-12

## Summary

Post-migration Firestore state is consistent with a successful Phase 7H invite-code migration apply.

Result: **PASS for data cutover and code/rules audit. PARTIAL for live callable flow testing.**

The live callable functions are deployed and active, but I did not execute production callable mutations because this shell does not have `GOOGLE_APPLICATION_CREDENTIALS`, and the in-app browser automation context was `about:blank` with no usable authenticated Tiizi session. I did not create, revoke, redeem, approve, reject, or delete any production records.

## 1. Migration Readiness Audit

Requested command:

```bash
npm run audit:invite-migration-readiness
```

Sandboxed output:

```text
Error: listen EPERM: operation not permitted ... /tsx-501/40203.pipe
```

Escalated output:

```text
Invite migration readiness audit failed: Error: Missing required env var: GOOGLE_APPLICATION_CREDENTIALS
```

Because the local Admin SDK credential is missing, the npm audit script could not run. I used the Firebase connector to inspect production Firestore read-only.

## 2. Production Firestore Validation

Collections inspected:

- `groups`
- `groupInvites`
- `groupJoinRequests`
- `groupAuditLogs`

### Legacy Groups With Invite Codes

Production still has 7 preserved legacy `groups.inviteCode` fields, as expected for this phase:

| Group ID | Legacy Code | Visibility |
| --- | --- | --- |
| `seed_group_early_birds` | `EARLY-BIRDS` | public |
| `seed_group_hydration_crew` | `HYDRATE-NOW` | public |
| `seed_group_squad_254` | `SQUAD-254` | public |
| `seed_group_strength_club` | `STRONG-CLUB` | public |
| `seed_group_trail_seekers` | `TRAIL-TEAM` | private |
| `seed_group_zen_yoga` | `ZEN-YOGA` | private |
| `zGO3H0GUZyKwQhbLuNyQ` | `FIT-50S-4O35` | public |

### Migrated Invite Records

Production has 7 migrated `groupInvites` documents:

| Invite ID | groupId | status | type | maxUses | useCount |
| --- | --- | --- | --- | ---: | ---: |
| `legacy_seed_group_early_birds` | `seed_group_early_birds` | active | multi_use | 10000 | 0 |
| `legacy_seed_group_hydration_crew` | `seed_group_hydration_crew` | active | multi_use | 10000 | 0 |
| `legacy_seed_group_squad_254` | `seed_group_squad_254` | active | multi_use | 10000 | 0 |
| `legacy_seed_group_strength_club` | `seed_group_strength_club` | active | multi_use | 10000 | 0 |
| `legacy_seed_group_trail_seekers` | `seed_group_trail_seekers` | active | multi_use | 10000 | 0 |
| `legacy_seed_group_zen_yoga` | `seed_group_zen_yoga` | active | multi_use | 10000 | 0 |
| `legacy_zGO3H0GUZyKwQhbLuNyQ` | `zGO3H0GUZyKwQhbLuNyQ` | active | multi_use | 10000 | 0 |

Common fields confirmed:

- `createdBy: "migration"`
- `migratedFrom: "groups.inviteCode"`
- `note: "Migrated from legacy groups.inviteCode. Original group field preserved."`
- `expiresAt: 2026-09-10T11:48:55.490Z`
- `createdAt` and `migratedAt`: 2026-06-12T11:48:56.746Z

### Required Checks

| Check | Result |
| --- | --- |
| all legacy `groups.inviteCode` values have matching `groupInvites/legacy_{groupId}` | PASS |
| `missingMappings` | 0 |
| `orphanedInviteRecords` | 0 |
| duplicate `tokenHash` | 0 found |
| duplicate active migrated invites per group | 0 found |
| token hashes match preserved legacy codes | PASS |

Token hash validation was run locally against all 7 legacy codes, and every stored `tokenHash` matched `sha256(groups.inviteCode)`.

## 3. Callable Invite Flow Validation

### Deployment / Health Evidence

`firebase functions:log --only createGroupInvite,listGroupInvites,revokeGroupInvite,redeemGroupInvite,requestGroupJoin,approveGroupJoinRequest,rejectGroupJoinRequest --project tiizi-challenges`

Logs showed the following functions deployed as Gen 2, Node.js 22, state `ACTIVE`, all traffic on latest revision:

- `createGroupInvite`
- `listGroupInvites`
- `revokeGroupInvite`
- `redeemGroupInvite`
- `requestGroupJoin`
- `approveGroupJoinRequest`
- `rejectGroupJoinRequest`

Recent log entries were deployment/startup logs, not user invocation logs. No function error log was observed in the returned output.

`firebase functions:list --project tiizi-challenges` failed locally with:

```text
Error: Failed to list functions for tiizi-challenges
firebase-tools update check failed
```

The function logs still returned successfully and confirmed active deployed functions.

### Live Production Mutation Tests

Not executed in this pass:

- redeem migrated public invite
- redeem migrated private invite
- create invite
- list invite through callable
- revoke invite
- request join
- approve join
- reject join

Reason:

- `GOOGLE_APPLICATION_CREDENTIALS` is not set, so Admin SDK custom-token or scripted authenticated testing is not available.
- The browser automation page context was `about:blank`, so there was no usable signed-in Tiizi app session to call the functions safely.
- Running these tests against production would mutate `groupInvites`, `groupMembers`, `groupJoinRequests`, and `groupAuditLogs`; I did not perform those writes without a controlled test account and cleanup plan.

Local backend coverage remains green:

```text
npm run test:group-invite-backend
Group invite backend security tests passed
```

That local suite covers valid invite redemption, invalid/expired/revoked/exhausted invites, one-time reuse, duplicate membership, invite creation, list/revoke, join request approval/rejection, and direct client write denial patterns.

## 4. Remaining Legacy `inviteCode` References

Search target:

```bash
rg -n "inviteCode|joinGroupByInviteCode|redeemGroupInvite|legacyInviteDocumentId|migratedFrom" src scripts functions firestore.rules package.json docs/reports/member-phase-7h-invite-migration-implementation.md
```

### Runtime

Allowed/current runtime references:

- `src/features/Groups/JoinGroupScreen.tsx`
  - Uses UI state named `inviteCode`, but it calls `useRedeemGroupInvite()`.
  - Classification: runtime UI label/state only, secure callable path.

- `src/services/groupInviteService.ts`
  - Calls callable `redeemGroupInvite`.
  - Classification: runtime secure invite system.

- `src/hooks/useGroupInvites.ts`
  - Exposes `useRedeemGroupInvite`.
  - Classification: runtime secure invite system.

No live runtime reference to `joinGroupByInviteCode` remains.

No live runtime query of `groups.inviteCode` was found in `src/features/Groups`, `src/hooks/useGroups.ts`, or `src/services/groupService.ts`.

### Migration Tooling

- `scripts/migrateInviteCodes.ts`
- `scripts/auditInviteMigrationReadiness.ts`
- `scripts/auditGroupInviteCodes.ts`

Classification: expected migration/audit tooling.

### Tests

- `scripts/testGroupInviteBackend.ts`

Classification: expected tests for migration idempotency and legacy path removal.

### Seed-Only

- `scripts/seedAppData.ts`

Classification: seed-only legacy data retained for migration testing. The file includes a comment marking `inviteCode` as legacy migration test data.

### Types

- `src/types/index.ts`

Classification: backwards-compatible data shape tolerance. This does not create or query legacy invite codes.

## 5. Firestore Rules Validation

Rule source confirms:

- `groupClientCreateFields()` does not include `inviteCode`.
- `groupOwnerEditableFields()` does not include `inviteCode`.
- `isValidGroupCreate()` does not require or allow `request.resource.data.inviteCode`.
- `match /groupInvites/{inviteId}` denies client create/update/delete.
- `match /groupJoinRequests/{requestId}` denies direct client create/update/delete.
- `match /groupAuditLogs/{auditId}` denies client create/update/delete.

Validation command:

```bash
firebase deploy --only firestore:rules --dry-run --project tiizi-challenges
```

Output:

```text
cloud.firestore: rules file firestore.rules compiled successfully
Dry run complete
```

Conclusion: the repo-root rules prevent client create/update of `groups.inviteCode`. I did not perform a live client write attempt against production.

## 6. Validation Commands Run

```text
npm run audit:invite-migration-readiness
FAIL/BLOCKED - missing GOOGLE_APPLICATION_CREDENTIALS after sandbox escalation
```

```text
npm run test:group-invite-backend
PASS
```

```text
npx tsc -b
PASS
```

```text
firebase deploy --only firestore:rules --dry-run --project tiizi-challenges
PASS
```

## 7. Remaining Risks

Medium:

- Live callable happy-path mutation tests are still pending because a controlled authenticated production test context was not available.

Low:

- Legacy `groups.inviteCode` fields remain in production by design. They should not be deleted until a later cleanup phase confirms no rollback need.

Low:

- `JoinGroupScreen` uses local variable/UI wording `inviteCode`, but it redeems through secure callable infrastructure and does not query legacy group fields.

## 8. Recommended Next Step

Run a controlled production smoke test with:

1. One owner/moderator account.
2. One non-member test account.
3. Admin SDK credentials exported locally.
4. A disposable test group or a pre-approved test group.
5. Cleanup plan for test `groupInvites`, `groupJoinRequests`, `groupAuditLogs`, and test memberships.

Required environment:

```bash
export GOOGLE_APPLICATION_CREDENTIALS="/Users/theo/secure-keys/tiizi-challenges-firebase-adminsdk-fbsvc-0887feecee.json"
export FIREBASE_PROJECT_ID=tiizi-challenges
```

Then rerun:

```bash
npm run audit:invite-migration-readiness
```

Do not delete legacy `groups.inviteCode` fields yet.
