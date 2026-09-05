---
title: "Tiizi V2 — Stage F Knowledge Runtime Contract"
document_type: "Stage F Knowledge Runtime Contract — DRAFT"
stage: "Stage F — Product & Technical Translation"
version: "0.1-draft"
date: "2026-09-05"
status: "Stage F Draft — Pending Founder Review"
authority_basis:
  - "EKG-01 Tiizi Knowledge Governance Standard v0.1 (Founder Approved 2026-09-02)"
  - "EOG-E1-01 Tiizi Entity & Operational Governance Standard v0.2"
  - "CGP-04 Entity Relationship Allocation Register v0.1"
  - "Stage F T1 Product Definition DRAFT"
  - "Stage F T2 Functional Requirements DRAFT"
  - "Stage F Canonical Information Contract DRAFT"
preserved_deferrals:
  - "ACT-03 — Verification Authority"
  - "ACT-04 — Correction Authority"
  - "MOT-01 — Recognition Authority"
  - "Rewards — implementation/custody/entitlement"
---

# Tiizi V2 — Knowledge Runtime Contract (DRAFT)

> **Status:** Stage F Draft — Pending Founder Review
> **Version:** 0.1-draft
> **Date:** 2026-09-05
> **Classification:** Programme Document — Stage F Technical Translation

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Runtime Knowledge Model](#2-runtime-knowledge-model)
3. [Canonical Activity Runtime Contract](#3-canonical-activity-runtime-contract)
4. [Challenge ↔ Knowledge Boundary](#4-challenge--knowledge-boundary)
5. [Historical Knowledge Preservation](#5-historical-knowledge-preservation)
6. [Knowledge Lifecycle](#6-knowledge-lifecycle)
7. [Admin/Runtime Management Boundary](#7-adminruntime-management-boundary)
8. [Runtime Consumption Requirements](#8-runtime-consumption-requirements)
9. [Current Implementation Assessment](#9-current-implementation-assessment)
10. [Technical Implications for Next-Stage Mapping](#10-technical-implications-for-next-stage-mapping)
11. [Material Blockers](#11-material-blockers)

---

## 1. Purpose

This contract defines how Tiizi's governed Knowledge domain operates at runtime. It answers engineering questions about catalogue access, Activity identity, Knowledge vs configuration boundaries, historical preservation, lifecycle, admin capabilities, and runtime consumption. It does NOT design databases, APIs, or UIs.

**Inputs:**

| Source Document | Role in This Contract |
|---|---|
| EKG-01 Tiizi Knowledge Governance Standard v0.1 | Governing authority for Knowledge domain rules |
| Stage F T1 Product Definition DRAFT | Product context — what Tiizi offers to users |
| Stage F T2 Functional Requirements DRAFT | Functional requirements that consume Knowledge |
| Stage F Canonical Information Contract DRAFT | Data contracts that this runtime contract operationalises |
| EOG-E1-01 Entity & Operational Governance Standard v0.2 | Entity boundaries and operational governance |
| CGP-04 Entity Relationship Allocation Register v0.1 | Relationship allocation between governed entities |

**Preserved deferrals (NOT resolved by this contract):**

| Deferral | Subject | Reason for Deferral |
|---|---|---|
| ACT-03 | Verification Authority | Requires Founder decision on who verifies Knowledge correctness |
| ACT-04 | Correction Authority | Requires Founder decision on who authorises corrections |
| MOT-01 | Recognition Authority | Requires Founder decision on recognition criteria and delegation |
| Rewards | Implementation, custody, entitlement | Cross-cutting concern; not a Knowledge runtime question |

**What this contract is:**
- A runtime behaviour contract for governed Knowledge
- An engineering translation of EKG-01 principles into operational constraints
- An input to Technical Architecture Mapping (Stage F deliverable 5)

**What this contract is NOT:**
- A database schema design
- An API specification
- A UI/UX design document
- An authorisation to implement changes
- A resolution of deferred authority questions

---

## 2. Runtime Knowledge Model

### 2.1 One Governed Knowledge System

Tiizi maintains **ONE** Knowledge system covering Fitness and Wellness (EKG-01 P01).

This is not two separate knowledge systems. Fitness and Wellness are domains within a single governed Knowledge system, sharing the same governance rules, lifecycle model, and publication pipeline.

**Knowledge flow:**

```
Knowledge Base → Authoritative Publication → Runtime Catalogue → Product Consumers
```

| Stage | Description | Governance |
|---|---|---|
| Knowledge Base | Authoritative store of all Activity Assets | Governed by EKG-01 |
| Authoritative Publication | Formal act of making Knowledge available | Requires Knowledge Authority or delegate (EKG-01 §14) |
| Runtime Catalogue | Live, read-only view of published Knowledge | Filtered to published state only |
| Product Consumers | Challenge Wizard, Templates, Discovery, Logging, History | Read-only; MUST NOT modify Knowledge |

**Product consumers of the Runtime Catalogue:**

| Consumer | What It Reads |
|---|---|
| Challenge Wizard | Available Activities, metrics, units, constraints |
| Templates | Pre-configured Activity selections |
| Discovery / Browse | Activity name, category, description, icon |
| Activity Selection | Activity details for Challenge configuration |
| Activity Logging | Activity ID + metric/unit routing (from Challenge config) |
| Historical Interpretation | Snapshotted Knowledge data from Challenge documents |

### 2.2 Knowledge Architecture

```
TIIZI KNOWLEDGE BASE (Runtime Catalogue)
├── Fitness (Exercise Assets)
│   ├── Strength
│   ├── Cardio & Conditioning
│   ├── Mobility & Flexibility
│   ├── Balance & Stability
│   ├── Power, Speed & Agility
│   └── Sports & Recreation
└── Wellness (Wellness Activity Assets)
    ├── Sleep & Rest
    ├── Mind & Emotional Wellbeing
    ├── Nutrition & Hydration
    ├── Daily Living
    ├── Personal Growth
    └── Social Wellbeing
```

**Architecture constraints (from EKG-01):**

| Constraint | Source | Implication |
|---|---|---|
| Single Knowledge system | EKG-01 P01 | No parallel or competing Knowledge stores |
| Canonical classification taxonomy | EKG-01 §5 | Categories are governed; product cannot invent categories |
| Activity identity is independent of context | EKG-01 P04 | Context (Challenge, user) does not create new Activity identities |
| Permitted metrics/units are governed | EKG-01 §8 | Product cannot introduce un-governed metrics |
| Publication is the gate to availability | EKG-01 §16-17 | Only published Activities appear in Runtime Catalogue |

### 2.3 Canonical Activity Knowledge Asset — Runtime Shape

Each Activity in the Runtime Catalogue conforms to the following field structure. This is the engineering translation of EKG-01 §4 (Canonical Activity Knowledge Asset model).

| Field Group | Fields | Source | Notes |
|---|---|---|---|
| **Identity** | `id`, `canonicalName`, `domain` (fitness\|wellness), `lifecycleState` | Governed | `id` is the canonical reference for all consumers |
| **Classification** | `primaryCategory`, `secondaryClassifications[]` | Governed | Must reference valid taxonomy entries (EKG-01 §5) |
| **Meaning** | `description`, `instructions[]`, `safetyNotes[]` | Governed | Human-readable; safetyNotes are mandatory for physical Activities |
| **Measurement** | `permittedMetrics[]`, `permittedUnits[]` | Governed | Defines what can be measured and in what units (EKG-01 §8) |
| **Configuration Constraints** | `permittedChallengeTypes[]`, `targetRanges[]` | Governed | Bounds what Challenge configurations are valid |
| **Relationships** | `variants[]`, `relatedActivities[]`, `equipment[]` | Governed | Variants attributable to parent unless materially different (EKG-01 §7) |
| **Governance** | `provenance`, `publishedAt`, `retiredAt?`, `version?` | Governed | Audit trail for Knowledge changes (EKG-01 §13-14) |

**Domain-specific fields (Fitness):**

| Field | Type | Description |
|---|---|---|
| `tier_1` | string | Primary movement classification |
| `tier_2` | string | Secondary movement classification |
| `musclesTargeted[]` | string[] | Anatomical targets |
| `equipment[]` | string[] | Required or optional equipment |
| `setup` | string | Setup instructions |
| `execution` | string | Execution instructions |
| `breathing` | string | Breathing pattern |
| `formCues[]` | string[] | Key form/technique cues |
| `commonMistakes[]` | string[] | Common errors to avoid |

**Domain-specific fields (Wellness):**

| Field | Type | Description |
|---|---|---|
| `category` | string | Wellness category (6 categories) |
| `activityType` | string | Type within category |
| `protocolSteps[]` | object[] | Step-by-step protocol |
| `benefits[]` | string[] | Expected benefits |
| `bodyResponse[]` | string[] | Expected bodily responses |
| `defaultMetricUnit` | string | Default measurement unit |
| `defaultTargetValue` | number | Default target |
| `targetType` | string | Type of target (duration, count, etc.) |

### 2.4 Runtime Catalogue Contract

| Rule | Source | Enforcement |
|---|---|---|
| ONE authoritative Runtime Catalogue at any time | EKG-01 P01, §17 | Single publication pipeline; no parallel catalogues |
| Only published Activities are available to product consumers | EKG-01 §16 | Runtime Catalogue filters by `lifecycleState = published` |
| Product consumers MUST NOT establish competing canonical meaning | EKG-01 P03, P06 | No consumer may create, modify, or override Activity definitions |
| Technical publication pipeline is downstream engineering | This contract | Implementation detail; not prescribed by this contract |
| Runtime Catalogue is read-only for product consumers | This contract | Write access restricted to governed Knowledge administration |

**Runtime Catalogue invariants:**

1. Every Activity in the Runtime Catalogue has `lifecycleState = published`
2. Every Activity conforms to the Canonical Activity Knowledge Asset model
3. Every Activity belongs to a valid category in the governed taxonomy
4. No two Activities share the same canonical ID
5. Retired Activities are excluded from the Runtime Catalogue

---

## 3. Canonical Activity Runtime Contract

### 3.1 Activity Identity

| Principle | Source | Runtime Implication |
|---|---|---|
| Each Activity has exactly one canonical ID | EKG-01 §4 | Single `id` field; immutable once assigned |
| Identity is independent of targets, schedules, frequencies, Challenge types | EKG-01 P04 | Challenge configuration does not affect Activity identity |
| Context does not create identity | EKG-01 P06 | A "morning push-up" is the same Activity as an "evening push-up" |
| Variants remain attributable to existing canonical Activity unless materially different | EKG-01 §7 | Variant relationship is explicit, not implicit through context |

**Identity rules — what does and does NOT create a new Activity:**

| Scenario | New Activity? | Rationale |
|---|---|---|
| Same exercise, different target weight | No | Target is Challenge configuration, not Activity identity |
| Same exercise, different rep scheme | No | Rep scheme is Challenge configuration |
| Same exercise, different time of day | No | Context does not create identity (EKG-01 P06) |
| Same exercise, different equipment (substantially different) | Possibly | Material difference test (EKG-01 §7) |
| Modified movement pattern (materially different) | Yes | Materially different movement = different Activity |
| Same Activity used in different Challenge types | No | Challenge type is configuration, not Activity identity |

### 3.2 Activity Identification at Runtime

| Consumer | How It Identifies Activity | Notes |
|---|---|---|
| Challenge Wizard | Activity ID from Runtime Catalogue | Selection from published catalogue; user browses and selects |
| Challenge Configuration | `activityId` reference + snapshot of relevant fields | Copy-at-creation pattern; self-contained Challenge document |
| Activity Logging | `activityId` from Challenge config | Routes to correct logging path based on domain (fitness/wellness) |
| Discovery / Browse | Activity ID + category + name | From Runtime Catalogue; read-only browsing |
| Historical Challenge view | Snapshotted fields from Challenge document | Does NOT re-fetch current Knowledge; uses data at creation time |

**Identity resolution flow:**

```
User selects Activity
    → Runtime Catalogue returns Activity object (including id)
    → Challenge creation snapshots relevant fields
    → Challenge document stores activityId + snapshot
    → All subsequent references use activityId from Challenge document
    → Historical views use snapshotted data, not live Knowledge
```

### 3.3 Fitness vs Wellness at Runtime

Fitness and Wellness are two domains within ONE Knowledge system. They share governance rules but differ in domain-specific fields and logging paths.

| Aspect | Fitness Exercise | Wellness Activity |
|---|---|---|
| **Domain** | `fitness` | `wellness` |
| **Categories** | 6: Strength, Cardio & Conditioning, Mobility & Flexibility, Balance & Stability, Power Speed & Agility, Sports & Recreation | 6: Sleep & Rest, Mind & Emotional Wellbeing, Nutrition & Hydration, Daily Living, Personal Growth, Social Wellbeing |
| **Key identity fields** | `tier_1`, `tier_2`, `musclesTargeted`, `equipment`, `setup`, `execution`, `breathing` | `category`, `activityType`, `protocolSteps`, `benefits`, `bodyResponse` |
| **Metric model** | `metric: { type, unit, allowCustomUnit }` | `defaultMetricUnit`, `defaultTargetValue`, `targetType` |
| **Logging path** | `/app/workouts/log` | `/app/workouts/log-wellness` |
| **Log entry shape** | `value + unit` | `fasting / hydration / sleep / meditation + value` |
| **Firestore collection** | `exercises` | `wellnessActivities` |
| **Service layer** | `exerciseService`, `adminExerciseService` | `wellnessActivityService`, `adminWellnessActivityService` |
| **Local fallback** | None (REMEDIATION: see §9.2) | ~70+ items hardcoded fallback catalog |

**Critical point:** Challenge engines are **activity-type-agnostic**. They operate on `ActivityConfig` objects regardless of domain. The domain distinction matters for:
- Logging path selection
- Metric model interpretation
- UI rendering (different form fields)
- Service layer routing

The engine itself does not branch on domain.

### 3.4 Activity Relationship Model at Runtime

| Relationship | Direction | Runtime Behaviour |
|---|---|---|
| `variants[]` | Parent → variant(s) | Variant Activities are separate canonical Activities with explicit back-reference |
| `relatedActivities[]` | Bidirectional | Informational; used for Discovery suggestions |
| `equipment[]` | Activity → equipment | Informational; used for filtering and setup guidance |
| `primaryCategory` | Activity → category | Must reference valid taxonomy entry |
| `secondaryClassifications[]` | Activity → classification(s) | Optional; additional taxonomy references |

**Variant attribution rule (EKG-01 §7):**
- A variant is a recognisably different form of an existing Activity
- The variant has its own canonical ID but references the parent
- If the difference is NOT material, it should be a variant, not a new root Activity
- If the difference IS material, it is a separate Activity (no variant relationship required)

---

## 4. Challenge ↔ Knowledge Boundary

### 4.1 Core Principle

**Knowledge establishes what an Activity IS. Challenge determines what users DO with that Knowledge.** (EKG-01 P03, EKG-01 §9)

This is the single most important boundary in the Tiizi runtime. Violating it leads to:
- Knowledge meaning becoming mutable through Challenge configuration
- Historical Challenges becoming uninterpretable when Knowledge changes
- Identity proliferation (context creating identity)

| Domain | Owns | Does NOT Own |
|---|---|---|
| Knowledge | Activity identity, meaning, permitted metrics/units, safety info, classification | How users use the Activity (targets, schedules, frequencies) |
| Challenge | Selected metric, unit, target, frequency, duration, instructions override | Activity identity, canonical meaning, permitted metrics/units |

### 4.2 What Knowledge Owns (Immutable at Challenge Runtime)

Once a Challenge is created, the following Knowledge-derived fields are fixed in the Challenge's snapshot. Modifying canonical Knowledge does NOT retroactively alter existing Challenges.

| Knowledge-Owned Field | Immutable at Challenge Runtime? | Rationale |
|---|---|---|
| Activity canonical ID | Yes | Identity is permanent |
| Activity canonical name | Yes (snapshotted) | Historical record uses name at creation time |
| Permitted metrics | Yes (Challenge selects from permitted set) | Knowledge defines what CAN be measured |
| Permitted units | Yes (Challenge selects from permitted set) | Knowledge defines valid units |
| Safety / caution information | Yes (snapshotted) | Safety info at creation time is preserved |
| Configuration constraints | Yes | Bounds valid Challenge configurations |
| Category / classification | Yes (snapshotted) | Historical record preserves classification at creation |

### 4.3 What Challenge Configuration Owns (Challenge-Specific)

| Challenge Configures | Example | Source of Valid Options |
|---|---|---|
| Selected metric | Distance (from permitted: Distance, Duration) | Activity's `permittedMetrics[]` |
| Selected unit | kilometres (from permitted: km, miles) | Activity's `permittedUnits[]` |
| Target value | 100 km | Within `targetRanges[]` if defined |
| Frequency | daily | Challenge configuration |
| Duration | 30 days | Challenge configuration |
| Challenge type | Collective | Challenge configuration |
| Instructions override | "Walk to work each day" | Challenge configuration; does not modify canonical instructions |
| Sets / reps configuration | 3 sets of 20 | Challenge configuration |
| Start date | 2026-09-15 | Challenge configuration |
| Visibility / sharing | Public, invite-only | Challenge configuration |

### 4.4 Copy-at-Creation Pattern

When a Challenge is created, it snapshots relevant Activity fields into its own document. This makes the Challenge document **self-contained** for its lifetime.

**What is snapshotted at Challenge creation:**

| Field Category | Fields Snapshotted | Purpose |
|---|---|---|
| Identity | `activityId` (back-reference to canonical Knowledge) | Traceability to Knowledge; historical attribution |
| Display metadata | `activityName`, `description`, `category`, `difficulty`, `icon` | Historical display without re-fetching Knowledge |
| Measurement config | `selectedMetric`, `selectedUnit`, `targetValue` | Challenge-specific configuration |
| Guidance (Fitness) | `setup`, `execution`, `breathing`, `formCues`, `commonMistakes` | Historical display of instructions |
| Guidance (Wellness) | `protocolSteps`, `benefits`, `bodyResponse`, `guidelines` | Historical display of protocol |
| Safety | `warnings`, `contraindications`, `safetyNotes` | Preserved safety information |

**Consequence:** Modifying canonical Knowledge after Challenge creation does NOT affect existing Challenges. The Challenge document retains its snapshotted data.

### 4.5 What Must NOT Happen

| Prohibition | Source | Risk if Violated |
|---|---|---|
| Challenge configuration MUST NOT modify canonical Activity | EKG-01 P03 | Knowledge meaning becomes mutable through usage |
| Challenge MUST NOT create new Activity identities | EKG-01 P04, P06 | Identity proliferation; context creates meaning |
| Runtime consumers MUST NOT bypass the Runtime Catalogue to establish competing meaning | EKG-01 P01, §17 | Parallel Knowledge stores; governance bypass |
| Challenge MUST NOT extend permitted metrics/units beyond what Knowledge allows | EKG-01 §8 | Ungoverned measurement; breaks Knowledge authority |
| Challenge MUST NOT override safety information from Knowledge | This contract | User safety risk; governance bypass |

---

## 5. Historical Knowledge Preservation

### 5.1 Principle

A Challenge preserves sufficient representation of the Knowledge used at creation time to maintain **historical intelligibility**. (EKG-01 §18)

Historical intelligibility means: a user viewing a past Challenge must be able to understand what Activity was performed, how it was configured, and what guidance was given — even if the canonical Knowledge has since changed.

### 5.2 What Is Preserved

| Information | Where Preserved | How | Sufficient for Historical Display? |
|---|---|---|---|
| Activity identity | Challenge document | `activityId` / `exerciseId` back-reference | Yes — traceable to Knowledge at creation time |
| Activity name | Challenge document | Snapshotted at creation | Yes — displays correctly even if name later changes |
| Display metadata | Challenge document | `description`, `icon`, `category`, `difficulty` | Yes — visual rendering preserved |
| Measurement config | Challenge document | `metric`, `unit`, `targetValue` | Yes — Challenge-specific; not affected by Knowledge changes |
| Instructions / guidance | Challenge document | `protocolSteps`, `benefits`, `guidelines`, `warnings` | Yes — guidance at creation time preserved |
| Safety information | Challenge document | `warnings`, `contraindications` | Yes — safety context preserved |

### 5.3 What Happens When Knowledge Changes

| Scenario | Effect on Existing Challenges | Effect on New Challenges |
|---|---|---|
| Activity name changes | **No effect** — snapshotted name preserved | New Challenges use new name |
| Activity description changes | **No effect** — snapshotted description preserved | New Challenges use new description |
| Activity retired | **No effect** — self-contained Challenge document | Cannot be selected for new Challenges |
| Activity metric changed | **No effect** — snapshotted metric preserved | New Challenges use new metric |
| Activity category changes | **No effect** — snapshotted category preserved | New Challenges use new category |
| Activity deleted | Back-reference becomes orphaned; snapshotted data preserved | N/A — deletion should not occur for referenced Activities |
| Activity safety info updated | **No effect on existing** — snapshotted safety info preserved | New Challenges use updated safety info |

### 5.4 Divergence Detection (Implementation Implication)

The current implementation has **no version field** on Activities. This has the following implications:

| Aspect | Current State | Contract Requirement |
|---|---|---|
| Detecting Knowledge changes since Challenge creation | **Not possible** — no version to compare | Version tracking should be considered (see §9.2) |
| Snapshotted data sufficiency | **Sufficient** for historical display | Snapshotted data meets historical intelligibility requirement |
| Divergence visibility | **Invisible** — cannot tell if Challenge snapshot differs from current Knowledge | Technical Architecture Mapping should address |
| Audit trail | Partial — Firestore document history may exist but is not structured | EKG-01 §13-14 requires attributable change tracking |

**Note:** The absence of version tracking does NOT violate the historical preservation principle — snapshotted data is sufficient for display. However, it means divergence between Challenge snapshots and current Knowledge is undetectable. This is a REMEDIATION REQUIRED finding (§9.2).

### 5.5 Historical Display Contract

When rendering a historical Challenge view:

| Data Source | Used For | Rationale |
|---|---|---|
| Challenge document (snapshotted) | Activity name, description, icon, category, instructions, safety info | Preserves creation-time representation |
| Challenge document (config) | Metric, unit, target, frequency, duration | Challenge-specific; not from Knowledge |
| Runtime Catalogue | **NOT used** for historical views | Historical views must not re-fetch current Knowledge |
| Runtime Catalogue | MAY be used for supplementary data (e.g., equipment images) | Only if non-critical and clearly labelled as current |

---

## 6. Knowledge Lifecycle

### 6.1 Lifecycle States

| State | Meaning | Available to Runtime Catalogue? | Available to Challenge Creation? | Visible in Historical Views? |
|---|---|---|---|---|
| `draft` | Under preparation, not yet published | No | No | N/A (never referenced by Challenges) |
| `published` | Authoritative, available for use | Yes | Yes | Yes (via Challenge snapshots) |
| `retired` | No longer available for new use | No | No | Yes (via Challenge snapshots; self-contained) |

### 6.2 Lifecycle Transitions

```
                 ┌──────────────────────────────────────────┐
                 │                                          │
    ┌──────┐     │    ┌───────────┐     ┌──────────┐       │
    │ draft │────┼───→│ published │────→│ retired  │       │
    └──────┘     │    └───────────┘     └──────────┘       │
                 │                                          │
                 │  Transitions are irreversible:           │
                 │  • draft → published (publication)       │
                 │  • published → retired (retirement)      │
                 │  • No published → draft reversal         │
                 │  • No retirement → published reversal    │
                 └──────────────────────────────────────────┘
```

| Transition | Who Can Authorise | Source | Notes |
|---|---|---|---|
| `draft → published` | Knowledge Authority or delegated admin | EKG-01 §14, §16 | Publication gate; makes Activity available to Runtime Catalogue |
| `published → retired` | Knowledge Authority or delegated admin | EKG-01 §16 | Retirement; removes from Runtime Catalogue but preserves for historical |
| `published → draft` | **PROHIBITED** | This contract | Once published, always at least published in history |
| `retired → published` | **PROHIBITED** | This contract | Retirement is irreversible; create new Activity if needed |

### 6.3 Introduction of New Activities

New Activities are introduced through Knowledge administration (EKG-01 §19).

| Requirement | Source | Verification |
|---|---|---|
| Must conform to Canonical Activity Knowledge Asset model | EKG-01 §4 | Schema validation on creation |
| Must be assigned to a valid category | EKG-01 §5 | Category must exist in governed taxonomy |
| Must declare permitted metrics / units | EKG-01 §8 | Non-empty `permittedMetrics[]` and `permittedUnits[]` |
| Must have safety information (physical Activities) | EKG-01 §10 | `safetyNotes[]` required for Fitness Activities |
| Published Activities become immediately available in Runtime Catalogue | EKG-01 §17 | Runtime Catalogue reflects publication state |
| Creation is attributable (actor ID recorded) | EKG-01 §13 | `createdBy`, `createdAt` fields |

**New Activity lifecycle:**

```
Admin creates Activity (state = draft)
    → Admin populates required fields
    → Knowledge Authority or delegate publishes (state = published)
    → Activity appears in Runtime Catalogue
    → Available for Challenge creation
```

### 6.4 Deprecation / Retirement

| Aspect | Rule | Source |
|---|---|---|
| Retired Activities not available for new Challenge creation | Yes | EKG-01 §16 |
| Existing Challenges unaffected | Yes — self-contained via snapshot | This contract §4.4 |
| Historical display uses snapshotted data | Yes | This contract §5.5 |
| Retirement must not destroy historical interpretability | Yes | EKG-01 §16, §18 |
| Retired Activities remain in Knowledge store | Yes | Retirement ≠ deletion |
| Retired Activities excluded from Runtime Catalogue | Yes | EKG-01 §17 |

**Retirement flow:**

```
Knowledge Authority retires Activity (state = retired)
    → Activity removed from Runtime Catalogue
    → Existing Challenges: unaffected (snapshotted data preserved)
    → New Challenge creation: Activity not selectable
    → Historical views: continue to display snapshotted data
    → Activity record preserved in Knowledge store (not deleted)
```

---

## 7. Admin / Runtime Management Boundary

### 7.1 Knowledge Authority vs Admin Capability

| Action | Requires Knowledge Authority? | Delegable to Admin? | Source |
|---|---|---|---|
| Create new Activity | Yes (or delegated) | Yes, if delegated | EKG-01 §14, §19 |
| Edit published Activity | Yes (or delegated) | Yes, if delegated | EKG-01 §14 |
| Publish Activity (draft → published) | Yes (or delegated) | Yes, if delegated | EKG-01 §14, §16 |
| Retire Activity (published → retired) | Yes (or delegated) | Yes, if delegated | EKG-01 §14, §16 |
| Change Knowledge governance rules | **Yes — Founder only** | **No** | EKG-01 §20 |
| Modify classification taxonomy | Yes (or delegated) | Yes, if delegated | EKG-01 §5 |
| Manage metrics / units | Yes (or delegated) | Yes, if delegated | EKG-01 §8 |
| Delete Activity | **PROHIBITED** | **N/A** | This contract §6.4; use retirement |
| Approve Knowledge Governance Standard changes | **Yes — Founder only** | **No** | EKG-01 §20 |

### 7.2 What Admin Can Do Operationally

Assuming delegation from Knowledge Authority:

| Operational Capability | Scope |
|---|---|
| Create Activities | Both Fitness and Wellness domains |
| Edit Activities | Modify fields; changes take effect immediately on published Activities |
| Publish Activities | Transition from draft to published |
| Retire Activities | Transition from published to retired |
| Manage classifications | Add/edit/organise taxonomy entries |
| Manage relationships | Set variant, related, equipment relationships |
| Manage guidance | Edit instructions, safety notes, form cues, protocol steps |
| Bulk import | Import Activities from external sources (must conform to Asset model) |
| View audit trail | See change history for Activities |

### 7.3 What Requires Knowledge Authority (Founder)

| Action | Why Founder Only | Source |
|---|---|---|
| Changing governance rules | Governance rules are the constitutional basis for Knowledge | EKG-01 §20 |
| Approving Knowledge Governance Standard changes | Standard is the governing instrument | EKG-01 §20 |
| Delegating Knowledge management capabilities | Delegation is an authority decision | EKG-01 §14 |
| Revoking delegated capabilities | Revocation is an authority decision | EKG-01 §14 |
| Resolving Knowledge disputes | Ultimate authority over Knowledge meaning | EKG-01 §15 |

### 7.4 Approval Workflow (Contract Requirement)

The Knowledge Runtime Contract REQUIRES the following workflow guarantees:

| Requirement | Current State | Gap |
|---|---|---|
| Activities have a lifecycle state (draft / published / retired) | **NOT IMPLEMENTED** | Activities have no lifecycle state field |
| Only published Activities are available to product consumers | **PARTIALLY** — all Activities in Firestore are effectively "published" | No filtering by state |
| Activity CRUD is attributable (actor ID recorded) | **PARTIALLY** — Firestore auth exists but not structured attribution | No `createdBy` / `updatedBy` fields on Activity documents |
| Retirement of referenced Activities is permitted | **NOT IMPLEMENTED** | Only hard delete exists |
| Deletion of referenced Activities is prohibited | **NOT ENFORCED** | Hard delete is available and used |

**REMEDIATION REQUIRED:** See §9.2 for detailed remediation items.

---

## 8. Runtime Consumption Requirements

### 8.1 What Product Consumers Need

| Consumer | Reads from Runtime Catalogue | Writes / Modifies Knowledge? | Read Pattern |
|---|---|---|---|
| Challenge Wizard | Activity selection, metrics, units, constraints | No | Read published Activities; filter by category, search by name |
| Challenge Configuration | Selected Activity details for snapshot | No | Read single Activity; copy fields into Challenge document |
| Activity Logging | Activity ID + metric / unit from Challenge config | No | Read Activity ID for routing; does NOT read Knowledge for logging |
| Discovery / Browse | Activity name, category, description, icon | No | Read published Activities; paginated, filterable |
| Historical Challenge View | Snapshotted data from Challenge document | No | Read Challenge document; does NOT read Knowledge |
| Admin Management | Full Knowledge CRUD | Yes (governed) | Read/write all Activities regardless of state |

### 8.2 Runtime Catalogue Access Pattern

```
Product Consumer
    → Runtime Catalogue API
        → Governance check: is Activity published?
            → YES: Return Activity data
            → NO: Exclude (return 404 or filter out)
```

**Access rules:**

| Rule | Enforcement |
|---|---|
| Only published Activities returned | Runtime Catalogue filters by `lifecycleState = published` |
| Retired Activities excluded | Not returned in queries; 404 if accessed by ID |
| Draft Activities excluded | Not returned in queries; 404 if accessed by ID |
| Admin access bypasses publication filter | Admin UI can see all states |
| Product consumers cannot access draft/retired | API enforces publication filter |

### 8.3 Resilience

| Aspect | Current State | Contract Requirement |
|---|---|---|
| Wellness local fallback catalog | **IMPLEMENTED** — ~70+ items hardcoded | ALIGNED — deliberate resilience pattern |
| Fitness local fallback catalog | **NOT IMPLEMENTED** | FUTURE IMPROVEMENT — Fitness relies entirely on Firestore |
| Fallback activation | Wellness: fallback used when Firestore unavailable | ALL domains should have resilience fallback |

**Resilience contract:**

| Requirement | Priority | Notes |
|---|---|---|
| Runtime Catalogue should have fallback for primary source unavailability | Recommended | Prevents total product failure if Knowledge store is down |
| Fallback must serve published Activities only | Required | Fallback must not serve draft or retired Activities |
| Fallback must be eventually consistent with primary | Required | Stale fallback must not persist beyond reasonable window |
| Fitness should have a local fallback | Recommended | Currently missing; Wellness pattern can be replicated |

### 8.4 Caching

| Aspect | Contract Requirement |
|---|---|
| Runtime Catalogue data may be cached by consumers | Permitted |
| Cache invalidation must respect Knowledge publication changes | Required — retired Activity must not remain cached as published |
| Stale cache must not serve retired Activities as published | Required — cache TTL must be bounded |
| Cache invalidation on Activity edit (published) | Required — edited fields must propagate within reasonable window |
| Cache invalidation on Activity retirement | Required — immediate or near-immediate removal from cache |

**Cache contract:**

```
Activity published → cache entry created/updated
Activity edited    → cache entry invalidated (or updated)
Activity retired   → cache entry removed
Activity in draft  → cache entry NOT created
```

---

## 9. Current Implementation Assessment

### 9.1 Findings Summary

| # | Finding | Classification | Detail |
|---|---|---|---|
| F-01 | Fitness exercises in dedicated Firestore collection | **ALIGNED** | Clean service layer (`exerciseService`, `adminExerciseService`); separate from Wellness |
| F-02 | Wellness activities in dedicated Firestore collection | **ALIGNED** | Clean service layer (`wellnessActivityService`, `adminWellnessActivityService`) |
| F-03 | Copy-at-creation pattern for Challenges | **ALIGNED** | Challenges snapshot Activity data at creation; self-contained documents |
| F-04 | Wellness local fallback catalog (~70+ items) | **ALIGNED** | Deliberate resilience pattern; Firestore is primary source |
| F-05 | Fitness / Wellness separation with unified engine | **ALIGNED** | Distinct collections, services, types; `challengeActivityFlow.ts` routes correctly; engines are type-agnostic |
| F-06 | Hardcoded wellness catalog as seed / bootstrap | **ALIGNED** | Serves as fallback, not primary source of truth |
| F-07 | No approval workflow for Activity CRUD | **REMEDIATION REQUIRED** | Any admin can create / edit / delete Activities without review; no draft / published lifecycle state |
| F-08 | No version field on Activities | **REMEDIATION REQUIRED** | Cannot detect when canonical Activity changed since Challenge creation; divergence is invisible |
| F-09 | Fitness Challenges embed minimal Activity data | **REMEDIATION REQUIRED** | Only `exerciseId` + `exerciseName` + `targetValue` + `unit` stored; full details (setup, execution, form cues) not snapshotted; display re-fetches current version |
| F-10 | No Fitness local fallback catalog | **FUTURE IMPROVEMENT** | Wellness has fallback; Fitness relies entirely on Firestore |
| F-11 | Activity deletion permitted | **REMEDIATION REQUIRED** | Hard delete from Firestore; should be retirement (preserve for historical references) |

### 9.2 REMEDIATION REQUIRED Summary

The following items require remediation. They are inputs to Technical Architecture Mapping (Stage F deliverable 5), not immediate implementation tasks.

| # | Remediation | Priority | Affected Components | Effort Indicator |
|---|---|---|---|---|
| R-01 | **Activity lifecycle states**: Add `draft` / `published` / `retired` lifecycle to both Fitness and Wellness Activities | Required | `exerciseService`, `wellnessActivityService`, admin UIs, Runtime Catalogue queries | Medium |
| R-02 | **Activity versioning**: Add `version` field; increment on edit; Challenges should record the version they snapshotted | Required | Activity schemas, Challenge creation flow, admin edit flow | Medium |
| R-03 | **Fitness snapshot completeness**: Challenge creation should embed full Activity display data (not just name + unit) | Required | Challenge creation flow, Challenge document schema | Low–Medium |
| R-04 | **Retirement over deletion**: Replace hard delete with retirement; retired Activities remain in Knowledge store but excluded from Runtime Catalogue | Required | Admin delete flow, Runtime Catalogue queries | Low |
| R-05 | **Approval gate**: At minimum, require `published` state before Activity is available for Challenge creation | Required | Runtime Catalogue query filter, Challenge Wizard | Low |

**Remediation dependencies:**

```
R-01 (lifecycle states) ← prerequisite for R-05 (approval gate)
R-01 (lifecycle states) ← prerequisite for R-04 (retirement over deletion)
R-02 (versioning) ← independent; can proceed in parallel with R-01
R-03 (snapshot completeness) ← independent; can proceed in parallel
```

### 9.3 FUTURE IMPROVEMENT Summary

| # | Improvement | Priority | Notes |
|---|---|---|---|
| I-01 | Fitness local fallback catalog for resilience | Recommended | Wellness pattern (~70+ items) can be replicated for Fitness |

No correction tasks are created for Future Improvement items. They are noted for Technical Architecture Mapping consideration.

### 9.4 ALIGNED Findings — Detail

**F-01 / F-02: Dedicated Firestore collections**

The current implementation maintains separate Firestore collections for Fitness (`exercises`) and Wellness (`wellnessActivities`). Each has a dedicated service layer:

| Domain | Read Service | Admin Service | Collection |
|---|---|---|---|
| Fitness | `exerciseService` | `adminExerciseService` | `exercises` |
| Wellness | `wellnessActivityService` | `adminWellnessActivityService` | `wellnessActivities` |

This separation is ALIGNED with the Knowledge Architecture (§2.2). The two domains share governance rules but have distinct data shapes and service layers.

**F-03: Copy-at-creation pattern**

Challenges snapshot Activity data at creation time. The Challenge document is self-contained:

| What | Where | How |
|---|---|---|
| Activity reference | Challenge document | `activityId` / `exerciseId` field |
| Activity display data | Challenge document | Snapshotted fields (name, description, icon, etc.) |
| Challenge configuration | Challenge document | Metric, unit, target, frequency, duration |

This pattern is ALIGNED with the Historical Knowledge Preservation principle (§5).

**F-05: Unified engine with domain separation**

The challenge engine operates on `ActivityConfig` objects regardless of domain. Domain-specific routing happens at the service layer:

| Layer | Domain-Agnostic? | Notes |
|---|---|---|
| Challenge engine | Yes | Operates on `ActivityConfig`; no domain branching |
| Service layer | No | `challengeActivityFlow.ts` routes to correct domain service |
| Logging | No | Different paths: `/app/workouts/log` vs `/app/workouts/log-wellness` |
| Admin | No | Separate admin services per domain |

---

## 10. Technical Implications for Next-Stage Mapping

The Technical Architecture Mapping (Stage F deliverable 5) must address the following implications derived from this contract.

| # | Implication | Source | Priority | Affected Area |
|---|---|---|---|---|
| TI-01 | Activity lifecycle state machine (`draft` / `published` / `retired`) | EKG-01 §16, KRC §6 | Required | Activity schemas, service layer, admin UI |
| TI-02 | Activity version tracking | KRC §5.4, §9.2 (R-02) | Required | Activity schemas, Challenge creation flow |
| TI-03 | Runtime Catalogue API (published-only access) | EKG-01 §17, KRC §8 | Required | API layer, query filters |
| TI-04 | Knowledge change audit trail | EKG-01 §13-14, KRC §7 | Required | Activity write operations, audit logging |
| TI-05 | Fitness snapshot completeness at Challenge creation | KRC §9.2 (R-03) | Required | Challenge creation flow, document schema |
| TI-06 | Retirement mechanism (replace deletion) | EKG-01 §16, KRC §6.4, §9.2 (R-04) | Required | Admin delete flow, Runtime Catalogue |
| TI-07 | Resilience fallback for all Activity domains | KRC §8.3, §9.3 (I-01) | Recommended | Fallback catalog, activation logic |
| TI-08 | Cache invalidation on Knowledge publication changes | KRC §8.4 | Recommended | Caching layer, invalidation events |
| TI-09 | Admin UI for lifecycle management | EKG-01 §19, KRC §7 | Required | Admin frontend |
| TI-10 | Delegated admin permission model | EKG-01 §14, KRC §7.1 | Required | Auth/permissions layer |

**Priority mapping:**

| Priority | Count | Items |
|---|---|---|
| Required | 8 | TI-01 through TI-06, TI-09, TI-10 |
| Recommended | 2 | TI-07, TI-08 |

**Sequencing guidance for Technical Architecture Mapping:**

```
Phase 1 — Foundation:
    TI-01 (lifecycle states) — prerequisite for TI-03, TI-06
    TI-04 (audit trail) — foundational for governance compliance

Phase 2 — Runtime:
    TI-03 (Runtime Catalogue API) — depends on TI-01
    TI-06 (retirement mechanism) — depends on TI-01
    TI-05 (snapshot completeness) — independent

Phase 3 — Administration:
    TI-09 (admin UI) — depends on TI-01
    TI-10 (permission model) — depends on TI-01

Phase 4 — Resilience:
    TI-02 (versioning) — can proceed independently
    TI-07 (fallback) — can proceed independently
    TI-08 (cache invalidation) — depends on TI-03
```

---

## 11. Material Blockers

**NO MATERIAL BLOCKER.**

The current implementation's copy-at-creation pattern provides sufficient historical integrity for existing Challenges. The REMEDIATION REQUIRED findings (lifecycle states, versioning, snapshot completeness, retirement) are implementation improvements that do not block the Knowledge Runtime Contract itself.

| Potential Blocker | Assessment | Conclusion |
|---|---|---|
| No lifecycle states on Activities | Does not block contract definition; blocks enforcement | Contract is safe to define; remediation is input to Technical Architecture Mapping |
| No version tracking | Does not block historical display (snapshots are sufficient) | Divergence is invisible but not harmful at this stage |
| Fitness snapshot incomplete | Affects display quality for historical Fitness Challenges | Remediation required but not a blocker for contract |
| Hard delete permitted | Risk to historical integrity if exercised on referenced Activities | Remediation required; governance commitment sufficient for now |
| No approval workflow | Governance gap; not a technical blocker | Contract defines requirement; implementation follows |

The contract is safe to proceed with. Technical Architecture Mapping will address the remediation items.

---

## Appendix A: Cross-Reference to EKG-01 Principles

| EKG-01 Principle / Section | KRC Section | Implementation Status |
|---|---|---|
| P01 — Single Knowledge system | §2.1, §2.4 | ALIGNED (two domains, one system) |
| P03 — Knowledge vs Challenge boundary | §4.1, §4.5 | ALIGNED (copy-at-creation pattern) |
| P04 — Activity identity independence | §3.1 | ALIGNED (identity independent of context) |
| P06 — Context does not create identity | §3.1 | ALIGNED |
| §4 — Canonical Activity Knowledge Asset model | §2.3 | PARTIALLY ALIGNED (model exists; no lifecycle state) |
| §5 — Classification taxonomy | §2.2 | ALIGNED (6+6 categories) |
| §7 — Variant attribution | §3.4 | ALIGNED (variant relationship model defined) |
| §8 — Permitted metrics / units | §2.3, §4.2 | ALIGNED (metrics/units are governed fields) |
| §10 — Safety information | §2.3 | ALIGNED (safetyNotes field exists) |
| §13-14 — Attribution / audit trail | §7.4 | REMEDIATION REQUIRED (no structured attribution) |
| §16 — Publication / retirement | §6 | REMEDIATION REQUIRED (no lifecycle states) |
| §17 — Runtime Catalogue | §2.4, §8.2 | PARTIALLY ALIGNED (no formal Runtime Catalogue API) |
| §18 — Historical preservation | §5 | ALIGNED (copy-at-creation preserves history) |
| §19 — Knowledge administration | §7 | PARTIALLY ALIGNED (admin exists; no lifecycle management) |
| §20 — Governance rule authority | §7.3 | ALIGNED (Founder authority preserved) |

## Appendix B: Deferred Questions

| Deferral | Question | Status | Owner |
|---|---|---|---|
| ACT-03 | Who verifies Knowledge correctness? | Deferred | Founder |
| ACT-04 | Who authorises Knowledge corrections? | Deferred | Founder |
| MOT-01 | Who recognises Activity contributions? | Deferred | Founder |
| Rewards | How are rewards implemented, custodied, and entitled? | Deferred | Cross-cutting |

These deferrals are preserved from the governing instruments and are NOT resolved by this contract. They remain open for Founder decision.

## Appendix C: Document Relationships

```
EKG-01 (Knowledge Governance Standard)
    │
    ├──→ This Document (Knowledge Runtime Contract)
    │        │
    │        ├──→ T1 (Product Definition) — product context
    │        ├──→ T2 (Functional Requirements) — functional consumers
    │        ├──→ CIC (Canonical Information Contract) — data contracts
    │        │
    │        └──→ Technical Architecture Mapping (Stage F deliverable 5)
    │             — addresses remediation items
    │
    ├──→ EOG-E1-01 (Entity & Operational Governance)
    │
    └──→ CGP-04 (Entity Relationship Allocation Register)
```

---

*End of Stage F Knowledge Runtime Contract — DRAFT v0.1*
*Date: 2026-09-05*
*Status: Pending Founder Review*
