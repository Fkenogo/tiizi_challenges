# Phase-3A-12_Tiizi AI_Recommendation_Decision_Framework_v2

**Status:** Constitutional Intelligence Standard

**Purpose**

The AI Recommendation & Decision Framework defines how Tiizi transforms governed knowledge into governed decisions.

It establishes the principles, decision hierarchy, confidence model and safety guardrails that every recommendation engine must follow, regardless of implementation technology.

This framework applies to:

- AI Coach
- Workout Generator
- Challenge Builder
- Personalised Recommendations
- Search
- Notifications
- Future conversational assistants

---

# 1. Vision

AI in Tiizi does not create truth.

AI discovers, combines and explains governed knowledge.

Knowledge remains the authority.

AI provides intelligent interpretation.

---

# 2. Constitutional Principle

Every recommendation must be:

- explainable
- reproducible
- governed
- auditable
- safe
- grounded in canonical knowledge

No recommendation should depend solely on probabilistic model output.

---

# 3. Decision Hierarchy

Every recommendation follows the same hierarchy.

```
User Intent
      ↓
User Context
      ↓
Knowledge Graph
      ↓
Governed Rules
      ↓
Candidate Options
      ↓
Ranking & Confidence
      ↓
Safety Validation
      ↓
Recommendation
      ↓
Explanation
```

This sequence is mandatory.

---

# 4. Inputs

Every recommendation may consider:

## User Profile

- age
- fitness level
- experience
- interests
- preferred activities
- available equipment
- goals
- language
- accessibility preferences

---

## Current Context

Examples:

- active challenge
- workout history
- recent activity
- recovery status
- time available
- location (if permitted)
- connected devices
- current programme

---

## Knowledge Graph

AI never invents exercises.

It queries:

- exercises
- workouts
- wellness activities
- relationships
- goals
- challenge compatibility

---

# 5. Decision Objectives

Every recommendation must optimise one or more declared objectives.

Examples:

- consistency
- progression
- recovery
- safety
- enjoyment
- adherence
- challenge completion
- skill acquisition
- variety

Objectives are explicit, not implied.

---

# 6. Candidate Generation

The graph produces candidate options.

Example:

Goal:

Upper-body strength

Candidates:

- Push-up
- Chest Press
- Incline Push-up
- Bench Press
- Wall Push-up

The AI does not invent candidates; it ranks governed ones.

---

# 7. Ranking Factors

Candidate ranking considers:

- goal alignment
- user ability
- current progression
- safety
- available equipment
- challenge compatibility
- variety
- historical performance
- preferences
- recovery state

Each factor contributes to the final recommendation score.

---

# 8. Confidence Model

Every recommendation includes a confidence assessment.

Example:

| Confidence | Meaning |
| --- | --- |
| Very High | Strong evidence from profile, graph and history |
| High | Good fit with minor assumptions |
| Moderate | Reasonable option with limited evidence |
| Low | Limited confidence; present with caution |

Confidence supports transparency rather than certainty.

---

# 9. Explainability

Every recommendation must be explainable in user-friendly language.

Example:

> We recommended **Wall Push-up** because:
>
> - it develops the same pushing movement as a Push-up;
> - it matches your current beginner level;
> - it requires no equipment;
> - it has a lower technical complexity;
> - it fits your active challenge.

This explanation is derived from graph relationships and user context.

---

# 10. Safety Guardrails

Safety overrides all optimisation goals.

If a recommendation conflicts with governed safety guidance, it is excluded before ranking.

Examples:

- contraindications
- declared injuries
- pregnancy guidance
- restricted activities
- age-specific restrictions

The framework errs on the side of caution.

---

# 11. Conflict Resolution

Recommendations may involve competing objectives.

Example:

A user wants:

- rapid progression
- low injury risk

When objectives conflict, the decision hierarchy is:

1. Safety
2. Eligibility
3. User goals
4. Long-term adherence
5. Performance optimisation
6. Variety

This hierarchy is fixed for Version 2.

---

# 12. Personalisation Principles

Personalisation should use governed data rather than opaque assumptions.

Factors include:

- completed workouts
- preferred movement families
- preferred workout duration
- successful challenge history
- stated interests
- available equipment

Personalisation should always remain explainable.

---

# 13. Recommendation Categories

The framework supports several recommendation types.

### Exercise Recommendation

Example:

> Try Wall Push-up.
>

---

### Workout Recommendation

Example:

> Complete a 20-minute beginner upper-body workout.
>

---

### Challenge Recommendation

Example:

> Join the 14-Day Walking Streak.
>

---

### Wellness Recommendation

Example:

> Add a five-minute breathing session after today's workout.
>

---

### Learning Recommendation

Example:

> Review the Shoulder Press technique guide before increasing weight.
>

Each category follows the same decision framework.

---

# 14. Diversity & Repetition

Recommendations should balance familiarity and variety.

The engine should avoid repeatedly suggesting the same exercise unless:

- it remains the best governed option,
- the user is intentionally repeating a programme,
- a challenge requires repetition.

This supports long-term engagement.

---

# 15. Learning Feedback

User actions provide feedback to improve future recommendations.

Signals include:

- accepted recommendation
- ignored recommendation
- completed activity
- abandoned workout
- explicit feedback
- favourites
- saved workouts

Feedback influences ranking but never changes canonical knowledge.

---

# 16. Human Oversight

Governed knowledge remains editable only through the established review process.

AI may suggest:

- new relationships,
- potential aliases,
- editorial improvements.

These require human review before becoming canonical.

---

# 17. Auditability

Every recommendation should be reproducible.

The platform should be able to record:

- recommendation timestamp,
- knowledge version,
- graph version,
- decision rules applied,
- user context,
- confidence level.

This supports debugging, governance and trust.

---

# 18. Privacy Principles

Recommendations use only authorised user information.

Users retain control over:

- connected devices,
- health information,
- personalisation preferences,
- data sharing.

Sensitive information should only influence recommendations where appropriate and permitted.

---

# 19. Extensibility

Future recommendation domains include:

- nutrition,
- sleep,
- recovery,
- rehabilitation,
- mental wellbeing,
- sports performance.

All future domains inherit this decision framework.

---

# 20. Version 2 Intelligence Freeze

Version 2 freezes the following principles:

- Knowledge is authoritative.
- AI interprets; it does not redefine.
- Recommendations follow a governed decision hierarchy.
- Safety always takes precedence.
- Every recommendation is explainable.
- Confidence is explicit.
- Personalisation is transparent.
- Canonical knowledge evolves only through governance.

---

# Deliverable

The AI Recommendation & Decision Framework provides the governed intelligence layer for Tiizi.

Together with the Knowledge Graph and Ontology, it ensures that recommendations are:

- grounded in canonical knowledge,
- consistent across applications,
- explainable to users,
- auditable by engineers,
- adaptable to future AI technologies.

---

# A Strategic Milestone

With this phase complete, the **Knowledge Platform architecture is effectively complete**.

You now have constitutional standards for:

- Knowledge ownership
- Controlled taxonomies
- Canonical specifications
- Editorial governance
- Knowledge relationships
- Graph ontology
- AI decision-making

That means the remaining work is no longer about inventing architecture.

It is about **authoring and governing knowledge**.

## The Next Programme

I would formally begin a new stage:

# Stage 4 — Knowledge Production Programme

This stage creates the canonical content that will populate the platform.

The recommended sequence is:

1. **Exercise Knowledge Catalogue** (family by family)
2. **Workout Knowledge Catalogue**
3. **Wellness Knowledge Catalogue**
4. **Interest Knowledge Catalogue**
5. **Challenge Knowledge Catalogue**
6. **Knowledge Freeze**
7. **Migration Engineering** (Migration Map → Environment Reconciliation → Migration Specification)

This marks a natural transition in the project. The foundational architecture is sufficiently mature that the focus can now shift from designing the platform to building the high-quality knowledge assets that will power it.
