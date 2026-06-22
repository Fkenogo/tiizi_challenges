# Member Phase 7B: Server-Owned Group & Challenge Counters

Date: 2026-06-11
Scope: `groups.memberCount`, `groups.activeChallenges`, `challenges.participantCount`.
Deployment: not deployed.
Backfill apply: not run.

## Files Changed

- `firestore.rules`
- `functions/src/index.ts`
- `functions/src/memberCounters.ts`
- `src/services/groupService.ts`
- `src/services/challengeService.ts`
- `src/services/adminChallengeService.ts`
- `scripts/backfillGroupCounts.ts`
- `package.json`
- `docs/reports/member-phase-7b-server-owned-counters.md`

No notifications, feeds, messaging, or UI redesign work was done.

## Counters Audited

### `groups.memberCount`

Reads:

- `src/services/groupService.ts` maps missing `memberCount` to `0`.
- Member UI reads group member counts from group docs and `useGroupMemberCount()`.
- `src/services/adminGroupService.ts` reads `memberCount` for admin group tables.
- Seed/backfill scripts read/write seed values.

Writes before this phase:

- `src/services/groupService.ts` created groups with `memberCount: 1`.
- `src/services/groupService.ts` incremented on public group join.
- `src/services/groupService.ts` decremented on group leave.
- Seed/reset scripts wrote seed values.

Writes after this phase:

- Cloud Functions update `groups.memberCount`.
- `scripts/backfillGroupCounts.ts` can correct counts in apply mode only.
- Client create/update rules reject direct member writes to `memberCount`.

### `groups.activeChallenges`

Reads:

- Member group cards and admin group tables display `activeChallenges`.
- Admin analytics computes active challenge totals independently from challenges.

Writes before this phase:

- `src/services/groupService.ts` created groups with `activeChallenges: 0`.
- Seed/reset scripts wrote seed values.

Writes after this phase:

- Cloud Functions update `groups.activeChallenges` from challenge status transitions.
- `scripts/backfillGroupCounts.ts` can correct counts in apply mode only.
- Client create/update rules reject direct member/admin-browser writes to `activeChallenges`.

### `challenges.participantCount`

Reads:

- `src/services/challengeService.ts` reads `participantCount` for challenge cards and details.
- `src/services/adminChallengeService.ts` reads `participantCount` for admin challenge analytics/tables.
- Member home/challenge screens display participant counts.

Writes before this phase:

- `src/services/challengeService.ts` created challenges with `participantCount: 0`.
- `src/services/adminChallengeService.ts` created admin challenges with `participantCount: 0`.
- Earlier code had already removed a post-create member-client `participantCount: 1` update.
- Seed/reset scripts wrote seed values.

Writes after this phase:

- Cloud Functions update `challenges.participantCount` from challenge membership transitions.
- `scripts/backfillGroupCounts.ts` can correct counts in apply mode only.
- Client create/update rules reject direct writes to `participantCount`.

Note: `functions/src/memberActivitySummaries.ts` still writes `challengeActivitySummaries.participantCount`, which is a separate summary collection field and not the `challenges.participantCount` counter in this phase.

## Functions Added

New module:

- `functions/src/memberCounters.ts`

New exported triggers in `functions/src/index.ts`:

- `onGroupMemberCreated`
- `onGroupMemberUpdated`
- `onGroupMemberDeleted`
- `onChallengeCreated`
- `onChallengeUpdated`
- `onChallengeDeleted`
- `onChallengeMemberCreated`
- `onChallengeMemberUpdated`
- `onChallengeMemberDeleted`

Counter logic:

- `groups.memberCount` increments only when a group membership enters `active`/`joined`.
- `groups.memberCount` decrements only when a group membership leaves `active`/`joined` or is deleted while active.
- `groups.activeChallenges` increments only when a challenge enters `active`.
- `groups.activeChallenges` decrements when an active challenge becomes non-active or is deleted.
- `challenges.participantCount` increments only when a challenge membership enters `active`/`joined`.
- `challenges.participantCount` decrements when an active participant leaves active state or is deleted.
- Updates compare before/after state, so no-op edits do not double count.
- Group/challenge ID changes are handled by decrementing the old target and incrementing the new target when applicable.

## Client Writes Removed

Removed from `src/services/groupService.ts`:

- group create payload no longer sends `memberCount`
- group create payload no longer sends `activeChallenges`
- public group join no longer increments `groups.memberCount`
- group leave no longer decrements `groups.memberCount`

Removed from `src/services/challengeService.ts`:

- member challenge create payload no longer sends `participantCount`

Removed from `src/services/adminChallengeService.ts`:

- admin challenge create payload no longer sends `participantCount`

## Rules Changed

`firestore.rules` now treats counters as server-owned:

- `isValidGroupCreate()` rejects client-created `memberCount` and `activeChallenges`.
- `isValidChallengeCreate()` rejects client-created `participantCount`.
- `keepsGroupCountersServerOwned()` blocks browser updates to `memberCount` and `activeChallenges`, including admin/moderator client updates.
- `keepsChallengeCountersServerOwned()` blocks browser updates to `participantCount`, including admin/moderator client updates.

Admin SDK and Cloud Functions bypass Firestore rules, so trusted server writes remain possible.

## Backfill Script

Added:

- `scripts/backfillGroupCounts.ts`

Package scripts:

- `npm run backfill:group-counts`
- `CONFIRM_PROJECT_ID=tiizi-challenges npm run backfill:group-counts:apply`

Safety:

- Dry-run by default.
- Apply mode requires `CONFIRM_PROJECT_ID=tiizi-challenges` for production.
- Reads `groups`, `groupMembers`, `challenges`, and `challengeMembers`.
- Writes only corrected counter fields plus `countersBackfilledAt` in apply mode.

Dry-run command executed:

```bash
npx tsx scripts/backfillGroupCounts.ts
```

Dry-run result:

```json
{
  "mode": "dry-run",
  "projectId": "tiizi-challenges",
  "collectionsRead": {
    "groups": 7,
    "groupMembers": 83,
    "challenges": 27,
    "challengeMembers": 218
  },
  "groupsProcessed": 7,
  "challengesProcessed": 27,
  "memberCountCorrections": 1,
  "activeChallengesCorrections": 6,
  "participantCountCorrections": 20,
  "writesPlanned": 26,
  "writesApplied": 0
}
```

Sample corrections:

- `seed_group_early_birds`: `memberCount` 13 -> 15, `activeChallenges` 2 -> 8
- `seed_group_hydration_crew`: `activeChallenges` 1 -> 2
- `seed_group_strength_club`: `activeChallenges` 2 -> 3
- `1S7cXHuHkwAONHhtSgLD`: `participantCount` 1 -> 0
- `seed_challenge_01`: `participantCount` 12 -> 2

The first `npm run backfill:group-counts` attempt was blocked by local sandbox IPC permissions from `tsx`; the same dry-run succeeded with the already-approved `npx tsx scripts/backfillGroupCounts.ts` path. No writes were applied.

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
✓ built in 28.41s
```

### `npm --prefix functions run build`

Passed.

```text
> build
> tsc -p tsconfig.json
```

### `npm --prefix functions run lint`

Passed.

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

## Remaining Medium Findings

- Invite-code joining for private groups still needs a trusted callable/minimal invite lookup design from Phase 7A.
- Member-created group reports still need a safe create rule if normal member reporting is required.
- Seed scripts still write counter values for reset/seed workflows. That is acceptable for seed data setup, but production runtime should rely on functions plus backfill.
- Existing production counter drift should be corrected with the dry-run/apply backfill after review.

## Deploy / Apply Commands After Review

Deploy functions and rules:

```bash
npm --prefix functions run build
firebase deploy --only functions,firestore:rules --project tiizi-challenges
```

Backfill after deploy:

```bash
npm run backfill:group-counts
CONFIRM_PROJECT_ID=tiizi-challenges npm run backfill:group-counts:apply
```
