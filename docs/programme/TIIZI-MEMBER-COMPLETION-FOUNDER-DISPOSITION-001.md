# TIIZI — MEMBER COMPLETION FOUNDER DISPOSITION 001

**Date:** 2026-10-10 (revised; finalization pass)
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
| **FD-MC-04b** | **EFFECTIVE (approved with verification)** | Governed Group Focus Areas = starting Interest vocabulary; governed Group Goals = starting Goal vocabulary; stable IDs stored. Verification and reconciliation required before REC-1 implementation (§5) |
| **FD-MC-04c** | **EFFECTIVE** | REC-1 is a pre-pilot capability (§5) |
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

**Open implementation detail (not a Founder decision):** returning-member behaviour for members who predate this flow or were seeded without selections (they have no stored selections). Proposed: they are routed into the same required step on next entry. To be settled in MC-3.

## 5. Vocabulary, verification and REC-1

### 5.1 Approved direction
Interest vocabulary starts from the governed **Group Focus Areas**; Goal vocabulary starts from the governed **Group Goals**. Member selections are stored as stable IDs.

### 5.2 Preliminary verification observations (from reading the code at `365c958`; formal verification is an entry gate for REC-1)
- **Focus Areas are the governed Knowledge taxonomy.** `src/v2/groups/groupFocusAreas.ts` defines 12 entries as exact Fitness/Wellness *categories* from the governed Knowledge taxonomy (EKG-01 §5). This makes an Activity-category → Focus-Area mapping likely close to identity, but it must still be defined explicitly and approved.
- **Focus Areas have no stable IDs.** The client list and the API list (`api/src/groupVocabulary.ts`) carry labels/categories only. Stable IDs must be defined and versioned before member selections can be stored as IDs. (`GROUP_GOALS` already has stable ids such as `build_strength`.)
- **Group `focus_tags` are not conformant.** They are stored as label strings. The API accepts standard labels plus other strings up to 30 characters, and the code comment calls them "free-text focus chips, presentation only". Legacy and custom tags exist by design.
- **No recommendation logic exists.** Group discovery orders by creation date; Today opportunities are un-joined Challenges in the member's own Groups, not relevance-ranked.

### 5.3 REC-1 entry gates (all before implementation)
1. Verify current storage and validation of Group `focus_tags` (confirm the observations above against data and tests).
2. Reconcile/normalize them to stable governed IDs where needed (including a decision on legacy/custom tags: map, retain as non-matching presentation, or migrate), without changing Group presentation unexpectedly.
3. Define and approve an explicit governed **Activity-category → Focus-Area mapping** for Challenge relevance.
4. Define stable IDs and a vocabulary version for Interests and Goals.

### 5.4 REC-1 requirements (EFFECTIVE)
Purpose: rank relevant Groups and Challenges using member interests/goals. It **must**: rank only inside already-authorized discoverable results; never create visibility, access or eligibility; be deterministic and explainable for v1; fall back to the ordinary existing ordering when no match exists; never present hidden or non-discoverable entities. **No ML requirement for v1.** Recommendation is a navigation aid, not endorsement. Results must still respect Group and Challenge visibility, membership rules, participation eligibility, location or other authorized constraints, and ordinary authorization.

### 5.5 Status
**REC-1: PRE-PILOT capability, APPROVED in principle, NOT STARTED, implementation not authorized.** Depends on MC-3 data and the §5.3 gates.

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
| **MC-3** | Onboarding + Consent | MC-1, MC-2; legal version ids; vocabulary stable ids (§5.3 items 2, 4) |
| **REC-1** | Relevance Recommendations | MC-3 data; §5.3 gates complete |
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

1. Legal text owner and Terms/Privacy version identifiers; re-acceptance policy. 2. Deletion SLA and legal retention period; who fulfils manually. 3. MEDIA-1 specifics (upload mode, limits, variants, takedown, budget owner). 4. Whether Kudos applies to automatic system cards or only to member-owned Shares and announcements (CF-01 §6 proposes the latter). 5. Definition of the "authorized, distinct Challenge-administration actor" for announcements. 6. Activity-category → Focus-Area mapping approval and legacy/custom focus-tag treatment. 7. BG-1 technology/hosting choice. 8. Whether the fallback treatment for pre-existing seeded members (no selections) is acceptable.

## 15. Boundaries

GF-01/02/03/04 behaviour, the four Group Feed families, and migration 025 are unchanged. No migration created or reserved. No scheduler, media upload, Kudos, Share, announcement or recommendation code. No application code. No deployment, no production access. V1 not consulted for design. Miledge authority not copied into Tiizi. **No PR opened.**

**Disposition:** TIIZI MEMBER COMPLETION FOUNDER DISPOSITION 001 — FOUNDER DECISIONS RESOLVED / PRE-PILOT PROGRAMME DEFINED / AWAITING FINAL REVIEW AND PR.
