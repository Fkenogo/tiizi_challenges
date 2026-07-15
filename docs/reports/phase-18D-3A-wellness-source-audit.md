# Phase 18D-3A — Wellness Activity Source Audit

**Date:** 2026-06-28
**Branch:** fix/p0-pre-deploy-blockers
**Type:** Audit only — no code changes, no Firestore writes

---

## 1. Root Cause (Summary First)

The UI shows legacy activities because `wellnessActivityService.getAllActivities()` reads **Firestore first**. It only falls back to the local catalog when Firestore returns an empty collection or a read error. The Firestore `wellnessActivities` collection is populated with the pre-18D-1 legacy data — `10-Min Mindfulness`, `20-Min Deep Practice`, `16-Hour Fast`, `18-Hour Fast`, `20-Hour Fast`, `24-Hour Fast`, etc. — and it always returns a non-empty result, so the new local catalog is **never reached in production**.

The new catalog in `src/data/wellnessActivitiesCatalog.ts` is correct and complete. It is not the problem. The problem is the Firestore collection that supersedes it at runtime.

---

## 2. Dependency Map

### All screens that display or allow selection of wellness activities

```
CreateChallengeWizard (src/features/Challenges/CreateChallengeWizard.tsx)
  ↓ useWellnessActivities (src/hooks/useWellnessActivities.ts)
  ↓ wellnessActivityService.getAllActivities() (src/services/wellnessActivityService.ts)
  ↓ Firestore: getDocs("wellnessActivities")  ← PRIMARY SOURCE (legacy data)
  ↓ fallback: WELLNESS_ACTIVITIES_CATALOG     ← NEVER REACHED (Firestore is non-empty)
  → renders via ChallengeActivitySection (src/features/Challenges/components/ChallengeActivitySection.tsx)
  → wellness picker modal reads wellnessActivities[] prop

Admin CreateChallengeScreen (src/features/Admin/Challenges/CreateChallengeScreen.tsx)
  ↓ useWellnessActivities (same hook)
  ↓ wellnessActivityService.getAllActivities()
  ↓ Firestore: getDocs("wellnessActivities")  ← PRIMARY SOURCE (legacy data)
  → renders via ChallengeActivitySection

Admin EditWellnessTemplateScreen (src/features/Admin/Challenges/EditWellnessTemplateScreen.tsx)
  ↓ useWellnessActivities (same hook)
  ↓ wellnessActivityService.getAllActivities()
  ↓ Firestore: getDocs("wellnessActivities")  ← PRIMARY SOURCE (legacy data)
  → renders via ChallengeActivitySection

Admin WellnessActivityListScreen (src/features/Admin/Wellness/WellnessActivityListScreen.tsx)
  ↓ useAdminWellnessActivities (src/hooks/useAdminWellnessActivities.ts)
  ↓ adminWellnessActivityService.getAdminWellnessActivities() (src/services/adminWellnessActivityService.ts)
  ↓ Firestore: getDocs("wellnessActivities")  ← DIRECT FIRESTORE READ (no fallback)

Admin AddWellnessActivityScreen (src/features/Admin/Wellness/AddWellnessActivityScreen.tsx)
  ↓ useCreateAdminWellnessActivity (src/hooks/useAdminWellnessActivities.ts)
  ↓ adminWellnessActivityService.createActivity()
  ↓ Firestore: setDoc("wellnessActivities/{id}")  ← WRITES TO FIRESTORE

Admin EditWellnessActivityScreen (src/features/Admin/Wellness/EditWellnessActivityScreen.tsx)
  ↓ useAdminWellnessActivity + useUpdateAdminWellnessActivity
  ↓ adminWellnessActivityService.getActivityById() / updateActivity()
  ↓ Firestore: getDoc / updateDoc("wellnessActivities/{id}")

WellnessTemplateGalleryScreen (src/features/Challenges/WellnessTemplateGalleryScreen.tsx)
  ↓ useWellnessTemplates (src/hooks/useWellnessTemplates.ts)
  ↓ wellnessTemplateService.getTemplates() (src/services/wellnessTemplateService.ts)
  ↓ Firestore: getDocs("wellnessTemplates")
  → Activities shown here come from the template document itself (stored at creation time)
  → NOT from wellnessActivities collection directly

ChallengesScreen (src/features/Challenges/ChallengesScreen.tsx)
  ↓ useWellnessTemplates
  ↓ wellnessTemplateService.getTemplates()
  ↓ Firestore: getDocs("wellnessTemplates")
  → Displays template names/previews only, not individual activities from the picker

SelectChallengeActivityScreen (src/features/Workouts/SelectChallengeActivityScreen.tsx)
  → Does NOT call useWellnessActivities at all
  → Reads challenge.activities[] directly from the challenge Firestore document
  → Activities shown here were baked in when the challenge was created
```

---

## 3. Complete Activity Source Inventory

### Source A — Firestore `wellnessActivities` collection (ACTIVE, LEGACY)

- **File:** Firestore database (remote)
- **Content:** Pre-18D-1 activities — includes `10-Min Mindfulness`, `20-Min Deep Practice`, `16-Hour Fast`, `18-Hour Fast`, `20-Hour Fast`, `24-Hour Fast`, and all legacy names
- **Seeded by:** `scripts/seedWellnessActivities.ts` (last run against the old catalog)
- **Read by:**
  - `wellnessActivityService.fromFirestore()` → used by `getAllActivities()`, `getActivitiesByCategory()`, `searchActivities()`, `getPopularActivities()`
  - `adminWellnessActivityService.getAdminWellnessActivities()` → used by admin list/edit screens
- **Priority:** FIRST — supersedes the local catalog as long as the collection is non-empty
- **Status:** **This is the live data source driving the picker. It is stale.**

### Source B — Local catalog `WELLNESS_ACTIVITIES_CATALOG` (CORRECT, INACTIVE)

- **File:** `src/data/wellnessActivitiesCatalog.ts`
- **Content:** Phase 18C/18D-1 framework — 67 activities, 10 categories, updated names, `targetType` field, no embedded quantities
- **Imported by:** `src/services/wellnessActivityService.ts` (as fallback only)
- **Read by:** `wellnessActivityService.fallbackCatalog()` → only reached when Firestore returns empty or errors
- **Status:** **Correct and complete. Never reached in production.**

### Source C — Hardcoded `WELLNESS_CATEGORIES` constant (STALE)

- **File:** `src/features/Challenges/components/ChallengeActivitySection.tsx` line 28–31
- **Content:**
  ```ts
  const WELLNESS_CATEGORIES = [
    'all', 'fasting', 'hydration', 'sleep', 'mindfulness',
    'nutrition', 'habits', 'stress', 'social',
  ] as const;
  ```
- **Missing:** `movement` and `health-monitoring`
- **Effect:** The category filter buttons in the wellness activity picker do not show Movement or Health Monitoring tabs, even once the Firestore data is replaced
- **Read by:** The wellness picker modal in `ChallengeActivitySection` (used by all three picker-bearing screens: `CreateChallengeWizard`, `CreateChallengeScreen`, `EditWellnessTemplateScreen`)

### Source D — `catalogMetadata.ts` constants (STALE, UNUSED)

- **File:** `src/services/catalogMetadata.ts`
- **Content:**
  ```ts
  export const WELLNESS_CATEGORY_OPTIONS: WellnessCategory[] = [
    'fasting', 'hydration', 'sleep', 'mindfulness',
    'nutrition', 'habits', 'stress', 'social',
    // missing: movement, health-monitoring
  ];
  export const WELLNESS_ACTIVITY_TYPE_OPTIONS: WellnessActivityType[] = [
    'fasting', 'water', 'sleep', 'meditation', 'food', 'habit', 'breathing', 'social',
    // missing: steps, walking, yoga, monitoring
  ];
  ```
- **Imported by:** Nothing — `grep -rn "catalogMetadata"` returns zero results. The file is exported but never imported anywhere in the codebase.
- **Status:** Dead code. Stale but harmless since it is unused.

### Source E — `wellnessTemplateService` (separate pipeline, not activity picker)

- **File:** `src/services/wellnessTemplateService.ts`
- **Content:** Reads/writes the `wellnessTemplates` Firestore collection
- **Data origin:** Templates contain denormalized activity data baked in at template creation time
- **Effect on picker:** None. Template activities are pre-stored; the picker is not involved at template display time.
- **Stale categories in toCategory():** `wellnessTemplateService.ts` line 32–44 only recognises 8 categories (`fasting`, `hydration`, `sleep`, `mindfulness`, `nutrition`, `habits`, `stress`, `social`). It will default `movement` and `health-monitoring` templates to `'habits'`. Secondary issue, not the picker root cause.

---

## 4. Why the Legacy Activities Are Shown

### Exact code path for "16-Hour Fast", "18-Hour Fast", "20-Hour Fast", "24-Hour Fast", "10-Min Mindfulness", "20-Min Deep Practice"

```
User opens wellness activity picker
  ↓
ChallengeActivitySection renders wellnessActivities[] prop
  ↓
Prop originates from useWellnessActivities() hook
  ↓
  src/hooks/useWellnessActivities.ts
    queryFn: async () => wellnessActivityService.getAllActivities()
  ↓
  src/services/wellnessActivityService.ts  getAllActivities()
    try {
      const items = await this.fromFirestore();   // ← EXECUTES
      if (items.length > 0) {
        return items.sort(...);                   // ← RETURNS HERE
      }
    }
    // fallback never reached
    return this.fallbackCatalog().sort(...);      // ← NEVER REACHED
  ↓
  fromFirestore()
    getDocs(collection(db, 'wellnessActivities')) // ← Reads legacy Firestore data
  ↓
  Returns legacy documents including:
    - "10-Min Mindfulness" (id: mindfulness-5min-meditation or similar legacy id)
    - "20-Min Deep Practice"
    - "16-Hour Fast", "18-Hour Fast", "20-Hour Fast", "24-Hour Fast"
    - All old embedded-quantity names
```

The fallback at line 78 (`return this.fallbackCatalog().sort(...)`) requires Firestore to return an empty snapshot OR throw a read error. Neither happens in production.

---

## 5. Duplicate Catalogs

There are **two** wellness activity data sources, one canonical and one obsolete:

| | Canonical | Obsolete |
|---|---|---|
| Location | `src/data/wellnessActivitiesCatalog.ts` | Firestore `wellnessActivities` collection |
| Activities | 67 (Phase 18C framework) | ~60 (legacy, includes retired activities) |
| Categories | 10 | 8 |
| Names | Target-free | Embedded quantities |
| `targetType` | Present | Absent |
| Screens using it | None (fallback only) | All picker screens (via getAllActivities) |

There is no second TypeScript catalog file. The duplication is between the local TS source and the Firestore collection.

---

## 6. Secondary Issues Found

### 6A. Hardcoded category list in `ChallengeActivitySection` (Source C)
Category filter tabs exclude `movement` and `health-monitoring` regardless of what data is returned. Fixing the Firestore data without fixing this means the two new categories will appear in unfiltered results only; their filter tabs won't exist.

### 6B. `toCategory()` in `wellnessTemplateService` (Source E)
Only validates 8 categories. Any new template or activity tagged `movement` or `health-monitoring` will be coerced to `'habits'` when stored via this service.

### 6C. `catalogMetadata.ts` (Source D)
Dead file — exports stale constants for 8 categories and 8 activity types, but is imported by nothing. No runtime impact, but adds confusion.

---

## 7. Implementation Plan (Replace the Legacy Source)

The correct fix is a **Firestore seed replacement**: delete or overwrite the legacy documents and write the Phase 18D-1 catalog. This is Phase 18D-4, which requires explicit user approval.

Before 18D-4 can run, two code fixes are needed so the new data is correctly displayed:

### Step 1 — Fix `ChallengeActivitySection` hardcoded category list (Source C)
**File:** `src/features/Challenges/components/ChallengeActivitySection.tsx` line 28–31

Replace the hardcoded `WELLNESS_CATEGORIES` constant with all 10 categories:
```ts
const WELLNESS_CATEGORIES = [
  'all', 'movement', 'hydration', 'sleep', 'mindfulness',
  'nutrition', 'fasting', 'habits', 'stress', 'social', 'health-monitoring',
] as const;
```

This is a pure UI fix — no data change, no Firestore. Required so the two new categories have filter tabs in the picker.

### Step 2 — Fix `wellnessTemplateService.toCategory()` (Source E)
**File:** `src/services/wellnessTemplateService.ts` line 32–44

Add `movement` and `health-monitoring` to the allowed-category guard so templates in those categories are stored and retrieved correctly.

### Step 3 — Delete/overwrite legacy Firestore documents (Phase 18D-4)
Run `scripts/seedWellnessActivities.ts` against the Phase 18D-1 catalog after explicit approval. This replaces the legacy collection with the 67-activity catalog. Once done, `getAllActivities()` returns the new data because Firestore will be non-empty with the new documents.

### Step 4 — (Optional cleanup) Remove or update `catalogMetadata.ts`
File is dead code. Can be deleted or updated to match the 10-category framework. No runtime effect either way.

---

## 8. Screens Not Affected

| Screen | Reason |
|---|---|
| `SelectChallengeActivityScreen` | Reads `challenge.activities[]` from the challenge document — activities were baked in at challenge creation. Not affected by Firestore `wellnessActivities` collection. |
| `WellnessTemplateGalleryScreen` | Reads `wellnessTemplates` collection, not `wellnessActivities`. Displays template-level data only. |
| `ChallengesScreen` | Same as above — only consumes templates, not the activity library. |
| `WellnessTemplateDetailScreen` | Reads a single template document by ID. Same pipeline. |

---

## 9. Files Audited

| File | Role | Status |
|---|---|---|
| `src/data/wellnessActivitiesCatalog.ts` | Canonical local catalog (67 activities) | ✅ Correct, never reached |
| `src/services/wellnessActivityService.ts` | Reads Firestore first, falls back to catalog | ⚠️ Firestore takes priority — legacy data wins |
| `src/hooks/useWellnessActivities.ts` | React Query wrapper over wellnessActivityService | Correct — delegates entirely to service |
| `src/hooks/useAdminWellnessActivities.ts` | Wraps adminWellnessActivityService (direct Firestore) | Correct — CRUD only |
| `src/services/adminWellnessActivityService.ts` | Admin CRUD on wellnessActivities collection | Correct — no fallback by design |
| `src/services/wellnessTemplateService.ts` | Reads/writes wellnessTemplates collection | ⚠️ `toCategory()` missing movement/health-monitoring |
| `src/features/Challenges/components/ChallengeActivitySection.tsx` | Picker UI shared by Wizard + Admin screens | ⚠️ Hardcoded 8-category filter list |
| `src/features/Challenges/CreateChallengeWizard.tsx` | Calls useWellnessActivities → shows picker | Receives stale Firestore data |
| `src/features/Admin/Challenges/CreateChallengeScreen.tsx` | Same pattern | Receives stale Firestore data |
| `src/features/Admin/Challenges/EditWellnessTemplateScreen.tsx` | Same pattern | Receives stale Firestore data |
| `src/features/Admin/Wellness/WellnessActivityListScreen.tsx` | Admin list via useAdminWellnessActivities | Shows stale Firestore data |
| `src/features/Admin/Wellness/AddWellnessActivityScreen.tsx` | Creates new Firestore documents | Functional |
| `src/features/Admin/Wellness/EditWellnessActivityScreen.tsx` | Edits existing Firestore documents | Functional |
| `src/features/Workouts/SelectChallengeActivityScreen.tsx` | Reads challenge.activities[] | Unaffected |
| `src/services/catalogMetadata.ts` | Exports stale category/type constants | ⚠️ Dead code — imported nowhere |
| `scripts/seedWellnessActivities.ts` | Seeds Firestore from local catalog | Correct — was last run against old catalog |

---

## RESULT: Audit Complete — No Code Changes Made
