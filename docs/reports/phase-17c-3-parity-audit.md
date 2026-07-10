# Phase 17C-3 — Shared Form Parity Audit Report

**Date:** 2026-06-27
**Branch:** fix/p0-pre-deploy-blockers
**Build:** `npx tsc --noEmit` clean · `npm run build` ✓

---

## 1. Component Usage Table

| Component | Wizard | Admin | Notes |
|---|---|---|---|
| `ChallengeBasicInfoSection` | ✅ line 674 | ✅ line 437 | Both pass `isWellnessMode`, `challengeType`, `onModeChange`, `onTypeChange`. Wizard adds `afterCoverSlot` (group selector) and `className="st-form-max mt-3"`. |
| `ChallengeEngineSettingsSection` | ✅ line 718 | ✅ line 452 | Identical props. Wizard adds `className="st-form-max"`. |
| `ChallengeTimelineSection` | ✅ line 731 | ✅ line 464 | Admin adds `responsive` prop; Wizard adds `className="st-form-max"`. |
| `ChallengeActivitySection` | ✅ line 753 | ✅ line 473 | Wizard adds `onNavigateToExercise` and `className="st-form-max mt-4"`. |
| `ChallengeDonationSection` | ✅ line 792 | ✅ line 510 | Wizard adds `className="st-form-max mt-4"`. |

All five shared components confirmed wired in both screens.

---

## 2. Utility Usage Table

| Utility | Wizard | Admin | Other consumers |
|---|---|---|---|
| `challengeFormValidation.ts` | ✅ called in `launchChallenge` | ✅ called in `onSaveTemplate` | — |
| `challengeFormDefaults.ts` | ✅ `DEFAULT_AUTO_COMPLETE_ON_GROUP_TARGET`, `DEFAULT_STREAK_RESET_ON_MISS`, `DURATION_FALLBACK_DAYS` | ✅ same + `DEFAULT_TEMPLATE_MODE` | — |
| `challengeFormCopy.ts` | ✅ `DONATION_PAYLOAD_DISCLAIMER` | ✅ `DONATION_PAYLOAD_DISCLAIMER` | `ChallengeBasicInfoSection` (type/mode descriptions), `ChallengeDonationSection` (full disclaimer) |

All three utilities confirmed imported and used in both screens.

**Note — Wizard does not import `DEFAULT_TEMPLATE_MODE`:** Wizard uses `challengeCategory` derived from URL params (`useSearchParams`) instead of a local `templateMode` state. This is a structural difference, not a defect — see §6.

---

## 3. Remaining Duplicated JSX

**Between the two parent files:** essentially none. Admin's render section delegates entirely to the five shared components plus three action buttons (`Cancel`, `Save as Draft`, `Save & Publish`). Wizard has additional Wizard-only chrome (step progress bar, template banner, per-step summary chips, step 4 review screen) — none of it appears in Admin.

**Near-duplicate within the Wizard:** the "name + type chip" summary strip appears twice (steps 2 and 3, lines 711–714 and 743–748) with minor differences — step 3 adds a duration badge. Both instances are Wizard-only, not duplicated with Admin.

---

## 4. Remaining Duplicated Validation

### Wizard post-resolution activity check (line 504–506)
```typescript
if (validActivities.length === 0) {
  showToast('Add at least one valid activity.', 'error');
  return;
}
```
The shared validator also covers this case via the pre-flight `namedActivities` check. However, the Wizard's post-resolution guard fires when all activities fail to resolve against the exercise catalog (e.g. a free-typed query that matches no exercise) — a scenario the pre-flight validator cannot catch because it only inspects raw `query` strings. **This is intentional and complementary, not a defect.**

### Wizard `advanceStep` step-scoped validation (lines 608–623)
Operates per step before submit using `setStepError` (inline errors, not toasts). The shared validator only runs at submit time. These are complementary — `advanceStep` provides early per-step feedback; `validateChallengeForm` is the authoritative gate before submission.

### Admin `canSaveTemplate` button gate (line 209)
Still checks `name`, `description`, and `resolvedActivities.length > 0` to disable the save buttons. This is UI-only — `onSaveTemplate` always calls the shared validator before any save. Not a defect, but see **D4** below for a UX gap it creates.

---

## 5. Remaining Duplicated Copy

| String | Wizard | Admin | Status |
|---|---|---|---|
| `'Challenge cover uploaded.'` | line 300 | line 292 | Duplicated toast inside `handleCoverFileSelected` in each screen |
| `'Could not read selected image.'` | line 308 | line 300 | Duplicated cover-upload error toast |
| `'Using local image preview. Upload will depend on storage permissions.'` | line 306 | line 298 (`'...depends on...'`) | **Wording diverges** — see D1 |
| `'Reps'` (unit fallback) | multiple | multiple | Functional string, not display copy — acceptable |
| `'All'` (tier filter default) | line 112 | line 116 | State initializer, not display copy — acceptable |

The cover-image toast strings are the only remaining duplicated display copy in both parent files. They live inside the cover-upload handler, which is not yet extracted into a shared utility.

---

## 6. Intentional User / Admin Differences

| Area | Wizard | Admin | Reason |
|---|---|---|---|
| **Mode tracking** | `challengeCategory` (URL param-driven via `useSearchParams`) | `templateMode` state | Wizard supports deep-linking to wellness mode via `?type=wellness`; Admin is always a fresh form |
| **Group selector** | Required — `afterCoverSlot` with group `<select>` + async membership validation | Absent — templates are not group-scoped | Fundamentally different creation targets (live challenge vs template) |
| **Step flow** | 4-step wizard with `advanceStep` / `goBack` navigation | Single-page, all sections always visible | Intentional UX pattern difference |
| **Step 4 Review** | Full pre-launch review screen | None | Wizard-only pre-launch confirmation before committing |
| **Template banner** | Shows "Using Suggested Template" / "Using Wellness Template" banners when `templateId` or `wellnessTemplateId` URL param is present | None | Wizard supports template prefill from URL params; Admin does not |
| **`responsive` on Timeline** | Not passed (always `grid-cols-2`) | Passed (`md:grid-cols-2`) | Admin has wider card layout; Wizard is a narrow mobile form |
| **`onNavigateToExercise` on Activity** | Passed — navigates to `/app/exercises/:id` | Not passed | Admin does not expose the exercise detail route in its navigation context |
| **Submit outcome** | Launches a live challenge via `useCreateChallenge`; toasts "Challenge launched" or "submitted for platform review" | Saves a draft or published template via `useCreateSuggestedChallengeTemplate` + `wellnessTemplateService`; toasts "Template published" or "saved as draft" | Different backend targets by design |
| **`exerciseId` type in `ActivityRow`** | `string` (required, `''` for blank) | `string?` (optional, `undefined` for blank) | Both are local types predating shared extraction; see D2 |

---

## 7. Remaining Defects

| # | Description | Evidence | Severity |
|---|---|---|---|
| **D1** | Cover-image info toast wording diverges: Wizard says `"Upload will depend on storage permissions."`, Admin says `"Upload depends on storage permissions."` — same event, inconsistent copy | Wizard line 306 · Admin line 298 | Minor |
| **D2** | `ActivityRow.exerciseId` is `string` (required, blank = `''`) in Wizard but `string?` (optional, blank = `undefined`) in Admin. No current observable bug — the shared component treats both as falsy — but the type drift could cause silent failures if the field is ever narrowed | Wizard line 38 · Admin line 33 | Low |
| **D3** | Wizard `advanceStep` step-2 date check uses string comparison (`endDate < startDate`) while `validateChallengeForm` uses `new Date()` comparison. String comparison is correct for ISO `YYYY-MM-DD` format but semantically fragile and inconsistent with the shared validator's approach | Wizard line 611 · `challengeFormValidation.ts` line 32 | Low |
| **D4** | Admin `canSaveTemplate` enables the save button whenever `description` is non-empty, but the shared validator requires `description.trim().length >= 8`. A 1–7 character description leaves the button enabled and causes an immediate toast on click — confusing UX | Admin line 209 · `challengeFormValidation.ts` line 27 | Minor |

---

## Coverage Matrix — 6 Form Combinations

| Mode | Type | Sections render | Engine settings | Activities | Validation wired |
|---|---|---|---|---|---|
| Fitness | Collective | ✅ All 5 sections | ✅ Collective block (`groupCumulativeTarget`, `autoComplete`) | ✅ Exercises | ✅ Mixed-unit, groupTarget > 0, date |
| Fitness | Competitive | ✅ All 5 sections | ✅ Competitive info card | ✅ Exercises | ✅ Date, activity presence |
| Fitness | Streak | ✅ All 5 sections | ✅ Streak block (`requiredConsecutiveDays`, `streakResetOnMiss`) | ✅ Exercises | ✅ consecutiveDays > 0, ≤ durationDays, date |
| Wellness | Collective | ✅ All 5 sections | ✅ Collective block | ✅ Wellness activities | ✅ Mixed-unit, groupTarget > 0, date |
| Wellness | Competitive | ✅ All 5 sections | ✅ Competitive info card | ✅ Wellness activities | ✅ Date, activity presence |
| Wellness | Streak | ✅ All 5 sections | ✅ Streak block | ✅ Wellness activities | ✅ consecutiveDays > 0, ≤ durationDays, date |

Donation validation is wired for all 6 combinations in both screens (enabled/disabled toggle; cause name, description, phone/card-link required when enabled).

---

## Build Status

```
npx tsc --noEmit   →  CLEAN (zero errors)
npm run build      →  ✓ built (~10–12s)
                      Pre-existing chunk-size warning only (vendor-firebase-internal > 500 kB)
```
