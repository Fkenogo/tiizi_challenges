# Phase 14B — Wellness Template Engine Parity

**Date:** 2026-06-26  
**Branch:** fix/p0-pre-deploy-blockers  
**Scope:** Migrate wellness templates to share the v2 challenge engine fully with fitness templates  
**Code changes:** 6 files  
**Schema changes:** Added engine-specific and lifecycle fields to `wellnessTemplates` documents (backward-compatible — `deriveStatus()` handles existing docs without `status` field)  
**Engine changes:** None  
**Scoring changes:** None  

---

## Audit Findings

### Gap 1 — `WellnessTemplate` type missing engine fields ❌ → Fixed
The `WellnessTemplate` interface in `src/types/index.ts` had no engine-specific fields. Any engine config set in the admin UI was structurally invisible to the wellness template system.

**Missing fields:**
- `groupCumulativeTarget?: number`
- `autoCompleteOnGroupTarget?: boolean`
- `requiredConsecutiveDays?: number`
- `streakResetOnMiss?: boolean`
- `targetType?: 'daily' | 'cumulative'` (on activities)
- Lifecycle fields: `status`, `version`, `usageCount`, timestamps, actor UIDs

### Gap 2 — `wellnessTemplateService.ts` didn't parse or persist engine fields ❌ → Fixed
- `fromDoc()` silently dropped `groupCumulativeTarget`, `autoCompleteOnGroupTarget`, `requiredConsecutiveDays`, `streakResetOnMiss`, `targetType` from Firestore docs
- `createTemplate()` accepted only `Omit<WellnessTemplate, 'id'>` — but since the type lacked engine fields, they could never be passed through
- No lifecycle operations existed (publish, unpublish, archive, restore, soft delete, duplicate)
- Status was derived only from `isPublished` boolean with no `deriveStatus()` safety net

### Gap 3 — Admin `CreateChallengeScreen.tsx` didn't send engine fields for wellness ❌ → Fixed
The fitness template creation path correctly passed `groupCumulativeTarget`, `autoCompleteOnGroupTarget`, `requiredConsecutiveDays`, `streakResetOnMiss` to `createTemplateMutation`. The wellness path called `wellnessTemplateService.createTemplate()` with none of these fields — they were silently discarded even though the same UI state held them.

### Gap 4 — `CreateChallengeWizard.tsx` didn't restore engine fields from wellness template ❌ → Fixed
When a user opened a wellness template detail screen and tapped "Adopt to Group", the wizard applied: name, description, challengeType, category, dates, and activities — but not engine config. A collective wellness template with `groupCumulativeTarget: 500` would create a collective challenge with `groupCumulativeTarget: 0`.

The fitness template apply effect already correctly restored engine fields (lines ~163-211). Wellness was missing the equivalent logic.

### Gap 5 — `WellnessTemplateDetailScreen.tsx` showed `type` as raw string, no engine info ❌ → Fixed
The template preview card displayed `{template.type}` as a plain text badge — no emoji, no engine explanation, no engine-specific field summary (unlike the fitness gallery which showed full engine badges with descriptions). A user viewing a wellness template had no way to understand what "collective" meant.

### Gap 6 — `useWellnessTemplates.ts` had no admin lifecycle hooks ❌ → Fixed
The fitness system had `usePublishTemplate`, `useArchiveTemplate`, `useDeleteTemplate`, etc. Wellness had none — no way for admin to manage the lifecycle of wellness templates from the UI.

---

## Wellness / Fitness Parity Matrix

| Capability | Fitness | Wellness Before | Wellness After |
|---|---|---|---|
| Engine type stored | ✅ | ✅ (type field) | ✅ |
| `groupCumulativeTarget` stored | ✅ | ❌ | ✅ |
| `autoCompleteOnGroupTarget` stored | ✅ | ❌ | ✅ |
| `requiredConsecutiveDays` stored | ✅ | ❌ | ✅ |
| `streakResetOnMiss` stored | ✅ | ❌ | ✅ |
| `targetType` on activities | ✅ | ❌ | ✅ |
| Engine fields restored in wizard | ✅ | ❌ | ✅ |
| Engine explanation in detail view | ✅ (gallery) | ❌ (raw string) | ✅ |
| Engine config shown in detail view | ✅ (gallery) | ❌ | ✅ |
| Lifecycle: status model | ✅ | ❌ (isPublished only) | ✅ |
| Lifecycle: version tracking | ✅ | ❌ | ✅ |
| Lifecycle: usageCount | ✅ | ❌ | ✅ |
| Lifecycle: publish/unpublish | ✅ | ❌ | ✅ |
| Lifecycle: archive/restore | ✅ | ❌ | ✅ |
| Lifecycle: soft delete | ✅ | ❌ | ✅ |
| Lifecycle: duplicate | ✅ | ❌ | ✅ |
| Admin lifecycle hooks | ✅ | ❌ | ✅ |
| Backward compat (`isPublished`) | ✅ | partial | ✅ |
| Admin `createTemplate` engine fields | ✅ | ❌ | ✅ |

**Permitted differences (by spec):** activity library (wellness activities vs exercises), wellness-specific categories, icon/color fields, `wellnessTemplates` vs `challengeTemplates` collection, `templateSource: 'admin'` filter.

---

## Remaining Legacy Paths

No legacy-specific rendering paths were removed from wellness templates in this phase — none existed. The wellness template system was simply underpowered rather than incorrectly implemented. All changes are additive (new fields, new methods, new hooks).

Legacy support for existing challenge instances (historical `challenges` documents) is unchanged — the fix is upstream in templates only.

---

## Files Changed

| File | Change |
|---|---|
| `src/types/index.ts` | Added engine fields (`groupCumulativeTarget`, `autoCompleteOnGroupTarget`, `requiredConsecutiveDays`, `streakResetOnMiss`), `targetType` on activities, and lifecycle fields to `WellnessTemplate` interface |
| `src/services/wellnessTemplateService.ts` | Full rewrite — `fromDoc()` now parses engine/lifecycle fields, `createTemplate()` accepts and persists engine fields, `deriveStatus()` added for backward compat, 8 new lifecycle methods added |
| `src/hooks/useWellnessTemplates.ts` | Added `useAllAdminWellnessTemplates`, `useCreateWellnessTemplate`, `useUpdateWellnessTemplate`, `usePublishWellnessTemplate`, `useUnpublishWellnessTemplate`, `useArchiveWellnessTemplate`, `useRestoreWellnessTemplate`, `useDeleteWellnessTemplate`, `useDuplicateWellnessTemplate` |
| `src/features/Admin/Challenges/CreateChallengeScreen.tsx` | Wellness template create path now conditionally passes `groupCumulativeTarget`/`autoCompleteOnGroupTarget` (collective) and `requiredConsecutiveDays`/`streakResetOnMiss` (streak) |
| `src/features/Challenges/CreateChallengeWizard.tsx` | Wellness template apply effect now restores all four engine-specific fields to wizard state (matching the fitness template apply behaviour) |
| `src/features/Challenges/WellnessTemplateDetailScreen.tsx` | Engine type now displayed with emoji + badge + description; engine-specific config (groupCumulativeTarget, requiredConsecutiveDays) shown in an info block |

---

## Regression Guards Added (14B-1 through 14B-13)

| Guard | Assertion |
|---|---|
| 14B-1 | `WellnessTemplate` type has all 4 engine-specific fields |
| 14B-2 | `WellnessTemplate` type has lifecycle fields (status, version, usageCount) |
| 14B-3 | `WellnessTemplate` activity has `targetType: 'daily' \| 'cumulative'` |
| 14B-4 | `wellnessTemplateService.fromDoc` parses all engine fields |
| 14B-5 | `wellnessTemplateService` exposes `createTemplate` |
| 14B-6 | `wellnessTemplateService` has `deriveStatus` for backward compat |
| 14B-7 | `deleteTemplate` is soft-delete, not `Firestore.deleteDoc` |
| 14B-8 | All 8 lifecycle methods present (parity with `challengeTemplateService`) |
| 14B-9 | All 5 admin lifecycle hooks exported from `useWellnessTemplates` |
| 14B-10 | `CreateChallengeWizard` applies `groupCumulativeTarget` and `requiredConsecutiveDays` from wellness template |
| 14B-11 | Admin `CreateChallengeScreen` wellness path passes engine fields to service |
| 14B-12 | `WellnessTemplateDetailScreen` shows engine explanation (not raw string) |
| 14B-13 | `WellnessTemplateDetailScreen` displays `groupCumulativeTarget` and `requiredConsecutiveDays` |

---

## Validation

```
npx tsc -b --pretty false           → 0 errors ✅
npm run build                       → ✓ built in 3.07s ✅
npm run test:scoring-guards         → scoring guards passed (13C-1 through 14A-15, 14B-1 through 14B-13) ✅
npm run test:home-challenge-feeds   → all guards passed ✅
```
