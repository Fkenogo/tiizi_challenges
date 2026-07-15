# CHANGELOG — Donation Currency Summaries + Platform Support Detail (2026-07-06)

## Phase 18I-6Y Follow-up 2

### Changed

- **`DonationCampaign`** — added `confirmedByCurrency: Record<string, number>` and `pendingByCurrency: Record<string, number>` per-currency breakdown fields
- **`adminDonationService.getCampaigns()`** — pledge aggregation now accumulates `confirmedByCurrency` and `pendingByCurrency` per challenge; platform support campaign computes per-currency breakdown from `supportDonations`; platform campaign `currency` changed from `'KES'` to `'mixed'`
- **`DonationCampaignsScreen` campaign summary card** — cause/legacy path uses new `CurrencyBreakdown` component for confirmed/pending rows; "Remaining" shows "See currency breakdown" when confirmed pledges are in different or mixed currencies vs goal currency; platform support path shows per-currency breakdown + behaviour stats (most common frequency, amount, latest date)
- **`DonationCampaignsScreen` support records table** — always renders with full column headers (Contributor, Amount, Currency, Frequency, Status, Created, Confirmed); empty state copy added below table; added admin note "Support Tiizi records are self-reported until payment integration is added."; split Amount and Currency into separate columns

### Added

- **`CurrencyBreakdown` component** (inside `DonationCampaignsScreen.tsx`) — renders one `{ccy} {amount}` line per currency; falls back to `{fallbackCurrency} 0` when breakdown is empty
- **`supportStats` memo** in `CampaignDetailPanel` — computes most common frequency, most common amount, latest support date from live `supportRecords`; shown in Platform Support summary section
- **15 new guard assertions** in `scripts/testAdminDonationDashboardGuards.ts` covering per-currency fields, `CurrencyBreakdown` usage, "See currency breakdown" copy, platform mixed-currency display, empty state structure, table column coverage
