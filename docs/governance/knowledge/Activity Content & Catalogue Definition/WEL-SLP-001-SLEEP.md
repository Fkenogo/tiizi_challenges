# WEL-SLP-001 --- Sleep

**Working package:** Tiizi V2 Activity Content & Catalogue Definition\
**Document type:** Representative canonical Activity exemplar\
**Status:** Founder/Product working baseline --- measurement semantics
require Founder confirmation\
**Activity Code:** `WEL-SLP-001`\
**Domain:** Wellness\
**Category:** Sleep & Recovery\
**Classification:** Sleep Practice\
**Baseline-supported measurements:** Duration; Completion

## 1. Canonical Meaning

### Canonical title

**Sleep**

### Description

A wellness activity in which the participant records a completed period
of sleep using the measurement required by the applicable Challenge.

### Purpose / context

Sleep gives Tiizi a canonical way to include sleep as a reportable
wellness Activity without claiming that Tiizi clinically measures sleep
or determines sleep quality.

The Activity represents the participant's reported sleep period. It does
not prescribe how much sleep a particular person should get.

### Semantic distinction

Sleep is distinct from: - **Bedtime**, which concerns whether a
configured bedtime condition was met; - **Wake Time**, which concerns
whether a configured wake-time condition was met; - a sleep-quality
score; - a medical or physiological sleep assessment.

Those concepts should not be silently collapsed into the canonical Sleep
Activity.

## 2. Duration Measurement Contract

### Duration

**Metric:** Duration

The baseline establishes Duration as a compatible Metric for Sleep. The
exact canonical unit tuple should be reconciled against the
authoritative baseline/Knowledge record before final publication if the
source does not explicitly settle it in this exemplar package.

For participant-facing use, the value means:

> the amount of sleep the participant reports for the applicable sleep
> period.

**Participant reporting instruction:**\
\> Enter how long you slept.

### What the report does not mean

A reported Sleep Duration does not establish that Tiizi: - objectively
detected sleep onset; - objectively detected waking; - distinguished
sleep from time spent in bed; - clinically measured sleep stages; -
verified sleep quality.

Unless Tiizi later integrates separately governed evidence, the value is
the participant's report.

## 3. Duration Start and End Semantics

Sleep differs from a timed exercise such as Plank because a participant
may not know the exact moment sleep began.

Therefore canonical Tiizi content should **not create false precision**
by pretending that self-reported Sleep Duration is an objectively timed
interval.

For ordinary self-report:

-   the participant reports their reasonable estimate or known record of
    how long they slept;
-   Tiizi stores the governed reported value;
-   Tiizi does not reinterpret the value as a clinical sleep
    measurement.

If a future device or external evidence source supplies Sleep Duration,
its evidence semantics must be governed separately.

## 4. Completion --- Product Semantics Check

The working baseline also identifies Completion as compatible with
Sleep.

This requires a more careful product interpretation than Completion for
a discrete practice such as Breathing Practice.

A technically possible participant-facing meaning would be:

> Mark Done after completing the Sleep occurrence required by your
> Challenge.

However, this risks becoming too vague unless the Challenge Definition
clearly establishes what qualifies as the configured Sleep occurrence.

For that reason, this exemplar does **not** automatically declare
Completion publication-ready merely because the baseline lists it.

### Proposed disposition

-   **Duration:** suitable canonical measurement.
-   **Completion:** retain as a baseline candidate, but require
    Challenge-definition semantic validation before making
    `Sleep → Completion` generally Challenge Eligible.

This is a representative-catalogue finding rather than a reason to alter
the Activity identity.

## 5. Reporting Guidance

### Duration-based Challenge

> Enter how long you slept for the applicable sleep period.

The participant should report the value they reasonably know rather than
being encouraged to invent precision.

### Completion-based Challenge

No final participant copy should be approved until the product has
established what the configured Completion condition means for Sleep.

## 6. Practice Guidance

Sleep does not require a Tiizi step-by-step execution protocol.

The canonical Activity should not pretend that sleep itself is performed
through a prescribed sequence of instructions.

Where Tiizi later offers sleep-routine guidance, bedtime routines or
related practices, those should be represented as appropriate Knowledge
or Activities rather than being forced into the canonical definition of
Sleep.

## 7. Health-Claim Boundary

Canonical Sleep content may explain what the participant reports.

It should not: - diagnose a sleep disorder; - determine whether the
participant's sleep is medically sufficient; - prescribe an
individualized sleep duration; - claim that a particular Challenge
target is medically appropriate; - interpret a self-reported duration as
clinical evidence; - promise a medical or psychological outcome.

A Challenge creator's target is not converted into health advice merely
because it references Sleep.

## 8. Safety and Guidance Boundary

No invented universal sleep-duration threshold belongs in this canonical
Activity.

If Tiizi later provides age-specific, medical, occupational or other
health-sensitive sleep recommendations, those require an appropriate
evidence and governance basis rather than being authored ad hoc in the
Activity catalogue.

The canonical Activity can remain useful without such recommendations.

## 9. Verification Boundary

Canonical Sleep Knowledge defines: - what Sleep means as a Tiizi
reportable Activity; - what a self-reported Duration represents; - the
distinction from Bedtime, Wake Time and clinical sleep measurement.

It does not establish that Tiizi independently verified: - whether the
participant was asleep; - exact sleep onset or wake time; - reported
Duration; - sleep stages; - sleep quality; - health effect.

Any device-derived or independently verified Sleep evidence requires
separately governed evidence semantics.

## 10. Activity / Challenge Separation Check

The exemplar contains no canonical: - recommended sleep duration; -
target duration; - bedtime; - wake time; - schedule; - frequency; -
Challenge duration; - Challenge type; - streak rule; - scoring; -
ranking; - recognition; - reward.

Those remain downstream or separately governed concerns.

## 11. KCS / Content Coverage

Sleep exercises: - universal canonical meaning; - self-reported
Duration; - uncertainty/precision semantics; - Completion-semantic
review; - health-adjacent content boundaries; - distinction between
participant report and objective measurement.

It demonstrates that two Activities sharing the same Metric do not
necessarily share the same evidence semantics. Plank Duration can
conceptually be timed from an intentional start to stop; Sleep Duration
may be a participant estimate or separately sourced record.

## 12. Readiness Assessment

### Content status

**Publication-ready candidate for the core Sleep Activity and Duration
semantics**, subject to Founder approval and reconciliation with the
canonical Knowledge record.

### Challenge eligibility --- Duration

**Eligible candidate**, once the exact governed Duration unit tuple is
confirmed from the authoritative baseline/Knowledge record and normal
publication gates are satisfied.

### Challenge eligibility --- Completion

**Pending.**

Do not make `Sleep → Completion` generally Challenge Eligible until the
Challenge Definition work establishes a clear, non-circular meaning for
what a completed Sleep occurrence represents.

### Challenge-level safety dependency

As with Water Intake, unrestricted creator-defined health-adjacent
targets should be considered at the Challenge Definition/validation
layer. The canonical Activity should not invent target thresholds.

### Verification

Ordinary Sleep reporting remains self-reported unless separately
governed evidence is introduced.

## 13. Representative-Catalogue Finding

Sleep exposes two important design rules:

1.  **Measurement semantics include evidence meaning.**\
    `Duration` does not imply identical evidence quality or timing
    precision across Activities.

2.  **Baseline compatibility is subject to semantic validation.**\
    A Metric appearing in the working baseline should not be made
    Challenge Eligible if its participant-facing meaning cannot yet be
    stated clearly.

This is a useful correction to any implementation that treats
compatibility as a purely technical Activity/Metric/Unit lookup.

## 14. Example Challenge Uses --- Non-Canonical Illustration

Potential downstream uses include: - a Challenge asking participants to
report Sleep Duration for applicable periods; - a Streak Challenge
evaluating a configured Sleep requirement, provided its
target/configuration is permitted by Challenge validation.

No example here establishes a recommended amount of sleep.

The canonical Activity remains `WEL-SLP-001`; Challenge Definition
determines the undertaking.
