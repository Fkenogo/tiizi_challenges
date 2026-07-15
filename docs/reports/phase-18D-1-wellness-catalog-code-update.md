# Phase 18D-1 — Wellness Catalog Code Update

**Date:** 2026-06-28
**Branch:** fix/p0-pre-deploy-blockers
**Phase:** 18D-1 (catalog/type code changes only; no Firestore writes, no seed scripts)

---

## Objective

Implement the Phase 18C wellness activity framework in code:
- Update TypeScript types to add two new categories and four new activity types
- Update validation sets in the admin service
- Update UI dropdown lists in the form utils
- Rewrite the catalog (`wellnessActivitiesCatalog.ts`) to implement all 67 activities across 10 categories with `targetType` on every entry

---

## Files Modified

| File | Change |
|---|---|
| `src/types/wellnessActivity.ts` | Added `movement`, `health-monitoring` categories; added `steps`, `walking`, `yoga`, `monitoring` activity types; added optional `targetType` field |
| `src/services/adminWellnessActivityService.ts` | Extended `categoryOptions` and `activityTypeOptions` Sets |
| `src/features/Admin/Wellness/wellnessActivityFormUtils.ts` | Extended dropdown arrays for category and activity type |
| `src/data/wellnessActivitiesCatalog.ts` | Full rewrite — 10 categories, 67 activities |

---

## Catalog Summary

| Category | Activities | New | Retired |
|---|---|---|---|
| Movement & Steps | 8 | 8 | 0 (entirely new category) |
| Hydration | 5 | 1 | 4 |
| Sleep & Recovery | 6 | 1 | 2 |
| Mindfulness & Mental Wellness | 9 | 2 | 1 |
| Nutrition | 9 | 2 | 0 |
| Fasting | 4 | 2 | 6 |
| Habits & Discipline | 8 | 2 | 2 |
| Stress Management | 7 | 1 | 1 |
| Social & Relationships | 6 | 1 | 2 |
| Health Monitoring | 5 | 5 | 0 (entirely new category) |
| **Total** | **67** | **25** | **18** |

---

## ID Stability

All retained activities preserve their exact `shortName` values. The catalog ID formula `{category}-{slugify(shortName)}` means no existing Firestore references are orphaned. Examples:

| Display Name Change | shortName (unchanged) | ID (unchanged) |
|---|---|---|
| "2L Daily Hydration" → "Water Intake" | `2L Daily` | `hydration-2l-daily` |
| "8-Hour Sleep" → "Sleep" | `8hr Sleep` | `sleep-8hr-sleep` |
| "5-Minute Meditation" → "Meditation" | `5min Meditation` | `mindfulness-5min-meditation` |
| "Vegetable Servings" → "Vegetable Intake" | `5 Veg Servings` | `nutrition-5-veg-servings` |
| "16:8 Intermittent Fasting" → "Intermittent Fasting" | `16hr Fast` | `fasting-16hr-fast` |

---

## New Fields

- **`targetType`**: Added to `WellnessActivity` interface as optional `'daily' | 'cumulative' | 'weekly' | 'monthly'`. Defaulted to `'daily'` in `buildActivity`. Every seed in the catalog specifies a value. Movement activities that accumulate across the day use `'cumulative'`; community and meal planning activities use `'weekly'`; health monitoring appointments use `'monthly'`.

- **`activityType` override on seed**: Individual seeds can now override the category-level `activityType` default. Used for stress category activities that are walking/breathing rather than the default stress type.

---

## Validation

```
npx tsc --noEmit   → ✅ No errors
npm run build      → ✅ Built in 6.92s, no type errors
```

---

## What Was NOT Done (by design)

- No Firestore writes
- No seed scripts executed
- No Cloud Function changes
- No challenge engine logic changes
- No admin UI screen changes (dropdowns auto-populate from updated arrays)

---

## Next Steps

- **Phase 18D-2**: Add static audit guards to verify catalog integrity (ID uniqueness, shortName stability, required fields)
- **Phase 18D-3**: Admin preview — manually inspect the updated catalog in the admin UI (no writes)
- **Phase 18D-4**: Controlled Firestore seed — requires explicit user approval before execution
