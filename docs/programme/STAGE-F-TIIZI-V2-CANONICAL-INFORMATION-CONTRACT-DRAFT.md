---
title: "Tiizi V2 — Stage F Canonical Information Contract"
document_type: "Stage F Canonical Information Contract — DRAFT"
stage: "Stage F — Product & Technical Translation"
version: "0.1-draft"
date: "2026-09-05"
status: "Stage F Draft — Pending Founder Review"
authority_basis:
  - "Tiizi Constitutional Ontology & Foundational Product Concepts (Document 00)"
  - "EOG-E1-01 Tiizi Entity & Operational Governance Standard v0.2"
  - "EKG-01 Tiizi Knowledge Governance Standard v0.1"
  - "CGP-04 Entity Relationship Allocation Register v0.1"
  - "Stage F T1 Product Definition DRAFT"
  - "Stage F T2 Functional Requirements DRAFT"
preserved_deferrals:
  - "ACT-03 — Verification Authority"
  - "ACT-04 — Correction Authority"
  - "MOT-01 — Recognition Authority"
  - "Rewards — implementation/custody/entitlement"
---

# Tiizi V2 — Stage F Canonical Information Contract (DRAFT)

> **Status:** Stage F Draft — Pending Founder Review
> **Version:** 0.1-draft
> **Date:** 2026-09-05
> **Classification:** Governance-derived; implementation-adjacent
> **Authority Basis:** Constitutional Ontology (Doc 00), EOG-E1-01 v0.2, EKG-01 v0.1, CGP-04 v0.1, T1 Product Definition, T2 Functional Requirements

---

## Table of Contents

1. [Purpose and Scope](#1-purpose-and-scope)
2. [Cross-Domain Invariants (Binding Constraints)](#2-cross-domain-invariants-binding-constraints)
3. [Information Boundaries — Must Not Conflate](#3-information-boundaries--must-not-conflate)
4. [Canonical Information Objects](#4-canonical-information-objects)
5. [Domain Map and Ownership Summary](#5-domain-map-and-ownership-summary)
6. [Current Implementation Implications](#6-current-implementation-implications)
7. [Deferred Authority Boundaries](#7-deferred-authority-boundaries)
8. [Appendix: Entity Relationship Summary](#8-appendix-entity-relationship-summary)
9. [Glossary of Key Terms](#9-glossary-of-key-terms)

---

## 1. Purpose and Scope

### 1.1 What This Contract Is

This Canonical Information Contract (CIC) defines **what information exists** in Tiizi V2, **who owns it**, **how it relates** to other information, and **what constraints govern it** — derived from the settled product and domain model established in Stage F T1 (Product Definition) and T2 (Functional Requirements), together with the governance standards EOG-E1-01, EKG-01, and CGP-04, and the Constitutional Ontology (Document 00).

### 1.2 What This Contract Is NOT

| This contract DOES | This contract does NOT |
|---|---|
| Define canonical information objects and their attributes | Design database schemas or table structures |
| Specify ownership and authority boundaries | Design APIs or service interfaces |
| State invariants that any implementation MUST enforce | Design UI screens or user flows |
| Identify relationships and cardinalities between information | Prescribe storage technology or indexing strategies |
| Preserve deferred authority boundaries explicitly | Resolve deferred authorities (ACT-03, ACT-04, MOT-01, Rewards) |
| Provide an engineer-useable reference for data architecture | Authorise implementation to proceed |

### 1.3 Inputs

| Source Document | Role in This Contract |
|---|---|
| Stage F T1 Product Definition (DRAFT) | Product/domain model — entities, types, rules, invariants |
| Stage F T2 Functional Requirements (DRAFT) | Functional requirements — FR identifiers, acceptance criteria |
| EOG-E1-01 Tiizi Entity & Operational Governance Standard v0.2 | Entity governance — steward accountability, lifecycle, authority allocation |
| EKG-01 Tiizi Knowledge Governance Standard v0.1 | Knowledge governance — activity definitions, categories, knowledge authority |
| CGP-04 Entity Relationship Allocation Register v0.1 | Relationship allocation — ownership boundaries, cross-entity constraints |
| Constitutional Ontology & Foundational Product Concepts (Document 00) | Constitutional foundation — core concepts, authority types, deferral register |

### 1.4 Preserved Deferrals

The following authorities are **explicitly deferred** — this contract reserves structural space for them but does NOT define their governance procedures:

| Deferred Authority | Label | Status |
|---|---|---|
| Verification Authority | ACT-03 | Deferred — verification status field reserved in Accepted Activity Event (4.13) |
| Correction Authority | ACT-04 | Deferred — correction history structure reserved; procedures TBD |
| Recognition Authority | MOT-01 | Deferred — recognition boundary defined (4.23); qualification/issuance TBD |
| Rewards | Rewards | Deferred — no information model for rewards in V2 |

### 1.5 Intended Audience

This document is written for:

- **Data architects** designing storage and query models from the canonical information definitions
- **Backend engineers** implementing business logic that must enforce invariants
- **Governance reviewers** verifying that the information model preserves authority boundaries
- **Product reviewers** confirming that the information contract matches the settled product model

### 1.6 Reading Conventions

| Convention | Meaning |
|---|---|
| MUST | Binding requirement — violation is a contract breach |
| MUST NOT | Binding prohibition — violation is a contract breach |
| SHOULD | Strong recommendation — deviation requires justification |
| MAY | Permitted option — implementation discretion |
| [DRAFT] | Not yet settled — subject to Founder review |
| T1 §X | Reference to T1 Product Definition, Section X |
| T2 FR-V2-NNN | Reference to T2 Functional Requirements, requirement NNN |
| EOG-E1-01 §N | Reference to Entity & Operational Governance Standard, section N |
| EKG-01 §N | Reference to Knowledge Governance Standard, section N |

---

## 2. Cross-Domain Invariants (Binding Constraints)

These 12 invariants are derived from T1 Section Z (Invariants & Non-Goals). They are **binding constraints** on the information model: any implementation that violates an invariant is non-conformant.

| # | Invariant | Information Model Implication | T1 Reference |
|---|---|---|---|
| 1 | Every Challenge belongs to exactly one Group | Challenge has a single `groupId` foreign reference; no Challenge exists without a Group; a Challenge cannot be moved between Groups | T1 §E |
| 2 | Group Membership ≠ Challenge Participation | These are distinct information objects (4.4 vs 4.8) with distinct identities, lifecycles, and authority; one does not imply the other | T1 §C-D, §H |
| 3 | Challenge Activity is Challenge-specific (no cross-Challenge reuse) | Challenge-Specific Activity Records (4.14) are scoped to exactly one Challenge; the same real-world Activity logged in two Challenges produces two separate records | T1 §G |
| 4 | Derived Truth precedes Recognition | Platform Recognition (4.23) references Derived Truth (4.15); Recognition cannot exist without a prior Derived Truth calculation | T1 §U, §M |
| 5 | Financial contribution never affects Challenge truth or Recognition | Support Tiizi (4.24) and Social Cause (4.25-4.26) information objects have no causal link to Derived Truth (4.15) or Recognition (4.23) | T1 §V, §W |
| 6 | Feed/sharing does not expand visibility | Group Feed Publication (4.20) and Share-to-Group (4.21) are presentation events; visibility classes (4.27) govern what can be shown, and feed/sharing cannot override them | T1 §P, §R, §X |
| 7 | Template ≠ Challenge | Challenge Template (4.9) and Challenge (4.6) are distinct information objects; a Template is a starting point, not a live Challenge; adopting a Template creates a new Challenge with a new ID | T1 §E |
| 8 | Extension ≠ Repetition | Extension modifies an active Challenge's parameters (same ID); "Run Again" creates a new Challenge (new ID) — these are distinct operations with distinct information outcomes | T1 §I, §N |
| 9 | Community Acknowledgement ≠ Platform Recognition | Kudos (4.22) and Platform Recognition (4.23) are distinct; Kudos are social actions with no governance effect; Recognition is governed and derived from truth | T1 §Q, §U |
| 10 | Challenge Engine is a product concept, not a Platform Authority | The Challenge lifecycle (draft → active → ended) is a product mechanism; it does not constitute Platform endorsement or certification of any real-world outcome | T1 §E-I |
| 11 | Platform governance supersedes Group Charter | Group Charter (4.5) operates within Platform governance boundaries; where Charter conflicts with Platform governance, Platform governance prevails | T1 §D, EOG-E1-01 §3 |
| 12 | Self-accountability: Tiizi does not certify real-world Activity | Activity Submission Intent (4.12) is a self-report; Tiizi records the report but does not attest that the Activity occurred in the real world | T1 §G |

### Invariant Enforcement Summary

| Invariant | Enforced By | Detection Mechanism |
|---|---|---|
| #1 — Single Group per Challenge | Data integrity (foreign reference) | Structural constraint on Challenge creation/update |
| #2 — Membership ≠ Participation | Separate information objects | Distinct identity keys; no implicit derivation |
| #3 — Challenge-specific records | Record scoping | Each record carries `challengeId`; no shared record references |
| #4 — Truth before Recognition | Calculation ordering | Recognition references Derived Truth; cannot be created independently |
| #5 — Financial ≠ truth | Information separation | No field or reference path from contribution objects to truth/recognition |
| #6 — Feed ≠ visibility expansion | Visibility class enforcement | Feed presentation filtered by visibility classes at render time |
| #7 — Template ≠ Challenge | Distinct information objects | Separate identity spaces; Template adoption produces new Challenge ID |
| #8 — Extension ≠ Repetition | Lifecycle state machine | Extension = parameter change on same ID; Run Again = new ID |
| #9 — Kudos ≠ Recognition | Distinct information objects | Separate identity spaces; Kudos has no effect on Recognition calculation |
| #10 — Engine ≠ Authority | Product boundary | Challenge status is product state; no Platform endorsement semantics |
| #11 — Platform > Charter | Authority hierarchy | Governance engine validates Charter provisions against Platform rules |
| #12 — Self-accountability | Information semantics | Submission Intent carries self-report semantics; no certification field |

---

## 3. Information Boundaries — Must Not Conflate

The following pairs of information objects MUST remain distinct in any implementation. Conflation (treating one as the other, merging their storage, or allowing one to substitute for the other) violates the information contract.

| # | Information A | Information B | Why They MUST NOT Be Conflated | Invariant |
|---|---|---|---|---|
| 1 | Member (4.1) | Member Profile (4.2) | Identity vs presentation/preferences. Member is the platform-level identity prerequisite; Profile is the member-controlled presentation layer. Merging them conflates who someone IS with how they CHOOSE to present. | — |
| 2 | Group Membership (4.4) | Challenge Participation (4.8) | Different relationships, different lifecycle, different authority. Membership is a Group-level relationship (join/leave); Participation is a Challenge-level commitment (join/withdraw). One does not imply the other. | #2 |
| 3 | Canonical Activity Definition (4.10) | Challenge-Specific Activity Configuration (4.11) | Knowledge vs instance configuration. The Canonical definition is governed knowledge (what an Activity IS); the Challenge-specific configuration is how THAT Challenge uses it (target, unit, frequency). Changing one must not affect the other. | #7 (analogous) |
| 4 | Activity Submission Intent (4.12) | Accepted Activity Event (4.13) | Intent vs governed acceptance. A submission is the member's self-report ("I did this"); acceptance is the governed acknowledgement that the submission is recorded. They have different authorities and different mutability rules. | #12 |
| 5 | Activity Event (Accepted, 4.13) | Derived Truth (4.15) | Raw evidence vs calculated result. An Accepted Event is a single recorded fact; Derived Truth is a computation over many events. They exist at different levels of abstraction. | #4 |
| 6 | Challenge Result (Derived Truth, 4.15) | Platform Recognition (4.23) | Truth vs acknowledgement. Derived Truth is calculated from records; Recognition is a governed acknowledgement BASED ON truth. Recognition depends on truth but is not truth itself. | #4 |
| 7 | Platform Recognition (4.23) | Kudos/Reaction (4.22) | Governed issuance vs social encouragement. Recognition is a platform-governed acknowledgement with qualification basis; Kudos is a lightweight social gesture with no governance effect. | #9 |
| 8 | Challenge Activity Goal (4.7, 4.11) | Social Cause Fundraising Goal (4.25) | Fitness truth vs financial target. A Challenge's activity goal (e.g., "run 100km") is a fitness metric; a Social Cause fundraising goal (e.g., "raise €500") is a financial target. They measure entirely different things. | #5 |
| 9 | Support Tiizi Contribution (4.24) | Social Cause Contribution (4.26) | Different beneficiary, different rules. Support Tiizi funds the platform; Social Cause contributions fund an external cause. Different collections, different reporting, different governance. | #5 |
| 10 | Group Feed Publication (4.20) | Underlying Source Information | Presentation vs truth. A feed item is a publication event — it presents information in a community stream. The underlying information (achievement, activity, share) has its own truth and visibility. Feed does NOT expand visibility. | #6 |
| 11 | Challenge-Specific Activity Records for Challenge A (4.14) | Challenge-Specific Activity Records for Challenge B (4.14) | Challenge-specific logging boundary. The same real-world Activity, logged in two different Challenges, produces two distinct records with distinct identities. Records are Challenge-scoped and never shared. | #3 |

### Conflation Risk Matrix

| High-Risk Area | Common Mistake | Correct Approach |
|---|---|---|
| Member identity | Storing profile data on the Member record | Separate Member (identity) from Profile (presentation); 1:1 but distinct |
| Group/Challenge access | Assuming Group Members can automatically participate in Challenges | Check Group Membership AND Challenge Participation independently |
| Activity knowledge | Editing canonical Activity definitions when configuring a Challenge | Create Challenge-Specific Activity Configuration; leave canonical definition unchanged |
| Activity reporting | Treating submission as acceptance | Two-step: Submission Intent → Accepted Activity Event (with governed acceptance) |
| Progress tracking | Storing progress as a static field updated manually | Derived Truth is CALCULATED from records; not independently stored as primary truth |
| Recognition | Issuing Recognition based on submission rather than Derived Truth | Recognition references Derived Truth; truth must be calculated first |
| Feed visibility | Assuming that because something appears in the feed, all members can see its details | Feed is filtered by visibility classes; feed presence ≠ universal visibility |
| Financial/truth | Allowing contribution status to affect Challenge eligibility or ranking | Financial contribution objects have NO reference path to truth or ranking calculations |

---

## 4. Canonical Information Objects

This section defines all 28 canonical information objects. Each object is defined using a compact attribute table. The definitions specify WHAT the information is, WHO owns it, and HOW it relates to other information — not HOW to store it.

### Object Index

| # | Canonical Name | Owning Domain | Section |
|---|---|---|---|
| 4.1 | Member | Member | §4.1 |
| 4.2 | Member Profile | Member | §4.2 |
| 4.3 | Group | Group | §4.3 |
| 4.4 | Group Membership | Group | §4.4 |
| 4.5 | Group Charter | Group | §4.5 |
| 4.6 | Challenge | Challenge | §4.6 |
| 4.7 | Challenge Configuration | Challenge | §4.7 |
| 4.8 | Challenge Participation | Challenge | §4.8 |
| 4.9 | Challenge Template | Challenge | §4.9 |
| 4.10 | Canonical Activity Definition | Knowledge | §4.10 |
| 4.11 | Challenge-Specific Activity Configuration | Challenge | §4.11 |
| 4.12 | Activity Submission Intent | Activity & Evidence | §4.12 |
| 4.13 | Accepted Activity Event | Activity & Evidence | §4.13 |
| 4.14 | Challenge-Specific Activity Record | Activity & Evidence | §4.14 |
| 4.15 | Derived Truth | Derived Truth | §4.15 |
| 4.16 | Collective Progress/Result | Derived Truth | §4.16 |
| 4.17 | Competitive Progress/Result/Standing | Derived Truth | §4.17 |
| 4.18 | Streak Progress/Result | Derived Truth | §4.18 |
| 4.19 | Challenge Lifecycle/Finalization | Challenge | §4.19 |
| 4.20 | Group Feed Publication | Community | §4.20 |
| 4.21 | Share-to-Group | Community | §4.21 |
| 4.22 | Kudos/Reaction | Community | §4.22 |
| 4.23 | Platform Recognition Information Boundary | Recognition | §4.23 |
| 4.24 | Support Tiizi Contribution | Contribution | §4.24 |
| 4.25 | Social Cause Information | Contribution | §4.25 |
| 4.26 | Social Cause Contribution/Reporting | Contribution | §4.26 |
| 4.27 | Visibility/Privacy/Consent | Cross-cutting | §4.27 |
| 4.28 | Historical/Audit Information | Historical Integrity | §4.28 |

---

### 4.1 Member

| Attribute | Value |
|---|---|
| **Canonical Name** | Member |
| **Owning Domain** | Member |
| **Identity** | Member ID — stable, platform-assigned; immutable once assigned |
| **Purpose** | Platform-level identity; prerequisite for all Tiizi activity. A Member MUST exist before any Group Membership, Challenge Participation, or Activity logging can occur. |
| **Required Information** | `id` (Member ID), `email`, `status` (active \| suspended \| deleted), `createdAt` |
| **Optional Information** | `emailVerified` (boolean), `lastActive` (timestamp), `role` (admin \| member) |
| **Relationships** | 1 → N Group Memberships (4.4); 1 → N Challenge Participations (4.8); 1 → 1 Member Profile (4.2) |
| **Source of Truth** | Recorded — created by platform registration process |
| **Mutability** | Mutable — `status` changes by governed action (suspension, deletion); `id` is stable and immutable; `email` mutable by member with re-verification |
| **Lifecycle / States** | `active` → `suspended` → `deleted`. Transitions are governed. Deletion is a terminal state. |
| **Visibility / Privacy** | Member identity is platform-internal. Display name (from Profile) is subject to visibility classes (4.27). Email is privileged-operational by default. |
| **Historical Preservation** | Status changes are audit-recorded (4.28). Deletion preserves audit trail; member data may be anonymised per platform policy. |
| **Authority Boundary** | Platform governance controls status transitions. ACT-03/ACT-04 [DEFERRED] may affect verification state when those authorities are defined. |
| **T1 / T2 References** | T1 §C (Member concept); T2 FR-V2-001 (registration), FR-V2-002 (authentication) |

**Notes:**

- Member is the root identity object. All other member-scoped objects reference Member ID.
- `role` distinguishes platform-level administrative access from ordinary membership. This is NOT the same as Group-level roles (steward/member in Group Membership 4.4).
- Suspension does not delete historical data; it restricts active operations.

---

### 4.2 Member Profile

| Attribute | Value |
|---|---|
| **Canonical Name** | Member Profile |
| **Owning Domain** | Member (within Platform governance) |
| **Identity** | Same as Member ID — 1:1 relationship with Member (4.1); NOT a separately-identified entity |
| **Purpose** | Presentation, preferences, interests, privacy settings, and personal information. Controls how the Member appears to others and what the Member is interested in. |
| **Required Information** | `displayName` |
| **Optional Information** | `photoURL`, `exerciseInterests[]` (enumerated), `wellnessInterests[]` (enumerated), `goals[]`, `region`, `personalInfo` (free-form structured object), `privacySettings` (structured object — see 4.27) |
| **Relationships** | 1:1 with Member (4.1) — same identity, different concern |
| **Source of Truth** | Recorded — member-provided; member is the authority for their own profile content |
| **Mutability** | Mutable by Member — the Member controls their own profile content, subject to Platform governance (e.g., content policies) |
| **Lifecycle / States** | Exists for the lifetime of the Member. No independent lifecycle. |
| **Visibility / Privacy** | Governed by `privacySettings` and visibility classes (4.27). Individual fields may have different visibility (e.g., displayName may be public; personalInfo may be private). |
| **Historical Preservation** | Profile changes are audit-recorded (4.28). Previous display names may be retained for historical intelligibility. |
| **Authority Boundary** | Member controls content; Platform governance sets boundaries (content policies, required fields). |
| **T1 / T2 References** | T1 §C (Profile concept); T2 FR-V2-182 (privacy settings), FR-V2-183 (display name), FR-V2-184 (interests), FR-V2-185 (personal info), FR-V2-186 (profile visibility) |

**MUST NOT be confused with:** Member identity (4.1). The Profile is presentation; the Member is identity. Changing a display name does not change the Member ID.

**Notes:**

- Interest arrays SHOULD use controlled vocabularies derived from Canonical Activity Definitions (4.10) categories where applicable.
- `privacySettings` is a structured object whose schema is defined by the visibility/privacy model (4.27).
- The 1:1 relationship means Profile is always accessed via its Member; it has no independent query identity.

---

### 4.3 Group

| Attribute | Value |
|---|---|
| **Canonical Name** | Group |
| **Owning Domain** | Group (under Platform governance) |
| **Identity** | Group ID — platform-assigned; immutable once assigned |
| **Purpose** | Persistent community context; the container that hosts Challenges. Groups outlive individual Challenges and provide the social fabric for collective activity. |
| **Required Information** | `id` (Group ID), `name`, `status` (active \| inactive \| suspended \| deleted), `createdAt`, `stewardId` (→ Member ID) |
| **Optional Information** | `description`, `coverImageUrl`, `charter` (→ Group Charter 4.5, or embedded), `visibility`, `groupType`, `activityInterests[]`, `wellnessTopics[]`, `locationScope` |
| **Relationships** | 1 → 1 Accountable Steward (→ Member 4.1); 1 → N Group Memberships (4.4); 1 → N Challenges (4.6); 1 → 1 Charter (4.5) |
| **Source of Truth** | Recorded — created by steward or platform admin |
| **Mutability** | Mutable — `name`, `description`, `coverImageUrl` by steward; `status` by governed action; `stewardId` by governed steward transition |
| **Lifecycle / States** | `active` → `inactive` → `suspended` → `deleted`. Transitions are governed. Deletion is terminal. |
| **Visibility / Privacy** | Group visibility determines who can discover and view the Group. Subject to visibility classes (4.27). |
| **Historical Preservation** | Status changes and steward transitions are audit-recorded (4.28). Historical Challenges remain accessible per their own lifecycle rules. |
| **Authority Boundary** | Group Steward manages Group content; Platform governance controls status and can suspend/delete. EOG-E1-01 §4 requires exactly 1 Accountable Steward at all times. |
| **T1 / T2 References** | T1 §D (Group concept); T2 FR-V2-007 (create Group), FR-V2-008 (Group settings), FR-V2-009 (Charter), FR-V2-010 (steward), FR-V2-011-015 (Group operations) |

**Invariants:**

- Exactly 1 Accountable Steward at a time (EOG-E1-01 §4). Steward transition MUST be atomic — the Group MUST never be without a Steward.
- A Group MUST have a name that is non-empty.

**Notes:**

- `groupType` may distinguish open/closed/secret Groups, affecting discovery and join mechanics.
- `locationScope` supports geographically-scoped Groups but does not enforce location-based access by itself — that is a visibility/privacy concern (4.27).
- Group inactivity (no active Challenges) does not automatically change Group status; `inactive` is a deliberate state.

---

### 4.4 Group Membership

| Attribute | Value |
|---|---|
| **Canonical Name** | Group Membership |
| **Owning Domain** | Group |
| **Identity** | Composite key: `groupId` + `memberId`. Not a separately-assigned ID. |
| **Purpose** | Represents a Member's relationship to a Group. Distinct from Challenge Participation. Gates the ability to view Group-restricted content, create Challenges within the Group, and (depending on Group rules) participate in Group Challenges. |
| **Required Information** | `groupId` (→ Group 4.3), `memberId` (→ Member 4.1), `role` (steward \| member), `status` (active \| pending \| left \| removed), `joinedAt` |
| **Optional Information** | `approvedAt` (timestamp — when pending membership was approved) |
| **Relationships** | N:1 Group (4.3); N:1 Member (4.1); **distinct from** Challenge Participation (4.8) |
| **Source of Truth** | Recorded — created by join request, invitation, or direct addition |
| **Mutability** | Mutable — join/leave/remove by governed action. Role changes by governed action (steward transition). |
| **Lifecycle / States** | `pending` → `active` → `left` / `removed`. `left` is member-initiated; `removed` is steward/governance-initiated. Both are terminal for the active relationship. |
| **Visibility / Privacy** | Membership in a Group is visible to other Group Members by default. Visibility to non-members depends on Group visibility settings (4.27). |
| **Historical Preservation** | Status transitions are audit-recorded (4.28). Historical membership is preserved for audit even after `left`/`removed`. |
| **Authority Boundary** | Join rules governed by Group settings + Platform governance. Removal by steward or Platform governance. |
| **T1 / T2 References** | T1 §C-D (Membership concept); T2 FR-V2-006 (join Group), FR-V2-021 (leave Group), FR-V2-057 (membership gating) |

**MUST NOT be confused with:** Challenge Participation (4.8). Group Membership is a Group-level relationship; Challenge Participation is a Challenge-level commitment. Being a Group Member does NOT automatically create Challenge Participation, and vice versa.

**Notes:**

- The composite identity (`groupId` + `memberId`) means there can be at most one Membership record per (Group, Member) pair.
- A Member who left and rejoins MAY reuse the same composite key with a new `joinedAt` timestamp, or MAY create a new record — implementation discretion. Historical records MUST be preserved.
- The `steward` role on a Membership record is distinct from the `stewardId` on the Group record (4.3). The Group's `stewardId` identifies the Accountable Steward; the Membership `role` indicates steward-level permissions within the Group.

---

### 4.5 Group Charter

| Attribute | Value |
|---|---|
| **Canonical Name** | Group Charter |
| **Owning Domain** | Group |
| **Identity** | Bound to Group ID — 1:1 relationship. The Charter has no independent identity; it is accessed via its Group. |
| **Purpose** | Group-level rules and community expectations. Defines Group-specific policies that operate WITHIN Platform governance boundaries. Subordinate to Platform governance — where Charter conflicts with Platform rules, Platform prevails. |
| **Required Information** | `groupId` (→ Group 4.3) |
| **Optional Information** | `articles[]` (selectable provisions from a platform-defined catalogue), `customText` (free-form Group-specific rules), `challengeCreationRestriction` (rules about who can create Challenges in this Group) |
| **Relationships** | 1:1 Group (4.3) |
| **Source of Truth** | Recorded — authored by Group Steward |
| **Mutability** | Mutable by Group Steward, subject to Platform governance validation (Charter provisions MUST NOT conflict with Platform rules) |
| **Lifecycle / States** | Exists for the lifetime of the Group. May be empty (no custom provisions). No independent lifecycle. |
| **Visibility / Privacy** | Charter content is visible to Group Members. Visibility to non-members depends on Group visibility (4.27). |
| **Historical Preservation** | Charter changes are audit-recorded (4.28). Previous versions retained for historical intelligibility. |
| **Authority Boundary** | Platform governance > Charter > Group operations. The Charter cannot override Platform governance. EOG-E1-01 §3 establishes this hierarchy. |
| **T1 / T2 References** | T1 §D (Charter concept); T2 FR-V2-009 (Charter creation), FR-V2-010 (Charter editing), FR-V2-011 (Charter provisions), FR-V2-012 (challenge creation restrictions), FR-V2-015 (Platform supremacy) |

**Authority Hierarchy:**

```
Platform Governance (absolute)
    └── Group Charter (subordinate)
        └── Group Operations (most subordinate)
```

**Notes:**

- `articles[]` is a list of selectable provisions from a platform-defined catalogue. The Platform defines which provisions are available; the Steward selects which apply to their Group.
- `challengeCreationRestriction` may limit Challenge creation to stewards only, or allow any Group Member to create Challenges.
- The Charter is optional in the sense that a Group MAY operate without custom provisions. The information object always exists (bound to the Group) but may contain only defaults.

---

### 4.6 Challenge

| Attribute | Value |
|---|---|
| **Canonical Name** | Challenge |
| **Owning Domain** | Challenge (within Group context) |
| **Identity** | Challenge ID — platform-assigned; immutable once assigned |
| **Purpose** | A time-bounded collective undertaking within a Group. Challenges are the primary product mechanism for group activity — they define what participants do, over what period, and how progress is tracked. |
| **Required Information** | `id` (Challenge ID), `groupId` (→ Group 4.3), `name`, `challengeType` (collective \| competitive \| streak), `status` (draft \| active \| ended), `createdBy` (→ Member ID), `startDate`, `endDate` |
| **Optional Information** | `description`, `coverImageUrl`, `visibility`, `durationDays`, `instructions`, `eligibility` (participation rules) |
| **Relationships** | N:1 Group (4.3); 1:1 Challenge Type; N:N Canonical Activity references (via Challenge-Specific Activity Configuration 4.11); 1 → N Challenge Participations (4.8); 0:1 Template source (→ Challenge Template 4.9) |
| **Source of Truth** | Recorded — created by a Group Member (subject to Group Charter rules) |
| **Mutability** | Mutable while `draft` or `active` (with constraints — Configuration 4.7 freezes on active); **frozen when `ended`** — no structural changes after ending |
| **Lifecycle / States** | `draft` → `active` → `ended` (via `goalReached` or `periodExpired`). `ended` is terminal. A Challenge MUST NOT be reopened after ending. |
| **Visibility / Privacy** | Challenge visibility is initially inherited from Group visibility but may be further restricted. Subject to visibility classes (4.27). |
| **Historical Preservation** | Ended Challenges are preserved in their final state. Corrections to underlying records may recalculate Derived Truth but do NOT reopen the Challenge. |
| **Authority Boundary** | Created by Group Member (subject to Charter); governed by Platform rules. Lifecycle transitions are product mechanisms (Invariant #10 — not Platform endorsement). |
| **T1 / T2 References** | T1 §E-I (Challenge concept, types, lifecycle); T2 FR-V2-022 (create Challenge), FR-V2-023 (Challenge types), FR-V2-024-028 (Challenge properties), FR-V2-120-127 (lifecycle) |

**Invariants:**

- Exactly 1 Group per Challenge (Invariant #1). `groupId` is required and immutable.
- A Challenge MUST NOT be reopened after `ended`. Corrections recalculate but do not change status.
- "Run Again" creates a NEW Challenge with a NEW ID. It is not a reopening (Invariant #8).

**Notes:**

- `challengeType` determines which type-specific Derived Truth calculations apply (4.16, 4.17, 4.18).
- `createdBy` records who created the Challenge; this is NOT necessarily the Accountable Steward. Any Group Member may create Challenges unless the Charter restricts this (4.5).
- The optional Template source reference records which Template (4.9) was used as a starting point, if any. This is informational — the Challenge is independent of its Template once created.

---

### 4.7 Challenge Configuration

| Attribute | Value |
|---|---|
| **Canonical Name** | Challenge Configuration |
| **Owning Domain** | Challenge |
| **Identity** | Bound to Challenge ID — embedded or 1:1 relationship. Has no independent identity. |
| **Purpose** | Type-specific settings that determine how the Challenge operates. Contains the parameters that define what participants must do and how progress is measured. |
| **Required Information** | `challengeType` (collective \| competitive \| streak), `target` / `goal` value, `metric`, `unit`, timing info (`startDate`, `endDate` or `durationDays`) |
| **Optional Information** | `sets`, `frequency` (daily \| total), `participationEligibility` (rules), `contributionOptions` |
| **Collective-specific** | `groupGoal` (shared target value), `autoCompleteOnGoalReached` (boolean) |
| **Competitive-specific** | `individualTarget` (per-participant target value) |
| **Streak-specific** | `dailyRequirements[]` (list of daily activity requirements), `governingTimezone` (timezone for day boundaries) |
| **Relationships** | 1:1 Challenge (4.6); N:N Canonical Activity (4.10) via activity references |
| **Source of Truth** | Recorded — set at Challenge creation |
| **Mutability** | **Immutable after Challenge goes `active`** — configuration is fixed for the lifecycle of the Challenge. Changes during `draft` are permitted. |
| **Lifecycle / States** | Created with Challenge; frozen when Challenge transitions to `active`. |
| **Visibility / Privacy** | Same as parent Challenge visibility. |
| **Historical Preservation** | Configuration snapshot preserved at `active` transition for historical reference. |
| **Authority Boundary** | Set by Challenge creator; frozen by lifecycle transition. Cannot be changed by steward or Platform during active Challenge (governed exception: Challenge cancellation). |
| **T1 / T2 References** | T1 §E (configuration concept), §J-L (type-specific rules); T2 FR-V2-043 (collective config), FR-V2-044 (competitive config), FR-V2-045 (streak config), FR-V2-046-049 (configuration properties) |

**Type-Specific Configuration Summary:**

| Field | Collective | Competitive | Streak |
|---|---|---|---|
| `groupGoal` | Required | — | — |
| `individualTarget` | — | Required | — |
| `dailyRequirements[]` | — | — | Required |
| `governingTimezone` | — | — | Required |
| `autoCompleteOnGoalReached` | Optional | — | — |
| `target` / `metric` / `unit` | Required | Required | Required |
| `frequency` | Optional | Optional | Implied (daily) |

**Notes:**

- The immutability constraint after `active` is critical: participants commit to known rules. Changing rules mid-Challenge would violate the integrity of Derived Truth.
- Streak Challenges have `dailyRequirements[]` — a list of activities that must ALL be completed each day. This is distinct from a single activity target.
- `governingTimezone` for Streaks determines when a "day" begins and ends. This is essential for daily status calculation (4.18).

---

### 4.8 Challenge Participation

| Attribute | Value |
|---|---|
| **Canonical Name** | Challenge Participation |
| **Owning Domain** | Challenge |
| **Identity** | Composite key: `challengeId` + `memberId`. Not a separately-assigned ID. |
| **Purpose** | A Member's voluntary commitment to a specific Challenge. Distinct from Group Membership (4.4). Only Participants can log Activity, appear in standings, or receive Recognition for a Challenge. |
| **Required Information** | `challengeId` (→ Challenge 4.6), `memberId` (→ Member 4.1), `status` (active \| withdrawn \| removed), `joinedAt` |
| **Optional Information** | `leftAt` (timestamp), `removalReason` |
| **Relationships** | N:1 Challenge (4.6); N:1 Member (4.1); 1 → N Challenge-Specific Activity Records (4.14) |
| **Source of Truth** | Recorded — created by member's voluntary join action |
| **Mutability** | Mutable — join/withdraw/remove by governed action. Status transitions are governed. |
| **Lifecycle / States** | `active` → `withdrawn` (member-initiated) / `removed` (governance-initiated). History is preserved — withdrawal does not delete past records. |
| **Visibility / Privacy** | Participation status visible to other Participants and Group Members (subject to visibility classes 4.27). |
| **Historical Preservation** | Status transitions audit-recorded (4.28). Withdrawn/removed Participants retain their historical Activity Records and Derived Truth contributions. |
| **Authority Boundary** | Join rules set by Challenge eligibility + Group membership requirements. Removal by Challenge creator, Group Steward, or Platform governance. |
| **T1 / T2 References** | T1 §H (Participation concept); T2 FR-V2-056 (join Challenge), FR-V2-057 (membership prerequisite), FR-V2-058-063 (participation operations) |

**MUST NOT be confused with:** Group Membership (4.4). Participation is Challenge-specific; Membership is Group-level. A Member MUST be a Group Member to participate in a Group Challenge (typically), but Membership does not automatically create Participation.

**Notes:**

- Withdrawal after Challenge end has no effect — the Participation is already historical.
- A withdrawn Participant's historical records remain in the Challenge-Specific Activity Records (4.14) and continue to contribute to Derived Truth. Withdrawal stops FUTURE logging; it does not erase PAST contributions.
- The composite identity (`challengeId` + `memberId`) means there can be at most one Participation record per (Challenge, Member) pair at any time.

---

### 4.9 Challenge Template

| Attribute | Value |
|---|---|
| **Canonical Name** | Challenge Template |
| **Owning Domain** | Challenge (admin-managed) |
| **Identity** | Template ID — platform-assigned; independent identity space from Challenges |
| **Purpose** | A reusable starting point for Challenge creation. Templates provide pre-configured settings so that Challenge creators do not need to configure everything from scratch. A Template is NOT a live Challenge. |
| **Required Information** | `id` (Template ID), `name`, `challengeType` (collective \| competitive \| streak), `status` (draft \| published \| archived) |
| **Optional Information** | `description`, `preconfiguredActivities[]` (references to Canonical Activity Definitions 4.10 with default values), `targetValues`, `duration`, `instructions` |
| **Relationships** | 1 → N Challenges created from it (informational reference; Challenges are independent once created) |
| **Source of Truth** | Recorded — created and managed by Platform admin |
| **Mutability** | Mutable by admin; **published Templates are frozen for adoption** — changes to a published Template affect only future adoptions, not already-created Challenges |
| **Lifecycle / States** | `draft` → `published` → `archived`. `archived` Templates are no longer available for new Challenge creation. |
| **Visibility / Privacy** | Templates are platform-scoped; visible to users who can create Challenges (subject to Group Charter restrictions). |
| **Historical Preservation** | Template changes audit-recorded (4.28). Versioning of published Templates is implementation-discretion. |
| **Authority Boundary** | Platform admin manages Templates. Group Stewards and Members consume Templates; they do not author them. |
| **T1 / T2 References** | T1 §E (Template concept); T2 FR-V2-029 (Template browsing), FR-V2-030 (Template adoption), FR-V2-031-034 (Template operations) |

**MUST NOT be confused with:** Challenge (4.6). A Template is a starting point — it has no Group, no Participants, no lifecycle, no Derived Truth. Adopting a Template creates a NEW Challenge with a NEW ID in a specific Group.

**Notes:**

- `preconfiguredActivities[]` contains references to Canonical Activity Definitions (4.10) with default target values, units, and frequencies. When a Challenge is created from the Template, these become the Challenge-Specific Activity Configurations (4.11).
- The informational reference from Template to Challenges-created-from-it is for analytics and management; it does not create a dependency — deleting a Template does not affect existing Challenges.

---

### 4.10 Canonical Activity Definition

| Attribute | Value |
|---|---|
| **Canonical Name** | Canonical Activity Definition |
| **Owning Domain** | Knowledge (Knowledge Authority = Founder, per EKG-01) |
| **Identity** | Activity ID — governed knowledge asset; stable across the lifetime of the definition |
| **Purpose** | Reusable activity knowledge — defines what an Activity IS: its identity, category, variants, permitted metrics and units, and guidance. This is governed knowledge, not instance data. |
| **Required Information** | `id` (Activity ID), `name`, `category` (fitness \| wellness), `permittedMetrics[]`, `permittedUnits[]` |
| **Optional Information** | `variants[]` (named variations of the Activity), `instructions`, `guidance`, `cautions`, `difficulty` (beginner \| intermediate \| advanced), `equipment[]` |
| **Relationships** | Referenced by N Challenge-Specific Activity Configurations (4.11); governed by EKG-01 |
| **Source of Truth** | Recorded — governed knowledge, maintained by Knowledge Authority |
| **Mutability** | Mutable ONLY by Knowledge Authority (Founder) or explicitly delegated admin. Changes to a Canonical Definition do NOT affect existing Challenge-Specific Configurations (they are snapshots). |
| **Lifecycle / States** | Active → Deprecated. Deprecated definitions remain referenced by historical Challenges but are not available for new Challenge configuration. |
| **Visibility / Privacy** | Canonical Activity Definitions are platform-scoped knowledge; visible to all authenticated users for browsing and selection. |
| **Historical Preservation** | Changes audit-recorded (4.28). Deprecated definitions preserved for historical reference. |
| **Authority Boundary** | Knowledge Authority (Founder, per EKG-01) controls definitions. This is a governance authority, not a product authority. |
| **T1 / T2 References** | T1 §F (Activity concept); T2 FR-V2-035 (Activity browsing), FR-V2-036 (Activity selection), FR-V2-037-042 (Activity properties and categories) |

**Category Structure (EKG-01 Initial Baseline):**

| Domain | Categories |
|---|---|
| **Fitness** (6 categories) | Cardio, Strength, Flexibility, Balance, Sport, Functional |
| **Wellness** (6 categories) | Mindfulness, Nutrition, Sleep, Recovery, Social, Personal Growth |

**Notes:**

- `permittedMetrics[]` defines what can be measured for this Activity (e.g., distance, duration, repetitions, weight). Challenge-Specific Configurations (4.11) MUST select from these permitted metrics.
- `permittedUnits[]` defines valid units for each metric (e.g., km/miles for distance; minutes/hours for duration).
- `variants[]` allows named variations (e.g., "Running" might have variants "Treadmill Running", "Trail Running") that share the same metrics but differ in guidance.
- The governed nature of this information object means it is NOT editable by Group Stewards or Challenge Creators — they can only SELECT from available definitions and configure them for their Challenge.

---

### 4.11 Challenge-Specific Activity Configuration

| Attribute | Value |
|---|---|
| **Canonical Name** | Challenge-Specific Activity Configuration |
| **Owning Domain** | Challenge |
| **Identity** | Bound to Challenge ID + Activity reference. Composite: `challengeId` + `activityId`. |
| **Purpose** | Defines how a Canonical Activity (4.10) is configured for THIS specific Challenge — the target value, unit, metric, frequency, and any instruction overrides. This is the bridge between governed knowledge and Challenge instance. |
| **Required Information** | `challengeId` (→ Challenge 4.6), `activityId` (→ Canonical Activity 4.10), `targetValue`, `unit`, `metric` |
| **Optional Information** | `sets`, `frequency` (daily \| total), `instructionsOverride`, `dailyFrequency` |
| **Relationships** | N:1 Challenge (4.6); N:1 Canonical Activity (4.10) |
| **Source of Truth** | Recorded — set at Challenge creation (from Template or manual configuration) |
| **Mutability** | **Immutable after Challenge goes `active`** — same constraint as Challenge Configuration (4.7) |
| **Lifecycle / States** | Created with Challenge; frozen when Challenge transitions to `active`. |
| **Visibility / Privacy** | Same as parent Challenge visibility. |
| **Historical Preservation** | Configuration snapshot preserved at `active` transition. |
| **Authority Boundary** | Set by Challenge creator at creation time; frozen by lifecycle. |
| **T1 / T2 References** | T1 §F (Activity in Challenges), §15 (configuration rules); T2 FR-V2-035 (activity selection in Challenge), FR-V2-036 (activity configuration), FR-V2-037 (activity metrics) |

**MUST NOT be confused with:** Canonical Activity Definition (4.10). The Canonical definition is governed knowledge (what the Activity IS). This configuration is instance data (how THIS Challenge uses the Activity). Editing the Canonical definition does NOT change existing Challenge-Specific Configurations.

**Example:**

| Field | Canonical Activity (4.10) | Challenge-Specific Config (4.11) |
|---|---|---|
| Name | "Running" | (inherited from Canonical) |
| Permitted Metrics | distance, duration, pace | (selected from permitted) |
| Permitted Units | km, miles, min, hrs | (selected from permitted) |
| Target | — | 50 |
| Unit | — | km |
| Metric | — | distance |
| Frequency | — | total (over Challenge duration) |

---

### 4.12 Activity Submission Intent

| Attribute | Value |
|---|---|
| **Canonical Name** | Activity Submission Intent |
| **Owning Domain** | Activity & Evidence (Member-authored) |
| **Identity** | Submission ID — platform-assigned |
| **Purpose** | A Participant's self-reported Activity — the "I did this" statement. This is the raw input to the governed acceptance process. It represents the Member's attestation, NOT a verified fact. |
| **Required Information** | `id` (Submission ID), `memberId` (→ Member 4.1), `challengeId` (→ Challenge 4.6), `activityId` (→ Canonical Activity 4.10), `value` (numeric), `unit`, `submittedAt` (timestamp) |
| **Optional Information** | `notes` (free text), `date` (local YYYY-MM-DD — the day the Activity was performed) |
| **Relationships** | N:1 Challenge Participation (4.8); optionally → 1 Accepted Activity Event (4.13) |
| **Source of Truth** | Recorded — member self-report. The Member is the authority for their own submission. |
| **Mutability** | Mutable by Participant while the relevant day is still open; governed correction after day closes (subject to ACT-04 [DEFERRED]) |
| **Lifecycle / States** | Submitted → Accepted (→ 4.13) / Rejected (governed). Submission is the initial state. |
| **Visibility / Privacy** | Visible to the Participant; visibility to others depends on Challenge and Group visibility settings (4.27). |
| **Historical Preservation** | Changes audit-recorded (4.28). Original submission preserved in audit trail even after correction. |
| **Authority Boundary** | Self-accountability model (Invariant #12): Tiizi does not certify that the real-world Activity occurred. The submission is the Member's attestation. ACT-03 [DEFERRED] may add verification in future. |
| **T1 / T2 References** | T1 §G (Activity reporting concept); T2 FR-V2-064 (log Activity), FR-V2-065 (submission rules), FR-V2-066-069 (submission properties), FR-V2-070 (submission correction) |

**Notes:**

- The `date` field allows back-dating within the same day (local time). Cross-day back-dating rules are implementation-discretion, subject to governance.
- A Submission Intent does NOT directly affect Derived Truth. It must first be accepted (→ 4.13) before it produces a Challenge-Specific Activity Record (4.14) that feeds Derived Truth (4.15).
- The self-accountability model means Tiizi records what Members SAY they did. Tiizi does not verify what they ACTUALLY did. This is a deliberate product choice (Invariant #12).

---

### 4.13 Accepted Activity Event

| Attribute | Value |
|---|---|
| **Canonical Name** | Accepted Activity Event |
| **Owning Domain** | Activity & Evidence (Governed — Acceptance Authority) |
| **Identity** | Accepted Event ID — platform-assigned |
| **Purpose** | The governed acceptance of an Activity Submission Intent. This is the bridge between self-report (4.12) and Challenge-Specific Activity Records (4.14). Acceptance transforms a Member's attestation into a governed record. |
| **Required Information** | `id` (Accepted Event ID), `submissionIntentId` (→ Submission Intent 4.12), `acceptedAt` (timestamp), `acceptanceAuthority` (identifier of the acceptance mechanism/authority) |
| **Optional Information** | `verificationStatus` (field reserved for ACT-03 [DEFERRED]) |
| **Relationships** | N:1 Submission Intent (4.12); consumed by N Challenge-Specific Activity Records (4.14) — one Accepted Event may feed records in multiple Challenges if the same Activity is logged in multiple Challenges |
| **Source of Truth** | Recorded — governed acceptance. The Acceptance Authority is the authority for acceptance. |
| **Mutability** | **Immutable once accepted** — subject to governed correction (ACT-04 [DEFERRED]). An accepted event cannot be un-accepted; it can only be corrected through governed procedures. |
| **Lifecycle / States** | Created upon acceptance. Immutable thereafter (subject to governed correction). |
| **Visibility / Privacy** | Same as underlying Submission Intent visibility. |
| **Historical Preservation** | Immutable by design. Corrections create new audit records (4.28) rather than modifying the original. |
| **Authority Boundary** | Acceptance Authority (governed). ACT-03 [DEFERRED] may add verification requirements. ACT-04 [DEFERRED] governs correction procedures. |
| **T1 / T2 References** | T1 §G (acceptance concept); T2 FR-V2-072 (acceptance process), FR-V2-073 (acceptance rules), FR-V2-077 (acceptance authority) |

**MUST NOT be confused with:** Activity Submission Intent (4.12). The Submission Intent is the Member's self-report; the Accepted Activity Event is the governed acceptance of that report. They have different authorities and different mutability.

**Notes:**

- The `acceptanceAuthority` field records WHO or WHAT accepted the submission. In the initial implementation, this may be automatic (system acceptance). When ACT-03 is defined, this field may carry verification state.
- A single Submission Intent produces at most one Accepted Activity Event. The Accepted Event may then feed into multiple Challenge-Specific Activity Records (4.14) if the Member is participating in multiple Challenges that reference the same Activity.
- The `verificationStatus` field is reserved for ACT-03. Until ACT-03 is defined, this field is either absent or set to a default "unverified" state.

---

### 4.14 Challenge-Specific Activity Record

| Attribute | Value |
|---|---|
| **Canonical Name** | Challenge-Specific Activity Record |
| **Owning Domain** | Activity & Evidence (Challenge-scoped) |
| **Identity** | Record ID — Challenge-scoped. Each record belongs to exactly ONE Challenge. |
| **Purpose** | The link between an Accepted Activity Event (4.13) and a specific Challenge. This is the record that feeds Derived Truth (4.15) calculations. It carries the Challenge-specific context (which Challenge, which Participant, which Activity, what value). |
| **Required Information** | `id` (Record ID), `challengeId` (→ Challenge 4.6), `participationId` (→ Challenge Participation 4.8), `acceptedEventId` (→ Accepted Activity Event 4.13), `activityId` (→ Canonical Activity 4.10), `value` (numeric), `unit`, `recordedAt` (timestamp) |
| **Optional Information** | `date` (the day this Activity counts toward), `scoringVersion` (version of the scoring algorithm used) |
| **Relationships** | N:1 Challenge Participation (4.8); N:1 Accepted Activity Event (4.13); N:1 Challenge (4.6) |
| **Source of Truth** | Recorded — derived from Accepted Activity Event, scoped to Challenge |
| **Mutability** | **Immutable once recorded** — subject to governed correction (ACT-04 [DEFERRED]). Corrections create new records or append correction annotations; original records are not modified. |
| **Lifecycle / States** | Created upon acceptance of an Activity for this Challenge. Immutable thereafter. |
| **Visibility / Privacy** | Same as parent Challenge visibility. Visible to Participant and (depending on settings) other Participants. |
| **Historical Preservation** | Immutable by design. Corrections are tracked via audit (4.28) and may produce new records. |
| **Authority Boundary** | Challenge-scoped — each record belongs to exactly one Challenge. No cross-Challenge sharing. |
| **T1 / T2 References** | T1 §G (Challenge-specific logging); T2 FR-V2-207 (Challenge-specific record — superseding FR-V2-069A), FR-V2-082 (record properties) |

**CRITICAL INVARIANT (Invariant #3):** Each Challenge-Specific Activity Record belongs to exactly ONE Challenge. If the same real-world Activity (same Accepted Event) is logged in Challenge A and Challenge B, TWO separate records are created — one scoped to Challenge A, one scoped to Challenge B. Records are NEVER shared between Challenges.

**MUST NOT be confused with:** Challenge-Specific Activity Records in other Challenges (same Challenge-Specific Activity Configuration name, different Challenge). Even if two Challenges use the same Canonical Activity with the same target, their records are distinct.

**Notes:**

- The `scoringVersion` field allows tracking which version of the Derived Truth calculation was used when this record was scored. This supports recalculation when scoring rules change.
- The link to Accepted Activity Event (via `acceptedEventId`) provides traceability back to the original self-report and acceptance.
- This is the PRIMARY input to Derived Truth (4.15) calculations. Derived Truth is computed from the set of Challenge-Specific Activity Records for a given Challenge (and optionally, for a given Participant within that Challenge).

---

### 4.15 Derived Truth

| Attribute | Value |
|---|---|
| **Canonical Name** | Derived Truth |
| **Owning Domain** | Derived Truth (Calculation Authority) |
| **Identity** | Derived from Challenge ID + calculation context (e.g., Challenge-level for Collective; Participant-level for Competitive/Streak). Not a standalone entity with its own assigned ID. |
| **Purpose** | The calculated result derived from Challenge-Specific Activity Records (4.14). This is the basis for Platform Recognition (4.23). Derived Truth is COMPUTED, not independently reported. |
| **Required Information** | `challengeId` (→ Challenge 4.6), `calculatedAt` (timestamp), `result` (type-specific — see 4.16, 4.17, 4.18) |
| **Optional Information** | `correctionHistory[]` (references to corrections that affected the calculation) |
| **Relationships** | N:1 Challenge (4.6); consumes N Challenge-Specific Activity Records (4.14); may give rise to 0:1 Platform Recognition (4.23) |
| **Source of Truth** | **DERIVED** — computed from Challenge-Specific Activity Records. Not a primary recorded fact. |
| **Mutability** | **Automatically recalculated** when underlying records change (new records added, corrections applied). Not manually editable. |
| **Lifecycle / States** | `Current` (while Challenge is `active`) → `Final` (at ending boundary — `goalReached` or `periodExpired`). Final state is stable; corrections after ending recalculate the Final value but do not reopen the Challenge. |
| **Visibility / Privacy** | Same as parent Challenge visibility. Participants see their own Derived Truth; Collective truth visible to all Participants. |
| **Historical Preservation** | Calculation snapshots preserved at key lifecycle transitions (e.g., at `ended`). Correction history tracked via audit (4.28). |
| **Authority Boundary** | Calculation Authority computes Derived Truth. Corrections subject to ACT-03/ACT-04 [DEFERRED]. Derived Truth MUST precede Recognition (Invariant #4). |
| **T1 / T2 References** | T1 §M (Derived Truth concept); T2 FR-V2-074 (calculation trigger), FR-V2-075 (calculation rules) |

**MUST NOT be confused with:**

- Raw Activity Events (Accepted Activity Events 4.13 or Challenge-Specific Records 4.14) — those are inputs; Derived Truth is the output.
- Platform Recognition (4.23) — Recognition is based ON Derived Truth but is a separate governed acknowledgement.

**Type-Specific Derived Truth:**

| Challenge Type | Derived Truth Object | Calculation Basis | T1 Reference |
|---|---|---|---|
| Collective | Collective Progress/Result (4.16) | Sum of all Participant contributions | T1 §J, §M.8 |
| Competitive | Competitive Progress/Result/Standing (4.17) | Individual progress + completion order | T1 §K, §M.9 |
| Streak | Streak Progress/Result (4.18) | Daily Done/Not-Done attestations | T1 §L, §M.10 |

**Notes:**

- Derived Truth is not stored as a primary fact — it is recalculated from records. Implementations MAY cache calculated values for performance, but the canonical source is the calculation over records.
- When records change (correction, addition, removal), Derived Truth MUST be recalculated. Stale Derived Truth is a contract violation.
- The `calculatedAt` timestamp records when the calculation was last performed. This supports audit and debugging.

---

### 4.16 Collective Progress/Result

| Attribute | Value |
|---|---|
| **Canonical Name** | Collective Progress/Result |
| **Owning Domain** | Derived Truth (Challenge — Collective type) |
| **Identity** | Bound to Challenge ID — one Collective Result per Collective Challenge |
| **Purpose** | Shared accumulation toward a common Goal. All Participants' contributions are summed into a single collective progress value. |
| **Required Information** | `challengeId` (→ Challenge 4.6), `collectiveProgress` (sum of all contributions, numeric), `configuredGoal` (target value from Configuration 4.7), `completionStatus` (active \| goalReached \| expired) |
| **Optional Information** | `extensionHistory[]` (record of extensions applied), `completionReason` (goalReached \| periodExpired) |
| **Relationships** | 1:1 Challenge (Collective type, 4.6); derived from N Challenge-Specific Activity Records (4.14) |
| **Source of Truth** | **DERIVED** — sum of all Challenge-Specific Activity Records for this Challenge |
| **Mutability** | Auto-recalculated when new records are added or corrections applied. May exceed 100% of goal. |
| **Lifecycle / States** | `active` (progress accumulating) → `goalReached` (collective progress ≥ configured goal, if autoCompleteOnGoalReached) / `expired` (period ended without reaching goal). **No failure label on expiry** — the Challenge ends; it simply did not reach the goal. |
| **Visibility / Privacy** | Collective progress visible to all Participants. |
| **Historical Preservation** | Final state preserved at Challenge end. Extension history preserved. |
| **Authority Boundary** | Calculated by Calculation Authority. Extension is a governed action. |
| **T1 / T2 References** | T1 §J (Collective type rules), §M.8 (collective calculation); T2 FR-V2-083 (collective progress), FR-V2-084-091 (collective operations) |

**Key Rules:**

| Rule | Detail |
|---|---|
| Full crossing contribution | When collective progress crosses the goal, the contribution that crosses it counts in full (no partial capping) |
| >100% allowed | Collective progress MAY exceed 100% of the configured goal |
| No failure label | If the period expires without reaching the goal, the Challenge ends — it is NOT labelled as "failed" |
| autoCompleteOnGoalReached | If configured, the Challenge transitions to `ended` immediately when goal is reached |
| Extension | May extend the Challenge period; governed action; same Challenge ID |

---

### 4.17 Competitive Progress/Result/Standing

| Attribute | Value |
|---|---|
| **Canonical Name** | Competitive Progress/Result/Standing |
| **Owning Domain** | Derived Truth (Challenge — Competitive type) |
| **Identity** | Per-Participant within Challenge — composite: `challengeId` + `memberId` |
| **Purpose** | Individual progress toward a target value; finishing positions based on completion order. Each Participant has their own progress and (if they complete) a finishing position. |
| **Required Information** | `challengeId` (→ Challenge 4.6), `memberId` (→ Member 4.1), `individualProgress` (numeric — accumulated value), `targetValue` (from Configuration 4.7) |
| **Optional Information** | `finishingPosition` (integer — 1st, 2nd, 3rd, etc.), `completionTimestamp` |
| **Relationships** | N:1 Challenge (Competitive type, 4.6); N:1 Member (4.1); derived from N Challenge-Specific Activity Records (4.14) for this Participant in this Challenge |
| **Source of Truth** | **DERIVED** — individual progress from records + completion order |
| **Mutability** | Auto-recalculated when records change. **Finishing positions may shift on corrections** — if a correction changes completion order, positions are recalculated. |
| **Lifecycle / States** | `in-progress` (accumulating) → `completed` (progress ≥ target) / `not-completed` (period ended). Only completed Participants receive a finishing position. |
| **Visibility / Privacy** | Individual progress visible to the Participant; standings visibility depends on Challenge settings. |
| **Historical Preservation** | Final standings preserved at Challenge end. Correction history tracked. |
| **Authority Boundary** | Calculated by Calculation Authority. Position recalculation on correction is automatic. |
| **T1 / T2 References** | T1 §K (Competitive type rules), §M.9 (competitive calculation); T2 FR-V2-092 (competitive progress), FR-V2-093-103 (competitive operations), FR-V2-208 (competitive standings) |

**Key Rules:**

| Rule | Detail |
|---|---|
| Race to target | Participants compete to reach the individual target first |
| Ties share position | If two Participants complete at the same value/timestamp, they share the same finishing position |
| Non-completers get no position | Participants who do not reach the target do NOT receive a finishing position |
| No HP mode | No "honourable mention" or participation trophy for non-completers |
| Position recalculation | Corrections that change completion order MUST recalculate positions |

---

### 4.18 Streak Progress/Result

| Attribute | Value |
|---|---|
| **Canonical Name** | Streak Progress/Result |
| **Owning Domain** | Derived Truth (Challenge — Streak type) |
| **Identity** | Per-Participant within Challenge — composite: `challengeId` + `memberId` |
| **Purpose** | Daily consistency tracking against a fixed period. Each day, the Participant must complete ALL required activities. The result is measured in days completed vs. total days. |
| **Required Information** | `challengeId` (→ Challenge 4.6), `memberId` (→ Member 4.1), `daysCompleted` (integer), `configuredPeriodDays` (integer — from Configuration 4.7), `governingTimezone` (from Configuration 4.7) |
| **Optional Information** | `currentStreak` (consecutive days), `bestStreak` (longest consecutive run), `finalStreak` (at Challenge end), `dailyStatuses[]` (per-day: Pending \| Complete \| Missed) |
| **Relationships** | N:1 Challenge (Streak type, 4.6); N:1 Member (4.1); derived from N Challenge-Specific Activity Records (4.14) for this Participant in this Challenge |
| **Source of Truth** | **DERIVED** — daily Done/Not-Done attestations based on records |
| **Mutability** | Auto-recalculated when records change. **Daily status is locked after the day closes** (in the governing timezone). |
| **Lifecycle / States** | `in-progress` (days accumulating) → `ended` (period complete). Daily statuses transition: Pending → Complete / Missed. |
| **Visibility / Privacy** | Individual streak visible to the Participant; streak standings visibility depends on Challenge settings. **No leaderboard** for Streaks (T1 §L). |
| **Historical Preservation** | Final streak state preserved at Challenge end. Daily statuses preserved. |
| **Authority Boundary** | Calculated by Calculation Authority. Day boundaries determined by `governingTimezone`. |
| **T1 / T2 References** | T1 §L (Streak type rules), §M.10 (streak calculation); T2 FR-V2-104 (streak progress), FR-V2-105-119 (streak operations), FR-V2-209 (streak standings), FR-V2-210 (streak daily status), FR-V2-211 (streak timezone) |

**Key Rules:**

| Rule | Detail |
|---|---|
| Daily only | Streaks measure daily consistency — no weekly, no custom periods |
| ALL requirements must be Done | If the Challenge has multiple daily requirements, ALL must be completed for the day to count as Complete |
| No grace period | A missed day is missed. No make-up, no grace period. |
| Fixed denominator | `configuredPeriodDays` is fixed at Challenge creation. The result is `daysCompleted / configuredPeriodDays`. |
| No leaderboard | Streaks do NOT have a competitive leaderboard. Participants see their own progress. |
| Day boundary | Determined by `governingTimezone`. A day closes at midnight in the governing timezone. |
| Day lock | Once a day closes, its status (Complete/Missed) is locked and cannot be changed by logging. Corrections subject to ACT-04 [DEFERRED]. |

---

### 4.19 Challenge Lifecycle/Finalization

| Attribute | Value |
|---|---|
| **Canonical Name** | Challenge Lifecycle/Finalization |
| **Owning Domain** | Challenge |
| **Identity** | Bound to Challenge ID — 1:1 with Challenge (4.6) |
| **Purpose** | State machine and finalization record for a Challenge. Tracks the Challenge through its lifecycle (draft → active → ended) and records the reason and circumstances of ending. |
| **Required Information** | `challengeId` (→ Challenge 4.6), `status` (draft \| active \| ended), `endReason` (goalReached \| periodExpired) |
| **Optional Information** | `endedAt` (timestamp), `extendedFrom` (reference to prior period if extension occurred), `repeatSource` (Challenge ID of the original if this is a "Run Again"), `frozenAt` (timestamp when records were frozen) |
| **Relationships** | 1:1 Challenge (4.6) |
| **Source of Truth** | Recorded — lifecycle transitions are product mechanisms |
| **Mutability** | Status transitions are governed. `ended` state is **stable** — corrections to underlying records recalculate Derived Truth but do NOT reopen the Challenge or change its status. |
| **Lifecycle / States** | `draft` → `active` → `ended` (`goalReached` | `periodExpired`). Terminal. |
| **Visibility / Privacy** | Same as parent Challenge. |
| **Historical Preservation** | Full lifecycle history preserved. Extension and repeat references preserved. |
| **Authority Boundary** | Lifecycle transitions are product mechanisms (Invariant #10). Platform governance can cancel a Challenge (forced transition to `ended`). |
| **T1 / T2 References** | T1 §I (lifecycle), §N (finalization); T2 FR-V2-120 (lifecycle transitions), FR-V2-121-127 (finalization operations) |

**State Machine:**

```
                    ┌──────────────────────────────┐
                    │                              │
  [draft] ──start──▶ [active] ──goal reached──▶ [ended: goalReached]
                    │                              │
                    └────period expired──────────▶ [ended: periodExpired]
                    │
                    └────cancelled (governed)────▶ [ended: periodExpired]
```

**Notes:**

- A Challenge that is cancelled by Platform governance transitions to `ended` with `endReason: periodExpired` (or a governance-specific reason if the model supports it).
- `extendedFrom` records that the Challenge's period was extended. The Challenge ID remains the same (Invariant #8 — Extension ≠ Repetition).
- `repeatSource` records the Challenge ID of the original Challenge when this Challenge was created via "Run Again". The new Challenge has a NEW ID.
- Corrections after `ended` recalculate Derived Truth (4.15) but do NOT change `status` or `endReason`. The Challenge remains `ended`.

---

### 4.20 Group Feed Publication

| Attribute | Value |
|---|---|
| **Canonical Name** | Group Feed Publication |
| **Owning Domain** | Community (Group-scoped) |
| **Identity** | Feed Item ID — platform-assigned |
| **Purpose** | A community stream item showing meaningful Group/Challenge events and explicit Shares. The feed is a PRESENTATION layer — it surfaces information but does NOT create or expand visibility. |
| **Required Information** | `id` (Feed Item ID), `groupId` (→ Group 4.3), `content` (structured — what is being presented), `createdAt` (timestamp), `source` (automatic \| share) |
| **Optional Information** | `challengeId` (→ Challenge 4.6, if related to a Challenge), `memberId` (→ Member 4.1, if a Share), `feedItemType` (categorisation of the event) |
| **Relationships** | N:1 Group (4.3); may reference Challenge (4.6), Member (4.1) |
| **Source of Truth** | Recorded — publication event. The feed item is the record of publication. |
| **Mutability** | **Immutable once published** — may be removed by governed action (deletion), but not modified. |
| **Lifecycle / States** | Published → (optionally removed by governed action). No other states. |
| **Visibility / Privacy** | **CRITICAL: Feed does NOT expand visibility.** The feed item is filtered by visibility classes (4.27). A feed item about a Challenge achievement is only visible to users who can already see the underlying achievement. Feed presence does not grant new visibility. |
| **Historical Preservation** | Feed items preserved unless removed by governed action. Removal is audit-recorded. |
| **Authority Boundary** | Automatic feed items generated by product mechanisms (Challenge events, etc.). Share feed items created by Member action (4.21). Removal by Group Steward or Platform governance. |
| **T1 / T2 References** | T1 §P (Feed concept); T2 FR-V2-128 (superseded), FR-V2-129 (superseded), FR-V2-130 (feed visibility rules) |

**CRITICAL:** The feed is a PRESENTATION, not the truth. The underlying information (achievement, Activity, Challenge event) has its own truth and visibility. The feed item is a publication event that surfaces that information in a community stream.

**MUST NOT be confused with:** The underlying source information. A feed item saying "Member X completed Challenge Y" is a presentation. The actual completion is recorded in Derived Truth (4.15). The feed item does not create the completion; it announces it.

**Feed Item Sources:**

| Source | Trigger | Example |
|---|---|---|
| `automatic` | Product mechanism | Challenge created, Challenge ended, goal reached |
| `share` | Member explicit action | Member shares their achievement to Group Feed (4.21) |

---

### 4.21 Share-to-Group

| Attribute | Value |
|---|---|
| **Canonical Name** | Share-to-Group |
| **Owning Domain** | Community (Member action) |
| **Identity** | Share event ID — or represented as a Feed Item with `source: share` (4.20) |
| **Purpose** | A Member's explicit choice to publish a personal achievement or Activity to a Group Feed. Sharing is a SEPARATE, VOLUNTARY act — it is NOT automatic. |
| **Required Information** | `memberId` (→ Member 4.1), `groupId` (→ Group 4.3), `feedItemId` (→ Feed Item 4.20, created by this share), `sharedAt` (timestamp), `sharedContent` (what is being shared) |
| **Optional Information** | `challengeId` (→ Challenge 4.6, if sharing a Challenge achievement) |
| **Relationships** | N:1 Member (4.1); N:1 Group (4.3); creates 1 Feed Item (4.20) |
| **Source of Truth** | Recorded — member action. The Member is the authority for their own sharing decision. |
| **Mutability** | **Immutable once shared** — the share event cannot be undone. The feed item may be removed by governed action. |
| **Lifecycle / States** | Created by member action. Immutable. |
| **Visibility / Privacy** | The shared content is subject to visibility classes (4.27). Sharing does NOT expand visibility beyond what the visibility model allows. |
| **Historical Preservation** | Share events preserved as part of feed history. |
| **Authority Boundary** | Member controls the decision to share. Platform governance sets boundaries (what can be shared, to whom). |
| **T1 / T2 References** | T1 §R (Share concept); T2 FR-V2-135 (share action), FR-V2-136 (share rules), FR-V2-137 (share visibility), FR-V2-212 (share operations) |

**CRITICAL:** The default is NOT shared. When a Member completes a Challenge or logs an Activity, this is NOT automatically shared to the Group Feed. Sharing is a separate, explicit, voluntary action.

**Notes:**

- A share creates a Feed Item (4.20) with `source: share`. The Feed Item is the presentation; the Share is the Member's action that caused it.
- The `sharedContent` describes what is being shared — it may reference a Derived Truth result, an Activity Record, or a Challenge completion.
- Sharing is subject to visibility: a Member cannot share content that would expose information to users who should not see it (governed by visibility classes 4.27).

---

### 4.22 Kudos/Reaction

| Attribute | Value |
|---|---|
| **Canonical Name** | Kudos/Reaction |
| **Owning Domain** | Community (Member social action) |
| **Identity** | Reaction ID — platform-assigned |
| **Purpose** | Lightweight community encouragement — a social gesture between Members. Kudos are NOT Platform Recognition and have NO effect on Challenge calculations, Derived Truth, or Recognition. |
| **Required Information** | `id` (Reaction ID), `memberId` (→ Member 4.1, the reactor), `targetId` (the target — feed item, achievement, etc.), `reactionType` (e.g., kudos, encouragement), `createdAt` |
| **Optional Information** | — |
| **Relationships** | N:1 Member (4.1, reactor); N:1 target (feed item, achievement, etc.) |
| **Source of Truth** | Recorded — member social action |
| **Mutability** | Mutable — the Member MAY change their reaction type (e.g., from kudos to encouragement). Deletion is also permitted. |
| **Lifecycle / States** | Created → (optionally modified or deleted). No governed lifecycle. |
| **Visibility / Privacy** | Visible in the context of the target (e.g., shown on the feed item). Subject to visibility classes (4.27). |
| **Historical Preservation** | Kudos are social; historical preservation is implementation-discretion. |
| **Authority Boundary** | Member social action. No governance involvement in individual Kudos. |
| **T1 / T2 References** | T1 §Q (Kudos concept); T2 FR-V2-131 (kudos action), FR-V2-132 (kudos rules), FR-V2-134 (kudos display) |

**CRITICAL:** Kudos do NOT affect:

- Challenge calculations
- Derived Truth (4.15)
- Platform Recognition (4.23)
- Finishing positions (4.17)
- Challenge eligibility
- Any governed outcome

Kudos are purely social. They are encouragement, not acknowledgement.

**MUST NOT be confused with:** Platform Recognition (4.23). Recognition is governed and derived from truth. Kudos are social and have no governance effect.

---

### 4.23 Platform Recognition Information Boundary

| Attribute | Value |
|---|---|
| **Canonical Name** | Platform Recognition Information Boundary |
| **Owning Domain** | Recognition (Platform Policy — MOT-01 deferred) |
| **Identity** | Recognition ID — assigned when Recognition is issued |
| **Purpose** | A governed acknowledgement based on Derived Truth. Recognition is the Platform's formal acknowledgement that a Member has achieved something in a Challenge, as calculated by Derived Truth. |
| **Required Information** | `challengeId` (→ Challenge 4.6), `memberId` (→ Member 4.1), `derivedTruthReference` (→ Derived Truth 4.15), `recognitionType` (categorisation of the recognition) |
| **Optional Information** | `issuedAt` (timestamp), `qualificationBasis` (description of why this Recognition was issued — reserved for MOT-01) |
| **Relationships** | Derived from Derived Truth (4.15); distinct from Kudos (4.22) |
| **Source of Truth** | Recorded — when issued. Recognition is issued based on Derived Truth. |
| **Mutability** | Mutable if Derived Truth changes — recalculation of Derived Truth MAY invalidate a previously-issued Recognition. Recognition MUST reflect current Derived Truth. |
| **Lifecycle / States** | Not-yet-issued → Issued → (optionally Invalidated if Derived Truth changes). |
| **Visibility / Privacy** | Recognition visible to the recognised Member; visibility to others depends on Challenge and Group settings (4.27). |
| **Historical Preservation** | Issuance and invalidation audit-recorded (4.28). |
| **Authority Boundary** | **MOT-01 [DEFERRED]** — who defines qualification conditions, who issues Recognition, and how Recognition is withdrawn are all deferred. This contract defines the information BOUNDARY (what Recognition is and what it relates to) but not the governance procedures. |
| **T1 / T2 References** | T1 §U (Recognition concept); T2 FR-V2-142 (Recognition boundary), FR-V2-143-147 (Recognition operations) |

**MUST NOT be confused with:**

- Challenge Result / Derived Truth (4.15) — Recognition is BASED ON truth but is a separate acknowledgement.
- Kudos (4.22) — Recognition is governed; Kudos are social.

**Deferred Elements [MOT-01]:**

| Element | Status |
|---|---|
| Qualification conditions (what triggers Recognition) | Deferred — MOT-01 |
| Issuance authority (who/what issues Recognition) | Deferred — MOT-01 |
| Withdrawal procedures (how Recognition is revoked) | Deferred — MOT-01 |
| Recognition types and categories | Partially defined (recognitionType field reserved) |
| Relationship to rewards | Deferred — Rewards |

**Notes:**

- The `derivedTruthReference` is critical: it ensures that every Recognition is traceable to a specific Derived Truth calculation. Without this link, Recognition would be unmoored from truth (violating Invariant #4).
- If Derived Truth changes (e.g., due to correction), the Recognition MUST be re-evaluated. If the corrected truth no longer qualifies, the Recognition is invalidated.

---

### 4.24 Support Tiizi Contribution

| Attribute | Value |
|---|---|
| **Canonical Name** | Support Tiizi Contribution |
| **Owning Domain** | Contribution (Member + Platform) |
| **Identity** | Contribution ID — platform-assigned |
| **Purpose** | A voluntary financial contribution to support the Tiizi platform. This is platform funding, NOT Social Cause funding. |
| **Required Information** | `id` (Contribution ID), `memberId` (→ Member 4.1), `amount` (numeric), `currency`, `status` (intent \| confirmed), `createdAt` |
| **Optional Information** | `challengeId` (→ Challenge 4.6, if the contribution was made via a Challenge-level CTA), `paymentMethod`, `transactionId` (external payment reference) |
| **Relationships** | N:1 Member (4.1); optionally N:1 Challenge (4.6) |
| **Source of Truth** | Recorded — contribution event |
| **Mutability** | Status transitions: `intent` → `confirmed`. Confirmed is terminal. |
| **Lifecycle / States** | `intent` (initiated but not completed) → `confirmed` (payment completed). |
| **Visibility / Privacy** | Contribution details are privileged-operational. Not visible to other Members. |
| **Historical Preservation** | Contribution records preserved for financial audit. |
| **Authority Boundary** | Platform manages contribution processing. Financial governance applies. |
| **T1 / T2 References** | T1 §V (Support Tiizi concept); T2 FR-V2-155 (contribution action), FR-V2-156-162 (contribution operations) |

**CRITICAL:** Support Tiizi contributions do NOT affect:

- Challenge eligibility
- Activity logging or acceptance
- Progress or Derived Truth
- Completion status
- Ranking or finishing positions
- Platform Recognition

Financial contribution is completely separate from Challenge truth and Recognition (Invariant #5).

---

### 4.25 Social Cause Information

| Attribute | Value |
|---|---|
| **Canonical Name** | Social Cause Information |
| **Owning Domain** | Contribution (Challenge creator + Platform) |
| **Identity** | Bound to Challenge ID — 1:1 optional relationship. Not all Challenges have a Social Cause. |
| **Purpose** | Defines the Social Cause associated with a Challenge — the cause description, beneficiary, fundraising Goal, payment destination, and review status. This is an OPTIONAL capability that requires Platform review before fundraising activation. |
| **Required Information** | `challengeId` (→ Challenge 4.6), `causeTitle`, `causeDescription`, `beneficiary`, `fundraisingGoal` (numeric), `paymentDestination` (where funds go), `reviewStatus` (draft \| under_review \| approved \| rejected) |
| **Optional Information** | `supportingInfo` (additional context about the cause) |
| **Relationships** | 1:1 Challenge (4.6, optional); distinct from Challenge Activity Goal (4.7, 4.11) |
| **Source of Truth** | Recorded — authored by Challenge creator, reviewed by Platform |
| **Mutability** | Mutable during `draft`/`under_review`; **frozen when `approved`** — approved cause details cannot be changed without re-review. |
| **Lifecycle / States** | `draft` → `under_review` → `approved` / `rejected`. `rejected` may return to `draft` for revision. |
| **Visibility / Privacy** | Approved cause information visible to Challenge Participants. Draft/rejected cause information visible only to creator and reviewers. |
| **Historical Preservation** | Review history audit-recorded (4.28). |
| **Authority Boundary** | Challenge creator authors cause; Platform reviews and approves. Ordinary Challenges do NOT require approval — only Challenges with Social Cause fundraising. |
| **T1 / T2 References** | T1 §W (Social Cause concept); T2 FR-V2-163 (cause creation), FR-V2-164 (cause review), FR-V2-165-166 (cause properties), FR-V2-167 (fundraising activation), FR-V2-168-174 (cause operations) |

**MUST NOT be confused with:**

- Challenge Activity Goal (4.7, 4.11) — the activity goal (e.g., "run 100km") is a fitness metric; the fundraising goal (e.g., "raise €500") is a financial target. They measure entirely different things (Invariant #5).
- Support Tiizi Contribution (4.24) — Support Tiizi funds the platform; Social Cause contributions fund an external cause. Different beneficiary, different rules.

**Notes:**

- `reviewStatus` is critical: fundraising CANNOT be activated until the cause is `approved`. This is a Platform governance requirement.
- `paymentDestination` identifies where raised funds should go. This is verified during the review process.
- Ordinary Challenges (without Social Cause) do NOT require any review or approval. The review requirement is specific to the Social Cause fundraising capability.

---

### 4.26 Social Cause Contribution/Reporting

| Attribute | Value |
|---|---|
| **Canonical Name** | Social Cause Contribution/Reporting |
| **Owning Domain** | Contribution (Member self-report + Platform) |
| **Identity** | Contribution report ID — platform-assigned |
| **Purpose** | A Participant's self-reported financial contribution to a Social Cause. This is a DECLARATION, not a verified payment record. |
| **Required Information** | `id` (Report ID), `challengeId` (→ Challenge 4.6, which has a Social Cause), `memberId` (→ Member 4.1), `declaredAmount` (numeric), `currency`, `declaredAt` (timestamp) |
| **Optional Information** | `paymentReference` (external payment reference — optional, not verified) |
| **Relationships** | N:1 Challenge (with Social Cause, 4.6); N:1 Member (4.1) |
| **Source of Truth** | Recorded — member self-report. The Member declares what they contributed. |
| **Mutability** | **Immutable once declared** — a declaration cannot be edited. Corrections require a new declaration or governed procedure. |
| **Lifecycle / States** | Declared. Immutable. |
| **Visibility / Privacy** | Visible to the declaring Member. Aggregate reporting visible per Challenge Social Cause settings. Individual contributions may be private. |
| **Historical Preservation** | Declarations preserved immutably. |
| **Authority Boundary** | Self-report model (analogous to Activity self-report). Tiizi does not verify that the payment was actually made. |
| **T1 / T2 References** | T1 §W (Social Cause reporting); T2 FR-V2-167 (contribution declaration), FR-V2-168 (declaration rules), FR-V2-174 (reporting) |

**CRITICAL:**

- Self-report is NOT verified payment. A declaration says "I contributed €X" — Tiizi records the declaration but does not verify the payment.
- Community-reported total ≠ "Amount Raised". The sum of self-reported declarations is a community-reported figure, not a verified fundraising total.
- Discrepancy ≠ misconduct. Differences between self-reported totals and actual funds received are not automatically evidence of misconduct — they reflect the self-report model.

---

### 4.27 Visibility/Privacy/Consent

| Attribute | Value |
|---|---|
| **Canonical Name** | Visibility/Privacy/Consent |
| **Owning Domain** | Cross-cutting (Platform governance) |
| **Identity** | Not a single entity — this is a cross-cutting concern applied to ALL information objects |
| **Purpose** | Governs what information is visible to whom, under what conditions. Defines visibility classes and consent requirements that apply across all domains. |
| **Required Information** | N/A — cross-cutting model, not a single record |
| **Visibility Classes** | See table below |
| **Relationships** | Applies to ALL information objects (4.1–4.26, 4.28) |
| **Source of Truth** | Recorded (settings) + Governed (classes) |
| **Mutability** | Visibility settings mutable by information owner (within governance bounds). Visibility classes governed by Platform. |
| **Authority Boundary** | Platform governance defines visibility classes and consent requirements. Individual Members control their own privacy settings within those classes. |
| **T1 / T2 References** | T1 §X (Visibility concept); T2 FR-V2-182 (privacy settings), FR-V2-183-186 (visibility operations) |

**Visibility Classes:**

| Class | Description | Examples |
|---|---|---|
| **Public** | Visible to anyone, including unauthenticated users | Platform description, public Group info |
| **Authenticated-discoverable** | Visible to any authenticated Tiizi user | Public Group listings, public Challenge results |
| **Shared-group** | Visible to Members of a specific Group | Group Feed, Group Challenge details, Group Member list |
| **Private** | Visible only to the information owner | Personal settings, private profile fields |
| **Privileged-operational** | Visible only to Platform governance / admin | System logs, audit trails, financial records, email addresses |

**Consent Rules:**

| Rule | Detail |
|---|---|
| Governed consent | Where governance requires consent (e.g., data sharing), consent state MUST be respected |
| Consent withdrawal | Withdrawal of consent takes effect prospectively; historical records preserved for audit |
| Feed/sharing ≠ visibility expansion | Feed items and shares are filtered by visibility classes — they do NOT grant new visibility (Invariant #6) |

**Notes:**

- Every information object (4.1–4.26, 4.28) has a default visibility class. Some objects have field-level visibility (e.g., Member Profile 4.2 — displayName may be public while personalInfo is private).
- Visibility is evaluated at READ time, not at write time. Information is always stored; visibility controls who can see it.
- The visibility model interacts with Feed (4.20) and Sharing (4.21): feed items and shares are filtered by the visibility of the underlying information. A private achievement cannot be made visible via a feed post.

---

### 4.28 Historical/Audit Information

| Attribute | Value |
|---|---|
| **Canonical Name** | Historical/Audit Information |
| **Owning Domain** | Historical Integrity (Platform) |
| **Identity** | Audit record ID — platform-assigned |
| **Purpose** | Prevents silent rewriting of information; maintains historical intelligibility. Every significant change to any information object is recorded in the audit trail. |
| **Required Information** | `entityType` (which information object was changed), `entityId` (which instance), `action` (created \| updated \| corrected \| deleted), `actorId` (→ Member ID or system), `timestamp`, `beforeSnapshot` (state before change), `afterSnapshot` (state after change) |
| **Optional Information** | `correctionReason`, `correctionAuthority` (which authority authorised the correction — relevant when ACT-04 is defined) |
| **Relationships** | References any entity (polymorphic reference) |
| **Source of Truth** | Recorded — append-only audit log |
| **Mutability** | **APPEND-ONLY** — audit records are NEVER modified or deleted. This is a binding constraint. |
| **Lifecycle / States** | Created on every significant change. Immutable. Permanent. |
| **Visibility / Privacy** | Privileged-operational — visible only to Platform governance / admin. |
| **Historical Preservation** | The audit log IS the historical preservation mechanism. It is itself never modified. |
| **Authority Boundary** | Platform manages audit infrastructure. Audit records are generated automatically by governed actions. |
| **T1 / T2 References** | T1 §N (Historical integrity); T2 FR-V2-175 (audit trail), FR-V2-176-181 (audit operations) |

**CRITICAL:** Every correction MUST be attributable and historically traceable. The audit trail records:

- WHO made the change (`actorId`)
- WHAT changed (`beforeSnapshot` → `afterSnapshot`)
- WHEN it changed (`timestamp`)
- WHY it changed (`correctionReason`, when applicable)
- UNDER WHAT AUTHORITY (`correctionAuthority`, when ACT-04 is defined)

**Notes:**

- The append-only constraint means that even erroneous audit records are not deleted — they are part of the historical record. Corrections to audit records are not possible; if an audit record itself is wrong, a new audit record documenting the error is appended.
- `beforeSnapshot` and `afterSnapshot` are structured representations of the entity state. The schema depends on the entity type.
- The audit trail supports both governance (accountability) and debugging (understanding what changed and when).

---

## 5. Domain Map and Ownership Summary

This table maps each governance domain to its authority and the information objects it encompasses.

| Domain | Authority | Information Objects | Governance Standard |
|---|---|---|---|
| **Member** | Platform governance | Member (4.1), Member Profile (4.2) | EOG-E1-01 |
| **Group** | Group Steward + Platform governance | Group (4.3), Group Membership (4.4), Group Charter (4.5) | EOG-E1-01 |
| **Challenge** | Group + Challenge Creator | Challenge (4.6), Challenge Configuration (4.7), Challenge Participation (4.8), Challenge Template (4.9) | EOG-E1-01 |
| **Knowledge** | Knowledge Authority (Founder, per EKG-01) | Canonical Activity Definition (4.10) | EKG-01 |
| **Activity & Evidence** | Member (self-report) + Acceptance Authority (governed) | Submission Intent (4.12), Accepted Activity Event (4.13), Challenge-Specific Activity Record (4.14) | EOG-E1-01 |
| **Derived Truth** | Calculation Authority | Derived Truth (4.15), Collective Result (4.16), Competitive Result (4.17), Streak Result (4.18) | EOG-E1-01 |
| **Challenge Lifecycle** | Product mechanism + Platform governance | Challenge Lifecycle/Finalization (4.19) | EOG-E1-01 |
| **Recognition** | Platform Policy (MOT-01 [DEFERRED]) | Platform Recognition Information Boundary (4.23) | MOT-01 (deferred) |
| **Community** | Member social actions | Group Feed Publication (4.20), Share-to-Group (4.21), Kudos/Reaction (4.22) | Platform governance |
| **Contribution** | Member + Platform | Support Tiizi Contribution (4.24), Social Cause Information (4.25), Social Cause Contribution/Reporting (4.26) | Platform governance |
| **Visibility & Privacy** | Platform governance | Cross-cutting — applies to all objects (4.27) | Platform governance |
| **Historical Integrity** | Platform | Historical/Audit Information (4.28) | Platform governance |

### Authority Interaction Map

```
Platform Governance (supreme authority)
├── Member domain ──────────── Platform assigns identity, controls status
├── Group domain ───────────── Steward manages content; Platform controls status
│   └── Challenge domain ───── Creator configures; Steward oversees; Platform governs
│       ├── Knowledge ──────── Knowledge Authority (Founder) governs definitions
│       ├── Activity ───────── Member self-reports; Acceptance Authority governs
│       ├── Derived Truth ──── Calculation Authority computes
│       └── Lifecycle ──────── Product mechanism; Platform can cancel
├── Recognition ────────────── MOT-01 [DEFERRED]
├── Community ──────────────── Member social actions within Platform bounds
├── Contribution ───────────── Member + Platform financial governance
├── Visibility ─────────────── Platform governance (cross-cutting)
└── Historical Integrity ───── Platform (append-only audit)
```

### Cross-Domain Reference Summary

| From Domain | To Domain | Reference Type | Example |
|---|---|---|---|
| Group → Member | Steward accountability | 1:1 foreign reference | Group.stewardId → Member.id |
| Challenge → Group | Containment | N:1 foreign reference | Challenge.groupId → Group.id |
| Participation → Member | Voluntary commitment | N:1 foreign reference | Participation.memberId → Member.id |
| Participation → Challenge | Voluntary commitment | N:1 foreign reference | Participation.challengeId → Challenge.id |
| Activity Config → Canonical Activity | Knowledge reference | N:1 foreign reference | Config.activityId → Activity.id |
| Activity Record → Accepted Event | Evidence link | N:1 foreign reference | Record.acceptedEventId → Event.id |
| Derived Truth → Activity Records | Calculation input | Consumes N records | Derived from Records for Challenge |
| Recognition → Derived Truth | Qualification basis | 1:1 reference | Recognition.derivedTruthReference → Derived Truth |
| Feed Item → Group | Presentation scope | N:1 foreign reference | FeedItem.groupId → Group.id |
| Share → Feed Item | Causation | 1:1 creation | Share creates Feed Item |
| Social Cause → Challenge | Optional extension | 1:1 foreign reference | SocialCause.challengeId → Challenge.id |

---

## 6. Current Implementation Implications

This section notes key observations about how the canonical information contract relates to the current (pre-V2) implementation. These are NOT prescriptions — they are observations for the data architecture team.

### 6.1 Alignment Observations

| Current Implementation | CIC Alignment | Notes |
|---|---|---|
| Composite document IDs (`{parentId}_{childId}`) for memberships | **Consistent** with CIC identity model (4.4, 4.8 use composite keys) | The composite key pattern aligns with the CIC's composite identity for Group Membership and Challenge Participation |
| Challenge activities embedded in Challenge documents | **Mapped** to Challenge-Specific Activity Configuration (4.11) | CIC treats these as distinct information objects; implementation may choose to embed or separate |
| Feed items denormalized by Cloud Functions | **Mapped** to Group Feed Publication (4.20) | CIC defines the canonical boundary; denormalisation is an implementation strategy |
| Support Tiizi and Social Cause contributions as separate collections | **Consistent** with CIC separation (4.24 vs 4.26) | Different beneficiaries, different rules — separate storage is correct |

### 6.2 Divergence Observations

| Current Implementation | CIC Position | Implication |
|---|---|---|
| Comments/replies on feed items | **EXCLUDED** from initial V2 per T1 §Q | Current comment/reply functionality is not part of V2 initial scope; if retained, requires a new information object definition |
| Notifications stored as inline array fields | CIC does not specify storage | Notification information SHOULD be modelled as a distinct information object if needed downstream; inline arrays may not scale |
| Scoring uses `proportional_capped` method | CIC defines WHAT is derived, not HOW | Scoring method is an implementation detail; CIC defines that Derived Truth is calculated from records, not which algorithm is used |
| Group `stewardId` may be missing during transitions | CIC requires exactly 1 Steward (EOG-E1-01 §4) | Implementation MUST ensure atomic steward transitions; a Group without a Steward is a contract violation |

### 6.3 Implementation Discretion Areas

The following are explicitly left to implementation discretion:

| Area | CIC Position | Implementation Options |
|---|---|---|
| Storage technology | Not specified | Document DB, relational, hybrid — CIC defines information, not storage |
| Embedding vs referencing | Relationships defined; storage strategy not | Challenge-Specific Activity Configs may be embedded in Challenge or separate |
| Derived Truth caching | CIC requires recalculation on change | Cache strategy (eager, lazy, materialised views) is implementation choice |
| Audit record format | CIC defines required fields | JSON, structured log, event stream — implementation choice |
| Feed generation strategy | CIC defines Feed Publication boundary | Denormalisation, real-time generation, queued generation — implementation choice |
| Notification model | Not specified in V2 CIC | Separate information object, event-driven, polling — TBD |

### 6.4 Migration Considerations

| Current Pattern | V2 Pattern | Migration Note |
|---|---|---|
| Embedded activities | Challenge-Specific Activity Configuration (4.11) | Embedded activities may need extraction to separate records or structured sub-documents |
| Inline notifications | TBD (not in V2 CIC) | If notifications are retained, design as distinct information object |
| Direct scoring | Derived Truth calculation (4.15) | Current scoring logic maps to Derived Truth calculation; ensure recalculation on correction |
| Flat feed | Feed Publication (4.20) with visibility filtering | Feed generation must incorporate visibility class filtering |

---

## 7. Deferred Authority Boundaries

This section documents the deferred authorities and their impact on the information model. Each deferred authority has reserved structural space in the CIC but its governance procedures are NOT defined.

| Deferred Authority | Label | Information Object(s) Affected | What IS Defined | What IS Deferred |
|---|---|---|---|---|
| **Verification Authority** | ACT-03 | Accepted Activity Event (4.13) | Event structure exists; `verificationStatus` field reserved | How verification works, who verifies, what triggers verification, verification outcomes |
| **Correction Authority** | ACT-04 | Accepted Activity Event (4.13), Challenge-Specific Activity Record (4.14), Derived Truth (4.15) | Correction history structure; audit trail required (4.28) | Who can request corrections, who approves, correction procedures, time limits, correction scope |
| **Recognition Authority** | MOT-01 | Platform Recognition (4.23) | Recognition boundary defined; `qualificationBasis` field reserved | Who defines qualification conditions, who issues Recognition, how Recognition is withdrawn, Recognition types |
| **Rewards** | Rewards | None currently defined | No information model for rewards in V2 | Whether rewards get an information model, what triggers entitlement, custody model, entitlement rules |

### Deferred Authority Impact Matrix

| Information Object | ACT-03 Impact | ACT-04 Impact | MOT-01 Impact | Rewards Impact |
|---|---|---|---|---|
| Submission Intent (4.12) | May gain verification metadata | Subject to correction procedures | — | — |
| Accepted Activity Event (4.13) | `verificationStatus` populated | Correction procedures apply | — | — |
| Challenge-Specific Record (4.14) | — | Correction procedures apply | — | — |
| Derived Truth (4.15) | — | Recalculated on correction | Re-evaluated on truth change | — |
| Platform Recognition (4.23) | — | May be invalidated by correction | Qualification/issuance defined | May link to entitlement |
| Collective Result (4.16) | — | Recalculated on correction | — | — |
| Competitive Result (4.17) | — | Positions recalculated | — | — |
| Streak Result (4.18) | — | Daily statuses recalculated | — | — |

### Structural Reservations

The following fields/structures are reserved for deferred authorities:

| Field | Object | Reserved For | Current State |
|---|---|---|---|
| `verificationStatus` | Accepted Activity Event (4.13) | ACT-03 | Absent or default "unverified" |
| `correctionReason` | Audit Information (4.28) | ACT-04 | Optional; populated when correction occurs |
| `correctionAuthority` | Audit Information (4.28) | ACT-04 | Optional; populated when ACT-04 defines authority |
| `qualificationBasis` | Platform Recognition (4.23) | MOT-01 | Optional; populated when Recognition is issued |

### Deferral Resolution Path

| Authority | Resolution Requires | Blocking For |
|---|---|---|
| ACT-03 | Governance decision on verification model | Full Activity verification workflow |
| ACT-04 | Governance decision on correction procedures | Correction request/approval workflow |
| MOT-01 | Governance decision on Recognition qualification | Recognition issuance and withdrawal |
| Rewards | Product decision on rewards model | Rewards information model and entitlement |

**Note:** None of these deferrals block the initial V2 implementation. The reserved fields are optional, and the core information model functions without them. They are designed to be additive — resolving a deferral adds governance procedures without restructuring existing information objects.

---

## 8. Appendix: Entity Relationship Summary

### 8.1 Relationship Diagram (Text Form)

```
Member (4.1)
├── 1:1 ──▶ Member Profile (4.2)
├── 1:N ──▶ Group Membership (4.4)
│              └── N:1 ──▶ Group (4.3)
│                            ├── 1:1 ──▶ Group Charter (4.5)
│                            ├── 1:1 ──▶ Steward (→ Member)
│                            ├── 1:N ──▶ Challenge (4.6)
│                            │              ├── 1:1 ──▶ Challenge Configuration (4.7)
│                            │              │              └── 1:N ──▶ Challenge-Specific Activity Config (4.11)
│                            │              │                               └── N:1 ──▶ Canonical Activity Definition (4.10)
│                            │              ├── 1:N ──▶ Challenge Participation (4.8)
│                            │              │              └── 1:N ──▶ Challenge-Specific Activity Record (4.14)
│                            │              │                               └── N:1 ──▶ Accepted Activity Event (4.13)
│                            │              │                                                └── N:1 ──▶ Submission Intent (4.12)
│                            │              ├── 0:1 ──▶ Challenge Template (4.9) [source]
│                            │              ├── 1:1 ──▶ Challenge Lifecycle (4.19)
│                            │              └── 0:1 ──▶ Social Cause Information (4.25)
│                            │                               └── 1:N ──▶ Social Cause Contribution (4.26)
│                            └── 1:N ──▶ Group Feed Publication (4.20)
│                                           └── 0:N ──▶ Kudos/Reaction (4.22)
├── 1:N ──▶ Challenge Participation (4.8) [also via Group Membership path]
├── 0:N ──▶ Share-to-Group (4.21) ──▶ creates Feed Item (4.20)
├── 0:N ──▶ Kudos/Reaction (4.22) [as reactor]
├── 0:N ──▶ Support Tiizi Contribution (4.24)
└── 0:N ──▶ Activity Submission Intent (4.12)

Derived Truth (4.15)
├── ← Challenge-Specific Activity Records (4.14) [calculated from]
├── 0:1 ──▶ Platform Recognition (4.23) [may give rise to]
├── Collective Result (4.16) [type: collective]
├── Competitive Result (4.17) [type: competitive]
└── Streak Result (4.18) [type: streak]

Historical/Audit Information (4.28)
└── References any entity [polymorphic]

Visibility/Privacy/Consent (4.27)
└── Cross-cutting: applies to all entities
```

### 8.2 Cardinality Summary Table

| Relationship | From | To | Cardinality | Constraint |
|---|---|---|---|---|
| Member → Profile | Member (4.1) | Member Profile (4.2) | 1:1 | Profile always exists for active Member |
| Member → Group Membership | Member (4.1) | Group Membership (4.4) | 1:N | Member can belong to many Groups |
| Member → Challenge Participation | Member (4.1) | Challenge Participation (4.8) | 1:N | Member can participate in many Challenges |
| Group → Steward | Group (4.3) | Member (4.1) | 1:1 | Exactly 1 Accountable Steward (EOG-E1-01 §4) |
| Group → Charter | Group (4.3) | Group Charter (4.5) | 1:1 | Charter always exists (may be empty/default) |
| Group → Challenge | Group (4.3) | Challenge (4.6) | 1:N | Group hosts many Challenges over time |
| Group → Membership | Group (4.3) | Group Membership (4.4) | 1:N | Group has many Members |
| Group → Feed Item | Group (4.3) | Feed Publication (4.20) | 1:N | Group has many Feed Items |
| Challenge → Group | Challenge (4.6) | Group (4.3) | N:1 | Challenge belongs to exactly 1 Group (Invariant #1) |
| Challenge → Configuration | Challenge (4.6) | Challenge Configuration (4.7) | 1:1 | Configuration bound to Challenge |
| Challenge → Activity Config | Challenge (4.6) | Activity Config (4.11) | 1:N | Challenge references many Activities |
| Challenge → Participation | Challenge (4.6) | Challenge Participation (4.8) | 1:N | Challenge has many Participants |
| Challenge → Template | Challenge (4.6) | Challenge Template (4.9) | 0:1 | Challenge optionally created from Template |
| Challenge → Lifecycle | Challenge (4.6) | Challenge Lifecycle (4.19) | 1:1 | Lifecycle bound to Challenge |
| Challenge → Social Cause | Challenge (4.6) | Social Cause Info (4.25) | 0:1 | Challenge optionally has Social Cause |
| Activity Config → Canonical | Activity Config (4.11) | Canonical Activity (4.10) | N:1 | Many configs reference same Activity |
| Participation → Activity Record | Participation (4.8) | Activity Record (4.14) | 1:N | Participant has many records in a Challenge |
| Activity Record → Accepted Event | Activity Record (4.14) | Accepted Event (4.13) | N:1 | Many records may reference same Event |
| Accepted Event → Submission | Accepted Event (4.13) | Submission Intent (4.12) | N:1 | One Event per Submission |
| Derived Truth → Records | Derived Truth (4.15) | Activity Records (4.14) | 1:N (consumes) | Calculated from Challenge's records |
| Derived Truth → Recognition | Derived Truth (4.15) | Recognition (4.23) | 0:1 | May give rise to Recognition |
| Feed Item → Kudos | Feed Item (4.20) | Kudos (4.22) | 1:N | Feed item may receive many Kudos |
| Member → Share | Member (4.1) | Share-to-Group (4.21) | 1:N | Member may share many times |
| Share → Feed Item | Share-to-Group (4.21) | Feed Item (4.20) | 1:1 | Each share creates one Feed Item |
| Social Cause → Contributions | Social Cause (4.25) | Cause Contributions (4.26) | 1:N | Many contributions per cause |
| Audit → Any | Audit (4.28) | Any entity | N:1 (polymorphic) | Many audit records per entity |

### 8.3 Identity Space Summary

| Information Object | Identity Type | Identity Format |
|---|---|---|
| Member (4.1) | Assigned | Member ID (platform-assigned, stable) |
| Member Profile (4.2) | Inherited | Same as Member ID (1:1) |
| Group (4.3) | Assigned | Group ID (platform-assigned, stable) |
| Group Membership (4.4) | Composite | `groupId` + `memberId` |
| Group Charter (4.5) | Inherited | Same as Group ID (1:1) |
| Challenge (4.6) | Assigned | Challenge ID (platform-assigned, stable) |
| Challenge Configuration (4.7) | Inherited | Same as Challenge ID (1:1) |
| Challenge Participation (4.8) | Composite | `challengeId` + `memberId` |
| Challenge Template (4.9) | Assigned | Template ID (independent space) |
| Canonical Activity (4.10) | Assigned | Activity ID (governed knowledge space) |
| Activity Config (4.11) | Composite | `challengeId` + `activityId` |
| Submission Intent (4.12) | Assigned | Submission ID |
| Accepted Event (4.13) | Assigned | Accepted Event ID |
| Activity Record (4.14) | Assigned | Record ID (Challenge-scoped) |
| Derived Truth (4.15) | Derived | `challengeId` + calculation context |
| Collective Result (4.16) | Inherited | Same as Challenge ID |
| Competitive Result (4.17) | Composite | `challengeId` + `memberId` |
| Streak Result (4.18) | Composite | `challengeId` + `memberId` |
| Challenge Lifecycle (4.19) | Inherited | Same as Challenge ID |
| Feed Item (4.20) | Assigned | Feed Item ID |
| Share-to-Group (4.21) | Assigned | Share Event ID (or Feed Item ID) |
| Kudos (4.22) | Assigned | Reaction ID |
| Recognition (4.23) | Assigned | Recognition ID |
| Support Tiizi (4.24) | Assigned | Contribution ID |
| Social Cause Info (4.25) | Inherited | Same as Challenge ID |
| Social Cause Contribution (4.26) | Assigned | Report ID |
| Visibility (4.27) | N/A | Cross-cutting (no identity) |
| Audit (4.28) | Assigned | Audit Record ID |

### 8.4 Lifecycle State Summary

A consolidated view of all lifecycle state machines defined across the information objects:

| Information Object | States | Transitions | Terminal States |
|---|---|---|---|
| Member (4.1) | active, suspended, deleted | active → suspended → deleted | deleted |
| Group (4.3) | active, inactive, suspended, deleted | active → inactive → suspended → deleted | deleted |
| Group Membership (4.4) | pending, active, left, removed | pending → active → left / removed | left, removed |
| Challenge (4.6) | draft, active, ended | draft → active → ended | ended |
| Challenge Template (4.9) | draft, published, archived | draft → published → archived | archived |
| Canonical Activity (4.10) | active, deprecated | active → deprecated | deprecated |
| Submission Intent (4.12) | submitted, accepted, rejected | submitted → accepted / rejected | accepted, rejected |
| Accepted Activity Event (4.13) | accepted | (immutable after acceptance) | — |
| Challenge Participation (4.8) | active, withdrawn, removed | active → withdrawn / removed | withdrawn, removed |
| Challenge Lifecycle (4.19) | draft, active, ended | draft → active → ended | ended |
| Feed Item (4.20) | published, removed | published → removed (governed) | — |
| Support Tiizi (4.24) | intent, confirmed | intent → confirmed | confirmed |
| Social Cause Info (4.25) | draft, under_review, approved, rejected | draft → under_review → approved / rejected | approved (frozen) |
| Platform Recognition (4.23) | not-yet-issued, issued, invalidated | issued → invalidated (if truth changes) | — |

### 8.5 Information Flow: Activity Logging to Recognition

This diagram shows the canonical information flow from a Member's activity self-report through to Platform Recognition:

```
Member self-reports Activity
        │
        ▼
┌─────────────────────────────┐
│ Activity Submission Intent  │  (4.12) — Member's "I did this" statement
│ Owner: Member               │
│ Self-accountability model   │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ Accepted Activity Event     │  (4.13) — Governed acceptance
│ Owner: Acceptance Authority │
│ ACT-03 verification reserved│
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ Challenge-Specific Activity │  (4.14) — Scoped to ONE Challenge
│ Record                      │  Invariant #3: no cross-Challenge sharing
│ Owner: Challenge            │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ Derived Truth               │  (4.15) — Calculated from records
│ Owner: Calculation Authority│  Invariant #4: truth precedes Recognition
│ Type-specific: 4.16/4.17/4.18│
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ Platform Recognition        │  (4.23) — Governed acknowledgement
│ Owner: Platform (MOT-01)    │  MUST NOT be confused with Kudos (4.22)
│ MOT-01 deferred             │
└─────────────────────────────┘
```

**Key constraints on this flow:**

1. Each step has a different owner/authority (separation of concerns)
2. Financial contribution (4.24, 4.26) has NO path into this flow (Invariant #5)
3. Kudos (4.22) has NO path into this flow (Invariant #9)
4. Corrections flow backwards through audit (4.28) and trigger recalculation
5. The entire flow is self-accountability — Tiizi does not certify real-world Activity (Invariant #12)

### 8.6 Information Flow: Feed and Sharing

```
Challenge Event (e.g., goal reached)
        │
        ├──▶ Automatic Feed Item (4.20, source=automatic)
        │         │
        │         └──▶ Visibility filter applied (4.27)
        │                    │
        │                    └──▶ Shown to eligible viewers only
        │
        └──▶ Member decides to share
                  │
                  ▼
           Share-to-Group (4.21)
                  │
                  ▼
           Feed Item (4.20, source=share)
                  │
                  └──▶ Visibility filter applied (4.27)
                           │
                           └──▶ Shown to eligible viewers only
                                        │
                                        └──▶ Others may react with Kudos (4.22)
```

**Key constraints:**

- Feed does NOT expand visibility (Invariant #6)
- Sharing is voluntary — default is NOT shared
- Kudos do not affect Derived Truth or Recognition (Invariant #9)

---

## 9. Glossary of Key Terms

| Term | Definition | CIC Reference |
|---|---|---|
| **Accountable Steward** | The single Member responsible for a Group's governance at any time | 4.3, EOG-E1-01 §4 |
| **Acceptance Authority** | The governed authority that transforms a Submission Intent into an Accepted Activity Event | 4.13 |
| **Calculation Authority** | The authority responsible for computing Derived Truth from Activity Records | 4.15 |
| **Canonical Activity** | A governed knowledge definition of an Activity — its identity, metrics, units, and guidance | 4.10 |
| **Challenge-Specific** | Scoped to a single Challenge; not shared across Challenges | 4.11, 4.14, Invariant #3 |
| **Conflation** | Treating two distinct information objects as if they were the same; prohibited by Section 3 | Section 3 |
| **Cross-Domain Invariant** | A binding constraint that spans multiple information domains; violation is a contract breach | Section 2 |
| **Derived Truth** | A calculated result computed from Challenge-Specific Activity Records; not a primary recorded fact | 4.15 |
| **Governed Action** | An action subject to authority constraints — not freely mutable by any single party | Throughout |
| **Information Boundary** | The defined separation between two information objects that MUST NOT be conflated | Section 3 |
| **Information Object** | A canonical unit of information defined by this contract — its identity, ownership, attributes, and relationships | Section 4 |
| **Knowledge Authority** | The authority (Founder, per EKG-01) that governs Canonical Activity Definitions | 4.10, EKG-01 |
| **Platform Governance** | The supreme authority layer; supersedes Group Charters and Group-level operations | Invariant #11 |
| **Self-Accountability** | The model where Members self-report Activity; Tiizi records the report but does not certify the real-world fact | 4.12, Invariant #12 |
| **Visibility Class** | A category defining who can see a piece of information (Public, Authenticated, Shared-group, Private, Privileged) | 4.27 |

---

## Document Control

| Field | Value |
|---|---|
| **Document Type** | Stage F Canonical Information Contract — DRAFT |
| **Version** | 0.1-draft |
| **Date** | 2026-09-05 |
| **Status** | Stage F Draft — Pending Founder Review |
| **Author** | Governance-derived from T1, T2, EOG-E1-01, EKG-01, CGP-04, Constitutional Ontology |
| **Authority Basis** | See document header |
| **Preserved Deferrals** | ACT-03, ACT-04, MOT-01, Rewards |

### Change Log

| Version | Date | Change |
|---|---|---|
| 0.1-draft | 2026-09-05 | Initial draft — complete information object definitions, invariants, boundaries, relationships |

### Review Checklist

The following items require Founder review before this contract can move from DRAFT to APPROVED:

- [ ] All 12 invariants correctly reflect settled product model
- [ ] All 28 information objects have correct ownership and attributes
- [ ] Information boundaries (Section 3) correctly identify conflation risks
- [ ] Deferred authorities (ACT-03, ACT-04, MOT-01, Rewards) are correctly scoped
- [ ] Domain map (Section 5) correctly assigns authority
- [ ] Entity relationships (Section 8) have correct cardinalities
- [ ] Current implementation implications (Section 6) are accurate
- [ ] No database, API, or UI design has inadvertently been included

---

*End of Stage F Canonical Information Contract — DRAFT*
