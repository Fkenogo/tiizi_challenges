# EOG-05 Phase 4 — Independent Constitutional Register Review

**Document reviewed:** [Entity Ownership Register — Founder Review Draft 1](24-EOG-05-ENTITY-OWNERSHIP-REGISTER-DRAFT-1.md)

**Review status:** Independent constitutional critique

**Date:** 2026-07-20

## 1. Executive Summary

Draft 1 is structurally disciplined and broadly consistent with the approved separated-register architecture. It contains 72 unique candidate rows, uses the required inventory fields, preserves 14 provisional classifications, assigns one proposed primary category per candidate, and contains no EOG-01 relationship-allocation columns.

The register is not yet ready for founder approval as constitutional inventory governance. Five targeted register defects require refinement:

1. seven rows replace Phase 0 **Undefined** Information Subject treatment with affirmative wording without marking that treatment provisional;
2. Recognition is classified as an independent **Derived Information** subject even though its qualifying truth and constitutional treatment remain deferred;
3. Member and Participant are presented as independent contextual entities alongside the relationships from which those designations arise, without an explicit non-duplication test;
4. Activity, Metric and Unit are presented as independent entities alongside corresponding Knowledge Asset entities without a sufficient concept-versus-asset identity rule; and
5. Challenge Policy is retained independently while Applicable Policy is consolidated into Policy, without a rule establishing why Challenge Policy is not the same scoped Policy treatment.

No defect requires redesign of the separated-register architecture. No duplicate Entity ID, duplicate canonical name, missing required field, allocation leakage or implementation leakage was found. The appropriate next step is a targeted Draft 2 refinement, followed by another count and boundary validation.

**Final verdict:** Constitutionally coherent, but ready for approval only after targeted register refinements.

## 2. Constitutional Findings

### CF-01 — Higher-order precedence is preserved

**Result:** Pass.

Draft 1 cites approved EOG-01 through EOG-04 governance, the Platform Data and Information Standard and the Phase 0 through Phase 2 architecture records. It correctly states that drafting evidence does not independently establish entity meaning.

### CF-02 — Entity identity is separated from accountability allocation

**Result:** Pass.

The register defines entity identity, subject treatment, category and boundary. It contains no columns for Authority to Establish Truth, Accountable Steward, Custodian, Administrator, Operator, Contributor, Participant relationship, Delegate, Presenter, Downstream User or Attributable Originator.

References to Authority appear only in constitutional boundaries such as “not a Platform Authority.” Those negative boundaries do not allocate an actor or relationship.

### CF-03 — Governed Subject treatment is generally restrained

**Result:** Pass with required refinements.

The 14 CG-linked candidates remain Provisional. Draft 1 does not convert the entire 72-candidate audit universe into approved entities.

However, Member, Participant and the Activity/Metric/Unit concept rows require stronger independent-entity justification because they overlap with separately listed relationship or Knowledge Asset entities. The concern is register identity, not the approved constitutional meaning of those concepts.

### CF-04 — Information Subject restraint is incomplete

**Result:** Fail pending targeted refinement.

The [Phase 0 Coverage Matrix](21-EOG-05-RELATIONSHIP-COVERAGE-MATRIX.md#53-undefined-concentration) identifies unresolved Information Subject treatment for:

- C-GRP-08 Stewardship Council;
- C-CHL-09 Group Configuration;
- C-CHL-10 Community Context;
- AEV-08 Verification;
- KNW-09 Runtime Catalogue;
- C-KNW-16 Template; and
- C-CTL-07 Creation Mechanism.

Draft 1 gives each row an affirmative Information Subject description without marking that cell provisional. The overall Classification status remains provisional for six of the seven, but AEV-08 Verification is marked Proposed inclusion. This presentation can be read as resolving the Information Subject question by table wording.

The affected cells must expressly retain unresolved or proposed treatment. This change need not remove the candidates.

### CF-05 — Source traceability is adequate

**Result:** Pass.

Every candidate row has source keys and, where applicable, a named gate or governance dependency. Draft 1 correctly treats DOM and P0 as supporting sources rather than silently elevating the Phase E1 register to approved authority.

Some entries use broad dependencies such as “future Policy governance.” This is acceptable for Draft 1, although decision-level references would improve later audit precision.

### CF-06 — Dependency handling preserves pending governance

**Result:** Pass.

GRP, CHL, ACT, KNW and RSK dependencies remain explicit. No lifecycle, permission, formula, role or implementation outcome is inferred from a dependency.

## 3. Register Findings

| Finding | Result | Evidence and consequence |
|---|---|---|
| Candidate-row completeness | Pass | 72 candidate rows are present, each with 11 populated fields. |
| Entity ID uniqueness | Pass | All 72 Entity IDs are unique. |
| Canonical-name uniqueness | Pass | All 72 canonical names are unique. |
| Classification-status totals | Pass | 58 Proposed inclusion and 14 Provisional entries reconcile to 72. |
| Provisional-gate coverage | Pass | CG-01 through CG-08 cover all 14 Provisional entries. |
| Primary-category completeness | Pass | Ten approved categories are used and reconcile to 72. |
| Approved-alias discipline | Pass | Every row records “—”; no alias is invented. |
| Explicit exclusions | Pass | Fourteen additional concepts are consolidated or excluded separately. |
| Information Subject fidelity | Refinement required | Seven Phase 0 Undefined treatments are presented too affirmatively. |
| Relationship/entity separation | Refinement required | Member and Participant overlap with their governed relationship rows. |
| Concept/asset separation | Refinement required | Activity, Metric and Unit overlap with corresponding Knowledge Asset rows. |
| Policy naming | Refinement required | Challenge Policy and Policy coexist without a sufficient identity rule. |
| Recognition classification | Refinement required | Derived classification risks anticipating deferred qualification governance. |
| Cross-register separation | Pass | No allocation columns, holders or implied role bundles appear. |

## 4. Duplicate and Merge Assessment

### 4.1 No literal duplicates

No two rows share an Entity ID or canonical name. No exact duplicate definition was found.

### 4.2 Member and Membership relationship

**Rows:** GRP-02 and GRP-03.

EOG-02 defines Membership as the governed relationship by which a Person belongs to a Group as a Member. Draft 1 then treats both the relationship and Member as independent inventory entities.

The distinction may be constitutionally viable: one row may govern the relationship, while the other identifies the Person-in-context. The current boundary does not explain why both require independent entity identity rather than Member being a contextual designation derived from GRP-02.

**Assessment:** Potential redundancy. Apply an explicit entity test before approval. Do not merge automatically.

### 4.3 Participant and Challenge participation relationship

**Rows:** CHL-05 and CHL-06.

EOG-01 defines Participant as a canonical contextual accountability relationship, and EOG-04 describes a Participant as having a governed relationship to a Challenge. Draft 1 treats the Challenge participation relationship and Participant as separate independent subjects.

As with Member, the separation may be valid if Participant is the Person-in-context and CHL-05 is the relationship itself. That distinction must be explicit because EOG-01 warns against treating relationship names as implied actors or bundles.

**Assessment:** Potential redundancy and terminology ambiguity. Apply the same entity test as Member.

### 4.4 Activity, Metric and Unit versus Knowledge Assets

**Rows:** AEV-01 through AEV-03 and KNW-02 through KNW-04.

The register appears to distinguish a governed concept from the identifiable Knowledge Asset that bears its meaning. That is constitutionally plausible and consistent with the EOG-03 doctrine that meaning precedes representation.

The boundaries are incomplete:

- AEV-01 does not state how Activity differs from Activity Knowledge Asset;
- AEV-02 does not state how Metric differs from Metric Knowledge Asset; and
- AEV-03 does not state how Unit differs from Unit Knowledge Asset.

The asset rows likewise define the same reusable meaning without stating whether one Asset can bear one concept, multiple representations of one concept can exist, or the concept is merely the meaning borne by the Asset. Those cardinality questions remain outside this review, but the identity distinction must not depend on them.

**Assessment:** Do not merge automatically. Add a reciprocal concept-versus-asset boundary or move the pairs to provisional classification review.

### 4.5 Challenge Policy versus Policy

**Rows:** CHL-04 and CTL-01; related excluded concept: Applicable Policy.

Draft 1 consolidates Applicable Policy with Policy because applicability describes contextual scope. It nevertheless retains Challenge Policy as an independent policy subject, defined as Policy applicable to a Challenge.

Without a further distinction, CHL-04 appears to be the same scoped treatment that the exclusions table says does not create a second Policy entity.

**Assessment:** Material overlap. Either establish a source-grounded identity distinction or classify CHL-04 as a contextual Policy reference/subtype pending review. This review does not select the outcome.

### 4.6 Administrative actions and records

Group, Challenge, Event and Knowledge administrative actions remain distinct from Administrative record and Audit record. The action-versus-record boundaries are explicit enough to avoid merger.

### 4.7 Projection and Runtime Projection

Projection is a derived estimate; Runtime Projection is a subordinate Knowledge representation. The principal boundaries distinguish them adequately. No merge is recommended.

## 5. Missing Entity Assessment

### 5.1 No confirmed missing foundational entity

No approved EOG-01 through EOG-04 Governed Subject was found that must unquestionably be added as an independent entity before Draft 1 can proceed.

The following omissions are deliberate and sound:

- Platform Knowledge remains an aggregate;
- Authoritative Meaning remains a fact;
- Constitutional Composition remains a doctrine;
- Undertaking is consolidated with Challenge for Version 2;
- Challenge Identity is information concerning Challenge; and
- Challenge Integrity and continuity remain constitutional conditions or interpretive principles.

### 5.2 Group creation event — review candidate, not confirmed omission

EOG-02 gives the Group creation event attributable constitutional significance distinct from the Group and its founding purpose. Draft 1 does not inventory it.

The approved source does not clearly establish the creation event as an independent Governed Subject rather than an attributable event concerning Group. Therefore it is not a confirmed missing entity. Draft 2 should record an explicit exclusion or provisional review note so the event is not silently lost when later Group creation governance matures.

### 5.3 Challenge Context — exclusion trace recommended

EOG-04 defines Challenge Context as a bounded set of relationships. Draft 1 appropriately does not create an entity, but it does not list Challenge Context among consolidated or excluded concepts. Adding an exclusion trace would make the treatment explicit and prevent later duplication with Event context, Group Configuration or Community Context.

### 5.4 Evidence — exclusion trace recommended

DATA defines Evidence as authoritative information approved for use in a governed determination. The register contains Accepted Activity Event and Evidence Eligibility, preserving the important chain. Evidence is therefore better treated as a contextual evidential status or use relationship unless later governance establishes otherwise. An explicit exclusion trace would make this reasoning auditable.

## 6. Category Assessment

### 6.1 Category totals

The distribution is arithmetically complete:

| Category | Draft 1 count | Assessment |
|---|---:|---|
| Identity Information | 8 | Consistent. |
| Participation Information | 15 | Generally consistent; Stewardship Council remains provisional. |
| Knowledge Information | 19 | Requires Policy/Challenge Policy and Template review. |
| Activity Information | 7 | Generally consistent; Verification treatment remains unresolved. |
| Derived Information | 6 | Recognition requires refinement. |
| Administrative Information | 6 | Consistent. |
| Operational Information | 1 | Consistent. |
| Analytical Information | 1 | Consistent. |
| Presentation Information | 8 | Creation Mechanism assignment remains provisional. |
| Temporary Information | 1 | Consistent. |

### 6.2 Recognition category

**Finding:** Required refinement.

Draft 1 changes Recognition from Presentation Information in the earlier Phase E1 evidence to Derived Information and defines it as an “independent derived acknowledgement subject.” EOG-04 expressly defers Recognition qualification, and the current corpus does not establish whether Recognition is calculated truth, an authoritative acknowledgement, presentation, or a composite governed outcome.

The Derived Information category therefore risks prefiguring MOT-01 and the future relationship-allocation decision. Recognition should receive expressly provisional category treatment until its constitutional qualification model is approved, or Draft 2 must cite approved higher-order support for Derived Information treatment.

### 6.3 Template category

Template consumes Platform Knowledge but is not a Knowledge Asset and does not establish meaning. Knowledge Information may still be a viable category for composition guidance, but the choice needs explicit provisional wording because CG-06 remains open.

### 6.4 Creation Mechanism category

Presentation Information is clearly labelled provisional in the Drafting Notes, but not in the row's category cell. A mechanism may ultimately be a capability rather than an information entity. The category must be expressed as “proposed if admitted” or withheld pending CG-07 so it does not imply Information Subject status.

### 6.5 Challenge Policy category

Knowledge Information is consistent with DATA's treatment of approved Policy knowledge. The issue is not the category itself; it is whether Challenge Policy is independent from CTL-01 Policy.

## 7. Boundary Assessment

### 7.1 Strong boundaries

The following boundaries are precise and mutually consistent:

- Person / Identity / Profile;
- Group / Challenge;
- Submission Intent / Acceptance Decision / Accepted Activity Event;
- Accepted Activity Event / Evidence Eligibility / Derived Truth;
- Knowledge Asset / Runtime Projection;
- Runtime Catalogue / Platform Authority;
- administrative action / Administrative record / Audit record;
- Projection / Runtime Projection; and
- presentation / source truth.

### 7.2 Boundaries requiring refinement

| Boundary | Defect | Required treatment |
|---|---|---|
| Member / Membership relationship | Person-in-context and relationship identity are not sufficiently distinguished. | Add an independent-entity justification or make Member provisional pending consolidation review. |
| Participant / Challenge participation relationship | EOG-01 relationship meaning may be confused with independent entity identity. | Add an independent-entity justification or make Participant provisional pending consolidation review. |
| Activity / Activity Knowledge Asset | Concept and meaning-bearing asset overlap. | Add reciprocal concept-versus-asset boundary. |
| Metric / Metric Knowledge Asset | Concept and meaning-bearing asset overlap. | Add reciprocal concept-versus-asset boundary. |
| Unit / Unit Knowledge Asset | Concept and meaning-bearing asset overlap. | Add reciprocal concept-versus-asset boundary. |
| Challenge Policy / Policy | Challenge scope may be mistaken for separate Policy identity. | Reconcile with Applicable Policy consolidation. |
| Verification / Information Subject | Undefined subject treatment is narrowed to evidence or claim. | Restore explicit unresolved treatment under ACT-03. |
| Recognition / Derived Truth | Derived category may imply unapproved qualification. | Make category provisional pending MOT-01 or cite approved support. |

## 8. Required Refinements

### RR-01 — Restore unresolved Information Subject treatment

For C-GRP-08, C-CHL-09, C-CHL-10, AEV-08, KNW-09, C-KNW-16 and C-CTL-07, mark the Information Subject cell explicitly as proposed or unresolved. Do not allow descriptive text to convert Phase 0 Undefined treatment into an approved classification.

### RR-02 — Make Recognition category treatment provisional

Remove the implication that Recognition is already constitutionally established as Derived Information. Preserve the candidate while making its category and “derived acknowledgement” classification dependent on MOT-01 or later Recognition governance.

### RR-03 — Apply an entity-versus-context test to Member and Participant

Explain why GRP-03 and CHL-06 require independent entity identity alongside GRP-02 and CHL-05, or make those rows provisional pending consolidation. Preserve Member ≠ Participant regardless of row treatment.

### RR-04 — Establish reciprocal concept-versus-asset boundaries

Clarify the identity distinction between Activity/Metric/Unit and Activity/Metric/Unit Knowledge Assets. If approved sources cannot support independent treatment, make the affected rows provisional rather than inferring a model.

### RR-05 — Reconcile Challenge Policy with Policy

Resolve the internal classification inconsistency between independent CHL-04 Challenge Policy and the consolidation of Applicable Policy into CTL-01 Policy. The refinement must not create Policy lifecycle or allocation rules.

### RR-06 — Revalidate counts and summaries after refinement

Any status, merge or provisional-treatment change must update:

- classification totals;
- category totals;
- gate coverage;
- consolidated and excluded concepts;
- Drafting Notes;
- Founder Review Checklist; and
- Self-Validation.

## 9. Optional Improvements

### OI-01 — Add an explicit entity-admission test

Define a compact test distinguishing an independent entity from a fact, contextual designation, relationship, type, function, mechanism or representation. This would make future domain extension more repeatable.

### OI-02 — Add explicit exclusion traces

Record Group creation event, Challenge Context and Evidence as reviewed exclusions or provisional candidates, with reasons. This would improve completeness without increasing entity count automatically.

### OI-03 — Separate source from dependency in future revisions

The combined “Sources and dependency” column is valid but dense. Separate fields could improve auditability if they do not make the register unwieldy.

### OI-04 — Add source-section precision

Where a classification is likely to be contested, cite the controlling section rather than only E2, E3, E4 or DOM.

### OI-05 — Define amendment impact evidence

Future approval governance may specify how an entity consolidation or category change demonstrates that linked allocation declarations were reviewed. This belongs after Draft 1 and does not alter the present cross-register contract.

## 10. Final Verdict

**Verdict: Constitutionally coherent, but ready for approval only after targeted register refinements.**

Draft 1 has no architectural failure, no allocation leakage and no confirmed missing foundational entity. Its structure, traceability and restraint are strong. The required refinements concern classification fidelity and overlap: unresolved Information Subject treatment, Recognition category, contextual relationship entities, concept-versus-asset identity and Policy identity.

The register is ready for a narrowly scoped Draft 2. It is not ready to become approved constitutional inventory governance in its current form.

## 11. Review Validation

| Check | Result |
|---|---|
| Draft 1 and companion package reviewed | Pass |
| Approved EOG-01 through EOG-04 boundaries reviewed | Pass |
| All 72 rows assessed structurally | Pass |
| Duplicate and merge assessment complete | Pass |
| Missing entity assessment complete | Pass |
| Category assessment complete | Pass |
| Cross-register contract compatibility assessed | Pass |
| No existing governance document modified | Pass |
| No allocation introduced | Pass |
| Markdown structure valid | Pass |
| Relative links resolve | Pass — 2 links checked |
| Whitespace validation passes | Pass |
| `git diff --check` passes | Pass |
