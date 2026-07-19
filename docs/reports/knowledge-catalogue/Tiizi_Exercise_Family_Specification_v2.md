# Tiizi_Exercise_Family_Specification_v2

**Status:** Foundational Knowledge Standard

**Purpose**

The Exercise Family Specification defines the canonical structure used to classify every exercise in the Tiizi Knowledge Catalogue.

It provides a stable taxonomy that supports content governance, challenge creation, search, recommendations, AI coaching, analytics and future expansion.

This specification applies only to **Exercises**. Wellness Activities and Workouts have their own classification frameworks.

---

# 1. Design Principles

The classification system is based on seven principles:

- Every exercise belongs to one primary family.
- Families represent movement intent, not muscle names.
- Variants inherit from a canonical parent exercise.
- An exercise may have multiple tags but only one primary family.
- Classification is independent of equipment whenever possible.
- Families remain stable even as new exercises are introduced.
- Human readability takes precedence over excessive granularity.

---

# 2. Classification Hierarchy

Every exercise follows the same hierarchy.

```
Exercise
    ↓
Domain
    ↓
Family
    ↓
Sub-Family
    ↓
Canonical Exercise
    ↓
Variant
```

Example:

```
Exercise
 ↓
Strength & Conditioning
 ↓
Push
 ↓
Horizontal Push
 ↓
Push-up
 ↓
Incline Push-up
```

This hierarchy prevents duplication and enables consistent inheritance.

---

# 3. Primary Exercise Domains

These are the highest-level categories.

### Strength & Conditioning

Exercises primarily intended to build strength, muscular endurance or power.

Examples:

- Push-up
- Squat
- Deadlift

---

### Cardiovascular

Exercises primarily focused on cardiovascular fitness and endurance.

Examples:

- Walking
- Running
- Cycling
- Rowing

---

### Mobility

Exercises intended to improve joint range of motion and movement quality.

Examples:

- Hip Mobility
- Thoracic Rotation

---

### Flexibility

Exercises focused on muscle length and stretching.

Examples:

- Hamstring Stretch
- Chest Stretch

---

### Balance & Stability

Exercises that improve control, coordination and postural stability.

Examples:

- Single-leg Balance
- Bird Dog

---

### Functional Movement

Exercises that replicate everyday movement patterns.

Examples:

- Farmer Carry
- Step-up
- Turkish Get-up

---

### Recovery

Exercises used for active recovery and restoration.

Examples:

- Gentle Walking
- Foam Rolling
- Recovery Stretch

---

# 4. Primary Movement Families

These become the canonical exercise families.

## Push

Examples:

- Push-up
- Bench Press
- Shoulder Press

---

## Pull

Examples:

- Pull-up
- Row
- Lat Pulldown

---

## Squat

Examples:

- Bodyweight Squat
- Goblet Squat
- Front Squat

---

## Hinge

Examples:

- Deadlift
- Romanian Deadlift
- Good Morning

---

## Lunge

Examples:

- Reverse Lunge
- Walking Lunge
- Split Squat

---

## Carry

Examples:

- Farmer Carry
- Suitcase Carry
- Overhead Carry

---

## Rotation

Examples:

- Russian Twist
- Cable Rotation
- Wood Chop

---

## Anti-Rotation

Examples:

- Pallof Press
- Dead Bug

---

## Locomotion

Examples:

- Walking
- Running
- Crawling

---

## Jump & Plyometric

Examples:

- Box Jump
- Broad Jump
- Jump Squat

---

## Balance

Examples:

- Single-leg Balance
- BOSU Balance

---

## Mobility

Examples:

- Hip CARs
- Shoulder CARs

---

## Flexibility

Examples:

- Static Stretch
- Dynamic Stretch

---

## Recovery

Examples:

- Foam Rolling
- Recovery Walk

---

# 5. Sub-Families

Families are further refined where useful.

## Push

Sub-families:

- Horizontal Push
- Vertical Push
- Incline Push
- Decline Push
- Isometric Push

---

## Pull

Sub-families:

- Horizontal Pull
- Vertical Pull
- Grip Pull

---

## Squat

Sub-families:

- Bilateral
- Unilateral
- Overhead
- Front Loaded

---

This level provides enough detail without becoming unwieldy.

---

# 6. Canonical Exercise Rules

Each family has one or more canonical exercises that act as parents.

Example:

```
Push-up
```

Parent of:

- Knee Push-up
- Incline Push-up
- Decline Push-up
- Diamond Push-up
- Wide Push-up

The parent defines the core movement concept; variants inherit from it and override only what differs.

---

# 7. Variant Classification

Variants should not be promoted to separate canonical exercises unless they represent a genuinely different movement pattern or training objective.

Variation types include:

- Difficulty
- Equipment
- Grip
- Stance
- Tempo
- Range of Motion
- Load Position
- Environment

This keeps the catalogue concise while still expressive.

---

# 8. Cross-Cutting Tags

In addition to their family, exercises receive reusable tags.

### Primary Muscles

Examples:

- Chest
- Back
- Quadriceps

### Secondary Muscles

### Movement Plane

- Sagittal
- Frontal
- Transverse

### Equipment

### Difficulty

### Impact Level

- Low
- Moderate
- High

### Indoor / Outdoor

### Individual / Partner

These tags support search, filtering and recommendations without changing the primary classification.

---

# 9. Family Relationships

Families are related but distinct.

Examples:

- Push ↔ Pull (complementary)
- Squat ↔ Lunge (related lower-body patterns)
- Mobility ↔ Recovery (often paired)
- Balance ↔ Functional Movement (frequently combined)

These relationships will later feed the Knowledge Relationship Graph and AI recommendations.

---

# 10. Expansion Rules

New exercise families may only be introduced when:

- they represent a genuinely distinct movement pattern,
- they cannot reasonably fit within an existing family,
- they improve clarity rather than increase complexity,
- and they are approved through the Knowledge Governance Framework.

This avoids taxonomy drift.

---

# 11. Classification Examples

| Exercise | Domain | Family | Sub-Family | Canonical Parent |
| --- | --- | --- | --- | --- |
| Push-up | Strength & Conditioning | Push | Horizontal Push | Push-up |
| Knee Push-up | Strength & Conditioning | Push | Horizontal Push | Push-up |
| Incline Push-up | Strength & Conditioning | Push | Incline Push | Push-up |
| Walking | Cardiovascular | Locomotion | Walking | Walking |
| Romanian Deadlift | Strength & Conditioning | Hinge | Bilateral Hinge | Deadlift |
| Bird Dog | Balance & Stability | Anti-Rotation | Core Stability | Bird Dog |

---

# 12. Engineering Implications

The engineering model should:

- store a reference to the primary family rather than free text,
- support inheritance from canonical parent exercises,
- expose tags as structured metadata,
- keep family definitions versioned and centrally governed.

This ensures that search, recommendations, challenge creation and analytics all rely on the same classification model.

---

# Governance Freeze

The following principles are frozen for Version 2:

- Every exercise has one primary family.
- Canonical parent exercises are the source of truth for their variants.
- Families represent movement intent rather than individual muscles.
- Variants inherit from parents instead of duplicating content.
- Cross-cutting tags complement, but never replace, the primary family classification.
- New families require governance approval.
