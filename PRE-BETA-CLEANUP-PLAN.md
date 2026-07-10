# Tiizi Pre-Beta Cleanup Plan

**Date:** 2026-07-10 · Companion to `PRE-BETA-AUDIT.md`
**Rule for every phase:** stop after each phase, run verification, and review before starting the next. Never combine phases in one change.

**Global verification commands** (run at the end of every phase):

```bash
npx tsc --noEmit
npm run build
npx tsx scripts/testMobileLayoutGuards.ts
npx tsx scripts/testShareTiiziInstallGuards.ts
```

---

## Phase 0: Safety checks and branch setup — DO THIS FIRST

### Task 0.1 — Protect the service account key
- **Linked finding:** PB-001
- **Objective:** Make it impossible to accidentally commit admin credentials.
- **Files:** `.gitignore`
- **Guidance:** Append to `.gitignore`:
  ```
  serviceAccountKey.json
  *serviceAccount*.json
  ```
  Then verify history is clean: `git log --all --oneline -- serviceAccountKey.json` must return nothing. If it returns anything, STOP and rotate the key in Firebase Console (Project Settings → Service Accounts) before proceeding.
- **Acceptance:** `git check-ignore serviceAccountKey.json` prints the filename (i.e., ignored).
- **Verification:** the command above + `npm run audit:secrets`
- **Risk:** none · **Founder approval:** not needed

### Task 0.2 — Checkpoint commit of all pending work
- **Linked finding:** PB-002
- **Objective:** Create a rollback point for the 481 modified files.
- **Files:** all modified tracked files (no source edits — just commit what exists)
- **Guidance:** On `fix/p0-pre-deploy-blockers`, stage tracked modifications only (`git add -u`), commit as `checkpoint: pre-beta working state (visual polish, onboarding split, install flow)`. Do NOT `git add -A` until 0.1 is done and root clutter (Task 2.3) is decided. Untracked docs can be committed separately or deferred.
- **Acceptance:** `git status` shows no modified tracked files; `git log -1` shows the checkpoint.
- **Risk:** none · **Founder approval:** not needed

### Task 0.3 — Baseline validation snapshot
- **Objective:** Record the known-good baseline all later phases compare against.
- **Guidance:** Run the global verification commands plus all 10 guard scripts; save output to `docs/reports/pre-beta-baseline-validation.md`. Expected: everything passes except `testOnboardingGuards` and `testScoringGuards` (known stale — fixed in Phase 1).
- **Risk:** none · **Founder approval:** not needed

---

## Phase 1: Broken guards, broken links, and dead-end routes

### Task 1.1 — Fix stale onboarding guard
- **Linked finding:** PB-004
- **Objective:** `testOnboardingGuards.ts` passes and encodes the 5-step flow.
- **Files:** `scripts/testOnboardingGuards.ts` (only — no app code)
- **Guidance:** Replace assertions that expect `ProfileWellnessInterestsScreen` to own `selectedGoals` with: (a) wellness screen preserves `setup?.goals` in its payload; (b) `ProfileHealthGoalsScreen.tsx` owns `selectedGoals` and validates ≥1 goal; (c) `useProfileSetup.ts` routes `!goals?.length` → `/app/profile/health-goals`; (d) all five step labels ("Step N of 5") present in their screens.
- **Acceptance:** `npx tsx scripts/testOnboardingGuards.ts` exits 0.
- **Risk:** low · **Founder approval:** not needed

### Task 1.2 — Fix scoring guard + shim footgun
- **Linked finding:** PB-005
- **Objective:** `testScoringGuards.ts` passes; `buildChallengeProgress` no longer silently ignores `challenge.groupCurrentTotal`.
- **Files:** `src/features/Challenges/challengeProgressDisplay.ts`, possibly `scripts/testScoringGuards.ts`
- **Guidance:** In the shim, when `priorTeamTotal` is undefined, default it to `challenge.groupCurrentTotal`:
  ```ts
  const resolved = resolveChallengeProgress({
    challenge, membership, leaderboard, currentUserId, activitySummaryTotal,
    priorTeamTotal: priorTeamTotal ?? challenge.groupCurrentTotal,
  });
  ```
  This preserves existing callers (useHomeScreen passes it explicitly; `??` is a no-op there) and makes the guard pass unchanged.
- **Acceptance:** `npx tsx scripts/testScoringGuards.ts` exits 0; Home screen collective cards still show correct totals (manual spot check in preview).
- **Risk:** low (additive default) · **Founder approval:** not needed

### Task 1.3 — Route and link Terms/Privacy
- **Linked finding:** PB-009
- **Objective:** Legal screens reachable; signup links to them.
- **Files:** `src/App.tsx`, `src/features/Auth/SignupScreen.tsx`, `src/features/Legal/PrivacyScreen.tsx`, `src/features/Legal/TermsScreen.tsx`
- **Guidance:** Add public routes `/terms` and `/privacy` (lazy imports, no ProtectedRoute). Add a footer line to SignupScreen: "By signing up you agree to our [Terms] and [Privacy Policy]." Review the copy in both screens with the founder first — do not ship placeholder legal text.
- **Acceptance:** both URLs render logged-out; signup shows working links; guards pass.
- **Risk:** low · **Founder approval:** **YES — legal copy must be reviewed**

### Task 1.4 — Decide and implement 404 behavior
- **Linked finding:** PB-011
- **Objective:** Unknown URLs behave intentionally.
- **Files:** `src/App.tsx` (+ optionally a small `NotFoundScreen`)
- **Guidance:** Option A (recommended): minimal public NotFound screen with "Go to Tiizi" button → `/app/home`. Option B: keep redirect, add explanatory comment. ~30 lines either way.
- **Acceptance:** visiting `/nonsense` gives a deliberate experience.
- **Risk:** low · **Founder approval:** **YES — pick A or B**

---

## Phase 2: Safe dead-code cleanup

### Task 2.1 — Wire the ErrorBoundary (not removal — activation)
- **Linked finding:** PB-003
- **Objective:** Runtime crashes show a recovery screen, not a white page.
- **Files:** `src/App.tsx` (or `src/main.tsx`), `src/components/ErrorBoundary.tsx`
- **Guidance:** Read `ErrorBoundary.tsx` first; verify it renders a fallback with a reload action (add one if missing — button calling `window.location.reload()`). Wrap the `<Routes>` subtree (inside providers, so toasts/auth still work in the fallback path).
- **Acceptance:** temporarily throwing inside a screen (dev only, reverted) shows the fallback instead of a white screen; build + guards pass.
- **Risk:** low · **Founder approval:** not needed

### Task 2.2 — Remove confirmed-dead files
- **Linked finding:** PB-012, PB-020
- **Objective:** Delete only the SAFE TO REMOVE set.
- **Files to delete:** `src/features/Admin/Content/BooksScreen.tsx` (route already redirects away, `App.tsx:249`), `src/features/Placeholders/` (empty dir).
- **Guidance:** Before each deletion re-run `grep -rn "<name>" src/` to confirm zero references; delete; build.
- **Acceptance:** build + typecheck clean after deletions.
- **Risk:** low · **Founder approval:** not needed

### Task 2.3 — Root and docs clutter
- **Linked finding:** PB-015
- **Objective:** Clean `git status` output.
- **Files:** root `*.png` screenshots, `.gitignore.backup-2026-05-25`, `.playwright-mcp/` (gitignore it), `docs/reports/*` untracked files
- **Guidance:** Delete the backup file; move or delete screenshots; add `.playwright-mcp/` to `.gitignore`. For docs: present the founder the list, then commit-or-archive per their choice.
- **Acceptance:** `git status --short` fits on one screen.
- **Risk:** none · **Founder approval:** **YES for docs disposition**, no for the rest

### Task 2.4 — Investigate NEEDS CONFIRMATION components
- **Linked finding:** PB-012
- **Objective:** Resolve each to delete-or-keep with evidence.
- **Files:** `TodaysGoalsList.tsx`, `RequireProfileSetup.tsx`, `OngoingChallengeCard.tsx`, `CompletedChallengesScreen.tsx`, `GroupInviteManagementPanel.tsx`, `PlatformSupportScreen.tsx`, `AdminImageField.tsx`, `analyticsUi.tsx`
- **Guidance:** For each: full-text search (including dynamic import strings), `git log --oneline -3 -- <file>` for context, one-line verdict in a short report. Delete confirmed-dead ones in a separate commit per file group. Do not delete anything with ambiguous evidence.
- **Acceptance:** report written; deletions build clean.
- **Risk:** medium (mitigated by per-file evidence + checkpoint commit) · **Founder approval:** show verdict list before deleting

---

## Phase 3: Duplicate logic / source-of-truth cleanup

### Task 3.1 — Firestore rules: dailyGoals self-write
- **Linked finding:** PB-006
- **Files:** `firestore.rules`, new/extended rules guard script
- **Guidance:** Add the dailyGoals field names to the user self-writable allowlist. Deploy of rules is a SEPARATE, founder-approved step (`npm run deploy:firestore`) — the code change alone does nothing until deployed.
- **Acceptance:** rules file updated; `firebase_validate_security_rules` (or emulator test) passes; guard added.
- **Risk:** medium (rules changes affect prod on deploy) · **Founder approval:** **YES before deploy**

### Task 3.2 — Group discovery visibility filter
- **Linked finding:** PB-007
- **Files:** `src/services/groupService.ts`, `firestore.indexes.json`, guard script
- **Guidance:** Add visibility filter to the public discovery query; add composite index; guard-test that the query string includes the filter. Index deploy is founder-approved.
- **Acceptance:** private group invisible in discovery (manual two-account test); guards pass.
- **Risk:** medium · **Founder approval:** **YES before index deploy**

### Task 3.3 — GroupDetail lifecycle filtering
- **Linked finding:** PB-008
- **Files:** `src/features/Groups/GroupDetailScreen.tsx`
- **Guidance:** Apply `isChallengeOngoing` / `isChallengeUpcoming` (already imported in the file) consistently to the active-challenges list so ended challenges drop out.
- **Acceptance:** an ended challenge no longer renders in the Active row; guards pass.
- **Risk:** low · **Founder approval:** not needed

### Task 3.4 — Seed-script dry-run gates
- **Linked finding:** PB-010
- **Files:** `scripts/seedAppData.ts`, `scripts/seedBaselineData.ts`, `scripts/seedWellnessActivities.ts`, `scripts/seedWellnessTemplates.ts`, `scripts/auditGroupFeedAfterLog.ts`, `package.json`
- **Guidance:** Copy the `--apply` gate pattern from `scripts/cleanupSeedData.ts`: default run prints what WOULD be written and exits; writes only with `--apply`. In package.json, split each seed script into `seed:x` (dry) and `seed:x:apply`. For `auditGroupFeedAfterLog.ts`, remove or gate its 4 write calls. Also: founder decision on removing `reset:all-data:apply` alias.
- **Acceptance:** running any `seed:*` without `--apply` performs zero writes (verify by log output).
- **Risk:** low (safety-only change) · **Founder approval:** yes for the reset-alias decision

---

## Phase 4: Mobile UI cleanup

### Task 4.1 — Manual visual QA pass (no code)
- **Linked finding:** Mobile UI findings section
- **Guidance:** On a 360–390px device or emulation: Home (new-user + active states), GroupFeed composer, SuggestedChallenges chips, Install screen (real iOS Safari + Samsung Chrome), Profile on ≤360px. File findings as a short list; fix only concrete defects in Task 4.2.
- **Risk:** none · **Founder approval:** not needed

### Task 4.2 — Fix defects found in 4.1
- **Guidance:** Small, targeted class-level fixes only; follow existing token conventions (`rounded-2xl`, `border-slate-100`, `shadow-sm`, `st-*` classes). No redesigns.
- **Acceptance:** layout guards still pass (54 checks); before/after screenshots.
- **Risk:** low · **Founder approval:** not needed

---

## Phase 5: User-flow QA fixes

### Task 5.1 — Onboarding interests rules
- **Linked finding:** PB-014 (session task #6)
- **Files:** `src/features/Profile/ProfileInterestsScreen.tsx`
- **Guidance:** No pre-selected defaults; remove max cap; require minimum 3 selections with clear validation copy. Extend onboarding guards.
- **Risk:** low · **Founder approval:** not needed

### Task 5.2 — Home activation card + empty states
- **Linked finding:** PB-014 (session tasks #7, #8)
- **Files:** `src/features/Home/HomeScreen.tsx`, `src/features/Home/useHomeScreen.ts`
- **Guidance:** New-user activation card (join a group / browse challenges CTAs) when user has no groups/challenges; improve the active-challenges empty state. Match existing card conventions.
- **Risk:** low · **Founder approval:** copy review recommended

### Task 5.3 — Execute full manual QA checklist
- **Guidance:** Run the 16-item checklist from `PRE-BETA-AUDIT.md` on real devices with two test accounts. Log every failure as a finding; fix in scoped follow-ups.
- **Risk:** none · **Founder approval:** founder should participate

---

## Phase 6: Security / env / doc cleanup

### Task 6.1 — Secrets and env audit
- **Guidance:** Run `npm run audit:secrets`; verify `.env.example` matches actual required vars; confirm no keys in `docs/`. Re-verify Task 0.1.
- **Risk:** none · **Founder approval:** not needed

### Task 6.2 — Firestore rules manual review
- **Guidance:** In Firebase console rules playground, simulate: user A writing user B's profile (deny), non-member writing a group (deny), member creating challengeMember with wrong totalActivities (deny), anonymous read of users collection (deny). Document results.
- **Risk:** none · **Founder approval:** not needed

### Task 6.3 — README / beta ops notes
- **Guidance:** Short `docs/BETA-OPS.md`: how to run validation suite, which scripts are dangerous, how to add a beta user, known limitations (legacy v1 engine, bundle size).
- **Risk:** none · **Founder approval:** review

---

## Phase 7: Final beta readiness verification

### Task 7.1 — Full validation suite, all green
- **Guidance:** typecheck, build, and ALL guard scripts must exit 0 — including the two repaired in Phase 1. Save output to `docs/reports/beta-readiness-final.md`.

### Task 7.2 — Fresh production-build smoke test
- **Guidance:** `npm run build && npm run preview`; walk signup → onboarding → join → log → share on the production bundle (not the dev server).

### Task 7.3 — Go/no-go review with founder
- **Guidance:** Review the audit's critical/high findings one by one; each is either verified-fixed or explicitly accepted. Only then invite users.
- **Founder approval:** **YES — this is the founder's launch decision**

---

## Sequencing summary

```
Phase 0 (same day) → Phase 1 → Phase 2 → Phase 3 → Phase 4+5 (parallel-ok) → Phase 6 → Phase 7
```

Phases 0–2 are low-risk and unblock everything else. Phase 3 contains the only production-affecting deploys (rules/indexes) and needs founder sign-off. Phases 4–5 are polish + QA. Phase 7 is the gate.
