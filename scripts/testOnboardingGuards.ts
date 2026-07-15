/**
 * Phase 18I-6O — Onboarding persistence + expanded interests guards.
 * Updated for the 5-step onboarding split (Phase 1 guard triage):
 *   Step 1 personal → Step 2 exercise → Step 3 wellness topics →
 *   Step 4 health goals → Step 5 privacy.
 * Run: npm run test:onboarding-guards
 */
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

// File refs
const profileSetup = read('src/hooks/useProfileSetup.ts');
const userProfileService = read('src/services/userProfileService.ts');
const profileCompletion = read('src/features/Profile/ProfileCompletionScreen.tsx');
const profileInterests = read('src/features/Profile/ProfileInterestsScreen.tsx');
const profileWellnessInterests = read('src/features/Profile/ProfileWellnessInterestsScreen.tsx');
const profileHealthGoals = read('src/features/Profile/ProfileHealthGoalsScreen.tsx');
const profilePrivacy = read('src/features/Profile/ProfilePrivacySettingsScreen.tsx');
const profileFinish = read('src/features/Profile/ProfileSetupFinishScreen.tsx');
const onboardingSlides = read('src/features/Onboarding/OnboardingSlides.tsx');
const appTsx = read('src/App.tsx');
const signupScreen = read('src/features/Auth/SignupScreen.tsx');
const firestoreRules = read('firestore.rules');

// ─── ONBOARDING_PATHS ────────────────────────────────────────────────────────
assert.match(profileSetup, /\/app\/onboarding\/intro/, 'ONBOARDING_PATHS must include /app/onboarding/intro');
assert.match(profileSetup, /\/app\/profile\/wellness-interests/, 'ONBOARDING_PATHS must include /app/profile/wellness-interests');
assert.match(profileSetup, /\/app\/profile\/health-goals/, 'ONBOARDING_PATHS must include /app/profile/health-goals');
assert.match(profileSetup, /\/app\/profile\/privacy-settings/, 'ONBOARDING_PATHS must include /app/profile/privacy-settings');
assert.match(profileSetup, /\/app\/profile\/setup-finish/, 'ONBOARDING_PATHS must include /app/profile/setup-finish');

// ─── getOnboardingPath logic ──────────────────────────────────────────────────
assert.match(profileSetup, /hasSeenIntro.*onboarding\/intro|onboarding\/intro.*hasSeenIntro/, 'getOnboardingPath must gate on hasSeenIntro → intro');
assert.match(profileSetup, /wellnessInterests.*wellness-interests|wellness-interests.*wellnessInterests/, 'getOnboardingPath must check wellnessInterests → wellness-interests step');
assert.match(profileSetup, /goals\?\.length.*health-goals|health-goals.*goals\?\.length/, 'getOnboardingPath must check goals → health-goals step');
// Fallback must NOT go back to completion when interests are present
assert.doesNotMatch(profileSetup, /return '\/app\/profile\/completion';\s*\}$/, 'getOnboardingPath fallback must not return completion as the final return');
assert.match(profileSetup, /return '\/app\/profile\/setup-finish'/, 'getOnboardingPath final fallback must be /app/profile/setup-finish');

// ─── UserProfileSetup type ────────────────────────────────────────────────────
assert.match(userProfileService, /wellnessInterests\s*:\s*string\[\]/, 'UserProfileSetup must have wellnessInterests: string[]');
assert.match(userProfileService, /goals\s*:\s*string\[\]/, 'UserProfileSetup must have goals: string[]');
assert.match(userProfileService, /hasSeenIntro\s*:\s*boolean/, 'UserProfileSetup must have hasSeenIntro: boolean');

// ─── goals[] backward-compat read ────────────────────────────────────────────
assert.match(userProfileService, /primaryGoal.*secondaryGoal.*filter\(Boolean\)|derivedGoals/, 'getProfileSetup must derive goals[] from primaryGoal/secondaryGoal for old records');

// ─── wellnessInterests persistence in write ───────────────────────────────────
assert.match(userProfileService, /wellnessInterests\s*:\s*input\.wellnessInterests/, 'upsertProfileSetup must write wellnessInterests');
assert.match(userProfileService, /hasSeenIntro\s*:\s*input\.hasSeenIntro/, 'upsertProfileSetup must write hasSeenIntro');

// ─── ProfileCompletionScreen ──────────────────────────────────────────────────
assert.match(profileCompletion, /wellnessInterests\s*:\s*setup\?\.wellnessInterests/, 'ProfileCompletionScreen handleNext must pass wellnessInterests');
assert.match(profileCompletion, /goals\s*:\s*setup\?\.goals/, 'ProfileCompletionScreen handleNext must pass goals');
assert.match(profileCompletion, /hasSeenIntro\s*:\s*setup\?\.hasSeenIntro/, 'ProfileCompletionScreen handleNext must pass hasSeenIntro');
assert.match(profileCompletion, /onboardingCompleted\s*:\s*setup\?\.onboardingCompleted\s*\?\?\s*false/, 'ProfileCompletionScreen must preserve onboardingCompleted');

// ─── ProfileInterestsScreen (Step 2 — Activities only) ───────────────────────
// Step 2 no longer owns goals; it preserves existing goals from setup
assert.match(profileInterests, /goals\s*:\s*profileSetup\?\.goals\s*\?\?\s*\[\]/, 'ProfileInterestsScreen must preserve existing goals (not own selectedGoals)');
assert.doesNotMatch(profileInterests, /selectedGoals/, 'ProfileInterestsScreen must not reference selectedGoals (goals moved to Step 3)');
assert.match(profileInterests, /navigate\(['"]\/app\/profile\/wellness-interests['"]\)/, 'ProfileInterestsScreen must navigate to /app/profile/wellness-interests');
assert.match(profileInterests, /wellnessInterests\s*:\s*profileSetup\?\.wellnessInterests/, 'ProfileInterestsScreen handleNext must preserve wellnessInterests');
assert.match(profileInterests, /hasSeenIntro\s*:\s*profileSetup\?\.hasSeenIntro/, 'ProfileInterestsScreen handleNext must pass hasSeenIntro');

// ─── ProfileWellnessInterestsScreen (Step 3 — Wellness Topics only) ──────────
// Step 3 owns wellness interests only; goals moved to Step 4 (ProfileHealthGoalsScreen).
assert.match(profileWellnessInterests, /wellnessInterests\s*:\s*selectedWellness/, 'ProfileWellnessInterestsScreen must save wellnessInterests: selectedWellness');
assert.match(profileWellnessInterests, /goals\s*:\s*setup\?\.goals\s*\?\?\s*\[\]/, 'ProfileWellnessInterestsScreen must preserve existing goals (not own selectedGoals)');
assert.doesNotMatch(profileWellnessInterests, /selectedGoals/, 'ProfileWellnessInterestsScreen must not reference selectedGoals (goals moved to Step 4)');
assert.match(profileWellnessInterests, /navigate\(['"]\/app\/profile\/health-goals['"]\)/, 'ProfileWellnessInterestsScreen must navigate to /app/profile/health-goals');

// ─── ProfileHealthGoalsScreen (Step 4 — Health Goals) ────────────────────────
// Step 4 owns goal selection.
assert.match(profileHealthGoals, /goals\s*:\s*selectedGoals/, 'ProfileHealthGoalsScreen must save goals: selectedGoals (owns goal selection)');
assert.match(profileHealthGoals, /navigate\(['"]\/app\/profile\/privacy-settings['"]\)/, 'ProfileHealthGoalsScreen must navigate to /app/profile/privacy-settings');
assert.match(profileHealthGoals, /navigate\(['"]\/app\/profile\/wellness-interests['"]\)/, 'ProfileHealthGoalsScreen Previous/back must go to /app/profile/wellness-interests');
// goals[] hydration from stored goals with scalar fallback
assert.match(profileHealthGoals, /setup\.goals.*primaryGoal|goals\?\.length/, 'ProfileHealthGoalsScreen must hydrate selectedGoals from goals[] with scalar fallback');
assert.match(profileHealthGoals, /Step 4 of 5/, 'ProfileHealthGoalsScreen must label itself "Step 4 of 5"');

// ─── ProfilePrivacySettingsScreen (Step 5) ───────────────────────────────────
assert.match(profilePrivacy, /wellnessInterests\s*:\s*setup\?\.wellnessInterests/, 'ProfilePrivacySettingsScreen must pass wellnessInterests');
assert.match(profilePrivacy, /goals\s*:\s*setup\?\.goals/, 'ProfilePrivacySettingsScreen must pass goals');
assert.match(profilePrivacy, /hasSeenIntro\s*:\s*setup\?\.hasSeenIntro/, 'ProfilePrivacySettingsScreen must pass hasSeenIntro');
assert.match(profilePrivacy, /onboardingCompleted\s*:\s*setup\?\.onboardingCompleted\s*\?\?\s*false/, 'ProfilePrivacySettingsScreen must preserve onboardingCompleted');
assert.match(profilePrivacy, /navigate\(['"]\/app\/profile\/health-goals['"]\)/, 'ProfilePrivacySettingsScreen back must go to /app/profile/health-goals');
assert.match(profilePrivacy, /Step 5 of 5/, 'ProfilePrivacySettingsScreen must label itself "Step 5 of 5"');

// ─── ProfileSetupFinishScreen skip + handleFinishSetup ───────────────────────
assert.match(profileFinish, /onboardingCompleted\s*:\s*true/, 'ProfileSetupFinishScreen must set onboardingCompleted: true');
// wellnessInterests must appear in the file (shared via basePayload helper or inline in both paths)
assert.match(profileFinish, /wellnessInterests/, 'ProfileSetupFinishScreen must include wellnessInterests in its save logic');
// Launchpad sections
assert.match(profileFinish, /Your Tiizi Profile/, 'ProfileSetupFinishScreen must include "Your Tiizi Profile" section');
assert.match(profileFinish, /Recommended for You/, 'ProfileSetupFinishScreen must include "Recommended for You" section');
// Skip must also mark onboardingCompleted true (via shared basePayload)
assert.match(profileFinish, /handleSkip/, 'ProfileSetupFinishScreen must have a handleSkip function');
assert.doesNotMatch(profileFinish, /handleSkip[\s\S]{0,200}onboardingCompleted\s*:\s*false/, 'handleSkip must not set onboardingCompleted: false');
// Max selections guards
assert.match(profileInterests, /MAX\s*=\s*10/, 'ProfileInterestsScreen activities MAX must be 10');
assert.match(profileWellnessInterests, /MAX_WELLNESS\s*=\s*10|const MAX\s*=\s*10/, 'ProfileWellnessInterestsScreen wellness MAX must be 10');
assert.match(profileHealthGoals, /MAX_GOALS\s*=\s*10|MAX\s*=\s*10/, 'ProfileHealthGoalsScreen goals MAX must be 10');
// Step 5 must NOT contain "What You'll Do First"
assert.doesNotMatch(profilePrivacy, /What You'll Do First/, 'ProfilePrivacySettingsScreen must not contain "What You\'ll Do First" section');

// ─── OnboardingSlides ─────────────────────────────────────────────────────────
assert.match(onboardingSlides, /hasSeenIntro\s*:\s*true/, 'OnboardingSlides must write hasSeenIntro: true on completion');
assert.match(onboardingSlides, /navigate\(['"]\/app\/profile\/completion['"]\)/, 'OnboardingSlides must navigate to /app/profile/completion after slides');
assert.match(onboardingSlides, /hasSeenIntro/, 'OnboardingSlides must check hasSeenIntro to skip already-seen intro');
assert.match(onboardingSlides, /getOnboardingPath/, 'OnboardingSlides must call getOnboardingPath to redirect already-seen users');

// ─── App.tsx route registrations ─────────────────────────────────────────────
assert.match(appTsx, /\/app\/onboarding\/intro.*OnboardingSlides|OnboardingSlides.*\/app\/onboarding\/intro/, 'App.tsx must register /app/onboarding/intro route with OnboardingSlides');
assert.match(appTsx, /\/app\/profile\/wellness-interests.*ProfileWellnessInterestsScreen|ProfileWellnessInterestsScreen.*\/app\/profile\/wellness-interests/, 'App.tsx must register /app/profile/wellness-interests route');

// ─── SignupScreen default redirect ───────────────────────────────────────────
assert.match(signupScreen, /\/app\/onboarding\/intro/, 'SignupScreen default nextPath must be /app/onboarding/intro');
assert.doesNotMatch(signupScreen, /return '\/app\/profile\/completion'/, "SignupScreen must not default to /app/profile/completion");

// ─── Phase 6: onboarding gate wiring ─────────────────────────────────────────
const requireProfileSetup = read('src/components/Auth/RequireProfileSetup.tsx');
const requireOnboardedRoute = read('src/components/Auth/RequireOnboardedRoute.tsx');
const requireOnboardingRoute = read('src/components/Auth/RequireOnboardingRoute.tsx');

// RequireOnboardedRoute composes ProtectedRoute + RequireProfileSetup(mode="completed")
assert.match(requireOnboardedRoute, /<ProtectedRoute>/, 'RequireOnboardedRoute must wrap children in ProtectedRoute (auth check)');
assert.match(requireOnboardedRoute, /mode="completed"/, 'RequireOnboardedRoute must use RequireProfileSetup mode="completed"');

// RequireOnboardingRoute composes ProtectedRoute + RequireProfileSetup(mode="onboarding")
assert.match(requireOnboardingRoute, /<ProtectedRoute>/, 'RequireOnboardingRoute must wrap children in ProtectedRoute (auth check)');
assert.match(requireOnboardingRoute, /mode="onboarding"/, 'RequireOnboardingRoute must use RequireProfileSetup mode="onboarding"');

// /app/home must be gated by RequireOnboardedRoute — incomplete users must not bypass onboarding
assert.match(appTsx, /path="\/app\/home"[^/]*RequireOnboardedRoute/, '/app/home route must be wrapped in RequireOnboardedRoute so incomplete users are redirected');

// All 5 onboarding step routes (+ intro) must remain registered and use RequireOnboardingRoute
for (const path of [
  '/app/profile/completion',
  '/app/profile/interests',
  '/app/profile/wellness-interests',
  '/app/profile/health-goals',
  '/app/profile/privacy-settings',
]) {
  const escaped = path.replace(/\//g, '\\/');
  const pattern = new RegExp(`path="${escaped}"[^/]*RequireOnboardingRoute`);
  assert.match(appTsx, pattern, `${path} route must remain registered and wrapped in RequireOnboardingRoute`);
}
assert.match(appTsx, /path="\/app\/onboarding\/intro"[^/]*RequireOnboardingRoute/, '/app/onboarding/intro must be wrapped in RequireOnboardingRoute');

// Admin routes must remain wrapped in AdminRoute, not the onboarding gate (no regression)
assert.match(appTsx, /path="\/app\/admin\/dashboard"[^/]*AdminRoute/, 'Admin routes must remain wrapped in AdminRoute, not RequireOnboardedRoute');
assert.doesNotMatch(appTsx, /path="\/app\/admin\/dashboard"[^/]*RequireOnboardedRoute/, 'Admin routes must not be wrapped in RequireOnboardedRoute');

// Public routes must remain unwrapped (no auth/onboarding gate)
for (const path of ['/app/login', '/app/signup', '/app/welcome', '/install', '/terms', '/privacy']) {
  const escaped = path.replace(/\//g, '\\/');
  const routeLine = appTsx.split('\n').find((l) => l.includes(`path="${path}"`));
  assert.ok(!!routeLine, `Public route ${path} must exist`);
  assert.ok(
    !!routeLine && !routeLine.includes('RequireOnboardedRoute') && !routeLine.includes('RequireOnboardingRoute') && !routeLine.includes('AdminRoute'),
    `Public route ${path} must not be wrapped in any auth/onboarding gate`,
  );
}

// isOnboardingPath must exclude gate loops: onboarding routes should never wrap themselves
// in RequireOnboardedRoute (that would create a redirect loop with mode="completed").
for (const path of [
  '/app/profile/completion',
  '/app/profile/interests',
  '/app/profile/wellness-interests',
  '/app/profile/health-goals',
  '/app/profile/privacy-settings',
  '/app/onboarding/intro',
]) {
  const routeLine = appTsx.split('\n').find((l) => l.includes(`path="${path}"`));
  assert.ok(
    !!routeLine && !routeLine.includes('RequireOnboardedRoute'),
    `Onboarding route ${path} must use RequireOnboardingRoute, not RequireOnboardedRoute (would loop)`,
  );
}

// ─── Step-1-stuck regression fix (Phase 7C) ─────────────────────────────────
// Root cause: getOnboardingPath used `exerciseInterests.length` (Step 2's own
// completion marker) as the gate for leaving Step 1, and routed the
// "incomplete" case back to Step 1's own path — so navigating Step 1 → Step 2
// immediately bounced back to Step 1, since exerciseInterests is still empty
// right after Step 1 saves. These assertions pin the fixed behavior so this
// exact class of bug (a step's own data used to gate the *next* step) can't
// regress silently.

// 1) Step 1 handler saves before navigating (mutateAsync is awaited, and the
//    navigate call to Step 2 appears after it in source order).
{
  const handleNextBody = profileCompletion.slice(
    profileCompletion.indexOf('const handleNext'),
    profileCompletion.indexOf('const handleSkipForNow'),
  );
  const saveIdx = handleNextBody.indexOf('await saveProfileSetup.mutateAsync(');
  const navIdx = handleNextBody.indexOf("navigate('/app/profile/interests')");
  assert.ok(saveIdx !== -1, 'ProfileCompletionScreen handleNext must call saveProfileSetup.mutateAsync');
  assert.ok(navIdx !== -1, 'ProfileCompletionScreen handleNext must navigate to /app/profile/interests');
  assert.ok(saveIdx < navIdx, 'ProfileCompletionScreen handleNext must save before navigating to Step 2');
}

// 2) Step 1's navigation target is a route actually registered in App.tsx.
assert.match(
  appTsx,
  /path="\/app\/profile\/interests"[^/]*RequireOnboardingRoute/,
  'Step 1 navigation target /app/profile/interests must be registered and onboarding-gated in App.tsx',
);

// 3) Step 1 saves the exact fields getOnboardingPath checks to consider Step 1 complete.
assert.match(
  profileCompletion,
  /fullName:\s*fullName\.trim\(\)/,
  'ProfileCompletionScreen must save personalInfo.fullName',
);
assert.match(
  profileCompletion,
  /birthday:\s*birthday\.trim\(\)/,
  'ProfileCompletionScreen must save personalInfo.birthday',
);
assert.match(
  profileSetup,
  /personalInfo\?\.fullName\?\.trim\(\)/,
  'getOnboardingPath must gate Step 1 completion on personalInfo.fullName',
);
assert.match(
  profileSetup,
  /personalInfo\?\.birthday\?\.trim\(\)/,
  'getOnboardingPath must gate Step 1 completion on personalInfo.birthday',
);

// 5) The exerciseInterests check must route to Step 2 (interests), not back to
//    Step 1 (completion) — this is the exact line that caused the stuck loop.
//    Also assert ordering: the personalInfo gate must appear before the
//    exerciseInterests gate, so Step 1 is evaluated before Step 2.
{
  const personalInfoGateIdx = profileSetup.indexOf("personalInfo?.fullName?.trim()");
  const exerciseInterestsGateIdx = profileSetup.indexOf("MIN_EXERCISE_INTERESTS) return '/app/profile/interests'");
  assert.ok(personalInfoGateIdx !== -1 && exerciseInterestsGateIdx !== -1, 'Both personalInfo and exerciseInterests gates must exist in getOnboardingPath');
  assert.ok(personalInfoGateIdx < exerciseInterestsGateIdx, 'getOnboardingPath must check personalInfo (Step 1) before exerciseInterests (Step 2)');
}
assert.match(
  profileSetup,
  /\(profileSetup\?\.exerciseInterests\?\.length \?\? 0\) < MIN_EXERCISE_INTERESTS\) return '\/app\/profile\/interests';/,
  'getOnboardingPath must route an exerciseInterests-incomplete user to Step 2 (/app/profile/interests), not back to Step 1',
);
assert.doesNotMatch(
  profileSetup,
  /if \(!profileSetup\?\.exerciseInterests\?\.length\) return '\/app\/profile\/completion';/,
  'getOnboardingPath must not route an exerciseInterests-incomplete user back to Step 1 (regression check for the stuck-on-step-1 bug)',
);

// ─── Phase 7D: Issue 2 — Step 2 guard must enforce the approved minimum of 3 ─
// Prior version treated any non-empty exerciseInterests as Step 2 complete
// (`!profileSetup?.exerciseInterests?.length`), which would let 1 or 2
// selections pass even though ProfileInterestsScreen requires 3. Both now
// share MIN_EXERCISE_INTERESTS so they can't drift apart again.
assert.match(
  profileSetup,
  /export const MIN_EXERCISE_INTERESTS = 3;/,
  'useProfileSetup must export a shared MIN_EXERCISE_INTERESTS = 3 constant',
);
assert.doesNotMatch(
  profileSetup,
  /if \(!profileSetup\?\.exerciseInterests\?\.length\) return '\/app\/profile\/interests';/,
  'getOnboardingPath must not gate Step 2 on a bare truthy/length check (must use MIN_EXERCISE_INTERESTS instead)',
);
{
  // Behavioral proof, not just text matching: exercise the actual function
  // against 0/1/2/3-length arrays for every state the reported bug and this
  // follow-up both depend on getting right.
  const source = readFileSync(resolve(root, 'src/hooks/useProfileSetup.ts'), 'utf8');
  const fnBody = source.slice(source.indexOf('export function getOnboardingPath'));
  const fnMatch = fnBody.match(/getOnboardingPath\(profileSetup[^)]*\)[^{]*\{([\s\S]*?)\n\}/);
  assert.ok(fnMatch, 'getOnboardingPath function body must be extractable for behavioral testing');
  const HOME_PATH = '/app/home';
  const MIN_EXERCISE_INTERESTS = 3;
  // eslint-disable-next-line no-new-func
  const getOnboardingPath = new Function(
    'profileSetup',
    'HOME_PATH',
    'MIN_EXERCISE_INTERESTS',
    `${fnMatch![1]}`,
  );
  const base = {
    hasSeenIntro: true,
    onboardingCompleted: false,
    personalInfo: { fullName: 'Test User', birthday: '1990-01-01' },
  };
  for (const count of [0, 1, 2]) {
    const path = getOnboardingPath({ ...base, exerciseInterests: Array(count).fill('x') }, HOME_PATH, MIN_EXERCISE_INTERESTS);
    assert.equal(path, '/app/profile/interests', `getOnboardingPath must send a user with ${count} interests back to Step 2 (interests), got ${path}`);
  }
  const withThree = getOnboardingPath(
    { ...base, exerciseInterests: ['a', 'b', 'c'], wellnessInterestsCompleted: true, goals: ['g'], privacySettingsCompleted: true },
    HOME_PATH,
    MIN_EXERCISE_INTERESTS,
  );
  assert.equal(withThree, '/app/profile/setup-finish', `getOnboardingPath must let a user with 3 interests (and all later steps done) proceed, got ${withThree}`);
}

// Step 4 → Step 5 had the identical bug shape: goals-complete users skipped
// straight past privacy-settings to setup-finish. Gate on a dedicated
// completion marker instead of reusing data every earlier step also writes.
assert.match(
  profileSetup,
  /privacySettingsCompleted/,
  'getOnboardingPath must gate Step 5 (privacy-settings) on its own completion marker, not on privacySettings existing (every earlier step writes default privacySettings)',
);
assert.match(
  profilePrivacy,
  /privacySettingsCompleted:\s*true/,
  'ProfilePrivacySettingsScreen must set privacySettingsCompleted: true on save',
);

// Step 2 → Step 3 had the identical bug shape once more: wellnessInterests is
// explicitly optional (the screen shows "Optional" copy and a "Skip this
// step" button), so an empty selection is a valid completed state — but
// getOnboardingPath used to require wellnessInterests.length > 0, which
// bounced a user straight back to Step 3 the moment they saved zero topics
// via either Next or Skip. Gate on a dedicated completion marker instead.
assert.doesNotMatch(
  profileSetup,
  /if \(!profileSetup\?\.wellnessInterests\?\.length\) return '\/app\/profile\/wellness-interests';/,
  'getOnboardingPath must not gate Step 3 on wellnessInterests.length (wellness topics are optional — regression check for the stuck-on-step-3 bug)',
);
assert.match(
  profileSetup,
  /wellnessInterestsCompleted/,
  'getOnboardingPath must gate Step 3 (wellness-interests) on its own completion marker, not on wellnessInterests.length (wellness topics are optional)',
);
assert.match(
  profileWellnessInterests,
  /wellnessInterestsCompleted:\s*true/,
  'ProfileWellnessInterestsScreen must set wellnessInterestsCompleted: true on save',
);
// ─── Phase 7D: Issue 1 — Step 3 Skip must not silently suppress save failure ─
// Prior version: `try { await saveProfileSetup.mutateAsync(buildPayload()); }
// catch { /* non-blocking */ } navigate(...)` — this saved wellnessInterestsCompleted
// on a best-effort basis and navigated unconditionally, so a failed save still
// let the user reach Step 4 without the completion marker ever having been
// persisted (and with no error shown). Both Next and Skip now share one
// saveAndContinue() function that awaits the mutation, only navigates on
// success, and shows a toast + logs on failure without navigating.
{
  const saveAndContinueBody = profileWellnessInterests.slice(
    profileWellnessInterests.indexOf('const saveAndContinue'),
    profileWellnessInterests.indexOf('const handleNext'),
  );
  assert.ok(saveAndContinueBody.length > 0, 'ProfileWellnessInterestsScreen must define a shared saveAndContinue function');

  // 1) awaits mutateAsync before navigation (navigate must appear after the await, inside the try)
  const awaitIdx = saveAndContinueBody.indexOf('await saveProfileSetup.mutateAsync(');
  const navigateIdx = saveAndContinueBody.indexOf("navigate('/app/profile/health-goals')");
  assert.ok(awaitIdx !== -1 && navigateIdx !== -1, 'saveAndContinue must both await the mutation and navigate to Step 4');
  assert.ok(awaitIdx < navigateIdx, 'saveAndContinue must await the save before navigating');

  // 2) navigate to Step 4 must appear exactly once — on success, not again
  // from a catch block. (A separate navigate('/app/login') early-return for
  // the unauthenticated case is expected and not part of this check.)
  const step4NavigateOccurrences = saveAndContinueBody.match(/navigate\('\/app\/profile\/health-goals'\)/g) ?? [];
  assert.equal(
    step4NavigateOccurrences.length,
    1,
    'saveAndContinue must navigate to Step 4 exactly once (on success) — not again from a catch block',
  );
  const catchIdx = saveAndContinueBody.indexOf('} catch');
  assert.ok(catchIdx !== -1 && catchIdx > navigateIdx, 'saveAndContinue must not navigate from within the catch block');

  // 3) user-visible error on failure, and a dev-visible technical log — no empty/suppressed catch
  const catchBody = saveAndContinueBody.slice(catchIdx);
  assert.ok(catchBody.includes('showToast('), 'saveAndContinue catch must show a user-visible error toast on save failure');
  assert.ok(catchBody.includes('console.error('), 'saveAndContinue catch must log the technical error for development visibility');
  assert.doesNotMatch(
    saveAndContinueBody,
    /catch\s*\{\s*\/\*[^}]*\*\/\s*\}/,
    'saveAndContinue must not contain an empty/non-blocking catch block',
  );

  // Both Next and Skip must delegate to the same shared function (no behavioral drift).
  assert.match(
    profileWellnessInterests,
    /const handleNext = \(\) => saveAndContinue\(\);/,
    'ProfileWellnessInterestsScreen handleNext must delegate to the shared saveAndContinue',
  );
  assert.match(
    profileWellnessInterests,
    /const handleSkip = \(\) => saveAndContinue\(\);/,
    'ProfileWellnessInterestsScreen handleSkip must delegate to the shared saveAndContinue (so Skip gets identical save/error/navigate behavior to Next)',
  );

  // 4) Skip button disabled and shows a saving indicator while the mutation is pending.
  const skipButtonBlock = profileWellnessInterests.slice(profileWellnessInterests.indexOf('Skip this step') - 400);
  assert.match(skipButtonBlock, /disabled=\{saveProfileSetup\.isPending\}/, 'Skip button must be disabled while saveProfileSetup is pending');
  assert.match(skipButtonBlock, /saveProfileSetup\.isPending \? 'Saving\.\.\.' : 'Skip this step'/, 'Skip button must show a saving indicator while pending');
}

// ─── Phase 7D: Issue 3 — custom wellness text must persist, not be discarded ─
// customInterests is already a live field used by ProfileInterestsScreen for
// the "Other activity" exercise text, so reusing it for wellness would
// conflate two different steps' custom text. A dedicated
// customWellnessInterests field mirrors the existing customInterests
// (exercise) / customGoals (goals) per-category pattern already established
// in the schema — the smallest schema-consistent fix, not a new pattern.
assert.match(
  userProfileService,
  /customWellnessInterests:\s*string\[\]/,
  'UserProfileSetup must declare customWellnessInterests: string[], mirroring customInterests/customGoals',
);
assert.match(
  userProfileService,
  /customWellnessInterests:\s*input\.customWellnessInterests/,
  'upsertProfileSetup must write customWellnessInterests',
);
assert.match(
  userProfileService,
  /customWellnessInterests:[\s\S]{0,80}customWellnessInterests \?\? \[\]/,
  'getProfileSetup must read customWellnessInterests back (defaulting to [])',
);
assert.match(
  profileWellnessInterests,
  /setCustomWellness\(setup\.customWellnessInterests\?\.\[0\] \?\? ''\)/,
  'ProfileWellnessInterestsScreen must hydrate customWellness from the saved customWellnessInterests[0] when returning to Step 3',
);
assert.match(
  profileWellnessInterests,
  /customWellnessInterests:\s*customWellness\.trim\(\)\s*\?\s*\[customWellness\.trim\(\)\]\s*:\s*\(setup\?\.customWellnessInterests\s*\?\?\s*\[\]\)/,
  'ProfileWellnessInterestsScreen must save trimmed customWellness text (or preserve the existing value when empty, e.g. on Skip)',
);

// 10) No empty/non-blocking catch remains anywhere in the primary onboarding
// progression handlers (Next/Skip/Finish) across all 5 steps.
{
  const screensWithHandlers: Array<[string, string]> = [
    ['ProfileCompletionScreen', profileCompletion],
    ['ProfileInterestsScreen', profileInterests],
    ['ProfileWellnessInterestsScreen', profileWellnessInterests],
    ['ProfileHealthGoalsScreen', profileHealthGoals],
    ['ProfilePrivacySettingsScreen', profilePrivacy],
  ];
  for (const [name, content] of screensWithHandlers) {
    // Only flag catch blocks attached to the primary Next/Finish handler
    // (handleNext / handleFinish) — explicit "Skip for now" escape hatches
    // elsewhere are an intentional, separate, out-of-scope UX pattern.
    const primaryHandlerMatch = content.match(/const (handleNext|handleFinish) = async[\s\S]*?\n  \};/);
    if (!primaryHandlerMatch) continue;
    assert.doesNotMatch(
      primaryHandlerMatch[0],
      /catch\s*\{\s*(\/\*[^}]*\*\/)?\s*\}/,
      `${name}'s primary Next/Finish handler must not contain an empty or comment-only catch block`,
    );
  }
}

// 4) The mutation invalidates the exact query key useProfileSetup reads.
assert.match(
  profileSetup,
  /queryKey:\s*\[['"]profile-setup['"],\s*uid\]/,
  'useProfileSetup must use queryKey [\'profile-setup\', uid]',
);
assert.match(
  profileSetup,
  /invalidateQueries\(\{\s*queryKey:\s*\[['"]profile-setup['"],\s*resolvedUid\]/,
  'useSaveProfileSetup onSuccess must invalidate the [\'profile-setup\', uid] query key used by useProfileSetup',
);

// 6) Incomplete users are still blocked from Home (existing gate, re-asserted here for this fix's context).
assert.match(appTsx, /path="\/app\/home"[^/]*RequireOnboardedRoute/, '/app/home must remain gated by RequireOnboardedRoute');

// 7) Fully onboarded users still reach Home.
assert.match(
  profileSetup,
  /onboardingCompleted === true\) return HOME_PATH/,
  'getOnboardingPath must still route onboardingCompleted users straight to HOME_PATH',
);

// 7b) Regression guard for the real legacy-user redirect bug: the
// onboardingCompleted check must run BEFORE hasSeenIntro (or any other
// per-step marker check) inside getOnboardingPath. Checking hasSeenIntro
// first would incorrectly re-onboard any legacy completed user who
// predates that field (confirmed via real Firestore data: most existing
// completed users lack hasSeenIntro entirely).
{
  const fnBody = profileSetup.slice(
    profileSetup.indexOf('function getOnboardingPath'),
    profileSetup.indexOf('\nexport function isOnboardingPath'),
  );
  const completedIndex = fnBody.indexOf('onboardingCompleted === true');
  const hasSeenIntroIndex = fnBody.indexOf("if (!profileSetup?.hasSeenIntro)");
  assert.ok(completedIndex >= 0, 'getOnboardingPath body must contain the onboardingCompleted check');
  assert.ok(hasSeenIntroIndex >= 0, 'getOnboardingPath body must contain the hasSeenIntro check');
  assert.ok(
    completedIndex < hasSeenIntroIndex,
    'getOnboardingPath must check onboardingCompleted BEFORE hasSeenIntro — reversing this order re-onboards legacy completed users missing hasSeenIntro',
  );
}

// 8) Firestore self-write rule permits the fields Step 1 (and onboarding generally) writes.
//    Scoped strictly to the userSelfWritableFields() function body (not any call site)
//    so this doesn't false-positive/negative on unrelated 'role' text elsewhere in the file.
const userSelfWritableFieldsBody = (() => {
  const start = firestoreRules.indexOf('function userSelfWritableFields()');
  assert.ok(start !== -1, 'firestore.rules must define userSelfWritableFields()');
  const end = firestoreRules.indexOf('}', start);
  return firestoreRules.slice(start, end);
})();
assert.match(
  userSelfWritableFieldsBody,
  /'profile'/,
  'firestore.rules userSelfWritableFields() must include \'profile\' (personalInfo, exerciseInterests, etc. all live under it)',
);
assert.match(
  userSelfWritableFieldsBody,
  /'photoURL'/,
  'firestore.rules userSelfWritableFields() must include \'photoURL\'',
);

// 9) role / profile.role remain forbidden from self-writes (no regression toward blanket owner writes).
assert.doesNotMatch(
  userSelfWritableFieldsBody,
  /'role'/,
  'firestore.rules userSelfWritableFields() must not include bare \'role\'',
);
assert.match(
  firestoreRules,
  /hasNoSelfWrittenProfileRole/,
  'firestore.rules must still block self-written profile.role via hasNoSelfWrittenProfileRole',
);
assert.match(
  firestoreRules,
  /isValidUserSelfUpdate\(\)[\s\S]*?hasNoSelfWrittenProfileRole\(\)/,
  'isValidUserSelfUpdate must still call hasNoSelfWrittenProfileRole()',
);

// 10) No empty catch suppresses the Step 1 save error — it must toast and must not navigate.
{
  const handleNextBody = profileCompletion.slice(
    profileCompletion.indexOf('const handleNext'),
    profileCompletion.indexOf('const handleSkipForNow'),
  );
  const catchBody = handleNextBody.slice(handleNextBody.indexOf('} catch (error) {'));
  assert.ok(catchBody.includes('showToast('), 'ProfileCompletionScreen handleNext catch must show a toast on save failure');
  assert.ok(!catchBody.includes("navigate("), 'ProfileCompletionScreen handleNext catch must not navigate on save failure');
  assert.ok(catchBody.includes('console.error('), 'ProfileCompletionScreen handleNext catch must log the technical error for development visibility');
}

console.log('✅ All onboarding guards passed.');
