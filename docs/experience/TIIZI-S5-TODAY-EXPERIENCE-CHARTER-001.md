# TIIZI-S5 — Today Experience Charter 001

**Task:** TIIZI-S5-TODAY-EXPERIENCE-CHARTER-001 — reference reconciliation and bounded implementation readiness. **Authoritative charter; S5a implemented candidate is recorded below.**

**Canonical implementation base reviewed:** `origin/main` @ `a2275fe2a80a4ec283e606412fadf91d1da4f468` (post PR #65).

**Previous documentation head:** `f4020f0318faa3ff21d4f7949ce1b353cec1f7e0` on `docs/tiizi-s5-today-readiness-001`.

**Experience Reference inspected:** `Fkenogo/tiizi-prototye` @ `cfa696fbd09180c6fdaeaf14d2e8784d8b05d6a6`, including `docs/TIIZI-EXPERIENCE-REFERENCE.md`, `src/components/today/TodayView.tsx`, and `src/data/assumptionsData.ts`. This repository is an experience reference, not Product Truth or backend authority.

**Status:** Charter merged and authoritative on `origin/main` @ `5d556e129defcf174ff1060dced577b5ebfc1df3` (post V1 Exclusion Pass 001). S5a implementation is a reconciled unmerged candidate; S5b and S5c remain subsequent slices (both NOT STARTED).

**Namespace reconciliation:** V1 Exclusion Pass 001 replaced the retired `/v1` API prefix with the product-neutral `/api` namespace. The forward-looking endpoint references in this charter have therefore been restated under `/api/*`. The S5 Product Truth, projection contract, sequence, boundaries and non-goals recorded below are unchanged by that correction. See [`TIIZI-API-NAMESPACE-CORRECTION-001.md`](../architecture/TIIZI-API-NAMESPACE-CORRECTION-001.md) and `AGENTS.md`.

## 1. Founder dispositions

### FD-S5-001 — APPROVED WITH CLARIFICATION

Stage F T1 §O remains Product Truth. EA-01 and the Experience Reference govern human-facing assembly and do not replace Product Truth. Today is progressively assembled from governed capabilities that exist. Absence of a downstream capability means omission or bounded adaptation for now; it does not authorize simulation and does not permanently delete that capability from eventual Product Truth.

> Today is progressively assembled from governed capabilities. Absence of a downstream capability means omission or bounded adaptation, not simulation and not deletion from eventual Product Truth.

The Experience Reference ordering is adopted as the human-facing assembly hypothesis: immediate required activity; active Challenge progress and attention; invitations or relevant join opportunities; upcoming events; bounded community moments. T1 §O's results, milestones, meaningful developments, and discovery remain legitimate Product Truth. Each is assembled when its authoritative capability exists and is suitable; the sequence is not used to silently narrow T1.

### FD-S5-002 — APPROVED WITH REFINEMENT

There is no authoritative inbound invitation record or invitation inbox read model. Explicit Group and Challenge invitations are deferred until that capability exists. Invite-code resolution and a Member's outgoing join request are not invitations in an inbox. This does not defer Group-contextual Challenge opportunities: a discoverable, joinable Challenge hosted by a Group the Member belongs to may be surfaced as an opportunity, not labelled as an invitation.

### FD-S5-003 — DO NOT ADOPT THE PROTOTYPE FEED AS SHOWN

Product Truth remains: Today/Home is not a Feed; Group Feed is the single Group community stream; Today must not duplicate it. No Group Feed artefacts currently exist. Initial S5 defers community moments. Preserve their eventual experience intent as a very small bounded attention/summary card sourced from a future authoritative Group Feed or event capability, linking to that Group/Feed and never becoming a chronological stream.

## 2. Product Truth and experience boundary

T1 §O.1 defines Home as an accountability and operational surface answering “What matters to me right now?” T1 §O.2 retains its five Product Truth priorities: (1) what the Member needs to do, (2) active Challenge state and progress, (3) results and milestones, (4) meaningful Group/Challenge developments, and (5) discovery opportunities. T1 §O.3–O.5 retain those content types and prohibit duplication of Group Feed. EA-01 is the adopted experience assembly authority for the human-facing V2 shell, subject to this Product Truth.

The prototype's Today is an action home, not a generic dashboard, fitness tracker, second Challenges page, second Group Feed, or vanity-metric surface. The primary question remains “What matters to this Member right now?” Prototype layout and mock values do not establish data authority.

S5 exposes and assembles current truth. `GET /api/today` is a member-scoped projection; it does not become a domain engine. It must not calculate Challenge results, establish lifecycle, implement Streak, calculate Competitive ranking, create Recognition, invitations, Feed events, recommendations, or payment/support state, or mutate Challenge/participation state.

## 3. Experience Reference: component reconciliation

| Prototype section or element | Disposition | S5 direction and boundary |
| --- | --- | --- |
| Today greeting and action-home hierarchy | **ADOPT** | Primary action home; contextual greeting; server-governed day context; “what to do today” hierarchy; authoritative active-Challenge count; action-first hierarchy; compact cards/pills; mobile-first. No hardcoded prototype date. |
| Streak — action required today | **ADAPT** | Use authoritative Challenge/participation/application/derived truth for Challenge identity, governing day, current and best streak, completed days, required Activities, per-requirement state, Done Today/Pending Today, direct existing Log action, and missed/restarted state when derivable from governed records. No second Streak engine and no client `doneToday`. |
| “Time remaining today” | **ADAPT** | Prototype literal is not authoritative. Server may derive the instant the Challenge-local governing day closes from `serverNow` and the configured IANA timezone using the same day-boundary semantics as the engine, and return that context. Friendly countdown copy may then be displayed. Browser/device time never determines governing day. If implementation cannot prove DST-safe equivalence to engine day semantics, omit countdown and retain governing date. |
| Active Challenge Progress | **ADOPT / ADAPT** | Compact cards for active Challenges the Member actually participates in. Together may show authoritative group total/target, member contribution, remaining amount/window and existing log action. Race may show own target progress/amount remaining/qualification; ranking/standing only from Competitive authority. Streak's required action stays in the higher-priority action section. Link cards to Challenge Detail; do not reproduce that page or derive ranking. |
| Challenges in Your Groups You Can Join | **ADAPT / AUTHORIZE BOUNDED CAPABILITY** | Contextual opportunities may be projected from current Group Membership, the existing governed Group-scoped Challenge discovery read, Challenge lifecycle, and participation. Exclude an active participation; require current Group membership; present no inferred-interest ordering or relevance score. CTA routes through the existing governed join authority and cannot bypass its checks. This is not an invitation or personalized recommendation. |
| Explicit Group/Challenge invitations | **DEFER** | No inbound invitation entity/read model. Do not fabricate invitation cards from invite codes, outgoing requests, or Group opportunities. |
| Upcoming events / Challenges | **ADAPT** | Show joined Challenge starts/ends when derived from authoritative Challenge dates, timezone, lifecycle, and server-governed day. For S5 projection policy only, “upcoming” means a lifecycle boundary within the next seven Challenge-local calendar days after `governingToday`; this is presentation policy, not new lifecycle truth. No notifications are required. Group-contextual upcoming opportunities may appear in the separate opportunities section when visibility/join rules permit. |
| Results and milestones | **ADAPT / PROGRESSIVE ASSEMBLY** | Preserve as legitimate T1 §O Home material. Initial S5 may show a compact link/attention item for an existing authoritative finalized personal result when returned by existing result authority. Do not recalculate results, invent “recent” events, or infer milestones. Recognition appears only from an authoritative Recognition capability; it is not inferred from Challenge progress. Other milestone/Recognition assembly waits for upstream authority. |
| Community Accountability Feed / community moments | **DEFER** | Do not adopt prototype peer logs, cheers, Kudos controls, or a chronological Today stream. Initial S5 has no community moments. Later, a bounded summary card may link into the single authoritative Group Feed. |
| Support / Social Cause | **OMIT from initial S5** | No payment/support execution in Today. Social Cause approval does not gate ordinary participation. S8 execution remains absent. Cause attention is not an ordinary Member task. |
| Prototype notification bell/badge | **DEFER** | No authoritative notification inbox/read model for Today; no fake unread state. |
| Prototype sample flagged Challenge / fixture CTAs | **OMIT** | Mock/test fixture is not member truth. |
| Experience Reference chrome, persona switchers, simulators | **OMIT** | Reference-only tools are not product UI. |

## 4. Capability assessment from current authority

Assessment is against the canonical implementation base `a2275fe2a80a4ec283e606412fadf91d1da4f468`, not the dirty primary checkout.

### Required Streak actions and status

The authoritative API already projects own `myParticipation.progress` from `challenge_participation_derived`: `currentStreak`, `bestStreak`, `lastCompletedDay`, `dayStates`, `daysCompleted`, `completionStatus`, accepted logs, cumulative values, and final position where authoritative. Streak day states are keyed by governed `occurred_day` and carry `complete` plus the canonical Activities recorded for that day. The Streak fold marks a day complete only after all governing requirements are present. Accepted `challenge_activity_records` are immutable applications; the governing Challenge config identifies today's required Activity requirements.

Therefore per-requirement Done/Pending can be projected by matching today's authoritative `dayStates[governingToday].activities` against the current governing requirements. A Today projection must preserve canonical identities/config semantics, use the Challenge's `governingToday`, and must not create or persist `doneToday`. Today must not use another participant's progress. If implementation discovers a requirement form whose satisfaction cannot be mapped from `dayStates` and accepted application truth, that exact form must be omitted until an upstream projection exists; it must not be guessed from client logs.

`dayStates`, `currentStreak`, `lastCompletedDay`, and Challenge dates support a bounded missed-day/restarted presentation only where their governed calendar meaning establishes the prior incomplete day and an earlier completed streak. There is no standalone `missedYesterday` flag in the authoritative V2 projection; do not copy the prototype boolean or claim a reset event that the records do not establish.

### Governing-day countdown

Existing Challenge reads return the Challenge IANA `timezone`, server `governingToday`, and (on detail) `serverNow`; the Streak calculation/application uses the same timezone policy. A server-side projection can derive the next Challenge-local midnight instant from the same timezone rules, including 23/25-hour daylight-saving days, and return `governingDayEndsAt`/remaining duration with `serverNow`. This is presentation context from existing authority, not a new lifecycle authority. It is authorized only if S5a reuses/verifies the exact engine timezone boundary semantics. A client may format/decrement a supplied duration but may not choose the Challenge day using device time. With multiple Streak Challenges in different timezones, each action is paired with its own governing day and remaining duration; Today must not invent one universal day boundary.

### Active Challenge progress

`GET /api/challenges` returns visible Challenge summaries and own participation. `GET /api/challenges/:challengeId` returns governed config and own progress; Together collective totals and goals are read by the Challenge authority, and Competitive frozen position is available only after finalization. The existing Challenge Detail experience remains the destination for full information. Today can compose compact own progress from these same sources through the server projection. It must not sum unrelated units, make a live Race rank, infer a winner, or turn participation counts into social proof.

### Group-contextual opportunities — exact determination

**Authorize for initial S5 as a bounded contextual discovery section, subject to using the existing governed reads and join seam.** `GET /api/memberships/me` supplies the authenticated Member's current Group memberships. `GET /api/challenges?groupId=…` scopes through the existing entitlement model and, for discoverable Groups, its bounded Challenge discovery projection. It returns Challenge identity, Group, lifecycle dates/status, and the Member's own participation projection. The Challenge join endpoint independently requires a current authoritative Group Membership and a mutable Challenge window, and rejects an already-active participation.

The Today projection may include only discoverable hosted Challenges that are not already actively participated in and whose lifecycle/window is currently joinable under those existing authorities. The section is contextual, not personalized: no interest matching, inferred relevance, scoring, ranking, or automatic enrollment. A card may point to the existing Challenge detail/join path; all eligibility and join checks stay in the existing authority. If S5a cannot prove joinability from the current lifecycle/status fields without guessing, it must omit the Join CTA and identify the exact unprojected joinability signal; it must not label that row “You can join.” Future personalized recommendation engine remains deferred.

### Upcoming state and T1 results/milestones

Challenge `startDate`, `endDate`, `timezone`, lifecycle status, and server `governingToday` support the bounded seven-Challenge-local-day presentation window defined above. Challenge dates/lifecycle remain authoritative. The window creates no scheduler, notification, or new lifecycle state. Existing finalized results remain available through S3d authority; Today may link to that result without re-rendering it. No standalone milestone or Recognition authority is established by this read model.

## 5. S5a — bounded `GET /api/today` projection

**Purpose:** one authenticated, member-scoped server projection supporting the reconciled Today assembly. Identity is resolved from the authenticated request, never accepted from request body/query as a member selector. The endpoint composes current authorities and returns no client-derived truth.

**Contract direction (implemented shape is recorded in the S5a implementation record):**

```text
GET /api/today
{
  serverNow,
  activeChallengeCount,
  todayContext: { serverNow, activeChallengeCount, timezoneContexts },
  requiredToday: [{ Challenge, governingToday, requirements, streak }],
  joinedChallengeProgress: [{ Challenge, typeSpecificOwnProgress }],
  groupChallengeOpportunities: [{ Challenge, Group, joinability: "not_asserted" }],
  upcoming: [{ Challenge, kind: "starts" | "ends", lifecycleDate }],
  finalizedResults: [{ Challenge, detailPath }],
  unsupportedSections: { invitations, communityMoments, notifications }
}
```

The wire schema may use explicit empty arrays plus capability status rather than literal enum strings, but it must distinguish “no items” from “upstream capability unavailable” without fabricating cards. Omit a section's data when its authority does not exist. Do not add mock placeholders. The projection may compose participation, accepted activity applications, derived truth, current Challenge config/lifecycle/finalization, and current Group memberships/discovery. It returns only caller-owned participation data and disclosure-safe Group/Challenge summaries.

**Boundary:** no calculation of results, Streak, ranking, Recognition, invitation state, Feed events, recommendation scoring, payment/support state, participation truth, Challenge lifecycle, or joinability beyond authoritative existing signals; no writes/mutations; no cross-member records; no client fan-out to decide Challenge day, Streak, ranking, participation, lifecycle, or joinability. It is not a second Challenge Detail API; cards route to authoritative Challenge Detail and existing log/join actions.

**Specific upstream capability gaps:**

- Inbound invitation entity, member inbox read, and governed accept/decline seam: absent; invitations deferred.
- Group Feed publication/read/event capability: absent; community moments deferred.
- Recognition issuance/read authority and standalone milestone records: absent; assemble only existing finalized result links for now.
- Notification inbox/read authority: absent; no Today notification badge.
- Explicit shared joinability projection: no dedicated `canJoin` field exists. Current membership, Challenge lifecycle/window, and active participation plus existing join authority support the bounded current case. If any additional eligibility/capacity/rule authority is introduced upstream later, Today must consume it rather than reproduce it.
- A declared period-end/reset event: absent. `dayStates` and existing Streak fields bound what can be shown; no synthetic `missedYesterday` state.
- Countdown end instant: not currently returned. It is safely derivable server-side from the existing IANA timezone only after implementation proves matching engine boundary behavior; otherwise countdown is omitted.

## 6. S5b intended experience composition and states

S5b assembles, in the Experience Reference order, a contextual greeting and governed day context; immediate required Streak actions; compact member-specific active Challenge progress/attention (including authoritative final-result links where currently relevant); explicit invitations only after their upstream inbox exists, with Group-contextual join opportunities supported now as a separate, clearly labelled opportunity; bounded upcoming lifecycle events; and, only after Group Feed authority exists, a few bounded community attention summaries that link to the Group Feed.

Initial S5 therefore displays no invitation section content, no community moments, no Recognition inferred from progress, no cause approval task, and no payment/support action. It may display Group-contextual Challenge opportunities under §4. Primary navigation remains Today / Challenges / Groups; Activity Guide stays contextual/secondary. Today rows route to authoritative Challenge detail, existing log action, existing join flow, Challenges, or Groups.

Intentional low-activity states:

- No active Challenges: greeting and an honest path to Challenges/Groups; no fabricated metrics.
- Active Challenges but nothing required today: quiet completion state or no action card; active progress remains useful.
- Group membership without Challenge participation: show only eligible contextual opportunities when available; otherwise point to Groups/Challenges.
- No Groups: honest Challenge/Groups discovery path; no invented community activity.
- Only upcoming Challenges: show bounded upcoming state and link to detail; no active progress or action card.
- Unsupported upstream sections: omit their content; do not simulate them or represent them as permanent exclusions from eventual Product Truth.

**Current form-factor authority (Founder clarification, 2026-10-03): TIIZI MEMBER / USER APPLICATION IS MOBILE ONLY.** Member Today is designed, assembled, and Founder-reviewed against mobile presentation. The member application has no desktop layout, desktop-responsive expansion, desktop-specific information architecture, or desktop Founder visual-acceptance requirement. The **Platform Operator Console is a distinct experience and requires desktop layout and desktop Founder review**. Do not transfer Operator Console requirements to the member app.

The earlier sentences in this paragraph that said desktop may widen the member content and that “S5b must be reviewed on mobile and desktop” are superseded by the Founder clarification recorded in §13. They are retained here as historical charter wording explaining the former A2 disposition; they are no longer current authority.

## 7. Preserved boundaries

- **Product Truth:** Stage F T1 §O remains intact, including Results/Milestones and developments/discovery as legitimate Home content. EA-01 controls experience assembly and precedence; this charter applies Founder dispositions, not a rewrite of T1.
- **Feed:** no Home Feed and no second community stream. Group Feed remains deferred for initial S5; do not reopen the Groups programme here.
- **Invitations:** no fabricated invitation inbox. Group-contextual opportunities remain a distinct, assessable capability.
- **Recognition:** distinct from Kudos and not inferred from progress.
- **Social Cause/support:** payment/support execution is absent (S8); Cause approval never gates ordinary participation and is not a routine Today task.
- **S9:** production scheduler remains absent. This charter creates no job, scheduler, lifecycle writer, or notification.
- **Empty states:** honest, useful, and free of filler content.
- **Privacy/integrity:** authenticated member scope; no roster or other member's activity/progress in Today; use current governed visibility and membership authorities; fail closed on required projection dependencies.

## 8. Programme disposition

At charter approval, Master Programme v2.21 advanced to **v2.22** to record the Founder dispositions and S5a boundary. Stage G remains Active. S1–S4 and S6 remain complete/accepted/merged. The following sequence records the state at charter approval and is historical; current status is in §12 and Master Programme v2.30. The current implementation state is now recorded in [S5a Today Member Projection 001](./TIIZI-S5A-TODAY-MEMBER-PROJECTION-001.md), and Master Programme v2.23 synchronized that candidate status:

1. **S5a — Today Member Projection / Read Model:** `GET /api/today`; implemented candidate awaiting Founder review; final implementation candidate commit `106579d854b98bba0b69c1590fa4f6f75c279a42` (runtime source was introduced in `b84451e1fe69b4e37334fc9d054792599f79b9bf`).
2. **S5b — Today Experience Assembly:** follows S5a; member-facing assembly; not started.
3. **S5c — Founder Preview / Acceptance:** follows S5b; not started at charter approval (historical).

S7 remains PF-06-gated and not begun. S8 payment/contribution execution remains absent and authority-gated. S9 production scheduler remains absent. S10 remains excluded pending commercial model. No S5b assembly, deployment, production access, or production mutation occurred.

## 9. Validation and publication record

- Documentation-only change: this charter and Master Programme only.
- Experience Reference inspected at `cfa696fbd09180c6fdaeaf14d2e8784d8b05d6a6`; requested reference doc, Today component, and assumptions register inspected.
- Product Truth was not rewritten; prototype values and mock behavior were not promoted to Product Truth.
- Group-contextual opportunities assessed separately from personalized recommendations and invitations.
- Explicit invitations remain deferred; Group Feed/community moments remain deferred for initial S5; no second Feed is authorized.
- S8 payment execution and S9 scheduler remain absent.
- `git diff --check` required before commit; worktree must be clean after commit.
- Primary checkout `/Volumes/PRODUCTION/Projects/tiizi_revamp` was not used for edits and requires separate reconciliation.
- Branch: `docs/tiizi-s5-today-readiness-001`; pull request target: current `origin/main`; do not merge.

## 10. Founder acceptance statements

*(Historical — the state recorded at charter approval. The current S5 position is recorded in §12.)*

**S5 TODAY EXPERIENCE:** FOUNDER DIRECTION RECONCILED WITH EXPERIENCE REFERENCE

**S5a TODAY MEMBER PROJECTION:** IMPLEMENTED CANDIDATE — AWAITING FOUNDER REVIEW

**S5b TODAY EXPERIENCE ASSEMBLY:** NOT STARTED

**MERGE STATUS:** NOT MERGED — AWAITING FOUNDER

## 11. S5a implementation record

Implementation status, exact field provenance, query composition, security boundary, validation, and candidate SHA are recorded in [TIIZI-S5A-TODAY-MEMBER-PROJECTION-001.md](./TIIZI-S5A-TODAY-MEMBER-PROJECTION-001.md). This record does not advance S5b, mark Today complete, alter Product Truth, or authorize deployment or production access.

## 12. S5c Founder Preview / Acceptance and S5 closure

**S5c Founder Preview / Acceptance is SATISFIED against the mobile-only member form factor. S5 is READY FOR FINAL CLOSURE, subject to Founder disposition and merge of PR #72.**

S5c introduced no new product implementation. Its purpose was the final Founder Preview /
Acceptance of the assembled S5 capability. The preview and correction cycle occurred during S5b and is merged. The earlier A2 disposition held S5 open because the then-current §6 required mobile and desktop review. The Founder clarification in §13 supersedes that requirement: desktop review was not performed and is not claimed, but it is NOT APPLICABLE to the mobile-only member experience. The existing mobile Founder review evidence satisfies S5c; no additional mobile S5 requirement remains unresolved.

The sequence recorded in §8 is complete; S5 is ready for final closure subject to Founder disposition and merge of PR #72:

1. **S5a — Today Member Projection / Read Model:** COMPLETE / FOUNDER ACCEPTED / MERGED.
2. **S5b — Today Experience Assembly:** COMPLETE / FOUNDER ACCEPTED / MERGED / CLOSED.
3. **S5c — Founder Preview / Acceptance:** SATISFIED — MOBILE FOUNDER PREVIEW ACCEPTED.

The §10 statements above are the historical state at charter approval and are preserved as
historical evidence. S5 is ready for final closure upon Founder disposition and merge of PR #72. Group Feed remains deferred and NOT IMPLEMENTED; V1 Pass 002 remains NOT
STARTED; S7, S8 payment/contribution execution, and the S9 production scheduler remain absent.
Deferred capabilities are NOT completed by this closure. See
[TIIZI-S5C-FOUNDER-PREVIEW-ACCEPTANCE-001.md](./TIIZI-S5C-FOUNDER-PREVIEW-ACCEPTANCE-001.md).


## 13. Founder form-factor clarification and supersession (2026-10-03)

**Authoritative rule:** **TIIZI MEMBER / USER APPLICATION = MOBILE. TIIZI PLATFORM OPERATOR CONSOLE = DESKTOP.**

The Founder clarified that the member application does not require desktop layout, desktop-responsive expansion, desktop information architecture, desktop visual acceptance, or widening at large browser widths. The mobile-oriented bounded member surface is not a defect merely because it appears narrow in a desktop browser. Future member experience work is designed and Founder-reviewed against mobile presentation.

The Platform Operator Console is separate: it requires desktop layout and desktop Founder review. This requirement does not apply to the member app.

This clarification explicitly supersedes the earlier §6 sentence “S5b must be reviewed on mobile and desktop” and the permission that desktop may widen member content. Those statements remain preserved as historical wording, but are no longer current authority. Desktop visual review was not performed and is not claimed; it is **NOT APPLICABLE / SUPERSEDED**, not SATISFIED.
