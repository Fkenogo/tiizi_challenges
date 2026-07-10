# Phase 14D — Template Snapshot & Version Integrity Audit

**Date:** 2026-06-26  
**Branch:** fix/p0-pre-deploy-blockers  
**Scope:** Architecture audit of template → challenge data-flow; snapshot integrity verification  
**Code changes:** 4 files (3 bugs fixed)  
**Engine changes:** None  
**Scoring formula changes:** None  

---

## Data-Flow Diagram

```
Admin creates template (challengeTemplates / wellnessTemplates)
        │
        │  templateId stored in URL param only
        │  template fields copied into wizard state (React useState)
        ▼
CreateChallengeWizard (client state)
  name, description, coverImageUrl, activities[], engine config,
  startDate, endDate, durationDays (computed), challengeType
        │
        │  createChallenge(payload) → Firestore write
        ▼
challenges/{challengeId}  ◄── SNAPSHOT (fully copied, no live reference)
  name, description, coverImageUrl, activities[],
  durationDays, engineVersion, challengeType,
  groupCumulativeTarget, autoCompleteOnGroupTarget,
  requiredConsecutiveDays, streakResetOnMiss,
  startDate, endDate, createdBy, groupId, status, ...
        │
        │  workoutService / wellnessLogService / activityLogSessionService
        │  read ONLY from challenges/{id} — never from template collections
        ▼
Scoring (computeActivityScore, deriveDailyTargetValue, computeRequiredLogs)
        │
        ▼
challengeMembers/{id}  (points, completionRate, streak, cumulativeValues)
```

---

## Field Copy Audit

### Fields copied from template → wizard state → challenge document

| Field | Fitness template | Wellness template | Challenge document |
|---|---|---|---|
| `name` | ✅ | ✅ | ✅ stored as `name` |
| `description` | ✅ | ✅ | ✅ |
| `coverImageUrl` | ✅ | ✅ (as `coverImage`) | ✅ |
| `challengeType` | ✅ | ✅ (as `type`) | ✅ |
| `activities[].targetValue` | ✅ | ✅ | ✅ |
| `activities[].unit` | ✅ | ✅ | ✅ |
| `activities[].targetType` | ✅ | ✅ | ✅ **fixed (Bug 2)** |
| `activities[].instructions` / `protocolSteps` | ✅ | ✅ | ✅ |
| `groupCumulativeTarget` | ✅ | ✅ | ✅ |
| `autoCompleteOnGroupTarget` | ✅ | ✅ | ✅ |
| `requiredConsecutiveDays` | ✅ | ✅ | ✅ |
| `streakResetOnMiss` | ✅ | ✅ | ✅ |
| `engineVersion` | always `'v2'` | always `'v2'` | ✅ |
| `durationDays` | used to set endDate | used to set endDate | ✅ **fixed (Bug 1)** |
| `category` | ✅ | ✅ | ✅ |
| `difficultyLevel` | UI only | UI only | not stored (by design) |

### Fields NOT copied (by design)

| Field | Reason |
|---|---|
| `templateId` | Not stored on challenge; no current consumer reads it. Absence doesn't affect scoring or integrity. Recommended as future analytics field. |
| `templateVersion` | Same reason — useful for analytics only. |
| `usageCount` | Template field, not a challenge field |
| `status` (template lifecycle) | Template field, not a challenge field |

---

## Bugs Found and Fixed

### Bug 1 — `durationDays` not stored in challenge document (HIGH SEVERITY)

**Location:** `src/services/challengeService.ts` → `createChallenge()`

**Root cause:** `durationDays` was in `CreateChallengeInput` and was used to derive `endDate` when `endDate` was absent, but was never added to the Firestore payload.

**Impact:**
- `computeRequiredLogs(challenge.durationDays, activityCount)` fell back to `durationDays = 1`. For a 21-day challenge with 1 activity, `totalActivities = 1` instead of `21`. Any member logging once would complete the challenge on day 1.
- `deriveDailyTargetValue` used `durationDays` as denominator for cumulative streak targets. With `durationDays = 1`, there was no reduction — users were scored against the full cumulative target each day.

**Fix:** `challengeService.createChallenge()` now computes `durationDays = Math.max(1, Math.round((endDate - startDate) / ms_per_day))` and writes it to the payload.

---

### Bug 2 — `targetType` not in `Challenge.activities` type and not copied (MEDIUM SEVERITY)

**Location:** `src/types/index.ts` → `Challenge.activities`; `src/features/Challenges/CreateChallengeWizard.tsx` → activity mapping

**Root cause:** `targetType?: 'daily' | 'cumulative'` was defined on `WellnessTemplate.activities` (Phase 14B) but was never added to `Challenge.activities` nor included in the wizard's activity-mapping block.

**Impact:**
- Scoring engine reads `activityConfig?.targetType` from challenge document. Without the field, it always used the heuristic fallback (`targetValue / durationDays`). Templates explicitly tagged as `targetType: 'daily'` were silently treated as cumulative.
- For streak challenges, activities with explicit `targetType: 'daily'` would be scored with the wrong effective target once Bug 1 was fixed (correct `durationDays` but no `targetType` → heuristic divides a daily target by duration days).

**Fix:** Added `targetType?: 'daily' | 'cumulative'` to `Challenge.activities` in `types/index.ts`; added `targetType: activity.targetType` to the wizard's activity-mapping block; added `targetType` to `ActivityRow` local type.

---

### Bug 3 — `incrementUsageCount` never called (LOW SEVERITY — data accuracy)

**Location:** `challengeTemplateService.incrementUsageCount` and `wellnessTemplateService.incrementUsageCount` existed but were never invoked.

**Impact:** Template `usageCount` was always 0. The 14C admin dashboard "Never Used" pill and usage-count sort were permanently wrong.

**Fix:** `CreateChallengeWizard.handleLaunch()` now fires `challengeTemplateService.incrementUsageCount(templateId)` and `wellnessTemplateService.incrementUsageCount(wellnessTemplateId)` as fire-and-forget calls after a successful `createChallenge.mutateAsync()`. If the increment fails, the challenge is already created — the error is silently swallowed (`.catch(() => null)`).

---

## Isolation Verification

### Editing a template cannot affect existing challenges ✅ CONFIRMED

All template fields are fully copied into the challenge document at creation time. The three scoring services (`workoutService`, `wellnessLogService`, `activityLogSessionService`) import nothing from `challengeTemplateService` or `wellnessTemplateService` — they read from `challenges/{id}` only.

| Scenario | Result |
|---|---|
| Admin edits template name/description | Existing challenges unaffected — name was copied at creation |
| Admin changes template activities or targets | Existing challenges unaffected — activities were snapshot-copied |
| Admin changes engine config (groupCumulativeTarget, etc.) | Existing challenges unaffected — engine fields copied at creation |
| Admin publishes new template version | Future challenges use new version; existing are unchanged |
| Admin archives a template | Existing challenges unaffected — they hold a complete copy |
| Admin deletes (soft) a template | Existing challenges unaffected — Firestore document retained |

### Publishing a new template version only affects future challenges ✅ CONFIRMED

`updateTemplate()` and `publishTemplate()` in both services write to the template document only. No challenge documents are touched.

### Duplicate template creates a new lineage ✅ CONFIRMED

`duplicateTemplate()` creates a new Firestore document with a new ID and `status: 'draft'`. No link is maintained to the source template except the `name` field (which is copied). There is no `parentTemplateId` field — each duplicate is an independent template.

### Archived templates remain usable by existing challenges ✅ CONFIRMED

Existing challenges hold all data. They never re-fetch from the template collection. Archiving has zero runtime effect on challenges.

---

## Findings NOT Fixed (Architecture Gaps, Not Defects)

### `templateId` / `templateVersion` absent from challenge documents

The challenge document does not store which template it was created from, or which version of that template. This means:

- Admin cannot see "challenges spawned from this template" in the dashboard
- If a template is updated, there is no way to diff existing challenges against the new template version
- Analytics (which template is most effective) requires cross-referencing `usageCount` on the template, not per-challenge data

**Recommendation for a future phase:** Store `templateId?: string` and `templateVersion?: number` on the challenge document at creation time. This is additive and backward-compatible (existing challenges simply lack the field).

---

## Files Changed

| File | Change |
|---|---|
| `src/services/challengeService.ts` | Compute `durationDays` from `startDate`/`endDate` and include in Firestore payload |
| `src/types/index.ts` | Add `targetType?: 'daily' \| 'cumulative'` to `Challenge.activities` |
| `src/features/Challenges/CreateChallengeWizard.tsx` | Add `targetType` to `ActivityRow`; copy `activity.targetType` in payload mapping; call `incrementUsageCount` after successful challenge creation |
| `scripts/testScoringGuards.ts` | Added 14D-1 through 14D-9 guards |

---

## Regression Guards Added (14D-1 through 14D-9)

| Guard | Assertion |
|---|---|
| 14D-1 | `createChallenge` computes `durationDays` from `startDate`/`endDate` timestamps |
| 14D-2 | `durationDays` is in the Firestore payload (not just a local variable) |
| 14D-3 | `Challenge.activities` type includes `targetType` |
| 14D-4 | `ActivityRow` includes `targetType` |
| 14D-5 | Wizard copies `activity.targetType` into challenge payload |
| 14D-6 | Wizard calls `challengeTemplateService.incrementUsageCount` for fitness templates |
| 14D-7 | Wizard calls `wellnessTemplateService.incrementUsageCount` for wellness templates |
| 14D-8 | `workoutService` and `wellnessLogService` do not import template services |
| 14D-9 | `createChallenge` builds from input, not by re-fetching templates |

---

## Validation

```
npx tsc -b --pretty false           → 0 errors ✅
npm run build                       → ✓ built in 5.88s ✅
npm run test:scoring-guards         → scoring guards passed (through 14D-9) ✅
```
