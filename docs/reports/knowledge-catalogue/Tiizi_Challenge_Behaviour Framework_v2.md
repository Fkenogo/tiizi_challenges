# Tiizi_Challenge_Behaviour Framework_v2

**Status:** Draft for Approval

**Authority:** Platform Behaviour Standard

**Dependencies:**

- ✅ Knowledge Model v2
- ✅ Unified Taxonomy v2
- ✅ Challenge Compatibility Matrix v2

---

# 1. Purpose

The Challenge Behaviour Framework defines every reusable behavioural pattern that can be used by Tiizi challenges.

Rather than allowing every challenge to implement its own logic, the platform provides a governed library of approved behaviour models.

Every Challenge Policy references one or more Behaviour Models.

The Behaviour Models become reusable building blocks across the platform.

---

# 2. Architectural Position

```
Knowledge Item
        │
        ▼
Challenge Compatibility Matrix
        │
        ▼
Challenge Policy
        │
        ▼
Challenge Behaviour Framework
        │
        ▼
Runtime Engine
```

Knowledge defines identity.

Compatibility defines permission.

Behaviour defines execution.

Runtime executes.

---

# 3. Behaviour Principles

Every behaviour must be:

- deterministic
- reusable
- explainable
- versioned
- independently testable
- implementation-independent
- reusable across many activities

---

# 4. Behaviour Categories

The framework consists of six major behaviour groups.

---

## A — Progress Behaviours

Defines how progress accumulates.

---

## B — Completion Behaviours

Defines when success occurs.

---

## C — Ranking Behaviours

Defines winner determination.

---

## D — Aggregation Behaviours

Defines group calculations.

---

## E — Validation Behaviours

Defines accepted submissions.

---

## F — Finalization Behaviours

Defines how challenges end.

---

# 5. Progress Behaviour Library

These behaviours determine how user contributions accumulate.

---

## PB-001

### Distance Accumulation

Used by:

- Walking
- Running
- Hiking
- Cycling

Progress

```
distance += submittedDistance
```

---

## PB-002

### Duration Accumulation

Used by:

- Meditation
- Yoga
- Breathing
- Stretching

```
minutes += submittedMinutes
```

---

## PB-003

### Step Accumulation

Used by:

Walking

Step challenges

---

## PB-004

### Session Accumulation

Counts completed sessions.

---

## PB-005

### Completion Accumulation

Binary progress.

Completed

or

Not Completed.

---

## PB-006

### Workout Completion

Progress only after the entire workout satisfies its completion rule.

---

## PB-007

### Consecutive Day Progress

Used for streaks.

---

## PB-008

### Scheduled Consistency

Counts scheduled obligations rather than uninterrupted streaks.

---

## PB-009

### Composite Progress

Future capability.

Multiple approved metrics.

---

# 6. Completion Behaviour Library

---

## CB-001

Shared Target

---

## CB-002

Participant Complete

---

## CB-003

Minimum Participants

---

## CB-004

Scheduled End

---

## CB-005

Daily Predicate

---

## CB-006

Workout Completed

---

## CB-007

Hybrid Completion

Future.

---

# 7. Ranking Behaviour Library

---

## RB-001

Highest Total

---

## RB-002

Lowest Time

---

## RB-003

Highest Completion %

---

## RB-004

Earliest Completion

---

## RB-005

Highest Consistency

---

## RB-006

Greatest Improvement

Future.

---

# 8. Aggregation Behaviour Library

---

## AB-001

Simple Sum

---

## AB-002

Count

---

## AB-003

Participant Count

---

## AB-004

Equivalent Contribution

Allows approved activities to contribute toward one goal.

Example:

Walking

-

Running

↓

Distance

---

## AB-005

Weighted Aggregation

Reserved.

---

# 9. Validation Behaviour Library

---

## VB-001

Metric Validation

---

## VB-002

Unit Validation

---

## VB-003

Target Validation

---

## VB-004

Duplicate Detection

Uses idempotency.

---

## VB-005

Challenge Window Validation

---

## VB-006

Membership Validation

---

## VB-007

Verification Validation

---

## VB-008

Safety Validation

---

# 10. Finalization Behaviour Library

---

## FB-001

Natural End

Scheduled finish.

---

## FB-002

Target Reached

---

## FB-003

Manual Cancellation

---

## FB-004

Administrative Closure

---

## FB-005

Force Completion

Reserved.

---

# 11. Behaviour Composition

Every Challenge Policy references behaviours.

Example

Walking Competition

Progress

PB-001

Ranking

RB-001

Completion

CB-004

Aggregation

AB-001

Validation

VB-001–008

Finalization

FB-001

Instead of writing custom code, engineering assembles approved behaviours.

---

# 12. Behaviour Versioning

Every behaviour has:

- Behaviour ID
- Behaviour Version
- Status
- Effective Date
- Change History

Changing a behaviour creates a new version; existing launched challenges continue using the version captured in their immutable snapshot.

---

# 13. Behaviour Inheritance

Challenge Policies inherit behaviour rather than copying it.

For example:

Walking

↓

Distance Challenge Policy

↓

PB-001

CB-001

AB-001

RB-001

This minimizes duplication and keeps behaviour consistent.

---

# 14. Behaviour Compatibility

Not every behaviour can be combined.

Examples:

PB-001 (Distance Accumulation)

✔ Compatible with

- AB-001
- RB-001
- CB-001

✖ Not compatible with

- Health Reading behaviours
- Private-only tracking

The implementation should enforce compatibility between behaviour modules.

---

# 15. Runtime Responsibilities

The runtime should:

- load the selected Behaviour Models
- validate the submission
- execute the Progress Behaviour
- update projections using the Aggregation Behaviour
- determine completion using the Completion Behaviour
- calculate rankings using the Ranking Behaviour
- execute Finalization Behaviour when required

This keeps the runtime generic and avoids activity-specific code paths.

---

# 16. Engineering Guidelines

Engineers should:

- compose behaviours rather than create bespoke logic
- add new behaviours only through governance
- write unit tests for each behaviour in isolation
- version behaviours independently
- document compatibility before implementation

---

# 17. Acceptance Criteria

The Behaviour Framework is complete when:

- Every Challenge Policy references approved Behaviour Models.
- No challenge embeds custom execution logic outside the framework.
- Behaviour modules are individually testable.
- Behaviour versioning supports immutable challenge snapshots.
- The runtime executes behaviours through composition rather than branching on activity types.

---

# 18. Governance Freeze

The following principles are frozen for Version 2:

- Behaviour is defined centrally and reused.
- Challenge Policies compose behaviours; they do not duplicate them.
- Runtime code remains generic and policy-driven.
- New behaviour types require governance approval and versioning.
- Existing behaviour versions remain available for historical challenge snapshots.

## Where we are now

With this document, the governance foundation is effectively complete. We now have a layered architecture:

1. **Knowledge Model** — defines what each activity, exercise and workout is.
2. **Unified Taxonomy & Controlled Dictionaries** — defines the platform vocabulary.
3. **Challenge Compatibility Matrix** — defines which challenge types and rules are permitted.
4. **Challenge Behaviour Framework** — defines the reusable execution logic.

From here, the next phase shifts from architecture to content engineering.

## Phase 2B — Fitness Catalogue Rationalisation

This will be the largest documentation effort. Rather than just "cleaning up" the 154 exercises, we'll produce a canonical catalogue where every exercise is mapped to:

- a stable V2 ID
- its taxonomy classification
- exercise family and variation relationships
- approved metrics and units
- compatible Challenge Policies
- Behaviour Framework mappings
- safety tier
- audience
- equipment
- movement pattern
- migration disposition (Keep, Merge, Rename, Split, Retire, etc.)

That catalogue will become the implementation blueprint for both engineering and content production, and it will drive the initial launch catalogue for Tiizi.
