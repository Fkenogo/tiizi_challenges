# CHANGELOG — Cause Campaign Currency Source of Truth (2026-07-06)

## Phase 18I-6Y Follow-up 3

### Fixed

- **`CreateChallengeWizard.tsx` `loadTemplate()`** — now calls `setDonationCurrency(template.donation.currency)` when loading a template; previously `donationCurrency` stayed at the `'KES'` default, causing all template-created challenges to be saved with `donation.currency = 'KES'` regardless of the template's currency

### Changed

- **`SuggestedChallengeTemplate.donation`** — added `currency?: string` field to type definition in `challengeTemplateService.ts`; added `currency` reading in `fromDoc()` so the field round-trips through template storage correctly

- **`scripts/seedAppData.ts`** — seed collective challenges now include `targetAmountKes` (renamed from `targetAmount`), `causeName`, `currency: 'KES'`, and `approvalStatus: 'approved'`; local seed type updated to match

### Added

- **`scripts/testAdminDonationCurrencySourceGuards.ts`** — 16 guard assertions covering: challenge type declares `donation.currency`, admin service reads it as primary source, wizard restores currency from template, wizard saves currency to challenge payload, seed data uses correct field names and includes currency
