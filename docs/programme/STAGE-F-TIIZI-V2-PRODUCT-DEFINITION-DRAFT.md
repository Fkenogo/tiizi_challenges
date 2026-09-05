---
title: "Tiizi V2 — Stage F Product Definition"
document_type: "Stage F Product Definition — DRAFT"
stage: "Stage F — Product & Technical Translation"
version: "0.1-draft"
date: "2026-09-05"
status: "Stage F Draft — Pending Founder Review"
supersedes_working:
  - "TIIZI-V2-STAGE-F-PRODUCT-MODEL-FOUNDER-WORKING-BASELINE-v0.1 (2026-09-04, SHA-256: 6b31bbb8)"
  - "TIIZI-V2-STAGE-F-COLLECTIVE-CHALLENGE-PRODUCT-DEFINITION-FOUNDER-WORKING-BASELINE-v0.1 (2026-09-04, SHA-256: faa531b5)"
  - "TIIZI-V2-STAGE-F-COMPETITIVE-CHALLENGE-PRODUCT-DEFINITION-FOUNDER-WORKING-BASELINE-v0.1 (2026-09-04, SHA-256: 71562b85)"
  - "TIIZI-V2-STAGE-F-STREAK-CHALLENGE-PRODUCT-DEFINITION-FOUNDER-WORKING-BASELINE-v0.1 (2026-09-04, SHA-256: 866d56d8)"
  - "TIIZI-V2-STAGE-F-SHARED-CHALLENGE-EXPERIENCE-FOUNDER-WORKING-BASELINE-v0.1 (2026-09-04, SHA-256: 0df5df6d)"
  - "TIIZI-V2-STAGE-F-LOGICAL-PRODUCT-AND-DOMAIN-MODEL-FOUNDER-WORKING-BASELINE-v0.1 (2026-09-04, SHA-256: 02ee9869)"
  - "TIIZI-V2-CALCULATION-AND-DERIVED-TRUTH-MODEL-FOUNDER-WORKING-BASELINE (2026-09-04, SHA-256: aa570df1)"
  - "TIIZI-V2-RECOGNITION-AND-ACHIEVEMENT-MODEL-FOUNDER-WORKING-BASELINE (2026-09-04, SHA-256: 3bf48042)"
  - "TIIZI-V2-CONTRIBUTION-AND-CAUSES-FUNCTIONAL-MODEL-FOUNDER-WORKING-BASELINE (2026-09-04, SHA-256: 77712c92)"
  - "TIIZI-V2-NOTIFICATIONS-FEED-DISCOVERY-AND-SOCIAL-BEHAVIOUR-MODEL-FOUNDER-WORKING-BASELINE (2026-09-04, SHA-256: 80fffeab)"
authority_basis:
  - "Tiizi Constitutional Ontology & Foundational Product Concepts (Document 00)"
  - "EOG-E1-01 Tiizi Entity & Operational Governance Standard v0.2 (Founder Approved 2026-09-03)"
  - "EKG-01 Tiizi Knowledge Governance Standard v0.1 (Founder Approved 2026-09-02)"
  - "CGP-04 Entity Relationship Allocation Register v0.1 (Founder Approved 2026-09-01)"
  - "Stage F Founder Working Baseline Reconciliation (RECON-001, d5f3baf)"
preserved_deferrals:
  - "ACT-03 — Verification Authority"
  - "ACT-04 — Correction Authority"
  - "MOT-01 — Recognition Authority"
  - "Rewards — implementation/custody/entitlement"
reconciliation_branch: "recon/stage-f-founder-baselines-001"
reconciliation_commit: "d5f3baf"
---

# Tiizi V2 — Stage F Product Definition (DRAFT)

**Document Status:** Stage F Draft — Pending Founder Review
**Version:** 0.1-draft
**Date:** 2026-09-05
**Authority:** This document consolidates product substance from Stage F Founder Working Baselines. It does NOT authorize implementation.

---

## A. Purpose, Authority and Stage F Status

### A.1 Document Purpose

This Stage F Product Definition consolidates product substance from ten (10) Stage F Founder Working Baselines into a single coherent product model. It serves as the authoritative product reference for Stage F technical translation work.

This is a **DRAFT** product definition. It has not been approved by the Founder. It is presented for Founder review as part of the Stage F delivery process.

### A.2 Source Baselines Consolidated

This document consolidates the following Founder-approved working baselines:

1. **TIIZI-V2-STAGE-F-PRODUCT-MODEL-FOUNDER-WORKING-BASELINE-v0.1** (2026-09-04, SHA-256: 6b31bbb8)
2. **TIIZI-V2-STAGE-F-COLLECTIVE-CHALLENGE-PRODUCT-DEFINITION-FOUNDER-WORKING-BASELINE-v0.1** (2026-09-04, SHA-256: faa531b5)
3. **TIIZI-V2-STAGE-F-COMPETITIVE-CHALLENGE-PRODUCT-DEFINITION-FOUNDER-WORKING-BASELINE-v0.1** (2026-09-04, SHA-256: 71562b85)
4. **TIIZI-V2-STAGE-F-STREAK-CHALLENGE-PRODUCT-DEFINITION-FOUNDER-WORKING-BASELINE-v0.1** (2026-09-04, SHA-256: 866d56d8)
5. **TIIZI-V2-STAGE-F-SHARED-CHALLENGE-EXPERIENCE-FOUNDER-WORKING-BASELINE-v0.1** (2026-09-04, SHA-256: 0df5df6d)
6. **TIIZI-V2-STAGE-F-LOGICAL-PRODUCT-AND-DOMAIN-MODEL-FOUNDER-WORKING-BASELINE-v0.1** (2026-09-04, SHA-256: 02ee9869)
7. **TIIZI-V2-CALCULATION-AND-DERIVED-TRUTH-MODEL-FOUNDER-WORKING-BASELINE** (2026-09-04, SHA-256: aa570df1)
8. **TIIZI-V2-RECOGNITION-AND-ACHIEVEMENT-MODEL-FOUNDER-WORKING-BASELINE** (2026-09-04, SHA-256: 3bf48042)
9. **TIIZI-V2-CONTRIBUTION-AND-CAUSES-FUNCTIONAL-MODEL-FOUNDER-WORKING-BASELINE** (2026-09-04, SHA-256: 77712c92)
10. **TIIZI-V2-NOTIFICATIONS-FEED-DISCOVERY-AND-SOCIAL-BEHAVIOUR-MODEL-FOUNDER-WORKING-BASELINE** (2026-09-04, SHA-256: 80fffeab)

### A.3 Authority Hierarchy

The following authority hierarchy governs Tiizi V2 product and technical definition:

1. **Approved Governance Documents** — Constitutional Ontology (Document 00), EOG-E1-01, EKG-01, CGP-04
2. **Reconciliation Findings** — RECON-001 (d5f3baf)
3. **Working Baselines** — the ten source documents listed in §A.2
4. **Implementation Evidence** — code, schemas, APIs (downstream of this document)

This document occupies position 3 in the hierarchy. It consolidates working baselines in light of reconciliation findings but does not supersede approved governance. Where this document conflicts with an approved governance document, the approved governance document controls.

### A.4 What This Document Does NOT Do

This document:

- **Does NOT authorize implementation.** It is a product definition, not a technical specification or build authorization.
- **Does NOT resolve deferred authorities.** ACT-03 (Verification Authority), ACT-04 (Correction Authority), MOT-01 (Recognition Authority), and Rewards (implementation, custody, entitlement) remain explicitly deferred.
- **Does NOT complete Stage F.** Stage F remains incomplete until the Canonical Information Contract, Knowledge Runtime Contract, and Technical Architecture Mapping are delivered and approved.
- **Does NOT supersede approved governance.** Where this document conflicts with EOG-E1-01, EKG-01, or CGP-04, the approved governance document controls.

### A.5 Stage F Remaining Deliverables

Following this draft product definition, Stage F requires:

1. **Canonical Information Contract** — data structures, field definitions, validation rules, entity relationships expressed as implementable contracts.
2. **Knowledge Runtime Contract** — Activity Library runtime representation, variant resolution, metric/unit binding, knowledge governance integration.
3. **Technical Architecture Mapping** — system components, service boundaries, data flow, integration points, deployment topology.

These deliverables translate this product definition into implementable technical specifications. They are downstream of this document and must remain consistent with it.

---

## B. Core Tiizi V2 Proposition

### B.1 What Tiizi Is

Tiizi is a **group accountability platform for fitness and wellness**. It enables Members to form voluntary communities, set shared or individual goals, and hold themselves accountable through structured Challenges.

The core relationship chain is: **Member → Group → Challenge**.

- A **Person** must first become a **Tiizi Member**.
- A **Member** may join or create **Groups** (persistent community contexts).
- Within a **Group**, Members may establish **Challenges** (structured accountability undertakings).
- **Participation** in Challenges is voluntary and distinct from Group Membership.

Tiizi exists to support self-accountability within community context. Members choose to participate, set or join goals, and track their own progress. Tiizi provides structure, truth, and recognition — not enforcement, policing, or external motivation.

### B.2 Foundational Principles

Tiizi operates on three foundational principles:

**Community Before Competition.** Tiizi prioritizes collective accountability and mutual support over competitive ranking. Competition exists as a Challenge type, but the platform does not default to leaderboard mechanics or popularity contests. The Group — the community — is the primary context, not the individual ranking.

**Truth Before Recognition.** Derived Truth (what Participants actually achieved) precedes Recognition (badges, awards, acknowledgements). Recognition reflects truthful outcomes; it does not substitute for them or inflate them. If Derived Truth changes through legitimate correction, Recognition follows.

**Participation Before Reward.** Tiizi does not gate participation behind payment, subscription, or reward mechanics. The platform is free to use. Support Tiizi is voluntary. Financial contribution does not affect Challenge truth or Recognition.

### B.3 What Tiizi Is NOT

Tiizi is explicitly **not**:

- **Not a fitness tracker.** Tiizi does not track real-world Activity through device sensors, GPS, or wearable integrations. Members self-report; Tiizi calculates what they report.
- **Not a challenge app.** Tiizi is not a generic challenge platform. Challenges are accountability structures within Groups, not standalone gamification.
- **Not a reward platform.** Tiizi does not distribute rewards, prizes, or material incentives. Recognition is symbolic, not transactional.
- **Not a social network.** Tiizi is not a general-purpose social platform. Social features (Feed, Kudos, Sharing) serve accountability, not social engagement for its own sake.
- **Not an activity logger.** Tiizi does not maintain a persistent personal activity log independent of Challenges. Activity is logged within the context of specific Challenges.
- **Not a leaderboard.** Tiizi does not rank Members globally or within Groups. Competitive Challenges have finishing positions, but these are Challenge-specific, not platform-wide rankings.

### B.4 Constitutional Ontology Layers

Tiizi's product model follows the Constitutional Ontology's layered structure:

| Layer | Product Term | Description |
|-------|-------------|-------------|
| Platform | Tiizi Platform | The platform as a whole, governed by Platform Policy |
| Community | Group | Persistent community context with Charter |
| Undertaking | Challenge | Structured accountability undertaking within a Group |
| Commitment | Participation | Voluntary commitment to participate in a Challenge |
| Evidence | Activity Record | Activity logged by a Participant within a Challenge |
| Truth | Derived Truth | Calculated outcome from Evidence |
| Motivation | Recognition | Issued when Derived Truth satisfies qualification conditions |
| Growth | (Deferred) | Member development over time — not a primary V2 focus |

Each layer has distinct governance, visibility, and lifecycle properties. Governance flows downward: Platform Policy supersedes Group Charter; Group Charter frames Challenge configuration; Challenge configuration governs Participation.

---

## C. Member → Group → Challenge Product Structure

### C.1 Membership Precedes Everything

A Person must become a **Tiizi Member** before participating in any Group or Challenge. Membership is the foundational relationship with the Platform. Without Membership, there is no access to Groups or Challenges.

### C.2 Group Membership Is Voluntary

A Member may join or create Groups. Group Membership is voluntary and distinct from Platform Membership. A Member may belong to zero, one, or many Groups. No Member is required to join a Group to remain a Tiizi Member.

### C.3 Challenges Exist Only Within Groups

A **Challenge** may only be established within the context of a Group. Every Challenge belongs to exactly one Group. There are no platform-wide Challenges independent of Groups. This ensures that every Challenge operates within a community context with governance (Charter, Steward) and visibility controls.

### C.4 Group Membership ≠ Challenge Participation

**Group Membership** and **Challenge Participation** are distinct relationships:

- A Member may belong to a Group without participating in any of its Challenges.
- A Member may participate in a Challenge only if they are a Group Member (eligibility enforced at join time).
- Joining a Group does not automatically enroll the Member in any Challenge.
- Participating in a Challenge does not grant any Group governance authority.

### C.5 No Automatic Enrollment

Tiizi does not automatically enroll Members into Challenges. Participation requires **affirmative joining** — the Member must explicitly choose to participate. This preserves voluntary self-accountability and prevents unintended commitment.

### C.6 Challenge Configuration Controls Eligibility

Challenge configuration determines who is eligible to participate. Eligibility may reference Group Membership status, but participation is always voluntary and always requires affirmative action. The Challenge creator defines eligibility; the Group Charter may constrain creation permissions.

---

## D. Group Product Model

### D.1 Groups as Persistent Community Context

A **Group** is a persistent community context. It provides:

- **Membership context** — who belongs to the Group
- **Identity** — Group name, description, purpose, image
- **Charter** — governing principles for the Group (subordinate to Platform Policy)
- **Challenge hosting** — the context within which Challenges are created and managed
- **Accountability** — the community within which Members hold themselves accountable
- **Governance** — stewardship, administration, and community norms

Groups persist across Challenges. A Group may host many Challenges over time, each with its own lifecycle. The Group itself does not end when a Challenge ends.

### D.2 Group Creation

Any Tiizi Member may create a Group. The creator becomes the initial **Accountable Steward** of the Group.

**Stewardship continuity** follows EOG-E1-01 §4 — the Group must always have exactly one Accountable Steward. If the current Steward withdraws or is removed, stewardship must transfer to another Group Member per governed procedures. A Group without a Steward is in a governance deficit that must be resolved.

### D.3 Group Charter

Every Group has a **Charter** — a governing document that specifies:

- Group purpose and identity
- Community norms and expectations
- Challenge creation permissions (e.g., whether any Member may create Challenges, or only the Steward)
- Any Group-specific governance provisions

**Charter composition:**

- **Prefilled selectable articles** — standard provisions approved by Platform Policy. The Steward selects from available articles.
- **Custom text** — Group-specific additions authored by the Steward.

**Charter subordination:** Group Charter is subordinate to Platform Policy. Where Charter conflicts with Platform Policy, Platform Policy controls. The Charter may add governance within Platform boundaries; it may not override them.

### D.4 Group Visibility

Groups operate under approved **visibility classes** per EOG-E1-01 §§30-32:

| Visibility Class | Description |
|-----------------|-------------|
| Public | Visible to anyone, including non-Members |
| Authenticated-discoverable | Visible to Tiizi Members, discoverable via browse/search |
| Shared-group | Visible to Group Members only |
| Private | Visible to Group Members only, not discoverable |
| Privileged-operational | Visible to privileged roles (e.g., Platform administrators) |

Visibility determines who can discover the Group and view its information. It does not affect Platform governance authority — Platform governance applies regardless of Group visibility.

### D.5 Group Discovery

**Discoverable Groups** (Public, Authenticated-discoverable) are browsable by eligible Members. Discovery information includes:

- Group name, description, purpose
- Group image
- Charter (or summary)
- Member count
- Active Challenges (subject to Challenge visibility)

**Private Groups** are not discoverable. They are visible only to Group Members.

**Discovery does not create Membership.** Browsing a Group does not enroll the browser into the Group. Membership requires affirmative joining.

### D.6 Group Administration

Tiizi V2 implements a **lightweight administration model**:

- **Accountable Steward** — primary governance authority for the Group (per EOG-E1-01 §4)
- **Challenge creation permissions** — configurable via Charter (any Member, or Steward only, or other governed configuration)
- **Member management** — join requests, removal (per governed procedures)

Tiizi does not implement complex role hierarchies or granular permission systems in V2. Group governance is simple and steward-centered.

---

## E. Challenge Foundation

### E.1 Challenge Creation Context

Every Challenge is created **within a Group**. The Challenge belongs to that Group for its entire lifecycle. A Challenge cannot be transferred between Groups. If the Group ceases to exist, the Challenge's status is governed by Platform Policy (not defined in this document).

### E.2 Challenge Creation Permissions

**Default:** Any Group Member may create a Challenge.

**Charter override:** The Group Charter may restrict Challenge creation to the Steward or other governed configuration.

### E.3 Challenge Creator Attribution

The Member who creates a Challenge receives **historical attribution** as the creator. This is not perpetual ownership or governance authority. The creator's role is historical record, not ongoing control. Once created, the Challenge operates according to its configuration and the governing rules — the creator does not retain special privileges over it.

### E.4 Challenge Types

Tiizi V2 supports three Challenge types:

1. **Collective Challenge** — Participants contribute toward a shared Goal (see Section J)
2. **Competitive Challenge** — Participants race to a configured target; finishing position determined by target-completion order (see Section K)
3. **Streak Challenge** — Participants maintain daily consistency across a configured period (see Section L)

Each type has distinct configuration, calculation, and completion rules.

### E.5 Challenge Configuration

Challenge configuration includes:

- **Activity/Activities** — which canonical Activity/Activities the Challenge references
- **Type** — Collective, Competitive, or Streak
- **Goal/target** — the quantitative objective (shared Goal for Collective, individual target for Competitive, daily requirement for Streak)
- **Metric** — the measurement standard (e.g., distance, duration, count)
- **Unit** — the unit of measurement (e.g., kilometers, minutes, repetitions)
- **Duration** — the Challenge period (start date, end date)
- **Schedule** — for Streak Challenges, the daily requirement schedule
- **Eligibility** — who may participate (e.g., all Group Members, specific Member subsets)
- **Instructions** — guidance for Participants
- **Contribution options** — for Social Causes (see Section W)

### E.6 Challenge Templates

A **Template** is a reusable starting point for creating new Challenges. A Template captures Challenge configuration but does not establish a live Challenge itself.

**Template properties:**

- **Reusable** — may be adopted multiple times to create distinct Challenges
- **Each adoption creates a new Challenge** — with a new identity, lifecycle, participation, and history
- **The Template itself is not a Challenge** — it does not participate in calculations, does not have Participants, does not have a lifecycle
- **An ended Challenge may serve as a Template** — for a new Challenge (see Section N)

Templates are a convenience mechanism. They do not establish governance relationships or create ongoing obligations.

### E.7 Challenge Creation Wizard

The **Challenge Creation Wizard** is a product mechanism that guides Members through Challenge configuration. It is a user interface tool, not a governance Authority. The Wizard facilitates configuration; it does not grant or restrict authority. It enforces configuration validity (e.g., metric/unit compatibility with the selected Activity) but does not make governance decisions.

### E.8 Challenge Discovery

Challenges are discoverable where Group visibility permits:

- **Browseable within Group pages** — Group Members may view active Challenges
- **Home recommendations** — Tiizi may recommend Challenges based on Member interests, Group memberships, Activity categories
- **Browse/search** — discoverable Challenges may appear in search results

**Recommendation ≠ enrollment.** Tiizi may recommend a Challenge, but recommendation does not enroll the Member. Participation requires affirmative joining.

### E.9 Voluntary Participation

Participation in Challenges is **voluntary**:

- **Affirmative joining required** — the Member must explicitly choose to participate
- **Eligibility enforced** — the Member must satisfy Challenge eligibility requirements
- **Withdrawal supported** — the Member may withdraw from a Challenge at any time (subject to historical preservation)

### E.10 Historical Preservation on Withdrawal/Removal

When a Member withdraws from or is removed from a Challenge:

- **Historical records preserved** — the Member's Activity records and Derived Truth contributions remain in the Challenge history
- **Participation ends** — the Member is no longer an active Participant
- **No further logging** — the Member may not log additional Activity in that Challenge
- **Historical intelligibility maintained** — the Challenge history remains coherent and attributable

---

## F. Activity Knowledge and Challenge Configuration Relationship

### F.1 Canonical Activity Library

Tiizi maintains a **canonical Activity Library** per EKG-01. The Activity Library is governed knowledge — it defines what Activities Tiizi recognizes, not what Members actually do. The Knowledge Authority (Founder, per EKG-01) governs the Activity Library.

**Initial baseline:** 6 Fitness categories + 6 Wellness categories.

**Fitness categories (examples):** Running, Cycling, Strength Training, Swimming, Yoga, Walking.
**Wellness categories (examples):** Sleep, Hydration, Nutrition, Mindfulness, Reading, Medication Adherence.

The exact category and Activity catalogue is governed knowledge and may evolve. This document establishes the structural relationship, not the exhaustive content.

### F.2 Activity Knowledge Structure

Each canonical Activity provides:

- **Identity** — unique Activity identifier and name
- **Category** — Fitness or Wellness category
- **Variants** — permitted measurement variants (e.g., Push-Up in repetitions, Push-Up Hold in seconds)
- **Permitted Metrics/Units** — what can be measured and in what units (e.g., distance in kilometers, duration in minutes)
- **Measurement guidance** — how to measure the Activity
- **Instructions** — how to perform the Activity
- **Difficulty advice** — guidance on Activity difficulty levels

### F.3 Activities Do Not Become Rigid Challenge Definitions

Canonical Activities define **reusable knowledge**, not rigid Challenge definitions. A Challenge references canonical Activity knowledge but determines its own specific configuration:

- The Activity defines what variants and metrics are permitted.
- The Challenge determines which variant, metric, and unit apply.
- The Activity provides measurement guidance; the Challenge sets the Goal/target.
- The Activity is shared knowledge; the Challenge is a specific undertaking.

This separation allows the same Activity knowledge to serve many different Challenges with different goals, durations, and configurations.

### F.4 Activity Variants

An Activity may have multiple **variants** — distinct measurement modes for the same underlying Activity.

**Example:**

- **Activity:** Push-Up
- **Variant 1:** Push-Up (measured in repetitions)
- **Variant 2:** Push-Up Hold (measured in seconds)

A Challenge selects which variant applies. A Participant logs according to the Challenge-configured variant. The variant determines what metric and unit are used for that Challenge.

### F.5 Member Activity Exists Independently of Challenge

A Member's real-world Activity exists independently of any Challenge. Tiizi does not track real-world Activity; it records what Members report within Challenge contexts.

**Key distinction:**

- **Member Activity Event** — a Member's report of real-world Activity (exists independently of any Challenge)
- **Challenge-Specific Activity Record** — the same Activity logged within a specific Challenge context

A Member may perform the same real-world Activity multiple times and log it in different Challenges. Each log is a distinct Challenge-specific record.

### F.6 Challenge Does Not Own Underlying Member Activity Event

A Challenge does not "own" the underlying Member Activity Event. The Member Activity Event is the Member's report; the Challenge-specific record is the application of that report to a particular Challenge.

This distinction supports:

- **Historical preservation** — if a Challenge ends, the Member's Activity history remains
- **Multiple Challenge participation** — the same real-world Activity may be logged in multiple compatible Challenges (see Section G)
- **Correction and recalculation** — corrections to Challenge-specific records do not alter the Member's underlying Activity history

---

## G. Challenge-Specific Activity Logging Model

### G.1 Critical Latest Position (Reconciliation F-A-01)

This section reflects the **latest position per reconciliation F-A-01**. It supersedes any earlier working baseline wording implying cross-Challenge Activity reuse.

### G.2 Challenge Activity Logging Boundary

**Challenge Activity is logged within the Challenge in which the Participant intends it to count.**

- A log made in Challenge A does NOT automatically exist in, transfer to, or count toward Challenge B.
- The same real-world Activity may be separately reported in more than one compatible Challenge, but Tiizi does not establish a system relationship between those separate reports.
- A Participant deliberately logs separately in each Challenge if the same real-world Activity is intended to count in more than one Challenge.

### G.3 No Automatic Cross-Challenge Attribution

There is **no initial V2 requirement** for:

- Cross-Challenge Activity matching
- Automatic Activity reuse across Challenges
- System-mediated attribution of one Activity Event to multiple Challenges

Each Challenge maintains its own Activity records. Participants are responsible for logging in each Challenge where they intend the Activity to count.

### G.4 Canonical Activities May Be Shared Across Challenges

**Canonical Activities** (the knowledge domain) may be shared across Challenges. Multiple Challenges may reference the same canonical Activity (e.g., both Challenge A and Challenge B reference "Running").

**This is about canonical Activity types/knowledge, NOT event reuse.** The Activity knowledge is shared; the Activity records are Challenge-specific.

### G.5 Superseded Working Positions

**SUPERSEDED:** Any earlier wording in working baselines implying that one Activity Event automatically contributes to multiple Challenges is superseded by this section.

**Rationale:** Automatic cross-Challenge reuse creates ambiguity about Participant intent, complicates correction and recalculation, and undermines the principle that Participation is voluntary and deliberate. Challenge-specific logging preserves clarity and accountability.

---

## H. Challenge Participation

### H.1 Affirmative Joining Required

Participation in a Challenge requires **affirmative joining** — the Member must explicitly choose to participate. Tiizi does not automatically enroll Members into Challenges. This is a core expression of the voluntary self-accountability principle.

### H.2 No Automatic Enrollment from Group Membership

Joining a Group does not automatically enroll the Member in any of the Group's Challenges. Group Membership and Challenge Participation are distinct relationships (see §C.4). A Member may belong to a Group and never participate in any Challenge.

### H.3 Eligibility Enforcement

Challenge eligibility is enforced at the point of joining. A Member must satisfy Challenge eligibility requirements to participate. Eligibility may reference:

- Group Membership status (must be a Group Member)
- Challenge-specific criteria (e.g., prior participation, skill level, if configured)
- Charter provisions (if the Charter imposes additional constraints)

Eligibility is checked at join time. If eligibility changes during the Challenge (e.g., a Member is removed from the Group), the participation status is governed by Platform Policy and Challenge rules.

### H.4 Participation Attribution

Participation is attributable — Tiizi records who participated in which Challenge, when they joined, and what they achieved. Participation attribution is part of the Challenge history and contributes to historical intelligibility.

### H.5 Participation Is Non-Governing

Participation in a Challenge does not grant any governance authority. Participants do not gain control over the Challenge, the Group, or other Participants. Participation is a commitment to self-accountability, not a governance role. The Challenge creator has historical attribution but not ongoing governance authority.

### H.6 Voluntary Withdrawal Supported

A Participant may withdraw from a Challenge at any time. Withdrawal:

- Ends active Participation
- Preserves historical records (see §E.10)
- Does not affect the Challenge's continued operation
- Does not affect other Participants' progress or Derived Truth

### H.7 Authorized Removal Supported

A Participant may be removed from a Challenge by authorized authority (e.g., Group Steward, Platform administrator) per governed procedures. Removal:

- Ends active Participation
- Preserves historical records
- Does not affect the Challenge's continued operation
- Is distinguishable from voluntary withdrawal in historical records

### H.8 Historical Preservation on Exit

Whether by withdrawal or removal, historical records are preserved. The exited Participant's Activity records and Derived Truth contributions remain in the Challenge history for historical intelligibility. The exited Participant is identified as no longer active, but their prior contributions remain attributable and visible.

---

## I. Challenge Lifecycle

### I.1 Lifecycle States

A Challenge progresses through three lifecycle states:

1. **Establishment** — Challenge created, configuration finalized, participation open. The Challenge exists but may not yet be active (depending on configured start date).
2. **Active** — Challenge in progress. Participants are logging Activity. Derived Truth is being calculated. This is the operational state.
3. **Ended** — Challenge period concluded. Final Derived Truth is established. No further ordinary logging is accepted.

### I.2 No Universal Completion Rule Across Types

There is **no universal completion rule** across all Challenge types. Each Challenge type has type-specific completion rules:

- **Collective** — completes when the shared Goal is reached (or period expires)
- **Competitive** — closes at the configured end of the competitive window
- **Streak** — closes when the configured period ends

The lifecycle states (Establishment, Active, Ended) are common across types. The conditions for transitioning from Active to Ended are type-specific.

### I.3 Ended Challenge Is Historically Complete

An ended Challenge is **historically complete**. Its Final Derived Truth is established. The Challenge identity, configuration, participation, and outcomes are preserved for historical intelligibility. An ended Challenge is a historical record, not an active undertaking.

### I.4 No Same-Identity Reopening

An ended Challenge **cannot be reopened** under the same identity. Once a Challenge ends, its lifecycle is complete. There is no mechanism to resume or extend an ended Challenge. This preserves the integrity of the historical record.

### I.5 Run Again Creates New Challenge

**Run Again** is a product mechanism that creates a **new Challenge** based on an ended Challenge (often using it as a Template). The new Challenge has:

- **New identity** — distinct from the original Challenge
- **New lifecycle** — starts at Establishment, progresses through Active, ends independently
- **New participation** — Members must join again; prior participation does not carry over
- **New progress** — starts from zero; prior progress does not carry over
- **New history** — independent historical record

Run Again is a convenience mechanism. It does not extend, resume, or continue the original Challenge.

### I.6 Extension Differs from Repetition

**Extension** is different from **repetition** (Run Again):

- **Extension** occurs while the Challenge is still Active. It extends the Challenge period (e.g., adds days to the end date). Extension preserves the same Challenge identity, lifecycle, participation, and history.
- **Repetition** (Run Again) occurs after the Challenge has Ended. It creates a new Challenge with a new identity.

Extension must occur **before** the Challenge ends. Once a Challenge has ended, it cannot be extended — only repeated via Run Again.

### I.7 Extension Preserves Identity and History

When a Challenge is extended:

- The same Challenge identity continues
- The same participation continues
- The same progress continues (accumulated contributions are preserved)
- The Challenge history is continuous (no break or reset)
- The end date changes (extended)

Extension is a modification of the Active Challenge, not the creation of a new one.

---

## J. Collective Challenge Model

### J.1 Shared Goal

A **Collective Challenge** is defined by a **shared Goal** toward which all Participants contribute. The Goal is a single quantitative target (e.g., 1000 km, 5000 minutes, 10,000 repetitions) that the group works toward together.

### J.2 Collective Progress Calculation

**Collective Progress** is the sum of all qualifying Challenge-specific Participant contributions.

- Each Participant logs Activity within the Challenge.
- Each qualifying contribution is added to the common total.
- Collective Progress = sum of all qualifying contributions.

The calculation is straightforward accumulation. There is no weighting, normalization, or adjustment beyond eligibility filtering.

### J.3 Goal Crossing

When a contribution causes Collective Progress to reach or exceed the configured Goal:

- The contribution that crosses the Goal is **recorded in full**.
- Example: If the Goal is 1000 km and Collective Progress is 998 km, a 5 km contribution brings the total to 1003 km. The full 5 km is recorded. The result is 1003 km, not 1000 km.

### J.4 May Exceed 100%

Collective Progress **may exceed 100%** of the Goal. The result is displayed truthfully (e.g., 100.3%). There is no artificial cap at 100%.

### J.5 Completion Boundary

When the Goal is reached:

- **Ordinary new Activity logging closes.** Participants may no longer log new Activity that counts toward the Collective Progress.
- The Challenge transitions to Ended (or to a completed state within the Active period, depending on implementation).
- A later ordinary log does not increase the completed result.

The completion boundary preserves the integrity of the achieved result.

### J.6 Expiry Without Goal Reached

If the Challenge period ends before the Goal is reached:

- The actual result is reported (e.g., 873/1000 km = 87.3%).
- **No failure label is applied.** The result is stated truthfully without judgement.
- The Challenge transitions to Ended.

Tiizi reports what happened. It does not label unmet goals as failures.

### J.7 Extension Rules

Extension of a Collective Challenge:

- Is only permitted while the Challenge is **Active** — never after it has Ended.
- Must be authorized per governed procedures.
- Preserves the same Challenge identity, participation, progress, and history.
- Does not reset or alter accumulated contributions.

**Open parameter:** No universal extension cap is established in this document. Whether there is a maximum number or duration of extensions is a product parameter to be determined.

### J.8 Run Again ≠ Extension

Run Again creates a new Challenge (see §I.5). It is not an extension. A Collective Challenge that has Ended cannot be extended — it can only be repeated via Run Again, which starts fresh.

### J.9 No Forced Competitive Ranking

Although individual contributions are visible (as part of the collective record), a Collective Challenge does not impose competitive ranking. The focus is on the shared Goal, not on who contributed most. Individual contribution is attributable but not ranked.

If the Group or Challenge creator wishes to highlight top contributors, this is a presentation choice, not a structural requirement. The Challenge model does not force competitive ranking merely because individual contributions are visible.

### J.10 Calculation Schedule — Collective

The calculation schedule for Collective Challenges is:

1. **Eligible contribution:** Each qualifying Participant contribution is added to the common total.
2. **Accumulation:** Collective Progress = sum of all qualifying Challenge-specific contributions.
3. **Goal crossing:** The cumulative qualifying progress first reaches or exceeds the configured Goal.
4. **Full crossing contribution:** The contribution that crosses the Goal is recorded in full (not truncated to the Goal boundary).
5. **>100% result:** The result may exceed 100% and is displayed truthfully.
6. **Completion boundary:** When the Goal is reached, ordinary new logging closes.
7. **Expiry:** If the period ends before the Goal is reached, the actual result and percentage are reported.
8. **Extension boundary:** Extension is only permitted while Active, never after end; extension preserves identity.
9. **Correction/recalculation:** A legitimate governed correction triggers recalculation of affected Derived Truth.

---

## K. Competitive Challenge Model

### K.1 Latest Position (Reconciliation F-B-01, F-B-02)

This section reflects the **latest position per reconciliation F-B-01 and F-B-02**. It supersedes any earlier working baseline wording that included a "Highest Performance" mode.

### K.2 Initial V2 Competitive = Race to Target Only

Initial V2 Competitive Challenges are a **race to a configured target only**. There is no "Highest Performance" mode in V2. Each Participant races to reach the configured target; finishing position is determined by who reaches the target first.

### K.3 Individual Challenge-Specific Progress

Each Participant maintains **individual Challenge-specific progress** within a Competitive Challenge. Progress is calculated per Participant based on their Challenge-specific Activity records.

### K.4 Target Completion

Target completion occurs when a Participant's qualifying cumulative progress **reaches or exceeds** the configured target.

- Individual early completion is allowed — one Participant reaching the target does NOT end the Challenge.
- The Challenge continues until the configured competitive window closes.
- Other Participants may continue to work toward the target.

### K.5 Challenge Closure

The Challenge **closes at the configured end of the competitive window**. This is a fixed endpoint determined by Challenge configuration (e.g., end date, duration). The Challenge does not close early because one or more Participants have reached the target.

### K.6 Finishing Position

**Finishing position** is determined by **governed target-completion order**:

- Earlier target completion = higher position (1st, 2nd, 3rd, etc.)
- The Participant who reaches the target first is in 1st position.
- The Participant who reaches the target second is in 2nd position.
- And so on.

### K.7 Additional Progress After Target Does Not Improve Position

Once a Participant reaches the target, additional progress **does not improve their finishing position**. Position is determined by when the target was reached, not by how much excess performance was accumulated.

### K.8 Ties — No Artificial Tie-Breaker

If two or more Participants reach the target at the **identical governed completion point**, they **share that finishing position**.

- Example: If two Participants both reach the target at the same governed time point, they are both in 1st position. The next Participant to reach the target is in 3rd position (not 2nd).
- **No artificial tie-breaker** is applied. Tiizi does not introduce secondary criteria (e.g., fractional time, random ordering) to separate tied Participants.

Ties are a legitimate outcome. They reflect truthful equality, not a problem to be solved.

### K.9 Non-Completers

Participants who do not reach the target before the Challenge closes:

- **Receive NO finishing position.** They are not ranked as 4th, 5th, etc.
- Their **actual final progress remains visible** — their achievement is reported truthfully.
- They are **NEVER labelled as failed** or given any negative designation.

Non-completion is not failure. It is a truthful report of what was achieved.

### K.10 Finishing Position Is Derived Truth

Finishing position is **Derived Truth** — it is calculated from the underlying records. It is not a manual assignment or a fixed label.

- If a legitimate governed correction removes or alters a supporting record, progress and position are **recalculated**.
- If a Participant later reaches the target again (after a correction restores eligibility), the new completion point determines their position.

Finishing position follows the truth. It is not preserved for appearance.

### K.11 Calculation Schedule — Competitive

The calculation schedule for Competitive Challenges is:

1. **Participant progress:** Each Participant's individual Challenge-specific progress total is maintained.
2. **Target completion:** A Participant's qualifying cumulative progress reaches or exceeds the configured target.
3. **Finishing position:** Determined by governed target-completion order (earlier = higher).
4. **Shared/tied position:** Identical completion points share position; no artificial tie-breaker.
5. **Non-completer outcome:** No finishing position; actual progress visible; never labelled failed.
6. **Challenge closure:** At the configured end of the competitive window.
7. **Correction/recalculation:** A legitimate governed correction triggers recalculation of position as Derived Truth.

---

## L. Streak Challenge Model

### L.1 Latest Position (Reconciliation F-C-01, F-C-02)

This section reflects the **latest position per reconciliation F-C-01 and F-C-02**. It supersedes any earlier working baseline wording that included weekly recurrence mode.

### L.2 Initial V2 Streak = Daily Only

Initial V2 Streak Challenges are **daily only**. There is no weekly mode in V2. The Streak measures daily consistency across a configured period.

### L.3 Streak Measures Consistency, Not Performance Quantity

A Streak Challenge measures **consistency** — whether the Participant met the daily requirement — not performance quantity. The question is "Did they do it today?" not "How much did they do?"

### L.4 Creator-Configured Daily Requirements

The Challenge creator configures the **daily Activity requirement(s)**. Requirements specify what the Participant must do each day to maintain the Streak.

**Single-Activity example:** Run 1 km every day for 30 days.
**Multi-Activity example:** Sleep 8 hours + Drink 4 litres + Read 10 pages every day for 14 days.

### L.5 Done Semantics

A Participant marks a requirement as **Done** — a self-attestation that the requirement was satisfied for that day.

- **Exceeding the requirement creates no additional Streak credit.** Running 5 km when the requirement is 1 km does not count more than running 1 km. The day is either Complete or not.
- Done is a binary state: the requirement was satisfied or it was not.

### L.6 Multi-Activity Streak

When multiple Activities are configured as daily requirements:

- **ALL configured daily requirements must be Done** for the day to count as Complete.
- If any requirement is not Done, the day is not Complete.
- Partial completion (some requirements Done, others not) does not count as a Complete day.

### L.7 Daily States

Each Challenge day has one of three states:

| State | Description |
|-------|-------------|
| **Pending** | The day is in progress; the Participant has not yet marked all requirements Done |
| **Complete** | All configured daily requirements are marked Done |
| **Missed** | The day closed without all requirements being marked Done |

### L.8 No Ordinary Late-Logging Grace Period

There is **no ordinary late-logging grace period** for Streak Challenges. The Participant must mark Done **during the applicable Challenge day**. Once the day closes, it closes.

This preserves the integrity of the daily consistency measure. A grace period would undermine the Streak's meaning.

### L.9 Missed Day Resets Current Streak

When a day closes without all requirements being Done:

- The day is marked **Missed**.
- The **Current Streak resets to 0**.
- The Participant **remains in the Challenge** — they are not removed or disqualified.
- The next completed day begins a **new Current Streak of 1**.

Missing a day is not failure. It resets the current consecutive count but does not end participation.

### L.10 Prior Streak History Preserved

When a Streak resets:

- **Best Streak** (the longest uninterrupted sequence achieved) is preserved.
- **Completed days** history is preserved.
- The reset affects only the Current Streak, not the historical record.

### L.11 One Governing Challenge Timezone

A Streak Challenge operates under **one governing Challenge timezone**. This timezone is set at Challenge creation and governs the day boundary for all Participants.

- **Device timezone changes must not shift the Challenge-day boundary.** If a Participant travels across timezones, the Challenge day boundary remains fixed to the governing timezone.
- This ensures consistency and prevents timezone manipulation from affecting Streak outcomes.

### L.12 Late Joining

**Late joining is allowed** where Challenge-specific eligibility permits. A Member may join a Streak Challenge after it has started, subject to eligibility rules.

**Late joining does NOT change the denominator:**

- The full configured Challenge period remains the denominator for result calculation.
- Example: A 30-day Challenge. A Member joins on Day 7. They complete every remaining day (Days 7–30 = 24 days). Their result is **24/30**, not 24/24.
- The denominator reflects the full Challenge period, not the personalized join-to-end window.

This ensures that Streak results are comparable across Participants and that late joining does not inflate the apparent achievement.

### L.13 No Streak Leaderboard

There is **no Streak leaderboard** in V2. A Streak Challenge is a **personal competition with oneself**. Participants track their own consistency; they are not ranked against other Participants.

Results are personal:

- **Days Completed** — how many Challenge days were Complete
- **Best Streak** — the longest uninterrupted sequence achieved
- **Current/Final Streak** — the Current Streak at the time of viewing (or the Final Streak when the Challenge ends)

### L.14 Challenge Closure

The Streak Challenge **closes when the configured period ends**. There is no early closure, no automatic extension, no carry-over.

### L.15 No Auto-Extension; Run Again = New Challenge

- **No auto-extension** — the Challenge ends when the period ends.
- **Run Again** creates a new Challenge with a new identity, lifecycle, participation, and progress (see §I.5).
- **No carry-over** — Streak history from the original Challenge does not carry over to the new Challenge.

### L.16 Open-Day Editing

While a Challenge day remains open (i.e., the day has not yet closed in the governing timezone):

- The Participant may edit their Done markings.
- Editing is permitted as the Participant refines their self-report.

Once the day closes:

- **Ordinary editing closes.** The day's state is fixed.
- Corrections are possible only through governed correction procedures (subject to ACT-04).

### L.17 Calculation Schedule — Streak

The calculation schedule for Streak Challenges is:

1. **Daily requirement:** Creator-configured Activity requirement per Challenge day.
2. **Multi-Activity ALL requirement:** All configured daily requirements must be Done for the day to count as Complete.
3. **Done semantics:** Marking Done = self-attestation of satisfaction; exceeding creates no extra credit.
4. **Governing timezone:** One Challenge timezone governs; device timezone must not shift the day boundary.
5. **Late joining:** Allowed where eligible; does not redefine or shorten the Challenge period.
6. **Denominator:** Full configured Challenge period (not personalized from join date).
7. **Missed-day reset:** Day closes without all Done → Current Streak = 0.
8. **Days Completed:** Count of completed Challenge days against the full period.
9. **Current Streak:** Consecutive completed days currently maintained.
10. **Best Streak:** Longest uninterrupted sequence achieved.
11. **Finalization:** Challenge period ends → Final Streak = last uninterrupted sequence.
12. **Correction:** A legitimate governed correction triggers recalculation where applicable.

---

## M. Calculation and Derived Truth Model

### M.1 Core Principle

Tiizi calculates **what Participants actually achieved**. Derived Truth is produced from records applicable to that specific Challenge. It is not an estimate, not a projection, not a label — it is a calculation from the evidence that exists.

### M.2 Derived Truth Lifecycle

- **Current Derived Truth** — produced while a Challenge is Active. It reflects the current state of records and may change as new Activity is logged or corrections are applied.
- **Final Derived Truth** — established at the Challenge's ending boundary. It is the definitive calculation for that Challenge.

### M.3 Automatic Recalculation

Derived Truth is **automatically recalculated** when a valid underlying record changes. If a new Activity record is added, if an existing record is modified through a legitimate correction, or if a record is removed through a legitimate correction, the Derived Truth updates accordingly.

### M.4 Corrections and Recalculation

Corrections follow governed procedures:

- A **legitimate governed correction** triggers recalculation of affected Derived Truth.
- Corrections are not manual rewrites of Derived Truth — they are changes to the underlying records that cause Derived Truth to recalculate.
- Authority and procedures for corrections remain subject to **ACT-03** (Verification Authority) and **ACT-04** (Correction Authority), which are preserved deferrals.

### M.5 Historical Intelligibility

When a correction occurs:

- The correction is **attributable** — it is clear what changed and why.
- The correction is **historically intelligible** — the sequence from original record to correction to recalculated result is traceable.
- There is no silent rewrite. The history shows the original, the correction, and the recalculated result.

### M.6 No Automatic Failure Labels

Tiizi does not automatically apply failure labels. When a Goal is not reached, the actual result is reported (e.g., 873/1000 = 87.3%). When a target is not reached in a Competitive Challenge, the actual progress is reported without a "failed" designation. Tiizi reports truth; it does not judge it.

### M.7 Challenge-Specific Records Only

Derived Truth is calculated from **Challenge-specific records only**. There is no cross-Challenge Activity reuse. Each Challenge has its own records, its own calculation, its own Derived Truth.

### M.8 Calculation Schedule — Collective

1. **Eligible contribution:** Each qualifying Participant contribution is added to the common total.
2. **Accumulation:** Collective Progress = sum of all qualifying Challenge-specific contributions.
3. **Goal crossing:** The cumulative qualifying progress first reaches or exceeds the configured Goal.
4. **Full crossing contribution:** The contribution crossing the Goal is recorded in full (not truncated).
5. **>100% result:** The result may exceed 100% and is displayed truthfully.
6. **Completion boundary:** When the Goal is reached, ordinary new logging closes.
7. **Expiry:** If the period ends before the Goal is reached, the actual result and percentage are reported.
8. **Extension boundary:** Extension is only permitted while Active, never after end; extension preserves identity.
9. **Correction/recalculation:** A legitimate governed correction triggers recalculation of affected Derived Truth.

### M.9 Calculation Schedule — Competitive

1. **Participant progress:** Each Participant's individual Challenge-specific progress total is maintained.
2. **Target completion:** A Participant's qualifying cumulative progress reaches or exceeds the configured target.
3. **Finishing position:** Determined by governed target-completion order (earlier = higher).
4. **Shared/tied position:** Identical completion points share position; no artificial tie-breaker.
5. **Non-completer outcome:** No finishing position; actual progress visible; never labelled failed.
6. **Challenge closure:** At the configured end of the competitive window.
7. **Correction/recalculation:** A legitimate governed correction triggers recalculation of position as Derived Truth.

### M.10 Calculation Schedule — Streak

1. **Daily requirement:** Creator-configured Activity requirement per Challenge day.
2. **Multi-Activity ALL requirement:** All configured daily requirements must be Done for the day to count as Complete.
3. **Done semantics:** Marking Done = self-attestation of satisfaction; exceeding creates no extra credit.
4. **Governing timezone:** One Challenge timezone governs; device timezone must not shift the day boundary.
5. **Late joining:** Allowed where eligible; does not redefine or shorten the Challenge period.
6. **Denominator:** Full configured Challenge period (not personalized from join date).
7. **Missed-day reset:** Day closes without all Done → Current Streak = 0.
8. **Days Completed:** Count of completed Challenge days against the full period.
9. **Current Streak:** Consecutive completed days currently maintained.
10. **Best Streak:** Longest uninterrupted sequence achieved.
11. **Finalization:** Challenge period ends → Final Streak = last uninterrupted sequence.
12. **Correction:** A legitimate governed correction triggers recalculation where applicable.

---

## N. Challenge History, Run Again, and Correction Effects

### N.1 Historical Intelligibility of Ended Challenges

Ended Challenges remain **historically intelligible**. Their records are preserved in a form that can be understood, audited, and traced. An ended Challenge is not deleted, archived into obscurity, or rendered incomprehensible.

### N.2 What Historical Records Preserve

Historical records preserve:

- **Challenge identity** — the Challenge's unique identifier and name
- **Configuration** — the Challenge's configuration at the time it ended (type, Goal/target, Activity, period, etc.)
- **Participation** — who participated, when they joined, when they exited
- **Outcomes** — Final Derived Truth, finishing positions (Competitive), Streak results, Collective progress

### N.3 Correction Effects on History

When a legitimate governed correction is applied to an ended Challenge:

- The correction is **attributable** — it is clear what changed and why.
- The correction is **historically intelligible** — the sequence from original to correction to recalculated result is traceable.
- There is **no silent rewrite** — the history shows the change.

### N.4 Run Again Creates Independent History

Run Again creates a **new Challenge** with:

- **New Challenge identity** — distinct from the original
- **New lifecycle** — independent lifecycle states
- **New participation** — Members must join again
- **New progress** — starts from zero

The original Challenge history remains intact. Run Again does not modify, extend, or overwrite the original.

### N.5 Template Basis

An ended Challenge may serve as a **Template** for a new Challenge. The Template captures configuration; the new Challenge is independent. The Template basis is noted in the new Challenge's history (e.g., "created from Template based on Challenge X") but the two Challenges have separate identities, lifecycles, and histories.

---

## O. Home Experience

### O.1 Home Is NOT a Feed

**Home is not a Feed.** It is an **accountability and operational dashboard**. The Home screen answers the question: **"What matters to me right now?"**

This is a fundamental product distinction. Home is not a chronological stream of social posts. It is a personalised operational view that surfaces what the Member needs to attend to.

### O.2 Home Priorities

Home surfaces content in the following priority order:

1. **What the Member needs to do** — outstanding Streak actions, pending daily requirements, imminent deadlines
2. **Active Challenge state and progress** — current Collective progress, Competitive standing, Streak status
3. **Results and milestones** — recently achieved results, Goal completions, personal milestones
4. **Meaningful Group/Challenge developments** — new Challenges in joined Groups, Challenge starting/ending, important announcements
5. **Discovery opportunities** — recommended Groups or Challenges based on interests

### O.3 Home Content

Home content includes:

- Active Challenges (with current state and progress)
- Today's Streak actions (what needs to be Done today)
- Current Streak count
- Personal Collective contribution (how much the Member has contributed)
- Competitive progress (how close to target, finishing position if applicable)
- Challenges starting or ending soon
- Recent results (personal and Group-level)
- Recognition received
- Relevant updates from Groups
- Recommendations (Groups, Challenges)

### O.4 Operational and Personalised Cards

Home content is presented as **operational and personalised cards**, not social posts. Each card serves an accountability or operational purpose. Cards are personalised based on the Member's active Challenges, Group memberships, and interests.

### O.5 Home Does Not Duplicate Group Feed

Home does not duplicate the Group Feed. The Group Feed answers "What is happening in this Group?" (see Section P). Home answers "What matters to me right now?" These are different questions with different content.

---

## P. Group Feed

### P.1 Single Community Stream per Group

Each Group has a **single community stream** — the Group Feed. The Feed answers the question: **"What is happening in this Group?"**

### P.2 Two Content Sources

The Group Feed draws from two content sources:

1. **Meaningful automatic Group/Challenge events** — system-generated entries for significant occurrences
2. **Explicit Share-to-Group by Members** — voluntary sharing of personal achievements

### P.3 Automatic Events

Automatic events published to the Group Feed include:

- Challenge created, started, or ended
- Valid extension of a Challenge
- Collective milestone reached or Goal achieved
- Final results of a Challenge
- Cause activated or closing declared (see Section W)
- Important Group announcements (from Steward)

These are meaningful events that the community benefits from knowing about.

### P.4 Routine Personal Activity Is NOT Automatically Published

**Routine personal Activity is NOT automatically published to the Group Feed.** When a Member logs an Activity in a Challenge, that log does not automatically appear in the Feed. This is a deliberate product choice to prevent Feed noise and protect Member privacy.

### P.5 Personal Activity Enters Feed Only Through Explicit Share

**Personal Activity, milestones, and Recognition enter the Group Feed ONLY through explicit Share to Group** (see Section R). The Member must choose to share. The default is not shared.

### P.6 System Exhaust Must Not Become Feed Content

The Feed is curated. **System exhaust must not become Feed content.** Not every database event, state change, or system occurrence deserves a Feed entry. The Feed is a meaningful community stream, not a chronological dump of everything that happens in the system.

### P.7 Milestone Aggregation

Where many similar events occur (e.g., 18 Members completed today's hydration Streak), the Feed may **aggregate** them into a single entry (e.g., "18 Members completed today's hydration Streak"). Aggregation prevents Feed flooding while still recognising community achievement.

### P.8 Feed Does Not Expand Visibility

The Feed **does not expand visibility**. A Feed entry is visible only to those who already have visibility into the underlying Group/Challenge. If a Challenge is visible only to Group Members, the Feed entry about that Challenge is visible only to Group Members. The Feed respects underlying visibility boundaries (see Section X).

---

## Q. Kudos / Reactions

### Q.1 Purpose

Kudos (or Reactions) are **lightweight community encouragement**. They express: "I saw this. Well done. Keep going." They are a social gesture, not a governance mechanism.

### Q.2 What Kudos Do NOT Do

Kudos:

- Do **NOT verify Activity** — a Kudos does not confirm that the Activity actually occurred
- Do **NOT affect calculations** — Kudos do not enter into Derived Truth calculations
- Do **NOT affect completion** — Kudos do not contribute to Goal progress or target completion
- Do **NOT affect finishing order** — Kudos do not influence Competitive finishing positions
- Do **NOT preserve Streaks** — Kudos do not count as Streak completion
- Do **NOT create or strengthen Recognition** — Kudos are Community Acknowledgement, not Platform Recognition

### Q.3 Must NOT Become Popularity Mechanics

Kudos must not become **popularity mechanics**. The system is designed to prevent Kudos from functioning as a social scoring system.

### Q.4 Counts Not Used for Ranking

Kudos counts are **not used for**:

- Ranking (within Challenges or Groups)
- Recommendation (influencing what Tiizi recommends)
- Status (granting elevated platform status)
- Influence (affecting governance or visibility)

Kudos are encouragement, not currency.

---

## R. Sharing

### R.1 Share to Group

**Share to Group** is a separate voluntary act that occurs after an Activity log, milestone, Streak result, Competitive finish, or Recognition. The Member chooses to share their achievement with their Group.

**Default is NOT shared.** The Member must explicitly choose to share. Sharing is opt-in, not opt-out.

### R.2 External Sharing

**External sharing** is supported where permitted by Platform Policy and visibility rules. Members may share achievements outside Tiizi (e.g., to social media) where the platform supports it.

### R.3 Share to Group and External Share Are Independent

Share to Group and external Share are **independent acts**. Sharing to a Group does not automatically share externally. Sharing externally does not automatically share to the Group. Each is a separate voluntary choice.

### R.4 Visibility Enforcement

Sharing **must respect** Group/Challenge visibility, privacy, and consent boundaries:

- If a Group is Private, sharing from that Group must not expose Group content to non-Members.
- If a Challenge has restricted visibility, sharing must not bypass those restrictions.
- Consent of other affected Members must be respected.

**No visibility bypass.** Sharing cannot be used to circumvent visibility controls.

### R.5 Recognition and Sharing Are Separate

Recognition (Platform Recognition) and sharing are **separate mechanisms**. A Member may receive Recognition without sharing it. A Member may share an achievement without receiving Recognition. They are independent.

---

## S. Discovery

### S.1 Discoverable Groups

**Discoverable Groups** (Public, Authenticated-discoverable visibility classes) are browsable by eligible Members. Discovery information includes:

- Group name, description, purpose
- Group image
- Charter (or summary)
- Member count
- Active Challenges (subject to Challenge visibility)

Private Groups are not discoverable. They are visible only to Group Members.

### S.2 Discoverable Challenges

Challenges are discoverable through:

- **Group pages** — Group Members may browse active Challenges within their Groups
- **Home recommendations** — Tiizi may recommend Challenges based on Member interests, Group memberships, Activity categories
- **Browse/search** — discoverable Challenges may appear in search results
- **Interests and categories** — Challenges may be categorised by Activity type, Challenge type, or other attributes

### S.3 Discovery Does NOT Create Membership or Participation

Discovery is informational. Browsing a Group or Challenge does not create Membership or Participation. The Member must take affirmative action to join a Group or participate in a Challenge.

### S.4 Recommendation Is Not Endorsement

Tiizi may recommend Groups or Challenges based on Member interests and behaviour. **Recommendation is not endorsement.** Tiizi does not vouch for the quality, safety, or appropriateness of any Group or Challenge. Recommendation is a navigation aid, not a quality signal.

### S.5 Initial Personalisation

Initial personalisation of recommendations may use:

- Group memberships (what Groups the Member belongs to)
- Interests (what Activity categories the Member has expressed interest in)
- Activity categories (what types of Activity the Member participates in)

Personalisation evolves as Tiizi learns more about the Member's behaviour and preferences.

---

## T. Notifications

### T.1 Purpose

Notifications **direct Member attention to timely and meaningful matters**. They are not a duplicate Feed. Notifications answer: "Is there something I need to attend to right now?"

### T.2 Notification Classes

| Class | Description | Examples |
|-------|-------------|---------|
| **Action** | Outstanding action the Member needs to take | Streak action pending before day closes |
| **Challenge** | Challenge lifecycle events | Challenge starting, ending, Goal reached, final results |
| **Group** | Group developments | New Challenge in a joined Group, Group announcement |
| **Social** | Community encouragement | Kudos received |
| **Administrative** | Platform or Cause administration | Cause review status, Cause approved, Cause closing |

### T.3 Notification Restraint

**Not every Feed item triggers a push notification.** Notifications are reserved for actions, time-sensitive matters, and milestones. The notification threshold is higher than the Feed threshold.

### T.4 Avoid Duplication

A single event may update multiple surfaces (Home, Feed, Notifications). Where possible, Tiizi avoids redundant alerts. If the Member is already attending to the relevant surface, a duplicate notification is unnecessary.

### T.5 Streak Reminders

Streak Challenges may generate **reminders before the day closes** — prompting the Member to mark their daily requirement Done if they have not yet done so.

- Reminders are notifications, not Challenge truth.
- A reminder does not alter the Challenge day boundary or the governing timezone.
- A reminder does not extend the day or create a grace period.

### T.6 Competitive Notification Restraint

Competitive Challenges do not generate **continuous leaderboard-change notifications**. Finishing position changes are not notification-worthy on their own. Notifications for Competitive Challenges are reserved for:

- Challenge starting
- Personal target approaching or reached
- Challenge ending / final results

### T.7 Cause Notifications

Social Cause notifications (see Section W) include:

- Cause review status (submitted, under review)
- Cause approved and activated
- Cause closing declaration

### T.8 No Contribution Pressure

**Support Tiizi must not become nagware.** Notifications about Support Tiizi or Social Cause contributions are restrained. Tiizi does not pressure Members to contribute financially. Support is voluntary and the notification pattern reflects that.

---

## U. Recognition & Achievement Model

### U.1 Three Distinct Layers

Tiizi's recognition model has three distinct layers:

1. **Challenge Result** — the truthful outcome of a Challenge (Derived Truth)
2. **Platform Recognition** — issued when governed qualification conditions are satisfied
3. **Community Acknowledgement** — voluntary social encouragement (Kudos)

These layers are distinct and do not substitute for each other.

### U.2 Derived Truth Precedes Recognition

**Derived Truth precedes Recognition.** Recognition is issued based on what Participants actually achieved, not on what they intended or claimed. If Derived Truth changes, Recognition follows.

### U.3 Challenge Result Is Not Automatically an Award

A Challenge Result is a **truthful outcome**, not automatically an award. Completing a Challenge, reaching a Goal, or achieving a Streak is a factual result. Platform Recognition may follow if qualification conditions are satisfied, but the Result itself is not the Recognition.

### U.4 Platform Recognition

**Platform Recognition** is issued when governed qualification conditions are satisfied. Qualification conditions are defined by Platform Policy and are type-specific.

**MOT-01 (Recognition Authority) is preserved.** The authority to define qualification conditions, issue Recognition, and withdraw invalid Recognition remains subject to MOT-01 resolution.

### U.5 Community Acknowledgement

**Community Acknowledgement** is voluntary social encouragement (Kudos). It does not alter Derived Truth, does not affect calculations, and does not constitute Platform Recognition.

### U.6 Collective Recognition

For Collective Challenges:

- Recognition is based on **shared Goal achievement**.
- Participants receive recognition of their **relationship to the shared achievement** — they contributed to a collective result.
- A Participant is **not credited with the entire Group result** — their individual contribution is recognised separately.
- **Top contributor status is secondary** — the primary recognition is for the collective achievement, not for individual ranking.

### U.7 Competitive Recognition

For Competitive Challenges:

- Recognition is based on **target completion + finishing position**.
- **1st, 2nd, 3rd** positions receive stronger visual prominence.
- **Non-completers** retain their actual progress, receive no artificial position, and are not labelled as failed.

### U.8 Streak Recognition

For Streak Challenges:

- Recognition is based on **personal consistency**.
- Recognised metrics: **Days Completed, Best Streak, Final Streak**.
- **No leaderboard** — Streak Recognition is personal, not comparative.
- **Full-period completion is meaningful** — completing all days of a Streak Challenge is a significant achievement.

### U.9 No Broad Badge/XP/Level System in Initial V2

Tiizi V2 implements a **lean recognition model**. There is no broad badge/XP/level system in initial V2. Recognition is Challenge-type-specific and tied to truthful outcomes, not to accumulated points or gamification layers.

### U.10 Milestone Badges Deferred

**Milestone badges are deferred.** Specific milestone badges (e.g., 7-day, 14-day, 21-day, 30-day Streak badges) are not required in initial V2. They may be introduced in future iterations if the Founder determines they serve the product purpose.

### U.11 Challenge History ≠ Achievement Showcase

Challenge History is a historical record, not an Achievement showcase. History preserves what happened; it is not curated for display purposes. The distinction matters: History is governed by preservation and intelligibility principles; Achievement showcases would be governed by presentation and marketing principles.

### U.12 Recognition Follows Corrected Derived Truth

When Derived Truth is recalculated due to a legitimate governed correction:

- **Recognition follows the corrected Derived Truth.**
- **Invalid earlier Recognition must not remain current** after a legitimate correction.
- If a correction removes the basis for a Recognition, the Recognition is withdrawn.

### U.13 Platform Policy Governs Qualification

Platform Policy governs Recognition qualification conditions. Challenge-type logic (e.g., how Collective progress is calculated, how Competitive finishing position is determined) applies, but the Challenge-type logic does not become a constitutional Authority. It is product logic that serves the governance framework, not a substitute for it.

### U.14 MOT-01 Preserved

**MOT-01 (Recognition Authority) is preserved.** This document does not silently resolve the question of who has authority to define, issue, and withdraw Recognition. That authority remains subject to MOT-01 resolution through the governed process.

---

## V. Support Tiizi

### V.1 Tiizi Remains Free

Tiizi remains **free to use**. There is no subscription fee for ordinary participation. No Member is required to pay to participate in Challenges, join Groups, or access core platform features.

### V.2 Support Tiizi Is Voluntary

**Support Tiizi** is a voluntary contribution mechanism. Members may choose to support Tiizi financially, but they are not required to do so. Support is separate from participation.

### V.3 Permanent Profile CTA

Support Tiizi is represented by a **permanent Profile CTA** (Call to Action) that is independent of Groups and Challenges. The CTA is always available to Members who wish to contribute, regardless of their Challenge or Group status.

### V.4 Challenge-Level Support

At the Challenge level, Support Tiizi is:

- **Optional** — the Challenge creator may enable or disable it
- **Off by default** — the creator must actively choose to enable it
- The creator may suggest a specific amount or leave the contribution amount open

### V.5 Must NOT Become a Participation Fee

Support Tiizi **must not become a participation fee or eligibility condition**:

- Payment → eligibility is **prohibited**
- A Member's ability to participate in a Challenge must not depend on whether they have contributed financially
- Support Tiizi and Challenge Participation are independent

### V.6 Tiizi-Controlled Destination

Support Tiizi contributions go to a **Tiizi-controlled destination** (with payment provider downstream). Tiizi controls where the funds go; the payment provider processes the transaction.

---

## W. Social Causes

### W.1 Optional Capability, NOT a Challenge Type

**Social Causes are an optional capability, NOT a Challenge Type.** A Social Cause is an add-on to a Challenge (Collective, Competitive, or Streak), not a fourth Challenge type. The Challenge type determines the calculation and completion rules; the Social Cause adds a fundraising dimension.

### W.2 Off by Default

Social Causes are **off by default**. The Challenge creator must actively choose to enable a Social Cause for their Challenge.

### W.3 Creator Configuration

When enabling a Social Cause, the creator provides:

- **Cause title** — name of the cause
- **Description** — what the cause is about
- **Beneficiary** — who benefits from the fundraising
- **Reason** — why this cause is being supported
- **Fundraising Goal** — the target amount to raise
- **Payment destination** — where the funds will go (initially: direct external payment destination)

### W.4 Platform Review Required

**Platform review is required before fundraising activation.** The Social Cause follows a lifecycle:

1. **Draft** — creator configures the cause
2. **Cause Review** — Platform reviews the cause (title, description, beneficiary, destination)
3. **Approved** — Platform approves the cause
4. **Active** — fundraising is activated within the Challenge

**Ordinary Challenges do NOT require Platform approval.** Only Challenges with Social Causes undergo Platform review.

### W.5 Support Tiizi Does Not Trigger Challenge Approval

Enabling Support Tiizi (see Section V) does **not** trigger Challenge approval. Support Tiizi and Social Causes are separate mechanisms with separate approval requirements.

### W.6 Voluntary Contributions

Social Cause contributions are **voluntary**:

- A Member may fully participate in the Challenge without contributing to the Social Cause
- Contribution to the Social Cause does not affect Challenge participation, progress, or Recognition
- Financial contribution and Challenge Activity are independent

### W.7 Separate Fundraising Goal

The Social Cause has a **separate fundraising Goal** distinct from the Challenge Activity Goal:

- **Challenge Activity Goal** — the quantitative target for the Challenge (e.g., 1000 km)
- **Fundraising Goal** — the monetary target for the Social Cause (e.g., $5,000)

The two goals are independent. Reaching one does not affect the other.

### W.8 Initial Direct External Payment Destination

In initial V2, Social Cause funds go to a **direct external payment destination** (e.g., the beneficiary's payment account). Tiizi does not custody or escrow Social Cause funds.

### W.9 Tiizi Custody/Escrow NOT Authorized

**Tiizi custody or escrow of Social Cause funds is NOT authorized.** Tiizi does not hold, manage, or distribute Social Cause funds. Funds flow directly from contributors to the designated external destination.

### W.10 Participant Self-Report Is NOT Verified Payment

A Participant's self-report of a financial contribution is **NOT verified payment**. Self-reporting that one has contributed does not constitute evidence of actual payment.

### W.11 Community-Reported Label

The total of self-reported contributions must be labelled **"community-reported"** — it is **NEVER** labelled "Amount Raised" without reliable payment evidence. The distinction between self-report and verified payment is critical for transparency.

### W.12 Creator Closing Declaration

The Challenge creator may make a **closing declaration** about the Social Cause (e.g., "We raised $X and it was delivered to Y"). This declaration is recorded but is not automatically verified.

### W.13 Discrepancy Does Not Prove Misconduct

A discrepancy between the community-reported total and the creator-declared total **does not prove misconduct**. Discrepancies may arise from various causes (reporting errors, timing differences, etc.). Confirmed payment requires reliable transaction evidence, not self-report.

### W.14 Financial Contribution Never Affects Challenge Truth

**Financial contribution NEVER changes Challenge truth or Recognition.** Whether a Member contributes to a Social Cause has no effect on their Challenge progress, Derived Truth, finishing position, Streak, or Recognition.

### W.15 Legal/Regulatory/Fundraising Matters Downstream

Legal, regulatory, and fundraising compliance matters are **downstream** of this product definition. This document establishes the product model; legal compliance (fundraising registration, tax treatment, fraud prevention) is addressed in later stages.

---

## X. Privacy, Visibility, and Consent Boundaries

### X.1 Visibility Follows Approved Classes

Visibility follows the **approved visibility classes** per EOG-E1-01 §§30-32:

- Public
- Authenticated-discoverable
- Shared-group
- Private
- Privileged-operational

These classes apply to Groups, Challenges, and derived content (Feed, notifications, sharing).

### X.2 Profile/Evidence Protection

Member profiles and evidence (Activity records) are protected by visibility rules. A Member's profile and Activity records are visible only to those with appropriate visibility access.

### X.3 Consent and Minimum-Necessary Access

Tiizi operates on **consent and minimum-necessary access** principles:

- Members consent to data collection and sharing through their participation choices
- Access to Member data is limited to what is necessary for the relevant function
- Visibility controls enforce minimum-necessary access

### X.4 Privacy Before Convenience

When privacy and convenience conflict, **privacy prevails**. Tiizi does not sacrifice Member privacy for the sake of easier sharing, broader discovery, or simpler implementation.

### X.5 Underlying Visibility Governs All Derived Presentation

**Underlying visibility governs ALL derived presentation and sharing.** If a Challenge is visible only to Group Members, then:

- Feed entries about that Challenge are visible only to Group Members
- Notifications about that Challenge go only to eligible recipients
- Sharing from that Challenge respects the underlying visibility

Visibility is not determined at the presentation layer; it is inherited from the source.

### X.6 Feed Does Not Expand Visibility

The Feed **does not expand visibility** (see §P.8). A Feed entry is visible only to those who already have visibility into the underlying content.

### X.7 Ownership/Authorship ≠ Unrestricted Access

The creator of a Group or Challenge does not gain unrestricted access to other Members' data through their authorship. Authorship grants governance authority over the Group/Challenge configuration, not access to other Members' private information.

### X.8 Withdrawal Effect Respected

When a Member withdraws from a Group or Challenge, the **withdrawal effect is respected**:

- The Member's visibility access is reduced to what is appropriate for a non-Participant
- Historical records remain (for historical intelligibility) but the withdrawn Member's access to the Group/Challenge is curtailed
- The withdrawal is reflected in visibility calculations

---

## Y. Logical Domain Model and Principal Relationships

### Y.1 Core Entities and Relationships

The following core entities and relationships derive from the Constitutional Ontology and CGP-04:

| Relationship | Description |
|-------------|-------------|
| **Tiizi Member → Group Membership** | A Member may belong to zero or more Groups. Membership is a distinct relationship from Platform Membership. |
| **Group → Challenge** | Every Challenge belongs to exactly one Group. A Group may host zero or more Challenges. |
| **Group → Accountable Steward** | Every Group has exactly one Accountable Steward at a time (per EOG-E1-01 §4). |
| **Group Member → Challenge Participation** | A Group Member may participate in zero or more Challenges within their Group. Participation is voluntary and distinct from Group Membership. |
| **Challenge → Challenge Type** | Every Challenge has exactly one type: Collective, Competitive, or Streak. |
| **Challenge → Canonical Activity** | A Challenge references one or more canonical Activities. The Challenge references Knowledge, it does not redefine it. |
| **Challenge Participant → Challenge-Specific Activity Record** | A Participant logs Activity within the context of a specific Challenge. Each record is Challenge-specific. |
| **Challenge-Specific Activity Record → Accepted Activity Event** | An Activity Record may be linked to an Accepted Activity Event (via Acceptance Authority — subject to ACT-03). |
| **Accepted Activity Event → Derived Truth** | Accepted Activity Events feed into Derived Truth calculation (via Calculation Authority). |
| **Derived Truth → Platform Recognition** | Derived Truth may give rise to Platform Recognition (subject to MOT-01). |
| **Template → Challenge** | A Template may be adopted to create a new Challenge. Each adoption creates a distinct Challenge. |

### Y.2 Member Activity Event Independence

A **Member Activity Event** exists independently of any Challenge. It represents the Member's report of real-world Activity. Challenges consume eligible Activity Events through Challenge-specific records, but the underlying Member Activity Event is not owned by any Challenge.

### Y.3 Challenge-Specific Logging Boundary

**One Activity Event logged in Challenge A does NOT automatically exist in Challenge B.** Each Challenge maintains its own Activity records. Cross-Challenge Activity reuse does not occur in V2 (see Section G).

### Y.4 Knowledge Domain

The Knowledge domain (Activity Library, categories, variants, metrics, units) is governed by **EKG-01**. The Knowledge Authority is the Founder (per EKG-01). This document describes the structural relationship between Knowledge and Challenges; the content of the Activity Library is governed knowledge.

### Y.5 Deferred Authorities

The following authorities are **deferred** and not resolved by this document:

- **ACT-03 — Verification Authority:** How Activity Events are verified/accepted
- **ACT-04 — Correction Authority:** How corrections are requested, approved, and applied
- **MOT-01 — Recognition Authority:** How Recognition qualification conditions are defined, who issues Recognition, and how invalid Recognition is withdrawn

These deferrals are explicit and preserved.

---

## Z. Cross-Domain Invariants

The following invariants hold across the entire Tiizi V2 product model. They are not type-specific; they apply to all Challenge types and all product surfaces.

1. **Every Challenge belongs to exactly one Group.** There are no Group-independent Challenges.
2. **Group Membership ≠ Challenge Participation.** Joining a Group does not enroll in Challenges. Participating in a Challenge does not confer Group governance.
3. **Challenge Activity is Challenge-specific.** No automatic cross-Challenge Activity reuse. One log in Challenge A does not count in Challenge B.
4. **Derived Truth precedes Recognition.** Recognition is based on calculated truth, not on self-report or intention.
5. **Financial contribution never affects Challenge truth or Recognition.** Support Tiizi and Social Cause contributions are independent of Challenge outcomes.
6. **Feed/sharing does not expand visibility.** Underlying visibility governs all derived presentation.
7. **Template ≠ Challenge.** A Template is a starting point, not a live Challenge.
8. **Extension ≠ Repetition.** Extension preserves identity; repetition (Run Again) creates a new Challenge.
9. **Community Acknowledgement ≠ Platform Recognition.** Kudos are social encouragement; Recognition is governed issuance.
10. **Challenge Engine is a product concept, not a Platform Authority** (per EOG-E1-01 §35). The Challenge Engine facilitates Challenge operation; it does not exercise governance authority.
11. **Platform governance supersedes Group Charter.** Where Charter conflicts with Platform Policy, Platform Policy controls.
12. **Self-accountability: Tiizi does not certify real-world Activity.** Members self-report; Tiizi calculates what they report. Tiizi does not verify, certify, or guarantee that reported Activity actually occurred.

---

## AA. Explicit Downstream Deferrals

This document does NOT resolve or authorize the following matters. They are explicitly deferred to later stages or to governed resolution processes:

### AA.1 Governance Authority Deferrals

- **ACT-03 — Verification Authority:** How Activity Events are verified or accepted
- **ACT-04 — Correction Authority and procedures:** How corrections are requested, approved, and applied
- **MOT-01 — Recognition Authority and qualification:** Who defines Recognition qualification conditions, who issues Recognition, how invalid Recognition is withdrawn
- **Rewards — implementation, custody, entitlement, fulfilment, payment:** Whether and how material rewards are distributed

### AA.2 Technical Deferrals

- **Technical IAM/RBAC:** Identity and access management, role-based access control implementation
- **Database schemas / Firestore structure:** Data storage design
- **API contracts:** Interface specifications between system components
- **Payment-provider selection:** Which payment provider(s) to use
- **Deployment/infrastructure:** Hosting, scaling, deployment topology
- **Calculation-service architecture:** How Derived Truth calculation is implemented
- **Technical archival/versioning:** How historical records are archived and versioned
- **Fraud-detection mechanisms:** How fraud is detected and prevented

### AA.3 Product Deferrals

- **Tiizi Social Cause custody/escrow:** Whether Tiizi will ever custody or escrow Social Cause funds (NOT authorized for V2)
- **V1→V2 migration:** How existing V1 data and users transition to V2
- **Exact visibility-field list:** The specific field-level visibility rules (deferred by EOG itself)
- **Canonical notification trigger catalogue:** The exhaustive list of notification triggers (downstream technical)
- **Exact leaderboard UI:** The specific presentation of Competitive finishing positions (downstream presentation)
- **Universal Collective extension cap:** Whether there is a maximum number or duration of Collective Challenge extensions (open product parameter)
- **Streak recurrence beyond daily:** Whether weekly or other recurrence modes will be introduced (not in V2)
- **Weighted/optional multi-Activity Streak requirements:** Whether Streak requirements can be weighted or made optional (not in V2)

### AA.4 Legal and Compliance Deferrals

- **Legal/regulatory/fundraising compliance:** Compliance with fundraising regulations, tax law, consumer protection
- **Detailed due-diligence/dispute/fraud procedures:** Procedures for investigating and resolving Social Cause disputes or fraud allegations

---

## Appendix A: Source Baseline Consolidation Map

This appendix maps each source working baseline to the sections of this document where its substance appears.

| Source Baseline | Primary Sections in This Document |
|----------------|----------------------------------|
| **PRODUCT-MODEL** (6b31bbb8) | B (Core Proposition), C (Member→Group→Challenge), D (Group Model), E (Challenge Foundation), H (Participation), I (Lifecycle), O (Home), P (Feed), Q (Kudos), R (Sharing), S (Discovery), T (Notifications), X (Privacy/Visibility), Y (Domain Model), Z (Invariants) |
| **COLLECTIVE-CHALLENGE** (faa531b5) | J (Collective Challenge Model), M.8 (Collective Calculation Schedule) |
| **COMPETITIVE-CHALLENGE** (71562b85) | K (Competitive Challenge Model), M.9 (Competitive Calculation Schedule) |
| **STREAK-CHALLENGE** (866d56d8) | L (Streak Challenge Model), M.10 (Streak Calculation Schedule) |
| **SHARED-CHALLENGE-EXPERIENCE** (0df5df6d) | G (Challenge-Specific Activity Logging), F (Activity Knowledge relationship), N (History/Run Again/Correction Effects) |
| **LOGICAL-PRODUCT-AND-DOMAIN-MODEL** (02ee9869) | Y (Logical Domain Model), Z (Cross-Domain Invariants) |
| **CALCULATION-AND-DERIVED-TRUTH-MODEL** (aa570df1) | M (Calculation and Derived Truth Model) |
| **RECOGNITION-AND-ACHIEVEMENT-MODEL** (3bf48042) | U (Recognition & Achievement Model) |
| **CONTRIBUTION-AND-CAUSES-FUNCTIONAL-MODEL** (77712c92) | V (Support Tiizi), W (Social Causes) |
| **NOTIFICATIONS-FEED-DISCOVERY-AND-SOCIAL-BEHAVIOUR-MODEL** (80fffeab) | O (Home), P (Group Feed), Q (Kudos), R (Sharing), S (Discovery), T (Notifications) |

**Notes:**

- Some baselines contribute to multiple sections. The table shows primary contributions.
- The PRODUCT-MODEL baseline is the broadest, contributing to the structural and behavioural foundation.
- Reconciliation findings (RECON-001, d5f3baf) are reflected throughout, particularly in Sections G, K, and L.

---

## Appendix B: Superseded Working Positions

This appendix lists working positions from the source baselines that were superseded during the reconciliation process (RECON-001, d5f3baf).

### B.1 Cross-Challenge Activity Reuse (Superseded by Reconciliation F-A-01)

**Earlier position:** Some working baselines implied or stated that one Activity Event could automatically contribute to multiple Challenges. For example, if a Member ran 5 km and was participating in both a Collective running Challenge and a Competitive running Challenge, the single Activity Event would automatically count in both.

**Superseded position:** Challenge Activity is logged within the Challenge in which the Participant intends it to count. A log in Challenge A does not automatically exist in Challenge B. The same real-world Activity may be separately reported in more than one compatible Challenge, but Tiizi does not establish a system relationship between those reports.

**Rationale:** Automatic cross-Challenge reuse creates ambiguity about Participant intent, complicates correction and recalculation, and undermines the principle that Participation is voluntary and deliberate. Challenge-specific logging preserves clarity and accountability.

### B.2 Competitive "Highest Performance" Mode (Superseded by Reconciliation F-B-01, F-B-02)

**Earlier position:** Some working baselines described Competitive Challenges as supporting two modes: (1) race to target, and (2) highest performance (who achieves the most within the competitive window).

**Superseded position:** Initial V2 Competitive = race to configured target only. There is no "Highest Performance" mode in V2.

**Rationale:** The "Highest Performance" mode introduced complexity and risked shifting the Competitive model toward leaderboard mechanics that conflict with the "Community Before Competition" principle. The race-to-target model is simpler, clearer, and more aligned with Tiizi's foundational principles.

### B.3 Weekly Streak Mode (Superseded by Reconciliation F-C-01, F-C-02)

**Earlier position:** Some working baselines described Streak Challenges as supporting both daily and weekly recurrence modes. In weekly mode, the Participant would need to complete the requirement at least once per week to maintain the Streak.

**Superseded position:** Initial V2 Streak = daily only. There is no weekly mode in V2.

**Rationale:** Weekly mode introduced ambiguity about what constitutes a "week" (calendar week? rolling 7-day period? Challenge-defined week?), complicated timezone handling, and diluted the daily consistency message. Daily-only is simpler, clearer, and more aligned with the Streak's purpose of measuring daily consistency.

### B.4 Automatic Failure Labels (Superseded by Reconciliation Consensus)

**Earlier position:** Some working baselines implied or stated that unmet Goals or targets would be labelled as "failures" or "incomplete."

**Superseded position:** Tiizi does not apply automatic failure labels. When a Goal is not reached, the actual result is reported (e.g., 873/1000 = 87.3%). When a target is not reached in a Competitive Challenge, the actual progress is reported without a "failed" designation.

**Rationale:** Failure labels are judgement, not truth. Tiizi reports truth. Members can draw their own conclusions. The platform does not impose negative framing on unmet goals.

### B.5 Non-Completer Finishing Positions (Superseded by Reconciliation F-B-02)

**Earlier position:** Some working baselines assigned finishing positions to all Participants in a Competitive Challenge, including those who did not reach the target (e.g., 4th, 5th place for non-completers).

**Superseded position:** Non-completers receive NO finishing position. Their actual final progress remains visible. They are NEVER labelled as failed or given an artificial position.

**Rationale:** Assigning positions to non-completers implies a ranking that does not exist. If someone did not reach the target, they are not in a "position" — they did not complete the race. Their actual progress is reported truthfully, but they are not ranked.

### B.6 Streak Leaderboard (Superseded by Reconciliation F-C-02)

**Earlier position:** Some working baselines described a Streak leaderboard that ranked Participants by their Streak length or Days Completed.

**Superseded position:** There is no Streak leaderboard in V2. A Streak Challenge is a personal competition with oneself.

**Rationale:** A Streak leaderboard shifts the focus from personal consistency to social comparison, which conflicts with the self-accountability principle. Streaks are personal; they do not need a leaderboard to be meaningful.

---

*End of Document — STAGE F DRAFT — Pending Founder Review*
