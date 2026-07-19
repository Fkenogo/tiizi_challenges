# Tiizi_Challenge_Compatibility_Matrix_v2d

**Status:** Draft for Approval

**Authority:** Platform Governance Standard

**Dependencies:**

- ✅ Knowledge Model v2
- ✅ Unified Taxonomy & Controlled Dictionaries v2
- ✅ Challenge Engine Audit
- ⏳ Fitness Catalogue Rationalisation
- ⏳ Wellness Catalogue Rationalisation

---

# 1. Purpose

The Challenge Compatibility Matrix defines every valid relationship between:

- Knowledge Items
- Challenge Types
- Metrics
- Units
- Completion Rules
- Ranking Rules
- Verification Requirements
- Safety Restrictions

It is the **single source of truth** used by:

- Challenge Wizard
- Admin Template Builder
- Validation Services
- Activity Logging
- Leaderboards
- Recommendations
- Analytics
- AI Coaching
- Future API integrations

No runtime component may invent challenge behaviour outside this matrix.

---

# 2. Design Principles

The matrix follows eight principles:

### Principle 1 — Knowledge owns compatibility

Activities determine challenge behaviour.

Challenges never redefine activity rules.

---

### Principle 2 — One activity, many policies

Example:

Walking

may support

- Collective
- Competitive
- Streak

Medication Adherence

may support

- Private Streak only

---

### Principle 3 — Policies are explicit

Every challenge policy explicitly defines:

- metrics
- units
- ranking
- completion
- verification

Nothing is implied.

---

### Principle 4 — Safety overrides flexibility

If an activity should never be public competition, the matrix prevents it.

---

### Principle 5 — Runtime never guesses

The runtime reads approved policies.

It never calculates missing behaviour.

---

### Principle 6 — Future-proof

Future challenge types or verification methods extend the matrix rather than replacing it.

---

### Principle 7 — Versioned

Every policy receives its own version.

---

### Principle 8 — Explainable

Every restriction should have a product or safety rationale.

---

# 3. Matrix Structure

Each Knowledge Item references one or more Challenge Policies.

```
Knowledge Item
        │
        ▼
Challenge Policies
        │
        ├── Collective
        ├── Competitive
        └── Streak
```

Policies are reusable.

---

# 4. Challenge Policy Schema

Every policy defines:

## Identity

- Policy ID
- Policy Version
- Status

---

## Scope

- Group
- Personal (future)

---

## Challenge Type

- Collective
- Competitive
- Streak

---

## Metric Contract

Defines:

- approved metric
- approved units
- conversion rules
- default target
- permitted target options

---

## Completion Contract

Defines exactly when success occurs.

---

## Ranking Contract

Defines ranking or confirms ranking is disabled.

---

## Verification Contract

Defines acceptable evidence.

---

## Privacy Contract

Defines visibility.

---

## Safety Contract

Defines restrictions.

---

## Runtime Contract

Defines:

- aggregation
- projection
- correction
- recap

---

# 5. Challenge Compatibility Matrix

Every Knowledge Item will ultimately receive one row.

| Field | Description |
| --- | --- |
| Knowledge Item ID | Canonical ID |
| Name | Display name |
| Entity Type | Exercise / Wellness / Workout |
| Domain | Controlled taxonomy |
| Family | Controlled taxonomy |
| Challenge Types | Supported challenge types |
| Scope | Group / Personal |
| Metric | Approved metric |
| Units | Approved units |
| Target Direction | Controlled direction |
| Completion Strategy | Approved strategy |
| Ranking Strategy | Approved strategy |
| Aggregation Strategy | Approved strategy |
| Verification | Accepted methods |
| Public Allowed | Yes / No |
| Safety Tier | Low–Restricted |
| Notes | Rationale |

---

# 6. Challenge Type Rules

## Collective

Purpose:

Work together toward one outcome.

### Required

- aggregation
- shared target
- contribution policy
- completion strategy

### Ranking

Disabled by default.

### Winners

Optional.

---

## Competitive

Purpose:

Fair comparison.

### Required

- one metric
- one ranking strategy
- one tie strategy

### Verification

May be mandatory.

---

## Streak

Purpose:

Repeat behaviour consistently.

### Required

- cadence
- daily predicate
- timezone
- missed-day policy

---

# 7. Completion Strategies

Approved strategies:

### Shared Target

Group reaches target.

---

### Participant Completion

Every participant completes.

---

### Minimum Participation

Minimum required participants complete.

---

### Scheduled End

Challenge ends at end date.

---

### Daily Predicate

User satisfies daily obligation.

---

### Workout Completion

Entire workout completed.

---

### Hybrid

Combination of approved strategies.

---

# 8. Ranking Strategies

Approved:

- Highest Total
- Lowest Time
- Highest Completion %
- Earliest Completion
- Highest Consistency
- Greatest Improvement

Each Competitive challenge selects exactly one.

---

# 9. Aggregation Strategies

Approved:

### Sum

Walking distance.

---

### Count

Sessions.

---

### Completed Participants

Number of members completed.

---

### Equivalent Contribution

Different activities mapped through an approved equivalence model.

---

### Average

Future capability.

---

# 10. Verification Matrix

| Verification | Collective | Competitive | Streak |
| --- | --- | --- | --- |
| Self Report | Yes | Limited | Yes |
| Device | Yes | Yes | Yes |
| Wearable | Yes | Yes | Yes |
| Photo | Optional | Optional | Optional |
| Admin | Optional | Optional | Optional |
| Partner | Future | Future | Future |

---

# 11. Safety Matrix

Safety influences challenge eligibility.

| Safety Tier | Collective | Competitive | Streak |
| --- | --- | --- | --- |
| Low | Yes | Yes | Yes |
| Moderate | Yes | Limited | Yes |
| High | Restricted | Restricted | Restricted |
| Restricted | Case by case | Normally No | Private only |

---

# 12. Privacy Matrix

| Privacy | Public | Group | Personal |
| --- | --- | --- | --- |
| Walking | Yes | Yes | Yes |
| Meditation | Yes | Yes | Yes |
| Sleep | No | Yes | Yes |
| Medication | No | No | Yes |
| Blood Pressure | No | No | Yes |
| Blood Glucose | No | No | Yes |

---

# 13. Entity Compatibility

## Exercise

May support:

- Collective
- Competitive
- Streak

depending on policy.

---

## Wellness Activity

Usually:

- Streak

Sometimes:

- Collective

Occasionally:

- Competitive

---

## Workout

May support:

- Collective
- Competitive
- Streak

depending on completion definition.

---

# 14. Multi-Activity Compatibility

Multi-activity challenges are allowed only when an approved policy exists.

Examples

### Allowed

Walking

-

Running

Distance

---

Meditation

-

Breathing

Minutes

---

Mobility Routine

Sequence completion

---

### Not Allowed

Squats

-

Water Intake

---

Sleep

-

Bench Press

---

Blood Pressure

-

Running Distance

---

# 15. Restricted Activities

The following default to **non-competitive**:

- Medication
- Blood Pressure
- Blood Glucose
- Weight Tracking
- Mental Health Check-ins

Future governance may expand this list.

---

# 16. Launch Catalogue Compatibility

Every launch activity will receive one approved policy set.

Example:

## Walking

Collective

✔

Competitive

✔

Streak

✔

Metrics

- Steps
- Distance
- Duration

Verification

Self-report or device

Safety

Low

---

## Morning Water

Collective

✔

Competitive

✖

Streak

✔

Metrics

Completion

or

Millilitres

Safety

Low

---

## Forearm Plank

Collective

✔

Competitive

Limited

Streak

✔

Metrics

Hold Duration

Safety

Moderate

---

## Blood Pressure

Collective

✖

Competitive

✖

Streak

Private only

Verification

Optional

Safety

Restricted

---

# 17. Wizard Behaviour

The Challenge Wizard never constructs arbitrary combinations.

Instead:

Choose

↓

Knowledge Item

↓

Read Compatible Policies

↓

Show valid challenge types

↓

Show valid metrics

↓

Show valid units

↓

Show valid target options

↓

Launch

No unsupported options appear.

---

# 18. Runtime Validation

Server validation confirms:

✓ activity supports policy

✓ metric valid

✓ unit valid

✓ challenge type valid

✓ verification valid

✓ completion strategy valid

✓ ranking strategy valid

✓ participant eligible

✓ safety restrictions satisfied

---

# 19. Engineering Rules

Developers must never:

- hard-code challenge rules
- infer metrics
- infer ranking
- invent completion logic
- bypass policy validation

Every runtime decision must originate from the Challenge Compatibility Matrix.

---

# 20. Future Extensions

Reserved for:

- AI-generated challenge recommendations
- Adaptive challenge difficulty
- Organization-specific policies
- Coach-approved policies
- Clinical pathways
- Verified competitions
- Wearable trust levels
- Personal challenge scope

---

# 21. Phase 2E Acceptance Criteria

This phase is complete when:

- Every Challenge Policy conforms to the Knowledge Model and Unified Taxonomy.
- Every Knowledge Item can declare one or more approved Challenge Policies.
- The Challenge Wizard can generate its UI solely from this matrix.
- Unsupported challenge combinations are impossible to create through normal product flows.
- Validation, logging and runtime execution all consume the same policy definitions.
- Engineering no longer needs to embed challenge-specific rules in multiple services or scree

# Approved Design Decisions

The following are frozen unless changed through governance:

- Challenge compatibility is determined by the **Knowledge Item**, not by the wizard.
- Every challenge must reference an approved **Challenge Policy**.
- Competitive challenges use exactly one authoritative ranking strategy.
- Multi-activity challenges require an explicit compatibility policy.
- Sensitive health activities default to private, non-competitive participation.
- The Challenge Wizard exposes only combinations permitted by the Challenge Compatibility Matrix.
- Server-side validation is the final authority for all challenge creation and activity logging.
