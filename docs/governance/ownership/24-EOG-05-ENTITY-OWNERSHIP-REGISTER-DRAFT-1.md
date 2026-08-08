# EOG-05 — Entity Ownership Register

**Version:** Founder Review Draft 1

**Status:** Draft classification recommendations pending founder approval

**Date:** 2026-07-20

## 1. Purpose

This register defines the proposed constitutional inventory and classification of Tiizi entities. It identifies what Tiizi governs, what information concerns each entity, and the principal boundary that keeps each entity distinct.

This register does not allocate Authority, Accountable Stewardship, Custody, Administration, Operation, Contribution, Participation, Delegation, Presentation, downstream use or attributable origin. Those relationships belong to the separately approved but operationally deferred Entity Relationship Allocation Register.

## 2. Constitutional Status and Approval Boundary

This is Founder Review Draft 1. Its classifications are recommendations, not approved Entity Ownership governance.

The draft applies the [approved separated-register architecture](23-EOG-05-ARCHITECTURE-APPROVAL-RECORD.md) and the [Drafting Authorization Report](23-EOG-05-INVENTORY-REGISTER-DRAFTING-AUTHORIZATION-REPORT.md). It assesses all 72 Phase 0 candidates. It proposes 58 for inclusion on source-grounded treatment and preserves 14 as provisional under CG-01 through CG-08.

Inclusion in this draft does not allocate an EOG-01 relationship. A provisional entry does not approve independent entity status.

## 3. Constitutional Precedence and Source Keys

| Key | Source |
|---|---|
| E1 | [EOG-01 — Platform Accountability Framework](04-PLATFORM-ACCOUNTABILITY-FRAMEWORK.md) and [Founder Approval Record](05-EOG-01-FOUNDER-APPROVAL-RECORD.md) |
| E2 | [EOG-02 — Constitutional Accountability for Groups](06-EOG-02-CONSTITUTIONAL-ACCOUNTABILITY-FRAMEWORK-FOR-GROUPS.md) and [Founder Approval Record](07-EOG-02-FOUNDER-APPROVAL-RECORD.md) |
| E3 | [EOG-03 — Constitutional Governance of Platform Knowledge](14-EOG-03-CONSTITUTIONAL-GOVERNANCE-OF-PLATFORM-KNOWLEDGE-APPROVED.md) |
| E4 | [EOG-04 — Constitutional Governance of Challenges](20-EOG-04-CONSTITUTIONAL-GOVERNANCE-OF-CHALLENGES-APPROVED.md) |
| DATA | [Platform Data and Information Standard](../platform/08-PLATFORM-DATA-AND-INFORMATION-STANDARD.md) |
| DOM | [Foundational Domain Standards](../domains/) |
| P0 | [Phase 0 Candidate Entity Inventory](21-EOG-05-CANDIDATE-ENTITY-INVENTORY.md), [Coverage Matrix](21-EOG-05-RELATIONSHIP-COVERAGE-MATRIX.md) and [Dependency Map](21-EOG-05-DEPENDENCY-MAP.md) |
| ARCH | [Phase 1 Blueprint](22-EOG-05-PHASE-1-CONSTITUTIONAL-REGISTER-ARCHITECTURE-AND-SEPARATION-BLUEPRINT.md) and [Phase 2 Approval](23-EOG-05-ARCHITECTURE-APPROVAL-RECORD.md) |

Higher-order approved governance takes precedence. P0 and ARCH control drafting scope and architecture; they do not independently establish entity meaning.

## 4. Interpretation Rules

1. **Entity identity is not allocation.** A classification says what the entity is, not who holds a relationship to it.
2. **Governed Subject and Information Subject remain distinct.** A Governed Subject is governed in its own right. Information Subject treatment states what the information primarily concerns.
3. **One primary category.** Every candidate has one proposed primary category from DATA. The category does not determine visibility, access or accountability.
4. **No implied actor.** An entity, fact, function, mechanism or representation does not exercise Authority merely because it is governed.
5. **Provisional means unresolved.** A provisional Entity ID supports review and traceability only. It does not approve permanent row treatment.
6. **No alias by convenience.** “—” in the Approved alias column means no alias is constitutionally approved. Similar or historical wording does not become an alias by use.
7. **No duplicate truth.** A subtype, representation, relationship or contextual fact must not become a competing entity or source of truth.
8. **Source traceability is mandatory.** Every proposed inclusion and provisional treatment identifies its governing source and dependency.
9. **Classification change requires impact review.** Later approval, consolidation or exclusion must assess every linked allocation before an allocation register is amended.
10. **Draft status remains explicit.** “Proposed inclusion” and “Provisional” are review states, not lifecycle states.

## 5. Register Columns

| Column | Meaning |
|---|---|
| Entity ID | Stable proposed identifier, or provisional identifier where a classification gate remains open. |
| Canonical name | Proposed constitutional name. |
| Approved alias | Alias expressly approved by source governance; “—” means none. |
| Domain | Principal constitutional domain or cross-platform context. |
| Governed Subject classification | Proposed independent-subject treatment or the unresolved classification question. |
| Information Subject treatment | What information about the candidate primarily concerns. |
| Constitutional definition | Concise source-grounded meaning. |
| Principal boundary | The distinction the inventory must preserve. |
| Primary category | One category from DATA. |
| Classification status | Proposed inclusion or Provisional with a named gate. |
| Sources and dependency | Governing source keys and unresolved decision or gate where applicable. |

## 6. Entity Ownership Register

### 6.1 Human and Identity

| Entity ID | Canonical name | Approved alias | Domain | Governed Subject classification | Information Subject treatment | Constitutional definition | Principal boundary | Primary category | Classification status | Sources and dependency |
|---|---|---|---|---|---|---|---|---|---|---|
| HID-01 | Person | — | Profile | Independent human subject | The human person | The human subject who may hold governed identity and participation relationships. | Person is not Identity or Profile. | Identity Information | Proposed inclusion | DOM; DATA |
| HID-02 | Identity | — | Profile | Independent identity subject | The Person recognized in governed context | The governed identity context through which a Person is recognized and attributable. | Identity is not the Person or its Profile representation. | Identity Information | Proposed inclusion | DOM; DATA |
| HID-03 | Profile | — | Profile | Independent profile subject | The Person represented through Identity | The governed representation of Identity supporting safe participation, privacy, preferences and accountability. | Profile is not Identity, Challenge truth or an individual-challenge mode. | Identity Information | Proposed inclusion | DOM; DATA |
| HID-04 | Preference | — | Profile | Independent personal-expression subject | The Person expressing a preference | A governed expression of a Person's permitted preference for a declared purpose. | Preference does not establish Knowledge, Policy or participation. | Identity Information | Proposed inclusion | E3; DOM; KNW-04 remains separate |
| HID-05 | Interest | — | Profile | Independent personal-expression subject | The Person expressing an interest | A governed expression of relevance or interest used within future discovery and personalisation boundaries. | Interest is not Platform Knowledge or an Activity merely because it uses a governed term. | Identity Information | Proposed inclusion | E3; DOM; KNW-04 and Discovery governance remain pending |
| HID-06 | Consent expression | — | Profile | Independent expression subject | The Person making the expression | An attributable expression of consent or withdrawal for a governed purpose. | The expression is not the authoritative Consent record. | Identity Information | Proposed inclusion | E1; DOM; later Consent standard |
| HID-07 | Consent record | — | Profile | Independent identity record subject | The Person and the declared consent context | The authoritative record that preserves an attributable consent expression and its governed context. | A record cannot extend consent beyond the expression and purpose recorded. | Identity Information | Proposed inclusion | DATA; DOM; later Consent standard |
| HID-08 | Privacy choice | — | Profile | Independent personal-choice subject | The Person and affected Profile information | A governed expression selecting an approved privacy or visibility treatment. | A display control is not a privacy choice unless its effect is governable and enforceable. | Identity Information | Proposed inclusion | E1; DATA; DOM; future Privacy Standard |

### 6.2 Group and Community

| Entity ID | Canonical name | Approved alias | Domain | Governed Subject classification | Information Subject treatment | Constitutional definition | Principal boundary | Primary category | Classification status | Sources and dependency |
|---|---|---|---|---|---|---|---|---|---|---|
| GRP-01 | Group | — | Group | Independent community subject | The persistent governed community | Tiizi's persistent governed community through which people organize, participate, collaborate and pursue shared purposes. | Group is not Challenge, audience or unrestricted social network. | Participation Information | Proposed inclusion | E2; E4; DOM |
| GRP-02 | Membership relationship | — | Group | Independent governed relationship | The Person–Group relationship | The governed relationship connecting a Person to a Group as a Member. | Membership is not Profile ownership, Challenge participation or governance. | Participation Information | Proposed inclusion | E2; E4; DOM; later Membership standard |
| GRP-03 | Member | — | Group | Independent contextual subject | The Person in a membership relationship | A Person recognized within a governed Group membership relationship. | Member is not Participant and membership grants no implied governance relationship. | Participation Information | Proposed inclusion | E2; E4; DOM |
| GRP-04 | Group purpose | — | Group | Candidate authoritative fact; independent-subject treatment unresolved | The Group | The founding and evolving purpose that explains why the Group exists. | Purpose is not the Group itself, Platform Policy or activity evidence. | Participation Information | Provisional — CG-01 | E2; P0; Group-purpose classification decision |
| GRP-05 | Group communication | — | Group | Independent communication subject | The attributable communication in Group context | Governed communication created within the Group's approved community context. | Communication is not membership truth, Submission Intent or evidence. | Participation Information | Proposed inclusion | E2; DOM; future Social and Moderation standards |
| GRP-06 | Group administrative action | — | Group | Independent administrative-action subject | The action, basis and affected Group subjects | An attributable high-impact or scoped administrative action concerning a Group. | The action does not become underlying Group, membership or Challenge truth. | Administrative Information | Proposed inclusion | E1; E2; DOM; future Administration standard |
| C-GRP-07 | Group Charter | — | Group | Independent governed charter subject | The Group and its governed constitutional commitments | The governed expression of a Group's identity, purpose and internal constitutional commitments. | Charter is not Platform governance, a role bundle or an implementation configuration. | Participation Information | Proposed inclusion | E2; later Charter governance |
| C-GRP-08 | Stewardship Council | — | Group | Approved supporting Governed Subject; permanent inventory treatment unresolved | The governed supporting body | A governed body established to support the singular Accountable Steward relationship of a Group. | Council membership is not Accountable Stewardship, Authority, Administration or Custody. | Participation Information | Provisional — CG-08 | E2; P0; future Stewardship Council governance |

### 6.3 Challenge and Composition Context

| Entity ID | Canonical name | Approved alias | Domain | Governed Subject classification | Information Subject treatment | Constitutional definition | Principal boundary | Primary category | Classification status | Sources and dependency |
|---|---|---|---|---|---|---|---|---|---|---|
| CHL-01 | Challenge | — | Challenge | Independent undertaking subject | The governed collective undertaking | Tiizi's constitutional expression of a governed, time-bounded collective Undertaking within a Group context. | Challenge is distinct from Group and every input to its Constitutional Composition. | Participation Information | Proposed inclusion | E3; E4; DOM |
| CHL-02 | Challenge purpose | — | Challenge | Candidate authoritative fact; independent-subject treatment unresolved | The Challenge | The declared reason the Challenge exists as a collective Undertaking. | Purpose is not Challenge identity, Goal, Policy or presentation. | Participation Information | Provisional — CG-01 | E4; P0; CHL-01 dependency |
| CHL-03 | Goal | — | Challenge | Candidate governed concept; independent-subject treatment unresolved | The Challenge objective | The defined outcome toward which Challenge participation is directed. | Goal is not Target, Progress, Completion or Platform Knowledge. | Participation Information | Provisional — CG-01 | E3; E4; P0; CHL-01 dependency |
| CHL-04 | Challenge Policy | — | Challenge | Independent policy subject | The rules applicable to the Challenge | The governed Policy that supplies rules applicable to a Challenge. | Challenge Policy is distinct from Knowledge, Group configuration and Challenge identity. | Knowledge Information | Proposed inclusion | E3; E4; DOM; later Policy governance |
| CHL-05 | Challenge participation relationship | — | Challenge | Independent governed relationship | The Person–Challenge relationship in Group context | The Challenge-specific governed relationship through which a Person participates. | Membership does not establish this relationship, and participation is not governance. | Participation Information | Proposed inclusion | E2; E4; DOM; later Participation standard |
| CHL-06 | Participant | — | Challenge | Independent contextual subject | The Person in a Challenge participation relationship | A Person acting within a governed Challenge participation context. | Participant is not Member by implication and gains no authority over other Participants. | Participation Information | Proposed inclusion | E1; E4; DOM |
| CHL-07 | Target | — | Challenge | Candidate authoritative fact; independent-subject treatment unresolved | The measurable or evaluable Challenge objective | A declared measure or condition against which a Challenge Goal may later be evaluated. | Target is not Goal, Metric, Progress, Completion or Ranking. | Participation Information | Provisional — CG-01 | E4; P0; CHL and RSK dependencies |
| CHL-08 | Challenge administrative action | — | Challenge | Independent administrative-action subject | The action, basis and affected Challenge subjects | An attributable scoped administrative action concerning a Challenge. | Administration cannot establish evidence, calculation truth or new Challenge meaning by implication. | Administrative Information | Proposed inclusion | E1; E4; DOM; future Administration standard |
| C-CHL-09 | Group Configuration | — | Challenge composition | Candidate composition input; independent-subject treatment unresolved | The Group's declared contribution to a composition | Governed Group-supplied configuration used in Constitutional Composition. | It is not Platform Knowledge, Policy or the resulting Challenge. | Participation Information | Provisional — CG-02 | E3; E4; P0; CHL and GRP dependencies |
| C-CHL-10 | Community Context | — | Challenge composition | Candidate contextual input; independent-subject treatment unresolved | The Group meaning surrounding an undertaking | Governed local context contributed by a Group to the meaning of a composed experience. | Community Context cannot redefine Platform Knowledge or applicable Policy. | Participation Information | Provisional — CG-02 | E3; E4; P0; CHL and GRP dependencies |

### 6.4 Activity, Evidence and Event

| Entity ID | Canonical name | Approved alias | Domain | Governed Subject classification | Information Subject treatment | Constitutional definition | Principal boundary | Primary category | Classification status | Sources and dependency |
|---|---|---|---|---|---|---|---|---|---|---|
| AEV-01 | Activity | — | Knowledge and Activity Event | Independent knowledge-defined subject | The governed activity meaning | A governed definition of measurable action or occurrence available for declared use. | Activity definition is not an occurrence or Activity Event. | Knowledge Information | Proposed inclusion | E3; E4; DOM |
| AEV-02 | Metric | — | Knowledge and Activity Event | Independent knowledge-defined subject | The governed measurement meaning | A governed dimension by which an Activity or outcome may be measured. | Metric is not Unit, measured value, score or formula. | Knowledge Information | Proposed inclusion | E3; E4; DOM |
| AEV-03 | Unit | — | Knowledge and Activity Event | Independent knowledge-defined subject | The governed unit meaning | A governed expression of measurement used with an approved Metric. | A display label cannot substitute for Unit meaning. | Knowledge Information | Proposed inclusion | E3; E4; DOM |
| AEV-04 | Submission Intent | — | Activity Event | Independent participant-expression subject | The Participant's attributable claim in context | A Participant's attributable expression that an Activity occurred in a governed context. | Submission Intent is not acceptance, evidence eligibility or Derived Truth. | Activity Information | Proposed inclusion | E1; E4; DATA; DOM |
| AEV-05 | Acceptance Decision | — | Activity Event | Independent authoritative-decision subject | The evaluated Submission Intent and acceptance basis | The attributable determination whether an expression may establish an Accepted Activity Event. | The decision is not the submitted claim, resulting event or calculation. | Activity Information | Proposed inclusion | E4; DATA; DOM; ACT rules deferred |
| AEV-06 | Accepted Activity Event | — | Activity Event | Independent accepted-event subject | The measurable occurrence accepted in context | The authoritative accepted record that a measurable Activity occurred in governed Participant, Challenge and Group context. | It is not Activity definition, Evidence Eligibility or Derived Truth. | Activity Information | Proposed inclusion | E4; DATA; DOM |
| AEV-07 | Evidence Eligibility | — | Activity Event | Independent policy-determination subject | The event's permitted use in a declared calculation | The governed determination that an Accepted Activity Event may be used for a declared calculation. | Acceptance does not create universal eligibility, and eligibility is not Progress. | Activity Information | Proposed inclusion | E4; DATA; DOM |
| AEV-08 | Verification | — | Activity Event | Independent governed concept; detailed subject meaning unresolved | The evidence or claim being assessed | A governed determination concerning evidential status whose exact meaning and effect remain deferred. | Verification is not Submission Intent, acceptance, eligibility or calculation by implication. | Activity Information | Proposed inclusion | E4; DATA; DOM; ACT-03 |
| AEV-09 | Correction reference | — | Activity Event | Independent historical-reference subject | The relationship between prior and corrected information | An attributable reference preserving the relationship between an authoritative record and a later governed correction. | A correction reference is not silent editing, deletion or a correction workflow. | Activity Information | Proposed inclusion | E4; DATA; DOM; ACT-04 |
| AEV-10 | Event administrative action | — | Activity Event | Independent administrative-action subject | The action, basis and affected event information | An attributable scoped administrative action concerning activity information. | Administration cannot manufacture, conceal or silently rewrite accepted-event truth. | Administrative Information | Proposed inclusion | E1; E4; DOM; ACT and Administration standards |
| AEV-11 | Event context | — | Activity Event | Independent contextual information subject | The Participant, Group, Challenge, Activity, Metric, Unit and time context | The governed context necessary to understand an activity expression or accepted event. | Context combines references without becoming the event, Knowledge or an independent source of authority. | Activity Information | Proposed inclusion | E4; DATA; DOM |

### 6.5 Derived, Analytical and Presentation

| Entity ID | Canonical name | Approved alias | Domain | Governed Subject classification | Information Subject treatment | Constitutional definition | Principal boundary | Primary category | Classification status | Sources and dependency |
|---|---|---|---|---|---|---|---|---|---|---|
| DRV-01 | Progress | — | Challenge outcomes | Independent derived subject | Advancement toward a governed Goal | Governed advancement derived from eligible evidence under applicable Policy. | Progress is not evidence, Target, Completion or its display. | Derived Information | Proposed inclusion | E4; DATA; DOM; formula deferred |
| DRV-02 | Completion | — | Challenge outcomes | Independent derived subject | Satisfaction of governed completion meaning | The governed determination that approved completion conditions are satisfied. | Accepted evidence alone does not automatically establish Completion. | Derived Information | Proposed inclusion | E4; DATA; DOM; completion rules deferred |
| DRV-03 | Ranking | — | Challenge outcomes | Independent derived subject | Ordered Challenge result | A governed ordered result derived under approved Ranking Policy. | Ranking is not Leaderboard, Recognition or Reward. | Derived Information | Proposed inclusion | E4; DATA; DOM; RSK-01 through RSK-04 |
| DRV-04 | Streak | — | Motivation | Independent derived subject | Governed continuity of qualifying participation | A governed derived expression of qualifying consistency over a declared time meaning. | Streak is not raw event count, Progress or Recognition. | Derived Information | Proposed inclusion | E4; DOM; RSK decisions |
| DRV-05 | Projection | — | Analytics | Independent derived subject | An attributable estimate based on governed inputs | A subordinate calculated estimate or forecast for a declared purpose. | Projection is not source truth or Runtime Projection. | Derived Information | Proposed inclusion | DATA; DOM; ANL and OPS dependencies |
| DRV-06 | Leaderboard | — | Presentation | Independent presentation subject | Ranking information presented to an audience | A governed presentation of Ranking in a declared Challenge context. | Leaderboard does not calculate or redefine Ranking. | Presentation Information | Proposed inclusion | E4; DATA; DOM; RSK decisions |
| DRV-07 | Feed item | — | Social presentation | Independent communication or presentation subject | The source event, communication or context represented | An attributable item communicated within an approved Feed context. | Feed content is not evidence, Policy, membership truth or Derived Truth. | Presentation Information | Proposed inclusion | E4; DATA; DOM; SOC decisions |
| DRV-08 | Notification | — | Motivation and presentation | Independent communication subject | The event, state or attention communicated | An attributable communication of governed information to an approved audience. | Notification does not establish the state it communicates. | Presentation Information | Proposed inclusion | E4; DATA; DOM; NTF decisions |
| DRV-09 | Recognition | — | Motivation | Independent derived acknowledgement subject | The qualifying participation or governed outcome acknowledged | A truthful acknowledgement of governed participation or outcome where later Policy permits. | Recognition is not evidence, Ranking, Reward or Presentation alone. | Derived Information | Proposed inclusion | E4; DATA; DOM; MOT-01 |
| DRV-10 | Analytical interpretation | — | Analytics | Independent analytical subject | The governed source information interpreted | An attributable interpretation of patterns, performance or outcomes for a declared purpose. | Interpretation is not authoritative source fact or Derived Truth by implication. | Analytical Information | Proposed inclusion | E4; DATA; DOM; ANL-01 |
| DRV-11 | Presentation summary | — | Presentation | Independent presentation subject | The source information summarized | A governed condensation of authoritative, derived or contextual information. | Summary cannot change source meaning, category or authority. | Presentation Information | Proposed inclusion | E4; DATA; DOM |

### 6.6 Knowledge

| Entity ID | Canonical name | Approved alias | Domain | Governed Subject classification | Information Subject treatment | Constitutional definition | Principal boundary | Primary category | Classification status | Sources and dependency |
|---|---|---|---|---|---|---|---|---|---|---|
| KNW-01 | Knowledge Asset | — | Knowledge Asset | Independent knowledge subject | The governed item bearing Authoritative Meaning | An identifiable governed Knowledge item that bears, preserves and communicates Authoritative Meaning. | Knowledge Asset is not Policy, evidence, Template or Runtime Projection. | Knowledge Information | Proposed inclusion | E3; DOM |
| KNW-02 | Activity Knowledge Asset | — | Knowledge Asset | Independent knowledge-type subject | The governed meaning of an Activity | A Knowledge Asset defining reusable Activity meaning for declared domains. | Generic type treatment must not duplicate Exercise or Wellness Activity Asset identity. | Knowledge Information | Proposed inclusion | E3; DOM; CG-04 impact remains |
| KNW-03 | Metric Knowledge Asset | — | Knowledge Asset | Independent knowledge-type subject | The governed meaning of a Metric | A Knowledge Asset defining reusable Metric meaning. | It is not a measurement, formula or score. | Knowledge Information | Proposed inclusion | E3; DOM; KNW classification governance |
| KNW-04 | Unit Knowledge Asset | — | Knowledge Asset | Independent knowledge-type subject | The governed meaning of a Unit | A Knowledge Asset defining reusable Unit meaning. | It is not a display label or measured value. | Knowledge Information | Proposed inclusion | E3; DOM; KNW classification governance |
| KNW-05 | Instructional Knowledge Asset | — | Knowledge Asset | Independent knowledge-type subject | Governed instructional meaning | A Knowledge Asset providing governed instruction for a declared purpose. | Instruction does not prove participation or establish Policy. | Knowledge Information | Proposed inclusion | E3; DOM; future content standard |
| KNW-06 | Safety Knowledge Asset | — | Knowledge Asset | Independent knowledge-type subject | Governed safety meaning | A Knowledge Asset providing governed safety meaning or constraints for a declared purpose. | Safety Knowledge does not itself verify activity or replace Policy. | Knowledge Information | Proposed inclusion | E3; DOM; future safety review governance |
| KNW-07 | Taxonomy or controlled-vocabulary Knowledge Asset | — | Knowledge Asset | Independent knowledge-type subject | The governed semantic classification | A Knowledge Asset defining controlled terms or semantic relationships needed for authoritative meaning. | Knowledge vocabulary is distinct from Discovery Tags and Categories. | Knowledge Information | Proposed inclusion | E3; DOM; KNW-04 and Discovery boundary |
| KNW-08 | Knowledge relationship | — | Knowledge Asset | Independent semantic-relationship subject | The governed relationship among Knowledge meanings | An attributable semantic relationship among Knowledge Assets or approved meanings. | Similarity, copying or adjacency does not establish a Knowledge relationship. | Knowledge Information | Proposed inclusion | E3; DOM; detailed relationship types deferred |
| KNW-09 | Runtime Catalogue | — | Runtime Knowledge | Candidate governed function; independent-subject treatment unresolved | Governed runtime availability and its catalogue context | The single governed function through which approved Knowledge is made available for declared runtime use. | Runtime Catalogue is not a Platform Authority, actor, role or source of canonical meaning. | Knowledge Information | Provisional — CG-03 | E3; P0; KNW-01 and later Runtime governance |
| KNW-10 | Runtime availability | — | Runtime Knowledge | Independent availability-fact subject | A Knowledge Asset's availability for declared runtime use | The governed fact that an approved Knowledge representation is available for a declared runtime purpose. | Availability is not canonical meaning, presentation, local presence or operational health. | Knowledge Information | Proposed inclusion | E3; DOM; later Runtime governance |
| KNW-11 | Runtime Projection | — | Runtime Knowledge | Independent governed-representation subject | The source Knowledge Asset represented for runtime use | A governed representation of a Knowledge Asset for a declared runtime purpose. | Runtime Projection is not a Knowledge Asset classification or independent source of truth. | Presentation Information | Proposed inclusion | E3; E4; DOM; KNW-04 remains pending |
| KNW-12 | Historical Knowledge reference | — | Knowledge history | Candidate historical-reference relationship; independent-subject treatment unresolved | The historically applicable Knowledge meaning referenced | A governed reference connecting later use to Knowledge meaning applicable at a relevant time. | Reference is not Historical Representation, a version scheme or an independent source of truth. | Knowledge Information | Provisional — CG-05 | E3; P0; KNW-02 and KNW-03 |
| KNW-13 | Knowledge administrative action | — | Knowledge Asset | Independent administrative-action subject | The action, basis and affected Knowledge subjects | An attributable scoped administrative action concerning governed Knowledge. | Administration cannot establish or redefine Authoritative Meaning. | Administrative Information | Proposed inclusion | E1; E3; DOM; future Knowledge Administration standard |
| C-KNW-14 | Exercise Asset | — | Fitness Knowledge | Approved primary Knowledge type; row-versus-subtype treatment unresolved | The governed exercise meaning | A primary Fitness Platform Knowledge Asset defining an Exercise for governed reuse. | It cannot be modified, forked or redefined by a Group. | Knowledge Information | Provisional — CG-04 | E3; P0; KNW classification governance |
| C-KNW-15 | Wellness Activity Asset | — | Wellness Knowledge | Approved primary Knowledge type; row-versus-subtype treatment unresolved | The governed wellness-activity meaning | A primary Wellness Platform Knowledge Asset defining a wellness Activity for governed reuse. | It cannot be modified, forked or redefined by a Group. | Knowledge Information | Provisional — CG-04 | E3; P0; KNW classification governance |
| C-KNW-16 | Template | — | Challenge composition | Approved governed composition guide; independent-subject treatment unresolved | The guidance used to compose a Challenge | A governed composition guide that consumes Platform Knowledge without becoming a Knowledge Asset. | Template does not establish Knowledge, Policy applicability or Challenge identity. | Knowledge Information | Provisional — CG-06 | E3; E4; P0; future Template governance |
| C-KNW-17 | Historical Representation | — | Knowledge and Challenge history | Approved governed representation; permanent row treatment unresolved | The historically applicable composition or meaning represented | A subordinate representation preserving historically applicable meaning and context. | It is not Historical Knowledge reference, source truth, snapshot rule or version scheme. | Presentation Information | Provisional — CG-05 | E3; E4; P0; KNW-02 and KNW-03 |

### 6.7 Platform Control and Mechanisms

| Entity ID | Canonical name | Approved alias | Domain | Governed Subject classification | Information Subject treatment | Constitutional definition | Principal boundary | Primary category | Classification status | Sources and dependency |
|---|---|---|---|---|---|---|---|---|---|---|
| CTL-01 | Policy | — | Cross-platform governance | Independent policy subject | The governed rule and affected subjects | An approved rule governing permitted behavior, evidence use, calculations, access or administrative action for a declared purpose. | Policy is not Knowledge, evidence, calculation or presentation. | Knowledge Information | Proposed inclusion | E3; E4; DATA; future Policy governance |
| CTL-02 | Administrative record | — | Cross-platform administration | Independent administrative-record subject | The authority action, decision basis and affected subjects | A durable attributable record of a governed administrative decision or action. | The record does not replace or transfer the underlying source truth. | Administrative Information | Proposed inclusion | E1; DATA; future Administrative Records standard |
| CTL-03 | Operational record | — | Cross-platform operations | Independent operational-record subject | The operational condition, action or control outcome | An attributable record supporting reliable and reviewable platform operation. | Operational truth is not product, participation, evidence or calculation truth. | Operational Information | Proposed inclusion | E1; DATA; OPS-01 |
| CTL-04 | Audit record | — | Cross-platform administration | Independent audit-record subject | The action, basis, acting identity and affected subject | A durable attributable record supporting accountability and review of governed action. | Audit record is not the action or source fact it records. | Administrative Information | Proposed inclusion | E1; E2; E4; DATA; future Audit standard |
| CTL-05 | Temporary information | — | Cross-platform control | Independent temporary-information subject | The declared working purpose and source subject | Information retained temporarily for a limited governed purpose before disposal or governed acceptance. | Temporary information is not authoritative merely because it exists or is possessed. | Temporary Information | Proposed inclusion | E1; DATA; later domain standard |
| CTL-06 | Presentation information | — | Cross-platform presentation | Independent presentation-information subject | The underlying authoritative, derived or contextual information | Information arranged or communicated for an approved audience and purpose. | Presentation does not establish or redefine underlying truth. | Presentation Information | Proposed inclusion | E1; E3; E4; DATA |
| C-CTL-07 | Creation Mechanism | — | Challenge composition | Candidate governed mechanism; entity-versus-capability treatment unresolved | The composition inputs and resulting creation context | A governed means that consumes Platform Knowledge, Templates and Group configuration to produce a Group Challenge. | It is not a Knowledge Asset, Challenge, Platform Authority or source of Policy applicability. | Presentation Information | Provisional — CG-07 | E3; E4; P0; future Creation governance |

## 7. Classification Summary

| Result | Count | Constitutional meaning |
|---|---:|---|
| Proposed inclusion | 58 | Approved sources support distinct treatment; founder approval of this register remains required. |
| Provisional | 14 | Permanent entity or row treatment remains open under CG-01 through CG-08. |
| Total candidates assessed | 72 | Complete Phase 0 audit universe. |

### Primary-category distribution

| Primary constitutional information category | Count |
|---|---:|
| Identity Information | 8 |
| Participation Information | 15 |
| Knowledge Information | 19 |
| Activity Information | 7 |
| Derived Information | 6 |
| Administrative Information | 6 |
| Operational Information | 1 |
| Analytical Information | 1 |
| Presentation Information | 8 |
| Temporary Information | 1 |
| **Total** | **72** |

## 8. Provisional Classification Gates

| Gate | Provisional Entity IDs | Question preserved |
|---|---|---|
| CG-01 | GRP-04, CHL-02, CHL-03, CHL-07 | Whether purpose, Goal and Target are independent Governed Subjects or authoritative facts concerning Group or Challenge. |
| CG-02 | C-CHL-09, C-CHL-10 | Whether Group Configuration and Community Context are independent information objects or grouped composition information. |
| CG-03 | KNW-09 | Whether Runtime Catalogue requires an entity row, governed-function treatment or only runtime-availability fact treatment. |
| CG-04 | C-KNW-14, C-KNW-15 | Whether Exercise Asset and Wellness Activity Asset require separate rows or controlled subtype treatment under Activity Knowledge Asset. |
| CG-05 | KNW-12, C-KNW-17 | How Historical Knowledge reference and Historical Representation remain distinct without duplicate entity treatment. |
| CG-06 | C-KNW-16 | Whether Template requires an independent entity row or governed composition-guide subtype treatment. |
| CG-07 | C-CTL-07 | Whether Creation Mechanism is an entity, governed capability or non-register reference. |
| CG-08 | C-GRP-08 | Permanent inventory treatment for the approved supporting Governed Subject Stewardship Council. |

No gate is resolved by this draft.

## 9. Consolidated and Excluded Concepts

These concepts do not add to the 72-candidate count.

| Concept | Draft 1 treatment | Constitutional reason |
|---|---|---|
| Platform Knowledge | Exclude as aggregate | The governed body of reusable meaning is expressed through Knowledge Assets. |
| Governed Knowledge | Exclude as constitutional condition | It describes Knowledge subject to approved governance, not another entity. |
| Authoritative Meaning | Exclude as authoritative fact | It is the meaning borne by a Knowledge Asset, not a separate entity or actor. |
| Constitutional Composition | Exclude as doctrine | It governs how distinct inputs form a distinct experience. |
| Group Experience | Exclude as domain boundary | It distinguishes Group context from Platform Knowledge without allocating accountability. |
| Applicable Policy | Consolidate with Policy | “Applicable” identifies contextual scope, not a second Policy entity. |
| Governed Review | Exclude as governance requirement | It is a condition of future contribution governance, not a role, Authority or entity. |
| Undertaking | Consolidate with Challenge for Version 2 | Challenge is the governed product expression of the ontological Undertaking. |
| Challenge Identity | Consolidate with Challenge | It is authoritative information concerning the Challenge, not a second subject. |
| Challenge Information | Exclude as information grouping | It groups information whose primary Information Subject is the Challenge. |
| Challenge Integrity | Exclude as constitutional condition | It is not a state, score or independent entity. |
| Challenge Identity Continuity | Exclude as interpretive principle | It preserves identity understanding without becoming an entity or lifecycle doctrine. |
| Group Governance Health | Exclude as future non-governing concept | EOG-02 creates no current determination, metric or entity. |
| Governance Maturity | Exclude as future conceptual distinction | EOG-02 approves no maturity model or governed entity. |

All treatments remain Draft 1 recommendations pending founder approval.

## 10. Cross-Domain Entity Boundaries

| Boundary | Inventory rule |
|---|---|
| Person / Identity / Profile | Three distinct proposed entities; representation does not collapse the human subject into identity information. |
| Group / Challenge | Group is the persistent community; Challenge is the distinct collective Undertaking within Group context. |
| Member / Participant | Separate governed contexts; membership does not establish Challenge participation. |
| Knowledge Asset / Policy | Meaning and rules remain distinct. |
| Activity / Submission Intent / Accepted Activity Event | Definition, expression and accepted occurrence remain distinct entities. |
| Accepted Activity Event / Evidence Eligibility / Derived Truth | Acceptance, permitted calculation use and calculated result remain distinct. |
| Knowledge Asset / Runtime Projection | Source meaning remains distinct from subordinate runtime representation. |
| Historical Knowledge reference / Historical Representation | Reference relationship and representation object remain distinct pending CG-05. |
| Challenge / Runtime Projection / Presentation | The governed Undertaking remains distinct from its runtime and audience representations. |
| Administrative action / Audit record | Governed action and durable record remain distinct. |

## 11. Dependency Treatment

- **GRP:** Group identity is retained; Group purpose and Stewardship Council treatment remain provisional where named.
- **CHL:** Challenge identity is retained; purpose, Goal, Target and composition-input treatment remain provisional.
- **ACT:** Event concepts are inventoried without defining Verification, correction or lifecycle rules.
- **KNW:** Knowledge and representation boundaries are preserved; runtime, subtype, Template and history classifications remain provisional.
- **RSK:** Derived and presentation subjects are inventoried without defining formulas, qualification or Recognition Policy.

Later governance may support a future classification amendment. It cannot silently change this draft or create an allocation through dependency resolution.

## 12. Cross-Register Contract Compliance

This draft implements only the inventory side of the approved contract:

- it identifies entities and proposed classifications;
- it contains no relationship-allocation columns;
- it uses stable or explicitly provisional Entity IDs;
- it preserves unresolved classifications and dependencies;
- it does not import allocations from the Phase 0 Coverage Matrix; and
- it leaves a future allocation register unable to create or redefine an entity.

## 13. Deferred Governance

This draft defers:

- CG-01 through CG-08;
- all relationship allocations;
- GRP, CHL, ACT, KNW and RSK decisions not already approved;
- entity lifecycle, amendment, archival, retention and deletion rules;
- roles, permissions, privacy and security;
- formulas, scoring, Ranking, Streak and Recognition rules;
- technical identifiers, storage, interfaces and implementation mapping; and
- permanent EOG programme identifier reconciliation.

## 14. Founder Review Decisions Requested

Founder review is requested to determine whether:

1. the 58 proposed inclusions form a sound constitutional inventory;
2. the ten primary-category assignments remain consistent with DATA;
3. the 14 provisional candidates are correctly restrained under CG-01 through CG-08;
4. the 14 consolidated or excluded concepts should remain outside independent entity treatment;
5. the cross-domain boundaries are sufficiently clear; and
6. the draft may proceed to independent constitutional review without resolving any classification gate.

## 15. Governance Status

**Founder Review Draft 1.** Structurally complete for the 72-candidate audit universe and ready for founder-directed review. It is not approved constitutional inventory governance.

No Entity Relationship Allocation Register has been drafted. No EOG-01 relationship is allocated by this document.
