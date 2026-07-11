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

console.log('✅ All onboarding guards passed.');
