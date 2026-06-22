# Phase 10C-P3B Auth and Onboarding UX Fixes

Date: 2026-06-15  
Branch: fix/p0-pre-deploy-blockers  
Status: COMPLETE — both fixes implemented, all validation passes

---

## Summary

This phase fixes two High-priority UX defects from the Phase 10C-P2 authenticated smoke test:

1. Birthday can be skipped during profile completion with no validation error
2. No password reset action is exposed on the login screen

---

## Fix 1: Birthday Validation

### Root Cause

`ProfileCompletionScreen.tsx` `handleNext` only checked `fullName.trim()` before saving and navigating. The birthday field was presented in the UI with the label "Birthday" and no "(Optional)" marker, making it appear required — but it was never actually validated. A fresh user could advance to Interests/Goals with an empty birthday string saved to their profile.

### Decision

Birthday is **required**. The field is presented without an optional label, and birthday data is used for profile personalization. Making it optional would require UI copy changes across the form and data model. Blocking progression is the minimal-change, correct approach.

### UX Before

- User leaves Birthday blank and clicks "Next Step →"
- Profile saves with `birthday: ""` and navigation proceeds to `/app/profile/interests`
- No error shown

### UX After

- User leaves Birthday blank and clicks "Next Step →"
- Save is blocked; an inline error "Please enter your birthday." appears below the Birthday input
- The Birthday input border changes to red
- Typing a date clears the error immediately
- Navigation proceeds only after a valid date is entered

### Files Changed

- `src/features/Profile/ProfileCompletionScreen.tsx`
  - Added `birthdayError` state
  - Added empty-birthday guard in `handleNext` that sets `birthdayError` and returns early
  - Inline error message rendered below the Birthday input
  - Input border turns red when `birthdayError` is set; error clears on change

---

## Fix 2: Password Reset

### Root Cause

`LoginScreen.tsx` had no password reset action. The login form contained email, password, Continue, Google, and Sign Up — but no way for a user who forgot their password to recover their account.

### UX Before

- Login screen: Email → Password → Continue, Google, Sign Up
- No "Forgot password?" link
- No path to recover access without contacting support

### UX After

- A "Forgot password?" link appears to the right of the Password label
- Clicking it reveals an inline reset panel (no new route, no route loop risk):
  - Email field pre-filled with whatever is already in the email input
  - "Send Reset Link" button and "Cancel" button
  - Success: "Check your inbox for a password reset link." shown in green
  - Error: normalized human-readable message (no raw Firebase codes exposed)
- Panel can be dismissed with "Cancel" to return to the normal login form

### Implementation Notes

- `sendPasswordResetEmail` is called directly from `firebase/auth` using the existing `auth` instance from `src/lib/firebaseAuth.ts` — no changes to `AuthContext` required
- All errors go through the existing `normalizeFirebaseAuthError` utility
- Three new error codes added to `firebaseAuthErrors.ts`:
  - `auth/missing-email` — user submits the reset form with an empty email
  - `auth/expired-action-code` — reset link has expired
  - `auth/invalid-action-code` — reset link already used or malformed

### Files Changed

- `src/features/Auth/LoginScreen.tsx`
  - Added `sendPasswordResetEmail` import from `firebase/auth`
  - Added `auth` import from `../../lib/firebaseAuth`
  - Added `resetMode`, `resetEmail`, `resetMessage`, `resetLoading` state
  - Added `handlePasswordReset` function
  - Added "Forgot password?" button below the password input
  - Added inline reset panel rendered when `resetMode` is true
- `src/utils/firebaseAuthErrors.ts`
  - Added `auth/missing-email`, `auth/expired-action-code`, `auth/invalid-action-code` error messages

---

## Tests Added

### Extended: `scripts/testPilotUxPolishGuards.ts`

New assertions added after existing member-screen checks:

**Birthday validation:**
- `ProfileCompletionScreen` must validate that birthday is not empty before proceeding
- `ProfileCompletionScreen` must have an inline `birthdayError` state
- Birthday must not be labelled optional

**Password reset:**
- `LoginScreen` must expose a "Forgot password" action
- `LoginScreen` must call `sendPasswordResetEmail`
- `LoginScreen` must not expose raw Firebase error codes or messages
- `firebaseAuthErrors.ts` must handle `auth/missing-email`

---

## Validation Results

```
npm run test:pilot-ux-polish-guards  → pilot UX polish guards passed
npm run test:home-performance-guards → home performance guards passed
npx tsc -b --pretty false            → (no errors)
npm run build                        → ✓ built in 3.78s
```

---

## Files Changed (Complete List)

| File | Change |
|------|--------|
| `src/features/Profile/ProfileCompletionScreen.tsx` | Added birthday required validation and inline error |
| `src/features/Auth/LoginScreen.tsx` | Added Forgot password? link and inline password reset panel |
| `src/utils/firebaseAuthErrors.ts` | Added 3 password-reset-related error codes |
| `scripts/testPilotUxPolishGuards.ts` | Extended with P3B birthday and password reset guards |

---

## Deployment Notes

- No Firestore rules changes. No index changes. No Cloud Functions changes.
- No new routes added — password reset is inline on the login screen to avoid redirect complexity.
- Do not deploy until P3B is reviewed and approved.
