# Home Data Incident Report (For External Consultant)

Date: 2026-02-28  
Project: Tiizi Revamp (`/Users/theo/tiizi_revamp`)

## 1) Incident Summary

Home screen data hydration is inconsistent across auth/session transitions.

Observed behavior:
- First sign-in after app refresh can show blank Home sections:
  - `Active Challenge` => `No active group challenge yet.`
  - `Trending Challenges` => `No trending challenges available yet.`
- After sign-out/sign-in (or later session transitions), data appears.
- Some users with active membership still do not see active challenge card on Home.

Impact:
- Core trust and engagement issue on landing screen.
- Users may assume no challenges/groups exist.

## 2) Expected Behavior

- Any authenticated user should see public trending challenges without needing group membership.
- Active challenge card should only render when user is explicitly enrolled in an active challenge.
- Completed challenges should be view-only, not join/log.

## 3) What Was Already Implemented

Recent fixes already applied in code:
- Visibility-safe challenge fetch in Home using:
  - `challengeService.getVisibleChallengesForUser(uid, { statuses: ['active', 'completed'] })`
- Home query waits for auth readiness and token init:
  - `enabled: !!user?.uid && isReady`
  - `await user.getIdToken()` before reads
- One-shot Home refetch when payload resolves empty.
- Active challenge selection changed to strict membership-based logic.
- Membership backfill added: fetch challenge docs by membership IDs when missing from capped lists.
- Completed challenge CTA fixed to non-log/non-join behavior.

## 4) Current Hypothesis for Root Cause

Likely an auth + Firestore read ordering/race condition specific to first post-login render, with one or more of:
- `onAuthStateChanged` event arriving before all user/bootstrap reads are stable in first tick.
- User document bootstrap timing (`ensureUserDocument`) occurring after initial query windows in certain sessions.
- Multiple overlapping challenge sources with different visibility/index semantics racing during initial hydration.
- Query-level silent fallbacks masking partial permission/read failures.

No deterministic browser console error is currently reproduced by reporter during failing sessions.

## 5) Relevant Files for Consultant Review

Auth/session bootstrap:
- `src/context/AuthContext.tsx`
- `src/hooks/useAuth.ts`
- `src/features/Auth/LoginScreen.tsx`
- `src/features/Auth/SignupScreen.tsx`

Home hydration and fallbacks:
- `src/features/Home/useHomeScreen.ts`
- `src/features/Home/HomeScreen.tsx`
- `src/components/Home/ActiveChallengeCard.tsx`
- `src/components/Home/TrendingChallenges.tsx`

Challenge/group visibility and membership:
- `src/services/challengeService.ts`
- `src/services/groupService.ts`
- `src/hooks/useChallenges.ts`

Rules:
- `firestore.rules`

## 6) Reproduction Steps (Most Reliable)

1. Hard refresh app.
2. Sign in with a regular user.
3. Open Home immediately.
4. Observe blank trending/active.
5. Sign out and sign back in (same or different user).
6. Observe Home now showing data.

## 7) Suggested Consultant Debug Plan

1. Add scoped runtime telemetry for first 10s after auth:
   - auth ready timestamp
   - token resolved timestamp
   - user doc existence/read result
   - challenge query counts (`visible`, `accessible`, `membershipBackfill`)
   - rejected promise reasons (if any)
2. Move Home data query start behind explicit "bootstrap complete" gate:
   - e.g. after deterministic user-doc + role/profile read settles.
3. Consolidate to one canonical Home challenge source for first render.
4. Validate Firestore indexes and rule paths for first-read latency/perms edge cases.
5. Add integration test for first-signin Home hydration (cold start).

## 8) Status

Unresolved at root-cause level. Behavior improved in some sessions but still reproduces intermittently.

See also:
- `CHANGE.md` for all attempted fixes and timestamps.
