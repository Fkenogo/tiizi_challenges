# Stage E1 Entry Assessment — Entity & Operational Governance

**Status:** Assessment / evidence report. Not governing authority. Makes no substantive governance decisions, creates no entities, roles, permissions, workflows or policies, and amends no instrument.

**Authoritative basis:** `origin/main` at `c02ac4e` (Stage EK closed via PR #4). All citations resolve against that revision. Historical or draft material is labelled as evidence, not authority.

**Programme reference:** `docs/programme/TIIZI-V2-MASTER-PROGRAMME.md` v1.45, §13 (Stage E1), §14 (Stage F).

---

## 1. Executive conclusion

Stage E1 is **genuinely necessary and bounded**. The constitutional inventory (EOG-05 register, approved 2026-07-21 + CG-08 amendment), the relationship allocation state (CGP-04, approved 2026-09-01: 13 ALLOCATED, 12 DEFERRED, 0 requiring Founder allocation for E0 purposes), the authority-type architecture (Platform Authority Model), and the constitutional boundaries for Groups (EOG-02 + GRP closure GFC-01–GFC-05, approved 2026-07-21), Challenges (EOG-04, approved 2026-07-20), Platform Knowledge (EOG-03, approved) and Knowledge Assets (EKG-01 v0.1, approved 2026-09-02; Stage EK closed) are all settled and must not be reopened.

What remains is **one coherent operational-governance subject**: the procedures, lifecycles, role vocabulary, delegations, privacy/visibility rules and security/trust requirements that every governing instrument explicitly deferred. Twelve Founder questions (E1-FQ-01–12) require substantive Founder decisions before Stage F; five further questions are classified F / G / H / DEFER and must not be pulled into E1.

**Minimum sufficient E1: one integrated operational-governance instrument** (lifecycle + roles/permissions + admin delegation + privacy/visibility + security requirements + charter operations + recognition authority), approved by the Founder. No per-question documents. Of the five programme-listed E1 deliverables, one is SATISFIED and four are REQUIRED (one of them, Security & Trust, as governance requirements only — mechanisms belong to Stage H).

**No blocker** prevents commencing E1 once Founder-authorized. No implementation is authorized by this assessment.

---

## 2. Authoritative repository baseline

| Item | State |
|---|---|
| `origin/main` | `c02ac4edbe842c998a546f59bb10926515a2409c` — matches expected SHA |
| PR #4 (`recon/ek-final-reconciliation`) | Merged (`c02ac4e` merge commit); Stage EK closed (STAGE-EK-CLOSE-01, 2026-09-02); Master Programme v1.45 |
| Primary worktree (`/Volumes/PRODUCTION/Projects/tiizi_revamp`) | Local HEAD `5a01239`, 98 status entries of pre-existing modified/untracked work — **untouched**: no pull, reset, clean, stash, checkout, merge, deletion or synchronization performed |
| Assessment method | Read-only inspection of `origin/main` via detached clean linked worktree; no primary-worktree modification |

Stage position: Stage D Complete; Stage E0 Complete (CGP-02 + CGP-03 + CGP-04); Stage EK Complete; **Stage E1 Not Started** (authorized to commence when Founder-authorized); Stage F Not Started; no implementation authorized.

---

## 3. Current Stage E1 programme definition

Master Programme v1.45 §13 and `docs/programme/TIIZI-V2-PROGRAMME-GUIDE.md` §9 define Stage E1 identically:

- **Purpose:** "Complete the governed entity, lifecycle, role, permission, privacy, visibility, security and trust foundations required before constitutional meaning can be translated into product and technical requirements."
- **Deliverables:** Entity Ownership Register [x]; Lifecycle Standards [ ]; Roles & Permissions [ ]; Privacy & Visibility [ ]; Security & Trust [ ] — each subject to the standard Discovery → Draft → Founder Review → Validation → Traceability → Approval → Adoption Record → Programme/Dashboard Updated checklist.
- **Completion gate:** "The required entity inventory is authoritative; the applicable lifecycle standards are approved; roles and permissions preserve constitutional relationship boundaries; privacy and visibility are purpose-limited; and security and trust requirements are approved without substituting implementation for governance."
- **Dependencies:** Stage EK Complete (satisfied); the approved Entity Ownership Register is an input but "its existence does not complete Stage E1"; lifecycle/role/permission/privacy/visibility/security/trust work must preserve Stages D, E0 and EK.

The E1 purpose explicitly scopes **governance foundations**, not product behaviour or implementation — the E1/F boundary in §6 below is drawn on that basis, reinforced by CGP-03 closure discipline (CGP03-P15 no ceremony by analogy; P27 consolidation preference; P28 direct Founder decision; P30 closure evident not ceremonial).

---

## 4. Existing governed entity inventory

### 4.1 Constitutional inventory baseline: EOG-05 register (APPROVED)

`docs/governance/ownership/27-EOG-05-ENTITY-OWNERSHIP-REGISTER-APPROVED.md` (Approved 2026-07-21, CG-08 amendment applied): **72 candidates assessed — 58 proposed inclusions, 13 provisional under classification gates CG-01–CG-07, 1 provisional under MOT-01 (Recognition).** It is inventory-only: "No Entity Relationship Allocation Register has been drafted [at approval time]. No EOG-01 relationship is allocated by this document" (§15; relationship allocation now exists separately as approved CGP-04 — see §5).

| Group | Entity IDs | Concepts | Notes |
|---|---|---|---|
| Human and Identity | HID-01–HID-08 | Person; Identity; Profile; Preference; Interest; Consent expression; Consent record; Privacy choice | Consent items await later Consent standard; Privacy choice awaits future Privacy Standard |
| Group and Community | GRP-01–GRP-06, C-GRP-07, C-GRP-08 | Group; Membership relationship; Member; Group purpose; Group communication; Group administrative action; Group Charter; Group Governance Body (Stewardship Council alias) | GRP-04 purpose provisional (CG-01); C-GRP-08 permanent inventory treatment resolved by CG-08 amendment; Charter/Body await later governance |
| Challenge and Composition | CHL-01–CHL-08, C-CHL-09, C-CHL-10 | Challenge; Challenge purpose; Goal; Challenge Policy; Challenge participation relationship; Participant; Target; Challenge administrative action; Group Configuration; Community Context | CHL-02/03/07 provisional (CG-01); C-CHL-09/10 provisional (CG-02) |
| Activity, Evidence and Event | AEV-01–AEV-11 | Activity; Metric; Unit; Submission Intent; Acceptance Decision; Accepted Activity Event; Evidence Eligibility; Verification; Correction reference; Event administrative action; Event context | AEV-08 Verification meaning deferred (ACT-03); AEV-05 Acceptance criteria deferred (ACT rules) |
| Derived, Analytical, Presentation | DRV-01–DRV-11 | Progress; Completion; Ranking; Streak; Projection; Leaderboard; Feed item; Notification; Recognition; Analytical interpretation; Presentation summary | DRV-09 Recognition provisional (MOT-01); formulas/qualification deferred (RSK) |
| Knowledge | KNW-01–KNW-13, C-KNW-14–C-KNW-17 | Knowledge Asset (+ Activity/Metric/Unit/Instructional/Safety/Taxonomy variants); Knowledge relationship; Runtime Catalogue; Runtime availability; Runtime Projection; Historical Knowledge reference; Knowledge administrative action; Exercise Asset; Wellness Activity Asset; Template; Historical Representation | KNW-09 provisional (CG-03); KNW-12/C-KNW-17 provisional (CG-05); C-KNW-14/15 provisional (CG-04); C-KNW-16 Template provisional (CG-06) |
| Platform Control and Mechanisms | CTL-01–CTL-06, C-CTL-07 | Policy; Administrative record; Operational record; Audit record; Temporary information; Presentation information; Creation Mechanism | C-CTL-07 provisional (CG-07) |

Consolidated/excluded (not entities): Platform Knowledge (aggregate), Governed Knowledge, Authoritative Meaning, Constitutional Composition, Group Experience, Applicable Policy, Governed Review, **Undertaking (consolidated with Challenge for V2)**, Challenge Identity/Information/Integrity/Continuity, Group Governance Health, Governance Maturity (§9).

EOG-05 §13 explicitly defers: CG-01–CG-07; all relationship allocations (now CGP-04's function); GRP/CHL/ACT/KNW/RSK decisions not already approved; **entity lifecycle, amendment, archival, retention and deletion rules; roles, permissions, privacy and security**; formulas/scoring/Ranking/Streak/Recognition; technical identifiers/storage/interfaces/implementation.

### 4.2 Ontological and product concepts (Document 00)

`docs/governance/00-TIIZI-CONSTITUTIONAL-ONTOLOGY-AND-FOUNDATIONAL-PRODUCT-CONCEPTS.md` establishes the constitutional ontology — Platform, Community, Undertaking, Commitment, Evidence, Truth, Motivation, Growth (Part II); product concepts Platform, Group, Challenge, Participation, Evidence, Truth, Recognition, Growth (Part III); constitutional relationships (Part IV); principles including **Truth Before Recognition**, Participation Before Reward, One Community Many Undertakings, Voluntary Commitment (Part V). Undertaking → Challenge consolidation for V2 is confirmed by EOG-05 §9. No further E1 governance required for ontology itself; open operationalizations (Challenge Template, Creation Mechanism, Recognition qualification) are carried as FQs below, not as definitional work.

### 4.3 Per-concept E1 necessity

Every EOG-05 inventoried entity: **no further definitional governance required in E1** (inventory authoritative; CG-01–CG-07 gates are classification refinements that later governance "may support" via amendment — EOG-05 §11 — and none blocks Stage F entry except as noted in §9). Operational concepts whose **relationships, lifecycles or authorities** are deferred (Membership, Participation, Challenge establishment, Verification, Recognition, Charter, Governance Body operations, Consent/Privacy, administrative actions) require E1 governance as specified in §§7–9 — as operation/authority decisions, not redefinition.

---

## 5. Existing relationship coverage

### 5.1 Settled relationships (CGP-04 ALLOCATED)

`docs/governance/principles/CGP-04-ENTITY-RELATIONSHIP-ALLOCATION-REGISTER-v0.1.md` (Founder Approved, constitutionally effective, Complete — CGP-04-FAD-01, 2026-09-01), §6 register. Zero rows carry "UNALLOCATED — FOUNDER DECISION REQUIRED".

| Relationship | Allocation | Basis |
|---|---|---|
| Governance Authority → Founder | Founder exercising Governance Authority | Constitutional + CGP authority |
| Group creation → Creator | Creator establishes Group under existing Group governance | EOG-02 |
| Group Accountable Stewardship (initial + cardinality) | Creator becomes first Accountable Steward; exactly one per Group | EOG-02 |
| Group initial Membership | Creator becomes first Member | EOG-02 |
| Membership (Member ↔ Group) | Membership confers no governance authority | EOG-02 / EOG baseline |
| Challenge governed identity | Challenge is distinct governed subject / product expression of Undertaking | EOG-04 / ontology |
| Challenge participation | Participation relationship distinct from membership and governance authority | EOG-04 |
| Knowledge Authority → Authoritative Meaning | Where established | EOG baseline (+ EKG-01 §13: Founder is Knowledge Authority) |
| Participant Authority → Submission Intent | Participant governs own submission expression | EOG baseline (PAM §4.A) |
| Policy Authority → Evidence Eligibility | Policy governs eligibility; ≠ Derived Truth | EOG baseline (PAM §§4.E/5.5) |
| Acceptance Authority → Accepted Activity Event | Acceptance governs acceptance; ≠ calculation | EOG baseline (PAM §§4.F/5.4) |
| Calculation Authority → Derived Truth | Calculation governs truth; ≠ Recognition | EOG baseline (PAM §§4.G/5.5) |

Supporting settled distinctions: Community ≠ Group; Undertaking ≠ Challenge; Commitment ≠ Participation; Motivation ≠ Recognition; Evidence eligibility ≠ Derived Truth ≠ Recognition (CGP04-P08/P09); authority ≠ responsibility ≠ custody ≠ administration ≠ operation ≠ participation (CGP04-P05–P07, P21–P28); no authority by allocation record, no silent transfer, no general delegation by inference (§§2, 7–9); no product roles, no technical permissions, no Knowledge pre-emption, no product requirements created by the register (§12, P41–P45).

### 5.2 Partially settled relationships

- **Group stewardship continuity:** GFC-02-B approved (successor-continuous reassignment; Charter succession principle; existing Platform Authority establishes reassignment truth) — procedures/mechanisms deferred (E1-FQ-02).
- **Challenge establishment:** Challenge identity settled (EOG-04); establishment mechanism/authenticating authority deferred as CHL-01 (E1-FQ-01).
- **Membership / participation:** existence, meaning and boundaries settled (EOG-02 §§12, 15; EOG-04 §10; CGP-04); lifecycle (entry, invitation, suspension, restoration, removal, departure, withdrawal) deferred to EOG-08 / later governance (E1-FQ-03, E1-FQ-04).
- **Evidence → Truth → Recognition chain:** authority *types* and chain order settled (PAM §5; CGP-04); Verification holder deferred (ACT-03/ACT-04); Recognition authority and qualification deferred (MOT-01) (E1-FQ-06, E1-FQ-10).
- **Knowledge rows:** CGP-04 deferred canonical-Asset governance, modification/identity and Metrics/Units to Stage EK — **since resolved** by EKG-01 v0.1 + two Founder Working Baselines + STAGE-EK-CLOSE-01. CGP-04 §6 is stale on these three rows only; mechanical reconciliation under CGP-03 (CGP03-P31/P38), not substantive E1 work.
- **Charter / Governance Body:** constitutional status settled (GFC-03-A, GFC-04-B, CG-08 amendment); requirement, amendment authority, binding effect, council composition/appointment/decision-making deferred (E1-FQ-09).

### 5.3 Genuinely unresolved relationships (E1 worklist)

Stewardship reassignment / relinquishment / succession; membership lifecycle; participation withdrawal; Challenge establishment mechanism; Verification authority; Recognition authority + qualification; Knowledge Accountable Stewardship and Custody allocations (EOG-03 §18.1 — EK governed meaning and lifecycle, not stewardship/custody); Custodian allocation and retention; Administrator allocation and specific powers (beyond EKG-01 §§13–14 Knowledge delegation); Group configuration authority and amendment (EOG-03 §18.1). Each is carried into §9 as an E1 FQ.

---

## 6. Existing authority / accountability coverage

### 6.1 Settled

- **Founder authority:** sole Governance Authority; approves constitutional rules, standards, boundaries, exceptions, amendments (PAM §4.K; CGP-04). Founder is Knowledge Authority (EKG-01 §13, citing EOG-03 §8 and PAM).
- **Constitutional vs operational vs technical:** PAM §§2–4/6–7 separate authority from ownership (accountable stewardship), responsibility, access, visibility, capability, role and presentation; CGP-04 §§7–8, P41/P42/P45 forbid converting implementation actors, admin execution or role names into governance authority and forbid reading technical permission design as E1 governance. EKG-01 §14 confirms "the exact technical authorization mechanism belongs to downstream implementation."
- **Knowledge administration:** Founder may delegate bounded, capability-specific Knowledge-management capabilities (e.g. create/edit without publish/retire); Super Admin is an operational administrative mechanism conferring no independent authority; Admin account creation alone confers nothing (EKG-01 §§13–14).
- **Group founding accountability:** creator → first Member + first Accountable Steward; singular stewardship; creation-only Administrative authentication of the creation event (EOG-02 §§6/8/9; GFC-01-B, GFC-02-B; CGP-04).
- **Group moderation:** constitutional meaning, relationship map and boundaries settled (EOG-02 §14); thresholds, process, appeal, remedy deferred.
- **Group Charter:** distinct governed subject; subordinate to Platform governance/Policy; not Authority; authorship ≠ truth; historically intelligible amendment (GFC-03-A conditions).
- **Stewardship Council:** permitted, never a second Accountable Steward; membership grants no relationship by implication (GFC-04-B; CG-08).
- **EOG-01 vocabulary:** complete bounded accountability relationship set; "Accountable Steward" formal term; Governed vs Information Subject distinction (EOG-01-FW-01–FW-08, approved 2026-07-19). The PAF itself allocates nothing ("Draft for founder review. No accountability relationship is allocated by this framework." — PAF §13 Governance/Status).
- **Delegation conditions:** explicit, scoped, purposeful, attributable, non-exceeding, auditable, revocable; delegation ≠ transfer (PAM §7; CGP04-P29–P32).
- **Auditability:** durable accountability required for acceptance decisions, consequential eligibility determinations, high-impact admin decisions, Policy/Knowledge changes, delegation/revocation, corrections, amendments — without prescribing retention periods or technical structures (PAM §11).

### 6.2 Deferred (carried to §9)

Administrator allocation and specific powers; custodian allocation/retention; stewardship reassignment/relinquishment/succession procedures; council composition/appointment/decision-making/responsibilities; Charter requirement, initial form, amendment authority, versioning; Verification authority; Recognition authority; Knowledge stewardship/custody; Policy authorship/applicability/amendment/effect machinery; role assignment/revocation regime (canonical role vocabulary absent — PAM §14; Group/Challenge/Profile domain standards assign no roles).

---

## 7. Operational lifecycle coverage

Rule applied: no lifecycle is required merely because an entity exists; only lifecycles Stage F cannot safely proceed without.

| Entity / matter | Governed so far | Still requiring governance before F |
|---|---|---|
| Group | Creation (created-not-proposed; founding consequences); identity/purpose evolution principles; historical intelligibility | Amendment/retention/lifecycle rules; archival; inactivity thresholds/consequences; Charter operations (E1-FQ-02/09) |
| Membership | Meaning, voluntary basis, dormant-membership concept | Full lifecycle: invitation, entry, suspension, restoration, removal, departure (EOG-08) (E1-FQ-03) |
| Challenge | Identity, integrity, history/continuity principles; composition boundaries | Establishment; states/transitions/timing/recovery; active-Challenge amendment; finalization/reopening; snapshots/retention/archival/access (E1-FQ-01/05) |
| Participation | Voluntary, Challenge-specific; not governance | Eligibility, entry, withdrawal, removal, history, effect on truth (E1-FQ-04) |
| Activity / Evidence | Submission Intent → Acceptance Decision → Accepted Activity Event → Evidence Eligibility chain (authority types) | Submission/acceptance criteria; Verification (ACT-03); correction (ACT-04); late/early/finalization handling (E1-FQ-06) |
| Derived truth (Progress/Completion/Ranking/Streak) | Authority (Calculation) and attribution rules | Formulas, qualification, thresholds — **Stage F**, not E1 (E1-FQ-13) |
| Recognition | Concept inventoried; Truth-Before-Recognition principle | Recognition authority + qualification (MOT-01) (E1-FQ-10) |
| Knowledge | Lifecycle (§16), Runtime Catalogue (§17), Historical representation (§18), V1-evidence baseline (§21) governed by EKG-01 | Stewardship/custody allocations; publication/versioning/snapshot contracts if EK left any — confirm against EKG-01 §§16–18 during E1 entry, do not reopen (no FQ; E1-entry check only) |
| Template / Creation Mechanism | Constitutional boundaries (EOG-03 §13; EOG-04 §17.3) | Template governance; Creation governance (fold into E1-FQ-01/05, not standalone) |
| Profile / Account | Principles (one Profile per identity; privacy precedes convenience; visibility classification constitutional) | Account lifecycle, completion/editing/verification workflows, media lifecycle, deletion, recovery, invitations, social graph (E1-FQ-08 for privacy/consent aspects; remainder F/H) |
| Consent | Expression vs authoritative record distinguished (HID-06/07) | Consent standard (record use, withdrawal effect) — within E1-FQ-08 |
| Charter / Governance Body | Constitutional status + boundaries | Requirement/amendment/binding/versioning; council operations (E1-FQ-09) |
| Policy | Class defined (CTL-01); Challenge Policy as scoped instance | Policy authorship, applicability determination machinery, amendment, effect (within E1 integrated instrument; Challenge-creation rights hinge on it) |
| Admin / Operational records | Durable-accountability obligations (PAM §11); record/subject distinctions (CTL-02/04, AEV-09/10) | Retention periods, correction procedures, technical audit structures — **Stage H** |

---

## 8. Operational decision-right coverage

| Decision | Status | Source |
|---|---|---|
| Who may create a Group | SETTLED (creator creates; Administration authenticates creation event only) | EOG-02 §8; GFC-01-B |
| Who governs a Group | SETTLED in model (singular Accountable Steward; council support only); procedures DEFERRED | EOG-02 §9; GFC-02-B/04-B; E1-FQ-02 |
| Who may create/configure a Challenge | UNRESOLVED (CHL-01) | EOG-04 §17.2; E1-FQ-01 |
| Who may modify an active Challenge | UNRESOLVED (Goal/target/configuration amendment) | EOG-04 §17.2; E1-FQ-05 |
| Who may join/leave/remove participants (Group) | UNRESOLVED (lifecycle) | EOG-02 §18; E1-FQ-03 |
| Who may enter/withdraw from a Challenge | UNRESOLVED | EOG-04 §17.2; E1-FQ-04 |
| Who may submit evidence | SETTLED (Participant, as Submission Intent) | PAM §4.A; CGP-04 |
| Who validates evidence / acceptance criteria | TYPE settled (Acceptance Authority); CRITERIA + VERIFICATION HOLDER unresolved | PAM §4.F; CGP-04 DEFERRED row; E1-FQ-06 |
| Who determines authoritative completion/truth | TYPE settled (Calculation Authority); FORMULAS/QUALIFICATION for Stage F | PAM §4.G; E1-FQ-13 (F) |
| Recognition authority + qualification | UNRESOLVED (MOT-01) | CGP-04; EOG-05; E1-FQ-10 |
| Role/ownership change effects | UNRESOLVED | E1-FQ-02/03/07 |
| Admin vs Group actors | PARTIAL (creation-only Group auth; Knowledge delegation); otherwise UNRESOLVED | GFC-01-B; EKG-01 §§13–14; E1-FQ-07 |

---

## 9. Genuine unresolved questions

Classification key: **E1** — governance decision genuinely required before product definition. **F** — product requirement/behaviour for Stage F. **G** — V1→V2 alignment issue. **H** — implementation concern. **DEFER** — legitimately unnecessary before Stage F. Nothing below is resolved or drafted — questions only, per instruction.

### E1-FQ-01 — Challenge establishment: who may create a Challenge and under whose authenticating authority? [E1 — Founder decision required]

Why before F: Stage F must specify Challenge creation behaviour; without a governed establishing authority it cannot know whose act creates a Challenge or what authenticates its identity, purpose and Goal. Existing evidence: Challenge identity/boundaries settled (EOG-04); establishment mechanism + "Authority authenticating individual Challenge identity, purpose and Goal" deferred (EOG-04 §17.2); CHL-01 pending; CGP-04 DEFERRED row. Template/Creation Mechanism boundaries exist (EOG-03 §13) but no Template or Creation governance.

### E1-FQ-02 — Group stewardship continuity: by what procedures do reassignment, voluntary relinquishment, succession and stewardship-failure operate? [E1 — Founder decision required]

Why before F: product definition needs deterministic stewardship-change behaviour (who becomes steward, what happens on abandonment) without inventing authority. Existing evidence: GFC-02-B model approved (successor-continuous reassignment; Charter succession principle; existing Platform Authority establishes reassignment truth); procedures expressly deferred (EOG-02 §18; CGP-04 three DEFERRED rows).

### E1-FQ-03 — Membership lifecycle: invitation, entry, suspension, restoration, removal, departure? [E1 — Founder decision required]

Why before F: every Group/Challenge product flow presupposes membership transitions; rules must come from governance, not implementation convenience. Existing evidence: membership meaning/consequences settled (EOG-02 §12; CGP-04); lifecycle deferred to EOG-08 / later governance (EOG-02 §18; CGP-04 DEFERRED row).

### E1-FQ-04 — Challenge participation: eligibility, entry, withdrawal, removal, history, and effect on truth? [E1 — Founder decision required]

Why before F: participation transitions alter whose evidence counts toward derived truth; withdrawing mid-Challenge without governed effect corrupts Completion semantics. Existing evidence: voluntary, Challenge-specific, non-governing participation settled (EOG-04 §10); eligibility/entry/withdrawal/removal/history deferred (EOG-04 §17.2); CGP-04 withdrawal row DEFERRED.

### E1-FQ-05 — Challenge lifecycle: states, transitions, timing, recovery, active-Challenge amendment, finalization/reopening, snapshots and archival? [E1 — Founder decision required]

Why before F: Stage F functional requirements and the Canonical Information Contract need governed Challenge states; "identity continuity" (EOG-04 §§7/15) constrains but does not supply a lifecycle. Existing evidence: identity/integrity/history principles settled; "lifecycle, states, transitions, timing and recovery", "Goal, target and configuration amendment", "late activity, early Completion, finalization and reopening", "historical versions, snapshots, retention, archival and access" all deferred (EOG-04 §17.2).

### E1-FQ-06 — Evidence integrity operations: acceptance criteria, Verification authority holder, and correction authority (ACT-03/ACT-04)? [E1 — Founder decision required]

Why before F: accepted-event truth is the foundation of all derived truth; Stage F cannot specify submission/acceptance behaviour while the acceptance criteria, the Verification holder and correction authority are unallocated. Existing evidence: authority types settled (Acceptance; CGP-04); "activity submission, acceptance criteria, Verification and correction" deferred (EOG-04 §17.2); Verification meaning deferred to ACT-03, correction to ACT-04 (EOG-05 AEV-08/09); Verification Authority row DEFERRED in CGP-04.

### E1-FQ-07 — Canonical role vocabulary, role→authority assignments, and administrative delegation (beyond Knowledge)? [E1 — Founder decision required]

Why before F: functional requirements assign actions to actors; without governed roles, Stage F would invent authority via personas/screens (prohibited by PAM §13.9 and CGP04-P41). Existing evidence: authority types fully architected but "does not assign final roles" (PAM §§4/14); "final role names and powers remain deferred" (Group standard §6 Authority Model; Challenge standard; EOG-02 §18 "Administrator allocation and specific powers"); Knowledge-only delegation settled (EKG-01 §14) — Group/Challenge/Platform delegation regimes missing; no general delegation model may be inferred (CGP04-P32).

### E1-FQ-08 — Privacy, visibility and consent governance: visibility-class operation, consent-record use and withdrawal effect, minimum-necessary enforcement? [E1 — Founder decision required]

Why before F: privacy is a cross-cutting constitutional constraint on every authority transition (PAM §§3.12/5/10); product definition must receive enforceable visibility/consent rules, not invent them. Existing evidence: principles settled (privacy precedes convenience; visibility classification constitutional; deny-by-default; Profile standard §§4/10–11); "roles, permissions, privacy and security" deferred across EOG-02 §18, EOG-03 §18.1, EOG-04 §17.2, EOG-05 §13; future Privacy Standard + later Consent standard flagged (EOG-05 HID-06–08). Scope is governance rules only; field definitions, screens and controls are F/H.

### E1-FQ-09 — Group Charter operations and Governance Body operations: requirement, amendment authority, binding effect, council composition and procedure? [E1 — Founder decision required]

Why before F: the approved continuity model (GFC-02-B) relies on "applicable Charter succession principle" — an inoperable Charter leaves stewardship succession without its rule source. Existing evidence: Charter/Body constitutional status and boundaries approved (GFC-03-A, GFC-04-B, CG-08); requirement, initial form, amendment authority, binding effect, versioning, council composition/appointment/decision-making deferred (EOG-02 §18).

### E1-FQ-10 — Recognition authority and qualification (MOT-01)? [E1 — Founder decision required]

Why before F: Truth-Before-Recognition is constitutional (Doc 00 Part V); Stage F's Calculation & Derived Truth deliverable must know which authority acknowledges truth and what qualifies — otherwise recognition collapses into ranking/display. Existing evidence: Recognition inventoried as provisional candidate (EOG-05 DRV-09); Recognition Authority and qualification rows DEFERRED (CGP-04); formulas/mechanics stay in F.

### E1-FQ-11 — Security and trust requirements (governance layer): what must be assured of authority execution, attribution and reviewability? [E1 — Founder decision required]

Why before F: the E1 completion gate requires "security and trust requirements approved without substituting implementation for governance"; technical architecture mapping in F needs the requirements. Existing evidence: trust conditions, least privilege, auditability obligations, prohibited patterns settled (PAM §§8/11/13); "security controls" deferred (PAM §14; EOG instruments). Mechanisms (IAM/RBAC, key management, audit storage) are H. If the Founder judges PAM §§8/11/13 sufficient as requirements, this FQ may close with no new text — recorded as a decision, not a document.

### E1-FQ-12 — Historical preservation obligations: what Group/Challenge/evidence history must remain intelligible, for whom, and for how long as policy? [E1 — Founder decision required]

Why before F: retention shapes the information contract and archival behaviour; EOG-04 prohibits inferring that "historical integrity approves snapshots, versions, retention or reopening" (§17.3). Existing evidence: historical-integrity and identity-continuity principles settled (EOG-04 §§14–15; PAM §5); "historical versions, snapshots, retention, archival and access" deferred (EOG-04 §17.2). Technical preservation mechanisms are H (cf. DQ-10).

### E1-FQ-13 — Progress, Completion, Ranking, Streak, Projection formulas, thresholds and qualification mechanics? [F — no Founder governance decision required before F]

Why not E1: calculation *authority* and attribution are settled (PAM §§4.G/5.5/9; CGP-04); the remaining content is product specification using approved meaning — exactly Stage F's "Calculation & Derived Truth" deliverable. Existing evidence: formulas/qualification deferred to RSK decisions across EOG-04 §17.2, EOG-05 §11/§13, PAM §14. RSK decision material (`docs/reports/platform-foundation-decisions/06-RANKING-SCORING-AND-STREAK-DECISIONS.md`) is evidence input, not authority.

### E1-FQ-14 — Notification, Feed, discovery/personalisation, moderation-process and social behaviour? [F — no Founder governance decision required before F]

Why not E1: presentation/communication boundaries are settled (PAM §4.J; EOG-04 §16; EOG-03 §17 Discovery boundary — discovery concepts are *not* Platform Knowledge); the remaining content is product behaviour for Stage F functional requirements. Existing evidence: SOC/NTF decision material (`08-SOCIAL-MODERATION-AND-NOTIFICATION-DECISIONS.md`) as evidence; moderation thresholds/process/appeal deferred (EOG-02 §18) only insofar as governance needs them — operational moderation workflow is F. Discovery & Personalisation governance programme remains future work (EOG-03 §17), DEFER beyond F unless F needs hooks.

### E1-FQ-15 — Technical permission model (RBAC, Firestore rules, API authorization) implementing approved roles? [H — no E1 governance content]

Why not E1: CGP04-P42 and EKG-01 §14 place technical authorization in downstream implementation; PAM §14 defers "technical authorization design" and "permission matrix". Stage H task; must trace to the E1 role model once approved.

### E1-FQ-16 — V1→V2 migration of groups, challenges, knowledge and accounts? [G — out of E1 scope]

Why not E1: migration is alignment/transition work, not entity governance; EK closure explicitly authorized no "Firestore migration … V1→V2 migration" (STAGE-EK-CLOSE-01 §3 Completion). V1 catalogue/legacy documents are subordinate evidence (EOG-03/EOG-04 precedence rules; EKG-01 §21). Address in Stage G preparation, preserving constitutional precedence.

### E1-FQ-17 — D17 constitutional-process questions, governance maturity/health models, future domains, individual challenges? [DEFER — not required before F]

Why not E1: DQ-01/02/04/05/09/10/11 concern governance-process machinery (review design, re-review basis, index designation, archival mechanisms, recorder allocation) for later governance programmes (D17 register). Maturity/health models are expressly non-governing (EOG-02 §16; EOG-05 §9). Future domains and individual/non-Group/indefinite Challenge modes are excluded from V2 scope (PAM §1; EOG-04 §17.1; domain standards).

---

## 10. Existing E1 deliverable disposition

| Programme deliverable | Disposition | Rationale |
|---|---|---|
| Entity Ownership Register | **SATISFIED** | EOG-05 approved + CG-08 amendment (inventory authoritative); CGP-04 approved (allocation state truthful: 13 ALLOCATED / 12 DEFERRED / 0 founder-unallocated). Only mechanical CGP-04 reconciliation of the 3 EK-resolved knowledge rows outstanding (CGP-03 administrative, §5.2). |
| Lifecycle Standards | **REQUIRED** | Group, Membership (EOG-08), Challenge, Participation, Evidence operations (ACT-03/04), Charter/Body operations lifecycles all deferred. Knowledge lifecycle absorbed by EKG-01 — confirm, do not redo. |
| Roles & Permissions | **REQUIRED** | Canonical vocabulary + assignments + delegation regimes absent (PAM types are the constraining input, not the vocabulary). Knowledge delegation pattern (EKG-01 §14) is reusable precedent. Technical permission matrix explicitly excluded (H). |
| Privacy & Visibility | **REQUIRED** | Governance rules only (visibility operation, consent, minimum-necessary). Principles exist as input (PAM; Profile standard). Screens/fields/controls are F/H. |
| Security & Trust | **REQUIRED** (requirements layer only) | PAM trust/auditability/prohibited-pattern content is input; approve requirements without mechanisms. May close by Founder decision with no new text if PAM suffices (E1-FQ-11). |

No deliverable is obsolete or redundant; none is better allocated downstream except the excluded layers noted.

---

## 11. Minimum sufficient Stage E1 recommendation

**One integrated instrument** — e.g. "Entity & Operational Governance Standard" — covering E1-FQ-01–12 as a single coherent subject (operational exercise of already-allocated authority), structured in parts (Group & stewardship operations; Challenge & participation lifecycle; evidence operations; roles, permissions & delegation; privacy & visibility; security & trust requirements; charter/body operations; recognition authority; preservation obligations). Rationale: CGP-03 P27 consolidation preference; the twelve questions share the same authority sources, the same Founder reviewer, and the same Stage F consumer; a per-question document set would breach P26 (no artificial work-package rule) and P15 (no ceremony by analogy, including no separate EOG-08 membership instrument — absorb it).

A second instrument is justified **only if** Founder review finds privacy/security needs an independent approval track; default to annexes within the single instrument. **Zero new instruments is not available**: E1-FQ-01–12 name authority/lifecycle allocations no existing instrument contains, and CGP-03 P36 (broken trace requires correction) obliges their explicit resolution rather than silent inheritance by Stage F.

Do not redraft: ontology, PAM authority types, EOG-01 vocabulary, EOG-02/03/04 boundaries, EKG-01, CGP-04 allocation rows, GRP closure decisions. Reference them.

---

## 12. Matters NOT to govern in E1

Formulas, scores, thresholds, ranking/streak mechanics (F); notification/feed/discovery/moderation product behaviour (F); functional requirements, information contracts, runtime contracts, architecture mapping (F); technical authorization, IAM/RBAC, audit storage, retention mechanisms (H); V1 migration, Wizard rebuild, Firestore migration (G); D17 process machinery, recorder allocation, canonical index designation (later governance — DEFER); maturity/health models, future domains, individual challenges (excluded/DEFER); UI, screens, copy, client behaviour; dataset contents (taxonomy entries, catalogue content); any redefinition of settled constitutional concepts.

---

## 13. Proposed Stage E1 closure conditions

Drawn from the programme E1 gate (§3) and CGP-03 P30/P46-equivalent completion discipline:

1. Founder decisions on E1-FQ-01–12 recorded attributably (approvals may be direct per CGP03-P28).
2. The single integrated operational-governance instrument Founder-approved and constitutionally effective, preserving Stages D/E0/EK (traceability per CGP-03).
3. CGP-04 DEFERRED rows affected by E1 decisions mechanically reconciled (CGP03-P38 administrative reconciliation), including the 3 EK-resolved knowledge rows.
4. Programme §13 checklist (Founder Review → Validation → Traceability → Approval → Adoption Record → Programme/Dashboard Updated) satisfied for the one instrument; non-applicable checklist steps explicitly marked not-required with reason (CGP03-P15/P29), not silently skipped.
5. Stage F entry expressly authorized; no implementation authorized by E1 closure.

---

## 14. Blockers

**None.** No technical, evidentiary or dependency blocker prevents E1 commencement. The sole precondition is procedural: Founder authorization of Stage E1 substantive work per the Master Programme dependency order (cf. EK closure: "Next attributable governance is Stage E1 when Founder-authorized"). All Stage E1 inputs (EOG-05, CGP-04, PAM, EOG-02/03/04, EKG-01, domain standards, Session-1 and platform-foundation decision evidence) are present and legible at `origin/main c02ac4e`.

---

## Appendix A — Evidence reviewed (authoritative unless noted)

Constitutional/authority: Doc 00 ontology; Platform Constitution (01), Principles (02), Domain & Terminology (03), Launch Scope (04), Capability Map (05), Entity Ownership Foundation (06), Glossary (07), Data & Information Standard (08 + 09 validation); PAM (10 + 11 validation); CGP-02 (Complete via FAD-01 + FLD-01; D17 register for DQ-01–DQ-11); CGP-03 v0.1 + CGP-03-FAD-01 + reconciliation report; CGP-04 v0.1 + CGP-04-FAD-01 + reconciliation report. Entity/ownership: EOG-01 approval record (+ decision pack); PAF (04) + relationship matrix; EOG-02 framework + approval record + transition report; EOG-03 approved + approval record; EOG-04 approved + approval record + validation; EOG-05 register approved + CG-08 amendment + approval trail; GRP closure memorandum/decision record/completion report; EKG-01 v0.1 + EKG-01-FAD-01; EK closure STAGE-EK-CLOSE-01 + EK audit/carry-forward + EK reconciliation report. Domains: 01 Profile, 02 Group (+ validation), 03 Challenge (+ validation), 04 Activity Event (+ validation), 05 Knowledge Asset (+ validation + traceability appendix), 06 cross-validation + reconciliation plan. Programme: Master Programme v1.45 §§5/6/8/9/13/14 + stage tables; Programme Guide §§9–10; PTRA-01–06 series (transition assessments); EK working baselines (Metric/Unit; 118-Activity). Historical evidence only (not authority): `docs/reports/platform-foundation-decisions/` pack (37 decisions, Session-1 approvals), member-phase implementation reports, V1/legacy catalogue docs.

## Appendix B — Validation

- All cited files verified present at `origin/main c02ac4e`; status/approval claims quote document-control headers.
- Authority assertions track current approved instruments; draft/historical items (PAF draft status, 01-Register superseded by 27-Approved, candidate-stage CGP-02 papers, GRP memorandum's "no approval recorded" cover page superseded by the issued 2026-07-21 Decision Record) are distinguished where material.
- No code, data, governance substance or programme status changed by this assessment. Primary worktree untouched (verified §2 method; re-verified after completion — see return summary).
- Recorded as a single new evidence file on a clean branch from `origin/main`; unmerged, for review under repository convention.
