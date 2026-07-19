# Phase_3A_8_Canonical_Exercise_Knowledge_Specification_v2

---

**Status:** Constitutional Knowledge Standard

---

# 1. Purpose

Every Exercise in Tiizi shall conform to one standard knowledge structure.

Regardless of whether the exercise is:

- Push-up
- Walking
- Deadlift
- Plank
- Burpee
- Swimming

The knowledge record is identical.

Only the values differ.

---

# 2. Knowledge Philosophy

An Exercise is not simply a name.

It is a reusable body of knowledge.

The exercise record exists independently from:

- workouts
- challenges
- programmes
- users
- coaches

Everything references it.

Nothing duplicates it.

---

# 3. Canonical Record Structure

Every Exercise contains the following sections.

```
Identity

↓

Classification

↓

Movement Science

↓

Execution

↓

Safety

↓

Measurement

↓

Relationships

↓

Challenge Behaviour

↓

Workout Behaviour

↓

Learning

↓

AI Metadata

↓

Governance
```

---

# SECTION A — Identity

Owns identity.

## Required

Canonical ID

Example

```
EX-PUSH-0001
```

---

Canonical Name

```
Push-up
```

---

Aliases

Example

```
Pushups

Push Up

Press-up
```

---

Translations

- English
- French
- Kirundi
- future languages

---

Short Description

One sentence.

---

Long Description

Educational explanation.

---

# SECTION B — Classification

Every exercise owns exactly one taxonomy.

Fields

Primary Domain

Primary Family

Sub-family

Movement Type

Dynamic

Static Hold

Explosive

Hybrid

Primary Plane

Sagittal

Frontal

Transverse

Multi-planar

Environment

Indoor

Outdoor

Either

---

# SECTION C — Movement Science

This section makes Tiizi much more intelligent than a normal fitness app.

Fields

Primary Movers

Secondary Movers

Stabilisers

Joint Actions

Movement Pattern

Energy System

Force Type

Bilateral

Unilateral

Open Chain

Closed Chain

Compound

Isolation

---

# SECTION D — Execution

The educational content.

Includes

Starting Position

Execution Steps

Breathing

Tempo

Range of Motion

Common Mistakes

Coaching Tips

Visual Cues

Completion Criteria

---

# SECTION E — Safety

Safety belongs to the exercise.

Fields

Safety Tier

Technical Complexity

Impact Level

Contraindications

Pregnancy Guidance

Children Guidance

Senior Guidance

Beginner Friendly

Medical Restrictions

Equipment Safety

Spotter Required

---

# SECTION F — Measurement

Defines how the exercise is measured.

Primary Metric

Examples

Repetitions

Hold Duration

Distance

Duration

Steps

Load

Secondary Metrics

Approved Units

Minimum Value

Maximum Value

Recommended Ranges

Personal Record Eligible

Verification Options

Self

Manual

Sensor

Wearable

Video

Judge

---

# SECTION G — Equipment

Equipment references.

Required Equipment

Optional Equipment

Alternative Equipment

Minimal Space

Surface

Gym

Home

Outdoor

---

# SECTION H — Relationships

Knowledge graph.

Relationships include

Progressions

Regressions

Prerequisites

Alternatives

Complementary Exercises

Same Family

Same Equipment

Same Muscles

Common Pairings

These become graph edges.

---

# SECTION I — Challenge Behaviour

Exercise-specific challenge metadata.

Compatible With

Collective

Competitive

Streak

Recommended Challenge Metrics

Recommended Target Ranges

Verification Confidence

Leaderboard Suitability

Anti-Cheat Risk

Recommended Difficulty

---

# SECTION J — Workout Behaviour

Defines how the exercise behaves inside workouts.

Warm-up Suitable

Cooldown Suitable

Circuit Suitable

Superset Suitable

EMOM Suitable

AMRAP Suitable

Tabata Suitable

Recovery Interval

Average Time

Transition Time

---

# SECTION K — Learning

Educational metadata.

Difficulty Explanation

When To Learn

Prerequisites

Learning Objectives

Typical Mistakes

Frequently Asked Questions

Recommended Videos

Recommended Reading

---

# SECTION L — AI Metadata

Future AI systems consume this.

Fields

Semantic Tags

Embeddings

Intent Categories

Related Goals

Weight Loss

Strength

Mobility

Sports

Rehabilitation

Confidence

Recommendation Rules

---

# SECTION M — Governance

Administrative metadata.

Fields

Knowledge Version

Created Date

Updated Date

Review Status

Medical Review

Fitness Review

Editorial Review

Translation Status

Launch Status

Deprecation Status

Migration Aliases

---

# Exercise Knowledge Summary

Every exercise therefore owns:

| Category | Approximate Fields |
| --- | --- |
| Identity | 8 |
| Classification | 8 |
| Movement Science | 10 |
| Execution | 9 |
| Safety | 10 |
| Measurement | 10 |
| Equipment | 5 |
| Relationships | 9 |
| Challenge Behaviour | 8 |
| Workout Behaviour | 9 |
| Learning | 8 |
| AI Metadata | 7 |
| Governance | 10 |

Total:

Approximately **110–120 structured knowledge fields** per exercise.

---

# Why this matters

This is what transforms Tiizi from a simple exercise list into a **Fitness Knowledge Platform**.

A Push-up is no longer just:

```
Push-up

Category: Chest

Metric: Reps
```

It becomes a richly structured knowledge object that can:

- teach users how to perform it;
- drive workout generation;
- support challenge validation;
- power AI recommendations;
- provide safety guidance;
- relate to other exercises through a knowledge graph;
- remain versioned and governable over time.

---

# Version 2 Knowledge Freeze

Every canonical exercise in Tiizi shall:

- have one authoritative knowledge record;
- follow this specification;
- own its identity, taxonomy, safety and metrics;
- expose relationship metadata rather than duplicate knowledge;
- support challenge, workout and AI systems through structured metadata;
- preserve version history and governance status.

---
