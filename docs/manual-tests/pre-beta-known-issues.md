# Tiizi Pre-Beta — Known Issues

Date: 2026-07-11

This list covers every gap identified during automated verification and
static audit for Phase 7 (Final Beta Readiness). None of these were
introduced by Phase 7 — all are pre-existing and were re-confirmed during
this pass.

## Blocking (must resolve before inviting testers)

1. **Support email is a placeholder.** `TermsScreen.tsx` and
   `PrivacyScreen.tsx` both display `support@tiizichallenges.com
   (placeholder — update ...)`. Beta testers will see this literal
   "placeholder" text in the legal documents. **Owner: founder** — needs a
   real monitored inbox before invites go out.
2. **No beta operations documents exist yet**: no tester list, no tester
   instructions, no feedback channel is documented anywhere in the repo.
   These are business/ops artifacts, not code — they must be created by the
   founder (see `docs/reports/pre-beta-final-readiness-report.md` Part 13
   for the exact list).
3. **Uncommitted work on the working branch.** `git status` shows 3 modified
   files and 2 untracked files (Phase 6B/7 guard and screen changes) not yet
   committed. The most recent committed, deployable checkpoint is
   `035addd41f32ebe7a735a65bcb387eebaa01ffa2` ("phase 6: enforce onboarding
   and complete home beta UX cleanup") — **this, not the working tree, is
   the current rollback point** until Phase 6B/7 work is committed.

## Non-blocking (tracked, safe to ship beta with)

4. **`testPilotUxPolishGuards.ts` fails on one assertion**: `HomeScreen.tsx`
   has no "activation card" for brand-new users with 0 groups/0 active
   challenges (`joinedGroupCount === 0|activeChallengeCount === 0`). This is
   an existing backlog item ("Add Home activation card for new users"), not
   a defect — new users still see Home's normal empty states, just not a
   dedicated activation card. User impact: slightly less guided first-run
   experience; no broken functionality.
5. **`npm run audit:secrets` reports "Google API key" matches** in several
   `docs/reports/phase-10c-p2-network-*.md` QA network-log artifacts at the
   repo root. These are Firebase **web** API keys (`AIzaSy...`), which are
   safe to expose publicly by design — Firebase access control is enforced
   by Firestore Security Rules and API-key HTTP referrer restrictions, not
   by keeping this key secret (see Firebase's own documentation on this).
   No actual secret (service account key, admin SDK credential, session
   token) was found. Cleanup recommendation: these root-level HAR-style dump
   files are QA scratch artifacts and could be moved out of the repo root
   or deleted in a future housekeeping pass — not a security blocker.
6. **`firestore.rules` compiles with 3 linter warnings**: one unused
   function (`isValidChallengeMemberCreate`) and two "invalid variable name:
   request" warnings from the Firestore rules linter. Rules compiled and
   deployed successfully in the dry-run; these are style warnings, not
   errors.
7. **Bundle size warning**: `vendor-firebase-internal` chunk is 537 kB
   minified (126 kB gzipped) — Vite's default 500 kB warning threshold.
   Pre-existing, not a functional issue; a code-splitting pass is a
   post-beta optimization candidate.

## Explicitly out of scope for this phase (confirmed, not defects)

- Secure group invite UI wiring — deferred by design; the disabled-state
  message ("Invite code joining is temporarily unavailable...") is present
  and consistent across `JoinGroupScreen.tsx` and `GroupsScreen.tsx`.
- `PlatformSupportScreen` routing — deferred by design, not wired.
- Broad Home redesign — deferred by design (Phase 6/6B decision).
