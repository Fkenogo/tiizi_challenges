# CHANGELOG — Admin Donation Dashboard Follow-up (2026-07-06)

## Phase 18I-6Y Follow-up

### Changed

- **`DonationCampaign.source`** — type changed from `'platform' | 'challenge_cause'` to `'platform_support' | 'challenge_cause' | 'legacy'` to clearly separate real-time platform support from seed/legacy campaigns
- **`DonationTransaction.source`** — updated to match: `'platform_support' | 'challenge_cause' | 'legacy'`
- **`DonationReports.bySource`** — key renamed `platform` → `platform_support`
- **`adminDonationService.getCampaigns()`** — `donationCampaigns` collection docs now classified as `source: 'legacy'` (previously `'platform'`); virtual Tiizi App Support campaign is `source: 'platform_support'`; added `isExpired` computation from `timingEndDate < today` — expired campaigns derive status `'completed'` without any Firestore write; added `timingStartDate`/`timingEndDate` fields on cause campaign objects
- **`adminDonationService.getChallengePledgesForAdmin()`** — now resolves contributor identity via `getUserDisplayMap()`; returned pledges include `displayName` and `email`
- **`DonationCampaignsScreen`** — `FilterKey` changed `'platform'` → `'platform_support'`; filter chip label "Platform" → "Platform Support"; KPI platform total uses `platform_support` source; campaign card badge shows "Platform" / "Cause" / "Legacy"; cause campaign detail panel shows timing window with days remaining or `(expired)`; contribution rows show resolved display name + email instead of raw `userId`
- **`DonationReportsScreen`** — `bySource.platform` → `bySource.platform_support`
- **`ChallengeDetailScreen`** — `campaignSuspended` now also true when `contributionEndDate < today` (expired campaigns hide CTA, show "temporarily unavailable")

### Added

- **`adminDonationService.getUserDisplayMap(userIds)`** — batch reads `users/{uid}` docs using the same `deriveDisplayName`/`deriveEmail` pattern as `adminUserService`; returns `Map<uid, { displayName, email }>`
- **`adminDonationService.getPlatformSupportForDetail()`** — reads up to 200 `supportDonations` records with resolved display names; used in the Platform Support campaign detail panel
- **`DonationCampaign.timingStartDate`** and **`.timingEndDate`** — contribution window dates from `challenge.donation.contributionStartDate/EndDate`
- **`AdminChallengePledge.displayName`** and **`.email`** — resolved from users collection; shown in contribution table instead of raw userId
- **`usePlatformSupportForDetail()`** hook — wraps `getPlatformSupportForDetail()` with React Query
- **Platform Support records section** in `CampaignDetailPanel` — shows full support records table (name, email, amount, currency, frequency, status, date) when viewing the `tiizi_platform_support` campaign
- **12 new guard assertions** in `scripts/testAdminDonationDashboardGuards.ts` covering source classification, legacy exclusion, user identity resolution, platform support detail, timing dates, and expiry detection

### Removed

- `'platform'` as a valid source value — replaced by `'platform_support'` (platform) and `'legacy'` (seed/demo data)
