# Tiizi Pre-Beta Audit

**Date:** 2026-07-10
**Branch:** `fix/p0-pre-deploy-blockers`
**Auditor:** Claude Code (read-only audit — no source files were modified)

---

## Executive Summary

Tiizi is functionally close to beta-ready. The build compiles cleanly, TypeScript has zero errors, and 8 of 10 guard scripts pass. The core journeys — signup, onboarding, group join, challenge creation, activity logging, recaps, leaderboards, sharing, and the new install flow — are implemented and internally consistent.

However, there are **three critical items that must be resolved before inviting real users**:

1. A Firebase **service-account key sits in the project root and is not protected by `.gitignore`** — one accidental `git add -A` publishes admin credentials for the production database.
2. **481 modified files are uncommitted** on the working branch. There is no rollback point. Any mistake right now is unrecoverable without losing weeks of work.
3. **No error boundary exists** — any unexpected runtime crash shows users a permanently blank white screen with no recovery.

Beyond those, the highest-value pre-beta work is: fixing two stale guard scripts (currently failing and masking real regressions), closing three known Firestore rule/query gaps already tracked in the session task list, and adding Terms/Privacy links before real users sign up.

## Current Beta Readiness Status

**Verdict: NOT READY — but close.** Estimated 2–4 focused work phases from ready. No fundamental architecture problems were found. The blockers are operational (git hygiene, secrets, crash handling), not structural.

---

## What Appears Ready

- **Build & types:** `npm run build` succeeds (3.3s); `npx tsc --noEmit` clean.
- **Core challenge engine:** v2 engine (collective/competitive/streak) with a canonical progress resolver (`src/features/Challenges/challengeProgressResolver.ts`) used consistently by Home, ChallengeDetail, WorkoutLogged, and SelectChallengeActivity screens. Legacy v1 engine retained deliberately for old challenges.
- **Onboarding:** 5-step flow (personal → exercise → wellness → goals → privacy) with resume logic in `src/hooks/useProfileSetup.ts` covering every step.
- **Install/share growth loop:** `/install` public route with platform detection, `beforeinstallprompt` native prompt, Android label-variant guidance; `ShareTiiziCard` wired into Profile, WorkoutLogged, and GroupDetail (joined-only). 25/25 guards pass.
- **Admin panel:** fully routed behind `AdminRoute`; Firestore rules implement layered role checks (`admins` collection + `users.role` + `users.profile.role`).
- **Guard coverage:** 10 static guard scripts; 8 pass (mobile layout 54 checks, share/install 25 checks, share screen, movement types, isometric catalog, lifecycle, completion CTA, profile analytics).
- **Mobile layout:** recent visual polish pass standardized radii/borders/shadows across 21 screens; layout guards verify bottom-nav clearance and mobile width constraints.

---

## Critical Blockers

### PB-001 — Service account key unprotected in project root
- **Severity:** critical | **Area:** security
- **Issue:** `serviceAccountKey.json` exists at the repo root. It is **untracked but NOT listed in `.gitignore`** (verified: `git check-ignore serviceAccountKey.json` → not ignored). `.gitignore` covers `.env*` patterns but not this file.
- **Files:** `serviceAccountKey.json` (root), `.gitignore`
- **Why it matters:** This file grants full admin access to the production Firestore database. A single `git add -A && git push` to any remote — including a private one that later becomes public or is shared with a contractor — leaks it. Several scripts reference it by name (`scripts/auditGroupDocumentSchema.ts:25`, `scripts/auditChallengeProgressIntegrity.ts:329`), so it will stay in the root long-term.
- **Fix direction:** Add `serviceAccountKey.json` (and a `*.serviceaccount.json` pattern) to `.gitignore`. Verify it has never been committed in history (`git log --all --oneline -- serviceAccountKey.json`). If it ever was, rotate the key in Firebase Console.
- **Status:** NOT APPLICABLE (config fix, nothing to delete)

### PB-002 — 481 uncommitted modified files, no rollback point
- **Severity:** critical | **Area:** cleanup / process
- **Issue:** `git status` shows 481 modified files plus a large set of untracked docs/screenshots, all sitting uncommitted on `fix/p0-pre-deploy-blockers`. Recent commits on the branch are docs-only; the actual feature work (visual polish, onboarding split, install flow, and much more) exists only in the working tree.
- **Why it matters:** There is no restore point. A bad script, a disk issue, or an overzealous cleanup command loses weeks of work. It also makes review impossible — no one can diff "what changed for beta."
- **Fix direction:** Commit the working tree in logical chunks (or one checkpoint commit) **before any cleanup work begins**. This must be Phase 0 of the cleanup plan.
- **Status:** NOT APPLICABLE

### PB-003 — No React error boundary mounted
- **Severity:** critical | **Area:** frontend
- **Issue:** `src/components/ErrorBoundary.tsx` exists but is imported nowhere. `src/main.tsx` renders `<App />` bare; `App.tsx` has no boundary either.
- **Files:** `src/main.tsx`, `src/App.tsx`, `src/components/ErrorBoundary.tsx`
- **Why it matters:** Any uncaught render error (a null field from Firestore, a malformed challenge doc) blanks the entire app for the user with no message and no way back. With real users on real data, this **will** happen eventually.
- **Fix direction:** Wrap the router (or at minimum the `<Routes>` output) in the existing `ErrorBoundary` with a friendly "Something went wrong — tap to reload" fallback.
- **Status:** KEEP (the component — it just needs to be used)

---

## High-Priority Pre-Beta Issues

### PB-004 — testOnboardingGuards is stale and failing
- **Severity:** high | **Area:** tests
- **Issue:** `npx tsx scripts/testOnboardingGuards.ts` crashes: it asserts `ProfileWellnessInterestsScreen` saves `selectedGoals`, but the onboarding split (intentional, recent) moved goal selection to the new `ProfileHealthGoalsScreen.tsx`. The guard encodes the old 4-step design.
- **Files:** `scripts/testOnboardingGuards.ts:66`, `src/features/Profile/ProfileWellnessInterestsScreen.tsx`, `src/features/Profile/ProfileHealthGoalsScreen.tsx`
- **Why it matters:** A permanently red guard trains everyone to ignore guard failures — the whole safety net stops working.
- **Fix direction:** Update the guard to the 5-step flow: wellness screen preserves (not saves) goals; health-goals screen owns `selectedGoals`; resume logic includes `/app/profile/health-goals`.
- **Status:** KEEP (update, don't remove)

### PB-005 — testScoringGuards stale assertion + a real API footgun
- **Severity:** high | **Area:** tests / frontend
- **Issue:** Guard `18I-5F-5b` fails: it calls `buildChallengeProgress(challenge, membership)` expecting `challenge.groupCurrentTotal` to be used, but the resolver only uses group totals passed explicitly as the `priorTeamTotal` parameter. Production code (`src/features/Home/useHomeScreen.ts:226,272`) passes it correctly, so **the app is not broken** — but the shim silently ignores `challenge.groupCurrentTotal` in its first argument, which is a trap for any future caller.
- **Files:** `scripts/testScoringGuards.ts:5855`, `src/features/Challenges/challengeProgressDisplay.ts`, `src/features/Challenges/challengeProgressResolver.ts:185`
- **Why it matters:** Same "red guard fatigue" as PB-004, plus a genuine design wrinkle: a data shape that looks like it works but is ignored.
- **Fix direction:** Either (a) make the `buildChallengeProgress` shim default `priorTeamTotal` to `challenge.groupCurrentTotal` when not passed, and keep the test; or (b) update the test to pass the 6th argument. Option (a) is safer for future callers.
- **Status:** KEEP (update)

### PB-006 — Firestore rules: dailyGoals fields not self-writable
- **Severity:** high | **Area:** data / auth
- **Issue:** Pre-existing known gap (open task #1 in session tracker): users cannot write their own `dailyGoals` fields under the current `firestore.rules` self-write allowlist.
- **Files:** `firestore.rules` (users match block)
- **Why it matters:** The daily-goals feature silently fails for real users (writes rejected by rules), likely surfacing as goals that never save.
- **Fix direction:** Add the `dailyGoals` field names to the user self-writable field allowlist in rules; add a rules guard test.
- **Status:** NOT APPLICABLE

### PB-007 — Public group discovery missing visibility filter
- **Severity:** high | **Area:** data
- **Issue:** Known gap (open task #2): the group discovery query does not filter on `visibility`, so private groups can appear in public browse results. Needs the filter plus a composite index.
- **Files:** `src/services/groupService.ts` (discovery query), `firestore.indexes.json`
- **Why it matters:** Private-group leakage is a trust problem the moment a real user creates a private group.
- **Fix direction:** Add `where('visibility','==','public')` (or equivalent) to the discovery query; add the required index; guard-test it.
- **Status:** NOT APPLICABLE

### PB-008 — GroupDetail active-challenge card missing lifecycle filtering
- **Severity:** high | **Area:** UX / data
- **Issue:** Known gap (open task #3): `GroupDetailScreen` selects "active" challenges without fully applying the canonical lifecycle helpers, so ended challenges can appear as active.
- **Files:** `src/features/Groups/GroupDetailScreen.tsx`, `src/utils/challengeLifecycle.ts`
- **Why it matters:** Users tapping "Continue" on a finished challenge hit a confusing dead flow.
- **Fix direction:** Apply `isChallengeOngoing` consistently to the active list (the imports already exist in the file).
- **Status:** NOT APPLICABLE

### PB-009 — No Terms of Service / Privacy Policy links at signup
- **Severity:** high | **Area:** UX / legal
- **Issue:** `src/features/Legal/PrivacyScreen.tsx` and `TermsScreen.tsx` exist but are **not routed in App.tsx and not linked from SignupScreen** (verified by grep: no terms/privacy references in the signup flow).
- **Files:** `src/features/Legal/PrivacyScreen.tsx`, `src/features/Legal/TermsScreen.tsx`, `src/features/Auth/SignupScreen.tsx`, `src/App.tsx`
- **Why it matters:** You are about to collect real names, emails, health goals, and body metrics from real users. A privacy policy link at signup is a baseline expectation (and in many jurisdictions, a requirement).
- **Fix direction:** Route both screens publicly (e.g. `/terms`, `/privacy`), link them from the signup screen footer, and review the copy inside them.
- **Status:** KEEP

### PB-010 — Seed scripts with production writes and no dry-run protection
- **Severity:** high | **Area:** data
- **Issue:** Several scripts perform Firestore writes with **zero dry-run guard**: `scripts/seedAppData.ts` (12 write calls), `scripts/seedWellnessActivities.ts`, `scripts/seedBaselineData.ts`, `scripts/seedWellnessTemplates.ts`, and `scripts/auditGroupFeedAfterLog.ts` (4 writes despite "audit" in the name). By contrast, cleanup/backfill scripts correctly use `--apply` flags.
- **Files:** the five scripts above; `package.json` scripts `seed:app`, `seed:baseline`, `seed:wellness-*`
- **Why it matters:** One accidental `npm run seed:app` against production overwrites/duplicates live data with test content while real users are in the app.
- **Fix direction:** Add the same `--apply` gate pattern used by `cleanupSeedData.ts` to all seed scripts; make the default a dry-run report. Rename `auditGroupFeedAfterLog.ts` or strip its writes.
- **Status:** KEEP (guard, don't delete)

---

## Medium-Priority Cleanup Issues

### PB-011 — Catch-all route sends unknown URLs to /app/flow
- **Severity:** medium | **Area:** route
- **Issue:** `App.tsx:305` — `<Route path="*" element={<Navigate to="/app/flow" replace />} />`. Unknown URLs (typos, stale shared links) land on FlowHubScreen (protected), so logged-out users get bounced to login, and logged-in users land on a hub screen with no explanation.
- **Why it matters:** A shared broken link should say "page not found," not silently teleport. Minor confusion multiplier during beta.
- **Fix direction:** Either keep as-is (documented decision) or add a small NotFound screen with "Go home." Low effort, founder's call.
- **Status:** NEEDS CONFIRMATION

### PB-012 — Orphaned/unreferenced components
- **Severity:** medium | **Area:** cleanup
- **Issue:** Reference scan found these files imported nowhere else in `src/`:
  | File | Classification | Rationale |
  |---|---|---|
  | `src/components/ErrorBoundary.tsx` | **KEEP** | Must be wired in (PB-003), not removed |
  | `src/components/Home/TodaysGoalsList.tsx` | NEEDS CONFIRMATION | Superseded by newer Home components? |
  | `src/components/Auth/RequireProfileSetup.tsx` | NEEDS CONFIRMATION | Onboarding gating now lives in `useProfileSetup` — likely obsolete |
  | `src/components/Challenges/OngoingChallengeCard.tsx` | NEEDS CONFIRMATION | Likely replaced by `ActiveChallengeCard` |
  | `src/features/Challenges/CompletedChallengesScreen.tsx` | NEEDS CONFIRMATION | Unrouted screen; ChallengesScreen may have a completed tab instead |
  | `src/features/Legal/PrivacyScreen.tsx` / `TermsScreen.tsx` | **KEEP** | Needed for PB-009 |
  | `src/features/Groups/components/GroupInviteManagementPanel.tsx` | NEEDS CONFIRMATION | Invite management may have moved into EditGroup |
  | `src/features/Admin/Donations/PlatformSupportScreen.tsx` | NEEDS CONFIRMATION | Unrouted admin screen |
  | `src/features/Admin/Content/BooksScreen.tsx` | SAFE TO REMOVE | Its route already redirects: `App.tsx:249` sends `/app/admin/content/books` → `/app/admin/content/pages` |
  | `src/features/Admin/shared/AdminImageField.tsx` | NEEDS CONFIRMATION | Possibly superseded by inline image fields |
  | `src/features/Admin/Analytics/analyticsUi.tsx` | NEEDS CONFIRMATION | Shared helpers possibly inlined elsewhere |
- **Why it matters:** Dead files confuse future work ("which card component is the real one?") and slowly rot.
- **Fix direction:** After Phase 0 commit, delete SAFE items; for each NEEDS CONFIRMATION item run a final text-search + git-history check, then delete or document.

### PB-013 — Legacy v1 challenge engine retained
- **Severity:** medium | **Area:** cleanup
- **Issue:** `src/services/challengeEngine/legacyEngine.ts` plus `!isV2` branches in `WorkoutLoggedScreen.tsx`, `ChallengeCompletedScreen.tsx`, `challengeProgressResolver.ts` handle v1 challenges (no `engineVersion: 'v2'`).
- **Why it matters:** Legitimate if v1 challenge documents still exist in production; pure dead weight if not.
- **Fix direction:** Founder decision required: query production for challenges without `engineVersion === 'v2'`. If none exist and no beta data will create them, schedule v1 path removal **after** beta (not before — too risky now).
- **Status:** KEEP (for beta) / NEEDS CONFIRMATION (post-beta removal)

### PB-014 — Onboarding interests: known UX gaps
- **Severity:** medium | **Area:** UX
- **Issue:** Open tasks #6–#8 in session tracker: interests screen should have no pre-selected defaults, no max cap, minimum 3 required; Home needs an activation card for brand-new users; the active-challenges empty state on Home is weak.
- **Files:** `src/features/Profile/ProfileInterestsScreen.tsx`, `src/features/Home/HomeScreen.tsx`, `src/features/Home/useHomeScreen.ts`
- **Why it matters:** First-session experience is exactly what beta users judge.
- **Fix direction:** Implement per the already-scoped tasks; add onboarding guard assertions.
- **Status:** NOT APPLICABLE

### PB-015 — Repo-root clutter
- **Severity:** medium | **Area:** cleanup
- **Issue:** Untracked at root: `admin-dashboard-metrics.png`, `analytics-*.png` (4 screenshots), `.gitignore.backup-2026-05-25`, `.playwright-mcp/`, plus a large sprawl of untracked docs under `docs/reports/` and `docs/architecture/`.
- **Why it matters:** Noise that makes `git status` unreadable — which is partly how 481 files went uncommitted unnoticed.
- **Fix direction:** Move screenshots to `docs/assets/` or delete; delete `.gitignore.backup-*`; commit or prune docs; gitignore `.playwright-mcp/`.
- **Status:** screenshots/backup: SAFE TO REMOVE · docs: NEEDS CONFIRMATION

### PB-016 — No lint or unit-test tooling
- **Severity:** medium | **Area:** tests
- **Issue:** `npm run lint` and `npm test` don't exist. Quality gates are only `tsc`, `vite build`, and the static guard scripts.
- **Why it matters:** Guards are string-matching on source files — good regression tripwires, but they can't catch logic bugs. No unit tests exist for the scoring resolver (ironically the best-suited candidate — `testScoringGuards.ts` partially fills this with real fixture execution).
- **Fix direction:** Post-beta: add ESLint + a minimal vitest setup. Pre-beta: not required; don't block on it.
- **Status:** NOT APPLICABLE

### PB-017 — Firebase vendor bundle is 537 KB minified
- **Severity:** medium (borderline low) | **Area:** frontend
- **Issue:** Build warns: `vendor-firebase-internal` chunk 537 KB (126 KB gzipped). On Kenyan mobile networks (primary audience, region default is `'Kenya'`), initial load matters.
- **Fix direction:** Post-beta optimization (Firestore lite client or lazy Firebase init). Do not change now.
- **Status:** NOT APPLICABLE

---

## Low-Priority Cleanup Issues

### PB-018 — `/app/group/:id/leaderboard` retained as redirect
- **Severity:** low | **Area:** route
- The group leaderboard tab was removed (session task #11 completed); `GroupLeaderboardScreen` survives as a redirect target for stale links. Intentional. **KEEP**, add a one-line comment in App.tsx post-beta.

### PB-019 — Mockups tooling
- **Severity:** low | **Area:** cleanup
- `/mockups` routes are correctly DEV-gated (`import.meta.env.DEV`) and excluded from production builds. `src/features/Mockups/`, `scripts/syncScreenLayouts.mjs`, and `src/data/mockupAliases.ts` are development tooling. **KEEP.**

### PB-020 — `src/features/Placeholders/` is an empty directory
- **Severity:** low | **Area:** cleanup — **SAFE TO REMOVE** (empty dir).

### PB-021 — Single TODO-adjacent marker
- **Severity:** low — the only match for TODO/FIXME/HACK in `src/` is a phone-number placeholder string (`ChallengeDonationSection.tsx:150`), which is legitimate UI copy. No comment-debt problem. **NOT APPLICABLE.**

---

## Route / Navigation Findings (summary)

~110 routes reviewed in `src/App.tsx:193-305`.

- **Public:** `/install`, `/app/login`, `/app/signup`, `/app/welcome` — correct set. `/install` verified public (PB audit + guard script).
- **Protected:** all user screens behind `ProtectedRoute`; log/challenge flows additionally behind `RequireGroupRoute`. Consistent.
- **Admin:** every `/app/admin/*` behind `AdminRoute`; one internal redirect (books → pages) is clean.
- **Redirects:** `/` and `/app` → `/app/welcome`; `*` → `/app/flow` (PB-011).
- **Dead route targets:** none found — every routed element resolves to an existing lazy import.
- **Unrouted screens:** `CompletedChallengesScreen`, `PrivacyScreen`, `TermsScreen`, `PlatformSupportScreen`, `BooksScreen` (see PB-012, PB-009).

## User-Flow Findings (summary)

| Flow | Status | Notes |
|---|---|---|
| Signup / login | Complete | Missing legal links (PB-009) |
| Onboarding (5 steps) | Complete | Resume logic covers all steps; stale guard (PB-004); interests UX tasks open (PB-014) |
| Add to home screen | Complete | `/install` + native prompt + Android variants; 25/25 guards pass |
| Join group | Complete | First-click bug fixed (session task #14) |
| Create group | Complete | — |
| Create challenge (group + main flow) | Complete | Wizard behind RequireGroupRoute |
| Join challenge | Complete | participantCount guards pass |
| Log activity | Complete | Home Log Activity routed to SelectChallengeActivityScreen (recent fix) |
| Workout logged screen | Complete | Per-engine recap; canonical resolver |
| Challenge recap / completed | Complete | — |
| Leaderboard | Complete | Unified data source (session task #10/#12 lineage) |
| Share achievement | Complete | Achievement-based copy, type-specific; guards pass |
| Share Tiizi / install | Complete | Three entry points verified |
| Profile | Complete | Header share now functional |
| Reports / analytics | Complete | Profile analytics guards pass |
| Sign out / sign back in | Complete | Sign Out → `/app/login` replace; resume via onboarding path logic |
| **Group discovery** | **Partial** | Visibility filter missing (PB-007) |
| **Daily goals** | **Likely broken** | Rules gap (PB-006) |
| **Any flow, on crash** | **Broken** | No error boundary (PB-003) |

## Mobile UI Findings

- 54 layout guards pass (bottom-nav clearance, mobile max-width, no fixed CTAs at bottom-0).
- The recent visual-polish pass standardized card radii (`rounded-2xl`), borders (`border-slate-100`), shadows (`shadow-sm`), and section headers across 21 screens.
- Remaining manual-QA hotspots (no code defects found; visual verification needed on a real 360–390px device): Home activation/empty states (PB-014), GroupFeed composer on small screens, SuggestedChallenges filter-chip row wrap behavior, Install screen on actual iOS Safari + Samsung Chrome, and the profile photo (160px circle) on ≤360px screens.
- No oversized-heading or overlap defects surfaced from code review.

## Data / Backend Findings

- Firestore rules use layered role helpers; challenge-member create validated against configured activity counts. Rules gaps: PB-006 (dailyGoals).
- Query gaps: PB-007 (visibility), PB-008 (lifecycle filtering client-side).
- Seed scripts: PB-010 — five scripts write without dry-run gates; the backfill/cleanup family correctly uses `--apply`.
- `package.json` exposes `reset:all-data:apply` — a **production data wipe one command away**. It does have a two-step (`--apply`) gate, but consider removing the npm alias before beta so the wipe requires typing the full tsx command.
- Legacy field back-compat is handled in code (`primaryGoal`/`secondaryGoal` scalars hydrated into `goals[]`), which is correct for beta.

## Security Findings

- **PB-001 (critical):** unignored service-account key.
- Auth routes correctly partitioned (public vs protected vs admin).
- No hardcoded API secrets found in `src/` (Firebase web config is public by design).
- `npm run audit:secrets` exists (`scripts/scanSecrets.mjs`) — run it as part of Phase 0.
- Firestore rules appear thorough; a full rules simulation is out of scope for a static audit — recommend one manual pass in the Firebase console rules playground for the users/groups/challenges write paths.

## Testing / Verification Findings

- **Passing:** build, typecheck, mobile layout (54), share/install (25), share screen, movement types, isometric catalog, challenge lifecycle, completion CTA, profile analytics.
- **Failing (stale):** onboarding guards (PB-004), scoring guards 18I-5F-5b (PB-005).
- **Missing coverage:** group discovery visibility (add with PB-007 fix), dailyGoals rules (add with PB-006 fix), error-boundary presence (add with PB-003 fix), legal-links presence (add with PB-009 fix).
- No lint/unit-test infra (PB-016; post-beta).

---

## Manual QA Checklist (before inviting users)

On a real Android phone (Chrome) and a real iPhone (Safari):

1. [ ] Sign up fresh → complete all 5 onboarding steps → land on Home
2. [ ] Kill app mid-onboarding (after step 3) → reopen → resumes at step 4
3. [ ] Open `/install` → follow install steps → app launches standalone from home screen
4. [ ] In standalone mode, `/install` shows "already installed"
5. [ ] Create group → invite/join with a second account → both see each other in members
6. [ ] Create one challenge of each type (collective, competitive, streak) from group
7. [ ] Log activity in each type → verify recap numbers match challenge detail and leaderboard
8. [ ] Log activity twice same day on streak → streak counts one day
9. [ ] Share achievement → verify text is achievement-based (not generic invite)
10. [ ] Share Tiizi from Profile, recap, and group detail → link opens `/install`
11. [ ] Set daily goals → **verify they persist after reload** (PB-006 check)
12. [ ] Create a private group with account A → confirm account B cannot find it in discovery (PB-007 check)
13. [ ] Visit a garbage URL like `/app/xyz` → note where you land (PB-011)
14. [ ] Sign out → sign back in → land correctly (Home if onboarded)
15. [ ] Airplane mode mid-session → interact → confirm app degrades without white screen
16. [ ] Profile → analytics screen numbers look sane vs actual logged activity

## Open Questions (founder decisions)

1. **Do v1 (non-`engineVersion: 'v2'`) challenges exist in production?** Determines legacy engine fate (PB-013). Read-only check, safe to run.
2. **What should a nonexistent URL show** — the current silent redirect to `/app/flow`, or a small "page not found" screen? (PB-011)
3. **Do you have Terms/Privacy copy ready**, or does the text in the existing Legal screens need writing/legal review before routing them? (PB-009)
4. **Should `reset:all-data:apply` stay in package.json** during beta, or be removed so a wipe requires deliberate effort?
5. **Docs sprawl:** commit `docs/reports/*` history to git, or archive it outside the repo?
