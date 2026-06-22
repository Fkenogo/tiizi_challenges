# Tiizi Auth Login Failure Review - 2026-06-05

## Firebase Auth Config Currently Used

Source env files:

- `VITE_FIREBASE_PROJECT_ID=tiizi-challenges`
- `VITE_FIREBASE_AUTH_DOMAIN=tiizi-challenges.firebaseapp.com`
- `VITE_FIREBASE_STORAGE_BUCKET=tiizi-challenges.firebasestorage.app`
- `VITE_FIREBASE_APP_ID=1:481957935000:web:5f2cc8008fba5283ee1ded`

Runtime config is initialized in `src/lib/firebaseApp.ts`.

The code uses `window.location.hostname` as `authDomain` when the app is served from a Firebase Hosting domain matching `.web.app` or `.firebaseapp.com`; otherwise it uses `VITE_FIREBASE_AUTH_DOMAIN`.

For production at `https://tiizi-challenges.web.app`, the effective auth domain is expected to be:

- `tiizi-challenges.web.app`

Read-only production check on 2026-06-05 showed Hosting serving bundle:

- `/assets/index-B-sLxm3a.js`

That deployed bundle includes the expected Tiizi Firebase project values.

## Email/Password Flow

Login screen calls:

- `login(email, password)` from `useAuth()`
- `AuthContext.login()`
- Firebase `signInWithEmailAndPassword(auth, email, password)`

Before this fix, the login screen caught errors but only showed:

- `Login failed. Try again.`

After this fix, the login screen normalizes Firebase Auth error codes and displays clear user-facing messages for:

- `auth/invalid-credential`
- `auth/user-not-found`
- `auth/wrong-password`
- `auth/user-disabled`
- `auth/too-many-requests`
- `auth/network-request-failed`

Firebase error codes are logged only in development builds.

## Google Flow

Google sign-in uses:

- `GoogleAuthProvider`
- `signInWithRedirect(auth, provider)`
- `getRedirectResult(auth)` in `AuthProvider`

The redirect result is handled globally in `AuthContext`. After this fix, redirect-result failures are normalized and exposed to the login screen through `authError`.

The Google provider now sets:

- `prompt=select_account`

This does not change the Firebase Hosting redirect handler. It only asks Google to show account selection.

## Likely Cause Of Email/Password 400

`identitytoolkit.googleapis.com/v1/accounts:signInWithPassword` returning HTTP 400 is normal for Firebase Auth sign-in failures. The most likely cause for `fredkenogo@gmail.com` is one of:

- wrong password
- no email/password provider credential exists for that email
- account disabled
- too many failed attempts

The UI previously hid the actual Firebase Auth code behind a generic message. The code now maps common Firebase Auth failures to actionable messages.

## Likely Cause Of `redirect_uri_mismatch`

Because production runs on:

- `https://tiizi-challenges.web.app`

and the app uses redirect-based Google auth, Google/Firebase will use a redirect URI like:

- `https://tiizi-challenges.web.app/__/auth/handler`

The OAuth error `Error 400: redirect_uri_mismatch` means that exact redirect URI is not authorized on the Google OAuth client backing Firebase Auth.

## Code Changes Made

- Added `src/utils/firebaseAuthErrors.ts` for normalized Firebase Auth error handling.
- Updated `src/context/AuthContext.tsx` to:
  - expose redirect auth errors to UI
  - normalize redirect-result errors
  - clear stale auth errors before new auth attempts
  - set Google provider `prompt=select_account`
- Updated `src/features/Auth/LoginScreen.tsx` to:
  - show inline auth error text
  - show specific toast messages
  - normalize email/password and Google sign-in errors
  - avoid navigating immediately after `signInWithRedirect`

## Manual Console Actions Still Required

In Firebase Console:

1. Go to Authentication > Settings > Authorized domains.
2. Confirm these domains are authorized:
   - `tiizi-challenges.web.app`
   - `tiizi-challenges.firebaseapp.com`

In Google Cloud Console:

1. Open project `tiizi-challenges`.
2. Go to APIs & Services > Credentials.
3. Open the OAuth 2.0 Web client used by Firebase Authentication.
4. Add these Authorized redirect URIs if missing:
   - `https://tiizi-challenges.web.app/__/auth/handler`
   - `https://tiizi-challenges.firebaseapp.com/__/auth/handler`

No deployment was performed as part of this review.
