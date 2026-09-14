# Tiizi V2 Fitness Activity Content Standard

**Working package:** Tiizi V2 Activity Content & Catalogue Definition\
**Section:** 03\
**Status:** Founder/Product working baseline\
**Purpose:** Define the content required for canonical Fitness
Activities without forcing every Fitness Activity into one
exercise-instruction template.

## 1. Fitness Activity Definition

A canonical **Fitness Activity** is a governed physical activity or
practice whose meaning, valid measurement options, reporting semantics
and applicable performance guidance are defined by Tiizi independently
of any particular Challenge.

A Fitness Activity describes **what is performed and what may be
reported**. It does not define a Challenge target, schedule, scoring
rule, ranking rule, streak rule or recognition outcome.

## 2. Fitness Content Principle

Fitness content must be sufficient for a participant to understand:

1.  what the Activity is;
2.  how it is normally performed;
3.  what Tiizi may validly ask them to report;
4.  what the reported value means;
5.  any proportionate practical guidance or cautions relevant to the
    Activity.

Tiizi provides performance guidance but does not imply independent
verification of technique or reported performance.

## 3. Fitness Activity Patterns

Fitness Activities should be described using the content modules that
fit their real nature. The catalogue must support different patterns
rather than treating every Fitness Activity as a repetition-based
strength exercise.

### 3.1 Repetition / Technique Activities

Examples include Activities whose natural report is a count of discrete
repetitions.

Typical applicable modules: - setup; - execution; - what to count as one
repetition; - form cues; - common mistakes; - equipment/environment
where relevant; - adaptations; - safety guidance.

Typical measurement: `Repetitions → reps`

### 3.2 Static / Timed Activities

These are physical Activities naturally measured by time rather than
repetition.

Typical applicable modules: - setup/position; - execution or hold
meaning; - when timing starts; - when timing ends; - form/position
guidance; - adaptations; - safety.

Typical measurement: `Duration → seconds/minutes`

The Activity defines the valid timed practice. The Challenge determines
the required duration.

### 3.3 Locomotion / Distance Activities

These involve movement over distance.

Typical applicable modules: - activity meaning; - start/end meaning
where needed; - applicable environment/equipment; - reporting
guidance; - practical technique or pacing guidance only where useful; -
adaptations; - safety.

Typical measurement: `Distance → metres/kilometres`

Duration may also be supported where the canonical Activity genuinely
permits time-based Challenge configuration, but this must be an explicit
Metric/Unit compatibility rather than assumed.

### 3.4 Equipment-Based Activities

Equipment use is a content characteristic, not a separate measurement
family.

Applicable content should explain: - required equipment; - setup; -
execution; - measurement; - practical equipment-specific cautions; -
reasonable adaptations where appropriate.

The catalogue should not encode a Challenge target merely because
equipment is involved.

### 3.5 Session / Completion-Oriented Fitness Activities

Some physical practices may be more naturally represented as completing
a defined session or routine rather than counting a single movement.

Where justified by the actual Activity, applicable measurement may
include:

`Completion → completion`

or a governed Duration measurement.

Completion semantics must be explicit enough that a participant knows
what they are marking Done. A generic "workout completed" record without
a canonical Activity meaning is not sufficient merely to fit the schema.

## 4. Universal Fitness Content

Every published Fitness Activity should have, at minimum where
applicable under KCS:

### Identity

-   immutable Activity Code;
-   canonical title;
-   Fitness domain;
-   governed category;
-   optional subcategory.

### Meaning

-   concise description;
-   enough semantic context to distinguish the Activity from similar
    Activities.

### Measurement

-   supported Metric(s);
-   exact valid Metric/Unit tuple(s);
-   measurement meaning;
-   participant reporting instruction.

### Guidance

-   the applicable technique/performance modules for the Activity
    pattern.

### Safety

-   proportionate practical caution where needed.

No field should be filled with fabricated content merely to satisfy a
generic form.

## 5. Setup

Setup describes the starting state required to perform the Activity
where that information materially helps the participant.

It may include: - body position; - equipment placement; -
space/environment; - starting orientation.

Setup should not contain Challenge configuration.

If an Activity has no meaningful setup requirement, the field/module may
be absent.

## 6. Execution

Execution explains the normal sequence or action involved in performing
the Activity.

It should: - use clear participant-facing language; - describe the
essential movement or practice; - avoid unnecessary technical jargon; -
distinguish the Activity from related Activities.

Execution is guidance, not proof that a participant performed the
movement exactly as written.

## 7. Measurement Semantics

For each supported Fitness Metric, the Activity must explain what the
reported value represents.

### Repetitions

The Activity should explain what the participant should count as one
repetition.

This is a **self-report counting standard**, not a claim of platform
verification.

### Duration

The Activity should explain what period is being timed and, where
material, when timing begins and ends.

### Distance

The Activity should explain what travelled distance is being reported.

### Completion

The Activity should explain what defined practice/session must be
completed before the participant marks Done.

## 8. Technique Guidance Versus Count Validity

Tiizi distinguishes:

**Expected technique** --- guidance for performing the Activity
appropriately.

**Reporting semantics** --- what the participant should count/report.

**Verification** --- independent confirmation of whether performance met
a governed standard.

Canonical Fitness content may define the first two. It does not
establish the third.

For example, Push-Up guidance can explain maintaining a stable plank and
using a controlled lowering/press. Its reporting guidance can tell the
participant to count a completed down-and-up cycle. Tiizi does not
thereby claim that each reported repetition was independently observed
or judged.

## 9. Form Cues

Form cues are short practical reminders that improve clarity while
performing an Activity.

Good form cues should be: - concise; - observable or actionable; -
relevant to the Activity; - non-diagnostic.

They are optional where they add no meaningful value.

## 10. Common Mistakes

Common mistakes should only be included where they materially help a
participant understand the expected practice.

They should not: - create a hidden verification standard; - imply Tiizi
observed the mistake; - become exhaustive biomechanical analysis.

## 11. Equipment and Environment

Equipment and environment should distinguish:

-   **required** conditions/equipment needed for the canonical Activity;
-   **optional** equipment that may assist;
-   reasonable environmental requirements where relevant.

Challenge creators should later be able to understand whether an
Activity is appropriate for their Group without inventing equipment
requirements in the Wizard.

## 12. Adaptations

An adaptation is a practical alternative way to perform or access an
Activity while preserving enough of its intended meaning to remain
within the same canonical Activity.

Adaptations must be used carefully.

If an alternative materially changes the movement, measurement semantics
or Activity identity, it should be considered a separate canonical
Activity rather than hidden inside an adaptation field.

The catalogue-definition exercise must therefore review adaptations
individually rather than assuming every variation belongs to the parent
Activity.

## 13. Safety Boundary

Fitness safety guidance should remain proportionate to ordinary
participation.

Appropriate examples include: - use stable equipment/surfaces; - stop if
sharp pain occurs; - avoid an unsafe environment; - use an easier
adaptation if needed.

Canonical Tiizi content should not provide: - diagnosis; - treatment; -
rehabilitation prescriptions; - claims that an Activity cures or
prevents disease; - individualized medical clearance.

Where an Activity requires a stronger caution to be responsibly
published, the applicable KCS safety class governs publication
readiness.

## 14. Push-Up --- Pattern Validation

**Activity Code:** `FIT-STR-001`\
**Activity:** Push-Up\
**Pattern:** Repetition / Technique Activity\
**Primary Metric:** Repetitions\
**Valid Unit:** reps

The current PF-01 exemplar establishes the right content shape: -
description; - setup; - execution; - repetition semantics; - form
cues; - common mistakes; - equipment/environment; - adaptation; - basic
safety.

For the product catalogue, the Push-Up exemplar should be refined under
this standard so that:

1.  technique guidance is clear but not presented as independent
    verification;
2.  "one repetition" is understandable as a participant counting
    instruction;
3.  adaptations do not silently turn into materially different canonical
    Activities;
4.  Challenge targets remain completely outside the Activity content.

## 15. Catalogue Authoring Rule

Before a Fitness Activity becomes publication-ready, the author/reviewer
should be able to answer:

-   What physical Activity is this?
-   Which Fitness category does it belong to?
-   How should a participant understand performing it?
-   What Metrics can legitimately measure it?
-   Which exact units are valid for each Metric?
-   What does the participant report?
-   What applicable setup/execution/technique content is needed?
-   Does it require equipment or environmental guidance?
-   Are proposed adaptations still the same Activity?
-   What proportionate safety guidance is required?
-   Is any Challenge-specific rule accidentally embedded in the
    Activity?

If these questions cannot be answered coherently, the Activity should
remain Draft rather than being forced into Challenge eligibility.

## 16. Representative Fitness Validation

Before scaling the Fitness catalogue, Tiizi should validate this
standard against real Activities from the approved working catalogue
that collectively exercise:

-   repetition-based movement;
-   timed/static movement;
-   distance/locomotion;
-   equipment use;
-   meaningful adaptation;
-   completion/session semantics if such an Activity exists in the
    approved catalogue.

The representative Activities should be selected from the approved
catalogue evidence. The standard should be amended where real product
evidence exposes a genuine gap rather than inventing fields in advance.

## 15. Loaded and Multi-Metric Fitness Activities

Loaded Fitness Activities may legitimately support Weight alongside
Repetitions, Distance or Duration.

The Activity standard must distinguish:

-   legitimate measurement capability;
-   the participant-facing meaning of reported load;
-   equipment expression;
-   downstream Challenge configuration;
-   downstream calculation/scoring.

A loaded Activity is not Challenge-ready for Weight merely because
`Weight → grams/kilograms` is technically compatible. The Tiizi Load
Reporting Convention must first establish what the participant reports
across relevant equipment patterns.

Likewise, multiple compatible Metrics do not imply a compound score.
Bench Press supporting Repetitions and Weight, or Farmer Carry
supporting Distance, Duration and Weight, does not authorize the
Activity layer to invent how those dimensions combine.

Equipment expression also does not automatically create a new canonical
identity. Barbell, dumbbell, machine, bilateral and unilateral
expressions should follow the governed canonical-versus-variant rule
unless the undertaking or measurement semantics materially differ.
