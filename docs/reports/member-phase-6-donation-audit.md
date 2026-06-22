# Member Phase 6 Pre-Audit: Donation Data Access & Aggregation

Date: 2026-06-10

## Decision

**A. Phase 6 is still required.**

The scope is narrower than a full donation rewrite, but there is still a pilot-readiness gap:

- Member-facing platform support progress is calculated by reading raw `supportDonations` records with `status == "confirmed"`.
- Firestore rules allow any authenticated user to read all confirmed `supportDonations` documents.
- Admin donation reporting is already materialized through `adminMetrics/revenue`, but that aggregate is admin-only and cannot safely serve the member app.

## Architecture

```mermaid
flowchart TD
  "DonateScreen" --> "useSupportDonationSettings"
  "DonateScreen" --> "useConfirmedSupportTotal"
  "DonateScreen" --> "useSupportPreference"
  "ProfileScreen" --> "useSupportDonationSettings"
  "ProfileScreen" --> "useConfirmedSupportTotal"
  "ChallengeDetailScreen" --> "useChallengeContribution"
  "ChallengeDetailScreen" --> "challenge.donation embedded fields"

  "useSupportDonationSettings" --> "supportDonationSettings/current"
  "useSupportPreference" --> "supportDonationPreferences/{uid}"
  "useConfirmedSupportTotal" --> "supportDonations where status == confirmed"
  "useChallengeContribution" --> "challengeContributionPledges where challengeId == X and userId == uid"
  "challenge.donation embedded fields" --> "challenges/{challengeId}"

  "Admin donation reports" --> "adminMetrics/revenue"
  "Admin campaign lists" --> "donationCampaigns + challenges donation fields"
  "Admin transaction lists" --> "donationTransactions + supportDonations + challengeContributionPledges"
```

## Collection Inventory

Counts were checked against project `tiizi-challenges` using Admin SDK count aggregation.

| Collection | Count | Purpose | Key fields observed |
|---|---:|---|---|
| `donations` | 0 | Legacy/unused donation namespace. | None observed. |
| `donationCampaigns` | 3 | Legacy campaign records, admin-only. | `goalAmount`, `raisedAmount`, `donorCount`, `status`, `startDate`, `endDate`. |
| `donationReports` | 0 | No active report collection found. | None observed. |
| `donationTransactions` | 28 | Legacy/admin transaction rows. | `campaignId`, `campaignName`, `donorName`, `donorEmail`, `amount`, `currency`, `status`, `createdAt`. |
| `supportDonations` | 0 | Platform support intents, pending confirmations, confirmed support. | Expected fields from code: `userId`, `amountKes`, `frequency`, `trigger`, `paymentMethod`, `paymentDestination`, `transactionId`, `source`, `status`, `createdAt`, `updatedAt`. |
| `supportDonationSettings` | 1 | Member-visible support configuration. | `active`, `title`, `subtitle`, `ctaLabel`, `goalAmountKes`, `currency`, `suggestedAmountsKes`, `manualPaymentNote`, payment destination fields. |
| `supportDonationPreferences` | 0 | Per-user support preference. | `userId`, `preferredFrequency`, `preferredTrigger`, `updatedAt`. |
| `challengeContributionPledges` | 0 | Challenge/cause pledge or skip records. | Expected fields from code/rules: `id`, `challengeId`, `groupId`, `userId`, `amountKes`, `status`, `createdAt`, optional timing/payment fields. |
| `adminMetrics/revenue` | 1 doc | Materialized admin revenue aggregate. | `totalConfirmedDonations`, `platformSupportConfirmed`, `pendingSupportTotal`, `challengeDonationsConfirmed`, `confirmedTransactions`, `pendingTransactions`, `breakdown`, `recentDonations`. |
| `challenges` embedded `donation` | 6 enabled challenge docs | Challenge/cause configuration. | Current sample fields are legacy-shaped: `enabled`, `causeDescription`, `targetAmount`. Current counts: 6 enabled, 0 approved, 0 accepting donations. |

## Member Query Inventory

| Screen / path | Hook/service | Query | Read pattern | Risk |
|---|---|---|---|---|
| `DonateScreen` | `useSupportDonationSettings` -> `getSupportDonationSettings()` | `getDoc(supportDonationSettings/current)` | 1 doc | Safe |
| `DonateScreen` | `useSupportPreference` -> `getSupportPreference(uid)` | `getDoc(supportDonationPreferences/{uid})` | 1 own doc | Safe |
| `DonateScreen` | `useConfirmedSupportTotal` -> `getConfirmedSupportTotal()` | `getDocs(query(supportDonations, where(status == confirmed)))` | Reads every confirmed platform support record and sums client-side | High |
| `DonateScreen` submit | `createSupportDonation()` | `setDoc(supportDonations/{newId})` | 1 write | Safe shape, but writes `undefined` optional fields may depend on Firestore ignoreUndefined handling |
| `DonateScreen` payment reference | `confirmSupportDonation()` | `getDoc(supportDonations/{id})`, then merge update | 1 read + 1 update | Safe owner check in service and rules |
| `ProfileScreen` support card | `useSupportDonationSettings` | `getDoc(supportDonationSettings/current)` | 1 doc | Safe |
| `ProfileScreen` support card | `useConfirmedSupportTotal` | Same raw confirmed support scan | Reads every confirmed support record | High |
| `ChallengeDetailScreen` | `useChallengeContribution` -> `getUserChallengeContribution(challengeId, uid)` | `getDocs(challengeContributionPledges where challengeId == X and userId == uid)` | Bounded by user/challenge but no `limit(1)` or `orderBy` | Medium |
| `ChallengeDetailScreen` | `useChallenge` | `getDoc(challenges/{id})` via challenge hook | 1 challenge doc includes donation config | Safe, but legacy donation fields may make donations unavailable |
| `HomeScreen` | none direct | No donation hook currently mounted | No donation read | Safe |

File references:

- [donationService.ts](/Users/theo/tiizi_revamp/src/services/donationService.ts:71)
- [useDonations.ts](/Users/theo/tiizi_revamp/src/hooks/useDonations.ts:23)
- [DonateScreen.tsx](/Users/theo/tiizi_revamp/src/features/Donate/DonateScreen.tsx:27)
- [ProfileScreen.tsx](/Users/theo/tiizi_revamp/src/features/Profile/ProfileScreen.tsx:18)
- [ChallengeDetailScreen.tsx](/Users/theo/tiizi_revamp/src/features/Challenges/ChallengeDetailScreen.tsx:37)

## Admin Query Notes

The requested `DonationCampaignsScreen` and `DonationReportsScreen` are admin screens, not member app screens.

- Admin campaign list uses paginated queries across `donationCampaigns` and donation-enabled `challenges`.
- Admin transaction list uses paginated queries across `donationTransactions`, `supportDonations`, and `challengeContributionPledges`.
- Admin reports read `adminMetrics/revenue` only.

This means the admin reporting side is effectively materialized already. The gap is the member-visible support progress path.

## Security Findings

### Finding 1: Confirmed support donations are readable by all authenticated users

Current rule:

```rules
allow read: if isAuthenticated()
            && (
              resource.data.userId == request.auth.uid
              || resource.data.status == 'confirmed'
              || canAccessAdmin()
            );
```

Impact:

- A normal authenticated user can read every `supportDonations` document with `status == "confirmed"`.
- This exposes raw donor records rather than a safe aggregate.
- Depending on document contents, this can expose `userId`, amount, frequency, payment method, payment destination, transaction reference, and timestamps.

Risk: **High** once real support donations exist.

### Finding 2: Challenge pledge reads are restricted better

`challengeContributionPledges` reads are allowed only for:

- pledge owner
- admin
- challenge creator

This avoids exposing all pledge records to ordinary members.

Risk: **Low to Medium**, because challenge creators can see pledge records for their challenge. That may be intended for coordination, but should be a conscious product decision.

### Finding 3: Campaign and transaction collections are admin-only

`donationCampaigns` and `donationTransactions` are readable only by `canAccessAdmin()`.

Risk: **Low** for member app exposure.

### Finding 4: Support settings are member-readable

`supportDonationSettings/current` is readable by any authenticated user. This is expected because it drives the member Donate screen.

Risk: **Low**, assuming no secret payment credentials are stored there beyond intended public/manual payment instructions.

## Performance Findings

### Member Donate screen

Current first render reads:

- `supportDonationSettings/current`: 1 read
- `supportDonationPreferences/{uid}`: 1 read
- all confirmed `supportDonations`: N reads

Current production N is 0, but this grows linearly with every confirmed support donation.

### Profile support card

Current support card reads:

- `supportDonationSettings/current`: 1 read
- all confirmed `supportDonations`: N reads

This is repeated on a high-traffic member page.

### Challenge detail donation block

Current donation-related reads:

- challenge doc already loaded for detail
- user's pledge query for current challenge/user

This is acceptable for pilot. Add `limit(1)` later to prevent duplicate pledge history from growing the read count.

## Existing Aggregate Audit

Search terms reviewed:

- `totalRaised`
- `donorCount`
- `donationTotals`
- `campaignTotals`
- `aggregate`
- `summary`
- `metrics`

Findings:

- `adminMetrics/revenue` exists and is populated by `functions/src/adminMetricsCore.ts`.
- `adminDonationService.getReports()` reads `adminMetrics/revenue`, not raw donation collections.
- Legacy `donationCampaigns` include stored `raisedAmount` and `donorCount`.
- Challenge docs may include denormalized `donation.pledgedAmountKes`, `donation.pendingAmountKes`, `donation.confirmedAmountKes`, `donation.pledgeCount`, or `donation.donorCount`, but current production enabled challenge samples only have legacy fields.
- No member-readable platform support aggregate exists.

## Phase 6 Gaps

Phase 6 is still required for:

1. **Member-safe platform support aggregate**
   - Add a member-readable aggregate such as `supportDonationSummary/current` or `publicMetrics/support`.
   - Fields should include confirmed support total, donor count, pending/unverified amount if product wants to show it, generatedAt, and sourceVersion.

2. **Rules hardening after aggregate exists**
   - Change `supportDonations` read so normal users can read only their own records.
   - Keep admins able to read all.
   - Remove `resource.data.status == 'confirmed'` as a broad member read path.

3. **Update member screens**
   - `DonateScreen` and `ProfileScreen` should read the aggregate instead of scanning confirmed `supportDonations`.

4. **Challenge pledge query tightening**
   - Add `orderBy(createdAt, desc)` + `limit(1)` to `getUserChallengeContribution()`.
   - This is not urgent at current count 0, but prevents duplicate pledge records from becoming a slow read.

5. **Donation field backfill/normalization for challenge causes**
   - Six production challenges have `donation.enabled == true`, but zero have approved/accepting fields.
   - Hardened rules and client code require `donation.approvalStatus == "approved"` and `donation.acceptingDonations == true`; current legacy-shaped docs will not accept pledges.

## Roadmap Items That Can Be Removed or Downgraded

- Admin donation reports do not need a new runtime aggregate design; they already read `adminMetrics/revenue`.
- Admin donation list pagination has already been addressed and should remain separate from member Phase 6.
- No member-facing screen currently reads `donationTransactions` or `donationCampaigns` directly.

## Recommendation

Proceed with a focused Phase 6 implementation:

1. Create `supportDonationSummary/current` as a server-generated/member-readable aggregate.
2. Populate it from Cloud Functions when `supportDonations` change and from an admin backfill script.
3. Update `DonateScreen` and `ProfileScreen` to use the aggregate.
4. Tighten `supportDonations` rules so members can read only their own donation records.
5. Add `limit(1)` and deterministic ordering to the current user's challenge pledge query.
6. Backfill or admin-review legacy donation-enabled challenges so donation approval/accepting fields are explicit.

Expected read reduction after Phase 6:

- Donate screen support progress: `N confirmed support donation reads -> 1 aggregate doc read`
- Profile support card: `N confirmed support donation reads -> 1 aggregate doc read`

Expected privacy improvement:

- Members no longer need broad read access to confirmed donor records.
