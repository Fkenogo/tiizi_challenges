# STAGE F — TIIZI V2 KNOWLEDGE CONTENT SPECIFICATION (ANNEX)

**Stage:** Stage F — Product & Technical Translation
**Document type:** Stage F annex (product contract, not a governance instrument)
**Status:** v0.1-draft — Pending Founder Review
**Date:** 2026-09-11
**Authority:** EKG-01 §§4, 12, 14, 16–17; 118-Activity Founder Working Baseline
§§4, 27–28; Metric & Unit Founder Working Baseline; T1 §F; T2 §10.
This annex does not create product authority. It records the bounded
product-content contract identified by assessment
TIIZI-V2-STAGE-F-PRODUCT-CONTENT-COMPLETENESS-001 so that the KRC
publication gate and T2 requirements have a single referenced source.
It does not authorize implementation.

## 1. Purpose

This annex answers one question:

> **What must be true of a canonical Activity's content before that
> Activity may transition to Published and become usable by Tiizi V2?**

It preserves proportionality: it does not require identical long-form
content for all Activities. Content depth follows the Activity's class.
An Activity whose undertaking is self-evident needs little; a practice
no Member can perform without instruction needs a protocol.

## 2. Content classes

Classes compose. An Activity belongs to every class whose description
fits it (e.g. Deadlift is U+Q+T+S; Breathing Practice is U+P+C;
Fasting is U+M+S; Bedtime is U+C). The applicable minimum is the union
of the class minima.

- **U — Universal.** Every canonical Activity.
- **Q — Quantitative/measured.** The Activity is used with a numeric
  metric (Repetitions, Duration, Distance, Weight, Quantity).
- **T — Technique-dependent fitness.** Correct performance depends on
  bodily technique a Member could get wrong.
- **P — Protocol/practice-based wellness.** The undertaking is a
  practice whose content is not self-evident (breathing, meditation,
  mindfulness, relaxation, journaling and equivalents).
- **C — Completion/self-attested.** Completion of a configured
  occurrence is itself the measurement (including Avoidance Practices).
- **M — Meaning-sensitive.** Consistent use depends on a governed
  semantic definition (serving interpretations, avoidance meanings,
  practice boundaries).
- **S — Safety-sensitive.** Material risk of harm from incorrect
  performance or unsafe configuration, or evidence-backed caution
  exists. Physical Activities are S by default.

These classes restate distinctions already present in EKG-01 §4
("where applicable… without ambiguity that would materially impair
truthful interpretation"), the 118-baseline §§4/27 ("proportionate
to the Activity"), and the KRC domain field split. They add no new
governance classification.

## 3. Minimum content contract

### 3.1 U — REQUIRED FOR PUBLICATION (all Activities)

- Stable language-independent canonical ID (immutable once assigned).
- Display title (localizable string, §5).
- Concise authoritative description — what this Activity is.
- Domain, primary category, valid taxonomy references.
- Compatible metrics and compatible units (non-empty).
- Measurement/reporting guidance — what the Member should report
  and in which unit. One sentence suffices where self-evident.
- Lifecycle/publication metadata (provenance, state).

### 3.2 Q — REQUIRED FOR PUBLICATION

- Unit semantics for each permitted unit: what one unit means for
  this Activity (e.g. for Walking: what counts toward steps versus
  distance). Where the unit meaning is universal and unambiguous,
  a shared governed note may be referenced instead of repeated.

### 3.3 T — REQUIRED FOR PUBLICATION

- How-to execution guidance (setup and execution).
- Key form cues and common mistakes, or a governed reference to
  shared guidance where the movement is elementary.
- Equipment/environment considerations where relevant.
- Adaptation/difficulty pointer (scaling direction, not a Challenge
  prescription).

### 3.4 P — REQUIRED FOR PUBLICATION

- Protocol steps: what a session/practice consists of, in enough
  detail that a normal Member can perform it without inventing
  the practice.
- Session framing: typical posture, setting, and duration meaning
  where relevant.

### 3.5 C — REQUIRED FOR PUBLICATION

- Completion meaning: what counts as Done for one configured
  occurrence, in the Member's own words (self-attestation language).
- For Avoidance Practices: the avoidance condition stated plainly;
  time windows and schedules remain Challenge configuration.

### 3.6 M — REQUIRED FOR PUBLICATION before publishing with the dependent semantics

- Governed semantic definition: serving interpretation for
  serving-measured intake; intended meaning for avoidance
  undertakings; practice boundary where subdivision is plausible.
- This carries forward 118-baseline §28 (Fruit/Vegetable servings,
  Avoid Added Sugar, Avoid Sugary Drinks, late-night window
  ownership) and Metric baseline serving notes. Publication using
  `servings` without a governed serving definition is prohibited.

### 3.7 S — REQUIRED FOR PUBLICATION

- Caution/safety notes where materially relevant and supported by
  evidence. Mandatory for physical Activities (KRC §2; EKG-01 §12).
- Tiizi must not invent clinical thresholds or contraindications
  merely to complete a record (EKG-01 §12). Fasting-class
  Activities require appropriate caution guidance before
  publication (118-baseline §28.6); specific protocols, durations
  and limits remain subject to evidence and configuration
  governance.

### 3.8 CONDITIONAL

- `breathing`, `formCues[]`, `commonMistakes[]`: required where
  T applies; omit where genuinely inapplicable, never pad.
- `protocolSteps[]`, `benefits[]`, `bodyResponse[]`: required
  where P applies.
- `defaultTargetValue` / `targetType` (wellness): required only
  where a sensible default exists; Challenges may always configure
  their own.
- `permittedChallengeTypes[]`, `targetRanges[]`: required only
  where Knowledge must constrain configuration (EKG-01 §12).

### 3.9 OPTIONAL / FUTURE ENRICHMENT (never a publication precondition)

Progressions/regressions libraries, media/video hooks, extended
coaching content, recommendation/AI fields, full reference-asset
depth (cf. RKA-001 §7 of this annex).

## 4. Publication-readiness gate (normative)

1. An Activity must not transition `draft → published` unless the
   union of the class minima in §3 applicable to it is satisfied.
   The gate is enforced by the KRC lifecycle rule (KRC §6.2) and
   T2 FR-V2-213.
2. Lifecycle is unchanged: `draft → published → retired`. No
   destructive deletion. No `published → draft` or
   `retired → published` reversal.
3. Progressive content completion is explicitly permitted. Nothing
   in Stage F requires all 118 Activities to become Published
   simultaneously. Each Activity publishes when its own minimum
   is met.
4. The six 118-baseline §28 dependencies gate only the Activities
   named there (and any equivalent later identified); they do not
   block publication of unrelated Activities.

## 5. Localization structure (foundation-level rule)

1. Canonical Activity identity is language-independent. The
   canonical ID is stable across languages and never localized.
2. All member-facing textual Knowledge (title, description,
   instructions, protocol steps, guidance, safety notes,
   attestation wording) must be structurally localizable:
   stored as locale-keyed content resolved against the canonical
   ID, never as separate per-language Activity identities.
3. Localization must not create separate Activity identities.
   A French-titled Push-Up is FIT-STR-001, not a new Activity
   (EKG-01 P06: context does not create identity).
4. No translation is required for publication or for Stage F
   approval. No multilingual catalogue and no translation
   workflow is mandated by this annex. (T2 FR-V2-214.)

## 6. Safety / guidance boundary (product boundary, not legal copy)

1. Tiizi Activity Knowledge may provide ordinary fitness/wellness
   execution and practice guidance proportionate to the Activity.
2. It must not present itself as medical diagnosis, treatment, or
   clinical advice.
3. It should carry Activity-specific caution/safety information
   where materially relevant and supported (§3.7).
4. It must not invent clinical contraindications (EKG-01 §12).
5. Platform-level professional-advice disclaimer copy is useful
   but is **post-Stage-F implementation/legal content**, not a
   Stage F blocker: no approved authority currently requires it
   as a structural element, and the safety-relevant behaviour
   (caution notes, no invented thresholds) is specified without it.

## 7. Worked exemplars

### 7.1 RKA-001 Push-Up (fitness technique exemplar — ACCEPTED as worked exemplar)

RKA-001 satisfies the U+Q+T+S minimum: stable identity, editorial
summary, classification, technique module (starting position,
execution, breathing, tempo, completion criteria), coaching module,
safety module, measurement module, governance/lifecycle modules.
It exceeds the minimum (scientific profile, programming, challenge
intelligence, recommendation, graph, AI modules count as §3.9
enrichment, not precedent every record must match).

Recorded as unresolved before it may be called the permanent
benchmark (per its own closing recommendation):

1. Four-perspective validation workshop not evidenced:
   Product, Exercise Science, Engineering, AI & Personalisation.
2. Non-English translation keys unapproved (Kirundi explicitly
   "to be approved through terminology governance").
3. Canonical ID form (`KA-EX-PUSH-0001`) predates the governed
   `FIT-STR-001` baseline IDs; ID mapping must be settled during
   content production, not in Stage F.

RKA-001 is therefore a valid worked exemplar of the contract,
not a completed canonical record. Its depth must not be read as
the publication minimum.

### 7.2 Wellness exemplar — ABSENT

No wellness reference asset exists on origin/main. Authoring the
first wellness exemplar (a P+C Activity such as Breathing Practice,
against §§3.4–3.5) is the first post-Stage-F content-production
task. It is not authored in this task: the contract above is
sufficient to prove the requirement without pre-empting governed
content production.

## 8. Charter selectable articles — disposition: capability now, catalogue later

T1 §D.3 and T2 FR-V2-010 (SHOULD) require only the *capability*:
prefilled selectable provisions plus Steward-authored custom text,
subordinate to Platform Policy. With zero prefilled articles the
product still functions — a Steward completes the Charter with
purpose, norms, permissions (required Charter contents, T1 §D.3)
via custom text. No standard provision set is therefore required
for the product to work as defined. The article catalogue is
**launch-content work** for governed administration, not a Stage F
document gap. No Charter article is authored in this task.

## 9. Status and next use

This annex is a Stage F draft pending Founder Review. It is the
referenced source for KRC §6.2 (publication gate) and T2
FR-V2-213/FR-V2-214. Content production against this contract is
post-Stage-F governed administration (T2 FR-V2-042), gated
per-Activity by lifecycle state. No implementation is authorized
by this annex.
