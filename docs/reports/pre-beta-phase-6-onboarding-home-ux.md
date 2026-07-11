# Pre-Beta Phase 6 — Onboarding and Home Beta UX Cleanup

Date: 2026-07-11
Branch: `fix/p0-pre-deploy-blockers`

## Summary

Wired the pre-existing but unused onboarding gate into routing, added a
self-service forgot-password flow, moved Home's direct Firestore reads into
`challengeService`, restored the group-type quick tag on the group detail
header, and routed the previously-orphaned completed-challenges list.

## Files changed

- `src/components/Auth/RequireOnboardedRoute.tsx` (new) — composes
  `ProtectedRoute` + `RequireProfileSetup mode="completed"` for normal
  authenticated routes.
- `src/components/Auth/RequireOnboardingRoute.tsx` (new) — composes
  `ProtectedRoute` + `RequireProfileSetup mode="onboarding"` for the
  onboarding step routes themselves.
- `src/App.tsx` — 46 normal authenticated routes now use
  `RequireOnboardedRoute`; 7 onboarding routes use `RequireOnboardingRoute`;
  added `/app/challenges/history` route for `CompletedChallengesScreen`.
  Admin routes (`AdminRoute`) and public routes (login/signup/welcome/legal)
  are unchanged.
- `src/features/Auth/LoginScreen.tsx` — added `ForgotPasswordModal` and a
  "Forgot password?" link under the password field.
- `src/utils/firebaseAuthErrors.ts` — added `isPasswordResetVisibleError()`,
  an allowlist of the only error codes safe to show during password reset
  (`auth/invalid-email`, `auth/too-many-requests`); everything else,
  including "no account found," is treated as success in the UI.
- `src/services/challengeService.ts` — added `getChallengesByIds()`,
  `getCompetitiveLeaderboards()`, `getChallengeActivitySummaries()`.
- `src/features/Home/useHomeScreen.ts` — replaced four inline Firestore
  reads with calls to the new `challengeService` methods; no more
  `firebase/firestore` import.
- `src/features/Groups/components/GroupSharedHeader.tsx` — added a subtle
  `groupType` pill to the compact info strip.
- `src/features/Profile/ProfileScreen.tsx` — added a "View completed
  challenges →" entry point linking to `/app/challenges/history`.
- `scripts/testOnboardingGuards.ts` — added Phase 6 onboarding-gate wiring
  assertions.
- `scripts/testGroupDetailAndEdit.ts`, `scripts/testHomeChallengeFeeds.ts` —
  updated stale assertions that predated the header-unification and
  service-layer refactors (see "Guard maintenance" below).

## Part 1 — Onboarding gate

`RequireProfileSetup` existed but was never referenced from `App.tsx`. Two
thin wrapper components were added instead of touching ~50 call sites
individually:

- `RequireOnboardedRoute` — auth + "onboarding complete" gate, used on all
  normal app routes (Home, Groups, Challenges, Profile, etc.).
- `RequireOnboardingRoute` — auth + "on the correct onboarding step" gate,
  used only on the 7 onboarding-step routes.

Result: an authenticated user with incomplete onboarding hitting any normal
route (e.g. `/app/home`) is redirected to their exact next onboarding step.
A fully onboarded user hitting an onboarding route is redirected to
`/app/home`. `/app/profile/privacy-settings` was confirmed (by grepping all
`navigate()` call sites) to be reachable only from within the onboarding
flow, so no dual-purpose conflict exists. Admin and public routes are
untouched — they don't match the `<ProtectedRoute>` pattern the transform
targeted.

## Part 2 — Forgot password

Added `ForgotPasswordModal` in `LoginScreen.tsx`: validates email format
client-side, calls `sendPasswordResetEmail`, shows "Check your email for a
password reset link." on success. On error, only `auth/invalid-email` and
`auth/too-many-requests` are surfaced as real errors (via the new
`isPasswordResetVisibleError` allowlist in `firebaseAuthErrors.ts`) —
`auth/user-not-found` and everything else is treated as success, so the UI
never reveals whether an account exists. Verified manually in-browser: empty
input keeps the button disabled, an invalid-format email keeps it disabled,
and a valid-format email with no matching account still shows the success
state.

## Part 3 — Home service-layer cleanup

`useHomeScreen.ts` had four inline Firestore reads (chunked
`documentId() in` queries and a per-challenge `challengeMembers` query).
Moved them into `challengeService`:

- `getChallengesByIds(ids)` — chunked backfill for challenges missing from
  the initial visible/accessible challenge lists.
- `getCompetitiveLeaderboards(challengeIds)` — per-challenge member score
  list for competitive v2 progress display.
- `getChallengeActivitySummaries(challengeIds)` — chunked
  `challengeActivitySummaries` read, now returning both `totalValue` and
  `totalLogs` (previously two near-identical inline queries reading one
  field each); called twice with different id sets exactly as before, so
  read count and chunking (10 per `in` query) are unchanged.

Query semantics, limits, sort order, and returned shape are byte-for-byte
identical to the pre-refactor code — only the call site moved.
`useHomeScreen.ts` no longer imports `firebase/firestore`.

## Part 4 — UI gaps

**4A — groupType tag:** restored as a subtle uppercase pill in
`GroupSharedHeader`'s compact info strip, next to the "Group since" date.

**4B — CompletedChallengesScreen:** confirmed non-duplicative —
`/app/challenges/completed` routes to `ChallengeCompletedScreen` (a
per-challenge completion/celebration screen), while
`CompletedChallengesScreen` is a list of all of the user's completed
challenges and had no route or entry point anywhere. Routed it at
`/app/challenges/history` and added a subtle link from `ProfileScreen`.

## Guard maintenance

Fixing groupType surfaced four other assertions in
`testGroupDetailAndEdit.ts` that were checking `GroupDetailScreen.tsx` alone
for the owner-gate button, its edit-route navigation, and the details modal
wiring — all of which moved into `GroupSharedHeader.tsx` during an earlier
header-unification refactor (before this phase) and were never updated.
Updated those four assertions to check the combined source, matching the
pattern the file already uses for the description-preview and
"Group since" checks. Same story in `testHomeChallengeFeeds.ts`: three
assertions expected the `challengeActivitySummaries` literal, the
`documentId() in` chunking, and the `totalLogs ?? 0` fallback directly in
`useHomeScreen.ts`; updated to check `challengeService.ts` (or the
service-call site) since that's where the Phase 6 refactor moved them.

## Known gaps not fixed (out of scope / conflicting with Part 5)

- **`testHomePerformanceGuards.ts` still fails.** Its forbidden-pattern list
  bans `groupService` and `userProfileService` entirely and requires
  `getChallengesPage`, `getActiveChallengesForUser`, and `memberMetricsService`
  calls that don't exist anywhere in the codebase. Satisfying it would mean
  removing Home's group-count and profile-header reads and introducing new
  service methods — a broad Home redesign, which Part 5 explicitly defers.
  The literal Phase 6 requirement ("remove direct firebase/firestore query
  imports from useHomeScreen.ts") is done — the file no longer imports
  `firebase/firestore` or calls `getDocs`/`collection`/`documentId` at all.
- **`testPilotUxPolishGuards.ts` still fails**, but not on anything in this
  phase — it fails on a pre-existing, unrelated assertion that
  `ProfileInterestsScreen` requires a minimum of 3 interests
  (`selectedInterests.length < 3`). That screen was never touched in Phase 6
  and the gap is already tracked as an open task ("Fix interests: no
  defaults, no max cap, min 3 required") from before this phase. The three
  Part-2-relevant assertions in that same file (Forgot password link,
  `sendPasswordResetEmail` call, no raw Firebase codes, `auth/missing-email`
  handling) all pass when checked in isolation.

## Guard results

Ran all 52 scripts under `scripts/test*.ts`:

**50 passed, 2 failed** — both pre-existing/out-of-scope as documented above
(`testHomePerformanceGuards.ts`, `testPilotUxPolishGuards.ts`).

Named Part 6 scripts:
- `testOnboardingGuards.ts` — ✅ pass
- `testHomePerformanceGuards.ts` — ❌ fail (documented gap, broad redesign deferred)
- `testPilotUxPolishGuards.ts` — ❌ fail (pre-existing, unrelated ProfileInterestsScreen gap)
- `testGroupDetailAndEdit.ts` — ✅ pass
- `testHomeChallengeFeeds.ts` — ✅ pass
- `testMobileLayoutGuards.ts` — ✅ pass (54/54)
- `testLegacyChallengeRemovalGuards.ts` — ✅ pass (35/35)

## Typecheck / build

- `npx tsc --noEmit` — clean, no errors.
- `npm run build` — succeeds (only a pre-existing "chunk >500kB" size
  warning on `vendor-firebase-internal`, unrelated to this phase).

## Manual test matrix

Performed in-browser (dev server, no auth backend session available for a
full two-account walkthrough):

| Test | Result |
|---|---|
| Unauthenticated visit to `/app/home` | ✅ Redirects to `/app/login` |
| LoginScreen shows "Forgot password?" | ✅ |
| Forgot-password modal opens | ✅ |
| Empty email → Send disabled | ✅ |
| Invalid-format email → Send disabled | ✅ |
| Valid-format email, no matching account → success shown | ✅ ("Check your email for a password reset link.") — confirms no account-existence leak |
| Console/network errors during flow | ✅ None observed |

**Still required (needs real test accounts, not available in this
session):**
- User A (incomplete onboarding, authenticated) hitting `/app/home` directly
  → redirect to exact missing onboarding step → complete all 5 steps →
  Home opens → sign out/in → no redirect loop.
- User B (completed profile) → direct Home access → challenge cards/progress
  values match pre-Phase-6 numbers exactly → completed-challenges nav works
  end-to-end from Profile.

## Deferred (per Part 5, not implemented)

Secure group invite UI wiring, PlatformSupportScreen routing, broad Home
redesign, new analytics, Firestore rules/index changes, challenge engine
changes, legacy data cleanup.
