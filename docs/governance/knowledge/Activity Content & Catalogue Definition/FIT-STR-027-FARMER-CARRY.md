# FIT-STR-027 --- Farmer Carry

**Working package:** Tiizi V2 Activity Content & Catalogue Definition\
**Document type:** Representative canonical Activity exemplar\
**Status:** Founder/Product working baseline --- multi-metric Challenge
semantics require later definition\
**Activity Code:** `FIT-STR-027`\
**Domain:** Fitness\
**Category:** Strength\
**Classification:** Carry\
**Baseline-supported measurements:** Distance → metres/kilometres;
Duration → seconds/minutes; Weight → grams/kilograms

## 1. Canonical Meaning

### Canonical title

**Farmer Carry**

### Description

A loaded carry exercise in which the participant holds external load at
the sides and walks while maintaining control of the load.

### Purpose / context

Farmer Carry gives Tiizi a canonical loaded-carry Activity that can
legitimately be described by distance travelled, time spent carrying,
and external load.

The Activity defines the undertaking and its permitted measurement
dimensions. It does not prescribe the load, distance, duration, route,
pace, number of carries or Challenge scoring.

### Semantic distinction

Farmer Carry is distinguished from the other canonical carry Activities
in the Founder Working Baseline by the load position.

The baseline separately represents: - Suitcase Carry; - Front-Rack
Carry; - Overhead Carry.

The load position materially changes those undertakings enough for
separate canonical identities in the working baseline.

## 2. Measurement Contract

Farmer Carry supports three distinct measurement dimensions:

1.  Distance
2.  Duration
3.  Weight

Their compatibility with the Activity does not mean that every Challenge
must use all three.

### 2.1 Distance → metres/kilometres

**Metric:** Distance\
**Valid Units:** metres, kilometres

**What the reported value means:**\
The distance the participant reports travelling while performing the
Farmer Carry.

**Participant reporting instruction:**\
\> Enter the distance you carried the load.

Compatible units may be normalized deterministically:

`1 kilometre = 1,000 metres`

### 2.2 Duration → seconds/minutes

**Metric:** Duration\
**Valid Units:** seconds, minutes

**What the reported value means:**\
The elapsed time the participant reports spending actively performing
the Farmer Carry.

**Participant reporting instruction:**\
\> Enter how long you carried the load.

Compatible units may be normalized deterministically:

`1 minute = 60 seconds`

### 2.3 Weight → grams/kilograms

**Metric:** Weight\
**Valid Units:** grams, kilograms

**What the reported value means --- working definition:**\
The external load associated with the reported Farmer Carry.

**Participant reporting instruction --- provisional:**\
\> Enter the load you carried.

Compatible units may be normalized deterministically:

`1 kilogram = 1,000 grams`

The exact convention for a bilateral carry---particularly whether the
participant reports combined load or another governed
representation---must be settled consistently by Tiizi before
unrestricted Weight-based Challenge creation.

## 3. Three Metrics Do Not Create a Three-Part Score

Farmer Carry is the strongest current test of the distinction between
**Activity capability** and **Challenge configuration**.

Canonical Activity Knowledge says that Distance, Duration and Weight can
all meaningfully describe Farmer Carry.

It does **not** say how they combine.

Tiizi must not silently infer formulas such as:

`distance × weight`

`duration × weight`

or

`distance × duration × weight`

Nor should the Activity decide whether heavier, farther or longer
performance ranks higher.

Those decisions belong to Challenge Definition and the applicable
Challenge Engine.

## 4. Potential Challenge Configuration Patterns

PF-03 should later determine which patterns are valid, for example:

-   Distance as the primary reported/progress Metric;
-   Duration as the primary reported/progress Metric;
-   Weight as a governed condition while Distance is measured;
-   Weight as a governed condition while Duration is measured;
-   another explicitly governed compound definition.

These are **not approvals** of those patterns. They illustrate why
Activity compatibility alone is insufficient to define a Challenge.

## 5. Setup

1.  Use external loads that can be held securely at the sides.
2.  Establish a stable standing position with clear space for the carry.
3.  Hold the loads under control before beginning to move.
4.  Confirm that the intended path or area is suitable for carrying the
    load.

The canonical Activity does not prescribe a particular equipment type.

## 6. Execution

1.  Begin with the load held at the sides under control.
2.  Walk through the intended path while maintaining control of the
    load.
3.  Continue for the chosen or Challenge-configured Distance or
    Duration.
4.  Finish by stopping and placing or returning the load under control.

The canonical Activity does not prescribe pace, load, distance or
duration.

## 7. Form Guidance

Useful general cues include: - maintain control of the load while
moving; - use a stable walking path; - avoid deliberately swinging or
throwing the load; - remain aware of the walking surface and
surroundings; - finish the carry under control.

These cues describe ordinary execution rather than a verification
rubric.

## 8. Equipment and Environment

Farmer Carry requires external load.

The load may be provided by suitable exercise equipment or another
appropriate load that can be carried securely.

Equipment type does not automatically create a new canonical Farmer
Carry Activity.

The environment should provide enough clear space for the participant to
move without unnecessary obstruction.

## 9. Weight Reporting and Bilateral Load

Farmer Carry exposes a specific issue that Bench Press did not fully
settle: a participant commonly carries load on both sides.

The canonical Activity should not leave the UI to guess whether a
reported `20 kg` means: - 20 kg total; - 20 kg in each hand; - one
selected implement's load.

This must be governed before Weight is used as a Challenge measurement
or condition.

### Working recommendation

Tiizi should establish a cross-Activity **Load Reporting Convention**
rather than solve this independently inside Farmer Carry.

That convention should define how total external load is represented
for: - bilateral loads; - unilateral loads; - barbell loads; -
dumbbells; - machines; - other relevant resistance equipment.

Until then, Weight remains a valid Activity measurement dimension but
not an unrestricted Challenge-authoring primitive.

## 10. Safety and Practical Caution

Use loads that can be held and moved under reasonable control.

Use a clear, stable route and remain aware of the walking surface and
surroundings.

Start and finish the carry with the load under control.

Stop if the Activity causes sharp pain or significant discomfort.

This is ordinary participation guidance, not individualized load
prescription, rehabilitation or medical advice.

## 11. Verification Boundary

Canonical Farmer Carry Knowledge defines: - the loaded-carry
undertaking; - valid Distance, Duration and Weight dimensions; -
participant reporting meaning; - ordinary equipment/environment
guidance.

It does not establish that Tiizi independently verified: - the load; -
distance; - duration; - path; - body position; - technique.

Any verified performance capability remains separately governed.

## 12. Activity / Challenge Separation Check

The exemplar contains no canonical: - required load; - target
distance; - target duration; - pace; - number of carries; - rest
interval; - frequency; - schedule; - Challenge duration; - scoring
formula; - ranking rule; - recognition; - reward.

Those remain downstream concerns.

## 13. KCS / Content Coverage

Farmer Carry exercises: - universal canonical meaning; - Distance; -
Duration; - Weight; - multi-Metric compatibility; - equipment
relationships; - environment; - physical safety; - separate canonical
identities based on materially different load positions.

It confirms that Activity Knowledge must describe **measurement
capability without becoming Challenge calculation logic**.

## 14. Readiness Assessment

### Content status

**Publication-ready candidate**, subject to Founder approval and
canonical Knowledge reconciliation.

### Challenge eligibility --- Distance

**Eligible candidate** for:

`Farmer Carry → Distance → metres/kilometres`

subject to normal publication/compatibility gates.

### Challenge eligibility --- Duration

**Eligible candidate** for:

`Farmer Carry → Duration → seconds/minutes`

subject to normal publication/compatibility gates.

### Challenge eligibility --- Weight

**Pending Load Reporting Convention.**

### Compound configurations

**Pending PF-03 Challenge Definition.**

Do not implement multi-Metric scoring or conditions merely because all
three Metrics are compatible with the Activity.

### Verification

No Verification Authority is established for ordinary self-reported
Farmer Carry participation.

## 15. Representative-Catalogue Findings

Farmer Carry strengthens three findings:

1.  **Metric compatibility is capability, not Challenge structure.**\
    Three valid Metrics do not imply a three-variable score.

2.  **Weight requires a catalogue-wide Load Reporting Convention.**\
    The issue is broader than Bench Press and should be solved once for
    loaded Activities.

3.  **Some Metrics can be Challenge Eligible before others.**\
    Farmer Carry can be publication-ready and usable through Distance or
    Duration while Weight remains pending.

This supports the existing distinction between Published Knowledge and
governed Challenge eligibility.

## 16. Example Challenge Uses --- Non-Canonical Illustration

Potential downstream uses include: - a Distance-based Farmer Carry
Challenge; - a Duration-based Farmer Carry Challenge; - a future
governed configuration combining a load condition with Distance or
Duration.

No example here establishes a recommended load or scoring formula.

The canonical Activity remains `FIT-STR-027`; Challenge Definition and
the engine determine the undertaking and result.
