# Member Phase 4: Onboarding and Auth Cleanup

Date: 2026-06-10

## Files changed

- `src/context/AuthContext.tsx`
- `src/features/Auth/LoginScreen.tsx`
- `src/features/Auth/SignupScreen.tsx`
- `src/features/Profile/ProfileCompletionScreen.tsx`
- `src/features/Profile/ProfileInterestsScreen.tsx`
- `src/features/Profile/ProfileSetupFinishScreen.tsx`
- `src/features/Profile/ProfilePrivacySettingsScreen.tsx`
- `src/services/userProfileService.ts`
- `src/utils/firebaseAuthErrors.ts`

## Root causes found

1. `ProfileInterestsScreen` sent incomplete users to `/app/profile/privacy-settings`, but that route is completed-profile-only in `App.tsx`. The route guard redirected them away, creating confusing onboarding behavior.
2. Onboarding "Skip for now" buttons sent incomplete users to `/app/home` while leaving `profile.onboardingCompleted` false. The completed-route guard then immediately redirected them back into onboarding.
3. `AuthContext.ensureUserDocument()` wrote `createdAt` on every periodic user sync because it used `setDoc(..., { merge: true })` with `createdAt` in the merge payload.
4. Login redirected to `next` immediately after auth success without waiting for the profile setup state. Guards eventually corrected the route, but users could see unclear intermediate redirects.
5. Signup used generic error copy instead of the normalized Firebase auth error helper.

## Redirect and onboarding rules after fix

One clear onboarded rule:

- A user is onboarded only when `users/{uid}.profile.onboardingCompleted === true`.
- Before completion, the required onboarding path is:
  - missing full name: `/app/profile/completion`
  - missing at least one interest or goal: `/app/profile/interests`
  - profile details and interests/goals present but not completed: `/app/profile/setup-finish`
  - completed: `/app/home`

Route behavior:

- Completed-only member routes use `RequireProfileSetup mode="completed"`.
- Onboarding-only routes use `RequireProfileSetup mode="onboarding"`.
- Completed users who land on onboarding routes go to `/app/home`.
- Incomplete users who land on completed routes go to their next required onboarding step.
- `/app/login` and `/app/signup` now wait for profile setup status after auth succeeds, then route completed users to a safe `next` path or `/app/home`, and incomplete users to the correct onboarding step.
- Skip buttons that bypassed onboarding were removed from the onboarding screens.
- Profile privacy settings is treated as a normal completed-user settings screen and no longer resets onboarding.

## Auth error handling

- Email/password login and signup use `normalizeFirebaseAuthError`.
- Signup now shows user-facing errors for email already in use, weak password, invalid email, network failure, and redirect/Google sign-in issues.
- Google redirect-result errors from `AuthContext` are surfaced on login/signup screens through `authError`.

## CreatedAt preservation

- `AuthContext.ensureUserDocument()` now reads the existing user document first.
- `createdAt` is included only when the user document does not exist or is missing `createdAt`.
- `userProfileService.upsertProfileSetup()` only sets `createdAt` if it has to create a missing user document.
- Normal profile updates do not include `createdAt`.

## Remaining risks

- Google sign-in still depends on Firebase/Google Console authorized domains and redirect URI configuration.
- Some completed-user settings screens still have onboarding-style copy; this is cosmetic and not a redirect blocker.
- Existing user documents with already overwritten `createdAt` need data repair if historical signup dates are required.

## Validation results

- `npm run test:sentinels`: passed, 8 checks passed and 0 failed.
- `npx tsc -b`: passed.
- `npm run build`: passed, Vite built 1832 modules successfully.
- `firebase deploy --only firestore:rules --dry-run --project tiizi-challenges`: passed, `firestore.rules` compiled successfully.
