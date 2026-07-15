# Phase 14A — Complete Challenge Template Management

**Date:** 2026-06-26  
**Branch:** fix/p0-pre-deploy-blockers  
**Scope:** Upgrade admin template module from creation-only to full lifecycle management  
**Code changes:** 6 files (2 rewrites, 2 new, 2 modified)  
**Schema changes:** Added lifecycle fields to `challengeTemplates` documents (backward-compatible)  
**Engine changes:** None  
**Scoring changes:** None  
**Firestore challenge execution changes:** None  

---

## Summary

Prior to this phase, the admin template module could only **create** templates — there was no way to edit, publish, unpublish, archive, restore, or delete an existing template from the admin UI. The only status indicator was a "Published / Draft" badge that admins could not change.

Phase 14A delivers a complete lifecycle management system:

| Capability | Before | After |
|---|---|---|
| View all templates | Published only (user-facing hook) | All non-deleted, with status filter |
| Edit template | Not possible | Full edit form at `/admin/challenges/templates/:id/edit` |
| Publish / Unpublish | Not possible | One-click with confirmation for unpublish |
| Archive / Restore | Not possible | One-click with confirmation for archive |
| Duplicate | Not possible | One-click |
| Soft delete | Not possible | One-click with confirmation |
| Search | Not available | Real-time name + description search |
| Filter by status | Not available | All / Published / Draft / Archived with counts |
| Filter by engine type | Available | Still available |
| Sort | Not available | Recent / Name / Usage |
| Create as draft | Always published | Save as Draft or Save & Publish |
| Version tracking | Not tracked | Increments on every update, shown in edit form |
| Usage count | Not tracked | Incremented on template use, shown on card |

---

## Lifecycle Model

```
Draft → Published ← → Unpublished (→ Draft)
      ↓           ↓
    Archive ←———————
      ↓
    Restore → Draft
      ↓
    Delete (soft — status=deleted, document retained)
```

**Backward compatibility:** Existing templates have `isPublished: boolean` but no `status` field. `deriveStatus()` in `challengeTemplateService.ts` derives the status at read time: `isPublished !== false → 'published'`, otherwise `'draft'`. All new writes include an explicit `status` field.

---

## Files Changed

| File | Change |
|---|---|
| `src/services/challengeTemplateService.ts` | **Full rewrite** — `TemplateStatus` type, lifecycle fields on `SuggestedChallengeTemplate`, `deriveStatus()` for backward compat, 8 new service methods, `createTemplate` now defaults to draft |
| `src/hooks/useChallengeTemplates.ts` | **Full rewrite** — 8 new mutation hooks, `useAllAdminTemplates` for admin, `invalidateAll()` helper, original hooks preserved |
| `src/features/Admin/Challenges/ChallengeTemplatesScreen.tsx` | **Rewritten** — full management UI with search, status filter, engine filter, sort, action menus, confirmation dialogs, template cards showing cover/type/status/version/usage |
| `src/features/Admin/Challenges/EditChallengeTemplateScreen.tsx` | **New** — full edit form pre-populated from existing template, Save as Draft / Save & Publish buttons, version info, engine-specific config sections |
| `src/features/Admin/Challenges/CreateChallengeScreen.tsx` | **Modified** — `onSaveTemplate(publish: boolean)` accepts flag, two buttons (Save as Draft / Save & Publish), defaults to `isPublished: false` |
| `src/App.tsx` | **Modified** — lazy import + route `/app/admin/challenges/templates/:id/edit` |

---

## New Service Methods (`challengeTemplateService.ts`)

| Method | Description |
|---|---|
| `getAllTemplatesAdmin()` | All non-deleted templates sorted by `updatedAt` desc |
| `updateTemplate(id, actorUid, payload)` | Partial update, increments `version`, stamps `updatedAt`/`updatedBy` |
| `publishTemplate(id, actorUid)` | Sets `status=published`, `isPublished=true`, stamps `publishedAt` |
| `unpublishTemplate(id, actorUid)` | Sets `status=draft`, `isPublished=false` |
| `archiveTemplate(id, actorUid)` | Sets `status=archived`, `isPublished=false`, stamps `archivedAt` |
| `restoreTemplate(id, actorUid)` | Sets `status=draft`, `isPublished=false`, clears `archivedAt` |
| `deleteTemplate(id, actorUid)` | **Soft delete** — sets `status=deleted`, document retained |
| `duplicateTemplate(id, actorUid)` | Creates new doc with `(Copy)` suffix, `status=draft`, `version=1`, `usageCount=0` |
| `incrementUsageCount(id)` | Incremented when a challenge is created from a template |

---

## New Lifecycle Fields on `SuggestedChallengeTemplate`

| Field | Type | Notes |
|---|---|---|
| `status` | `TemplateStatus` | Derived from `isPublished` for legacy docs |
| `isPublished` | `boolean` | Kept for backward compat |
| `version` | `number` | Starts at 1, increments on every `updateTemplate` call |
| `usageCount` | `number` | Incremented via `incrementUsageCount` |
| `createdAt` | `string?` | ISO timestamp |
| `updatedAt` | `string?` | ISO timestamp |
| `publishedAt` | `string?` | ISO timestamp |
| `archivedAt` | `string?` | ISO timestamp |
| `createdBy` | `string?` | Firebase UID |
| `updatedBy` | `string?` | Firebase UID |

---

## Scoring Guards Added (14A-1 through 14A-15)

| Guard | Assertion |
|---|---|
| 14A-1 | `TemplateStatus` has all 4 lifecycle states |
| 14A-2 | `deriveStatus()` backward compat using `isPublished` |
| 14A-3 | All 9 service methods present |
| 14A-4 | `deleteTemplate` is soft-delete, not `Firestore.deleteDoc` |
| 14A-5 | `duplicateTemplate` resets `usageCount=0`, `version=1` |
| 14A-6 | All 8 mutation hooks exported from `useChallengeTemplates` |
| 14A-7 | Mutations invalidate `admin-challenge-templates-all` query key |
| 14A-8 | `ChallengeTemplatesScreen` uses `useAllAdminTemplates` |
| 14A-9 | Search state exists on list screen |
| 14A-10 | Status filter with draft/archived present |
| 14A-11 | Confirmation dialog for destructive actions |
| 14A-12 | `EditChallengeTemplateScreen` uses `useParams` and pre-populates |
| 14A-13 | Edit screen has both Save as Draft / Save & Publish buttons |
| 14A-14 | Create screen has both Save as Draft / Save & Publish buttons |
| 14A-15 | Edit route registered in `App.tsx` |

---

## Validation

```
npx tsc -b --pretty false         → 0 errors ✅
npm run build                     → ✓ built in 3.15s ✅
npm run test:scoring-guards       → scoring guards passed (13C-1 through 14A-15) ✅
```
