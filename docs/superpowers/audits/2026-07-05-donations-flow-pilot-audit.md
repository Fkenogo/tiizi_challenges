# Phase 18I-6W — Donations Flow Pilot Audit

**Date:** 2026-07-05  
**Branch:** fix/p0-pre-deploy-blockers  
**Scope:** Audit only — no code changes in this phase.

---

## Summary

Two donation flows exist in Tiizi: **Support Tiizi** (platform-level admin-controlled support donations) and **Support Causes** (challenge-based, cause-driven contribution pledges). Both flows have issues that must be resolved before pilot launch. The most critical blocker is a hardcoded wrong phone number in `DonateScreen.tsx`.

---

## Files Audited

| File | Role |
|---|---|
| `src/features/Donate/DonateScreen.tsx` | User-facing "Support Tiizi" donation entry point |
| `src/services/donationService.ts` | Firestore writes for both support and challenge donations |
| `src/hooks/useDonations.ts` | React Query wrappers for donation operations |
| `src/features/Challenges/components/ChallengeDonationSection.tsx` | Challenge wizard donation sub-form |
| `src/features/Admin/Donations/PlatformSupportScreen.tsx` | Admin UI for support donation intents |
| `src/services/adminDonationService.ts` | Admin Firestore reads/writes for donations |
| `src/features/Challenges/ChallengeDetailScreen.tsx` | Participant-facing cause donation display |
| `src/features/Admin/Challenges/CreateChallengeScreen.tsx` | Admin challenge creator with donation wizard |
| `firestore.rules` | Security rules for all donation collections |

---

## Flow 1: Support Tiizi (Platform Donation)

### Critical Blockers

#### 1. Wrong hardcoded phone number — PILOT BLOCKER

**File:** `src/features/Donate/DonateScreen.tsx`

```typescript
const RECEIVER_PHONE = '0722361789';
const MPESA_USSD_CODE = '*344*2*0*722361789#';
const MPESA_USSD_TEL_URI = 'tel:*344*2*0*722361789%23';
```

The pilot requires phone number `+250794003947` (Rwanda). The current constant is a Kenyan M-Pesa number (`0722361789`) that does not match the pilot operator or country. Any user who attempts a mobile money donation during the pilot would be sending money to the wrong recipient.

**Recommendation:** Read the phone number from `platformSettings/support` in Firestore at runtime. The admin screen (`PlatformSupportScreen.tsx`) already manages `mobileMoneyNumber` and `mobileMoneyUssdCode` in that document. DonateScreen should call `adminDonationService.getPlatformSupportSettings()` on load and derive all phone-based constants from that response. This makes the number config-driven without requiring a code deploy to change it — critical for a pilot.

#### 2. Card payment tab is fully active but payment is not live

**File:** `src/features/Donate/DonateScreen.tsx`

The "Card" tab renders an active payment form and `cardUrl` is set to:
```typescript
const cardUrl = 'https://payments.tiizi.app/support';
```
This is a placeholder URL; no payment gateway is live. There is no `coming soon` state, no disabled overlay, and no user-facing notice that card payments are unavailable. A pilot user selecting "Card" will see an active form and receive no feedback when it fails.

**Recommendation:** Disable the Card tab UI entirely for pilot. Replace with a "Coming soon" badge and a disabled button. The tab can remain in the codebase as a scaffold but must not be actionable until a payment gateway is wired.

#### 3. DonateScreen does not read from Firestore admin settings

**File:** `src/features/Donate/DonateScreen.tsx`

The admin screen (`PlatformSupportScreen.tsx`) manages `mobileMoneyNumber`, `mobileMoneyUssdCode`, and `cardPaymentUrl` in `platformSettings/support`. DonateScreen does not read this document at all — all values are hardcoded constants. This means any admin change to the phone number or URL has zero effect on the user-facing flow.

**Recommendation:** Wire `getPlatformSupportSettings()` into DonateScreen via a `useQuery`. Fall back to a safe disabled state if the settings doc is not found, rather than using stale hardcoded fallbacks.

### Non-blocking Issues

#### 4. `platformSettings/support` has no Firestore security rule

**File:** `firestore.rules`

A grep for `platformSettings` returns no results. The document is read by `adminDonationService.getPlatformSupportSettings()` and written by `savePlatformSupportSettings()`, but there is no explicit rule in `firestore.rules` for this path. It likely falls through to a default-deny rule, which would break the recommended fix above (DonateScreen fetching admin settings on load) because unauthenticated or regular-user reads would be denied.

**Recommendation:** Add a read rule for `platformSettings/support` that allows any authenticated user to read (or even public read, since it only contains a display phone number and a URL). Write should remain super-admin only.

#### 5. Race condition on "Donate Now" — double dispatch

**File:** `src/features/Donate/DonateScreen.tsx`

The "Donate Now" click handler fires `window.location.href = MPESA_USSD_TEL_URI` and calls `submit()` simultaneously. The `submit()` call creates an intent in `supportDonations` with status `'intent'`. If the USSD redirect fails (user cancels, wrong OS handling), the intent record is already written with no way for the user to know it was created. Orphaned `'intent'` records accumulate and skew admin analytics.

**Recommendation:** Write the intent record only after the user confirms they completed the USSD action, or defer Firestore write to when the admin confirms the donation.

---

## Flow 2: Support Causes (Challenge-Based)

### Significant Issues

#### 6. Any user can set payment phone number with no pre-approval gate in wizard UI

**Files:** `src/features/Challenges/components/ChallengeDonationSection.tsx`, `src/features/Admin/Challenges/CreateChallengeScreen.tsx`

The challenge creation wizard allows any authenticated user to set `contributionPhoneNumber` and `contributionCardUrl` freely. These fields are written directly to the challenge document in Firestore. There is no warning in the UI that these fields must be approved before becoming visible to participants.

The `challengeService.ts` does set `donation.approvalStatus = 'pending'` on creation, but:
- This is only visible to admins, not surfaced in the creator's UI
- The cause-donation section in the wizard shows no message like "Subject to admin approval"
- `DONATION_PAYLOAD_DISCLAIMER` is shown (from `challengeFormCopy.ts`), but it describes Tiizi's non-custodial role, not the approval gate

**Recommendation:** Add a visible banner in `ChallengeDonationSection.tsx` informing creators that donation fields will only be shown to participants after admin review. This is a UX clarity fix, not a security fix (approval is enforced in `challengeService.ts` via `approvalStatus: 'pending'`).

#### 7. ChallengeDetailScreen shows donation phone number to participants with no approval guard

**File:** `src/features/Challenges/ChallengeDetailScreen.tsx` (line 665–667)

```tsx
{resolvedChallenge.donation.contributionPhoneNumber && (
  <p>Mobile: {resolvedChallenge.donation.contributionPhoneNumber}</p>
)}
```

This renders the phone number whenever `contributionPhoneNumber` is truthy. It does not check `donation.approvalStatus`. If a challenge somehow reaches `'active'` status before donation approval (e.g., via a status field set incorrectly), participants would see an unapproved phone number.

The Firestore rule (`firestore.rules` line ~210) does include a guard:
```
!(resource.data.donation.enabled == true && request.resource.data.status == 'active')
```
This prevents creator self-activation of donation-enabled challenges. However the display-side has no guard.

**Recommendation:** In `ChallengeDetailScreen.tsx`, wrap the donation phone/card display in an `approvalStatus === 'approved'` check. This adds a defense-in-depth layer on the display side.

#### 8. No admin screen listed for challenge donation approval workflow

**File:** `src/features/Admin/AdminPendingChallengesScreen.tsx`

The admin pending challenges list exists and shows challenges requiring moderation. However, there is no dedicated UI surface clearly labelled "approve donation details" vs "approve challenge" — these are conflated. A super admin approving a challenge may not realize they are also approving its donation phone number.

**Recommendation:** In the admin pending challenge review UI, prominently surface the donation sub-section when `donation.enabled === true`, including the `contributionPhoneNumber` and `contributionCardUrl`, with a separate explicit confirmation that these have been verified before approval.

---

## Firestore Security Rules — Donation Collections

| Collection | Create | Read | Update | Delete |
|---|---|---|---|---|
| `supportDonations` | Authenticated user (own) | Own or admin | Own or admin | Own or admin |
| `supportDonationPreferences` | Own or admin | Own or admin | Own or admin | Own or admin |
| `challengeContributionPledges` | Authenticated user (own) | Own, admin, or group member | Own or admin | Own or admin |
| `donationCampaigns` | Super admin only | Admin only | Super admin only | Super admin only |
| `donationTransactions` | Super admin only | Admin only | Super admin only | Super admin only |
| `platformSettings/support` | **No explicit rule** | **No explicit rule** | **No explicit rule** | **No explicit rule** |

The absence of a rule for `platformSettings/support` is a gap that must be resolved as part of the fix for finding #3.

---

## Phone Number Storage Recommendation

**For pilot:** Store `+250794003947` in `platformSettings/support` as `mobileMoneyNumber`. Have DonateScreen fetch this at runtime via `getPlatformSupportSettings()`. This:
- Avoids a code deploy to change the number
- Uses the existing Firestore document the admin already manages
- Aligns admin settings with user-facing display
- Enables easy number rotation without a release

**Do NOT** use a hardcoded constant (current broken state) or environment variable (requires build pipeline coordination). Firestore-driven config is the right approach here.

---

## Prioritized Fix List

| # | Severity | Finding | File(s) |
|---|---|---|---|
| 1 | **PILOT BLOCKER** | Wrong hardcoded phone number `0722361789` | `DonateScreen.tsx` |
| 2 | **PILOT BLOCKER** | Card payment tab fully active, payment not live | `DonateScreen.tsx` |
| 3 | **High** | DonateScreen does not read from Firestore admin settings | `DonateScreen.tsx` |
| 4 | **High** | `platformSettings/support` has no Firestore security rule | `firestore.rules` |
| 5 | **Medium** | Double dispatch on "Donate Now" creates orphaned intent records | `DonateScreen.tsx` |
| 6 | **Medium** | No pre-approval warning in donation wizard for creators | `ChallengeDonationSection.tsx` |
| 7 | **Medium** | ChallengeDetailScreen renders phone number with no approval-status guard | `ChallengeDetailScreen.tsx` |
| 8 | **Low** | Admin challenge approval UI does not surface donation fields explicitly | `AdminPendingChallengesScreen.tsx` |

---

## Out of Scope (Not Audited)

- Actual payment gateway integration (no gateway exists yet; pilot is manual)
- Donation analytics / reporting accuracy
- Email/push notification flows for donation confirmation
