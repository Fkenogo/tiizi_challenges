# Phase 18C — Wellness Activity Framework Spec

**Date:** 2026-06-28
**Branch:** fix/p0-pre-deploy-blockers
**Type:** Spec / audit only — no production code changes, no Firestore writes

---

## 1. Current Catalog Audit

### Totals

- **60 activities** across 8 categories
- Derived from `WELLNESS_ACTIVITIES_CATALOG` in `src/data/wellnessActivitiesCatalog.ts`
- Seeded to Firestore via `npm run seed:wellness-activities` (uses admin SDK + `GOOGLE_APPLICATION_CREDENTIALS`)

### ID Generation

Two ID strategies exist depending on creation path:

| Path | Formula | Example |
|---|---|---|
| Catalog (`wellnessActivitiesCatalog.ts`) | `category-slugify(shortName)` | `mindfulness-5min-meditation` |
| Admin UI (`adminWellnessActivityService.ts`) | `slugify(name)` with suffix dedup | `custom-meditation` |

The catalog path is canonical. Changing `shortName` changes the ID and orphans any Firestore document, challenge, or template that references the old ID.

### Problem: Embedded Quantities in Names

14 of 60 current activity names bake a fixed quantity into the display label. This creates a UX conflict: when a user picks "10-Min Mindfulness" and sets `targetValue: 20`, the activity name still says "10-Min."

| Activity ID | Current Name | Embedded quantity |
|---|---|---|
| `fasting-16hr-fast` | 16-Hour Fast (16/8) | "16-Hour" |
| `fasting-18hr-fast` | 18-Hour Fast (18/6) | "18-Hour" |
| `fasting-20hr-fast` | 20-Hour Fast (20/4) | "20-Hour" |
| `fasting-48hr-fast` | 48-Hour Fast | "48-Hour" |
| `fasting-72hr-fast` | 72-Hour Fast | "72-Hour" |
| `sleep-8hr-sleep` | 8-Hour Sleep Streak | "8-Hour" |
| `hydration-2l-daily` | Daily Hydration 2L | "2L" |
| `hydration-3l-daily` | Enhanced Hydration 3L | "3L" |
| `hydration-4l-daily` | Athlete Hydration 4L | "4L" |
| `nutrition-5-veg-servings` | 5-a-Day Vegetables | "5-a-Day" |
| `nutrition-7-produce` | 7-a-Day Produce | "7-a-Day" |
| `mindfulness-5min-meditation` | 5-Min Meditation | "5-Min" |
| `mindfulness-10min-mindfulness` | 10-Min Mindfulness | "10-Min" |
| `mindfulness-20min-meditation` | 20-Min Deep Practice | "20-Min" |

### Problem: Missing Core Activities

| Missing | Priority | Notes |
|---|---|---|
| Steps | Critical | Highest-engagement mobile wellness metric; completely absent |
| Walking distance | High | "Nature Walk Reset" (stress) tracks minutes only |
| Yoga | High | Absent entirely |
| Movement category | High | No category for physical movement at all |
| Generic fasting entry | Medium | All fasting activities are protocol-specific |
| Health monitoring | Medium | Weight, blood pressure, medication — absent |

### Problem: Overly Specific Activities

Several activities are so protocol-specific that they should be retired and replaced by a generic activity + user-set target:

| Activity | Problem |
|---|---|
| `fasting-48hr-fast`, `fasting-72hr-fast` | Medical supervision required; fringe edge case |
| `fasting-24hr-fast` (OMAD) | User can set target=24 on "Intermittent Fasting" |
| `hydration-4l-daily` | User can set target=4000 ml on "Water Intake" |
| `hydration-pre-meal-250ml` | Too granular; pre-meal timing is protocol, not a different activity |
| `hydration-hydration-streak` | Vague; replaced by "Water Intake" with streak challenge type |
| `sleep-sleep-optimize` | Duplicate of "Sleep" |
| `sleep-sleep-recovery` | Weekend-specific; conflicts with daily streak model |
| `fasting-adf`, `fasting-5-2-fasting` | Weekly cadence incompatible with daily streak engine |
| `habits-no-alcohol` | Health sensitivity; better as user-defined free-text note |
| `stress-calm-routine` | Duplicate of Evening Routine (habits) |

### Problem: Missing `targetType` field

The `WellnessActivity` interface has no `targetType` field. Without it, the scoring engine and detail screen cannot know whether a logged value contributes per-day (`daily`) or accumulates across multiple sessions (`cumulative`). This field is needed for collective challenge scoring — a group step challenge should sum all `cumulativeLoggedValue` values; a meditation challenge sums daily completion counts.

---

## 2. Proposed Framework

Full framework defined in: [`docs/architecture/wellness-activity-framework.md`](../architecture/wellness-activity-framework.md)

### Category Changes

| # | Category | Status | Icon |
|---|---|---|---|
| 1 | Movement & Steps | **New** | 🏃 |
| 2 | Hydration | Existing (simplified) | 💧 |
| 3 | Sleep & Recovery | Existing (simplified) | 😴 |
| 4 | Mindfulness & Mental Wellness | Existing (renamed + expanded) | 🧘 |
| 5 | Nutrition | Existing (simplified + expanded) | 🥗 |
| 6 | Fasting | Existing (heavily simplified) | 🕐 |
| 7 | Habits & Discipline | Existing (renamed + expanded) | ✅ |
| 8 | Stress Management | Existing (renamed) | 🌿 |
| 9 | Social & Relationships | Existing (renamed) | 🤝 |
| 10 | Health Monitoring | **New** | 🩺 |

### Final Activity Count by Category

| Category | Final count |
|---|---|
| Movement & Steps | 8 |
| Hydration | 6 |
| Sleep & Recovery | 6 |
| Mindfulness & Mental Wellness | 9 |
| Nutrition | 9 |
| Fasting | 4 |
| Habits & Discipline | 7 |
| Stress Management | 7 |
| Social & Relationships | 6 |
| Health Monitoring | 5 |
| **Total** | **67** |

vs. current: 60 activities. Net: +7 (25 added, 18 retired).

---

## 3. Schema Changes Required

### `src/types/wellnessActivity.ts`

**Change 1 (required before seeding):** Expand `WellnessCategory`:

```ts
// Before
export type WellnessCategory =
  | 'fasting' | 'hydration' | 'sleep' | 'mindfulness'
  | 'nutrition' | 'habits' | 'stress' | 'social';

// After
export type WellnessCategory =
  | 'fasting' | 'hydration' | 'sleep' | 'mindfulness'
  | 'nutrition' | 'habits' | 'stress' | 'social'
  | 'movement' | 'health-monitoring';
```

**Change 2 (required before seeding):** Expand `WellnessActivityType`:

```ts
// Before
export type WellnessActivityType =
  | 'fasting' | 'water' | 'sleep' | 'meditation'
  | 'food' | 'habit' | 'breathing' | 'social';

// After
export type WellnessActivityType =
  | 'fasting' | 'water' | 'sleep' | 'meditation'
  | 'food' | 'habit' | 'breathing' | 'social'
  | 'steps' | 'walking' | 'yoga' | 'monitoring';
```

**Change 3 (optional, adds capability):** Add `targetType` field:

```ts
export interface WellnessActivity {
  // ... existing fields ...
  targetType?: 'daily' | 'cumulative' | 'weekly' | 'monthly';
}
```

This is optional and backward-compatible — existing Firestore documents without `targetType` simply return `undefined`, and callers treat `undefined` as `'daily'` (the default).

### `src/data/wellnessActivitiesCatalog.ts`

- `categoryMeta` record: add entries for `movement` and `health-monitoring`
- `ActivitySeed` type: add optional `targetType` field
- `buildActivity`: pass `targetType` through to the output object
- Replace all 14 embedded-quantity names with target-free names (name field only)
- Remove retired activity seeds
- Add new activity seeds for all 25 new activities

### No changes required in

- `src/services/wellnessActivityService.ts` — reads and sorts by name; no hardcoded category list
- `src/services/adminWellnessActivityService.ts` — validates against the type union; will need rebuilding after type changes
- `src/features/Challenges/components/ChallengeActivitySection.tsx` — picker is data-driven
- `scripts/seedWellnessActivities.ts` — unchanged; reads from `WELLNESS_ACTIVITIES_CATALOG`
- Firestore security rules — collection name unchanged
- Any challenge scoring logic — activity identity is separate from scoring

---

## 4. ID Stability Analysis

### Existing 60 activities: zero migration risk for name-only renames

All 60 existing activity IDs are derived from `shortName`. Renaming only `name`:
- Zero Firestore migration needed
- Zero impact on `challengeMembers` documents (they store `activityId`, not `name`)
- Zero impact on `wellnessTemplates` (they store `activityId` + `exerciseName` separately)
- Zero impact on `wellnessLogs`

### Retired activities: Firestore documents must NOT be deleted

18 activities are proposed for retirement (removal from picker). Their Firestore documents must remain. Any challenge or template that references a retired activity ID will still resolve the `activityId` correctly from the stored challenge document fields (`exerciseName`, `targetValue`, `unit`). The activity name is denormalized onto the challenge document at creation time, so display is unaffected even if the source document is gone.

### New activities: zero migration risk

New activities use new IDs in new or existing categories. No conflict with existing IDs.

### Risk: admin-UI-created activities with `slugify(name)` IDs

The admin wellness activity editor generates IDs from `slugify(name)`. If any admin-created activity has the same name as a new catalog activity, the IDs may collide or be near-identical. This is low risk because admin-created activities go to the same Firestore collection and the seed script uses `set(..., { merge: true })` — it will update existing documents by ID rather than creating duplicates.

---

## 5. Can Implementation Proceed Without Firestore Migration?

**Yes**, with the following approach:

1. **Phase 18D-1 (code only, no writes):** Update TypeScript types + catalog code. Run `tsc + build`. All changes are catalog/type-level.
2. **Phase 18D-2 (tests):** Static guards verify new activities are present, names are target-free, retired activities are absent from catalog array, new categories exist in type union.
3. **Phase 18D-3 (admin preview):** Admin opens wellness activity picker in staging/dev. Confirms new activities appear, retired activities are gone, names are clean.
4. **Phase 18D-4 (seed — requires explicit approval):** Run `npm run seed:wellness-activities` against production. The seed script uses `set(..., { merge: true })` — it upserts by ID. Existing documents for retained activities get name updated. New documents get created. Retired activity documents stay in place (not deleted by seed script). **Requires `GOOGLE_APPLICATION_CREDENTIALS`.**

No database migration scripts. No data transforms. The seed script is the write path.

---

## 6. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Retired activity ID orphaned in existing challenges | Low | Challenges store `exerciseName` + `targetValue` + `unit` as denormalized fields. The name is always displayed from the challenge document, not re-fetched from the activity catalog. |
| `WellnessCategory` type expansion breaks existing TypeScript callers | Low | Adding new values to a union is backward-compatible; no existing `switch`/`exhaustive` checks confirmed on `WellnessCategory`. |
| Admin-created activities with `slugify(name)` IDs conflicting with new catalog IDs | Low | Seed uses `merge: true`; would overwrite admin-created doc with catalog values. Audit admin-created activities before seeding. |
| `targetType` unused by scoring engine initially | None | Optional field. Scoring engine ignores unknown fields. Can be used in Phase 18E for engine-aware scoring. |
| `defaultTargetValue` changes on renamed activities (e.g. Meditation 5→10) | Low | Only affects new challenges created after seed. Existing challenges retain their stored `targetValue`. |
| Health Monitoring activities may require user education | Medium | Blood pressure / blood sugar checks are clinical. Medical supervision copy and `medicalSupervisionRequired: true` flag should be set for relevant activities. |

---

## 7. Implementation Phases

### Phase 18D-1 — Catalog Code Update (code only, no Firestore writes)

**Files:**
- `src/types/wellnessActivity.ts` — add `movement`, `health-monitoring` to `WellnessCategory`; add `steps`, `walking`, `yoga`, `monitoring` to `WellnessActivityType`; add optional `targetType` field
- `src/data/wellnessActivitiesCatalog.ts` — rename 14 embedded-quantity names; remove 18 retired seeds; add 25 new seeds; add `categoryMeta` entries for new categories; thread `targetType` through `buildActivity`

**Validation:** `npx tsc --noEmit` + `npm run build`

### Phase 18D-2 — Tests / Static Guards

**Files:**
- New script: `scripts/auditWellnessActivityCatalog.ts`

**Guards to add:**
1. Total activity count = 67
2. No activity name contains a digit followed by common quantity patterns (`-Min`, `L`, `-Hour`, `-a-Day`)
3. All 10 categories present in catalog
4. `movement-steps` exists with `defaultMetricUnit: 'steps'`
5. All retired IDs absent from catalog array
6. `targetType` present on all activities
7. No two activities share the same ID
8. `WellnessCategory` type includes `movement` and `health-monitoring` (static source check)

### Phase 18D-3 — Admin Preview / Manual Check

Manual steps (no code):
1. Open wellness activity picker in dev/staging build
2. Confirm new categories (`Movement`, `Health Monitoring`) appear
3. Confirm Steps, Walking Distance, Yoga appear under Movement
4. Confirm retired activities no longer appear in picker
5. Confirm activity names are target-free in the picker UI
6. Create a test wellness collective challenge using Steps; confirm `groupCumulativeTarget` field accepts it

### Phase 18D-4 — Controlled Firestore Seed (explicit approval required)

**Requires explicit approval before running.**

```bash
npm run seed:wellness-activities
```

- Upserts all 67 catalog activities to `wellnessActivities` collection
- Retired activity Firestore documents are NOT deleted (left in place)
- Requires `GOOGLE_APPLICATION_CREDENTIALS` env var pointing to service account

**Post-seed verification:**
1. Confirm `wellnessActivities` collection count ≥ 67
2. Confirm `movement-steps` document exists with correct fields
3. Open challenge creation wizard → wellness mode → confirm Steps appears
4. Confirm a retired activity (e.g. `fasting-72hr-fast`) still has its Firestore document (not deleted)

---

## 8. Files Audited

| File | Finding |
|---|---|
| `src/data/wellnessActivitiesCatalog.ts` | 60 activities; 14 embedded-quantity names; ID formula confirmed |
| `src/types/wellnessActivity.ts` | No `targetType` field; 8 categories; 8 activity types |
| `src/services/wellnessActivityService.ts` | Data-driven; no hardcoded names; fallback to catalog if Firestore unavailable |
| `src/services/adminWellnessActivityService.ts` | Admin-create IDs use `slugify(name)`; validates against type unions |
| `src/features/Admin/Wellness/WellnessActivityForm.tsx` | Form fields match current type; no `targetType` input |
| `src/features/Challenges/components/ChallengeActivitySection.tsx` | Picker is fully data-driven; no hardcoded category list |
| `scripts/seedWellnessActivities.ts` | Uses `set(..., { merge: true })`; does not delete existing documents |
