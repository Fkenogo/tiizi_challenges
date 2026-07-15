# Tiizi Pre-Beta — Final Manual QA Matrix

Date: 2026-07-11
Environment: local dev server (`npm run dev`, no live Firebase auth session),
Browser pane (Chromium-based, resizable viewport). No physical Android/iPhone
device, no real Firebase test accounts, and no live production/staging
deployment were available in this environment.

**How to read this matrix:** every row is either
- ✅ **VERIFIED (static/dev)** — confirmed via code inspection, guard
  script, or an unauthenticated dev-server check in the Browser pane, or
- ⬜ **NOT EXECUTED — requires human tester** — needs a real account,
  a physical device, or a live deployed URL, none of which this session had
  access to. These rows must be run by a human before the final GO decision
  is finalized as unconditional.

## Part 4 — New-user onboarding QA

| # | Step | Result |
|---|---|---|
| 1 | Open shared Tiizi link | ⬜ NOT EXECUTED — requires live `tiizichallenges.com` deployment |
| 2 | Sign up | ⬜ NOT EXECUTED — requires a real test account |
| 3 | Open Terms and Privacy | ✅ VERIFIED (dev) — both render publicly, no auth gate, "Beta notice" banner present |
| 4 | Complete onboarding (personal details, ≥3 activities, wellness topics, health goals, privacy/final step) | ⬜ NOT EXECUTED — requires authenticated session. Code-level: 5-step flow confirmed registered and gated by `RequireOnboardingRoute` (`scripts/testOnboardingGuards.ts` passes); activity minimum verified at 3 (Phase 6B) |
| 5 | Before completion, manually open `/app/home` | ✅ VERIFIED (dev, logged out) — redirects to `/app/login`. Authenticated-but-incomplete case verified at the guard level (`scripts/testOnboardingGuards.ts`), not live |
| 6 | Confirm redirect to exact missing step | ⬜ NOT EXECUTED live — logic verified via `RequireProfileSetup`/`getOnboardingPath` guard assertions only |
| 7 | Finish onboarding | ⬜ NOT EXECUTED — requires live account |
| 8 | Confirm Home opens | ⬜ NOT EXECUTED — requires live account |
| 9 | Sign out and sign in again | ⬜ NOT EXECUTED — requires live account |
| 10 | Confirm no redirect loop | ✅ VERIFIED (guard) — `RequireProfileSetup` mode="onboarding" logic and `scripts/testOnboardingGuards.ts` explicitly assert no-loop conditions; not exercised live |
| 11 | Confirm saved selections remain intact | ⬜ NOT EXECUTED — requires live account. Code-level: `ProfileInterestsScreen` hydration effect confirmed unchanged (`useEffect` reading `profileSetup.exerciseInterests`) |

## Part 5 — Existing-user QA

| Test | Result |
|---|---|
| Login | ⬜ NOT EXECUTED — requires a completed-profile test account |
| Home loads | ⬜ NOT EXECUTED live. Static: `useHomeScreen.ts` service-layer reads verified bounded/chunked (Phase 6/6B), calculations unchanged |
| Group count correct | ⬜ NOT EXECUTED — requires live data |
| Ongoing challenge count correct | ⬜ NOT EXECUTED — requires live data |
| Profile loads | ⬜ NOT EXECUTED — requires live account |
| Completed challenge history opens | ⬜ NOT EXECUTED live. Static: `/app/challenges/history` route registered, gated by `RequireOnboardedRoute`, linked from Profile (Phase 6 Part 4B) |
| Profile edit saves | ⬜ NOT EXECUTED — requires live account + Firestore write |
| Privacy settings save | ⬜ NOT EXECUTED — requires live account + Firestore write |
| Forgot-password flow works logged out | ✅ VERIFIED (dev) — modal opens, empty/invalid email blocks send, valid-format email with no matching account shows success state, no console errors (Phase 6 QA) |
| Password reset does not reveal account existence | ✅ VERIFIED (dev + code) — `isPasswordResetVisibleError` allowlist confirmed; live-browser test with a non-existent address showed the same success copy |

## Part 6 — Group QA

| Test | Result |
|---|---|
| Create public group | ⬜ NOT EXECUTED — requires live account + Firestore write |
| Create private group | ⬜ NOT EXECUTED — requires live account + Firestore write |
| Private group hidden from another user's Discover tab | ⬜ NOT EXECUTED — requires two live accounts |
| Join public group | ⬜ NOT EXECUTED — requires live account |
| Leave group | ⬜ NOT EXECUTED — requires live account |
| Edit public → private / private → public | ⬜ NOT EXECUTED — requires live account |
| Visibility changes correctly | ⬜ NOT EXECUTED — requires live data |
| Group tabs work (Challenges / Feed / Members) | ✅ VERIFIED (static) — `scripts/testGroupDetailAndEdit.ts` passes; all three tab routes confirmed registered and reachable through `GroupSharedHeader`/`GroupDetailTabs` |
| Ongoing challenge count matches ongoing tab | ⬜ NOT EXECUTED — requires live data |
| Group type pill | ✅ VERIFIED (static) — restored in `GroupSharedHeader.tsx` (Phase 6 Part 4A), asserted by `scripts/testGroupDetailAndEdit.ts` |
| Disabled invite-code flow shows temporary-unavailable message | ✅ VERIFIED (static) — confirmed in `JoinGroupScreen.tsx` and `GroupsScreen.tsx`: "Invite code joining is temporarily unavailable. Ask the group owner to add you directly." |
| No broken secure-invite controls appear | ✅ VERIFIED (static) — secure invite UI is not wired anywhere in the routed app (explicitly deferred; grep confirms no dangling invite-management screens are linked) |

## Part 7 — Challenge QA matrix (6 combinations)

| Fitness | Wellness |
|---|---|
| Collective — ⬜ NOT EXECUTED (requires live accounts) | Collective — ⬜ NOT EXECUTED |
| Competitive — ⬜ NOT EXECUTED | Competitive — ⬜ NOT EXECUTED |
| Streak — ⬜ NOT EXECUTED | Streak — ⬜ NOT EXECUTED |

None of the 6 combinations' 15-step flows (create → join → log → recap →
detail → Home card → leaderboard → Group Feed → share → completion) were
exercised live — all require authenticated accounts and real Firestore
writes, which this session cannot perform without violating the "no
Firestore writes / no seeding" constraint.

**Regression checks covered by the automated guard suite instead** (all
passing in the 51/52 full-suite run):

| Check | Guard |
|---|---|
| Isometric hold defaults to seconds | `testExerciseLibraryIsometricGuards.ts` ✅ |
| Isotonic exercise defaults to reps | `testExerciseMovementTypeUiGuards.ts` ✅ |
| Step values above 10,000 retained | `testGroupFeedStepCapGuards.ts` ✅ |
| Collective values do not double-count | `testCollectiveDoubleCountGuards.ts` ✅ |
| Collective totals never show individual as team total | `testCollectiveTeamProgressRegressionGuards.ts` ✅ |
| v1 challenge paths not reachable | `testLegacyChallengeRemovalGuards.ts` ✅ (35/35) |
| Challenge performance source of truth | `testChallengePerformanceSourceOfTruthGuards.ts`, `testChallengePerformanceFinalRegressionGuards.ts` ✅ |
| Recap screen content | `testChallengeRecapScreenGuards.ts` ✅ |

## Part 8 — Share Tiizi and Install QA

| Test | Result |
|---|---|
| Share entry point: Profile | ✅ VERIFIED (static) — `ShareTiiziCard` used in `ProfileScreen.tsx` |
| Share entry point: Workout/challenge recap | ✅ VERIFIED (static) — `ShareTiiziCard` used in `WorkoutLoggedScreen.tsx` |
| Share entry point: joined Group Detail | ✅ VERIFIED (static) — `ShareTiiziCard` used in `GroupDetailScreen.tsx` |
| Native share opens where supported | ⬜ NOT EXECUTED — requires a real mobile browser with the Web Share API |
| Clipboard fallback works | ✅ VERIFIED (static) — `ShareTiiziCard.handleShare` falls back to `navigator.clipboard.writeText` when `navigator.share` is unavailable/rejected |
| Shared URL is exactly `https://www.tiizichallenges.com/install` | ✅ VERIFIED (static) — `INSTALL_URL` constant in `ShareTiiziCard.tsx` and `InstallScreen.tsx`'s own share button both use this exact string |
| Shared text is clear | ✅ VERIFIED (static) — "Tiizi helps you build healthy habits with group challenges. Add it to your home screen!" |
| No Firestore IDs or internal route IDs exposed | ✅ VERIFIED (static) — share payload is a static title/text/URL constant, no dynamic IDs interpolated |
| Android install (Samsung Chrome / other) | ⬜ NOT EXECUTED — requires a physical Android device |
| iPhone Safari install | ⬜ NOT EXECUTED — requires a physical iPhone |
| Desktop install-page detection | ✅ VERIFIED (dev, desktop viewport) — `/install` correctly shows "On your phone" guidance with a copyable link and a "Share Tiizi" button when loaded on a desktop-width browser |

**Note:** the on-page "on your phone" copy box on `/install` displays the
root domain `https://www.tiizichallenges.com` (an `APP_URL` constant
distinct from `INSTALL_URL`), not `/install`. This is informational text on
the install page itself, not one of the three share entry points the task
specifies (Profile/recap/Group Detail), which all correctly use
`INSTALL_URL` (`/install`). Flagged for awareness, not treated as a defect
against the Part 8A requirement, which is scoped to those three entry
points.

## Part 9 — Achievement-sharing QA

| Test | Result |
|---|---|
| Correct last-logged value / progress / rank / streak text | ⬜ NOT EXECUTED — requires live challenge data. Static: `testChallengeRecapScreenGuards.ts` passes |
| WhatsApp opens with correct copy | ⬜ NOT EXECUTED — requires live device/session |
| Copy Text works | ⬜ NOT EXECUTED — requires live session (clipboard permission) |
| Native share works where supported | ⬜ NOT EXECUTED — requires live mobile browser |
| Open Challenge goes to the real challenge | ⬜ NOT EXECUTED — requires live challenge ID |
| No generic invitation copy replaces achievement copy | ⬜ NOT EXECUTED — requires live recap render |

## Part 10 — Error and resilience QA

| Test | Result |
|---|---|
| Unknown URL → Page Not Found | ✅ VERIFIED (dev) — `/app/this-route-does-not-exist` renders `NotFoundScreen` with "Go to Tiizi" CTA |
| Invalid challenge ID → controlled state | ⬜ NOT EXECUTED live — requires exercising `ChallengeDetailScreen`'s not-found branch with a real (missing) ID |
| Invalid group ID → controlled state | ⬜ NOT EXECUTED live — same as above for `GroupDetailScreen` |
| Runtime error → ErrorBoundary | ✅ VERIFIED (static) — `ErrorBoundary` wraps the full route tree in `App.tsx`; renders "We could not load this screen." with Reload/Go home buttons |
| Reload app works | ✅ VERIFIED (static) — `handleReload` calls `window.location.reload()` |
| Go home works | ✅ VERIFIED (static) — `handleGoHome` navigates to `/app/welcome` |
| Slow network shows loading | ✅ VERIFIED (static) — `RequireProfileSetup` shows `LoadingSpinner fullScreen` while `isLoading || isFetching`; route-level `Suspense` fallbacks present for lazy-loaded screens |
| Failed request shows recoverable error | ⬜ NOT EXECUTED live — requires simulating a real network failure against Firestore |
| App never remains on a blank white screen | ✅ VERIFIED (static, partial) — ErrorBoundary + Suspense fallbacks cover the render tree; not stress-tested live |

## Part 11 — Device/layout QA

| Device/width | Result |
|---|---|
| Android Chrome (real device) | ⬜ NOT EXECUTED — no physical device available |
| iPhone Safari (real device) | ⬜ NOT EXECUTED — no physical device available |
| Desktop Chrome | ✅ VERIFIED (dev, Browser pane is Chromium-based) |
| 360px width | ✅ VERIFIED (dev) — `/app/welcome`, no horizontal scroll (`scrollWidth === clientWidth === 360`) |
| 390px width | ✅ VERIFIED (dev) — `/app/login`, no horizontal scroll (`scrollWidth === clientWidth === 390`) |
| 414px width | ⬜ NOT EXECUTED this session (414/430 not spot-checked individually; covered in aggregate by `testMobileLayoutGuards.ts`, 54/54 passing, which asserts layout classes across the app's screens) |
| 430px width | ⬜ NOT EXECUTED this session (see above) |
| Bottom nav / fixed buttons / chip rows / modal fit / keyboard-avoidance | ⬜ NOT EXECUTED live at these exact breakpoints on a real device (touch keyboard behavior can't be emulated in this environment); static class-level coverage exists via `testMobileLayoutGuards.ts` |

## Firebase/Deployment readiness (Part 12)

| Check | Result |
|---|---|
| `firebase use` → correct active project | ✅ `tiizi-challenges` |
| `firebase projects:list` → project exists and accessible | ✅ Confirmed, listed as `tiizi-challenges (current)` |
| `firestore.rules` compiles | ✅ Compiled successfully (3 non-blocking linter warnings — see known issues doc) |
| `firestore.indexes.json` present | ✅ Present |
| Cloud Functions source present | ✅ `functions/` directory present with build config |
| Hosting config present | ✅ `firebase.json` hosting block targets `dist/` with SPA rewrite |
| Dry-run rules deploy | ✅ `firebase deploy --only firestore:rules --dry-run` succeeded, no writes made |

## Summary

- **Static/dev-verifiable rows:** all passed.
- **Rows requiring a live account, physical device, or deployed URL:** not
  executed in this session — these must be run by a human tester (founder
  or a delegated QA tester) using the exact steps above before the beta
  invite goes out unconditionally.
