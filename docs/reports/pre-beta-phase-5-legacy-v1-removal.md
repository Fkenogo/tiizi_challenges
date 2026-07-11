# Pre-Beta Phase 5 — Remove Legacy v1 Challenge Paths

**Date:** 2026-07-11
**Branch:** `fix/p0-pre-deploy-blockers`
**Founder decision:** Legacy v1 challenges are no longer supported. No backward compatibility required. Remaining v1 records are obsolete and may be excluded (not auto-deleted).

---

## 1. Legacy references found (audit)

Searched `src/`, `functions/`, `scripts/`, `firestore.rules`, `firestore.indexes.json` for `engineVersion`, `legacy`, `v1`, `fallback`, `compatibility`, and related terms. Full inventory with classification:

| Location | Classification | Disposition |
|---|---|---|
| `src/services/challengeEngine/legacyEngine.ts` | REMOVE | Deleted — the entire v1 engine implementation |
| `src/services/challengeEngine/index.ts` — `selectEngine()` v1 fallback | REMOVE | Now throws for non-v2 instead of returning `LegacyEngine` |
| `src/services/challengeEngine/types.ts` — `EngineVersion = 'v1' \| 'v2'` | REMOVE | Narrowed to `EngineVersion = 'v2'` |
| `src/services/workoutService.ts` — engineVersion ternary + engine call | MIGRATE | Now rejects non-v2 before building any engine context |
| `src/services/wellnessLogService.ts` — same pattern | MIGRATE | Same fix applied |
| `src/features/Challenges/ChallengeDetailScreen.tsx` — `{!isV2 && (...)}` legacy block | REMOVE | Replaced with a "no longer supported" early return |
| `src/features/Challenges/ChallengeCompletedScreen.tsx` — "Legacy v1 completion" block | REMOVE | Replaced with a "no longer supported" state + safety-net fallback |
| `src/features/Challenges/ChallengeCompletedScreen.tsx` — `useFinalRank` legacy sort fallback | MIGRATE | Removed the `else` totalPoints sort branch; non-v2 now returns `rank: null` without computing |
| `src/features/Challenges/ChallengeLeaderboardScreen.tsx` | MIGRATE | Added the same "no longer supported" early return (previously had no explicit v1 UI but would have shown a blank/broken leaderboard) |
| `src/features/Workouts/WorkoutLoggedScreen.tsx` — legacy completion bar UI | REMOVE | Replaced with a one-line "no longer supported" notice |
| `src/utils/leaderboardSort.ts` — trailing `totalPoints DESC` fallback | MIGRATE | Non-v2/unmatched combos now return rows **unsorted** instead of computing a legacy ranking |
| `src/services/challengeService.ts` — 8 list-returning methods | MIGRATE | Added `isSupportedChallengeEngine` filter so obsolete records never appear in Discover/My Challenges/Group/Completed lists |
| `src/types/index.ts` — `engineVersion?: 'v2'` | KEEP | Already v2-only in the type system; no v1 literal was ever typed |
| `src/features/Home/useHomeScreen.ts` | KEEP | Already correctly filters `engineVersion === 'v2'` |
| `src/features/Challenges/CreateChallengeWizard.tsx` | KEEP | Already hardcodes `engineVersion: 'v2' as const` for all new challenges |
| `functions/src/challengeCreationBackend.ts` | KEEP | Already throws `invalid-argument` for anything but `'v2'` |
| `firestore.rules:154` — `engineVersion == 'v2'` gate | KEEP | Already restrictive; not touched per constraints (no rules changes) |
| `scripts/auditChallengeProgressIntegrity.ts` | KEEP | Read-only diagnostic; classifies v1/v2 for reporting, never repairs v1 records — correct as-is |
| `src/features/Challenges/challengeProgressResolver.ts` — comment mentioning "legacy fallback floor" | KEEP | False positive — refers to a v2 optimistic-display floor (`priorTeamTotal`), unrelated to the v1 engine |
| `src/features/Workouts/LogWorkoutScreen.tsx` / `LogWellnessActivityScreen.tsx` — `: 'Save Workout'` fallback label | KEEP | Generic default button text, not a legacy calculation or rendering branch |
| `src/features/Workouts/SelectChallengeActivityScreen.tsx` — `{!isV2 && 'Pick an activity...'}` | KEEP | Generic fallback copy only; no legacy calculation |
| Guard scripts (`testScoringGuards.ts`, `testPhase13E.ts`, `testChallengeRecapScreenGuards.ts`, `testHomeChallengeFeeds.ts`) | MIGRATE | Updated — see Part 5 section below |

No UNCERTAIN items were found requiring a stop-and-report — every reference resolved cleanly to REMOVE, MIGRATE, or KEEP with direct evidence.

---

## 2. Files removed

- `src/services/challengeEngine/legacyEngine.ts` — the v1 engine implementation (42 lines)

## 3. Files modified

**Application code:**
- `src/services/challengeEngine/index.ts` — `selectEngine()` throws for non-v2 instead of instantiating `LegacyEngine`
- `src/services/challengeEngine/types.ts` — `EngineVersion` narrowed to `'v2'`
- `src/services/workoutService.ts` — rejects non-v2 challenges immediately after loading the challenge doc, before any engine context is built
- `src/services/wellnessLogService.ts` — same fix
- `src/services/challengeService.ts` — added `isSupportedChallengeEngine()` helper; applied as a filter to 8 list-returning methods (`getUserAccessibleChallenges`, `getChallengesForMyGroups`, `getChallenges`, `getActiveChallenges`, `getVisibleChallengesForUser`, `getChallengesByGroup`, `getGroupChallenges`, `getCompletedChallengesForUser`, `getChallengesByGroupPage`)
- `src/features/Challenges/ChallengeDetailScreen.tsx` — removed the "Legacy / v1 challenges" JSX block (Daily Targets + How Points Work sections) and the now-unused `isMultiActivity` variable; added a `!isV2` → "no longer supported" `EmptyState` early return
- `src/features/Challenges/ChallengeCompletedScreen.tsx` — removed the "Legacy v1 completion" return block and its exclusive variables (`totalValue`, `averageValue`, `intensity`, `tier`); added a `!isV2` early return plus a defensive fallback return; simplified `useFinalRank`'s dead sort branch to return `rank: null` for non-v2 instead of computing a legacy ranking
- `src/features/Challenges/ChallengeLeaderboardScreen.tsx` — added a `!isV2` → "no longer supported" `EmptyState` early return (this screen previously had no explicit legacy branch, but would have rendered a blank/broken leaderboard for a v1 challenge)
- `src/features/Workouts/WorkoutLoggedScreen.tsx` — removed the legacy points-completion bar UI and its exclusive variables (`totalDays` legacy calc, `legacyTarget`, `legacyCompletion`, `points`, `metTarget`); replaced with a one-line "no longer supported" notice
- `src/utils/leaderboardSort.ts` — non-v2/unmatched-type rows are now returned **unsorted** rather than ranked by a legacy `totalPoints` formula

**Guard scripts (Part 5 — stale guard repair):**
- `scripts/testScoringGuards.ts` — removed/rewrote ~10 assertions that referenced `LegacyEngine`, constructed it directly, or checked for now-deleted legacy copy ("Target not met.", "Partial points earned.", "How Points Work"); replaced with `assert.throws()` checks confirming `selectEngine` rejects v1/undefined engineVersion, and updated `sortLeaderboardRows` assertions to expect unsorted output for non-v2 input
- `scripts/testPhase13E.ts` — replaced the entire "Section 1: Legacy Engine" test block (constructed `LegacyEngine` directly) with a "Legacy Engine Removal" section confirming `selectEngine` throws; rewrote 3 "Edge Cases" tests that used `legacy`/`legacyCtx` to use the v2 `CollectiveEngine` instead (same edge-case coverage — zero-value log, abandoned membership, completed-membership overflow — now proven against a real v2 engine)
- `scripts/testChallengeRecapScreenGuards.ts` — the "Share Achievement button must appear ≥3 times" check was a fragile literal-string count that was coincidentally satisfied by comment text plus the removed legacy button; replaced with a check that `<RecapNavActions` (the real shared component) is invoked ≥3 times, once per v2 recap type
- `scripts/testHomeChallengeFeeds.ts` — the "activity list must render frequency label" check looked for the literal legacy `freqLabel`/`frequency` strings; updated to check for `targetLabel`/`targetType`, the v2 equivalent that was never actually missing
- `scripts/testLegacyChallengeRemovalGuards.ts` — **new**, 35 checks (see Part 5 below)

**Other:**
- `package.json` — added `audit:legacy-challenges` script

**New file:**
- `scripts/auditLegacyV1Challenges.ts` — read-only legacy-data audit script

---

## 4. v1 branches removed (exact list)

1. `ChallengeDetailScreen.tsx`: `{!isV2 && (<>...Daily Targets... How Points Work...</>)}`
2. `ChallengeCompletedScreen.tsx`: trailing `// --- Legacy v1 completion (unchanged) ---` return block (full recap screen with `tier`/`intensity`/`legacyCompletionPct`)
3. `WorkoutLoggedScreen.tsx`: `{!isV2 && (<section>...Level Up! badge, legacy completion bar, Target met/not met/Partial points copy...</section>)}`
4. `challengeEngine/index.ts`: `if (challenge.engineVersion !== 'v2') { return new LegacyEngine(); }`
5. `leaderboardSort.ts`: trailing `return [...rows].sort((a, b) => b.totalPoints - a.totalPoints);` fallback
6. `ChallengeCompletedScreen.tsx` `useFinalRank`: `else { sorted = rows.slice().sort((a, b) => b.totalPoints - a.totalPoints); }`

## 5. Compatibility shims removed

- `LegacyEngine` class (implemented `ChallengeEngine`, wrapped the pre-v2 completion formula) — fully deleted
- `workoutService.ts`/`wellnessLogService.ts`: `engineVersion: challengeData.engineVersion === 'v2' ? 'v2' : 'v1'` ternary — this was the exact "silently assume v1 and keep going" shim; both now `throw` before this point is ever reached for non-v2 data

## 6. References intentionally kept and why

See the KEEP rows in the Part 1 table above. Summary: the v2 creation path, Home filtering, Firestore rules gate, and the read-only integrity-audit script were already correctly v2-only and needed no change. A few "legacy"/"fallback" string matches were false positives — generic UI fallback copy or an unrelated v2 optimistic-display comment — confirmed by reading actual usage before deciding, per the instruction not to remove code merely because its name sounds old.

---

## 7. Legacy data audit results

Ran `npx tsx scripts/auditLegacyV1Challenges.ts` against production Firestore (read-only, credentials present in this environment):

```
Legacy v1 Challenge Audit — 2026-07-11T09:35:12.004Z [read-only]

═══ Summary ═══
  Total challenges:              0
  engineVersion === 'v2':        0  (supported)
  engineVersion === 'v1':        0  (legacy — no longer supported)
  engineVersion missing/other:   0  (legacy — treated as v1)
  Total legacy (obsolete):       0

  ✓ No legacy v1 challenge records found. Nothing further to report.
```

**No obsolete Firestore records were discovered.** The `challenges` collection is currently empty in the connected project. This is a clean result — there is no legacy data to migrate, archive, or exclude at this time. The exclusion logic added to `challengeService.ts` (Part 3) will still correctly filter out any legacy records if they exist in a different environment or appear later (e.g., a restored backup), and `--apply` cleanup mode remains intentionally unimplemented per the constraint against automated deletion.

---

## 8. Verification commands and exact results

```
npx tsc --noEmit                                          → clean, no errors
npm run build                                              → ✓ built in 7.26s (pre-existing chunk-size warning only)

npx tsx scripts/testScoringGuards.ts                       → scoring guards passed
npx tsx scripts/testChallengeActivityModel.ts               → 53 passed, 0 failed
npx tsx scripts/testChallengeCreation6Combinations.ts        → all guards passed
npx tsx scripts/testChallengeCreationBackend.ts              → challenge creation backend tests passed
npx tsx scripts/testChallengePerformanceFinalRegressionGuards.ts → all Phase 19A final regression guards passed
npx tsx scripts/testChallengePerformanceSourceOfTruthGuards.ts   → all challenge performance source-of-truth guards passed
npx tsx scripts/testChallengeRecapScreenGuards.ts             → all Phase 19A-10M challenge recap screen guards passed
npx tsx scripts/testCollectiveDoubleCountGuards.ts            → all Phase 19A-10G collective double-count guards passed
npx tsx scripts/testCollectiveTeamProgressRegressionGuards.ts → all Phase 19A-10J collective team progress regression guards passed
npx tsx scripts/testWorkoutLoggedCompletionCtaGuards.ts       → all Phase 19A-10L WorkoutLoggedScreen completion CTA guards passed
npx tsx scripts/testLegacyChallengeRemovalGuards.ts           → 35 passed, 0 failed (new guard)
```

**Full guard suite (50 scripts): 49 passed, 1 pre-run regression found and fixed, 3 pre-existing failures remain — all unrelated to this phase:**

- `testGroupDetailAndEdit` — known `groupType` quick-tag UI gap (documented in Phase 1 triage, deferred to a future UI-cleanup phase)
- `testHomePerformanceGuards` — known Home data-hook architecture issue (documented in Phase 1, explicitly out of scope: "Do not refactor Home performance code in this phase")
- `testPilotUxPolishGuards` — known missing forgot-password feature (documented in Phase 1, explicitly out of scope: "Do not implement forgot password")

One genuine regression was caught and fixed during this phase's verification: `testHomeChallengeFeeds` initially failed because it checked for the literal legacy `freqLabel`/`frequency` string that was removed along with the legacy block — the v2 equivalent (`targetLabel`/`targetType`) was already present and functioning; only the stale guard needed updating.

---

## 9. Manual tests required

Since `auditLegacyV1Challenges.ts` found zero legacy records in the connected environment, most of this is forward-looking / defense-in-depth verification rather than "fix a live bug":

1. **Create and complete one challenge of each v2 type** (collective, competitive, streak) end-to-end — join, log activity, view detail, view leaderboard, complete, view recap, share achievement. Confirm nothing changed from a user's perspective (this phase should be invisible to normal v2 usage).
2. **Attempt to open a nonexistent/malformed challenge ID directly** via URL (`/app/challenge/<garbage-id>`) — confirm the existing "Challenge not found" state still shows correctly (unrelated to this phase, but worth confirming no regression).
3. **If any v1 data exists in a different environment** (e.g., a staging DB with older seed data): open one directly via its detail/leaderboard/recap URL and confirm each screen shows "This challenge is no longer supported" instead of blank content, a crash, or stale point-based UI.
4. **Attempt to log activity against a v1 challenge ID directly** (e.g., via a saved deep link) in an environment that has such data — confirm the log is rejected with a clear error, not silently scored.
5. Re-run `npm run audit:legacy-challenges` against any staging/production environment periodically before the beta launch to confirm the "0 legacy records" state holds, or to get an accurate count if it doesn't.
