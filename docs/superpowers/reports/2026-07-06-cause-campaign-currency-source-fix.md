# Phase 18I-6Y Follow-up 3 — Cause Campaign Currency Source of Truth

**Date:** 2026-07-06
**Branch:** fix/p0-pre-deploy-blockers

---

## Problem

Cause campaigns created in RWF displayed `Campaign currency: KES` in the admin donations dashboard. User-facing challenge cause card correctly showed the RWF currency, but the admin campaign summary read `KES`.

---

## Root Causes Found

| # | Location | Bug |
|---|----------|-----|
| 1 | `scripts/seedAppData.ts` line 662 | Seed collective challenges used `targetAmount` (wrong field name) and had no `currency` field. Admin service fell through to pledge currency, which also defaults to `'KES'`. |
| 2 | `src/features/Challenges/CreateChallengeWizard.tsx` `loadTemplate()` | `loadTemplate()` restored all donation fields except `donationCurrency`. When creating from an RWF template, the wizard stayed at its `'KES'` default and saved `donation.currency = 'KES'` to Firestore. |
| 3 | `src/services/adminDonationService.ts` line 221 | Fallback chain `donation?.currency ?? stats.currency ?? 'KES'` is architecturally correct — the real issue is upstream: if `donation.currency` is absent in Firestore, there is nothing correct to read. |

The admin service code was **correct for challenges that had `donation.currency` properly saved**. Both bugs were data-production bugs, not reading bugs.

---

## Fixes Applied

### Fix 1 — `CreateChallengeWizard.tsx` `loadTemplate()` (primary fix)

Added `setDonationCurrency()` call when loading a template with donation enabled:

```typescript
if (template.donation.currency === 'RWF' || template.donation.currency === 'UGX') {
  setDonationCurrency(template.donation.currency);
}
```

Explicit type guard avoids the need for a cast and naturally preserves `'KES'` default when the template has no currency field.

### Fix 2 — `scripts/seedAppData.ts` seed collective challenges

- Renamed `targetAmount` → `targetAmountKes`
- Added `causeName: 'Community Clean Water Initiative'`
- Added `currency: 'KES'`
- Added `approvalStatus: 'approved'`
- Updated local seed type definition to include all donation fields

### Fix 3 — `src/services/challengeTemplateService.ts` type + `fromDoc`

- Added `currency?: string` to `SuggestedChallengeTemplate.donation` type
- Added `currency` field reading in `fromDoc()` so the wizard receives the field when it loads a stored template

### Fix 4 — `scripts/testAdminDonationCurrencySourceGuards.ts` (new)

Created guard script with 16 assertions covering:
- Challenge type declares `donation.currency?: string`
- Admin service reads `donation?.currency` as primary source
- Fallback chain present
- `DonationCampaignsScreen` uses `campaign.currency` not hardcoded `'KES'`
- Wizard calls `setDonationCurrency` when loading templates
- Wizard reads `template.donation.currency`
- Wizard saves `donationCurrency` to challenge payload
- Seed data uses `targetAmountKes`, `currency`, `causeName`, `approvalStatus`

---

## Files Modified

| File | Change |
|------|--------|
| `src/features/Challenges/CreateChallengeWizard.tsx` | Added `setDonationCurrency(template.donation.currency)` in `loadTemplate()` when currency is RWF or UGX |
| `src/services/challengeTemplateService.ts` | Added `currency?: string` to `SuggestedChallengeTemplate.donation`; added `currency` field in `fromDoc()` |
| `scripts/seedAppData.ts` | Fixed seed collective challenge donation: `targetAmountKes`, `causeName`, `currency: 'KES'`, `approvalStatus: 'approved'`; updated local type |
| `scripts/testAdminDonationCurrencySourceGuards.ts` | New guard script — 16 assertions |

---

## Commands Executed

```bash
npx tsx scripts/testAdminDonationCurrencySourceGuards.ts
npx tsx scripts/testAdminDonationDashboardGuards.ts
npx tsx scripts/testDonationPilotGuards.ts
npx tsx scripts/testCauseDonationGuards.ts
npx tsc --noEmit
npm run build
```

## Test Results

```
✅ All cause campaign currency source guards passed. (16 assertions)
✅ All admin donation dashboard guards passed.
✅ All Support Tiizi pilot donation guards passed (multi-currency).
✅ All cause donation pledge flow guards passed.
tsc --noEmit: 0 errors
npm run build: ✓ built in 3.22s
```

---

## Risks / Limitations

1. **Existing Firestore challenges with no `donation.currency`** — challenges already in the database that were created before this fix (or from seed data) still lack the field. For those, the admin service falls through to pledge currency (which may also be absent, resolving to `'KES'`). **No Firestore migration was run** — that is out of scope per constraints.

2. **Seed data fix is forward-only** — updating the seed script only affects new seed runs. Existing seeded data in any environment keeps `targetAmount` (wrong field) and no `currency`. A seed wipe-and-reseed is required for the fix to take effect.

3. **`stats.currency` fallback** — the admin service still uses pledge currency as a fallback when `donation.currency` is absent. This is correct per the spec's fallback order and is intentionally preserved.

---

## Rollback Instructions

1. Revert wizard: remove the `setDonationCurrency` lines from `loadTemplate()`.
2. Revert `challengeTemplateService.ts`: remove `currency` from type and `fromDoc`.
3. Revert seed data: restore `targetAmount`, remove `causeName`/`currency`/`approvalStatus`.
4. Delete `scripts/testAdminDonationCurrencySourceGuards.ts`.
