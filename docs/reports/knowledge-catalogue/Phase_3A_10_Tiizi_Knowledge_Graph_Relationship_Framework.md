# Phase_3A_10_Tiizi_Knowledge_Graph_Relationship_Framework_v2

**Status:** Constitutional Knowledge Standard

**Purpose**

The Knowledge Graph & Relationship Framework defines how every knowledge entity in Tiizi is connected.

Rather than storing isolated records, the platform models a governed network of relationships that can be traversed by applications, analytics and AI.

This framework applies across:

- Exercises
- Workouts
- Wellness Activities
- Challenge Templates
- Challenge Policies
- User Interests
- Learning Resources
- Future Knowledge Domains

---

# 1. Vision

Tiizi is not an exercise database.

It is a **Fitness Knowledge Graph**.

Every knowledge entity exists as a node within a governed graph.

Applications consume the graph rather than implementing their own disconnected logic.

---

# 2. Core Principles

The Knowledge Graph follows six constitutional principles.

### Principle 1 — Everything Is a Node

Knowledge entities are represented as nodes.

Examples:

- Exercise
- Workout
- Wellness Activity
- Challenge Template
- User Interest
- Equipment
- Muscle Group
- Goal
- Metric
- Learning Resource

---

### Principle 2 — Every Connection Has Meaning

Relationships are explicit.

Examples:

- Progression
- Regression
- Alternative
- Complementary
- Requires
- Uses Equipment
- Measures With
- Belongs To Family

No implicit relationships.

---

### Principle 3 — Relationships Are Typed

Every edge has one approved relationship type.

Never generic:

```
related_to
```

Always specific:

```
Progression

Alternative

Prerequisite

Same Family
```

---

### Principle 4 — Relationships Are Governed

Editors cannot invent new relationship types.

Every relationship type belongs to the controlled ontology.

---

### Principle 5 — Relationships Are Directional

Example

```
Wall Push-up

↓

Regression Of

↓

Push-up
```

The reverse is:

```
Push-up

↓

Progression

↓

Wall Push-up
```

Direction always has meaning.

---

### Principle 6 — Knowledge Is Explainable

Every recommendation should be traceable through graph relationships.

The platform must be able to explain:

> "Why was this exercise recommended?"
>

---

# 3. Graph Architecture

```
Knowledge Graph

│

├── Exercise

├── Workout

├── Wellness Activity

├── Challenge Template

├── Challenge Policy

├── User Interest

├── Equipment

├── Muscle Group

├── Goal

├── Metric

└── Learning Resource
```

Each node participates in multiple relationship networks.

---

# 4. Relationship Categories

The graph uses governed categories.

## A. Technical Relationships

Describe exercise mechanics.

Examples:

- Progression
- Regression
- Variation
- Alternative
- Same Family
- Same Sub-Family
- Similar Movement Pattern

---

## B. Physiological Relationships

Describe physical effects.

Examples:

- Primary Muscle
- Secondary Muscle
- Stabiliser
- Joint Action
- Energy System
- Impact Level
- Recovery Demand

---

## C. Programming Relationships

Describe workout planning.

Examples:

- Warm-up Before
- Cooldown After
- Superset Pair
- Circuit Pair
- Recovery Pair
- Mobility Preparation
- Activation Drill

---

## D. Coaching Relationships

Describe learning.

Examples:

- Prerequisite
- Preparation Exercise
- Corrective Exercise
- Common Mistake Companion
- Frequently Confused With

---

## E. Behaviour Relationships

Describe challenge suitability.

Examples:

- High Verification Confidence
- Suitable For Streak
- Suitable For Collective
- Suitable For Competitive
- High Anti-Cheat Confidence

---

## F. Recommendation Relationships

Describe intelligent suggestions.

Examples:

- Popular Together
- Frequently Substituted
- Goal Match
- Beginner Path
- Rehabilitation Option

---

# 5. Canonical Relationship Dictionary

The initial Version 2 dictionary freezes the following relationship types.

## Technical

- Progression
- Regression
- Variation
- Alternative
- Same Family
- Same Sub-Family
- Same Movement Pattern
- Similar Technique

## Physiological

- Primary Muscle
- Secondary Muscle
- Stabiliser
- Same Energy System
- Same Movement Plane
- Same Force Type
- Similar Recovery Demand

## Programming

- Warm-up Before
- Cooldown After
- Superset Pair
- Circuit Pair
- EMOM Suitable
- AMRAP Suitable
- Tabata Suitable

## Coaching

- Prerequisite
- Preparation Exercise
- Corrective Exercise
- Mobility Drill
- Activation Drill

## Behaviour

- Suitable for Collective Challenge
- Suitable for Competitive Challenge
- Suitable for Streak Challenge
- High Verification Confidence
- Low Cheating Risk

## Recommendation

- Frequently Substituted
- Often Performed Together
- Goal Match
- Beginner Recommendation
- Advanced Progression

These become the only approved relationship types for Version 2.

---

# 6. Node Ownership

Every node owns its own attributes.

Relationships never duplicate node data.

Example:

Push-up owns:

- execution
- safety
- metrics

The relationship owns only the connection.

---

# 7. Relationship Ownership

Every relationship records:

- Relationship ID
- Relationship Type
- Source Node
- Target Node
- Direction
- Confidence
- Evidence
- Version
- Governance Status

Relationships themselves become governed assets.

---

# 8. Example: Push-up Graph

```
Push-up
│
├── Progression → Decline Push-up
├── Progression → Archer Push-up
├── Regression → Incline Push-up
├── Regression → Wall Push-up
├── Alternative → Chest Press
├── Complementary → Bent-over Row
├── Requires → Forearm Plank
├── Uses Equipment → Bodyweight
├── Primary Muscle → Chest
├── Secondary Muscle → Triceps
├── Goal Match → Upper Body Strength
└── Suitable For → Streak Challenge
```

A single exercise becomes a rich network of governed relationships rather than an isolated record.

---

# 9. Graph Traversal Principles

Applications should navigate the graph instead of hard-coding logic.

Examples:

- "Show regressions of Push-up."
- "Find bodyweight alternatives."
- "Recommend exercises with the same primary goal."
- "Build a beginner progression pathway."

The graph supplies these answers through explicit relationships.

---

# 10. Explainability

Every recommendation must be explainable.

Example:

> Recommendation: Wall Push-up
>

Reason:

- Regression of Push-up
- Same movement family
- Lower technical complexity
- Lower safety tier
- Appropriate for beginners

This traceability improves user trust and simplifies debugging.

---

# 11. AI Integration

The Knowledge Graph is the primary source of structured knowledge for AI systems.

Large language models should:

- interpret user intent,
- query or traverse the graph,
- synthesise responses.

They should not invent canonical relationships that are absent from the graph.

This keeps recommendations grounded in governed knowledge.

---

# 12. Versioning

Relationships are versioned independently.

If a relationship changes:

- previous versions remain auditable,
- dependent knowledge records retain historical integrity,
- recommendations remain reproducible.

---

# 13. Governance Rules

No relationship may:

- duplicate node content,
- contradict controlled taxonomies,
- introduce unmanaged relationship types,
- bypass editorial review.

All relationship additions follow the same governance lifecycle as knowledge records.

---

# 14. Quality Gates

Before approval, every relationship must satisfy:

- Approved relationship type
- Valid source node
- Valid target node
- Correct direction
- Supporting rationale
- Editorial review
- Governance approval
- Version recorded

---

# 15. Version 2 Framework Freeze

Version 2 freezes the following principles:

- Every knowledge entity is a graph node.
- Every connection uses an approved relationship type.
- Relationships are directional and governed.
- Knowledge remains explainable through graph traversal.
- Applications consume graph relationships rather than implementing duplicate logic.
- AI recommendations are grounded in governed graph knowledge.

---

# Deliverable

The **Knowledge Graph & Relationship Framework** establishes the constitutional rules for how knowledge is connected throughout Tiizi.

It turns the catalogue into a navigable, explainable network that supports:

- AI coaching,
- workout generation,
- challenge creation,
- intelligent search,
- adaptive recommendations,
- analytics,
- future knowledge domains.
