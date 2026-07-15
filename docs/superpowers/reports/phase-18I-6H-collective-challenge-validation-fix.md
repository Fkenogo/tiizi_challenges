# Phase 18I-6H: Fix Collective Challenge Creation (Stale groupCumulativeTarget Validation)

**Date:** 2026-07-02  
**Branch:** fix/p0-pre-deploy-blockers  
**Commit:** 0131ade  
**Status:** ✅ Complete — 44/44 activity model guards, all suites passing, TypeScript clean, build clean

---

## Problem

Admin could not create a Collective fitness challenge template. Error:

> "Set a group cumulative target greater than zero."

The member Challenge Wizard triggered the same error. Both paths were blocked even when the activity had a valid `targetValue > 0`.

---

## Root Cause

`challengeFormValidation.ts` contained a stale check:

```ts
if (!input.groupCumulativeTarget || Number(input.groupCumulativeTarget) <= 0) {
  return 'Set a group cumulative target greater than zero.';
}
```

The UI for entering a separate `groupCumulativeTarget` had been removed from `ChallengeEngineSettingsSection` — the MVP rule is that `groupCumulativeTarget` equals `activities[0].targetValue` and is derived at payload time. But the validation interface (`ChallengeFormValidationInput`) still accepted `groupCumulativeTarget: string`, and the callers were still passing the now-always-empty state variable `''` → the check always blocked.

---

## Files Changed

| File | Change |
|------|--------|
| `src/features/Challenges/utils/challengeFormValidation.ts` | Removed `groupCumulativeTarget: string` from `ChallengeFormValidationInput`; removed stale blocking check |
| `src/features/Challenges/CreateChallengeWizard.tsx` | Removed `groupCumulativeTarget` from `validateChallengeForm` call; fixed "Ready to launch?" collective checklist item to check `activities.some(a => Number(a.targetValue) > 0)` |
| `src/features/Admin/Challenges/CreateChallengeScreen.tsx` | Removed `groupCumulativeTarget` from `validateChallengeForm` call |
| `src/features/Admin/Challenges/EditWellnessTemplateScreen.tsx` | Removed `groupCumulativeTarget` from `validationInput` useMemo and its dependency array |
| `scripts/auditChallengeCreationPayloads.ts` | Removed `groupCumulativeTarget` from test `validateChallengeForm` call (was causing TS2353) |
| `scripts/testChallengeActivityModel.ts` | Added Phase 18I-6H guards (9 new, total 44/44) |

---

## What Was NOT Changed

- **Payload derivation** — all four creation/edit paths (`CreateChallengeWizard`, `CreateChallengeScreen`, `EditChallengeTemplateScreen`, `EditWellnessTemplateScreen`) already derived `groupCumulativeTarget: Number(finalActivities[0]?.targetValue ?? 0)` correctly.
- **`EditChallengeTemplateScreen`** — does not call `validateChallengeForm`; no change needed.
- **Backend / services** — `challengeService.ts` still accepts `groupCumulativeTarget?: number` on the payload (optional field); frontend now always sends the derived number for collective.
- **Competitive and Streak creation** — unaffected; their validation paths were not touched.
- **Unit consistency check** — the remaining collective validation (`units.size > 1` → error) is correct and preserved.

---

## Validation Rule After Fix

For Collective challenges, `validateChallengeForm` now:

1. Requires at least one named activity with `targetValue > 0` (existing check, line 40)
2. Requires each named activity has `targetValue > 0` (existing check, line 44)
3. Requires all activities share the same unit (existing check, line 50–53)
4. ~~Requires `groupCumulativeTarget > 0`~~ **Removed** — this is now always derived.

---

## Validation Suite Results

```
tsc --noEmit                       clean ✅
npm run build                      clean ✅
test:challenge-activity-model      44/44 ✅  (+9 new Phase 18I-6H guards)
test:admin-challenge-management    66/66 ✅
test:scoring-guards                all passed ✅
test:challenge-creation-backend    all passed ✅
test:challenge-creation-6combos    all passed ✅
test:home-challenge-feeds          all passed ✅
audit:challenge-creation-payloads  all passed ✅
audit:challenge-templates          all passed ✅
```

---

## Manual Test Checklist

- [ ] Admin creates Collective fitness template with one activity targetValue > 0 → succeeds
- [ ] Admin creates Collective wellness template with one activity targetValue > 0 → succeeds
- [ ] Member creates Collective challenge from wizard with one activity targetValue > 0 → succeeds
- [ ] Firestore doc includes `groupCumulativeTarget` equal to `activities[0].targetValue`
- [ ] "Ready to launch?" checklist shows "Group target set ✓" when activity has targetValue
- [ ] Error "Set a group cumulative target" is NOT shown when activity has targetValue > 0
- [ ] Collective creation with no activity or targetValue = 0 still fails validation (different message)
- [ ] Competitive creation still works
- [ ] Streak creation still works
