# WEL-MND-003 --- Breathing Practice

**Working package:** Tiizi V2 Activity Content & Catalogue Definition\
**Document type:** Representative canonical Activity exemplar\
**Status:** Founder/Product working baseline\
**Activity Code:** `WEL-MND-003`\
**Domain:** Wellness\
**Category:** Mind & Emotional Wellbeing\
**Classification:** Mind-Body Practice\
**Supported measurements:** Duration → seconds/minutes; Completion →
completion

## 1. Canonical Meaning

### Canonical title

**Breathing Practice**

### Description

A deliberate breathing practice in which the participant follows a
simple, controlled breathing pattern for a defined practice session.

### Purpose / context

Breathing Practice gives Tiizi a canonical way to represent an
intentional breathing session as a concrete, reportable wellness
practice.

The Activity describes the practice itself. It does not claim to
diagnose, treat or cure a medical or psychological condition.

### Semantic distinction

Breathing Practice is not simply "breathing normally" and is not a
desired state such as "feel calm." It is an intentional practice session
in which the participant deliberately follows the selected breathing
guidance.

The canonical Activity should remain broad enough to support ordinary
guided breathing practice without making one particular
inhale/hold/exhale ratio the permanent identity of every Breathing
Practice Challenge.

## 2. Measurement Contract

Breathing Practice supports two distinct governed measurement paths.

### 2.1 Duration → seconds/minutes

**Metric:** Duration\
**Valid Units:** seconds, minutes

**What the reported value means:**\
The elapsed time the participant spent intentionally carrying out the
Breathing Practice session.

**Participant reporting instruction:**\
\> Enter how long you practised.

The Challenge may select a permitted Duration unit and establish its
required duration. The canonical Activity does not prescribe a universal
session length.

### 2.2 Completion → completion

**Metric:** Completion\
**Technical Unit:** completion\
**Participant-facing action:** Done

**What completion means:**\
The participant affirms that they carried out the Breathing Practice
session required by the applicable Challenge configuration.

**Participant reporting instruction:**\
\> Mark the practice Done after completing the breathing session
required by your Challenge.

Completion is a self-reported Activity measurement. It is not the same
thing as a Challenge day being Done.

## 3. Duration and Completion Are Separate

A Challenge may configure Breathing Practice using Duration or
Completion where the canonical compatibility contract permits it.

Examples:

-   Duration configuration: report minutes practised.
-   Completion configuration: mark the configured practice Done.

Supporting both does not create invalid combinations such as
`Completion → minutes`.

The Challenge pins the applicable Activity/Metric/Unit configuration.
The participant does not choose a different measurement path while
logging.

## 4. Preparation

1.  Choose a safe position and setting in which you can breathe
    comfortably without needing to perform another demanding task at the
    same time.
2.  Sit, stand or lie in a comfortable position appropriate to the
    setting.
3.  Allow normal breathing to settle before deliberately beginning the
    practice.

No specialist equipment is required for the canonical Activity.

## 5. Core Practice

A Breathing Practice session consists of deliberately attending to and
controlling the breathing pattern for the practice period.

A simple general practice may involve:

1.  breathe in gently and comfortably;
2.  breathe out gently and comfortably;
3.  continue the deliberate breathing pattern at a comfortable pace for
    the session;
4.  finish the practice and return attention to normal breathing.

The participant should not be required by canonical Activity identity to
use a fixed breath-hold or fixed numerical breathing ratio.

Specific governed breathing protocols may later be represented through
Challenge configuration, Templates, guidance variants or separate
canonical Activities where the protocol materially defines a different
undertaking.

## 6. Why the Protocol Is Intentionally General

The PF-01 engineering exemplar used a specific inhale/hold/exhale
counting sequence.

For the product catalogue, that sequence should **not automatically
become the canonical identity of Breathing Practice**.

Doing so would make one protocol appear to define all Breathing Practice
and would blur the boundary between:

-   canonical Activity meaning;
-   a particular practice protocol;
-   a Challenge/Template configuration.

The canonical Activity therefore defines the general practice. More
specific breathing protocols require their own governed representation
if Tiizi needs to prescribe them.

## 7. Session Framing

### Session start

A session begins when the participant intentionally starts the breathing
practice rather than simply continuing ordinary automatic breathing.

### During the session

The participant deliberately follows the applicable breathing guidance
or Challenge-configured practice.

### Session end

The session ends when the participant stops the deliberate practice and
returns to ordinary breathing.

For Duration reporting, the participant reports the elapsed practice
time.

For Completion reporting, the participant marks Done after carrying out
the configured session.

## 8. Reporting Guidance

### Duration-based Challenge

> Enter the time you spent doing the breathing practice.

### Completion-based Challenge

> Mark Done after you complete the breathing practice required by the
> Challenge.

Tiizi does not require the participant to report a health outcome such
as calmness, stress reduction or mood change in order for the Activity
report to be valid.

## 9. Completion Versus Challenge Done

Breathing Practice `Completion` is an Activity-level report.

For example, in a Streak Challenge containing multiple daily
requirements, completing Breathing Practice may satisfy one requirement.
The Challenge day becomes Done only when the Challenge Engine determines
that **all** configured daily requirements are satisfied.

The Activity must not set Streak state itself.

## 10. Guidance and Health-Claim Boundary

Canonical Breathing Practice content may explain how to carry out the
practice.

It must not claim, without a separately governed and supported basis,
that completing the practice:

-   treats anxiety;
-   cures stress;
-   lowers blood pressure;
-   treats a breathing disorder;
-   produces a guaranteed psychological or medical result.

The participant may personally use breathing practice for many reasons.
Those reasons do not redefine the canonical Activity.

## 11. Safety and Practical Caution

Practise in a safe setting where deliberate attention to breathing will
not distract from an activity requiring full attention.

Keep the breathing comfortable rather than forcing unusually deep
breaths or prolonged breath-holding.

If the practice causes dizziness or significant discomfort, stop the
deliberate pattern and return to normal breathing.

This is ordinary participation guidance, not diagnosis or medical
treatment.

## 12. Avoidance Boundary

Breathing Practice should not be performed in a way that distracts the
participant from safely driving, operating equipment or another task
requiring full attention.

Canonical Tiizi content should not attempt to construct a
disease-specific contraindication list.

If Tiizi later introduces specialized breathing protocols with
materially different safety considerations, those protocols require
their own content/safety assessment.

## 13. Verification Boundary

Canonical Breathing Practice Knowledge defines:

-   what the practice means;
-   how an ordinary session is framed;
-   valid Duration and Completion reporting;
-   ordinary practical guidance.

It does not establish that Tiizi independently verified:

-   the participant's breathing pattern;
-   exact breath timing;
-   practice duration beyond the governed evidence/reporting model;
-   physiological response;
-   psychological outcome.

Any future verification capability remains separately governed.

## 14. Activity / Challenge Separation Check

The exemplar contains no canonical:

-   required practice duration;
-   required number of sessions;
-   daily frequency;
-   schedule;
-   Challenge duration;
-   Challenge type;
-   streak rule;
-   scoring;
-   ranking;
-   recognition;
-   reward;
-   required therapeutic outcome.

Those remain downstream concerns.

## 15. KCS / Content Coverage

The Breathing Practice exemplar exercises:

-   universal canonical meaning;
-   quantitative Duration measurement;
-   Completion reporting;
-   protocol/practice content;
-   completion semantics;
-   session framing;
-   proportionate Wellness safety content.

It provides: - identity and classification; - description and
purpose/context; - Duration/seconds/minutes compatibility; -
Completion/completion compatibility; - participant reporting guidance; -
preparation; - general practice protocol; - session framing; -
completion meaning; - ordinary safety/caution guidance; - health-claim
boundary.

## 16. Readiness Assessment

### Content status

**Publication-ready candidate**, subject to Founder approval of this
wording and final reconciliation with the canonical Knowledge record.

### Challenge eligibility

**Eligible candidate** for Challenges using either governed measurement
path:

-   `Breathing Practice → Duration → seconds/minutes`
-   `Breathing Practice → Completion → completion`

provided the Activity is Published and the normal Tiizi
publication/compatibility gates are satisfied.

### Material product dependency

The existing PF-01 seeded fixed inhale/hold/exhale count should be
reconciled with this broader canonical definition. It should not
silently remain authoritative canonical protocol if the Founder approves
this exemplar.

This is a content reconciliation issue, not a reason to reopen PF-01
architecture.

### Verification

No Verification Authority is established or required for ordinary
self-reported Breathing Practice participation.

## 17. Example Challenge Uses --- Non-Canonical Illustration

The following illustrate downstream configuration only and are **not
part of canonical Breathing Practice Knowledge**:

-   a Streak Challenge requiring a configured duration of Breathing
    Practice each day;
-   a Challenge requiring one configured Breathing Practice session to
    be marked Done per applicable period;
-   a Group Challenge using a specific approved breathing protocol
    supplied by a Template or Challenge configuration.

The canonical Activity remains `WEL-MND-003`. Challenge Definition
determines the specific undertaking.
