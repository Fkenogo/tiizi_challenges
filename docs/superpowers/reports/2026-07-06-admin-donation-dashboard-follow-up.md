# Phase 18I-6Y Follow-up — Admin Donation Dashboard Classification, Identity, Duration

**Date:** 2026-07-06
**Branch:** fix/p0-pre-deploy-blockers

---

## Problems Fixed

| # | Problem | Root Cause | Fix |
|---|---------|-----------|-----|
| 1 | Seed/demo campaigns showed in Platform Support | `donationCampaigns` collection docs had no `source` field — classified as `'platform'` | Changed to `source: 'legacy'`; virtual campaign is now `'platform_support'` |
| 2 | Contribution records showed raw `userId` | No user identity lookup in `getChallengePledgesForAdmin` or support detail | Added `getUserDisplayMap()` batch lookup; `AdminChallengePledge` now has `displayName`/`email` |
| 3 | Platform Support detail view too thin | `CampaignDetailPanel` had no records section for platform campaigns | Added `getPlatformSupportForDetail()` + `usePlatformSupportForDetail`; panel shows full support record table with name, email, amount, currency, frequency, status, date |
| 4 | Cause campaign had no donation duration | `timingStartDate`/`timingEndDate` not read in admin or user-facing views | Added `timingStartDate`/`timingEndDate` to `DonationCampaign`; detail panel shows window with days remaining / expired label |
| 5 | Expired campaigns still showed contribution CTA | No expiry check in `ChallengeDetailScreen` | Added `isExpired` computed from `contributionEndDate < today`; folded into `campaignSuspended` — CTA hidden when expired |

---

## Files Modified

| File | Change |
|------|--------|
| `src/services/adminDonationService.ts` | `DonationCampaign.source` type: `'platform_support' \| 'challenge_cause' \| 'legacy'`; `DonationTransaction.source` updated; `DonationReports.bySource` updated; `AdminChallengePledge` gains `displayName?`/`email?`; added `timingStartDate`/`timingEndDate` to `DonationCampaign`; `legacyCampaigns` now `source: 'legacy'`; virtual campaign `source: 'platform_support'`; `isExpired` computed in `getCampaigns()`; added `getUserDisplayMap()`; updated `getChallengePledgesForAdmin()` to resolve identities; added `getPlatformSupportForDetail()` |
| `src/hooks/useAdminDonations.ts` | Added `usePlatformSupportForDetail()` hook |
| `src/features/Admin/Donations/DonationCampaignsScreen.tsx` | `FilterKey` and all filter logic updated to `platform_support`; import `usePlatformSupportForDetail`; contribution rows show `displayName`/`email` instead of raw `userId`; cause campaign detail shows timing window with days remaining / expired badge; Platform Support detail panel shows full support records table; campaign card badge distinguishes Platform / Cause / Legacy |
| `src/features/Admin/Donations/DonationReportsScreen.tsx` | `bySource.platform` → `bySource.platform_support` |
| `src/features/Challenges/ChallengeDetailScreen.tsx` | Added `isExpired` from `contributionEndDate < today`; folded into `campaignSuspended` — CTA hidden and "temporarily unavailable" shown |
| `scripts/testAdminDonationDashboardGuards.ts` | 12 new assertions: source classification, legacy exclusion, user identity, platform support detail, timing dates, expiry detection |

---

## Key Design Decisions

### Source classification
Three source values now clearly separated:
- `'platform_support'` — only the virtual `tiizi_platform_support` campaign (aggregates `supportDonations`)
- `'challenge_cause'` — cause challenges with `donation.enabled = true`
- `'legacy'` — old `donationCampaigns` Firestore collection docs (seed/demo)

### User identity batch lookup
`getUserDisplayMap(userIds: string[])` reads `users/{uid}` in parallel using `Promise.all`. Uses the same `deriveDisplayName`/`deriveEmail` pattern as `adminUserService.ts`. Fallback: `User ${uid.slice(0, 6)}`.

### Expiry
`isExpired = timingEndDate && timingEndDate < today` (YYYY-MM-DD string comparison). No Firestore write — computed at read time. Admin dashboard shows `(expired)` badge; user-facing CTA is hidden (same path as paused/suspended).

---

## Test Results

```
✅ All admin donation dashboard guards passed. (49 assertions)
✅ All Support Tiizi pilot donation guards passed (multi-currency).
✅ All cause donation pledge flow guards passed.
tsc --noEmit: 0 errors
npm run build: ✓ built in 3.80s
```
