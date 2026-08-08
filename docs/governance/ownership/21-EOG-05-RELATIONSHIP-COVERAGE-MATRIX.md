# EOG-05 Phase 0 — Relationship Coverage Matrix

**Status:** Constitutional coverage audit; not an allocation matrix

**Date:** 2026-07-20

## 1. Purpose

This matrix assesses every candidate in the [Candidate Entity Inventory](21-EOG-05-CANDIDATE-ENTITY-INVENTORY.md) against the mandatory EOG-01 relationship vocabulary and the approved EOG-02 through EOG-04 treatments.

The matrix records constitutional coverage only. It does not assign an actor, role, Authority, Accountable Steward, Custodian, Administrator, Operator, Delegate, Presenter or Downstream User.

## 2. Status Codes

| Code | Classification | Meaning |
|---|---|---|
| A | Approved | Approved governance expressly establishes the relationship treatment or expressly establishes that the subject has no independent source Authority. |
| D | Deferred | Approved governance expressly leaves the allocation or detailed treatment to a named founder decision or later standard. |
| U | Undefined | The candidate is recognised or proposed, but approved governance does not yet determine whether this relationship applies or how it is classified. |
| O | Out of Scope | The relationship does not constitutionally apply to this candidate in its present approved meaning. |

An **A** records an approved constitutional boundary, not necessarily a named organizational actor. A **D** must not be converted into an allocation during register drafting. A **U** requires a scope or classification decision before final register treatment. An **O** is a negative applicability finding, not an allocation.

## 3. Relationship Keys

| Key | EOG-01 relationship |
|---|---|
| GS | Governed Subject |
| IS | Information Subject |
| AT | Authority to Establish Truth |
| AS | Accountable Steward |
| CU | Custodian |
| AD | Administrator |
| OP | Operator |
| CO | Contributor |
| PA | Participant |
| DE | Delegate |
| PR | Presenter |
| DU | Downstream User |
| AO | Attributable Originator |

Attributable Originator is included because EOG-01 makes it part of the complete bounded accountability vocabulary even though it was not repeated in the task's minimum relationship list.

## 4. Coverage Matrix

### 4.1 Human and Identity candidates

| ID | Candidate | GS | IS | AT | AS | CU | AD | OP | CO | PA | DE | PR | DU | AO | Principal finding |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| HID-01 | Person | A | A | A | D | D | D | D | O | O | D | D | D | A | Recognition boundary approved; accountable actor allocations remain later Identity governance. |
| HID-02 | Identity | A | A | A | D | D | D | D | O | O | D | D | D | A | Identity Authority treatment approved; lifecycle and custody deferred. |
| HID-03 | Profile | A | A | A | D | D | D | D | O | O | D | D | D | A | Identity and permitted personal-expression boundaries coexist without stewardship allocation. |
| HID-04 | Preference | A | A | A | D | D | D | D | O | O | D | D | D | A | Personal expression approved; vocabulary and use remain later governance. |
| HID-05 | Interest | A | A | A | D | D | D | D | O | O | D | D | D | A | Personal expression and Knowledge vocabulary remain separate. |
| HID-06 | Consent expression | A | A | A | D | D | D | D | O | O | U | D | D | A | Participant expression is approved; delegation treatment is not defined. |
| HID-07 | Consent record | A | A | A | D | D | D | D | O | O | D | D | D | A | Authoritative record remains distinct from expression. |
| HID-08 | Privacy choice | A | A | A | D | D | D | D | O | O | D | D | D | A | Enforceable choice boundary approved; final accountability and use remain deferred. |

### 4.2 Group and Community candidates

| ID | Candidate | GS | IS | AT | AS | CU | AD | OP | CO | PA | DE | PR | DU | AO | Principal finding |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| GRP-01 | Group | A | A | D | A | D | D | D | A | O | D | D | D | A | Initial Accountable Steward approved; creation-authenticating Authority deferred. |
| GRP-02 | Membership relationship | A | A | A | D | D | D | D | O | O | D | D | D | D | Participation Authority type approved; origin and lifecycle actors deferred. |
| GRP-03 | Member | A | A | A | D | D | D | D | O | O | D | D | D | D | First Member consequence approved; later establishment remains lifecycle-dependent. |
| GRP-04 | Group purpose | U | A | D | U | D | D | D | D | O | D | D | D | A | Founding fact approved, but independent Governed Subject and stewardship treatment are not settled. |
| GRP-05 | Group communication | A | A | A | D | D | D | D | A | O | D | D | D | A | Authorship treatment exists; moderation, custody and presentation allocation remain deferred. |
| GRP-06 | Group administrative action | A | A | A | D | D | A | D | O | O | D | D | A | A | Administrative relationship applies within scope but does not establish underlying Group truth. |
| C-GRP-07 | Group Charter | A | A | D | A | D | D | D | A | O | D | D | D | A | Distinct Governed Subject; composite truth and amendment Authorities remain deferred. |
| C-GRP-08 | Stewardship Council | A | U | D | D | D | D | D | O | O | D | U | U | D | Supporting Governed Subject approved; all operating relationships remain future governance. |

### 4.3 Challenge and composition-context candidates

| ID | Candidate | GS | IS | AT | AS | CU | AD | OP | CO | PA | DE | PR | DU | AO | Principal finding |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| CHL-01 | Challenge | A | A | D | D | D | D | D | A | A | D | D | D | D | Identity, Purpose and Goal establishment plus all accountability allocations remain deferred. |
| CHL-02 | Challenge purpose | U | A | D | U | D | D | D | D | O | D | D | D | D | Approved as Challenge Information; independent subject treatment remains undefined. |
| CHL-03 | Goal | U | A | D | U | D | D | D | D | O | D | D | D | D | Distinct meaning approved; truth Authority and independent subject treatment remain open. |
| CHL-04 | Challenge Policy | A | A | A | D | D | D | D | U | O | D | D | D | D | Policy Authority applies; authorship, applicability and stewardship remain deferred. |
| CHL-05 | Challenge participation relationship | A | A | A | D | D | D | D | O | A | D | D | D | D | Participation Authority and Participant relationship approved; lifecycle deferred. |
| CHL-06 | Participant | A | A | A | D | D | D | D | A | A | D | D | D | A | Canonical contextual relationship; participation confers no governance. |
| CHL-07 | Target | U | A | D | U | D | D | D | D | O | D | D | D | D | Target distinction approved; subject, authorship and amendment treatment remain open. |
| CHL-08 | Challenge administrative action | A | A | A | D | D | A | D | O | O | D | D | A | A | Administrative truth is purpose-limited and cannot replace source Authority. |
| C-CHL-09 | Group Configuration | U | U | D | U | D | D | D | A | O | D | D | A | A | Composition input approved; independent subject and Authority treatment unresolved. |
| C-CHL-10 | Community Context | U | U | D | U | D | D | D | A | O | D | D | A | A | Local meaning boundary approved; register-row classification remains unresolved. |

### 4.4 Activity, evidence and event candidates

| ID | Candidate | GS | IS | AT | AS | CU | AD | OP | CO | PA | DE | PR | DU | AO | Principal finding |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| AEV-01 | Activity | A | A | A | D | D | D | D | A | O | D | D | A | A | Knowledge meaning approved; Knowledge accountability remains deferred. |
| AEV-02 | Metric | A | A | A | D | D | D | D | A | O | D | D | A | A | Knowledge Authority boundary approved; calculation use remains separate. |
| AEV-03 | Unit | A | A | A | D | D | D | D | A | O | D | D | A | A | Governed Unit meaning approved; display cannot substitute for meaning. |
| AEV-04 | Submission Intent | A | A | A | D | D | D | D | O | A | U | D | A | A | Participant Authority and origin approved; delegation is not treated. |
| AEV-05 | Acceptance Decision | A | A | A | D | D | D | D | O | O | D | D | A | A | Acceptance Authority treatment approved; workflow and actor allocation deferred. |
| AEV-06 | Accepted Activity Event | A | A | A | D | D | D | D | O | O | D | D | A | A | Acceptance Authority establishes the event; evidence and calculation remain separate. |
| AEV-07 | Evidence Eligibility | A | A | A | D | D | D | D | O | O | D | D | A | A | Policy Authority establishes eligibility for each declared calculation. |
| AEV-08 | Verification | A | U | D | D | D | D | D | O | O | D | D | D | D | Verification meaning, subject, truth Authority and effects remain ACT-dependent. |
| AEV-09 | Correction reference | A | A | D | D | D | D | D | O | O | D | D | D | D | Historical relation recognised; Authority and effect remain ACT-dependent. |
| AEV-10 | Event administrative action | A | A | A | D | D | A | D | O | O | D | D | A | A | Administration may record scoped action but cannot manufacture event truth. |
| AEV-11 | Event context | A | A | A | D | D | D | D | O | O | D | D | A | A | Approved source Authorities jointly supply distinct contextual facts without competing truth. |

### 4.5 Derived, analytical and presentation candidates

| ID | Candidate | GS | IS | AT | AS | CU | AD | OP | CO | PA | DE | PR | DU | AO | Principal finding |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| DRV-01 | Progress | A | A | A | D | D | D | D | O | O | D | A | A | A | Calculation Authority approved; formula and lifecycle remain deferred. |
| DRV-02 | Completion | A | A | A | D | D | D | D | O | O | D | A | A | A | Calculation Authority approved; completion rules remain deferred. |
| DRV-03 | Ranking | A | A | A | D | D | D | D | O | O | D | A | A | A | Calculation Authority approved; RSK rules remain pending. |
| DRV-04 | Streak | A | A | A | D | D | D | D | O | O | D | A | A | A | Calculation boundary approved; qualification and time rules remain pending. |
| DRV-05 | Projection | A | A | A | D | D | D | D | O | O | D | A | A | A | Projection remains attributable and subordinate to approved calculation inputs. |
| DRV-06 | Leaderboard | A | A | A | D | D | D | D | O | O | D | A | A | A | Explicitly a presentation of Ranking, not a separate ranking Authority. |
| DRV-07 | Feed item | A | A | A | D | D | D | D | A | U | D | A | A | A | Source and presentation boundary approved; social and moderation governance deferred. |
| DRV-08 | Notification | A | A | A | D | D | D | D | O | O | D | A | A | A | No independent state Authority; lifecycle and delivery governance remain deferred. |
| DRV-09 | Recognition | A | A | D | D | D | D | D | O | O | D | A | D | D | Qualification Authority, stewardship and correction remain deferred. |
| DRV-10 | Analytical interpretation | A | A | A | D | D | D | D | O | O | D | A | A | A | Explicitly not authoritative Derived Truth; method governance remains deferred. |
| DRV-11 | Presentation summary | A | A | A | D | D | D | D | O | O | D | A | A | A | Source Authority remains controlling; summary cannot redefine truth. |

### 4.6 Knowledge candidates

| ID | Candidate | GS | IS | AT | AS | CU | AD | OP | CO | PA | DE | PR | DU | AO | Principal finding |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| KNW-01 | Knowledge Asset | A | A | A | D | D | D | D | A | O | D | A | A | A | Knowledge Authority establishes Authoritative Meaning; all accountability allocations remain deferred. |
| KNW-02 | Activity Knowledge Asset | A | A | A | D | D | D | D | A | O | D | A | A | A | Generic type requires reconciliation with approved Exercise and Wellness Activity Assets. |
| KNW-03 | Metric Knowledge Asset | A | A | A | D | D | D | D | A | O | D | A | A | A | Supporting Knowledge meaning approved; classification detail deferred. |
| KNW-04 | Unit Knowledge Asset | A | A | A | D | D | D | D | A | O | D | A | A | A | Supporting Knowledge meaning approved; classification detail deferred. |
| KNW-05 | Instructional Knowledge Asset | A | A | A | D | D | D | D | A | O | D | A | A | A | Meaning boundary approved; content and review standards deferred. |
| KNW-06 | Safety Knowledge Asset | A | A | A | D | D | D | D | A | O | D | A | A | A | Meaning boundary approved; safety review governance deferred. |
| KNW-07 | Taxonomy or controlled-vocabulary Knowledge Asset | A | A | A | D | D | D | D | A | O | D | A | A | A | Knowledge vocabulary is distinct from Discovery classification. |
| KNW-08 | Knowledge relationship | A | A | A | D | D | D | D | A | O | D | A | A | A | Knowledge Authority may establish governed semantic relationships; detailed types remain deferred. |
| KNW-09 | Runtime Catalogue | U | U | A | D | D | D | D | O | O | D | O | A | D | Governed function and availability Authority boundary approved; independent subject classification unresolved. |
| KNW-10 | Runtime availability | A | A | A | D | D | D | D | O | O | D | A | A | D | Authoritative availability fact approved through Knowledge Authority; actor remains deferred. |
| KNW-11 | Runtime Projection | A | A | A | D | D | D | D | O | O | D | A | A | A | Governed representation has no independent source Authority. |
| KNW-12 | Historical Knowledge reference | U | A | A | D | D | D | D | O | O | D | A | A | A | Historical relation is recognised; independent subject treatment remains unresolved. |
| KNW-13 | Knowledge administrative action | A | A | A | D | D | A | D | O | O | D | A | A | A | Administration cannot establish or redefine Authoritative Meaning. |
| C-KNW-14 | Exercise Asset | A | A | A | D | D | D | D | A | O | D | A | A | A | Primary Platform Knowledge Asset; row-versus-subtype treatment awaits classification governance. |
| C-KNW-15 | Wellness Activity Asset | A | A | A | D | D | D | D | A | O | D | A | A | A | Primary Platform Knowledge Asset; row-versus-subtype treatment awaits classification governance. |
| C-KNW-16 | Template | A | U | D | D | D | D | D | D | O | D | D | A | D | Governed composition guide; authorship, approval, availability and lifecycle all deferred. |
| C-KNW-17 | Historical Representation | A | A | A | D | D | D | D | O | O | D | A | A | A | Explicit subordinate representation; no independent source Authority. |

### 4.7 Platform-control and mechanism candidates

| ID | Candidate | GS | IS | AT | AS | CU | AD | OP | CO | PA | DE | PR | DU | AO | Principal finding |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| CTL-01 | Policy | A | A | A | D | D | D | D | U | O | D | A | A | A | Policy Authority approved; author, steward and lifecycle remain deferred. |
| CTL-02 | Administrative record | A | A | A | D | D | A | D | O | O | D | A | A | A | Administrative record preserves administrative truth, not the underlying source truth. |
| CTL-03 | Operational record | A | A | A | D | D | D | A | O | O | D | A | A | A | Operational Authority establishes operational truth only; Operator allocation remains deferred. |
| CTL-04 | Audit record | A | A | A | D | D | D | D | O | O | D | A | A | A | Audit preserves attribution and reviewability; custody and retention remain deferred. |
| CTL-05 | Temporary information | A | A | A | D | D | D | D | A | O | D | D | D | A | Approved negative truth boundary; later acceptance determines any authoritative use. |
| CTL-06 | Presentation information | A | A | A | D | D | D | D | O | O | D | A | A | A | Explicitly no independent source truth; Presenter remains subordinate. |
| C-CTL-07 | Creation Mechanism | U | U | A | D | D | D | D | O | O | D | D | A | D | Explicitly not an Authority; entity-versus-capability treatment remains unresolved. |

## 5. Coverage Findings

### 5.1 Approved concentration

Approved coverage is strongest for:

- constitutional subject distinctions already established by the Domain Standards and EOG-02 through EOG-04;
- Authority to Establish Truth for Identity, Knowledge, Policy, Participation, Submission Intent, Acceptance, Evidence Eligibility, Derived Truth, administration and operation;
- negative Authority boundaries for runtime, presentation, historical and analytical representations;
- Participant, Contributor, Presenter, Downstream User and Attributable Originator boundaries where explicitly discussed.

### 5.2 Deferred concentration

Deferred coverage is pervasive for:

- Accountable Stewardship outside the approved initial Group stewardship consequence;
- purpose-limited Custody;
- named Administrators and Operators;
- Delegation;
- Presenter and Downstream User allocation details;
- Challenge, Verification, correction, Recognition, Template and historical lifecycle treatment.

### 5.3 Undefined concentration

Undefined status is limited principally to classification questions:

- whether Group purpose, Challenge purpose, Goal and Target require independent Governed Subject rows;
- the Information Subject treatment of Stewardship Council, Group Configuration, Community Context, Runtime Catalogue, Template and Creation Mechanism;
- whether Runtime Catalogue and Creation Mechanism are entity rows, governed-function records or capability references;
- whether Exercise and Wellness Activity Assets require individual rows or controlled subtype treatment;
- how Historical Knowledge reference and Historical Representation coexist without duplication.

## 6. Matrix Result

The matrix covers all **72** candidates and all **12** relationships requested by the task, plus the EOG-01-mandated Attributable Originator relationship.

It is suitable as a drafting input but not as an allocation instrument. Every **D** and **U** cell must remain visibly unresolved until its named decision or classification gate is approved.
