# Tiizi V2 Representative Catalogue Review & Content-Model Findings

**Working package:** Tiizi V2 Activity Content & Catalogue Definition\
**Review point:** After Section 06 representative exemplar authoring\
**Status:** Founder/Product working consolidation\
**Purpose:** Consolidate findings from real Activity authoring, identify
bounded corrections to Sections 01--05, and establish the gate before
catalogue-scale authoring.

## 1. Review Scope

Section 06 deliberately stress-tested the Tiizi Activity content model
against representative Fitness and Wellness Activities rather than
proceeding directly to bulk catalogue authoring.

The reviewed set covered:

-   `FIT-STR-001` Push-Up
-   `WEL-MND-003` Breathing Practice
-   `FIT-CAR-001` Running
-   `WEL-NUT-001` Water Intake
-   `FIT-STR-031` Plank
-   `WEL-SLP-001` Sleep
-   `FIT-STR-003` Bench Press
-   `FIT-STR-027` Farmer Carry
-   `WEL-SLP-002` Bedtime
-   `WEL-SLP-003` Wake Time
-   `WEL-NUT-009` Fasting

The purpose was not to approve every Activity. The purpose was to
determine whether Sections 01--05 are strong enough to support real
catalogue production.

## 2. Overall Finding

**The content model is fundamentally sound, but the representative set
exposed several material refinements that should be incorporated before
catalogue-scale authoring.**

No wholesale redesign is required.

The strongest validated principles are:

1.  canonical Activity Knowledge defines the undertaking, legitimate
    measurement and participant reporting meaning;
2.  Challenge Definition owns targets, conditions, frequency, temporal
    rules, scoring and competition/streak structure;
3.  measurement compatibility does not itself define Challenge
    calculation;
4.  participant reporting does not imply Tiizi verification;
5.  Published and Challenge Eligible must remain separate;
6.  Challenge eligibility may be measurement/configuration-specific
    rather than a single Activity-wide boolean;
7.  health-adjacent Activities may require stronger Challenge-use
    constraints than ordinary canonical publication;
8.  candidate baseline identities may be reconsidered when they fail the
    canonical Activity test.

## 3. Finding 01 --- Weight Is a First-Class Measurement Family

### Evidence from exemplars

Bench Press and Farmer Carry require Weight as a legitimate measurement
dimension.

The source baseline already contains Weight, but Section 02 initially
omitted it.

### Decision

The governed measurement families are:

-   Completion
-   Repetitions
-   Duration
-   Distance
-   Weight
-   Quantity

Section 02 has already been corrected accordingly.

### Carry-forward

PF-02 must treat Weight as a governed Metric rather than encoding load
through Quantity or Activity-specific fields.

## 4. Finding 02 --- Tiizi Needs a Load Reporting Convention

### Evidence from exemplars

Bench Press and Farmer Carry show that `Weight → kilograms` is
technically insufficient to tell a participant what number to report.

Examples include: - bilateral dumbbells; - unilateral load; - barbell
load; - machine resistance; - two carried implements.

### Decision

Add a catalogue-wide **Load Reporting Convention** before Weight becomes
an unrestricted Challenge-authoring capability.

The convention must define the participant-facing meaning of reported
external load consistently across relevant Activities.

### Boundary

This convention must not define scoring. It defines what the Weight
value means.

### Carry-forward

Section 02 should explicitly identify load semantics as required
reporting metadata for Weight Activities. PF-02 should implement the
governed convention after Founder/Product definition.

## 5. Finding 03 --- Multi-Metric Compatibility Is Not Multi-Metric Challenge Logic

### Evidence from exemplars

Running supports Distance and Duration. Bench Press supports Repetitions
and Weight. Farmer Carry supports Distance, Duration and Weight.

### Decision

An Activity may expose several legitimate measurement dimensions without
defining: - which one is primary; - whether several are used together; -
a compound formula; - a ranking rule.

Activity Knowledge establishes capability.

Challenge Definition establishes the selected measurement configuration
and any governed relationship among dimensions.

The Challenge Engine calculates only from that definition.

### Carry-forward

PF-03 must explicitly model valid single- and, if approved,
compound-measurement Challenge definitions. No implementation should
infer formulas from compatible Metrics.

## 6. Finding 04 --- Challenge Eligibility Must Be More Precise Than Activity-Level Publication

### Evidence from exemplars

Farmer Carry can plausibly support Distance and Duration before Weight
reporting semantics are settled.

Sleep can support Duration while Completion remains semantically
unresolved.

Fasting can have a technically meaningful Duration Metric while
remaining entirely ineligible for Challenge use.

### Decision

The product model must support the concept:

> Published Activity + governed compatible measurement/configuration +
> applicable safety/product constraints = Challenge-eligible
> configuration.

A single broad `activity.challengeEligible = true` is not sufficient if
it implies that every compatible Metric and every Challenge
configuration is allowed.

### Carry-forward

Sections 01--02 should describe Challenge eligibility as
configuration-sensitive. PF-02/PF-03 should preserve that distinction in
implementation.

## 7. Finding 05 --- Duration Has Activity-Specific Evidence Semantics

### Evidence from exemplars

Plank Duration can conceptually begin when the participant establishes
the hold and end when the hold stops.

Sleep Duration may be a participant estimate or separately sourced
record; the participant may not know exact physiological sleep onset.

Breathing Practice Duration is intentional practice time.

### Decision

Metric + Unit is not the complete reporting contract.

Each compatible Activity/Metric combination must define: - what the
value represents; - how the participant should report it; - any material
precision/evidence semantics.

### Carry-forward

Section 02 should make reporting/evidence meaning mandatory for each
eligible Activity/Metric combination.

## 8. Finding 06 --- Completion Requires Explicit Activity-Level Meaning

### Evidence from exemplars

Breathing Practice Completion is understandable: the participant affirms
completion of the configured practice session.

Sleep Completion is much less clear.

Bedtime/Wake Time show that Completion can accidentally conceal a
Challenge condition.

### Decision

`Completion → completion` is not self-explanatory.

Every Completion-compatible Activity must state exactly what the
participant affirms by marking **Done**.

If that statement cannot be made without importing a target, schedule or
Challenge condition into the Activity identity, the compatibility or
Activity identity must be reconsidered.

### Carry-forward

Section 02 should add a Completion semantic test before Challenge
eligibility.

## 9. Finding 07 --- Candidate Baseline Identity Is Reviewable

### Evidence from exemplars

`Bedtime` and `Wake Time` appear to name temporal conditions more than
sufficiently defined canonical undertakings.

### Decision

The Founder Working Baseline remains the governed source candidate set,
but catalogue authoring may recommend: - retain; - rename/reframe; -
split; - merge; - move concept to Challenge Definition; - keep Draft; -
retire/reject candidate.

No baseline candidate is forced into publication merely because it has
an ID.

### Carry-forward

Section 07 must include a governed candidate-disposition workflow during
catalogue scaling.

PF-03 should evaluate timezone-aware time-of-day Challenge conditions
before Bedtime/Wake Time are reconciled.

## 10. Finding 08 --- Canonical Protocol Must Not Accidentally Become One Variant

### Evidence from exemplar

The PF-01 Breathing Practice seed used a particular inhale/hold/exhale
count.

Representative authoring showed that one fixed ratio should not silently
define every Breathing Practice.

### Decision

Canonical Activity content should define the stable undertaking.

A particular protocol belongs in: - canonical content only if it is
essential to Activity identity; - a governed variant; - a Template; -
Challenge configuration; - or a separate Activity when materially
different.

### Carry-forward

Reconcile the PF-01 Breathing Practice seeded protocol later. This is a
content correction, not an architecture reopening.

## 11. Finding 09 --- Content Depth Is Activity-Specific

### Evidence from exemplars

Push-Up and Bench Press benefit from setup, execution and technique
content.

Running requires substantially less procedural detail.

Water Intake needs strong semantic precision but almost no execution
protocol.

Sleep should not be padded with a fictitious step-by-step procedure.

### Decision

KCS content classes are modular publication requirements, not a mandate
that every Activity contain every possible field.

Content should exist because the Activity needs it.

### Carry-forward

Retain the modular content model. Do not bulk-generate filler to satisfy
a uniform template.

## 12. Finding 10 --- Health-Adjacent Activities Need Two Separate Gates

### Evidence from exemplars

Water Intake is canonically understandable without prescribing a
universal target.

Sleep is canonically understandable without prescribing universal hours.

Fasting is understandable as a candidate but has unresolved
safety/caution and Challenge-use dependencies.

### Decision

Health-adjacent content requires separate consideration of:

**Publication gate** - Is the Activity meaning and ordinary guidance
responsible and sufficiently supported?

**Challenge-use gate** - Are creator-selected targets, duration,
frequency, Streak pressure, Competitive pressure or other configuration
choices permitted?

Passing the publication gate does not automatically pass every
Challenge-use gate.

### Carry-forward

PF-03 must consider health-adjacent configuration constraints without
turning canonical Activity Knowledge into individualized medical advice.

## 13. Finding 11 --- Fasting Correctly Demonstrates a Blocked Candidate

### Decision

`WEL-NUT-009 Fasting` remains:

-   stable working candidate identity;
-   Duration technically meaningful;
-   Draft;
-   not Published;
-   not Challenge Eligible.

This is a successful outcome of the publication model, not an incomplete
catalogue record.

No coding agent should invent medical thresholds, contraindications or
fasting prescriptions to force publication.

## 14. Finding 12 --- Verification Boundary Survived Every Exemplar

Across Push-Up, Running, Water Intake, Plank, Sleep, Bench Press, Farmer
Carry and Breathing Practice, the content model can explain:

-   expected undertaking;
-   what to count/report;
-   technique/protocol where useful;
-   ordinary safety guidance;

without claiming that Tiizi independently verified correct performance.

### Decision

Retain the rule:

> Canonical Activity content defines the expected way to
> perform/practise the Activity and what the participant should
> count/report, but does not imply Tiizi independently verified correct
> performance.

ACT-03 Verification Authority remains separately governed and deferred.

## 15. Bounded Amendments Required Before Catalogue Scale

The following amendments should be made to the standards package before
bulk authoring:

### Section 01 --- Activity Content Standard

Add/strengthen: - configuration-sensitive Challenge eligibility; -
candidate baseline disposition may include reconsideration rather than
publication; - canonical protocol versus variant/Template/Challenge
protocol boundary.

### Section 02 --- Measurement & Reporting Standard

Add/strengthen: - Weight as governed family --- already corrected; -
Load Reporting Convention requirement; - mandatory Activity/Metric
reporting/evidence semantics; - Completion semantic test; - multi-Metric
capability does not imply compound calculation; - Challenge eligibility
can differ by Metric/configuration.

### Section 03 --- Fitness Activity Content Standard

Add/strengthen: - loaded-Activity reporting dependency; - multi-Metric
Fitness Activities; - equipment expression does not automatically create
separate canonical identity.

### Section 04 --- Wellness Activity Content Standard

Add/strengthen: - health-adjacent publication gate versus Challenge-use
gate; - Completion must have explicit participant affirmation meaning; -
temporal condition concepts may belong to Challenge Definition rather
than Activity identity.

### Section 05 --- Safety & Guidance Boundary

Add/strengthen: - health-adjacent Challenge configuration may require
constraints beyond canonical publication; - Streak/Competitive pressure
can be relevant to Challenge-use suitability; - safety uncertainty
should keep an Activity Draft rather than trigger invented thresholds.

These are bounded refinements, not a new governance programme.

## 16. Items to Carry Into PF-02

PF-02 Metric/Unit Compatibility and Catalogue Authoring should account
for:

1.  six governed Metrics;
2.  exact Activity/Metric/Unit tuples;
3.  per-Activity/Metric reporting meaning;
4.  Weight load-reporting convention;
5.  configuration-sensitive eligibility;
6.  historical intelligibility/versioning of compatible measurement
    meaning.

PF-02 should not invent compound Challenge scoring.

## 17. Items to Carry Into PF-03

PF-03 Challenge Definition should explicitly address:

1.  selection of one or more compatible measurement dimensions;
2.  if multi-Metric definitions are allowed, their governed
    relationship;
3.  health-adjacent target/configuration constraints;
4.  timezone-aware time-of-day conditions;
5.  Completion conditions without circular semantics;
6.  Streak/Competitive suitability where Activity characteristics create
    material risk;
7.  separation of Activity compatibility from Challenge
    scoring/calculation.

## 18. Catalogue-Scale Readiness Decision

**Disposition: READY FOR SECTION 07 AFTER BOUNDED STANDARD AMENDMENTS.**

The representative set has done enough work to validate the overall
content architecture.

Do not author the remaining 100+ candidates yet.

First: 1. incorporate the bounded amendments into Sections 01--05; 2.
preserve the exemplar findings; 3. create Section 07 --- Catalogue Scale
& Publication Plan.

Section 07 should then define how the 118-candidate baseline is triaged,
authored, reviewed and progressively published without making all 118 a
launch blocker.

## 19. No Engineering Authorization Yet

This review does not authorize: - PF-02 implementation; - PF-03
implementation; - migration deployment; - EBC-05 merge; - broad
catalogue seeding; - Fasting publication; - Bedtime/Wake Time
publication; - new verification capability.

Engineering reconciliation should occur only after the
product-definition package reaches the agreed checkpoint.
