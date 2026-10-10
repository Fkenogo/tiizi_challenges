# TIIZI — MEMBER COMPLETION FOUNDER DISPOSITION 001 (REVISED)

**Date:** 2026-10-10
**Base:** `365c958bf69f6d79ae262e81045abae9c777c19c` (canonical `main`); Master Programme 2.50 → **2.51**
**Basis:** `docs/programme/TIIZI-MEMBER-COMPLETION-ASSESSMENT-001.md` (commit `0ee5da0`)
**Companion records:** `docs/product-truth/TIIZI-CF-01-CHALLENGE-FEED-PRODUCT-TRUTH.md`; `docs/programme/TIIZI-MEDIA-CAPABILITY-ASSESSMENT-001.md`
**Status:** **REVISED / MEDIA PRE-PILOT / CHALLENGE FEED AUTHORIZED IN PRINCIPLE / AWAITING FOUNDER REVIEW.**
**Nature:** Documentation, Product Truth and programme alignment only. **No implementation is authorized by this record.** Each work package below still needs its own Founder authorization.

## 1. How to read this record

Two kinds of statement appear below and are kept apart on purpose:

- **FOUNDER DIRECTION (effective):** what the Founder instructed in the 2026-10-10 revised disposition. These are recorded as given.
- **RECOMMENDATION (proposed):** my detailed proposals (taxonomies, event matrices, work packages). They are **not** Product Truth until the Founder accepts them. Where something is a recommendation it is labelled so.

## 2. Superseded Founder decisions

| Item | Previous position (from Assessment 001) | Now |
|---|---|---|
| FD-MC-07 | Profile media deferred until after pilot; pilot uses initials | **SUPERSEDED.** Media is required before pilot |
| FD-MC-09 | "No Challenge-specific Feed" (FR-V2-128 / F-E-01) left in force; Challenge Feed last, behind a decision | **SUPERSEDED / REOPENED.** Tiizi will have a Challenge-specific Feed; it is a pre-pilot capability |
| FD-MC-04 | Interests/goals not collected at onboarding until a consumer exists | **SUPERSEDED.** Interests and goals are required onboarding components |
| Assessment §D.2 / §C.8 | Challenge Feed placed last; "none for pilot" | **SUPERSEDED.** Sequencing is re-planned in §10 |
| Assessment §B.3 | Onboarding purely progressive / non-blocking, no interests/goals | **REVISED** (§6). Still no V1 gate, but a bounded interests/goals step is now part of onboarding |
| Assessment §A.9 | Pilot Profile without photo | **REVISED** (§5). Profile image is in scope |

Historical records are preserved. They are annotated, not erased.

## 3. New effective Founder decisions

| ID | Decision (as directed) |
|---|---|
| FD-MC-01 | **Approved with bounded implementation.** Explicit, bounded, idempotent V2 member bootstrap. No generic provisioning on arbitrary authenticated API requests. MC-1 remains the first technical blocker |
| FD-MC-02 | **Pilot Profile required** (not a placeholder): display name; email to self; profile image; own Group/Challenge summary; edit allowed fields; sign out; Terms; Privacy; appropriate member identity in authorized shared contexts. No health/body/birth/contact data unless separately authorized |
| FD-MC-03 | **Display name approved:** member-controlled; shown in shared-group / authorized Challenge contexts; not globally public by default; no uniqueness; accountable server-side change history; previous names not shown in ordinary presentation |
| FD-MC-04 | **Interests and goals required in onboarding**; purpose is relevance/recommendation only; PostgreSQL-persisted, member-controlled, auditable; never evidence or authority (§6) |
| FD-MC-05 | **Versioned Terms/Privacy consent record required before pilot** (member identity, Terms version, Privacy version, timestamp, source/context, accountable actor). No invented legal wording |
| FD-MC-06 | **Account lifecycle assessed as pilot readiness**, not silently pushed past pilot (§9) |
| FD-MC-07 (new) | **Media capability required before pilot** for profile images, Group covers and Challenge covers. MV-206 v0.1 voluntarily adopted as external guidance (§7). Local gradients do not satisfy the requirement |
| FD-MC-09 (new) | **Tiizi includes a governed Challenge-specific Feed** (§4) |
| General | Earlier Product Truth may be amended where later product learning justifies it; Group Feed and Challenge Feed are separate capabilities and must not be conflated |

## 4. Challenge Feed — exact Product Truth amendment

**OLD (now HISTORICAL / SUPERSEDED)** — Stage F FR-V2-128 as reconciled by F-E-01: *"There is no Challenge-specific Feed and no separate Home Feed. The Group Feed is the single community stream. Challenge-specific operational information (progress, results, status) is presented through the Challenge experience itself, not through a Feed."*

**NEW EFFECTIVE DIRECTION:**

> **Tiizi includes a governed Challenge-specific Feed as a Challenge-local engagement surface. Its content does not create or alter Challenge Truth.**

What this amendment does **and does not** change:

- Supersedes only the "no Challenge-specific Feed" clause. **There is still no Home Feed.** The Group Feed remains the single community stream *of the Group*.
- Does **not** change GF-01 v1.1, GF-02, GF-03 or GF-04. Group Feed automatic families remain exactly `challenge_established`, `challenge_started`, `together_goal_achieved`, `challenge_ended`. Ordinary participant activity is never published to the Group Feed.
- Does **not** reopen FR-V2-133 (no comments/replies) or FR-V2-212 (Share to Group is explicit). Those are addressed per feature in CF-01 and flagged as Founder decisions where the Challenge Feed would need an equivalent rule (§12).
- Does **not** authorize implementation. The detailed contract is CF-01 (draft, awaiting Founder review); CF-2 onward remain unauthorized.

Records annotated to carry this (originals preserved): `STAGE-F-TIIZI-V2-FUNCTIONAL-REQUIREMENTS-DRAFT.md` (FR-V2-128 and its register row), `STAGE-F-T1-T2-CONSOLIDATION-REPORT-001.md` (F-E-01 row), `TIIZI-GF-01-GROUP-FEED-EVENT-CONTRACT.md` (editorial cross-reference only; no rule changed).

## 5. Exact Group Feed ↔ Challenge Feed boundary

| Aspect | Group Feed (GF-01 v1.1, unchanged) | Challenge Feed (CF-01, proposed) |
|---|---|---|
| Question answered | "What is happening in this Group?" | "What is happening in this Challenge?" |
| Scope key | One per Group | One per Challenge |
| Audience | Active/joined Group members (subject to Challenge visibility) | Members who currently have access to that Challenge (Group membership **and** Challenge visibility), rechecked per read |
| Content | Four automatic, actor-free, number-free cards | Challenge-local moments; may carry actor and permitted metrics per CF-01 |
| Ordinary participant activity | Never | Only by explicit Share (recommended) |
| Engagement | None (no Kudos, comments, Share) | Per CF-01 tiers (§8) |
| Storage | Migration 025 `group_feed_*` tables; **stays Group-Feed-specific** | **Own** publication and projection tables (new migration 026+); not an extension of 025 |
| Read API | `GET /api/groups/:groupId/feed` | New Challenge-scoped endpoint under the canonical API prefix |
| Reads from the other? | No | **No.** Neither feed reads, merges or re-exports the other |
| Shared source facts | Challenge transitions (established/started/goal/ended) | The same transitions may appear in both, as **separate publications** for different audiences. This is intentional, not conflation |
| Today | May consume only the Group Feed read seam (GF-01 §11) | Not a Today stream; Today may link into it |

Rules that keep them apart: no cross-feed foreign keys; no shared outbox rows; a change to one feed's contract cannot change the other's allow-list; the existing invariant test (`api/test/groupFeedContractInvariant.test.ts`) must continue to pass untouched.

## 6. Profile + onboarding (revised scope)

### 6.1 Pilot Profile (FD-MC-02/03)
Display name (editable, server-persisted, change history kept server-side, previous names never shown in ordinary UI); email to self only; profile image (MEDIA-2); own Groups/Challenges summary from existing reads; interests and goals (editable); sign out; Terms and Privacy links; consent status. **Not collected:** health, body, birth date, contact. Region, language and other preferences: assessed against product purpose before inclusion. My recommendation: **language** (V2 locale exists) and **region** (location-relevance for recommendations, only if the recommendation seam actually uses it) are candidates; neither is added without a stated consumer. Notification preferences wait for Notifications.

### 6.2 Onboarding (FD-MC-04) — RECOMMENDATION
Not the V1 flow. A short V2 entry after first successful bootstrap:
1. Welcome / how Tiizi works (Groups → Challenges → logging), skippable.
2. **Interests** step. 3. **Goals** step.
4. Land on Today with personalized discovery.

**Interest taxonomy (proposed):** reuse the existing governed Group Focus Areas (12 entries across Fitness and Wellness in `api/src/groupVocabulary.ts`) so Group metadata and member interests share one vocabulary. The Activity catalogue also has governed `domain` and `category` per Activity; a governed mapping between Activity category and Focus Area is needed so Challenges can be matched. That mapping does not exist yet (see 6.3).
**Goal taxonomy (proposed):** reuse the 9 governed Group Goals (`GROUP_GOALS`, e.g. build strength, improve sleep, manage stress). The same ids are already used by Groups, giving a direct join.
**Storage rule (proposed):** store stable ids, never labels; vocabulary versioned; unknown ids dropped on read.
**Selection rules (proposed, for Founder choice):** interests multi-select, minimum 1, maximum 5; goals multi-select, minimum 1, maximum 3. **Skippable?** My recommendation: the step is always presented and the member may "Skip for now"; a skip is recorded and Today shows a gentle prompt until completed. This honors "required component of onboarding" while keeping EA-01 M4 "no forced setup" and avoiding junk data. If the Founder wants a hard requirement, that is a one-line change but contradicts M4 and should be a conscious decision (FD-MC-04a).
**Editing:** same selectors in Profile; every change audited with timestamp and actor (the member).
**Constraints (Founder-stated):** interests/goals never establish eligibility, membership, participation, scoring, progress, results, Recognition, or override visibility, and are never evidence.

### 6.3 Recommendation seam — what exists
I found **no recommendation logic**. Group discovery orders by `created_at DESC` (`api/src/groupDiscovery.ts`); Today's "opportunities" are un-joined Challenges in the member's own Groups (`api/src/today.ts`), not ranked by relevance. Group `focus_tags` appear to be member-entered text in Group Settings, so exact-match against a governed vocabulary cannot be assumed; this needs verification. Challenges carry no focus-area attribute; only their Activities carry governed domain/category.

**Conclusion: a bounded recommendation slice (REC-1) is required before pilot.** Proposed shape: deterministic, explainable relevance ordering (no ML), applied **only inside the already-authorized discoverable set** (Group privacy/discoverability, Challenge visibility, membership, eligibility all enforced first), using overlap of member interests/goals with Group focus areas/goals and with Challenge Activity category via the governed mapping. **Fallback:** when nothing matches, return the existing default order unlabelled; never present a non-match as "recommended"; an empty state never leaks hidden Groups/Challenges. Recommendation is a navigation aid, not endorsement (T1 §S).

### 6.4 Consent (FD-MC-05)
Table (illustrative, not schema authority): member id, Terms version id, Privacy version id, accepted_at, source/context (e.g. `v2_sign_up`), accountable actor (the member). Version identifiers come from the legal text owner; **I do not draft legal wording.** Re-acceptance on version change is a later decision. Prospective withdrawal per CIC §4.27.

### 6.5 Member bootstrap (FD-MC-01) — requirements recorded
Explicit bounded V2 call (not an auth-hook side effect); verified Firebase ID token; idempotent on `(auth_provider, auth_subject)`; concurrent first calls converge on one row; conflicts fail closed; returning members reuse the mapping; sign-up display name persisted canonically at first creation and not overwritten by later sign-ins; Google sign-in handled by the same call (name from the verified claim, falling back safely); always creates ordinary `member` role only, so Operator/admin authority paths (roster-based, e.g. `platform_operator_*` tables, knowledge-import role seeding) cannot be created or elevated by it; `requireAuth` stays strict. Existing seeded members with no name need a safe empty-name path. **Status: not started; first technical blocker; implementation not authorized by this record.**

## 7. Media — MV-206 adoption (FD-MC-07)

### 7.1 Adoption wording (proposed record text)
> Tiizi voluntarily adopts **MV-206 v0.1 — Media Storage & Delivery Guidance** (`Fkenogo/miledge-ventures`, `docs/miledge-ventures-knowledge/02-architecture/`, approved by Miledge Founder decision MV-FD-001, 2026-10-08) as **external architecture guidance only**. MV-206 does not govern Tiizi. Miledge acquires no Tiizi product authority, and no Miledge governance is imported. MV-206 itself states it is "not a provider mandate" and that independent projects may use it voluntarily. Tiizi retains its own authority over product requirements, data models, permissions, privacy, provider selection and release. Cloudflare R2 and Cloudflare Images are candidates to **evaluate**, not selections. Tiizi's provider and architecture decision will be made and recorded in MEDIA-1. Tiizi describes itself as independent of the Miledge portfolio.

### 7.2 Media scope and work packages
Scope: member profile images, Group cover images, Challenge cover images. Full evaluation is in `TIIZI-MEDIA-CAPABILITY-ASSESSMENT-001.md`. The current curated-gradient cover allowlist (`cover_id`) remains only as the default/fallback catalogue, which MV-206 §5 itself suggests keeping.

| WP | Title | Content |
|---|---|---|
| MEDIA-1 | Tiizi Media Capability Decision | Docs/decision: provider choice (R2 vs alternatives, Images vs own processing), access/visibility policy per asset class, limits, variants, retention/deletion, cost model, IDP-04 disposition, portability seam, bounded non-production proof plan (MV-206 §6 style). Founder approves. No code |
| MEDIA-2a | Media core | Provider-neutral adapter, signed/authorized upload, server-side validation and re-encode, `media_assets` metadata in PostgreSQL, orphan cleanup, deletion, tests |
| MEDIA-2b | Profile image | Upload/replace/remove, privacy-aware delivery, initials fallback |
| MEDIA-2c | Group cover | Steward upload; coexists with gradient catalogue |
| MEDIA-2d | Challenge cover | Wizard cover upload; same core |
| MEDIA-3 | Founder preview/acceptance | Preview before pilot readiness is declared |

(The Founder named MEDIA-1 and MEDIA-2; I propose splitting MEDIA-2 into a/b/c/d slices for reviewability. Naming is adjustable.)

## 8. Challenge Feed — engagement recommendation (summary)

Full detail and the event matrix are in CF-01. Summary tiers (RECOMMENDATION):

| Tier | Features |
|---|---|
| **MUST HAVE BEFORE PILOT** | Automatic Challenge-local moments (typed, template-generated); **explicit Share** of own activity/milestone/result to the Challenge Feed (structured, no free text); a single lightweight **Kudos** reaction (toggle; separate from Recognition) |
| **SHOULD HAVE** | Steward announcements (text, steward-authored, bounded, reportable) |
| **LATER** | Comments/replies; multiple reaction types; notifications for feed activity; aggregation; external share |

Why this split: the feed would be nearly empty without participant-originated content, so explicit Share is the minimum engagement; one reaction gives acknowledgement without free text; comments and announcements introduce free text and moderation, and comments additionally require superseding FR-V2-133 for the Challenge Feed. None may alter evidence, score, progress, results or Recognition (FR-V2-130/132/134).

## 9. Account lifecycle (FD-MC-06) — RECOMMENDATION

Context: IDP-03 is still unticked. Participation, activity, finalization and membership tables reference `members` with `ON DELETE RESTRICT` and are immutable/historical, so **hard deletion of a member row is not possible without breaking Challenge history**. The workable model is the IDP-03 recommended default (Option A): separate reversible deactivation from irreversible deletion, and **anonymize** rather than purge where shared history requires it.

**Minimum for pilot (proposed):**
1. Sign-out (Profile).
2. A member-initiated **"Request account deletion"** captured as a durable, auditable request, fulfilled by the Operator within a stated period (manual process acceptable for pilot).
3. Fulfilment = anonymization: remove display name, image (object deleted per MV-206), interests/goals and email linkage; shared contexts show a neutral "Former member"; historical attribution kept only as the internal UUID. Firebase Auth account disabled/deleted in coordination.
4. A member `status` capable of `active` / `deactivated` / `deleted-anonymized` (CIC §4.1 already names `active | suspended | deleted`).
5. Retention/privacy statement owned by the Founder/legal: what is retained, for how long. **I do not draft this.**
6. Media and Feed content authored by the member is removed or anonymized on deletion (Feed shares withdrawn; Kudos removed).

**Safely post-pilot:** self-service data export, automated deletion workflows, formal retention schedules per data class, legal holds, account recovery/identity linking, suspension tooling beyond what the Operator already has.

**Needs Founder decision:** approve Option A; the deletion SLA; who fulfils; legal text.

## 10. Revised pre-pilot programme sequence

Work packages (all unauthorized until the Founder authorizes each):

| WP | Title | Depends on |
|---|---|---|
| **MC-1** | V2 Member Bootstrap / Provisioning | FD-MC-01 (done) |
| **MC-2** | Profile Domain + Pilot Profile Foundation (profile store incl. display-name history, interests/goals persistence, `/api/me`, Profile page, sign-out) | MC-1; Profile Product Truth contract (MC-2a) |
| **MEDIA-1** | Media Capability Decision | none (docs) |
| **MEDIA-2** | Media implementation (a–d above) | MEDIA-1; 2b needs MC-2 |
| **MC-3** | V2 Entry / Onboarding + Versioned Consent | MC-1, MC-2; vocabulary governance; legal version ids |
| **REC-1** | Bounded recommendation slice (added) | MC-3 data; interest/Activity-category mapping |
| **MC-4** | Governed Member Identity Projection | MC-2; (images need MEDIA-2b) |
| **LIFE-1** | Minimum account lifecycle (added) | MC-2; IDP-03 decision; MEDIA-2 deletion hook |
| **CF-1** | Challenge Feed Product Truth Amendment / Contract (drafted as CF-01) | Founder review |
| **CF-2** | Challenge Feed Publication/Event Model | CF-1 approved; own migration; actor-free events need no MC-4 |
| **CF-3** | Challenge Feed Read API | CF-2; MC-4 for actor names |
| **CF-4** | Challenge Feed Mobile Experience | CF-3 |
| **CF-5** | Challenge Engagement Layer (Share, Kudos, announcements per tier) | CF-2…4, MC-4 |
| **CF-6** | Founder Preview / Acceptance (feed; media; onboarding) | all above |

**Critical path:** MC-1 → MC-2 → (MC-3, MC-4, MEDIA-2b) → CF-5 → CF-6. CF-2/3/4 for actor-free automatic moments can run alongside MC-2 and do not wait on it.

**Parallelizable now (docs/decisions, no code dependency):** MEDIA-1; CF-1 review; MC-2a Profile contract; vocabulary/taxonomy governance; IDP-03 and legal-version decisions; REC-1 design. **Parallelizable after MC-1:** MC-2 ∥ MEDIA-2a ∥ CF-2 (automatic events). **After MC-2:** MC-3 ∥ MC-4 ∥ MEDIA-2b/c/d ∥ LIFE-1. Operationally, only the migration numbers need coordination (MC-2, MEDIA-2a, CF-2 each want migration 026+); assign numbers at authorization time.

**Standing operational gap:** no scheduler is deployed (GF-04 used the manual `feed:process`). A Challenge Feed, media orphan cleanup and retention expiry will all want one. Treat "scheduler / background job runner" as an explicit pre-pilot dependency (S9 is otherwise unstarted) rather than discovering it later. Needs a Founder decision on whether it is in pre-pilot scope.

## 11. Boundaries

GF-01/02/03/04 unchanged. Migration 025 unmodified and still Group-Feed-specific (and still not deployed; its event-type CHECK reconciliation remains required before deployment). No migrations created. No scheduler added, no media upload, no Kudos/Recognition/Share/comments/reactions built. No application code. No deployment, no production access. V1 not used. Miledge authority not copied into Tiizi.

## 12. Implementation blockers still needing a Founder decision

1. **FD-MC-04a** Is the interests/goals step skippable? (recommend skippable with prompt)
2. **FD-MC-04b** Approve vocabulary reuse (Group Focus Areas for interests; Group Goals for goals) and the min/max selection counts.
3. **FD-MC-04c** Approve REC-1 as a pre-pilot slice and the Activity-category ↔ Focus-Area mapping owner.
4. **FD-MC-05a** Legal text owner and Terms/Privacy version identifiers; re-acceptance policy.
5. **FD-MC-06a** Approve IDP-03 Option A, deletion SLA, fulfilment owner, retention statement.
6. **FD-MC-07a** MEDIA-1 decisions: provider, public vs private delivery per asset class, size/format limits, moderation/takedown scope, budget owner. Also who may change a Challenge cover after establishment.
7. **FD-MC-09a** CF-01 review: event matrix, metric/actor visibility ceilings (esp. whether a shared activity may show its own value/unit), Challenge-Feed retention and historical access, Together percentage milestone set.
8. **FD-MC-09b** Whether comments/replies are LATER (recommended) or required before pilot — requires superseding FR-V2-133 for the Challenge Feed.
9. **FD-MC-09c** Who may post steward announcements in a Challenge (Group Accountable Steward only, or also the Challenge creator).
10. **FD-MC-09d** Whether explicit Share to the Challenge Feed must also satisfy FR-V2-212's "Share to Group is explicit" in spirit (recommended: yes, same affirmative-preview pattern).
11. **FD-MC-10** Scheduler/background job runner in pre-pilot scope.
12. Verification item (not a decision): confirm how Group `focus_tags` are stored/validated before REC-1.

## 13. Disposition

**TIIZI MEMBER COMPLETION FOUNDER DISPOSITION 001 — REVISED / MEDIA PRE-PILOT / CHALLENGE FEED AUTHORIZED IN PRINCIPLE / AWAITING FOUNDER REVIEW.** No implementation authorized.
