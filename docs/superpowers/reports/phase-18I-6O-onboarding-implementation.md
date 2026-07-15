# Phase 18I-6O — Onboarding Persistence + Expanded Interests: Implementation Report

**Date:** 2026-07-03
**Branch:** fix/p0-pre-deploy-blockers

---

## Summary

Implemented all P0 + P1 fixes for the onboarding re-registration loop and expanded the interests/goals model. New `OnboardingSlides` intro screen added for P2.

---

## Root Causes Fixed

### 1. `getOnboardingPath` fallback bug (P0)
`getOnboardingPath` previously returned `/app/profile/completion` as its final fallback. Any user who had exercise interests + goals but hadn't set `onboardingCompleted: true` was silently routed back to step 1 on every app open.

**Fix:** Final fallback now returns `/app/profile/setup-finish`.

### 2. "Skip for now" no-write bug (P0)
The "Skip for now" button on `ProfileSetupFinishScreen` navigated home without writing `onboardingCompleted: true` to Firestore. On next launch, `getOnboardingPath` re-routed user into onboarding.

**Fix:** Skip button now calls `saveProfileSetup.mutateAsync({ ..., onboardingCompleted: true })` before navigating.

---

## Changes

### `src/services/userProfileService.ts`
- Added `wellnessInterests: string[]`, `goals: string[]`, `hasSeenIntro: boolean` to `UserProfileSetup` type
- `getProfileSetup`: reads new fields with fallback (`goals[]` derived from `primaryGoal`/`secondaryGoal` for old records)
- `upsertProfileSetup`: writes all new fields; derives backward-compat `primaryGoal`/`secondaryGoal` scalars from `goals[]`

### `src/hooks/useProfileSetup.ts`
- `ONBOARDING_PATHS` expanded from 3 to 6 paths (adds intro, wellness-interests)
- `getOnboardingPath` logic fixed: intro gate → completed check → interests check → wellness-interests check → setup-finish fallback

### `src/features/Profile/ProfileCompletionScreen.tsx`
- Both `handleNext` and `handleSkipForNow` now preserve `onboardingCompleted`, `wellnessInterests`, `goals`, `hasSeenIntro`
- Step label updated: "Step 1 of 4"

### `src/features/Profile/ProfileInterestsScreen.tsx`
- `handleNext` saves `goals: selectedGoals` (full array, not just scalars)
- Navigation changed from `/app/profile/privacy-settings` → `/app/profile/wellness-interests`
- Step label updated: "Step 2 of 4"
- Expanded exercise options (+4 activities) and renamed `wellnessGoals` → `fitnessGoals` with +5 new goals
- Hydration uses `profileSetup.goals[]` with scalar fallback

### `src/features/Profile/ProfileWellnessInterestsScreen.tsx` *(new)*
- Step 3 of 4 — wellness interest selection (15 options)
- Saves `wellnessInterests[]`, navigates to `/app/profile/privacy-settings`
- Skippable (saves empty array)

### `src/features/Profile/ProfilePrivacySettingsScreen.tsx`
- `handleFinish` preserves `wellnessInterests`, `goals`, `hasSeenIntro`, `onboardingCompleted`
- Step label updated: "Step 4 of 4"
- Back navigation changed to `/app/profile/wellness-interests`

### `src/features/Profile/ProfileSetupFinishScreen.tsx`
- `handleFinishSetup` now includes `wellnessInterests`, `goals`, `hasSeenIntro`
- Skip button already fixed in P0 phase (previous session)

### `src/features/Profile/ProfilePersonalInfoScreen.tsx`
- Save call updated with `wellnessInterests`, `goals`, `hasSeenIntro`

### `src/features/Profile/ProfileSettingsScreen.tsx`
- Save call updated with `wellnessInterests`, `goals`, `hasSeenIntro`

### `src/features/Onboarding/OnboardingSlides.tsx` *(new)*
- 6-slide intro carousel (Welcome → Challenges → Log Activity → Community → Streaks → Let's Personalize)
- Writes `hasSeenIntro: true` on completion or skip
- If `hasSeenIntro` already true on load, immediately redirects to `getOnboardingPath(setup)`

### `src/App.tsx`
- Added lazy imports: `ProfileWellnessInterestsScreen`, `OnboardingSlides`
- Added routes: `/app/onboarding/intro`, `/app/profile/wellness-interests`

### `src/features/Auth/SignupScreen.tsx`
- Default `nextPath` changed from `/app/profile/completion` → `/app/onboarding/intro`

### `scripts/testOnboardingGuards.ts` *(new)*
- 28 guards covering: ONBOARDING_PATHS, getOnboardingPath logic, type fields, goals fallback, write persistence, per-screen field preservation, navigation paths, route registration, signup default

### `package.json`
- Added `"test:onboarding-guards": "tsx scripts/testOnboardingGuards.ts"`

---

## Validation Results

```
✅ npx tsc --noEmit      — clean
✅ npm run build         — clean (pre-existing bundle warning)
✅ test:onboarding-guards        — all 28 guards passed
✅ test:profile-analytics-guards — all guards passed
✅ test:scoring-guards           — all guards passed
```

---

## Not Implemented (Out of Scope for This Phase)

- `RequireProfileSetup mode="completed"` wrapper on `/app/home` route — guard component exists but not yet applied to routes. Tracked as future improvement.
- Richer wellness goals in the goals modal (deferred to content iteration)
