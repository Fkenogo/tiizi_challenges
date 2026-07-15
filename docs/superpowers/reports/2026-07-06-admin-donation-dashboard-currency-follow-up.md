# Phase 18I-6Y Follow-up 2 — Donation Currency Summaries + Platform Support Detail

**Date:** 2026-07-06
**Branch:** fix/p0-pre-deploy-blockers

---

## Problems Fixed

| # | Problem | Fix |
|---|---------|-----|
| 1 | Cause campaign summary showed hardcoded `campaign.currency` for all confirmed/pending totals even when pledges were in multiple currencies | Added `confirmedByCurrency`/`pendingByCurrency` per-currency breakdown to `DonationCampaign`; computed in `getCampaigns()` from pledge records; rendered via new `CurrencyBreakdown` component |
| 2 | Platform Support summary hardcoded `currency: 'KES'` and showed a single KES total | Platform campaign now sets `currency: 'mixed'` and computes `confirmedByCurrency`/`pendingByCurrency` from `supportDonations`; detail panel shows per-currency breakdown |
| 3 | "Remaining" calculation mixed currencies (e.g., RWF target minus KES confirmed) | `Remaining` now shows "See currency breakdown" when confirmed pledges are in a different or mixed currency vs the campaign goal currency |
| 4 | Platform Support detail too thin — no table when empty | Support records table always renders with full headers; empty state shows "No support records yet. When users record support, their contribution details will appear here." |
| 5 | Support records table missing Currency and Confirmed date columns | Table now has 7 columns: Contributor, Amount, Currency, Frequency, Status, Created, Confirmed |
| 6 | Platform Support summary lacked behaviour stats | Added `supportStats` memo in `CampaignDetailPanel`: most common frequency, most common amount, latest support date — computed from live `supportRecords` |

---

## Files Modified

| File | Change |
|------|--------|
| `src/services/adminDonationService.ts` | Added `confirmedByCurrency: Record<string, number>` and `pendingByCurrency: Record<string, number>` to `DonationCampaign` type; updated `PledgeStats` inner type to track these; computed per-currency in pledge aggregation loop; platform support campaign computes `platformConfirmedByCurrency`/`platformPendingByCurrency` from `supportDonations`; changed platform campaign `currency` from hardcoded `'KES'` to `'mixed'`; legacy campaigns include empty `{}` for both breakdown fields |
| `src/features/Admin/Donations/DonationCampaignsScreen.tsx` | Added `CurrencyBreakdown` helper component; rewrote campaign summary card to branch on `isPlatform`: platform path shows per-currency breakdown + behaviour stats; cause path uses `CurrencyBreakdown` for confirmed/pending, smart "Remaining" (mixed-safe); support records table always renders headers; added Currency and Confirmed columns; improved empty state copy; added `supportStats` `useMemo` in `CampaignDetailPanel` |
| `scripts/testAdminDonationDashboardGuards.ts` | 15 new assertions: per-currency breakdown fields, `CurrencyBreakdown` component, "See currency breakdown" text, platform mixed-currency note, empty state copy, admin note, table column coverage |

---

## Code Diff Summary

**`DonationCampaign` type additions:**
```typescript
confirmedByCurrency: Record<string, number>;
pendingByCurrency: Record<string, number>;
```

**`PledgeStats` additions and aggregation loop:**
```typescript
current.confirmedByCurrency[currency] = (current.confirmedByCurrency[currency] ?? 0) + pledgedAmount;
current.pendingByCurrency[currency] = (current.pendingByCurrency[currency] ?? 0) + pledgedAmount;
```

**Platform support campaign currency change:**
```typescript
currency: 'mixed',  // was: 'KES'
confirmedByCurrency: platformConfirmedByCurrency,
pendingByCurrency: platformPendingByCurrency,
```

**`CurrencyBreakdown` component:**
- Shows per-entry `{ccy} {amount}` lines
- Falls back to `{fallbackCurrency} 0` when empty

**Remaining calculation:**
```typescript
const isMixed = confirmedKeys.length > 1 || (confirmedKeys.length === 1 && !campaign.confirmedByCurrency[campaign.currency]);
// → 'See currency breakdown' when true
```

**Support records table:** 7 columns, always rendered; tbody populated when records exist; empty-state p-tag when empty.

---

## Commands Executed

```bash
npx tsx scripts/testAdminDonationDashboardGuards.ts
npx tsx scripts/testDonationPilotGuards.ts
npx tsx scripts/testCauseDonationGuards.ts
npx tsc --noEmit
npm run build
```

## Test Results

```
✅ All admin donation dashboard guards passed. (64 assertions)
✅ All Support Tiizi pilot donation guards passed (multi-currency).
✅ All cause donation pledge flow guards passed.
tsc --noEmit: 0 errors
npm run build: ✓ built in 3.59s
```

---

## Dependencies Added

None.

## Config Changes

None.

---

## Risks / Limitations

1. **`amountKes` field name used for all currencies** — the field is named `amountKes` but stores the amount in whatever currency the user selected (RWF, UGX, etc.). This is a data model naming inconsistency that predates this phase. Currency grouping uses the separate `currency` field on each record, so the per-currency breakdown is correct. The `amountKes` field acts as "the amount in the user's selected currency."

2. **Legacy campaign records have `confirmedByCurrency: {}`** — old `donationCampaigns` docs have no pledge-level records, so their breakdown is always empty. This is expected (they use static `raisedAmount` from the doc itself).

3. **`currency: 'mixed'` on platform campaign** — the platform campaign now has `currency: 'mixed'` which prevents it from being used as a sort key by currency. Sorting still works (by source/start date). The campaign list card for platform support shows "mixed" as currency.

---

## Rollback Instructions

1. Revert `src/services/adminDonationService.ts` — remove `confirmedByCurrency`/`pendingByCurrency` from type and `getCampaigns()`.
2. Revert `src/features/Admin/Donations/DonationCampaignsScreen.tsx` — remove `CurrencyBreakdown` component, restore single-currency summary rows.
3. Remove new assertions from `scripts/testAdminDonationDashboardGuards.ts`.

---

## Manual QA Checklist

### Campaign Summary — Cause Campaign
- [ ] Open a cause campaign with RWF currency — confirm summary shows "Campaign currency: RWF"
- [ ] Verify confirmed raised shows "RWF {amount}" not "KES {amount}"
- [ ] For a campaign with no pledges: confirm "RWF 0" (fallback with correct currency)
- [ ] For a campaign with mixed-currency pledges: verify "Remaining" shows "See currency breakdown"
- [ ] For a single-currency campaign: verify "Remaining" shows correct numeric value

### Campaign Summary — Platform Support
- [ ] Open Tiizi App Support — verify no "KES {amount}" single total
- [ ] Verify confirmed raised shows per-currency breakdown (KES / RWF / UGX lines)
- [ ] Verify "KES · RWF · UGX (mixed)" currency label
- [ ] With records: verify Most common frequency, Most common amount, Latest support date appear
- [ ] Without records: verify stats section is absent (supportStats = null)

### Support Records Table
- [ ] With zero records: table headers render; "No support records yet." message visible
- [ ] With records: Contributor, Amount, Currency, Frequency, Status, Created, Confirmed all visible
- [ ] Confirmed records show "Marked as sent" badge
- [ ] Admin note "Support Tiizi records are self-reported until payment integration is added." visible

### Terminology
- [ ] "payment verified" does not appear in admin donation screens
- [ ] "payment successful" does not appear in admin donation screens
