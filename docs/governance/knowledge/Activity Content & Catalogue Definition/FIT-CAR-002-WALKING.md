# FIT-CAR-002 --- Walking

**Working package:** Tiizi V2 Activity Content & Catalogue Definition\
**Batch:** CLU-01 --- Core Launch Utility\
**Document type:** Canonical Activity exemplar\
**Status:** Founder/Product working baseline\
**Activity Code:** `FIT-CAR-002`\
**Domain:** Fitness\
**Category:** Cardio & Conditioning\
**Classification:** Locomotion\
**Baseline-supported measurements:** Quantity → steps; Distance →
metres/kilometres; Duration → seconds/minutes/hours

## 1. Canonical Meaning

### Canonical title

**Walking**

### Description

A locomotion Activity in which the participant moves from place to place
by walking.

Walking is one canonical Tiizi Activity regardless of whether a
Challenge uses it for physical activity, everyday movement, social
participation, outdoor wellbeing or another legitimate context.

Purpose does not create duplicate canonical identities.

## 2. Cross-Domain Identity

Walking remains:

`FIT-CAR-002 — Walking`

under **Fitness → Cardio & Conditioning**.

A Wellness-oriented Challenge may still select Walking without
creating: - Wellness Walking; - Mindful Walking; - Social Walking; -
Outdoor Walking;

as duplicate canonical Activities merely because the Challenge purpose
differs.

The Challenge supplies context and purpose. Canonical Knowledge supplies
the stable Activity meaning.

A genuinely different undertaking may later justify its own canonical
identity, but context alone does not.

## 3. Supported Measurement Paths

Walking deliberately exercises three governed measurement paths:

1.  **Quantity → steps**
2.  **Distance → metres/kilometres**
3.  **Duration → seconds/minutes/hours**

These are alternative legitimate ways to measure Walking.

Their coexistence does not create a compound score.

## 4. Quantity --- Steps

### Metric

Quantity

### Unit

steps

### Reporting meaning

The participant reports the number of walking steps completed for the
applicable Activity occurrence.

### Participant instruction

> Enter the number of steps you completed.

Step count may be self-reported or obtained from a separately governed
device/integration in the future. Canonical Walking Knowledge does not
claim that Tiizi independently verified the count.

A Challenge target such as 8,000 or 10,000 steps is Challenge
configuration, not canonical Activity Knowledge.

Tiizi must not embed a universal health target into Walking.

## 5. Distance

### Metric

Distance

### Units

-   metres
-   kilometres

### Reporting meaning

The participant reports the distance walked for the applicable Activity
occurrence.

### Participant instruction

> Enter the distance you walked.

`1 kilometre = 1000 metres`

The Challenge may choose the participant-facing unit and target.

Canonical Walking does not prescribe route, speed or distance.

## 6. Duration

### Metric

Duration

### Units

-   seconds
-   minutes
-   hours

### Reporting meaning

The participant reports elapsed time spent intentionally performing the
applicable Walking occurrence.

### Participant instruction

> Enter how long you walked.

The Challenge may select Duration without requiring Distance or steps.

## 7. Multi-Metric Boundary

Walking supporting Steps, Distance and Duration does **not** authorize
Tiizi to infer:

-   steps × distance;
-   distance ÷ time as a new Pace Metric;
-   speed;
-   calories;
-   activity points;
-   a combined Walking score.

If future Challenges need a relationship among several dimensions, PF-03
must define it explicitly.

For ordinary Challenge creation, one configured Activity/Metric/Unit
path can remain sufficient.

## 8. Evidence Meaning

The three measurement paths may have different evidence sources.

For example: - steps may come from participant self-report or future
device evidence; - Distance may be self-reported or future
device-derived; - Duration may be self-reported or timed.

Canonical Knowledge defines what each value means, not the authority or
verification mechanism that produced it.

That remains separately governed.

## 9. Setup and Execution

Walking requires little procedural instruction.

For an intentional Walking occurrence:

1.  begin walking in an environment suitable for the Activity;
2.  continue for the applicable Challenge occurrence;
3.  finish the walk;
4.  report the configured measurement.

Tiizi should not add unnecessary technique content merely to make the
Activity record appear detailed.

## 10. Environment and Expressions

Walking may occur: - outdoors; - indoors; - on a treadmill; - as part of
ordinary movement; - in a social or recreational context.

These expressions do not automatically create separate canonical
Activities where the undertaking and measurement meaning remain Walking.

Route, terrain, location and social context are normally
Challenge/context metadata rather than canonical identity.

## 11. Running Boundary

Walking and Running remain separate canonical Activities.

Although both are locomotion Activities and support Distance/Duration,
the participant-facing undertaking is materially different enough to
preserve separate identity.

A Challenge should not silently count Running as Walking or Walking as
Running unless a later governed Challenge rule explicitly permits
cross-Activity contribution.

## 12. Safety and Practical Guidance

Walk in an environment appropriate to the participant's circumstances
and remain aware of surroundings, traffic, terrain and other ordinary
environmental risks.

Stop if the Activity causes significant discomfort.

No universal pace, step count, distance or Duration is prescribed.

This is ordinary participation guidance, not individualized medical or
training advice.

## 13. Verification Boundary

Canonical Walking Knowledge defines: - the undertaking; - valid
measurement paths; - what steps, Distance and Duration represent; -
ordinary reporting meaning.

It does not establish that Tiizi independently verified: - step count; -
Distance; - Duration; - route; - pace; - walking technique.

ACT-03 remains separate.

## 14. Activity / Challenge Separation

Canonical Activity Knowledge owns:

``` text
Walking
Quantity → steps
Distance → metres/kilometres
Duration → seconds/minutes/hours
```

Challenge Definition owns:

``` text
selected Metric
selected Unit
target
frequency
window
Challenge purpose/context
Challenge type
scoring/ranking where applicable
```

The Challenge Engine consumes only the governed configured path and
accepted Activity records.

## 15. Readiness Assessment

### Canonical identity

**Retain `FIT-CAR-002 Walking`.**

### Quantity

**Challenge Eligible candidate:** `Walking → Quantity → steps`

### Distance

**Challenge Eligible candidate:**
`Walking → Distance → metres/kilometres`

### Duration

**Challenge Eligible candidate:**
`Walking → Duration → seconds/minutes/hours`

### Compound use

Not implied. Any multi-dimensional Walking Challenge requires PF-03
definition.

### Cross-domain use

Allowed without duplicate Activity identity.

### Verification

No Verification Authority established.

## 16. CLU-01 Finding

Walking confirms three important Tiizi rules:

1.  **One Activity can legitimately support several independent
    measurement paths.**
2.  **Challenge purpose does not duplicate canonical identity across
    domains.**
3.  **Measurement capability does not imply derived Metrics or compound
    scoring.**

Walking is therefore a strong early catalogue Activity for testing the
PF-02 compatibility model and PF-03 Challenge Definition.
