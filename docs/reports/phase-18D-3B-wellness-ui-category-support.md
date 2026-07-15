# Phase 18D-3B — Wellness Catalog UI Category Support

**Date:** 2026-06-28
**Branch:** fix/p0-pre-deploy-blockers
**Type:** UI/type code fixes only — no Firestore writes, no seed scripts

---

## Objective

Prepare all UI and service code to correctly handle the 10-category Phase 18C framework before the Firestore seed (Phase 18D-4). Three stale sources identified in Phase 18D-3A were updated, plus one ripple type fix, plus four new static guards were added to the audit script.

---

## Files Changed

| File | Change |
|---|---|
| `src/features/Challenges/components/ChallengeActivitySection.tsx` | Replaced 8-category `WELLNESS_CATEGORIES` constant with all 10; added `wellnessCategoryLabel()` for clean rendering |
| `src/services/wellnessTemplateService.ts` | Extended `toCategory()` to accept `movement` and `health-monitoring` |
| `src/types/index.ts` | Extended `WellnessTemplate.category` union to include `movement` and `health-monitoring` |
| `src/features/Challenges/CreateChallengeWizard.tsx` | Extended `challengeCategory` state type to include `movement` and `health-monitoring` |
| `src/services/catalogMetadata.ts` | Updated `WELLNESS_CATEGORY_OPTIONS` and `WELLNESS_ACTIVITY_TYPE_OPTIONS` to match 10-category framework |
| `scripts/auditWellnessActivityCatalog.ts` | Added Guards G18–G21 (Section H — UI & Service Consistency) |

---

## Fix Details

### Fix 1 — ChallengeActivitySection picker tabs

**Before:**
```ts
const WELLNESS_CATEGORIES = [
  'all', 'fasting', 'hydration', 'sleep', 'mindfulness',
  'nutrition', 'habits', 'stress', 'social',
] as const;
// labels rendered raw: "fasting", "health-monitoring"
```

**After:**
```ts
const WELLNESS_CATEGORIES = [
  'all', 'movement', 'hydration', 'sleep', 'mindfulness',
  'nutrition', 'fasting', 'habits', 'stress', 'social', 'health-monitoring',
] as const;

function wellnessCategoryLabel(cat: string): string {
  if (cat === 'health-monitoring') return 'Health';
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}
// renders: "All", "Movement", "Hydration", ..., "Health"
```

Picker tabs now cover all 10 categories. `health-monitoring` renders as "Health" to fit the narrow pill.

### Fix 2 — wellnessTemplateService.toCategory()

Added `'movement'` and `'health-monitoring'` to the acceptance guard. Previously both values were coerced to `'habits'` — any template in those categories would have been stored with a wrong category.

### Fix 3 — WellnessTemplate.category type (ripple from Fix 2)

`toCategory()` returns `WellnessTemplate['category']`. Adding `movement` and `health-monitoring` to the return set required extending the `WellnessTemplate.category` union in `src/types/index.ts`. This in turn exposed a narrower `useState` type in `CreateChallengeWizard` — extended to match.

### Fix 4 — catalogMetadata.ts

File was dead code (imported nowhere) but exported stale 8-category, 8-type constants. Updated in place to match the Phase 18C framework (10 categories, 12 activity types). TypeScript enforces correctness via the `WellnessCategory` and `WellnessActivityType` type parameters.

---

## Exact Category List Now Used by Picker

```
'all', 'movement', 'hydration', 'sleep', 'mindfulness',
'nutrition', 'fasting', 'habits', 'stress', 'social', 'health-monitoring'
```

Rendered labels: All · Movement · Hydration · Sleep · Mindfulness · Nutrition · Fasting · Habits · Stress · Social · Health

---

## New Audit Guards (G18–G21)

| Guard | What it checks |
|---|---|
| G18 | `ChallengeActivitySection` `WELLNESS_CATEGORIES` includes `movement` and `health-monitoring`; does not have the old 8-category list |
| G19 | `wellnessTemplateService.toCategory()` source accepts both new categories |
| G20 | `catalogMetadata.ts` lists all 10 categories and all 12 activity types |
| G21 | No unexpected Firestore write calls in the three Phase 18D-3B files |

All 21 guards (G1–G21) pass.

---

## Validation

```
npx tsc --noEmit                            → ✅ No errors
npm run build                               → ✅ Built in 7.71s
npx tsx scripts/auditWellnessActivityCatalog.ts → ✅ PASS (21/21 guards)
```

---

## Firestore Writes

None. No Firestore write functions were called. No seed scripts were executed. Guard G21 confirms this statically.

---

## Remaining Blocker Before Phase 18D-4 (Firestore Seed)

The only remaining blocker is the legacy `wellnessActivities` Firestore collection. Everything in the application code is now correct and ready for the new data:

- Local catalog: ✅ 67 activities, 10 categories, correct names, `targetType` on every entry
- Service fallback: ✅ will serve the new catalog if Firestore is empty
- Picker tabs: ✅ all 10 categories listed
- Category normalization: ✅ `toCategory()` accepts all 10 categories
- Type unions: ✅ all relevant types extended

**Phase 18D-4** (requires explicit approval): delete or overwrite the legacy Firestore `wellnessActivities` documents and seed from `WELLNESS_ACTIVITIES_CATALOG`. Once done, `getAllActivities()` will serve the correct data and the picker will show the new library.
