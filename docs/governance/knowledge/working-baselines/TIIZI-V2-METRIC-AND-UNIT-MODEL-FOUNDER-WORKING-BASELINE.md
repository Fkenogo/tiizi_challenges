# Tiizi V2 Metric & Unit Model --- Founder Working Baseline

**Programme:** Tiizi V2\
**Stage:** EK --- Knowledge Governance\
**Document Type:** Founder Working Baseline\
**Status:** Founder Working Baseline --- Substantively Settled for
Canonical Activity Development\
**Date:** 2026-09-02\
**Relationship to EKG-01:** Stage EK working baseline under EKG-01 ---
Tiizi Knowledge Governance Standard & Knowledge Asset Model\
**Authority Note:** This working baseline records Founder direction for
Metric and Unit semantics. It is not a separate constitutional
instrument and does not authorize implementation.

------------------------------------------------------------------------

## 1. Purpose

This working baseline defines the initial Tiizi V2 Metric and Unit model
to be used in developing and reconciling the canonical Activity
Knowledge baseline.

It resolves the substantive working direction for **EK-FQ-04 --- Metric
types** and **EK-FQ-05 --- Unit relationships**.

The model was developed from first principles and stress-tested against
representative Fitness and Wellness Activities, including dynamic
strength, isometric strength, weighted strength, running, walking,
cardio and conditioning, sleep, scheduled completion, meditation, water
intake, vegetable intake, fasting, reading and social wellbeing.

Legacy V1/V2-draft measurement concepts remain evidence only unless
explicitly carried into this baseline.

------------------------------------------------------------------------

## 2. Governing Measurement Model

``` text
Activity
    ↓
Permitted Metric
    ↓
Permitted Unit
    ↓
Challenge-selected Target
```

A canonical Activity may permit one or more **Primary Metrics** and zero
or more **Secondary Metrics**.

The Knowledge Base determines which Metrics and Units are semantically
compatible with the Activity. A Challenge selects from those permitted
relationships for a particular undertaking.

Activity identity remains independent of Metric selection, Unit
selection, Target, schedule, frequency, execution structure, Challenge
type and product interpretation.

------------------------------------------------------------------------

## 3. Core Metric Vocabulary

### MET-01 --- Completion

Whether the defined Activity occurrence was completed.

Completion does not by itself establish satisfaction of an attached
schedule, time window or other Challenge condition.

### MET-02 --- Repetitions

Number of repeated executions of an Activity movement or action.

Repetitions remain distinct from generic Quantity because they carry
exercise-specific execution and measurement meaning.

### MET-03 --- Duration

Amount of time for which an Activity is performed or maintained.

Initial compatible Units: seconds, minutes, hours.

`Hold Duration` and `Active Duration` are not separate core Metrics.
Where required, they are specializations or contextual interpretations
of Duration.

### MET-04 --- Distance

Physical distance covered through an Activity.

Initial compatible Units: metres, kilometres.

An Activity may permit both Distance and Duration as Primary Metrics
without creating separate canonical Activity identities.

### MET-05 --- Weight

External mass or resistance associated with performance of an Activity.

Initial compatible Units: grams, kilograms.

Weight will commonly operate as a **Secondary Metric** for strength
Activities.

Example:

``` text
Activity: Deadlift
Primary Metric: Repetitions → 10 reps
Secondary Metric: Weight → 80 kg
Execution: Sets → 2
```

Training load or training volume calculations are not part of the
canonical Weight Metric.

### MET-06 --- Quantity

Amount of an explicitly identified Activity-specific thing, item or
substance expressed through an explicit compatible Unit.

Quantity replaces the ambiguous generic `Count` concept. A Quantity
Target is invalid without an explicit semantic Unit.

Examples:

``` text
Walking → Quantity → steps → 10,000
Water Intake → Quantity → litres → 2
Vegetable Intake → Quantity → servings → 3
Reading → Quantity → pages → 20
Acts of Kindness → Quantity → acts → 3
```

Each canonical Activity must declare its compatible Quantity Unit or
Units.

------------------------------------------------------------------------

## 4. Initial Unit Vocabulary

  -----------------------------------------------------------------------
  Metric                              Initial compatible Units
  ----------------------------------- -----------------------------------
  Completion                          completion

  Repetitions                         repetitions / reps

  Duration                            seconds, minutes, hours

  Distance                            metres, kilometres

  Weight                              grams, kilograms

  Quantity                            steps, millilitres, litres,
                                      servings, pages, acts, flights
  -----------------------------------------------------------------------

Additional Units may be introduced later through governed Knowledge
administration when a legitimate canonical Activity requires them.

Units such as `books`, `pieces` and other conceivable Quantity Units are
not included merely because they may be useful in the future.

------------------------------------------------------------------------

## 5. Unit Equivalence and Normalization

Compatible Units representing the same measurement dimension may be
converted without changing canonical Activity identity, Metric identity
or semantic Target.

``` text
1.2 kg = 1,200 g
5 km = 5,000 m
30 min = 1,800 sec
2 L = 2,000 ml
```

For semantic governance, Tiizi may identify a normalization Unit and
permit alternative user-facing input/display Units.

  Measurement       Normalization basis   Permitted representation
  ----------------- --------------------- --------------------------
  Duration          seconds               seconds, minutes, hours
  Distance          metres                metres, kilometres
  Weight            grams                 grams, kilograms
  Liquid Quantity   millilitres           millilitres, litres

This governs semantic equivalence only. Exact database storage,
precision, conversion implementation and UI display remain downstream
decisions.

Non-convertible Quantity Units must not be artificially converted.

------------------------------------------------------------------------

## 6. Primary and Secondary Metric Roles

**Primary Metric:** A permitted measurement through which required
performance or completion of a particular Challenge undertaking may
principally be expressed.

A canonical Activity may permit more than one Primary Metric.

``` text
Running
Permitted Primary Metrics:
- Distance
- Duration
```

**Secondary Metric:** An additional compatible measurement that may
qualify, contextualize or compare Activity performance without
necessarily defining completion.

``` text
Deadlift
Permitted Primary:
- Repetitions
Permitted Secondary:
- Weight
```

The Knowledge Base governs compatibility. The Challenge determines which
permitted Metric roles apply to a particular undertaking.

Detailed roles such as Target Metric, Constraint Metric, Comparison
Metric, ranking Metric or scoring Metric remain downstream.

------------------------------------------------------------------------

## 7. Scheduled Completion Rule

A schedule, time, frequency or time window may qualify the conditions of
a Completion undertaking without becoming an Activity Metric, Activity
Unit or part of canonical Activity identity.

``` text
Activity: Bedtime
Metric: Completion
Schedule condition: by 10:30 PM
```

Whether a completion satisfied the configured schedule is a separate
Challenge determination based on applicable evidence and Challenge
rules.

------------------------------------------------------------------------

## 8. Execution Structure Is Not an Activity Metric

### Sets

`Sets` is execution structure, not a canonical Activity Metric.

For a 100 Push-Up Challenge, Repetitions is the Metric and 100
repetitions is the Target. One participant may use five sets and another
ten; Sets describe how the work was executed.

### Sessions and Occurrences

`Sessions` and Activity occurrences are not canonical Activity Metrics.

For `Run 20 km this week`, Distance is the Activity Metric; completing
it in two or four sessions describes execution.

For `Meditate three times this week`, Completion or Duration may be the
Activity Metric while three times per week is Challenge frequency.

------------------------------------------------------------------------

## 9. Isometric Activity Treatment

Isometric performance is governed through **Execution Mode**, not
through a separate `Hold Duration` Metric.

Initial Execution Modes: - Dynamic - Isometric

``` text
Push-Up → Dynamic → Repetitions
Push-Up Hold → Isometric → Duration
Squat → Dynamic → Repetitions
Squat Hold → Isometric → Duration
Wall Sit → Isometric → Duration
Plank → Isometric → Duration
```

An isometric expression may receive its own canonical Activity identity
where it represents a recognized independently selectable undertaking
with materially different execution meaning and measurement
relationship.

Execution Mode is a Knowledge property, not a Metric.

------------------------------------------------------------------------

## 10. Measurement Instruction

A canonical Activity may require a **Measurement Instruction**: the
authoritative Activity-specific rule explaining how a Metric or Unit is
interpreted, counted or measured where reasonable ambiguity would
otherwise exist.

Examples include: - how Walking Lunge repetitions are counted; - how
Mountain Climber repetitions are counted; - when Plank Duration begins
and ends; - how Farmer Carry Distance is determined; and - what
constitutes a qualifying serving for Vegetable Intake.

Individual Challenges should not invent conflicting measurement
conventions for the same canonical Activity.

Where a Measurement Instruction requires external health, nutritional,
safety or scientific authority, Tiizi must not invent the definition
merely to complete the catalogue.

------------------------------------------------------------------------

## 11. Metric and Unit Compatibility

A Metric or Unit appearing in the Tiizi controlled vocabulary is not
automatically valid for every Activity.

Each canonical Activity Knowledge Asset must declare: - permitted
Primary Metric(s); - permitted Secondary Metric(s), where applicable; -
compatible Units; - relevant Measurement Instructions; and - applicable
safety/configuration constraints.

The Knowledge Base is the authority for Activity-to-Metric and
Activity-to-Unit compatibility. Downstream mechanisms such as the
Challenge Wizard should consume those governed relationships rather than
independently inventing them.

------------------------------------------------------------------------

## 12. Metric Selection Does Not Create Activity Identity

Different permitted measurement modes do not by themselves create
different canonical Activities.

``` text
Walking
Permitted Primary:
- Quantity → steps
- Distance → metres/kilometres
- Duration → seconds/minutes/hours
```

`Walk 10,000 steps`, `Walk 5 km` and `Walk for 45 minutes` may therefore
use one canonical Walking Activity.

Likewise, Meditation may permit Duration or Completion without creating
separate canonical identities.

------------------------------------------------------------------------

## 13. Context Does Not Create Activity Identity

Purpose, discovery placement, recommendation context, Challenge theme or
secondary wellbeing relationship does not create a duplicate canonical
Activity where the underlying undertaking remains the same.

Walking may have a primary Fitness classification while also being
relevant to general wellness, daily movement, outdoor wellbeing, social
activity or stress reduction without creating competing canonical
Walking identities.

------------------------------------------------------------------------

## 14. Device-Generated Measurements

A measurement produced by equipment, wearables or other devices does not
automatically become authoritative Tiizi Activity Knowledge.

Device-dependent values must be assessed for semantic compatibility,
comparability, provenance, reliability, interpretation and truthful use.

This applies particularly to calories, machine-generated distance,
heart-rate measurements, physiological estimates and proprietary
equipment scores.

Such measurements are not included in the initial core Metric vocabulary
merely because a device can produce them.

------------------------------------------------------------------------

## 15. Concepts Explicitly Outside the Core Metric Vocabulary

  -----------------------------------------------------------------------
  Concept                             V2 classification
  ----------------------------------- -----------------------------------
  Sets                                Execution structure

  Sessions                            Occurrence/execution structure

  Occurrence frequency                Challenge configuration

  Schedule                            Challenge configuration

  Time window                         Challenge configuration

  Count                               Abstract primitive; not exposed
                                      Activity Metric

  Steps                               Quantity Unit

  Servings                            Quantity Unit

  Pages                               Quantity Unit

  Acts                                Quantity Unit

  Flights                             Quantity Unit

  Hold Duration                       Duration specialization / isometric
                                      context

  Active Duration                     Duration specialization/context

  Training Volume                     Derived measurement

  Pace                                Derived measurement

  Streak Days                         Progress calculation

  Scheduled Days Completed            Progress calculation

  Progress Percentage                 Progress calculation

  Score                               Product interpretation

  Ranking                             Product interpretation

  Calories                            Deferred measurement

  Heart-rate measurement              Deferred measurement

  Qualitative Check-In                Evidence/response mechanism

  Tracked Reading                     Replaced by appropriate Activity
                                      Metric such as Duration, Quantity
                                      or Completion
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 16. Representative Validation Examples

``` text
Push-Up
Execution Mode: Dynamic
Permitted Primary: Repetitions
Unit: repetitions
```

``` text
Push-Up Hold
Execution Mode: Isometric
Permitted Primary: Duration
Units: seconds, minutes
```

``` text
Deadlift
Permitted Primary: Repetitions
Permitted Secondary: Weight
```

``` text
Running
Permitted Primary:
- Distance
- Duration
```

``` text
Walking
Permitted Primary:
- Quantity
- Distance
- Duration
Quantity Unit: steps
```

``` text
Farmer Carry
Permitted Primary:
- Distance
- Duration
Permitted Secondary:
- Weight
```

``` text
Sleep
Permitted Primary: Duration
```

``` text
Bedtime
Permitted Primary: Completion
Challenge condition: scheduled time/window
```

``` text
Meditation
Permitted Primary:
- Duration
- Completion
```

``` text
Water Intake
Permitted Primary: Quantity
Compatible Units:
- millilitres
- litres
```

``` text
Vegetable Intake
Permitted Primary: Quantity
Compatible Unit: servings
Measurement Instruction: governed definition of qualifying serving required before authoritative publication
```

``` text
Fasting
Permitted Primary: Duration
```

``` text
Reading
Permitted Primary:
- Duration
- Quantity
- Completion
Quantity Unit: pages
```

``` text
Acts of Kindness
Permitted Primary:
- Quantity
- Completion
Quantity Unit: acts
```

------------------------------------------------------------------------

## 17. Stress-Test Result

The six-Metric model has been tested against representative Activities
from Strength, isometric strength, weighted strength, Cardio &
Conditioning, locomotion, scheduled wellness, Sleep & Rest, Mind &
Emotional Wellbeing, Nutrition & Hydration, Personal Growth and Social
Wellbeing.

No additional core Metric was required.

The validation identified supporting Knowledge concepts required for
truthful Activity measurement: 1. Execution Mode; 2. Measurement
Instruction; 3. Activity-specific Metric compatibility; 4.
Activity-specific Unit compatibility; 5. Primary and Secondary Metric
roles; and 6. semantic Unit equivalence.

------------------------------------------------------------------------

## 18. EK-FQ-04 Working Resolution --- Metric Types

The initial Tiizi V2 canonical Activity Metric vocabulary consists of
six Metrics:

1.  **Completion**
2.  **Repetitions**
3.  **Duration**
4.  **Distance**
5.  **Weight**
6.  **Quantity**

The prior proposed 16-metric taxonomy remains historical design evidence
and is not promoted wholesale into V2 authority.

------------------------------------------------------------------------

## 19. EK-FQ-05 Working Resolution --- Unit Relationships

Tiizi uses governed Metric-compatible Units. Each canonical Activity
declares which Metrics and Units are semantically valid for it.
Convertible Units may be normalized without changing Activity, Metric or
Target meaning. Quantity always requires an explicit semantic Unit.

Initial relationships include:

``` text
Duration
→ seconds
→ minutes
→ hours

Distance
→ metres
→ kilometres

Weight
→ grams
→ kilograms

Quantity
→ Activity-specific governed Units
   - steps
   - millilitres
   - litres
   - servings
   - pages
   - acts
   - flights
```

Exact technical storage and conversion implementation remains
downstream.

------------------------------------------------------------------------

## 20. Boundary

This working baseline does **not**: - approve every canonical
Activity; - close Stage EK; - define final Challenge composition
behaviour; - define scoring or ranking; - define competitive Challenge
algorithms; - define evidence capture implementation; - define wearable
integration; - define database schemas or Firestore representation; -
define Challenge Wizard or Admin UI; - authorize V1 migration; -
authorize implementation; or - settle future Metrics and Units without
demonstrated need.

It provides stable measurement semantics for continued construction of
the initial V2 canonical Activity baseline.

------------------------------------------------------------------------

## 21. Next Use

Each candidate Activity should now be tested for: 1. canonical identity;
2. Domain and Category; 3. internal classification/family; 4. Execution
Mode where applicable; 5. permitted Primary Metric(s); 6. permitted
Secondary Metric(s); 7. compatible Unit(s); 8. Measurement Instruction
where needed; 9. canonical-versus-Variant treatment; 10. typed
relationships; 11. safety/configuration compatibility; and 12.
suitability for the initial V2 Activity baseline.

The Strength and Cardio & Conditioning Activities produced during stress
testing remain candidates subject to canonical-baseline reconciliation.

------------------------------------------------------------------------

## 22. Working Disposition

**Founder Working Baseline:** Accepted for continued Stage EK canonical
Activity development.

**Core Metrics:** Completion; Repetitions; Duration; Distance; Weight;
Quantity.

**EK-FQ-04:** Working substantive resolution established.\
**EK-FQ-05:** Working substantive resolution established.

Formal repository reconciliation, controlled-document integration and
any subsequent approval-state recording should occur only when the
relevant Stage EK substantive baseline has reached the point where
repository reconciliation is necessary.
