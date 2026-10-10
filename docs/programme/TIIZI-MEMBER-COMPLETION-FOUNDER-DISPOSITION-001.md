# TIIZI — MEMBER COMPLETION FOUNDER DISPOSITION 001

**Date:** 2026-10-10 (revised; finalization pass; §5 aligned by Recommendation Authority Reconciliation 001 and Founder Disposition 001 on vocabularies)
**Base:** `365c958bf69f6d79ae262e81045abae9c777c19c` (canonical `main`). Master Programme 2.50 → 2.51 → **2.52**
**Basis:** `docs/programme/TIIZI-MEMBER-COMPLETION-ASSESSMENT-001.md` (commit `0ee5da0`); first revised disposition candidate `2bf79f7`
**Companion records:** `docs/product-truth/TIIZI-CF-01-CHALLENGE-FEED-PRODUCT-TRUTH.md` (v0.2); `docs/programme/TIIZI-MEDIA-CAPABILITY-ASSESSMENT-001.md`
**Status:** **FOUNDER DECISIONS RESOLVED / PRE-PILOT PROGRAMME DEFINED / AWAITING FINAL REVIEW AND PR.**
**Nature:** Documentation, Product Truth and programme alignment only. **No implementation is authorized.** Each work package below still needs its own Founder authorization before it starts. No PR has been opened.

## 1. How to read this record

- **EFFECTIVE** = decided by the Founder (2026-10-10, including the finalization pass) and recorded as given.
- **PROPOSED** = a detail that is genuinely unresolved and offered for later decision; it is not authority.

## 2. Superseded and corrected positions

| Item | Earlier position | Now |
|---|---|---|
| Profile media | Deferred past pilot (Assessment 001) | **Required before pilot** (FD-MC-07) |
| "No Challenge-specific Feed" (FR-V2-128 / F-E-01) | Left in force | **Superseded**; Challenge-specific Feed authorized (FD-MC-09) |
| Interests/goals | Not collected until a consumer exists | **Required onboarding inputs** (FD-MC-04) |
| Interests/goals skippable ("Skip for now") | Recommended in the first revised disposition (`2bf79f7`) | **Superseded: no skip** (FD-MC-04a) |
| Steward announcements | SHOULD HAVE tier | **Required before pilot** |
| Kudos | MUST HAVE with giver visible to item owner (proposal) | **Required before pilot**, with the final rules in §9.3 |
| Challenge Feed sequencing | Last | **Pre-pilot, parallel** where dependencies permit |
| Reserving migration 026 for Challenge Feed (and 026 in other work packages) | Stated in earlier drafts | **Removed.** See §12 |
| EA-01 M4 "no forced setup" | Applied to all setup | **Narrowed** (§4) |

Historical records are annotated, not erased.

## 3. Resolved decisions (FD-MC register)

| ID | Status | Decision |
|---|---|---|
| FD-MC-01 | EFFECTIVE | Explicit bounded idempotent V2 member bootstrap; no generic provisioning on arbitrary authenticated requests. MC-1 is the first technical blocker |
| FD-MC-02 | EFFECTIVE | Real pilot Profile (name, self-visible email, profile image, own Group/Challenge summary, edit allowed fields, sign out, Terms, Privacy, member identity in authorized shared contexts). No health/body/birth/contact data unless separately authorized |
| FD-MC-03 | EFFECTIVE | Display name: member-controlled; shown in shared-group / authorized Challenge contexts; not globally public; no uniqueness; accountable server-side change history; previous names not shown in ordinary presentation |
| FD-MC-04 | EFFECTIVE | Interests and goals are required onboarding inputs; relevance and recommendation only |
| **FD-MC-04a** | **EFFECTIVE (new)** | **No skip.** Interests: multi-select, min 1, max 5. Goals: multi-select, min 1, max 3. Both editable in Profile |
| **FD-MC-04b** | **EFFECTIVE (approved with verification)** | Governed Group Focus Areas = starting Interest vocabulary; governed Group Goals = starting Goal vocabulary; stable IDs stored. Verification and reconciliation required before REC-1 implementation (§5). *Member Interest and Member Goal remain distinct concepts from Group Focus Area and Group Goal; only the starting vocabulary is shared.* |
| **FD-MC-04c** | **EFFECTIVE** | REC-1 is a pre-pilot capability that **operationalizes** the already-authorized interest-based discovery/recommendation capability (§5.0) |
| **FD-MC-04d** | **EFFECTIVE (approved 2026-10-10)** | Goal-based relevance approved for V2: Member Goals as bounded REC-1 relevance inputs; Group Goals as the corresponding Group-side relevance attributes. A new, narrow relationship that creates no access, eligibility, membership, participation or scoring effect (§5) |
| **FD-MC-04e** | **EFFECTIVE (approved 2026-10-10)** | Bounded KNW-04 resolution for the V2 pilot: Member Interest vocabulary = the governed 12 Focus Area concepts; Member Goal vocabulary = the governed 9 Group Goal concepts; entities stay distinct; KNW-04 stays open only for broader evolution (§5) |
| FD-MC-05 | EFFECTIVE | Versioned Terms/Privacy consent record before pilot (§6). No legal wording invented |
| **FD-MC-06a** | **EFFECTIVE in principle** | IDP-03 Option A (§10) |
| **FD-MC-07a** | **EFFECTIVE** | Cloudflare R2 selected as the initial object-storage provider behind a provider-neutral port (§8) |
| **FD-MC-09a** | **EFFECTIVE** | Challenge Feed v1 event decisions, retention and access (CF-01 v0.2 §4, §5) |
| **FD-MC-09b** | **EFFECTIVE** | Comments/replies are not required before pilot; later, with separate Product Truth/moderation decision; FR-V2-133 remains in force |
| **FD-MC-09d** | **EFFECTIVE** | Challenge Feed Share follows the same affirmative principle as existing Share authority (§7) |
| FD-MC-09 | EFFECTIVE | Challenge-specific Feed authorized (amendment in §9) |
| **FD-MC-10** | **EFFECTIVE** | Reliable background processing is required before pilot; work package BG-1 (§11). Not selected or implemented here |

## 4. Onboarding requirement (exact)

The V2 entry flow includes a bounded step in which the member **must** choose:

- **Interests:** multi-select, **minimum 1, maximum 5**;
- **Goals:** multi-select, **minimum 1, maximum 3**.

**There is no "Skip for now" in the initial V2 onboarding flow.** Both remain editable later in Profile (every change audited, actor = the member). Selections are stored as **stable IDs, not display labels**, in PostgreSQL as canonical member Profile/preference data — never only in localStorage or Firebase profile metadata.

**EA-01 M4 narrowing (recorded).** EA-01 reconciliation row M4 said onboarding has "no forced setup". That principle is **narrowed, not removed**: Tiizi still does not force extensive personal or profile completion, and V1's multi-step forced completion is not reinstated. Tiizi may require the minimum preference inputs needed to deliver the authorized recommendation experience, and that is exactly interests and goals. Nothing else is required beyond the display name collected at sign-up and the versioned consent acceptance. The V1 onboarding is not copied.

**Constraints (Founder-stated, binding):** interests/goals are member-provided preferences. They must not establish Challenge eligibility, Group membership or Challenge participation, modify scoring, progress, results or Recognition, override Group/Challenge visibility, or become evidence.

**Flow shape (PROPOSED, experience detail):** short welcome (how Tiizi works), interests step, goals step, then Today. The welcome screen being skippable is an experience detail; the interests and goals steps are not skippable.

**Pre-existing members (EFFECTIVE):** a V2 member without canonical Interest/Goal selections must complete the same bounded onboarding selection (interests 1–5, goals 1–3, no skip) on next V2 entry. V1 preference data is not imported automatically.

## 5. Vocabularies, relevance authority and REC-1

### 5.0 Final authority interpretation (EFFECTIVE)
Foundation Product Truth already authorized interest-based discovery and recommendation (Stage F T1 §E.8, §O.2, §S.2, §S.4, §S.5; FR-V2-053; CIC §4.2/§4.3). The later S4 statements were non-delegation/scope boundaries: Focus Areas and Goals did not themselves create a recommender, and the S4 slice did not implement recommendation. FD-MC-04d now adds the narrow Member Goal ↔ Group Goal relevance relationship. FD-MC-04e establishes the bounded V2 pilot vocabularies. **REC-1 does not invent interest-based recommendation from nothing**; it operationalizes an authorized capability and adds the approved Goal relationship. Full trace: `TIIZI-INTEREST-GOAL-FOCUS-AREA-RECOMMENDATION-AUTHORITY-RECONCILIATION-001.md`.

### 5.1 Decisions
**FD-MC-04d — APPROVED.** Goal-based relevance is approved for V2. Member Goals may be used by REC-1 as bounded relevance inputs, and Group Goals may be used as the corresponding Group-side relevance attributes. This is a new, narrow relationship. It does not mean that Group Goals create recommendation authority by themselves; that Member Goals create access; that Goals create eligibility, Group membership or Challenge participation; that Goals affect Challenge scoring, progress or results; or that recommendation becomes endorsement. REC-1 is the explicit governed capability that relates these independent facts.

**S4 Group Goal wording, narrowly clarified.** *Historical meaning (unchanged):* at S4 acceptance, Group Goals did not themselves rank, recommend or match Groups, and S4 did not implement a recommender. *New effective clarification (FD-MC-04d):* a separately governed recommendation capability MAY use Group Goals as descriptive relevance inputs, together with Member Goals, inside the already-authorized discoverable set.

**FD-MC-04e — APPROVED (bounded KNW-04 resolution for the V2 pilot).** KNW-04 is resolved only for the bounded V2 pilot recommendation/profile scope. For this scope the **Member Interest vocabulary is the governed 12 Focus Area concepts** and the **Member Goal vocabulary is the governed 9 Group Goal concepts**. Sharing a vocabulary does not collapse the entities: a Member Interest is a Profile expression; a Group Focus Area is Group descriptive metadata; a Member Goal is a Profile expression; a Group Goal is Group descriptive metadata; an Activity category is a Knowledge classification. The Member owns their Interest and Goal expressions; the Group Steward establishes Group Focus Areas and Goals under Group authority; Knowledge Authority governs Activity and category meaning; REC-1 relates those facts for relevance only.

**KNW-04 status:** *RESOLVED for the bounded V2 pilot recommendation/profile scope* (vocabulary and ownership as above). *OPEN for broader future evolution* only: adding or removing controlled concepts, taxonomy lifecycle beyond pilot, broader personalization capabilities, and future custom-vocabulary governance.

### 5.2 Ownership and definitions (final)
| Concept | Final definition | Owner / authority |
|---|---|---|
| **Member Interest** | A Profile expression, by the member, of interest in one of the governed 12 Focus Area concepts, held as that concept's stable ID, for the declared purpose of relevance. Private preference data; creates no access, eligibility or participation | The Member (Participant Authority) |
| **Member Goal** | A Profile expression, by the member, of one of the governed 9 Group Goal concepts, held as that concept's stable ID, for relevance only. Not a Challenge target, Policy or Activity | The Member |
| **Group Focus Area** | Descriptive Group metadata selecting from the governed 12 concepts | The Group Steward, under Group authority |
| **Group Goal** | Descriptive Group metadata selecting from the governed 9 concepts | The Group Steward, under Group authority |
| **Activity category** | Knowledge classification (EKG-01 §5), the same 12 concepts | Knowledge Authority |
| **Relevance result** | Derived, non-canonical, not Profile truth, not persisted in v1 | REC-1 (application capability) |

### 5.3 Stable IDs (REQUIRED before MC-3 / REC-1 implementation)
**Recorded inconsistency.** `api/src/groupVocabulary.ts` states "IDs are stable API values", but `GROUP_FOCUS_AREAS` there has only `domain` and `label` (the client copy has `domain` and `category`), with **no id**. Group Goals and Community Norms do have IDs. Requirements for the 12 Focus Areas: **stable, application-owned machine IDs; immutable once published; UI labels may evolve without changing identity; Member Interests store IDs, not labels; Group Focus Areas must ultimately normalize to IDs; Challenge Activity-category mapping uses governed IDs/relations; free-text labels are never canonical recommendation keys.** No ID values are chosen or proposed in this docs pass (repository convention does not require the Product Truth record to specify them); the vocabulary normalization package defines them, and any values it proposes are implementation candidates until that package begins.

### 5.4 Custom text (EFFECTIVE)
REC-1 v1 **must not** use arbitrary custom text as a recommendation key. Governed Focus Area IDs and governed Group Goal IDs participate. Custom focus tags and custom Group goal text remain **display/descriptive metadata only** and receive **no relevance weight** unless later mapped through an explicitly governed normalization process.

### 5.5 Challenge relevance (EFFECTIVE)
No synthetic Challenge Focus Area field is added for recommendation. Challenge relevance derives from (1) the canonical Activities pinned to the Challenge, (2) their governed Activity categories, (3) the hosting Group's governed Focus Areas, and (4) the hosting Group's governed Goals where applicable. REC-1 may combine those signals; weighting belongs to REC-1 design.

### 5.6 REC-1 requirements and authority status (EFFECTIVE)
REC-1 ranks Groups and Challenges using Member Interests and Goals inside already-authorized discoverable results. It **must**: never create visibility, access, membership, participation or eligibility; be deterministic and explainable for v1; fall back to the existing ordering when no match exists; never present hidden or non-discoverable entities; use no ML in v1; not infer interests from behaviour in v1; not store results as Profile truth; never expose one member's interests/goals to others. Recommendation is a navigation aid, not endorsement.
**Authority status: CLEAR.** REC-1 is no longer blocked by recommendation authority. It remains pre-pilot, NOT STARTED, and implementation is not authorized.

### 5.7 Remaining REC-1 technical prerequisites (not implemented in this pass)
1. Mint stable Focus Area IDs. 2. Normalize governed Group Focus Areas to IDs (verify real stored `focus_tags` first). 3. Preserve custom values as non-ranking metadata. 4. Persist Member Interest and Goal IDs (MC-2/MC-3). 5. Define the Challenge Activity-category relevance mapping. 6. Implement deterministic ranking within already-authorized discovery. 7. Provide fallback ordering.

### 5.8 Preliminary verification (from code at `365c958`)
Focus Areas equal the 12 governed Knowledge categories (`groupFocusAreas.ts`, `groupVocabulary.ts`, `knowledge.ts` V2 categories). They have no IDs (§5.3). Group `focus_tags` are label strings; the validated route accepts the standard labels plus at most one custom label of up to 30 characters, the domain sanitizer treats them as bounded free-text strings, and legacy tags are read as stored. No recommendation logic exists (Group discovery orders by creation date).

## 6. Consent (FD-MC-05)
Record: member identity, Terms version, Privacy version, timestamp, source/context, accountable actor. Version identifiers and the wording come from the legal text owner; engineering does not invent them. Prospective withdrawal per CIC §4.27.

## 7. Profile scope and member bootstrap

**Pilot Profile (EFFECTIVE):** display name (editable, change history kept server-side, previous names not shown ordinarily); email shown to self; profile image (MEDIA-2b); own Group/Challenge summary; interests and goals (editable); sign out; Terms and Privacy; member identity in authorized shared contexts (MC-4). Region, language and other preferences: included only when a real product purpose is stated.

**Member bootstrap (FD-MC-01) requirements recorded:** explicit bounded V2 call (not an auth-hook side effect); verified Firebase token; idempotent on `(auth_provider, auth_subject)`; concurrent first calls converge; conflicts fail closed; returning members reuse the mapping; sign-up name persisted canonically at first creation and not overwritten later; Google sign-in handled by the same call; creates ordinary `member` role only so Operator/admin authority paths cannot be created or elevated; `requireAuth` stays strict. Existing seeded members with no name need a safe empty-name path. **Status: not started.**

## 8. Media — Cloudflare R2 (FD-MC-07a)

### 8.1 Provider selection wording (EFFECTIVE)
> **Cloudflare R2 is selected as Tiizi's initial object-storage provider for profile images, Group covers and Challenge covers.** The architecture remains provider-neutral: *Tiizi application/domain → ObjectStore / media port → S3-compatible adapter → Cloudflare R2.* Provider URLs are never canonical identity. PostgreSQL stores Tiizi-owned asset references and metadata; R2 stores bytes. Cloudflare Images / transformation services are **optional** and are evaluated during the bounded non-production proof; they are not required for the base capability.

### 8.2 MV-206 (unchanged)
Tiizi voluntarily adopts **MV-206 v0.1 — Media Storage & Delivery Guidance** (`Fkenogo/miledge-ventures`, MV-FD-001, 2026-10-08) as **external architecture guidance only**. It does not govern Tiizi, Miledge acquires no Tiizi product authority, and Tiizi records its own decisions (this section and MEDIA-1). Tiizi describes itself as independent of the Miledge portfolio.

### 8.3 Visibility and mutation baseline (EFFECTIVE)
| Asset | Visibility | Who may change |
|---|---|---|
| Profile image | Visible only where the member identity itself is authorized; **not anonymously public by default** | The member |
| Group cover | **Inherits Group visibility/discovery policy** | Accountable Steward (existing Group Settings authority) |
| Challenge cover | **Inherits Challenge visibility** | The creator during establishment; **after establishment, the authorized Group Accountable Steward may replace it** |

The existing curated gradient catalogue remains the **fallback/default**.

### 8.4 MEDIA-1 — now a concrete decision record
MEDIA-1 must produce a Tiizi media decision record, not only a comparison. The provider and visibility baseline above are decided. Still to resolve in MEDIA-1: API-mediated vs scoped direct upload; exact size and pixel limits; variants; delivery/access mechanics consistent with the visibility baseline; replacement and deletion; moderation/takedown; cost and budget ownership; the bounded non-production proof plan including the optional Cloudflare Images evaluation.

Work packages: **MEDIA-1** decision record; **MEDIA-2** implementation (2a core and R2 adapter; 2b profile image; 2c Group cover; 2d Challenge cover); **MEDIA-3** Founder preview. No live user images or production use without separate authority.

## 9. Challenge Feed — amendment and v1 contract

**Effective amendment (unchanged):**
> Tiizi includes a governed Challenge-specific Feed as a Challenge-local engagement surface. Its content does not create or alter Challenge Truth.

There is still no Home Feed. Group Feed and Challenge Feed are separate capabilities.

**Boundary (EFFECTIVE).** The Group Feed (GF-01 v1.1/GF-02/GF-03/GF-04) is unchanged, with exactly four automatic families (`challenge_established`, `challenge_started`, `together_goal_achieved`, `challenge_ended`), and ordinary participant activity is never published to it. The Challenge Feed owns Challenge-local engagement and activity moments, with its own publication/projection storage and read API; neither feed reads or merges the other; migration 025 remains Group-Feed-specific. Lifecycle moments (started, goal, ended) may appear in both as separate publications for different audiences.

### 9.1 Final v1 allow-list (EFFECTIVE; detail in CF-01 v0.2 §4)

| # | Moment | Mode | What the card carries |
|---|---|---|---|
| 1 | Participant joined | AUTOMATIC | Display name only; no other personal data; Challenge-local |
| 2 | Challenge started | AUTOMATIC | Generic |
| 3 | Together progress milestones | AUTOMATIC | **25%, 50%, 75%**; actor-free; percentage only |
| 4 | Together goal reached | AUTOMATIC | Generic |
| 5 | Challenge ended | AUTOMATIC | Generic |
| 6 | Finalized results ready | AUTOMATIC | Generic "Results are ready"; actual results stay on Challenge Detail |
| 7 | Accepted participant activity | **EXPLICIT SHARE ONLY** | Activity name, the member's own accepted value, unit, display name. No notes/evidence/location/raw metadata |
| 8 | Streak milestone | **EXPLICIT SHARE ONLY** | The member's own milestone only |
| 9 | Race finish / personal result | **EXPLICIT SHARE ONLY** | The member's own result only; **no numeric final position** in a Feed Share |

**NOT APPROPRIATE:** participant left; live Race rank/position movement; routine automatic personal activity; a "Challenge established" card inside the Challenge's own Feed.

### 9.2 Explicit Share rules (EFFECTIVE, FD-MC-09d)
Explicit member action; **preview before publishing**; **self-only**; **default is not shared**; **withdrawable**; the underlying activity/result never changes; one source item cannot silently create duplicate shares. Ordinary activity is never published automatically. Same affirmative principle as existing explicit Share authority (FR-V2-212 / T1 §R.1).

### 9.3 Kudos rules (EFFECTIVE; REQUIRED BEFORE PILOT)
One Kudos type only; any Challenge-visible member may Kudos an item; **no self-Kudos**; one Kudos per member per item; **toggle off/undo**; **aggregate count visible** to Challenge Feed viewers; the giver sees their own active/inactive state; **no public list of givers in v1**; never affects ranking, recommendation, status, progress, results or Recognition; rate-limit and abuse protections required; the Feed item's retention controls the Kudos lifetime. Kudos is distinct from Platform Recognition.

### 9.4 Steward announcements (EFFECTIVE; REQUIRED BEFORE PILOT)
Authors: the **Group Accountable Steward**, and the **Challenge creator where the creator is an authorized, distinct Challenge-administration actor**. Requirements: attributed author; timestamp; bounded text length; edit and delete; durable edit history; operator suppression/takedown; no effect on Challenge truth; **no member-authored free-form posts**. Unresolved detail (PROPOSED, for CF-1/CF-5): the repository records a creator on each Challenge (`created_by_member_id`) and Groups can allow members to create Challenges, but no distinct "Challenge administration actor" authority is defined today; CF-01 must define precisely when a creator qualifies before CF-5.

### 9.5 Retention and access (EFFECTIVE)
Feed available for the **Challenge lifetime plus 90 days after Challenge end**. After expiry, the Feed projection/presentation is removed; canonical Challenge evidence and results are never deleted or changed because of Feed retention. Audience: the member must still hold authorized Group/Challenge visibility; an exited Challenge participant may read while otherwise authorized to view the Challenge; leaving or losing Group or Challenge visibility removes Feed access. Signed Challenge-bound cursor; default page 20, maximum 50.

### 9.6 Comments (EFFECTIVE)
Comments and replies are **not required before pilot**. They are a later capability needing a separate Product Truth and moderation decision. They are not part of CF-5 v1. **FR-V2-133 remains in force** for general member comments/replies.

## 10. Account lifecycle (FD-MC-06a)

**IDP-03 Option A, in principle.** Account states: `active`; `deactivated`/`suspended` as applicable; `deleted-anonymized`. Historical member identity rows referenced by immutable Challenge history are **never hard-deleted**.

**Pilot minimum (EFFECTIVE):**
- Sign out.
- **Request account deletion** as a durable, auditable request.
- Manual Operator fulfilment is acceptable for pilot.
- Anonymize member-facing identity to **"Former member"**.
- Remove the profile image (object deleted).
- Remove interests and goals.
- Sever/remove operational email and auth linkage as permitted by the auth lifecycle.
- Withdraw the member's Challenge Feed Shares.
- Remove their Kudos.
- Preserve the internal historical UUID where immutable records require it.

**Policy/legal inputs (not to be invented by engineering):** the exact legal retention period and the deletion service level.

**Post-pilot (may remain):** self-service data export; fully automated deletion.

Engineering note for LIFE-1 (design consideration, not a decision): `members.auth_subject` is `NOT NULL` and unique, so "severing auth linkage" must be designed (for example, a non-resolvable tombstone) without breaking foreign keys.

## 11. Background processing — BG-1 (FD-MC-10)

A reliable background-processing capability is **required before pilot**. It is needed for at least: Group Feed publication processing (today the manual `feed:process`); Challenge Feed publication processing; scheduled Challenge lifecycle transitions (the existing `processExpiredChallenges` and scheduled-start seams have no deployed runner); media orphan cleanup; Feed retention expiry; and other already-authorized deferred processing seams.

**BG-1 — Background Processing / Scheduler prerequisite.** A bounded pre-pilot work package: **not selected, designed or implemented in this docs pass**, and not authorized. Its job-runner technology and hosting choice are a later decision (provider-neutral, consistent with ARCH-001 and the Cloud Run plan). It is a prerequisite for *pilot readiness*, not for developing the other packages (local CLIs remain usable in development).

**S9 caution.** The Master Programme tracks "S9 production scheduler remains absent" and separately the S9 Operator management surfaces. BG-1 may satisfy **only** the scheduler/background-runner aspect; it **does not complete or authorize S9**, and S9 must not be recorded complete because BG-1 lands. If the repository's identifier convention differs, BG-1 is a working identifier.

## 12. Migration numbering (correction)

Earlier drafts reserved or implied migration 026 for the Challenge Feed and referred to "026+" elsewhere. **That wording is removed.** MC-2, MEDIA, LIFE and CF packages may each require migrations. **Rule: assign migration numbers sequentially only when each authorized implementation package begins.** No migration is created or reserved now.

Migration 025 remains Group-Feed-specific and unchanged and is not deployed. **Its historical event-type CHECK gap (it still lists `challenge_finalized`) MUST BE RECONCILED BEFORE MIGRATION 025 DEPLOYMENT.**

## 13. Pre-pilot programme (parallel, not one chain)

| Line | Title | Needs (hard dependencies) |
|---|---|---|
| **MC-1** | Member Bootstrap | none (first technical blocker) |
| **MC-2** | Profile Foundation (profile store, display-name history, interests/goals persistence, Profile page, sign out) | MC-1; Profile Product Truth contract |
| **MC-3** | Onboarding + Consent | MC-1, MC-2; legal version ids; stable Focus Area IDs (§5.3) |
| **REC-1** | Relevance Recommendations | MC-3 data; technical prerequisites in §5.7 (authority is clear) |
| **MC-4** | Member Identity Projection | MC-2 |
| **MEDIA-1** | Media decision record | none |
| **MEDIA-2** | Media implementation (2a core+R2 adapter; 2b profile; 2c Group cover; 2d Challenge cover) | MEDIA-1; 2a needs R2 account/credentials/non-production env; 2b needs MC-2 |
| **MEDIA-3** | Media Founder preview | MEDIA-2 |
| **LIFE-1** | Account Lifecycle (pilot minimum) | MC-2; consumers of Shares/Kudos/media removal (CF-5, MEDIA-2b) wired at the end |
| **CF-1** | Challenge Feed Product Truth (CF-01) | Founder review of remaining detail |
| **CF-2** | Publication/Event Model | CF-1; BG-1 for production draining |
| **CF-3** | Read API | CF-2; MC-4 for names |
| **CF-4** | Mobile Experience | CF-3 |
| **CF-5** | Engagement Layer (Share, Kudos, announcements) | CF-2…4; MC-4; operator suppression capability |
| **CF-6** | Founder Preview / Acceptance | CF-5 |
| **BG-1** | Background Processing / Scheduler prerequisite | none to start; consumed by CF-2/5, MEDIA cleanup, retention |

**Can proceed in parallel now (docs/decisions):** MEDIA-1, CF-1 remaining detail, Profile Product Truth contract (MC-2a), vocabulary ID definition and focus-tag verification (REC-1 gates), legal version ids and IDP-03 policy inputs, BG-1 design/selection.
**In parallel after MC-1:** MC-2 ∥ MEDIA-2a ∥ CF-2 (automatic, actor-free moments) ∥ BG-1.
**In parallel after MC-2:** MC-3 ∥ MC-4 ∥ MEDIA-2b/2c/2d ∥ LIFE-1.
**Serial constraints:** MC-1 → MC-2; MC-3 → REC-1; MC-4 and CF-3 → name-bearing Feed items; CF-2…4 → CF-5 → CF-6; MEDIA-2 → MEDIA-3. Migration numbers are assigned only when each package starts.

## 14. Remaining Founder inputs (genuinely open)

1. Legal text owner and Terms/Privacy version identifiers; re-acceptance policy. 2. Deletion SLA and legal retention period; who fulfils manually. 3. MEDIA-1 specifics (upload mode, limits, variants, takedown, budget owner). 4. Whether Kudos applies to automatic system cards or only to member-owned Shares and announcements (CF-01 §6 proposes the latter). 5. Definition of the "authorized, distinct Challenge-administration actor" for announcements. 6. Activity-category → Focus-Area mapping definition (technical, within the vocabulary normalization package) and legacy/custom focus-tag handling design. 7. BG-1 technology/hosting choice. 8. Whether the fallback treatment for pre-existing seeded members (no selections) is acceptable.

## 15. Boundaries

GF-01/02/03/04 behaviour, the four Group Feed families, and migration 025 are unchanged. No migration created or reserved. No scheduler, media upload, Kudos, Share, announcement or recommendation code. No application code. No deployment, no production access. V1 not consulted for design. Miledge authority not copied into Tiizi. **No PR opened.**

**Disposition:** TIIZI MEMBER COMPLETION FOUNDER DISPOSITION 001 — FOUNDER DECISIONS RESOLVED / PRE-PILOT PROGRAMME DEFINED / AWAITING FINAL REVIEW AND PR.
