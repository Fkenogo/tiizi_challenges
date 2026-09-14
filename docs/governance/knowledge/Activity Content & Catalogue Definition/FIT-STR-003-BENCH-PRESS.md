# FIT-STR-003 --- Bench Press

**Working package:** Tiizi V2 Activity Content & Catalogue Definition\
**Document type:** Representative canonical Activity exemplar\
**Status:** Founder/Product working baseline --- multi-metric Challenge
semantics require later definition\
**Activity Code:** `FIT-STR-003`\
**Domain:** Fitness\
**Category:** Strength\
**Classification:** Push\
**Baseline-supported measurements:** Repetitions → reps; Weight →
grams/kilograms

## 1. Canonical Meaning

### Canonical title

**Bench Press**

### Description

A resistance-based pushing exercise performed from a supported lying
position by lowering a load toward the chest area and pressing it away
from the body.

### Purpose / context

Bench Press gives Tiizi a canonical Activity for the bench-supported
horizontal press.

The Activity defines the exercise and the measurement dimensions that
can legitimately describe its performance. It does not define a workout
prescription, training load, set structure or competition score.

### Semantic distinction

Bench Press is distinct from Push-Up because the undertaking uses
external resistance from a bench-supported lying position.

Barbell, dumbbell and machine expressions do not automatically require
separate canonical Activities merely because the equipment differs.
Their eventual representation should follow the governed
variant/equipment relationship unless a materially different undertaking
justifies independent identity.

## 2. Measurement Contract

The Founder Working Baseline permits two measurement dimensions for
Bench Press:

1.  Repetitions
2.  Weight

These dimensions are individually meaningful, but their coexistence
exposes an important Challenge Definition question addressed below.

### 2.1 Repetitions → reps

**Metric:** Repetitions\
**Unit:** reps

**What the reported value means:**\
The number of Bench Press repetitions the participant reports completing
under the applicable Challenge configuration.

**Participant reporting instruction:**\
\> Enter the number of Bench Press repetitions you completed.

A repetition is one controlled lowering-and-press cycle returning the
load to the applicable starting position.

### 2.2 Weight → grams/kilograms

**Metric:** Weight\
**Valid Units:** grams, kilograms

**What the reported value means:**\
The external load associated with the Bench Press performance being
reported.

**Participant reporting instruction:**\
\> Enter the load you used for the Bench Press.

Compatible units may be normalized deterministically:

`1 kilogram = 1,000 grams`

The Challenge retains its configured participant-facing unit.

## 3. Repetitions and Weight Must Not Become an Accidental Score

The canonical Activity may support both Repetitions and Weight without
defining how those values combine.

Tiizi must not silently infer formulas such as:

`repetitions × weight = score`

or:

`heavier load always ranks above more repetitions`

Those are Challenge/engine decisions, not Activity Knowledge.

Likewise, the Activity does not establish whether a particular
Challenge: - measures only repetitions; - measures only load; - requires
a configured load while counting repetitions; - requires a configured
repetition condition while reporting load; - uses both dimensions in a
governed compound definition.

PF-03 Challenge Definition must establish the valid configuration
patterns before compound Bench Press Challenges are generally exposed.

## 4. Weight Reporting Requires Load Semantics

Before final engineering reconciliation, Tiizi should define precisely
what `Weight` means for loaded Activities.

For Bench Press, the intended working meaning is:

> the total external resistance/load used for the reported Bench Press
> performance.

However, equipment can make this less trivial than it appears. Barbell,
dumbbell and machine expressions may present load differently.

Therefore the canonical Activity should not invent equipment-specific
arithmetic in this exemplar.

The eventual Weight reporting standard should establish a consistent
participant-facing convention for loaded Activities.

## 5. Setup

1.  Use stable equipment appropriate for the Bench Press expression.
2.  Establish a supported lying position on the bench.
3.  Position the hands or handles securely for the selected equipment.
4.  Ensure the load and surrounding equipment are controlled before
    beginning the movement.

Exact grip width and equipment-specific setup do not need to become
universal canonical requirements.

## 6. Execution

1.  Begin with the load supported in the applicable starting position.
2.  Lower the load toward the chest area under control.
3.  Press the load away from the body to return to the starting
    position.
4.  Repeat the lowering-and-press cycle as required by the participant's
    activity or Challenge.

The canonical Activity does not prescribe sets, repetitions, load or
rest periods.

## 7. Form Guidance

Useful general cues include: - keep the body supported on the bench; -
maintain control of the load; - lower and press without deliberately
dropping or bouncing the load; - use a stable hand or handle position
appropriate to the equipment.

These cues communicate the intended exercise. They are not a Tiizi
judging standard.

## 8. Common Mistakes

General execution issues include: - using a load that cannot be
controlled through the intended movement; - dropping or bouncing the
load rather than controlling it; - beginning a repetition without stable
control of the equipment; - allowing equipment setup to become unstable.

Tiizi does not claim to detect these issues during ordinary
self-reported participation.

## 9. Equipment and Variants

Bench Press is equipment-dependent.

Potential equipment expressions include: - barbell; - dumbbells; -
suitable resistance machines.

These should initially be treated as governed equipment/variant
relationships rather than automatically creating separate canonical
Activity identities.

If a future expression materially changes Activity meaning, measurement
semantics or participant undertaking, it can be assessed for separate
canonical status.

## 10. Safety and Practical Caution

Use stable equipment and a load that can be handled under reasonable
control.

Ensure the exercise environment allows the load to be started, performed
and finished safely.

Where the equipment or load creates a risk of becoming trapped beneath
an uncontrolled weight, use appropriate ordinary safety support for that
setting.

Stop if the Activity causes sharp pain or significant discomfort.

This is ordinary exercise guidance, not individualized training,
rehabilitation or medical advice.

## 11. Verification Boundary

Canonical Bench Press Knowledge defines: - the exercise; - what a
repetition means for reporting; - the Weight measurement dimension; -
ordinary equipment and safety guidance.

It does not establish that Tiizi independently verified: - repetition
quality; - number of repetitions; - load; - equipment configuration; -
movement range; - exercise technique.

Any verified strength competition or evidence mechanism remains
separately governed.

## 12. Activity / Challenge Separation Check

The exemplar contains no canonical: - required load; - required
repetitions; - sets; - repetitions per set; - rest periods; - training
percentage; - one-repetition maximum; - frequency; - schedule; -
Challenge duration; - scoring formula; - ranking; - recognition; -
reward.

Those remain downstream concerns.

## 13. KCS / Content Coverage

Bench Press exercises: - universal canonical meaning; - Repetitions; -
Weight; - multiple compatible Metrics; - equipment relationships; -
technique-bearing physical guidance; - physical safety; -
canonical-versus-variant boundaries.

It demonstrates that **supporting multiple Metrics is not the same as
defining a multi-Metric Challenge calculation**.

## 14. Readiness Assessment

### Content status

**Publication-ready candidate**, subject to Founder approval and
canonical Knowledge reconciliation.

### Challenge eligibility --- Repetitions

**Eligible candidate** for:

`Bench Press → Repetitions → reps`

subject to normal publication/compatibility gates.

### Challenge eligibility --- Weight

**Pending bounded reporting-semantic confirmation.**

The Activity legitimately supports Weight, but Tiizi should settle the
cross-equipment meaning of reported load before exposing unrestricted
Weight-based Challenge creation.

### Compound Repetitions + Weight configuration

**Pending PF-03 Challenge Definition.**

Do not infer or implement a compound scoring formula from the Activity's
two compatible Metrics.

### Verification

No Verification Authority is established for ordinary self-reported
Bench Press participation.

## 15. Representative-Catalogue Findings

Bench Press exposes two important requirements for later product work:

1.  **Weight needs a governed reporting convention.**\
    The Metric and units alone are insufficient when equipment can
    express external load differently.

2.  **Multi-Metric capability belongs upstream of engine scoring but
    downstream of Activity compatibility.**\
    Activity Knowledge says which dimensions are legitimate. Challenge
    Definition says which dimensions a Challenge uses together and how.
    The engine calculates only from that governed definition.

These findings should be carried into the Measurement Standard and PF-03
rather than solved by inventing Bench Press-specific scoring.

## 16. Example Challenge Uses --- Non-Canonical Illustration

Potential downstream configurations include: - a Challenge counting
accepted Bench Press repetitions; - a governed Challenge using a defined
Bench Press load condition; - a future compound configuration using both
repetitions and load if PF-03 explicitly permits and defines it.

The canonical Activity remains `FIT-STR-003`; it does not determine the
scoring model.
