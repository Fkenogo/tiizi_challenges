# Phase 17F-1 — Challenge Creation Flow Audit

**Date:** 2026-06-28
**Branch:** fix/p0-pre-deploy-blockers
**Scope:** Audit only — no code changes. All four creation/editing routes reviewed.

---

## Files Audited

| File | Lines Read | Status |
|---|---|---|
| `src/features/Challenges/CreateChallengeWizard.tsx` | Full | ✅ |
| `src/features/Admin/Challenges/CreateChallengeScreen.tsx` | Full | ✅ |
| `src/features/Admin/Challenges/EditChallengeTemplateScreen.tsx` | Full | ✅ |
| `src/features/Admin/Challenges/EditWellnessTemplateScreen.tsx` | Full | ✅ (written this session) |
| `src/features/Challenges/components/ChallengeActivitySection.tsx` | Full | ✅ (modified this session) |

---

## 1. Route-by-Route Audit Table

| Route | Screen | Shared Components Used | Activity Library | Mode Derivation |
|---|---|---|---|---|
| `/app/challenges/create` | `CreateChallengeWizard` | ✅ All 5 shared sections | Fitness or Wellness (based on `challengeCategory`) | `isWellnessMode = challengeCategory !== 'fitness'` |
| `/app/admin/challenges/create` | `CreateChallengeScreen` | ✅ All 5 shared sections | Fitness or Wellness (based on `templateMode`) | `isWellnessMode = templateMode === 'wellness'` |
| `/app/admin/challenges/templates/:id/edit` | `EditChallengeTemplateScreen` | ❌ **None — fully custom inline UI** | Fitness only (inline search input) | N/A — fitness-only screen |
| `/app/admin/challenges/wellness-templates/:id/edit` | `EditWellnessTemplateScreen` | ✅ All shared except Timeline + Donation | Wellness only | Hardcoded `isWellnessMode={true}` |

---

## 2. Fitness vs Wellness Activity Library Behaviour

| Behaviour | Fitness path | Wellness path |
|---|---|---|
| Search input | readOnly — tap opens fitness picker modal | readOnly — tap opens wellness picker modal |
| Picker trigger (+ button) | Opens fitness picker at new row index | Opens wellness picker at new row index |
| Library source | `useExercises()` → `catalogExercises` collection | `useWellnessActivities()` → filtered by category + search |
| Filter | Tier dropdown (6 tiers + All) | Category tabs + search |
| On pick — fields set | `exerciseId`, `query`, `unit` | `activityId`, `activityType`, `query`, `description`, `category`, `difficulty`, `icon`, `protocolSteps`, `benefits`, `guidelines`, `warnings`, `frequency`, `targetValue`, `unit`, `dailyFrequency`, `instructions` |
| On pick — fields cleared | `activityId` left undefined | `exerciseId` left undefined |
| Frequency field | Shown only for streak type | Shown only for streak type |
| Cross-contamination on pick | None — fitness pick does not write wellness-specific fields | None — wellness pick clears `exerciseId` |
| Modal close | ✅ Closes after pick + clears state | ✅ Closes after pick + clears state |

---

## 3. Six-Combination Check (after Phase 17E-3)

| Mode | Challenge Type | "How often?" field | Activity Library | Correct? |
|---|---|---|---|---|
| Fitness | Collective | ❌ Hidden | Fitness | ✅ |
| Fitness | Competitive | ❌ Hidden | Fitness | ✅ |
| Fitness | Streak | ✅ Shown | Fitness | ✅ |
| Wellness | Collective | ❌ Hidden | Wellness | ✅ |
| Wellness | Competitive | ❌ Hidden | Wellness | ✅ |
| Wellness | Streak | ✅ Shown | Wellness | ✅ |

All six combinations behave correctly.

---

## 4. Confirmed Bugs

### BUG-1 (Medium): Wizard `addActivity` hardcodes `unit: 'Reps'` in wellness mode

**File:** `src/features/Challenges/CreateChallengeWizard.tsx` line 342

```ts
// BUG — always defaults to 'Reps' regardless of isWellnessMode
setActivities((prev) => [...prev, { query: '', exerciseId: undefined, targetValue: '', unit: 'Reps' }]);
```

**Expected:** When `isWellnessMode === true`, new rows should default to `unit: 'count'`.

**Root cause:** Simple omission — the wellness branch was not considered when the `addActivity` handler was written.

**Admin Create handles this correctly** (line 214):
```ts
{ query: '', exerciseId: undefined, targetValue: '', unit: templateMode === 'wellness' ? 'count' : 'Reps' }
```

**Impact:** In wellness mode, clicking "+ Add Activity" creates a row with `unit: 'Reps'`. The unit is overwritten when the user picks from the wellness library, so the bug is masked if the user picks immediately. If the user edits the unit field manually before picking, the wrong default is visible.

---

### BUG-2 (Medium): `EditChallengeTemplateScreen` uses old inline activity UI

**File:** `src/features/Admin/Challenges/EditChallengeTemplateScreen.tsx`

This screen was not refactored to use `ChallengeActivitySection`. It has:
- Its own minimal local `ActivityRow = { query, exerciseId, targetValue, unit }` (4 fields only — no wellness fields)
- Its own inline `<input className="st-input pl-10" ...>` search field with live `onChange` (the old autocomplete pattern, **not** the readOnly picker trigger from Phase 17D)
- Its own inline `<div className="absolute ...">` suggestion dropdown

**Root cause:** Phase 17D refactored `CreateChallengeWizard` and `CreateChallengeScreen` but did not include `EditChallengeTemplateScreen` in scope.

**Impact:** Admin users editing fitness templates see the old autocomplete search UX, not the picker modal UX. Phase 17D's UX improvements did not reach this screen.

---

### BUG-3 (Low): Four independent `ActivityRow` type definitions

| Location | Fields |
|---|---|
| `CreateChallengeWizard.tsx` | Full wellness + fitness fields |
| `CreateChallengeScreen.tsx` | Full wellness + fitness fields |
| `EditChallengeTemplateScreen.tsx` | `query, exerciseId, targetValue, unit` only |
| `ChallengeActivitySection.tsx` | Exported `ActivityRow` — canonical |

Call sites (`Wizard`, `AdminCreate`, `EditWellness`) do not import the exported `ActivityRow` from `ChallengeActivitySection` — they shadow it with local types. TypeScript catches mismatches at the `ChallengeActivitySection` props boundary, so this is not a runtime bug, but it is a maintenance risk: a field added to the canonical `ActivityRow` must be added to 3+ local copies manually.

---

## 5. Recommended Fix Order

| Priority | Fix | File | Effort |
|---|---|---|---|
| 1 | Fix `addActivity` unit default in Wizard wellness mode | `CreateChallengeWizard.tsx` line 342 | 1 line |
| 2 | Refactor `EditChallengeTemplateScreen` to use `ChallengeActivitySection` | `EditChallengeTemplateScreen.tsx` | Medium — aligned with Phase 17E-1 pattern |
| 3 | Import shared `ActivityRow` at call sites (or re-export from a types file) | All 3 call sites | Low — minor DX improvement |

Fix #1 is the only runtime-visible bug in user-facing flows. Fix #2 is an admin UX parity gap. Fix #3 is maintenance hygiene.

---

## 6. Files Requiring Changes

| File | Change Needed | Bug |
|---|---|---|
| `src/features/Challenges/CreateChallengeWizard.tsx` | `addActivity` unit default — `'Reps'` → `isWellnessMode ? 'count' : 'Reps'` | BUG-1 |
| `src/features/Admin/Challenges/EditChallengeTemplateScreen.tsx` | Refactor to use `ChallengeActivitySection` | BUG-2 |

---

## 7. Confirmed Correct (No Changes Needed)

- `ChallengeActivitySection` frequency gate: `challengeType === 'streak'` — correct for all 6 combinations
- All 3 `ChallengeActivitySection` call sites pass required `challengeType` prop
- Fitness picker opens/closes correctly and populates `exerciseId`, `query`, `unit`
- Wellness picker opens/closes correctly and populates all 14 wellness fields
- No cross-contamination between fitness and wellness fields on pick
- Step 3 validation in Wizard (`activities.some((a) => a.exerciseId || a.activityId)`) covers both modes
- Template prefill (fitness): sets `query`, `exerciseId`, `targetValue`, `unit` — correct
- Template prefill (wellness): sets all wellness fields including `activityId`, `frequency`, `category`, then calls `setChallengeCategory(wellnessTemplate.category)` making `isWellnessMode = true` — correct
- `isWellnessMode` derivation:
  - Wizard: `challengeCategory !== 'fitness'` — all non-fitness categories are wellness; correct
  - AdminCreate: `templateMode === 'wellness'` — binary toggle; correct
  - EditWellnessTemplate: hardcoded `isWellnessMode={true}` — correct
- Mode switching (Wizard step 1 type toggle): changing `challengeCategory` to 'fitness' switches library; changing to any wellness category switches library — correct
- Type switching (collective/competitive/streak): updates `challengeType` which controls engine settings section and frequency field — correct

---

## 8. Build Results

```
npx tsc --noEmit  →  CLEAN (zero errors)
npm run build     →  ✓ built in 18.09s (pre-existing vendor chunk warning only)
```

---

## 9. Screenshots

Audit only — no code changes made. Manual testing not performed this phase.
