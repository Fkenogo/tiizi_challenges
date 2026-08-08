# Post-EOG-05 — Entity Relationship Allocation Dependency Matrix

**Status:** Planning matrix; CG-08 classification resolved; no relationship allocated

**Date:** 2026-07-21

## 1. Purpose

This matrix classifies unresolved dependencies affecting a future Entity Relationship Allocation Register. It supplements the [Phase 0 Dependency Map](21-EOG-05-DEPENDENCY-MAP.md) using the approved [EOG-05 inventory](27-EOG-05-ENTITY-OWNERSHIP-REGISTER-APPROVED.md).

The dependency owner column identifies the governing decision family or later standard. It does not allocate EOG-01 accountability.

## 2. Classification-Gate Dependencies

| Dependency | Dependency owner | Current status | Blocking effect on allocation | Expected prerequisite decisions | Classification |
|---|---|---|---|---|---|
| CG-01 — purpose, Goal and Target treatment | Founder classification governance informed by GRP and CHL | Unresolved; 4 Provisional rows | Allocations cannot safely target these rows until each is confirmed as an entity or consolidated as information about Group or Challenge. | Group-purpose treatment; CHL-01; later target-classification decision | Allocation blocker |
| CG-02 — Group Configuration and Community Context | Founder classification governance informed by CHL | Unresolved; 2 Provisional rows | Prevents independent allocation rows from being distinguished from Challenge composition information. | CHL-01 and composition-boundary confirmation | Allocation blocker |
| CG-03 — Runtime Catalogue treatment | Founder classification governance informed by KNW | Unresolved; 1 Provisional row | Prevents allocation from determining whether it concerns an entity, governed function or availability fact. | KNW runtime-governance clarification without creating a new Authority | Allocation blocker |
| CG-04 — Exercise and Wellness Asset subtype treatment | Founder classification governance informed by KNW | Unresolved; 2 Provisional rows | Risks duplicate allocations between Activity Knowledge Asset and its primary-domain types. | KNW-04 or later Knowledge Classification governance | Allocation blocker |
| CG-05 — historical reference and representation treatment | Founder classification governance informed by KNW and CHL | Unresolved; 2 Provisional rows | Risks duplicate or orphan custody, preservation and presentation allocations. | KNW-02, KNW-03 and CHL-03 boundary decisions | Allocation blocker |
| CG-06 — Template treatment | Founder classification governance informed by KNW and CHL | Unresolved; 1 Provisional row | Prevents deciding whether a distinct allocation row exists for the composition guide. | Template-classification decision consistent with EOG-03 | Allocation blocker |
| CG-07 — Creation Mechanism treatment | Founder classification governance informed by CHL | Unresolved; 1 Provisional row | Prevents allocating a mechanism as though it were an actor, Authority or independent entity. | CHL-01 and later creation-governance boundary | Allocation blocker |

### Resolved classification dependency

| Dependency | Resolution | Allocation effect | Remaining governance |
|---|---|---|---|
| CG-08 — Group Governance Body treatment | Resolved by the [EOG-05 CG-08 Constitutional Amendment](36-EOG-05-CG-08-CONSTITUTIONAL-AMENDMENT.md); C-GRP-08 has permanent inventory treatment. | Removes the classification blocker only. It allocates no EOG-01 relationship. | Governance Body composition, appointment, procedures, responsibility, tenure, roles, permissions and implementation remain deferred. |

## 3. Group Dependencies

| Dependency | Dependency owner | Current status | Blocking effect on allocation | Expected prerequisite decisions | Classification |
|---|---|---|---|---|---|
| Group creation authentication | Founder / future Group governance | Deferred by EOG-02 | Prevents declaring the Authority or accountable actor that authenticates Group existence and initial identity. | Explicit founder decision using an existing Platform Authority | Allocation blocker |
| GRP-01 — canonical roles and authority | Founder / GRP | Pending | Prevents complete Administrator and Delegate mapping, although EOG-01 relationships must remain role-independent. | GRP-01 followed by Roles and Permissions Standard | Allocation blocker |
| GRP-02 — stewardship continuity | Founder / GRP | Pending; initial creator stewardship approved separately | Prevents durable Accountable Steward treatment after reassignment, relinquishment or creator departure. | GRP-02 and stewardship-continuity governance | Allocation blocker |
| GRP-03 — Group and membership lifecycle | Founder / GRP | Pending | Affects state-sensitive Custodian, Administrator, Operator, Presenter and Downstream User scope. | GRP-03 and Group/Membership Lifecycle Standards | Allocation influence |
| GRP-04 — invitation, removal and appeal | Founder / GRP | Pending | Affects origin, Administration and Delegation for membership actions without changing membership truth Authority. | GRP-04 and later moderation/permissions governance | Allocation influence |
| Group Governance Body governance | Founder / future Group governance | Constitutional inventory recognition approved; operating governance deferred | Affects Contributor, Delegate and supporting-responsibility treatment; cannot replace the singular Accountable Steward relationship. | Governance Body composition and responsibility standard | Allocation influence |
| Group Charter governance | Founder / future Charter governance | Deferred by EOG-02 | Affects Authority, Accountable Steward, Custodian and Administrator scope for Charter truth and history. | Charter amendment, binding and historical governance | Allocation blocker |

## 4. Challenge Dependencies

| Dependency | Dependency owner | Current status | Blocking effect on allocation | Expected prerequisite decisions | Classification |
|---|---|---|---|---|---|
| CHL-01 — identity, purpose, Goal, authority and stewardship | Founder / CHL | Pending | Prevents the central Authority-to-establish-truth and Accountable Steward allocations and informs CG-01, CG-02 and CG-07. | CHL-01 founder decision consistent with EOG-03 and EOG-04 | Allocation blocker |
| CHL-02 — Challenge lifecycle | Founder / CHL | Pending | Affects lifecycle-sensitive Custodian, Administrator, Operator, Presenter and Downstream User scope. | CHL-02 and Challenge Lifecycle Standard | Allocation influence |
| CHL-03 — amendment and historical integrity | Founder / CHL | Pending | Prevents complete amendment-authority and historical-custody treatment and is required for CG-05. | CHL-03 with KNW-02 and KNW-03 | Allocation blocker |
| CHL-04 — withdrawal, lateness, completion and reopening | Founder / CHL | Pending | Affects Participation, Administration and downstream-use scope without changing the approved Authority chain. | CHL-04 and later participation/lifecycle governance | Allocation influence |

## 5. Activity-Integrity Dependencies

| Dependency | Dependency owner | Current status | Blocking effect on allocation | Expected prerequisite decisions | Classification |
|---|---|---|---|---|---|
| ACT-03 — duplicate, correction and deletion treatment | Founder / ACT | Pending | Prevents allocating correction truth, correction Administration, Custody and downstream recalculation responsibilities. | ACT-03 and later Correction Standard | Allocation blocker |
| ACT-04 — Verification and downstream effects | Founder / ACT | Pending | Prevents allocating Verification truth and its separation from Acceptance, Evidence Eligibility and Calculation. | ACT-04 and later Verification Standard | Allocation blocker |

ACT-01 and ACT-02 are Approved and supply binding allocation boundaries; they are prerequisites already satisfied, not unresolved dependencies.

## 6. Knowledge Dependencies

| Dependency | Dependency owner | Current status | Blocking effect on allocation | Expected prerequisite decisions | Classification |
|---|---|---|---|---|---|
| KNW-02 — versioning and historical representation | Founder / KNW | Pending | Affects historical Custody, Administration, Operation, Presentation and downstream use; contributes to CG-05 closure. | KNW-02 and later Knowledge Lifecycle governance | Allocation influence |
| KNW-03 — deprecation, deletion and historical references | Founder / KNW | Pending | Prevents complete Knowledge preservation, deprecation, Custody and Administration allocations. | KNW-03 and later Knowledge Lifecycle governance | Allocation blocker |
| KNW-04 — Discovery, taxonomy and projection boundaries | Founder / KNW | Pending | Prevents complete classification and allocation treatment across Interest, Goal, controlled vocabulary, Knowledge relationships and Runtime Projection; informs CG-04. | KNW-04 and future Discovery and Personalisation governance | Allocation blocker |
| Future Knowledge contribution | Founder / Contributor Governance | Direction recognized; governance deferred | Affects Contributor, Delegate, Accountable Steward and review-responsibility scope without changing Knowledge Authority. | Contributor eligibility, review and accountability governance | Allocation influence |

KNW-01 and EOG-03 are Approved and remain binding prerequisites already satisfied.

## 7. Ranking, Scoring and Motivation Dependencies

| Dependency | Dependency owner | Current status | Blocking effect on allocation | Expected prerequisite decisions | Classification |
|---|---|---|---|---|---|
| RSK-01 — authoritative Ranking source and Metric | Founder / RSK | Pending | Refines derived-truth scope and downstream use; Calculation Authority is already fixed. | RSK-01 and Ranking Standard | Allocation influence |
| RSK-02 — normalization and terminology | Founder / RSK | Pending | Influences method-specific derived, presentation and downstream-use scope without changing Calculation Authority. | RSK-02 and calculation terminology standard | Allocation influence |
| RSK-03 — tie, fairness and finalization | Founder / RSK | Pending | Affects Administration, Custody and Presentation around final results without changing Calculation Authority. | RSK-03 and Ranking Finalization Standard | Allocation influence |
| RSK-04 — Streak qualification, time and correction | Founder / RSK | Pending | Affects Streak calculation scope, Administration and downstream use and depends on correction governance. | RSK-04 with ACT-03 | Allocation influence |
| MOT-01 — goals, milestones, Recognition and Reward | Founder / MOT | Pending; Recognition Provisional | Prevents a valid Recognition allocation because qualification truth, relationship to Reward and final category remain unresolved. | MOT-01 and later Recognition governance | Allocation blocker |

## 8. Adjacent Inventory Dependencies

| Dependency | Dependency owner | Current status | Blocking effect on allocation | Expected prerequisite decisions | Classification |
|---|---|---|---|---|---|
| IDP-03 — identity lifecycle | Founder / IDP | Pending | Affects lifecycle-sensitive Custody, Administration and Presentation for identity subjects. | IDP-03 and Identity Lifecycle Standard | Allocation influence |
| IDP-04 — Profile media | Founder / IDP | Pending | Profile media is not an independent current EOG-05 row; a future entity amendment may be required. | IDP-04 before any inventory amendment | No allocation impact |
| SOC-01 and SOC-02 — social content and moderation | Founder / SOC | Pending | Affect Custody, Administration, Contributor and Presenter treatment for Group communication and Feed item. | SOC-01, SOC-02 and Moderation Standard | Allocation influence |
| NTF-01 — Notification scope and lifecycle | Founder / NTF | Pending | Prevents complete Notification truth, stewardship, custody and presentation allocation. | NTF-01 and Notification Standard | Allocation blocker |
| ANL-01 — analytics and projections | Founder / ANL | Pending | Prevents complete Analytical interpretation and Projection accountability treatment. | ANL-01 and Analytics and Measurement Standard | Allocation blocker |
| OPS-01 — operational ownership and continuity | Founder / OPS | Pending | Prevents complete Operator and Custodian allocations for Operational record and supporting processes. | OPS-01 and Platform Operations Standard | Allocation blocker |
| Roles and permissions | Future cross-platform standard | Not begun | Influences mapping from declared relationships to organizational or product roles; must not define Authority by role name. | GRP/CHL/ADM dependencies followed by Roles and Permissions Standard | Allocation influence |
| Privacy and security | Future cross-platform standards | Not begun | Constrain visibility, access and minimum-necessary use but do not independently establish truth. | Relevant IDP/GRP/ACT decisions followed by Privacy and Security Standards | Allocation influence |
| SUP-01 and SUP-02 | Founder / SUP | Pending | No support or donation entity exists in the current EOG-05 inventory; later scope may require inventory amendment. | SUP decisions before any new entity admission | No allocation impact |

## 9. Matrix Result

The matrix distinguishes row-level blockers from programme-wide start conditions. An Allocation blocker does not automatically mean every allocation row must wait. Operational Draft 1 should nevertheless wait for the start-critical cluster in the [Readiness Assessment](28-ENTITY-RELATIONSHIP-ALLOCATION-READINESS-ASSESSMENT.md#5-start-critical-blockers), because that cluster determines inventory stability and the core constitutional usefulness of the instrument.
