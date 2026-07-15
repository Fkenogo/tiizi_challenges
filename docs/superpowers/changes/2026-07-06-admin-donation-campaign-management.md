# CHANGELOG — Admin Donation Campaign Management (2026-07-06)

## Phase 18I-6Y

### Changed

- **`adminDonationService.getCampaigns()`** — now separates `confirmedAmount` (status === 'confirmed') from `pendingAmount` (status === 'pledged'); uses `pledgedAmount ?? amountKes` for correct amounts; uses `currency` field from pledges instead of hardcoding KES; reads `donation.campaignStatus` for admin-controlled campaign status; includes "Tiizi App Support" as a virtual platform campaign
- **`adminDonationService.getTransactions()`** — now includes `confirmed` pledges (not only `pledged`); uses `pledgedAmount`; uses correct `currency` from pledge; uses `causeName` as campaign name; maps confirmed pledges to `confirmed_by_user` status (not `success`)
- **`adminDonationService.getReports()`** — counts only `confirmed_by_user` and `success` as confirmed; top campaigns show per-campaign currency
- **`DonationCampaignsScreen`** — full rebuild with KPI cards, filter chips, search input, campaign card list, and `CampaignDetailPanel` slide-over
- **`DonationReportsScreen`** — removed hardcoded "KES" from all totals; added mixed-currency disclaimer; top campaigns show per-campaign currency; uses "confirmed by users" copy throughout
- **`ChallengeDetailScreen`** — reads `donation.campaignStatus`; hides contribution CTA when paused/suspended; shows "Support temporarily unavailable" message

### Added

- **`adminDonationService.updateCampaignStatus(challengeId, campaignStatus)`** — writes `donation.campaignStatus` to `challenges/{id}` via `updateDoc` merge; used by admin to pause/resume/suspend/complete cause campaigns
- **`adminDonationService.getChallengePledgesForAdmin(challengeId)`** — returns all pledges for a challenge (all statuses except skipped), sorted by createdAt desc
- **`DonationCampaign.confirmedAmount`** — sum of confirmed pledge amounts
- **`DonationCampaign.pendingAmount`** — sum of pledged-but-not-confirmed amounts
- **`DonationCampaign.contributorCount`** — unique confirmed contributor count
- **`DonationCampaign.currency`** — per-campaign currency
- **`DonationCampaign.campaignStatus`** — admin-controlled status field
- **`DonationCampaign.challengeId`** and **`challengeName`** — for cause campaign linking
- **`DonationCampaign.approvalStatus`** — donation approval status from challenge
- **`DonationTransaction.causeName`** — displayed in transaction list
- **`DonationTransaction.status: 'confirmed_by_user'`** — replaces 'success' for manual user-confirmed payments
- **`useChallengePledgesAdmin(challengeId)`** hook — queries admin pledge detail for a challenge
- **`useUpdateCampaignStatus()`** hook — calls `updateCampaignStatus`, invalidates campaign query cache
- **`CampaignDetailPanel`** component (inside DonationCampaignsScreen) — slide-over with campaign summary, payment channel note, admin actions, contribution records table
- **`scripts/testAdminDonationDashboardGuards.ts`** — 37 assertions covering platform/cause separation, confirmed totals, pending totals, KPI cards, action buttons, detail view, contribution list fields, terminology, Firestore write methods, user-facing enforcement

### Removed

- Hardcoded "KES" from `DonationReportsScreen` KPI cards and top campaigns list
- Old simple `<table>` in `DonationCampaignsScreen` (replaced by card list + detail panel)
