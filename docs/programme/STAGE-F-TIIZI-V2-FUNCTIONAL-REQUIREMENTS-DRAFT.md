---
title: "Tiizi V2 — Stage F Functional Requirements"
document_type: "Stage F Functional Requirements — DRAFT"
stage: "Stage F — Product & Technical Translation"
version: "0.1-draft"
date: "2026-09-05"
status: "Stage F Draft — Pending Founder Review"
supersedes_working:
  - "TIIZI-V2-STAGE-F-FUNCTIONAL-REQUIREMENTS-BASELINE-FOUNDER-WORKING-BASELINE-v0.1 (2026-09-04, SHA-256: 1a966fd7)"
authority_basis:
  - "Tiizi Constitutional Ontology & Foundational Product Concepts (Document 00)"
  - "EOG-E1-01 Tiizi Entity & Operational Governance Standard v0.2 (Founder Approved 2026-09-03)"
  - "EKG-01 Tiizi Knowledge Governance Standard v0.1 (Founder Approved 2026-09-02)"
  - "CGP-04 Entity Relationship Allocation Register v0.1 (Founder Approved 2026-09-01)"
  - "Stage F Founder Working Baseline Reconciliation (RECON-001, d5f3baf)"
  - "Stage F Product Definition DRAFT (companion T1 document)"
preserved_deferrals:
  - "ACT-03 — Verification Authority"
  - "ACT-04 — Correction Authority"
  - "MOT-01 — Recognition Authority"
  - "Rewards — implementation/custody/entitlement"
reconciliation_branch: "recon/stage-f-founder-baselines-001"
reconciliation_commit: "d5f3baf"
---

> **DRAFT — This document is a Stage F Draft. It does not authorize implementation.
> All requirements herein remain subject to Founder review and approval before
> becoming controlled Stage F instruments.**

---

# Part 1: Preliminary

---

## §1 Purpose

This document translates the Stage F Product Definition (companion T1 document) and the
reconciled Founder Working Baseline into a controlled set of **testable functional
requirements** for Tiizi V2.

This document:

- carries forward every FR-V2-001 through FR-V2-206 from the Founder Working Baseline;
- applies reconciliation dispositions from RECON-001 (d5f3baf);
- settles formerly open Stage F questions where the Product Definition DRAFT provides
  governed answers;
- introduces additional requirements where reconciliation identified gaps;
- preserves all deferred authority decisions (ACT-03, ACT-04, MOT-01, Rewards).

This document **does not**:

- authorize implementation;
- resolve deferred governance authority;
- specify database design, APIs, infrastructure, or UI;
- select payment providers or reward systems;
- override the companion Stage F Product Definition DRAFT.

---

## §2 Requirement Language

The following terms are used throughout this document:

| Term | Meaning |
|------|---------|
| **MUST** | Required behaviour. Non-negotiable. |
| **MUST NOT** | Prohibited behaviour. Non-negotiable. |
| **SHOULD** | Expected behaviour unless a justified downstream reason requires otherwise. |
| **MAY** | Permitted capability. Not required. |

All functional requirement identifiers use the prefix **FR-V2-**.

Where a requirement has been superseded by reconciliation, the superseding requirement
is identified by cross-reference. Where wording has been aligned to the Product
Definition DRAFT without changing substantive intent, the disposition is recorded as
**ALIGNED WORDING**.

---

## §3 Authority and Dependencies

This DRAFT derives its authority from the following approved governance instruments:

1. **Tiizi Constitutional Ontology & Foundational Product Concepts (Document 00)** —
   foundational product concepts, entity relationships, and constitutional constraints.

2. **EOG-E1-01 Tiizi Entity & Operational Governance Standard v0.2** (Founder Approved
   2026-09-03) — entity definitions, operational governance, and authority allocation.

3. **EKG-01 Tiizi Knowledge Governance Standard v0.1** (Founder Approved 2026-09-02) —
   canonical Knowledge governance, Activity identity, and Template governance.

4. **CGP-04 Entity Relationship Allocation Register v0.1** (Founder Approved
   2026-09-01) — entity relationship allocation and governance boundaries.

5. **Stage F Founder Working Baseline Reconciliation (RECON-001, d5f3baf)** —
   reconciliation of the Founder Working Baseline against the authoritative repository,
   including disposition of formerly open questions.

6. **Stage F Product Definition DRAFT (companion T1 document)** — provides the
   governed product definitions, calculation rules, notification baselines, and
   contribution rules that settle formerly open Stage F questions.

This document is the **T2 controlled requirements translation** of the above instruments.
It does not independently create product authority.

---

## §4 Preserved Deferrals

The following governance authority decisions remain **intentionally unresolved** and are
preserved as deferrals throughout this document. No requirement in this document MUST be
interpreted as resolving any of the following:

| Deferral | Subject | Status |
|----------|---------|--------|
| **ACT-03** | Verification Authority — who or what verifies that real-world Activity occurred as reported | Unresolved. Preserved. |
| **ACT-04** | Correction Authority — who or what governs corrections to accepted Activity or Derived Truth | Unresolved. Preserved. |
| **MOT-01** | Recognition Authority — who or what governs Platform Recognition issuance | Unresolved. Preserved. |
| **Rewards** | Implementation, custody, entitlement, escrow, payout, or fulfilment of Group-defined Challenge rewards | Unresolved. Preserved. |

Requirements FR-V2-077, FR-V2-078, and FR-V2-147 explicitly guard these deferrals
against silent resolution through implementation.

---

# Part 2: Functional Requirements

> **DRAFT — All requirements in this Part are subject to Founder review and approval.**

---

## §5 Core Product Structure

> **Disposition: KEEP all as-is from Founder Working Baseline.**

### FR-V2-001 — Member prerequisite

A person MUST be a Tiizi Member before participating in Tiizi Groups or Challenges.

### FR-V2-002 — Group prerequisite

A Challenge MUST belong to exactly one Group.

### FR-V2-003 — No standalone Challenge

The product MUST NOT permit creation of a Challenge without a Group context.

### FR-V2-004 — Group pathways

A Member MUST be able, subject to applicable rules, to join an existing Group or create
a new Group.

### FR-V2-005 — Challenge pathways

A Group Member MUST be able, subject to applicable rules, to browse/join eligible
Challenges and create Challenges where permitted.

### FR-V2-006 — Relationship distinction

The product MUST preserve the distinction between Tiizi Membership, Group Membership and
Challenge Participation.

---

## §6 Group Creation and Community Governance

> **Disposition: KEEP all as-is from Founder Working Baseline.**

### FR-V2-007 — Group creation

The product MUST provide an authorized pathway for a Member to establish a Group.

### FR-V2-008 — Initial Group stewardship

Group creation MUST establish the applicable initial stewardship/accountability
relationship under approved governance.

### FR-V2-009 — Simple Charter

Group creation SHOULD support a simple Group Charter rather than requiring Members to
draft governance from scratch.

### FR-V2-010 — Prefilled Charter provisions

The Group Charter experience SHOULD provide selectable/prefilled provisions covering
permitted common community rules.

### FR-V2-011 — Custom Charter text

The product MAY allow Groups to add permitted custom Charter text.

### FR-V2-012 — Platform supremacy

Group Charter content MUST remain subordinate to Platform governance and MUST NOT create
prohibited authority.

### FR-V2-013 — Minimal administration

Product design SHOULD avoid unnecessary Group administrative roles and approval layers.

### FR-V2-014 — Honest logging expectations

The Charter capability SHOULD be able to support Group expectations concerning honest
Activity logging.

### FR-V2-015 — Challenge-creation restriction

The Charter/rule capability MUST be able to support a valid Group restriction on who may
create Challenges where governance permits.

---

## §7 Group Discovery and Visibility

> **Disposition: KEEP all as-is from Founder Working Baseline.**

### FR-V2-016 — Governed visibility

Group discovery MUST use the approved visibility-class model.

### FR-V2-017 — No binary collapse

The product MUST NOT silently reduce approved Group visibility to a simple Public/Private
binary where additional governed classes exist.

### FR-V2-018 — Discoverable Groups

A Group classified as discoverable to an authenticated Tiizi Member MUST be capable of
appearing in Group discovery.

### FR-V2-019 — Pre-join information

Where visibility permits, a Member SHOULD be able to view enough Group information to
decide whether to join.

### FR-V2-020 — Private information protection

Group information outside the Member's permitted visibility MUST NOT be exposed through
discovery.

### FR-V2-021 — Discovery is not membership

Viewing or discovering a Group MUST NOT automatically create Group Membership.

---

## §8 Challenge Creation

> **Disposition: KEEP all as-is from Founder Working Baseline.**

### FR-V2-022 — Default creation permission

By default, an ordinary Group Member MUST be permitted to create a Challenge within their
Group.

### FR-V2-023 — Valid Group restriction

Where valid Group rules restrict Challenge creation, the product MUST enforce the
applicable restriction.

### FR-V2-024 — No universal admin-only model

The product MUST NOT impose a universal rule that only Group Admins may create Challenges.

### FR-V2-025 — Challenge creator attribution

Challenge creation MUST be attributable to the creating Member.

### FR-V2-026 — Creator authority boundary

The product MUST NOT infer unlimited or permanent Challenge authority solely from
Challenge authorship.

### FR-V2-027 — Challenge type

Challenge creation MUST require selection of a valid Challenge type.

### FR-V2-028 — Initial Challenge types

The initial V2 product model MUST support Collective, Competitive and Streak Challenge
definitions, subject to repository reconciliation.

---

## §9 Templates

> **Disposition: KEEP all as-is from Founder Working Baseline.**

### FR-V2-029 — Reusable Templates

The product SHOULD support reusable Challenge Templates.

### FR-V2-030 — Template is not Challenge

A Template MUST NOT itself establish a live Challenge.

### FR-V2-031 — Template adoption

A Member using a Template MUST create a new Challenge identity through
adoption/customization.

### FR-V2-032 — Template customization

A Template SHOULD permit valid customization before Challenge creation.

### FR-V2-033 — Template canonical references

Templates MUST reference valid canonical Activities rather than redefine Activity
identity.

### FR-V2-034 — Template configuration

Templates MAY prefill valid targets, durations, frequencies, instructions and other
Challenge settings.

---

## §10 Activity Library and Challenge Configuration

> **Disposition: KEEP all as-is from Founder Working Baseline.**

### FR-V2-035 — Canonical Activity selection

Challenge configuration MUST reference a valid canonical Activity where the Challenge
requires Activity.

### FR-V2-036 — Permitted measurement

Challenge configuration MUST use Metric/Unit combinations permitted for the selected
Activity.

### FR-V2-037 — Challenge-specific values

The actual Challenge target MUST be established by Challenge configuration rather than
hardcoded universally into the Activity.

### FR-V2-038 — Sets

Where relevant, Challenge configuration MAY define sets in addition to total target
values.

### FR-V2-039 — Open set structure

Where sets are not required by the Challenge, the product MAY allow Participants to
determine how they divide the required total.

### FR-V2-040 — Activity guidance

Canonical Activities SHOULD be capable of carrying instructions, measurement guidance,
cautions, equipment guidance and difficulty/usage advice.

### FR-V2-041 — Guidance/configuration separation

Activity guidance MUST NOT unnecessarily force one fixed Challenge configuration.

### FR-V2-042 — Admin refinement

Authorized Admin capability SHOULD allow appropriate Activity and Template content to be
refined without hardcoding all such content into application releases.

---

## §11 Challenge Configuration

> **Disposition: KEEP all as-is from Founder Working Baseline.**

### FR-V2-043 — Core configuration

A Challenge MUST be capable of carrying the configuration required by its type.

### FR-V2-044 — Name and description

Challenge creation SHOULD support a Challenge name and explanatory description.

### FR-V2-045 — Timing

A Challenge MUST define the timing information required by its type.

### FR-V2-046 — Instructions

A Challenge SHOULD support Challenge-specific instructions.

### FR-V2-047 — Eligibility

A Challenge MAY define valid Challenge-specific participation eligibility restrictions.

### FR-V2-048 — Restriction location

Participation eligibility restrictions MUST attach to the Challenge rather than becoming
a general Group rule controlling participation in all Challenges.

### FR-V2-049 — Valid configuration

The product MUST reject Challenge configurations that violate applicable canonical
Activity, Challenge-type or governance constraints.

---

## §12 Challenge Discovery

> **Disposition: KEEP all as-is from Founder Working Baseline.**

### FR-V2-050 — Browse Challenges

Members MUST be able to discover/browse Challenges where visibility and eligibility rules
permit.

### FR-V2-051 — Group context

Challenge discovery MUST make the Challenge's Group context intelligible.

### FR-V2-052 — Home surfacing

The Home experience MAY surface ongoing or upcoming Challenges a Member may be interested
in joining.

### FR-V2-053 — Interest relevance

Challenge discovery MAY use permitted Member interests or other approved context to
improve relevance.

### FR-V2-054 — Recommendation is not enrollment

Surfacing or recommending a Challenge MUST NOT enroll the Member.

### FR-V2-055 — Challenge preview

Where visibility permits, the product SHOULD show sufficient Challenge information for an
informed joining decision.

---

## §13 Voluntary Challenge Participation

> **Disposition: KEEP all as-is from Founder Working Baseline.**

### FR-V2-056 — Affirmative joining

A Member MUST affirmatively choose to join a Challenge.

### FR-V2-057 — No automatic enrollment

Group Membership MUST NOT automatically enroll a Member into a Group Challenge.

### FR-V2-058 — Eligibility enforcement

The product MUST apply valid Challenge-specific eligibility conditions before
establishing participation.

### FR-V2-059 — Participation attribution

Challenge Participation MUST be attributable to the relevant Member and Challenge.

### FR-V2-060 — Participation is non-governing

Joining a Challenge MUST NOT by itself grant governance authority.

### FR-V2-061 — Withdrawal

The product MUST support governed voluntary withdrawal from a Challenge.

### FR-V2-062 — Removal

The product MUST support valid Participant removal where approved governance permits.

### FR-V2-063 — Historical preservation

Withdrawal or removal MUST NOT silently erase historical participation or Activity.

---

## §14 Activity Logging and Self-Accountability

> **Disposition: KEEP all as-is. ADD FR-V2-207 (Reconciliation F-A-01).**

### FR-V2-064 — Participant Activity

Participants MUST be able to provide Activity Evidence for their own participation.

### FR-V2-065 — Self-accountability model

The product MUST represent Tiizi as a self-accountability platform rather than claiming
independent factual verification of every Activity.

### FR-V2-066 — No false certification

Acceptance of Activity MUST NOT be represented as Tiizi certifying that the real-world
Activity occurred exactly as reported.

### FR-V2-067 — Plausibility safeguards

The product MAY support safeguards capable of identifying obviously anomalous or
implausible Activity submissions.

### FR-V2-068 — Safeguard boundary

Plausibility safeguards MUST NOT silently redefine Tiizi as the factual verifier of
Participant Activity.

### FR-V2-069 — Community accountability

The product SHOULD preserve the ability of Groups to respond to repeated dubious logging
through valid community governance.

### FR-V2-207 — Challenge-specific Activity logging *(NEW — Reconciliation F-A-01)*

Activity logging MUST be Challenge-specific. A log made in one Challenge MUST NOT
automatically exist in, transfer to, or count toward another Challenge. A Participant
MUST log separately in each Challenge where the same real-world Activity is intended to
count.

> **Source:** Reconciliation F-A-01; Calculation Model §§3, 40(1-2).
> **Rationale:** The baseline did not explicitly state that Activity logging is
> Challenge-specific. The Calculation Model makes this a governing principle: each
> Challenge maintains its own independent Activity record, and a single real-world
> Activity does not automatically propagate across Challenges.

---

## §15 Evidence and Truth Chain

> **Disposition: KEEP all as-is from Founder Working Baseline.**

### FR-V2-070 — Submission Intent

The product model MUST preserve Submission Intent as distinct from accepted Activity.

### FR-V2-071 — Evidence Eligibility

Evidence Eligibility MUST remain distinct from submission and acceptance.

### FR-V2-072 — Acceptance Authority

Accepted Activity MUST arise through the applicable governed Acceptance Authority.

### FR-V2-073 — Accepted Activity Event

The product MUST preserve Accepted Activity Event as the governed accepted-event concept.

### FR-V2-074 — Calculation Authority

Derived Challenge results MUST trace through applicable Calculation Authority.

### FR-V2-075 — Derived Truth

Challenge progress, completion, rankings and Streak results MUST be derived rather than
silently treated as raw Activity claims.

### FR-V2-076 — No parallel acceptance gate

The product MUST NOT invent an undefined parallel evidence-acceptance concept that
bypasses the governed authority chain.

### FR-V2-077 — Deferred verification

Implementation MUST NOT silently resolve ACT-03 Verification Authority where it remains
deferred.

### FR-V2-078 — Deferred correction authority

Implementation MUST NOT silently resolve ACT-04 correction authority where it remains
deferred.

---

## §16 Shared Challenge Progress

> **Disposition: KEEP all as-is from Founder Working Baseline.**

### FR-V2-079 — Progress visibility

Participants SHOULD be able to understand their relevant Challenge progress.

### FR-V2-080 — Remaining requirement

Where meaningful, the product SHOULD show what remains for the Participant or Challenge
to achieve.

### FR-V2-081 — Type-specific calculation

Progress MUST be calculated according to the selected Challenge type rather than one
generic formula.

### FR-V2-082 — Underlying Activity distinction

The underlying Member Activity Event MUST remain distinct from Challenge progress.

---

## §17 Collective Challenge Requirements

> **Disposition: KEEP all. ALIGNED WORDING for FR-V2-084, FR-V2-086, FR-V2-088.**

### FR-V2-083 — Shared Goal

A Collective Challenge MUST support one configured shared collective Goal.

### FR-V2-084 — Contribution aggregation *(ALIGNED WORDING)*

Eligible Participant Activity MUST contribute to shared Collective progress according to
governed Collective calculation rules.

> **Alignment note:** Wording aligned to reference governed Collective calculation rules
> explicitly, consistent with the Calculation Model. Substantive intent unchanged.

### FR-V2-085 — Individual contribution

The product SHOULD be capable of showing a Participant's contribution to collective
progress where appropriate.

### FR-V2-086 — Goal-reached completion *(ALIGNED WORDING)*

A Collective Challenge MUST be capable of ending when the shared Goal is reached before
the scheduled end. The contribution crossing the Goal MUST be recorded in full.

> **Alignment note:** Added explicit requirement that the contribution which crosses the
> Goal threshold is recorded in full (not truncated to the Goal). Consistent with
> Calculation Model treatment of overshoot.

### FR-V2-087 — Time-expiry completion

A Collective Challenge MUST end when its configured period expires if it has not already
ended through Goal achievement.

### FR-V2-088 — Active extension *(ALIGNED WORDING)*

The product MUST support an authorized Collective Challenge extension while Active only.

> **Alignment note:** Wording tightened to "extension while Active only" to make explicit
> that extension is not available after a Challenge has ended. Consistent with
> Calculation Model and FR-V2-090.

### FR-V2-089 — Extension continuity

A valid Collective extension MUST preserve the same Challenge identity, participants,
accumulated progress and history.

### FR-V2-090 — No post-end extension

An ended Collective Challenge MUST NOT be extended as the same Challenge.

### FR-V2-091 — No forced ranking

Collective Challenges MUST NOT require competitive Participant ranking merely because
individual contributions are visible.

---

## §18 Competitive Challenge Requirements

> **Disposition: RECONCILIATION APPLIED. FR-V2-101 and FR-V2-102 SUPERSEDED.
> ADD FR-V2-208 (Reconciliation F-B-01).**

### FR-V2-092 — Individual competitive progress

Each Competitive Participant MUST maintain individual Challenge performance.

### FR-V2-093 — No shared accumulation

One Participant's Activity MUST NOT add to another Participant's Competitive progress.

### FR-V2-094 — Comparative standing

The product MUST support comparative standing appropriate to the Competitive Challenge
configuration.

### FR-V2-095 — Individual early completion

Where the Competitive Challenge uses a finishable target, a Participant MUST be able to
complete individually when that target is validly reached.

### FR-V2-096 — Individual finish does not close Challenge

One Participant's completion MUST NOT end the Competitive Challenge for remaining
Participants.

### FR-V2-097 — Scheduled Challenge closure

The Competitive Challenge MUST close at the end of its configured competitive window.

### FR-V2-098 — Unfinished Participant result

At closure, the product MUST preserve the actual result of Participants who did not reach
the Goal.

### FR-V2-099 — No false completion

A Participant who did not satisfy the configured completion condition MUST NOT be
represented as having completed it.

### FR-V2-100 — Finish order

Where applicable, Competitive calculation MAY use qualifying finish order as comparative
standing.

### FR-V2-101 — Tie rules *(SUPERSEDED)*

> **Original text:** "Tie-breaking MUST be explicitly specified before implementation
> relies on it."
>
> **Disposition:** SUPERSEDED by reconciliation. The formerly open question is now
> settled.
>
> **Settled rule:** Where two or more Participants have the same governed
> target-completion point, they MUST share that finishing position. Tiizi MUST NOT
> invent an artificial tie-breaker.
>
> **Source:** Reconciliation F-B-02; Calculation Model §16.

### FR-V2-102 — Non-completer ordering *(SUPERSEDED)*

> **Original text:** "Any ordering among non-completers MUST be explicitly specified
> before implementation relies on it."
>
> **Disposition:** SUPERSEDED by reconciliation. The formerly open question is now
> settled.
>
> **Settled rule:** Participants who have not reached the target when the Challenge ends
> MUST receive no finishing position. Their actual final progress MUST remain visible.
> They MUST NOT be labelled failed, incomplete, or assigned an artificial position.
>
> **Source:** Reconciliation F-B-02; Calculation Model §17.

### FR-V2-103 — No assumed extension

Competitive Challenges MUST NOT inherit Collective extension behaviour automatically.

### FR-V2-208 — No Highest Performance mode *(NEW — Reconciliation F-B-01)*

Initial V2 MUST NOT include a Highest Performance Competitive mode. Competitive
Challenges MUST operate as a race to the configured target.

> **Source:** Reconciliation F-B-01; Calculation Model.
> **Rationale:** The Product Definition DRAFT confirms that initial V2 Competitive
> Challenges operate exclusively as a race to the configured target. A Highest
> Performance mode (ranking by maximum achievement rather than first-to-target) is
> excluded from initial V2 scope.

---

## §19 Streak Challenge Requirements

> **Disposition: RECONCILIATION APPLIED. FR-V2-105, FR-V2-107 ALIGNED WORDING.
> FR-V2-117, FR-V2-118, FR-V2-119 SUPERSEDED.
> ADD FR-V2-209, FR-V2-210, FR-V2-211 (Reconciliation F-C-01, F-C-02).**

### FR-V2-104 — Individual Streak

Each Streak Participant MUST maintain their own Streak result.

### FR-V2-105 — Required interval *(ALIGNED WORDING)*

A Streak Challenge MUST define the daily Activity requirement necessary to maintain the
Streak.

> **Alignment note:** Wording aligned to "daily Activity requirement" to reflect that
> initial V2 supports daily-frequency Streak Challenges only. See FR-V2-209.

### FR-V2-106 — Interval success

Qualifying Activity satisfying the configured daily interval requirement MUST count
toward the Participant's continuing Streak.

### FR-V2-107 — Missed interval reset *(ALIGNED WORDING)*

Failure to satisfy a required daily interval MUST reset the Participant's Current Streak.

> **Alignment note:** Wording aligned to specify that failure to satisfy a required
> **daily** interval triggers the reset. Consistent with FR-V2-105 alignment and
> FR-V2-209.

### FR-V2-108 — Reset does not remove Participant

A Streak reset MUST NOT automatically remove the Participant from the Challenge.

### FR-V2-109 — Continue after reset

A Participant MUST be able to continue participating after a reset and begin a new Streak
during the remaining Challenge period.

### FR-V2-110 — Preserve prior Streak history

A reset MUST NOT erase prior Streak performance.

### FR-V2-111 — End by period

A Streak Challenge MUST close when its configured Challenge period ends.

### FR-V2-112 — No ordinary early finish

A Participant MUST NOT ordinarily be treated as finished merely because they reached an
intermediate Streak length before the Challenge period ends.

### FR-V2-113 — Current Streak

The product SHOULD be capable of representing Current Streak.

### FR-V2-114 — Best Streak

The product SHOULD be capable of representing Best Streak where applicable.

### FR-V2-115 — Completed intervals

The product MAY represent completed required intervals separately from consecutive Streak
length.

### FR-V2-116 — No assumed extension

Streak Challenges MUST NOT inherit Collective extension behaviour automatically.

### FR-V2-117 — Late-join rule *(SUPERSEDED)*

> **Original text:** "The detailed Stage F specification MUST explicitly settle late
> joining for Streak Challenges before implementation."
>
> **Disposition:** SUPERSEDED by reconciliation. The formerly open question is now
> settled.
>
> **Settled rule:** A Participant MAY join an active Streak Challenge late where
> Challenge-specific eligibility permits. Late joining MUST NOT redefine or shorten the
> Challenge period. Streak results MUST be reported against the full configured Challenge
> period regardless of join date.
>
> **Source:** Reconciliation F-C-02; Calculation Model §§30-31.

### FR-V2-118 — Late-log rule *(SUPERSEDED)*

> **Original text:** "The detailed Stage F specification MUST explicitly settle late
> logging/grace-period behaviour before implementation."
>
> **Disposition:** SUPERSEDED by reconciliation. The formerly open question is now
> settled.
>
> **Settled rule:** Initial V2 MUST NOT provide an ordinary late-logging grace period for
> Streak Challenges. A Participant MUST mark daily requirement(s) Done during the
> applicable Challenge day. If the day closes without all requirements being Done, the
> day is Missed and Current Streak resets.
>
> **Source:** Reconciliation F-C-02; Calculation Model §26.

### FR-V2-119 — Time-boundary rule *(SUPERSEDED)*

> **Original text:** "The detailed Stage F specification MUST explicitly settle applicable
> day/interval boundary and timezone behaviour before implementation."
>
> **Disposition:** SUPERSEDED by reconciliation. The formerly open question is now
> settled.
>
> **Settled rule:** Each Streak Challenge MUST operate against one governing Challenge
> timezone. Device timezone changes MUST NOT independently change the Challenge-day
> boundary.
>
> **Source:** Reconciliation F-C-02; Calculation Model §27.

### FR-V2-209 — Daily-only Streak *(NEW — Reconciliation F-C-01)*

Initial V2 MUST support daily Streak Challenges only. Weekly-frequency Streak
calculations MUST NOT be included.

> **Source:** Reconciliation F-C-01; Calculation Model §20.
> **Rationale:** The Product Definition DRAFT confirms that initial V2 Streak Challenges
> operate on a daily-frequency basis only. Weekly or other non-daily frequency Streak
> calculations are excluded from initial V2 scope.

### FR-V2-210 — Multi-Activity Streak *(NEW — Calculation Model §24)*

Where a Streak Challenge configures multiple daily Activities, ALL configured daily
requirements MUST be Done for the Challenge day to count as Complete.

> **Source:** Calculation Model §24.
> **Rationale:** The baseline did not explicitly address the case where a Streak
> Challenge requires multiple distinct daily Activities. The Calculation Model establishes
> that all configured daily requirements must be satisfied for the day to count.

### FR-V2-211 — No Streak Leaderboard *(NEW — Calculation Model §34; Recognition §16)*

Initial V2 MUST NOT rank Streak Challenge Participants against one another. A Streak
Challenge MUST NOT produce a Participant leaderboard.

> **Source:** Calculation Model §34; Recognition §16.
> **Rationale:** Streak Challenges measure each Participant's own consecutive-day
> performance. They do not produce a comparative ranking. This is consistent with the
> recognition framework: Streak results are personal Derived Truth, not competitive
> standing.

---

## §20 Challenge Completion, Finalization and Reuse

> **Disposition: KEEP all as-is from Founder Working Baseline.**

### FR-V2-120 — Type-specific completion

Challenge completion MUST follow the selected Challenge type's governed rules.

### FR-V2-121 — Finalization

Ended Challenges MUST reach an intelligible finalized historical state.

### FR-V2-122 — No same-identity reopening

An ended Challenge MUST NOT be reopened as the same Challenge.

### FR-V2-123 — Run Again

The product SHOULD support Run Again or equivalent reuse.

### FR-V2-124 — New identity on repeat

Run Again MUST create a new Challenge identity.

### FR-V2-125 — New participation

A repeated Challenge MUST establish new participation rather than automatically carrying
Participants forward.

### FR-V2-126 — New progress

A repeated Challenge MUST begin new Challenge progress.

### FR-V2-127 — Preserve original

The original Challenge's history MUST remain intact when a new Challenge is created from
it.

---

## §21 Home, Feed, and Community Experience

> **Disposition: RECONCILIATION APPLIED (F-E-01). FR-V2-128, FR-V2-129, FR-V2-133
> SUPERSEDED. FR-V2-134 updated to remove comments/replies reference.**

### FR-V2-128 — Challenge information surface *(SUPERSEDED)*

> **Original text:** "A Challenge SHOULD provide a social Feed or equivalent shared
> activity surface."
>
> **Disposition:** SUPERSEDED by reconciliation.
>
> **Settled rule:** The Challenge experience MUST provide Challenge-specific operational
> information. The Group Feed MUST serve as the single community stream. Tiizi MUST NOT
> provide a separate Home Feed.
>
> **Source:** Reconciliation F-E-01; Notifications baseline §§3, 7.
>
> **Effect:** There is no Challenge-specific Feed and no separate Home Feed. The Group
> Feed is the single community stream. Challenge-specific operational information
> (progress, results, status) is presented through the Challenge experience itself, not
> through a Feed.

### FR-V2-129 — Group Feed content *(SUPERSEDED)*

> **Original text:** "The Feed MAY surface joining, Activity, progress, milestones,
> completions, Streak events, comparative events, collective events and permitted
> contribution events."
>
> **Disposition:** SUPERSEDED by reconciliation.
>
> **Settled rule:** Group Feed content MUST come from: (a) meaningful Group/Challenge
> state events eligible for automatic publication; and (b) personal achievements or
> Activity information that a Member explicitly chooses to Share to Group. Routine
> personal Activity logging MUST NOT automatically create Group Feed content.
>
> **Source:** Reconciliation F-E-01; Notifications baseline §§8-12.
>
> **Effect:** The Feed is not an automatic broadcast of all Activity. Only state events
> the governance framework identifies as eligible for automatic publication, and
> information a Member explicitly Shares, enter the Group Feed.

### FR-V2-130 — Feed is not truth source

Feed presentation MUST NOT become the source of Activity, Challenge progress or Derived
Truth.

### FR-V2-131 — Kudos

Members SHOULD be able to provide lightweight community encouragement such as Kudos.

### FR-V2-132 — Kudos do not affect performance

Kudos MUST NOT alter Activity, progress, ranking, Streak, completion or Platform
Recognition.

### FR-V2-133 — Comments/replies *(SUPERSEDED)*

> **Original text:** "The product MAY support bounded Challenge social interaction such
> as comments or replies."
>
> **Disposition:** SUPERSEDED by reconciliation.
>
> **Settled rule:** Initial V2 MUST NOT provide comments or reply threads on Feed items.
>
> **Source:** Reconciliation F-E-01; Notifications baseline §20.
>
> **Effect:** No comment or reply capability in initial V2. This removes the associated
> complexity from the notification and authority models.

### FR-V2-134 — Social interaction authority boundary *(UPDATED)*

Kudos and reactions MUST NOT silently become evidence acceptance, governance authority or
calculation input.

> **Update note:** Wording updated to remove reference to comments and replies, which do
> not exist in initial V2 per FR-V2-133 supersession. Substantive boundary preserved for
> Kudos and reactions.

---

## §22 Sharing

> **Disposition: KEEP all as-is. ADD FR-V2-212 (Notifications baseline §§14-15).**

### FR-V2-135 — Sharing capability

The product MAY support sharing of Challenges and achievements.

### FR-V2-136 — Visibility enforcement

Sharing MUST respect Group/Challenge visibility, privacy, consent and minimum-necessary
disclosure.

### FR-V2-137 — No visibility bypass

A share action MUST NOT expose information the recipient is not permitted to access.

### FR-V2-212 — Share to Group is explicit *(NEW — Notifications baseline §§14-15)*

Personal Activity, milestones, and Recognition MUST NOT automatically enter the Group
Feed. A Member MUST explicitly choose to Share to Group.

> **Source:** Notifications baseline §§14-15.
> **Rationale:** This requirement makes explicit the principle underlying FR-V2-129's
> settled rule: personal Activity does not automatically become Feed content. A Member
> must take an affirmative Share action for their Activity, milestones, or Recognition to
> appear in the Group Feed.

---

## §23 Notifications

> **Disposition: KEEP all as-is from Founder Working Baseline.**

### FR-V2-138 — Challenge notifications

The product SHOULD support relevant Challenge notifications.

### FR-V2-139 — Notification events

Notifications MAY cover invitations, starts, reminders, progress, milestones, community
interaction and Challenge end.

### FR-V2-140 — Non-coercive notifications

Notification design SHOULD support accountability without implying involuntary Challenge
participation.

### FR-V2-141 — Trigger specification

Detailed notification triggers and frequency MUST be specified before implementation is
treated as canonical product behaviour.

---

## §24 Recognition

> **Disposition: KEEP all as-is from Founder Working Baseline.**

### FR-V2-142 — Recognition distinction

Platform Recognition MUST remain distinct from Challenge Derived Truth.

### FR-V2-143 — Group encouragement distinction

Kudos and Group acknowledgement MUST remain distinct from Platform Recognition.

> **Update note:** Wording adjusted to remove reference to comments, which do not exist
> in initial V2 per FR-V2-133 supersession.

### FR-V2-144 — Leaderboard distinction

Leaderboard position MUST NOT automatically be treated as Platform Recognition.

### FR-V2-145 — Challenge logic

Challenge-type logic MAY determine qualifying performance under governed Platform Policy.

### FR-V2-146 — No engine authority

A product or technical Challenge Engine MUST NOT independently be treated as Recognition
Authority.

### FR-V2-147 — MOT-01 preservation

Platform Recognition issuance MUST remain gated by the unresolved MOT-01 authority
decision where applicable.

---

## §25 Future Rewards

> **Disposition: KEEP all as-is from Founder Working Baseline.**

### FR-V2-148 — Preserve future rewards

The product architecture SHOULD avoid unnecessarily preventing future Group-defined
Challenge rewards.

### FR-V2-149 — No Phase-1 reward system

This baseline MUST NOT be interpreted as authorizing a Phase-1 reward custody,
entitlement, escrow, payout or fulfilment system.

### FR-V2-150 — Reward/performance distinction

A future reward MUST remain distinct from the underlying truth of Challenge performance.

---

## §26 Free Platform Principle

> **Disposition: KEEP all as-is from Founder Working Baseline.**

### FR-V2-151 — Free use

Core use of Tiizi MUST NOT require a subscription.

### FR-V2-152 — Free Group participation

Group Membership MUST NOT require payment to Tiizi as a general platform condition.

### FR-V2-153 — Free Challenge participation

Challenge Participation MUST NOT require a Support Tiizi contribution.

### FR-V2-154 — Voluntary support

Financial support for Tiizi MUST remain voluntary under this product model.

---

## §27 Support Tiizi

> **Disposition: KEEP all as-is from Founder Working Baseline.**

### FR-V2-155 — Profile CTA

The Member Profile SHOULD provide a standalone Support Tiizi CTA.

### FR-V2-156 — Challenge option

Challenge creation SHOULD support enabling/disabling a Support Tiizi contribution
capability.

### FR-V2-157 — Suggested amount

Where enabled, the product MAY support a suggested contribution amount.

### FR-V2-158 — Open amount

Where enabled, the product MAY support an open contribution amount.

### FR-V2-159 — Voluntary nature

The product MUST clearly preserve the voluntary nature of Support Tiizi contributions.

### FR-V2-160 — No performance effect

Support Tiizi contributions MUST NOT affect Challenge eligibility, Activity, progress,
completion, ranking, Streak or Recognition.

### FR-V2-161 — Tiizi beneficiary

Support Tiizi contributions MUST be distinguishable as contributions intended for the
Tiizi Platform.

### FR-V2-162 — Payment provider deferred

This baseline MUST NOT select or imply a final payment provider.

---

## §28 Social Cause Support

> **Disposition: KEEP all. ALIGNED WORDING for FR-V2-170, FR-V2-171.**

### FR-V2-163 — Cause option

Challenge creation SHOULD support enabling/disabling Social Cause Support.

### FR-V2-164 — Cause information

Where enabled, the creator MUST provide the information required to describe and review
the cause.

### FR-V2-165 — Cause Goal

The product SHOULD support a distinct fundraising Goal for the cause.

### FR-V2-166 — Separate Goals

The cause fundraising Goal MUST remain distinct from the Challenge Activity Goal.

### FR-V2-167 — Voluntary contribution

Social Cause contribution MUST remain voluntary.

### FR-V2-168 — No performance effect

Cause contributions MUST NOT affect Challenge eligibility, Activity, progress,
completion, ranking, Streak or Recognition.

### FR-V2-169 — Proposed payment destination

The cause configuration SHOULD support an approved mobile-money account/phone number or
another later-supported destination.

### FR-V2-170 — Approval before go-live *(ALIGNED WORDING)*

A Challenge with Social Cause Support enabled MUST NOT go live with its fundraising
capability active before Platform Admin approval.

> **Alignment note:** Wording aligned to clarify that it is the **fundraising
> capability** that requires approval before going active, not the Challenge itself
> necessarily. A Cause-enabled Challenge may be created and configured, but its
> fundraising functionality MUST NOT be live until Platform Admin approval is granted.

### FR-V2-171 — Due-diligence capability *(ALIGNED WORDING)*

The product MUST support a Platform review state/process sufficient for later-defined
cause due diligence.

> **Alignment note:** Wording aligned to clarify that the product must support a review
> **state/process** — not that the product itself performs due diligence. The due
> diligence criteria are a downstream governance/operational matter (see FR-V2-204).

### FR-V2-172 — Ordinary Challenge boundary

Platform pre-approval MUST NOT become a universal requirement for ordinary Challenges
merely because Social Cause Challenges require approval.

### FR-V2-173 — Approval status

The creator SHOULD be able to understand whether a Cause-enabled Challenge is pending
review, approved or otherwise not eligible to go live.

### FR-V2-174 — Contribution privacy

Display of cause contribution information MUST respect privacy, consent and
minimum-necessary disclosure.

---

## §29 Historical Integrity

> **Disposition: KEEP all as-is from Founder Working Baseline.**

### FR-V2-175 — Historical Challenge access

Ended Challenges SHOULD remain historically intelligible to authorized viewers.

### FR-V2-176 — Preserve identity

Historical records MUST preserve the identity of the original Challenge.

### FR-V2-177 — Preserve configuration

Historical representation SHOULD preserve the relevant Challenge configuration.

### FR-V2-178 — Preserve participation

Historical representation SHOULD preserve relevant participation history.

### FR-V2-179 — Preserve outcomes

Historical representation SHOULD preserve relevant final progress/results.

### FR-V2-180 — Correction traceability

Corrections affecting historical Challenge truth MUST remain attributable and historically
intelligible.

### FR-V2-181 — No silent rewrite

The product MUST NOT silently rewrite historical Challenge truth as though a corrected
prior state never existed.

---

## §30 Privacy, Visibility and Consent

> **Disposition: KEEP all as-is from Founder Working Baseline.**

### FR-V2-182 — Privacy before convenience

Challenge functionality MUST remain subject to approved privacy and visibility
governance.

### FR-V2-183 — Minimum necessary

Product surfaces SHOULD disclose only the information necessary for the permitted
purpose.

### FR-V2-184 — Consent

Where governed consent is required, the product MUST respect the applicable consent
state.

### FR-V2-185 — Withdrawal effect

Where consent withdrawal has a governed effect, product behaviour MUST reflect that
effect rather than relying solely on display preferences.

### FR-V2-186 — Ownership/access distinction

Ownership or authorship MUST NOT be interpreted as unrestricted access.

---

## §31 Admin and Content Operations

> **Disposition: KEEP all as-is from Founder Working Baseline.**

### FR-V2-187 — Authorized Admin management

The product SHOULD provide authorized Admin mechanisms for managing appropriate
configurable Knowledge/product assets.

### FR-V2-188 — Activity management

Authorized Admin capability SHOULD support appropriate Activity Library refinement.

### FR-V2-189 — Template management

Authorized Admin capability SHOULD support appropriate Challenge Template refinement.

### FR-V2-190 — Admin is mechanism

Admin tooling MUST NOT itself be treated as governance Authority.

### FR-V2-191 — Governance trace

Admin powers MUST trace to approved operational authority.

---

## §32 Product Flexibility

> **Disposition: KEEP all as-is from Founder Working Baseline.**

### FR-V2-192 — Configurable targets

The product SHOULD allow valid Challenge-specific target configuration rather than
hardcoding one target per Activity.

### FR-V2-193 — Configurable sets

The product MAY support Challenge-specific set configuration where appropriate.

### FR-V2-194 — Configurable duration

The product MUST support type-appropriate Challenge duration configuration.

### FR-V2-195 — Configurable instructions

The product SHOULD support Challenge-specific instructions.

### FR-V2-196 — Optional capabilities

Optional contribution and other approved capabilities SHOULD be configurable rather than
universally forced on every Challenge.

### FR-V2-197 — Boundary enforcement

Configuration flexibility MUST remain inside approved governance, canonical Activity and
Challenge-type constraints.

---

## §33 Settlement of Formerly Open Stage F Questions

> **Disposition: RECONCILIATION APPLIED. FR-V2-198 through FR-V2-206 addressed per
> reconciliation findings. These requirements were originally framed as "Stage F MUST
> define..." open questions. They are now SETTLED, ADDRESSED, or DOWNSTREAM per the
> Product Definition DRAFT and reconciliation.**

### FR-V2-198 — Competitive tie-breaking *(SETTLED)*

Where two or more Participants have the same governed target-completion point, they MUST
share that finishing position. Tiizi MUST NOT invent an artificial tie-breaker.

> **Disposition:** ALIGNED WORDING — was open in the baseline, now settled by
> Calculation Model §16. This requirement replaces the original open question with the
> governed answer.

### FR-V2-199 — Competitive non-completer ordering *(SETTLED)*

Participants who have not reached the target when the Challenge ends MUST receive no
finishing position. Their actual final progress MUST remain visible. They MUST NOT be
labelled failed or assigned an artificial position.

> **Disposition:** ALIGNED WORDING — was open in the baseline, now settled by
> Calculation Model §17. This requirement replaces the original open question with the
> governed answer.

### FR-V2-200 — Streak late joining *(SETTLED)*

A Participant MAY join an active Streak Challenge late where Challenge-specific
eligibility permits. Late joining MUST NOT redefine or shorten the Challenge period.
Streak results MUST be reported against the full configured Challenge period.

> **Disposition:** ALIGNED WORDING — was open in the baseline, now settled by
> Calculation Model §§30-31. This requirement replaces the original open question with
> the governed answer.

### FR-V2-201 — Streak late logging *(SETTLED)*

Initial V2 MUST NOT provide an ordinary late-logging grace period for Streak Challenges.

> **Disposition:** ALIGNED WORDING — was open in the baseline, now settled by
> Calculation Model §26. This requirement replaces the original open question with the
> governed answer.

### FR-V2-202 — Streak time boundaries *(SETTLED)*

Each Streak Challenge MUST operate against one governing Challenge timezone. Device
timezone changes MUST NOT independently change the Challenge-day boundary.

> **Disposition:** ALIGNED WORDING — was open in the baseline, now settled by
> Calculation Model §27. This requirement replaces the original open question with the
> governed answer.

### FR-V2-203 — Notification rules *(ADDRESSED)*

Notification trigger families and aggregation rules are defined in the Stage F Product
Definition. Residual exact trigger catalogue is downstream technical specification.

> **Disposition:** DOWNSTREAM — substantially addressed by the Notifications baseline in
> the Product Definition DRAFT. The exact per-trigger catalogue remains a downstream
> technical specification matter. This requirement no longer blocks Stage F progression.

### FR-V2-204 — Cause due diligence *(DOWNSTREAM)*

Operational cause-review requirements MUST be defined before live fundraising. This is a
downstream governance/operational matter.

> **Disposition:** DOWNSTREAM — proper downstream deferral per reconciliation. The
> product supports a review state/process (FR-V2-171), but the operational due diligence
> criteria, procedures, and approval workflows are a downstream governance matter to be
> defined before any live fundraising goes active.

### FR-V2-205 — Contribution visibility *(SETTLED)*

Community-reported contribution totals MUST be clearly labelled as based on Participant
reports. They MUST NOT be presented as confirmed Amount Raised without reliable payment
evidence.

> **Disposition:** ALIGNED WORDING — was open in the baseline, now settled by
> Contribution Model §24. This requirement replaces the original open question with the
> governed answer.

### FR-V2-206 — Detailed calculation specification *(SETTLED)*

Deterministic calculation rules for Collective, Competitive and Streak Derived Truth are
provided in the Stage F Product Definition Calculation Schedule.

> **Disposition:** ALIGNED WORDING — was open in the baseline, now settled by the
> Calculation Model (rules 1-25) in the Product Definition DRAFT. This requirement
> replaces the original open question with confirmation that the governed rules exist.

---

# Part 3: FR-V2 Reconciliation Schedule

> **DRAFT — This schedule records the disposition of every FR-V2 identifier from the
> Founder Working Baseline through reconciliation.**

The following table records the disposition of every original FR-V2-001 through FR-V2-206,
plus any new requirements introduced through reconciliation.

**Disposition legend:**

| Disposition | Meaning |
|-------------|---------|
| **KEEP** | Carried forward unchanged from the Founder Working Baseline. |
| **ALIGNED WORDING** | Substantive intent preserved; wording aligned to Product Definition DRAFT or reconciliation findings. |
| **SUPERSEDED** | Original open-question formulation replaced by a settled rule. The superseding requirement is identified. |
| **DOWNSTREAM** | Deferred to downstream technical specification or governance work. Does not block Stage F. |
| **NEW** | New requirement introduced through reconciliation where the baseline had a gap. |

---

## Reconciliation Table: FR-V2-001 through FR-V2-206

| FR ID | Original Subject | Disposition | Final T2 Location | Final Wording Status | Source/Reconciliation Finding | Notes |
|-------|-----------------|-------------|-------------------|---------------------|-------------------------------|-------|
| FR-V2-001 | Member prerequisite | KEEP | §5 | Unchanged | — | — |
| FR-V2-002 | Group prerequisite | KEEP | §5 | Unchanged | — | — |
| FR-V2-003 | No standalone Challenge | KEEP | §5 | Unchanged | — | — |
| FR-V2-004 | Group pathways | KEEP | §5 | Unchanged | — | — |
| FR-V2-005 | Challenge pathways | KEEP | §5 | Unchanged | — | — |
| FR-V2-006 | Relationship distinction | KEEP | §5 | Unchanged | — | — |
| FR-V2-007 | Group creation | KEEP | §6 | Unchanged | — | — |
| FR-V2-008 | Initial Group stewardship | KEEP | §6 | Unchanged | — | — |
| FR-V2-009 | Simple Charter | KEEP | §6 | Unchanged | — | — |
| FR-V2-010 | Prefilled Charter provisions | KEEP | §6 | Unchanged | — | — |
| FR-V2-011 | Custom Charter text | KEEP | §6 | Unchanged | — | — |
| FR-V2-012 | Platform supremacy | KEEP | §6 | Unchanged | — | — |
| FR-V2-013 | Minimal administration | KEEP | §6 | Unchanged | — | — |
| FR-V2-014 | Honest logging expectations | KEEP | §6 | Unchanged | — | — |
| FR-V2-015 | Challenge-creation restriction | KEEP | §6 | Unchanged | — | — |
| FR-V2-016 | Governed visibility | KEEP | §7 | Unchanged | — | — |
| FR-V2-017 | No binary collapse | KEEP | §7 | Unchanged | — | — |
| FR-V2-018 | Discoverable Groups | KEEP | §7 | Unchanged | — | — |
| FR-V2-019 | Pre-join information | KEEP | §7 | Unchanged | — | — |
| FR-V2-020 | Private information protection | KEEP | §7 | Unchanged | — | — |
| FR-V2-021 | Discovery is not membership | KEEP | §7 | Unchanged | — | — |
| FR-V2-022 | Default creation permission | KEEP | §8 | Unchanged | — | — |
| FR-V2-023 | Valid Group restriction | KEEP | §8 | Unchanged | — | — |
| FR-V2-024 | No universal admin-only model | KEEP | §8 | Unchanged | — | — |
| FR-V2-025 | Challenge creator attribution | KEEP | §8 | Unchanged | — | — |
| FR-V2-026 | Creator authority boundary | KEEP | §8 | Unchanged | — | — |
| FR-V2-027 | Challenge type | KEEP | §8 | Unchanged | — | — |
| FR-V2-028 | Initial Challenge types | KEEP | §8 | Unchanged | — | — |
| FR-V2-029 | Reusable Templates | KEEP | §9 | Unchanged | — | — |
| FR-V2-030 | Template is not Challenge | KEEP | §9 | Unchanged | — | — |
| FR-V2-031 | Template adoption | KEEP | §9 | Unchanged | — | — |
| FR-V2-032 | Template customization | KEEP | §9 | Unchanged | — | — |
| FR-V2-033 | Template canonical references | KEEP | §9 | Unchanged | — | — |
| FR-V2-034 | Template configuration | KEEP | §9 | Unchanged | — | — |
| FR-V2-035 | Canonical Activity selection | KEEP | §10 | Unchanged | — | — |
| FR-V2-036 | Permitted measurement | KEEP | §10 | Unchanged | — | — |
| FR-V2-037 | Challenge-specific values | KEEP | §10 | Unchanged | — | — |
| FR-V2-038 | Sets | KEEP | §10 | Unchanged | — | — |
| FR-V2-039 | Open set structure | KEEP | §10 | Unchanged | — | — |
| FR-V2-040 | Activity guidance | KEEP | §10 | Unchanged | — | — |
| FR-V2-041 | Guidance/configuration separation | KEEP | §10 | Unchanged | — | — |
| FR-V2-042 | Admin refinement | KEEP | §10 | Unchanged | — | — |
| FR-V2-043 | Core configuration | KEEP | §11 | Unchanged | — | — |
| FR-V2-044 | Name and description | KEEP | §11 | Unchanged | — | — |
| FR-V2-045 | Timing | KEEP | §11 | Unchanged | — | — |
| FR-V2-046 | Instructions | KEEP | §11 | Unchanged | — | — |
| FR-V2-047 | Eligibility | KEEP | §11 | Unchanged | — | — |
| FR-V2-048 | Restriction location | KEEP | §11 | Unchanged | — | — |
| FR-V2-049 | Valid configuration | KEEP | §11 | Unchanged | — | — |
| FR-V2-050 | Browse Challenges | KEEP | §12 | Unchanged | — | — |
| FR-V2-051 | Group context | KEEP | §12 | Unchanged | — | — |
| FR-V2-052 | Home surfacing | KEEP | §12 | Unchanged | — | — |
| FR-V2-053 | Interest relevance | KEEP | §12 | Unchanged | — | — |
| FR-V2-054 | Recommendation is not enrollment | KEEP | §12 | Unchanged | — | — |
| FR-V2-055 | Challenge preview | KEEP | §12 | Unchanged | — | — |
| FR-V2-056 | Affirmative joining | KEEP | §13 | Unchanged | — | — |
| FR-V2-057 | No automatic enrollment | KEEP | §13 | Unchanged | — | — |
| FR-V2-058 | Eligibility enforcement | KEEP | §13 | Unchanged | — | — |
| FR-V2-059 | Participation attribution | KEEP | §13 | Unchanged | — | — |
| FR-V2-060 | Participation is non-governing | KEEP | §13 | Unchanged | — | — |
| FR-V2-061 | Withdrawal | KEEP | §13 | Unchanged | — | — |
| FR-V2-062 | Removal | KEEP | §13 | Unchanged | — | — |
| FR-V2-063 | Historical preservation | KEEP | §13 | Unchanged | — | — |
| FR-V2-064 | Participant Activity | KEEP | §14 | Unchanged | — | — |
| FR-V2-065 | Self-accountability model | KEEP | §14 | Unchanged | — | — |
| FR-V2-066 | No false certification | KEEP | §14 | Unchanged | — | — |
| FR-V2-067 | Plausibility safeguards | KEEP | §14 | Unchanged | — | — |
| FR-V2-068 | Safeguard boundary | KEEP | §14 | Unchanged | — | — |
| FR-V2-069 | Community accountability | KEEP | §14 | Unchanged | — | — |
| FR-V2-070 | Submission Intent | KEEP | §15 | Unchanged | — | — |
| FR-V2-071 | Evidence Eligibility | KEEP | §15 | Unchanged | — | — |
| FR-V2-072 | Acceptance Authority | KEEP | §15 | Unchanged | — | — |
| FR-V2-073 | Accepted Activity Event | KEEP | §15 | Unchanged | — | — |
| FR-V2-074 | Calculation Authority | KEEP | §15 | Unchanged | — | — |
| FR-V2-075 | Derived Truth | KEEP | §15 | Unchanged | — | — |
| FR-V2-076 | No parallel acceptance gate | KEEP | §15 | Unchanged | — | — |
| FR-V2-077 | Deferred verification | KEEP | §15 | Unchanged | — | Guards ACT-03 |
| FR-V2-078 | Deferred correction authority | KEEP | §15 | Unchanged | — | Guards ACT-04 |
| FR-V2-079 | Progress visibility | KEEP | §16 | Unchanged | — | — |
| FR-V2-080 | Remaining requirement | KEEP | §16 | Unchanged | — | — |
| FR-V2-081 | Type-specific calculation | KEEP | §16 | Unchanged | — | — |
| FR-V2-082 | Underlying Activity distinction | KEEP | §16 | Unchanged | — | — |
| FR-V2-083 | Shared Goal | KEEP | §17 | Unchanged | — | — |
| FR-V2-084 | Contribution aggregation | ALIGNED WORDING | §17 | Aligned to governed calculation rules | Calculation Model | References governed Collective calculation rules explicitly |
| FR-V2-085 | Individual contribution | KEEP | §17 | Unchanged | — | — |
| FR-V2-086 | Goal-reached completion | ALIGNED WORDING | §17 | Aligned; overshoot recording added | Calculation Model | Contribution crossing Goal recorded in full |
| FR-V2-087 | Time-expiry completion | KEEP | §17 | Unchanged | — | — |
| FR-V2-088 | Active extension | ALIGNED WORDING | §17 | Aligned; "while Active only" | Calculation Model | Extension while Active only; not after end |
| FR-V2-089 | Extension continuity | KEEP | §17 | Unchanged | — | — |
| FR-V2-090 | No post-end extension | KEEP | §17 | Unchanged | — | — |
| FR-V2-091 | No forced ranking | KEEP | §17 | Unchanged | — | — |
| FR-V2-092 | Individual competitive progress | KEEP | §18 | Unchanged | — | — |
| FR-V2-093 | No shared accumulation | KEEP | §18 | Unchanged | — | — |
| FR-V2-094 | Comparative standing | KEEP | §18 | Unchanged | — | — |
| FR-V2-095 | Individual early completion | KEEP | §18 | Unchanged | — | — |
| FR-V2-096 | Individual finish does not close Challenge | KEEP | §18 | Unchanged | — | — |
| FR-V2-097 | Scheduled Challenge closure | KEEP | §18 | Unchanged | — | — |
| FR-V2-098 | Unfinished Participant result | KEEP | §18 | Unchanged | — | — |
| FR-V2-099 | No false completion | KEEP | §18 | Unchanged | — | — |
| FR-V2-100 | Finish order | KEEP | §18 | Unchanged | — | — |
| FR-V2-101 | Tie rules explicit | SUPERSEDED | §18 | Settled: shared position, no artificial tie-break | Reconciliation F-B-02; Calculation §16 | SUPERSEDED — No separate replacement FR. Settled rule embedded in FR-V2-094/FR-V2-100 context: identical completion points share position, no artificial tie-breaker. T1 §K; Calculation §16. |
| FR-V2-102 | Non-completer ordering explicit | SUPERSEDED | §18 | Settled: no position, no label, progress visible | Reconciliation F-B-02; Calculation §17 | SUPERSEDED — No separate replacement FR. Settled rule embedded in FR-V2-098 context: non-completers receive no finishing position, actual progress visible, never labelled failed. T1 §K; Calculation §17. |
| FR-V2-103 | No assumed extension | KEEP | §18 | Unchanged | — | — |
| FR-V2-104 | Individual Streak | KEEP | §19 | Unchanged | — | — |
| FR-V2-105 | Required interval | ALIGNED WORDING | §19 | Aligned to daily Activity requirement | Calculation Model §20 | Initial V2 is daily only |
| FR-V2-106 | Interval success | KEEP | §19 | Unchanged | — | — |
| FR-V2-107 | Missed interval reset | ALIGNED WORDING | §19 | Aligned to daily interval | Calculation Model | Failure to satisfy daily interval resets Current Streak |
| FR-V2-108 | Reset does not remove Participant | KEEP | §19 | Unchanged | — | — |
| FR-V2-109 | Continue after reset | KEEP | §19 | Unchanged | — | — |
| FR-V2-110 | Preserve prior Streak history | KEEP | §19 | Unchanged | — | — |
| FR-V2-111 | End by period | KEEP | §19 | Unchanged | — | — |
| FR-V2-112 | No ordinary early finish | KEEP | §19 | Unchanged | — | — |
| FR-V2-113 | Current Streak | KEEP | §19 | Unchanged | — | — |
| FR-V2-114 | Best Streak | KEEP | §19 | Unchanged | — | — |
| FR-V2-115 | Completed intervals | KEEP | §19 | Unchanged | — | — |
| FR-V2-116 | No assumed extension | KEEP | §19 | Unchanged | — | — |
| FR-V2-117 | Late-join rule required | SUPERSEDED | §19 | Settled: late join permitted, full period, no shortening | Reconciliation F-C-02; Calculation §§30-31 | SUPERSEDED — No separate replacement FR. Settled rule: late joining permitted where eligible, does not change denominator. T1 §L; Calculation §§30-31. |
| FR-V2-118 | Late-log rule required | SUPERSEDED | §19 | Settled: no grace period, day must be Done | Reconciliation F-C-02; Calculation §26 | SUPERSEDED — No separate replacement FR. Settled rule: no ordinary late-logging grace period. T1 §L; Calculation §26. |
| FR-V2-119 | Time-boundary rule required | SUPERSEDED | §19 | Settled: one governing timezone, device changes no effect | Reconciliation F-C-02; Calculation §27 | SUPERSEDED — No separate replacement FR. Settled rule: one governing Challenge timezone. T1 §L; Calculation §27. |
| FR-V2-120 | Type-specific completion | KEEP | §20 | Unchanged | — | — |
| FR-V2-121 | Finalization | KEEP | §20 | Unchanged | — | — |
| FR-V2-122 | No same-identity reopening | KEEP | §20 | Unchanged | — | — |
| FR-V2-123 | Run Again | KEEP | §20 | Unchanged | — | — |
| FR-V2-124 | New identity on repeat | KEEP | §20 | Unchanged | — | — |
| FR-V2-125 | New participation | KEEP | §20 | Unchanged | — | — |
| FR-V2-126 | New progress | KEEP | §20 | Unchanged | — | — |
| FR-V2-127 | Preserve original | KEEP | §20 | Unchanged | — | — |
| FR-V2-128 | Challenge Feed | SUPERSEDED | §21 | Settled: Group Feed is single stream, no Home Feed | Reconciliation F-E-01; Notifications baseline §§3,7 | SUPERSEDED — No active replacement FR. Challenge Feed concept replaced by Group Feed (single community stream) + Challenge view (operational). Home is not a Feed. T1 §§O,P; Notifications baseline §§3,7. |
| FR-V2-129 | Feed events | SUPERSEDED | §21 | Settled: state events + explicit Share only | Reconciliation F-E-01; Notifications baseline §§8-12 | SUPERSEDED — No active replacement FR. Feed content model replaced by: meaningful automatic state events + explicit Share-to-Group only. T1 §P; Notifications baseline §§8-12. |
| FR-V2-130 | Feed is not truth source | KEEP | §21 | Unchanged | — | — |
| FR-V2-131 | Kudos | KEEP | §21 | Unchanged | — | — |
| FR-V2-132 | Kudos do not affect performance | KEEP | §21 | Unchanged | — | — |
| FR-V2-133 | Comments/replies | SUPERSEDED | §21 | Settled: no comments/replies in initial V2 | Reconciliation F-E-01; Notifications baseline §20 | SUPERSEDED — No active replacement FR. Capability explicitly excluded from initial V2. T1 §Q; Notifications baseline §20. |
| FR-V2-134 | Social interaction authority boundary | KEEP (updated) | §21 | Updated: removed comments/replies reference | Reconciliation F-E-01 | Kudos and reactions boundary preserved |
| FR-V2-135 | Sharing capability | KEEP | §22 | Unchanged | — | — |
| FR-V2-136 | Visibility enforcement | KEEP | §22 | Unchanged | — | — |
| FR-V2-137 | No visibility bypass | KEEP | §22 | Unchanged | — | — |
| FR-V2-138 | Challenge notifications | KEEP | §23 | Unchanged | — | — |
| FR-V2-139 | Notification events | KEEP | §23 | Unchanged | — | — |
| FR-V2-140 | Non-coercive notifications | KEEP | §23 | Unchanged | — | — |
| FR-V2-141 | Trigger specification | KEEP | §23 | Unchanged | — | — |
| FR-V2-142 | Recognition distinction | KEEP | §24 | Unchanged | — | — |
| FR-V2-143 | Group encouragement distinction | KEEP (updated) | §24 | Updated: removed comments reference | Reconciliation F-E-01 | Comments removed in initial V2 |
| FR-V2-144 | Leaderboard distinction | KEEP | §24 | Unchanged | — | — |
| FR-V2-145 | Challenge logic | KEEP | §24 | Unchanged | — | — |
| FR-V2-146 | No engine authority | KEEP | §24 | Unchanged | — | — |
| FR-V2-147 | MOT-01 preservation | KEEP | §24 | Unchanged | — | Guards MOT-01 |
| FR-V2-148 | Preserve future rewards | KEEP | §25 | Unchanged | — | — |
| FR-V2-149 | No Phase-1 reward system | KEEP | §25 | Unchanged | — | — |
| FR-V2-150 | Reward/performance distinction | KEEP | §25 | Unchanged | — | — |
| FR-V2-151 | Free use | KEEP | §26 | Unchanged | — | — |
| FR-V2-152 | Free Group participation | KEEP | §26 | Unchanged | — | — |
| FR-V2-153 | Free Challenge participation | KEEP | §26 | Unchanged | — | — |
| FR-V2-154 | Voluntary support | KEEP | §26 | Unchanged | — | — |
| FR-V2-155 | Profile CTA | KEEP | §27 | Unchanged | — | — |
| FR-V2-156 | Challenge option | KEEP | §27 | Unchanged | — | — |
| FR-V2-157 | Suggested amount | KEEP | §27 | Unchanged | — | — |
| FR-V2-158 | Open amount | KEEP | §27 | Unchanged | — | — |
| FR-V2-159 | Voluntary nature | KEEP | §27 | Unchanged | — | — |
| FR-V2-160 | No performance effect | KEEP | §27 | Unchanged | — | — |
| FR-V2-161 | Tiizi beneficiary | KEEP | §27 | Unchanged | — | — |
| FR-V2-162 | Payment provider deferred | KEEP | §27 | Unchanged | — | — |
| FR-V2-163 | Cause option | KEEP | §28 | Unchanged | — | — |
| FR-V2-164 | Cause information | KEEP | §28 | Unchanged | — | — |
| FR-V2-165 | Cause Goal | KEEP | §28 | Unchanged | — | — |
| FR-V2-166 | Separate Goals | KEEP | §28 | Unchanged | — | — |
| FR-V2-167 | Voluntary contribution | KEEP | §28 | Unchanged | — | — |
| FR-V2-168 | No performance effect | KEEP | §28 | Unchanged | — | — |
| FR-V2-169 | Proposed payment destination | KEEP | §28 | Unchanged | — | — |
| FR-V2-170 | Approval before go-live | ALIGNED WORDING | §28 | Aligned: fundraising capability specifically | Contribution Model | Fundraising capability requires approval |
| FR-V2-171 | Due-diligence capability | ALIGNED WORDING | §28 | Aligned: review state/process | Contribution Model | Product supports review state/process |
| FR-V2-172 | Ordinary Challenge boundary | KEEP | §28 | Unchanged | — | — |
| FR-V2-173 | Approval status | KEEP | §28 | Unchanged | — | — |
| FR-V2-174 | Contribution privacy | KEEP | §28 | Unchanged | — | — |
| FR-V2-175 | Historical Challenge access | KEEP | §29 | Unchanged | — | — |
| FR-V2-176 | Preserve identity | KEEP | §29 | Unchanged | — | — |
| FR-V2-177 | Preserve configuration | KEEP | §29 | Unchanged | — | — |
| FR-V2-178 | Preserve participation | KEEP | §29 | Unchanged | — | — |
| FR-V2-179 | Preserve outcomes | KEEP | §29 | Unchanged | — | — |
| FR-V2-180 | Correction traceability | KEEP | §29 | Unchanged | — | — |
| FR-V2-181 | No silent rewrite | KEEP | §29 | Unchanged | — | — |
| FR-V2-182 | Privacy before convenience | KEEP | §30 | Unchanged | — | — |
| FR-V2-183 | Minimum necessary | KEEP | §30 | Unchanged | — | — |
| FR-V2-184 | Consent | KEEP | §30 | Unchanged | — | — |
| FR-V2-185 | Withdrawal effect | KEEP | §30 | Unchanged | — | — |
| FR-V2-186 | Ownership/access distinction | KEEP | §30 | Unchanged | — | — |
| FR-V2-187 | Authorized Admin management | KEEP | §31 | Unchanged | — | — |
| FR-V2-188 | Activity management | KEEP | §31 | Unchanged | — | — |
| FR-V2-189 | Template management | KEEP | §31 | Unchanged | — | — |
| FR-V2-190 | Admin is mechanism | KEEP | §31 | Unchanged | — | — |
| FR-V2-191 | Governance trace | KEEP | §31 | Unchanged | — | — |
| FR-V2-192 | Configurable targets | KEEP | §32 | Unchanged | — | — |
| FR-V2-193 | Configurable sets | KEEP | §32 | Unchanged | — | — |
| FR-V2-194 | Configurable duration | KEEP | §32 | Unchanged | — | — |
| FR-V2-195 | Configurable instructions | KEEP | §32 | Unchanged | — | — |
| FR-V2-196 | Optional capabilities | KEEP | §32 | Unchanged | — | — |
| FR-V2-197 | Boundary enforcement | KEEP | §32 | Unchanged | — | — |
| FR-V2-198 | Competitive tie-breaking | ALIGNED WORDING | §33 | Settled: shared position, no tie-breaker | Reconciliation F-B-02; Calculation §16 | Was open; now settled |
| FR-V2-199 | Competitive non-completer ordering | ALIGNED WORDING | §33 | Settled: no position, no label | Reconciliation F-B-02; Calculation §17 | Was open; now settled |
| FR-V2-200 | Streak late joining | ALIGNED WORDING | §33 | Settled: late join permitted, full period | Reconciliation F-C-02; Calculation §§30-31 | Was open; now settled |
| FR-V2-201 | Streak late logging | ALIGNED WORDING | §33 | Settled: no grace period | Reconciliation F-C-02; Calculation §26 | Was open; now settled |
| FR-V2-202 | Streak time boundaries | ALIGNED WORDING | §33 | Settled: one governing timezone | Reconciliation F-C-02; Calculation §27 | Was open; now settled |
| FR-V2-203 | Notification rules | DOWNSTREAM | §33 | Substantially addressed; residual is downstream | Notifications baseline | Exact trigger catalogue is downstream |
| FR-V2-204 | Cause due diligence | DOWNSTREAM | §33 | Proper downstream deferral | Reconciliation | Operational review requirements are downstream |
| FR-V2-205 | Contribution visibility | ALIGNED WORDING | §33 | Settled: labelled as Participant reports | Contribution Model §24 | Was open; now settled |
| FR-V2-206 | Detailed calculation specification | ALIGNED WORDING | §33 | Settled: Calculation Model rules 1-25 provided | Calculation Model | Was open; now settled |

---

## New Requirements Introduced Through Reconciliation

The following requirements were **not** present in the Founder Working Baseline and have
been introduced through reconciliation. They are allocated sequential identifiers beginning at FR-V2-207
to maintain clear traceability while preserving the original 001–206 numbering intact.

| New FR ID | Subject | Disposition | Final T2 Location | Source/Reconciliation Finding |
|-----------|---------|-------------|-------------------|-------------------------------|
| FR-V2-207 | Challenge-specific Activity logging | NEW | §14 | Reconciliation F-A-01; Calculation Model §§3, 40(1-2) |
| FR-V2-208 | No Highest Performance mode | NEW | §18 | Reconciliation F-B-01; Calculation Model |
| FR-V2-209 | Daily-only Streak | NEW | §19 | Reconciliation F-C-01; Calculation Model §20 |
| FR-V2-210 | Multi-Activity Streak | NEW | §19 | Calculation Model §24 |
| FR-V2-211 | No Streak Leaderboard | NEW | §19 | Calculation Model §34; Recognition §16 |
| FR-V2-212 | Share to Group is explicit | NEW | §22 | Notifications baseline §§14-15 |

**Identifier convention:** New requirements are allocated sequential identifiers beginning at FR-V2-207
(FR-V2-207 through FR-V2-212). This preserves the original 001–206 numbering intact while
providing a clear, sequential range for all new requirements introduced through reconciliation.

---

# Part 4: Non-Authorizations

> This Part carries forward the non-authorizations from the Founder Working Baseline §32
> and extends them for the DRAFT controlled requirements instrument.

This DRAFT does **not** authorize:

- production code;
- database migrations;
- Firestore restructuring;
- API contracts;
- payment integration;
- payment custody;
- Social Cause payment routing;
- reward systems;
- reward custody, entitlement, escrow, payout, or fulfilment;
- technical RBAC/IAM;
- migration from V1;
- deployment;
- infrastructure selection;
- ACT-03 resolution (Verification Authority);
- ACT-04 resolution (Correction Authority);
- MOT-01 resolution (Recognition Authority);
- notification trigger catalogue as canonical product behaviour (see FR-V2-141, FR-V2-203);
- operational cause-review criteria or due diligence procedures (see FR-V2-204);
- Highest Performance Competitive mode (see FR-V2-208);
- weekly-frequency Streak calculations (see FR-V2-209);
- comments or reply threads on Feed items (see FR-V2-133 supersession);
- Streak Participant leaderboard (see FR-V2-211).

These require their applicable governed stage and authority.

---

# Part 5: Appendices

---

## Appendix A: FR-V2 Reconciliation Schedule (Summary)

This Appendix provides a summary view of the reconciliation schedule. The full table is
in Part 3.

### Disposition Statistics

| Disposition | Count | Percentage |
|-------------|-------|------------|
| KEEP (unchanged) | 180 | 87.4% |
| KEEP (updated wording) | 2 | 1.0% |
| ALIGNED WORDING | 14 | 6.8% |
| SUPERSEDED | 8 | 3.9% |
| DOWNSTREAM | 2 | 1.0% |
| **Total original (FR-V2-001 to FR-V2-206)** | **206** | **100%** |

| New Requirements | Count |
|-----------------|-------|
| NEW (FR-V2-207 to FR-V2-212) | 6 |
| **Total requirements in DRAFT** | **212** |

### Disposition by Section

| Section | Section Title | Total FRs | KEEP | ALIGNED | SUPERSEDED | DOWNSTREAM | NEW |
|---------|--------------|-----------|------|---------|------------|------------|-----|
| §5 | Core Product Structure | 6 | 6 | 0 | 0 | 0 | 0 |
| §6 | Group Creation and Community Governance | 9 | 9 | 0 | 0 | 0 | 0 |
| §7 | Group Discovery and Visibility | 6 | 6 | 0 | 0 | 0 | 0 |
| §8 | Challenge Creation | 7 | 7 | 0 | 0 | 0 | 0 |
| §9 | Templates | 6 | 6 | 0 | 0 | 0 | 0 |
| §10 | Activity Library and Challenge Configuration | 8 | 8 | 0 | 0 | 0 | 0 |
| §11 | Challenge Configuration | 7 | 7 | 0 | 0 | 0 | 0 |
| §12 | Challenge Discovery | 6 | 6 | 0 | 0 | 0 | 0 |
| §13 | Voluntary Challenge Participation | 8 | 8 | 0 | 0 | 0 | 0 |
| §14 | Activity Logging and Self-Accountability | 6+1 | 6 | 0 | 0 | 0 | 1 |
| §15 | Evidence and Truth Chain | 9 | 9 | 0 | 0 | 0 | 0 |
| §16 | Shared Challenge Progress | 4 | 4 | 0 | 0 | 0 | 0 |
| §17 | Collective Challenge Requirements | 9 | 6 | 3 | 0 | 0 | 0 |
| §18 | Competitive Challenge Requirements | 12+1 | 10 | 0 | 2 | 0 | 1 |
| §19 | Streak Challenge Requirements | 16+3 | 11 | 2 | 3 | 0 | 3 |
| §20 | Challenge Completion, Finalization and Reuse | 8 | 8 | 0 | 0 | 0 | 0 |
| §21 | Home, Feed, and Community Experience | 7 | 4 | 0 | 3 | 0 | 0 |
| §22 | Sharing | 3+1 | 3 | 0 | 0 | 0 | 1 |
| §23 | Notifications | 4 | 4 | 0 | 0 | 0 | 0 |
| §24 | Recognition | 6 | 6 | 0 | 0 | 0 | 0 |
| §25 | Future Rewards | 3 | 3 | 0 | 0 | 0 | 0 |
| §26 | Free Platform Principle | 4 | 4 | 0 | 0 | 0 | 0 |
| §27 | Support Tiizi | 8 | 8 | 0 | 0 | 0 | 0 |
| §28 | Social Cause Support | 12 | 10 | 2 | 0 | 0 | 0 |
| §29 | Historical Integrity | 7 | 7 | 0 | 0 | 0 | 0 |
| §30 | Privacy, Visibility and Consent | 5 | 5 | 0 | 0 | 0 | 0 |
| §31 | Admin and Content Operations | 5 | 5 | 0 | 0 | 0 | 0 |
| §32 | Product Flexibility | 6 | 6 | 0 | 0 | 0 | 0 |
| §33 | Settlement of Formerly Open Questions | 9 | 0 | 7 | 0 | 2 | 0 |

---

## Appendix B: New Requirements Justification

This Appendix explains why each new requirement was introduced.

### FR-V2-207 — Challenge-specific Activity logging

**Why needed:** The Founder Working Baseline established the self-accountability model
(§14) and the evidence/truth chain (§15), but did not explicitly state that Activity
logging is Challenge-specific. The Calculation Model makes this a governing principle:
each Challenge maintains its own independent Activity record. Without this requirement,
an implementation could infer that a single Activity log propagates across all Challenges
a Participant has joined.

**Source:** Reconciliation F-A-01; Calculation Model §§3, 40(1-2).

**Relationship to existing FRs:** Complements FR-V2-064 (Participant Activity) and
FR-V2-075 (Derived Truth). Does not contradict any existing requirement.

---

### FR-V2-208 — No Highest Performance mode

**Why needed:** The baseline defined Competitive Challenges in terms of individual
performance and comparative standing, but did not explicitly exclude a Highest Performance
mode (where Participants are ranked by maximum achievement rather than first-to-target).
The Product Definition DRAFT confirms that initial V2 Competitive Challenges operate
exclusively as a race to the configured target.

**Source:** Reconciliation F-B-01; Calculation Model.

**Relationship to existing FRs:** Constrains FR-V2-094 (Comparative standing) and
FR-V2-100 (Finish order). Does not contradict any existing requirement.

---

### FR-V2-209 — Daily-only Streak

**Why needed:** The baseline used the general term "required interval" (FR-V2-105)
without specifying that initial V2 is daily-frequency only. The Calculation Model
confirms daily-only scope. Without this requirement, an implementation could introduce
weekly or other non-daily frequency Streak calculations.

**Source:** Reconciliation F-C-01; Calculation Model §20.

**Relationship to existing FRs:** Constrains FR-V2-105 (Required interval) and
FR-V2-107 (Missed interval reset). Does not contradict any existing requirement.

---

### FR-V2-210 — Multi-Activity Streak

**Why needed:** The baseline did not address the case where a Streak Challenge configures
multiple distinct daily Activities. The Calculation Model establishes that all configured
daily requirements must be satisfied for the day to count. Without this requirement, the
multi-Activity case is undefined.

**Source:** Calculation Model §24.

**Relationship to existing FRs:** Supplements FR-V2-106 (Interval success) and
FR-V2-107 (Missed interval reset) for the multi-Activity case. Does not contradict any
existing requirement.

---

### FR-V2-211 — No Streak Leaderboard

**Why needed:** The baseline did not explicitly state that Streak Challenges do not
produce a Participant leaderboard. While FR-V2-091 addresses this for Collective
Challenges, no equivalent exists for Streak. The Calculation Model and Recognition
framework confirm that Streak results are personal Derived Truth, not competitive
standing.

**Source:** Calculation Model §34; Recognition §16.

**Relationship to existing FRs:** Consistent with FR-V2-091 (No forced ranking for
Collective). Extends the same principle to Streak. Does not contradict any existing
requirement.

---

### FR-V2-212 — Share to Group is explicit

**Why needed:** The reconciliation of §21 (Reconciliation F-E-01) established that Group
Feed content comes from state events and explicit Share. However, the Sharing section
(§22) did not explicitly state that personal Activity, milestones, and Recognition do not
automatically enter the Group Feed. This requirement makes the explicit-Share principle
traceable in the Sharing section.

**Source:** Notifications baseline §§14-15.

**Relationship to existing FRs:** Complements FR-V2-129 (Group Feed content, superseded
text) and FR-V2-136 (Visibility enforcement). Does not contradict any existing
requirement.

---

## Appendix C: Source Traceability

This Appendix traces each reconciliation finding back to its governance source.

### Reconciliation Findings Referenced

| Finding ID | Subject | Source Document | Source Section(s) | Requirements Affected |
|------------|---------|----------------|-------------------|----------------------|
| F-A-01 | Challenge-specific Activity logging | Stage F Product Definition DRAFT — Calculation Model | §§3, 40(1-2) | FR-V2-207 (new) |
| F-B-01 | No Highest Performance mode | Stage F Product Definition DRAFT — Calculation Model | Competitive scope | FR-V2-208 (new) |
| F-B-02 | Competitive tie and non-completer rules | Stage F Product Definition DRAFT — Calculation Model | §§16, 17 | FR-V2-101 (superseded), FR-V2-102 (superseded), FR-V2-198 (settled), FR-V2-199 (settled) |
| F-C-01 | Daily-only Streak | Stage F Product Definition DRAFT — Calculation Model | §20 | FR-V2-209 (new) |
| F-C-02 | Streak late-join, late-log, time boundaries | Stage F Product Definition DRAFT — Calculation Model | §§26, 27, 30-31 | FR-V2-117 (superseded), FR-V2-118 (superseded), FR-V2-119 (superseded), FR-V2-200 (settled), FR-V2-201 (settled), FR-V2-202 (settled) |
| F-E-01 | Feed and community experience | Stage F Product Definition DRAFT — Notifications baseline | §§3, 7-12, 14-15, 20 | FR-V2-128 (superseded), FR-V2-129 (superseded), FR-V2-133 (superseded), FR-V2-134 (updated), FR-V2-212 (new), FR-V2-143 (updated) |

### Governance Instruments Referenced

| Instrument | Abbreviation | Approval Date | Role in This Document |
|-----------|--------------|---------------|----------------------|
| Tiizi Constitutional Ontology & Foundational Product Concepts | Document 00 | — | Foundational concepts and constraints |
| EOG-E1-01 Tiizi Entity & Operational Governance Standard v0.2 | EOG-E1-01 | 2026-09-03 | Entity definitions, operational governance |
| EKG-01 Tiizi Knowledge Governance Standard v0.1 | EKG-01 | 2026-09-02 | Canonical Knowledge governance |
| CGP-04 Entity Relationship Allocation Register v0.1 | CGP-04 | 2026-09-01 | Entity relationship allocation |
| Stage F Founder Working Baseline Reconciliation | RECON-001 | 2026-09-05 (d5f3baf) | Reconciliation dispositions |
| Stage F Product Definition DRAFT (companion T1) | T1 DRAFT | 2026-09-05 | Settled product definitions |

### Product Definition DRAFT Sections Referenced

| Section | Subject | Requirements Settled or Affected |
|---------|---------|--------------------------------|
| Calculation Model §3 | Challenge-specific Activity | FR-V2-207 |
| Calculation Model §16 | Competitive tie handling | FR-V2-101, FR-V2-198 |
| Calculation Model §17 | Non-completer treatment | FR-V2-102, FR-V2-199 |
| Calculation Model §20 | Daily Streak scope | FR-V2-209 |
| Calculation Model §24 | Multi-Activity daily Streak | FR-V2-210 |
| Calculation Model §26 | No late-logging grace | FR-V2-118, FR-V2-201 |
| Calculation Model §27 | Governing timezone | FR-V2-119, FR-V2-202 |
| Calculation Model §§30-31 | Late joining | FR-V2-117, FR-V2-200 |
| Calculation Model §34 | No Streak leaderboard | FR-V2-211 |
| Calculation Model §§40(1-2) | Challenge-specific logging | FR-V2-207 |
| Calculation Model rules 1-25 | Deterministic calculation | FR-V2-206 |
| Notifications baseline §§3, 7 | No Home Feed | FR-V2-128 |
| Notifications baseline §§8-12 | Feed content rules | FR-V2-129 |
| Notifications baseline §§14-15 | Explicit Share | FR-V2-212 |
| Notifications baseline §20 | No comments/replies | FR-V2-133 |
| Contribution Model §24 | Contribution labelling | FR-V2-205 |
| Recognition §16 | Streak recognition scope | FR-V2-211 |

---

# Document Control

| Field | Value |
|-------|-------|
| Document | Tiizi V2 — Stage F Functional Requirements |
| Type | Stage F Functional Requirements — DRAFT |
| Version | 0.1-draft |
| Date | 2026-09-05 |
| Status | Stage F Draft — Pending Founder Review |
| Supersedes | TIIZI-V2-STAGE-F-FUNCTIONAL-REQUIREMENTS-BASELINE-FOUNDER-WORKING-BASELINE-v0.1 (2026-09-04, SHA-256: 1a966fd7) |
| Reconciliation Branch | recon/stage-f-founder-baselines-001 |
| Reconciliation Commit | d5f3baf |
| Total Original FRs | 206 (FR-V2-001 through FR-V2-206) |
| New FRs | 6 (FR-V2-207, FR-V2-208, FR-V2-209, FR-V2-210, FR-V2-211, FR-V2-212) |
| Total Requirements in DRAFT | 212 |
| Preserved Deferrals | ACT-03, ACT-04, MOT-01, Rewards |

---

**End of DRAFT — Stage F Tiizi V2 Functional Requirements v0.1-draft**

> This document is a DRAFT. It does not authorize implementation.
> All requirements remain subject to Founder review and approval before
> becoming controlled Stage F instruments.
