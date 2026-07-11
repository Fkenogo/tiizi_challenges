# Tiizi Pre-Beta Phase 7 — Final Beta Readiness Verification

Date: 2026-07-11
Branch: `fix/p0-pre-deploy-blockers`
Role: senior release QA engineer sign-off pass

## Release decision

# CONDITIONAL GO

Automated/static verification (repository safety, typecheck, build, guard
suite, route/link audit, Firebase project/rules readiness) is clean. What
this session **cannot** provide is live human/device confirmation — no real
test accounts, no physical Android/iPhone devices, and no live deployed URL
were available in this environment, and creating live test data would have
required Firestore writes/seeding, which is explicitly prohibited for this
phase. Beta invites should not go out until the three blocking items below
are closed and a human runs the golden-path rows marked "NOT EXECUTED" in
`docs/manual-tests/pre-beta-final-manual-qa-matrix.md`.

## 1. GO / CONDITIONAL GO / NO-GO

**CONDITIONAL GO** — conditional on:
1. Replacing the placeholder support email in Terms/Privacy with a real,
   monitored inbox.
2. Founder creating the beta-ops artifacts (tester list, tester
   instructions, feedback channel) — business/ops work, not code.
3. Committing the current uncommitted working-tree changes (Phase 6B + this
   phase's guard/audit additions) so the recorded rollback commit reflects
   what's actually being shipped.
4. A human running at minimum: one full new-user onboarding pass, one full
   existing-user pass, one challenge combination end-to-end, and one
   install pass per platform (Android + iPhone) — none of which this
   session could execute live.

None of these require further code changes discovered during this audit —
no code defect blocks beta. The gate is operational readiness and live human
verification, not the codebase.

## 2. Blocking issues

| # | Issue | Owner | Why it blocks |
|---|---|---|---|
| 1 | Support email placeholder in Terms/Privacy | Founder | Beta testers will read literal "placeholder — update" text in legal docs |
| 2 | No beta tester list / instructions / feedback channel documented | Founder | Task requirement; testers have no onboarding path or way to report issues |
| 3 | Working tree has uncommitted changes | Engineering | "Rollback commit" must reflect the code actually deployed, not an earlier checkpoint |
| 4 | No live human QA has been run on real accounts/devices | Founder / QA tester | Automated coverage cannot substitute for a real signup → onboarding → Home → challenge → install walkthrough |

None of these are code defects — see the Known Issues doc
(`docs/manual-tests/pre-beta-known-issues.md`) for the non-blocking items.

## 3. Non-blocking known issues

See `docs/manual-tests/pre-beta-known-issues.md` for full detail. Summary:
- `testPilotUxPolishGuards.ts` fails on one pre-existing, unrelated
  assertion (Home activation card for brand-new users — tracked backlog
  item, not a defect).
- `npm run audit:secrets` flags Firebase **web** API keys embedded in old
  QA network-log docs at the repo root — these are safe-to-expose keys by
  Firebase's own design, not real secrets. No actual credential was found.
- `firestore.rules` compiles with 3 non-blocking linter warnings.
- One Vite bundle-size warning (`vendor-firebase-internal`, 537 kB
  minified) — pre-existing, cosmetic build-output warning.

## 4. Automated test counts

```
npx tsc --noEmit    → clean, 0 errors
npm run build        → succeeds (1 pre-existing bundle-size warning, no errors)

Full guard suite (scripts/test*.ts, 53 scripts):
PASSED: 52
FAILED: 1
```

The 1 failure is `testPilotUxPolishGuards.ts`, on the pre-existing
"Home activation card" assertion documented above — confirmed unrelated to
any change made in this or prior phases.

Named Part 2 scripts, individually:
- `npx tsx scripts/testPilotUxPolishGuards.ts` → ❌ (documented, non-blocking)
- `npx tsx scripts/testHomePerformanceGuards.ts` → ✅
- `npx tsx scripts/testOnboardingGuards.ts` → ✅
- `npx tsx scripts/testHomeChallengeFeeds.ts` → ✅

Part 3 addition — new read-only route/link guard,
`scripts/testRouteLinkAudit.ts` (included in the 53-script count above):
- 267 `navigate()`/`<Link to>` destinations checked against 104 declared
  routes → all resolve.
- Catch-all `*` route renders `NotFoundScreen`.
- `/terms`, `/privacy`, `/install` confirmed public (no auth/onboarding/
  admin gate).
- `/app/challenges/history` confirmed gated by `RequireOnboardedRoute`.
- All non-redirect `/app/admin/*` routes confirmed wrapped in `AdminRoute`.

## 5. Manual QA results

Full matrix: `docs/manual-tests/pre-beta-final-manual-qa-matrix.md`.

Everything reachable without a live account or physical device was
verified in the Browser pane against the local dev server or via static
code inspection — all passed:
- Unauthenticated `/app/home` redirects to login.
- Unknown URL renders `NotFoundScreen`.
- `/terms` renders publicly with the beta-notice banner.
- `/install` renders desktop guidance correctly on a desktop-width viewport.
- No horizontal overflow at 360px (`/app/welcome`) or 390px (`/app/login`).
- Forgot-password flow (empty/invalid email blocked, success state shown
  without revealing account existence) — verified live in Phase 6 and
  re-confirmed unaffected by later phases.
- `ShareTiiziCard` (Profile, recap, Group Detail entry points) uses the
  exact `https://www.tiizichallenges.com/install` URL, clear copy, no
  Firestore/route IDs.
- `ErrorBoundary` renders Reload/Go home on a render crash.
- Group type pill, invite-disabled messaging, group tab routing —
  confirmed via passing guards (`testGroupDetailAndEdit.ts`).
- Challenge-engine regression checks (isometric seconds, isotonic reps,
  step cap >10,000, collective no-double-count, v1 unreachable) — all
  covered and passing via existing dedicated guard scripts.

**Not executed** (needs a human with a real account/device — see matrix for
the full row-by-row list): full new-user signup → onboarding → Home
walkthrough, existing-user data-accuracy checks (group/challenge counts),
group create/visibility/leave flows, all 6 challenge-type combinations
end-to-end, native share/WhatsApp/Android/iPhone install flows, and
achievement-recap copy accuracy against live data.

## 6. Device/browser results

| Surface | Result |
|---|---|
| Desktop Chrome (dev server, Browser pane) | ✅ Verified — no overflow at 360px/390px, 404/redirect/public-route behavior correct |
| Android Chrome (physical device) | ⬜ Not executed — no device available |
| iPhone Safari (physical device) | ⬜ Not executed — no device available |
| 414px / 430px widths | ⬜ Not individually spot-checked this session; covered in aggregate by `testMobileLayoutGuards.ts` (54/54 passing) |

## 7. Share/install results

- Share entry points (Profile, recap, Group Detail) all use
  `ShareTiiziCard`, sharing the exact URL `https://www.tiizichallenges.com/install`
  with clear copy and no exposed IDs — verified statically.
- Clipboard fallback path confirmed in code (`navigator.clipboard.writeText`
  when `navigator.share` is unavailable).
- `/install` desktop path verified live: shows "On your phone" guidance,
  copyable link, and a working "Share Tiizi" button.
- Native share, Android install-prompt, and iPhone Add-to-Home-Screen flows
  were **not executed** — require real devices.

## 8. Required deployment commands

**Do not run these automatically — the founder must execute deploys in this
exact order, after the blocking items above are closed.**

```bash
# 1. Confirm the correct project is active (already confirmed this session)
firebase use tiizi-challenges

# 2. Deploy Firestore rules and indexes first (data-access layer before code
#    that depends on it)
firebase deploy --only firestore:rules,firestore:indexes

# 3. Deploy Cloud Functions
firebase deploy --only functions

# 4. Build and deploy Hosting last (so the live app only ever points at
#    rules/functions that are already live)
npm run build
firebase deploy --only hosting
```

Rules were already validated with a dry run this session
(`firebase deploy --only firestore:rules --dry-run` — compiled successfully,
3 non-blocking linter warnings, zero writes made).

## 9. Rollback commit

**Current recorded rollback commit:**
`035addd41f32ebe7a735a65bcb387eebaa01ffa2`
("phase 6: enforce onboarding and complete home beta UX cleanup")

This is the last **committed** state. The working tree currently has
uncommitted Phase 6B/7 changes (activity-interest minimum, rewritten
`testHomePerformanceGuards.ts`, new `testRouteLinkAudit.ts`, this
documentation). **Before deploying, commit this work and record the new
commit hash as the rollback point** — do not deploy from an uncommitted
working tree.

To roll back after a bad deploy:
```bash
git log --oneline -10          # confirm the last-known-good commit
git checkout <rollback-commit> -- .
npm run build
firebase deploy --only hosting
```
(Rules/functions rollback requires redeploying the prior rules/functions
source from that same commit, not just hosting.)

## 10. Exact warnings to give beta users

- "Tiizi is in private beta. Some features (secure group invite links,
  certain platform-support flows) are intentionally disabled or
  placeholder for now."
- "If you leave and rejoin a group, or edit group visibility, please
  report anything that looks wrong — this flow has not yet been verified
  with real accounts in this round of testing."
- "If you see a support email that says 'placeholder,' that's a known gap
  being fixed before wider release — use [insert founder's real contact
  channel] instead for now."
- "This is a small, early group — expect some rough edges, and please use
  the feedback channel above rather than assuming a bug is intentional."

## Files changed / added this phase

- `src/features/Profile/ProfileInterestsScreen.tsx` — (Phase 6B, carried
  forward) min-3/max-10 activity selection.
- `scripts/testPilotUxPolishGuards.ts`, `scripts/testHomePerformanceGuards.ts`
  — (Phase 6B, carried forward).
- `scripts/testRouteLinkAudit.ts` — new read-only route/link audit guard
  (Phase 7 Part 3).
- `docs/reports/pre-beta-final-readiness-report.md` — this report.
- `docs/manual-tests/pre-beta-final-manual-qa-matrix.md` — full QA matrix.
- `docs/manual-tests/pre-beta-known-issues.md` — known issues list.

No Firestore writes, seeds, resets, or deploys were performed. No features
were added and no screens were redesigned.
