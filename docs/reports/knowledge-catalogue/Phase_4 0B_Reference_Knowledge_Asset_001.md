# Phase_4.0B_Reference_Knowledge_Asset_001

---

## Push-up

Status:

**Production Knowledge Asset**

---

# Knowledge Asset Header

```
Knowledge Asset ID

KA-EX-PUSH-0001

Knowledge Domain

Fitness

Knowledge Category

Exercise

Knowledge Family

Push

Knowledge Status

Published

Knowledge Version

1.0.0
```

Already this looks much more like an enterprise knowledge platform than an exercise database.

---

# The Golden Rule

Every Knowledge Asset answers one simple question:

> **Everything the Tiizi platform knows about this concept.**
>

Nothing more.

Nothing less.

---

# Knowledge Asset Architecture

I would now organise the Push-up into **13 governed modules**.

---

# Module 1

Identity

Owns:

- ID
- Name
- Aliases
- Translation Keys
- Search Terms
- Editorial Summary

---

# Module 2

Classification

Owns:

- Domain
- Family
- Sub-family
- Movement Type
- Force Type
- Environment

---

# Module 3

Movement Science

Owns:

- Biomechanics
- Muscles
- Joints
- Planes
- Stabilisation
- Energy System

---

# Module 4

Performance

Owns:

- Metrics
- Units
- Difficulty
- Complexity
- Benchmarks
- Progression Readiness

---

# Module 5

Technique

Owns:

- Setup
- Execution
- Finish
- Breathing
- Tempo
- Coaching

---

# Module 6

Safety

Owns:

- Contraindications
- Risks
- Restrictions
- Modifications

---

# Module 7

Programming

Owns:

- Workout Usage
- Training Frequency
- Sets
- Reps
- Rest
- Programming Context

---

# Module 8

Challenge Intelligence

Owns:

- Challenge Types
- Verification
- Anti-cheat
- Targets
- Leaderboards

---

# Module 9

Recommendation Intelligence

Owns:

- Goals
- User Levels
- Equipment Context
- Time Context
- Personalisation Rules

---

# Module 10

Knowledge Graph

Owns every relationship.

Progressions

Regressions

Alternatives

Prerequisites

Complementary

Goal Links

Equipment Links

Workout Links

Challenge Links

This module alone may eventually contain **hundreds of relationships**.

---

# Module 11

AI Intelligence

Owns:

- Intent Categories
- Semantic Tags
- Embeddings
- Recommendation Rules
- Confidence Signals
- Prompt Hints

Notice something important:

The AI module does **not** own facts.

It owns *how AI uses the facts*.

That's a very important architectural distinction.

---

# Module 12

Evidence & Governance

This is a refinement I strongly recommend adding.

Every Knowledge Asset should explicitly record **why** its content is trusted.

Suggested fields include:

- Evidence Level (using the E1–E4 model we introduced)
- Scientific Review Status
- Editorial Review Status
- Source References
- Review Dates
- Governance Approvals

This keeps the platform transparent about the basis for its knowledge.

---

# Module 13

Lifecycle

Owns:

- Versions
- History
- Migration IDs
- Release
- Deprecation
- Archive

---

# The Knowledge Asset Passport

Every Knowledge Asset should also expose a lightweight summary for systems that don't need the full record.

Example:

```
Knowledge Asset Passport

ID:
KA-EX-PUSH-0001

Name:
Push-up

Family:
Push

Difficulty:
Intermediate

Safety:
Low

Metric:
Repetitions

Challenge Ready:
Yes

Workout Ready:
Yes

AI Ready:
Yes

Knowledge Version:
1.0.0

Graph Relationships:
43

Translation Coverage:
EN | FR | RN

Review Status:
Approved
```

Think of it as the "cover page" of the asset.

---

# One More Innovation

I believe Tiizi should introduce a **Knowledge Health Score**.

Not for users.

For the knowledge itself.

Each Knowledge Asset receives a score based on governance completeness.

Example dimensions:

| Dimension | Example Weight |
| --- | --- |
| Identity complete | 10% |
| Taxonomy complete | 10% |
| Scientific profile complete | 15% |
| Technique complete | 15% |
| Safety complete | 15% |
| Relationship graph complete | 15% |
| AI metadata complete | 10% |
| Translation coverage | 5% |
| Governance & evidence | 5% |

A Push-up record might score:

> **Knowledge Health: 98/100**
>

This gives editors and engineers an objective measure of catalogue maturity and highlights where improvements are needed.

---

# Phase 4.0B Deliverables

The first production deliverable should now consist of:

1. **Reference Knowledge Asset (RKA-001): Push-up**
2. **Knowledge Asset Passport**
3. **Complete Relationship Graph**
4. **AI Intelligence Profile**
5. **Evidence & Governance Record**
6. **Knowledge Health Assessment**
7. **Authoring & QA Checklist**

---
