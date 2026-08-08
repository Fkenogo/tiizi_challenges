# EOG-05 Phase 1 — Constitutional Register Architecture and Separation Blueprint

**Status:** Architecture recommendation pending founder approval

**Date:** 2026-07-20

## 1. Purpose and Decision Boundary

This blueprint evaluates whether the Entity Ownership programme should preserve constitutional entity inventory and constitutional relationship allocation in one register or separate them into two instruments.

It follows the [EOG-05 Phase 0 Readiness Review](21-EOG-05-PHASE-0-ENTITY-OWNERSHIP-REGISTER-READINESS-REVIEW.md), [Candidate Entity Inventory](21-EOG-05-CANDIDATE-ENTITY-INVENTORY.md), [Relationship Coverage Matrix](21-EOG-05-RELATIONSHIP-COVERAGE-MATRIX.md), [Dependency Map](21-EOG-05-DEPENDENCY-MAP.md) and [Recommended Drafting Scope and Exclusions](21-EOG-05-RECOMMENDED-DRAFTING-SCOPE-AND-EXCLUSIONS.md).

This document recommends an architecture. It does not approve that architecture, classify a provisional candidate, allocate an accountability relationship, or resolve a pending founder decision.

## 2. Executive Recommendation

**Recommended — pending founder approval: Option B, Separated Registers.**

The programme should distinguish:

1. **Entity Ownership Register:** the stable constitutional inventory and classification of Tiizi Governed Subjects and their Information Subject treatment; and
2. **Entity Relationship Allocation Register:** the allocation record for the EOG-01 accountability relationships that apply to those classified subjects.

Separation is constitutionally stronger because the two instruments answer different questions:

- the Entity Ownership Register answers **what is governed and how it is constitutionally classified**; and
- the Entity Relationship Allocation Register answers **which declared relationship applies, to whom or what, for which purpose and under which approved source**.

Phase 0 identified 72 candidates. Most subject boundaries are stable, but 427 of 864 required relationship cells remain Deferred and 29 remain Undefined. Combining these layers would make the stable inventory change whenever a later allocation changes and would hold its approval hostage to unresolved allocation decisions.

Option B adds cross-register maintenance obligations. Those obligations are controllable through stable identifiers, explicit precedence and referential rules. They are less constitutionally risky than allowing volatile allocations to reshape the inventory that defines what exists.

The proposed short identifier **EOG-06** must not yet be frozen for the allocation register. Historical founder-planning material already uses EOG-06 for Recognition Authority. This collision requires controlled identifier reconciliation; this blueprint does not resolve it.

## 3. Architecture Options

### 3.1 Option A — Single Register

One evolving Entity Ownership Register would contain both:

- entity inventory and constitutional classification; and
- Authority, Accountable Steward, Custodian, Administrator, Operator, Contributor, Participant, Delegate, Presenter, Downstream User and Attributable Originator treatment.

#### Strengths

- one document provides a complete lookup surface;
- entity and relationship context appear together;
- no cross-document identifier synchronization is required;
- a reader can see approved and unresolved treatment in one row; and
- approval and amendment history can be consulted in one place.

#### Weaknesses

- stable entity classification and frequently changing allocations share one amendment cycle;
- deferred allocations dominate the document and obscure settled subject boundaries;
- allocation changes can accidentally imply a change to constitutional identity;
- final approval remains dependent on numerous CHL, ACT, GRP, KNW and RSK decisions;
- large rows encourage shorthand that may conflate Authority, Stewardship, Custody and Administration;
- historical comparison becomes difficult because unrelated changes appear in the same instrument; and
- the 72-by-relationship structure becomes increasingly difficult to review as domains grow.

### 3.2 Option B — Separated Registers

The Entity Ownership Register would contain inventory and entity classification only. A separate Entity Relationship Allocation Register would contain EOG-01 relationship treatment and allocations.

#### Strengths

- constitutional identity is insulated from operational and organisational allocation change;
- the inventory can reach approval after classification gates are resolved without waiting for every allocation;
- deferred relationships remain visible without making the definition of an entity provisional;
- each allocation can carry its own purpose, scope and governing source;
- amendment history clearly distinguishes ontology change from accountability change;
- new domains can add entities without requiring premature allocations; and
- EOG-01 separation rules are easier to enforce because relationship declarations are not compressed into entity-definition rows.

#### Weaknesses

- the instruments can drift unless identifiers and references are controlled;
- readers may need both registers to understand one governed subject fully;
- an allocation can become orphaned if classification changes are not assessed across both instruments;
- approval and amendment processes must distinguish linked but separate effects; and
- governance indexes must maintain a clear sequence and precedence model.

## 4. Comparative Analysis

| Criterion | Option A — Single Register | Option B — Separated Registers | Constitutional assessment |
|---|---|---|---|
| Constitutional stability | Identity and allocation change together. | Stable classification is insulated from allocation change. | Option B is stronger. |
| Future extensibility | Every new domain expands already-wide rows. | New subjects and later allocations can mature independently. | Option B scales more cleanly. |
| Amendment frequency | Any relationship change amends the constitutional inventory. | Allocation changes normally leave the inventory untouched. | Option B reduces constitutional churn. |
| Auditability | One history contains multiple kinds of change. | Classification and allocation histories are separately attributable. | Option B provides clearer evidence. |
| Dependency on deferred decisions | Final register approval remains broadly blocked. | Inventory approval can precede allocation completeness. | Option B localizes dependency. |
| Risk of doctrinal drift | Allocation shorthand can alter subject meaning. | Explicit boundary prevents allocations from redefining subjects. | Option B lowers drift if cross-register controls hold. |
| Traceability | One row is convenient but can become dense. | Stable Entity IDs link precise allocation declarations to source decisions. | Option B is more precise; Option A is simpler to browse. |
| Document maintainability | One large matrix is simpler initially and harder over time. | Two narrower instruments require coordination but remain reviewable. | Option B has higher setup cost and lower long-term burden. |

## 5. Constitutional Risks

### 5.1 Risks of Option A

| Risk | Constitutional consequence |
|---|---|
| Identity-allocation conflation | A change in who holds a relationship may appear to change what the Governed Subject is. |
| Approval coupling | Settled entity classification cannot be approved independently of hundreds of unresolved relationship cells. |
| Relationship compression | One cell may obscure distinct authoritative facts, scopes or relationship holders. |
| Doctrinal drift | Repeated allocation edits may gradually alter definitions or boundaries without explicit constitutional review. |
| Historical noise | High-frequency allocation amendments obscure rare, material classification amendments. |
| False completeness | A structurally complete row may be mistaken for a constitutionally complete allocation. |

### 5.2 Risks of Option B

| Risk | Constitutional consequence | Required architectural control |
|---|---|---|
| Referential drift | An allocation may refer to a renamed, consolidated or excluded entity. | Stable Entity IDs and mandatory impact review. |
| Orphan allocation | A relationship declaration may survive after its subject treatment changes. | No allocation without a current inventory reference. |
| Conflicting status | The two registers may describe incompatible constitutional status. | Inventory classification takes precedence for entity identity; allocation status governs only the relationship. |
| Duplicated meaning | Allocation text may restate and subtly change entity definitions. | Allocation register references definitions and must not reproduce or redefine them. |
| Fragmented review | Readers may consult only one instrument. | Each register must state its boundary and link to the other. |
| Identifier collision | “EOG-06” may be confused with historical Recognition governance. | Use the full allocation-register title until controlled identifier reconciliation. |

### 5.3 Shared risks

Neither option prevents error by itself. Both require EOG-01 terminology, named governing sources, explicit Approved, Deferred, Undefined and Out of Scope treatment, and protection against a Governed Subject being treated as an actor or Authority.

## 6. Long-Term Governance Implications

### Option A

Option A optimizes for immediate readability. Its cost grows with the platform: every new domain adds more entities, relationships and decision dependencies to one instrument. The register would become a hybrid constitution, decision tracker and allocation ledger. That hybrid form is likely to require frequent amendment and increasingly complex approval rules.

### Option B

Option B creates a durable separation between constitutional inventory and constitutional accountability. The inventory should change only when Tiizi recognizes, reclassifies, consolidates or ceases to recognize a governed subject. The allocation register should change when approved governance assigns, narrows, delegates, reassigns or closes a relationship.

This distinction supports future domains without claiming their allocations in advance. It also allows an entity to remain constitutionally stable while organisational structures, governance standards and responsibility assignments evolve.

Separation does not diminish the importance of allocations. It makes their volatility explicit and preserves a cleaner audit trail for both layers.

## 7. Recommended Architecture

### 7.1 Instrument One — Entity Ownership Register

Despite its inherited title, this instrument should be defined strictly as the constitutional inventory and classification register. “Ownership” must not operate as shorthand for Authority, Stewardship, Custody, possession or control.

Its recommended content is:

- stable Entity ID;
- canonical name;
- domain;
- Governed Subject classification;
- Information Subject treatment;
- constitutional definition and principal boundary;
- primary constitutional information category;
- governing source and precedence;
- approved aliases or consolidation treatment where applicable;
- classification status;
- named classification dependency where unresolved; and
- notes distinguishing entities from facts, functions, mechanisms, representations and contextual relationships.

It must not contain allocations for Accountable Steward, Custodian, Administrator, Operator, Contributor, Participant, Delegate, Presenter or Downstream User. Authority treatment may be referenced only as a subject boundary—for example, that a Governed Subject is not itself an Authority—not as an allocation ledger.

### 7.2 Instrument Two — Entity Relationship Allocation Register

This instrument should apply the complete bounded EOG-01 relationship vocabulary to Entity IDs approved or provisionally admitted by the inventory.

Its recommended declaration unit is one Entity ID, one relationship, one declared purpose or authoritative fact, and one governing source. Its content should include:

- Entity ID reference;
- canonical relationship name;
- declared purpose or authoritative fact;
- Approved, Deferred, Undefined or Out of Scope status;
- approved relationship holder or explicit blocking decision where applicable;
- scope and constitutional boundary;
- governing decision or standard;
- separation constraints;
- approval trace; and
- amendment dependency.

It must not create, rename, consolidate or redefine a Governed Subject. It must not infer an allocation from a role title, access, possession, storage, implementation mechanism or presentation capability.

The full title **Entity Relationship Allocation Register** should be used provisionally. Assigning the short identifier EOG-06 remains pending controlled identifier reconciliation.

### 7.3 Cross-register constitutional contract

If Option B is approved, both instruments must obey these rules:

1. The Entity Ownership Register is authoritative for entity identity and classification.
2. The Entity Relationship Allocation Register is authoritative only for approved relationship declarations within its scope.
3. Every allocation declaration references exactly one current Entity ID.
4. The allocation register cannot create or redefine an entity.
5. The inventory cannot imply or allocate a relationship through classification wording.
6. Every relationship uses the approved EOG-01 term without redefinition.
7. Every approved allocation identifies its governing source, purpose and scope.
8. Deferred and Undefined treatment remains explicit and cannot be converted through inference.
9. A proposed classification change requires an impact assessment of all linked allocations before approval.
10. An allocation change does not alter entity identity unless separate constitutional governance expressly changes the inventory.
11. The instruments maintain separate status, approval and amendment traces.
12. No conflict may coexist silently; unresolved conflicts escalate under existing Governance Authority rules.

### 7.4 Presentation without source convergence

Future governance may permit a consolidated, non-governing view for human review. Such a view would present linked inventory and allocation information without becoming a third source of truth. This blueprint neither requires nor designs that view.

## 8. Transition Impact on Future Governance Families

| Family | Entity Ownership Register impact | Entity Relationship Allocation Register impact | Separation benefit |
|---|---|---|---|
| GRP | Classifies Group, membership relationship, Member, Group purpose, Group Charter, Stewardship Council and related candidates. | Records approved initial Group treatment and later stewardship, custody, administration, delegation and presentation allocations only when governed. | Group identity can remain stable while continuing governance decisions mature. |
| CHL | Classifies Challenge and determines treatment of Challenge purpose, Goal, Target, Group Configuration and Community Context through the classification gates. | Records truth-establishment and accountability allocations after CHL-01 and later Challenge governance. | EOG-04 Challenge identity is not held open by deferred Challenge allocations. |
| ACT | Classifies Submission Intent, Acceptance Decision, Accepted Activity Event, Evidence Eligibility, Verification, Correction reference and related subjects. | Preserves approved Participant, Acceptance, Policy and Calculation Authority boundaries while leaving Verification and correction allocations deferred under ACT-03 and ACT-04. | Settled evidence concepts remain distinct from unresolved integrity allocations. |
| KNW | Classifies Knowledge Asset types, Knowledge relationships, Runtime Catalogue function, Runtime availability, Runtime Projection, Historical Knowledge reference, Historical Representation, Template and Creation Mechanism. | Records Knowledge Authority and later stewardship, custody, contributor, runtime and administrative allocations governed by KNW-02 through KNW-04. | Platform Knowledge identity remains stable while lifecycle and contribution governance evolves. |
| RSK | Classifies Ranking, Streak, Projection, Leaderboard, Recognition and related derived or presentation candidates. | Records Calculation, Policy and Presentation relationships only to the extent approved; formula, tie, Streak and Recognition decisions remain deferred. | Derived subjects can be inventoried without pre-approving calculation or recognition policy. |

No family gains an allocation from this architecture. Each future standard supplies governing evidence to the appropriate instrument and cannot silently modify the other.

## 9. Transition Sequence

If Option B is approved, the safe sequence is:

1. reconcile the programme identifier collision without changing historical artefacts;
2. accept CG-01 through CG-08 as controlled classification gates;
3. draft and validate the Entity Ownership Register from the 72-candidate audit universe;
4. approve only classifications supported by existing constitutional governance and keep provisional classifications explicit;
5. derive the initial Entity Relationship Allocation Register from the Phase 0 coverage matrix;
6. preserve every Deferred and Undefined relationship without inference;
7. incorporate later GRP, CHL, ACT, KNW and RSK approvals through attributable allocation amendments; and
8. approve allocation completeness only when the declared approval gates are satisfied.

Drafting the allocation register need not wait for all pending decisions if it is explicitly incomplete. Constitutional approval as a fully allocated register must wait for its blocking decisions and purpose-limited custody treatment.

## 10. Approval and Readiness Gates

### 10.1 Architecture approval gate

Founder approval is required to choose Option A or Option B. This recommendation does not make the choice constitutional.

### 10.2 Inventory drafting gate

The Entity Ownership Register may enter drafting after:

- Option B is approved;
- CG-01 through CG-08 are accepted as the provisional scope-control method; and
- identifier discipline is recorded using an unambiguous full title.

### 10.3 Allocation drafting gate

The Entity Relationship Allocation Register may enter transparent drafting when:

- the inventory provides stable or explicitly provisional Entity IDs;
- EOG-01 terms are used without redefinition;
- all unresolved treatment remains Deferred or Undefined; and
- the allocation register’s permanent programme identifier is not assumed.

### 10.4 Final approval gate

A fully allocated register cannot be approved until its register-blocking GRP, CHL, ACT, KNW, RSK and cross-domain decisions are resolved and every applicable relationship has an approved declaration or a constitutionally justified Out of Scope treatment.

## 11. Explicit Exclusions

This blueprint does not:

- allocate Authority or any EOG-01 accountability relationship;
- classify the eight provisional candidate questions;
- resolve the historical EOG-05 or EOG-06 identifier collisions;
- resolve GRP, CHL, ACT, KNW or RSK decisions;
- amend EOG-01 through EOG-04;
- define lifecycle, role, permission, privacy, security or implementation governance; or
- change the existing Entity Ownership Register draft.

## 12. Final Architecture Verdict

**Option B is recommended, pending founder approval.** It best preserves the constitutional distinction between **what exists** and **who or what holds a declared relationship to it**.

The separation is ready for founder decision. After approval and identifier reconciliation, the inventory instrument is ready to enter drafting under the Phase 0 classification gates. The allocation instrument is ready only for an explicitly incomplete draft until the pending governance dependencies are resolved.

## 13. Validation

| Check | Result |
|---|---|
| Both architecture options evaluated | Pass |
| All eight review criteria assessed | Pass |
| Recommendation distinguished from founder approval | Pass |
| No accountability relationship allocated | Pass |
| No pending decision resolved | Pass |
| EOG-01 terminology preserved | Pass |
| EOG-01 through EOG-04 unchanged | Pass |
| CHL, ACT, GRP, KNW and RSK transition effects covered | Pass |
| Identifier collision disclosed without resolution | Pass |
| Markdown structure valid | Pass |
| Relative links resolve | Pass |
| Whitespace validation passes | Pass |
| `git diff --check` passes | Pass |
