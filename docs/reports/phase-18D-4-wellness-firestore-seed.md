# Phase 18D-4 — Wellness Firestore Seed

**Date:** 2026-06-28
**Branch:** fix/p0-pre-deploy-blockers
**Approval:** Explicitly granted

---

## Seed Command

```
npx tsx scripts/seedWellnessActivities.ts
```

---

## Seed Output

```
Wellness Activities Seed — 2026-06-28T16:21:38.237Z
  Deletions queued : 18
  Creates queued   : 25
  Updates queued   : 42
  Total ops        : 85
  committed batch [1–85] of 85 total ops
{
  "projectId": "tiizi-challenges",
  "seededActivities": 67,
  "createdCount": 25,
  "updatedCount": 42,
  "deletedCount": 18,
  "totalActivitiesInCollection": 67,
  "countsByCategory": {
    "fasting": 4,
    "habits": 8,
    "health-monitoring": 5,
    "hydration": 5,
    "mindfulness": 9,
    "movement": 8,
    "nutrition": 9,
    "sleep": 6,
    "social": 6,
    "stress": 7
  }
}
```

---

## Migration Results

| Metric | Value |
|---|---|
| Documents before seed | 60 |
| Documents after seed | 67 |
| Created (new IDs) | 25 |
| Updated (existing IDs) | 42 |
| Deleted (retired IDs) | 18 |
| Final Firestore count | 67 |

---

## Script Fix Applied Before Running

The original `scripts/seedWellnessActivities.ts` had two defects that were corrected before the seed:

**1. No deletion of retired documents.** The original script only upserted the 67 catalog entries — it did not delete the 18 Firestore-only (retired) documents. Without this fix, the post-seed collection would have contained 85 documents (67 new + 18 legacy), and the picker would still show retired activities.

**Fix:** Added a deletion pass — reads all current Firestore IDs, computes `toDelete = allCurrentIds − catalogIds`, and issues `batch.delete()` for each retired document before the upserts.

**2. Hard-coded `GOOGLE_APPLICATION_CREDENTIALS` guard.** The script threw before reaching `applicationDefault()` when that env var was absent, even though Application Default Credentials (ADC) were configured and working (as proven by the Phase 18D-3C audit script). The guard was removed; `applicationDefault()` finds ADC automatically.

---

## Post-Seed Verification

### Firestore comparison audit (`auditFirestoreWellnessActivities.ts`)

```
FIRESTORE DOCUMENT COUNT    67
LOCAL CATALOG COUNT         67
IDs IN BOTH                 67
IDs ONLY IN FIRESTORE       0   (deletions) ✅
IDs ONLY IN LOCAL CATALOG   0   (inserts)   ✅
SAME ID, CHANGED FIELDS     0               ✅

Legacy embedded-quantity names: (none found) ✅
Orphaned references:            (none found) ✅

Categories (Firestore): 10  [fasting, habits, health-monitoring, hydration,
                             mindfulness, movement, nutrition, sleep, social, stress]
Activity types (Firestore): 12  [breathing, fasting, food, habit, meditation,
                                 monitoring, sleep, social, steps, walking, water, yoga]

Risk level: SAFE
```

### Static catalog audit (`auditWellnessActivityCatalog.ts`)

```
Guards passed: 21 / 21 — 0 violations — ✅ PASS
```

### TypeScript + Build

```
npx tsc --noEmit   → ✅ No errors
npm run build      → ✅ Built in 8.04s
```

---

## Picker Impact

The wellness activity picker (`CreateChallengeWizard`, `CreateChallengeScreen`, `EditWellnessTemplateScreen`) now reads from the updated Firestore collection. Because `wellnessActivityService.getAllActivities()` reads Firestore first and the collection is now non-empty with the new data, the picker will display:

**New categories visible:**
- Movement (Steps, Walking, Walking Distance, Running / Jogging, Cycling, Stretching, Mobility Routine, Yoga)
- Health (Weight Check, Blood Pressure Check, Blood Sugar Check, Medication Adherence, Health Appointment)

**Legacy names replaced:**
- "5-Min Meditation" → "Meditation"
- "10-Min Mindfulness" → "Mindfulness"
- "20-Min Deep Practice" → "Deep Meditation"
- "16-Hour Fast (16/8)" → "Intermittent Fasting"
- "18-Hour Fast (18/6)" → "Extended Fasting"
- "5-a-Day Vegetables" → "Vegetable Intake"
- "7-a-Day Produce" → "Fruit Intake"
- "8-Hour Sleep Streak" → "Sleep"
- All others per Phase 18C framework

**Retired activities no longer appear:**
- 20-Hour Fast, 24-Hour Fast, 48-Hour Fast, 72-Hour Fast, 5:2 Protocol, Alternate Day Fasting
- 30-Min Deep Work Block, No Alcohol Challenge
- Athlete Hydration 4L, Pre-Meal Water, Workout Hydration, Hydration Streak
- Mindful Eating, Sleep Optimization, Weekend Sleep Recovery
- Weekly Group Check-In, No-Phone Meals, Evening Calm Routine

---

## Collections Touched

Only `wellnessActivities`. No other collection was accessed or modified.

- `challenges` — untouched ✅
- `challengeMembers` — untouched ✅
- `wellnessTemplates` — untouched ✅
- `users` — untouched ✅
- `groups` — untouched ✅
- `workouts` — untouched ✅
- `wellnessLogs` — untouched ✅

---

## Errors and Warnings

None. Seed completed in a single batch commit.
