# Phase 18I-6O — Onboarding Persistence + UX Audit

**Date:** 2026-07-03
**Branch:** fix/p0-pre-deploy-blockers
**Type:** Audit only — no code changes

---

## 1. Root Cause Summary — Re-Onboarding Bug

There are **two independent causes** that together guarantee already-onboarded users are sent back through onboarding.

### Root Cause A — `getOnboardingPath` fallback is incorrect

`src/hooks/useProfileSetup.ts:13–17`

```ts
export function getOnboardingPath(profileSetup: UserProfileSetup | null | undefined): string {
  if (profileSetup?.onboardingCompleted === true) return HOME_PATH;          // ✅
  if (!profileSetup?.exerciseInterests?.length) return '/app/profile/interests'; // ✅
  if (!profileSetup?.primaryGoal) return '/app/profile/setup-finish';            // ✅
  return '/app/profile/completion';   // ❌ BUG
}
```

The final `return` sends users who have **both** `exerciseInterests` AND `primaryGoal` (they completed steps 2 and 3) but whose `onboardingCompleted` is `false` back to `/app/profile/completion` — step 1.

**Intended behaviour:** If interests + goal exist but `onboardingCompleted` is still false, the user should be routed to the finish screen (`/app/profile/setup-finish`), not back to the beginning.

**Correct logic:**
```ts
return '/app/profile/setup-finish';   // ← fix
```

Or, preferably, treat this state as complete (see Root Cause B fix).

---

### Root Cause B — "Skip for now" on `ProfileSetupFinishScreen` never writes `onboardingCompleted: true`

`src/features/Profile/ProfileSetupFinishScreen.tsx:85`

```tsx
<button onClick={() => navigate('/app/home')}>
  Skip for now
</button>
```

This button navigates to home **without calling `saveProfileSetup`**. So `onboardingCompleted` stays `false` in Firestore. On next app open:

1. `profileSetup.onboardingCompleted === false` → not short-circuited
2. `exerciseInterests.length > 0` → skip `interests` branch
3. `primaryGoal` is set → skip `setup-finish` branch
4. Falls through to `return '/app/profile/completion'` ← user lands on step 1 again

**Fix:** The skip button should call `saveProfileSetup.mutateAsync({ ..., onboardingCompleted: true })` before navigating.

---

### Secondary Issue — `ProfileCompletionScreen` skip also writes `onboardingCompleted: false`

`src/features/Profile/ProfileCompletionScreen.tsx:126`

```ts
onboardingCompleted: false,   // hardcoded in handleSkipForNow
```

Every skip in step 1 explicitly re-asserts `false`. This is fine for mid-flow, but it means even if a user previously completed onboarding and then revisits `/app/profile/completion` for editing (e.g., to update health data), saving from that screen will overwrite `onboardingCompleted` back to `false`.

**Fix:** Don't hardcode `false` — pass `setup?.onboardingCompleted ?? false` so existing completion state is preserved.

---

### Secondary Issue — `ONBOARDING_PATHS` missing `/app/profile/privacy-settings`

`src/hooks/useProfileSetup.ts:7–11`

The actual 4-step flow is:
1. `/app/profile/completion` (personal info + health data)
2. `/app/profile/interests` (interests + goals)
3. `/app/profile/privacy-settings` (privacy options)
4. `/app/profile/setup-finish` (display name + finish)

But `ONBOARDING_PATHS` only lists steps 1, 2, 4. Step 3 (`/app/profile/privacy-settings`) is not included. This means `isOnboardingPath('/app/profile/privacy-settings')` returns `false`, which causes `RequireProfileSetup mode="onboarding"` to skip the redirect guard for that path.

The immediate consequence is minor (the screen still works), but it means the guard won't enforce correct sequencing if a user navigates directly to privacy settings out of order.

---

## 2. Source of Truth — Current State

| Signal | Location | Written by | Read by |
|--------|----------|-----------|---------|
| `onboardingCompleted` | `users/{uid}.profile.onboardingCompleted` | `ProfileSetupFinishScreen.handleFinishSetup()` only | `getOnboardingPath`, `RequireProfileSetup` |
| `exerciseInterests[]` | `users/{uid}.profile.exerciseInterests` | `ProfileInterestsScreen.handleNext()` | `getOnboardingPath`, `ProfileInterestsScreen` |
| `primaryGoal` | `users/{uid}.profile.primaryGoal` | `ProfileInterestsScreen.handleNext()` | `getOnboardingPath`, `ProfileSetupFinishScreen` |
| `personalInfo.*` | `users/{uid}.profile.personalInfo.*` | `ProfileCompletionScreen.handleNext()` | `ProfileScreen`, `ProfileSetupFinishScreen` |
| `privacySettings.*` | `users/{uid}.profile.privacySettings.*` | `ProfilePrivacySettingsScreen.handleFinish()` | `ProfilePrivacySettingsScreen` |
| Profile cache | TanStack Query `['profile-setup', uid]` | `useSaveProfileSetup.onSuccess` invalidates | `useProfileSetup(uid)` |

**No `wellnessInterests` field exists.** `UserProfileSetup` only has `exerciseInterests`. The wellness dimension is captured only through `primaryGoal`/`secondaryGoal`. The spec mentions "wellness interests" — these would need to be added as a new field.

**No `goals[]` array field.** Goals are stored as `primaryGoal` (string) and `secondaryGoal` (string) — max 2. The interests screen allows up to 3 selected goals but only saves the first two.

---

## 3. Data Persistence Verification

| Check | Status | Notes |
|-------|--------|-------|
| Written to Firestore | ✅ | `setDoc(ref, payload, { merge: true })` |
| Written to correct document | ✅ | `users/{uid}` |
| Merge vs overwrite | ✅ | `{ merge: true }` at root; `profile` key replaced as unit |
| Read back after refresh | ✅ | `getDoc(users/{uid})` → `data.profile` |
| Read back after logout/login | ✅ | No local storage dependency |
| Cache invalidated on save | ✅ | `queryClient.invalidateQueries(['profile-setup', uid])` in `onSuccess` |
| Cache staleTime | ⚠️ | 5 minutes — fresh navigation to an onboarding screen within 5 min of save may briefly show stale data |

**Risk:** `setDoc` with `{ merge: true }` merges at the **top-level key** (`profile`). Since the entire `profile` object is passed as a unit, all fields inside `profile` are replaced on every save. This is correct given the current design (each screen passes all fields), but means every save must include all existing fields or they will be lost if they're not in the payload. The current code guards against this by loading `setup` and spreading existing values, but the `undefined` → empty-string normalization in `upsertProfileSetup` could silently clear optional fields.

---

## 4. Interest Selection Limit

The spec mentions "limits selection to 2." After audit:

- **Exercise interests**: cap is `10` (`if (prev.length >= 10) return prev`)
- **Wellness goals**: cap is `3` (`if (prev.length >= 3) return prev`)
- **Display truncation**: The summary card shows only `.slice(0, 2)` items before "+N more" — this is what appears as "limited to 2" in the UI, but it's display-only

**Verdict:** The "2" is a display truncation, not a selection limit. Goals are capped at 3.

**Recommendation:** 
- Remove the `exerciseInterests` cap (or raise to 15 to match the list length)
- Remove the goals cap (or raise to 5); the data model stores `primaryGoal` + `secondaryGoal` (2 fields), so anything beyond 2 is dropped at save time — this is a data model bug
- Fix data model to use `goals: string[]` instead of `primaryGoal` + `secondaryGoal`

---

## 5. Current Interests & Goals vs Best-Practice MVP

### Exercise Interests (current: 15 items)

| Current | Assessment |
|---------|-----------|
| Running, Walking | ✅ |
| Gym/Weightlifting, Home Workouts | ✅ |
| Yoga, Swimming, Cycling | ✅ |
| Football (Soccer) | ✅ East Africa relevant |
| Hiking, Group Fitness, HIIT/Circuit | ✅ |
| Pilates, Dancing | ✅ |
| Stretching/Mobility | ✅ |
| Other | ✅ |

**Missing (recommended additions):**
- Jump Rope/Skipping 🪢 — very popular in East Africa, low cost
- Basketball 🏀 — widely played
- Martial Arts/Boxing 🥊 — popular
- Badminton 🏸

### Wellness Goals (current: 12 items)

| Current | Assessment |
|---------|-----------|
| Weight Loss, Build Strength, Improve Fitness | ✅ |
| Stay Healthy & Active, Manage Health Condition | ✅ |
| Reduce Stress, Increase Energy | ✅ |
| Improve Flexibility, Build Daily Routine | ✅ |
| Feel More Confident, Stay Accountable | ✅ |
| Other | ✅ |

**Missing (recommended additions):**
- Sleep Better 😴 — top wellness concern globally
- Improve Nutrition / Eat Better 🥗 — core to most wellness journeys
- Improve Mental Health / Mood 🧠 — growing category
- Sports Performance ⚡ — for athletes joining challenges

### New: Wellness Interests (currently missing as a category)

If wellness interests are to be added as a distinct field, recommended MVP set:

| Wellness Interest | Notes |
|-----------------|-------|
| Meditation / Mindfulness 🧘 | |
| Sleep Tracking 😴 | |
| Nutrition / Healthy Eating 🥗 | |
| Hydration 💧 | |
| Mental Health 🧠 | |
| Fasting / Intermittent Fasting ⏱️ | Popular |
| Stress Relief 🌿 | |
| Breathwork 🌬️ | |
| Cold Exposure / Ice Baths 🧊 | Growing trend |
| Journaling / Gratitude 📓 | Habit-based |

---

## 6. Onboarding Education Flow

**Current state:** None. `WelcomeScreen` is a single hero image with "Get Started" → SignupScreen. No slides, no explanation of the app.

**Recommended lightweight slide sequence (5–6 slides):**

| # | Title | Content | Visual |
|---|-------|---------|--------|
| 1 | Welcome to Tiizi | "The first community accountability app for fitness and wellness in Africa." | Hero image |
| 2 | Join a Group | "Find a group of friends, teammates, or colleagues who keep you moving." | Groups illustration |
| 3 | Take on Challenges | "Compete, collaborate, or build streaks together — Collective, Competitive, and Streak challenges." | Challenge types |
| 4 | Log Your Activity | "Track workouts, wellness habits, hydration, sleep, and more in seconds." | Logging screen |
| 5 | Watch the Leaderboard | "See who's crushing it. Celebrate wins. Push each other forward." | Leaderboard |
| 6 | Keep Tiizi Free | "Tiizi is free. Help keep it that way by contributing when you can — it's optional." | Support screen |

Implementation note: Slides should appear only once (gated by a `hasSeenIntro` flag in localStorage or Firestore). Existing users who have `onboardingCompleted: true` should bypass slides.

---

## 7. Files Affected (Proposed Fix Plan)

### P0 — Fixes the re-onboarding loop (must do)

| File | Change |
|------|--------|
| `src/hooks/useProfileSetup.ts` | Fix `getOnboardingPath` fallback: `return '/app/profile/setup-finish'` (not completion) |
| `src/features/Profile/ProfileSetupFinishScreen.tsx` | Skip button must save `{ onboardingCompleted: true }` before navigating |
| `src/features/Profile/ProfileCompletionScreen.tsx` | `handleSkipForNow`: pass `setup?.onboardingCompleted ?? false` instead of hardcoded `false` |
| `src/hooks/useProfileSetup.ts` | Add `/app/profile/privacy-settings` to `ONBOARDING_PATHS` |

### P1 — Data model + interests improvements

| File | Change |
|------|--------|
| `src/services/userProfileService.ts` | Add `wellnessInterests?: string[]` and `goals?: string[]` to `UserProfileSetup` type; migrate `primaryGoal`/`secondaryGoal` to `goals[]` array |
| `src/features/Profile/ProfileInterestsScreen.tsx` | Add wellness interests tab/section; fix goals save to use `goals[]`; remove hard caps |
| `src/hooks/useProfileSetup.ts` | Update `getOnboardingPath` to check `goals?.length > 0` alongside `primaryGoal` |

### P2 — Onboarding intro slides

| File | Change |
|------|--------|
| `src/features/Welcome/WelcomeScreen.tsx` OR new `src/features/Onboarding/OnboardingSlides.tsx` | Add swipeable 5-slide intro |
| `src/App.tsx` | Route `/app/onboarding` → `OnboardingSlides`; redirect new users post-signup |

---

## 8. Proposed Source-of-Truth Model

```
users/{uid}.profile = {
  onboardingCompleted: boolean         // true only after finish step
  hasSeenIntro: boolean                // true after viewing slides (new field)

  exerciseInterests: string[]          // existing
  wellnessInterests: string[]          // NEW — separate from exercise
  goals: string[]                      // NEW — replaces primaryGoal + secondaryGoal
  customInterests: string[]            // existing
  customGoals: string[]                // existing

  primaryGoal: string                  // KEEP for backwards compat; derive from goals[0]
  secondaryGoal: string                // KEEP for backwards compat; derive from goals[1]
  
  personalInfo: { ... }               // existing
  privacySettings: { ... }            // existing
  region: string                      // existing
}
```

Migration: read `primaryGoal`/`secondaryGoal` as fallback if `goals` is empty.

---

## 9. Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Existing users with `onboardingCompleted: false` who have real data | After P0 fix they'll land on setup-finish, see their name, and can click "Finish Setup" once to persist `true` | Acceptable one-time friction |
| `setDoc { merge: true }` replacing entire `profile` object | Could silently clear new fields added to `profile` if not included in every save payload | All save paths must be audited to include new fields |
| Intro slides shown to existing users after deploy | `hasSeenIntro` will be `undefined` for all existing users → they'd see slides on next login | Gate slides on `onboardingCompleted === false` OR `hasSeenIntro !== true`; existing users with `onboardingCompleted: true` bypass |
| `primaryGoal`/`secondaryGoal` deprecation | Anything reading these fields will see empty if `goals[]` is adopted | Keep both fields; derive `primaryGoal = goals[0]` on write |

---

## 10. Validation Commands (for implementation phase)

```bash
npx tsc --noEmit
npm run build
npm run test:profile-analytics-guards
npm run test:scoring-guards
```

New guard file to add: `scripts/testOnboardingGuards.ts`

Proposed guards:
- `getOnboardingPath` with `{ onboardingCompleted: false, exerciseInterests: ['running'], primaryGoal: 'weight-loss' }` returns `/app/profile/setup-finish` (not completion)
- `getOnboardingPath` with `{ onboardingCompleted: true }` returns `/app/home`
- `getOnboardingPath` with `null` returns `/app/profile/interests`
- `ProfileSetupFinishScreen` Skip button calls `saveProfileSetup` with `onboardingCompleted: true`
- `ProfileCompletionScreen` does not hardcode `onboardingCompleted: false` in skip path
- `ONBOARDING_PATHS` includes `/app/profile/privacy-settings`

---

## 11. Manual Test Plan (for implementation phase)

1. **Happy path**: New user → signup → step 1 (fill all) → step 2 (interests + goals) → step 3 (privacy) → step 4 (finish) → home. Log out. Log back in. Should land on home. ✓
2. **Skip all**: New user → signup → skip step 1 → skip interests → skip finish → home. Log out. Log in. Should land on home (not step 1). ✓
3. **Partial: complete interests, skip finish**: Complete interests, skip step 4. Log out. Log in. Should land on step 4 (not step 1). ✓
4. **Returning user**: Fully onboarded user. Log out. Log in. Should go directly to home. ✓
5. **Edit personal info**: Navigate to `/app/profile/completion` manually from profile settings. Fill data. Save. Navigate to home. Log out. Log in. Should still go to home (not restart onboarding). ✓
6. **Interest selection**: Open interests modal, select 15 items. Should not hard-stop at 10. ✓
7. **Goals selection**: Select 5 goals. All should be saved. ✓

---

## Questions / Blockers Before Implementation

1. **`primaryGoal`/`secondaryGoal` migration**: Should we migrate existing Firestore data from `primaryGoal`/`secondaryGoal` → `goals[]`? Or just add `goals[]` as additive and keep old fields as fallback? Recommend: additive + fallback, no migration script needed.

2. **`wellnessInterests` as separate step or merged**: Should wellness interests be a fourth tab in the current `ProfileInterestsScreen` modal, or a new screen between interests and goals? Recommend: add a second tab in the existing modal (lowest effort, same screen).

3. **Intro slides — when to show**: After signup only, or also for users who didn't see them? If existing users (who signed up before slides existed) should see slides once, the `hasSeenIntro` flag is needed. If skip for existing users, no flag needed — just gate on being a new signup (user created in last 60 seconds).

4. **Interest min count**: The spec says "min 3 required." Currently `handleNext` allows `selectedInterests.length >= 1`. Should the min be raised to 3 before implementing? Confirm: yes or no.

---

## Audit Report Path

`docs/superpowers/reports/phase-18I-6O-onboarding-audit.md`
