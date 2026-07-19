# Tiizi Profile Domain Standard

## 1. Purpose

The Profile exists to provide a governed representation of Identity and participation-supporting information for a Person.

Its purpose is to support safe, accountable participation in Tiizi's group-first platform while protecting privacy, preserving truthful identity context and enabling permitted personal preferences. A Profile helps the person participate; it does not independently establish participation, activity, progress or outcomes.

This standard defines the Profile as a business domain. It does not define fields, technical structures, interfaces, account workflows or lifecycle transitions.

## 2. Constitutional Role

The Profile is the governed representation of the Identity context through which a Person may be represented consistently and safely across Tiizi. It supports:

- **identity:** the governed context through which the Person is recognized and attributable;
- **privacy:** classification and use of Profile information according to approved visibility classes and minimum necessary access;
- **participation:** the identity and preference context needed to support governed Group and Challenge participation;
- **preferences:** permitted personal expressions that may support relevance and experience without becoming policy or authority;
- **accountability:** attribution of personal expressions, consent and permitted actions to the governed identity.

The Profile is not:

- a Challenge;
- a Leaderboard;
- a Knowledge Asset;
- a social profile whose purpose is unrestricted public identity or popularity;
- an individual-challenge mode;
- the authority for accepted activity, Progress, Completion, Ranking or Verification.

Group Challenges remain the primary Version 2 product model. The Profile supports group participation and does not create an individual product mode.

## 3. Domain Boundaries

### Included

The Profile Domain includes the constitutional governance of:

- the person's governed identity representation;
- participation-supporting personal information;
- personal preferences and Interests where permitted;
- privacy meaning and visibility classification for Profile information;
- attributable consent information;
- truthful presentation of approved Profile information;
- derived Profile information only where a later approved authority and purpose exist;
- the relationship between Profile information and other platform domains.

### Excluded

The Profile Domain does not govern:

- Group ownership, membership or role authority;
- Challenge participation or Challenge lifecycle;
- Submission Intent, Accepted Activity Events or Verification;
- Progress, Completion, Ranking, Leaderboards or Streaks;
- Knowledge Assets, activity definitions or the Runtime Catalogue;
- social graphs, friendships or public popularity;
- notifications, rewards or recognition as independent Profile truth;
- administrative authority merely because Profile information is available;
- account lifecycle states or transitions.

### Future Considerations

Future governance may define account lifecycle, Profile completion, editing, identity verification, Profile media, retention, deletion and additional permitted relationships. These possibilities create no current authority, workflow, state or launch obligation.

Individual challenges remain a possible future governed capability only and are excluded from Version 2 launch. The Profile Domain does not anticipate or require them.

## 4. Domain Principles

### 4.1 One Profile Per Governed Identity

Each governed identity shall have one authoritative Profile representation. Alternate presentations shall not become competing Profile authorities.

This principle does not define account linking, identity recovery or lifecycle behavior.

### 4.2 Profile Supports Participation

A Profile exists to enable safe and meaningful group participation. It does not constitute participation in a Group or Challenge.

### 4.3 Privacy Precedes Convenience

Access, discovery and presentation shall remain constrained by approved visibility classes, minimum necessary use and deny-by-default access.

### 4.4 Preferences Do Not Establish Authority

A preference or Interest expresses personal relevance or choice where permitted. It does not establish Knowledge, Policy, eligibility, participation, evidence or Derived Truth.

### 4.5 Profile Information Is Not Challenge Truth

Profile information shall not establish Submission Intent, an Accepted Activity Event, Progress, Completion, Ranking, Verification or any other Challenge outcome.

### 4.6 Profile Supports Groups but Is Not Owned by Groups

A Group may receive only the Profile information necessary for an approved participation purpose. A Group relationship does not transfer Profile ownership or unrestricted access.

### 4.7 Visibility Classification Is Constitutional

Every use or presentation of Profile information shall conform to the approved visibility class and purpose. Visibility does not grant authority to change Profile truth.

### 4.8 Presentation Remains Subordinate

A summary, label or other presentation of Profile information remains subordinate to the authoritative Profile information it communicates.

### 4.9 Profile Truth Remains Attributable

Authoritative Profile information and material changes shall remain attributable to the relevant identity, authority, purpose and governing basis.

### 4.10 Domain Boundaries Precede Feature Convenience

No feature may treat the Profile as a source of Challenge, Knowledge, Activity or Derived authority merely to simplify a local experience.

## 5. Information Model

The Profile Domain recognizes the following conceptual information groupings. These groupings describe purpose and authority; they do not define fields.

| Profile information grouping | Constitutional category | Purpose | Authority boundary |
|---|---|---|---|
| Identity Information | Identity Information | Represent the person consistently and support attributable participation. | Identity Authority establishes authoritative identity context; the person is the information subject. |
| Participation-supporting Information | Identity Information | Provide only the Profile-held identity context necessary to support governed Group or Challenge participation. | It may reference Participation Information, but it does not establish membership, participation or Challenge state. |
| Preference Information | Identity Information | Represent permitted personal preferences or Interests. | Participant Authority may express preferences; preferences do not become Policy, Knowledge or eligibility authority. |
| Privacy Information | Identity Information | Express approved privacy choices and the visibility meaning attached to Profile information. | It may be constrained by Policy and Administrative Information, but display alone cannot establish protection. |
| Consent Information | Identity Information | Preserve the Person's attributable expression concerning identified terms or privacy conditions. | Administrative evidence of a consent decision remains separate; consent meaning is limited to its identified version, subject, source, time and purpose. |
| Profile-derived Information | Derived Information | Express an approved calculation concerning Profile information. | It requires a declared Calculation Authority and never becomes an independent source of Profile truth. |
| Profile Analytical Information | Analytical Information | Interpret Profile-related patterns for a declared analytical purpose. | It remains attributable to source information and cannot establish Identity Information. |
| Profile Administrative Information | Administrative Information | Record approved exercises of Profile-related Administrative Authority. | It records the authority action and does not become the Person's Identity Information. |
| Presentation Information | Presentation Information | Communicate approved Profile information to an approved audience. | Presentation Authority may format or summarize but cannot broaden visibility or redefine truth. |
| Temporary Information | Temporary Information | Support a limited, declared working purpose before governed acceptance or disposal. | It is not authoritative Profile information unless accepted through a later governed process. |

Health, body, contact, birth-date and private preference information shall not be broadly readable. Classification depends on governed purpose and approved visibility, not convenience.

## 6. Authority Model

The Profile Domain conforms to the Platform Authority Model.

| Authority type | Profile-domain authority | Boundary |
|---|---|---|
| Participant Authority | May express personal preferences, Interests, consent or withdrawal expressions and participant-authored Profile information where later governance permits. | Does not establish authoritative identity state, participation, Accepted Activity Events, Progress, Completion, Ranking, Verification, Policy or authoritative analytics. |
| Identity Authority | Establishes authoritative identity and Profile information within approved privacy and later lifecycle rules. | Does not establish Group or Challenge relationships, activity evidence or Derived Truth. |
| Administrative Authority | May perform only explicitly approved high-impact Profile decisions under least privilege and durable accountability. | Receives no unrestricted Profile access and no final role hierarchy from this standard. |
| Presentation Authority | May communicate approved Profile information to an approved audience through truthful formatting or summarization. | Cannot change Profile truth, visibility classification or underlying authority. |
| Governance Authority | Approves Profile standards, authority boundaries, amendments and governed exceptions. | Does not create hidden authority or silently convert pending decisions into approved rules. |

Supporting constitutional authorities remain distinct:

- Participation Authority governs relationships to Groups and Challenges, not the Profile itself.
- Policy Authority constrains Profile use, privacy, access and administrative action without becoming Profile evidence.
- Calculation Authority may establish approved Profile-derived information only under a separately governed purpose and method.
- Operational Authority may support controlled operation but does not receive Profile ownership or unrestricted authority.

## 7. Ownership Model

This foundation describes Profile ownership without creating the Entity Ownership Register.

| Constitutional relationship | Constitutional position |
|---|---|
| Governed subject | The Profile is the Governed subject of this domain. |
| Information subject | The Person is the Information subject of Profile information. |
| Attributable originator | The Person is the Attributable originator of permitted personal expressions; origin does not establish all Profile truth. |
| Authority to establish truth | Identity Authority establishes authoritative Identity and Profile information within approved governance. Participant Authority establishes only the Person's permitted expressions. |
| Accountable steward | Accountable stewardship remains deferred. |
| Custodian | A later approved standard shall assign custody for preserving authoritative Profile information. Custody does not grant unrestricted use or Authority to establish truth. |
| Administrator | An Administrator may act only through explicitly assigned Administrative Authority under least privilege and durable accountability. |
| Operator | An Operator may support controlled operation only within explicitly assigned Operational Authority. |
| Presenter | A Presenter may communicate approved Profile information without redefining its truth or visibility. |
| Downstream user | A Downstream user may use approved Profile information only for the declared purpose and does not acquire authority over it. |

No Group, Challenge, feature, presentation or local copy acquires accountable stewardship or Authority to establish Profile truth. The full stewardship, custody and lifecycle allocation remains deferred to the Entity Ownership Register and later standards.

## 8. Relationships

| Related concept | Profile relationship | Boundary |
|---|---|---|
| Group | A Profile may provide the minimum Identity context necessary for governed Group participation. | A Group does not acquire stewardship of the Profile, Authority to establish Profile truth or access to all Profile information. |
| Participant | A Participant is a person with a governed relationship to a Challenge and may be represented through a Profile. | A Profile does not make the person a Participant. |
| Challenge | A Profile may support Identity, privacy and preference context for Challenge participation. | A Profile does not create, govern, configure or complete a Challenge. |
| Knowledge Asset | A Knowledge Asset may define concepts relevant to Profile preferences or participation. | Profile preferences are not Knowledge Assets and do not alter the Runtime Catalogue. |
| Activity Event | An Accepted Activity Event may reference the governed Identity or Participant context associated with a Profile. | Profile information is not Submission Intent, an Accepted Activity Event or Evidence Eligibility. |
| Progress | Progress may be communicated in a person-relevant context. | Profile information does not calculate or establish Progress. |
| Notification | A Notification may use approved Profile context to communicate truthfully to an appropriate recipient. | A Notification is not Profile authority and its display does not change Profile truth. |
| Analytics | Approved analytics may interpret Profile-related information for a declared purpose. | Analytical information does not alter the Profile or silently become authoritative identity information. |
| Administration | Administration may exercise approved Profile-related authority under least privilege and accountability. | Administrative access is not accountable stewardship or unrestricted authority. |
| Person | The Person is the human Information subject who may hold governed Identity and participation relationships. | The Profile is not the Person. |
| Identity | The Profile is the governed representation of Identity and participation-supporting information. | Identity is not the Person, a presentation or authority over unrelated domains. |

## 9. Information Integrity Rules

1. A Profile does not establish Group membership or Challenge participation.
2. A Profile does not establish Submission Intent, Accepted Activity Events or Verification.
3. A Profile does not establish Progress, Completion, Ranking, Leaderboards or Streaks.
4. Preferences and Interests do not create Knowledge, Policy, eligibility or administrative authority.
5. Privacy controls shall not promise effects that approved governance cannot enforce.
6. Presentation shall not redefine Profile truth, expand visibility or become an independent authority.
7. Group access shall remain limited to information necessary for an approved participation purpose.
8. Administrative access shall remain attributable, purpose-limited and constrained by least privilege.
9. Profile-derived information shall remain attributable to its approved inputs, Policy and Calculation Authority.
10. Temporary or copied Profile information shall not silently become authoritative.
11. Profile information shall not be used for an undeclared purpose merely because it is available.
12. Material uncertainty about Profile information shall be represented truthfully.

## 10. Visibility

Visibility classifies the approved audience for Profile information. It does not establish ownership, editing rights or authority.

| Visibility class | Profile-domain meaning | Constitutional constraint |
|---|---|---|
| Public | Profile information specifically approved for access without a participation relationship. | Public classification is exceptional and purpose-specific; it does not make the entire Profile public. |
| Authenticated-discoverable | Minimal Profile information approved for governed discovery by an authenticated person. | Discovery does not grant broader access, editing rights or participation. |
| Shared-group | Profile information necessary for an approved shared Group context. | Access depends on the relevant governed relationship and remains limited to participation need. |
| Private | Profile information approved only for the person and specifically authorized purposes. | Private does not mean that the person can override every governed operational duty; any other access requires explicit authority and minimum necessary use. |
| Privileged-operational | Profile information approved only for a defined operational authority. | Privileged access is deny-by-default, purpose-limited, reviewable and never unrestricted. |

Visibility classification shall be enforceable and truthfully represented. A preference to hide or share information does not by itself establish the applicable authority or override Policy.

## 11. Deferred Areas

This standard explicitly defers:

- account lifecycle;
- Profile completion workflow;
- editing workflow;
- Verification workflow;
- Profile media lifecycle;
- deletion;
- retention;
- Group invitations;
- friend relationships;
- social graph;
- account recovery and identity-linking behavior;
- Profile field definitions;
- technical implementation.

These areas require later approved governance. No deferred workflow, state, actor, transition, retention period or authority is created by this standard.

## 12. Governance

### Status

Status: Tiizi Foundational Governance Baseline v1.0 — reconciled for founder review. Approved Session 1 constitutional facts are incorporated and are not reopened by this standard.

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
- [Session 1 Founder Approval Report](../../reports/platform-foundation-decisions/13-SESSION-1-FOUNDER-APPROVAL-REPORT.md)

### Precedence

This standard is subordinate to the Tiizi Platform Constitution, approved founder decisions and approved platform standards. Later Profile standards may refine it but shall not contradict it.

### Decision Trace

| Decision | Profile-domain effect |
|---|---|
| PLT-01 | Places Profile governance within Tiizi's group-first platform identity. |
| PLT-02 | Establishes the Profile as supporting group participation rather than an individual-challenge mode. |
| PLT-03 | Keeps the Profile foundation domain-neutral while Fitness and Wellness remain launch domains. |
| PLT-04 | Excludes individual challenges from Version 2 and from this Profile standard. |
| IDP-01 | Establishes minimal disclosure, deny-by-default access and the five visibility classes. |
| IDP-02 | Requires enforceable privacy meaning and consent records attributable to the accepted terms or privacy version. |
| ACT-01 | Keeps the Profile distinct from the canonical Activity Event. |
| ACT-02 | Prevents Profile or Participant Authority from establishing accepted events or Derived Truth. |
| KNW-01 | Keeps preferences distinct from Knowledge Assets and the governed Runtime Catalogue authority. |
| ADM-01 | Requires least privilege, trusted high-impact authority and durable accountability. |

### Relationship to the Completed Foundational Domain Standards

The [Group Domain Standard](02-GROUP-DOMAIN-STANDARD.md), [Challenge Domain Standard](03-CHALLENGE-DOMAIN-STANDARD.md), [Activity Event Domain Standard](04-ACTIVITY-EVENT-DOMAIN-STANDARD.md) and [Knowledge Asset Domain Standard](05-KNOWLEDGE-ASSET-DOMAIN-STANDARD.md) govern their respective subjects. Reciprocal references do not transfer authority or stewardship.

### Relationship to Later Standards

Later identity, privacy, lifecycle, entity ownership, role, permission, security and operational standards shall conform to this Profile Domain Standard. They may assign approved actors and processes only after the relevant founder decisions are approved.
