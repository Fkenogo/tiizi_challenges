# Pre-Beta Baseline Validation

**Date:** 2026-07-10
**Branch:** `fix/p0-pre-deploy-blockers`
**Checkpoint commit:** `16e633b37741fcff1e361d59ecfeb02396967aa7` — "checkpoint: pre-beta working state before cleanup"
**Purpose:** Snapshot of validation state immediately after the Phase 0 checkpoint commit, before any cleanup work begins. Everything below is READ-ONLY evidence; no fixes were applied in this pass.

---

## Core build/type checks

| Command | Result |
|---|---|
| `npx tsc --noEmit` | ✅ PASS — exit 0, no output |
| `npm run build` | ✅ PASS — built in 3.48s, 1887 modules transformed. Pre-existing warning: `vendor-firebase-internal` chunk is 537 KB minified (125.98 KB gzipped) — not a new issue, tracked as PB-017 in `PRE-BETA-AUDIT.md`. |

## Named guards from the audit scope

| Command | Result |
|---|---|
| `npx tsx scripts/testMobileLayoutGuards.ts` | ✅ PASS — 54 checks |
| `npx tsx scripts/testShareTiiziInstallGuards.ts` | ✅ PASS — 25 checks |

## Full guard suite — all 49 `scripts/test*.ts` scripts

**42 passed, 7 additional failures beyond the two pre-known ones (9 total failing).**

> Note: the task instructions pre-approved failures only for `testOnboardingGuards` and `testScoringGuards`. Running the **complete** suite (49 scripts, not just the two named ones) surfaced **7 more failing guards** that were not previously flagged in `PRE-BETA-AUDIT.md`. These are reported here as new evidence, not fixed — Phase 0 is checkpoint-only, no source changes.

### Passing (42)

```
testAdminChallengeManagement            66 passed
testAdminDonationCurrencySourceGuards   pass
testAdminDonationDashboardGuards        pass
testCauseDonationGuards                 pass
testChallengeActivityModel              53 passed
testChallengeCreation6Combinations      pass
testChallengeCreationBackend            pass
testChallengeLifecycleGuards            pass
testChallengePerformanceFinalRegressionGuards  pass
testChallengePerformanceSourceOfTruthGuards    pass
testChallengeRecapScreenGuards          pass
testCollectiveDoubleCountGuards         pass
testCollectiveTeamProgressRegressionGuards     pass
testDonationPilotGuards                 pass
testExerciseLibraryIsometricGuards      391 passed
testExerciseMovementTypeUiGuards        54 passed
testGroupFeedAccuracyGuards             pass
testGroupFeedCardUiGuards               pass
testGroupFeedCommentsGuards             pass
testGroupFeedDataModelGuards            pass
testGroupFeedFiltersGuards              pass
testGroupFeedFinalQaGuards              pass
testGroupFeedLiveStatsGuards            pass
testGroupFeedMilestoneGuards            pass
testGroupFeedProgressGuards             pass
testGroupFeedProgressSnapshotGuards     pass
testGroupFeedReactionsGuards            pass
testGroupFeedStepCapGuards              pass
testGroupFeedStoriesGuards              pass
testGroupLifecycle                      64 passed
testGroupRoutingAndProfileEdit          pass
testHomeChallengeFeeds                  pass
testMobileLayoutGuards                  54 passed
testProfileAnalyticsGuards              pass
testQuickActionsAndGroupCreation        pass
testShareScreenGuards                   pass
testShareTiiziInstallGuards             25 passed
testUserMetricsBackfillPayload          pass
testWorkoutLoggedCompletionCtaGuards    pass
```

### Failing — pre-approved / already tracked (2)

| Script | First failure | Tracked as |
|---|---|---|
| `testOnboardingGuards` | `AssertionError: ProfileWellnessInterestsScreen must save goals: selectedGoals (owns goal selection)` | PB-004 in `PRE-BETA-AUDIT.md` — stale guard, predates the 5-step onboarding split. Fix scoped in `NEXT-CODING-AGENT-PROMPTS.md` Prompt 1. |
| `testScoringGuards` | `AssertionError: 18I-5F-5b: collective primaryLabel must show group total / target — got "0 / 5,000 pushups"` | PB-005 in `PRE-BETA-AUDIT.md` — stale guard + shim footgun in `buildChallengeProgress`. Fix scoped in `NEXT-CODING-AGENT-PROMPTS.md` Prompt 1. |

### Failing — NEW findings, not previously in the audit (7)

| Script | First failure | Notes |
|---|---|---|
| `testChallengesViewPolish` | `ChallengesScreen must have a "Browse Activities Library" section heading` | Likely a copy/section rename in `ChallengesScreen.tsx` that the guard wasn't updated for — needs triage. |
| `testGroupCardActiveChallengeCountGuards` | `10L-1: Badge must say "Ongoing Challenge" to match the GroupDetailScreen Ongoing tab` | Possible copy drift between a group card badge and the GroupDetail tab label. |
| `testGroupDetailAndEdit` | `GroupDetailScreen must show a one-line description preview` | May be genuinely missing UI, or a stale assertion from before the recent GroupDetail header standardization (session tasks #3/#12). |
| `testGroupInviteBackend` | `unauthorized invite creation should fail` | **Flag as higher priority** — this reads like a real authorization guard, not a copy guard. Needs investigation before beta; could indicate a Firestore rules gap on invite creation. |
| `testGroupUxPolish` | `GroupMembersScreen must use GroupHeroHeader` | Likely stale — the shared `GroupHeroHeader` work (session task #12) may not have reached `GroupMembersScreen`, or the guard predates a later refactor. |
| `testHomePerformanceGuards` | `Home data hook must not import Firestore query helpers directly` | Architecture guard — `useHomeScreen.ts` may have picked up a direct Firestore import during recent Home work. Worth a real look, not just a stale-test dismissal. |
| `testPhase13E` | 168/170 passed; 2 failed: `Regression: joinChallenge increments participantCount`, `Regression: leaveChallenge decrements participantCount` | Only 2 of 170 checks fail in this large suite — could be a real regression in participant-count bookkeeping, worth checking against PB-008-adjacent group/challenge lifecycle work. |
| `testPilotUxPolishGuards` | `LoginScreen must expose a Forgot password action` | Product gap or stale guard — LoginScreen may be missing password-reset, or the guard is outdated if reset lives elsewhere now. |
| `testP3aPilotFixes` | `firestore.rules must include dailyGoals in userSelfWritableFields so users can save Home goals` | **This directly corroborates PB-006** in `PRE-BETA-AUDIT.md` (dailyGoals rules gap) — independent confirmation from a different guard script. |

**No action taken on any of these in this phase** — Phase 0 is commit-and-verify only. They are logged here as evidence for Phase 1+ triage. `testGroupInviteBackend` and `testHomePerformanceGuards` in particular read as more than copy-drift and should be looked at before broader cleanup, since they touch authorization and architecture respectively.

## Secrets audit

`npm run audit:secrets` → **exit 1**, but the only findings are the app's own **public Firebase Web API key** (`AIzaSyDSX8JXfEJdiw6IGsXm93YdCUk89eiSWsc`, matches `VITE_FIREBASE_API_KEY` in `.env`) appearing inside untracked network-capture docs at the repo root (`phase-10c-p2-network-*.md`, 6 files, all untracked/uncommitted). Firebase Web API keys are designed to be public — they identify the project, not authenticate as an admin — so this is a **false positive relative to real secret exposure**, not the same class of risk as the service-account key. No `serviceAccountKey.json`, private keys, or other credential patterns were found anywhere in tracked or untracked files.

Recommendation carried into Phase 2 cleanup: these `phase-10c-p2-network-*.md` docs are root clutter regardless (see PB-015) — deciding whether to keep/archive/delete them will also resolve this scanner noise.

## Files changed in this phase

- `.gitignore` — added `serviceAccountKey.json`, `*serviceAccount*.json`, `.playwright-mcp/`
- `docs/reports/pre-beta-baseline-validation.md` — this report (new)

No `src/` files, `firestore.rules`, or any application logic was modified.
