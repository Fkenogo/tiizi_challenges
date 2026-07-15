# Member Phase 6: Support Donation Aggregate Implementation

Date: 2026-06-10

## Summary

Implemented the focused Phase 6 donation fix:

- Added member-safe aggregate `supportDonationSummary/current`.
- Switched member support progress reads away from raw `supportDonations`.
- Hardened Firestore rules so normal members can read only their own `supportDonations`.
- Added a Cloud Function trigger to refresh the aggregate when `supportDonations` changes.
- Added dry-run/apply backfill script.
- Bounded the current user's challenge contribution query with `orderBy(createdAt, desc)` and `limit(1)`.

No deploy was performed.

## Files Changed

- `functions/src/supportDonationSummary.ts`
- `functions/src/index.ts`
- `src/services/donationService.ts`
- `firestore.rules`
- `firestore.indexes.json`
- `scripts/backfillSupportDonationSummary.ts`
- `package.json`
- `docs/reports/member-phase-6-support-donation-aggregate.md`

## Aggregate Schema

Collection/document:

`supportDonationSummary/current`

Fields:

- `totalConfirmedAmount`
- `donorCount`
- `confirmedDonationCount`
- `generatedAt`
- `sourceVersion`

The aggregate contains no donor identities, transaction details, payment destinations, payment references, or raw support donation records.

## Aggregate Generation

Added shared generator:

`rebuildSupportDonationSummary(db, options)`

Source:

- `supportDonations where status == "confirmed"`

Writes:

- `supportDonationSummary/current`

Cloud Function added:

- `onSupportDonationWrittenUpdateSummary`

Trigger:

- `supportDonations/{donationId}` on document write

This covers create, update, confirm, cancel, reject, refund, and delete-style changes because any write refreshes the aggregate from the current confirmed records.

## Backfill Script

Added:

- `scripts/backfillSupportDonationSummary.ts`

Commands:

```bash
npm run backfill:support-summary
CONFIRM_PROJECT_ID=tiizi-challenges npm run backfill:support-summary:apply
```

Dry-run output:

```json
{
  "mode": "dry-run",
  "generatedAt": "2026-06-10T15:28:36.636Z",
  "durationMs": 2680,
  "readCounts": {
    "supportDonations": 0
  },
  "writeCounts": {
    "supportDonationSummary": 0
  },
  "summary": {
    "totalConfirmedAmount": 0,
    "donorCount": 0,
    "confirmedDonationCount": 0,
    "generatedAt": "2026-06-10T15:28:36.636Z",
    "sourceVersion": "member-phase-6-v1"
  },
  "projectId": "tiizi-challenges"
}
```

The first sandboxed run failed because `tsx` could not create its temporary IPC pipe. The command was rerun with escalation and completed successfully as a dry-run with no writes.

## Member App Changes

Updated:

- `donationService.getConfirmedSupportTotal()`

Old behavior:

- `getDocs(query(supportDonations, where("status", "==", "confirmed")))`
- client-side sum
- client-side donor count

New behavior:

- `getDoc(supportDonationSummary/current)`
- maps `totalConfirmedAmount` to existing `amountKes`
- maps `donorCount` to existing return shape
- missing aggregate returns `{ amountKes: 0, donorCount: 0 }`

Affected screens:

- `DonateScreen`
- `ProfileScreen`

These screens already consume `useConfirmedSupportTotal()`, so no UI wiring changes were required beyond the service replacement.

## Rule Changes

### `supportDonations`

Removed broad member read access to confirmed donations.

Old behavior:

- owner can read
- any authenticated user can read confirmed donation records
- admins can read all

New behavior:

- owner can read only their own support donations
- admins can read all
- normal members cannot read other members' confirmed donations

### `supportDonationSummary`

Added:

```rules
match /supportDonationSummary/{summaryId} {
  allow read: if isAuthenticated();
  allow create, update, delete: if false;
}
```

The summary is safe for any authenticated member to read.

## Challenge Contribution Query Cleanup

Updated:

`donationService.getUserChallengeContribution(challengeId, userId)`

New query:

- `where("challengeId", "==", challengeId)`
- `where("userId", "==", userId)`
- `orderBy("createdAt", "desc")`
- `limit(1)`

Added index:

```json
{
  "collectionGroup": "challengeContributionPledges",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "challengeId", "order": "ASCENDING" },
    { "fieldPath": "userId", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

## Donation-Enabled Challenge Audit

Read-only production audit against `tiizi-challenges`:

```json
{
  "donationEnabledCount": 6,
  "missingApprovalStatus": 6,
  "missingAcceptingDonations": 6
}
```

Donation-enabled challenge docs missing both `donation.approvalStatus` and `donation.acceptingDonations`:

| Challenge ID | Name | Group | Status | Donation keys |
|---|---|---|---|---|
| `seed_challenge_01` | Early 30-Day Core Blast | `seed_group_early_birds` | active | `causeDescription`, `enabled`, `targetAmount` |
| `seed_challenge_04` | Zen 30-Day Core Blast | `seed_group_zen_yoga` | active | `causeDescription`, `enabled`, `targetAmount` |
| `seed_challenge_07` | Strength 30-Day Core Blast | `seed_group_strength_club` | active | `causeDescription`, `enabled`, `targetAmount` |
| `seed_challenge_10` | Squad 30-Day Core Blast | `seed_group_squad_254` | active | `causeDescription`, `enabled`, `targetAmount` |
| `seed_challenge_13` | Trail 30-Day Core Blast | `seed_group_trail_seekers` | active | `causeDescription`, `enabled`, `targetAmount` |
| `seed_challenge_16` | Hydration 30-Day Core Blast | `seed_group_hydration_crew` | active | `causeDescription`, `enabled`, `targetAmount` |

No challenge records were modified.

## Validation Output

`npx tsc -b`

- Passed.

`npm run build`

- Passed.
- Vite production build completed successfully.

`npm --prefix functions run build`

- Passed.

`npm --prefix functions run lint`

- Passed.

`firebase deploy --only firestore:rules --dry-run --project tiizi-challenges`

- Passed.
- `firestore.rules` compiled successfully.

`firebase deploy --only firestore:indexes --dry-run --project tiizi-challenges`

- Passed.
- Dry-run complete.

`npm run backfill:support-summary`

- Passed after sandbox escalation.
- Dry-run only; no writes applied.

## Deployment Needed After Review

```bash
firebase deploy --only functions:onSupportDonationWrittenUpdateSummary --project tiizi-challenges
firebase deploy --only firestore:rules --project tiizi-challenges
firebase deploy --only firestore:indexes --project tiizi-challenges
npm run build
firebase deploy --only hosting --project tiizi-challenges
CONFIRM_PROJECT_ID=tiizi-challenges npm run backfill:support-summary:apply
```

The index deploy is needed for the bounded `challengeContributionPledges` query.

## Remaining Notes

- The aggregate will show zero until the apply backfill writes `supportDonationSummary/current` or a support donation write triggers the function after deployment.
- Admin reporting remains on `adminMetrics/revenue`; no admin redesign was needed.
- Challenge/cause donation availability is still blocked for the six legacy-shaped donation-enabled challenges until an explicit admin/backfill decision sets approval and accepting fields.
