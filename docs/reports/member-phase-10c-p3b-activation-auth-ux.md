# Phase 10C-P3B Activation, Onboarding & Auth UX

Date: 2026-06-15  
Branch: fix/p0-pre-deploy-blockers  
Status: COMPLETE — all five fixes implemented, all validation passes

---

## Summary

This phase addresses the complete set of P3B defects: interest preselection, birthday validation, password reset, new-user activation experience, and the empty challenges state on Home.

---

## Fix 1: Interests — No Preselected Defaults, No Cap, Min 3

### Root Cause

`ProfileInterestsScreen.tsx` had a `useEffect` that fell back to admin-seeded default interests and goals when a fresh user had none saved. This pre-populated choices that the user never made, producing false personalization:

```ts
// Before
setSelectedInterests(savedInterests.length > 0 ? savedInterests : defaultInterests);
setSelectedGoals(savedGoals.length > 0 ? savedGoals : defaultGoals.slice(0, 3));
```

Additionally, `toggleInterest` capped selections at 10 and `toggleGoal` capped at 3, preventing users with wide interests from reflecting their actual lifestyle. Validation required only 1 interest and 1 goal.

### UX Before

- Fresh user arrives at Interests step with 3–5 interests already highlighted
- Maximum 10 exercise interests and 3 goals could be selected
- Could proceed with just 1 interest and 1 goal

### UX After

- Fresh user arrives with zero interests and zero goals selected
- No selection cap — all interests and goals are freely toggleable
- Modal shows helper text: "Select all that apply — choose as many as you like."
- Validation requires **minimum 3 interests** and at least 1 wellness goal
- Proceeding with fewer shows: "Select at least 3 interests." or "Select at least 1 wellness goal."
- Previously saved selections are preserved on return visits (no regression)

### Files Changed

- `src/features/Profile/ProfileInterestsScreen.tsx`
  - Removed `defaultInterests` / `defaultGoals` fallback in hydration effect
  - Removed `prev.length >= 10` cap from `toggleInterest`
  - Removed `prev.length >= 3` cap from `toggleGoal`
  - Changed `handleNext` validation from `< 1` to `< 3` for interests, kept `< 1` for goals
  - Added helper text in interests modal

---

## Fix 2: Birthday Required Validation

### Root Cause

`ProfileCompletionScreen.tsx` `handleNext` only checked `fullName.trim()`. Birthday was presented without an "(Optional)" label but never validated — a fresh user could advance with an empty birthday string.

### UX Before

- User leaves Birthday blank → presses Next → advances to Interests with `birthday: ""`

### UX After

- User leaves Birthday blank → presses Next → inline red error "Please enter your birthday." appears below the field
- Input border turns red; error clears as soon as the user picks a date
- Navigation proceeds only after a valid date is entered

### Files Changed

- `src/features/Profile/ProfileCompletionScreen.tsx`
  - Added `birthdayError` state
  - Added birthday guard in `handleNext`
  - Inline error rendering below the Birthday input
  - Input red-border class applied when `birthdayError` is set

---

## Fix 3: Password Reset on Login

### Root Cause

`LoginScreen.tsx` had no password reset action. Users who forgot their password had no recovery path.

### UX Before

- Login screen: Email → Password → Continue / Google / Sign Up — no reset link

### UX After

- "Forgot password?" link appears inline below the password field
- Clicking reveals a collapsible reset panel (no new route):
  - Email field pre-filled from the login form
  - "Send Reset Link" / "Cancel" buttons
  - Success: "Check your inbox for a password reset link." (green)
  - Error: normalized human-readable message — no raw Firebase codes visible
- Panel dismisses cleanly with Cancel

### Files Changed

- `src/features/Auth/LoginScreen.tsx`
  - Added `sendPasswordResetEmail` from `firebase/auth`
  - Added `handlePasswordReset` with `normalizeFirebaseAuthError` error handling
  - Added inline reset panel with toggled `resetMode` state
- `src/utils/firebaseAuthErrors.ts`
  - Added `auth/missing-email`, `auth/expired-action-code`, `auth/invalid-action-code`

---

## Fix 4: New User Activation Card on Home

### Root Cause

Fresh users completing onboarding landed on Home to an empty screen with no guidance. They had no way to understand what groups, challenges, or activity logging were, or what to do first.

### UX Before

- Home after onboarding: metrics at 0, "No active challenges yet", one button
- No explanation of the ecosystem

### UX After

The activation card appears whenever `joinedGroupCount === 0 OR activeChallengeCount === 0`. It auto-hides once both conditions are satisfied (user has joined a group and has an active challenge).

Card content:

```
Welcome to Tiizi 👋
You're ready to begin your wellness journey. Follow these steps to get started:

✓/1  Join a Group
     Groups are communities of people with shared wellness goals.

✓/2  Join a Challenge
     Challenges help you stay motivated and track your progress.

  3  Log Activities
     Track workouts, wellness habits and progress toward your goals.

  4  Earn Streaks & Achievements
     Stay active to earn streaks, badges and climb leaderboards.

[ Browse Groups ]  [ Browse Challenges ]
```

Steps 1 and 2 switch to a green ✓ badge once completed. The Browse Groups button disappears once the user has joined a group; Browse Challenges disappears once they have an active challenge.

### Files Changed

- `src/features/Home/HomeScreen.tsx`
  - Added activation card section rendered when `joinedGroupCount === 0 || activeChallengeCount === 0`
  - Step badges dynamically show completion state

---

## Fix 5: Active Challenges Empty State

### Root Cause

The "no active challenges" state said "No active challenges yet" with a single CTA that showed either Browse Groups or Browse Challenges depending on group membership — but never explained the relationship between groups, challenges, and activity logging.

### UX Before

```
No active challenges yet
Join a challenge to start tracking your progress here.
[ Join a Group ]
```
or just:
```
[ Browse Challenges ]
```

### UX After

```
Get Started
1. Join a Group
2. Join a Challenge
3. Log Activities

Your active challenges will appear here.

[ Browse Groups ]  [ Browse Challenges ]
```

Both buttons are always visible, making it clear users need both a group and a challenge.

### Files Changed

- `src/features/Home/HomeScreen.tsx`
  - Replaced the single-CTA empty state with multi-step guidance and two persistent CTAs

---

## Guard Tests Added

### Extended: `scripts/testPilotUxPolishGuards.ts`

**Interests guards:**
- `ProfileInterestsScreen` must not reference `defaultInterests` or `defaultGoals`
- `ProfileInterestsScreen` must not cap selections at 10 or 3
- `ProfileInterestsScreen` must require at least 3 interests
- `ProfileInterestsScreen` must show "Select at least 3 interests" message

**Activation card guards:**
- `HomeScreen` must show activation card condition on `joinedGroupCount === 0 || activeChallengeCount === 0`
- `HomeScreen` must include welcome message for new users
- `HomeScreen` activation card must mention Join a Group and Join a Challenge
- `HomeScreen` empty state must use "Get Started" heading
- `HomeScreen` empty state must say "Your active challenges will appear here"

---

## Validation Results

```
npm run test:pilot-ux-polish-guards   → pilot UX polish guards passed
npm run test:home-performance-guards  → home performance guards passed
npx tsc -b --pretty false             → (no errors)
npm run build                         → ✓ built in 3.62s
```

---

## Files Changed (Complete List)

| File | Change |
|------|--------|
| `src/features/Profile/ProfileInterestsScreen.tsx` | No defaults, no cap, min 3 interests required |
| `src/features/Profile/ProfileCompletionScreen.tsx` | Birthday required with inline error |
| `src/features/Auth/LoginScreen.tsx` | Forgot password? link and inline reset panel |
| `src/utils/firebaseAuthErrors.ts` | 3 new password-reset error codes |
| `src/features/Home/HomeScreen.tsx` | Activation card + improved empty state |
| `scripts/testPilotUxPolishGuards.ts` | Extended with P3B activation and interests guards |

---

## Deployment Notes

- No Firestore rules changes. No index changes. No Cloud Functions changes.
- No new routes added.
- The activation card dismisses client-side using live `joinedGroupCount` and `activeChallengeCount` from existing Home data — no new Firestore reads required.
- Do not deploy until P3B is reviewed and approved.
