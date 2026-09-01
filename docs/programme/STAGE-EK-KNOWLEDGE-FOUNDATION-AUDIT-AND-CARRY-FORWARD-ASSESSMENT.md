# Stage EK — Knowledge Foundation Audit & Carry-Forward Assessment

## Document Control

| Field             | Value                                                    |
| ----------------- | -------------------------------------------------------- |
| Programme         | Tiizi Version 2                                          |
| Stage             | Stage EK — Knowledge Governance                          |
| Document type     | Audit and carry-forward assessment (supporting evidence) |
| Status            | **Complete**                                             |
| Report date       | 2026-09-01                                               |
| Governed baseline | `a4a26be9e10df1c818874874dae2823629bd2ffd`               |
| Master Programme  | [v1.42](TIIZI-V2-MASTER-PROGRAMME.md)                    |

**This report is supporting evidence. It does not approve Knowledge Assets, create Knowledge Authority, or draft EKG-01.**

---

## 1. Executive Conclusion

**Stage EK does NOT start from zero.** A substantial body of knowledge architecture, modelling, and content-governance work already exists across four evidence layers:

- **L1 (Current Governing Authority):** EOG-03 (Constitutional Governance of Platform Knowledge), Knowledge Asset Domain Standard, CGP-01–CGP-04 constitutional principles.
- **L2 (V2 Programme Decision Evidence):** 29 knowledge catalogue reports reviewed through the Knowledge Corpus Traceability Appendix; Entity Ownership Register with Knowledge domain entries; Master Programme Stage EK mandate.
- **L3 (V1/Historical Design Evidence):** 154-exercise clean catalogue; Wellness template system; Challenge composition model; exercise family specifications; taxonomy proposals; lifecycle proposals.
- **L4 (Implementation Evidence):** Source code types (CatalogExercise, ExerciseMetric, WellnessTemplate); Firestore schema; seed data; challenge template administration.

**Core findings:**

1. The **Knowledge Asset concept** is well-defined constitutionally (Domain Standard §2) and distinct from runtime representations, interests, goals, preferences, policy, and challenges.
2. **EOG-03 §7 already establishes Exercise Asset and Wellness Activity Asset as primary Platform Knowledge Asset classes.** This is class-level authority — Stage EK does not need to re-decide whether Exercise and Wellness Activity are Knowledge Assets. Stage EK must determine the disposition of specific instance baselines.
3. **154 exercises** exist in a clean catalogue with rich structure (metrics, units, muscles, breathing, form cues, safety notes, progressions). These are candidate instances of the Exercise Asset class.
4. **67 rationalised Wellness Activities** exist across **10 Wellness categories**. The categories are classification metadata; the 67 activities are candidate instances of the Wellness Activity Asset class.
5. The **single Runtime Catalogue Authority** principle is established (KNW-01).
6. **Fitness and Wellness** are the approved launch domains (EOG-03).
7. A **16-type metric taxonomy** exists as proposed V2 evidence (Draft for Approval) — substantially richer than the 3 runtime metric types. Stage EK must determine the governed metric catalogue.
8. **Substantial taxonomy/family work** exists (7 Exercise Domains, 19 Exercise Families) as proposed V2 evidence.
9. Most detailed governance (taxonomy approval, lifecycle, Knowledge Authority allocation, stewardship) remains **deferred** — these are genuine Stage EK decisions.
10. **No blocking contradictions** exist between the historical knowledge work and current constitutional authority.
11. **Knowledge Authority** (EK-FQ-01) and **Accountable Steward** (EK-FQ-02) are issues EKG-01 must resolve internally — no separate prior Founder decision is required before EKG-01 drafting.

**Recommendation:** Proceed with a **single integrated instrument (EKG-01)** covering Knowledge Governance Foundation, Knowledge Asset Identity & Classification, Authoritative Meaning & Knowledge Authority, Knowledge Structure/Metrics/Units, Knowledge Change/Integrity, and Knowledge-to-Product Boundary.

---

## 2. Audit Scope

| Dimension                | Sources reviewed                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------- |
| Constitutional authority | PC-01, PAM-01, CGP-01, CGP-02, CGP-03, CGP-04, Constitutional Ontology                            |
| Entity governance        | EOG-01 through EOG-05, Entity Ownership Register, Entity Ownership Decision Gaps                  |
| Knowledge governance     | EOG-03 approved standard, Knowledge Asset Domain Standard, Knowledge Corpus Traceability Appendix |
| Knowledge catalogue      | 29 reports in docs/reports/knowledge-catalogue/                                                   |
| Exercise catalogue       | catalogExercises_CLEAN.json (154 exercises, 12,341 lines)                                         |
| Source code types        | src/types/index.ts (CatalogExercise, ExerciseMetric, WellnessTemplate)                            |
| Architecture             | docs/architecture/, docs/TIIZI_TECHNICAL_SPECIFICATION_CLEAN_BUILD.md                             |
| Programme                | Master Programme v1.42, Stage EK mandate                                                          |

**Files materially reviewed:** ~650+ (governance docs, knowledge reports, source types, catalogue data)

---

## 3. Authority / Evidence Layers

| Layer                                   | Description                                                               | Examples                                                                                      | Weight for Stage EK                                            |
| --------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **L1 — Current Governing Authority**    | Approved constitutional/governance instruments with constitutional effect | EOG-03, Knowledge Asset Domain Standard, CGP-01–CGP-04, FLD-01                                | **Binding** — Stage EK must not contradict                     |
| **L2 — V2 Programme Decision Evidence** | Accepted V2 programme decisions, controlled current-state evidence        | Entity Ownership Register, Master Programme, D17, EOG-05 inventory                            | **Authoritative** — carries forward programme decisions        |
| **L3 — V1/Historical Design Evidence**  | Earlier architecture, specifications, product decisions                   | 29 knowledge catalogue reports, exercise catalogue, family specifications, taxonomy proposals | **Candidate for carry-forward** — must be tested against L1/L2 |
| **L4 — Implementation Evidence**        | Code, schemas, Firestore documents, scripts, tests                        | Source types, Firestore rules, seed data, admin screens                                       | **Evidence only** — does not establish governance authority    |

---

## 4. Knowledge Corpus Map

### 4.1 Governance Knowledge Corpus (29 artefacts)

| Family                             | Count | Key artefacts                                                                                                                 |
| ---------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------- |
| Current-state/legacy discovery     | 4     | Legacy fitness inventory (369 source rows), source register, discovery report, duplicate signals                              |
| Unified knowledge/catalogue models | 3     | Fitness/Wellness/Challenge Knowledge Model, Knowledge Catalogue Specification, Reference Knowledge Object                     |
| Governance/ownership/lifecycle     | 4     | Knowledge Governance Framework, Knowledge Ownership Entity Boundaries, Knowledge Object Lifecycle, Knowledge Capability Layer |
| Taxonomy/controlled dictionaries   | 2     | Unified Taxonomy/Controlled Dictionaries, Taxonomy Freeze Standard                                                            |
| Fitness rationalisation/catalogue  | 3     | Canonical Fitness Rationalisation, Canonical Fitness Knowledge Catalogue, Exercise Family Specification                       |
| Exercise families/variants         | 2     | Canonical Exercise Families, Family Specification                                                                             |
| Authoring/editorial/safety         | 2     | Exercise Authoring Standards/Style Guide, Fitness Knowledge Production                                                        |
| Reference assets/templates         | 2     | Reference Knowledge Asset 001, RKA-001 Push-up                                                                                |
| Graph/ontology/relationships       | 2     | Knowledge Graph Relationship Framework, Knowledge Graph Ontology v2                                                           |
| Challenge behavior/compatibility   | 2     | Challenge Behaviour Framework, Challenge Compatibility Matrix                                                                 |
| Recommendations/personalization    | 1     | AI Recommendation Decision Framework                                                                                          |
| Wellness rationalisation           | 1     | Wellness Catalogue Rationalisation Matrix                                                                                     |
| Production programmes              | 1     | Stage 4 Knowledge Production Programme                                                                                        |

### 4.2 Exercise Catalogue (L3/L4)

| Attribute       | Value                                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Total exercises | 154                                                                                                                                  |
| Metric types    | time:seconds (102), reps:reps (49), time:minutes (3)                                                                                 |
| Body categories | Core (68), Lower Body (44), Full Body (23), Upper Body (19)                                                                          |
| Movement types  | isometric (75), isotonic (53), unspecified (26)                                                                                      |
| Rich structure  | description, setup, execution, breathing, formCues, commonMistakes, progressions, advancedVariations, safetyNotes, recommendedVolume |

### 4.3 Wellness Template System (L4)

| Attribute          | Value                                                                                                       |
| ------------------ | ----------------------------------------------------------------------------------------------------------- |
| Categories         | 10 (fasting, hydration, sleep, mindfulness, nutrition, habits, stress, social, movement, health-monitoring) |
| Activity structure | activityId, activityType, metricUnit, targetValue, targetType (daily/cumulative), frequency                 |
| Challenge types    | collective, competitive, streak                                                                             |
| Difficulty levels  | beginner, intermediate, advanced, expert                                                                    |

---

## 5. Reconstructed Historical Knowledge Model

### What was established

**A. Knowledge Asset concept:** A governed unit of Knowledge with distinct identity, canonical meaning, declared authority and defined relationships. Supports Activities, Metrics, Units, guidance, relationships, safety information. (Domain Standard §2 — **L1**)

**B. Exercise modelling:** Each exercise has: unique ID, name, body category (tier_1), discipline (tier_2), difficulty, muscles targeted, equipment, training goals, metric (type + unit), description, setup steps, execution steps, breathing pattern, form cues, common mistakes, progressions, advanced variations, safety notes, recommended volume by level, tags, movement type. (**L3/L4**)

**C. Wellness Activity modelling:** Categories (fasting, hydration, sleep, etc.) with activities referencing exercise IDs, metric units, target values, target types (daily/cumulative), frequency, and points. (**L4**)

**D. Exercise ↔ Wellness Activity relationship:** Wellness Activities reference exercise IDs. Exercises provide the canonical knowledge; Wellness templates compose exercises into structured programmes. (**L3/L4**)

**E. Common abstraction:** Both Exercise and Wellness Activity share: identity, metric (type + unit), target/goal, difficulty, category, description. The Domain Standard treats both as potential Knowledge Assets under a unified model. (**L1/L3**)

**F. Activity identity vs. target:** Activity identity (what the exercise IS) is separate from target (what the participant aims to achieve). An activity has a metric type and unit; a challenge sets a target value using that metric. (**L1/L4**)

**G. Metrics modelled:** Two primary metric types — time (seconds/minutes) and reps. Each exercise declares its metric type and unit. `allowCustomUnit` flag exists. (**L3/L4**)

**H. Units modelled:** seconds, minutes, reps. No conversion rules documented. No cross-metric compatibility rules. (**L4**)

**I. Canonical identity:** Exercise IDs are stable string identifiers (e.g., "plank-forearm-plank"). The Domain Standard requires canonical identity for Knowledge Assets. The catalogue provides de facto canonical IDs but without governed authority. (**L3/L4**)

**J. Aliases/variants:** The duplicate-and-overlap signals report identifies possible aliases, variants, and Fitness/Wellness overlaps. No formal alias/variant model approved. (**L3**)

**K. Challenge Templates ↔ Knowledge:** Templates reference activities by ID. Template creation selects from existing exercises. Templates add challenge-specific configuration (targets, duration, rules) without modifying the underlying exercise knowledge. (**L4**)

**L. Challenge Wizard:** A product mechanism for composing challenges from templates and exercises. Not a Knowledge Asset — it is a composition/creation mechanism. (**L4**)

**M. Challenge creation:** Selects canonical knowledge (exercises) and adds challenge-specific policy (targets, rules, duration). Does not create new Knowledge Assets. (**L4**)

**N. Groups ↔ canonical knowledge:** Groups create challenges that reference canonical exercises. No evidence of Groups modifying or forking canonical knowledge. Group customization operates at the challenge/policy level, not the knowledge level. (**L4**)

**O. Interests/Goals/Preferences:** Modelled as profile/discovery metadata. Interests reference exercise IDs. Goals are challenge-level targets. Preferences are user settings. The Domain Standard explicitly excludes these from Knowledge Asset definition. (**L1/L4**)

**P. Discovery/filtering:** Uses tier_1 (body category), musclesTargeted, trainingGoals, tags, difficulty. These are classification metadata, not Knowledge Assets. (**L4**)

**Q. Technical storage:** Exercises stored as JSON documents. Firestore collections for exercises, wellness templates, wellness logs. Seed data from catalogExercises_CLEAN.json. (**L4**)

**R. Seeding/migration:** catalogExercises_CLEAN.json serves as seed data. No governed publication lifecycle. No versioning. No approval workflow for catalogue changes. (**L4**)

**S. Authority/stewardship assumptions:** Historical work assumed platform-level authority over knowledge. No formal Knowledge Authority allocation. No steward appointed. KNW-01 establishes the Runtime Catalogue Authority boundary but does not name the holder. (**L2/L3**)

**T. Modification lifecycle:** No approved lifecycle. The Knowledge Object Lifecycle Standard (Phase 4 0A) proposes draft→review→publication→change→deprecation→archive but is not approved governance. (**L3**)

**U. Retirement/versioning:** No approved model. The corpus proposes versioning and deprecation concepts but defers all decisions. (**L3**)

**V. Unresolved questions (explicitly recorded):**

- Taxonomy content and freeze status
- Exercise family dictionary and assignments
- Compatibility decisions (which exercises work in which challenges)
- Knowledge lifecycle states and transitions
- Knowledge Authority holder
- Steward allocation
- Publication workflow
- Wellness rationalisation decisions (keep/merge/variant/reclassify/retire)
- Record specification
- Runtime projection contract

---

## 6. Concept Evolution

| Concept            | Earliest representation                | Later refinement                                               | Current constitutional relationship                   | Stage EK implication                                          |
| ------------------ | -------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------- |
| Exercise           | V1 fitness catalogue (369 source rows) | Clean catalogue (154 exercises), rich specification            | Candidate Knowledge Asset (Domain Standard §2)        | Must be formally classified as Knowledge Asset or not         |
| Wellness Activity  | V1 wellness content                    | 10-category template system                                    | Candidate Knowledge Asset (Domain Standard)           | Must be formally classified; boundary with Exercise clarified |
| Metric             | Exercise metric field (type + unit)    | Governed measurement dimension (Domain Standard §8, §11, §13)  | Distinct governed concept                             | Must define metric catalogue and compatibility rules          |
| Unit               | seconds, minutes, reps                 | Governed expression of a Metric (Domain Standard §8, §11, §13) | Distinct governed concept                             | Must define unit catalogue and conversion rules               |
| Knowledge Asset    | Proposed in V1 knowledge programme     | Constitutionally defined (Domain Standard §2)                  | Approved constitutional concept                       | Must classify actual assets                                   |
| Challenge Template | V1 challenge creation                  | Composition mechanism referencing exercises                    | Not a Knowledge Asset (composition mechanism)         | Boundary with Knowledge must be explicit                      |
| Interest           | V1 profile metadata                    | Discovery/filtering metadata                                   | Not a Knowledge Asset (Domain Standard §2 exclusions) | Keep as profile/discovery metadata                            |
| Goal               | V1 challenge target                    | Challenge-level target                                         | Not a Knowledge Asset unless separately governed      | Keep as challenge/profile concept                             |
| Canonical Identity | Exercise string IDs                    | Constitutional requirement (Domain Standard)                   | Required for Knowledge Assets                         | Must govern ID allocation and stability                       |
| Runtime Catalogue  | V1 seed data / Firestore               | Single governed authority (KNW-01, Domain Standard §4)         | Constitutional principle                              | Must separate from rich Knowledge                             |

---

## 7. Constitutional Compatibility

| Earlier concept                                | Compatible with current authority?                                     | Notes                                        |
| ---------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------- |
| Knowledge Asset definition                     | **YES** — Domain Standard is L1 authority                              | Well-defined, consistent with EOG-03         |
| Exercise as Knowledge Asset candidate          | **YES** — consistent with Domain Standard §2                           | 154 exercises are strong candidates          |
| Wellness Activity as Knowledge Asset candidate | **YES** — consistent with Domain Standard                              | 10 categories with activities are candidates |
| Single Runtime Catalogue Authority             | **YES** — KNW-01, Domain Standard §4                                   | Constitutional principle                     |
| Fitness/Wellness as launch domains             | **YES** — EOG-03                                                       | Approved                                     |
| Metric/Unit as governed concepts               | **YES** — Domain Standard §8, §11, §13                                 | Well-defined                                 |
| Exercise families/variants                     | **YES** — constitutional family/variant boundary incorporated (EOG-03) | Dictionary and assignments deferred          |
| Challenge composition from knowledge           | **YES** — Constitutional Composition doctrine (EOG-03)                 | Templates compose, don't modify              |
| Interest/Goal/Preference as non-Knowledge      | **YES** — Domain Standard §2 exclusions                                | Explicitly excluded                          |
| Knowledge lifecycle (proposed)                 | **PENDING** — KNW-02, KNW-03 deferred                                  | Concepts sound but not approved              |
| Knowledge Authority holder                     | **PENDING** — not allocated                                            | Stage EK must determine                      |
| Steward allocation                             | **PENDING** — not allocated                                            | Stage EK must determine                      |

**No blocking contradictions found.** All major historical knowledge concepts are compatible with current constitutional authority.

---

## 8. Carry-Forward Hypothesis Results

| ID  | Hypothesis                                                                                                     | Result        | Evidence                                                                                                      |
| --- | -------------------------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------- |
| H1  | Exercise is a candidate primary canonical Knowledge Asset                                                      | **SUPPORTED** | Domain Standard §2 defines Knowledge Asset; 154 exercises with rich structure; EOG-03 Fitness domain          |
| H2  | Wellness Activity is a candidate primary canonical Knowledge Asset                                             | **SUPPORTED** | Domain Standard; 10 Wellness categories; EOG-03 Wellness domain                                               |
| H3  | Activity identity is separate from target                                                                      | **SUPPORTED** | Domain Standard distinguishes Activity from Challenge/Policy; source types separate exercise from targetValue |
| H4  | Metrics and units belong to governed knowledge but are not activity identity                                   | **SUPPORTED** | Domain Standard §8, §11, §13 define Metric and Unit as distinct governed concepts                             |
| H5  | Challenge Templates are not canonical Knowledge Assets merely because they reference them                      | **SUPPORTED** | Templates are composition mechanisms (EOG-03 Constitutional Composition); Domain Standard excludes them       |
| H6  | Challenge Wizard is a composition/creation mechanism, not a Knowledge Asset                                    | **SUPPORTED** | Product mechanism; no governance authority                                                                    |
| H7  | Interests, Goals and Preferences support discovery and are not primary Knowledge Assets                        | **SUPPORTED** | Domain Standard §2 explicitly excludes Interest, Goal (unless separately governed), preference                |
| H8  | A Group may customize challenge parameters without modifying/forking canonical Knowledge Asset identity        | **SUPPORTED** | Challenge composition doctrine (EOG-03); no evidence of Group knowledge modification                          |
| H9  | Existing catalogues contain useful V2 knowledge evidence and should be reconciled rather than blindly reseeded | **SUPPORTED** | 154 exercises with rich structure; 29 corpus artefacts reviewed; Knowledge Corpus Traceability Appendix       |
| H10 | Existing Firestore representation is implementation evidence rather than Knowledge Governance authority        | **SUPPORTED** | Domain Standard §4 distinguishes Runtime Catalogue from Knowledge; L4 ≠ L1                                    |

---

## 9. Candidate Knowledge Asset Inventory

| #   | Candidate              | Source                                                    | Historical role                                                                     | Current authority status                                            | Canonical identity needed? | Authoritative meaning needed? | Metrics/units? | Lifecycle needed? |
| --- | ---------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------- | ----------------------------- | -------------- | ----------------- |
| 1   | Exercise (Fitness)     | Catalogue (154), Domain Standard                          | Primary knowledge content; EOG-03 §7 establishes Exercise Asset class               | L1 class established (EOG-03 §7); 154 instances require disposition | YES                        | YES                           | YES            | YES               |
| 2   | Wellness Activity      | Catalogue (67 activities, 10 categories), Domain Standard | Wellness knowledge content; EOG-03 §7 establishes Wellness Activity Asset class     | L1 class established (EOG-03 §7); 67 instances require disposition  | YES                        | YES                           | YES            | YES               |
| 3   | Metric (type)          | Domain Standard §8, §11, §13; source types                | Measurement dimension                                                               | L1 concept defined                                                  | YES                        | YES                           | N/A            | YES               |
| 4   | Unit                   | Domain Standard §8, §11, §13; source types                | Measurement expression                                                              | L1 concept defined                                                  | YES                        | YES                           | N/A            | YES               |
| 5   | Exercise Family        | Corpus proposals, Domain Standard                         | Exercise grouping                                                                   | Concept incorporated; dictionary deferred                           | YES                        | YES                           | N/A            | YES               |
| 6   | Body Category (tier_1) | Catalogue, source types                                   | Classification metadata                                                             | L4 only                                                             | MAYBE                      | MAYBE                         | N/A            | MAYBE             |
| 7   | Training Goal          | Catalogue, source types                                   | Classification metadata                                                             | L4 only                                                             | MAYBE                      | MAYBE                         | N/A            | MAYBE             |
| 8   | Muscle Group           | Catalogue, source types                                   | Classification metadata                                                             | L4 only                                                             | MAYBE                      | MAYBE                         | N/A            | MAYBE             |
| 9   | Equipment Type         | Catalogue, source types                                   | Classification metadata                                                             | L4 only                                                             | MAYBE                      | MAYBE                         | N/A            | MAYBE             |
| 10  | Difficulty Level       | Catalogue, templates                                      | Classification metadata                                                             | L4 only                                                             | MAYBE                      | MAYBE                         | N/A            | MAYBE             |
| 11  | Movement Type          | Catalogue                                                 | Classification metadata                                                             | L4 only                                                             | MAYBE                      | MAYBE                         | N/A            | MAYBE             |
| 12  | Wellness Category      | Templates (10 categories)                                 | Classification metadata for Wellness Activities; NOT a Knowledge Asset (EOG-03 §17) | L4 classification metadata                                          | MAYBE                      | MAYBE                         | N/A            | MAYBE             |

**Note:** Items 6–12 are classification metadata that MAY become controlled vocabulary Knowledge Assets or MAY remain as product/discovery metadata. This is a genuine Stage EK decision. Wellness Categories (item 12) are explicitly excluded from Platform Knowledge Assets by EOG-03 §17 but may become governed taxonomy.

---

## 10. Metrics & Units Reconstruction

### Current state

**Runtime implementation (L4):** 3 metric types in the live catalogue:

| Metric type | Unit    | Exercise count | Examples                    |
| ----------- | ------- | -------------- | --------------------------- |
| time        | seconds | 102            | Plank, Wall Sit, High Knees |
| time        | minutes | 3              | Walking, Running, Cycling   |
| reps        | reps    | 49             | Push-up, Squat, Lunges      |

**Proposed V2 taxonomy (L3 — Draft for Approval):** The Unified Taxonomy Controlled Dictionaries propose 16 metric types: completion, sessions, repetitions, sets, holdDuration, activeDuration, distance, steps, load, totalVolume, calories, heartRateZoneDuration, streakDays, scheduledDaysCompleted, qualitativeCheckIn, trackedReading. Source: `Tiizi_Unified_Taxonomy_Controlled_Dictionaries_v2.md`. Status: "Draft for Approval" — NOT approved governance.

### What exists

- Each exercise declares ONE metric type and ONE default unit (runtime)
- `allowCustomUnit` boolean exists in source types
- No conversion rules (seconds ↔ minutes implied but not governed)
- No cross-metric compatibility rules
- No metric catalogue as a governed document

### What is deferred

- Formal metric catalogue (16-type proposal requires Stage EK disposition)
- Unit catalogue with conversion rules
- Metric/Unit compatibility matrix (which metrics can use which units)
- Activity-specific metric restrictions
- Aggregation semantics (how to sum time vs. reps)
- Display vs. canonical unit rules

### Compatibility observation

The current runtime model is simple: each exercise has one metric. The proposed V2 model is substantially richer. Stage EK must determine the governed metric catalogue by reconciling the runtime evidence with the proposed taxonomy.

---

## 11. Challenge Composition Boundary

```
Knowledge Asset (Exercise/Wellness Activity)
    ↓ referenced by
Challenge Template
    ↓ composed with policy
Challenge (Group-created)
    ↓ configured with
Target / Configuration
```

| Layer                      | Canonical?          | Customizable by Group?          | Governance          |
| -------------------------- | ------------------- | ------------------------------- | ------------------- |
| Knowledge Asset (Exercise) | YES (when approved) | NO — knowledge meaning is fixed | Knowledge Authority |
| Challenge Template         | Product mechanism   | Template selection              | Product governance  |
| Challenge                  | Group-created       | YES — targets, rules, duration  | Group + Policy      |
| Target/Configuration       | Challenge-specific  | YES                             | Policy              |

**Key finding:** Challenge creation references canonical knowledge but does not modify it. The Constitutional Composition doctrine (EOG-03) governs this boundary. No historical evidence of accidental knowledge duplication in challenge creation.

---

## 12. Group / Knowledge Boundary

| Question                                   | Historical intent | Current governance                           | Stage EK decision needed? |
| ------------------------------------------ | ----------------- | -------------------------------------------- | ------------------------- |
| Can Groups create challenges?              | YES               | EOG-02, EOG-04                               | No — already established  |
| Can Groups create custom activities?       | No evidence       | Not established                              | YES — if needed           |
| Can Groups modify canonical knowledge?     | No evidence       | Not permitted (Knowledge Authority boundary) | No — boundary clear       |
| Can Groups fork canonical knowledge?       | No evidence       | Not permitted                                | No — boundary clear       |
| Can Groups customize challenge parameters? | YES               | EOG-04                                       | No — already established  |
| Private vs. shared knowledge?              | No evidence       | Not established                              | YES — if needed           |

---

## 13. Discovery / Personalisation Boundary

| Concept           | What it is                                | Knowledge Asset?                | Stage EK treatment        |
| ----------------- | ----------------------------------------- | ------------------------------- | ------------------------- |
| Interest          | Profile metadata referencing exercise IDs | NO (Domain Standard exclusion)  | Keep as profile/discovery |
| Goal              | Challenge-level target or personal target | NO (unless separately governed) | Keep as challenge/profile |
| Preference        | User settings                             | NO (Domain Standard exclusion)  | Keep as profile data      |
| Category (tier_1) | Exercise classification                   | MAYBE (controlled vocabulary?)  | Stage EK decision         |
| Tag               | Exercise metadata                         | MAYBE (controlled vocabulary?)  | Stage EK decision         |
| Recommendation    | Product logic using knowledge             | NO (product mechanism)          | Keep as product logic     |
| Filter            | Product UI using classification           | NO (product mechanism)          | Keep as product UI        |

**Key finding:** Interests, Goals, and Preferences are clearly NOT Knowledge Assets. They are profile/discovery metadata that reference Knowledge Assets. The boundary is explicit in the Domain Standard.

---

## 14. Knowledge Authority & Stewardship

| Question                                         | Current state   | Stage EK decision needed?       |
| ------------------------------------------------ | --------------- | ------------------------------- |
| Who holds Knowledge Authority?                   | NOT ALLOCATED   | YES — genuine Stage EK decision |
| Who is Accountable Steward for Knowledge?        | NOT ALLOCATED   | YES — genuine Stage EK decision |
| Who is Custodian of knowledge content?           | NOT ALLOCATED   | YES                             |
| Who administers knowledge changes?               | NOT ALLOCATED   | YES                             |
| Who operates the Runtime Catalogue?              | NOT ALLOCATED   | YES                             |
| Does Group creator hold any knowledge authority? | NOT ESTABLISHED | YES — if applicable             |

**CGP-04 relationship:** CGP-04 preserves these as UNALLOCATED. The Entity Ownership Register marks Knowledge Asset stewardship as "Pending founder decision." Stage EK must make these allocations.

---

## 15. Change / Lifecycle Governance

| Lifecycle stage | Historical proposal                   | Current authority | Stage EK status           |
| --------------- | ------------------------------------- | ----------------- | ------------------------- |
| Creation        | Draft → Review → Publication proposed | NOT APPROVED      | Genuine Stage EK decision |
| Approval        | Founder/Authority approval proposed   | NOT APPROVED      | Genuine Stage EK decision |
| Editing         | Authoring standards proposed          | NOT APPROVED      | Genuine Stage EK decision |
| Versioning      | Version model proposed (KNW-02)       | DEFERRED          | Genuine Stage EK decision |
| Retirement      | Deprecation/archive proposed (KNW-03) | DEFERRED          | Genuine Stage EK decision |
| Deletion        | Not proposed                          | NOT ESTABLISHED   | Stage EK decision         |
| Migration       | Seed data exists                      | L4 only           | Stage EK may govern       |

**Key finding:** No lifecycle governance is approved. The historical proposals are conceptually sound but require Stage EK approval. CGP-02 amendment discipline applies to substantive knowledge changes.

---

## 16. Carry-Forward Register

| ID    | Finding                                                                      | Classification                                      | Rationale                                                                     |
| ----- | ---------------------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------- |
| CF-01 | Knowledge Asset constitutional definition                                    | **A — CARRY FORWARD**                               | L1 authority (Domain Standard). Well-defined, compatible, binding.            |
| CF-02 | 154-exercise catalogue as candidate Knowledge Assets                         | **B — CARRY FORWARD WITH GOVERNANCE FORMALIZATION** | Strong candidates but need formal classification by Knowledge Authority.      |
| CF-03 | Wellness 10-category template system                                         | **B — CARRY FORWARD WITH GOVERNANCE FORMALIZATION** | Strong candidates but need formal classification.                             |
| CF-04 | Metric/Unit model (time:seconds, time:minutes, reps:reps)                    | **B — CARRY FORWARD WITH GOVERNANCE FORMALIZATION** | Sound model but needs governed catalogue and compatibility rules.             |
| CF-05 | Single Runtime Catalogue Authority principle                                 | **A — CARRY FORWARD**                               | L1 authority (KNW-01). Binding.                                               |
| CF-06 | Fitness/Wellness as launch domains                                           | **A — CARRY FORWARD**                               | L1 authority (EOG-03). Binding.                                               |
| CF-07 | Exercise family concept                                                      | **B — CARRY FORWARD WITH GOVERNANCE FORMALIZATION** | Concept incorporated; dictionary and assignments deferred.                    |
| CF-08 | Challenge composition from knowledge (not modification)                      | **A — CARRY FORWARD**                               | L1 authority (EOG-03 Constitutional Composition). Binding.                    |
| CF-09 | Interest/Goal/Preference as non-Knowledge                                    | **A — CARRY FORWARD**                               | L1 authority (Domain Standard exclusions). Binding.                           |
| CF-10 | Rich Knowledge Asset structure (description, setup, execution, safety, etc.) | **B — CARRY FORWARD WITH GOVERNANCE FORMALIZATION** | Information needs demonstrated; record specification deferred.                |
| CF-11 | Knowledge lifecycle proposal (draft→review→publish→change→deprecate→archive) | **C — CARRY FORWARD WITH RECONCILIATION**           | Conceptually sound; needs reconciliation with CGP-02 amendment discipline.    |
| CF-12 | Exercise authoring/style guide                                               | **D — PRODUCT/IMPLEMENTATION EVIDENCE ONLY**        | Useful for content quality; not governance authority.                         |
| CF-13 | Knowledge graph/ontology proposals                                           | **C — CARRY FORWARD WITH RECONCILIATION**           | Relationship concepts useful; graph implementation deferred.                  |
| CF-14 | AI recommendation framework                                                  | **D — PRODUCT/IMPLEMENTATION EVIDENCE ONLY**        | Product logic; not knowledge governance.                                      |
| CF-15 | 369-row legacy fitness inventory                                             | **E — SUPERSEDED**                                  | Superseded by 154-exercise clean catalogue. Preserved as trace evidence only. |
| CF-16 | Taxonomy freeze proposal                                                     | **F — UNRESOLVED FOUNDER DECISION**                 | Taxonomy content and freeze status require Stage EK decision.                 |
| CF-17 | Wellness rationalisation matrix                                              | **F — UNRESOLVED FOUNDER DECISION**                 | Keep/merge/variant/reclassify/retire decisions required.                      |
| CF-18 | Knowledge Authority holder                                                   | **G — GENUINE STAGE EK GAP**                        | Not allocated in any reviewed authority.                                      |
| CF-19 | Knowledge steward allocation                                                 | **G — GENUINE STAGE EK GAP**                        | Not allocated in any reviewed authority.                                      |
| CF-20 | Knowledge publication lifecycle                                              | **G — GENUINE STAGE EK GAP**                        | KNW-02/KNW-03 deferred. No approved lifecycle.                                |

---

## 17. Superseded / Implementation-Only Material

| Material                             | Classification          | Reason                                      |
| ------------------------------------ | ----------------------- | ------------------------------------------- |
| 369-row legacy fitness inventory     | Superseded              | Cleaned to 154 exercises                    |
| V1 Firestore exercise documents      | Implementation evidence | L4 only; not governance authority           |
| Admin UI exercise management screens | Implementation evidence | Product interface                           |
| Seed/migration scripts               | Implementation evidence | Technical mechanism                         |
| Local asset files (src/assets/)      | Implementation evidence | Development fixtures per Domain Standard §4 |

---

## 18. Genuine Stage EK Gaps

| Gap ID | Subject                                 | Why existing authority is insufficient                                          | Downstream ambiguity                                | Founder decision needed? |
| ------ | --------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------ |
| GAP-01 | Knowledge Authority holder              | No authority allocates who holds Knowledge Authority                            | Cannot approve Knowledge Assets without authority   | YES                      |
| GAP-02 | Knowledge Accountable Steward           | Not allocated in CGP-04 or Entity Ownership Register                            | No answerability for knowledge coherence            | YES                      |
| GAP-03 | Knowledge lifecycle states/transitions  | KNW-02/KNW-03 deferred                                                          | Cannot govern creation→publication→retirement       | YES                      |
| GAP-04 | Taxonomy content and freeze             | Proposed but not approved                                                       | No controlled vocabulary for classification         | YES                      |
| GAP-05 | Exercise family dictionary              | Proposed but not approved                                                       | No governed grouping of exercises                   | YES                      |
| GAP-06 | Wellness rationalisation decisions      | Matrix proposed but decisions not made                                          | No keep/merge/retire decisions for Wellness content | YES                      |
| GAP-07 | Metric/Unit catalogue and compatibility | Model exists but not governed                                                   | No governed measurement rules                       | YES                      |
| GAP-08 | Knowledge Asset record specification    | Rich structure demonstrated but not mandated                                    | No mandatory content requirements                   | YES                      |
| GAP-09 | Runtime Catalogue publication mechanism | KNW-01 principle established; mechanism deferred                                | No governed publication workflow                    | YES                      |
| GAP-10 | Knowledge change/amendment workflow     | CGP-02 provides general discipline; knowledge-specific workflow not established | Unclear how knowledge-specific changes proceed      | YES                      |

---

## 19. Stage EK Architecture Assessment

| Proposed section                               | Assessment | Rationale                                                                                   |
| ---------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------- |
| 1. Knowledge Governance Foundation             | **KEEP**   | Necessary constitutional foundation for Stage EK                                            |
| 2. Knowledge Asset Identity & Classification   | **KEEP**   | Core Stage EK purpose — classify the 154 exercises and Wellness content                     |
| 3. Authoritative Meaning & Knowledge Authority | **KEEP**   | Must allocate Knowledge Authority and define Authoritative Meaning                          |
| 4. Knowledge Structure, Metrics & Units        | **KEEP**   | Metrics and Units are distinct governed concepts requiring governed catalogues              |
| 5. Knowledge Change, Extension & Integrity     | **KEEP**   | Lifecycle governance is a genuine gap (KNW-02/KNW-03)                                       |
| 6. Knowledge-to-Product Boundary               | **KEEP**   | Runtime Catalogue, Challenge composition, and discovery boundaries need explicit governance |

---

## 20. Recommended Minimum Stage EK Architecture

**One integrated instrument: EKG-01 — Tiizi Knowledge Governance Standard & Knowledge Asset Model**

Rationale:

- The six sections are interdependent (identity requires authority; authority requires lifecycle; lifecycle requires product boundary).
- Splitting into multiple instruments would create artificial dependencies and sequencing problems.
- The existing Knowledge Asset Domain Standard already covers much of this ground at the constitutional level. EKG-01 extends it into operational governance.
- CGP-03 proportionality principles (P01, P25–P30) support a single integrated instrument over multiple ceremonial stages.

---

## 21. Single-Instrument Assessment

**YES — one integrated instrument is sufficient.**

The six architecture sections form a coherent governance standard. No genuinely independent governance problem requires a separate instrument. The Knowledge Asset Domain Standard (L1) provides the constitutional foundation; EKG-01 extends it into operational governance within a single controlled instrument.

---

## 22. Founder Decision Register

| ID       | Question                                                                                                                              | Historical position                                                                                             | Current authority                                                                                                                                                                                                                                               | Options supported by evidence                                                                                                                                | Downstream consequence                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| EK-FQ-01 | Who holds Knowledge Authority, and who is Accountable Steward for Knowledge?                                                          | Assumed platform-level; steward not addressed                                                                   | Not allocated (CGP-04 preserves as unallocated). EOG-03 establishes Knowledge Authority as one of 11 Platform Authority types but does not name holder.                                                                                                         | Founder holds directly; delegates to a function/role; Knowledge Council. Steward may be same or separate from Authority holder.                              | EKG-01 resolves these internally — no separate prior Founder decision required. Knowledge coherence answerability. |
| EK-FQ-02 | What disposition should Stage EK give to the 154-exercise clean catalogue as the initial canonical Exercise baseline?                 | Catalogue exists; not formally approved                                                                         | EOG-03 §7 establishes Exercise Asset as primary Platform Knowledge Asset class. Instances not yet classified.                                                                                                                                                   | Approve all as canonical; approve subset; approve with modifications; defer individual dispositions.                                                         | Determines the governed Exercise knowledge baseline.                                                               |
| EK-FQ-03 | What disposition should Stage EK give to the 67 rationalised Wellness Activities as the initial canonical Wellness Activity baseline? | 67 activities across 10 categories; rationalisation matrix proposed                                             | EOG-03 §7 establishes Wellness Activity Asset as primary Platform Knowledge Asset class. Instances not yet classified.                                                                                                                                          | Approve all; approve subset; approve with modifications; defer.                                                                                              | Determines the governed Wellness Activity knowledge baseline.                                                      |
| EK-FQ-04 | What is the governed metric catalogue?                                                                                                | 3 runtime types (time:seconds, time:minutes, reps:reps); 16-type V2 taxonomy proposed (Draft for Approval)      | Domain Standard defines Metric concept. 16-type proposal is L3 evidence, not approved.                                                                                                                                                                          | Adopt runtime three; adopt proposed 16; reconcile into unified catalogue; restructure.                                                                       | Determines measurement governance.                                                                                 |
| EK-FQ-05 | What is the governed unit catalogue with conversion rules?                                                                            | seconds, minutes, reps exist at runtime; proposed taxonomy includes metres, kilometres, kilograms, litres, etc. | Domain Standard defines Unit concept.                                                                                                                                                                                                                           | Adopt runtime units; adopt proposed units; add conversions; restructure.                                                                                     | Determines unit governance.                                                                                        |
| EK-FQ-06 | What is the knowledge lifecycle model?                                                                                                | Draft→review→publish→change→deprecate→archive proposed                                                          | KNW-02/KNW-03 deferred                                                                                                                                                                                                                                          | Adopt proposed; simplify; extend.                                                                                                                            | Determines how knowledge changes over time.                                                                        |
| EK-FQ-07 | What taxonomy/content classification is controlled?                                                                                   | Body categories, muscles, goals, tags exist as L4; 7 Exercise Domains and 19 Families proposed as L3            | Not governed. Taxonomy Freeze Standard is "Draft for Approval."                                                                                                                                                                                                 | Adopt existing L4 categories; adopt proposed L3 domains/families; reconcile; defer.                                                                          | Determines discovery/filtering governance.                                                                         |
| EK-FQ-08 | What is the exercise family dictionary?                                                                                               | 19 families with sub-families proposed in corpus                                                                | Concept incorporated in Domain Standard; dictionary deferred                                                                                                                                                                                                    | Adopt proposed 19 families; restructure; defer.                                                                                                              | Determines exercise grouping.                                                                                      |
| EK-FQ-09 | What Wellness rationalisation decisions apply?                                                                                        | Rationalisation matrix proposed (67 activities from 60 existing + 25 new − 18 retired)                          | Not decided                                                                                                                                                                                                                                                     | Keep/merge/variant/reclassify/retire per matrix.                                                                                                             | Determines Wellness knowledge baseline.                                                                            |
| EK-FQ-10 | What is the Knowledge Asset record specification?                                                                                     | Rich structure demonstrated (identity, classification, content, measurement, safety, governance)                | Not mandated                                                                                                                                                                                                                                                    | Adopt rich model; minimal model; tiered model.                                                                                                               | Determines mandatory content requirements.                                                                         |
| EK-FQ-11 | What governs the relationship between Knowledge Assets and the Runtime Catalogue?                                                     | Seed data / Firestore; Runtime Catalogue is single governed authority (KNW-01)                                  | KNW-01 principle established; publication eligibility and authoritative state deferred. Stage EK governs publication eligibility and Knowledge-to-Runtime relationship; technical mechanisms (pipelines, deployment, tooling) remain downstream implementation. | Define publication eligibility criteria; define authoritative publication state; define Knowledge-to-Runtime subordination rules; defer technical mechanism. | Determines runtime availability governance without pre-empting implementation choices.                             |

---

## 23. Risks / Contradictions

| #   | Risk/Contradiction                                                             | Severity | Mitigation                                |
| --- | ------------------------------------------------------------------------------ | -------- | ----------------------------------------- |
| 1   | Knowledge Authority not allocated — cannot approve Knowledge Assets without it | HIGH     | EK-FQ-01 must be resolved early in EKG-01 |
| 2   | 154 exercises may need rationalisation before approval                         | MEDIUM   | EK-FQ-03/ EK-FQ-10 address this           |
| 3   | No lifecycle governance — knowledge changes have no governed process           | MEDIUM   | EK-FQ-07 addresses this                   |
| 4   | Wellness rationalisation undecided — content may overlap or conflict           | MEDIUM   | EK-FQ-10 addresses this                   |
| 5   | Metric/Unit model is simple (3 types) — may need extension                     | LOW      | EK-FQ-05/06 address this                  |

**No blocking contradictions found.** All risks are manageable through the Founder Decision Register.

---

## 24. Non-Effects

This audit does NOT:

- approve any Knowledge Asset;
- declare Exercise or Wellness Activity canonical;
- create Knowledge Authority;
- appoint a steward;
- alter entity classifications;
- resolve any Stage EK Founder question;
- modify product requirements or implementation;
- alter Firestore or reseed data;
- draft EKG-01;
- update earlier documents;
- commence Stage F, G, or H;
- authorize implementation.

---

## 25. Exact Recommended Next Step

**The Founder/ChatGPT should commence EKG-01 drafting, addressing the Founder Decision Register (EK-FQ-01 through EK-FQ-11) within the single integrated instrument.**

No separate prior Founder decision is required before EKG-01 drafting. EK-FQ-01 (Knowledge Authority and Accountable Steward) is resolved within EKG-01, not as a prerequisite ceremony.

Suggested internal ordering within EKG-01:

1. **EK-FQ-01** (Knowledge Authority and Accountable Steward) — establishes who governs knowledge
2. **EK-FQ-02/03** (Exercise and Wellness Activity baseline disposition) — establishes the knowledge baseline
3. **EK-FQ-04/05** (Metric/Unit catalogues) — governs measurement
4. **EK-FQ-06** (Lifecycle model) — governs knowledge change
5. **EK-FQ-07/08** (Taxonomy/families) — governs classification
6. **EK-FQ-09** (Wellness rationalisation) — governs Wellness content
7. **EK-FQ-10** (Record specification) — governs content requirements
8. **EK-FQ-11** (Knowledge-to-Runtime Catalogue relationship) — governs availability

---

_This is the Stage EK Knowledge Foundation Audit and Carry-Forward Assessment (reconciled). It confirms that Stage EK has a substantial existing foundation to build upon, identifies 11 genuine Stage EK Founder decisions, and recommends a single integrated EKG-01 instrument. EOG-03 §7 already establishes Exercise Asset and Wellness Activity Asset as primary Platform Knowledge Asset classes. The 16-type metric taxonomy and 7-domain/19-family taxonomy exist as proposed V2 evidence. No separate prior Founder decision is required before EKG-01 drafting._
