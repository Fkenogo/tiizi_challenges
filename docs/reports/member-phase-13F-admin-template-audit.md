# Phase 13F — Admin & Template Workflow Audit

**Date:** 2026-06-26  
**Branch:** fix/p0-pre-deploy-blockers  
**Scope:** Admin challenge modules, template services, and user-facing wizard — verified against v2 engine implementation  
**Code changes:** 3 files modified  
**Schema changes:** None  
**Firestore rules changes:** None

---

## Audit Scope

All admin challenge modules audited:

| Module | File | Status |
|---|---|---|
| Challenge Templates list | `Admin/Challenges/ChallengeTemplatesScreen.tsx` | No defects — read-only display |
| Create Template (admin) | `Admin/Challenges/CreateChallengeScreen.tsx` | **DEFECT-13F-1 — FIXED** |
| Active Challenges | `Admin/Challenges/ActiveChallengesScreen.tsx` | No defects — display only |
| Challenge Analytics | `Admin/Challenges/ChallengeAnalyticsScreen.tsx` | No defects — aggregate metrics |
| Pending Challenges | `Admin/AdminPendingChallengesScreen.tsx` | Minor (non-blocking, noted below) |
| Approved Challenges | `Admin/AdminApprovedChallengesScreen.tsx` | No defects — minimal list |
| Template Service | `services/challengeTemplateService.ts` | **DEFECT-13F-2 — FIXED** |
| Admin Challenge Service | `services/adminChallengeService.ts` | `createChallengeFromAdmin` is dead code — no action |
| Admin Hook | `hooks/useAdminChallenges.ts` | `useCreateAdminChallenge` is dead code — no action |
| User Wizard | `Challenges/CreateChallengeWizard.tsx` | **DEFECT-13F-3 — FIXED** |
| Preview Screen | `Challenges/ChallengePreviewScreen.tsx` | No defects — redirect only |
| Wellness Gallery | `Challenges/WellnessTemplateGalleryScreen.tsx` | No defects — display only |
| Wellness Template Detail | `Challenges/WellnessTemplateDetailScreen.tsx` | No defects — display only |

---

## Confirmed Defects (Fixed)

### DEFECT-13F-1 — Templates missing engine-specific fields (service types)

**File:** `src/services/challengeTemplateService.ts`  
**Severity:** High

**Root Cause:**  
`SuggestedChallengeTemplate` and `CreateSuggestedChallengeTemplateInput` types lacked fields for v2 engine configuration. As a result, template documents could not carry `requiredConsecutiveDays`, `streakResetOnMiss`, `groupCumulativeTarget`, `autoCompleteOnGroupTarget`, or `activities[].targetType`. These values would be silently dropped on save and never propagated to challenges created from the template.

`fromDoc()` also did not read these fields back from Firestore, so even pre-existing documents with these fields (if written externally) would lose them on round-trip.

**Fix:**  
Added the following optional fields to both types:
```typescript
requiredConsecutiveDays?: number;
streakResetOnMiss?: boolean;
groupCumulativeTarget?: number;
autoCompleteOnGroupTarget?: boolean;
// on each activity:
targetType?: 'daily' | 'cumulative';
```

Updated `fromDoc()` to read all four engine fields from Firestore using safe `!= null` guards (preserves `false` booleans, which `?? undefined` would drop).

---

### DEFECT-13F-2 — Admin create screen has no UI for engine-specific fields

**File:** `src/features/Admin/Challenges/CreateChallengeScreen.tsx`  
**Severity:** High

**Root Cause:**  
The form collected `challengeType` but had no inputs for the engine-specific config that type requires. A streak template saved with no `requiredConsecutiveDays`, and a collective template with no `groupCumulativeTarget`, produces an unusable challenge when created from the template — the wizard would require the user to enter these values from scratch, defeating the purpose of the template.

**Fix:**  
Added four state variables: `groupCumulativeTarget`, `autoCompleteOnGroupTarget`, `requiredConsecutiveDays`, `streakResetOnMiss`.

Added type-gated UI sections (fitness mode only — wellness templates have a different type system):
- **Collective Settings**: numeric input for group cumulative target + toggle for auto-complete
- **Streak Settings**: numeric input for required consecutive days + toggle for streak-reset-on-miss policy

Updated the fitness template save payload to include these fields conditionally:
```typescript
...(challengeType === 'collective' && Number(groupCumulativeTarget) > 0 ? {
  groupCumulativeTarget: Number(groupCumulativeTarget),
  autoCompleteOnGroupTarget,
} : {}),
...(challengeType === 'streak' && Number(requiredConsecutiveDays) > 0 ? {
  requiredConsecutiveDays: Number(requiredConsecutiveDays),
  streakResetOnMiss,
} : {}),
```

Fields are only included when the user has entered a valid value (> 0), preventing accidental saves of zero-value engine config.

---

### DEFECT-13F-3 — Wizard does not apply engine fields from template

**File:** `src/features/Challenges/CreateChallengeWizard.tsx`  
**Severity:** High

**Root Cause:**  
When loading a fitness template (lines 160–199), the wizard applied `name`, `description`, `challengeType`, `activities`, and `donation` from the template, but not the engine-specific fields. A user creating a "30-Day Streak" challenge from a template would see the challenge type pre-selected as "streak" but `requiredConsecutiveDays` left blank — the wizard's validation would then block them from launching until they re-entered a value the template already knew.

**Fix:**  
Added four conditional `setState` calls after the donation block:
```typescript
if (template.groupCumulativeTarget != null && template.groupCumulativeTarget > 0) {
  setGroupCumulativeTarget(String(template.groupCumulativeTarget));
}
if (template.autoCompleteOnGroupTarget != null) {
  setAutoCompleteOnGroupTarget(template.autoCompleteOnGroupTarget);
}
if (template.requiredConsecutiveDays != null && template.requiredConsecutiveDays > 0) {
  setRequiredConsecutiveDays(String(template.requiredConsecutiveDays));
}
if (template.streakResetOnMiss != null) {
  setStreakResetOnMiss(template.streakResetOnMiss);
}
```

Null guards ensure that templates without these fields (existing templates, wellness templates routed via the `wellnessTemplateId` path) leave the wizard defaults unchanged.

---

## Non-Blocking Observations (Not Fixed)

### OBS-13F-1 — AdminPendingChallengesScreen defaults `challengeType` to `'collective'`

**File:** `src/features/Admin/AdminPendingChallengesScreen.tsx:79`  
**Severity:** Low

The display uses `item.challengeType || 'collective'` — if a challenge document is missing `challengeType`, it renders as "collective". Incorrect label, but this is the admin moderation UI only; the underlying challenge data is unaffected. All challenges created through the wizard or admin create screen have `challengeType` set explicitly.

No fix applied — incorrect default is a display-only issue in an admin-only screen.

### OBS-13F-2 — `useCreateAdminChallenge` / `createChallengeFromAdmin` are dead code

**File:** `src/services/adminChallengeService.ts`, `src/hooks/useAdminChallenges.ts`  
**Severity:** Low

`createChallengeFromAdmin` exists and is exported, but `useCreateAdminChallenge` (the only hook that calls it) is never used by any component. The service function also lacks `engineVersion` in its payload type — it would create Legacy-engine challenges. Since this code path is unreachable, it poses no live risk.

No fix applied — removing dead code is out of scope for this audit phase.

### OBS-13F-3 — `ChallengeAnalyticsScreen` uses `progress` for completion rate

**File:** `src/services/adminChallengeService.ts:getChallengeAnalytics()`  
**Severity:** Low

`avgCompletionRate` averages `challenge.progress` across all challenges. The `progress` field is set to `0` at creation and never updated by the challenge engines — engines write to member-level `completionRate` fields, not the challenge-level `progress`. The analytics metric is always near-zero.

Not fixed in this phase — requires a separate aggregation strategy (e.g., fan-in from memberships). Noted as a follow-up item.

---

## Regression Guards Added (13F-1 through 13F-14)

| Guard | What it tests |
|---|---|
| 13F-1 | `SuggestedChallengeTemplate` includes `groupCumulativeTarget` and `autoCompleteOnGroupTarget` |
| 13F-2 | `SuggestedChallengeTemplate` includes `requiredConsecutiveDays` and `streakResetOnMiss` |
| 13F-3 | `fromDoc` reads `groupCumulativeTarget` from Firestore |
| 13F-4 | `fromDoc` reads `requiredConsecutiveDays` from Firestore |
| 13F-5 | `CreateSuggestedChallengeTemplateInput` includes engine-specific fields |
| 13F-6 | Template activities type includes `targetType` field |
| 13F-7 | `CreateChallengeScreen` manages `groupCumulativeTarget` state |
| 13F-8 | `CreateChallengeScreen` manages `requiredConsecutiveDays` state |
| 13F-9 | `CreateChallengeScreen` passes `groupCumulativeTarget` to mutation for collective templates |
| 13F-10 | `CreateChallengeScreen` passes `requiredConsecutiveDays` to mutation for streak templates |
| 13F-11 | Wizard applies `template.groupCumulativeTarget` on template load |
| 13F-12 | Wizard applies `template.requiredConsecutiveDays` on template load |
| 13F-13 | Wizard applies `template.streakResetOnMiss` on template load |
| 13F-14 | Wizard applies `template.autoCompleteOnGroupTarget` on template load |

---

## Validation Results

```
npx tsc -b --pretty false         → 0 errors ✅
npm run build                     → ✓ built in 2.97s ✅
npm run test:scoring-guards       → scoring guards passed (13C-1 through 13F-14) ✅
npm run test:home-challenge-feeds → all guards passed ✅
npx tsx scripts/testPhase13E.ts   → 170/170 checks passed ✅
```

---

## Files Changed

| File | Change |
|---|---|
| `src/services/challengeTemplateService.ts` | Added engine fields to `SuggestedChallengeTemplate`, `CreateSuggestedChallengeTemplateInput`, `fromDoc`, and activity item deserialization |
| `src/features/Admin/Challenges/CreateChallengeScreen.tsx` | Added state + UI for collective/streak engine fields; passes them to fitness template save |
| `src/features/Challenges/CreateChallengeWizard.tsx` | Applies engine-specific template fields when loading a fitness template |
| `scripts/testScoringGuards.ts` | Guards 13F-1 through 13F-14 |
