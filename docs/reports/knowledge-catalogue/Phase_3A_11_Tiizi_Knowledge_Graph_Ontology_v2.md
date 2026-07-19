# Phase_3A_11_Tiizi_Knowledge_Graph_Ontology_v2

**Status:** Constitutional Knowledge Standard

**Purpose**

The Knowledge Graph Ontology defines every node type, relationship type, inheritance rule and validation constraint used by the Tiizi Knowledge Platform.

It provides a single semantic model for all current and future knowledge domains.

The ontology is implementation-independent and serves as the authoritative conceptual blueprint for engineering.

---

# 1. Vision

The Tiizi Knowledge Graph is a **semantic network**, not a collection of tables.

Every node represents a governed concept.

Every edge represents a governed relationship.

Every traversal has semantic meaning.

Applications, analytics and AI consume this semantic model rather than inventing their own interpretations.

---

# 2. Ontology Layers

The ontology is organised into five layers.

```
Knowledge Layer
        ↓
Behaviour Layer
        ↓
Runtime Layer
        ↓
Projection Layer
        ↓
Experience Layer
```

Each layer has clearly defined responsibilities.

---

# 3. Knowledge Layer

This layer contains immutable or version-controlled knowledge.

Node types:

- Knowledge Item
- Exercise
- Workout
- Wellness Activity
- Equipment
- Muscle Group
- Goal
- Metric
- Unit
- Interest
- Learning Resource
- Challenge Policy
- Challenge Template

These nodes own knowledge.

---

# 4. Behaviour Layer

Behaviour defines **how** knowledge is interpreted.

Node types:

- Challenge Policy
- Validation Rule
- Scoring Rule
- Verification Method
- Recommendation Rule

Behaviour nodes never duplicate knowledge.

---

# 5. Runtime Layer

Runtime represents facts.

Examples:

- Activity Event
- Workout Log
- Challenge Instance
- User Achievement
- Verification Record

Runtime never edits knowledge.

It references it.

---

# 6. Projection Layer

Projection nodes are calculated.

Examples:

- Leaderboard
- Progress Projection
- Goal Projection
- Weekly Summary
- Challenge Recap

If deleted they can be rebuilt.

---

# 7. Experience Layer

This layer exists purely for presentation.

Examples:

- Home Feed
- Suggested Workouts
- AI Coach Conversation
- Dashboard Widgets
- Notifications

These nodes never own truth.

---

# 8. Inheritance Model

The ontology uses controlled inheritance.

```
Knowledge Item
│
├── Exercise
├── Workout
├── Wellness Activity
├── Stretch
├── Recovery Activity
└── Future Domains
```

Every child inherits:

- identity
- governance
- translations
- versioning
- taxonomy support

Children extend, not replace, inherited behaviour.

---

# 9. Node Contracts

Every node must implement a common contract.

Mandatory fields:

- Node ID
- Node Type
- Version
- Status
- Owner
- Created Date
- Updated Date
- Governance State

Domain-specific fields extend this contract.

---

# 10. Relationship Contracts

Every relationship implements the same contract.

Required attributes:

- Relationship ID
- Relationship Type
- Source Node
- Target Node
- Direction
- Effective Version
- Confidence
- Editorial Status

This allows relationships to be audited and versioned.

---

# 11. Cardinality Rules

The ontology defines how many relationships are permitted.

Examples:

### Exercise

Exactly one:

- Primary Domain
- Primary Family

Zero or many:

- Alternatives
- Progressions
- Regressions
- Complementary Exercises

---

### Workout

One or many:

- Exercise references

Exactly one:

- Workout Type

---

### Challenge Template

Exactly one:

- Challenge Policy

One or many:

- Knowledge Items

---

# 12. Relationship Constraints

Examples:

An Exercise:

- may progress to many Exercises;
- may regress from many Exercises;
- may belong to only one primary family.

A Challenge Template:

- cannot directly reference Activity Events.

An Activity Event:

- cannot reference another Activity Event.

These rules maintain graph integrity.

---

# 13. Cross-Domain Relationships

The ontology allows relationships across domains.

Example:

```
Exercise
      ↓ Goal Match
Goal

Exercise
      ↓ Supports
Workout

Workout
      ↓ Suitable For
Challenge Template

Challenge Template
      ↓ Uses
Challenge Policy
```

This enables knowledge reuse.

---

# 14. Identity Principles

Node IDs are immutable.

Display names may evolve.

Example:

```
Node ID

EX-PUSH-0001

Name v1

Push-up

Name v2

Standard Push-up
```

The identity remains unchanged.

---

# 15. Semantic Integrity

Every concept has exactly one semantic owner.

Examples:

Exercise owns:

- execution
- safety
- metrics

Challenge Policy owns:

- scoring
- completion

Workout owns:

- sequence
- structure

No duplication is permitted.

---

# 16. Traversal Rules

Applications traverse approved paths.

Example:

```
Goal

↓

Recommended Exercises

↓

Progressions

↓

Workout

↓

Challenge
```

Rather than issuing disconnected lookups, applications navigate governed relationships.

---

# 17. Validation Rules

The ontology validates:

- orphan nodes
- invalid relationships
- circular references (where prohibited)
- duplicate identities
- invalid inheritance
- broken references

These checks protect long-term data quality.

---

# 18. Extensibility

New domains must inherit the ontology rather than redefining it.

Future domains include:

- Nutrition
- Sleep
- Mental Wellbeing
- Rehabilitation
- Sports Skills
- Occupational Health

Each plugs into the same semantic framework.

---

# 19. Governance Lifecycle

Every ontology element follows:

```
Draft
   ↓
Technical Review
   ↓
Knowledge Review
   ↓
Editorial Review
   ↓
Governance Approval
   ↓
Published
   ↓
Deprecated (if required)
```

Ontology evolution is controlled and versioned.

---

# 20. Version 2 Ontology Freeze

Version 2 freezes:

- Layer architecture
- Node contracts
- Relationship contracts
- Inheritance model
- Cardinality rules
- Semantic ownership
- Traversal principles
- Validation rules
- Extensibility model
- Governance lifecycle

No implementation may diverge from this ontology without a formal governance revision.

---

# Why This Matters

The Knowledge Graph Framework (Phase 3A-10) defined *how* knowledge should relate.

The Knowledge Graph Ontology defines *what* exists in the graph and the rules that govern it.

Together they provide a stable semantic foundation for every Tiizi capability—from AI coaching and workout generation to analytics, search and future expansion into other health domains.

---

# One Strategic Observation Before the Next Phase

At this point, we have created:

- Knowledge Architecture
- Ownership Model
- Controlled Taxonomies
- Knowledge Specification
- Editorial Standards
- Relationship Framework
- Graph Ontology

This is already sufficient to implement a conventional fitness platform.

The next phase should focus on what will make Tiizi *intelligently adaptive* rather than simply *knowledge-aware*.

## Phase 3A-12 — AI Recommendation & Decision Framework

This will not describe prompts or language models.

Instead, it will define:

- recommendation objectives,
- decision hierarchy,
- graph traversal strategies,
- conflict resolution,
- confidence scoring,
- explainability,
- safety guardrails,
- personalisation rules.

In other words, it will answer:

> **"Given this knowledge graph, how should Tiizi decide what to recommend, when, and why?"**
>

That creates a governed decision layer that can be implemented consistently regardless of whether the underlying AI is a rules engine, a graph engine, or a future large language model.
