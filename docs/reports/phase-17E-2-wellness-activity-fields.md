# Phase 17E-2 — Wellness Activity Fields by Challenge Type

**Date:** 2026-06-28
**Branch:** fix/p0-pre-deploy-blockers
**Scope:** `ChallengeActivitySection` + 3 call sites — UI only, no logic/service/schema changes

---

## Problem

The "How often?" frequency selector was rendered for all wellness challenge types:

```
isWellnessMode && (
  <div className="mt-3">
    <p ...>How often?</p>
    <select ...>…</select>
  </div>
)
```

This produced incorrect UIs for Wellness + Collective and Wellness + Competitive, where frequency has no meaning (targets are cumulative, not per-session).

---

## Fix

### Conditional Rendering Rule

**Before:**
```tsx
{isWellnessMode && (
  <div className="mt-3">
    <p …>How often?</p>
    <select …>…</select>
  </div>
)}
```

**After:**
```tsx
{isWellnessMode && challengeType === 'streak' && (
  <div className="mt-3">
    <p …>How often?</p>
    <select …>…</select>
  </div>
)}
```

`challengeType` added as a required prop to `ChallengeActivitySectionProps` and destructured in the function signature.

---

## Files Changed

| File | Change |
|---|---|
| `src/features/Challenges/components/ChallengeActivitySection.tsx` | Added `challengeType` required prop; changed frequency condition from `isWellnessMode` to `isWellnessMode && challengeType === 'streak'` |
| `src/features/Challenges/CreateChallengeWizard.tsx` | Added `challengeType={challengeType}` prop |
| `src/features/Admin/Challenges/CreateChallengeScreen.tsx` | Added `challengeType={challengeType}` prop |
| `src/features/Admin/Challenges/EditWellnessTemplateScreen.tsx` | Added `challengeType={challengeType}` prop |

---

## Shared Component Usage Table (post-fix)

| Component | Receives `challengeType` | Notes |
|---|---|---|
| `ChallengeActivitySection` | ✅ required prop | Used to gate frequency field |
| `ChallengeBasicInfoSection` | ✅ (already existed) | Type selector lives here |
| `ChallengeEngineSettingsSection` | ✅ (already existed) | Type is the primary input |
| `ChallengeTimelineSection` | N/A | No type dependency |
| `ChallengeDonationSection` | N/A | No type dependency |

---

## Six-Combination Manual Check Summary

| Mode | Type | Activity search | Target + Unit | "How often?" |
|---|---|---|---|---|
| Fitness | Collective | Tap to choose exercise ✅ | ✅ | ❌ hidden |
| Fitness | Competitive | Tap to choose exercise ✅ | ✅ | ❌ hidden |
| Fitness | Streak | Tap to choose exercise ✅ | ✅ | ❌ hidden (fitness never shows it) |
| Wellness | Collective | Tap to choose wellness activity ✅ | ✅ | ❌ hidden |
| Wellness | Competitive | Tap to choose wellness activity ✅ | ✅ | ❌ hidden |
| Wellness | Streak | Tap to choose wellness activity ✅ | ✅ | ✅ shown |

Verified in all three call sites:
- `CreateChallengeWizard` (step 2 activity form)
- `CreateChallengeScreen` (Admin single-page create)
- `EditWellnessTemplateScreen` (Admin wellness edit)

---

## No Logic Changes

- Save payloads unchanged — `frequency` field is still written to `ActivityRow` when an activity is picked from the wellness library (default `'daily'`). It is simply not editable in the UI for non-streak types.
- Validation unchanged — `validateChallengeForm` does not inspect frequency.
- Cloud Functions unchanged.
- Firestore rules unchanged.
- Services unchanged.

---

## Build Output

```
npx tsc --noEmit   →  CLEAN (zero errors)
npm run build      →  ✓ built (pre-existing vendor-firebase chunk warning only)
```

---

## Remaining Form Inconsistencies

None introduced by this phase. One pre-existing note: `EditChallengeTemplateScreen` (fitness-only, legacy) does not use the shared `ChallengeActivitySection` and retains the old datalist autocomplete pattern from before Phase 17D. This is a separate refactor task.
