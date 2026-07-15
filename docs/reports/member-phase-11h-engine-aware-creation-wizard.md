# Phase 11H — Engine-aware Challenge Creation Wizard
**Branch:** `fix/p0-pre-deploy-blockers`  
**Date:** 2026-06-25  
**Status:** Complete — all validation commands passed

---

## 1. Objective

Replace the one-size-fits-all challenge creation flow with an engine-aware wizard that:
- Always writes `engineVersion: 'v2'` for new challenges
- Collects type-specific fields per challenge type (Collective / Streak / Competitive)
- Shows type descriptions so admins understand what they're creating
- Validates that required type-specific fields are provided before launch
- Shows a dynamic review summary before the launch button

Legacy (v1) challenges are unaffected — this change only applies to NEW challenge creation.

---

## 2. Files Modified

| File | Change |
|---|---|
| `src/types/index.ts` | Added v2 fields to `Challenge` interface |
| `src/services/challengeService.ts` | Extended `CreateChallengeInput` + `createChallenge` payload |
| `src/features/Challenges/CreateChallengeWizard.tsx` | Type descriptions, type-specific settings UI, v2 payload, review summary, validation |

**Files confirmed NOT modified:**
- `src/features/Admin/Challenges/CreateChallengeScreen.tsx` — template creation only, not live challenges
- All engine files — no logic changes
- `src/services/workoutService.ts` — unchanged
- `src/services/wellnessLogService.ts` — unchanged
- `firestore.rules` — unchanged

---

## 3. Commands Executed

```
npx tsc -b --pretty false      → 0 errors (exit 0)
npm run build                  → ✓ built in 2.78s
npm run test:scoring-guards    → scoring guards passed
```

---

## 4. Changes in Detail

### 4.1 `src/types/index.ts` — Challenge interface

Added v2 fields (all optional — no impact on v1 reads):

```typescript
// v2 engine fields
engineVersion?: 'v2';
// Collective v2
groupCumulativeTarget?: number;
autoCompleteOnGroupTarget?: boolean;
groupCurrentTotal?: number;
// Streak v2
requiredConsecutiveDays?: number;
streakResetOnMiss?: boolean;
```

### 4.2 `src/services/challengeService.ts` — CreateChallengeInput + payload

**`CreateChallengeInput`** extended with:
```typescript
engineVersion?: 'v2';
groupCumulativeTarget?: number;
autoCompleteOnGroupTarget?: boolean;
requiredConsecutiveDays?: number;
streakResetOnMiss?: boolean;
```

**`createChallenge` payload** conditionally writes each field via spread:
```typescript
...(input.engineVersion ? { engineVersion: input.engineVersion } : {}),
...(input.groupCumulativeTarget !== undefined ? { groupCumulativeTarget: input.groupCumulativeTarget } : {}),
...(input.autoCompleteOnGroupTarget !== undefined ? { autoCompleteOnGroupTarget: input.autoCompleteOnGroupTarget } : {}),
...(input.requiredConsecutiveDays !== undefined ? { requiredConsecutiveDays: input.requiredConsecutiveDays } : {}),
...(input.streakResetOnMiss !== undefined ? { streakResetOnMiss: input.streakResetOnMiss } : {}),
```

This is safe for backwards compatibility: undefined values are excluded from the document by `removeUndefinedDeep`.

### 4.3 `src/features/Challenges/CreateChallengeWizard.tsx` — UI and payload

**New state variables:**
- `groupCumulativeTarget: string` — text input → converted to number on submit
- `autoCompleteOnGroupTarget: boolean` — toggle, default `true`
- `requiredConsecutiveDays: string` — text input → converted to number on submit
- `streakResetOnMiss: boolean` — toggle, default `true`

**Type description strip:** After the type selector buttons, a short description of the selected type is shown in the primary/5 callout box.

**Conditional settings sections:**
- `challengeType === 'collective'` → shows "Collective Settings" with Group Cumulative Target input and Auto-complete toggle
- `challengeType === 'streak'` → shows "Streak Settings" with Required Consecutive Days input and Reset on Miss toggle
- `challengeType === 'competitive'` → shows "Competitive Settings" with an explanation that per-activity targetValues are cumulative targets

**Validation (before launch):**
```typescript
if (challengeType === 'collective' && (!groupCumulativeTarget || Number(groupCumulativeTarget) <= 0)) {
  showToast('Set a group cumulative target greater than zero.', 'error');
  return;
}
if (challengeType === 'streak' && (!requiredConsecutiveDays || Number(requiredConsecutiveDays) <= 0)) {
  showToast('Set the required consecutive days greater than zero.', 'error');
  return;
}
```

**Payload additions:**
```typescript
engineVersion: 'v2' as const,
...(challengeType === 'collective'
  ? { groupCumulativeTarget: Number(groupCumulativeTarget), autoCompleteOnGroupTarget }
  : {}),
...(challengeType === 'streak'
  ? { requiredConsecutiveDays: Number(requiredConsecutiveDays), streakResetOnMiss }
  : {}),
```

**Review summary card:** Shown above the launch button when name and type are filled. Displays:
- Challenge name
- Type with human-readable description
- Engine version (always "v2")
- Type-specific parameters (group target + auto-complete, OR streak days + reset rule)
- Duration in days

---

## 5. Firestore Document Examples per Type

### Collective v2
```json
{
  "name": "Group 50K Challenge",
  "challengeType": "collective",
  "engineVersion": "v2",
  "groupCumulativeTarget": 50000,
  "autoCompleteOnGroupTarget": true,
  "groupCurrentTotal": 0,
  "startDate": "2026-07-01T00:00:00.000Z",
  "endDate": "2026-07-31T00:00:00.000Z",
  "activities": [{ "exerciseName": "Pushups", "targetValue": 100, "unit": "Reps" }]
}
```

### Streak v2
```json
{
  "name": "7-Day Run Streak",
  "challengeType": "streak",
  "engineVersion": "v2",
  "requiredConsecutiveDays": 7,
  "streakResetOnMiss": true,
  "startDate": "2026-07-01T00:00:00.000Z",
  "endDate": "2026-07-31T00:00:00.000Z",
  "activities": [{ "exerciseName": "Run", "targetValue": 3, "unit": "Km" }]
}
```

### Competitive v2
```json
{
  "name": "Squat Leaderboard",
  "challengeType": "competitive",
  "engineVersion": "v2",
  "startDate": "2026-07-01T00:00:00.000Z",
  "endDate": "2026-07-31T00:00:00.000Z",
  "activities": [{ "exerciseName": "Squats", "targetValue": 1000, "unit": "Reps" }]
}
```

---

## 6. Validation Matrix

| Scenario | Behaviour |
|---|---|
| Collective with no group target | Blocked: toast "Set a group cumulative target greater than zero." |
| Collective with target=0 | Blocked: same toast |
| Collective with valid target | Allowed: `groupCumulativeTarget` written to Firestore |
| Streak with no required days | Blocked: toast "Set the required consecutive days greater than zero." |
| Streak with days=0 | Blocked: same toast |
| Streak with valid days | Allowed: `requiredConsecutiveDays` written to Firestore |
| Competitive | No additional validation — existing activity targetValue serves as cumulative target |
| All new challenges | `engineVersion: 'v2'` always written |
| Legacy challenges (existing) | Unaffected — not created through this wizard |

---

## 7. Backwards Compatibility

- All existing challenges have no `engineVersion` field → still route to `LegacyEngine` → behavior unchanged
- `CreateChallengeInput` new fields are optional → no breaks to existing callers
- `Challenge` interface new fields are optional → no breaks to any screen reading challenge data
- Admin `CreateChallengeScreen.tsx` not modified → template creation unchanged

---

## 8. Remaining Gaps

| Gap | Priority | Notes |
|---|---|---|
| No integration test against Firestore | Medium | Unit/engine tests pass. First v2 challenge creation requires manual QA in staging. |
| Template-seeded challenges | Low | If a template is applied, the new v2 type-specific fields are NOT pre-filled from the template (templates don't store these fields). Admin must set them manually after template apply. |
| Wellness template auto-complete flag | Low | `autoCompleteOnGroupTarget` defaults to `true` even when a wellness template is applied. Intended — most wellness collective challenges should auto-complete. |
