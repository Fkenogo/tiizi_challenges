/**
 * Phase 18I-6N Task 1 — Canonical user analytics layer guards
 *
 * Uses readFileSync-only pattern (no Firestore calls).
 * Run: npm run test:profile-analytics-guards
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync('src/services/userAnalyticsService.ts', 'utf8');
const hook = readFileSync('src/hooks/useUserAnalytics.ts', 'utf8');
const workoutsHook = readFileSync('src/hooks/useWorkouts.ts', 'utf8');

// ── Service exists and exports the right shape ────────────────────────────────

assert.match(
  service,
  /userAnalyticsService/,
  'userAnalyticsService must be exported from the service file',
);

assert.match(
  service,
  /getUserAnalytics/,
  'userAnalyticsService must expose a getUserAnalytics method',
);

// ── completedChallengesCount comes from challengeMembers, not challenges collection ──

assert.match(
  service,
  /collection\(db,\s*['"]challengeMembers['"]\)/,
  'userAnalyticsService must query the challengeMembers collection for completed challenge count',
);

assert.match(
  service,
  /status.*completed|completed.*status/,
  'userAnalyticsService must filter challengeMembers by status === "completed"',
);

// The challenges collection IS queried by fetchChallengeDocsByIds to get
// lifecycle data (startDate/endDate/status) for isChallengeOngoing().
// completedChallengesCount must still come from challengeMembers, not challenges.
assert.match(
  service,
  /collection\(db,\s*['"]challengeMembers['"]\)/,
  'userAnalyticsService must query challengeMembers for completed/total challenge counts',
);

// ── Fitness logs: workouts collection with date filter ────────────────────────

assert.match(
  service,
  /collection\(db,\s*['"]workouts['"]\)/,
  'userAnalyticsService must query the workouts collection',
);

assert.match(
  service,
  /where\(['"]date['"],\s*['"]>=['"],/,
  'userAnalyticsService must apply a date >= threshold filter on workouts query',
);

// ── Wellness logs: wellnessLogs collection with date filter ───────────────────

assert.match(
  service,
  /collection\(db,\s*['"]wellnessLogs['"]\)/,
  'userAnalyticsService must query the wellnessLogs collection',
);

// ── Returns all required fields ───────────────────────────────────────────────

const requiredFields = [
  'groupsCount',
  'totalGroupsJoinedCount',
  'ongoingChallengesCount',
  'completedChallengesCount',
  'totalChallengesJoinedCount',
  'currentStreak',
  'longestStreak',
  'fitnessLogsLast7d',
  'fitnessLogsLast30d',
  'wellnessLogsLast7d',
  'wellnessLogsLast30d',
  'totalLogsLast30d',
  'mostLoggedActivityName',
  'habitCompletionRate',
  'habitDaysTracked',
];

for (const field of requiredFields) {
  assert.match(service, new RegExp(field), `userAnalyticsService must return field: ${field}`);
}

// ── Hook exists with correct queryKey and staleTime ───────────────────────────

assert.match(
  hook,
  /useUserAnalytics/,
  'useUserAnalytics hook must be exported',
);

assert.match(
  hook,
  /\['user-analytics',/,
  "useUserAnalytics queryKey must start with 'user-analytics'",
);

assert.match(
  hook,
  /staleTime.*2\s*\*\s*60\s*\*\s*1000|120.*1000|staleTime.*120000/,
  'useUserAnalytics staleTime must be 2 minutes',
);

// ── Invalidation wired into both log mutations ────────────────────────────────

assert.match(
  workoutsHook,
  /USER_ANALYTICS_QUERY_KEY/,
  'useWorkouts must import USER_ANALYTICS_QUERY_KEY to invalidate analytics on log',
);

// Both useLogWorkout and useLogWellnessActivity must invalidate user-analytics
const invalidationMatches = [...workoutsHook.matchAll(/USER_ANALYTICS_QUERY_KEY/g)];
assert.ok(
  invalidationMatches.length >= 2,
  'USER_ANALYTICS_QUERY_KEY must be invalidated in both useLogWorkout and useLogWellnessActivity onSuccess',
);

// ── ProfileScreen — Task 2 guards ────────────────────────────────────────────

const profileScreen = readFileSync('src/features/Profile/ProfileScreen.tsx', 'utf8');

assert.doesNotMatch(
  profileScreen,
  /Top 5% Contributor/,
  'ProfileScreen must not contain hardcoded "Top 5% Contributor" badge',
);

assert.doesNotMatch(
  profileScreen,
  /Community Leader/,
  'ProfileScreen must not contain hardcoded "Community Leader" subtitle',
);

assert.match(
  profileScreen,
  /useUserAnalytics/,
  'ProfileScreen must use the useUserAnalytics hook',
);

// ── ProfileScreen — Phase 19A lifecycle-aware quick stat guards ───────────────

// Groups stat must use myGroups.length (full filter chain via useMyGroups),
// not analytics.groupsCount (Firestore member-doc count that may be stale).
assert.match(
  profileScreen,
  /myGroups\.length/,
  'ProfileScreen: Groups quick stat must use myGroups.length (authoritative active-memberships source)',
);
assert.doesNotMatch(
  profileScreen,
  /analytics\?\.groupsCount/,
  'ProfileScreen: Groups quick stat must NOT use analytics.groupsCount',
);

// Challenges quick stat must use lifecycle-aware ongoingChallengesCount.
assert.match(
  profileScreen,
  /ongoingChallengesCount/,
  'ProfileScreen: Challenges quick stat must use ongoingChallengesCount',
);

// Done % removed — no completionRatePct in ProfileScreen.
assert.doesNotMatch(
  profileScreen,
  /completionRatePct/,
  'ProfileScreen: completionRatePct must be removed (Done % tile removed)',
);

// Quick stats grid must be 2-column now that Done % is removed.
assert.match(
  profileScreen,
  /grid-cols-2/,
  'ProfileScreen: Quick stats grid must be grid-cols-2 (Done % removed)',
);
assert.doesNotMatch(
  profileScreen,
  /grid-cols-3/,
  'ProfileScreen: Quick stats grid must not be grid-cols-3',
);

// ── ProfileAnalyticsScreen — Task 3 guards ───────────────────────────────────

const analyticsScreen = readFileSync('src/features/Profile/ProfileAnalyticsScreen.tsx', 'utf8');

assert.match(
  analyticsScreen,
  /useUserAnalytics/,
  'ProfileAnalyticsScreen must use useUserAnalytics hook',
);

assert.doesNotMatch(
  analyticsScreen,
  /useUserWorkouts/,
  'ProfileAnalyticsScreen must not use useUserWorkouts directly',
);

assert.doesNotMatch(
  analyticsScreen,
  /useDailyGoalsAnalytics/,
  'ProfileAnalyticsScreen must not reference useDailyGoalsAnalytics',
);

assert.doesNotMatch(
  analyticsScreen,
  /["']Goals["']/,
  'ProfileAnalyticsScreen must not label a section "Goals" (ambiguous — use "Daily Habits")',
);

assert.match(
  analyticsScreen,
  /fitnessLogsLast30d/,
  'ProfileAnalyticsScreen must display fitness log count (30d)',
);

assert.match(
  analyticsScreen,
  /wellnessLogsLast30d/,
  'ProfileAnalyticsScreen must display wellness log count (30d)',
);

assert.match(
  analyticsScreen,
  /totalChallengesJoinedCount/,
  'ProfileAnalyticsScreen total joined must come from challengeMembers-derived analytics (totalChallengesJoinedCount)',
);

// ── ProfileAnalyticsScreen — Phase 19A lifecycle-aware guards ────────────────

// "Active" renamed to "Ongoing"
assert.match(
  analyticsScreen,
  /label="Ongoing"/,
  'ProfileAnalyticsScreen: challenge tile must use label "Ongoing"',
);
assert.doesNotMatch(
  analyticsScreen,
  /label="Active"/,
  'ProfileAnalyticsScreen: label "Active" must be removed (renamed to "Ongoing")',
);

// Completion Rate removed
assert.doesNotMatch(
  analyticsScreen,
  /Completion rate|completionRate/,
  'ProfileAnalyticsScreen: Completion rate tile must be removed',
);

// Community section split into Current Groups + Total Joined
assert.match(
  analyticsScreen,
  /label="Current Groups"/,
  'ProfileAnalyticsScreen: Community must show "Current Groups" tile',
);
assert.match(
  analyticsScreen,
  /label="Total Joined"/,
  'ProfileAnalyticsScreen: Community must show "Total Joined" tile',
);
assert.match(
  analyticsScreen,
  /analytics\?\.totalGroupsJoinedCount/,
  'ProfileAnalyticsScreen: Total Joined must read totalGroupsJoinedCount from analytics',
);

// ── ProfileAnalyticsScreen — Follow-up section guards ────────────────────────

// No duplicate Challenges section (title must appear exactly once)
const challengesTitleMatches = [...analyticsScreen.matchAll(/title="Challenges"/g)];
assert.equal(
  challengesTitleMatches.length,
  1,
  'ProfileAnalyticsScreen must render exactly one Challenges section',
);

// No duplicate Community section
const communityTitleMatches = [...analyticsScreen.matchAll(/title="Community"/g)];
assert.equal(
  communityTitleMatches.length,
  1,
  'ProfileAnalyticsScreen must render exactly one Community section',
);

assert.doesNotMatch(
  analyticsScreen,
  /title="Daily Habits"/,
  'ProfileAnalyticsScreen must not render a Daily Habits section',
);

assert.match(
  analyticsScreen,
  /Donations.*Support|Support.*Donations/,
  'ProfileAnalyticsScreen must render a Donations & Support section',
);

assert.match(
  analyticsScreen,
  /useSupportDonations/,
  'ProfileAnalyticsScreen Donations section must use useSupportDonations hook',
);

// ── Task 4 — Analytics refresh + query performance guards ────────────────────

const streakHook = readFileSync('src/hooks/useStreak.ts', 'utf8');
const workoutService = readFileSync('src/services/workoutService.ts', 'utf8');
const userAnalyticsSvc = readFileSync('src/services/userAnalyticsService.ts', 'utf8');

// useLogWorkout must invalidate user-analytics (already covered above, explicit label)
assert.match(
  workoutsHook,
  /USER_ANALYTICS_QUERY_KEY/,
  'useLogWorkout must invalidate user-analytics query key',
);

// useLogWellnessActivity must also invalidate user-analytics (two matches required)
const analyticsInvalidations = [...workoutsHook.matchAll(/USER_ANALYTICS_QUERY_KEY/g)];
assert.ok(
  analyticsInvalidations.length >= 2,
  'useLogWellnessActivity must also invalidate user-analytics (need ≥2 occurrences)',
);

// useUserStreak staleTime must be <= 5 minutes (300000ms)
// Accept: 5 * 60 * 1000  or  300000  or  300 * 1000
assert.match(
  streakHook,
  /staleTime.*5\s*\*\s*60\s*\*\s*1000|staleTime.*300\s*\*\s*1000|staleTime.*300000/,
  'useUserStreak staleTime must be 5 minutes or less (5 * 60 * 1000)',
);

// workoutService must expose a date-filtered method
assert.match(
  workoutService,
  /getWorkoutsByUserSince|where\(['"]date['"],\s*['"]>=['"],/,
  'workoutService must have a date-filtered workout query method (getWorkoutsByUserSince)',
);

// userAnalyticsService workout query must have a date filter
assert.match(
  userAnalyticsSvc,
  /where\(['"]date['"],\s*['"]>=['"],/,
  'userAnalyticsService workout query must apply a date >= filter to avoid full-history scans',
);

console.log('✅ testProfileAnalyticsGuards — all guards passed');
