# Onboarding Stuck-on-Step-1 — Root Cause and Fix

Date: 2026-07-11
Branch: `fix/p0-pre-deploy-blockers`

> **Update (Phase 7D):** this report now also covers the three follow-up
> gaps found during review of the original fix — see "Phase 7D" sections
> below. The original root-cause analysis (Parts 1–9) is unchanged and kept
> for history.

## 1. Exact root cause

`getOnboardingPath()` in [src/hooks/useProfileSetup.ts](src/hooks/useProfileSetup.ts) computes which onboarding
step an incomplete user should be on, and `RequireProfileSetup` (mode=`"onboarding"`) redirects the browser to that
computed path whenever the *current* pathname doesn't match it. The bug: the function used **the wrong step's own
data** as the completion signal for the step the user had just finished, so it kept recomputing "you're still on
Step 1" and silently bounced the user back immediately after every successful save-and-navigate.

## 2. Why no console error appeared

None of this involves an exception. The save succeeds, the navigate succeeds, and `RequireProfileSetup` then
performs a perfectly normal, intentional `<Navigate replace>` redirect — by design, not by failure.

## 3. Files changed

**Original fix:**
- `src/hooks/useProfileSetup.ts`, `src/services/userProfileService.ts`,
  `src/features/Profile/ProfileWellnessInterestsScreen.tsx`,
  `src/features/Profile/ProfilePrivacySettingsScreen.tsx`, `scripts/testOnboardingGuards.ts`.

**Phase 7D (this update):**
- `src/hooks/useProfileSetup.ts` — added `MIN_EXERCISE_INTERESTS = 3` shared constant; Step 2 gate now uses it.
- `src/features/Profile/ProfileInterestsScreen.tsx` — imports and uses `MIN_EXERCISE_INTERESTS` instead of a
  literal `3` in both the validation check and the Next-button disable condition.
- `src/features/Profile/ProfileWellnessInterestsScreen.tsx` — `handleNext`/`handleSkip` now delegate to one shared
  `saveAndContinue()`; hydrates and persists `customWellnessInterests`.
- `src/services/userProfileService.ts` — added `customWellnessInterests: string[]` to the schema (read + write).
- `src/features/Onboarding/OnboardingSlides.tsx`, `src/features/Profile/EditProfileScreen.tsx`,
  `src/features/Profile/ProfileCompletionScreen.tsx`, `src/features/Profile/ProfileHealthGoalsScreen.tsx`,
  `src/features/Profile/ProfilePersonalInfoScreen.tsx`, `src/features/Profile/ProfilePrivacySettingsScreen.tsx`,
  `src/features/Profile/ProfileSettingsScreen.tsx`, `src/features/Profile/ProfileSetupFinishScreen.tsx` — each
  preserves `customWellnessInterests` in their save payload (`setup?.customWellnessInterests ?? []`), matching the
  existing `customInterests`/`customGoals` preservation pattern already used for every other field.
- `scripts/testOnboardingGuards.ts`, `scripts/testPilotUxPolishGuards.ts` — expanded with the new assertions
  described under Tests below.

## 4–9. Original root-cause detail, mutation/cache behavior, rules, route matrix

Unchanged from the original fix — see Sections 4–9 of the prior version of this report (preserved in git history)
for the full before/after control-flow trace, the field-by-field save/guard table, the query-invalidation proof,
and confirmation that `firestore.rules` needed no changes (`profile` and `photoURL` were already fully
self-writable; `role`/`profile.role` remain blocked).

---

## Phase 7D — Closing three follow-up gaps

### Issue 1: Step 3 Skip silently suppressed save failure

**Before:**
```ts
const handleSkip = async () => {
  if (!user?.uid) { navigate('/app/profile/health-goals'); return; }
  try { await saveProfileSetup.mutateAsync(buildPayload()); } catch { /* non-blocking */ }
  navigate('/app/profile/health-goals');
};
```
Skip awaited the save but discarded any failure and navigated unconditionally — so a failed save still let the
user reach Step 4 without `wellnessInterestsCompleted` ever having been persisted, and with no error shown.

**After:** `handleNext` and `handleSkip` both delegate to one shared function:
```ts
const saveAndContinue = async () => {
  if (!user?.uid) { navigate('/app/login'); return; }
  try {
    await saveProfileSetup.mutateAsync(buildPayload());
    navigate('/app/profile/health-goals');
  } catch (error) {
    console.error('Profile setup save failed (step 3):', error);
    showToast('Could not save your selections.', 'error');
  }
};
const handleNext = () => saveAndContinue();
const handleSkip = () => saveAndContinue();
```
Navigation only happens after a successful save; a failure stays on Step 3, shows a toast, and logs to the
console — no empty or suppressed catch remains. The Skip button is now `disabled={saveProfileSetup.isPending}`
and shows "Saving..." while pending, identically to the Next button.

### Issue 2: Step 2 guard now enforces the approved minimum of 3

**Result:** Added `export const MIN_EXERCISE_INTERESTS = 3;` to `useProfileSetup.ts` and changed the Step 2 gate
from `!profileSetup?.exerciseInterests?.length` (any non-empty array passed) to
`(profileSetup?.exerciseInterests?.length ?? 0) < MIN_EXERCISE_INTERESTS`. `ProfileInterestsScreen.tsx`'s own
Next-button validation and disable condition now import and use the same constant, so the screen and the route
guard can never drift apart again. 0, 1, and 2 selections all resolve to `/app/profile/interests`; 3+ proceeds.
The maximum of 10 (enforced in the screen's own `toggle()` selection cap) was not touched.

### Issue 3: Custom wellness text was being discarded

**Trace:** `customInterests` is a live, already-used field — `ProfileInterestsScreen.tsx`'s "Other activity" input
saves into it (`customInterests: customInterest.trim() ? [customInterest.trim()] : []`). Reusing it for wellness
text would silently overwrite Step 2's custom exercise entry with Step 3's custom wellness entry (both screens
write the *same* field). The schema already has a second, precedented pattern for this exact situation:
`customGoals` mirrors `goals` the same way `customInterests` mirrors `exerciseInterests` — one dedicated
`customX: string[]` array per selection category, always a single-item array holding the trimmed free-text value,
hydrated from `[0]` and written from the current input.

**Decision:** add `customWellnessInterests: string[]`, mirroring the existing `customInterests`/`customGoals`
pattern exactly — not a novel design choice, but completing a pattern the schema already establishes twice. No
ambiguity to report.

**Implementation:**
```ts
// hydration
setCustomWellness(setup.customWellnessInterests?.[0] ?? '');

// save
customWellnessInterests: customWellness.trim() ? [customWellness.trim()] : (setup?.customWellnessInterests ?? []),
```
Trimmed, and Skip-with-empty-text is valid (preserves whatever was already saved rather than clobbering it).
Every other onboarding/profile screen that saves a full payload now preserves the existing value
(`setup?.customWellnessInterests ?? []`) so it's never lost by an unrelated step's save.

## Tests

Added to `scripts/testOnboardingGuards.ts`:

1. Step 3 Skip awaits `mutateAsync` before navigation — ordering assertion on the shared `saveAndContinue` body.
2. Step 3 Skip does not navigate from a catch block — asserts the Step-4 `navigate(...)` call appears exactly
   once, positioned before the `catch`.
3. Step 3 Skip displays a user-visible error on failed save — asserts `showToast(` inside the catch.
4. Step 3 Skip is disabled while saving — asserts `disabled={saveProfileSetup.isPending}` and a `'Saving...'`
   label on the Skip button.
5–8. Step 2 guard rejects 0/1/2 interests and accepts 3 — a genuine **behavioral** test: extracts
   `getOnboardingPath`'s function body from the live source file and executes it via `new Function(...)` against
   real `{exerciseInterests: [...]}` inputs of length 0, 1, 2, and 3 (the last combined with all later steps
   marked done), asserting the exact returned path. (This only evaluates our own trusted source file content, not
   external input — not a code-injection risk in this dev-only static-analysis script.)
9. Step 3 custom wellness input is persisted and hydrated — asserts the schema field, the write, the read-back
   default, the hydration line, and the save line all exist with the exact shapes described above.
10. No empty/non-blocking catch remains in any of the five onboarding screens' primary Next/Finish handler (Skip's
    intentional non-blocking pattern in *other* screens' explicit "Skip for now" escape hatches was left alone —
    out of scope, a different, pre-existing, deliberate UX pattern not touched by this task).

## Verification commands

```
npx tsx scripts/testOnboardingGuards.ts        → PASS (all Phase 7D assertions included)
npx tsx scripts/testPilotUxPolishGuards.ts     → PASS
npx tsx scripts/testHomePerformanceGuards.ts   → PASS
npx tsc --noEmit                                → clean, 0 errors
npm run build                                   → succeeds (pre-existing >500kB chunk warning only)

Full guard suite (scripts/test*.ts, 53 scripts):
PASSED: 53
FAILED: 0
```

`firestore.rules` unchanged — `customWellnessInterests` lives under the already-self-writable `profile` map, no
rules change needed.

## Browser tests (fresh accounts, live dev server)

**A — select exactly 2 activities:** confirmed `document.querySelector('button:contains(Next Step)').disabled === true`.
Next remained blocked. ✅

**B — select exactly 3 activities:** confirmed `disabled === false`; clicked Next Step, advanced cleanly to Step 3
("Wellness Topics", 60%). ✅

**C — Step 3, select no topics, click Skip:** advanced to Step 4 ("Health Goals", 80%). Reloaded
`/app/profile/health-goals` directly — remained on Step 4, no bounce back to Step 3. ✅

**D — simulated Step 3 save failure:** temporarily added a dev-only, query-param-gated throw
(`?simulateSaveFailure=1`) inside `upsertProfileSetup` (removed immediately after the test — confirmed via
`grep` that no trace remains in the source). With it active, clicking Skip: stayed on Step 3 (no navigation to
Step 4), `console.error` logged `"Profile setup save failed (step 3): Error: Simulated save failure..."`, and
the DOM confirmed the toast text `"Could not save your selections."` rendered. Re-ran without the simulated
failure immediately after — Skip worked normally and advanced to Step 4. ✅

**E — "Other wellness topic" persistence:** entered "Foam rolling" as custom wellness text, saved via Next,
advanced through the rest of onboarding. Since a fully-onboarded user (and even a user who has advanced past
Step 3) cannot revisit Step 3 through the UI — `RequireProfileSetup` redirects forward on any pathname mismatch,
a pre-existing, unrelated router limitation not in scope for this fix (see "Remaining risks" below) — persistence
was verified directly against Firestore via an authenticated admin read:
```json
{
  "wellnessInterests": ["preventive-health"],
  "customWellnessInterests": ["Foam rolling"],
  "wellnessInterestsCompleted": true
}
```
Confirms the custom text round-tripped through the save exactly as entered, trimmed, alongside the selected topic
and the completion marker. ✅

All five browser tests pass. No console errors were observed outside the intentional Test D simulation.

## Remaining risks or manual tests

- **Previous/Back navigation to an already-completed step still redirects forward** (pre-existing, unrelated to
  this fix, not touched — see the original report and the Phase 7C completion report). This meant Test E's
  "return/reload to Step 3" step had to be verified via direct Firestore read instead of UI navigation, since the
  guard correctly refuses to let a user go backward past their current furthest step. Flagged again here for
  visibility since it directly affected how this phase's testing had to be done, not because it's a new issue.
- **Test D's failure simulation was code-level, not network-level.** An initial attempt to simulate failure by
  monkey-patching `window.fetch` did not work because the Firestore SDK's WebChannel transport does not go
  through a simple interceptable `fetch` call in this environment — it just retried silently. The dev-only
  query-param throw used instead exercises the exact same catch/toast/no-navigate code path and was fully removed
  afterward; a completely offline/network-layer failure (e.g. via DevTools Protocol network throttling) was not
  separately exercised, but is not expected to behave differently since the mutation function's own promise
  rejection is what the code branches on, regardless of cause.
- Three test accounts were created against the live `tiizi-challenges` Firestore project during this session's
  browser testing (`phase7d.test.20260711@example.com`, `phase7d.skip.20260711@example.com`,
  `phase7d.fail.20260711@example.com`, plus `onboarding.test.p7c.20260711@example.com` from the original fix
  verification) and were left in place, consistent with the prior phase's testing pattern — no cleanup script was
  run against them.
