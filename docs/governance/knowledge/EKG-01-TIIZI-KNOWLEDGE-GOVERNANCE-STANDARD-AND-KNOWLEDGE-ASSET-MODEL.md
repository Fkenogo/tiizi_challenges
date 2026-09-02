# EKG-01 --- Tiizi Knowledge Governance Standard & Knowledge Asset Model

**Working Draft v0.1 (corrected) --- For Founder Review --- NOT Founder Approved**

## Document Control

| Field | Value |
| --- | --- |
| Programme | Tiizi Version 2 |
| Stage | Stage EK --- Knowledge Governance |
| Document type | Knowledge Governance Standard & Knowledge Asset Model |
| Version | v0.1 (corrected) --- prepared from Working Draft v0.1 |
| Status | **Working Draft --- For Founder Review --- NOT Founder Approved** |
| Date | 2026-09-02 |
| Basis | Prior EKG-01 Working Draft v0.1; [Stage EK Repository Reconciliation Report](../../programme/STAGE-EK-EKG-01-REPOSITORY-RECONCILIATION-REPORT.md); [Stage EK Knowledge Foundation Audit & Carry-Forward Assessment](../../programme/STAGE-EK-KNOWLEDGE-FOUNDATION-AUDIT-AND-CARRY-FORWARD-ASSESSMENT.md) |
| Authority constraints | CGP-02 (Complete, FLD-01); CGP-03 (Complete, CGP-03-FAD-01); CGP-04 (Complete, CGP-04-FAD-01) |
| Dependencies | EOG-03 (Constitutional Governance of Platform Knowledge); Knowledge Asset Domain Standard; Platform Authority Model (PAM-01); Platform Constitution; Master Programme v1.42 |

## 1. Purpose

This Standard establishes the governance of Platform Knowledge within
Tiizi and defines the Knowledge Asset model through which authoritative
Activity Knowledge is created, classified, managed, published and
consumed.

It establishes the authoritative Knowledge structure; canonical
Knowledge Asset identity and meaning; the relationship between Fitness
and Wellness Activity Knowledge; classification and relationship rules;
measurement and configuration compatibility; Knowledge authority and
delegated administration; lifecycle and publication requirements;
Runtime Catalogue authority; historical integrity requirements; and the
boundary between Knowledge and downstream product configuration.

The Standard governs Knowledge. It does not prescribe the final
technical implementation, database schema, Admin interface,
recommendation engine or Challenge Wizard implementation.

## 2. Governing principles

### EKG-P01 --- One governed Knowledge system

Tiizi shall maintain **one governed Platform Knowledge system** rather
than independent competing Knowledge systems for Fitness and Wellness.
Fitness and Wellness are domains within the common Activity Knowledge
architecture.

### EKG-P02 --- Canonical authority

A governed concept shall have one authoritative canonical identity
within the Tiizi Knowledge Base. No Runtime Catalogue, Challenge,
Template, Group, Community, Admin interface or implementation
representation may independently establish a competing canonical meaning
for the same concept.

### EKG-P03 --- Knowledge precedes configuration

Knowledge establishes what an Activity **is** and the legitimate ways in
which it may be represented and used. A Challenge, Template or other
product function determines what users are asked to do with that
Knowledge.

### EKG-P04 --- Activity identity is independent of target

Targets, schedules, frequencies, durations, challenge types, Group
settings and other configurations do not by themselves create new
Activity identities. `Running` is the Activity;
`Run 5 km daily for 30 days` is a configured undertaking using that
Activity.

### EKG-P05 --- Common architecture does not require identical domain structures

Fitness and Wellness Activities shall conform to the common Activity
Knowledge requirements while retaining domain-appropriate
classifications, guidance, relationships and other attributes. Fitness
shall not be forced into a Wellness structure, and Wellness shall not be
forced into an Exercise-specific structure merely to create technical
symmetry.

### EKG-P06 --- Context does not create identity

Different purposes, environments, participation contexts or product uses
do not by themselves create separate canonical Activities. An Activity
may legitimately participate in multiple contexts while retaining one
canonical identity.

### EKG-P07 --- Knowledge remains extensible

The initial Knowledge catalogue is a governed baseline, not a
permanently closed catalogue. New Activities, classifications and other
permitted Knowledge may be introduced, existing Knowledge may be
revised, and Knowledge may be retired through the governed Knowledge
lifecycle.

## 3. Knowledge architecture

``` text
TIIZI KNOWLEDGE BASE

Activity Knowledge
├── Fitness
│   └── Exercise Assets
└── Wellness
    └── Wellness Activity Assets
```

**Activity** is the common user-facing concept. **Fitness** and
**Wellness** are the initial Activity domains. An **Exercise Asset** is
a Fitness-domain Activity Knowledge Asset. A **Wellness Activity Asset**
is a Wellness-domain Activity Knowledge Asset. Both conform to the
common Activity Knowledge Asset model.

This preserves the existing constitutional recognition of Exercise and
Wellness Activity as primary Platform Knowledge Assets while placing
them within one coherent Activity Knowledge system.

## 4. Canonical Activity Knowledge Asset

A Canonical Activity Knowledge Asset represents an Activity's
authoritative identity and meaning within Tiizi.

The common model shall be capable of representing, where applicable:

-   **Identity:** canonical identifier, canonical name, domain, activity
    type, authoritative meaning, lifecycle state.
-   **Classification:** primary category, internal classifications,
    family/sub-family where applicable, secondary relationships,
    discovery classifications.
-   **Meaning & Guidance:** user-facing description,
    instructions/guidance, safety/caution information where required.
-   **Measurement:** compatible metrics, compatible units, measurement
    relationships.
-   **Configuration:** permitted configuration relationships,
    restrictions/constraints, challenge-use compatibility where
    required.
-   **Relationships:** variants, related Activities,
    progression/regression where applicable, equipment, body/muscle,
    environment, participation context and purpose/context.
-   **Governance:** provenance, lifecycle information, publication
    status and historical traceability.

Not every attribute is mandatory for every Activity. Each Asset must
contain enough authoritative information to support legitimate use
without ambiguity that would materially impair truthful interpretation.

## 5. Initial Activity taxonomy

### 5.1 Fitness

  -----------------------------------------------------------------------
  Category                            Scope
  ----------------------------------- -----------------------------------
  **Strength**                        Resistance-based Activities
                                      primarily concerned with muscular
                                      strength or capacity

  **Cardio & Conditioning**           Activities primarily concerned with
                                      cardiovascular capacity,
                                      conditioning or sustained/repeated
                                      physical effort

  **Mobility & Flexibility**          Activities primarily concerned with
                                      usable range of motion, mobility or
                                      flexibility

  **Balance & Stability**             Activities primarily concerned with
                                      balance, stability or body control

  **Power, Speed & Agility**          Activities primarily concerned with
                                      explosive movement, speed,
                                      responsiveness or change of
                                      direction

  **Sports & Recreation**             Game-based, sporting or
                                      recreational physical Activities
  -----------------------------------------------------------------------

Fitness may use richer internal classification, including movement
families and sub-families, without requiring those classifications to
appear as primary user navigation.

Candidate internal families may include Push, Pull, Squat, Hinge, Lunge,
Step, Carry, trunk/core patterns, Locomotion, Cyclical Cardio, Mobility,
Flexibility, Balance/Stability, Jump/Plyometric, Throw, Speed and
Agility.

Traceability: the six-category Fitness taxonomy above and its candidate
internal families are the current substantive proposal under EK-FQ-07/08
of the Stage EK Knowledge Foundation Audit. The prior 7 Exercise Domain /
19 canonical family Fitness taxonomy material (Tiizi Canonical Exercise
Families v2.2; Exercise Family Specification v2) remains prior
candidate/evidence only and does not constitute current governing
authority or displace this six-category candidate baseline.

### 5.2 Wellness

  -----------------------------------------------------------------------
  Category                            Initial candidate scope
  ----------------------------------- -----------------------------------
  **Sleep & Rest**                    Sleep, Bedtime, Wake Time, Nap/Rest

  **Mind & Emotional Wellbeing**      Meditation, Mindfulness Practice,
                                      Breathing Practice, Body Scan,
                                      Journaling, Gratitude Practice,
                                      Prayer/Reflection, Relaxation
                                      Practice, Stress Check-In, Time
                                      Outdoors

  **Nutrition & Hydration**           Water Intake, Fruit Intake,
                                      Vegetable Intake, Protein Intake,
                                      Whole-Food Meals, Home-Cooked
                                      Meals, Meal Planning, Mindful
                                      Eating, Added-Sugar Avoidance,
                                      Sugary-Drink Avoidance, Fasting

  **Daily Living**                    Digital Break, Decluttering,
                                      Personal Planning, No Late-Night
                                      Snacking

  **Personal Growth**                 Reading, Learning, Creative
                                      Practice

  **Social Wellbeing**                Social Connection/Check-In, Family
                                      Time, Acts of Kindness, Community
                                      Participation
  -----------------------------------------------------------------------

These constitute an **initial candidate baseline**, not an exhaustive
statement of every Activity Tiizi may support. Further editorial
normalization may occur during canonical catalogue construction.

Traceability: this six-category Wellness candidate baseline is the
current substantive proposal under EK-FQ-09 of the Stage EK Knowledge
Foundation Audit. The Wellness Catalogue Rationalisation Matrix
(67-activity rationalisation across prior Wellness categories) remains
prior candidate/evidence only and does not constitute current governing
authority or displace this six-category candidate baseline.

### 5.3 Health-management exclusion

Clinical measurements, medication management and similar
health-management records are outside the Version 2 launch Challenge
Activity Knowledge Library, including blood pressure checks, blood sugar
checks, medication adherence, clinical or preventive health appointments
and comparable health-monitoring records.

Their possible future treatment as private checks, records or another
Knowledge class is not determined by this Standard and does not block
Version 2 launch Knowledge Governance.

Traceability: this exclusion is consistent with the Wellness Catalogue
Rationalisation Matrix RESTRICT treatment (private, non-competitive
health tracking) and the reserved Health Tracking taxonomy; see EK-FQ-09.

## 6. Primary classification and cross-context use

Each canonical Activity shall have one authoritative identity and an
appropriate primary classification. An Activity may additionally have
governed relationships allowing it to appear in other discovery or
product contexts.

> **One Activity identity may support multiple legitimate contexts.**

Tiizi shall not create duplicate canonical Activities merely because the
same Activity is relevant to more than one category, purpose or domain
context. Swimming need not become separate `Cardio Swimming` and
`Sports Swimming` Knowledge Assets. Yoga shall not automatically become
multiple Fitness Activities or split into separate Fitness and Wellness
Knowledge Assets.

## 7. Canonical Activities and variants

A difference in presentation or execution does not automatically require
a new canonical Activity. A Variant may remain attributable to an
existing canonical Activity where the difference does not justify an
independent authoritative identity.

A separate canonical identity may be justified where differences in
authoritative meaning, execution mechanics, measurement contract,
equipment dependency, safety characteristics or other materially
governed characteristics make independent treatment necessary for
truthful interpretation or use.

## 8. Metrics and units

Metrics and Units are governed Knowledge supporting Activities; they do
not determine Activity identity. Each Activity shall declare or inherit
the metrics through which participation may legitimately be represented.
Each Metric shall support appropriate Units where applicable.

``` text
Activity
    ↓ permits
Metric
    ↓ permits
Unit
```

Examples: Running → Distance → kilometres/miles; Running → Active
Duration → minutes/hours; Push-Up → Repetitions → repetitions; Water
Intake → Volume → permitted volume units.

The examples above are illustrative pending the governed Metric and Unit
catalogues.

The exact initial controlled Metric and Unit vocabulary shall be
reconciled against existing Tiizi evidence during catalogue construction
rather than inherited automatically from V1.

Traceability: the governed metric and unit catalogues remain Stage EK
work under EK-FQ-04 (governed metric catalogue) and EK-FQ-05 (governed
unit catalogue) of the Stage EK Knowledge Foundation Audit and are not
presented as finally resolved by this Standard.

## 9. Knowledge and Challenge configuration

The Knowledge Base determines the legitimate semantic configuration
space for an Activity. The Challenge determines the selected
configuration for a particular undertaking.

``` text
KNOWLEDGE
Activity + compatible Metrics + compatible Units + constraints + safety/use restrictions

CHALLENGE
Activity + selected Metric + selected Unit + Target + Frequency + Duration + Challenge Type + other permitted rules
```

Challenge configuration shall not modify the canonical Activity.

## 10. Templates

Templates are not canonical Activity Knowledge Assets merely because
they reference Activities. A Template may compose one or more Activities
with configuration guidance for a particular purpose.

Examples include `Better Sleep`, `Warm-Up` and `Cool-Down`.

A Template does not become an independent source of authoritative
Activity meaning.

## 11. Purpose and contextual relationships

Activities may carry governed contextual relationships where useful for
discovery, composition or interpretation. These may include purpose,
environment, participation context, equipment, body/muscle
relationships, secondary classification and other governed relationships
introduced through the Knowledge lifecycle.

Exact controlled vocabularies need not be constitutionally fixed where
they can be safely administered under this Standard.

## 12. Safety and configuration compatibility

The existence of a canonical Activity does not imply that every possible
Challenge configuration involving that Activity is permitted.

Knowledge may establish constraints on permitted metrics, permitted
units, configuration ranges, challenge-type compatibility,
public/private use, safety-sensitive configurations and other conditions
necessary for legitimate use. Knowledge-level challenge-use compatibility
constrains legitimate use; it does not determine or override Policy
eligibility or other governing Challenge authority.

Where evidence is insufficient to establish a specific safety threshold,
Tiizi shall not invent one merely to complete the Knowledge record.

Fasting may exist as a canonical Wellness Activity under Nutrition &
Hydration while specific protocols, durations and safety limits remain
subject to appropriate evidence and configuration governance.

## 13. Knowledge Authority

Ultimate authority over Tiizi Platform Knowledge rests with the
**Founder** as the **Knowledge Authority** (EOG-03 §8; PAM-01).

The Founder may exercise this authority through the Platform's **Super
Admin** administrative capability. The Super Admin designation is an
operational administrative mechanism and does not independently create
or confer Knowledge Authority. Where the Founder holds the Super Admin
role, actions taken through that role may operationally exercise the
Founder's Knowledge Authority.

The Founder, as Knowledge Authority, may create, revise, approve/publish
and retire Knowledge; manage classifications and relationships; and
grant, modify or revoke Knowledge-management capabilities assigned to
other Administrators.

Administrative role membership alone does not confer authority over
Platform Knowledge, and creation of an Admin account does not itself
confer authority to modify Platform Knowledge.

The Founder is the **Accountable Steward** for Platform Knowledge
unless and until that accountability is explicitly delegated under Tiizi
governance.

## 14. Delegated Admin authority

The Founder may delegate bounded Knowledge-management capabilities to
other Administrators. Delegation shall be capability-specific.

An Administrator may, for example, be permitted to create or edit
Knowledge without necessarily being permitted to publish or retire it.

Such delegation does not transfer or create independent Knowledge
Authority. The exact technical authorization mechanism belongs to
downstream implementation.

Traceability: this section together with §13 records the Founder
resolution of EK-FQ-01 (Knowledge Authority holder and Accountable
Steward). Knowledge Authority boundaries follow EOG-03 §8; delegation
conforms to the PAM-01 delegation conditions (PAM-01 §7).

## 15. Ordinary Knowledge administration versus governance change

Ordinary management of the Knowledge catalogue in accordance with this
Standard does not require a new Founder governance decision for each
change.

Adding an appropriately governed new Activity may constitute ordinary
Knowledge administration. Changing the governing rules by which
canonical Knowledge authority, identity, publication or lifecycle
operates constitutes a Knowledge Governance change.

Traceability: this distinction is consistent with CGP-02 amendment
classification (Meaning-Preserving Maintenance versus Meaning-Changing
Amendment) and review-trigger discipline.

## 16. Knowledge lifecycle

The Knowledge system shall support a governed lifecycle sufficient to
distinguish at minimum:

-   Knowledge under preparation;
-   Knowledge eligible for authoritative publication;
-   currently authoritative/published Knowledge; and
-   Knowledge no longer available for new use.

The exact lifecycle vocabulary may be determined during detailed
Knowledge-model construction.

Removal from current use shall not destroy historical interpretability.
Where an Activity has already participated in governed product records,
retirement is generally distinct from destructive deletion.

Traceability: lifecycle vocabulary is subordinate to the CGP-02
Governance Lifecycle concepts; detailed Knowledge lifecycle states
remain within deferred scope (KNW-02/KNW-03; Knowledge Asset Domain
Standard §28).

## 17. Runtime Catalogue

Tiizi shall maintain **one authoritative Runtime Catalogue
relationship** for published Activity Knowledge.

``` text
Governed Knowledge Base
        ↓
Authoritative publication state
        ↓
Runtime Catalogue
        ↓
Product consumers
```

Product consumers may include the Challenge Wizard, Challenge Templates,
Discovery, Activity selection, Recommendations where later authorized,
Participation/logging functions and Historical interpretation.

A product consumer shall not establish competing canonical Activity
meaning. The technical publication pipeline, database representation,
caching model and synchronization mechanism are downstream engineering
matters.

## 18. Historical representation

A Challenge or other durable product record may preserve sufficient
representation of the Knowledge used at the time of composition to
maintain historical intelligibility.

Historical representation preserves what the Challenge meant when
created; remains traceable to its canonical Knowledge source; does not
become a competing canonical Knowledge Asset; and does not automatically
change because the current canonical Activity is later revised or
retired.

## 19. Admin management principle

The Administrator Knowledge-management layer shall ultimately allow authorized
management of the Knowledge Base without requiring engineering changes
for ordinary catalogue administration.

Subject to permissions, this may include Create, Review, Edit, Classify,
Relate, Publish and Retire.

The initial Activity catalogue is a **launch baseline**, not a
hard-coded permanent product boundary.

## 20. Knowledge-to-product boundary

EKG-01 governs **what Tiizi knows and treats as authoritative**. It does
not by itself determine **how every product feature must use that
Knowledge**.

This Standard does not itself authorize or define final Challenge Wizard
UX; recommendation algorithms; universal cross-Activity scoring;
wearable integrations; Firestore or other database schemas; API design;
final Admin UI; technical authorization implementation; migration of V1
catalogues; V1-to-V2 data remediation; or implementation architecture.

## 21. V1 evidence and V2 baseline

Existing V1 Exercise and Wellness catalogues, schemas, classifications
and implementations remain evidence available to V2. They do not
automatically become authoritative V2 Knowledge.

Existing items may be carried forward, normalized, consolidated,
reclassified, redefined, retired or excluded according to the governed
V2 Knowledge model.

No V1 catalogue count or taxonomy determines how many canonical
Activities V2 must contain.

## 22. Initial-baseline principle

Stage EK does not require Tiizi to identify every Activity the Platform
may ever support.

The initial catalogue need only provide a sufficiently coherent and
useful governed baseline for the applicable product stage. Expansion
thereafter occurs through Knowledge administration.

This prevents catalogue completeness from becoming a blocker to product
development.

## 23. Stage EK closure conditions

EKG-01 is sufficient for substantive Stage EK closure once:

1.  its governing model is Founder-approved;
2.  the initial Fitness and Wellness taxonomy is accepted;
3.  Knowledge Authority and delegated administration are settled;
4.  the existing metric/unit evidence has been reconciled into an
    initial controlled vocabulary or explicitly bounded for downstream
    completion;
5.  the initial V2 canonical Activity baseline has been reconciled from
    the existing corpus under the new model;
6.  Runtime Catalogue and historical-representation boundaries are
    confirmed; and
7.  repository reconciliation finds no unresolved constitutional
    contradiction that blocks adoption.

Mapping to the Master Programme Stage EK deliverables:

| Condition | EK deliverable |
| --- | --- |
| 1 --- governing model Founder-approved | EK1 --- Knowledge Asset Governance |
| 2 --- initial Fitness and Wellness taxonomy accepted | EK1 |
| 3 --- Knowledge Authority and delegated administration settled | EK1 |
| 4 --- metric/unit evidence reconciled or bounded | EK1 (supporting Metric/Unit vocabulary) |
| 5 --- initial V2 canonical Activity baseline reconciled | EK1 |
| 6 --- Runtime Catalogue and historical-representation boundaries confirmed | EK2 --- Runtime Catalogue Governance; EK4 --- Knowledge Lifecycle |
| 7 --- repository reconciliation finds no unresolved contradiction | Stage EK completion gate / this reconciliation |

Per the Master Programme dependency order, EK2 depends on EK1; EK3
(Challenge Composition Standard) depends on EK1 and EK2; EK4 depends on
the meaning and runtime boundaries established by EK1 through EK3; and
EK5 (Knowledge Relationship Model) depends on the approved treatment
across EK1 through EK4.

Stage EK closure does not require building the Admin system, migrating
Firestore, rebuilding the Challenge Wizard, or populating every future
Activity.
