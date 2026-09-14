# Tiizi V2 Activity Content Standard

**Working package:** Tiizi V2 Activity Content & Catalogue Definition\
**Section:** 01\
**Status:** Founder/Product working baseline\
**Purpose:** Define what canonical Tiizi Activity content means before
broader catalogue authoring or PF-02 engineering.

## 1. Core Definition

A **Tiizi Activity** is a canonical fitness or wellness practice that
can be selected when creating a Challenge, clearly explains what the
participant is expected to do, and defines how valid participation in
that Activity can be measured or reported.

Canonical Activity content defines the expected way to perform or
practise an Activity and what the participant should count or report. It
does **not** imply that Tiizi has independently verified correct
performance. Where verification is required, Verification Authority
remains a separate governed capability.

## 2. Activity--Challenge Boundary

Canonical Activity Knowledge describes the Activity itself. It must not
encode the objectives of a particular Challenge.

**Activity Knowledge may define:** - canonical identity and Activity
Code; - title, domain, category and optional subcategory; - what the
Activity is; - supported Metrics; - exact valid Metric/Unit
combinations; - measurement and reporting meaning; - applicable
technique, protocol, completion and safety guidance.

**Challenge Definition owns:** - targets; - Challenge duration/window; -
scoring; - streak requirements; - ranking; - participation/configuration
rules; - recognition/reward rules.

Example:

-   Activity Knowledge:
    `Push-Up → repetitions → reps → how to perform → what to count`
-   Challenge Definition: `Push-Up → 50 reps/day → 30 days → Streak`
-   Challenge Engine:
    `accepted activity → daily requirement evaluation → streak/result`

Challenge-specific target, scoring, streak, ranking, duration,
participation or recognition data must not be stored as part of
canonical Activity meaning.

## 3. Activity Content Layers

### 3.1 Identity and Classification

Every governed V2 Activity establishes: - authoritative internal UUID; -
immutable Tiizi Activity Code; - canonical title; - Fitness or Wellness
domain; - governed category; - optional editorial subcategory.

Display names and classification are not identity. Renaming, translation
or later reclassification must not change the Activity's identity.

### 3.2 Meaning

Content must explain what the participant is actually doing and
distinguish the Activity from similar Activities. Applicable content
includes: - description; - purpose/context; - semantic definition where
needed.

### 3.3 Measurement and Reporting

An Activity defines what Tiizi may validly ask a participant to
report: - supported Metrics; - exact valid Metric/Unit combinations; -
measurement meaning; - reporting instructions; - completion meaning
where applicable.

The Activity defines the permitted measurement space. A Challenge
selects a permitted measurement configuration from that space.

### 3.4 Practice Guidance

Guidance is modular and Activity-appropriate.

Fitness technique-bearing Activities may use: - setup; - execution; -
form guidance; - common mistakes; - equipment; - environment; -
adaptations; - safety guidance.

Wellness protocol-bearing Activities may use: - purpose; -
preparation; - protocol; - session framing; - completion meaning; -
reporting; - cautions/safety guidance.

Fields exist because the Activity needs them, not merely because a
schema contains them. Content must not be invented to fill irrelevant
fields.

### 3.5 Safety and Boundaries

Tiizi may provide proportionate practical safety guidance. Canonical
Activity content must not silently become diagnosis, treatment,
rehabilitation prescription or unsupported clinical/health claims.

## 4. Instruction, Reporting, Acceptance and Verification

These concepts remain distinct:

1.  **Instruction** --- explains how the Activity should be performed or
    practised.
2.  **Reporting** --- explains what the participant should count, enter
    or mark.
3.  **Acceptance** --- the governed system decision that an eligible
    submission becomes an Accepted Activity Event for the applicable
    Challenge.
4.  **Verification** --- any separate authority that independently
    verifies performance or evidence.

Activity Knowledge may define instruction and reporting semantics. It
does not itself establish Verification Authority.

## 5. Modular Content and KCS

Tiizi must not force all Activities into one oversized content template.

Applicable content modules are determined by the nature of the Activity
and the governed Knowledge Content Standard (KCS) publication
classes/minima. Fitness and Wellness Activities may therefore require
different content modules while sharing the same universal identity,
meaning, measurement, lifecycle and localization foundations.

## 6. Lifecycle and Challenge Eligibility

Canonical Activity lifecycle remains:

`Draft → Published → Retired`

**Published** means Tiizi considers the canonical Activity content
suitable for Runtime Catalogue use.

Publication and Challenge eligibility remain separate:

`Challenge Eligible = Published + publication-ready + valid governed Activity/Metric/Unit configuration for Challenge use`

### 6.1 Configuration-Sensitive Challenge Eligibility

Challenge eligibility is not necessarily one Activity-wide yes/no state.

A Published Activity may be eligible through one governed
Activity/Metric/Unit configuration while another compatible measurement
or Challenge configuration remains pending or prohibited.

The stronger working rule is:

`Challenge-eligible configuration = Published Activity + valid governed Activity/Metric/Unit + explicit reporting meaning + applicable product/safety constraints satisfied`

This distinction is especially important for multi-Metric and
health-adjacent Activities.

### 6.2 Working-Baseline Candidate Disposition

Presence in the Founder Working Baseline does not compel publication.

Catalogue authoring may recommend that a candidate be: - retained as
written; - renamed or reframed; - split or merged; - kept Draft; - moved
partly or wholly into Challenge Definition; - retired/rejected as a
canonical Activity candidate.

The canonical Activity test is whether the concept represents a
concrete, independently understandable undertaking rather than merely a
target, schedule, condition or desired outcome.

### 6.3 Canonical Protocol Boundary

A particular protocol belongs in canonical Activity content only when it
is essential to the stable identity of the Activity.

Where a protocol is one selectable way of performing a broader Activity,
it should instead be governed as an Activity variant, Template,
Challenge configuration, or separate canonical Activity where the
undertaking materially differs.

A Published Activity may therefore remain visible in canonical Knowledge
while not yet being eligible for new Challenge establishment.

## 7. Localization

Canonical Activity identity is language-independent.

Localizable content may include titles, descriptions, instructions,
reporting guidance, cautions and other participant-facing text.
Translation or editing of participant-facing text must not create a new
Activity identity.

Historical Challenge intelligibility must preserve the Activity/version
information required to understand the configuration that was valid when
the Challenge was established.

## 8. Product Rule

The canonical catalogue must answer, for each Activity:

> What is this Activity, how should it be practised, and what may Tiizi
> validly ask a participant to report?

It must not answer:

> What target should this particular Challenge impose, how should the
> Challenge score it, or what recognition should result?

Those belong to later Challenge configuration, engine and recognition
authorities.
