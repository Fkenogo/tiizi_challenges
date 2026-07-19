# Tiizi_Unified_Taxonomy_Controlled_Dictionaries_v2

**Status:** Draft for Approval

**Authority:** Platform Governance Document

**Dependencies:**

- ✅ Fitness, Wellness & Challenge Knowledge Model v2
- ✅ Challenge Engine Audit
- ✅ Wellness Rationalisation Matrix
- ⏳ Fitness Rationalisation Matrix (next phase)

---

# 1. Purpose

This document establishes the **controlled vocabulary** for Tiizi.

Its purpose is to ensure that every activity, workout, challenge, template, report and API uses the same terminology and classification.

No runtime component should invent new categories, metrics or challenge behaviour outside this taxonomy.

The taxonomy is implementation-independent and serves as the canonical reference for engineering, content creation and administration.

---

# 2. Taxonomy Principles

Every controlled value must satisfy these principles:

- **Unique** – one concept has one canonical term.
- **Reusable** – usable across fitness, wellness and future domains.
- **Human-readable** – understandable to end users where appropriate.
- **Machine-friendly** – stable IDs that never depend on display labels.
- **Versioned** – changes occur through governance.
- **Extensible** – new values can be added without breaking existing data.

---

# 3. Entity Types

These are the primary knowledge entities.

| Entity | Purpose |
| --- | --- |
| Knowledge Item | Base entity for all catalogue content |
| Wellness Activity | Behaviour or health habit |
| Exercise | Physical movement |
| Exercise Variant | Controlled variation of an exercise |
| Workout | Structured sequence of exercises and/or activities |
| Workout Step | Individual element within a workout |
| Challenge Policy | Approved challenge behaviour |
| Challenge Template | Reusable launch configuration |
| Challenge Snapshot | Immutable launched challenge |
| Activity Event | Immutable user submission |
| Progress Projection | Current calculated progress |
| Leaderboard Projection | Current ranking |
| Challenge Recap | Final immutable summary |

---

# 4. Primary Domains

These are the highest-level classifications.

### Movement

Walking, running, cycling and general movement.

### Strength & Fitness

Resistance training, bodyweight training and athletic performance.

### Mobility & Flexibility

Joint mobility, stretching and range-of-motion activities.

### Cardio & Endurance

Cardiovascular conditioning.

### Recovery

Recovery practices following physical activity.

### Nutrition

Eating behaviours and nutrition-related habits.

### Hydration

Fluid intake and hydration practices.

### Sleep

Sleep quality, routines and recovery.

### Mindfulness & Mental Wellbeing

Meditation, breathing, reflection and emotional wellbeing.

### Healthy Habits

Daily behaviours that support long-term wellness.

### Social Wellbeing

Community, relationships and group participation.

### Health Tracking

Private tracking of measurements and health observations.

---

# 5. Families

Families are sub-classifications within each domain.

Examples include:

**Movement**

- Walking
- Running
- Cycling
- Hiking
- Wheelchair Mobility

**Strength**

- Push
- Pull
- Squat
- Hinge
- Carry
- Core

**Mobility**

- Dynamic Mobility
- Static Stretching
- Joint Mobility
- Balance

**Nutrition**

- Meal Planning
- Healthy Eating
- Time-Restricted Eating
- Fruit & Vegetables
- Protein
- Sugar Reduction

**Hydration**

- Water Intake
- Electrolytes

**Sleep**

- Bedtime Routine
- Sleep Duration
- Sleep Hygiene

**Mindfulness**

- Meditation
- Breathing
- Gratitude
- Journaling

**Health Tracking**

- Blood Pressure
- Blood Glucose
- Weight
- Heart Rate
- Medication Adherence

---

# 6. Exercise Types

Controlled values:

- Bodyweight
- Free Weight
- Machine
- Resistance Band
- Cable
- Cardio
- Mobility
- Stretch
- Balance
- Plyometric
- Functional
- Isometric

---

# 7. Wellness Types

Controlled values:

- Nutrition
- Hydration
- Sleep
- Recovery
- Mindfulness
- Behaviour
- Stress Management
- Social
- Health Tracking

---

# 8. Metrics

Only these metric types may be used.

### Completion

Completed / Not Completed

### Sessions

Number of completed sessions.

### Steps

Walking or movement.

### Distance

Linear distance.

### Duration

Time spent.

### Hold Duration

Static holds.

### Repetitions

Repetition count.

### Sets

Set count.

### Load

Weight lifted or resisted.

### Total Volume

Derived load.

### Calories

Energy expenditure (future).

### Heart Rate Zone Duration

Future wearable support.

### Scheduled Days

Habit adherence.

### Streak Days

Consecutive completions.

### Qualitative Check-In

Mood or wellbeing.

### Health Reading

Private health measurements.

No new metric types should be introduced without governance approval.

---

# 9. Units

Controlled units include:

Time:

- Seconds
- Minutes
- Hours

Distance:

- Metres
- Kilometres
- Miles

Count:

- Repetitions
- Sets
- Sessions
- Days
- Steps

Weight:

- Kilograms
- Pounds

Volume:

- Millilitres
- Litres

Percentage:

- Percent (internal calculations only)

---

# 10. Target Directions

Each metric uses one direction.

- Higher is Better
- Lower is Better
- Target Reached
- Completion Only
- Within Range
- Consistency

Sensitive health readings default to **Completion Only** or **Within Range**, never competitive ranking.

---

# 11. Difficulty Model

The previous single difficulty scale is replaced by multiple dimensions.

Each Knowledge Item defines:

- Physical Demand (1–5)
- Technical Complexity (1–5)
- Behavioural Commitment (1–5)
- Coordination Requirement (1–5)
- Impact Level (1–5)

This allows a long walk and a technically complex lift to be described accurately without forcing both into a single "Advanced" category.

---

# 12. Safety Tier

Every Knowledge Item receives one Safety Tier.

| Tier | Meaning |
| --- | --- |
| Low | Suitable for most users |
| Moderate | Basic caution advised |
| High | Increased injury or health risk |
| Restricted | Requires explicit restrictions or professional guidance |

---

# 13. Audience

Controlled audience tags:

- Beginner
- General Adult
- Older Adult
- Youth (where appropriate)
- Athlete
- Pregnancy Safe
- Limited Mobility
- Clinical Guidance Required

Multiple audience tags may apply.

---

# 14. Equipment

Controlled equipment values include:

- None
- Chair
- Wall
- Mat
- Resistance Band
- Dumbbell
- Barbell
- Kettlebell
- Medicine Ball
- Pull-Up Bar
- Stationary Bike
- Treadmill
- Rowing Machine

---

# 15. Movement Patterns

Controlled values:

- Push
- Pull
- Squat
- Hinge
- Carry
- Rotate
- Anti-Rotation
- Gait
- Jump
- Balance
- Crawl
- Reach

---

# 16. Goal Tags

Knowledge Items may support one or more goals.

Examples:

- Weight Management
- Strength
- Muscle Endurance
- Cardiovascular Fitness
- Mobility
- Flexibility
- Recovery
- Better Sleep
- Stress Reduction
- Mental Wellbeing
- Healthy Habits
- Hydration
- Nutrition

---

# 17. Challenge Types

Frozen platform challenge types:

- Collective
- Competitive
- Streak

No fourth type exists in Version 2.

---

# 18. Challenge Scope

Controlled values:

- Group
- Personal *(reserved for future implementation)*

---

# 19. Challenge Eligibility

Each Knowledge Item must declare eligibility for:

- Collective
- Competitive
- Streak
- Public
- Private
- Manual Logging
- Verification Required

This becomes the primary filter for the Challenge Wizard.

---

# 20. Verification Methods

Controlled values:

- Self Report
- Device
- Wearable
- Photo
- Administrator
- Partner System
- None Required

---

# 21. Ranking Strategies

Approved strategies:

- Highest Total
- Lowest Valid Time
- Highest Completion Percentage
- Earliest Completion
- Highest Consistency
- Greatest Personal Improvement

Only one strategy may apply to a Competitive challenge.

---

# 22. Completion Strategies

Controlled values:

- Shared Target Reached
- All Participants Complete
- Minimum Participants Complete
- Scheduled End
- Daily Predicate Complete
- Workout Completed

---

# 23. Aggregation Strategies

Approved aggregation methods:

- Sum
- Count Completions
- Count Participants
- Count Scheduled Days
- Equivalent Contribution

---

# 24. Cadence

Controlled values:

- Daily
- Weekly
- Monthly
- Selected Weekdays
- Custom Schedule

---

# 25. Privacy Classification

Controlled values:

- Public
- Group
- Personal
- Restricted

Health Tracking defaults to **Personal** unless explicitly approved otherwise.

---

# 26. Governance Status

Every managed record has one lifecycle state:

- Draft
- In Review
- Approved
- Published
- Deprecated
- Archived

---

# 27. Translation Status

Controlled values:

- Not Started
- In Progress
- Reviewed
- Approved

English is the source language. French is the supported translation language for Version 2.

---

# 28. Reserved Future Taxonomy

The following concepts are reserved but not implemented in Version 2:

- Personal Challenges
- Wearable Trust Scores
- Reward Points
- Achievement Badges
- Team Competitions
- Clinical Programmes
- Organisation-specific Knowledge Packs

---

# 29. Governance Rules

1. New taxonomy values require governance approval.
2. Existing IDs must never be repurposed.
3. Display labels may evolve; IDs remain stable.
4. Deprecated values remain readable for historical records.
5. Engineering must reference IDs, not display text.
6. User-facing copy must remain simple and avoid exposing implementation terminology such as "engine", "projection" or "ledger".

---

# Phase 2A Acceptance Criteria

This phase is complete when:

- Every catalogue record can be classified using only these controlled values.
- No runtime component requires ad hoc categories or metrics.
- Fitness and wellness share the same taxonomy where concepts overlap.
- Challenge policies reference only approved metrics, units and strategies.
- The taxonomy is sufficient to support the upcoming Challenge Compatibility Matrix and Fitness Catalogue Rationalisation.
