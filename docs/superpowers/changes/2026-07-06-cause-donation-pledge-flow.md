# CHANGELOG — Cause Donation Pledge Flow (2026-07-06)

## Phase 18I-6X Prompt 2

### Changed

- **Cause donation CTA no longer creates a pledge immediately.** "Support this Cause" button now opens an amount-selection step before any Firestore write.
- **Four-step inline pledge flow** in `ChallengeDetailScreen`:
  1. **idle** — "Support this Cause" button (or "Contribute Again" if user has a confirmed pledge).
  2. **selecting_amount** — Currency presets + custom input. Validates amount > 0 before proceeding.
  3. **payment_instructions** — Shows approved phone number and "I've Sent My Contribution" button.
  4. **confirmed** — Success message "Contribution marked as sent." + "Contribute Again" option.
- **Cause target display** changed from "Target: KES X" to "Cause target: {currency} X total" to clarify it is a campaign-wide target.
- **Raised so far / Remaining** now displayed when `totalRaised > 0`.
- **Multiple contributions** explicitly supported — no block after first confirmed pledge.
- **Approval guard preserved** — phone number and all payment UI hidden unless `donation.approvalStatus === 'approved'`.

### Added

- `ChallengeContributionPledge.pledgedAmount` — user-selected contribution amount.
- `ChallengeContributionPledge.currency` — ISO 4217 currency code.
- `ChallengeContributionPledge.causeName` — stored for display.
- `ChallengeContributionPledge.confirmedAt` — timestamp when user confirmed they sent payment.
- `ChallengeContributionPledge.updatedAt` — last-modified timestamp.
- `ChallengeContributionPledge.status: 'confirmed'` — new terminal status.
- `donationService.confirmChallengeContribution(pledgeId, userId)` — sets status to confirmed.
- `donationService.getUserChallengeContributions(challengeId, userId)` — returns all pledges (supports repeat contributions).
- `donationService.getChallengeTotalRaised(challengeId)` — sums confirmed pledges for raised-so-far display.
- `useChallengeContributions(challengeId)` hook — replaces singular `useChallengeContribution`.
- `useChallengeTotalRaised(challengeId)` hook — for raised-so-far display.
- `useConfirmChallengeContribution()` hook — calls `confirmChallengeContribution`.

### Removed

- `useChallengeContribution` (singular) — replaced by `useChallengeContributions` (plural).
- Direct "Contribute" button that created a pledge without amount selection.
- "Skip" button from cause donation section.
- Old `amountKes` only input on contribution creation (replaced by `pledgedAmount` + `currency`).

### Guard tests

- `scripts/testCauseDonationGuards.ts` fully rewritten with 20 assertions covering:
  - No immediate pledge on CTA
  - Amount validation
  - `pledgedAmount` + `currency` on pledge record
  - `status: 'pledged'` on creation
  - `confirmChallengeContribution` sets `status: 'confirmed'` + `confirmedAt`
  - Approval guard enforcement
  - "Contribute Again" support
  - No "payment successful" / "payment verified" copy
  - Cause target labelled as total campaign target
