# Tiizi Activity Event Domain Standard

## 1. Purpose

The Activity Event Domain exists to govern how Tiizi represents an attributable claim and an authoritative accepted record that a measurable Activity occurred in context.

The domain preserves:

- attributable participant expression through Submission Intent;
- trusted acceptance under approved Knowledge and Policy;
- authoritative Activity Information and Policy-governed Evidence Eligibility for declared calculations;
- truthful Progress derived from eligible accepted evidence;
- correction integrity through attributable historical change;
- auditability of acceptance and other high-impact authority actions.

This standard defines the Activity Event as a business and evidence domain. It does not define workflows, criteria, algorithms, states, formulas, technical structures or implementation behavior.

## 2. Constitutional Role

The Activity Event Domain governs the representation of measurable Activity occurrence in a Participant, Challenge and Group context.

The following concepts remain distinct:

| Concept | Constitutional meaning | Boundary |
|---|---|---|
| Activity definition | Governed Knowledge describing an Activity and its approved meaning. | It does not prove that the Activity occurred. |
| Submission Intent | A Participant's attributable expression that an Activity occurred in a governed context. | It is not an Accepted Activity Event or eligible evidence. |
| Accepted Activity Event | The authoritative accepted record, established by Acceptance Authority, that a measurable Activity occurred in a governed context. | Acceptance establishes authoritative Activity Information, not universal Evidence Eligibility. |
| Evidence | Authoritative information approved for use in a governed determination. | Evidence eligibility remains Policy-governed and may depend on the determination. |
| Derived Truth | An authoritative result calculated from eligible evidence under approved Policy. | It is established by Calculation Authority, not by the event itself. |
| Presentation | Communication of event, evidence or Derived information to an approved audience. | It cannot establish acceptance, eligibility or outcomes. |

An Activity Event is not:

- the Activity definition;
- a Challenge;
- Progress;
- Completion;
- Ranking;
- a Feed item;
- a Notification;
- a participant-authored total.

## 3. Canonical Event Context

Under the approved canonical Activity Event direction, an Accepted Activity Event is conceptually attributable to:

- one Participant;
- one Challenge;
- one Group context;
- one approved Activity;
- one Metric;
- one Unit;
- one measured value or governed occurrence;
- one relevant time context;
- one Acceptance Authority and acceptance basis.

This context gives the accepted occurrence attributable meaning. It does not define fields, storage, technical cardinality, optionality, validation or acceptance criteria.

The event context shall preserve the relationship among Identity, participation, governed Knowledge, measurement, time and trusted acceptance without giving any contextual concept Authority to establish event truth.

## 4. Submission Intent Boundary

Submission Intent is the Participant's attributable expression that an Activity occurred in a governed context.

Submission Intent:

- is established as an expression under Participant Authority;
- identifies the Participant's claim and relevant context;
- is not an Accepted Activity Event or eligible evidence;
- does not establish Progress, Completion, Ranking or Verification;
- does not guarantee acceptance;
- remains distinct from the accepted record;
- does not gain authority merely because it was expressed through an interface.

Participant Authority ends at Submission Intent. This standard does not define how intent is submitted, received, changed or withdrawn.

## 5. Accepted Activity Event Boundary

An Accepted Activity Event is the authoritative accepted record that a measurable Activity occurred in context under approved Knowledge and Policy.

An Accepted Activity Event:

- is established only by Acceptance Authority;
- is attributable to its Submission Intent or another approved evidence source where later governance permits;
- preserves the accepted Activity, Metric, Unit, measurement, context and interpretation at the relevant time;
- is authoritative Activity Information;
- may become evidence eligible for use by Calculation Authority under approved Policy;
- does not by itself establish Progress, Completion, Ranking, Streak or Recognition.

Acceptance establishes event truth within its governed context. It does not transfer authority over Participant identity, Knowledge, Policy or Derived Truth.

## 6. Domain Boundaries

### Included

The Activity Event Domain includes the constitutional governance of:

- Submission Intent meaning;
- accepted-event meaning;
- event identity and attribution;
- references to approved Activity, Metric and Unit meaning;
- Participant, Challenge and Group context;
- relevant time context;
- Acceptance Authority and acceptance basis;
- evidence eligibility as a Policy-governed concept;
- historical integrity and correction-reference meaning;
- event presentation boundaries.

### Excluded

The Activity Event Domain does not define or approve:

- submission interfaces or workflow;
- validation algorithms;
- acceptance criteria or algorithms;
- correction, reversal or supersession workflows;
- Verification rules;
- duplicate-detection rules;
- fraud rules;
- anomaly handling;
- offline synchronization;
- import behavior;
- calculation formulas;
- technical storage;
- API behavior.

### Future Considerations

Future approved standards may define submission, acceptance, Verification, correction, duplication, fraud, device, timing, retention and evidence-eligibility behavior.

These possibilities establish no present workflow, state, criterion, formula, authority assignment or technical assumption.

## 7. Domain Principles

### 7.1 Activity Definition Is Not an Activity Event

Knowledge defines what an Activity means. Only trusted acceptance can establish that the Activity occurred in context.

### 7.2 Submission Is Not Acceptance

Submission Intent is a Participant expression for evaluation. It is not authoritative event truth.

### 7.3 Acceptance Requires Trusted Authority

Only Acceptance Authority acting under approved Knowledge and Policy may establish an Accepted Activity Event.

### 7.4 Accepted Events Are Attributable

An Accepted Activity Event shall remain attributable to its origin, Participant, context, Knowledge meaning, acceptance basis and Acceptance Authority.

### 7.5 Accepted Meaning Remains Historically Intelligible

The meaning accepted at the relevant time shall remain understandable even if later Knowledge, Policy or correction governance permits change.

### 7.6 Evidence Eligibility Is Policy-Governed

Acceptance and eligibility are related but distinct. Approved Policy determines whether an Accepted Activity Event may support a particular calculation.

### 7.7 Evidence Is Not Progress

Evidence may support calculation. Progress is Derived Truth established only by Calculation Authority.

### 7.8 Events Cannot Be Silently Rewritten

Material changes to authoritative event truth shall remain attributable and historically reviewable.

### 7.9 Corrections Preserve History

Any later permitted correction shall preserve its relationship to prior accepted truth, its reason and its authority. This principle does not define a correction workflow or state.

### 7.10 Presentation Is Subordinate

Presentation may communicate event or evidence information but cannot establish acceptance, eligibility or Derived Truth.

### 7.11 Client-Calculated Totals Are Not Authoritative

Participant-entered or client-calculated totals, Progress, Completion, Ranking or analytics are not authoritative Derived Truth.

### 7.12 Privacy and Least Privilege Apply

Event information shall be accessed and used only for an approved purpose under applicable visibility, minimum necessary access and least privilege.

### 7.13 Event Authority Remains Challenge-Contextual

An event's accepted meaning remains attributable to its governed Participant, Challenge and Group context. Context shall not be reassigned silently.

### 7.14 Domain Neutrality Preserves Launch Scope

The canonical Activity Event foundation supports governed Fitness and Wellness meaning without making an unimplemented domain active or collapsing domain-specific meaning.

## 8. Information Model

The Activity Event Domain recognizes the following conceptual information groupings. They define purpose and authority without defining fields.

| Event information grouping | Constitutional category | Purpose | Primary authority | Authority boundary |
|---|---|---|---|---|
| Submission Intent Information | Activity Information | Represent the Participant's attributable expression before trusted acceptance. | Participant Authority. | The Participant is the Attributable originator; the expression is not an Accepted Activity Event, eligible evidence or Derived Truth. |
| Event Identity Information | Activity Information | Distinguish an authoritative accepted occurrence from other occurrences and representations. | Acceptance Authority. | A local identifier or copy cannot create event authority. |
| Participant-context Information | Activity Information | Attribute the occurrence to the governed Participant relationship. | Identity and Participation Authority provide referenced context; Acceptance Authority establishes the event attribution. | Referenced Participation Information remains separately authoritative; the event does not change Profile or participation truth. |
| Group-context Information | Activity Information | Preserve the Group context containing the Challenge. | Participation Authority provides referenced context; Acceptance Authority establishes its use in the event. | Referenced Group information remains separate; the Group does not establish event truth. |
| Challenge-context Information | Activity Information | Preserve the governed undertaking to which the occurrence relates. | Participation and Policy Authority provide referenced context; Acceptance Authority establishes its use in the event. | Referenced Challenge information remains separate; the Challenge does not perform acceptance or calculation. |
| Activity-reference Information | Knowledge Information | Preserve the approved Activity meaning applied to the occurrence. | Knowledge Authority. | The reference does not prove occurrence. |
| Metric and Unit Reference Information | Knowledge Information | Preserve the governed measurement meaning applied to the event. | Knowledge Authority. | Display text or a raw number cannot replace Metric and Unit meaning. |
| Measurement Information | Activity Information | Represent the accepted measured value or governed occurrence. | Acceptance Authority. | Measurement does not become Progress or a score by itself. |
| Time-context Information | Activity Information | Preserve the relevant temporal meaning attributed to the occurrence. | Acceptance Authority under approved Policy. | This standard creates no timezone, backdating or grace rule. |
| Acceptance Information | Activity Information | Preserve the Acceptance Authority, basis and attributable Acceptance Decision as part of event meaning. | Acceptance Authority. | Administrative and audit records of the action remain separate; acceptance does not create Policy, Evidence Eligibility or Derived Truth. |
| Evidence-status Information | Activity Information | Represent Evidence Eligibility for a declared calculation under applicable Policy. | Policy Authority. | Eligibility is not acceptance, Verification or Progress and may be calculation-specific. |
| Correction-reference Information | Activity Information | Preserve an attributable relationship between later permitted change and prior accepted truth. | A future approved correction authority. | Administrative and audit records remain separate; this standard defines no correction state, workflow or effect. |
| Event Administrative Information | Administrative Information | Record approved high-impact event-related authority actions. | Administrative Authority within explicit scope. | Administration cannot manufacture, conceal or silently rewrite event truth. |
| Event Presentation Information | Presentation Information | Communicate approved event or evidence information to an approved audience. | Presentation Authority. | Presentation cannot establish acceptance, evidence eligibility or calculation. |
| Temporary Event Information | Temporary Information | Support a limited, declared purpose before governed acceptance or disposal. | The authority designated for the temporary purpose. | Temporary information is not authoritative until governed acceptance. |

## 9. Authority Model

The Activity Event Domain conforms to the Tiizi Information Authority Chain.

| Authority type | Activity Event authority | Boundary |
|---|---|---|
| Participant Authority | Establishes attributable Submission Intent. | The Participant is the Attributable originator. Authority ends at Submission Intent and does not establish acceptance, Evidence Eligibility or Derived Truth. |
| Identity Authority | Supplies authoritative identity and Profile context for attribution. | Does not establish participation, event acceptance or calculation. |
| Participation Authority | Supplies governed Participant, Challenge and Group relationship context. | Does not establish Activity occurrence, acceptance or outcomes. |
| Knowledge Authority | Defines approved Activity, Metric and Unit meaning. | Does not prove occurrence or determine acceptance. |
| Policy Authority | Defines approved acceptance rules and establishes Evidence Eligibility for declared calculations where separately governed. | Does not create Submission Intent, Accepted Activity Events or calculated outcomes. |
| Acceptance Authority | Evaluates Submission Intent and establishes Accepted Activity Events under approved Knowledge and Policy. | Does not create Policy, Knowledge or Derived Truth. |
| Calculation Authority | Uses eligible evidence to establish approved Derived Truth. | Calculation Authority cannot invent, rewrite or erase evidence and does not alter the Accepted Activity Event. |
| Administrative Authority | Performs only explicitly assigned event-related actions under least privilege and durable accountability. | Cannot silently manufacture, rewrite, conceal or delete event truth. |
| Presentation Authority | Communicates approved event and evidence information to an approved audience. | Cannot create event authority, acceptance, eligibility or Derived Truth. |
| Operational Authority | Supports reliability and reconciliation within later approved operational governance. | Does not acquire stewardship of event truth or override Policy, Acceptance Authority or privacy. |
| Governance Authority | Approves Activity Event domain boundaries, standards, amendments and governed exceptions. | Does not silently approve pending correction, Verification or lifecycle decisions. |

## 10. Ownership Model

This foundation describes Activity Event ownership boundaries without creating the Entity Ownership Register.

| Constitutional relationship | Constitutional position |
|---|---|
| Governed subject | The Accepted Activity Event is the Governed subject of authoritative accepted occurrence information; Submission Intent remains a distinct pre-acceptance expression. |
| Information subject | The event is the Information subject of event information; the Person remains the Information subject of associated Profile information. |
| Attributable originator | The Participant is the Attributable originator of Submission Intent. |
| Authority to establish truth | Participant Authority establishes Submission Intent; Acceptance Authority establishes Accepted Activity Event truth; Policy Authority establishes Evidence Eligibility for declared calculations. |
| Accountable steward | Accountable stewardship remains deferred. |
| Custodian | A future approved standard shall assign custody without transferring Authority to establish event truth. |
| Administrator | An Administrator may act only through explicitly assigned Administrative Authority and cannot fabricate, conceal or silently rewrite event truth. |
| Operator | An Operator may support reliability and reconciliation only through explicitly assigned Operational Authority. |
| Presenter | A Presenter may communicate event and eligibility information without establishing acceptance, eligibility or Derived Truth. |
| Downstream user | Calculation Authority and other Downstream users may use approved information only for declared purposes and do not rewrite the event. |

Participant origin does not confer Authority to establish accepted truth. Acceptance Authority does not establish Participant Identity or Knowledge. Challenge and Group provide context but do not establish event truth.

## 11. Relationships

| Related concept | Activity Event relationship | Boundary |
|---|---|---|
| Person | The human subject who may hold governed Identity and participation relationships. | A Person is not an event or accepted occurrence. |
| Profile | Supplies approved identity and participation-supporting context. | Profile information does not establish Submission Intent or an Accepted Activity Event. |
| Group | Provides the collective context containing the Challenge. | Group information and communication are not event evidence. |
| Member | Represents a person's governed relationship to the Group. | Membership does not create Submission Intent, participation or event authority. |
| Challenge | Provides the governed purpose, participation and Policy context for the event. | A Challenge does not perform acceptance or calculation. |
| Participant | Is the Attributable originator of Submission Intent within the governed Challenge relationship. | The Participant does not establish Accepted Activity Event truth, Evidence Eligibility or Derived Truth. |
| Knowledge Asset | Preserves approved reusable meaning relevant to the Activity and measurement. | It is not an event or evidence of occurrence. |
| Activity | Defines the governed behavior that may occur and be measured. | An Activity is not an Activity Event. |
| Metric | Defines the governed measurement dimension. | A Metric is not a value, score or event. |
| Unit | Expresses a Metric in an approved form. | A display label cannot replace governed Unit meaning. |
| Submission Intent | Expresses the Participant's attributable expression before trusted acceptance. | It is not an Accepted Activity Event or eligible evidence. |
| Accepted Activity Event | Records the authoritative accepted occurrence established by Acceptance Authority. | It does not by itself establish Evidence Eligibility, Progress, Completion or Ranking. |
| Evidence Eligibility | Represents the Policy-governed determination that an Accepted Activity Event may be used for a declared calculation. | Eligibility is not acceptance or a calculated outcome. |
| Progress | Derives advancement toward a Goal from eligible evidence. | Progress is not part of event identity and cannot rewrite the event. |
| Completion | Derives whether approved conditions are satisfied. | An accepted event does not automatically establish Completion. |
| Ranking | Derives an ordered result where approved Policy exists. | Ranking is not event truth or participant-authored evidence. |
| Streak | Represents a governed continuity pattern where later approved. | This standard establishes no qualification, time or correction rule. |
| Feed | May present approved event-related information or communication. | Feed content is not evidence or event authority. |
| Notification | May communicate an event-related fact, status or required attention. | A Notification is not evidence and does not establish acceptance. |
| Recognition | May acknowledge governed participation or outcome where later approved. | Recognition does not create event evidence or Derived Truth. |
| Analytics | May interpret accepted and Derived information for a declared purpose. | Analytics does not alter event truth or evidence eligibility. |
| Administration | May exercise explicitly assigned event-related authority. | Administrative access is not ownership or permission to fabricate or conceal. |
| Audit Record | Preserves durable accountability for qualifying authority actions. | An Audit Record is not the event itself and does not replace event history. |

## 12. Measurement and Meaning

| Concept | Constitutional meaning | Boundary |
|---|---|---|
| Measured value | The quantified magnitude accepted for an occurrence where the Activity uses quantitative measurement. | A raw value without governed Metric and Unit meaning is insufficient. |
| Governed occurrence | The accepted occurrence of an Activity where meaning need not be reduced to a numeric value. | Occurrence meaning must remain approved and attributable. |
| Metric | The governed dimension by which the Activity is measured. | A Metric is not a score or display label. |
| Unit | The governed expression used to quantify the Metric. | Display text cannot substitute for governed Unit meaning. |
| Activity meaning | The approved Knowledge defining what behavior or action the event represents. | An Activity reference does not prove occurrence. |
| Contextual validity | The applicability of Participant, Challenge, Group and Policy context to the accepted interpretation. | Exact validity rules remain deferred. |
| Time meaning | The relevant temporal interpretation applied to the occurrence. | Timezone, backdating, late-entry and grace rules remain deferred. |
| Accepted interpretation | The combined Activity, Metric, Unit, measurement, context and time meaning accepted by Acceptance Authority. | Later presentation or calculation cannot silently change it. |

Measurement interpretation shall use approved Knowledge. Event acceptance shall preserve the meaning applied at the relevant time. Formulas, conversion and rounding rules remain deferred.

## 13. Evidence Model

The constitutional evidence relationship is:

> **Submission Intent**
>
> ↓ evaluated under approved Knowledge and Policy
>
> **Acceptance Decision**
>
> ↓ establishes
>
> **Accepted Activity Event**
>
> ↓ evaluated under applicable Policy
>
> **Evidence Eligibility**
>
> ↓ permits governed use by Calculation Authority as
>
> **Calculation Use**

The following boundaries apply:

- An Accepted Activity Event and evidence are related but need not be identical in every future Policy context.
- Policy determines whether an Accepted Activity Event is eligible for a particular calculation.
- Evidence eligibility may be calculation-specific.
- Calculation Authority cannot invent evidence.
- Exclusion from one calculation does not silently erase historical event truth.
- Exact eligibility rules remain deferred.

## 14. Historical Integrity and Correction Boundary

Accepted Activity Events shall remain historically intelligible. The Activity, Metric, Unit, measurement, context, accepted interpretation, basis and authority relevant at acceptance shall remain attributable.

Material changes shall not be silent. Any later permitted correction shall preserve:

- attribution to the correcting authority;
- the reason for correction;
- the relationship to prior accepted truth;
- the relevant time of the correction;
- historical intelligibility of the earlier record.

Correction is not presentation editing. Deletion shall not be used to conceal authoritative history. Exact correction, reversal, supersession, deletion and retention rules remain deferred; this standard creates no correction state or workflow.

## 15. Information Integrity Rules

1. Submission Intent is not an Accepted Activity Event or eligible evidence.
2. An Accepted Activity Event requires Acceptance Authority.
3. An Activity definition is not an occurrence.
4. Group communication is not an Activity Event.
5. Feed content is not evidence.
6. A Notification is not evidence.
7. Participant-entered totals are not authoritative Progress.
8. An Accepted Activity Event does not automatically establish Evidence Eligibility or Completion.
9. Calculation Authority cannot invent or rewrite evidence.
10. Presentation cannot establish acceptance or evidence eligibility.
11. Metric and Unit meaning shall not be changed silently.
12. Participant, Challenge or Group context shall not be reassigned silently.
13. Corrections shall preserve historical truth and attribution.
14. Administrative access does not permit fabrication, concealment or silent rewriting.
15. Local copies cannot become competing event truth.
16. Duplicate representations cannot create duplicate authority.
17. Privacy, minimum necessary access and least privilege constrain event use.
18. Temporary information is not authoritative until governed acceptance.
19. Exclusion from a calculation shall not silently erase an Accepted Activity Event.
20. Presentation summaries and analytical interpretations remain subordinate to event and evidence authority.

## 16. Visibility

Visibility defines the approved audience for event-related information. It does not establish acceptance, evidence eligibility or calculation authority.

| Visibility class | Activity Event meaning | Constitutional constraint |
|---|---|---|
| Public | Event-related information specifically approved for access without a Group or participation relationship. | Accepted activity evidence is not public by default, and public summary information does not expose underlying evidence automatically. |
| Authenticated-discoverable | Minimal event-related information approved for governed discovery by an authenticated person. | Discovery does not establish event access, evidence eligibility or participation. |
| Shared-group | Approved event summaries or context available within the relevant governed Group relationship. | Shared-group presentation may expose only approved summaries; event details and Profile information remain separately governed. |
| Private | Event or Participant information restricted to the person and specifically authorized purposes. | Private information remains subject to explicit authority and minimum necessary use. |
| Privileged-operational | Event information available only to defined operational authority. | Access is purpose-limited, reviewable, deny-by-default and constrained by least privilege. |

Final event visibility and disclosure rules remain deferred.

## 17. Administrative and Operational Boundary

Administrative and Operational Authority:

- must be explicitly assigned;
- remain constrained by privacy, minimum necessary use and least privilege;
- cannot manufacture or silently rewrite Accepted Activity Events;
- cannot bypass Policy or Acceptance Authority;
- require durable accountability for high-impact actions;
- may support reconciliation only under approved governance;
- do not receive unrestricted event access;
- do not define final roles or technical privileges;
- cannot use operational urgency to conceal prior event truth.

## 18. Deferred Areas

This standard explicitly defers:

- submission workflow;
- acceptance criteria;
- event lifecycle states;
- correction workflow;
- reversal;
- supersession;
- deletion;
- Verification;
- duplicate detection;
- fraud detection;
- anomaly handling;
- offline capture;
- synchronization;
- import and migration;
- external-device evidence;
- manual evidence;
- evidence weighting;
- calculation-specific eligibility;
- conversion rules;
- rounding;
- time-zone rules;
- backdating;
- late submission;
- grace periods;
- dispute handling;
- moderation;
- retention;
- permissions;
- security controls;
- technical implementation;
- the Implementation Mapping.

No deferred state, workflow, criterion, algorithm, formula, role, permission or technical behavior is approved by this standard.

## 19. Governance

### Status

Status: Tiizi Foundational Governance Baseline v1.0 — reconciled for founder review.

### Dependencies

- [Tiizi Platform Constitution](../platform/01-TIIZI-PLATFORM-CONSTITUTION.md)
- [Platform Principles](../platform/02-PLATFORM-PRINCIPLES.md)
- [Platform Domain and Terminology Standard](../platform/03-PLATFORM-DOMAIN-AND-TERMINOLOGY-STANDARD.md)
- [Version 2 Launch Scope](../platform/04-VERSION-2-LAUNCH-SCOPE.md)
- [Platform Capability Map](../platform/05-PLATFORM-CAPABILITY-MAP.md)
- [Entity Ownership Foundation](../platform/06-ENTITY-OWNERSHIP-FOUNDATION.md)
- [Constitutional Glossary](../platform/07-CONSTITUTIONAL-GLOSSARY.md)
- [Platform Data and Information Standard](../platform/08-PLATFORM-DATA-AND-INFORMATION-STANDARD.md)
- [Platform Authority Model](../platform/10-PLATFORM-AUTHORITY-MODEL.md)
- [Profile Domain Standard](01-PROFILE-DOMAIN-STANDARD.md)
- [Group Domain Standard](02-GROUP-DOMAIN-STANDARD.md)
- [Challenge Domain Standard](03-CHALLENGE-DOMAIN-STANDARD.md)
- [Session 1 Founder Approval Report](../../reports/platform-foundation-decisions/13-SESSION-1-FOUNDER-APPROVAL-REPORT.md)

### Precedence

This standard is subordinate to the Tiizi Platform Constitution, approved founder decisions and approved platform standards. Later Activity Event standards may refine it but shall not contradict it.

### Approved Decision Trace

| Decision | Activity Event domain effect |
|---|---|
| PLT-01 | Places Activity Events within Tiizi's approved group-first platform identity and truthful shared Progress. |
| PLT-02 | Keeps Activity Events attributable to governed Group Challenge participation rather than an individual-challenge mode. |
| PLT-03 | Preserves a domain-neutral event foundation with Fitness and Wellness as launch domains. |
| PLT-04 | Excludes individual challenges from Version 2 and from current event-context obligations. |
| IDP-01 | Constrains event and Participant information through five visibility classes, minimal disclosure and deny-by-default access. |
| IDP-02 | Requires privacy meaning and controls concerning event information to be enforceable and truthful. |
| ACT-01 | Establishes one canonical Activity Event contract with governed domain extensions and attributable context. |
| ACT-02 | Separates Participant Submission Intent from trusted Acceptance Authority and Derived Truth. |
| KNW-01 | Requires Activity, Metric and Unit meaning to come from the single governed Runtime Catalogue authority. |
| ADM-01 | Requires explicitly assigned event administration, least privilege, trusted high-impact authority and durable accountability. |

### Relationship to Profile, Group and Challenge Standards

The [Profile Domain Standard](01-PROFILE-DOMAIN-STANDARD.md) governs identity representation, the [Group Domain Standard](02-GROUP-DOMAIN-STANDARD.md) governs collective and membership context, and the [Challenge Domain Standard](03-CHALLENGE-DOMAIN-STANDARD.md) governs the shared undertaking and Policy context. None of those domains independently establishes Accepted Activity Events.

### Relationship to the Knowledge Asset Domain Standard

The [Knowledge Asset Domain Standard](05-KNOWLEDGE-ASSET-DOMAIN-STANDARD.md) governs approved Activity, Metric and Unit meaning. Knowledge defines the event's meaning but does not prove occurrence.

### Relationship to Later Governance Standards

Future Activity Event lifecycle, correction, Verification, entity ownership, role, permission, privacy and security standards shall assign states, actors, criteria and controls only after the relevant founder decisions are approved.
