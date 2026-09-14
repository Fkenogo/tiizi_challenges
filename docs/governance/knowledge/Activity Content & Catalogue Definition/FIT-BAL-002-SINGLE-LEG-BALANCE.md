# FIT-BAL-002 --- Single-Leg Balance

**Working package:** Tiizi V2 Activity Content & Catalogue Definition\
**Batch:** CLU-01 --- Core Launch Utility\
**Document type:** Canonical Activity exemplar --- bilateral component
pattern\
**Status:** Founder/Product corrected working baseline\
**Activity Code:** `FIT-BAL-002`\
**Domain:** Fitness\
**Category:** Balance & Stability\
**Classification:** Static Balance\
**Baseline-supported measurement:** Duration → seconds/minutes

## 1. Canonical Meaning

### Canonical title

**Single-Leg Balance**

### Description

A static balance exercise performed on each leg, with the participant
maintaining a controlled standing balance position on one leg and then
performing the corresponding balance exercise on the other leg.

The canonical undertaking is **bilateral even though each component is
performed unilaterally**.

Performing only one side does not complete the canonical Single-Leg
Balance Activity.

## 2. Founder Product Decision

For Tiizi, `FIT-BAL-002 Single-Leg Balance` means the balanced exercise
across **both legs**.

Therefore:

``` text
Single-Leg Balance
├── LEFT LEG
└── RIGHT LEG
```

Both are required Activity Components.

This is canonical Activity truth, not an optional Challenge decision.

## 3. Why This Must Be One Activity

Some Tiizi Challenge types may permit only one Activity in the Challenge
configuration.

Requiring Challenge creators to add: - Left Single-Leg Balance; and -
Right Single-Leg Balance

as two separate Activities would incorrectly fragment one balanced
exercise and could make the intended Challenge impossible or awkward to
configure.

The correct library representation is therefore:

> **One canonical Activity with two required components.**

The Challenge creator selects **Single-Leg Balance once**.

## 4. Relationship to Side Plank

Single-Leg Balance and Side Plank now establish the same structural
pattern:

``` text
Canonical Activity
├── LEFT component
└── RIGHT component
relationship: ALL_REQUIRED
```

The physical execution differs: - Side Plank is performed on each side
of the body. - Single-Leg Balance is performed separately on each leg.

But in both cases, the balanced bilateral undertaking requires both
components.

## 5. Measurement Contract

**Metric:** Duration\
**Units:** seconds, minutes

Duration is recorded separately for each required leg.

Example:

``` text
Single-Leg Balance

LEFT LEG
30 seconds

RIGHT LEG
30 seconds
```

The values remain attributable to their components.

## 6. Do Not Sum the Legs

If the participant records:

-   Left Leg: 40 seconds
-   Right Leg: 20 seconds

Tiizi must not silently convert this into:

`60 seconds Single-Leg Balance`

where the Challenge requirement is balanced performance.

The component values must remain visible because the canonical Activity
requires both legs.

## 7. Challenge Target

Canonical Knowledge establishes: - LEFT LEG is required; - RIGHT LEG is
required; - Duration is measured per component; - both components form
the canonical Activity.

Challenge Definition establishes the target.

For example:

> Complete 30 seconds of Single-Leg Balance on each leg.

The `30 seconds` belongs to the Challenge.

The fact that **both legs are required** belongs to the Activity.

## 8. Completion Logic

Where the Challenge target is 30 seconds per leg:

``` text
LEFT LEG >= 30 seconds  → satisfied
RIGHT LEG >= 30 seconds → satisfied
-----------------------------------
Single-Leg Balance      → Done
```

If only one leg satisfies the requirement:

``` text
Single-Leg Balance → Not Done
```

This allows a one-Activity Challenge to preserve the full exercise.

## 9. Participant Experience

The participant sees one Activity:

**Single-Leg Balance**

with its required components:

``` text
Left Leg
[ 30 ] seconds

Right Leg
[ 30 ] seconds
```

The participant does not see two unrelated catalogue Activities.

## 10. Challenge Creation Experience

The Challenge creator selects:

**Single-Leg Balance**

once.

The Wizard derives the bilateral component structure from canonical
Knowledge and asks the creator for the applicable Duration target.

The creator should not have to reconstruct the exercise manually.

## 11. Attempts

Canonical Single-Leg Balance does not yet prescribe: - number of
attempts; - best-attempt selection; - whether retries are allowed; -
whether failed attempts are stored.

Those remain PF-03 Challenge Definition questions if required.

They do not change the bilateral component rule.

## 12. Setup and Execution

For each required leg:

1.  use a stable standing area;
2.  establish the single-leg support position;
3.  begin timing when the intentional balance hold begins;
4.  maintain the hold under reasonable control;
5.  stop timing when the hold ends;
6.  report the Duration;
7.  repeat the exercise on the other required leg.

The canonical Activity does not prescribe target Duration.

## 13. Guidance

Useful ordinary cues include: - maintain a controlled balance
position; - use a stable environment; - remain aware of nearby objects
or surfaces; - end the timed hold when balance is lost rather than
inventing an ungoverned pause/resume period.

These are participation cues, not a Tiizi judging standard.

## 14. Variants and Assistance

Support, eyes-closed execution, unstable surfaces, added movement or
other difficulty changes may be Variants or Challenge configuration
where later justified.

They do not alter the canonical requirement that the ordinary Single-Leg
Balance Activity is performed on both legs.

## 15. Safety and Practical Caution

Perform the Activity where an ordinary loss of balance is unlikely to
create avoidable harm. Use reasonable support where appropriate to the
chosen expression.

Stop if the Activity causes sharp pain or significant discomfort.

This is ordinary guidance, not rehabilitation, fall-risk assessment or
individualized medical advice.

## 16. Verification Boundary

Canonical Knowledge defines: - the bilateral undertaking; - LEFT LEG and
RIGHT LEG components; - Duration reporting per component; - ordinary
guidance.

It does not establish that Tiizi independently verified: - the leg
used; - Duration; - balance quality; - technique; - support use.

Verification remains separately governed.

## 17. Activity / Challenge Separation

Canonical Activity Knowledge owns:

``` text
Single-Leg Balance
Components:
  LEFT LEG
  RIGHT LEG
Relationship:
  ALL_REQUIRED
Metric:
  Duration
Units:
  seconds/minutes
```

Challenge Definition owns:

``` text
Duration target
frequency
schedule
Challenge type
attempt semantics if later supported
```

The Challenge Engine determines component satisfaction and then the
Activity requirement result.

## 18. Readiness Assessment

**Canonical identity:** Retain `FIT-BAL-002 Single-Leg Balance`.\
**LEFT LEG:** Required canonical Component.\
**RIGHT LEG:** Required canonical Component.\
**Relationship:** `ALL_REQUIRED`.\
**Measurement:** Duration → seconds/minutes, recorded per component.\
**Publication:** Publication-ready candidate.\
**Challenge eligibility:** Candidate once the component structure is
supported by PF-02/PF-03.\
**Verification:** None established.

## 19. Corrected CLU-01 Finding

Single-Leg Balance strengthens the Activity Component model rather than
creating an execution-side exception.

The governing test is not whether one side can physically be performed
in isolation.

The stronger product question is:

> **What constitutes the complete canonical exercise Tiizi intends to
> place in the Activity library?**

Where the complete exercise inherently requires balanced performance
across separately performed sides or limbs, Tiizi should model one
canonical Activity with required components.

This is especially important because a Challenge may support only one
Activity at a time.

Therefore:

> **Single-Leg Balance is one canonical Activity containing LEFT LEG and
> RIGHT LEG required components. Performing only one component does not
> complete the canonical Activity.**
