# Tiizi_Knowledge_Catalogue Specification

**Status:** Platform Master Specification

**Purpose**

Define the canonical structure for every Knowledge Item published by Tiizi.

Every Exercise, Wellness Activity and Workout must conform to this specification.

This becomes the blueprint for:

- database schema
- admin CMS
- APIs
- search
- recommendations
- AI
- challenge creation
- localization
- governance

---

# PART I — Catalogue Philosophy

## One Knowledge System

Tiizi does **not** maintain:

- Exercise Catalogue
- Wellness Catalogue
- Workout Catalogue

as independent systems.

Instead it maintains one governed catalogue.

```
Knowledge Catalogue

├── Exercises

├── Wellness Activities

└── Workouts
```

Everything inherits from one model.

---

# PART II — Knowledge Record Identity

Every record has immutable identity.

## Required

Knowledge ID

```
EX-PUSH-0001
```

or

```
WL-SLEEP-0007
```

or

```
WK-FULLBODY-0012
```

The ID never changes.

Display names may change.

---

Every record also has:

- Schema Version
- Content Version
- Published Version
- Status
- Created
- Updated
- Deprecated

---

# PART III — Canonical Naming

Every item defines:

## Canonical Name

Example

```
Forearm Plank
```

---

## Short Name

```
Plank
```

---

## Alternative Names

```
Low Plank

Elbow Plank
```

---

## Search Terms

```
core

abs

isometric

hold
```

---

# PART IV — Taxonomy

Every record references controlled IDs.

No free text.

Domain

Family

Subfamily

Movement Pattern

Exercise Type

Difficulty

Safety Tier

Audience

Goal Tags

Equipment

---

# PART V — Knowledge Description

Every record answers:

What is it?

Why does it help?

Who benefits?

Who should avoid it?

How is it performed?

Common mistakes

Tips

Progressions

Regressions

Substitutions

Safety

References

---

This follows the Content Standard already approved.

---

# PART VI — Technical Classification

Every record defines

Metric Contract

```
Duration
```

---

Allowed Units

```
Seconds
```

---

Target Direction

```
Higher

Target

Completion
```

---

Tracking Methods

```
Manual

Wearable

Photo
```

---

Challenge Eligibility

References Compatibility Matrix.

---

Behaviour References

References Behaviour Framework.

---

# PART VII — Relationships

This becomes extremely important.

Every item defines relationships.

Example

```
Push-up

Parent

↓

Knee Push-up

↓

Incline Push-up

↓

Decline Push-up
```

---

Another

```
Walking

↓

Workout Component

↓

Recovery Routine

↓

Challenge Template
```

Relationships become graph data rather than duplicated records.

---

# PART VIII — Exercise-Specific Fields

Exercises additionally define

Muscles

Primary

Secondary

Movement Pattern

Plane of Motion

Equipment

Setup

Execution

Breathing

Tempo

Range of Motion

Rest Guidance

Progressions

Regressions

Substitutions

---

# PART IX — Wellness Fields

Wellness defines

Habit Type

Frequency

Timing

Behaviour Category

Clinical Sensitivity

Privacy

Restrictions

Contraindications

Professional Guidance

---

# PART X — Workout Fields

Workout defines

Goal

Estimated Duration

Exercise Sequence

Rounds

Rest

Substitutions

Completion Rule

Difficulty

Equipment

---

# PART XI — AI Metadata

This is something I believe we should include now rather than bolt on later.

Every Knowledge Item should contain structured AI metadata.

## Recommendation Tags

Examples

```
Weight Loss

Stress

Morning

Office

Travel

Indoor

Outdoor
```

---

## Behaviour Tags

```
Quick Win

Habit Builder

Beginner Friendly

High Commitment

Low Impact
```

---

## Similar Activities

```
Walking

Cycling

Swimming
```

---

## Suggested Next Activities

```
30-minute Walk

Mobility Routine

Hydration Reminder
```

---

## Goal Compatibility Score

Future recommendation engine.

---

# PART XII — Search Metadata

Every record contains

Search Keywords

Popular Terms

Misspellings

Synonyms

Language Variants

This dramatically improves discovery.

---

# PART XIII — Challenge Metadata

This references

Compatibility Matrix

Behaviour Framework

Challenge Policies

Verification

Leaderboard

Completion

Everything links.

Nothing duplicated.

---

# PART XIV — Translation

Every textual field exists as

English

French

Future languages.

No duplicated records.

---

# PART XV — Governance

Every record stores

Author

Reviewer

Clinical Reviewer

Fitness Reviewer

Translation Reviewer

Approval Date

Review Date

Change History

Publication Notes

---

# PART XVI — Lifecycle

Every record follows

Draft

↓

Review

↓

Approved

↓

Published

↓

Deprecated

↓

Archived

---

# PART XVII — Rationalisation Matrix

Now comes the actual review.

Every existing exercise becomes one row.

| Existing Exercise | Canonical ID | Decision | Reason |
| --- | --- | --- | --- |
| Push-up | EX-PUSH-0001 | Keep | Canonical |
| Knee Push-up | EX-PUSH-0002 | Variant | Child |
| Incline Push-up | EX-PUSH-0003 | Variant | Child |
| Push-up Hold | EX-PUSH-0004 | Separate | Different metric |
| Wall Push-up | EX-PUSH-0005 | Variant | Beginner |

---

Every record receives

Keep

Merge

Split

Rename

Variant

Retire

Restricted

---

# PART XVIII — Quality Checklist

Every published Knowledge Item must pass validation.

✓ Identity

✓ Taxonomy

✓ Content

✓ Metrics

✓ Units

✓ Challenge Eligibility

✓ Behaviour References

✓ Relationships

✓ Translation

✓ Governance

Only then can it be published.

---

# PART XIX — Initial Launch Catalogue

Rather than publishing all 154 exercises immediately, define a curated launch catalogue.

I recommend:

- **30–50 core exercises** spanning major movement patterns and fitness goals.
- **20–30 wellness activities** covering hydration, nutrition, sleep, mindfulness and healthy habits.
- **10–15 foundational workouts** composed from those exercises.

This gives Tiizi a high-quality, internally consistent catalogue for launch while leaving room to expand. Additional exercises can then be onboarded through the governance workflow rather than rushing every legacy record into production.

---
