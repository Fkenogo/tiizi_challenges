# Pre-Beta Phase 4 — Safe Dead-Code Cleanup

**Date:** 2026-07-11
**Branch:** `fix/p0-pre-deploy-blockers`
**Scope:** Remove only confirmed dead code and repo clutter. No business logic changes, no Firestore writes, no deploy, no broad refactor.

---

## 1. Confirmed dead files — removed

Both were re-checked with fresh grep searches before deletion, per instructions.

| File | Evidence | Action |
|---|---|---|
| `src/features/Admin/Content/BooksScreen.tsx` | Zero references anywhere in `src/`. Its route (`/app/admin/content/books` in `App.tsx:256`) already redirects to `/app/admin/content/pages` via `<Navigate>` and never imports this component. | **REMOVED** |
| `src/features/Placeholders/` | Empty directory (`ls -la` showed only `.` and `..`), zero references to `Placeholders` anywhere in `src/`. | **REMOVED** |

---

## 2. Investigated files — classification

For each file I searched for every reference to its exported symbol(s) across `src/`, checked `App.tsx` routing, and read the file's content to understand what it does and whether an equivalent already exists elsewhere.

| File | Verdict | Evidence & reasoning |
|---|---|---|
| `src/components/Home/TodaysGoalsList.tsx` | **SAFE TO REMOVE** — removed | Zero references. `HomeScreen.tsx` renders its own inline daily-goals list (using `useDailyGoals`) directly — confirmed by reading `HomeScreen.tsx:20,52,54,150,156,246` — never imports this component. Genuinely superseded. |
| `src/components/Challenges/OngoingChallengeCard.tsx` | **SAFE TO REMOVE** — removed | Zero references. `HomeScreen.tsx:9,215` imports and renders `ActiveChallengeCard` instead — a different, actively-used component covering the same purpose. Genuinely superseded. |
| `src/features/Admin/shared/AdminImageField.tsx` | **SAFE TO REMOVE** — removed | Zero references. Three other admin forms (`EditChallengeTemplateScreen.tsx`, `EditWellnessTemplateScreen.tsx`, `CreateChallengeScreen.tsx`) call `uploadImageFile`/`readFileAsDataUrl` directly inline instead of using this shared component — it was built as a reusable abstraction but never adopted. Deleting it does not touch any active code path. Directory `src/features/Admin/shared/` was left empty afterward and removed too. |
| `src/features/Admin/Analytics/analyticsUi.tsx` | **SAFE TO REMOVE** — removed | Zero references anywhere, including no import of the file itself. Ten named exports (`formatKes`, `MetricCard`, `DataTable`, etc.), none referenced outside their own definitions. Fully orphaned utility file. |
| `src/components/Auth/RequireProfileSetup.tsx` | **NEEDS FOUNDER DECISION** — kept | This is a correctly-implemented onboarding gate (checks `getOnboardingPath`/`isOnboardingPath`, redirects appropriately) but it is **never imported by `App.tsx` or any route**. I checked whether onboarding completion is enforced anywhere else — it is not: `ProtectedRoute.tsx` only checks authentication, and `HomeScreen.tsx` has zero onboarding-completion checks. This means **a logged-in user can currently type `/app/home` directly and bypass onboarding entirely**, skipping profile setup. This is not dead code — it's a real, working fix for a real gap that was simply never wired in. Wiring it into every protected route is a genuine user-flow change (could redirect users mid-navigation in ways product should sign off on), explicitly outside this phase's "no user flow changes" constraint. **Flagging as a real pre-beta gap, not deleting.** |
| `src/features/Challenges/CompletedChallengesScreen.tsx` | **NEEDS FOUNDER DECISION** — kept | Fully working, self-contained screen. Its data hook `useCompletedChallengesForUser` (in `useChallenges.ts:186`) exists, works, and has no other consumer. The screen is not routed in `App.tsx` and nothing links to it (e.g., no "View completed challenges" link from Profile). This is a complete feature that got disconnected from navigation, not obsolete/broken code — deleting it would permanently lose working functionality. |
| `src/features/Groups/components/GroupInviteManagementPanel.tsx` | **NEEDS FOUNDER DECISION** — kept | Already documented in the Phase 1 guard-triage report as part of the larger "secure invite system built but never wired to any screen" finding (see `docs/reports/pre-beta-phase-1-guard-triage.md`, testGroupInviteBackend section). It's the create-invite UI counterpart to the redeem flow (`useRedeemGroupInvite`) that Phase 3 also found unwired. Both halves of the secure invite system exist and work but await a dedicated wiring task — deleting this panel now would require rebuilding it later. |
| `src/features/Admin/Donations/PlatformSupportScreen.tsx` | **NEEDS FOUNDER DECISION** — kept | Fully working admin dashboard for reviewing platform support/donation records. Its hooks (`usePlatformSupportDonations`, `usePlatformSupportReport`, `usePlatformSupportSettings`, `useSavePlatformSupportSettings`, `useUpdatePlatformSupportDonation` — all in `useAdminDonations.ts`) exist, work, and have no other consumer. Not routed in `App.tsx`, no admin nav entry. Complete feature, simply disconnected — same pattern as `CompletedChallengesScreen`. |

**Pattern observed:** four of the eight investigated files are genuine duplicates/orphaned utilities superseded by actively-used alternatives (safe to delete), while the other four are complete, correctly-built features or safety mechanisms that were never wired into routing or navigation. None of the four "needs decision" files are broken or obsolete — deleting any of them would destroy working functionality. I did not delete any of them.

---

## 3. Root cleanup

| Item | Action |
|---|---|
| `.gitignore.backup-2026-05-25` | **Removed** (stale backup file, no longer needed — `.gitignore` itself is current and correct) |
| 24 root-level `*.png` screenshots (`admin-dashboard-metrics.png`, `analytics-*.png` ×3, `phase-10c-p2-*.png` ×20) | **Moved to `docs/assets/`** — confirmed none are referenced as image sources from any tracked doc or code (only mentioned by filename in my own earlier audit reports, not embedded/consumed). Moving preserves them rather than deleting outright, since prior QA sessions may want to reference them. |
| `docs/reports/` (194 files, 2.3 MB) | **Not touched.** These are already fully git-tracked (`git ls-files docs/reports/` returns all 194 — `git status` shows zero untracked entries there). "Archive outside the repo" for 194 already-committed historical files is a bigger, judgment-heavy operation than routine cleanup, and doing it silently risks discarding project history a founder may want. Per the task's own fallback ("...or list what should be archived"), I'm listing it here as a recommendation rather than executing it: if the founder wants these archived, the most conservative approach is to move them to a separate `tiizi-archive` repo or a git tag/branch snapshot before removal, not a plain `rm`. |
| `.playwright-mcp/` gitignore coverage | **Confirmed already ignored** (added in Phase 0; `git check-ignore -v .playwright-mcp/` → `.gitignore:34:.playwright-mcp/`). No action needed. |

---

## 4. Reset script safety — confirmed, no changes needed

- `package.json` — confirmed `reset:all-data:apply` is **not present** (removed in Phase 3). Only `"reset:all-data": "tsx scripts/resetAllData.ts"` remains, which runs in dry-run mode by default.
- `scripts/resetAllData.ts` — confirmed the script cannot wipe data without an explicit `--apply` flag: `const applyMode = process.argv.includes('--apply');` (line 17), and the `run()` function computes and prints the full delete-target report *before* checking `if (!applyMode) { console.log('Dry-run only...'); return; }` (line 127) — every deletion call (`deleteRefs`, `deleteAuthUsers`) sits after that early return. A wipe now requires typing the full `tsx scripts/resetAllData.ts --apply` command; no npm alias shortcuts it.
- No changes were needed to `resetAllData.ts` or `package.json` for this task.

---

## Files removed (6)

- `src/features/Admin/Content/BooksScreen.tsx`
- `src/features/Placeholders/` (empty directory)
- `src/components/Home/TodaysGoalsList.tsx`
- `src/components/Challenges/OngoingChallengeCard.tsx`
- `src/features/Admin/shared/AdminImageField.tsx` (+ resulting empty `src/features/Admin/shared/` directory)
- `src/features/Admin/Analytics/analyticsUi.tsx`

## Files moved (24) / removed (1) at repo root

- 24 `*.png` files → `docs/assets/`
- `.gitignore.backup-2026-05-25` → deleted

## Files kept despite investigation (4) — need founder decision

- `src/components/Auth/RequireProfileSetup.tsx` — real onboarding-bypass gap, not wired in
- `src/features/Challenges/CompletedChallengesScreen.tsx` — working feature, unrouted
- `src/features/Groups/components/GroupInviteManagementPanel.tsx` — half of the unwired secure invite system (see Phase 1/3 reports)
- `src/features/Admin/Donations/PlatformSupportScreen.tsx` — working admin feature, unrouted

---

## Verification

```
npx tsc --noEmit                              → clean, no errors
npm run build                                 → ✓ built in 4.12s (pre-existing chunk-size warning only)
npx tsx scripts/testMobileLayoutGuards.ts     → 54 passed, 0 failed
npx tsx scripts/testShareTiiziInstallGuards.ts → 25 passed, 0 failed
npx tsx scripts/testLegalRoutingAndSafetyGuards.ts → 42 passed, 0 failed
```

**Full guard suite (50 scripts):** 48 passed, 3 failed. All 3 failures are pre-existing, unchanged from Phase 1/3, and unrelated to this cleanup (files not touched in this phase):

- `testGroupDetailAndEdit` — known `groupType` quick-tag UI gap (deferred to Phase 4 UI cleanup per Phase 1 triage — a different, larger UI phase than this dead-code pass)
- `testHomePerformanceGuards` — known Home data-hook architecture regression (deferred, needs new service methods)
- `testPilotUxPolishGuards` — known missing forgot-password feature (deferred, new feature work)

No new failures were introduced by this cleanup.
