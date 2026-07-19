# Phase_3A_6A_Canonical_Taxonomy_Freeze_Standard_v2

**Status:** Constitutional Knowledge Standard

**Purpose**

Freeze every controlled dictionary used by the Tiizi Fitness Knowledge Platform.

After approval, these dictionaries become the only permitted controlled values across:

- Knowledge Catalogue
- Admin Portal
- AI Recommendation Engine
- Challenge Engine
- Workout Builder
- Analytics
- Search
- User Interests
- APIs
- Future integrations

These values become governance artefacts, not implementation details.

---

# 1. Taxonomy Philosophy

A taxonomy is not simply a list.

A taxonomy defines the controlled language used throughout the platform.

Every controlled value must be:

- uniquely defined
- versioned
- stable
- reusable
- internationally understandable
- implementation independent

---

# 2. Canonical Controlled Dictionaries

Version 2 freezes the following dictionaries.

| Dictionary | Owner |
| --- | --- |
| Exercise Domains | Knowledge Platform |
| Exercise Families | Knowledge Platform |
| Exercise Sub-Families | Knowledge Platform |
| Movement Demands | Knowledge Platform |
| Equipment Types | Knowledge Platform |
| Muscle Groups | Knowledge Platform |
| Exercise Metrics | Knowledge Platform |
| Measurement Units | Knowledge Platform |
| Difficulty Levels | Knowledge Platform |
| Safety Tiers | Knowledge Platform |
| Impact Levels | Knowledge Platform |
| Technical Complexity | Knowledge Platform |
| Exercise Relationships | Knowledge Platform |
| User Interest Taxonomy | Knowledge Platform |
| Launch Classifications | Governance |

---

# 3. Exercise Domains

Frozen values

| ID | Domain |
| --- | --- |
| DOM-STRENGTH | Strength & Conditioning |
| DOM-CARDIO | Cardiovascular |
| DOM-MOBILITY | Mobility |
| DOM-FLEXIBILITY | Flexibility |
| DOM-BALANCE | Balance & Stability |
| DOM-POWER | Power & Athletic Movement |
| DOM-RECOVERY | Recovery |

Rules:

- one primary domain
- immutable IDs
- translated labels allowed
- IDs never translated

---

# 4. Exercise Families

Frozen values

```
Push

Pull

Squat

Hinge

Lunge

Step

Carry

Rotation

Anti-Rotation

Anti-Extension

Anti-Lateral Flexion

Locomotion

Cyclical Cardio

Jump & Plyometric

Throw

Balance

Mobility

Flexibility

Recovery
```

Exactly one primary family.

---

# 5. Exercise Sub-Families

Sub-families remain controlled.

Examples:

Horizontal Push

Vertical Push

Forward Lunge

Reverse Lunge

Walking

Running

Rowing

Hip Hinge

Romanian Hinge

Hip Extension

No free-text sub-families.

---

# 6. Secondary Movement Demands

Exercises may own optional secondary demands.

Examples

```
Push

Pull

Squat

Hinge

Rotation

Anti-Rotation

Anti-Extension

Anti-Lateral Flexion

Locomotion

Balance
```

These influence:

- recommendations
- AI
- substitutions
- programming

They do not change primary family.

---

# 7. Equipment Dictionary

Controlled equipment.

Examples

```
Bodyweight

Resistance Band

Dumbbell

Barbell

Kettlebell

Medicine Ball

Pull-up Bar

Chair

Bench

Step Platform

Cable Machine

TRX

Stability Ball

Foam Roller
```

Equipment becomes reusable metadata.

---

# 8. Muscle Dictionary

Muscles are descriptive.

Never taxonomic.

Examples

Primary

- Chest
- Back
- Shoulders
- Quadriceps
- Hamstrings
- Glutes
- Core

Secondary

- Triceps
- Biceps
- Calves
- Hip Flexors
- Forearms

Muscles never replace movement families.

---

# 9. Metric Dictionary

Canonical exercise metrics.

```
Repetitions

Hold Duration

Distance

Duration

Elevation

Load

Calories

Steps
```

Each exercise defines:

Primary Metric

Optional Secondary Metrics

---

# 10. Measurement Units

Controlled units.

```
repetitions

seconds

minutes

hours

metres

kilometres

miles

kilograms

pounds

steps
```

No synonyms.

Example

Not allowed

```
mins

min

minutes
```

Only

```
minutes
```

---

# 11. Difficulty Levels

Frozen.

```
Beginner

Intermediate

Advanced
```

No:

Easy

Hard

Expert

Extreme

These remain editorial descriptors if needed, not controlled values.

---

# 12. Safety Tiers

Controlled.

```
Low

Moderate

High

Restricted
```

Only one safety tier.

---

# 13. Impact Levels

Controlled.

```
Low Impact

Moderate Impact

High Impact
```

Used for recommendations.

---

# 14. Technical Complexity

Controlled.

```
Basic

Intermediate

Advanced

Expert
```

Separate from difficulty.

---

# 15. Relationship Types

Controlled graph relationships.

```
Progression

Regression

Alternative

Complementary

Prerequisite

Variation

Same Family

Similar Movement
```

Relationships become graph edges.

---

# 16. User Interest Taxonomy

This is a major correction.

The audit found multiple duplicated interest vocabularies.

Interests become their own governed taxonomy.

Examples

```
Strength Training

Running

Walking

Cycling

Swimming

Yoga

Pilates

Dance Fitness

HIIT

Outdoor Activities

Home Workouts

Group Fitness

Martial Arts

Racquet Sports

Team Sports
```

Notice these are programme interests.

Not exercises.

---

# 17. Launch Classification

Controlled.

```
Launch Core

Launch Extended

Future Pack

Specialist Pack

Restricted
```

---

# 18. Versioning

Every dictionary owns:

- version
- effective date
- governance owner
- deprecated values
- replacement values

Nothing disappears.

---

# 19. Deprecated Values

Example

```
Power

↓

Power & Athletic Movement
```

Old values remain aliases.

Never deleted.

---

# 20. Translation Rules

Only display labels translate.

IDs remain fixed.

Example

```
DOM-STRENGTH

English

Strength & Conditioning

French

Force et Conditionnement

Kirundi

…

ID remains

DOM-STRENGTH
```

---

# 21. Engineering Rules

Engineering never stores labels.

Engineering stores IDs.

Example

Store

```json
{
  "familyId":"FAM-PUSH"
}
```

Never

```json
{
  "family":"Push"
}
```

---

# 22. AI Rules

AI embeddings reference IDs.

Not labels.

This prevents multilingual drift.

---

# 23. Administration Rules

Admin users may:

- choose values

They may never:

- create values
- rename values
- delete values

Taxonomy changes require governance approval.

---

# 24. Quality Rules

Every controlled value must have:

- ID
- label
- description
- owner
- version
- status

No incomplete dictionary entries.

---

# 25. Governance Freeze

Version 2 freezes:

- Domains
- Families
- Sub-families
- Movement demands
- Equipment
- Muscles
- Metrics
- Units
- Difficulty
- Safety
- Impact
- Complexity
- Relationships
- Interests
- Launch classifications

No implementation may introduce uncontrolled values into these fields.

---

# Why this phase matters

This phase resolves one of the audit's most significant structural findings: the existence of competing taxonomies and duplicated vocabularies across the repository.

With the controlled dictionaries frozen, the catalogue review no longer depends on individual reviewer interpretation. Every exercise, workout, wellness activity and interest will be classified against a single approved vocabulary.

---
