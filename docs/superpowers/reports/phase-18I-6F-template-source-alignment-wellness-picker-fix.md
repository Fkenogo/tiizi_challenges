# Phase 18I-6F — Template Source Alignment + Wellness Picker Bug Fix

**Date:** 2026-07-02
**Branch:** fix/p0-pre-deploy-blockers

---

## Summary

Two issues found during manual testing of Phase 18I-6E. Both resolved:

1. **Wellness picker first-click bug** — When adding a second wellness activity in a multi-activity streak, the fitness exercise picker opened instead of the wellness activity picker. Fixed by branching `addActivity()` on `isWellnessMode` in `CreateChallengeWizard.tsx`.

2. **Fitness template data flow audit** — Full audit confirmed the data flow is correct: single source of truth is Firestore `challengeTemplates`, admin dashboard reads/writes the same collection, no static fallbacks exist. The 8-vs-7 discrepancy between Firestore count and admin dashboard is expected behavior (one soft-deleted document). Audit script created for ongoing verification.

---

## Issue A — Wellness Picker Root Cause

### What happened

`addActivity()` in `CreateChallengeWizard.tsx` (the callback wired to the "Add Another Activity" button) always executed:

```ts
setPickerRowIndex(nextIndex);   // ← always ran regardless of isWellnessMode
setPickerSearch('');
setPickerTier('All');
```

`fitnessPicker` is derived as `pickerRowIndex !== null`. Setting `pickerRowIndex` always opened the fitness picker, regardless of whether the challenge was in wellness mode.

On the **second** click (tapping the activity row's input), `openPicker(index)` in `ChallengeActivitySection` correctly routed to `onOpenWellnessPicker(index)` because `isWellnessMode` was checked there. That's why the second click worked.

### Fix

```ts
const addActivity = () => {
  const nextIndex = activities.length;
  setActivities((prev) => [...prev, { ..., unit: isWellnessMode ? 'count' : 'Reps' }]);
  if (isWellnessMode) {
    setPickerRowIndex(nextIndex);
    setWellnessPickerOpen(true);    // ← was missing
    setWellnessSearch('');
    setWellnessCategoryFilter('all');
  } else {
    setPickerRowIndex(nextIndex);
    setPickerSearch('');
    setPickerTier('All');
  }
};
```

### Why admin screens are not affected

`CreateChallengeScreen.tsx` (admin)'s `addActivity` does not auto-open any picker — it only adds the activity row. The user must click the row explicitly to open the picker, which routes through `openWellnessPicker` correctly. No bug there.

---

## Issue B — Fitness Template Data Flow Audit

### Answers to audit questions

| Question | Answer |
|---|---|
| Source of truth for fitness templates? | Firestore `challengeTemplates` collection |
| Admin dashboard reads from Firestore? | ✅ Yes — via `challengeTemplateService.getAllTemplatesAdmin()` |
| Admin create/edit/delete writes to Firestore? | ✅ Yes — all mutations go through `challengeTemplateService` |
| Old seed templates filtered in dashboard? | `getAllTemplatesAdmin()` hides `status='deleted'`; drafts are visible |
| Why 8 Firestore vs 7 admin? | Expected: one soft-deleted doc (status='deleted') retained in Firestore |
| Duplicate sources? | No — fitness uses `challengeTemplates`, wellness uses `wellnessTemplates` |
| Deactivated seed templates visible to users? | Only if `status='published'` or missing `status` + `isPublished=true` |

### Legacy template handling

`deriveStatus()` in `challengeTemplateService.ts` handles templates seeded before the `status` field was introduced:
- If `status` field is absent and `isPublished !== false` → treated as `'published'`
- If `status` field is absent and `isPublished === false` → treated as `'draft'`

This means old seed templates with no explicit `status` will appear as **published** to users unless they were explicitly unpublished. To hide them: archive or delete via admin dashboard.

### Seed script warning

`seedAppData.ts` overwrites `challengeTemplates` documents with `setDocs()` without checking if they exist first. **Do not re-run `seedAppData.ts` against production** — it will overwrite admin-managed templates. The audit script warns about this.

---

## Files Changed

| File | Change |
|---|---|
| `src/features/Challenges/CreateChallengeWizard.tsx` | `addActivity()` branches on `isWellnessMode`: opens wellness picker (not fitness picker) in wellness mode |
| `scripts/auditChallengeTemplates.ts` | New 28-guard audit script covering single source of truth, admin read/write path, seed safety, picker fix verification |
| `package.json` | Added `audit:challenge-templates` npm script |

---

## Validation

| Command | Result |
|---|---|
| `npx tsc --noEmit` | ✅ clean |
| `npm run build` | ✅ built in 2.98s |
| `npm run test:challenge-activity-model` | ✅ 35/35 |
| `npm run test:scoring-guards` | ✅ passed |
| `npm run test:challenge-creation-backend` | ✅ passed |
| `npm run test:challenge-creation-6combos` | ✅ passed |
| `npm run test:home-challenge-feeds` | ✅ passed |
| `npm run audit:challenge-creation-payloads` | ✅ passed |
| `npm run audit:challenge-templates` | ✅ 28/28 |

---

## Firestore Cleanup Recommendation

The 8-vs-7 discrepancy is explained by one soft-deleted document. No Firestore writes are needed.

If you see unexpected templates appearing in the app's "Suggested Challenges" screen for users, check those documents in the Firestore console:
- Look for documents without a `status` field AND `isPublished: true` — these will appear as published
- Archive or delete them via the admin dashboard at `/admin/challenges/templates`
- Do NOT re-run `seedAppData.ts` against production data
