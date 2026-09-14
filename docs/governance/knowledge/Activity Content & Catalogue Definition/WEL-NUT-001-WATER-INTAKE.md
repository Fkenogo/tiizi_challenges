# WEL-NUT-001 --- Water Intake

**Working package:** Tiizi V2 Activity Content & Catalogue Definition\
**Document type:** Representative canonical Activity exemplar\
**Status:** Founder/Product working baseline\
**Activity Code:** `WEL-NUT-001`\
**Domain:** Wellness\
**Category:** Nutrition & Hydration\
**Classification:** Hydration Practice\
**Primary measurement:** Quantity → millilitres/litres

## 1. Canonical Meaning

### Canonical title

**Water Intake**

### Description

A wellness activity in which the participant drinks water and reports
the quantity consumed.

### Purpose / context

Water Intake gives Tiizi a canonical, reportable way to represent
drinking water within a Challenge.

The Activity defines what is being reported and how the quantity is
measured. It does not prescribe how much water any particular person
should drink.

### Semantic distinction

Water Intake represents **water consumed**, not a general hydration
score, hydration status, beverage intake, or a medical assessment of
whether the participant is adequately hydrated.

Other beverages do not automatically count as Water Intake merely
because they contain water. If Tiizi later needs broader fluid-intake
semantics, that should be governed explicitly rather than silently
expanding this Activity.

## 2. Measurement Contract

### Quantity → millilitres/litres

**Metric:** Quantity\
**Valid Units:** millilitres, litres

**What the reported value means:**\
The volume of water the participant reports drinking.

**Participant reporting instruction:**\
\> Enter the amount of water you drank.

Compatible units may be normalized deterministically for Challenge
calculation:

`1 litre = 1,000 millilitres`

The Challenge retains its configured participant-facing unit.

## 3. What Counts

For this canonical Activity, the reported quantity represents plain
water consumed by the participant.

The Activity should not require Tiizi to determine the participant's
hydration status.

The following should not be silently treated as equivalent without a
later governed product rule: - juice; - soft drinks; - tea or coffee; -
sports drinks; - other beverages; - water contained within food.

This boundary keeps the Activity understandable and the Quantity
semantics stable.

## 4. Reporting Guidance

> Enter the quantity of water you drank using the unit configured by
> your Challenge.

The participant may report water in one or more accepted Activity
submissions as permitted by the Challenge and submission model.

The Challenge Engine determines how accepted quantities contribute to
Challenge progress.

Canonical Water Intake Knowledge does not itself determine: - a daily
target; - how many times water must be consumed; - when it must be
consumed; - whether a Challenge target is appropriate for a particular
participant.

## 5. Quantity Is Not a Universal Recommendation

The canonical Activity defines a measurable action:

`drink water → report volume`

It does **not** define:

`every person should drink X litres per day`

A Challenge creator may later configure a quantity target subject to the
governed Challenge Definition and any applicable product/safety
constraints.

Tiizi should not manufacture a universal medically correct intake value
as part of canonical Activity Knowledge.

## 6. Practice Guidance

Water Intake requires relatively little procedural guidance.

The participant drinks water and records the quantity consumed.

Tiizi does not need to create an artificial multi-step hydration
protocol merely to make the Activity appear more detailed.

Where the participant does not know an exact volume, the product should
not silently invent precision. Any future estimation workflow would
require a separately defined reporting rule.

## 7. Units and Conversion

The canonical compatible units are:

-   millilitres (`ml`);
-   litres (`L`).

For governed calculation:

`1 L = 1,000 ml`

Conversion is a measurement rule, not a Challenge target.

Participant-facing display should use familiar localized unit labels
while retaining stable internal unit identities.

## 8. Safety and Health-Claim Boundary

Canonical Water Intake content may describe drinking and reporting
water.

It should not: - diagnose dehydration; - claim that a reported amount
proves adequate hydration; - prescribe a universal intake for every
person; - prescribe individualized fluid intake for a medical
condition; - direct medication or clinical treatment; - claim that
completing a Water Intake Challenge prevents or treats disease.

A Challenge configuration that introduces specific intake targets
remains a downstream product concern and may require additional
constraints beyond canonical Activity content.

## 9. Verification Boundary

Canonical Water Intake Knowledge defines: - what counts as Water Intake
for this Activity; - valid Quantity units; - what the participant
reports.

It does not establish that Tiizi independently verified: - the liquid
consumed; - the exact volume; - the participant's hydration status; -
any health effect.

Ordinary participation remains governed self-report unless a separate
verification capability is later established.

## 10. Activity / Challenge Separation Check

The exemplar contains no canonical: - daily intake target; - minimum or
maximum quantity; - consumption frequency; - schedule; - Challenge
duration; - Challenge type; - streak rule; - scoring; - ranking; -
recognition; - reward; - medical hydration target.

Those remain downstream or separately governed concerns.

## 11. KCS / Content Coverage

Water Intake exercises: - universal canonical meaning; - Quantity
measurement; - exact volume units; - deterministic unit conversion; -
"what counts" semantics; - health-adjacent content boundaries; -
proportionate restraint in procedural guidance.

It demonstrates that a simple Activity can still require strong semantic
precision even when its execution instructions are minimal.

## 12. Readiness Assessment

### Content status

**Publication-ready candidate**, subject to Founder approval of this
wording and reconciliation with the canonical Knowledge record.

### Challenge eligibility

**Eligible candidate** for governed configurations using:

-   `Water Intake → Quantity → millilitres`
-   `Water Intake → Quantity → litres`

provided the Activity is Published and the normal Tiizi
publication/compatibility gates are satisfied.

### Challenge-level safety dependency

Canonical Water Intake itself does not prescribe a quantity target.

Before Tiizi permits unrestricted target configuration for
health-adjacent Quantity Activities, the Challenge Definition/validation
work should confirm whether any product-level constraints are required.
This should not be hidden inside the canonical Activity description.

This means the Activity may be publication-ready while Challenge
eligibility or target ranges remain subject to the applicable governed
Challenge rules.

### Verification

No Verification Authority is established or required for ordinary
self-reported Water Intake.

## 13. Example Challenge Uses --- Non-Canonical Illustration

The following illustrate downstream configuration only and do not
establish recommended intake amounts:

-   a Challenge with a creator-configured Water Intake quantity;
-   a Collective Challenge accumulating governed accepted Water Intake
    quantities where the product permits that configuration;
-   a Streak Challenge evaluating a configured Water Intake requirement
    per applicable day.

Whether a particular target/configuration is permitted is a Challenge
Definition question, not part of `WEL-NUT-001` canonical identity.
