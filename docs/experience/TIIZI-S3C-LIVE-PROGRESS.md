# TIIZI-S3c — V2 Challenge Live Progress / Type-State Vertical Assembly

**Work package:** S3c — Live progress / type-state (third S3 vertical product assembly slice, per FD-S3-001)

**Status:** COMPLETE / FOUNDER ACCEPTED / READY TO MERGE
(TIIZI-S3C-FOUNDER-ACCEPT-MERGE-001).
S3 remains IMPLEMENTATION IN PROGRESS. S3a/S3b remain COMPLETE / FOUNDER ACCEPTED /
MERGED. S3d NOT STARTED. No deploy.

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

S3c is **COMPLETE / FOUNDER ACCEPTED / READY TO MERGE**
(TIIZI-S3C-FOUNDER-ACCEPT-MERGE-001; merge authorised, STOP BEFORE S3d).
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

## 12. Technical revalidation and Founder preview readiness

TIIZI-S3C-LIVE-PROGRESS-ITR-002 independently revalidated CORR-001 at candidate
`85bbbcf18bb8c0c3bbae6baa4ea97f160882e7ef` and returned **B — APPROVABLE FOR
FOUNDER PREVIEW WITH NON-BLOCKING OBSERVATIONS**. It independently proved the actual
competitive hook transport boundary: finalized → 0 leaderboard transport calls;
active/unfinalized → 1 call. The equivalent permanent repository regression remains a
non-blocking S3c closure/acceptance follow-up unless Founder preview changes the implementation.

TIIZI-S3C-FOUNDER-PREVIEW-PREP-001 then assembled an isolated local preview from that exact
candidate using real PostgreSQL persistence, Firebase Auth/Firestore emulators, production HTTP
routes and governed activity application. Browser verification covered Together (150/200;
contributors 80/50/20/0), Race (live 1,1,3,null; 3 of 4 finished), and Streak (Africa/Nairobi
governing day 2026-09-20; current/best 2; days done 2 of 5; Done/Pending today), including hard
refresh coherence and console inspection. No S3c errors, raw UUID labels, malformed numeric
rendering, S3d final-result UI, Kudos, Support or media functionality were observed. Existing
React Router future-flag warnings are unrelated. Presentation observations reserved for Founder
review: Streak requirements show canonical Activity Codes rather than resolved display names,
and the timezone sentence repeats “time”. Neither changes product truth.

This readiness state does **not** mark S3c COMPLETE or FOUNDER ACCEPTED, authorize merge/deploy,
or start S3d.

## 13. CORR-002 experience-reference alignment record (Founder preview correction)

Founder preview functionally passed the S3c engine/product truth (Together/Race/Streak live
loops, streak transitions, ITR-002 no technical blocker) but found the challenge-detail pages
too close to technical/verification surfaces. CORR-002 reassembles the existing S3c truth into
the intended participant-facing experience against the adopted Tiizi Experience Reference
(`Fkenogo/tiizi-prototye`; hierarchy/interaction/terminology direction only — fixture data,
prototype ranking notation and prototype-only dimensions are NOT reproduced). **No engine,
domain, ranking, streak, acceptance, projection, cache, finalization or S3c/S3d change.**

- S3c engine/product truth was Founder-preview validated; this correction was required for
  participant-facing assembly; the Experience Reference controls presentation/hierarchy; the
  canonical implementation controls domain truth where the two differ.
- Common shell (`V2CreatedChallengeScreen`): Back to Challenges → `V2ChallengeHero` →
  one-line concise context (status · schedule · timezone · participation) → `V2ProgressSection`
  (canonical per-type truth unchanged) → supporting info (Taking part incl. Leave, What counts,
  secondary Create-another). Removed as dominant surfaces: the CREATED card, the
  CHALLENGE TYPE/STATUS grid card, and the permanently expanded Log Activity form.
- Hero (`V2ChallengeHero`, all three types): type badge, title, host Group, schedule/timezone,
  purpose statement, primary Log Activity CTA when the canonical view permits logging.
  Imagery fallback (bounded, documented): `V2ChallengeDetail` exposes no governed media field
  and cover media remains blocked on an authorised media contract (S3a acceptance), so the hero
  uses a type-tinted CSS treatment — no image element, no fabricated URL, no false domain state,
  no UI-only persistence.
- Log Activity CTA + overlay (`V2LogActivityDialog` over the unchanged `V2LogActivityForm` via
  the existing `V2Sheet` primitive): same allowed activities, identity, units, validation,
  timestamp handling, API path, success handling and `invalidateV2ChallengeReads` convergence;
  accepted confirmation stays rendered with Done/Log-another; closing unmounts the form so each
  opening starts a fresh intent. No `setQueryData` fabrication.
- Participant language: Group progress, Race progress / Race standings, Today's Daily
  Consistency, Current/Best streak, Days completed, Taking part; removed `Live race state` and
  the `… (UTC+3) time` duplication (timezone labels themselves unchanged, as are governing-day
  calculations).
- Activity names (CORR-002 §7): `activityNames.tsx` resolves the governed Knowledge name via
  `fetchKnowledgeByCode`/`fetchKnowledgeById` (batch `useActivityDisplayNames` for synchronous
  labels, `V2ActivityName` for single labels); logging selector, choice detail and Streak
  requirement rows show it primary with a transient humanized fallback while resolving. No
  hard-coded code→name mapping; canonical identity and submission payloads unchanged.
- Together/Race/Streak assemblies preserve every canonical truth listed in §§9–11 of the
  authorising task (shared total/goal/percent/share/projection/overshoot; own total/target/
  live 1,1,3 positions/N-of-M/finishers/still-progressing; server governingToday/streaks/
  Done-Pending/rollover/reset/no-late-logging) — only hierarchy and copy changed.
- Permanent finalized-query regression: `scripts/testS3cFinalizedQueryLifecycle.ts`
  (`test:s3c-finalized-query`) proves finalized → 0 leaderboard transport calls and
  active/unfinalized → 1 through a real QueryClient with the hook's real key/enablement,
  coupled to the actual hook source.
- Explicit Experience Reference deviations (product truth wins): standard competition ranking
  1,1,3 rendered (prototype 1,2,2 NOT reproduced); no other-member Streak state; no Kudos,
  Recent Activity, Support, media, social, podiums, winners, final results, recognition,
  Run Again, or S3d surfaces.

Validation and fresh Founder evidence are recorded in the return report held with the
candidate commit.

## 14. CORR-003 leave-interaction record (bounded Founder-preview correction)

Founder accepted the CORR-002 challenge hierarchy, Together/Race/Streak differentiation, hero,
Log Activity CTA/overlay, human-readable activity names and the CSS hero fallback for the
current slice — but rejected the standalone TAKING PART card as unnecessary clutter. CORR-003
moves Leave Challenge to a secondary hero action with confirmation disclosure. **No new
product semantics; no membership, history, engine or domain change.**

- Permanent participation card removed for active participants (`V2ParticipationSection`
  returns null while joined; join/rejoin/read-only states unchanged).
- Hero (`V2ChallengeHero`, all three types) carries a subordinate Leave Challenge action next
  to the primary + Log activity CTA; no explanatory history text in the hero.
- `V2LeaveChallengeDialog` (existing `V2Sheet` primitive): "Leave this Challenge?" with
  "Leaving ends your current participation … Your Challenge history will be kept." and
  Stay in Challenge / Leave Challenge actions. First selection only opens the dialog;
  cancellation performs no mutation; confirmation executes the existing governed
  `POST /v1/challenges/:id/withdraw` path exactly once (pending-disabled) with canonical
  invalidation/refetch; post-leave truth re-derives to the existing Join-again state.
- CORR-003 guards added to `test:s3c-live-progress` proving visibility, card absence,
  open-only first click, mutation-free cancellation, exactly-once governed leave, and intact
  Log Activity/progress surfaces.

S3c is NOT finally Founder-accepted; final acceptance remains with Founder after preview.

## 15. Founder acceptance (TIIZI-S3C-FOUNDER-ACCEPT-MERGE-001)

Founder reviewed S3c in localhost preview on the accepted candidate (head `2286b6a`)
and accepted:

- Together live progress experience (Walk Nairobi Together);
- Race live progress / standings experience (Push-Up Finish Line);
- Streak daily-consistency experience (Daily Strength & Calm);
- common challenge hero hierarchy;
- CSS hero fallback for this slice (canonical media still deferred behind its
  authorised contract);
- Log Activity CTA + overlay;
- human-readable activity names;
- removal of technical/backend-facing page language;
- Create Another Challenge placement;
- Leave Challenge as secondary hero action;
- Leave Challenge confirmation interaction (dialog disclosure, history kept);
- cancellation preserving participation.

CORR-003 was the final bounded S3c experience correction. Founder disposition:
**S3c live progress / type-state ACCEPTED.**

Accepted-candidate verification performed:

- Guards: `test:s3c-live-progress` (incl. CORR-002 alignment + CORR-003 leave
  interaction), `test:s3c-finalized-query`, `test:s3b-activity-logging`,
  `test:s3b-activity-application-corr-001`, `test:s3a-participation-experience`,
  `test:s3a-participation-cache`, `test:s2b-challenge-creation`,
  `test:v2-membership-cache`, `test:v2-frontend`, `test:v2-experience-boundary` —
  all PASS.
- API: typecheck clean; build clean; full suite 652 passed / 8 skipped
  (46 files passed, 1 skipped), including participation and S3c route suites.
- Root: `tsc -b` clean; `vite build` clean.
- Functions: build clean.
- `git diff --check` clean.
- Repository `ci` on the exact accepted head green (api, api-image, functions,
  web). External `Workers Builds: tiizi-challenges` failure is NOT an S3 gate
  per FD-S3-005.
- Negative scope proofs: no engine/domain/ranking/streak/acceptance/projection/
  cache/finalization change; no S3d; no Kudos/Support/media/social/podiums/winners;
  no migration; no deployment; no production mutation.
- Preview: localhost re-verified on all three challenges (dialog opens, cancel
  preserves, isolated confirmed-leave proof on scratch state; shared fixtures intact).

S3c is **COMPLETE / FOUNDER ACCEPTED** (merge authorised by this record; MERGED
status recorded post-merge). S3 remains IMPLEMENTATION IN PROGRESS. S3d NOT STARTED.
