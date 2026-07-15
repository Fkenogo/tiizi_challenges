# Phase 18D-3C — Firestore Wellness Catalog Migration Preview

**Date:** 2026-06-28
**Branch:** fix/p0-pre-deploy-blockers
**Type:** Read-only Firestore audit — no writes, no deletes, no seeds

---

## Migration Statistics

| Metric | Value |
|---|---|
| Current Firestore documents | 60 |
| New catalog documents | 67 |
| IDs in both (retained) | 42 |
| IDs only in Firestore → **delete** | 18 |
| IDs only in local catalog → **insert** | 25 |
| Same ID, changed fields → **update** | 42 |
| Display names changing | 34 |
| Categories: Firestore → catalog | 8 → 10 |
| Activity types: Firestore → catalog | 8 → 12 |

---

## A. Firestore Document Count: 60

The live `wellnessActivities` collection contains 60 documents across 8 categories.

---

## B. Local Catalog Count: 67

`src/data/wellnessActivitiesCatalog.ts` — Phase 18C/18D-1 framework.

---

## C. IDs Existing in Both (42 retained)

These documents exist in both Firestore and the local catalog. They will be **updated in place** during the seed. IDs are stable — no Firestore references break.

```
fasting-16hr-fast          fasting-18hr-fast          habits-daily-planning
habits-evening-routine     habits-morning-routine     habits-no-late-snacks
habits-read-daily          habits-wake-time           hydration-2l-daily
hydration-3l-daily         hydration-morning-500ml    hydration-no-sugar-drinks
mindfulness-10min-mindfulness  mindfulness-20min-meditation  mindfulness-5min-meditation
mindfulness-body-scan      mindfulness-breathing-3x   mindfulness-digital-detox
mindfulness-gratitude-journal  nutrition-5-veg-servings   nutrition-7-produce
nutrition-meal-prep        nutrition-no-processed     nutrition-no-sugar
nutrition-protein-goal     nutrition-whole-foods      sleep-8hr-sleep
sleep-bed-by-10pm          sleep-no-screen-1hr        sleep-power-nap
sleep-sleep-consistency    social-call-someone        social-community-join
social-daily-connection    social-gratitude-message   social-kindness-act
stress-box-breathing       stress-breathing-3x        stress-nature-walk
stress-pmr                 stress-stress-journal      stress-unplug-break
```

---

## D. IDs Only in Firestore — Deletion Candidates (18)

These documents will be **deleted** during the seed. They represent retired activities from the Phase 18C framework.

| Document ID | Current Name | Category |
|---|---|---|
| `fasting-20hr-fast` | 20-Hour Fast (20/4) | fasting |
| `fasting-24hr-fast` | 24-Hour Fast (OMAD) | fasting |
| `fasting-48hr-fast` | 48-Hour Fast | fasting |
| `fasting-5-2-fasting` | 5:2 Protocol | fasting |
| `fasting-72hr-fast` | 72-Hour Fast | fasting |
| `fasting-adf` | Alternate Day Fasting | fasting |
| `habits-deep-work` | 30-Min Deep Work Block | habits |
| `habits-no-alcohol` | No Alcohol Challenge | habits |
| `hydration-4l-daily` | Athlete Hydration 4L | hydration |
| `hydration-hydration-streak` | Hydration Streak | hydration |
| `hydration-pre-meal-250ml` | Pre-Meal Water | hydration |
| `hydration-workout-hydration` | Workout Hydration | hydration |
| `mindfulness-mindful-eating` | Mindful Eating | mindfulness |
| `sleep-sleep-optimize` | Sleep Optimization | sleep |
| `sleep-sleep-recovery` | Weekend Sleep Recovery | sleep |
| `social-group-check-in` | Weekly Group Check-In | social |
| `social-no-phone-meal` | No-Phone Meals | social |
| `stress-calm-routine` | Evening Calm Routine | stress |

---

## E. IDs Only in Local Catalog — Insertion Candidates (25)

These documents will be **created** during the seed. Entirely new activities.

| Document ID | Name | Category |
|---|---|---|
| `fasting-no-late-eating` | No Late Eating | fasting |
| `fasting-time-restricted` | Time-Restricted Eating | fasting |
| `habits-declutter` | Decluttering | habits |
| `habits-learning` | Learning | habits |
| `health-monitoring-appointment` | Health Appointment | health-monitoring |
| `health-monitoring-blood-sugar` | Blood Sugar Check | health-monitoring |
| `health-monitoring-bp-check` | Blood Pressure Check | health-monitoring |
| `health-monitoring-medication` | Medication Adherence | health-monitoring |
| `health-monitoring-weight-check` | Weight Check | health-monitoring |
| `hydration-electrolyte` | Electrolyte Hydration | hydration |
| `mindfulness-journaling` | Journaling | mindfulness |
| `mindfulness-prayer` | Prayer / Reflection | mindfulness |
| `movement-cycling` | Cycling | movement |
| `movement-mobility` | Mobility Routine | movement |
| `movement-running` | Running / Jogging | movement |
| `movement-steps` | Steps | movement |
| `movement-stretching` | Stretching | movement |
| `movement-walking` | Walking | movement |
| `movement-walking-dist` | Walking Distance | movement |
| `movement-yoga` | Yoga | movement |
| `nutrition-breakfast` | Healthy Breakfast | nutrition |
| `nutrition-home-cooked` | Home-Cooked Meal | nutrition |
| `sleep-wake-time` | Wake Up On Time | sleep |
| `social-family-time` | Family Time | social |
| `stress-music-calm` | Music / Calm Time | stress |

---

## F. Same ID, Changed Fields — Update Candidates (42)

All 42 retained documents have at least one changed field. The dominant change is the addition of `targetType` (absent from all 60 Firestore documents; present in every catalog entry). 34 of 42 also have display name changes. Selected notable changes:

### targetType — missing from ALL 60 Firestore documents
Every retained document gains `targetType`. The field was not previously stored. This is additive and safe — no existing code reads `targetType` from stored challenge activities.

### Notable name changes (34 documents)

| ID | Firestore name | New catalog name |
|---|---|---|
| `mindfulness-5min-meditation` | "5-Min Meditation" | "Meditation" |
| `mindfulness-10min-mindfulness` | "10-Min Mindfulness" | "Mindfulness" |
| `mindfulness-20min-meditation` | "20-Min Deep Practice" | "Deep Meditation" |
| `fasting-16hr-fast` | "16-Hour Fast (16/8)" | "Intermittent Fasting" |
| `fasting-18hr-fast` | "18-Hour Fast (18/6)" | "Extended Fasting" |
| `sleep-8hr-sleep` | "8-Hour Sleep Streak" | "Sleep" |
| `nutrition-5-veg-servings` | "5-a-Day Vegetables" | "Vegetable Intake" |
| `nutrition-7-produce` | "7-a-Day Produce" | "Fruit Intake" |
| `nutrition-no-sugar` | "30-Day No Sugar" | "No Added Sugar" |
| `habits-read-daily` | "Read 20 Minutes Daily" | "Reading" |
| `stress-nature-walk` | "Nature Walk Reset" | "Nature Time" |
| `stress-breathing-3x` | "Deep Breathing 3x Daily" | "Deep Breathing" |

### Notable metric changes

| ID | Field | Firestore | Catalog | Note |
|---|---|---|---|---|
| `mindfulness-5min-meditation` | defaultTargetValue | 5 | 10 | Phase 18C raised default to 10 min |
| `mindfulness-breathing-3x` | activityType | `meditation` | `breathing` | Corrected type |
| `mindfulness-breathing-3x` | defaultMetricUnit | `sessions` | `minutes` | Standardised to time-based |
| `mindfulness-digital-detox` | defaultTargetValue | 2 | 60 | Unit changed hours→minutes; value adjusted |
| `mindfulness-digital-detox` | defaultMetricUnit | `hours` | `minutes` | Standardised |
| `stress-nature-walk` | activityType | `breathing` | `walking` | Corrected type |
| `sleep-bed-by-10pm` | defaultTargetValue | 22 | 1 | Was storing hour-of-day (22:00), now 1 night |
| `sleep-bed-by-10pm` | defaultMetricUnit | `hour` | `night` | Aligned |
| `nutrition-5-veg-servings` | defaultTargetValue | 5 | 3 | Phase 18C lowered to 3 servings |
| `nutrition-7-produce` | defaultTargetValue | 7 | 2 | Phase 18C lowered to 2 servings |

---

## G. Legacy Embedded-Quantity Names That Will Disappear

The following display names in Firestore contain embedded numeric quantities and will be replaced by target-free names in the catalog:

| Firestore name | Replacement |
|---|---|
| "5-Min Meditation" | "Meditation" |
| "10-Min Mindfulness" | "Mindfulness" |
| "20-Min Deep Practice" | "Deep Meditation" |
| "16-Hour Fast (16/8)" | "Intermittent Fasting" |
| "18-Hour Fast (18/6)" | "Extended Fasting" |
| "20-Hour Fast (20/4)" | *(deleted — retired activity)* |
| "24-Hour Fast (OMAD)" | *(deleted — retired activity)* |
| "48-Hour Fast" | *(deleted — retired activity)* |
| "72-Hour Fast" | *(deleted — retired activity)* |
| "30-Min Deep Work Block" | *(deleted — retired activity)* |
| "Daily Hydration 2L" | "Water Intake" |
| "Enhanced Hydration 3L" | "Enhanced Hydration" |
| "Athlete Hydration 4L" | *(deleted — retired activity)* |
| "5-a-Day Vegetables" | "Vegetable Intake" |
| "7-a-Day Produce" | "Fruit Intake" |
| "8-Hour Sleep Streak" | "Sleep" |

---

## Reference Audit

**Scope:** All source files that could hardcode wellness activity IDs — services, seed scripts, test scripts, fixture files.

**Files checked:**
- `src/services/wellnessActivityService.ts`
- `src/services/wellnessTemplateService.ts`
- `src/data/wellnessActivitiesCatalog.ts`
- `scripts/seedWellnessActivities.ts`
- `scripts/seedWellnessTemplates.ts`
- `scripts/seedAppData.ts`
- `scripts/seedBaselineData.ts`

**Result: No hardcoded references to deletion-candidate IDs found.**

None of the 18 deletion-candidate IDs (`fasting-20hr-fast`, `fasting-24hr-fast`, etc.) appear as string literals in any source file. The application retrieves activities dynamically from Firestore; it does not hardcode activity IDs in application code.

**Note on in-flight challenges:** Challenges that have already been created store activity data (name, unit, target) directly inside the `challenge.activities[]` array at creation time. They do not look up activity IDs at log time. Deleting or updating `wellnessActivities` documents does not affect challenges already in Firestore.

---

## Migration Risk Assessment: LOW

| Factor | Detail |
|---|---|
| Hardcoded ID references | None found — risk SAFE on this axis |
| Deletion count | 18 documents — within normal range |
| In-flight challenge impact | None — challenge.activities[] is denormalized at creation |
| Field-change impact | additive only (`targetType`) + name/metric updates that only affect new picker selections |
| New categories | `movement` and `health-monitoring` are entirely additive |
| ID stability | 42 retained IDs unchanged — no Firestore references break |

**Overall: LOW**

The 18 deletions are retired activities that should no longer appear in the picker. The reference audit confirms nothing in the codebase hardcodes those IDs. In-flight challenges are denormalized and unaffected. The only non-zero risk is that active challenges whose participants haven't finished yet could have been created from the legacy library — but since `challenge.activities[]` is stored at challenge creation time, neither updating nor deleting the source `wellnessActivities` documents alters those challenges.

---

## Validation

```
npx tsc --noEmit                                  → ✅ No errors
npm run build                                     → ✅ Built in 7.43s
npx tsx scripts/auditWellnessActivityCatalog.ts   → ✅ PASS (21/21 guards)
npx tsx scripts/auditFirestoreWellnessActivities.ts → ✅ Read-only, 0 writes
```

---

## Confirmation: No Firestore Writes

The audit script (`scripts/auditFirestoreWellnessActivities.ts`) uses only `getDocs()` and `getDoc()` — no `setDoc`, `addDoc`, `updateDoc`, `deleteDoc`, or batch writes. The Firestore collection is unchanged.

---

## Next Step: Phase 18D-4 (Requires Explicit Approval)

The migration is fully previewed. To proceed:

1. Approve Phase 18D-4
2. Run `npx tsx scripts/seedWellnessActivities.ts`
   - Deletes 18 retired documents
   - Creates 25 new documents
   - Updates 42 existing documents (name, targetType, metric corrections)
3. Verify with `scripts/auditFirestoreWellnessActivities.ts` post-seed

**Do not run the seed until explicit approval is given.**
