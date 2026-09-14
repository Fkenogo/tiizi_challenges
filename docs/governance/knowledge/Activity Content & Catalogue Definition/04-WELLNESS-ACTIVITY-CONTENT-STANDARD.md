# Tiizi V2 Wellness Activity Content Standard

**Working package:** Tiizi V2 Activity Content & Catalogue Definition\
**Section:** 04\
**Status:** Founder/Product working baseline\
**Purpose:** Define the content required for canonical Wellness
Activities while keeping them concrete, reportable, non-clinical and
independent of Challenge-specific configuration.

## 1. Wellness Activity Definition

A canonical **Wellness Activity** is a governed wellness practice or
action that a participant can understand, perform and report, with
defined meaning, valid measurement options, reporting semantics and
applicable practice guidance.

A Wellness Activity describes **what the participant does**. It is not
merely a desired state, health outcome, aspiration or diagnosis.

Examples of Activity-shaped concepts include a defined breathing
practice, meditation practice, hydration action or other concrete
governed practice.

Concepts such as "be less stressed", "be healthier" or "improve
wellbeing" are outcomes or aspirations rather than canonical Activities
because they do not by themselves define a performable and reportable
action.

## 2. Wellness Content Principle

Wellness content must be sufficient for a participant to understand:

1.  what the practice/action is;
2.  what they are expected to do;
3.  what Tiizi may validly ask them to report;
4.  what completion or a reported value means;
5.  any proportionate preparation, protocol or safety guidance relevant
    to the practice.

Tiizi describes and supports ordinary wellness practices. Canonical
Wellness content must not silently become diagnosis, treatment,
individualized medical advice or unsupported health claims.

## 3. Wellness Activity Patterns

Wellness Activities should use the modules that fit their actual nature.
They must not all be forced into a generic "Done" checkbox.

### 3.1 Protocol / Practice Activities

These involve following a defined practice or sequence.

Typical applicable modules: - purpose/context; - preparation; - protocol
steps; - session framing; - completion meaning; - reporting; -
cautions/safety.

Possible measurements: - `Duration → seconds/minutes` -
`Completion → completion`

Breathing Practice is the initial exemplar of this pattern.

### 3.2 Duration-Based Wellness Activities

Some practices are naturally configured around time.

Applicable content should define: - what the practice consists of; -
what period is being timed; - when the practice begins/ends where
needed; - participant reporting guidance; - applicable protocol or
practice guidance; - safety/cautions where relevant.

Typical measurement: `Duration → seconds/minutes`

The Activity defines valid duration reporting. The Challenge determines
the required duration and applicable period/window.

### 3.3 Completion-Based Wellness Activities

Some practices are best represented by whether a defined action or
session was completed.

Applicable content must define what the participant is affirming when
they mark **Done**.

Typical measurement: `Completion → completion`

Completion must not become a shortcut for vague goals. A
completion-based Activity still needs a concrete, understandable action
or practice.

### 3.4 Quantity-Based Wellness Activities

Some concrete Wellness Activities may legitimately be measured by
quantity.

Applicable content should define: - what is being measured; - exact
valid unit(s); - reporting meaning; - relevant practical guidance; -
applicable safety boundary.

Typical measurement: `Quantity → governed compatible unit`

Quantity is not a generic numeric escape hatch. Units must be explicitly
governed for the canonical Activity.

### 3.5 Routine / Repeated-Practice Activities

A Wellness Activity may describe a repeatable practice, but canonical
Activity Knowledge must not encode the Challenge frequency.

For example, the Activity can define the practice and how completion is
reported. "Do this every day for 30 days" belongs to Challenge
Definition.

## 4. Universal Wellness Content

Every published Wellness Activity should establish, where applicable
under KCS:

### Identity

-   immutable Activity Code;
-   canonical title;
-   Wellness domain;
-   governed category;
-   optional subcategory.

### Meaning

-   concise description;
-   purpose/context framed around the practice itself;
-   enough semantic definition to distinguish it from related practices.

### Measurement

-   supported Metric(s);
-   exact valid Metric/Unit tuple(s);
-   measurement meaning;
-   participant reporting instruction;
-   completion meaning where Completion is supported.

### Practice Guidance

Applicable modules may include: - preparation; - protocol; - session
framing; - completion guidance; - practical reporting guidance.

### Safety

-   proportionate cautions where required;
-   no unsupported clinical or therapeutic claims.

No field should be filled with invented content merely because it exists
in the data model.

## 5. Purpose and Description

Wellness descriptions should explain the practice, not promise a health
result.

Appropriate framing: \> A slow guided breathing practice using a
repeated inhale-and-exhale pattern.

Avoid outcome claims such as: \> Treats anxiety.

The catalogue may explain ordinary context or purpose without converting
correlation, tradition or common use into a medical claim.

## 6. Preparation

Preparation describes what a participant should do before beginning
where this materially helps them practise the Activity.

It may include: - choosing an appropriate setting; - assuming a
comfortable position; - preparing ordinary required materials; - other
simple non-clinical setup.

Preparation is optional where unnecessary.

## 7. Protocol

A protocol defines the steps or sequence that make up a practice where
sequence matters.

A good protocol should: - be understandable without specialist
knowledge; - contain only steps material to the canonical practice; -
avoid embedding Challenge targets/frequency; - avoid unsupported
therapeutic prescriptions.

Not every Wellness Activity requires a protocol.

## 8. Session Framing

Session framing explains the boundaries of a practice session where
useful.

It may clarify: - how a session begins; - what constitutes continuing
the practice; - how the session ends; - whether Duration or Completion
is an appropriate measurement.

Session framing belongs to Activity meaning. A Challenge-specific
required session length belongs to Challenge Definition unless that
duration is inherently part of the identity of a distinct canonical
practice.

## 9. Completion Meaning

Where `Completion → completion` is supported, the Activity must define
what the participant is affirming by selecting **Done**.

Completion meaning should be: - concrete; - understandable; - tied to
the practice/action; - independent of Challenge scoring or streak state.

A participant reporting an Activity as complete does not itself mean a
Challenge day is Done. The Challenge Engine determines Challenge-period
truth from all configured requirements.

## 10. Duration Meaning

Where Duration is supported, the Activity must explain what period is
being reported.

Duration may describe time spent performing the practice. It must not
silently encode a Challenge target.

For example:

Activity: `Breathing Practice → Duration → minutes`

Challenge: `Practise for 10 minutes per day`

The `10 minutes per day` requirement is Challenge configuration, not
canonical Breathing Practice content.

## 11. Quantity Meaning

Where Quantity is supported, the Activity must define: - what quantity
is reported; - the exact compatible unit(s); - what a reported value
represents.

Quantity-based Wellness content requires particular care where
nutrition, hydration or other health-adjacent practices are involved.

Canonical Knowledge should define the reportable practice without
inventing universal personal intake targets, medical thresholds or
individualized recommendations.

Any Challenge target remains separately configured and must respect
later product/safety rules.

## 12. Guidance Versus Health Claims

Tiizi distinguishes:

**Practice guidance** --- explains how to carry out an ordinary wellness
practice.

**Reporting guidance** --- explains what the participant reports.

**Health/clinical claim** --- asserts prevention, diagnosis, treatment,
cure or a specific medical outcome.

Canonical Wellness Activities may contain the first two. They must not
depend on the third for their product meaning.

## 13. Safety and Caution Boundary

Appropriate ordinary cautions may include: - use a safe and comfortable
environment; - stop a practice if it causes significant discomfort; -
return to normal breathing if a breathing exercise causes dizziness; -
avoid unsafe physical circumstances.

Tiizi should not invent: - disease-specific treatment instructions; -
individualized medical thresholds; - medication guidance; - diagnostic
interpretations; - universal nutrition/hydration prescriptions presented
as medically correct for everyone; - unsupported claims that completing
an Activity produces a clinical result.

If a proposed Activity cannot be responsibly described without
individualized or clinical guidance, it may not be suitable for the
ordinary canonical catalogue without a separately governed product
decision.

## 14. Avoidance Conditions

Where a practice has an obvious ordinary circumstance in which it should
not be performed, a concise avoidance condition may be included.

Avoidance conditions must remain proportionate and supported. They
should not become an improvised medical contraindication database.

The applicable KCS safety requirements govern whether stronger caution
is necessary before publication.

## 15. Breathing Practice --- Pattern Validation

**Activity Code:** `WEL-MND-003`\
**Activity:** Breathing Practice\
**Pattern:** Protocol / Practice Activity\
**Supported Metrics:** Duration and Completion\
**Valid Units:** seconds/minutes for Duration; completion for Completion

The PF-01 exemplar establishes the intended structural pattern: -
description; - protocol; - session framing; - duration reporting; -
completion meaning; - ordinary safety caution.

For final catalogue content, the exemplar should be reviewed so that:

1.  the protocol is practical and understandable;
2.  its wording does not imply therapeutic treatment;
3.  Duration and Completion remain separate valid measurement paths;
4.  marking Done means completing the defined practice, not
    automatically satisfying the entire Challenge day;
5.  Challenge-specific duration/frequency/target remains outside the
    Activity;
6.  safety guidance stays proportionate and non-clinical.

## 16. Wellness Catalogue Guardrails

A proposed Wellness catalogue item should remain Draft or be rejected as
a canonical Activity if it is primarily:

-   a desired outcome rather than an action/practice;
-   an emotion or state with no governed participant action;
-   a medical treatment;
-   a diagnosis or symptom assessment;
-   an unsupported therapeutic claim;
-   a Challenge target disguised as an Activity;
-   a vague "healthy habit" with no clear reporting meaning.

The catalogue should prefer concrete, understandable, reportable
practices.

## 17. Catalogue Authoring Rule

Before a Wellness Activity becomes publication-ready, the
author/reviewer should be able to answer:

-   What concrete practice or action is this?
-   Which Wellness category does it belong to?
-   Can a participant understand what to do?
-   Which Metrics can legitimately measure/report it?
-   Which exact units are valid?
-   If Completion is supported, what exactly is the participant
    affirming?
-   If Duration is supported, what period is being timed?
-   If Quantity is supported, what exactly is measured and in what
    governed unit?
-   Does the Activity require preparation, protocol or session framing?
-   Is the content describing a practice rather than promising a health
    outcome?
-   What proportionate safety/caution content is required?
-   Is any Challenge-specific target, frequency or scoring rule embedded
    in the Activity?

If these questions cannot be answered coherently, the item should remain
Draft rather than being forced into Challenge eligibility.

## 18. Representative Wellness Validation

Before scaling the Wellness catalogue, Tiizi should validate this
standard against real Activities from the approved working catalogue
that collectively exercise:

-   protocol-based practice;
-   duration reporting;
-   completion reporting;
-   quantity reporting where genuinely applicable;
-   a routine/repeated practice without embedding Challenge frequency;
-   a health-adjacent Activity that tests the safety/claim boundary.

Representative Activities should come from the approved catalogue
evidence rather than being invented solely to satisfy schema coverage.

Where real product evidence exposes a genuine missing content or
measurement pattern, amend the standard before bulk authoring.

## 16. Health-Adjacent Publication and Challenge-Use Gates

For health-adjacent Wellness Activities, publication and Challenge use
require separate decisions.

**Publication gate:** Is the canonical meaning, reporting contract,
ordinary guidance and applicable safety/caution content sufficiently
responsible and supported?

**Challenge-use gate:** Are the proposed targets, Duration, frequency,
Streak pressure, Competitive pressure or other configuration choices
permitted for this Activity?

Passing the publication gate does not automatically authorize every
Challenge configuration.

## 17. Completion Must State the Participant Affirmation

Where Completion is supported, the canonical content must be able to
state clearly what the participant affirms by marking **Done**.

If Completion only becomes meaningful after importing a target, schedule
or temporal condition, the Activity/Metric compatibility requires
further review.

This protects Completion from becoming a generic escape hatch for
concepts that are not sufficiently defined Activities.

## 18. Temporal Conditions Versus Canonical Activities

Concepts such as Bedtime and Wake Time demonstrate that a clock-time
condition can be mistaken for an Activity identity.

Catalogue authoring should ask:

-   What concrete undertaking does the participant perform?
-   What part is the Challenge-selected clock-time condition?
-   Does the concept belong as a canonical Activity, a renamed/reframed
    Activity, or primarily in Challenge Definition?

Timezone, target clock time, `by/at/within` semantics and any tolerance
belong to governed Challenge temporal configuration rather than being
hidden inside canonical Activity identity.
