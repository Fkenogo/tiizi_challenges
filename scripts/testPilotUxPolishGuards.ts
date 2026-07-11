import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const files = [
  'src/features/Home/HomeScreen.tsx',
  'src/features/Home/useHomeScreen.ts',
  'src/features/Challenges/BrowseChallengesScreen.tsx',
  'src/features/Challenges/ChallengeDetailScreen.tsx',
  'src/features/Challenges/CreateChallengeWizard.tsx',
  'src/features/Groups/GroupDetailScreen.tsx',
  'src/features/Groups/GroupMembersScreen.tsx',
  'src/features/Groups/GroupsScreen.tsx',
  'src/features/Groups/CreateGroupScreen.tsx',
  'src/features/Profile/ProfileScreen.tsx',
  'src/features/Notifications/NotificationsScreen.tsx',
  'src/features/Share/ShareScreen.tsx',
  'src/features/Help/HelpScreen.tsx',
  'src/features/Legal/TermsScreen.tsx',
  'src/features/Legal/PrivacyScreen.tsx',
];

const forbidden = [
  { pattern: /window\.prompt\(/, label: 'browser prompt dialogs' },
  { pattern: /console\.log\(/, label: 'production console logs' },
  { pattern: /console\.error\(/, label: 'ungated production console errors' },
  { pattern: /backfill/i, label: 'backfill copy' },
  { pattern: /seed/i, label: 'seed/demo copy' },
  { pattern: /index may|index is|index.*prepar|challenge index|firestore index|index building|indexes? building|warming up|prepared|query requires/i, label: 'technical index/query copy' },
  { pattern: /permission-denied|FirebaseError|Missing or insufficient|raw error/i, label: 'raw Firebase error copy' },
  { pattern: /admin contacts|admin profiles|No admin profiles|super admin/i, label: 'admin-facing member copy' },
  { pattern: /\bAdmins\b|\bADMIN\b/, label: 'visible admin labels' },
];

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  for (const item of forbidden) {
    assert.equal(item.pattern.test(source), false, `${file} contains ${item.label}`);
  }
}

// ── P3B: Birthday validation guard ───────────────────────────────────────────

const profileCompletion = readFileSync('src/features/Profile/ProfileCompletionScreen.tsx', 'utf8');

assert.match(
  profileCompletion,
  /birthday.*trim\(\)|!birthday/,
  'ProfileCompletionScreen must validate that birthday is not empty before proceeding',
);

assert.match(
  profileCompletion,
  /birthdayError/,
  'ProfileCompletionScreen must show an inline birthday error state',
);

assert.doesNotMatch(
  profileCompletion,
  /birthday.*optional|Optional.*birthday/i,
  'Birthday must not be labelled optional — it is required',
);

// ── P3B: Password reset guard ────────────────────────────────────────────────

const loginScreen = readFileSync('src/features/Auth/LoginScreen.tsx', 'utf8');

assert.match(
  loginScreen,
  /[Ff]orgot password/,
  'LoginScreen must expose a Forgot password action',
);

assert.match(
  loginScreen,
  /sendPasswordResetEmail/,
  'LoginScreen must call sendPasswordResetEmail for the password reset flow',
);

assert.doesNotMatch(
  loginScreen,
  /FirebaseError|permission-denied|auth\/|Missing or insufficient/,
  'LoginScreen must not expose raw Firebase error codes or messages to users',
);

const authErrors = readFileSync('src/utils/firebaseAuthErrors.ts', 'utf8');

assert.match(
  authErrors,
  /auth\/missing-email/,
  'firebaseAuthErrors must handle auth/missing-email for password reset edge cases',
);

// ── P3B: Interests — no defaults, no cap, min 3 ──────────────────────────────

const interestsScreen = readFileSync('src/features/Profile/ProfileInterestsScreen.tsx', 'utf8');

assert.doesNotMatch(
  interestsScreen,
  /defaultInterests|defaultGoals/,
  'ProfileInterestsScreen must not apply admin-seeded default interests or goals to fresh users',
);

assert.doesNotMatch(
  interestsScreen,
  /prev\.length >= 10|prev\.length >= 3/,
  'ProfileInterestsScreen must not cap the number of interests or goals a user can select',
);

// Phase 6B founder decision: minimum 3 activities, maximum remains 10.
// Updated to match ProfileInterestsScreen's actual state variable (`selected`)
// and the approved copy ("Choose at least 3 activities.").
assert.match(
  interestsScreen,
  /selected\.length < 3/,
  'ProfileInterestsScreen must require at least 3 interests before proceeding',
);

assert.match(
  interestsScreen,
  /Choose at least 3 activities/,
  'ProfileInterestsScreen must show "Choose at least 3 activities." validation message',
);

// ── P3B: Home activation card ────────────────────────────────────────────────

const homeScreen = readFileSync('src/features/Home/HomeScreen.tsx', 'utf8');

assert.match(
  homeScreen,
  /joinedGroupCount === 0|activeChallengeCount === 0/,
  'HomeScreen must show an activation card when user has no groups or no active challenges',
);

// Phase 7B: copy finalized as "Start your Tiizi journey" / "Explore Groups"
// + "Create Challenge" (superseding the earlier, never-implemented P3B
// wording below), matching the founder-approved activation-card content.
assert.match(
  homeScreen,
  /Start your Tiizi journey/i,
  'HomeScreen activation card must include a welcome message for new users',
);

assert.match(
  homeScreen,
  /Explore Groups.*Create Challenge|Create Challenge.*Explore Groups/s,
  'HomeScreen activation card must guide the user to explore groups and create a challenge',
);

assert.match(
  homeScreen,
  /Get Started/,
  'HomeScreen active challenges empty state must use action-oriented "Get Started" heading',
);

assert.match(
  homeScreen,
  /Your active challenges will appear here/,
  'HomeScreen active challenges empty state must explain where challenges will appear',
);

// ── P3C → P5L: Challenge completion semantics (updated by P5L fix) ───────────
// P3C originally guarded that !endAt prevented time-bounded completions.
// P5L intentionally removed that guard so time-bounded challenges can be marked
// completed when all activities are logged (nextRate >= 100).
// The date-boundary guard (no logging after endDate) is separate and still present.

const activityLogService = readFileSync('src/services/activityLogSessionService.ts', 'utf8');

// Completion fires when all activities are done — regardless of endDate presence
// (membership.status !== 'completed' guard removed — superseded by early throw in P5T Fix 5)
assert.match(
  activityLogService,
  /nextRate >= 100/,
  'activityLogSessionService must set status=completed when nextRate >= 100 (time-bounded and open-ended alike)',
);
assert.match(
  activityLogService,
  /membership\.status === 'completed'/,
  'activityLogSessionService must throw early when membership is already completed (P5T Fix 5)',
);

// The !endAt guard must be gone — P5L fix
assert.ok(
  !activityLogService.includes('&& !endAt'),
  'activityLogSessionService must not have !endAt guard — removed by P5L to allow time-bounded challenge completion',
);

// ── P3C: Completed challenges destination ────────────────────────────────────

const profileScreen = readFileSync('src/features/Profile/ProfileScreen.tsx', 'utf8');

assert.match(
  profileScreen,
  /navigate.*\/app\/challenges/,
  'ProfileScreen must provide navigation to /app/challenges so users can view their completed challenge history',
);

// ── P3C: Home active challenges filtering ────────────────────────────────────

const useHomeScreenHook = readFileSync('src/features/Home/useHomeScreen.ts', 'utf8');

assert.match(
  useHomeScreenHook,
  /statuses.*\[.*'active'.*\]|status.*==.*active/,
  'Home hooks must filter for active challenges only so completed memberships are excluded from the active rail',
);

console.log('pilot UX polish guards passed');
