# TIIZI-S3D-PREIMPLEMENTATION-READINESS-001 — S3d Results / Finalized Experience — Pre-Implementation Readiness Assessment

**Type:** Assessment only. No implementation, no engine/domain change, no schema/migration change, no deployment.

**Reviewed main SHA:** `494ee23d40d37b97a8e11fac16535a427b1ac270` (matches the handoff reference exactly; `origin` = `https://github.com/Fkenogo/tiizi_challenges.git`; verified no drift). Master Programme v1.96.

**Programme state verified from the repository:** S3a / S3b / S3c COMPLETE / FOUNDER ACCEPTED / MERGED; TIIZI-S3C-DETAIL-CLEANUP-001 merged via PR #39 (accepted head `6ae21d72cb1ea229c64ca80ab9ebe080e32d96b7`, merge `e9cec23cb4d610db5f594420ddfb464297254f61`); S3c remains closed; **S3d NOT STARTED**; no deployment authorised.

**Experience Reference reviewed (read-only, unmodified):** `Fkenogo/tiizi-prototye` @ `cfa696fbd09180c6fdaeaf14d2e8784d8b05d6a6` (the adopted reference; inspected only after §§1–7).

**Disposition: D — MIXED.** Together is READY (experience assembly + client typing); Race is READY on the common path with one Founder-decision-gated edge; Streak has a bounded **API/projection gap** (frozen `final_streak` and terminal outcome are not exposed) plus a live-vs-frozen ambiguity that must not reach the UI. No missing *engine* capability was found; no engine change is recommended. See §9.

Order of analysis follows the charter rule: ENGINE / GOVERNED FINALIZED TRUTH → DOMAIN / PERSISTED STATE → API / READ MODEL → TYPE-SPECIFIC RESULTS EXPERIENCE. The prototype was consulted last and never as authority.

---

## 1. Programme authority for S3d (A)

**Source:** `docs/experience/TIIZI-S3-CHALLENGE-EXPERIENCE-CHARTER.md` §9 "S3d — Results / finalized experience" (Charter APPROVED / IMPLEMENTATION AUTHORISED, v1.79) and §12 Founder decisions FD-S3-001…005.

| Item | Authorised text |
| ---- | --------------- |
| Purpose | "see completion and frozen final results. S3d ends with authoritative final/frozen Challenge truth; Run Again is out of scope (FD-S3-003)." |
| Authority reused | frozen finals (`challenge_finalizations`, `challenge_participation_finals`) + `finalResult` + frozen leaderboard positions (§2E). Finals are produced via existing CLI/ops finalization — S3 adds no mutation seam. |
| Seams | "detail `finalResult` + frozen leaderboard (exist). No new API." |
| Experience | "read-only sealed results (totals/placements/streak outcomes preserved), logging disabled." |
| Non-goals | manual end/finalize/rebuild UI (S9 ops), recognition issuance, scheduling, Run Again / re-creation. |
| Preview | "CLI `finalize` → sealed results per type." Evidence: frozen rows + sealed rendering. |

Inherited dependencies: S3a read-only ended/finalized participation gating (`participationView.ts`); S3b logging hidden for `status !== 'active' || finalized` (`loggingView.ts:52`); S3c leaderboard query deliberately disabled once finalized and the live competitive surface unmounted (`progressView.ts:158`, `V2CompetitiveProgress.tsx:34`), with guard-enforced S3d-vocabulary bans in S3c files (§10.1, §11.2 G-4).

Relevant Founder decisions: **FD-S3-002** (existing CLI finalization is sufficient for S3 development/preview; scheduler belongs to S9), **FD-S3-003** (Run Again removed from S3d), FD-S3-004 (controlled local temporal preparation for streak preview is allowed, behaviour must still flow through canonical engine truth).

Programme/product governance that constrains S3d wording: Stage F FR-V2-120…122 (type-specific completion; ended Challenges "MUST reach an intelligible finalized historical state"; no same-identity reopening), FR-V2-211 (no Streak leaderboard), Product Definition K.6–K.10 (finishing position, ties, non-completers "NEVER labelled as failed"), L.13 (Streak results are personal: Days Completed, Best Streak, Current/**Final Streak**), M.6 (no automatic failure labels), M.8 (Collective: >100% preserved; expiry before goal reports the actual result and percentage); EA-01 M14 ("Results / finalization — BIND"; "ACT-04 repair deferred"); EA-01 M28 / MOT-01 (Recognition qualification unresolved, S8-gated); Ownership Register DRV-03 ("Ranking is optional Derived Truth, not Recognition, Reward or arbitrary score"; "Administrator cannot author rank or winner"; ranking metric/fairness/finalization Standard "pending").

**Does S3d already have implementation authority?** Yes for the bounded charter scope (sealed read-only results per type, no new API *as chartered*). Two things in this assessment go beyond the charter's "No new API" assumption or sit in unresolved governance (§9–§10): (a) one bounded read projection is needed for Streak (Founder should confirm it is inside S3d's authority rather than a new pre-slice); (b) three vocabulary/edge decisions (§10). Nothing else requires a new decision.

**Explicit exclusions (unchanged):** Run Again / re-creation, recognition issuance / Platform Recognition, completion awards/badges, Kudos, Support Tiizi / donations / Cause, media, operator finalization UI, scheduler, winner/podium semantics unless separately governed.

---

## 2. Finalization engine / domain truth (B)

All traced from code on `494ee23`, not inferred from UI.

### 2.1 What ends and what finalizes — two distinct events

| Concept | Mechanism | Evidence |
| ------- | --------- | -------- |
| **Ending** (ordinary acceptance stops) | (i) Collective goal crossing inside the acceptance transaction sets `status='ended'`; (ii) `processExpiredChallenges` / `finalizeChallenge` ends an *active* Challenge whose window has expired (`dayInTimezone(now, tz) > end_date`); (iii) governed manual `endChallenge`. | `challengeActivityApplication.ts:763-777`; `challengeFinalization.ts:135,343-376,488-534`; `challenges.ts:370-383` |
| **Finalization** (terminal truth computed once and frozen) | `finalizeChallenge(db, id, now)` — single transaction, `SELECT … FOR UPDATE` on the challenge row, idempotent, race-safe; requires status `ended` (or active-with-expired-window, which it ends first). Writes `challenge_finalizations` (1 row) + `challenge_participation_finals` (1 row per **episode**) + `challenges.finalized_at`. | `challengeFinalization.ts:343-470` |
| Trigger | **Explicit / process-driven only.** The only callers are the CLI (`api/src/challengeLifecycleCli.ts:37-78`, `npm run challenge:lifecycle`) and tests. No HTTP route, no scheduler, no Cloud Job, no listener. | repo-wide grep: only `api/package.json:17` references the CLI |
| Time-based? | Ending by window expiry is time-*determined* (governing timezone day > `end_date`) but time never *executes* it — an operator/job must call it. Until then a window-expired Challenge is still `status='active'` (§2.4 D-state 2). | `isWindowExpired`, `processExpiredChallenges` header ("No scheduler is deployed here") |
| Engine-derived? | Terminal outcomes are pure derivations: `evaluateTerminalTruth` over `recomputeChallengeDerived` (the same pure fold as live), so replay/verify share the fold. | `challengeFinalization.ts:187-256,386-397` |

### 2.2 State that represents finalization

No new lifecycle status. `status='ended'` + `finalized_at IS NULL` = ended, not finalized; `status='ended'` + `finalized_at` set = finalized. Statuses remain `establishment | active | ended` (`challenges.ts:63`). `CHECK (finalized_at IS NULL OR status='ended')` (migration 012 §1).

### 2.3 Where finalized truth is computed / persisted / sealed

| Question | Answer |
| -------- | ------ |
| Computed | `evaluateTerminalTruth` (`challengeFinalization.ts:187`), version `FINALIZATION_VERSION='ebc04/v1'`, engine `v2`, scoring `computeActivityScore/v1`. |
| Persisted | `challenge_finalizations` (challenge-level: `config_version`, `timezone`, `finalized_at`, provenance versions, `result` JSONB) and `challenge_participation_finals` (`completed`, `completed_at`, `days_completed`, `best_streak`, `final_streak`, `final_position`, `finalized_at`) — migration `012_ebc04_ending_finalization_rebuild.sql`. |
| Immutable / sealed? | **Yes at the persistence layer.** `BEFORE UPDATE OR DELETE` triggers reject any mutation of either final table; `challenges.finalized_at` is write-once and only on an ended Challenge; status transitions are one-way (`ended` terminal; no reopen). Rebuild on a finalized Challenge is **verify-only** and `repairFinalized` is refused with `finalized_repair_not_authorized` (`challengeFinalization.ts:570-586`). |
| Caveat (must shape copy) | "Cannot be changed" is true of the *system today*, not of an ever-guaranteed product promise: Stage F K.10 / M.5 contemplate governed correction (ACT-03/ACT-04), which is a **preserved deferral**; no correction mechanism exists. Sealed-result copy should say results are *saved / preserved*, and must not promise permanence beyond that. |
| Late activity | Rejected. `challenge_not_active` (422) both pre-transaction (`challengeActivityApplication.ts:490`) and inside the locked transaction (`:526`), plus a window-expired gate that rejects even before the ending is processed (`:541-548`). Backdated in-window `occurred_at` does not reopen it. Proven at the domain layer (EBC-04 tests 3 and 9). |
| Can history change a finalized result? | No: only accepted records feed the fold; acceptance is closed; finals rows are trigger-immutable; rebuild is verify-only. The single soft spot is the **live projection row** `challenge_participation_derived` (mutable table, not sealed) which the read API still serves for most progress fields (§5). It is not written after finalization except the one terminal streak transition (below). |
| Authoritative result truth per type? | **Yes for all three** (§3–§5), stored in the finals rows. |

### 2.4 The three end-states S3d must distinguish (and the read model exposes)

Proven by a throwaway diagnostic run in this assessment (§12; deleted, not committed):

| D-state | `status` | `finalized` | `finalResult` | Notes |
| ------- | -------- | ----------- | ------------- | ----- |
| 1. Active, in window | `active` | false | null | S3c live surfaces. |
| 2. **Window-expired, unprocessed** | **`active`** | false | null | `governingToday` (server) is past `endDate`; `endedAt` null; logging is already rejected server-side, but a client keying only on `status==='active'` still offers Log Activity (which then fails `challenge_not_active`). Observed: `{"status":"active","finalized":false,"endedAt":null,"governingToday":"2026-06-10","endDate":"2026-06-05"}`. |
| 3. **Ended, not finalized** | `ended` | false | null | Reached via Collective goal crossing (immediately), manual end, or after the ending seam and before finalize. Live derived truth is complete but **not frozen**. Streak `completionStatus` is still `in_progress` here — it must NOT be read as "not completed". |
| 4. Finalized | `ended` | true | populated | Frozen truth exists. |

Because FD-S3-002 accepts CLI-only finalization and no scheduler exists, D-states 2–3 can persist indefinitely in any environment where no operator runs `process-expired`/`finalize`. S3d's sealed results only ever render in D-state 4. This is a programme-level operational fact, not an S3d defect, but S3d must render D-states 2 and 3 honestly (§9, §10 FD-S3D-1).

---

## 3. Together (Collective) — finalized result (C)

**Canonical truth (frozen, engine-derived, served today):**

| Datum | Frozen source | Note |
| ----- | ------------- | ---- |
| Final shared total (overshoot retained) | `challenge_finalizations.result.collective_total` | Exact sum, may exceed goal (M.8 #4–5). |
| Target / goal | `challenges.goal_value` + `goal_unit` (pinned by config version) | Served on detail as `goalValue/goalUnit`. |
| Goal reached / not reached | `result.collective_goal_reached` | Boolean. Not-reached is reported as the actual result + percentage; **no failure label** (M.8 #7, M.6). |
| Goal-crossing instant | `result.goal_completed_at` | Null when not reached. |
| Completions count | `result.completions_count` | Counts **episodes** that completed, not members (see caveat). |
| Participant contribution | per-episode `cumulative_total` in live derived; contributors endpoint aggregates per member across episodes (S3c CORR-001, reconciles exactly with the total) | After finalization no acceptance occurs, so live == frozen for a Collective (verify pass would flag divergence). |
| Contribution share | `contributionTotal / collectiveTotal` (server-computed, S3c contributors read; `null` at zero) | Contribution visibility, **not** a leaderboard. |
| Completion/finalization state | `status`, `finalized`, `finalizedAt`, `finalResult.finalizedAt` | |
| Per-episode completion | `challenge_participation_finals.completed/completed_at` | On crossing every episode active at the instant completes ("shared achievement"). |

Observed finalized Collective read (diagnostic, goal 100, logs 60 + 50):
`{"status":"ended","finalized":true,"total":110,"reached":true,"cc":1,"finalResult":{…"result":{"collective_total":110,"completions_count":1,"goal_completed_at":"…13:00:00Z","collective_goal_reached":true}},"own":{"cum":110,"cs":"completed"}}`.

**What S3d can truthfully show today**

- *Canonical:* final group total vs goal, percent (incl. >100%), reached/not-reached, when the goal was reached, own contribution and own share, contributor totals/shares (member-level), finalized-at.
- *Derivable presentation:* "to go" when not reached (goal − total), overshoot amount when total > goal, sorted contributor display (display order carries no rank).
- *Unavailable / not authorised:* any winner/"top contributor" recognition, podium, ranking of contributors, MVP/badges/awards, recognition, "success/failure" framing of a missed goal, "completions" as a headline participant count (episode-based, semantics undefined).

Caveat: `completionsCount` counts episodes; a member who left before the crossing has no completed episode. It is not a governed "people who finished" number; do not label it that way without a Founder-defined semantics.

**Readiness: READY** (engine → persisted → API). Binding-only: the V2 client does not yet type `finalizedAt` / `finalResult` (§6).

---

## 4. Race (Competitive) — finalized result (D)

**Engine behaviour**

- Live completion is per participant when cumulative progress reaches the configured target (competitive engine; `derivedTruth.ts` fold); one finisher does not end the Challenge (EBC-04 test 11).
- Ending is at window expiry (or manual end). At finalization, `evaluateTerminalTruth` recomputes finishing positions with `computeFinishingPositions` (`derivedTruth.ts:360-379`): ordered by frozen `completed_at`, **standard competition ranking (1,1,3 / 1,2,2,4 / 1,2,3,3,5)**, no artificial tie-breaker, non-completers `null`; a stable secondary sort by participation id only affects the order in which tied ids are assigned, never the position value. Positions are frozen in `challenge_participation_finals.final_position` (CHECK ≥ 1). The completion instant is the canonical `completed_at` from recomputed truth, not the finalization time (EBC-04 CORR-001).
- Additional progress after target does not improve position (K.7); non-completers keep their actual progress, receive no position and are never labelled failed (K.9).
- **Final ranking is separately governed and sealed** — it is *not* the live ranking recomputed. Once finalized, the leaderboard route serves `frozen.get(id).final_position` instead of calling `computeFinishingPositions` (`challengeReads.ts:705-728`; EBC-04 test 17: "frozen 1,1,3 identical on repeat reads"; S3c CORR-001 test proves frozen positions still served after finalize).

**Served today**

| Datum | Where |
| ----- | ----- |
| Final positions (all members, latest episode each) | `GET /v1/challenges/:id/leaderboard` — frozen when `finalized_at` set. Entries: `memberId`, `participationId`, `totalPoints`, `cumulativeTotal`, `logsAccepted`, `completionStatus`, `completedAt`, `position`. |
| Own final position | detail `myParticipation.progress.finalPosition` (from finals). |
| Own final total / target | `myParticipation.progress.cumulativeTotal`; target from `config.activities[].targetValue`. |
| Unfinished participants | leaderboard entries with `position: null` and `completionStatus: 'in_progress'`; actual `cumulativeTotal` visible. |
| N of M finished | derivable from served entries (`position !== null` count over entries). Do NOT use `completionsCount` (episode-based). |

**Terminology authorised by existing truth**

| Term | Verdict |
| ---- | ------- |
| "Finished" (reached the target) | **Authorised** — engine `completed`; Stage F K.6/K.9; already used in accepted S3c copy. |
| "Final position" / "Finished #N" | **Authorised** — frozen `final_position`, standard competition ranking (K.6, K.8). Render server value, never client-ranked; never reproduce the prototype's `1,2,2` notation. |
| "Final standings" (a titled list of frozen positions) | **Presentational assembly of authorised data; wording needs Founder confirmation.** S3c already accepted "Race standings" for the live equivalent. DRV-03 records the ranking *Standard* (metric/fairness/finalization) as pending, so the term should be Founder-confirmed (FD-S3D-3). |
| "Winner" / "1st place trophy" / "Podium" | **NOT AUTHORISED.** No winner semantics exist; ties make "first" plural under K.8; DRV-03: "Administrator cannot author rank or winner outside approved correction"; S3c wording rule "no winner-takes-all copy". Not in S3d's charter. |
| "Did not finish / failed" | Failure labelling forbidden (K.9, M.6). Neutral reporting only ("Progress at close"). |

**Observation RACE-EDGE (domain, code-derived and diagnostic-confirmed — needs a Founder/engine decision, not an S3d workaround).** Finalization ranks **every participation episode**, including withdrawn/removed and earlier episodes of a member who left and rejoined (`challengeFinalization.ts:387-397`: `episodeIds` = all episodes). The leaderboard, however, shows the **latest episode per member** (`challengeReads.ts:694-700`). Diagnostic: Member A finishes in episode 1 (10:00), withdraws; B finishes 11:00; A rejoins and finishes episode 2. Frozen positions: A-ep1=**1**, B=**2**, A-ep2=**3**. Served board: **B=2, A=3 — no #1**; `completions_count` = **3 for two members**; A's detail shows `finalPosition 3`. This does not affect the ordinary path (no leave/rejoin after finishing), but a "Final standings" list rendered from served entries could visibly start at #2. The existing suite has no Race multi-episode finalization test. This is a *domain semantics* question (should an earlier/withdrawn episode hold a rank slot?), not a UI question; S3d must not paper over it by re-ranking client-side.

**Readiness: READY on the common path; PARTIALLY READY for the multi-episode edge** pending FD-S3D-2.

---

## 5. Streak — finalized result (E)

**Engine behaviour**

- Daily-only; one governing timezone (`challenges.timezone`, day = `dayInTimezone`), no grace, closed day rejects (`STREAK_DAY_CLOSED`), all configured requirements must be Done for a day to be Complete (FR-V2-210), a miss resets **current** streak while preserving best streak and days completed (L.9–L.10). Live logging **never** flips completion (`derivedTruth.ts:315-316`).
- **Completion is terminal-only**: at finalization `completed = required_consecutive_days > 0 && best_streak >= required_consecutive_days`; `completed_at` = the finalization instant; `final_streak` = the consecutive run ending **on the terminal day (`end_date`)**; `days_completed` / `best_streak` preserved (`challengeFinalization.ts:216-237`). Streaks carry no rank (`final_position` null; leaderboard 404; FR-V2-211).
- Outcome vocabulary in engine truth: `completed` boolean only. There is **no** "success/failure", badge, award, or recognition state; `completed=false` is "did not reach the required run", never a failure label (M.6).
- Day boundary: server-side governing timezone throughout; `governingToday` projected by the server (S3c). Timezone/day-boundary correctness is covered by the EBC-03 suite (`ebc03StreakTemporalCorrectness.test.ts`: Africa/Nairobi Challenge-local day vs UTC, client `occurred_day` cannot override, invalid timezone fails closed, no-grace, backdated closed-day rejection, late-join denominator, deterministic replay).

**Served today vs frozen — the gap**

| Datum | Frozen (finals) | API today |
| ----- | --------------- | --------- |
| Completed (terminal) | `completed` | Indirect: `progress.completionStatus` (live derived row, flipped to `completed` by finalization in the same tx) — **only after finalization**; ended-unfinalized stays `in_progress`. |
| Completed-at | `completed_at` (= finalizedAt) | `progress.completedAt` (same live row). |
| Days completed | `days_completed` | `progress.daysCompleted` (== frozen). |
| Best streak | `best_streak` | `progress.bestStreak` (== frozen). |
| **Final Streak** | `final_streak` | **NOT EXPOSED.** `progress.currentStreak` is the *live* value computed at the last accepted log and is not updated at finalization. |
| Required run / period denominator | config snapshot | `config.requiredConsecutiveDays`, `config.period` (denominator = full period, L.12). |

Diagnostic (days 1–3 complete then no more logging; required run 3): API after finalize → `currentStreak: 3, bestStreak: 3, completionStatus: 'completed'`; frozen finals → `final_streak: 0, best_streak: 3, completed: true`. **The served "current streak" (3) contradicts the governed Final Streak (0).** A second scenario (miss logged on day 5) happens to agree (both 0), which is exactly why this would slip past casual testing. EBC-04 test 23 asserts `final_streak` at the domain layer only; no read-layer test exists.

Product Definition L.13 names **Final Streak** as a governed Streak result ("the Final Streak when the Challenge ends"), so exposing it is authorised, not invented.

**What S3d can truthfully show for an ended Streak (today vs after the projection)**

- *Canonical today:* days completed of the full period (denominator = period days, L.12), best streak, required run length, terminal completed/not-completed (post-finalization only), finalized-at, per-day complete/missed history from `dayStates`.
- *Canonical, needs the projection (§9):* **Final Streak** (frozen `final_streak`).
- *Must not be shown:* live `currentStreak` on a finalized result labelled as the final streak; any leaderboard/ranking; success/failure/"failed" wording; badge/award/recognition; "streak broken" inferences beyond the served counters; other participants' streak results (no authoritative read projects them; streaks are personal, L.13 / FR-V2-211).
- *Not authorised:* completion awards, recognition, Run Again.

**Readiness: PARTIALLY READY — API/projection gap (B)** for Final Streak; the rest is served.

---

## 6. API / read-model readiness — field-level trace (F)

Legend: **READY** (served + client typed), **PARTIAL** (served, client untyped or ambiguous), **MISSING** (frozen but not projected), **NOT AUTH** (no governed truth). Layers are kept separate: a missing client field is not an engine gap, and a missing API projection is not missing domain truth.

Shared / all types

| S3d datum | Engine truth | Persisted source | API field | V2 client contract (`src/api/v2ChallengeApi.ts`) | Current UI consumer | Class |
| --------- | ------------ | ---------------- | --------- | --------------------------------------------------- | ------------------- | ----- |
| Ended vs finalized | lifecycle | `challenges.status/finalized_at` | `status`, `finalized`, `finalizedAt`, `endedAt` | `status`, `finalized` typed; `finalizedAt` **absent** (`endedAt` typed) | S3a/S3b gating (`participationView`, `loggingView`) | READY (typing gap) |
| Window-expired-unprocessed | derived from tz + end_date | config snapshot + wall clock | `governingToday`, `endDate` (both server) | typed (`governingToday`, `endDate`) | none | PARTIAL — derivable client-side from two server values; no explicit flag |
| Frozen challenge result | `evaluateTerminalTruth` | `challenge_finalizations` | `finalResult{finalizedAt,configVersion,finalizationVersion,engineVersion,scoringVersion,result{}}` | **absent** | none (guard-banned in S3c files) | PARTIAL (typing gap) |
| Finalization provenance | version stamps | same | same | absent | none | PARTIAL |

Together

| Datum | Persisted | API | Client | Consumer | Class |
| ----- | --------- | --- | ------ | -------- | ----- |
| Final total | `finalizations.result.collective_total` (== `challenge_derived_state.collective_total`) | `collectiveTotal`; `finalResult.result.collective_total` | `collectiveTotal` typed; `finalResult` absent | S3c `collectiveProgressFor` (live total) | READY |
| Goal / unit | `challenges.goal_*` | `goalValue`, `goalUnit` | typed | S3c | READY |
| Reached / not reached | `result.collective_goal_reached` | `collectiveGoalReached` | typed | S3c | READY |
| Goal-reached instant | `result.goal_completed_at` | `finalResult.result.goal_completed_at` (untyped JSON) | absent | none | PARTIAL (typing) |
| Own contribution / share | participation derived; contributors read | `myParticipation.progress.cumulativeTotal`; `/contributors` | typed | S3c | READY |
| Contributor totals/shares | derived (member-aggregated) | `GET /contributors` | typed | S3c (live) | READY |
| Completions count | `result.completions_count` | `completionsCount` | typed | S3c | READY but semantics = episodes; do not headline |
| Winner / top contributor / recognition | — | — | — | — | NOT AUTH |

Race

| Datum | Persisted | API | Client | Consumer | Class |
| ----- | --------- | --- | ------ | -------- | ----- |
| Frozen positions (board) | `participation_finals.final_position` | `GET /leaderboard` (frozen once finalized) | `getCompetitiveLeaderboardV2` typed | S3c hook **disabled when finalized** | READY (S3d needs its own enablement) |
| Own final position | same | `myParticipation.progress.finalPosition` | **absent** from `V2ParticipationProgress` | none | PARTIAL (typing) |
| Completed / instant | finals + derived | `completionStatus`, `completedAt` (entry + own) | typed | S3c (live) | READY |
| Final own total vs target | derived; config | `cumulativeTotal`; `config.activities[].targetValue` | typed | S3c | READY |
| Unfinished participants | derived | entries with `position:null` | typed | S3c | READY |
| N of M finished | — | derived from entries | — | S3c `raceBoardFor` | READY (derive from entries, not `completionsCount`) |
| Multi-episode frozen ranks vs member-level board | finals (per episode) | board = latest episode/member | — | — | PARTIAL — see RACE-EDGE / FD-S3D-2 |
| Winner / podium | — | — | — | — | NOT AUTH |

Streak

| Datum | Persisted | API | Client | Consumer | Class |
| ----- | --------- | --- | ------ | -------- | ----- |
| Terminal completed | `participation_finals.completed` | `progress.completionStatus` (live row; `completed` only post-finalization) | typed | S3c (live) | PARTIAL — ended-unfinalized `in_progress` is ambiguous |
| Completed-at | finals | `progress.completedAt` | typed | none | READY |
| Days completed / denominator | finals; config period | `daysCompleted`; `config.period` | typed | S3c | READY |
| Best streak | finals | `bestStreak` | typed | S3c | READY |
| **Final Streak** | `participation_finals.final_streak` | **not projected** | absent | none | **MISSING (projection)** |
| Live `currentStreak` on a finalized read | derived row | `currentStreak` | typed | S3c | PARTIAL — can contradict Final Streak |
| Day states | derived | `dayStates` | typed | S3c | READY |
| Required run length | config | `config.requiredConsecutiveDays` | typed | S3c | READY |
| Leaderboard / rank | — | leaderboard 404, `finalPosition` null | — | — | NOT AUTH (by design) |
| Other participants' results | — | none | — | — | NOT AUTH / MISSING (no governed read; personal results) |

Cross-cutting: the API serves the live derived row for most `progress.*` fields and only `final_position` from the sealed finals. For Together/Race the two agree by construction after finalization (acceptance closed; verify pass detects divergence); for Streak only `final_streak` diverges. The *frozen* source of record is `challenge_participation_finals`; the smallest correct fix is to project it, not to reinterpret the live row.

---

## 7. Existing finalized-experience surfaces in the repository (G)

None of the following is current authority. V1 is **FROZEN / reference-only** (EA-01 Founder disposition; cannot host V2); the repository boundary guard `test:v2-experience-boundary` forbids V1 imports into `src/v2/**`.

- **V2 (current) — no results UI exists.** Only read-only gating: `participationView.ts` (ended/finalized → `read-only`), `V2ParticipationSection` (finalized/ended copy), `loggingView.ts` (hidden), status chip in `V2ChallengeListScreen`, and the S3c competitive unmount (`if (detail.finalized) return null`). Race on a finalized Challenge currently renders **nothing** in the progress slot; Together and Streak keep showing their live surfaces unchanged (Streak still shows "Today's daily consistency" against `governingToday` on an ended Challenge).
- **V1 (Firestore) legacy, reference-only:** `src/features/Challenges/ChallengeCompletedScreen.tsx` (648 lines; recap variants, `assignFinishingPositions`/`ordinal`, share CTA), `CompletedChallengesScreen.tsx`, `ChallengeLeaderboardScreen.tsx`, `ChallengeDetailScreen` completed card, `src/utils/competitiveFinishing.ts`, `functions/src/challengeLifecycleJobs.ts` (`expireEndedChallenges`, status→`completed`, a *different* lifecycle vocabulary), and documentary `docs/reports/member-phase-10c-p5i-completed-challenge-experience.md`. They compute ranking client-side and use a `completed` status/"🏆" vocabulary that contradicts V2's `ended + finalized` model and the no-winner posture. **Not reusable** (V1 frozen; boundary guard). At most they evidence the historic demand for a recap screen.
- **Reusable V2 primitives** (allowed, neutral): S1 shell / `V2Primitives` (`V2Card`, `V2Page`, `V2Sheet`), `V2ChallengeHero`, `activityNames.tsx` name resolution, `progressView` pure-derivation convention, the `challengeQueryKeys` invalidation contract, `V2ActivityName`.

---

## 8. Prototype reference — inspected last (H)

`Fkenogo/tiizi-prototye` @ `cfa696fb`, `ChallengeDetailView.tsx`, `assumptionsData.ts`, `utils/runAgain.ts`, `docs/TIIZI-EXPERIENCE-REFERENCE.md`. **The reference has no distinct results product**: a completed Challenge is the same detail layout plus a banner, disabled logging and a Run Again button.

| Prototype element | Classification |
| ----------------- | -------------- |
| Banner "Finished: this challenge has ended. Everyone's results are saved and can't be changed." | **Supported (EBC-04 immutability)** — soften "can't be changed" to "saved" per ACT-04 caveat (§2.3). |
| "Results are in: this record is read-only." for `finalized` | **Supported** (`finalized`); a good ended-vs-finalized distinction (§2.4). |
| Logging disabled on completed views | **Supported** (already implemented S3b). |
| Finisher cards (`#rank`, "Finished (target)", finished time) | **Presentational interpretation** of frozen `final_position` + `completed_at`. Rank must be the served value verbatim. The prototype's seed data illustrates a tie at 2nd (`1,2,2,4`) — the same standard competition ranking system, at a different tie point — so seed data/notation must not be copied; S3c already renders server positions (e.g. 1,1,3). |
| "Still going (ranked once they finish)" on a finished Race | **Unsupported wording** for a sealed result; use neutral "progress at close". K.9 forbids failure framing. |
| "x of N finished" | **Supported** (derive from entries). |
| Collective "Target Exceeded!" badge with % | **Presentational interpretation** of `collective_total > goal`; badge/celebration copy is experience only — "Target Exceeded" must be conditioned on total > goal (≥ goal is "reached"). |
| Streak "Done x / N", Current, Best, "Best streak still saved" | **Supported**; but the prototype shows only the *live* layout — it has **no Final Streak presentation**, so streak results must be designed from L.13, not copied. |
| Run Again ("New cycle · 0 participants") | **Deferred capability** — removed from S3 by FD-S3-003. |
| Platform Recognition tiers/badges/"recognitions" in Profile + results recap | **Unsupported / new semantics** — policy-qualified, MOT-01 deferred, S8-gated (EA-01 M28; R4). |
| Kudos on results/feed | **Deferred** (S8). |
| Challenge-linked Support Tiizi | **Deferred** (S8; RECON-001). |
| Operator "reopen" / finalization health | **Unsupported / S9** (no reopen exists; FR-V2-122). |

Nothing was modified in the reference; the clone was read-only in a scratch directory outside the repository.

---

## 9. Engine-gap test (I)

**Classification: D — MIXED.**

| Type | Engine/domain | Persisted | API/read model | Class |
| ---- | ------------- | --------- | -------------- | ----- |
| Together | sufficient | sufficient | sufficient (client typing only) | **A — READY** |
| Race | sufficient (frozen 1,1,3; ties; non-completers) | sufficient | sufficient on common path; board is member-level while finals are episode-level | **A on common path**; edge decision FD-S3D-2 |
| Streak | sufficient (terminal evaluation, `final_streak`) | sufficient | **`final_streak` not projected; live `currentStreak` on a finalized read can contradict it** | **B — API/PROJECTION GAP** |

No **C** (engine/domain) gap: every governed result exists and is sealed. The two findings that are near the engine boundary are *decisions*, not missing capability: RACE-EDGE (episode-level rank slots) and the lack of any automatic finalization trigger (operational, FD-S3-002-covered).

The C/D result is not hidden: the Streak projection is real bounded read-model work, and it modifies `api/src/challengeReads.ts`, which the charter's "No new API" wording did not anticipate. It is small (read-only, no schema, no migration, no engine semantic change) but it is *not* pure experience assembly.

---

## 10. Recommended bounded scope for S3d (J) — assessment, not implementation

**Principle:** continue the accepted S3c visual language and the single existing detail route (`V2CreatedChallengeScreen`). Results are the *terminal state of the same detail page* — no separate results product, no new hierarchy.

### 10.1 Smallest correct bundle

1. **Bounded read projection (server, read-only).** Add a `final` block to detail `myParticipation` sourced from `challenge_participation_finals` for the display episode: `{ completed, completedAt, daysCompleted, bestStreak, finalStreak, finalPosition, finalizedAt }` (null while unfinalized). No schema, no migration, no engine or finalization change; consistent with the S3c precedent (bounded read projections). Type it on the V2 client together with `finalizedAt` / `finalResult` / `finalPosition`. Optionally project an explicit `periodEnded` flag rather than deriving `governingToday > endDate` client-side (S3c precedent: server-authoritative day).
2. **Experience.** Route the detail's progress slot by end-state (D-states in §2.4), in **new** results files (not by editing S3c-guarded files' vocabulary): active → existing S3c live surfaces unchanged; window-expired / ended-not-finalized → a neutral "ended — results are being confirmed" state, logging hidden; finalized → sealed results per type. Read-only. No mutation seams.
3. **Tests/guards** per §11.

### 10.2 Proposed information hierarchy (continuation of S3c)

Common shell (unchanged from S3c CORR-002/003): Back → hero (identity, Group, schedule, timezone, purpose; **no** Log Activity / Leave when ended) → one-line context ("Ended · dates · timezone · participation") → **results section** → supporting info → secondary "Create another Challenge". A quiet "Results saved on {finalizedAt}" line. No celebration graphics, badges or recognition.

**TOGETHER** — (1) Group total vs goal as the dominant figure with percent and, only if total > goal, the overshoot; (2) plain-language outcome derived from `collective_goal_reached` ("Goal reached on {date}" / actual total and percent when not reached — no failure wording); (3) your contribution and share; (4) contributors list (member-level, largest first, "You" highlighted, no ranks, no "top" label); (5) finalized-at. Omit `completionsCount` unless its semantics are defined.

**RACE** — (1) your result: total vs target and, if finished, "Finished · Final position #N" from the served frozen value (ties share; render exactly as served); if not finished, "Progress at close: x of target" with no position and no failure language; (2) the frozen standings list (finishers in served order with positions, then participants who did not reach the target with their progress) — titled per FD-S3D-3; (3) "N of M finished" derived from entries; (4) finalized-at. No winner/podium/trophy.

**STREAK** — (1) your outcome: days completed of the full period (e.g. 3 of 5), best streak, **Final Streak** (from the new projection), required run; (2) terminal outcome stated as engine `completed` ("Reached the required N-day streak" / "Best streak M of N required" — copy per FD-S3D-3, never "failed"); (3) a compact per-day complete/missed history from `dayStates`; (4) finalized-at. Personal only: no comparison with other participants, no leaderboard, no other-participant states.

**What transitions naturally from the live page:** hero and context line; the Together total/goal figure and contributor list (same components, frozen-labelled); the Race target/percent bar and standings list (frozen instead of live); the Streak days-completed/best figures. **What is replaced:** "Today's daily consistency", Done/Pending, rollover/reset notes, live "Placed #N (live)", and the Log Activity CTA.

### 10.3 Founder decisions required before implementation

- **FD-S3D-1 — Ended-not-finalized handling and the projection's authority.** Confirm (a) the neutral ended state for D-states 2–3 (recommended: sealed results only for `finalized`; never present live positions/streak as final) and (b) that the §10.1 read projection, though touching `challengeReads.ts`, is inside S3d's authority (recommended: yes, bounded read-only, S3c precedent) rather than requiring a separate pre-slice. Also confirm the S3d Founder preview relies on the CLI `finalize` (FD-S3-002) and that automatic finalization stays with S9.
- **FD-S3D-2 — RACE-EDGE.** Decide whether (a) leave/rejoin-after-finish holds two rank slots as implemented (accept and lock with a regression test; S3d renders served data), or (b) a bounded engine/domain follow-up governs episode-vs-member ranking and `completions_count` semantics. Recommended: accept (a) for S3d, record the limitation, and add the regression test; do not change the engine in S3d.
- **FD-S3D-3 — Results vocabulary.** Confirm: "Finished" and "Final position" are authorised; "Final standings"/"Results" as section titles are acceptable presentational labels; "Winner", "Podium", trophies/badges/awards/recognition are **not** used; streak terminal copy for `completed` true/false (no failure wording); and the "saved" (not "can't ever change") phrasing given the ACT-04 deferral.

Nothing else needs a decision: Run Again stays excluded (FD-S3-003), recognition/Kudos/Support stay S8, no scheduler in S3d.

---

## 11. Test and validation readiness (K)

### 11.1 Existing coverage

| Area | Coverage | Where |
| ---- | -------- | ----- |
| Ending (window expiry, idempotent end, no reopen, post-end rejection) | Domain, 5 tests | `ebc04EndingFinalizationRebuild.test.ts` tests 1–5 |
| Collective finalization (goal crossing overshoot, frozen aggregate, idempotent, post-finalization rejection) | Domain, tests 6–10 | same |
| Race finalization (one finisher doesn't end; ranking 1,1,3 / 1,2,2,4; non-completer null; frozen & stable across reads via leaderboard + detail) | Domain + read, tests 11–17, CORR-1…7 | same; `s3cLiveProgressCorr001.test.ts` (frozen positions after finalize) |
| Streak terminal (end by period, terminal evaluation, final_streak, no early finish, no rank) | Domain, tests 18–24, CORR-5 | same |
| Rebuild verify-only / repair refused / determinism / concurrency / atomicity | tests 25–34, CORR-7/8 | same |
| Timezone / day-boundary / no-grace / closed-day rejection / replay | EBC-03 suite (22 test cases + read exposure of governing timezone) | `ebc03StreakTemporalCorrectness.test.ts` |
| S3c guards preserving S3d boundary | `test:s3c-live-progress` (bans finalResult/finalPosition/winner/podium/recognition/award/Run Again in S3c files); `test:s3c-finalized-query` (finalized → 0 leaderboard transport calls) | `scripts/` |
| Read-only/hidden logging when ended/finalized | pure-view guards | `test:s3a-participation-experience`, `test:s3b-activity-logging` |

Re-run in this assessment (unchanged, no source modifications): `ebc04EndingFinalizationRebuild.test.ts` + `s3cLiveProgressCorr001.test.ts` — **42/42 passed**.

### 11.2 Missing regression tests S3d should require

API / domain (append-only; do not weaken existing):
1. **T-1 finalized Collective read shape** (`getChallengeDetail`): total, goal, `collectiveGoalReached`, `finalResult.result.{collective_total, collective_goal_reached, goal_completed_at, completions_count}`, own cumulative; plus **goal-not-reached at expiry** (actual total/percent, `collective_goal_reached=false`).
2. **T-2 finalized Streak read** (`getChallengeDetail`): the new projection's `finalStreak`, `completed`, `completedAt`, `bestStreak`, `daysCompleted`; **regression that `currentStreak` may differ from `finalStreak`** (days 1–3 complete then nothing logged, required 3 → served `currentStreak 3` vs frozen `final_streak 0`).
3. **T-3 ended-not-finalized read shape per type**: `status:'ended'`, `finalized:false`, `finalResult:null`; Streak `completionStatus` remains `in_progress` (must not be interpreted as not-completed).
4. **T-4 window-expired-unprocessed detail**: `status:'active'`, `finalized:false`, `governingToday > endDate`, and logging rejected server-side with `challenge_not_active` over the **HTTP route** (currently domain-level only).
5. **T-5 Race finalized detail**: `finalPosition` for tied finishers (1,1) and next (3), non-completer `null`, board entries with `position:null` retain actual `cumulativeTotal`.
6. **T-6 Race multi-episode finalization** (leave/rejoin after finishing) locking whichever decision FD-S3D-2 records (currently untested; DIAG shows 1/2/3 frozen vs 2/3 served).
7. **T-7 DB immutability actually rejects**: `UPDATE`/`DELETE` on `challenge_finalizations` / `challenge_participation_finals`, and `challenges.finalized_at` re-write/clear, each raise the guard error (the existing suite only *disables* the trigger for fault injection; rejection itself is unproven in tests).
8. **T-8 no partial exposure**: unfinalized Challenge never returns `finalPosition`/`final` block populated.

Client / guards:
9. **G-1** pure results-derivation module (React-free, S3c convention): renders served `finalPosition` only, never computes a rank; N-of-M from entries; overshoot only when total > goal; no failure/winner/podium vocabulary in S3d sources.
10. **G-2** end-state routing: active → S3c surfaces; window-expired/ended-not-finalized → neutral ended state; finalized → results; logging/leave hidden in all non-active states (including window-expired, using server `governingToday`/`periodEnded`).
11. **G-3** cache/refetch: finalization arrives by canonical refetch (existing invalidation contract), no `setQueryData` manufacture; S3d-specific leaderboard enablement (finalized competitive) proven through a real `QueryClient`, mirroring `testS3cFinalizedQueryLifecycle.ts`.
12. **G-4** S3c boundary preserved: S3d vocabulary stays out of S3c-guarded files; **do not weaken** the S3c guard bans — add S3d files and, if a guarded file must change, amend the guard only by an explicit, reviewed, narrowly scoped exception.
13. **G-5** V1 boundary: no V1 imports (`test:v2-experience-boundary`).

---

## 12. Verification performed in this assessment

- Repository verified against `origin/main` @ `494ee23` (fetched; identical to handoff). Work performed in an isolated worktree `/private/tmp/tiizi-s3d-readiness` on branch `docs/s3d-preimplementation-readiness-001`; the existing local checkout was not used or modified.
- Traced `challengeFinalization.ts`, `derivedTruth.ts`, `challengeReads.ts`, `challengeActivityApplication.ts`, `challenges.ts`, `challengeLifecycleCli.ts`, migration `012`, the V2 client/hooks/views, S3c guards, Stage F requirements/product definition, EA-01 reconciliation, Ownership Register DRV-03.
- Existing suites re-run (no changes): EBC-04 + S3c CORR-001 = 42/42 pass.
- **Throwaway diagnostics** (PGlite, existing fixtures copied into an uncommitted scratch test file, **deleted before commit**; no production code touched) settled three disputed behaviours: (1) finalized Streak API `currentStreak` vs frozen `final_streak`; (2) leave/rejoin Race frozen ranks vs served board; (3) window-expired-unprocessed and ended-not-finalized detail shape and the finalized Collective read. Results are quoted in §2.4, §3, §4, §5.
- No application source, test, script, package, migration, workflow or configuration file was changed.

## 13. Programme status statement

This assessment does **not** start S3d, does **not** mark anything implemented, does **not** reopen S3c (COMPLETE / FOUNDER ACCEPTED / MERGED), authorises no deployment, and changes no Master Programme state. Recording this assessment in the Master Programme is left to the Founder disposition step (precedent: RECON-001 was recorded by its separate closure task).

**Assessment status: COMPLETE — awaiting Founder disposition (STOP BEFORE MERGE).**
