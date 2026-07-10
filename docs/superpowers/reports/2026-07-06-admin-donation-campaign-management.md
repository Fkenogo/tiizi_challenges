# Phase 18I-6Y — Admin Donation Campaign Management Report

**Date:** 2026-07-06
**Branch:** fix/p0-pre-deploy-blockers

---

## Audit Findings (pre-implementation)

### What existed
- `DonationCampaignsScreen` — basic table, no filters, no detail view, no actions
- `DonationListScreen` — decent transaction table with filters and pagination
- `DonationReportsScreen` — KPI cards, hardcoded "KES" everywhere
- `adminDonationService` — `getCampaigns()` existed but:
  - Did not separate confirmed vs pending pledge amounts
  - Used only `amountKes` (not `pledgedAmount`) from pledges
  - Hardcoded `'KES'` for pledge currency
  - Did not include platform Support Tiizi as a virtual campaign
  - Had no `updateCampaignStatus` method
  - Had no per-challenge pledge detail query
- No campaign status management (pause/resume/suspend/complete)
- No campaign detail screen or modal

### Gaps identified
| Gap | Severity | Fixed |
|---|---|---|
| Confirmed vs pending not separated | High | ✅ |
| Pledge currency hardcoded to KES | High | ✅ |
| No campaign detail view | High | ✅ |
| No pause/resume/suspend/complete actions | High | ✅ |
| Platform support not in campaign list | Medium | ✅ |
| Reports hardcode "KES" | Medium | ✅ |
| Old pledge amount field (`amountKes`) used instead of `pledgedAmount` | Medium | ✅ |
| Transactions mapped `pledged` status only (skipped `confirmed` pledges) | Medium | ✅ |

---

## Files Modified

| File | Change |
|---|---|
| `src/services/adminDonationService.ts` | Major rewrite: extended `DonationCampaign` type, fixed `getCampaigns()` (confirmed/pending split, currency, campaignStatus), added `updateCampaignStatus`, added `getChallengePledgesForAdmin`, fixed `getTransactions()` (correct amounts/currency/status), fixed `getReports()` |
| `src/hooks/useAdminDonations.ts` | Added `useChallengePledgesAdmin`, `useUpdateCampaignStatus` |
| `src/features/Admin/Donations/DonationCampaignsScreen.tsx` | Full rebuild: KPI cards, filter chips, search, campaign cards, `CampaignDetailPanel` slide-over with summary/actions/contribution records |
| `src/features/Admin/Donations/DonationReportsScreen.tsx` | Removed hardcoded "KES", added mixed-currency disclaimer, fixed top campaigns to show per-campaign currency |
| `src/features/Challenges/ChallengeDetailScreen.tsx` | Added `campaignSuspended` check; hides contribution CTA when `donation.campaignStatus === 'paused' | 'suspended'`; shows "Support temporarily unavailable" |
| `scripts/testAdminDonationDashboardGuards.ts` | New guard script (37 assertions) |

---

## Key Design Decisions

### Campaign status storage
`donation.campaignStatus` is written on the `challenges/{id}` doc as a sub-field via `updateDoc(ref, { 'donation.campaignStatus': value })`. This is separate from:
- `moderationStatus` (content moderation lifecycle)
- `status` (challenge active/completed lifecycle)

Campaign status is admin-only and controls fundraising CTA visibility only.

### Confirmed vs Pending amounts
Previously all pledges (regardless of status) were summed as `raisedAmount`. Now:
- `confirmedAmount` = sum of `pledgedAmount` where `status === 'confirmed'` (user marked as sent)
- `pendingAmount` = sum of `pledgedAmount` where `status === 'pledged'` (intent only)
- `contributorCount` = unique userIds with a `confirmed` pledge

### Transaction status terminology
| Status | Meaning |
|---|---|
| `pledged` | User expressed intent, has not confirmed sending |
| `confirmed_by_user` | User tapped "I've Sent My Contribution" — self-reported only |
| `success` | Legacy payment system (pre-Tiizi manual flow) |

Never uses "payment verified" or "payment successful" for manual flows.

---

## Campaign Management Actions

Available for `challenge_cause` campaigns only (platform campaigns have no pause/resume):

| Action | Firestore write | User-facing effect |
|---|---|---|
| Resume → `active` | `donation.campaignStatus = 'active'` | CTA visible again |
| Pause → `paused` | `donation.campaignStatus = 'paused'` | CTA hidden, "temporarily unavailable" shown |
| Suspend → `suspended` | `donation.campaignStatus = 'suspended'` | Same as paused |
| Mark Completed → `completed` | `donation.campaignStatus = 'completed'` | CTA hidden |

Historical pledges are never deleted.

---

## Firestore / Index Changes

None. Existing admin rules (`canModerateChallenges()`) already allow writes to `challenges/{id}`. Single-field index on `challengeContributionPledges.challengeId` is auto-created by Firestore.

---

## Risks / Limitations

1. **Mixed-currency KPI totals** — confirmed raised total is a numeric sum across KES, RWF, UGX. Not currency-converted. Displayed with "mixed currencies" disclaimer.
2. **Admin contributor list shows userId, not display name** — requires a separate user profile lookup. Documented as future enhancement.
3. **`getChallengePledgesForAdmin` reads all pledges for a challenge in memory** — suitable for typical group sizes; may be slow for large campaigns (>1000 pledges).
4. **Platform Support Tiizi virtual campaign** — currency reported as KES since that's what `amountKes` field stores. Multi-currency support donations show amount in selected currency via `currency` field, but `amountKes` is always used for KES-equivalent tallying.

---

## Rollback Instructions

1. Revert `src/services/adminDonationService.ts` to previous version.
2. Revert `src/hooks/useAdminDonations.ts` — remove `useChallengePledgesAdmin`, `useUpdateCampaignStatus`.
3. Revert `src/features/Admin/Donations/DonationCampaignsScreen.tsx`.
4. Revert `src/features/Admin/Donations/DonationReportsScreen.tsx`.
5. Revert `ChallengeDetailScreen.tsx` — remove `campaignSuspended` check.

All changes are isolated to admin donation screens and the cause donation CTA enforcement. No shared infrastructure was modified.

---

## Manual Test Checklist

### KPI Cards
- [ ] Navigate to `/app/admin/donations/campaigns`
- [ ] Verify 6 KPI cards render without errors
- [ ] Verify "Active campaigns" count matches expected
- [ ] Verify "Confirmed raised" shows 0 when no confirmed pledges exist

### Campaign List
- [ ] Verify "Tiizi App Support" platform campaign appears
- [ ] Verify cause challenge campaigns appear (if any exist)
- [ ] Test "Platform" filter — only platform campaigns shown
- [ ] Test "Challenge Cause" filter — only cause campaigns shown
- [ ] Test "Active" filter
- [ ] Test "Paused / Suspended" filter
- [ ] Search by challenge name returns correct campaigns

### Campaign Detail
- [ ] Click "View Details" on any campaign — slide panel opens
- [ ] Verify Campaign Summary section shows confirmed/pending amounts separately
- [ ] Verify "Tiizi does not verify" disclaimer visible
- [ ] On a cause campaign: verify contribution records table renders

### Campaign Actions (cause campaigns only)
- [ ] Click "Pause" — verify `donation.campaignStatus = 'paused'` in Firestore
- [ ] Open affected challenge as participant — verify "Support temporarily unavailable" shown, CTA hidden
- [ ] Click "Resume" — verify CTA visible again for participants

### Reports Screen
- [ ] Navigate to `/app/admin/donations/reports`
- [ ] Verify no "KES" hardcoded next to totals
- [ ] Verify "mixed currencies" disclaimer visible
- [ ] Top campaigns shows per-campaign currency

### Terminology
- [ ] Search all admin donation screens for "payment verified" — should not appear
- [ ] Search for "payment successful" — should not appear
- [ ] "Marked as sent" terminology appears in contribution records

---

## Test Results

```
✅ All admin donation dashboard guards passed. (37 assertions)
✅ All Support Tiizi pilot donation guards passed (multi-currency).
✅ All cause donation pledge flow guards passed.
tsc --noEmit: 0 errors
npm run build: ✓ built in 3.53s
```
