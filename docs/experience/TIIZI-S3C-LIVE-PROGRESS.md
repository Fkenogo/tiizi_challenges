# TIIZI-S3c — V2 Challenge Live Progress / Type-State Vertical Assembly

**Work package:** S3c — Live progress / type-state (third S3 vertical product assembly slice, per FD-S3-001)

**Status:** IMPLEMENTED CANDIDATE / CORRECTED / AWAITING TECHNICAL REVALIDATION (TIIZI-S3C-LIVE-PROGRESS-CORR-001).
S3 remains IMPLEMENTATION IN PROGRESS. S3d NOT STARTED. No merge, no deploy, no Founder preview yet.

**Date:** 2026-09-19

**Base:** `origin/main` @ `af1d67ef8797cc887f4de09a178ae6af2a6d4a37` (Master Programme v1.88; S3a/S3b COMPLETE / FOUNDER ACCEPTED / MERGED; verified no drift)

**Branch:** `impl/s3c-live-progress-001`

**Charter:** `docs/experience/TIIZI-S3-CHALLENGE-EXPERIENCE-CHARTER.md` (§S3c)

**Readiness basis:** TIIZI-S3C-PREIMPLEMENTATION-READINESS-001 (disposition B — bounded server/read-model work; closed by this slice)

**Authoritative scope decisions (Founder, via the authorising task):**
- A. Collective contributor rollup SHALL be exposed (contribution visibility, NOT a leaderboard; no rank/position/winner/podium/ordering semantics/recognition/awards; smallest Challenge-scoped projection; no schema/migration).
- B. Streak governing today SHALL be server-projected on the read model (browser/device-local date calculation is never authoritative; timezone authority, STREAK_DAY_CLOSED, no-grace, governing-day rules and CORR-003 DATE-safety preserved).
- C. Live data uses the existing canonical query/invalidation/refetch model (no WebSockets, realtime subscriptions, polling infrastructure, or parallel stores; multi-user realtime is outside S3c).

**Governing formula:** PRODUCT TRUTH + ADOPTED EXPERIENCE REFERENCE = TIIZI PRODUCT ASSEMBLY.
This slice binds already-merged governed capability plus two bounded read projections to the adopted experience; it invents no new authority, no new scoring engine, no second progress store, no client ranking, no device-clock day.

---

## 1. Purpose

A Founder-previewable V2 Challenge live-progress journey that binds, end to end:

open a Challenge → see shared/own progress with per-type truth (Together total + contributor shares; Race own-vs-target + live server positions with N-of-M; Daily Streak governing-today state with current/best/day-states) → log activity (S3b) → see progress converge through canonical refetch → refresh and keep authoritative truth.

The experience under `src/v2/` is a real journey over real API/domain capability, not a mock.

## 2. Experience boundary (charter §S3c)

Implemented under the existing V2 composition root (`src/v2/**`). **Nothing** from the frozen
V1 experience tree is imported or routed; no PF-05 UI is resurrected; no parallel Challenge
detail/progress system is created (the existing `V2CreatedChallengeScreen` route gains the
`V2ProgressSection` after the S3b logging section).

Allowed reuse: governed domain/API capability (`src/api/**`, `src/hooks/**`), neutral
technical primitives, brand assets, and the S1 shell primitives.

## 3. Files (16, S3c-scoped)

| Area | File |
| ---- | ---- |
| Programme | `docs/programme/TIIZI-V2-MASTER-PROGRAMME.md` (1.88 → 1.89 candidate record) |
| Record | `docs/experience/TIIZI-S3C-LIVE-PROGRESS.md` (this file, new) |
| Charter wording | `docs/experience/TIIZI-S3-CHALLENGE-EXPERIENCE-CHARTER.md` (ranking notation 1,1,3 only) |
| Integration map | `docs/experience/TIIZI-EXPERIENCE-INTEGRATION-MAP.md` (Run Again / Kudos reconciliation) |
| Read model | `api/src/challengeReads.ts` (contributors projection + governingToday/serverNow) |
| V2 client | `src/api/v2ChallengeApi.ts` (contributor types/fetcher; governing-day types) |
| Cache contract | `src/v2/challenges/challengeQueryKeys.ts` (S3c scopes; same invalidation contract) |
| Hooks | `src/v2/challenges/useChallengeCreation.ts` (`useChallengeContributorsV2`, `useCompetitiveLeaderboardV2`) |
| View model | `src/v2/challenges/progressView.ts` (new: pure progress derivation) |
| Sections | `src/v2/challenges/V2CollectiveProgress.tsx`, `V2CompetitiveProgress.tsx`, `V2StreakProgress.tsx`, `V2ProgressSection.tsx` (new) |
| Detail | `src/v2/challenges/V2CreatedChallengeScreen.tsx` (embeds the progress section) |
| Tests | `api/test/s3cLiveProgress.test.ts` (new: 6 real-seam tests) |
| Guards | `scripts/testS3cLiveProgressGuards.ts` (new) + `package.json` (`test:s3c-live-progress` entry) |

No migration, no schema change, no workflow change, no deployment.

## 4. Authority and seams (bound, plus two minimal projections)

Pre-existing, reused unchanged:
- Derived fold (`api/src/derivedTruth.ts`): collective exact-sum/overshoot/goalReached, competitive per-activity completion, streak ALL-requirements/no-double/miss-reset, live-never-terminal for streak, `computeFinishingPositions` (standard competition ranking 1,1,3).
- Reads: `GET /v1/challenges`, `GET /v1/challenges/:id` (detail progress + governing config + `myParticipation.progress`), `GET /v1/challenges/:id/leaderboard` (competitive-only; live calc unfinalized, frozen finals finalized).
- Writes: `POST /v1/challenges/:id/activity` (S3b-bound; unchanged).

New bounded projections (read-only, derived truth reused, no new canonical state):
- A. `GET /v1/challenges/:id/contributors` (collective-only, 404 `contributors_not_available` otherwise): latest episode per member; `contributionTotal` (goal unit), `share` of current total (null at zero), `logsAccepted`; echoes `collectiveTotal/goalValue/goalUnit`. No position/rank/winner fields by design; entry order is display convenience with no rank semantics.
- B. Detail `governingToday` + `serverNow`: `dayInTimezone(now, challenge.timezone)` with injectable `now` (`ChallengeReadDeps.now`; production defaults to wall clock; tests drive it). `toDayString`/DATE-safe conventions preserved.

## 5. What was deliberately NOT built

- S3d (sealed/final results experience, winners, podiums, Platform Recognition, completion awards, Run Again, final recognition). `finalResult`/`finalPosition` exist in reads but are not consumed by any S3c file (guarded).
- Social Cause/contributions, Tiizi Support/donations, Group/Challenge cover media, Custom Duration, PF-05 resurrection, PF-06 (remains S7/Templates), EBC-05 (unmerged/reference-only), S8 capabilities, V1 progress/leaderboard resurrection (`challengeProgressResolver.ts` and Firestore aggregates untouched).
- Realtime infrastructure (no WebSockets/subscriptions/polling/parallel stores).

## 6. Cache / read coherence (S3a contract extended, not forked)

Post-acceptance success runs `invalidateV2ChallengeReads` (canonical list/detail + S3c contributors/leaderboard + legacy families together; per-user isolation) — the same contract S3a established and S3b reused. No `setQueryData` manufacture of canonical progress anywhere in the S3c touch-points (guarded). The next reads re-prove truth from the server.

## 7. Experience Reference mapping (per type)

Reference: adopted Tiizi Experience Reference (experience guidance only; engine/domain authority wins every disagreement).

- TOGETHER: used — identity/context at top (existing screen), Group total as dominant shared truth, total-vs-goal, percentage + remaining, contributor presentation with the current member visually distinct ("You"), contribution/share context, Log Activity as the primary ongoing action (existing S3b section, untouched). Omitted — Social Cause / Support Tiizi / Recent Activity / Kudos (outside S3c). No mismatch beyond omitted scope.
- RACE: used — finishers separated from still-progressing, participant progress toward target, own participant identifiable, live position for qualified finishers, N-of-M finished. AUTHORITY CORRECTION APPLIED: the prototype shows #1, #2, #2 — NOT authoritative; the screen renders served server positions (standard competition ranking 1,1,3) and never reproduces prototype ranking notation.
- STREAK: used — Today's Daily Consistency dominant, current/best streak, days completed / required duration, today's required activities with Done / Pending Today, member's own state identifiable, governing-day + timezone copy. Omitted — other-participant streak state (no authoritative read projects it). No grace implied; live streak never terminally complete.
- Prototype authority boundary honoured: hierarchy/interaction/grouping/emphasis/terminology/responsive direction taken from the reference; domain rules/ranking mathematics/scoring/lifecycle/recognition/financial capability/finalization taken from engine truth only.

## 8. Documentation reconciled (no engine change)

- Charter §5/§10: stale "1,2,2" acceptance wording corrected to the implemented standard competition ranking 1,1,3 (engine unchanged; `1,2,2,4` in §2C/test headers is the same ranking system illustrated at a different tie point and is correct).
- Integration map: "Results / Finalization / Run Again (S3)" corrected (Run Again NOT in S3 per FD-S3-003); Kudos "S3/S8" corrected to S8, NOT S3c capability.

## 9. Verification performed

- New `api/test/s3cLiveProgress.test.ts`: 6/6 PASS (collective 2-member incl. overshoot/shares/no-rank/leaderboard-404; competitive tie 1,1,3 + null + resolver agreement + contributors-404; streak governing-today tz-boundary + partial/dup/miss/best + closed-day fail-closed + never-terminal-live; contributors HTTP incl. type-gated 404s).
- New `test:s3c-live-progress` guards: PASS (derivation, non-ranking, server positions, server day, static boundaries, screen order, cache coherence incl. contributors/leaderboard invalidation + per-user isolation).
- Regression suites + full validation per §13 of the authorising task (recorded in the return report).

## 10. Status

S3c is **IMPLEMENTED CANDIDATE / CORRECTED / AWAITING TECHNICAL REVALIDATION** (STOP BEFORE MERGE).
**S3 remains IMPLEMENTATION IN PROGRESS. S3a/S3b remain COMPLETE / FOUNDER ACCEPTED /
MERGED. S3d NOT STARTED.** No deployment and no production mutation occurred.

## 11. CORR-001 correction record (ITR-001 blockers)

Independent review (TIIZI-S3C-LIVE-PROGRESS-ITR-001) proved two blockers; both corrected
on the PR #38 branch with no scope expansion:

1. **Collective contributor reconciliation.** The projection read the latest episode per
   member, so leave/rejoin histories under-reported (70 shown vs 110 canonical). Now
   member-level: contributionTotal/logsAccepted aggregate governed Derived Truth across
   all episodes; the exposed participationId is the current episode (active, else latest
   joined — the detail display-episode rule, so "You" still resolves); records stay
   attached to original episodes (no migration/reassignment); canonical collective
   truth untouched. A-class route regression `api/test/s3cLiveProgressCorr001.test.ts`:
   join → 40 → withdraw → rejoin → 70 → GET contributors proves total 110 / member 110 /
   share 1 / episode-2 currency / episode-1 history intact, plus multi-member
   sum/share reconciliation and visibility/isolation.
2. **Finalized competitive boundary.** Once finalized the leaderboard route serves
   frozen final authority (preserved for S3d — proven: frozen positions still served
   after `finalizeChallenge`). S3c no longer consumes it: `useCompetitiveLeaderboardV2`
   enables only for competitive + unfinalized (pure `competitiveLeaderboardEnabledForS3c`,
   guard-proven), and `V2CompetitiveProgress` returns null once finalized instead of
   rendering final truth as "live". Ended-but-unfinalized keeps live positions (still
   live authority, no frozen truth exists).
