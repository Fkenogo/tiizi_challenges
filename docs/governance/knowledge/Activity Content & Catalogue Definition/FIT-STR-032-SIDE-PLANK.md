# FIT-STR-032 --- Side Plank

**Working package:** Tiizi V2 Activity Content & Catalogue Definition\
**Document type:** Representative canonical Activity exemplar ---
bilateral component pattern\
**Status:** Founder/Product working baseline\
**Activity Code:** `FIT-STR-032`\
**Domain:** Fitness\
**Category:** Strength\
**Classification:** Core / Trunk\
**Baseline-supported measurement:** Duration → seconds/minutes

## 1. Product Question

Side Plank tests a canonical Activity pattern where one
participant-facing Activity contains two required component exercises:
Left Side and Right Side.

The Founder Working Baseline already contains one canonical Activity,
`FIT-STR-032 Side Plank`, rather than separate Left and Right canonical
Activities. This exemplar recommends retaining that single identity.

## 2. Canonical Meaning

**Side Plank** is a static bodyweight support exercise performed from a
side-facing supported position. Where the governed undertaking requires
balanced bilateral performance, it is performed on both the left and
right sides.

**Left Side Plank and Right Side Plank should not ordinarily be separate
canonical Activities.** They are side-specific components of the same
canonical undertaking.

The stable identity remains:

`FIT-STR-032 — Side Plank`

This avoids duplicate catalogue records, accidental one-sided Challenge
construction, duplicated guidance, and fragmented measurement semantics.

## 3. Activity Components

Tiizi needs a governed concept of an **Activity Component**:

> A constituent part of one canonical Activity that may be separately
> performed/reported but is not automatically an independently
> selectable canonical Activity.

For Side Plank:

``` text
Side Plank
├── LEFT
└── RIGHT
```

## 4. Component Is Not Variant

A Variant is normally an alternative expression:

`Activity → Variant A OR Variant B`

A required Component is constituent:

`Activity → Component A AND Component B`

For balanced Side Plank, Left and Right are therefore **components**,
not variants. A participant does not choose Left instead of Right when
both are required.

## 5. Measurement Contract

**Metric:** Duration\
**Units:** seconds, minutes

Duration should be attributable to each required side:

``` text
Side Plank
  LEFT: 30 seconds
  RIGHT: 30 seconds
```

The component values should remain separately attributable even though
they belong to one Activity.

## 6. Do Not Silently Sum Components

If the participant reports 30 seconds Left and 30 seconds Right, Tiizi
should not automatically reinterpret this as `60 seconds Side Plank`.

For a balanced bilateral requirement, the important truth may be
`30 seconds on each required side`.

Likewise, `45 seconds Left + 20 seconds Right` must not collapse to
`65 seconds`, because doing so hides the imbalance.

Any aggregation must be explicitly defined by Challenge Definition
rather than inferred by Activity Knowledge.

## 7. Challenge Definition Boundary

Canonical Activity Knowledge owns: - Side Plank identity; - LEFT and
RIGHT component structure; - Duration compatibility; -
seconds/minutes; - reporting Duration per component.

Challenge Definition owns: - target Duration; - whether all components
are required; - any governed component relationship; -
frequency/schedule; - Challenge type; - scoring/ranking where
applicable.

For example, a Challenge may define:

> Complete 30 seconds of Side Plank on each side.

The `30 seconds` target belongs to the Challenge, not the Activity.

## 8. Component Completion

Where both sides are required:

``` text
LEFT satisfied = true
RIGHT satisfied = true
----------------------
Side Plank requirement = Done
```

If either required component is not satisfied, the Side Plank
requirement is not Done.

This composes cleanly with the settled Streak rule: a Streak day is Done
only when all configured daily requirements are Done.

## 9. Participant Experience

The participant should see one Activity:

**Side Plank**

with component inputs beneath it:

``` text
Left Side
[ 30 ] seconds

Right Side
[ 30 ] seconds
```

The participant should not have to log two unrelated catalogue
Activities.

## 10. Challenge Creation Experience

The creator selects **Side Plank** once.

The Wizard should know from canonical Knowledge that Side Plank contains
governed bilateral components. The creator should not manually add "Side
Plank Left" and "Side Plank Right" to reconstruct the intended
undertaking.

## 11. When a Component Becomes a Separate Activity

A component should not become a separate canonical Activity merely
because it can physically be performed alone.

Separate identity is justified only when Tiizi deliberately recognizes
the unilateral undertaking as independently selectable and materially
meaningful with its own governed semantics.

That decision should be explicit rather than an accidental consequence
of data modelling.

## 12. Execution

For each required side:

1.  establish the side-facing supported position;
2.  begin timing when the intentional hold begins;
3.  maintain the hold under reasonable control;
4.  stop timing when the hold ends;
5.  report Duration for that side;
6.  perform the other required side.

The canonical Activity does not prescribe target Duration.

## 13. Guidance and Safety

Use a stable surface and maintain a controlled supported position.
Transition into and out of the hold under control. Stop if the Activity
causes sharp pain or significant discomfort.

These are ordinary participation cues, not a Tiizi verification standard
or individualized medical/rehabilitation advice.

## 14. Verification Boundary

Canonical Knowledge defines the undertaking, component structure and
reporting meaning. It does not establish that Tiizi independently
verified side, Duration, technique, alignment or completion.

Verification remains separately governed.

## 15. Component Identity

Components should have stable machine-readable identifiers subordinate
to the canonical Activity, conceptually:

``` text
FIT-STR-032
  component: LEFT
  component: RIGHT
```

They do not require independent canonical Activity Codes merely to be
persisted, configured or reported.

## 16. Historical Truth

A Challenge should pin enough component structure in its Challenge
configuration/version to preserve historical interpretation.

Later changes to canonical guidance or component metadata must not
change what an already-established Challenge required.

## 17. Generalized Product Model

Side Plank establishes a necessary three-way distinction:

-   **Canonical Activity:** independently selectable undertaking.
-   **Variant:** alternative governed expression of that undertaking.
-   **Component:** constituent part that may be required to complete the
    undertaking.

The initial component relationship needed is simply **ALL_REQUIRED**.
Additional component logic should not be invented until real catalogue
cases require it.

## 18. Readiness

**Canonical identity:** Retain `FIT-STR-032 Side Plank` as one
Activity.\
**LEFT:** Component, not separate canonical Activity by default.\
**RIGHT:** Component, not separate canonical Activity by default.\
**Measurement:** Duration → seconds/minutes, attributable per
component.\
**Publication:** Publication-ready candidate.\
**Challenge eligibility:** Candidate, provided PF-03 supports governed
Activity Components and target semantics.\
**Verification:** None established.

## 19. Carry-Forward

This component model should be carried into: - Activity Content
Standard; - Measurement & Reporting Standard; - PF-02
compatibility/catalogue model; - PF-03 Challenge Definition; - V2
Challenge Wizard; - Activity submission/logging; - historical Challenge
snapshots.

The important rule is:

> **One canonical Activity may contain multiple separately reportable
> required components without those components becoming separate
> canonical Activities.**
