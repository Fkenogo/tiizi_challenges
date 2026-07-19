# Phase_3A_5_Tiizi_Knowledge_Ownership_Entity_Boundary_Standard_v2

**Status:** Constitutional Governance Standard

**Purpose**

The Knowledge Ownership & Entity Boundary Standard defines ownership responsibilities for every major knowledge entity within Tiizi.

Its purpose is to ensure that:

- every concept has exactly one authoritative owner;
- no information is duplicated across entities;
- all references are directional rather than duplicative;
- runtime systems consume knowledge instead of redefining it;
- migrations preserve history without creating parallel truths.

This document is foundational to the Tiizi Knowledge Platform and applies across Fitness, Wellness, Challenges, Workouts and future AI coaching capabilities.

---

# 1. Core Governance Principle

Every piece of information in Tiizi must have **one authoritative owner**.

Other entities may reference that information but must not redefine it.

This principle eliminates taxonomy drift, inconsistent behaviour and duplicated maintenance.

---

# 2. Entity Hierarchy

The Version 2 platform is organised as follows:

```
Knowledge Platform
│
├── Knowledge Item
│     ├── Exercise
│     ├── Wellness Activity
│     └── Workout
│
├── Challenge Template
│
├── Challenge Instance
│
├── Activity Event
│
├── Workout Log
│
├── User Interest
│
├── Progress Projection
│
├── Leaderboard Projection
│
└── Challenge Recap
```

Knowledge entities define truth.

Runtime entities record events.

Projection entities calculate derived information.

---

# 3. Authoritative Ownership Matrix

| Entity | Owns Identity | Owns Content | Owns Taxonomy | Owns Metrics | Owns Safety | Owns Behaviour | Owns History |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Knowledge Item | ✓ | ✓ | ✓ | ✓ | ✓ | references | version history |
| Challenge Policy | ✓ | ✓ | — | ✓ | ✓ | ✓ | version history |
| Challenge Template | ✓ | template only | references | references | references | references | version history |
| Challenge Instance | ✓ | immutable snapshot | snapshot | snapshot | snapshot | snapshot | immutable |
| Workout Log | ✓ | user data | — | recorded values | — | — | immutable |
| Activity Event | ✓ | recorded event | — | recorded values | verification | — | immutable |
| User Interest | ✓ | label | interest taxonomy | — | — | — | editable |
| Progress Projection | derived | — | — | calculated | — | behaviour output | rebuildable |
| Leaderboard Projection | derived | — | — | calculated | — | behaviour output | rebuildable |
| Challenge Recap | ✓ | generated | snapshot | summary | — | generated | immutable |

---

# 4. Knowledge Item

## Responsibility

Represents the canonical concept.

Examples:

- Walking
- Push-up
- Meditation
- Deadlift
- Gratitude Journal

A Knowledge Item exists independently of any challenge, workout or user.

---

## Owns

- canonical identity
- canonical name
- translations
- taxonomy
- descriptions
- instructions
- safety
- metrics
- units
- compatibility
- relationships
- AI metadata
- governance
- version history

---

## Does NOT Own

- user progress
- challenge targets
- streaks
- workout completion
- scores
- rankings
- schedules

---

# 5. Exercise

Exercise is a specialised Knowledge Item.

Owns:

- movement definition
- execution
- muscles
- equipment
- movement family
- movement pattern
- regressions
- progressions
- substitutions

Never owns:

- daily prescriptions
- challenge targets
- workouts
- logs

---

# 6. Wellness Activity

Also a specialised Knowledge Item.

Owns:

- wellness protocol
- recommended cadence
- behavioural guidance
- contraindications
- health context
- privacy considerations

Never owns:

- exercise execution
- workouts
- challenge results
- logs

Walking as exercise and "Walk for 20 minutes after lunch" are different concepts:

- Walking → Knowledge Item (Exercise)
- Walk after lunch → Prescription referencing Walking

---

# 7. Workout

Workout is also a specialised Knowledge Item.

Owns:

- workout identity
- workout structure
- ordered exercise references
- rest periods
- rounds
- prescriptions
- coaching notes
- completion definition

A workout references Exercises.

It never duplicates their technical descriptions.

---

# 8. Challenge Policy

Challenge Policies own behaviour.

They define:

- progress calculation
- aggregation
- completion logic
- ranking logic
- validation
- verification
- finalisation

They never own activity content.

---

# 9. Challenge Template

Templates describe launch intent.

They own:

- title
- description
- branding
- selected Knowledge Items
- selected Policy
- defaults
- eligibility
- schedule defaults

Templates reference:

- Knowledge Items
- Policies

They do not duplicate content.

---

# 10. Challenge Instance

A launched challenge is immutable.

It owns snapshots of:

- selected Knowledge Items
- selected Policy
- selected metrics
- selected safety
- selected taxonomy
- selected compatibility
- selected translations

Future edits to a Knowledge Item must never alter historical challenges.

---

# 11. Activity Event

Activity Events are factual records.

They own:

- participant
- timestamp
- recorded metric
- recorded unit
- verification method
- supporting evidence
- challenge reference
- workout reference
- Knowledge Item reference

They never own descriptions or instructions.

---

# 12. Workout Log

Workout Logs own:

- workout performed
- participant
- completion
- duration
- notes
- linked Activity Events

Workout Logs never duplicate Workout definitions.

---

# 13. User Interest

Interests describe preferences.

Examples:

- Running
- Yoga
- Home Workouts
- Cycling

Interests never define executable activities.

They own:

- display label
- icon
- grouping
- recommendation metadata

They reference Knowledge Items where appropriate.

The audit confirmed that current implementations duplicate interest vocabularies across several places. Those should be consolidated into a single governed Interest Taxonomy.

---

# 14. Progress Projection

Progress is computed.

It owns nothing permanently.

It derives:

- completion %
- totals
- remaining targets
- trend
- projections

If deleted, it can be rebuilt from Activity Events.

---

# 15. Leaderboard Projection

Leaderboards are also derived.

Inputs:

- Activity Events
- Policy
- Verification

They never own participant truth.

---

# 16. Challenge Recap

Generated when a challenge closes.

Owns:

- statistics
- summary
- highlights
- achievements
- final rankings
- archived snapshot

It is immutable.

---

# 17. References

Relationships should always point toward the owner.

Example:

```
Challenge Template

↓

Exercise

↓

Movement Family
```

Not:

```
Challenge Template

stores movement family
```

---

# 18. Version Ownership

Only these entities are versioned independently:

- Knowledge Item
- Challenge Policy
- Challenge Template

Challenge Instances freeze those versions.

Everything else references them.

---

# 19. Translation Ownership

Translations belong only to:

- Knowledge Items
- Policies
- Templates
- Interest labels

Logs never own translated text.

---

# 20. Safety Ownership

Safety belongs exclusively to Knowledge Items and Challenge Policies.

Runtime data references safety.

It never rewrites it.

---

# 21. Metrics Ownership

Metric contracts belong to Knowledge Items.

Policies decide how those metrics are interpreted.

Example:

Walking owns:

- distance
- duration
- steps

Policy decides:

- aggregate distance
- highest distance
- daily completion
- streak completion

---

# 22. AI Ownership

Knowledge Items own:

- embeddings
- semantic tags
- recommendation metadata
- related concepts
- prerequisites
- progressions

AI systems consume this metadata.

They never create new canonical knowledge directly.

---

# 23. Historical Ownership

Historical truth belongs to runtime records.

Knowledge updates must never rewrite:

- Activity Events
- Workout Logs
- Challenge Instances
- Challenge Recaps

This aligns with the audit finding that current challenge snapshots are too dependent on the live catalogue and should instead preserve sufficient immutable context.

---

# 24. Migration Ownership

During migration:

- legacy IDs remain historical identifiers;
- canonical IDs become the new knowledge identifiers;
- alias mappings bridge old and new identities;
- historical runtime records continue referencing their original snapshots while being linkable to canonical knowledge through migration mappings.

Migration must not erase historical provenance.

---

# 25. Decision Rules

Whenever uncertainty exists:

1. Who owns this information?
2. Can another entity simply reference it?
3. Would duplication create future inconsistency?
4. Would changing one copy require changing another?
5. Can runtime reconstruct this from immutable records?

If duplication is required to preserve historical truth (for example, challenge snapshots), it must be explicit and intentional.

---

# 26. Governance Rules

Every new entity must define:

- ownership
- references
- lifecycle
- versioning
- migration behaviour
- historical behaviour
- AI behaviour

No new entity may duplicate responsibilities already owned elsewhere.

---

# 27. Version 2 Ownership Freeze

The following governance rules are frozen:

- Every concept has one authoritative owner.
- Knowledge defines; runtime records; projections calculate.
- Knowledge Items own taxonomy, content, metrics and safety.
- Challenge Policies own behavioural rules.
- Challenge Templates compose knowledge; they do not redefine it.
- Challenge Instances preserve immutable snapshots of the knowledge and policies they launched with.
- Activity Events and Workout Logs record facts, not knowledge.
- User Interests describe preferences, not executable activities.
- Derived projections must be rebuildable from immutable event data.
- Historical records must never be rewritten to reflect later knowledge changes.
- All future features must integrate with this ownership model rather than introducing parallel authorities.

---

# Phase 3A-5 Deliverable

With this document, Tiizi now has a constitutional ownership model for every major knowledge entity. It resolves the ambiguity highlighted in the repository audit around parallel vocabularies, duplicated interests, wellness overlaps and snapshot responsibilities.

The next phase becomes **Phase 3A-6 — Canonical Fitness Rationalisation**, where each legacy fitness record will be evaluated against this ownership model and the previously approved taxonomy, leading to evidence-based **Keep, Merge, Variant, Split, Reclassify, Restrict, Defer or Retire** decisions.
