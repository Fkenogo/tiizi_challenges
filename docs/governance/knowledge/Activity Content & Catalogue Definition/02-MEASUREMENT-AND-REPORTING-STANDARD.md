# Tiizi V2 Measurement & Reporting Standard

**Working package:** Tiizi V2 Activity Content & Catalogue Definition\
**Section:** 02\
**Status:** Founder/Product working baseline\
**Purpose:** Define how canonical Activities expose valid measurements
to Challenge Definition and how participants report activity without
allowing the UI or Challenge Wizard to invent measurement semantics.

## 1. Governing Principle

The **Activity defines what can validly be measured or reported**. The
**Challenge chooses from those permitted measurements**.

A Challenge may narrow or set a target against a canonical Activity's
supported measurement, but it may not create a new Activity/Metric/Unit
combination.

Example:

`Push-Up → Repetitions → reps`

permits a Challenge such as:

`Push-Up → 50 reps per required period`

It does not permit:

`Push-Up → 5 kilometres`

unless Distance is separately governed as a valid measurement for that
canonical Activity.

## 2. Exact Compatibility

Metric and Unit compatibility is explicit.

Tiizi must model valid combinations as exact tuples, not as independent
lists whose Cartesian product is assumed valid.

Examples:

-   `Repetitions → reps`
-   `Duration → seconds`
-   `Duration → minutes`
-   `Distance → metres`
-   `Distance → kilometres`
-   `Quantity → millilitres`
-   `Completion → completion`

If an Activity supports both Duration and Completion, that does **not**
imply that `Completion → minutes` is valid.

The Challenge Creation system must only offer combinations explicitly
permitted by canonical Activity Knowledge.

## 3. Governed Measurement Families

### 3.1 Repetitions

**Meaning:** Count of discrete repetitions of an Activity.

**Canonical unit:** `reps`

**Participant reporting pattern:** Enter the number of repetitions
completed.

**Activity content must define:** What the participant should count as
one repetition, with enough clarity for self-reporting.

Technique guidance may explain expected performance, but the existence
of a reported repetition does not imply independent Tiizi verification.

**Aggregation:** Additive unless a later Challenge Definition explicitly
introduces a different governed calculation. Accepted reports of 10 reps
and 15 reps represent 25 accepted reps for an additive Challenge
calculation.

### 3.2 Duration

**Meaning:** Elapsed time spent performing or practising an Activity.

**Initial units:** `seconds`, `minutes`

**Participant reporting pattern:** Enter how long the Activity was
performed/practised.

**Activity content must define:** What period of practice the duration
refers to.

**Normalization:** Tiizi should preserve the participant-facing
configured unit while calculation may normalize compatible duration
units internally. Conversion must be deterministic: 60 seconds = 1
minute.

A Challenge chooses the permitted display/reporting unit. The
participant should not need to understand internal normalization.

### 3.3 Distance

**Meaning:** Distance travelled while performing an Activity.

**Initial units:** `metres`, `kilometres`

**Participant reporting pattern:** Enter the distance completed.

**Activity content must define:** What movement/activity the distance
represents.

**Normalization:** Deterministic conversion is permitted: 1 kilometre =
1,000 metres. The Challenge retains its configured participant-facing
unit.

Distance is only valid for Activities whose canonical measurement
contract explicitly permits it.

### 3.4 Weight

**Meaning:** External load associated with performing an Activity where
load is a legitimate governed measurement dimension.

**Initial units:** `grams`, `kilograms`

**Participant reporting pattern:** Enter the applicable load
used/performed in the Challenge-configured valid unit.

**Activity content must define:** What the reported load represents for
that Activity. Weight must only be available where the canonical
Activity explicitly permits it.

**Normalization:** Compatible Weight units may be deterministically
converted while preserving the Challenge-configured participant-facing
unit.

Weight is not a substitute for Repetitions. An Activity such as Bench
Press may legitimately support both `Repetitions → reps` and
`Weight → kilograms/grams` as distinct governed measurement dimensions.
How a particular Challenge combines or constrains multiple dimensions
belongs to Challenge Definition, not canonical Activity identity.

### 3.5 Quantity

**Meaning:** A measurable amount associated with performing a canonical
Activity where repetitions, duration and distance do not adequately
describe the report.

Quantity is a measurement family, not a universal free-form number.

Each Quantity-based Activity must explicitly govern the applicable unit
or units. A unit is not valid merely because it exists elsewhere in
Tiizi.

Examples may include volume-based wellness practices where the canonical
Activity contract expressly permits a volume unit.

**Participant reporting pattern:** Enter the amount
completed/consumed/performed in the Challenge-configured valid unit.

**Rule:** Quantity must not become an escape hatch for arbitrary custom
units. New quantity units require canonical definition and
compatibility.

### 3.6 Completion

**Meaning:** The participant reports that the defined
Activity/session/protocol has been completed.

**Participant-facing expression:** `Done` / complete.

**Canonical technical unit:** `completion` may be retained as the
governed non-numeric unit/value contract used by the engine/API. The
product UI should normally present the action as **Done**, not expose
the word `completion` as a user-entered unit.

**Participant reporting pattern:** Mark the Activity Done after
satisfying the Activity's applicable completion meaning and the
Challenge's configured requirement.

Completion is not interchangeable with Duration or another numeric
Metric.

A canonical Activity may support both: - `Duration → minutes/seconds`;
and - `Completion → completion`

The Challenge must select which measurement governs that requirement.

## 4. Measurement Versus Challenge Requirement

Canonical Activity Knowledge defines **measurement capability**.

Challenge Definition defines **required performance**.

Examples:

-   Activity: `Push-Up → Repetitions → reps`

-   Challenge: `50 reps per day`

-   Activity: `Walking → Distance → kilometres`

-   Challenge: `5 km per day`

-   Activity: `Breathing Practice → Duration → minutes`

-   Challenge: `10 minutes per day`

-   Activity: `Breathing Practice → Completion → completion`

-   Challenge: `Complete one configured practice per day`

The Activity must not carry the `50`, `5`, `10`, daily frequency,
Challenge window or Streak semantics.

## 5. Reporting Contract

Every Challenge-eligible Activity/Metric combination must make the
participant action unambiguous.

The reporting contract should answer:

1.  **What do I report?**
2.  **In what unit or action?**
3.  **What does the reported value mean?**

Examples:

**Push-Up** - Report: number completed - Metric: Repetitions - Unit:
reps - UI action: numeric entry

**Running** - Report: distance completed - Metric: Distance - Unit:
Challenge-selected permitted distance unit - UI action: numeric entry

**Breathing Practice --- Duration** - Report: practice duration -
Metric: Duration - Unit: Challenge-selected seconds/minutes - UI action:
numeric/time entry

**Breathing Practice --- Completion** - Report: completion of the
configured practice - Metric: Completion - Participant-facing action:
Done - UI action: completion control

The future V2 participant UI must derive its input behavior from this
governed contract rather than hard-coding Activity-specific logging
behavior.

## 6. Value Validity

For numeric measurements:

-   values must be finite;
-   values must be positive for an accepted contribution unless a later
    governed Activity contract explicitly requires another semantic;
-   units must be compatible with the selected Metric;
-   conversion must use governed deterministic rules;
-   the participant cannot submit a different Metric/Unit combination
    from the Challenge's pinned configuration.

The Activity contract determines semantic validity; Challenge
configuration determines the required target; the engine determines
resulting Challenge truth.

## 7. Aggregation Boundary

Measurement describes evidence. Aggregation describes Challenge
calculation.

Canonical Activity Knowledge may establish whether a Metric is
inherently numeric or completion-based and how compatible units convert.
It must not define Challenge scoring, leaderboard position, Streak state
or Challenge completion.

Therefore:

`Participant report → Accepted Activity Event → Challenge Application → Challenge Engine → Derived Truth`

remains the governing calculation path.

## 8. Completion Is Not Engine "Done"

Activity **Completion** is a reporting Metric.

Challenge-period **Done** is Derived Truth produced by the applicable
Challenge Engine.

For example, marking a Breathing Practice complete may satisfy one
configured Activity requirement. A Streak day becomes Done only when
**all** configured daily requirements for that Challenge day are
satisfied.

The UI must not collapse these two concepts.

## 9. Multiple Measurements on One Activity

An Activity may support multiple Metrics only where each represents a
legitimate way to configure and report that Activity.

Each Metric has its own exact valid units and reporting meaning.

Supporting multiple Metrics does not mean a participant chooses freely
at logging time. The Challenge configuration pins the applicable
Activity/Metric/Unit combination, and submissions follow that pinned
contract.

## 10. Units and Display

Canonical units should be stable, language-independent identifiers
internally. Participant-facing labels may be localized.

The product should display natural labels such as: - reps; - seconds; -
minutes; - metres; - kilometres; - Done.

Internal identifiers must not force technical vocabulary into the
participant experience.

## 11. Open Catalogue Validation Question

Before bulk catalogue authoring, the representative Activity set must
test whether the five initial measurement families --- Repetitions,
Duration, Distance, Weight, Quantity and Completion --- cover the
intended Tiizi launch catalogue.

If a real Activity from the approved catalogue cannot be represented
cleanly, the standard should be amended from product evidence rather
than forcing that Activity into an unsuitable measurement family.

No additional measurement family should be invented solely for schema
completeness.

## 10. Reporting and Evidence Meaning Is Part of Compatibility

An Activity/Metric/Unit tuple is not fully ready for Challenge use
merely because the Metric and Unit are technically compatible.

For every Challenge-eligible Activity/Metric combination, Tiizi must
also define:

-   what the reported value or action represents;
-   what the participant is being asked to report;
-   any material precision or evidence semantics;
-   whether the value is self-reported, estimated, device-derived, or
    otherwise governed where relevant.

For example, Plank Duration can represent an intentionally timed hold,
while Sleep Duration may represent a participant's reasonable report or
a separately governed external record. The shared Metric does not make
the evidence semantics identical.

## 11. Completion Semantic Test

Every `Completion → completion` compatibility must answer, in plain
participant terms:

> What exactly am I affirming when I mark this Activity Done?

If that answer cannot be stated without importing a Challenge target,
schedule, clock-time condition, or other downstream rule into the
Activity identity, the compatibility or Activity identity must be
reconsidered before Challenge eligibility.

Activity Completion remains distinct from Challenge-period Done.

## 12. Multi-Metric Capability Is Not Compound Calculation

An Activity may legitimately support multiple Metrics.

That means those measurement dimensions are valid ways to describe the
Activity. It does not define:

-   which Metric a Challenge must use;
-   whether several Metrics may be used together;
-   a compound formula;
-   a ranking rule;
-   a score.

Challenge Definition owns any governed relationship among multiple
Metrics. The Challenge Engine calculates only from that definition.

## 13. Load Reporting Convention

Weight-based Activities require a catalogue-wide Load Reporting
Convention before unrestricted Weight-based Challenge authoring.

The convention must define what reported external load means across
relevant equipment patterns, including where applicable:

-   bilateral loads;
-   unilateral loads;
-   barbells;
-   dumbbells;
-   machines;
-   other governed resistance equipment.

This convention defines reporting meaning, not scoring.

Until that convention is settled, an Activity may legitimately support
Weight while Weight-based Challenge eligibility remains pending.

## 14. Configuration-Sensitive Eligibility

Challenge eligibility may differ by Metric or configuration.

Examples established during representative authoring include:

-   an Activity eligible through Distance or Duration while Weight
    remains pending;
-   an Activity eligible through Duration while Completion remains
    semantically unresolved;
-   a technically meaningful Metric on an Activity that remains entirely
    Draft/not Challenge Eligible for safety reasons.

Therefore implementation must not infer unrestricted Challenge use from
a broad Activity-level eligibility flag alone.
