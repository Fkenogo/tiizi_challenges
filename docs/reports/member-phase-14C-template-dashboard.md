# Phase 14C — Challenge Template Management Dashboard

**Date:** 2026-06-26  
**Branch:** fix/p0-pre-deploy-blockers  
**Scope:** Upgrade admin Challenge Templates module into a production-ready CMS dashboard  
**Code changes:** 2 files (`ChallengeTemplatesScreen.tsx` full rewrite, `scripts/testScoringGuards.ts` guards added)  
**Engine changes:** None  
**Scoring changes:** None  
**Firestore execution changes:** None  

---

## Audit Findings (Pre-Implementation)

### Gap 1 — Only fitness templates shown ❌ → Fixed
`ChallengeTemplatesScreen.tsx` called only `useAllAdminTemplates()` (fitness collection). The wellness `wellnessTemplates` collection was never loaded, making ~50% of the admin template library invisible to admins.

### Gap 2 — No analytics/usage bar ❌ → Fixed
No summary stats existed. Spec required: Total, Published, Draft, Archived, Most Used, Never Used — each as a clickable filter shortcut.

### Gap 3 — No bulk selection or bulk actions ❌ → Fixed
No per-card checkboxes, no select-all, no BulkActionBar. Admins had to act on each template individually.

### Gap 4 — No fitness/wellness collection filter ❌ → Fixed
No way to filter to only fitness or only wellness templates. With both collections merged into one view, this filter is essential for large template libraries.

### Gap 5 — Duplicate discarded return value, no edit navigation ❌ → Fixed
`onDuplicate` called `mutate(() => duplicateMutation.mutateAsync(id), ...)` which discards the returned new document ID. `duplicateTemplate()` returns `Promise<string>` (the new ID) — the screen never captured it, so navigating to the edit screen was impossible.

### Gap 6 — Archive dialog showed no usageCount warning ❌ → Fixed
The confirm dialog for archive/delete showed generic copy regardless of whether the template had been used to create challenges. A template with 100 active challenges could be archived silently.

### Gap 7 — Cards missing collection label, last updated, created by ❌ → Fixed
Template cards showed: name, engine type, status, version, usage count. Missing: fitness/wellness collection label, formatted last-updated date, created-by UID, formatted createdAt/publishedAt for version history.

### Gap 8 — Missing sort: oldest (createdAt); no unused filter ❌ → Fixed
Sort options were: recent (`updatedAt`), name, usage. Missing: oldest (`createdAt`). No "Unused" quick filter for finding templates with zero adoptions.

---

## Implementation

### Unified `AdminTemplate` type

Both Firestore collections are normalized into a single `AdminTemplate` interface with a `collection: 'fitness' | 'wellness'` discriminator. All filtering, sorting, and bulk operations are collection-agnostic.

```typescript
interface AdminTemplate {
  id: string;
  collection: TemplateCollection; // 'fitness' | 'wellness'
  name: string;
  description: string;
  challengeType: EngineType;
  status: TemplateStatus;
  version: number;
  usageCount: number;
  coverImageUrl?: string;
  difficultyLevel?: string;
  durationDays?: number;
  activityCount: number;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string;
  createdBy?: string;
  wellnessCategory?: string;
}
```

### Analytics strip

A horizontally scrollable strip of stat pills at the top. Each pill is a shortcut: tapping Published filters to `statusFilter = 'published'`, tapping Never Used applies `unusedOnly = true`, tapping Most Used sorts by usage descending.

### Bulk selection

Per-card checkboxes (visible on hover, always visible when any card is selected). Select-all toggle in the results row header. Sticky `BulkActionBar` appears at bottom of screen when ≥1 card is selected, with: Publish / Archive / Restore / Delete buttons. Bulk operations call services directly with `Promise.all` — one round trip per action type, not one per template.

### Duplicate workflow

`handleDuplicate()` awaits `mutateAsync()` and captures the returned new document ID. For fitness: navigates directly to `/app/admin/challenges/templates/${newId}/edit`. For wellness (no edit screen): shows a toast explaining the template was duplicated as a draft.

### Archive safety

`ConfirmDialog` receives `usageCount` from the template. When `usageCount > 0`, the dialog renders an amber warning block: "⚠️ This template has been used to create N challenges. Those challenges will not be affected, but new users won't be able to select this template."

### Version history on cards

Each card footer shows: version number, usage count, formatted `createdAt`, formatted `updatedAt` (when different from `createdAt`), formatted `publishedAt`, and a truncated `createdBy` UID.

### Collection filter

New `CollectionFilter = 'all' | 'fitness' | 'wellness'` filter chips displayed above the status filter row.

### Sort additions

- `createdAt` (oldest first) added as a sort option.
- `unusedOnly` boolean filter: `usageCount === 0`.

---

## Files Changed

| File | Change |
|---|---|
| `src/features/Admin/Challenges/ChallengeTemplatesScreen.tsx` | Full rewrite — combined fitness+wellness view, AnalyticsStrip, BulkActionBar, CollectionFilter, duplicate-navigate, usageCount safety warning, version history on cards, createdAt sort, unused filter |
| `scripts/testScoringGuards.ts` | Added 14C-1 through 14C-13 guards |

---

## Regression Guards Added (14C-1 through 14C-13)

| Guard | Assertion |
|---|---|
| 14C-1 | Screen loads both `useAllAdminTemplates` and `useAllAdminWellnessTemplates` |
| 14C-2 | Normalizes both into unified `AdminTemplate` with `collection` field |
| 14C-3 | `AnalyticsStrip` shows Published / Draft / Archived / Never Used stats |
| 14C-4 | `BulkActionBar`, `selected` Set, and `toggleSelectAll` present |
| 14C-5 | `CollectionFilter` (all/fitness/wellness) present |
| 14C-6 | `handleDuplicate` captures new ID and navigates to edit for fitness |
| 14C-7 | `usageCount` passed to `ConfirmDialog` for safety warning |
| 14C-8 | Cards display `createdAt`, `updatedAt`, `publishedAt` |
| 14C-9 | Sort-by-oldest (`createdAt` / `Oldest`) present |
| 14C-10 | `unusedOnly` filter and `Unused` label present |
| 14C-11 | Bulk ops use `challengeTemplateService`/`wellnessTemplateService` directly with `Promise.all` |
| 14C-12 | `useAllAdminWellnessTemplates` exported from `useWellnessTemplates` |
| 14C-13 | `COLLECTION_BADGE` or equivalent Fitness/Wellness collection badge on cards |

---

## Validation

```
npx tsc -b --pretty false           → 0 errors ✅
npm run build                       → ✓ built in 3.52s ✅
npm run test:scoring-guards         → scoring guards passed (through 14C-13) ✅
```
