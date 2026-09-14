# FIT-STR-012 --- Squat

**Working package:** Tiizi V2 Activity Content & Catalogue Definition\
**Batch:** CLU-01 --- Core Launch Utility\
**Document type:** Canonical Activity exemplar\
**Status:** Founder/Product working baseline\
**Activity Code:** `FIT-STR-012`\
**Domain:** Fitness\
**Category:** Strength\
**Classification:** Squat\
**Baseline-supported measurements:** Repetitions → reps; Weight →
grams/kilograms where applicable

## 1. Canonical Meaning

### Canonical title

**Squat**

### Description

A lower-body exercise in which the participant lowers the body by
bending through the hips and knees and then returns to the starting
standing position.

The canonical Activity represents the squat movement pattern. It does
not prescribe depth, stance, load, number of repetitions, sets, pace or
training objective.

## 2. Canonical Boundary

Squat is one canonical Activity.

Common expressions such as: - bodyweight Squat; - loaded Squat; - stance
adjustments; - equipment-assisted expressions;

do not automatically create separate canonical Activities where the
essential undertaking and reporting meaning remain the same.

A materially different undertaking may retain separate identity where
already governed or later justified. The authoritative baseline already
distinguishes, for example, **Squat Hold** from Squat because its normal
measurement and undertaking are materially different.

## 3. Bilateral Movement Is Not Automatically an Activity-Component Case

Squat provides an important contrast with Side Plank.

Side Plank has separately performable and separately reportable LEFT and
RIGHT constituent requirements.

Ordinary Squat uses both sides of the body simultaneously as part of one
repetition.

Therefore Tiizi should **not** create:

``` text
Squat
├── LEFT
└── RIGHT
```

for ordinary Squat.

The participant reports one repetition count for the canonical movement.

This establishes a useful rule:

> Anatomical bilateral involvement does not itself create Activity
> Components.

Components are needed only where constituent parts of the canonical
undertaking are separately performed or separately reported and must
remain distinguishable for Activity truth.

## 4. Repetitions Measurement

**Metric:** Repetitions\
**Unit:** reps

### Reporting meaning

The participant reports the number of complete Squat repetitions
performed.

### One repetition

For ordinary self-reporting, one repetition is one lowering-and-return
cycle:

1.  begin from the applicable starting standing position;
2.  lower the body through the squat movement;
3.  return to the applicable starting position.

### Participant instruction

> Enter the number of Squat repetitions you completed.

Tiizi does not need to impose one universal competition-grade depth
standard merely to make ordinary Squat reportable.

## 5. Weight Measurement

**Metric:** Weight, where applicable\
**Units:** grams, kilograms

Weight represents external load associated with a loaded Squat
expression.

The authoritative baseline permits Weight where applicable, but
unrestricted Weight-based Challenge eligibility should remain subject to
the catalogue-wide **Load Reporting Convention**.

The Activity must not independently invent whether reported load
means: - total external load; - implement-only load; - bar plus
plates; - another equipment-specific representation.

That convention should be governed consistently across loaded
Activities.

## 6. Repetitions and Weight Remain Distinct Dimensions

Supporting Repetitions and Weight does not authorize Tiizi to infer:

`repetitions × weight = score`

or any other compound result.

An ordinary CLU-01 path can make:

`Squat → Repetitions → reps`

Challenge Eligible while Weight remains pending.

Any future Challenge using both load and repetition conditions belongs
to PF-03 Challenge Definition.

## 7. Setup

1.  Establish a stable standing position.
2.  Position the feet in a stance suitable for the chosen Squat
    expression.
3.  If external load is used, establish control of the equipment before
    beginning.
4.  Ensure the surrounding area permits the movement to be performed
    safely.

The canonical Activity does not prescribe one universal stance width or
equipment arrangement.

## 8. Execution

1.  Begin from the applicable standing position.
2.  Lower the body by bending through the hips and knees under control.
3.  Reach the intended bottom position for the performed Squat
    expression.
4.  Return under control to the starting standing position.
5.  Repeat as applicable.

The Activity does not prescribe target repetitions, load, sets, rest or
tempo.

## 9. Form Guidance

Useful ordinary cues include: - maintain control while lowering and
returning; - keep the movement stable; - use a range of motion that can
be performed under reasonable control; - keep any external load
controlled throughout the movement.

These cues explain the intended undertaking. They are not a Tiizi
judging rubric.

## 10. Common Mistakes

General execution issues may include: - losing control of the
movement; - using external load that cannot be reasonably controlled; -
allowing equipment setup to become unstable; - turning the repetition
into a materially different movement.

Tiizi does not claim to detect these issues during ordinary
self-reported participation.

## 11. Variants and Related Activities

Different stance, equipment, resistance or assistance may remain
governed variants/relationships where canonical meaning is preserved.

However, a materially different undertaking may justify independent
canonical identity.

The existing baseline already treats examples such as: - Squat Hold; -
Split Squat; - Wall Sit;

as separate canonical Activities rather than variants of ordinary Squat.

The catalogue should preserve those governed distinctions unless later
evidence justifies reconciliation.

## 12. Safety and Practical Caution

Use a stable environment and, where applicable, external load that can
be handled under reasonable control.

Stop if the Activity causes sharp pain or significant discomfort.

This is ordinary exercise guidance, not individualized training,
rehabilitation or medical advice.

## 13. Verification Boundary

Canonical Squat Knowledge defines: - the undertaking; - what a
repetition means for ordinary reporting; - legitimate Repetitions and
Weight dimensions; - ordinary execution and safety guidance.

It does not establish that Tiizi independently verified: - depth; -
stance; - repetition count; - load; - technique; - movement quality.

Any verified-performance mechanism remains separately governed.

## 14. Activity / Challenge Separation

Canonical Activity Knowledge owns: - Squat identity; - Repetitions
compatibility; - Weight compatibility where applicable; - reporting
meaning; - ordinary guidance.

Challenge Definition owns: - repetition target; - load condition; -
sets; - repetitions per set; - schedule/frequency; - Challenge
duration; - scoring/ranking; - any compound Repetitions + Weight
relationship.

The Challenge Engine derives truth only from the governed Challenge
definition and accepted Activity records.

## 15. Readiness Assessment

### Canonical identity

**Retain `FIT-STR-012 Squat`.**

### Repetitions

**Publication-ready and Challenge Eligible candidate:**

`Squat → Repetitions → reps`

### Weight

**Legitimate Activity capability, but unrestricted Challenge eligibility
pending the Load Reporting Convention.**

### Activity Components

**Not required for ordinary Squat.**

The simultaneous use of left and right sides is anatomical execution,
not separately reportable component truth.

### Verification

No Verification Authority established.

## 16. CLU-01 Finding

Squat clarifies the boundary introduced by Side Plank:

> **Not every exercise involving two sides needs Activity Components.**

Use Components when constituent parts must be separately
performed/reported and preserved to determine Activity completion or
measurement truth.

Do not use Components merely because the human body has a left and right
side.

This keeps the component model bounded and prevents Tiizi from
over-engineering ordinary exercises.
