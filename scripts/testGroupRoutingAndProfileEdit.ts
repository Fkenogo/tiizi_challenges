/**
 * Phase 18I-6R — Group routing, gender field, edit profile guards.
 * Run: npx tsx scripts/testGroupRoutingAndProfileEdit.ts
 */
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

const groupsScreen   = read('src/features/Groups/GroupsScreen.tsx');
const homeScreen     = read('src/features/Home/HomeScreen.tsx');
const userService    = read('src/services/userProfileService.ts');
const completion     = read('src/features/Profile/ProfileCompletionScreen.tsx');
const editProfile    = read('src/features/Profile/EditProfileScreen.tsx');
const profileScreen  = read('src/features/Profile/ProfileScreen.tsx');
const appTsx         = read('src/App.tsx');

// ─── Groups smart tab default ─────────────────────────────────────────────────
assert.match(groupsScreen, /useLocation/, 'GroupsScreen must import useLocation');
assert.match(groupsScreen, /location\.state/, 'GroupsScreen must read location.state for requested tab');
assert.match(groupsScreen, /myGroups\.length\s*===\s*0\s*\?\s*['"]discover['"]/, 'GroupsScreen must default to discover when user has 0 groups');
assert.match(groupsScreen, /tabAutoSet/, 'GroupsScreen must use tabAutoSet guard to avoid tab flicker');

// ─── Home Join a Group CTA → Discover ────────────────────────────────────────
assert.match(homeScreen, /navigate\(['"]\/app\/groups['"],\s*\{\s*state\s*:\s*\{\s*tab\s*:\s*['"]discover['"]\s*\}/, 'Home Join a Group must navigate to /app/groups with { state: { tab: "discover" } }');

// ─── Gender field in UserProfileSetup type ───────────────────────────────────
assert.match(userService, /gender\?\s*:\s*string/, 'UserProfileSetup.personalInfo must have optional gender: string');
assert.match(userService, /genderSelfDescribe\?\s*:\s*string/, 'UserProfileSetup.personalInfo must have optional genderSelfDescribe: string');

// ─── Gender persisted in upsertProfileSetup ───────────────────────────────────
assert.match(userService, /gender\s*:\s*input\.personalInfo\?\.gender/, 'upsertProfileSetup must write gender');
assert.match(userService, /genderSelfDescribe\s*:\s*input\.personalInfo\?\.genderSelfDescribe/, 'upsertProfileSetup must write genderSelfDescribe');

// ─── Gender read back in getProfileSetup ─────────────────────────────────────
assert.match(userService, /gender.*personalInfo.*gender|personalInfo.*gender/s, 'getProfileSetup must read back gender');

// ─── Gender in ProfileCompletionScreen ───────────────────────────────────────
assert.match(completion, /gender/, 'ProfileCompletionScreen must include gender field');
assert.match(completion, /GENDER_OPTIONS/, 'ProfileCompletionScreen must define GENDER_OPTIONS');
assert.match(completion, /Self describe/, 'ProfileCompletionScreen must include Self describe option');
assert.match(completion, /genderSelfDescribe/, 'ProfileCompletionScreen must support self-describe text input');
assert.match(completion, /gender.*undefined|gender.*optional/s, 'ProfileCompletionScreen gender must be optional (not required)');

// ─── Edit Profile screen exists ──────────────────────────────────────────────
assert.match(appTsx, /\/app\/profile\/edit.*EditProfileScreen|EditProfileScreen.*\/app\/profile\/edit/, 'App.tsx must register /app/profile/edit route');
assert.match(profileScreen, /navigate\(['"]\/app\/profile\/edit['"]\)/, 'ProfileScreen must have Edit Profile button navigating to /app/profile/edit');

// ─── Edit Profile screen functionality ───────────────────────────────────────
assert.match(editProfile, /exerciseInterests|selectedActivities/, 'EditProfileScreen must support editing activities');
assert.match(editProfile, /wellnessInterests|selectedWellness/, 'EditProfileScreen must support editing wellness topics');
assert.match(editProfile, /goals|selectedGoals/, 'EditProfileScreen must support editing health goals');
assert.match(editProfile, /birthday/, 'EditProfileScreen must support editing birthday');
assert.match(editProfile, /weightKg/, 'EditProfileScreen must support editing weight');
assert.match(editProfile, /heightCm/, 'EditProfileScreen must support editing height');
assert.match(editProfile, /gender/, 'EditProfileScreen must support editing gender');
assert.match(editProfile, /privacySettings|showWeightHeight|showBirthday|isSearchable/, 'EditProfileScreen must support editing privacy settings');
assert.match(editProfile, /Save Changes/, 'EditProfileScreen must have a Save Changes button');
assert.match(editProfile, /showToast.*success|success.*showToast/s, 'EditProfileScreen must show success toast on save');

// ─── Edit Profile must NOT set onboardingCompleted: false ────────────────────
assert.doesNotMatch(editProfile, /onboardingCompleted\s*:\s*false/, 'EditProfileScreen must not set onboardingCompleted: false');

// ─── Edit Profile does not navigate to onboarding ────────────────────────────
assert.doesNotMatch(editProfile, /navigate\(['"]\/app\/profile\/completion['"]\)/, 'EditProfileScreen must not redirect to onboarding completion');
assert.doesNotMatch(editProfile, /navigate\(['"]\/app\/onboarding['"]\)/, 'EditProfileScreen must not redirect to onboarding');

console.log('✅ All group routing and profile edit guards passed.');
