# Tiizi_Knowledge_Governance_Framework _v2

**Status:** Platform Governance Standard

**Purpose**

The Knowledge Governance Framework defines how the Tiizi Knowledge Catalogue is created, reviewed, approved, maintained, versioned and retired throughout the life of the platform.

If the Knowledge Catalogue Specification defines the structure of knowledge, the Knowledge Governance Framework defines the lifecycle of that knowledge.

---

# 1. Governance Philosophy

The Tiizi catalogue is treated as a managed knowledge asset rather than a static database.

Every published item must be:

- accurate
- understandable
- evidence-aware
- safe
- version-controlled
- reviewable
- auditable
- translatable
- maintainable

Knowledge is never "finished"; it is continuously governed.

---

# 2. Governance Principles

The framework is built on ten principles.

### Accuracy

Every published statement must reflect the current approved content.

---

### Safety

User wellbeing takes precedence over challenge flexibility or engagement.

---

### Consistency

Similar concepts are classified and described consistently across the catalogue.

---

### Transparency

Changes are documented and traceable.

---

### Version Integrity

Launched challenges always reference the version they were created with.

---

### Simplicity

Technical complexity is hidden from end users.

---

### Reusability

Knowledge is authored once and reused many times.

---

### Localisation

Translations preserve meaning, not just wording.

---

### Auditability

Every change has an identifiable author, reviewer and approval history.

---

### Continuous Improvement

The catalogue evolves through governance rather than ad hoc edits.

---

# 3. Governance Roles

Every change has clear ownership.

| Role | Responsibility |
| --- | --- |
| Knowledge Author | Creates or edits content |
| Fitness Reviewer | Reviews exercise accuracy |
| Wellness Reviewer | Reviews wellness guidance |
| Clinical Reviewer | Reviews sensitive health content |
| Translation Reviewer | Reviews multilingual content |
| Publisher | Approves publication |
| Platform Administrator | Manages governance workflows |
| Engineering | Implements approved models without changing meaning |

Engineering must not alter approved knowledge independently.

---

# 4. Record Lifecycle

Every Knowledge Item follows the same lifecycle.

```
Idea
   ↓
Draft
   ↓
Editorial Review
   ↓
Technical Review
   ↓
Safety Review (where required)
   ↓
Translation Review
   ↓
Approval
   ↓
Published
   ↓
Monitoring
   ↓
Revision or Deprecation
   ↓
Archived
```

Each transition is auditable.

---

# 5. Versioning Rules

Separate different types of change.

### Schema Version

Changes to the underlying data model.

### Content Version

Changes to wording, instructions, safety guidance or relationships.

### Policy Version

Changes to challenge behaviour.

### Translation Version

Changes to translated content.

### Publication Version

The approved release state.

This prevents minor wording updates from appearing as behavioural changes.

---

# 6. Change Classification

Every proposed change is classified.

### Editorial

Grammar, spelling, formatting.

### Educational

Improved explanations without changing intent.

### Behavioural

Changes to metrics, completion rules or challenge eligibility.

### Safety

New contraindications, warnings or restrictions.

### Structural

Taxonomy or relationship changes.

### Technical

Schema or metadata updates.

Different classifications require different review levels.

---

# 7. Review Requirements

| Change Type | Editorial | Fitness | Wellness | Clinical | Translation |
| --- | --- | --- | --- | --- | --- |
| Editorial | ✓ | – | – | – | Optional |
| Exercise Technique | ✓ | ✓ | – | – | Optional |
| Wellness Guidance | ✓ | – | ✓ | Optional | Optional |
| Sensitive Health Content | ✓ | ✓ | ✓ | ✓ | Optional |
| Translation | ✓ | Optional | Optional | – | ✓ |
| Challenge Behaviour | ✓ | ✓ | ✓ | Optional | – |

---

# 8. Evidence Management

Each Knowledge Item should reference evidence where appropriate.

Evidence levels:

- Expert Consensus
- Public Health Guidance
- Professional Association Guidance
- Peer-Reviewed Research
- Internal Platform Guidance

The goal is to support trustworthy content, not to overwhelm users with citations.

---

# 9. Localisation Governance

English is the source language.

French is the first supported translation.

Translations should preserve:

- intent
- safety
- readability
- cultural relevance

Translations should not introduce new meaning.

---

# 10. Relationship Governance

Relationships must remain valid.

Examples:

- Parent–variant relationships
- Workout composition
- Similar activities
- Progressions
- Regressions
- Substitutions

Changes to one item should trigger review of related items where necessary.

---

# 11. Deprecation Policy

Items are deprecated when:

- superseded
- unsafe
- duplicated
- obsolete
- replaced by better guidance

Deprecation does not remove historical references.

Launched challenges continue to reference the version they used.

---

# 12. Retirement Policy

Retirement is reserved for items that should no longer be available for new use.

Retired items:

- remain readable for historical reporting
- cannot be selected for new templates
- cannot appear in new challenges

---

# 13. Publication Quality Gates

Before publication, every record must pass:

- Identity validation
- Taxonomy validation
- Content validation
- Metric validation
- Challenge compatibility validation
- Behaviour mapping validation
- Translation validation
- Governance validation

Only records that pass every gate can become Published.

---

# 14. Audit Programme

Knowledge should be reviewed on a scheduled basis.

Suggested review cadence:

| Category | Review Interval |
| --- | --- |
| General fitness | 24 months |
| Wellness guidance | 18 months |
| Sensitive health content | 12 months |
| Challenge policies | 12 months |
| Taxonomy | 24 months |

Urgent safety updates may occur at any time.

---

# 15. Analytics Feedback Loop

Governance should consider operational signals such as:

- search failures
- frequently abandoned challenges
- misunderstood instructions
- support requests
- user feedback
- completion trends

Analytics inform review priorities but do not automatically change knowledge.

---

# 16. AI Governance

Future AI features must consume approved Knowledge Items.

AI may:

- recommend
- explain
- personalise
- summarise

AI must not:

- invent exercises
- modify challenge rules
- reinterpret safety guidance
- override governance decisions

This keeps AI aligned with the approved knowledge base.

---

# 17. Governance Metrics

Track the health of the catalogue itself.

Suggested KPIs:

- Published Knowledge Items
- Drafts awaiting review
- Average review time
- Translation completion rate
- Records requiring evidence updates
- Deprecated items awaiting replacement
- Taxonomy consistency score
- Duplicate detection rate
- Challenge policy reuse rate

These metrics support operational governance rather than user-facing reporting.

---

# 18. Governance Freeze

The following principles are adopted as platform policy:

- Knowledge is a governed product asset.
- Every published item follows the same lifecycle.
- Behavioural changes require versioning.
- Engineering implements approved knowledge rather than redefining it.
- Historical challenges remain linked to their original knowledge and policy versions.
- AI operates within the boundaries of governed knowledge.
- Catalogue quality is maintained through continuous review, not one-time cleanup.

---

# Governance Foundation Complete

With this document, the governance layer is complete. Together, these documents form the constitutional framework for Tiizi:

1. **Fitness, Wellness & Challenge Knowledge Model v2** — the overall architecture.
2. **Unified Taxonomy & Controlled Dictionaries** — the platform vocabulary.
3. **Challenge Compatibility Matrix** — the allowed combinations of activities and challenge types.
4. **Challenge Behaviour Framework** — the reusable execution behaviours.
5. **Knowledge Catalogue Specification** — the canonical structure of every Knowledge Item.
6. **Knowledge Governance Framework** — the lifecycle, review and stewardship of the catalogue.
