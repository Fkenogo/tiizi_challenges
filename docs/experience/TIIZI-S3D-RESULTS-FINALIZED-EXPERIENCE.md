# TIIZI S3d — Results / Finalized Experience

**Slice:** S3d — Results / Finalized Experience
**Task:** TIIZI-S3D-RESULTS-FINALIZED-EXPERIENCE-001
**Status:** **IMPLEMENTED CANDIDATE / CORRECTED / AWAITING FOUNDER ACCEPTANCE** (NOT COMPLETE, NOT FOUNDER ACCEPTED, NOT MERGED)
**Branch:** `impl/s3d-results-finalized-experience-001`
**Entry:** `origin/main` @ `f98a71bf0ba3db9e932571ffaee4bd88a5da5f6e` (Master Programme v1.98); no drift. ITR-001 disposition **C — CORRECTION REQUIRED BEFORE FOUNDER PREVIEW**; corrected by TIIZI-S3D-RESULTS-FINALIZED-EXPERIENCE-CORR-001 (Master Programme v2.00). Founder-preview presentation corrected by TIIZI-S3D-RESULTS-EXPERIENCE-CORR-002 (§11; Master Programme v2.01).
**Authority:** `docs/programme/TIIZI-S3D-PREIMPLEMENTATION-READINESS-001.md` (Founder disposition §14: FD-S3D-1, FD-S3D-2A, FD-S3D-3, FD-S3D-2 Race rule) + `docs/experience/TIIZI-S3-CHALLENGE-EXPERIENCE-CHARTER.md` §9/§12.
**No deployment. No S3d merge. S3c remains CLOSED (COMPLETE / FOUNDER ACCEPTED / MERGED, not reopened).**

## 1. Purpose

S3d answers **"What happened when this Challenge ended?"** It presents governed
final / frozen Challenge truth and creates none. Authority order preserved:
ENGINE / FROZEN TRUTH → PERSISTED FINALIZATION → READ MODEL → CLIENT CONTRACT →
TYPE-SPECIFIC RESULTS EXPERIENCE.

## 2. Honest lifecycle states

| State | Condition | Presentation |
| ----- | --------- | ------------ |
| live | `active` and server `governingToday <= endDate` | existing S3c live surfaces, unchanged |
| ended-pending (window-expired unprocessed) | `active` while server `governingToday > endDate` | neutral "Challenge ended / Final results are being confirmed"; logging + Leave unavailable |
| ended-pending (ended, not finalized) | `ended`, `finalized:false` | neutral results-pending; no provisional result shown as final |
| finalized | `ended`, `finalized:true` | sealed, type-specific results |

Derived by the pure module `src/v2/challenges/challengeEndState.ts` using only
server-projected values (never the device clock).

## 3. Bounded read-model projection (no schema / no migration)

`GET /v1/challenges/:id` (and list) now exposes a frozen per-participation
`final` block on `myParticipation`, projected read-only from
`challenge_participation_finals`:

```json
{ "completed": true, "completedAt": "...", "daysCompleted": 3,
  "bestStreak": 3, "finalStreak": 0, "finalPosition": null, "finalizedAt": "..." }
```

It is `null` while unfinalized. For Race the block is the member's **governing
(earliest completed) episode** result (PR #41 member identity); identity/gating
stay on the display episode. Exposing frozen `finalStreak` is the bounded
projection FD-S3D-2A approved — the live `currentStreak` is never substituted.
`finalized`, `finalizedAt`, `finalResult` and `finalPosition` were already
served and are now typed on the V2 client. **No schema. No migration. No second
results authority. No frontend recomputation.** CORR-001 (§7) additionally
reconstructs finalized per-participation result fields server-side from
immutable governed evidence on the read path — still no schema, no migration,
no second authority and no client-side recomputation.

## 4. Experience

- **Together** — final group total vs goal, percent (overshoot preserved, e.g.
  220/200 = 110%), goal reached / actual result when not (no failure wording),
  goal-crossing instant, own contribution + share, member-level contributors
  (no ranking), "Results saved on …".
- **Race** — own final result (total vs target; "Finished · Final position #N"
  from the served frozen value, ties share; "Progress at close" when unfinished),
  **Final standings** (finishers in server order, then participants who did not
  reach the target with actual progress), "N of M finished" derived from
  entries, "Results saved on …". No winner/podium/trophy.
- **Streak** — personal only: days completed of the full period, best streak,
  **Final streak** from frozen truth, required run, terminal completion stated
  plainly, per-day complete/missed history, "Results saved on …". No
  leaderboard, no comparison, no failure label.

Copy is restrained ("Results saved on …"), never an unqualified permanence
promise (ACT-03/ACT-04 correction governance remains deferred). Backend
terminology (finalized/frozen/terminal truth) never reaches the member.

## 5. Tests and guards

- `api/test/s3dResultsFinalizedExperience.test.ts` — T-1 (finalized Together
  read shape, overshoot, missed-goal actual result), T-2 (frozen `finalStreak`
  vs live `currentStreak`), T-3 (ended-not-finalized per type), T-4
  (window-expired-unprocessed detail + HTTP `challenge_not_active`), T-5
  (Race ties 1,1,3 + non-finisher null + governed position), T-8 (no partial
  exposure), plus the PR #41 member-identity result proof. T-6/T-7 are delivered
  by PR #41 and not duplicated.
- `scripts/testS3dResultsGuards.ts` (`npm run test:s3d-results`) — G-1 pure
  results derivation (frozen passthrough, overshoot, N-of-M), G-2 end-state
  routing, G-3 finalized-standings lifecycle through a real `QueryClient`, G-4
  S3c boundary preserved (S3d vocabulary absent from S3c-guarded files; live
  surface still unmounts when finalized), G-5 no failure/winner/podium/
  recognition vocabulary, no client-manufactured truth, no V1 imports.

## 6. Explicit scope boundaries (not touched)

Scheduler, automatic finalization, finalization HTTP mutation endpoint,
operator finalization UI, Run Again, recognition issuance / Platform
Recognition, badges/rewards, Kudos, Support Tiizi / donations / Cause, media,
S4/S8/S9, ACT-03/ACT-04 correction mechanism, schema redesign, migrations.
S3c is not reopened; its live experience is unchanged for active/in-window
Challenges.

## 7. CORR-001 — correction of blocking ITR-001 findings

Independent review (TIIZI-S3D-RESULTS-FINALIZED-EXPERIENCE-ITR-001) returned
disposition **C — CORRECTION REQUIRED BEFORE FOUNDER PREVIEW** with three
blocking findings. All three are corrected here; the slice remains
**IMPLEMENTED CANDIDATE / CORRECTED / AWAITING TECHNICAL REVALIDATION**.

### 7.1 Correction A — server-authoritative join lifecycle

**Root cause.** `joinChallenge` rejected only `status = 'ended'`. An
`active`-status Challenge whose governed server day had passed `endDate`
(ended-pending, unprocessed) was still accepted by `POST /join`, even though
the UI already treated it as ended-pending.

**Correction.** `challengeParticipations.ts` now enforces one shared
`requireParticipationMutable` authority for join: status must not be `ended`,
the finalization marker must be absent, and the governing Challenge day
(derived via the same `getGoverningVersion` + `dayInTimezone` seam activity
acceptance uses, never the device clock) must not be past the pinned end date.
Rejection maps to the existing governed `422 challenge_ended` (no new lifecycle
status). No participation episode is created on rejection.

**UI agreement.** `participationViewFor` now also treats an active-status
window-expired Challenge as read-only (same server-projected
`governingToday`/`endDate` rule as `endStateFor`), so the assembled screen
offers no Join for ended-pending, and no Leave (already gated by
`participationMutableForEndState`). Backend and UI authority agree; the
correction is not UI hiding.

### 7.2 Correction B — server-authoritative withdrawal lifecycle

**Root cause.** `POST /withdraw` had no lifecycle check; only the episode's own
`active` status was tested, so an ended/finalized/window-expired Challenge could
still be mutated. UI hiding is not authority.

**Correction.** `withdrawParticipation` now runs the same
`requireParticipationMutable` authority before any write. A rejected withdrawal
performs no update and leaves the participation episode unchanged. Historical
evidence is never touched.

### 7.3 Correction C — finalized-result source rule

**Invariant (now enforced).** *A read presented as FINAL RESULTS must never
combine sealed Challenge truth with mutable live-derived truth in a way that
can diverge after finalization.*

The ITR attack sealed a Collective total of 40 and then changed the mutable
derived projection to 999; the finalized read could expose the sealed 40
alongside live-derived 999. The finalized read path is corrected so that:

- Challenge-level result fields come from `challenge_finalizations` (class **F**);
- per-participation result fields come from immutable governed evidence
  deterministically reconstructed through the authorised engine fold
  (`recomputeChallengeDerived`, class **I**) — never from the mutable
  `challenge_*_derived` projections (class **L**);
- contributor totals are anchored to the sealed total and a reconstruction
  that does not reconcile fails closed (`500 final_result_divergence`);
- a Challenge marked finalized without a stored finalization fails closed
  (`500 finalization_missing`) — live values are never substituted;
- the client `resultsView.ts` no longer falls back from absent frozen fields to
  live `collectiveTotal`/`collectiveGoalReached`/completion/position/streak
  values; without sealed truth the finalized components render nothing as a
  final result.

S3c's live projection is unchanged for unfinalized Challenges; the correction
applies only to the FINALIZED read path.

## 8. Final-result source trace (F / I / L)

Class: **F** frozen finalization/final row; **I** immutable governed evidence
deterministically reconstructed; **L** mutable live-derived projection.

### Collective (Together)

| Finalized field | Source | Class |
| --- | --- | --- |
| Challenge total | `challenge_finalizations.result.collective_total` | F |
| Goal | pinned governed config (`challenges.goal_value`) | I |
| Goal reached | `challenge_finalizations.result.collective_goal_reached` | F |
| Goal-crossing instant | `challenge_finalizations.result.goal_completed_at` | F |
| Completions count | `challenge_finalizations.result.completions_count` | F |
| Own contribution | reconstructed immutable accepted records | I |
| Own share | arithmetic over frozen total | I |
| Contributor totals | reconstructed immutable accepted records | I |
| Contributor shares | arithmetic over frozen total | I |
| Contributor sum vs sealed total | enforced equality (fail closed) | F + I |
| Unit | pinned governed config (`challenges.goal_unit`) | I |
| "Results saved on" | `challenges.finalized_at` | F |

### Race (Competitive)

| Finalized field | Source | Class |
| --- | --- | --- |
| Own completion | `challenge_participation_finals.completed` | F |
| Own final position | `challenge_participation_finals.final_position` | F |
| Own completion instant | `challenge_participation_finals.completed_at` | F |
| Own progress at close | reconstructed immutable accepted records | I |
| Target / unit | pinned governed config | I |
| Standings positions | `challenge_participation_finals.final_position` | F |
| Standings progress (finishers + at close) | reconstructed immutable accepted records | I |
| N of M finished | frozen positions + entries | F + I |
| One identity per member (PR #41) | member-scoped governing episode | I |

### Streak (Daily Streak)

| Finalized field | Source | Class |
| --- | --- | --- |
| Completed | `challenge_participation_finals.completed` | F |
| Completed at | `challenge_participation_finals.completed_at` | F |
| Days completed | `challenge_participation_finals.days_completed` | F |
| Best streak | `challenge_participation_finals.best_streak` | F |
| Final streak | `challenge_participation_finals.final_streak` | F |
| Required run | pinned governed config | I |
| Period length | pinned governed period | I |
| Per-day history | reconstructed immutable day states | I |

No field presented as final truth remains class **L**. Non-result metadata
(units, timezone label, "Results saved on") does not alter the meaning of a
result. The list summary's per-participation `progress` stays the S3c live
projection and is **not** part of the finalized results presentation (the S3d
results experience is the detail read); the list's Challenge-level result
fields are frozen from `challenge_finalizations`.

## 9. CORR-001 evidence

- `api/test/s3dResultsFinalizedCorr001.test.ts` — 11 production-seam tests:
  A expired-active join rejected (no episode created) + in-window join
  unchanged; B in-window withdrawal succeeds, window-expired / ended /
  finalized withdrawal rejected, rejected withdrawal leaves the episode
  unchanged; F Collective sealed at 40 after derived tamper to 999 (detail +
  contributor reconciliation); G Race frozen position + reconstructed progress
  after tamper; H Streak frozen `finalStreak = 0` + reconstructed day history
  after tamper; I missing frozen truth fails closed for detail/contributors/
  leaderboard. **Discrimination verified: 9 of 11 fail against the
  pre-correction PR #42 implementation; the 2 passing cases are the
  "unchanged behaviour" controls.**
- `scripts/testS3dResultsGuards.ts` — CORR-001 fail-closed pure-function
  checks (no live substitution when frozen truth is absent) and the
  participant-copy check.
- Existing `challengeFoundation.test.ts` and
  `challengeParticipationRoutes.test.ts` fixtures pin the governed clock
  inside their 2026-06 windows; their assertions are unchanged.

## 10. Status statement

S3d is an **IMPLEMENTED CANDIDATE / CORRECTED / AWAITING FOUNDER ACCEPTANCE**.
This record does **not** mark S3d COMPLETE, FOUNDER ACCEPTED or MERGED,
authorises no deployment, and changes no code-merge state. Founder disposition
remains outstanding. S3c is not reopened.

## 11. CORR-002 — finalized presentation hierarchy (Founder-preview correction)

Bounded, presentation-only correction arising from Founder review of the live
S3d preview. No Challenge semantics, finalization, frozen truth, lifecycle
authority, Race member identity, schema, migration, activity acceptance,
ranking, recognition or result derivation changed.

**11.1 Outcome-first hierarchy (all three types).** Each finalized result now
leads with a human-readable outcome and keeps the governed numeric facts
beneath it (pure helpers `collectiveOutcomeFor` / `competitiveOutcomeFor` /
`streakOutcomeFor` in `resultsView.ts`):

- **Together** — reached: primary "Goal reached", actual total and goal
  immediately below, uncapped percentage and overshoot retained; not reached:
  neutral "{actual} of {goal} {unit} completed" with no failure/success
  recognition. Collective calculations and contributor ordering unchanged.
- **Race** — a participant with a served frozen position: primary
  "You finished #{position}"; a participant without one: primary
  "You reached {progress} of {target} {unit}" with "Progress at close"
  retained. Governed progress and Final standings retained; server-projected
  positions remain authoritative; no winner/podium/medal/recognition and no
  client-side ranking.
- **Streak** — when frozen final truth says the required run was reached:
  primary "You reached the {requiredDays}-day streak"; Best streak, Final
  streak, Days completed, the required run and day-by-day history remain
  supporting governed facts. Final Streak continues to render the frozen
  `final_streak` value (including 0) and is never derived from
  `currentStreak`. Not reached: neutral factual wording only.

**11.2 Finalized "Taking part" card removed.** The separate card
("TAKING PART" / "You took part in this Challenge." / "Results for this
Challenge are sealed, so joining and leaving are closed.") is no longer
rendered on finalized results. The underlying participation/lifecycle
authority is unchanged: `participationViewFor` still reports finalized as
read-only, and Join, Leave and Log Activity remain unavailable after
finalization. The live/ended participation UI is otherwise unchanged.

**11.3 Ended-pending hero status.** A window-expired-but-unprocessed
Challenge (server still reports `status: 'active'`) previously rendered
"Running" beside "Challenge ended / Final results are being confirmed". The
metadata label is now derived from the existing server-governed `endStateFor`
path (`statusLabelForEndState`): anything the server has effectively ended
reads "Finished". No device clock (`Date`/`Date.now`) is used, no lifecycle
status is added to the domain and no status is mutated for presentation. The
pending card still reads "Challenge ended / Final results are being
confirmed".

**11.4 Evidence.** `scripts/testS3dResultsGuards.ts` gains 13 CORR-002 checks
covering the twelve required proofs (Together reached/missed, Race
positioned/unfinished, Streak completed/non-completed with frozen
`finalStreak = 0` represented, finalized card absence, no Join/Leave/Log
Activity when finalized, ended-pending never "Running", pending copy intact,
server-governed end state only, and re-asserted CORR-001 fail-closed
discriminators). The CORR-001 fail-closed discriminators remain green.
