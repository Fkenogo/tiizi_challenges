# Next Coding-Agent Prompts

Copy-paste prompts for executing the pre-beta cleanup, one safe cluster at a time. Run them **in order**. Each prompt is self-contained.

**Required completion report format (identical for every prompt):**

```
## Completion Report
- Task: <title>
- Files changed: <list with paths>
- What was done: <2-4 plain sentences>
- Verification output: <paste command results>
- Anything skipped or blocked: <or "none">
- Founder decisions still needed: <or "none">
```

---

## Prompt 0 — Safety First: Secrets Guard + Checkpoint Commit

```
TASK: Pre-beta Phase 0 — protect secrets and create a checkpoint commit. Reference: PRE-BETA-CLEANUP-PLAN.md Tasks 0.1–0.3, findings PB-001/PB-002 in PRE-BETA-AUDIT.md.

CONTEXT: serviceAccountKey.json sits in the repo root and is NOT gitignored. 481 modified files are uncommitted on branch fix/p0-pre-deploy-blockers.

EXACT TASK:
1. Append to .gitignore: `serviceAccountKey.json` and `*serviceAccount*.json` and `.playwright-mcp/`.
2. Run `git log --all --oneline -- serviceAccountKey.json`. If ANY commit appears, STOP and report — the key must be rotated by the founder before anything else.
3. Verify: `git check-ignore serviceAccountKey.json` prints the filename.
4. Stage tracked modifications ONLY (`git add -u`, never `git add -A`) and commit: "checkpoint: pre-beta working state (visual polish, onboarding split, install flow)".
5. Run the validation suite and save output to docs/reports/pre-beta-baseline-validation.md: npx tsc --noEmit; npm run build; npx tsx scripts/testMobileLayoutGuards.ts; npx tsx scripts/testShareTiiziInstallGuards.ts; plus the other test*.ts guard scripts (note: testOnboardingGuards and testScoringGuards are KNOWN-FAILING; record but don't fix here).

FILES TO INSPECT: .gitignore, git history
FILES LIKELY TO MODIFY: .gitignore, new file docs/reports/pre-beta-baseline-validation.md

CONSTRAINTS: Do not modify any src/ file. Do not deploy. Do not run any seed/reset/backfill script. Do not push unless asked.

VERIFICATION: git check-ignore serviceAccountKey.json; git status --short (no modified tracked files remain); npx tsc --noEmit
```

---

## Prompt 1 — Fix the Two Stale Guard Scripts

```
TASK: Repair testOnboardingGuards.ts and testScoringGuards.ts so the full guard suite is green. Reference: PRE-BETA-CLEANUP-PLAN.md Tasks 1.1–1.2, findings PB-004/PB-005.

CONTEXT: (a) Onboarding was split from 4 to 5 steps: goals moved from ProfileWellnessInterestsScreen.tsx to a new ProfileHealthGoalsScreen.tsx; the guard still asserts the old design and crashes at scripts/testOnboardingGuards.ts:66. (b) scoringGuards assertion 18I-5F-5b (line ~5855) fails because buildChallengeProgress in src/features/Challenges/challengeProgressDisplay.ts ignores challenge.groupCurrentTotal unless the caller passes it as the 6th arg (priorTeamTotal). Production callers (src/features/Home/useHomeScreen.ts:226,272) pass it, so the app works — the shim contract is the footgun.

EXACT TASK:
1. Rewrite the stale assertions in scripts/testOnboardingGuards.ts for the 5-step flow: wellness screen PRESERVES setup?.goals in its payload (does not own selection); ProfileHealthGoalsScreen owns selectedGoals with min-1 validation; src/hooks/useProfileSetup.ts routes missing goals to /app/profile/health-goals; step labels say "Step N of 5".
2. In challengeProgressDisplay.ts, default the resolver input: priorTeamTotal: priorTeamTotal ?? challenge.groupCurrentTotal. Change nothing else in the file.
3. Do NOT weaken any other assertion in testScoringGuards.ts.

FILES TO INSPECT: scripts/testOnboardingGuards.ts, scripts/testScoringGuards.ts (line ~5820-5860), src/features/Profile/ProfileWellnessInterestsScreen.tsx, src/features/Profile/ProfileHealthGoalsScreen.tsx, src/hooks/useProfileSetup.ts, src/features/Challenges/challengeProgressDisplay.ts, src/features/Challenges/challengeProgressResolver.ts
FILES LIKELY TO MODIFY: scripts/testOnboardingGuards.ts, src/features/Challenges/challengeProgressDisplay.ts

CONSTRAINTS: One-line production change only (the ?? default). No changes to the resolver, screens, or hooks. No deploy.

VERIFICATION: npx tsx scripts/testOnboardingGuards.ts (exit 0); npx tsx scripts/testScoringGuards.ts (exit 0); npx tsc --noEmit; npm run build
```

---

## Prompt 2 — Broken Links & Navigation Cleanup (Legal + 404 + ErrorBoundary)

```
TASK: Route Terms/Privacy, decide 404 behavior, and mount the ErrorBoundary. Reference: PRE-BETA-CLEANUP-PLAN.md Tasks 1.3, 1.4, 2.1; findings PB-003/PB-009/PB-011.

CONTEXT: src/features/Legal/PrivacyScreen.tsx and TermsScreen.tsx exist but are unrouted and unlinked. SignupScreen has no legal links. App.tsx:305 sends unknown URLs to /app/flow. src/components/ErrorBoundary.tsx exists but is mounted nowhere — crashes white-screen the app.

EXACT TASK:
1. Add public lazy routes /terms and /privacy in src/App.tsx (no ProtectedRoute).
2. In SignupScreen, add a small footer under the submit button: "By signing up you agree to our Terms and Privacy Policy" with links to the two routes. Match existing st-caption / text-slate-500 styling.
3. FOUNDER DECISION REQUIRED before implementing 404: Option A = small public NotFoundScreen ("Page not found" + button to /app/home) replacing the * redirect; Option B = keep redirect, add explanatory comment. Ask, then implement the chosen option.
4. Read src/components/ErrorBoundary.tsx. Ensure its fallback renders a friendly message and a reload button (window.location.reload()); add one if missing. Mount it in App.tsx wrapping the <Routes> subtree (inside providers).

FILES TO INSPECT: src/App.tsx, src/features/Auth/SignupScreen.tsx, src/features/Legal/*.tsx, src/components/ErrorBoundary.tsx
FILES LIKELY TO MODIFY: src/App.tsx, src/features/Auth/SignupScreen.tsx, src/components/ErrorBoundary.tsx, possibly new src/features/Placeholders-free NotFoundScreen file under src/features/

CONSTRAINTS: Do not rewrite legal copy without founder review — flag placeholder text if found. No other route changes. No deploy.

VERIFICATION: npx tsc --noEmit; npm run build; npx tsx scripts/testMobileLayoutGuards.ts; manually load /terms, /privacy, and a garbage URL in the dev preview
```

---

## Prompt 3 — Safe Dead-Code Removal

```
TASK: Delete confirmed-dead files and produce an evidence report for ambiguous ones. Reference: PRE-BETA-CLEANUP-PLAN.md Tasks 2.2–2.4; findings PB-012/PB-015/PB-020.

CONTEXT: A reference scan found files imported nowhere in src/. Two are confirmed safe; eight need per-file confirmation. Repo root has clutter.

EXACT TASK:
1. DELETE (after re-verifying zero references with grep): src/features/Admin/Content/BooksScreen.tsx (its route already redirects at App.tsx:249 — remove any leftover lazy import too), and the empty directory src/features/Placeholders/.
2. DELETE root clutter: .gitignore.backup-2026-05-25, admin-dashboard-metrics.png, analytics-engagement-metrics.png, analytics-overview-metrics.png, analytics-revenue-metrics.png (or move PNGs to docs/assets/ if the founder wants them kept — ask once).
3. INVESTIGATE (do NOT delete yet) and write verdicts to docs/reports/dead-code-verdicts.md: src/components/Home/TodaysGoalsList.tsx, src/components/Auth/RequireProfileSetup.tsx, src/components/Challenges/OngoingChallengeCard.tsx, src/features/Challenges/CompletedChallengesScreen.tsx, src/features/Groups/components/GroupInviteManagementPanel.tsx, src/features/Admin/Donations/PlatformSupportScreen.tsx, src/features/Admin/shared/AdminImageField.tsx, src/features/Admin/Analytics/analyticsUi.tsx. For each: full-text search including dynamic import strings, git log -3 --oneline for the file, verdict SAFE TO REMOVE / KEEP with one-line evidence.
4. Do NOT touch src/components/ErrorBoundary.tsx or src/features/Legal/* (used by Prompt 2).

FILES TO MODIFY: deletions listed above + new docs/reports/dead-code-verdicts.md
CONSTRAINTS: Every deletion in its own logical step with a grep check first. If any grep shows a reference, keep the file and note it. No deploy.

VERIFICATION: npx tsc --noEmit; npm run build; all guard scripts still pass
```

---

## Prompt 4 — Data-Safety: Firestore Gaps + Seed-Script Gates

```
TASK: Close three known Firestore gaps and add dry-run gates to unguarded scripts. Reference: PRE-BETA-CLEANUP-PLAN.md Phase 3; findings PB-006/PB-007/PB-008/PB-010.

CONTEXT: (1) users cannot self-write dailyGoals fields under firestore.rules; (2) public group discovery in src/services/groupService.ts lacks a visibility filter (private groups leak into browse) and needs a composite index; (3) GroupDetailScreen's active-challenges list doesn't consistently apply lifecycle helpers, so ended challenges show as active; (4) scripts/seedAppData.ts, seedBaselineData.ts, seedWellnessActivities.ts, seedWellnessTemplates.ts write to Firestore with NO dry-run gate, and scripts/auditGroupFeedAfterLog.ts performs 4 writes despite being named "audit".

EXACT TASK:
1. firestore.rules: add the dailyGoals field names to the user self-writable allowlist (inspect src usage of dailyGoalsService to enumerate exact field names first).
2. groupService.ts discovery query: add the public-visibility filter; add the matching composite index to firestore.indexes.json. DO NOT DEPLOY rules or indexes — flag for founder.
3. GroupDetailScreen.tsx: apply isChallengeOngoing (already imported) consistently to the active list.
4. Seed scripts: copy the --apply gate pattern from scripts/cleanupSeedData.ts into the four seed scripts (default = dry-run printout, writes only with --apply). Update package.json to split seed:x / seed:x:apply. Gate or remove the writes in auditGroupFeedAfterLog.ts.
5. Extend or add a guard script asserting: discovery query includes the visibility filter; GroupDetail uses lifecycle filtering; each seed script contains the --apply gate.

FILES TO INSPECT: firestore.rules, src/services/groupService.ts, src/services/dailyGoalsService.ts, src/features/Groups/GroupDetailScreen.tsx, src/utils/challengeLifecycle.ts, scripts/cleanupSeedData.ts (the reference pattern), the five scripts named above, package.json
FILES LIKELY TO MODIFY: all of the above except cleanupSeedData.ts

CONSTRAINTS: NEVER run any seed/reset script during this task, even in "dry" mode, without explicit founder request. Do not deploy rules or indexes. Firestore writes from your environment are forbidden.

VERIFICATION: npx tsc --noEmit; npm run build; new/updated guard script exits 0; firebase rules validation if available locally (validate only — no deploy)
```

---

## Prompt 5 — Onboarding & Home Activation Cleanup

```
TASK: Interests-screen rules and Home new-user experience. Reference: PRE-BETA-CLEANUP-PLAN.md Tasks 5.1–5.2; finding PB-014.

CONTEXT: Session backlog items: interests screen should have no pre-selected defaults, no maximum cap, and require at least 3 selections; Home needs an activation card for users with no groups/challenges; the active-challenges empty state is weak.

EXACT TASK:
1. src/features/Profile/ProfileInterestsScreen.tsx: remove any default pre-selections; remove the max cap; enforce minimum 3 with clear inline validation copy ("Choose at least 3 to personalise your experience").
2. src/features/Home/HomeScreen.tsx + useHomeScreen.ts: when the user has zero groups AND zero active challenges, render an activation card (welcome copy + two CTAs: "Join a Group" → /app/groups, "Browse Challenges" → /app/challenges/browse). Follow existing card conventions: rounded-2xl, border-slate-100, shadow-sm, st-* text classes.
3. Improve the active-challenges empty state with one-line guidance + CTA instead of bare text.
4. Extend scripts/testOnboardingGuards.ts with assertions for the min-3 rule and no-defaults.

FILES TO INSPECT: ProfileInterestsScreen.tsx, HomeScreen.tsx, useHomeScreen.ts, existing Home cards in src/components/Home/, scripts/testOnboardingGuards.ts
FILES LIKELY TO MODIFY: the four above

CONSTRAINTS: No data-model changes. No new routes. Match existing visual tokens exactly — this is not a redesign. No deploy.

VERIFICATION: npx tsc --noEmit; npm run build; npx tsx scripts/testOnboardingGuards.ts; npx tsx scripts/testMobileLayoutGuards.ts; screenshot of Home in the new-user state from the dev preview
```

---

## Prompt 6 — Share / Install Flow QA Pass

```
TASK: End-to-end QA of the share & install growth loop; fix only concrete defects. Reference: PRE-BETA-AUDIT.md user-flow findings; guards in scripts/testShareTiiziInstallGuards.ts.

CONTEXT: /install is a public route (src/features/Install/InstallScreen.tsx) with platform detection and beforeinstallprompt handling. ShareTiiziCard (src/components/ShareTiiziCard.tsx) is wired into ProfileScreen, WorkoutLoggedScreen, and GroupDetailScreen (joined members only). All 25 guards currently pass.

EXACT TASK:
1. In the dev preview, verify: /install renders logged-out; "Continue to Tiizi" navigates to /app/home (login-gated is fine); desktop shows "On your phone" copy; the Copy button writes to clipboard.
2. Simulate mobile UAs (preview_resize + UA notes in code review): confirm the iOS branch lists Share → Add to Home Screen, the Android branch lists all four label variants and the manufacturer note.
3. Verify ShareTiiziCard on all three entry screens: renders, correct install URL, GroupDetail instance hidden for non-joined membership states.
4. Confirm the ACHIEVEMENT share flow (src/features/Share/ShareScreen.tsx, route /app/share) is untouched and its guard passes.
5. Fix only concrete defects found; extend testShareTiiziInstallGuards.ts for anything fixed.

FILES TO INSPECT: src/features/Install/InstallScreen.tsx, src/components/ShareTiiziCard.tsx, src/features/Profile/ProfileScreen.tsx, src/features/Workouts/WorkoutLoggedScreen.tsx, src/features/Groups/GroupDetailScreen.tsx, src/features/Share/ShareScreen.tsx
FILES LIKELY TO MODIFY: only where defects are found

CONSTRAINTS: Do not restructure the install screen. Do not touch the achievement share flow's copy or params. No deploy.

VERIFICATION: npx tsx scripts/testShareTiiziInstallGuards.ts; npx tsx scripts/testShareScreenGuards.ts; npx tsc --noEmit; npm run build; screenshots of /install desktop state
```

---

## Prompt 7 — Final Beta Readiness Verification

```
TASK: Full verification gate before inviting beta users. Reference: PRE-BETA-CLEANUP-PLAN.md Phase 7.

CONTEXT: All prior cleanup prompts are complete. This is the final read-mostly gate; the only file you create is a report.

EXACT TASK:
1. Run and capture: npx tsc --noEmit; npm run build; then EVERY scripts/test*.ts guard via npx tsx. All must exit 0 — including testOnboardingGuards and testScoringGuards (repaired earlier). Any failure = stop and report, do not patch tests to pass.
2. Run npm run audit:secrets and confirm git check-ignore serviceAccountKey.json still passes.
3. Serve the production bundle (npm run preview) and smoke-walk: /install, /terms, /privacy, login screen, and a garbage URL.
4. Cross-check every critical/high finding in PRE-BETA-AUDIT.md (PB-001 through PB-011): mark each VERIFIED FIXED (with evidence) or STILL OPEN.
5. Write docs/reports/beta-readiness-final.md: all command outputs, the finding-by-finding table, and a clear GO / NO-GO recommendation with reasons in plain language.

FILES TO MODIFY: only docs/reports/beta-readiness-final.md

CONSTRAINTS: Read-only apart from the report. No fixes in this pass — failures get reported, not patched. No deploy. No Firestore writes.

VERIFICATION: the report itself, containing full command outputs
```
