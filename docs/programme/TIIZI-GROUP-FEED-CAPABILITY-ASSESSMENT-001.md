# TIIZI — GROUP FEED CAPABILITY & AUTHORITY ASSESSMENT 001

**Assessment date:** 2026-10-04  
**Assessed base:** `d71994ffb92c98da986a1205b47febbeff4df484` (`origin/main`; post-S5 close)  
**Master Programme:** v2.31  
**Disposition:** **GROUP FEED — ASSESSED, NOT IMPLEMENTED. STOP FOR FOUNDER REVIEW.**  
**Scope:** Assessment and recommended programme only. This document does not authorize implementation.

## 1. Executive assessment

Stage F Product Truth already establishes the broad Group Feed contract: one Group community stream; no separate Home Feed; meaningful Group/Challenge state events may be automatically published only when governance identifies them as eligible; personal Activity, milestones and Recognition require explicit Share; routine personal Activity logging is not broadcast; Feed display is never truth; initial V2 has no comments or reply threads. These are settled in the Founder-approved Stage F package (`STAGE-F-FAD-01`, T1/T2, T2 §21–22, FR-V2-128–134 and FR-V2-212; filenames retaining “DRAFT” do not change approval status).

What Stage F does not provide is an event allow-list, concrete publication and disclosure rules, audience/history semantics, retention/correction policy, or Feed storage/read contracts. Product Truth is therefore **partially specified, not implementation-ready**. Current Group, Challenge, activity, derived-state, finalization and Today authorities provide candidate source facts, but their existence does not authorize their publication.

At the assessed commit there is no active V2 Feed endpoint, store, table, query key, hook or screen section. Group Home deliberately has no Feed. No V2 Kudo implementation or Kudo table exists. The recommended path is to obtain the missing Founder/Product Truth dispositions and a versioned event contract first, then implement a PostgreSQL transactionally published outbox/Feed projection, followed by a separately authorized member read model and mobile assembly. Kudos must be separately scoped and authorized before any control or counter is shipped.

## 2. Evidence basis and boundary

Evidence was taken from the canonical programme and experience authorities, current V2 runtime and migrations at the assessed commit, and the frozen Experience Reference at `Fkenogo/tiizi-prototye@cfa696fbd09180c6fdaeaf14d2e8784d8b05d6a6`. The fetched `origin/main` still equals the requested canonical SHA. The standalone Product Truth source filenames are cited as stored; their approval is established by Stage F Founder decision `STAGE-F-FAD-01` and Master Programme v2.31.

**Authority order used:** Founder-approved Product Truth and governance; current V2 PostgreSQL/domain authority; accepted S4/S5 experience records; adopted prototype for presentation only. Prototype mock data, UI state and handlers do not establish event eligibility, persistence, consent, audience, privacy, Kudo semantics, or backend truth.

**V1 exclusion:** Archived V1 Feed behavior is frozen, non-authoritative, and excluded from V2 Feed design and implementation by `AGENTS.md` §§1–3. Do not inspect or use V1 Feed material as inspiration, precedent, compatibility, migration, fallback, or a source of missing Product Truth. Its physical presence creates no V2 authority.

## 3. Current V2 Group and adjacent capabilities

The active V2 architecture requires PostgreSQL as the sole authority for Group, membership, Group-scoped Challenge, participation, activity application and Knowledge (`AGENTS.md` §1.2–2). Firebase Auth supplies identity only. API routes are in `/api/*`, registered through the canonical prefix; `/v1/*` must not be reintroduced.

Current authorities relevant to a future Feed:

| Truth/capability | Active authority at base | What it can truthfully establish | Feed status |
|---|---|---|---|
| Group identity, privacy/discoverability, settings, steward | PostgreSQL `groups`; migrations 001, 018–022; Group authority/read APIs | Group existence/state, privacy, single Accountable Steward, governed settings | Candidate context only |
| Membership | PostgreSQL `group_memberships`; migrations 001, 019 | `active`/`joined`, `pending`, `rejected`, `left`; one relationship per Group/member; steward is also an active member | Can authorize a read boundary; join/leave state is not itself auto-publish authorization |
| Group Home | `GET /api/groups/:groupId`, Group detail/roster/pending APIs; `src/v2/groups/V2GroupHomeScreen.tsx` | Server-derived viewer relationship, bounded Group detail, hosted Challenges, roster and pending applications | No Feed; pending applicants receive a limited discoverable/pending projection, not member content |
| Challenge identity/lifecycle/configuration | PostgreSQL `challenges`, migration 004 and later lifecycle/config migrations; Challenge read/lifecycle routes | Group-hosted Challenge, current lifecycle and immutable identity/configuration history | Candidate state source; event policy still required |
| Participation | PostgreSQL `challenge_participations`; governed join/withdraw APIs | Explicit member participation episodes, subject to current Group membership and Challenge eligibility | Candidate; does not imply publication |
| Submitted / accepted Activity | `member_activity_events`, `activity_submission_intents`, `challenge_activity_records`; migrations 003, 005, 010; `challengeActivityApplication.ts` | Member Activity facts, eligibility/acceptance decision and applied Challenge records | Routine log/accepted Activity must not auto-publish (FR-V2-129, 212) |
| Streak / Together / Race derived state | `challenge_participation_derived`, `challenge_derived_state`; engine modules and read APIs | Authoritative current type-specific progress and milestones; Streak day truth; Together totals/contributions; Race progress | Candidate inputs only; avoid detail/ranking/socialization without event-specific policy |
| Finalized outcomes | `challenge_finalizations`, `challenge_participation_finals`; migration 012 and `challengeFinalization.ts` | Frozen Challenge and per-participant outcomes/results | Candidate event trigger; Feed must not calculate, restate or become result authority |
| Community Cause | Challenge support/cause configuration and operator approval authorities (migrations 022–024); `TIIZI-CHALLENGE-CONTRIBUTION-RECON-001` | Governed configuration and approval; not a general donation or verified contribution ledger | Any acknowledgement remains optional, privacy-sensitive and separately gated |
| Platform Recognition | Product Truth EOG §§33–36; MOT-01 remains deferred; no active Recognition authority | No current issuable/readable V2 Recognition truth | No event until MOT-01 and Recognition capability exist |
| Group Feed / event publication | None | No Feed events, projection, or Feed authority | **Not implemented** |
| Kudo | Stage F concept only; no active V2 persistence/API/UI | No Kudo state or count authority | **Not implemented** |

The repository has 24 active PostgreSQL migrations through 024. None defines a Group Feed, publication outbox, Feed projection, or Kudo table. There is no active Feed API route, V2 client API/hook/query key, or Group Home Feed presentation. Today explicitly marks community moments unavailable/deferred (`api/src/today.ts`, `src/v2/today/V2TodayScreen.tsx`, `todayView.ts`).

### Current Group audience facts

Current membership status vocabulary is `active`/`joined`, `pending`, `rejected`, `left`; there is no `former` state. Only active/joined membership is current membership. Group reads distinguish `steward`, `member`, `pending`, and non-member/discoverable viewer relationships. The steward is one Accountable Steward, not a separate broad-read audience. Pending applicants can see a constrained state sufficient to understand that an application is pending, but are not active members and are excluded from the roster/member-only Challenge experience. A discoverable Group exposes only its approved minimum pre-membership projection. Private Groups are indistinguishable from unknown Groups to non-members (404 posture).

These facts strongly support current-member-only Feed reads as the safe default. They do not settle the treatment of old events after leaving, Group privacy changes, source restrictions, or lawful deletion/correction. EOG §7 says departure/removal is prospective and does not by itself erase historical attribution; EOG §§8, 39 also make clear that preservation does not grant public or unrestricted visibility. Consequently, historical preservation cannot be translated into former-member access without a Founder decision.

## 4. S4/S5 and current Group experience

`src/v2/groups/V2GroupHomeScreen.tsx` explicitly states “no Feed” and presents the accepted Group composition: Group context/identity, hosted Challenges, Members/Stewardship, About/settings and governed pending applications. The API hooks/read models (`useV2Groups`, Group detail, Challenge list, roster and pending applications) likewise have no Feed seam. This is an intentional omission, consistent with S4's Feed deferral and S5's accepted closure, not a hidden V2 Feed.

S4 Group Home established a mobile-first, compact composition and current Group truth. S5 is COMPLETE / FOUNDER ACCEPTED / CLOSED at Master Programme v2.31. S5C expressly deferred community moments until an authoritative Group Feed exists and says Today is never a second stream. The future Feed should therefore be an additive Group-context surface, with the current Group identity, Challenge, member and steward authorities preserved. The exact Group Home placement was not settled by S4/S5 and needs Founder confirmation during experience assembly. A reasonable proposal is one compact “Group activity” section in the current member Group Home, after the hosted-Challenges summary and before the roster/About detail, with a “View all activity” action opening the same Group Feed. This is a proposal, not accepted Product Truth; it must not reorder or replace existing Group Home capabilities without review.

## 5. Experience Reference (experience authority only)

The adopted reference commit is verified at the exact SHA requested. Its own documentation says it governs human-facing assembly, while Product Truth governs engines. Relevant findings:

- `GroupDetailView.tsx` assembles Group identity and Challenges/Members/About tabs. It accepts `moments` and `onKudoMoment` props, but the inspected component does not render a Feed tab or moments list. The prototype therefore offers a feed-like concept more clearly in Today than in this Group detail implementation.
- `CommunityMoment` in `src/types.ts` is a mock presentation type (`type`, actor fields, Challenge identifiers/context, headline/detail/timestamp, kudos count/current-user flag); it is not a contract or backend schema.
- `mockData.ts` includes collective target progress, tied Race finish and Streak milestone mock cards, and Today renders the latest few “Community Accountability Feed” items with Challenge context and a Kudo counter. Mock text includes detailed distance, rank/timing and activity information that must not be copied without an authorized disclosure policy.
- `KudoButton.tsx` toggles local state and count in memory; it has no persistence, authorization, idempotency, abuse protection or canonical count. Its toggle behavior is a visual hypothesis only.
- The reference's Today priority order includes community moments, but S5C explicitly adapts this to a bounded summary sourced from the one authoritative Group Feed and linking to it. The reference's prototype feed, peer Activity details and Today Kudo controls are not adopted as V2 backend or privacy truth.

## 6. Proposed single Group Feed contract

**Settled:** there is one authoritative community stream per Group; no second Challenge or Home Feed (T2 §21 / FR-V2-128). Its purpose is a bounded, readable presentation of a small allow-list of meaningful Group/Challenge state events plus explicit Member-to-Group Shares (FR-V2-129, FR-V2-212). The Feed is presentation, never the authority for Activity, Challenge progress, Derived Truth, rankings, Streak, results, Recognition, participation or payments (FR-V2-130, 132; EOG and Group Domain Standard).

**Recommended audience:** only a viewer who is currently an active/joined member of that Group, including the Accountable Steward in their capacity as a member. A steward role does not broaden reading rights. Pending applicants, rejected applicants, left/former members and non-members—including authenticated users who can discover a public Group—do not read the Feed. Public/discoverable status authorizes only its existing minimum discovery projection, never the Group activity stream. This is the privacy-preserving recommendation under EOG §§7–9, 30, 39 and FR-V2-016–020, 182–186; Founder approval is required because Feed-specific audience rules are not explicit.

**Open history questions:** current-member-only access is recommended immediately on every read, so leaving revokes access to all Feed history by default. Whether a former member may retain a bounded historical view, whether historical event cards survive within the Group for current members after membership changes, and whether membership at event-time changes attribution must be explicitly decided. Recommend retaining event-time attribution for eligible historical acts while access remains current-member scoped. Do not infer an unlimited permanent archive from EOG historical-intelligibility rules.

**Ordering and pagination:** use server-assigned publication timestamps and deterministic tie-break/monotonic per-Group sequence; newest first. Never accept client timestamps or order values. Keyset pagination over stable server fields (not offsets) with a signed or integrity-protected opaque cursor bound to Group, direction, version and last key; reject tampered/cross-Group cursors. Page size should be bounded and set in GF-01. Do not reorder cards to amplify popularity or Kudo count.

**Retention / correction:** Product Truth does not set Feed retention, archival, deletion, correction or export rules. Founder decision required. Recommended default is a bounded retention window and no permanent copied activity payload. Keep only the minimum event summary and upstream identifiers needed for its declared purpose; make eligibility/visibility re-checkable. Source facts remain with their own authorities. If source truth is restricted, deleted or corrected, suppress or replace the Feed representation through a traceable correction/tombstone while retaining only what governance permits. Never silently rewrite historical truth (FR-V2-180/181; EOG §§38–39). Define source deletion and privacy obligations before selecting immutable vs erasable fields.

**Data model:** do not treat UI cards as Product Truth. Recommended model is an append-only, bounded publication record/outbox plus a rebuildable Feed read projection. The Feed record is a projection of an authorized publication decision, not a new domain fact; keep source references, event type/version, Group scope, authoritative server ordering, attribution reference, minimal approved presentation fields, visibility/withdrawal state and idempotency key. It must contain no raw activity submission, note, evidence, provider identity, unrestricted profile data, or client-authored event truth. Projection updates/corrections are traceable and cannot alter source truth.

## 7. Candidate event-source matrix

Legend: **Exists** means an authoritative V2 fact exists (not that Feed publication exists). **Safe** is the current assessment of automatic publication absent a new event-specific policy. **Requires PT** identifies the gap to close. **Publish seam** is a recommendation only.

| Candidate | A. Current authoritative source | B. Safe/appropriate to publish now? | C. Additional Product Truth | D. Privacy | E. Duplicate/noise | F. Member-facing category (if authorized) | G. Proposed seam |
|---|---|---|---|---|---|---|---|
| Member joins Group | PostgreSQL membership transition | Not automatically authorized; meaningful relationship change is a possible allow-list event | Confirm Group join/approval events eligible; whether member notice/consent; no personal invitation disclosure | Identifies membership; private Group membership is sensitive | Rejoin/approval retries may duplicate | “A member joined [Group]” | Mutation-time outbox in same PG transaction, deduped by transition ID |
| Challenge created in Group | PostgreSQL Challenge establishment | Candidate, not approved allow-list | Confirm creation event eligible; visibility if Challenge itself is restricted; creator attribution | Group/Challenge access can be narrower than Group membership | Draft/activation/retry duplicate risk | “[Challenge] is available in [Group]” | Domain event/outbox at accepted establishment/activation boundary |
| Member joins Challenge | PostgreSQL participation episode | Do not auto-publish by default; personal participation is not Group membership | Decide whether explicit Share is required or join is an eligible meaningful state event; cover rejoin/withdraw | Reveals personal commitments | Join/withdraw/rejoin churn | “A member joined [Challenge]” only if expressly authorized | Transactional event at accepted participation transition; idempotent per episode |
| Accepted Activity logged/applied | Accepted event + submission intent + Challenge activity record | **No routine auto-publication** (settled FR-V2-129/212) | Explicit Share flow and payload/redaction policy before any sharing | Value, activity, note, time and health-adjacent behavior may be sensitive | Very high volume and correction/supersession duplication | No automatic card; explicitly shared bounded summary only | Separate explicit-share command; reference accepted truth, never raw submission |
| Streak day completed | Streak-derived day state | Not automatically authorized | Decide whether a day completion is eligible, shareable, and which copy conveys it without exposing missed/private days | Daily routine and health behavior | One per member/day; engine recompute/replay duplication | “Completed today’s Challenge commitment” only if approved | Derived-state transition event, emitted once per Challenge/member/day |
| Streak milestone | Streak-derived state | Candidate only; not automatic until eligible event policy says so | Define milestone thresholds and whether explicit Share is required (FR-212 covers personal milestones) | Reveals sustained routine | Threshold/rebuild duplicate; possible notification/feed duplication | “Reached a [N]-day milestone” without activity detail | Outbox on first authoritative threshold crossing; uniqueness key |
| Together contribution/progress | Accepted records and collective derived total/contributors | No per-log auto-post; aggregate threshold may be eligible only after policy | Define eligible aggregate thresholds, participant visibility and whether member-specific contribution requires Share | Can expose individual amount, schedule, capability | Frequent, monotonic increments cause noise | “Group reached [approved progress milestone]” (no per-person amount by default) | Derived threshold crossing event, once per Challenge/version/threshold |
| Together milestone | Collective derived state/completion | Candidate Group state event, not approved allow-list | Define milestones, overshoot and completion timing/copy; no implied award | Low-to-moderate Group-level disclosure; member contributions can leak | Milestone/complete overlap and retries | “Group reached [goal/milestone]” | Domain event when canonical derived transition crosses approved threshold |
| Race activity/progress | Accepted records and competitive derived reads | **Do not publish continuous progress or ranks by default** | Decide whether finish events may be shared; prohibit unauthorized live rank/activity-detail broadcasting | Exposes behavior and comparative ranking | Every log noisy; rank changes churn | None pending policy; perhaps final finish announcement only if separately approved | Only event from authoritative qualifying result, with minimal redacted fields |
| Challenge starts | Challenge lifecycle state | Candidate meaningful state event; confirm allow-list | Decide start-time and eligible audience, scheduled activation semantics | Low if viewer is current member and Challenge visible | Scheduled processor retries/late starts | “[Challenge] has started” | Lifecycle domain event/outbox on actual active transition |
| Challenge ends/completes/finalizes | Lifecycle/finalization authority | Candidate event, but “completed” must not imply every participant succeeded | Define end vs finalized distinction, event wording, source visibility | May expose outcome availability | Ended-unfinalized and finalized are distinct; duplicate scheduled run | “[Challenge] has ended; results are available” only after approved boundary | Outbox on immutable finalization record; unique per finalization |
| Challenge result / member result | Frozen finalization and participant finals | Do not auto-publish individual result/rank absent explicit authorization | Settle result visibility, finishers/non-finishers, ties, Challenge/member privacy | High; exposes individual outcome and comparative position | Result rebuild/retry; correction has high impact | No result card pending policy; deep link may be allowed after review | Minimal event referencing final authority; query current visibility on read |
| Governed Platform Recognition | No current MOT-01 Recognition authority | **Not publishable today** | MOT-01 qualification/issuance/withdrawal; Share vs automatic disclosure; Recognition visibility | Personal distinction and policy basis | Reissue/withdrawal, reward confusion | No Feed event until capability and policy exist | Future Recognition domain event only after MOT-01 |
| Group governance/stewardship change | PostgreSQL Group/steward/membership transitions | Candidate only for material, member-relevant changes | Define event list, decision attribution, whether routine administration is private | Can disclose applicant/removed-member details and steward activity | Configuration updates can flood stream | “[Group] stewardship updated” without private actor detail, if approved | Same transaction as governed mutation; explicit event taxonomy |
| Cause contribution/support | Cause configuration/decision and contribution domain as separately authorized | Not currently safe: approval/configuration is not proof of contribution; no broad contribution ledger | Confirm what a contribution fact means, who can see it, consent, amount anonymity, custody boundary (RECON-001/EOG §36) | Financial/cause preference is highly sensitive | External claims, repeated pledges or corrections | No amount or contributor identity by default; possible generic cause-support acknowledgment only after approval | Separate approved contribution event source; never infer from support configuration |

Across all rows, publication must be triggered by authoritative server/domain transitions—not client interpretation or “whatever changed” polling. Duplicate prevention needs unique source transition/event identity plus an idempotency constraint. Automatic publication requires an explicit allow-list under the Stage F “eligible” rule; anything unlisted is omitted. Explicit Share requires its own consent, redaction, visibility and withdrawal contract; FR-V2-212 does not itself provide an implemented Share feature.

## 8. Kudo and Recognition

**Current V2 Kudo status:** the active V2 runtime has no Kudo write/read route, service, hook, persistence, counter, policy or UI. Migrations 001–024 contain no Kudo table. Kudo is therefore **not implemented**. This is distinct from the fact that Stage F Product Truth recognizes lightweight Kudos conceptually: FR-V2-131 says Members SHOULD be able to provide encouragement; FR-V2-132 prohibits any effect on performance; FR-V2-134 keeps Kudos/reactions outside evidence, governance and calculation. EOG §36 and T1 §Q retain the community-acknowledgement concept. These do not settle the operational contract.

Still unresolved for a V2 Kudo capability: who may Kudo (recommend current Group Members only); what entity may receive one (recommend an eligible Feed event only, not arbitrary Member/profile/Activity); one active Kudo per actor/item versus repeatable; toggle/undo and withdrawal; whether counts or identities are visible; how deleted/restricted Feed items affect Kudos; privacy of Kudo giver/recipient; idempotency and race-safe count authority; abuse/rate limits, moderation, audit and account deletion. These need a separate Product Truth/authorization slice. Do not infer them from prototype `KudoButton.tsx` local toggle/count or the term “feed counters.” No Kudo implementation is authorized here.

**Recognition remains separate.** Platform Recognition is a policy-qualified platform record derived from governed truth, not a peer reaction. MOT-01 governs Recognition and remains deferred. Kudos is not an award, result, eligibility signal or evidence; Recognition cannot be issued from Kudos or automatically created by a Feed card. A Feed may display a Recognition only after an authoritative Recognition capability exists and its own visibility/consent contract approves publication.

## 9. Today relationship

S5C (Founder accepted and closed in Master Programme v2.31) intentionally defers community moments until an authoritative Group Feed exists. Future seam: **Group Feed authority/read API → a bounded member-specific Today community summary**. Today reads a small number of already-authorized Feed items (or a dedicated projection derived strictly from that same Feed), scoped to Groups where the member is currently eligible, and links each summary to the corresponding Group Feed. It must not maintain another event store, publish its own events, own Kudo state/counts, independently reinterpret source events, or expose anything the Group Feed reader would deny. Today stays an action home, not a second chronological stream. No Today or S5 modification is part of this assessment.

## 10. Security, privacy and integrity requirements

The following are required design constraints for a future authorized slice; implementation details are for the later contract:

- **Tenant/group isolation:** every row, query, cache key, cursor and source reference is bound to one Group UUID; server derives Group scope and member identity from authenticated PostgreSQL authority. Cross-Group identifiers/cursors fail closed.
- **Read membership check:** check current active/joined relationship on every page/read, not just at Group entry or in a stale client cache. Stewardship confers no Feed bypass. Pending, rejected, left and unknown viewers receive no Feed. Public/discoverable visibility does not mean public Feed access.
- **No cross-member data leak:** per-item disclosure is separate from Group membership. Do not expose raw activity values, notes, evidence, health-like detail, timestamps precise enough to infer sensitive routines, profile/avatar fields not otherwise authorized, participant lists, private participation, or results/ranks by default.
- **Source restriction/correction:** keep only minimal presentation data, re-check source and Group visibility, and suppress/redact when no longer visible. Preserve traceability within governance; do not copy protected source data into an immutable permanent card. Decide withdrawal and correction handling before publication.
- **Trusted publication:** reject client-created event records, client-chosen actor/member IDs, event timestamps, event types and counters. Use server-only mutation/domain events from the authoritative PostgreSQL transaction or trusted outbox worker. Never generate from client-side interpretation.
- **Idempotency and ordering:** unique event/source transition key; retry-safe publisher; monotonic server-owned ordering; no client backdating or popularity sort. Challenge transitions need explicit event identity and transition/version scope to prevent duplicate join/start/finalization events.
- **Cursor integrity:** opaque authenticated cursor bound to Group, order/version and keyset; bounded page size; stable tie-break; reject cross-tenant, tampered, stale-version or inconsistent cursors.
- **Moderation and deletion:** current Product Truth does not define Feed moderation/reporting or event removal authority. Determine an authorized correction/takedown path and audit trail before implementation. No client free-text means no free-post moderation surface, but event privacy and source correction still require governance.
- **Upstream integrity:** Feed presentation never becomes Product Truth for participation, Accepted Activity, progress, ranking, Streak, completion, results, Recognition or financial contribution. All values and links remain subordinate to those upstream authorities.

## 11. Persistence/publication architecture options

| Option | Correctness/privacy/idempotency | Ordering/query/coupling | Rebuild/failure/Today/PostgreSQL fit |
|---|---|---|---|
| **A. Dynamic query of domain tables** | Rechecks truth naturally, but each event family needs bespoke disclosure logic; easy to expose raw records or inconsistent meanings; retries less relevant but duplicate rows/joins possible | High multi-table query cost, broad coupling to engine schema, difficult stable unified ordering/cursor and bounded pagination | No durable publication decision/audit; replay is query recomputation; source schema changes alter Feed; Today would duplicate complex query logic. Poor fit for “eligible events” policy. |
| **B. Write immutable Feed events directly in each domain action** | Can be atomic if every writer shares the same transaction; strong dedupe possible; risks event payload retaining restricted data and every mutation encoding product copy/privacy | Efficient Feed query/order; tight coupling of domain actions to Feed taxonomy/presentation; multiple producers drift | PostgreSQL fit only if all writes share transactions; partial failure or non-transactional job paths can lose events; rebuild requires rescanning source history, which may not preserve original publication decision. |
| **C. Transactional domain outbox → Feed projection** | Strongest fit: authoritative action and outbox commit atomically; outbox policy filters eligible transitions; idempotent projector/dedupe; projection can re-check visibility and minimize payload | One bounded Group-scoped read index and keyset cursor; moderate coupling through a versioned domain-event contract, not card code | PostgreSQL-native; replay/rebuild projection from retained authorized outbox/source references; explicit retry/dead-letter/lag visibility. Today consumes the same read seam. Must define transaction support on every producer and deletion/retention behavior. |
| **D. Hybrid: transactional source event + relational Feed projection/read model** | Combines atomic source publication decision with independently maintainable redacted card projection; current eligibility can gate reads | Query is simple; taxonomy is versioned; projection worker introduces eventual-consistency delay and operational requirements | Recommended form of C. Rebuildable projection if event/outbox retention and source visibility remain adequate; publish lag/failure must be observable and must not affect domain truth. |

**Recommendation:** D/C hybrid using PostgreSQL transactional outbox publication decisions and a separately materialized, bounded Group Feed projection. For a domain mutation already transactional in PostgreSQL, persist its outbox row in that same transaction only after the event contract marks that transition eligible. A projector writes the read model idempotently using a stable source-transition key. At read time, current Group membership and current visibility remain authoritative. Keep the event envelope small, versioned and privacy-minimized; no raw activity payload. If a source action cannot atomically write the outbox, it needs a reliable equivalent (or remains ineligible); do not use best-effort client/API dual writes. Feed projection lag/failure is a presentation concern and cannot roll back Accepted Activity, progress or results.

## 12. Recommended mobile Group experience

Mobile member experience only. Within the already accepted Group Home, present a compact “Group activity” section using a shared event-card hierarchy: one-line member/Group identity using only approved identity projection; plain-language event title; optional approved Challenge context as a navigable label; server-derived relative timestamp with accessible absolute time; and a small, factual subtitle only when the event contract permits it. Group identity events and Challenge state events should be visually distinguishable without awards/leaderboard styling. Link the card to authoritative Group/Challenge detail or finalized-result context; never duplicate progress/result calculations in the card.

Use an explicit “View all activity” route/panel for keyset-paginated Feed pages and progressive disclosure; no unbounded list or automatic infinite prefetch across Groups. Empty state should state that no Group activity is available yet, without synthetic samples, prompts to post, fabricated milestones or implying no members participate. Loading, stale cursor, deleted/restricted source and unavailable states should fail closed and remain understandable. Pending viewers should see the existing pending application state only, not a Feed preview. Stewards see the same Feed/read audience as members.

Kudo affordance is omitted unless the separately authorized Kudo capability supplies a real server count/current-viewer state and governed action. The reference's Kudo button is not sufficient authority. Comments, replies, composer/free-form posts, arbitrary reactions, bookmarking, media uploads and member-to-member sharing are not part of this initial Feed contract; explicit Share-to-Group may be a distinct future capability under FR-V2-212 only after its own authorization and privacy design.

## 13. Missing decisions requiring Founder/Product Truth

1. Versioned automatic event allow-list: exact event families and transition boundaries; which require explicit Share; whether join, Challenge creation/start/end, threshold milestones, finalization, steward changes and cause acknowledgements are eligible.
2. Per-event presentation contract: allowed identity, data fields, precision, wording and deep-link targets; treatment of Challenge privacy, personal participation, results and Rank.
3. Audience/history policy: current-member-only recommendation; pending/public/discoverable denial; effect of leaving/removal; Group or Challenge becoming private; whether current members keep old cards; treatment of event actor whose account/membership disappears.
4. Retention period, archive behavior, export/deletion obligations, source deletion/restriction and correction/tombstone semantics.
5. Ordering and pagination contract: publication vs source-occurrence time, late events, page bounds, tie-break, cursor version/expiry and behavior after retention or deletion.
6. Explicit Share-to-Group authority: consent/revocation, eligible source data, redaction and whether/how a shared item is removed. FR-V2-212 requires explicit action but does not implement it.
7. Kudo operations: eligible recipient, membership audience, one-vs-repeatable, undo, count and identity visibility, idempotency, abuse/rate limits, moderation and deletion semantics.
8. Feed moderation/takedown authority and operational accountability. No comments/posts are proposed, but event correction remains necessary.
9. Today summary bound: count/window and interaction/link behavior; must consume the single Feed authority/read seam.
10. Exact additive placement in Group Home, to preserve S4 composition and avoid silent redesign.

## 14. Smallest correct programme sequence

Identifiers below are **proposed for Founder disposition**, not adopted programme state. These should remain separate enough to permit review at each authority boundary:

| Proposed slice | Outcome | Separation/dependency |
|---|---|---|
| **GF-01 — Product Truth and Event Contract** | Founder-approved audience, event allow-list, source transition identity, card fields/wording, Share disposition, visibility/history, correction, retention, ordering/pagination and moderation decisions | First and required. Documentation/authority only. Explicitly exclude Kudo details that require a separate decision. |
| **GF-02 — PostgreSQL publication authority** | Migration/domain transaction outbox, event contract validation, stable dedupe/idempotency and publisher/projection failure policy | Only after GF-01. Keep separate from client/UI. Source actions only publish contracted events. |
| **GF-03 — Group Feed read model/API** | Member-scoped Group read, event projection/query/cursor, source-visibility suppression, pagination, cache/query contract | Can share code branch with GF-02 only if persistence/API remains one reviewable vertical slice and product contract is frozen. Requires its own security review. |
| **GF-04 — Mobile Group Feed assembly** | Additive mobile Group Home entry/section, cards, loading/empty/error and pagination/navigation | After GF-03. Preserve S4/S5, no Today yet. Founder preview/acceptance is a distinct gate. |
| **GF-K — Kudo Product Truth and capability** | Separately decide recipient, audience, persistence, toggle/undo, counter/privacy/idempotency/abuse/moderation | Separate authorization. Not a prerequisite to a useful Feed and must not block GF-01–04 unless Founder wants it in first release. |
| **GF-05 — Kudo persistence/API/UI (conditional)** | Implement governed Kudo action/count and mobile affordance | Only after GF-K and a Founder authorization; never bundled implicitly into Feed cards. |
| **GF-06 — Founder preview and acceptance** | Review actual mobile Group Feed and authorized event/privacy behavior | Required before closure; no merge/deploy inferred from assessment. |
| **GF-07 — Today bounded community summary** | Small member-specific summary sourced from GF-03's authoritative Feed read seam | Only after GF-06 acceptance; separate S5 follow-up, no second stream/store/authority. |

Do not start S7/S8/S9 under this assessment. Do not implement any proposed slice from this document alone; each slice requires its own Founder-authorized task.

## 15. V1 exclusion

**V1 exclusion:** Archived V1 Feed behavior is frozen, non-authoritative, and excluded from V2 Feed design and implementation by `AGENTS.md` §§1–3. Do not inspect or use V1 Feed material as inspiration, precedent, compatibility, migration, fallback, or a source of missing Product Truth. Its physical presence creates no V2 authority.

## 16. Programme, implementation and review disposition

- **Master Programme impact:** this assessment remains the analytical record; Master Programme v2.32 records the later Founder-approved GF-01 status. The effective Product Truth and implementation boundary are in `docs/product-truth/TIIZI-GF-01-GROUP-FEED-EVENT-CONTRACT.md`. GF-02 remains unauthorized.
- **Assessment provenance:** the original assessment changed only this assessment record. The subsequent GF-01 disposition adds the effective contract and the minimal Master Programme update; see the PR change set.
- **Product implementation:** none. No UI, API, route, hook, service, migration, table, schema, policy, guard, test fixture or Today behavior was changed.
- **Deployment:** none.
- **Dirty primary checkout:** untouched. Work occurred in a separate clean documentation worktree based on the assessment branch. The separate GF-01 draft worktree was read as a draft source and remains unmodified.
- **Fetch/base:** `git fetch origin --prune` completed; fetched `origin/main` is `d71994ffb92c98da986a1205b47febbeff4df484`, with no advancement.
- **Branch/head:** recorded in the PR and final implementation report.
- **PR:** existing documentation-only PR #74 is updated for Founder review; do not merge.

## Final status

**GROUP FEED:** GF-01 PRODUCT TRUTH APPROVED / EFFECTIVE — IMPLEMENTATION NOT STARTED
**KUDOS:** CONCEPTUALLY PRESENT IN V2 PRODUCT TRUTH; NO ACTIVE V2 CAPABILITY — IMPLEMENTATION/OPERATIONS REQUIRE SEPARATE AUTHORIZATION  
**TODAY COMMUNITY SUMMARY:** DEFERRED PENDING GROUP FEED  
**V1 FEED:** FROZEN / NON-AUTHORITATIVE / EXCLUDED FROM V2 BY `AGENTS.md`
**IMPLEMENTATION:** NOT STARTED  
**STOP FOR FOUNDER REVIEW.**
