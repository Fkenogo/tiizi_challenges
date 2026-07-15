# Phase 10C-P0 Production Readiness Verification

Date: 2026-06-15  
Project: `tiizi-challenges`  
Mode: Audit only. No deploys, production writes, or fixes were performed.

## Executive Summary

Status: **GO for closed pilot**

The recent deploy/backfill work is production-ready for a closed pilot. Required automated validation passed, hosting is live and serving the current build assets, required Cloud Functions are deployed and active on Node 22, Firestore indexes are deployed and ready, live Firestore rules were confirmed through the Firebase Rules API, and production summary/backfill documents exist with expected counts.

Remaining caution: this audit verified the unauthenticated production app shell and live backend state, but did not sign in or mutate production as a pilot member. Run one final authenticated smoke pass before inviting users.

## Commands Run

Validation:

```bash
npm run test:home-challenge-feeds
npm run test:home-performance-guards
npm run test:pilot-ux-polish-guards
npm run test:challenge-creation-backend
npm run test:group-invite-backend
npm run test:user-metrics-backfill-payload
npx tsc -b --pretty false
npm run build
npm --prefix functions run build
npm --prefix functions run lint
```

Production verification:

```bash
firebase hosting:sites:list --project tiizi-challenges
gcloud functions list --project tiizi-challenges --format='table(name.basename(),state,updateTime,buildConfig.runtime)'
gcloud firestore indexes composite list --project=tiizi-challenges --format=json
gcloud firestore databases describe --project=tiizi-challenges --database='(default)' --format=json
firebase deploy --only firestore:rules --dry-run --project tiizi-challenges
firebase deploy --only firestore:indexes --dry-run --project tiizi-challenges
npm run backfill:user-metrics
npm run backfill:support-summary
npm run backfill:group-counts
npm run backfill:catalog-template-fields
npm run backfill:discovery-fields
curl -s -I https://tiizi-challenges.web.app
curl -s https://tiizi-challenges.web.app
```

Additional read-only checks:

```bash
# Firebase Rules API release metadata, with gcloud access token and x-goog-user-project.
GET https://firebaserules.googleapis.com/v1/projects/tiizi-challenges/releases?pageSize=20
GET https://firebaserules.googleapis.com/v1/projects/tiizi-challenges/rulesets/eaecf30e-6f57-4a09-ad81-b688ac9b9b4e

# Admin SDK read-only production sampler.
# Checked userMetrics, memberHome, supportDonationSummary/current, groups, challenges, groupInvites.

gcloud logging read 'resource.type="cloud_run_revision" ... severity>=ERROR ...'
```

## Validation Output

All required validations passed.

| Check | Result |
| --- | --- |
| `test:home-challenge-feeds` | PASS |
| `test:home-performance-guards` | PASS |
| `test:pilot-ux-polish-guards` | PASS |
| `test:challenge-creation-backend` | PASS |
| `test:group-invite-backend` | PASS |
| `test:user-metrics-backfill-payload` | PASS |
| `npx tsc -b --pretty false` | PASS |
| `npm run build` | PASS |
| `npm --prefix functions run build` | PASS |
| `npm --prefix functions run lint` | PASS |

Build note:

```text
✓ 1845 modules transformed.
✓ built in 4.09s
vendor-firebase-BAvgB5Ib.js 528.33 kB │ gzip: 124.40 kB
```

The Firebase bundle-size warning remains expected after intentionally collapsing Firebase into one chunk to avoid the earlier Firebase circular chunk runtime crash.

## Deploy State

### Hosting

Status: **Live**

`firebase hosting:sites:list --project tiizi-challenges` returned:

- Site ID: `tiizi-challenges`
- Default URL: `https://tiizi-challenges.web.app`
- App ID: `1:481957935000:web:5f2cc8008fba5283ee1ded`

Production root request returned HTTP 200. The served HTML references the same asset hashes produced by the local build:

- `/assets/index-jEcYKKj_.js`
- `/assets/vendor-firebase-BAvgB5Ib.js`
- `/assets/index-CbsjwYUm.css`

Browser check opened production successfully and redirected to:

```text
https://tiizi-challenges.web.app/app/welcome
```

No blank-page regression was observed on the unauthenticated shell.

### Firestore Rules

Status: **Live and current**

Rules API release metadata:

```text
release: projects/tiizi-challenges/releases/cloud.firestore
ruleset: projects/tiizi-challenges/rulesets/eaecf30e-6f57-4a09-ad81-b688ac9b9b4e
updated: 2026-06-14T17:55:42.538549Z
```

Fetched live ruleset source confirms the deployed rules include the current hardening, including:

- `userMetrics/{userId}` read-own only, client writes denied.
- `memberHome/{userId}` read-own only, client writes denied.
- `supportDonationSummary/{summaryId}` authenticated read, client writes denied.
- `groupInvites`, `groupJoinRequests`, `groupAuditLogs` client writes denied.
- activity summary collections client writes denied.
- `challengeLeaderboards` client writes denied.
- support donations only owner/admin readable.
- group/challenge counter fields server-owned.

Dry-run rules validation:

```text
✔ cloud.firestore: rules file firestore.rules compiled successfully
✔ Dry run complete!
```

### Firestore Indexes

Status: **Ready**

`gcloud firestore indexes composite list` showed required member/catalog/discovery/invite indexes in `READY` state, including:

- `challenges`: `status + visibility + startDate desc`
- `challenges`: `status + groupVisibility + startDate desc`
- `challenges`: `groupId + status + startDate desc`
- `challengeMembers`: `userId + status`
- `groupMembers`: `userId + status`
- `groupInvites`: `groupId + createdAt desc`
- `challengeLeaderboards`: `challengeId + score desc`
- `challengeLeaderboards`: `challengeId + groupId + score desc`
- `groupLeaderboards`: `groupId + score desc`
- `groupMemberStats`: `groupId + score desc`
- catalog/template indexes for `status`, `visibility`, `isPublished`, `sortName`, category/difficulty filters.

Dry-run indexes command completed successfully. The installed Firebase CLI dry-run output reported Firestore deploy validation and rules compilation, while the authoritative live index state came from `gcloud`.

### Cloud Functions

Status: **Required functions active**

`gcloud functions list` shows the required functions active on `nodejs22`.

| Function | State | Updated |
| --- | --- | --- |
| `createChallengeWithCreatorMembership` | ACTIVE | 2026-06-14T12:30:55Z |
| `createGroupInvite` | ACTIVE | 2026-06-14T17:54:59Z |
| `listGroupInvites` | ACTIVE | 2026-06-14T17:55:01Z |
| `redeemGroupInvite` | ACTIVE | 2026-06-14T17:55:00Z |
| `revokeGroupInvite` | ACTIVE | 2026-06-14T17:55:02Z |
| `requestGroupJoin` | ACTIVE | 2026-06-14T17:55:01Z |
| `approveGroupJoinRequest` | ACTIVE | 2026-06-14T17:54:55Z |
| `rejectGroupJoinRequest` | ACTIVE | 2026-06-14T17:55:01Z |
| `onGroupMemberCreated` | ACTIVE | 2026-06-14T17:55:01Z |
| `onGroupMemberUpdated` | ACTIVE | 2026-06-14T17:55:00Z |
| `onGroupMemberDeleted` | ACTIVE | 2026-06-14T17:55:00Z |
| `onChallengeCreated` | ACTIVE | 2026-06-14T17:55:01Z |
| `onChallengeUpdated` | ACTIVE | 2026-06-14T17:55:01Z |
| `onChallengeDeleted` | ACTIVE | 2026-06-14T17:55:01Z |
| `onChallengeMemberCreated` | ACTIVE | 2026-06-14T17:55:01Z |
| `onChallengeMemberUpdated` | ACTIVE | 2026-06-14T17:55:01Z |
| `onChallengeMemberDeleted` | ACTIVE | 2026-06-14T17:55:02Z |
| `onWorkoutCreatedUpdateMemberSummaries` | ACTIVE | 2026-06-14T17:55:01Z |
| `onWellnessLogCreatedUpdateMemberSummaries` | ACTIVE | 2026-06-14T17:55:00Z |
| `onGroupMemberCreatedUpdateMemberSummaries` | ACTIVE | 2026-06-14T17:55:01Z |
| `onChallengeMemberCreatedUpdateMemberSummaries` | ACTIVE | 2026-06-14T17:55:01Z |
| `onChallengeMemberWrittenUpdateUserMetrics` | ACTIVE | 2026-06-14T17:55:01Z |
| `onGroupMemberWrittenUpdateUserMetrics` | ACTIVE | 2026-06-14T17:55:01Z |
| `onSupportDonationWrittenUpdateSummary` | ACTIVE | 2026-06-14T17:55:03Z |

Recent error log sweep:

```text
[]
```

No matching `severity>=ERROR` entries were found for the required functions since 2026-06-14T00:00:00Z.

## Backfill State

### userMetrics/memberHome

Status: **Completed**

Dry-run summary:

```json
{
  "usersProcessed": 30,
  "targetDocs": {
    "userMetrics": 30,
    "memberHome": 30
  },
  "readCounts": {
    "users": 30,
    "workouts": 519,
    "wellnessLogs": 0,
    "challengeMembers": 218,
    "groupMembers": 83,
    "challenges": 38
  }
}
```

Production sample check:

- `userMetrics` count: 30
- `memberHome` count: 30
- 5 sampled `userMetrics` docs included expected fields such as `totalActivitiesLogged`, `activeChallengesCount`, `joinedGroupsCount`, `updatedAt`, `sourceVersion`.
- 5 sampled `memberHome` docs included expected fields such as `activeChallengeCount`, `completedChallengeCount`, `joinedGroupCount`, `primaryActiveChallenge`, `generatedAt`.

### supportDonationSummary/current

Status: **Completed**

Dry-run recomputed summary:

```json
{
  "totalConfirmedAmount": 0,
  "donorCount": 0,
  "confirmedDonationCount": 0,
  "sourceVersion": "member-phase-6-v1"
}
```

Production document exists:

```json
{
  "totalConfirmedAmount": 0,
  "donorCount": 0,
  "confirmedDonationCount": 0,
  "generatedAt": "2026-06-14T17:56:19.975Z",
  "sourceVersion": "member-phase-6-v1"
}
```

### Group/Challenge Counters

Status: **Completed**

Dry-run summary:

```json
{
  "groupsProcessed": 7,
  "challengesProcessed": 27,
  "memberCountCorrections": 0,
  "activeChallengesCorrections": 0,
  "participantCountCorrections": 0,
  "writesPlanned": 0
}
```

Production samples show populated `groups.memberCount`, `groups.activeChallenges`, and `challenges.participantCount`.

Sample groups:

| Group | memberCount | activeChallenges |
| --- | ---: | ---: |
| `seed_group_early_birds` | 15 | 8 |
| `seed_group_hydration_crew` | 13 | 2 |
| `seed_group_squad_254` | 12 | 2 |
| `seed_group_strength_club` | 13 | 3 |
| `zGO3H0GUZyKwQhbLuNyQ` | 1 | 2 |

### Catalog/Template Fields

Status: **Completed**

Dry-run reported 0 writes planned across:

- `challengeTemplates`: scanned 5
- `wellnessTemplates`: scanned 8
- `catalogExercises`: scanned 113
- `wellnessActivities`: scanned 60

Missing `status`, `visibility`, `isPublished`, `sortName`, `category`, and `difficulty`: all 0.

### Discovery Fields

Status: **Completed**

Dry-run summary:

```json
{
  "readCounts": {
    "groups": 7,
    "challenges": 27
  },
  "writeCounts": {
    "groups": 0,
    "challenges": 0
  }
}
```

### groupInvites Legacy Mappings

Status: **Completed**

Direct production sample:

- `groupInvites` count: 7
- migrated legacy invite count: 7
- deterministic IDs present, e.g. `legacy_seed_group_early_birds`
- each sampled migrated invite has `migratedFrom == "groups.inviteCode"` and a `tokenHash`.
- duplicate token hashes: 0
- duplicate active migrated invites per group: 0

The script `npm run audit:invite-migration-readiness` could not run in this shell because it intentionally requires `GOOGLE_APPLICATION_CREDENTIALS`. This was not treated as a data failure because the Admin SDK direct production sampler verified the same critical readiness conditions read-only.

## Production Document Checks

| Check | Result |
| --- | --- |
| At least 5 `userMetrics` docs | PASS: 30 docs, 5 sampled |
| At least 5 `memberHome` docs | PASS: 30 docs, 5 sampled |
| `supportDonationSummary/current` | PASS: exists with expected fields |
| `groups.memberCount` values | PASS: sampled groups populated |
| `challenges.participantCount` values | PASS: sampled challenges populated |
| `groupInvites` legacy mappings | PASS: 7 migrated mappings, no duplicates |

## App Runtime Readiness

Verified:

- Production hosting returns HTTP 200.
- HTML serves current build asset hashes.
- Production app renders `/app/welcome` without blank screen.
- No startup blank-page regression observed.

Not fully verified in this audit:

- Authenticated Home/member runtime console after login.
- Browser console capture for signed-in routes.
- Callable invocation from the browser as a real member.

Reason: audit remained read-only and did not create/sign in/mutate production member data. The backend state strongly supports readiness, but a final human smoke test is still recommended.

## Missing or Failed Items

No production readiness blockers found.

Non-blocking issues/limitations:

1. Firebase CLI `functions:list` and `firestore:indexes` request paths failed in this shell with generic request/update-check errors, but `gcloud` returned the needed live state successfully.
2. `firebase firestore:rules:get` is not available in this Firebase CLI version. Live rules were verified through the Firebase Rules REST API instead.
3. `npm run audit:invite-migration-readiness` requires `GOOGLE_APPLICATION_CREDENTIALS`; direct Admin SDK production sampling verified the invite state without writes.
4. Authenticated browser console/runtime was not exercised in this audit.

## Recommended Next Step

Proceed with a **closed pilot GO** after one final manual authenticated smoke test:

1. Sign in as a normal pilot member.
2. Confirm Home loads without missing summary warnings.
3. Browse groups and challenges.
4. Join a public group/challenge.
5. Log one activity.
6. Confirm metrics update after function processing.
7. Confirm browser console has no app Firebase permission/index/callable errors.

No deploy or backfill is required based on this audit.

