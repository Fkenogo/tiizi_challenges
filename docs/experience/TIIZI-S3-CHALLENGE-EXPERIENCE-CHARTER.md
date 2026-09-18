# TIIZI-S3 — Challenge Experience Charter

**Task:** TIIZI-S3-CHARTER-001 (CHARTER — no implementation)

**Base:** `origin/main` @ `e6324d369382585c653f2449ea3aaa07c252fb96` (verified; no drift)

**Master Programme:** v1.79 (S3 CHARTER APPROVED / IMPLEMENTATION AUTHORISED;
S3a authorised, NOT STARTED)

**Status:** APPROVED / MERGE AUTHORISED (TIIZI-S3-CHARTER-APPROVE-MERGE-001).
Founder decisions FD-S3-001 → FD-S3-005 recorded in §12. Next authorised
implementation task is TIIZI-S3A-PARTICIPATION-ACCESS-001 (authorised, NOT STARTED —
S3a has not begun; no S3 slice is complete or in progress).

**Charter rule (engine-first):** canonical Tiizi/domain truth → governed authority →
persistence/read models → experience binding. S3 exposes existing Tiizi truth. The
experience must not become a second authority and must not invent challenge state,
progress, participation, rankings, completion, or recognition client-side.

## 1. Evidence base

Derived from, in order:

1. Master Programme v1.77 (`docs/programme/TIIZI-V2-MASTER-PROGRAMME.md`) and the
   Programme Guide (`docs/programme/TIIZI-V2-PROGRAMME-GUIDE.md`).
2. Accepted S2 assembled experience: `docs/experience/TIIZI-S1-V2-EXPERIENCE-FOUNDATION.md`,
   `TIIZI-S2G-GROUP-ESTABLISHMENT.md`, `TIIZI-S2B-V2-CHALLENGE-CREATION.md`,
   `TIIZI-EXPERIENCE-INTEGRATION-MAP.md`, `TIIZI-EA-01-PRODUCT-TRUTH-RECONCILIATION.md`;
   V2 screens `src/v2/challenges/*`, `src/v2/routes.tsx`, `src/api/v2ChallengeApi.ts`,
   `src/api/challengeCreationApi.ts`.
3. Engine/domain on main: `api/src/challengeParticipations.ts`,
   `challengeParticipationRoutes.ts`, `challengeActivityApplication.ts`,
   `challengeActivityRoutes.ts`, `derivedTruth.ts`, `challengeFinalization.ts`,
   `challengeReads.ts`, `challenges.ts`, `challengeConfigs.ts`, `challengeEstablishment.ts`,
   `challengeLifecycleCli.ts`, `app.ts` (registrations).
4. Persistence: migrations 001–017 (post-creation truth in 004, 005, 006, 009, 010,
   011, 012, 017).
5. Architecture (V1 FROZEN / reference-only where marked): `docs/architecture/challenge-architecture.md`,
   `challenge-data-model.md`, `challenge-engine-spec.md`.
6. Adopted Tiizi Experience Reference (`Fkenogo/tiizi-prototye` @ `cfa696fb`) as
   experience guidance only — never as domain authority.

## 2. Post-creation Challenge engine map (main @ `e6324d3`)

Capability classification: (1) engine implemented · (2) governed write seam exists ·
(3) governed read seam exists · (4) V2 experience binding exists · (5) missing binding
only · (6) missing domain/API capability.

### A. Participation

- `joinChallenge` / `withdrawParticipation` — `api/src/challengeParticipations.ts:94,150`.
  Statuses `active | withdrawn | removed` (`:35`); completion is Derived Truth, never a
  participation state (`:13-19`). Eligibility: UUID shape, challenge exists, rejects
  `ended`, requires live Group-Membership authority, one active episode per pair
  (`:100-146`).
- Write seams: `POST /v1/challenges/:challengeId/join`, `POST /v1/challenges/:challengeId/withdraw`
  (`api/src/challengeParticipationRoutes.ts:117-118,135-136`; reg `api/src/app.ts:105`).
- Read seam: `myParticipation` inside list/detail (`api/src/challengeReads.ts`).
- V2 binding: fetchers `joinChallengeV2` / `withdrawChallengeV2` exist
  (`src/api/v2ChallengeApi.ts:170-176`) but NO V2 screen consumes them → **(5)**.
- `removeParticipation` (`challengeParticipations.ts:166`) is domain-only with no HTTP
  route — by design (authorised removal is not part of the participant lifecycle) → (1) only.
- Verdict: (1)+(2)+(3); **(5) missing binding only** for join/withdraw UX.

### B. Activity logging / application

- `applyChallengeActivity` (`api/src/challengeActivityApplication.ts:389`): idempotency
  replay (`:430-442`), single-tx `runSubmission` (`:461,502`), live group-member gate
  (`:371`, fail-closed), exact-variant config match (`:342`), episode owning `occurred_at`
  (`:354`), governing version = current config at acceptance (`:529-534`), server-side
  score (`:699`), atomic persist + derived locks + accepted intent (`:706-808`).
- Challenge-specific configuration: `getGoverningVersion` (`api/src/challengeConfigs.ts:859`);
  pinned `(version, activity_config_id)`; exact unit match; Knowledge identity match
  (version deliberately not required); collective-unit homogeneity (`challengeConfigs.ts:208`);
  EBC-03 governing day derived server-side, client `occurred_day` mismatch → 422.
- Rejection is durable and fail-closed: `SubmissionRejectedError` (`:121`), rejected intents
  recorded outside the rolled-back tx (`:450-456`); reasons `GROUP_MEMBERSHIP_REQUIRED`,
  `CHALLENGE_NOT_ACTIVE`, `PARTICIPATION_NOT_ELIGIBLE`, `OCCURRENCE_OUT_OF_WINDOW`,
  `ACTIVITY_NOT_CONFIGURED`, `MEASUREMENT_NOT_COMPATIBLE`, `KNOWLEDGE_MISMATCH`,
  `STREAK_DAY_CLOSED` (no grace, no late logging); period-end gate stops ordinary logging.
- Write seam: `POST /v1/challenges/:challengeId/activity`
  (`api/src/challengeActivityRoutes.ts:178-179`; reg `api/src/app.ts:99`). Response echoes
  derived truth (`:152-168`).
- V2 binding: `logChallengeActivityV2` exists (`src/api/v2ChallengeApi.ts:178-186`) but NO
  V2 log screen consumes it → **(5)**.
- Verdict: (1)+(2)+(3); **(5) missing binding only**.

### C. Derived challenge truth

- Pure domain fold `api/src/derivedTruth.ts` ("No Firebase. No routes." `:24-25`):
  collective total incl. overshoot + `collectiveGoalReached` + `completionsCount`;
  competitive positions read-time only via `computeFinishingPositions` (completion-time
  order, ties share 1,1,3, non-completers null); streak `currentStreak/bestStreak/
  lastCompletedDay/dayStates/daysCompleted` (live streaks never flip completion —
  terminal evaluation at finalization only); per-episode and per-challenge state.
- No dedicated derived endpoint; exposed indirectly via activity responses and reads.
- V2 binding: list/detail screens bind current progress (`V2ChallengeListScreen`,
  `useChallengeDetailV2`).
- Verdict: (1)+(3 via reads)+(4 for current progress); leaderboard UX is **(5)**.

### D. Lifecycle

- Statuses `establishment | active | ended` (`api/src/challenges.ts:63`); `activateChallenge`,
  idempotent `endChallenge` (never reopens); window `start_date/end_date` + governing
  `timezone`; collective goal crossing auto-ends; expiry via `processExpiredChallenges`;
  `finalizeChallenge` (idempotent, `FINALIZATION_VERSION='ebc04/v1'`, frozen rows
  `challenge_finalizations` / `challenge_participation_finals`); `ended + finalized_at NULL`
  = ended-not-finalized; `rebuildChallengeDerived` recomputes live, verify-only for
  finalized (`api/src/challengeFinalization.ts`).
- Seams: **CLI only** (`api/src/challengeLifecycleCli.ts:39-76` — `process-expired`,
  `finalize <id>`, `rebuild <id>`). No HTTP, no scheduler deployment (stated `:35-37`).
- Verdict: (1)+(3: `status`/`finalized`/`finalResult` readable); S3 needs NO lifecycle
  mutation seam — ending/finalization/rebuild stay ops/CLI (S9), S3 reads frozen truth.

### E. Results

- `getChallengeLeaderboard` — competitive-only (404 otherwise), latest episode per member,
  live calc when unfinalized, frozen `final_position` when finalized
  (`api/src/challengeReads.ts:615-690`).
- Final state via `getChallengeDetail` (`finalized`, `finalizedAt`, `finalResult`) and
  `getChallengeFinal` / `getParticipationFinals` (`challengeFinalization.ts:260,272`).
- Read seams: `GET /v1/challenges`, `GET /v1/challenges/:challengeId`,
  `GET /v1/challenges/:challengeId/leaderboard` (`challengeReads.ts:714-744`;
  reg `api/src/app.ts:102`).
- V2 binding: `getCompetitiveLeaderboardV2` exists (`src/api/v2ChallengeApi.ts:164-168`)
  but NO V2 leaderboard/results screen → **(5)**.
- Verdict: (1)+(3); **(5) missing binding only**.

### Seam summary

Existing governed HTTP (challenge post-creation): `POST /v1/challenges/:id/join`,
`POST /v1/challenges/:id/withdraw`, `POST /v1/challenges/:id/activity`,
`GET /v1/challenges`, `GET /v1/challenges/:id`, `GET /v1/challenges/:id/leaderboard`
(competitive-only). Deliberately absent: `removeParticipation`, manual end/finalize/
expire/rebuild (CLI-only), personal activity-history/diary (`challengeReads.ts:17-19`),
governed correction ACT-03/04 (deferred).

**Missing canonical/domain capabilities for the bounded S3 lifecycle: none.** Every
capability S3 needs has engine code; gaps are transport/read/V2 bindings. Reference
elements with no engine truth at all (capacity/fullness, invites, flags/moderation,
voluntary contributions, Kudos, recognition) are outside S3 scope (see §4, §6).

## 3. Authoritative definition of S3 — Challenge Experience

S3 is the **participant lifecycle over already-created Challenges**, bound to existing
engine truth:

> Discover/access an existing Challenge → inspect it → join/participate where
> authorised → understand what activity counts → log/submit activity → see the accepted
> contribution (or durable rejection) → see personal/Challenge progress → see
> competitive position where applicable → see completion/final result.

Each step reuses a governed seam in §2. The experience creates no state of its own.

### Explicit non-goals (belong to other stages)

- Challenge creation — S2 (CLOSED; wizard/establishment untouched).
- Group management (detail, roster, invitations, admission, stewardship, Charter,
  Council, moderation/flags) — S4.
- Today aggregation/dashboard — S5.
- General Activity Guide / Knowledge browsing — S6.
- Templates (browse/use/author) — S7 / PF-06.
- Profile / Recognition / Notifications / Support Tiizi / donations / causes / Kudos — S8.
- Operator surfaces (manual end, finalize/rebuild/scheduler, review queues, audit) — S9.
- Capacity/fullness, invites lifecycle, flagged/moderated states — no engine truth exists;
  excluded until/unless a governed capability is chartered (not in S3).
- Custom Duration UI — deferred S2b follow-up (see §7).
- Challenge Image UI — blocked on media/domain prerequisite (see §7).
- PF-05 resurrection, PF-06 work, EBC-05 merge, V1 reuse (see §8).

## 4. Challenge-type experience scope (bound to engine truth)

### Collective

Participant sees: own accepted contribution; shared total vs goal (percent, to-go,
overshoot retained — engine keeps exact sums past 100%); completions count; contributor
rollup as share-of-total (NOT a podium). Completion may arrive via goal crossing
(auto-end) or window end + finalization; frozen totals preserved. No invented semantics.

### Competitive

Participant sees: own accumulation vs target; live position from the leaderboard seam
only (standard competition ranking 1,1,3 — ties share, non-completers null, window stays
open after first finisher, no winner-takes-all copy); N-of-M finished; frozen final
placement after finalization. No client-side ranking.

### Streak

Participant sees: qualifying activity per the governing config at acceptance; current /
best streak, day states, days completed; temporal status in the challenge's governing
timezone (day-boundary resets, closed-day rejection with no grace); completion evaluated
at finalization only — live UI must never present a streak as terminally complete.
No new temporal semantics.

## 5. Experience Reference alignment

Reference inspected at the adopted tree (`Fkenogo/tiizi-prototye` @ `cfa696fb`;
challenge list/detail/join/log/progress/leaderboard/results, Today, catalogue,
templates, profile, operator surfaces). Classification: (A) directly bindable · (B)
requires API/read binding (seam exists) · (C) requires missing domain capability ·
(D) later stage · (E) visual/interaction guidance only.

- Discover/access (status/type browse, search, affirmative CTA switch, hero with
  friendly timezone, read-only finalized/upcoming banners): **A/B + E**. Capacity/closed,
  flagged, invites: **no engine truth — excluded from S3** (E copy only, must not imply
  capability).
- Inspect (about, group, dates, headcount, what-counts recap per type): **A/B + E**.
  Cause dedication, movement/form guidance, catalogue matrix: **D** (S6/S8).
- Join (affirmative join on active; membership ≠ participation gate; creator does NOT
  auto-join — matches `join_creator` explicitness): **A** (engine already distinguishes).
- What-counts (metric/unit locked to canonical config; components ALL_REQUIRED with no
  summation; per-challenge timezone): **A** (EBC/PF contracts already govern).
- Log/submit → accepted contribution (joined-active entry points; metric-locked input;
  accepted + type-specific milestone feedback): **B + E**. Celebration/feed/Kudos: **E**,
  Kudos social semantics **D** (S8).
- Progress by type (Together totals/percent/contributors; Race own-bar + finisher cards;
  Streak today-checklist + countdown + reset banner): Together/Race **A/B + E**; Streak
  countdown/reset copy **E**, semantics already **A** (governing tz, day-closed rejection,
  finalization-only completion).
- Competitive position (Race 1,2,2 ties, null until finished; Together share-list is not
  a podium; Streak deliberately has no leaderboard): **A** (`computeFinishingPositions`
  already implements standard competition ranking) **+ E**.
- Completion/final result (sealed banner, logging disabled, frozen totals/placements):
  **A/B + E** (frozen finals already immutable).
- Run Again: REMOVED from S3 scope (FD-S3-003). Re-creating a Challenge is a
  creation/re-creation affordance, deferred for later placement (potentially alongside
  Templates/S7 or a separately authorised creation-experience enhancement). Not
  implemented in S3.
- Deferred to later stages (**D**): group hosting/permission surfaces (S4), Today
  prioritization (S5), catalogue/knowledge detail (S6), template gallery/use/authoring
  (S7), Profile/recognition/notifications/Kudos/support/donations (S8), operator console/
  review/audit (S9). No prototype assumption in these areas becomes domain authority.

## 6. Pre-S3 technical gaps (all binding-only; no canonical gap)

1. Participation mutation transport — EXISTS (`POST …/join`, `POST …/withdraw`); gap is
   V2 UX binding only.
2. Activity submission transport — EXISTS (`POST …/activity`); gap is V2 UX binding
   (incl. durable-rejection surfacing) only.
3. Challenge progress read model — EXISTS (list/detail progress); no new endpoint.
4. Participant progress read model — EXISTS (`myParticipation.progress`); no new endpoint.
5. Leaderboard read model — EXISTS (competitive-only); gap is V2 UX binding only.
6. Final-result read model — EXISTS (detail `finalResult` + frozen leaderboard); gap is
   V2 results UX only; finals are produced via existing CLI/ops, not new S3 mutations.

No genuinely missing canonical/domain capability was found for the §3 lifecycle.

## 7. Carried-forward Founder requirements

### Custom Duration

Disposition: **small S2b follow-up** (creation affordance), NOT S3. PF-03 already supports
arbitrary valid Challenge windows; the 7/14/21/30 presets (`challengeCreationDraft.ts:166`)
are experience affordances of the S2b wizard. S3 must not touch creation. A bounded
S2b maintenance slice may add a Custom valid non-preset duration later; no architecture
is invented here.

### Challenge Image

Disposition: **prerequisite media/domain slice first, UI after — outside S3**. No
canonical Challenge media/reference contract exists (no image/media/cover column in
004/009–012/017; only `knowledge_items.image_url` exists and is not a Challenge
contract). The programme must authorise a bounded media/domain package (contract +
persistence boundary) before any upload/display UI. S3 proceeds without image; no image
field, no upload UI, no invented media architecture in this charter.

## 8. PF / EBC / V1 boundaries

- **PF-05** (V2 Challenge Creation Wizard, implemented on unmerged
  `impl/pf-05-v2-challenge-creation-wizard-001`): experience assembly NOT APPROVED, NOT
  MERGED. S3 must not merge, cherry-pick, or resurrect it. S3 detail/logging/progress UX
  is new V2 assembly bound to §2 seams.
- **PF-06** (Challenge Template System & Admin Management): NOT BEGUN; remains Templates
  work (S7). No template browse/use/author in S3.
- **EBC-05** (revised PKG-1 exposure, `impl/ebc-05-engine-founder-preview-001`): UNMERGED /
  reference-only; must not be merged wholesale; not the V2 product path. S3 binds EBC-01→
  EBC-04 truth only.
- **V1**: FROZEN / reference-only; cannot host V2; no compatibility obligation; no V1
  experience reuse in S3.

## 9. Proposed S3 slice sequence (derived from authority topology)

Four vertical slices, each binding real engine truth to Founder-previewable experience.
The sequence follows the authority/lifecycle order — participant establishment
→ activity application → derived/live Challenge truth → final/frozen Challenge truth —
which corresponds to S3a → S3b → S3c → S3d below. Lifecycle mutations stay CLI/ops.
The sequence is Founder-approved (FD-S3-001); S3a implementation is authorised
(TIIZI-S3A-PARTICIPATION-ACCESS-001, NOT STARTED); S3b–S3d proceed in order, each
reaching a Founder-preview boundary before the next begins.

### S3a — Challenge participation / access

- Purpose: discover/access an existing Challenge, inspect it, join/withdraw where authorised.
- Authority reused: participation episodes + eligibility (`challengeParticipations.ts`);
  live Group-Membership authority; establishment/activation truth for visibility.
- Seams: `GET /v1/challenges`, `GET /v1/challenges/:id` (exist) +
  `POST …/join`, `POST …/withdraw` (exist). No new API.
- Experience: Challenge detail surface (hero, status, schedule in friendly timezone,
  group, what-counts summary from governing config, `myParticipation` state) + affirmative
  join/withdraw actions with closed/ended/finalized read-only states.
- Non-goals: logging, leaderboard, results, creation edits, group management.
- Preview: sign in → open a Challenge → join → withdraw → rejoin; refresh persistence.
- Evidence: journey recording + read-only persistence check (episode rows).

### S3b — Activity logging / application

- Purpose: understand what activity counts; submit activity; see accepted contribution or
  durable rejection.
- Authority reused: `applyChallengeActivity` pipeline + governing config version at
  acceptance + idempotency + rejection intents (§2B).
- Seams: `POST …/activity` (exists); what-counts presentation from detail governing
  config (exists). No new API.
- Experience: per-activity/component entry bound to the governing config (metric-locked
  input, component toggles, server-derived fields never sent), accepted-contribution
  confirmation with derived delta, fail-closed rejection surfacing (incl. streak
  day-closed, out-of-window, incompatible measurement).
- Non-goals: progress dashboards, leaderboard, results, history/diary API.
- Preview: joined participant logs qualifying activity → accepted; logs invalid activity
  → legible rejection; duplicate `client_key` → stable replay.
- Evidence: submission trace rows (accepted + rejected intents) + response payloads.

### S3c — Live progress / type-specific state

- Purpose: see personal and Challenge progress with per-type truth.
- Authority reused: derived fold (§2C) via existing reads; `computeFinishingPositions`
  for live competitive position.
- Seams: list/detail progress (exist) + `GET …/leaderboard` competitive-only (exists).
  No new endpoint.
- Experience: Collective (total/goal/percent/to-go/overshoot, contributor share-list);
  Competitive (own accumulation, live position, N-of-M finished, null-until-finished);
  Streak (today requirements, current/best, day states, governing-tz temporal status,
  never terminally complete while live).
- Non-goals: finalized results, recognition, Kudos.
- Preview: multi-participant logging across all three types showing diverging live truth.
- Evidence: read payloads vs rendered state for each type.

### S3d — Results / finalized experience

- Purpose: see completion and frozen final results. S3d ends with authoritative
  final/frozen Challenge truth; Run Again is out of scope (FD-S3-003).
- Authority reused: frozen finals (`challenge_finalizations`,
  `challenge_participation_finals`) + `finalResult` + frozen leaderboard positions (§2E).
  Finals are produced via existing CLI/ops finalization — S3 adds no mutation seam.
- Seams: detail `finalResult` + frozen leaderboard (exist). No new API.
- Experience: read-only sealed results (totals/placements/streak outcomes preserved),
  logging disabled.
- Non-goals: manual end/finalize/rebuild UI (S9 ops), recognition issuance, scheduling,
  Run Again / re-creation.
- Preview: CLI `finalize` → sealed results per type.
- Evidence: frozen rows + sealed rendering.

## 10. S3 acceptance model

Whole-S3 Founder acceptance requires a live participant lifecycle, not screens/tests
alone, across all three Challenge types, against the governed seams (no production
deployment):

1. Collective: create (S2 path) → join → log → shared total advances → goal crossing or
   CLI finalize → sealed total + contributor shares.
2. Competitive: create → join (2+ members) → log → live tied positions (1,2,2) → finish
   → CLI finalize → frozen placements.
3. Streak: create → join → log across governing-tz days (controlled local temporal
   setup permitted per FD-S3-004; behaviour still processed through canonical engine
   truth, never manufactured in UI) → current/best/day-states evolve
   → closed-day log rejected → CLI finalize → terminal completion from best streak; live
   UI never claimed early completion.

Each slice is previewed per §9; whole-S3 acceptance runs the three journeys end to end
on a local preview with read-only persistence verification.

## 11. Programme status after charter approval

- S2 remains COMPLETE / FOUNDER ACCEPTED / MERGED (unchanged).
- S3 is CHARTER APPROVED / IMPLEMENTATION AUTHORISED (TIIZI-S3-CHARTER-APPROVE-MERGE-001).
- Next authorised implementation task: TIIZI-S3A-PARTICIPATION-ACCESS-001 (authorised,
  NOT STARTED — S3a has not begun).
- No S3 slice (S3a–S3d) is complete or in progress.
- Slices proceed S3a → S3b → S3c → S3d per FD-S3-001, each to a Founder-preview
  boundary before the next begins.
- No later stage (S4–S9) is pulled into S3; no PF-05 resurrection; no PF-06 work; no
  EBC-05 merge; V1 remains frozen.
- No source/API/schema/migration/workflow/package change in this approval.

## 12. Founder decisions (TIIZI-S3-CHARTER-APPROVE-MERGE-001 — all five resolved)

1. **FD-S3-001 — Implementation cadence: slice-by-slice S3a → S3b → S3c → S3d.**
   Each slice establishes a coherent vertical capability and reaches a Founder-preview
   boundary before the next proceeds. No unnecessary governance micro-slices.
2. **FD-S3-002 — Finalisation: existing CLI finalisation is sufficient** for S3
   development and Founder preview. S3 consumes authoritative finalisation/frozen-final
   truth. Production scheduling/operational finalisation belongs to the operator/
   operations stage (currently S9). No scheduler in S3.
3. **FD-S3-003 — Run Again removed from S3d.** S3d ends with authoritative final/frozen
   results. Run Again is a creation/re-creation affordance, deferred for later placement
   (potentially alongside Templates/S7 or a separately authorised creation-experience
   enhancement). Not implemented in S3.
4. **FD-S3-004 — Streak preview without waiting real days.** Controlled local
   preview/test preparation may establish the temporal conditions for streak behaviour.
   Behaviour must still be processed through canonical engine truth; the UI must not
   manufacture streak progress/completion.
5. **FD-S3-005 — External Workers Build is NOT an S3 engineering gate.** The repository
   `ci` workflow remains the engineering gate. The external check is not modified or
   suppressed here; its deployment relevance may be investigated separately when that
   deployment path becomes relevant.
