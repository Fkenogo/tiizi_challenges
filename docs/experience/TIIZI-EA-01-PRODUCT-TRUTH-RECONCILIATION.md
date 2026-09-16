# TIIZI-EA-01 — Experience Reference & Product-Truth Reconciliation

**Document type:** Product-Truth reconciliation and experience-binding record

**Work package:** TIIZI-EA-01 — Experience Reference Adoption & Product-Truth Reconciliation

**Status:** RECORDED

**Date:** 2026-09-16

**Entry main SHA:** `4cac50d225a381b36b535d9497154bfb21c0c80f`
(Master Programme v1.65; `Fkenogo/tiizi_challenges`)

**Adopted Experience Reference:** `Fkenogo/tiizi-prototye` @
`cfa696fbd09180c6fdaeaf14d2e8784d8b05d6a6` (see
[`TIIZI-EXPERIENCE-REFERENCE-ADOPTION-RECORD.md`](TIIZI-EXPERIENCE-REFERENCE-ADOPTION-RECORD.md))

**Companion documents:**
[`TIIZI-EXPERIENCE-INTEGRATION-MAP.md`](TIIZI-EXPERIENCE-INTEGRATION-MAP.md)

---

## 0. Purpose, inputs and constraints

**Purpose.** Reconcile Tiizi Product Truth with the adopted Experience
Reference, establish precedence, classify every member and operator surface,
identify documentation conflicts, dispose of PF-05, and propose the next
coherent implementation sequence — **without implementing UI**.

**Authoritative inputs reviewed**

- Programmes: `docs/programme/TIIZI-V2-MASTER-PROGRAMME.md`,
  `docs/programme/TIIZI-V2-PROGRAMME-GUIDE.md`,
  `docs/programme/STAGE-G-TIIZI-ENGINE-ALIGNMENT-ASSESSMENT.md`,
  `docs/programme/TIIZI-REPOSITORY-CLASSIFICATION-REPORT.md`.
- Constitutional / entity: `docs/governance/platform/00-CONSTITUTIONAL-FOUNDATION-INDEX.md`,
  `docs/governance/ownership/37-EOG-E1-01-TIIZI-ENTITY-AND-OPERATIONAL-GOVERNANCE-STANDARD.md`
  (EOG-E1-01), `docs/governance/ownership/06-EOG-02-…`,
  `docs/governance/ownership/34-GRP-FOUNDATION-CLOSURE-FOUNDER-DECISION-RECORD.md`,
  `docs/governance/ownership/36-EOG-05-CG-08-CONSTITUTIONAL-AMENDMENT.md`,
  `docs/governance/domains/02-GROUP-DOMAIN-STANDARD.md`,
  `docs/governance/domains/03-CHALLENGE-DOMAIN-STANDARD.md`.
- Stage F package (Founder-approved via `STAGE-F-FAD-01`, 2026-09-11):
  `STAGE-F-TIIZI-V2-PRODUCT-DEFINITION-DRAFT.md` (**T1**),
  `STAGE-F-TIIZI-V2-FUNCTIONAL-REQUIREMENTS-DRAFT.md` (**T2**),
  `STAGE-F-TIIZI-V2-CANONICAL-INFORMATION-CONTRACT-DRAFT.md` (**CIC**),
  `STAGE-F-TIIZI-V2-KNOWLEDGE-RUNTIME-CONTRACT-DRAFT.md`,
  `STAGE-F-TIIZI-V2-TECHNICAL-ARCHITECTURE-MAPPING-DRAFT.md`,
  `STAGE-F-TIIZI-V2-KNOWLEDGE-CONTENT-SPECIFICATION.md`,
  `STAGE-F-FOUNDER-APPROVAL-DECISION-STAGE-F-FAD-01.md`.
- Engines / domain: `api/src/challengeFinalization.ts` (EBC-04),
  `api/src/engine/**`, `api/src/challengeComposer.ts` (PF-04),
  `api/src/challengeDefinition.ts` (PF-03), `api/src/knowledge.ts` /
  `api/src/activityComponents.ts` (PF-01/PF-02),
  `api/src/challengeCreationAuthority.ts`, `api/src/groupMembershipAuthority.ts`.
- PF-05 evidence: branch `impl/pf-05-v2-challenge-creation-wizard-001`
  (head `59adcf2`), including `docs/architecture/TIIZI-V1-PRODUCT-EXPERIENCE-FREEZE.md`.
- Adopted Experience Reference: `docs/TIIZI-EXPERIENCE-REFERENCE.md`,
  `src/types.ts`, `src/App.tsx`, `src/components/**`, `src/data/assumptionsData.ts`
  at `cfa696fb…`.

**Constraints observed:** no UI implementation; no prototype source copied into
Tiizi; PF-05 not merged; PF-06 not begun; no deployment; no production data; no
PF-01→PF-04 reopened; no engine semantics changed; V1 not made a compatibility
requirement; no Product Truth invented from prototype mock behaviour.

**A note on Stage F filenames.** The Stage F documents retain `-DRAFT` in their
filenames but are **Founder-approved** (`STAGE-F-FAD-01`, 2026-09-11) and are
the current governed V2 product/technical baseline. They are treated here as
Product Truth (layer 3).

---

# PART A — Governance precedence review

## A.1 Authority model

| # | Layer | What it governs | Examples | Decides |
| - | ----- | --------------- | -------- | ------- |
| 1 | **Constitutional / enduring Product Truth** | The product world, entities, authority, truth and integrity | Platform Constitution; Constitutional Ontology (Doc 00); Domain Standards; CGP-01/02/03/04; EOG-E1-01 §§1–9; Glossary | Meaning, authority, inviolable boundaries |
| 2 | **Entity & operational Product Truth** | Roles, membership, stewardship, charter, creation rights, lifecycles | EOG-E1-01 §§10–40; EOG-02; GRP Foundation Closure decisions | Who may do what, to whom, under what governance |
| 3 | **Product / technical contracts** | What V2 must do and the contracts implementation must satisfy | Stage F: T1, T2 (FR-V2-…), CIC, KRC, TAM, KCS; `STAGE-F-FAD-01` amendments | Required behaviour, information boundaries, invariants |
| 4 | **Engine / domain authority** | Executable domain truth | PF-01→PF-04 contracts; `api/src/engine/**`; finalization/result contracts (EBC-04); Group/Membership authority (Firestore live, PG shadow non-authoritative); Knowledge/Activity contracts | Computed results, lifecycles, validation, eligibility |
| 5 | **Adopted Product Experience Architecture** | Human-facing assembly | Experience Reference @ `cfa696fb…`; this record | Shell, navigation, journeys, composition, information hierarchy, presentation |
| 6 | **Programme sequencing / status** | Order, dependencies, current position | Master Programme; Programme Guide; Stage G assessment | What work comes next — **never** product behaviour |
| 7 | **Existing implementation** | Evidence of what has been built (V1 and V2) | `src/**`, `api/src/**`, V1 routes | Nothing authoritative; evidence only |
| 8 | **V1 reference material** | Historical intent, terminology, lessons, reusable primitives | V1 `/app/*`, `BottomNav`, V1 screens | Nothing; reference-only |

Layers 1–4 are Product Truth. Layer 5 governs assembly. Layer 6 governs
sequence. Layers 7–8 are evidence, never authority.

## A.2 Precedence determinations

**A. Experience Reference conflicts with V1 UI.**
→ **Experience Reference prevails.** V1 is layer 8, frozen reference-only. V1
screens, navigation, journeys and composition must not determine V2 shell,
navigation, journeys, IA or interaction composition.

**B. Experience Reference conflicts with old implementation assumptions.**
→ **Experience Reference prevails**, subject to layer 1–4. Implementation
(layer 7) is evidence. Where the old implementation encodes an assumption not
backed by Product Truth, the assumption is discarded; where it encodes Product
Truth, that truth is retained and the Experience Reference is adapted to it.

**C. Experience Reference conflicts with a programme document.**
→ **Depends on what the programme document is doing.**
- If it records **sequencing/status** (layer 6), the programme document is
  **amended** to accommodate the adopted Experience Reference. The Experience
  Reference is not degraded to preserve a sequence.
- If it records **Product Truth** (layers 1–3), Product Truth prevails and the
  conflict is handled as case D.

**D. Experience Reference conflicts with explicit Product Truth.**
→ **Product Truth prevails**, then apply the decision procedure in §A.3:
adapt the Experience Reference, or — if the documentation is **not** substantive
truth and the change introduces **no material security, integrity, privacy or
scope consequence** — amend the documentation. Otherwise the conflict is
**flagged for Founder decision**.

**E. Product Truth is silent and the Experience Reference supplies an
experience decision.**
→ **The Experience Reference supplies the decision**, binding as experience
architecture. It is recorded as an **experience decision**, never as Product
Truth. If the decision implies domain authority, permissions, lifecycle,
scoring, or scope, it is escalated (Founder decision or domestic classification),
not silently absorbed.

## A.3 Decision procedure for a discovered conflict

1. Identify the **exact** conflict (document, section, wording).
2. Determine whether the conflicting rule represents **explicit Product Truth**
   (layer 1–3) or programme/implementation/legacy material (layer 6–8).
3. If explicit Product Truth, determine whether changing it would introduce a
   material **security / integrity / privacy / product-scope** consequence.
4. If **no** such consequence applies, **amend the documentation** rather than
   degrade the adopted experience.
5. If such a consequence applies, **flag for Founder decision**.
6. Never silently change Product Truth. Never silently change the Experience
   Reference.

## A.4 Standing determinations

- **V1 UI/implementation must not override the adopted Experience Reference.**
- Programme/documentation is amended where necessary, unless it represents
  substantive Product Truth or a material safety/integrity/privacy/scope
  constraint.
- The Experience Reference may never establish domain authority, permissions,
  lifecycle, scoring, Challenge/Knowledge semantics, Group authority, Member
  eligibility or result truth.

---

# PART B — Experience-to-truth reconciliation matrix

## B.0 Taxonomy

| Code | Disposition | Meaning |
| ---- | ----------- | ------- |
| **BIND** | BIND AS-IS | Reference expectation already matches Product Truth; assemble as designed against existing/authoritative capability. |
| **ADAPT** | BIND WITH EXPERIENCE ADAPTATION | Product Truth governs; the reference needs a **bounded experience-level** change to fit. No Product Truth change. |
| **IMPLEMENT** | IMPLEMENT MISSING CAPABILITY | Product Truth permits/expects it; no V2 capability (domain or UI) exists yet. Build it. |
| **DOC-AMEND** | DOCUMENTATION AMENDMENT REQUIRED | Existing documentation wording would block the adopted experience with no material safety/integrity/privacy/scope reason. Amend the document. |
| **FOUNDER** | FOUNDER DECISION REQUIRED | Product Truth is silent or genuinely ambiguous with material scope/commercial/legal/authority consequence. |
| **REF** | REFERENCE ONLY | Design reference; not a V2 contract (usually because upstream governance is deferred or the item is mock-only). |
| **OOS** | OUT OF CURRENT SCOPE | Excluded from initial V2 scope. |

Product Truth is cited by short key: **EOG** = EOG-E1-01; **T1**/**T2**/**CIC** =
Stage F package; **EBC-04** = engine/finalization truth; **PF-0n** = domain
contract; **HAD** = Stage G Hybrid Architecture Decision.

## B.1 MEMBER surfaces

| # | Item | Experience Reference expectation | Product Truth source | Current implementation | Mismatch / gap | Disposition | Security / integrity / privacy / scope | Recommended slice |
| - | ---- | -------------------------------- | -------------------- | ---------------------- | -------------- | ----------- | -------------------------------------- | ----------------- |
| M1 | Authenticated shell | Mobile-first member shell; primary nav Today/Challenges/Groups; tablet/desktop shells; header (brand, bell, profile); Reference tools isolated from product UI | Identity boundary is Firebase Auth (HAD); no V2 shell in Product Truth | V1 `/app/*` shell + `BottomNav`; V2 routes bolted onto mixed `App.tsx` (PF-05 branch, unmerged) | No V2 shell exists; V1 containment remains the de-facto shell | **IMPLEMENT** (+ **ADAPT** to retire V1 containment) | Auth boundary must not be replaced; security-critical | **S1** |
| M2 | Today | Action home ordered: required activity → challenge attention → invitations → upcoming → community moments. No generic dashboard | T1 §O ("Home is not a Feed"); T2 FR-V2-128 (no separate Home Feed; Group Feed is single community stream) | None in V2; V1 Home is frozen | Today's "community moments" must not become a second feed | **ADAPT** (bounded recent-community summary linking to Group Feed) + **IMPLEMENT** | Privacy: avoid duplicating/auto-broadcasting community stream | **S5** |
| M3 | Navigation | Primary Today/Challenges/Groups + contextual Activity Guide; secondary via profile drawer/footer; no crowding | Product Truth silent (experience decision) | V1 `BottomNav` (frozen) | V1 nav must not carry forward | **IMPLEMENT**; reference supplies decision where PT silent | None | **S1** |
| M4 | Onboarding | Explains what Tiizi is, why groups, challenges/participation, join/create/discover; states brand new / no group / in-group-no-challenge / invited group / invited challenge / active commitments; no forced setup | Admission modes EOG §6; membership ≠ participation EOG §2/§11 | V1 Onboarding frozen | V1 onboarding assumptions must not carry forward | **IMPLEMENT** + **ADAPT** | None | **S1** |
| M5 | Challenges | Discover → invite/request/join → joined → upcoming → active → completed → closed; membership ≠ participation; logging only after joining; capacity/flagged states | EOG §2/§11; Challenge Domain Standard §3; T1 §I; T2 §20 | `V2ChallengesScreen` (PF-05, unmerged, V1-contaminated); V1 browse frozen | Experience is V1-hosted; read model exists on PF-05 branch only | **ADAPT** + **IMPLEMENT** | None | **S3** |
| M6 | Challenge creation | 6-step guided wizard, human language first; archetype+template → host group+story → activities → metrics/targets → schedule/timezone → review + explicit creator-participation decision (never auto-enrol) | PF-04 Composer contract (merged) — **nine-stage** governed flow; PF-03 validator; EOG §2/§11 (no auto-enrol) | PF-04 Composer domain merged; Wizard UI exists only on unmerged PF-05 branch | Reference 6-step grouping ≠ PF-04 nine-stage contract | **ADAPT** (map 6 human steps onto PF-04 nine stages; do not change PF-04) | Integrity: PF-03 remains single semantic authority | **S2** |
| M7 | Challenge templates | Pre-filled configurations, not an authority; browse → preview → use → edit allowed fields → create through same Wizard | Master Programme PF-06 direction (Templates via same Wizard; never bypass PF-03) | Not implemented (PF-06 not begun) | No template domain/UI | **IMPLEMENT** (gated by PF-06) | None | **S7** |
| M8 | Challenge detail | Full operational detail (not Feed); upcoming/closed/completed disable logging; results recap; Run Again on completed | T1 §I; T2 §20 FR-V2-120…127; EBC-04 | `V2ChallengeDetailScreen` (PF-05, unmerged, V1 nav exits) | V1-hosted navigation/logging exits | **ADAPT** | None | **S3** |
| M9 | Participation / join | Join / request / invite; explicit; capacity and eligibility respected; live Group membership gate | EOG §11 (only current Group Member may join); HAD (Firestore live membership); `api/src/challengeParticipations.ts` | Domain exists (participation episodes); no V2 experience | Read/experience layer only | **BIND** (to participation domain) | Eligibility must remain server-authoritative | **S3** |
| M10 | Activity logging | Logging UI appears only after joining; upcoming/closed/completed disable logging; per-activity/component entry; note; no verification claim | EOG §2/§11; ACT-03 (verification) deferred; PF-02 components | V1 logging + PF-05 preview; `api/src/submissionIntents.ts`, `challengeActivityApplication.ts` | V1 logging exits; no V2 logging experience | **ADAPT** + **IMPLEMENT** (UI) | Avoid implying verification (ACT-03 deferred) | **S3** |
| M11 | Together (collective) | Collective progress; early completion with overshoot frozen | EBC-04 collective engine; T1 | Engine merged | No V2 experience | **BIND** (engine truth) + **ADAPT** (presentation) | None | **S3** |
| M12 | Race (competitive) | Standard competition ranking (1,2,2,4); ties shared; non-finishers rankless; window stays open | EBC-04 / competitive engine; `STAGE-F-FAD-01` competitive amendment | Engine merged | No V2 experience | **BIND** | Integrity: frozen ranking truth | **S3** |
| M13 | Streak | Governing-timezone day boundaries; missed-day reset; Days Completed / Best Streak preserved | EBC-03 streak engine; T1; EOG | Engine merged | No V2 experience | **BIND** | None | **S3** |
| M14 | Results / finalization | Sealed archive; finalized immutable; no logging on completed | EBC-04 migration 012 (`challenge_finalizations` / `challenge_participation_finals` append-only); T1 §I/§N; EOG §13/§38 | Engine merged | No V2 experience; ACT-04 repair deferred | **BIND** | Integrity: finalized history immutable | **S3** |
| M15 | Run Again | New Challenge, same configuration, **zero participants**; prior members rejoin/reinvited affirmatively | T2 FR-V2-123…127; EOG §17; CIC Invariant #8 | New-identity establishment exists; dedicated copy operation not implemented (Stage G: P1) | Run Again copy/authoring operation missing | **BIND** (new-identity semantics) + **IMPLEMENT** (operation) | Integrity: original history intact | **S3** |
| M16 | Groups | Discover → create → join/request → invite → roster + steward(s) + active/upcoming/completed + rules + creation permissions; healthy/restricted/flagged | EOG §3/§5/§6/§7/§27; EOG-02; Group Domain Standard | V1 Groups frozen; no V2 Groups experience | "steward(s)" plural vs singular Accountable Steward; "valid Group rule" must resolve to Group Charter | **ADAPT** | None | **S4** |
| M17 | Group creation | Create group; creator becomes steward | EOG §3 (any Tiizi Member may establish; creator = first Member + initial Accountable Steward) | Group authority domain exists (EBC-01) | No V2 experience | **BIND** | None | **S4** |
| M18 | Group membership | Join / request / invite; roster; leave; admission modes Open/Approval/Invitation | EOG §6/§7; HAD (Firestore live authority; PG shadow non-authoritative) | Domain exists (`groupMembershipAuthority.ts`) | No V2 experience | **BIND** | Eligibility must remain server-authoritative and fail-closed | **S4** |
| M19 | Group stewards | Steward(s); add/remove + history | EOG §3 (exactly one Accountable Steward at a time); §28 delegation (explicit/scoped/attributable/revocable) | Domain roles exist | Plural co-equal steward display would misstate governance; steward history not allocated | **ADAPT** (singular Accountable Steward + delegated admins; history **REF** pending governance) | Integrity: authority must be attributable | **S4** |
| M20 | Group charter | Member-visible agreement; versioned draft/active; suggested clauses + custom + publish | EOG §5 (every Group has a Charter); content/amendment/versioning **deferred** (EOG-02 §5; GRP Closure §7) | Not implemented | Reference imagines charter lifecycle not yet governed | **ADAPT** (visibility) + **REF** (lifecycle/versioning semantics) | Scope: must not invent binding enforcement | **S4** |
| M21 | Group council | Optional; disabled by default; advisory/challenge-committee/moderation; no voting authority | EOG §5; CG-08 (Group Governance Body / Stewardship Council recognised, optional); composition/procedure **deferred** | Not implemented | Detail deferred | **REF** (semantics) + **ADAPT** (visibility) | Scope | **S4** |
| M22 | Group rules | Rules list; join requests; reports/flags | EOG §5 (Charter governs group operating rules); moderation authority not fully allocated | V1 rules only | Moderation/report authority unresolved | **ADAPT** + **FOUNDER** (moderation scope) | Integrity/fairness | **S4** |
| M23 | Group challenge-creation permissions | Open by default; restricted groups show steward-curated + request access | EOG §10/§27 (any Group Member may create unless Charter validly restricts) | Enforced in `api/src/challengeCreationAuthority.ts` | "valid Group rule" → must be a valid **Charter** restriction | **BIND** | None | **S4** (surface) / **S2** (enforcement already exists) |
| M24 | Activity Guide | Contextual/secondary (Variant B default); full catalogue secondary; surfaced in creation/logging/detail | PF-01 Knowledge contract; EOG-03 knowledge governance; CLU-01 | Not implemented as V2 experience | No member-facing Guide | **IMPLEMENT** + **BIND** (to PF-01) | None | **S6** |
| M25 | Activity detail | How it works, safety guidance, supported metrics/units, components, eligibility, localisation | PF-01/PF-02; Activity Content & Catalogue Definition standards; Load Reporting Convention 08; EOG-03 | Domain exists; no V2 experience | Read surface missing | **BIND** + **IMPLEMENT** (UI) | Safety guidance must be governed content | **S6** |
| M26 | Knowledge / measurement | Metric/unit compatibility; components (both/either); load reporting basis; never silently sum; no unlike-metric conversion | PF-02 (merged); Load Reporting Convention 08; Measurement & Reporting Standard 02 | Domain merged | No V2 experience | **BIND** | Integrity: no silent summation/conversion | **S6** (surfaced in S2) |
| M27 | Profile | Identity, groups, active/completed challenges, recognition, notification prefs (9), language, privacy, account (export/deactivate), support; no biometric dashboards | EOG privacy/visibility (requirements layer); T1 §U.11 (Challenge History ≠ achievement showcase) | V1 Profile frozen | No V2 profile; export/deactivate mechanisms not governed | **IMPLEMENT** + **REF** (export/deactivate) | Privacy: controls must map to governed visibility | **S8** |
| M28 | Recognition | Policy-qualified record from Derived Truth; not automatic; never a verified credential; distinct from Kudos; shown in Profile + results recap | EOG §33–36; T1 §U.2–§U.12; T2 FR-V2-142…147; CIC §4.23; **MOT-01 deferred** | None | Reference models tiers/badges; T1 §U.9 (no broad badge/level) and §U.10 (milestone badges deferred); "policy-qualified" is non-canonical wording | **FOUNDER** (MOT-01 qualification) + **ADAPT** (vocabulary → "governed qualification conditions"; defer tier/badge vocabulary) + **REF** until MOT-01 | Scope/integrity: no credential or automatic-award implication | **S8** |
| M29 | Kudos | Lightweight peer acknowledgement; feed counters; never Platform Recognition; no governed authority | EOG §36; T1 §Q; T2 FR-V2-131/132; CIC §4.22 | None | Feed publication rules must respect FR-V2-129/128 | **BIND** + **ADAPT** (publication limits) | Privacy: routine logging must not auto-publish | **S3**/**S8** |
| M30 | Notifications | 9 purposeful categories; empty state | Stage F Notifications baseline (cited by FR-V2-128 source); notification events feed Group Feed / Today | V1 notifications only | No governed notification contract surfaced | **IMPLEMENT** + **ADAPT** (map to governed events) | None | **S8** (centre); events cross-cutting earlier |
| M31 | Support Tiizi (general) | Support ledger; no custody implied | T1 §V; T2 §27 FR-V2-152…160; CIC §4.24; CIC Invariant #5 | V1 donate flows frozen | Donation authority **unallocated** (EOG-05 SUP-01/02 pending) | **IMPLEMENT** (gated) + **FOUNDER** (authority/payment) | Scope/legal | **S8** |
| M32 | Challenge-linked voluntary Support Tiizi | Optional per-challenge offer; off by default; suggested amounts + custom; offered on join/during/both; never scored; never affects progress/recognition/results; never mixed with Cause | T1 §V.1–§V.6, §T.8; T2 FR-V2-159/167/168; CIC §4.24; Invariant #5; PF-04 Composer carries **no** donation fields | Not implemented | Must stay outside the Composer domain | **BIND** (reference matches truth) + **FOUNDER** (authority allocation) | Integrity: never a participation condition | **S8** |
| M33 | Community Cause | Dedication + self-reported external pledge; **no** verified "Amount Raised"; no custody; no escrow | T1 §W.8–§W.15; T2 §28 FR-V2-204/205; CIC §4.25/4.26; `STAGE-F-FAD-01` (Social Cause custody NOT authorised) | Not implemented | Legal/regulatory downstream | **BIND** + **FOUNDER** (cause custody scope) + **REF** until authorised | Scope/legal | **S8** |
| M34 | Localisation | en + partial sw with fallback; missing-language state | Locale priority is an open Founder decision (reference Assumptions Register); KCS/KRC content contracts | V1 has none | Priority undecided | **FOUNDER** (locale priority) + **IMPLEMENT** (scaffolding) | None | **S1** (scaffolding) / **S8** (content) |
| M35 | Privacy / account settings | Privacy controls; account export/deactivate (mock) | EOG privacy/visibility (requirements layer; mechanisms downstream) | V1 settings frozen | Data-rights mechanisms not governed | **IMPLEMENT** + **REF** (export/deactivate) + **FOUNDER** (data-rights mechanism) | Privacy/legal | **S8** |

## B.2 OPERATOR surfaces

| # | Item | Experience Reference expectation | Product Truth source | Current implementation | Mismatch / gap | Disposition | Security / integrity / privacy / scope | Recommended slice |
| - | ---- | -------------------------------- | -------------------- | ---------------------- | -------------- | ----------- | -------------------------------------- | ----------------- |
| O1 | Operator shell | Dedicated dense console, desktop-first, 13 sections | EOG §29 (administrator status is an operational mechanism, not unrestricted authority); operator authority **unallocated** | None | Authority model undefined | **IMPLEMENT** (shell) + **FOUNDER** (authority scope) | Security: no implied superuser | **S9** |
| O2 | Overview | Control centre; needs-attention cards that link to management areas; no vanity metrics | Silent (experience) | None | Actionability depends on authority | **IMPLEMENT** + **FOUNDER** | Security | **S9** |
| O3 | Users | Full management: overview, groups, challenges, roles, recognition, support, activity/audit; suspend/reactivate; grant/revoke role; platform roles; remove elevated access; no impersonation; confirmation + audit | EOG §29; platform role model not Product Truth (reference Assumptions Register: NEEDS FOUNDER DECISION) | None | RBAC undefined | **FOUNDER** (platform role/RBAC model) + **IMPLEMENT** (read) + **REF** (mutations) | Security/privacy | **S9** |
| O4 | Groups | Overview (metadata edit), members, stewards, council, charter, challenges (link + creation-rule control), rules, join requests, reports/flags, history | EOG §3/§5/§10/§28; EOG-02; deferred detail | None | Singular steward; charter publish authority; moderation scope | **ADAPT** + **FOUNDER** + **IMPLEMENT** | Integrity: no silent truth edits | **S9** |
| O5 | Activities & Knowledge | Full lifecycle: create/edit/draft/publish/unpublish/retire/restore/duplicate/version; editable fields; metric/unit compatibility; load basis | PF-01/PF-02; EOG-03; CLU-01; Load Reporting Convention 08 | Domain merged; no admin UI | Management surface missing | **IMPLEMENT** + **BIND** (bind to PF-01/02 lifecycle & versions) | Integrity: nothing destructive | **S9** |
| O6 | Challenges | Row detail (group, creator, participants, type, setup, window, state, result, flags, finalized, audit); mock restrict/hide/moderate; active truth never rewritten | EBC-04 immutability; T1 §I.4 (no reopening under same identity); moderation authority unallocated | PF-05 preview only | Reference "reopen pending review" **conflicts** with ended-terminal truth | **ADAPT** (replace "reopen" with Run Again = new identity) + **FOUNDER** (moderation) + **IMPLEMENT** | Integrity: frozen history must not be rewritten | **S9** |
| O7 | Templates | Full CMS: create via Wizard Template-Authoring mode, edit draft, preview, duplicate, save draft, publish, unpublish/withdraw, retire, restore, visibility, history | Master Programme PF-06 direction; PF-03/PF-04 | Not implemented (PF-06 not begun) | Domain missing | **IMPLEMENT** (gated PF-06) | None | **S7** / **S9** |
| O8 | Review & Attention | Unified queue; per-row detail; only fit-for-item actions; separated approvals / moderation / attention; mock; confirmation + audit; permission-dependent; no new authority | Authority **unallocated** (reference Assumptions Register: NEEDS FOUNDER DECISION) | None | No governed approval/moderation model | **FOUNDER** + **IMPLEMENT** (read) + **REF** (actions) | Security/integrity: no blanket approval authority | **S9** |
| O9 | Donations / Support | Three ledgers (A general support, B challenge-linked support, C cause support) with detail; mock resolve/assign/escalate; no custody | T1 §V/§W; EOG-05 SUP-01/02 pending | V1 donation admin frozen | Authority/custody unallocated | **FOUNDER** + **IMPLEMENT** (read, labelled mock) + **REF** (actions) | Scope/legal | **S8**/**S9** |
| O10 | Content & Localisation | Inspect items; translations; missing items; readiness; fallback; editor; mock add/edit translation, mark ready, return for revision | EOG-03; KCS; locale priority Founder decision | None | Priority undecided | **FOUNDER** + **IMPLEMENT** | None | **S9** / **S8** |
| O11 | Access & Roles | Interactive role catalogue; holders per role; grant/revoke; scope change; role history; experience-only | Platform roles/RBAC not Product Truth (NEEDS FOUNDER DECISION); EOG §29 | None | No governed role model | **FOUNDER** + **REF** | Security: access control must be real when built | **S9** (after decision) |
| O12 | Platform Health | Services healthy/degraded/incident/maintenance + recent events; labelled UX simulation, not telemetry | Silent | None | Must be labelled simulation | **IMPLEMENT** (labelled) + **REF** | None | **S9** |
| O13 | Audit Log | Session mock actions + reference history; what/who/when/where/prev-new | EOG §29 (attributable/reviewable); EOG-01 accountability | None | Retention/audit model undefined | **IMPLEMENT** (audit read model) + **FOUNDER** (retention) | Integrity: attribution required | **S9** |
| O14 | Settings | Operator preferences (mock) | Silent | None | — | **IMPLEMENT** (labelled) + **REF** | None | **S9** |
| O15 | Commercial / subscription placeholder | EXPERIMENTAL plan/status/billing/entitlement/trial/grace; clearly labelled; isolated; NEEDS FOUNDER DECISION | Commercial model undecided (reference Assumptions Register) | None | Model undecided | **FOUNDER** + **REF** + **OOS** until decided | Scope/commercial | none / **S9** |

## B.3 Reconciliation outcome summary

| Disposition | Member | Operator | Total |
| ----------- | -----: | -------: | ----: |
| BIND (as-is) | 14 | 0 | 14 |
| ADAPT | 9 | 2 | 11 |
| IMPLEMENT | 9 | 7 | 16 |
| DOC-AMEND | 0 | 0 | 0 (document amendments are recorded in Part C, not per surface) |
| FOUNDER | 2 | 6 | 8 |
| REF | 1 | 0 | 1 |
| OOS | 0 | 0 | 0 |
| **Total** | **35** | **15** | **50** |

Counts are **primary** dispositions. Many rows carry a secondary annotation
(for example, a BIND row that still needs an experience re-brand, or an
IMPLEMENT row that remains Founder-gated); the secondary annotations are in the
matrix and are not counted twice.

**Key finding:** no member/operator surface requires Product Truth to change.
Every conflict is resolved by experience adaptation, an implementation slice, a
documentation amendment, or a scoped Founder decision.

---

# PART C — Document governance review

## C.1 Conflicts found

| # | Document | Wording / section | Conflict | Assessment | Resolution |
| - | -------- | ----------------- | -------- | ---------- | ---------- |
| C1 | `TIIZI-V2-MASTER-PROGRAMME.md` (v1.65) §2 Dashboard, Stage G row (line 30) | "PF-05 — V2 Challenge Creation Wizard is next (not begun)." | States PF-05 is next when EA-01 must precede further experience work, and PF-05 is implemented-but-unapproved | Programme sequencing/status (layer 6), not Product Truth | **AMENDED** (this work package) |
| C2 | same, §4 "Next Action" (line 72) | "PF-05 — V2 Challenge Creation Wizard is next (not begun); PF-06 … follows PF-05." | Sequences PF-06 without accounting for Experience Reference integration; treats PF-05 as not begun | Layer 6 | **AMENDED** |
| C3 | same, §23 Change Log rows v1.64–v1.65 | "PF-05 Wizard next (not begun); PF-06 Templates follows." | Preserves obsolete PF-05 experience assumption as current sequence | Layer 6 (historical rows must not be rewritten — corrected forward in v1.66) | **AMENDED forward** (v1.66 row added; historical rows preserved) |
| C4 | `TIIZI-V2-PROGRAMME-GUIDE.md` | "Current governed baseline: Master Programme v1.31 … Stage F NOT STARTED" + stale stage statuses | Contradicts canonical Master Programme v1.65 and risks contradictory orientation | Layer 6 orientation doc | **AMENDED minimally** (pointer to Master Programme; EA-01 orientation section added) |
| C5 | `docs/architecture/TIIZI-V1-PRODUCT-EXPERIENCE-FREEZE.md` (exists **only** on unmerged branch `impl/pf-05-…`) | "Experience Reference **IN DEVELOPMENT / NOT YET ADOPTED**" | Superseded by the adoption | Not current authority on `main` | **RECORDED as superseded** (Adoption Record §8); document amendment belongs to the PF-05 disposition work (do not merge PF-05) |
| C6 | `api/src/challengeComposer.ts` header comments | "consumed by the future PF-05 V2 Challenge Creation Wizard"; "PF-06 will generate Templates…" | Code comments describe PF-05/06 sequencing | Not documentation authority; comments remain true for PF-06 direction | **NO ACTION** (informational; no product-behaviour impact) |
| C7 | `TIIZI-V2-PROGRAMME-GUIDE.md` §2 | "No blanket decision to preserve or discard V1 should be made before Stage G." | Potential read as blocking the V1 freeze | V1 freeze is not a blanket preserve/discard of V1; it is a scope boundary consistent with "V1 is not the authority for V2 product truth" | **NO AMENDMENT REQUIRED** (clarified by EA-01 orientation note) |

No current document on `main` makes V1 the V2 experience host. No current
document on `main` requires V1 navigation or journeys. No current document on
`main` states the Experience Reference is a non-adopted candidate. No current
document treats technically implemented capabilities as the experience
architecture (beyond the PF-05 sequencing in C1–C3).

## C.2 Documentation amendments made by EA-01

1. **`docs/programme/TIIZI-V2-MASTER-PROGRAMME.md`**
   - Version 1.65 → **1.66**; metrics table updated.
   - Stage G dashboard row: PF-05 restated as **IMPLEMENTED / UNMERGED /
     experience NOT APPROVED**; EA-01 recorded; V2 Experience Foundation
     recorded as the next experience step; PF-06 remains not begun and is
     explicitly gated on Experience Reference integration.
   - §4 "Next Action": EA-01 recorded; PF-05 experience disposition recorded;
     PF-06 dependency recorded.
   - §23 Programme Change Log: **v1.66** row added.
2. **`docs/programme/TIIZI-V2-PROGRAMME-GUIDE.md`**
   - "Current governed baseline" line re-pointed to the Master Programme as
     authoritative instead of restating a stale version.
   - New section **"17. Experience Reference Adoption (EA-01)"** recording the
     adoption, the formula, the V1 freeze boundary, and pointers to
     `docs/experience/**`.
3. **`docs/experience/TIIZI-EXPERIENCE-REFERENCE-ADOPTION-RECORD.md`** (new).
4. **`docs/experience/TIIZI-EA-01-PRODUCT-TRUTH-RECONCILIATION.md`** (new,
   this document).
5. **`docs/experience/TIIZI-EXPERIENCE-INTEGRATION-MAP.md`** (new).

**Not amended (correctly):** constitutional instruments, domain standards,
EOG-E1-01, the Stage F package, and the adopted Experience Reference source.

## C.3 Amendments recommended but deliberately deferred

| # | Document | Recommended amendment | Why deferred |
| - | -------- | --------------------- | ------------ |
| D1 | `docs/architecture/TIIZI-V1-PRODUCT-EXPERIENCE-FREEZE.md` (on `impl/pf-05-…`) | Update Experience Reference status to ADOPTED; record EA-01 | Cannot be done by merging PF-05; belongs to the PF-05 disposition work package |
| D2 | `TIIZI-V2-PROGRAMME-GUIDE.md` §1/§5–§12 stage narrative; `TIIZI-V2-MASTER-PROGRAMME.md` §5 timeline / §6 "Stage E0 ← CURRENT" legacy narrative | Reconcile stage statuses with Master Programme v1.66 | Pre-existing drift, outside EA-01's bounded purpose; EA-01 points orientation to the Master Programme and avoids restating stale versions; recommend a separate orientation-freshness task |
| D3 | `api/src/challengeComposer.ts` header comments | Reference EA-01 experience binding | Code comments; no product impact; handle in the first experience slice |

---

# PART D — Programme transition

## D.1 Proposed bounded transition

It is recommended that the following is recorded as the **immediate bounded
transition before further PF-05/PF-06 experience implementation**:

> **TIIZI-EA-01 — Experience Reference Adoption & Product-Truth Reconciliation**

Scope: adopt the Experience Reference; freeze V1 as reference-only; establish
experience precedence; reconcile every member/operator surface; dispose of
PF-05; amend programme/direction wording; propose the vertical sequence. **No
UI implementation.**

Status after EA-01: the adoption is recorded; the reconciliation and integration
map are filed; PF-05 remains unmerged with its experience assembly NOT
APPROVED; PF-06 remains NOT BEGUN; no implementation is authorised.

## D.2 Validation of the proposed ordering

The expected direction was:

> EA-01 → V2 Experience Foundation → Challenge Creation → Challenge Experience
> → Groups Experience → Today → Activity Guide / Knowledge → Templates →
> Profile / Recognition / Notifications / Support → Operator management surfaces.

**Validated with corrections:**

1. **Foundation first — correct and mandatory.** Every slice mounts in the V2
   shell. Foundation must also resolve V1 containment (`/app/*`, `BottomNav`
   retirement) and provide the member/operator frame, routing and localisation
   scaffolding. Without it every later slice would re-host itself in V1.
2. **Challenge Creation must be preceded by Group context, not necessarily the
   full Groups Experience.** The Creation slice needs a host-Group context and
   the creation-authority gate (already implemented in `api/src`), plus a
   minimal Group read/context resolution. The full Groups Experience can follow.
   → *Correction: S2 introduces minimal Group context; S4 completes Groups.*
3. **Challenge Experience before Groups Experience — correct.** Challenges are
   the product core and Groups surfaces consume Challenge state.
4. **Today after Challenge and Groups Experience — correct.** Today composes
   required activity, attention, invitations and upcoming events from those
   slices; it cannot precede them without fabricating state.
5. **Activity Guide / Knowledge after Challenge Experience — correct.** The
   Guide is contextual (creation, logging, detail); those surfaces must exist
   first. The PF-01/PF-02 domain is already available for the creation slice.
6. **Templates after Knowledge — correct, and PF-06-gated.** Templates are
   pre-filled configurations of activities/metrics; they depend on the Guide,
   the Creation slice and PF-06.
7. **Notifications is cross-cutting, not a late surface.** Notification
   *events* (challenge_start, streak_reminder, invite) are consumed by
   Challenge/Groups/Today. → *Correction: define the governed notification
   event mapping during/after the Challenge Experience slice; build the
   notification centre UI late.*
8. **Recognition and Support are Founder/authority-gated, not merely late.**
   Recognition depends on MOT-01; Support/Cause depends on donation authority
   allocation and cause-custody scope. These must not block earlier slices; they
   are scheduled last and entered only when the associated Founder decision is
   recorded.
9. **Operator surfaces last — correct, and staged.** Read/detail surfaces can
   be built once the member slices expose the truth; action/mock-mutation
   surfaces must wait for the Access & Roles / operator-authority decision.
10. **Commercial placeholder excluded** until the commercial model decision.

## D.3 Recommended vertical integration sequence

| Slice | Name | Depends on | Entry condition |
| ----- | ---- | ---------- | --------------- |
| **EA-01** | Experience Reference Adoption & Product-Truth Reconciliation | — | **Recorded** |
| **S1** | **V2 Experience Foundation** — authenticated member/operator shell, primary navigation (Today/Challenges/Groups), contextual Activity Guide entry, routing, design tokens, localisation scaffolding, V1 containment retirement | EA-01; Firebase Auth boundary | EA-01 recorded |
| **S2** | **Group Context & Challenge Creation vertical slice** — host-Group context, creation-authority gate, PF-04 Composer → PF-03 preview → V2 establishment, explicit creator-participation decision | S1; PF-01→PF-04; EBC-01 | S1 assembled |
| **S3** | **Challenge Experience** — discovery/list, detail, join/request/invite, logging, Together/Race/Streak progress, results/finalization, Run Again; governed notification event mapping | S2; EBC-02/03/04; participation domain | S2 assembled |
| **S4** | **Groups Experience** — list, detail, roster, Accountable Steward + delegation, Charter visibility, Council visibility, rules, creation-permission, join requests | S1; Group/Membership authority (HAD) | S1 assembled; Founder moderation-scope decision for reports/flags |
| **S5** | **Today** — action home ordered required activity → attention → invitations → upcoming → bounded recent-community summary linking to Group Feed | S3; S4; FR-V2-128/129 | S3 + S4 assembled |
| **S6** | **Activity Guide / Knowledge** — contextual Guide, full catalogue secondary, authoritative activity detail, compatibility/component/load-basis surfacing | S2/S3; PF-01/PF-02; EOG-03 | S2 + S3 assembled |
| **S7** | **Templates** — authoring through the same Wizard (Template mode), member browse/use, visibility | S2; S6; **PF-06** | PF-06 authorised |
| **S8** | **Profile / Recognition / Notifications / Support** — profile, notification centre, recognition (MOT-01-gated), Support Tiizi, Community Cause; locale content | S3; S5; Founder decisions | MOT-01 for Recognition; donation authority + cause-custody scope for Support/Cause; locale priority |
| **S9** | **Operator management surfaces** — Overview, Users, Groups, Activities & Knowledge, Challenges, Templates, Review & Attention, Donations/Support, Content & Localisation, Access & Roles, Platform Health, Audit Log, Settings | S2–S8; Access & Roles decision | Read/detail may start once member truth exists; actions gated on operator-authority decision |
| **S10** | **Commercial / subscription placeholder** | Founder commercial model decision | Decision recorded |

## D.4 Proposed first implementation slice

**S1 — V2 Experience Foundation.**

Smallest coherent vertical output:

- an authenticated member shell that renders real identity and the reference's
  primary navigation (Today / Challenges / Groups + contextual Activity Guide);
- the operator surface frame reachable by surface switch (dormant sections
  permitted);
- responsive member (mobile-first) and operator (desktop-first) shells;
- design tokens and neutral primitives bound to the reference presentation;
- localisation scaffolding with English source and fallback;
- retirement of V1 containment as the V2 host (`BottomNav` no longer imported
  by any V2 experience module; V1 `/app/*` no longer the V2 entry);
- governed empty/loading/error states for the shell.

**Not in S1:** domain behaviour, Challenge creation, logging, engine exposure,
recognition, support, operator actions.

**Why not Challenge Creation first:** Creation cannot be assembled correctly
until the shell exists; doing Creation first would re-host it in V1 and
immediately violate the adopted experience and re-open the PF-05 defect
(Founder component review stopped exactly because composition was V1-influenced).

---

# PART E — PF-05 disposition

PF-05 (`impl/pf-05-v2-challenge-creation-wizard-001`, head `59adcf2`) is
**UNMERGED**. Its **domain/technical** integration is preserved and valid; its
**experience composition** is not approved.

## E.1 RETAIN DOMAIN / TECHNICAL

| Capability | Evidence | Status |
| ---------- | -------- | ------ |
| Composer binding (PF-04 Composer consumed by the creation flow) | `api/src/challengeComposer.ts` (merged, `1fc0c10`); `src/features/Challenges/V2/composerDraft.ts` (branch) | **RETAIN** |
| PF-03 validation wiring (preview through the single validator) | `api/src/challengeDefinition.ts` `registerChallengeDefinitionRoutes` (branch); PF-03 validator (merged) | **RETAIN** |
| Knowledge / activity selection | `api/src/knowledge.ts` `composerSelectable`; options seam (branch) | **RETAIN** |
| Metric / unit compatibility | PF-02 (merged); `api/src/activityComponents.ts` `describeActivityOptions` (branch) | **RETAIN** |
| Group identity bridge | `resolveEstablishmentGroupId` / V2 establishment seam | **RETAIN** |
| Live membership eligibility | Firestore live authority + PG shadow non-authoritative (HAD) | **RETAIN** |
| V2 establishment | `POST /v1/challenges` through PF-03 (merged) | **RETAIN** |
| V2 read model | `src/api/v2ChallengeApi.ts`, `v2ChallengeCreationApi.ts`, `v2ChallengeCreationMapping.ts` (branch) | **RETAIN** |
| Preview infrastructure | `api/src/previewComponentRoutes.ts`, `previewComponentGroup.ts`, seed CLIs, `src/api/v2ComponentPreviewMode.ts`, local preview harness docs and guards | **RETAIN** (tooling / reference; not the V2 product path) |

## E.2 REWORK EXPERIENCE

| Surface | Reason | Rework into |
| ------- | ------ | ----------- |
| `src/features/Challenges/V2/V2CreateChallengeWizard.tsx` | Imports `BottomNav`; returns to `/app/challenges/v2`; mounted below V1 onboarding/Group journey | S2 slice inside the S1 shell |
| `src/features/Challenges/V2ChallengesScreen.tsx` | Imports `BottomNav`; extends V1 route hierarchy | S3 slice inside the S1 shell |
| `src/features/Challenges/V2ChallengeDetailScreen.tsx` | Imports `BottomNav`; V1-hosted navigation and logging exits | S3 slice inside the S1 shell |
| `src/App.tsx` | Mixed composition root hosting V1 `/app/*` + V2 routes; not a future V2 shell | S1 Foundation composition root |
| `src/features/Challenges/V2/ChallengeCreationComponentPreview.tsx` | Preview-only composition | Keep as governed preview (S1/S2) or rework into the slice |
| `src/features/Challenges/V2/V2CreateChallengeWizard.runtime.test.tsx` | Tests the V1-hosted composition | Re-point at the S2 shell |

## E.3 RETIRE (from V2 experience)

| Item | Reason |
| ---- | ------ |
| `BottomNav` usage inside V2 experience modules | V1 product navigation; frozen |
| `/app/*` V1 containment as the V2 entry | V1 is not the V2 host |
| V1 Group prerequisite journey | V1 journey; not a V2 prerequisite |
| V1 onboarding assumptions | Superseded by the reference onboarding |
| V1 return paths (e.g. `/app/workouts/log`, `/app/challenges`) | Superseded by reference navigation |
| V1 challenge navigation | Superseded |

## E.4 REFERENCE ONLY

| Item | Reason |
| ---- | ------ |
| `docs/architecture/TIIZI-V1-PRODUCT-EXPERIENCE-FREEZE.md` (branch) | Correct principle, superseded status line; amend in PF-05 disposition, do not merge wholesale |
| Local preview harness runtime wiring | Tooling, not the product path |
| PF-05 Master Programme v1.66–v1.70 branch rows | Branch programme records, not canonical |

## E.5 PF-05 disposition summary

- **Domain/technical:** RETAIN (extract into main through a bounded,
  experience-free technical package, or re-apply the domain files onto `main`
  without the V1 composition).
- **Experience:** REWORK into S1/S2/S3 slices; do not polish the V1-hosted
  composition.
- **V1 remnants:** RETIRE from V2.
- **PF-05 as a package:** remains **NOT MERGED**; PF-05 is not merged by EA-01.

**PF-01 → PF-04 are not reopened.** Their merge status, migrations and contract
semantics are unchanged.

---

# PART F — Blockers

Only substantive blockers are reported. Ordinary UI adaptation is not a blocker.

## F.1 Genuine blockers

**None that prevent EA-01 or S1.**

The following are **Founder product-scope decisions** required before specific
later slices — not blockers to EA-01:

| # | Decision | Blocks | Nature |
| - | -------- | ------ | ------ |
| FD-1 | **MOT-01 — Recognition Authority** (qualification/issuance/withdrawal) | M28 / S8 Recognition | Unresolved Product Truth (preserved deferral) |
| FD-2 | **Donation / Support authority allocation** (EOG-05 SUP-01/SUP-02) and payment provider | M31 / M32 / O9 / S8 | Unallocated authority |
| FD-3 | **Community Cause custody / legal scope** | M33 / S8 | Product-scope + legal (custody already NOT authorised for V2) |
| FD-4 | **Operator authority / platform role (RBAC) model** | O1–O3, O8, O11 / S9 actions | Unallocated authority; security |
| FD-5 | **Moderation / reports / flags authority** | M22, O4, O8 | Unallocated authority; integrity/fairness |
| FD-6 | **Commercial / subscription model** | O15 / S10 | Product-scope + commercial |
| FD-7 | **Localisation priority (which locales, when)** | M34 / O10 | Product-scope |
| FD-8 | **V1 containment retirement timing** (when V1 UI is removed) | S1 | Scope; recommended: retire V1 as the V2 host at S1, keep V1 files as reference until an authorised retirement task |

## F.2 Genuine risks (resolved by disposition, not blockers)

| # | Risk | Type | Resolution |
| - | ---- | ---- | ---------- |
| R1 | Auto-publishing routine Activity logging to a community feed | Privacy | **ADAPT**: Group Feed publishes only governed state events + explicit shares (FR-V2-129); Today shows a bounded summary linking to the Group Feed |
| R2 | Reference "reopen pending review" on Operator Challenges | Integrity | **ADAPT**: replace with Run Again = new identity (T1 §I.4; EOG §17) |
| R3 | Plurals "steward(s)"/"Council voting" implying multi-equal governance | Integrity | **ADAPT**: singular Accountable Steward + explicit/scoped/revocable delegation; Council advisory, no voting authority |
| R4 | Recognition depicted with tiers/badges | Scope | **ADAPT**/**REF** until MOT-01; use "governed qualification conditions" vocabulary |
| R5 | Prototype persona switch / mock auth assumed real | Security | **ADAPT**: Firebase Auth boundary is authoritative; persona switch is reference-only |

## F.3 Non-blockers explicitly recorded

- UI adaptation differences (step count, labels, layout) — **not blockers**.
- Programme Guide staleness — **not a blocker**; handled by minimal amendment.
- Prototype self-description "NOT YET ADOPTED" — **not a blocker**; superseded
  by the Adoption Record.
- Unmerged PF-05 experience composition — **not a blocker**; dispositioned in
  Part E.

---

## Closing statement

Product Truth is unchanged. The adopted Experience Reference is unchanged. The
bounded transition is recorded, programme wording is aligned, PF-05 is
dispositioned, the vertical sequence is validated with corrections, and the
first implementation slice is proposed. No UI was implemented, no prototype
source was copied, no PF-05 work was merged, no PF-06 work began, nothing was
deployed, and no production data was modified.
