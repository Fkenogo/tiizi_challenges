# Phase_3A_6 Canonical_Fitness_Rationalisation_Standard_v2

**Status:** Production Governance Standard

**Purpose**

This phase defines how every legacy fitness record will be transformed into the canonical Tiizi Fitness Knowledge Catalogue.

Unlike Phase 3A-3, which defined the methodology, this phase defines the actual decision framework that reviewers must apply consistently.

No engineering implementation occurs here.

---

# 1. Mission

Transform every discovered legacy fitness record into one governed canonical knowledge record—or intentionally retire or reclassify it—while preserving historical traceability.

The objective is not to minimise the number of records.

The objective is to maximise:

- clarity
- consistency
- reusability
- safety
- maintainability

---

# 2. Guiding Principles

Every rationalisation decision must satisfy these principles.

## Principle 1 — One Concept, One Canonical Record

A movement should have one authoritative knowledge record.

Example:

```
Push-up
```

Not:

```
Pushups
Push Up
Push-Up
Standard Pushup
```

These become aliases or migration mappings, not separate canonical concepts.

---

## Principle 2 — Variants Are Not Duplicates

Difficulty alone does not create a new canonical movement.

Example:

```
Push-up

↓

Knee Push-up
Incline Push-up
Decline Push-up
Diamond Push-up
```

All remain related.

---

## Principle 3 — Purpose Determines Identity

Exercises are classified by what they primarily train.

Not by:

- muscles
- equipment
- popularity
- challenge usage

Example:

Romanian Deadlift

belongs to:

```
Hinge
```

not

```
Hamstrings
```

---

## Principle 4 — History Must Never Be Lost

Every legacy record survives through one of:

- canonical identity
- alias
- variant
- migration map
- retirement record

Nothing disappears silently.

---

# 3. Rationalisation Outcomes

Every legacy record receives one primary disposition.

| Outcome | Meaning |
| --- | --- |
| Keep | Already canonical |
| Rename | Better canonical terminology |
| Merge | Same concept |
| Variant | Child of another exercise |
| Split | Legacy combined several concepts |
| Reclassify | Wrong entity type |
| Restrict | Valid but controlled |
| Defer | Valid but outside launch |
| Retire | No future catalogue role |

No record receives multiple primary outcomes.

---

# 4. Canonical Exercise Test

A record qualifies as a canonical exercise when it has:

- distinct movement intent
- unique technical execution
- stable identity
- reusable educational value
- independent search value
- unique safety guidance

If not, it should usually become a variant.

---

# 5. Variant Test

A record becomes a variant when differences are primarily:

- difficulty
- equipment
- grip
- stance
- tempo
- elevation
- assistance
- resistance
- load position

Example:

```
Bodyweight Squat

↓

Goblet Squat

↓

Front Squat
```

Each may remain canonical or variant depending on technical independence, but simple regressions (for example Chair Squat) generally become variants.

---

# 6. Reclassification Test

Many legacy records will not remain exercises.

Typical destinations include:

| Legacy Record | New Entity |
| --- | --- |
| Morning Stretch Routine | Workout |
| Walk after lunch | Prescription |
| Home Workouts | User Interest |
| HIIT Class | Workout Template |
| Yoga Session | Workout or Wellness Programme (context dependent) |

The decision depends on **entity ownership**, not current implementation.

---

# 7. Family Assignment Rules

Every retained exercise receives:

- one primary domain
- one primary family
- one sub-family
- optional secondary movement demands

Example:

```
Push-up

Domain:
Strength & Conditioning

Family:
Push

Sub-family:
Horizontal Push

Secondary:
Anti-Extension
```

---

# 8. Domain Integrity

No exercise may belong to two primary domains.

Example:

Walking

Primary Domain:

```
Cardiovascular
```

Secondary tags:

- Recovery
- Functional
- Low Impact

The primary domain remains singular.

---

# 9. Family Integrity

No exercise may belong to multiple primary families.

Example:

Bear Crawl

Primary:

```
Locomotion
```

Secondary:

- Push
- Anti-Rotation

---

# 10. Naming Rules

Canonical names should:

- use internationally understood terminology
- avoid unnecessary punctuation
- avoid marketing language
- avoid dosage
- avoid challenge wording

Correct:

```
Forearm Plank
```

Avoid:

```
30 Second Plank
```

The latter is a prescription.

---

# 11. Alias Rules

Historical names remain searchable.

Example:

Aliases:

```
Press-up
Pushups
Push Up
```

Canonical:

```
Push-up
```

Aliases never become separate knowledge records.

---

# 12. Metric Integrity

Every canonical exercise owns one approved metric contract.

Example:

Walking

Primary metrics:

- distance
- duration
- steps

Push-up

Primary metrics:

- repetitions

Forearm Plank

Primary metrics:

- hold duration

Policies decide how those metrics are used in challenges.

---

# 13. Safety Integrity

Every retained exercise must receive:

- safety tier
- contraindications
- impact level
- complexity level

Exercises without minimum safety guidance cannot enter the launch catalogue.

---

# 14. Relationship Integrity

Every canonical exercise should define relationships.

Possible relationships:

- progression
- regression
- prerequisite
- alternative
- complementary
- similar movement
- same family

Example:

Push-up

Progressions:

- Decline Push-up

Regressions:

- Wall Push-up
- Knee Push-up

---

# 15. Launch Classification

Every retained exercise receives one launch status.

| Status | Meaning |
| --- | --- |
| Launch Core | Included in Version 1 |
| Launch Extended | Included shortly after |
| Future Pack | Approved but deferred |
| Specialist | Restricted audience |
| Restricted | Controlled access |

---

# 16. Canonical Record Requirements

Every retained exercise must ultimately include:

- canonical ID
- canonical name
- aliases
- domain
- family
- sub-family
- metrics
- units
- equipment
- muscles
- movement demands
- execution
- safety
- challenge compatibility
- relationships
- governance metadata
- version metadata

---

# 17. Migration Rules

Every legacy ID must map to exactly one migration outcome.

Example:

```
legacy-pushups

↓

EX-PUSH-0001
```

If retired:

```
legacy-test-record

↓

Retired

Reason:
Test-only content
```

---

# 18. Quality Gates

Before approval, reviewers confirm:

✓ Entity ownership correct

✓ Domain correct

✓ Family correct

✓ Metrics correct

✓ Safety complete

✓ Relationships complete

✓ Launch status assigned

✓ Migration path defined

---

# 19. Rationalisation Deliverables

Phase 3A-6 produces four governance artefacts.

## A. Canonical Decision Register

One row per legacy record.

---

## B. Canonical Exercise Register

The approved Version 2 catalogue.

---

## C. Alias Register

Historical names and synonyms.

---

## D. Migration Register

Legacy IDs to canonical IDs.

---

# 20. Governance Freeze

The following are now frozen:

- Every exercise has one canonical identity.
- Every exercise belongs to one primary domain.
- Every exercise belongs to one primary family.
- Variants inherit from canonical parents.
- Aliases never become separate knowledge records.
- Workouts, prescriptions and interests are separate entities.
- Historical identities remain traceable through migration mappings.
- Canonical records own metrics, safety and relationships.
- Launch inclusion is independent of catalogue validity.

---

# Phase 3A-6 Deliverable

The Tiizi programme now has a complete governance framework for making rationalisation decisions. Combined with the earlier audit and ownership standards, reviewers can classify every legacy record consistently without relying on subjective judgement.

---
