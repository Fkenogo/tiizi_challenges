# Phase 18I-6X Prompt 2 — Cause Donation Pledge Flow Implementation Report

**Date:** 2026-07-06
**Branch:** fix/p0-pre-deploy-blockers

---

## Summary

Redesigned the cause donation flow in `ChallengeDetailScreen` so that participants must select an amount before a pledge record is created. Added a four-step inline state machine (idle → selecting_amount → payment_instructions → confirmed), extended the `ChallengeContributionPledge` type with `pledgedAmount`, `currency`, `causeName`, `confirmedAt`, `updatedAt`, and `status: 'confirmed'`, and added a `confirmChallengeContribution` service + hook.

---

## Where Pledge Amount Is Captured

In `ChallengeDetailScreen.tsx`, when `pledgeStep === 'selecting_amount'`:
- Four preset buttons per currency (KES/RWF/UGX — `CAUSE_PRESETS` local constant).
- A free-text `custom amount` input.
- `pledgeAmount` is derived: custom input takes priority over preset.
- `submitPledge()` validates `pledgeAmount >= 1` before calling `createContribution.mutateAsync`.
- If amount is invalid (0 or non-numeric), a toast is shown and no Firestore write occurs.

---

## Where Pledge Records Are Stored

Collection: `challengeContributionPledges` (unchanged).

Fields written on pledge creation:

| Field | Type | Notes |
|---|---|---|
| `id` | string | Firestore doc ID |
| `challengeId` | string | |
| `groupId` | string | |
| `userId` | string | |
| `pledgedAmount` | number | User-selected amount in chosen currency |
| `amountKes` | number | Set equal to `pledgedAmount` for backwards compat |
| `currency` | string | e.g. `"KES"`, `"RWF"`, `"UGX"` |
| `causeName` | string | From challenge donation metadata |
| `timingStartDate` | string? | From challenge donation |
| `timingEndDate` | string? | From challenge donation |
| `paymentPhoneNumber` | string? | Admin-approved phone only |
| `status` | `'pledged'` | Set to `'pledged'` on creation |
| `createdAt` | ISO string | |
| `updatedAt` | ISO string | Same as createdAt on creation |

---

## How Confirmation Works

1. After pledge is created (`status: 'pledged'`), the user sees payment instructions with the cause phone number.
2. User taps **"I've Sent My Contribution"**.
3. `confirmChallengeContribution(pledgeId, userId)` is called.
4. Service reads the Firestore doc, verifies `userId` matches, then merges:
   - `status: 'confirmed'`
   - `confirmedAt: <ISO timestamp>`
   - `updatedAt: <ISO timestamp>`
5. Firestore rule allows `update` by the document owner (`resource.data.userId == request.auth.uid`) — no rule change needed.
6. Success message: "Contribution marked as sent. Thank you for supporting this cause."

**Important:** This records the user's self-reported confirmation only. Tiizi does not verify payment.

---

## How Approval Guards Are Enforced

```
donation.enabled === true  AND  donation.approvalStatus === 'approved'
```

- `donationApproved` flag gates the entire payment section.
- Phone number, presets, payment instructions, and "I've Sent My Contribution" are all inside `donationApproved ? (...)`.
- Unapproved: non-creators see nothing. Creator sees the amber "awaiting admin approval" notice.
- `useChallengeContributions` / `useChallengeTotalRaised` queries still run even when unapproved (they don't expose payment details; the data is used for aggregate display only when approved).

---

## How to Manually Test the Flow

### Pre-conditions
1. Create a challenge with Fitness + Cause enabled.
2. As a super-admin, approve the challenge donation (`donation.approvalStatus = 'approved'`).
3. Open the challenge as a different user (participant).

### Steps
1. Open `ChallengeDetailScreen` for the approved cause challenge.
2. Verify "Support this Cause" button is visible.
3. Tap "Support this Cause" — verify amount picker appears (no Firestore write yet).
4. Tap a preset (e.g. KES 250) and verify it highlights.
5. Tap "Continue" — verify Firestore doc created in `challengeContributionPledges` with `status: 'pledged'`, `pledgedAmount: 250`.
6. On the payment instructions screen, verify phone number shown equals `contributionPhoneNumber` from challenge.
7. Tap "I've Sent My Contribution" — verify Firestore doc updated with `status: 'confirmed'`, `confirmedAt` populated.
8. Verify success message: "Contribution marked as sent."
9. Tap "Contribute Again" — verify flow resets to amount picker.

### Verify approval guard
1. As creator, open a challenge with unapproved donation.
2. Verify amber "awaiting admin approval" notice visible.
3. As participant, verify no payment details shown.

### Verify amount validation
1. On amount picker, clear preset, leave custom blank, tap Continue.
2. Verify toast: "Enter an amount greater than 0."

---

## Files Modified

| File | Change |
|---|---|
| `src/types/index.ts` | Extended `ChallengeContributionPledge` with `pledgedAmount`, `currency`, `causeName`, `confirmedAt`, `updatedAt`, `status: 'confirmed'` |
| `src/services/donationService.ts` | Updated `createChallengeContribution` input/payload; added `confirmChallengeContribution`, `getUserChallengeContributions`, `getChallengeTotalRaised` |
| `src/hooks/useDonations.ts` | Replaced `useChallengeContribution` (singular) with `useChallengeContributions` (plural); added `useChallengeTotalRaised`, `useConfirmChallengeContribution`; updated `useCreateChallengeContribution` input type |
| `src/features/Challenges/ChallengeDetailScreen.tsx` | Full redesign of cause donation section: inline state machine, amount selection, payment instructions, confirm sent, contribute again; added `useState` import; updated hook imports |
| `scripts/testCauseDonationGuards.ts` | Rewrote guards for new pledge flow |

---

## Dependencies Added

None.

---

## Config / Infrastructure Changes

None. Existing Firestore rules already allow owner `update` on `challengeContributionPledges`. No new indexes required.

---

## Risks / Limitations

- **Raised so far** aggregation (`getChallengeTotalRaised`) reads all pledges for a challenge in memory. For large challenges this could be slow; a Firestore counter or Cloud Function aggregate would be more efficient at scale.
- **Self-reported confirmation only.** The `confirmed` status means the user said they sent it, not that Tiizi verified receipt.
- **`useChallengeContribution` (singular) removed.** Any other screen that imported it will fail to compile — verified clean via `tsc --noEmit`.

---

## Rollback Instructions

1. Revert `src/types/index.ts` — restore `ChallengeContributionPledge` to previous shape.
2. Revert `src/services/donationService.ts` — remove `confirmChallengeContribution`, `getUserChallengeContributions`, `getChallengeTotalRaised`; restore `createChallengeContribution`.
3. Revert `src/hooks/useDonations.ts` — restore old hooks.
4. Revert `src/features/Challenges/ChallengeDetailScreen.tsx` — restore old donation section.

All changes are isolated to the cause donation feature; no shared infrastructure was modified.

---

## Test Results

```
✅ All cause donation pledge flow guards passed.
✅ All Support Tiizi pilot donation guards passed (multi-currency).
tsc --noEmit: 0 errors
npm run build: ✓ built in 3.86s
```
