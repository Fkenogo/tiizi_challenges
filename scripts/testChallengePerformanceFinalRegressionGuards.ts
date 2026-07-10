/**
 * Phase 19A-10F — Final regression guards for challenge performance source-of-truth.
 * Covers all locked rules from phases 10A–10E.
 * Run: npx tsx scripts/testChallengePerformanceFinalRegressionGuards.ts
 */
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

const homeScreen     = read('src/features/Home/useHomeScreen.ts');
const completedScreen = read('src/features/Challenges/ChallengeCompletedScreen.tsx');
const feedCard       = read('src/features/Groups/FeedCard.tsx');
const feedLiveSvc    = read('src/services/feedLiveStatsService.ts');
const workoutSvc     = read('src/services/workoutService.ts');
const wellnessSvc    = read('src/services/wellnessLogService.ts');
const sessionSvc     = read('src/services/activityLogSessionService.ts');
const cf             = read('functions/src/memberActivitySummaries.ts');
const useWorkouts    = read('src/hooks/useWorkouts.ts');

// ─────────────────────────────────────────────────────────────────────────────
// RULE 1: User cumulative contribution → challengeMembers.cumulativeLoggedValue
// All three client write paths must write this field.
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  workoutSvc,
  /cumulativeLoggedValue/,
  'RULE 1: workoutService must write challengeMembers.cumulativeLoggedValue',
);
assert.match(
  wellnessSvc,
  /cumulativeLoggedValue/,
  'RULE 1: wellnessLogService must write challengeMembers.cumulativeLoggedValue',
);
assert.match(
  sessionSvc,
  /cumulativeLoggedValue/,
  'RULE 1: activityLogSessionService must write challengeMembers.cumulativeLoggedValue',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE 2: Collective team total → challengeActivitySummaries.totalValue (CF-owned)
// CF must write totalValue to challengeActivitySummaries; no client must override it.
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  cf,
  /challengeActivitySummaries[\s\S]{0,200}totalValue/,
  'RULE 2: CF must write totalValue to challengeActivitySummaries',
);

// feedLiveStatsService reads totalValue from challengeActivitySummaries for collective display
assert.match(
  feedLiveSvc,
  /challengeActivitySummaries/,
  'RULE 2: feedLiveStatsService must read from challengeActivitySummaries for collective total',
);
assert.match(
  feedLiveSvc,
  /totalValue/,
  'RULE 2: feedLiveStatsService must reference totalValue for collective display',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE 3: Competitive ranking score → challengeLeaderboards.score (CF-owned)
// CF must write score; feedLiveStatsService must use it for ordering.
// challengeLeaderboards must NOT write cumulativeLoggedValue (10B rule).
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  cf,
  /challengeLeaderboard[\s\S]{0,200}score/,
  'RULE 3: CF must write score to challengeLeaderboards',
);
assert.doesNotMatch(
  cf,
  /challengeLeaderboardPayload[\s\S]{0,300}cumulativeLoggedValue/,
  'RULE 3: CF challengeLeaderboardPayload must NOT write cumulativeLoggedValue (10B)',
);
assert.match(
  feedLiveSvc,
  /challengeLeaderboards/,
  'RULE 3: feedLiveStatsService must use challengeLeaderboards for score/rank ordering',
);
assert.doesNotMatch(
  feedLiveSvc,
  /challengeLeaderboards[\s\S]{0,100}cumulativeLoggedValue/,
  'RULE 3: feedLiveStatsService must NOT read cumulativeLoggedValue from challengeLeaderboards',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE 4: Streak progress → challengeMembers.currentStreak (client-owned)
// CF must not write currentStreak to challengeMembers.
// ─────────────────────────────────────────────────────────────────────────────
assert.doesNotMatch(
  cf,
  /batch\.set[\s\S]{0,30}challengeMembers/,
  'RULE 4: CF must NOT batch.set on challengeMembers (preserves client ownership of currentStreak)',
);

// ─────────────────────────────────────────────────────────────────────────────
// NO RAW LOG SUMMING on Home screen (10C)
// ─────────────────────────────────────────────────────────────────────────────
assert.doesNotMatch(
  homeScreen,
  /collection\(db,\s*['"]wellnessLogs['"]\)[\s\S]{0,300}progressValue/,
  '10C: Home must NOT query wellnessLogs to compute first-card progressValue',
);
assert.doesNotMatch(
  homeScreen,
  /collection\(db,\s*['"]workouts['"]\)[\s\S]{0,300}progressValue/,
  '10C: Home must NOT query workouts to compute first-card progressValue',
);
assert.match(
  homeScreen,
  /membership\?\.cumulativeLoggedValue/,
  '10C: Home must use membership.cumulativeLoggedValue for first-card user progress',
);

// ─────────────────────────────────────────────────────────────────────────────
// NO DUAL TOTALS on ChallengeCompletedScreen (10D)
// ─────────────────────────────────────────────────────────────────────────────
assert.doesNotMatch(
  completedScreen,
  /totalValue\.toLocaleString/,
  '10D: ChallengeCompletedScreen must NOT display raw totalValue (workout sum) as user total',
);
assert.doesNotMatch(
  completedScreen,
  />\s*\{totalValue/,
  '10D: ChallengeCompletedScreen must NOT render totalValue directly as JSX content',
);
assert.match(
  completedScreen,
  /cumulativeLoggedValue/,
  '10D: ChallengeCompletedScreen must use cumulativeLoggedValue for user completed total',
);
assert.match(
  completedScreen,
  /useChallengeMembership/,
  '10D: ChallengeCompletedScreen must still import useChallengeMembership',
);

// ─────────────────────────────────────────────────────────────────────────────
// FEED PREFERS feedProgressSnapshot (8D rule)
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  feedCard,
  /feedProgressSnapshot/,
  '8D: FeedCard must prefer feedProgressSnapshot for progress display',
);
assert.match(
  feedCard,
  /SnapshotProgress/,
  '8D: FeedCard must render SnapshotProgress when snapshot is available',
);

// CF must write feedProgressSnapshot to feed docs
assert.match(
  cf,
  /feedProgressSnapshot/,
  '8D: CF must write feedProgressSnapshot to groupActivityFeed docs',
);

// ─────────────────────────────────────────────────────────────────────────────
// FEED LIVE STATS reads competitive value from challengeMembers (not leaderboards)
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  feedLiveSvc,
  /challengeMembers/,
  '8D: feedLiveStatsService must fetch from challengeMembers for competitive cumulativeLoggedValue',
);
assert.match(
  feedLiveSvc,
  /cumulativeLoggedValue/,
  '8D: feedLiveStatsService must reference cumulativeLoggedValue from challengeMembers',
);

// ─────────────────────────────────────────────────────────────────────────────
// CACHE INVALIDATION — challenge-leaderboard-snapshot after every log (10E)
// ─────────────────────────────────────────────────────────────────────────────
const snapshotInvalidationCount = (useWorkouts.match(/challenge-leaderboard-snapshot/g) ?? []).length;
assert.ok(
  snapshotInvalidationCount >= 2,
  `10E: useWorkouts must invalidate challenge-leaderboard-snapshot in both useLogWorkout and useLogWellnessActivity (found ${snapshotInvalidationCount})`,
);
assert.match(
  useWorkouts,
  /challenge-membership/,
  '10E: useWorkouts must still invalidate challenge-membership after logs',
);

// ─────────────────────────────────────────────────────────────────────────────
// NO UNRELATED CONFIG CHANGES
// Firestore rules and function config must not include source-of-truth workarounds.
// ─────────────────────────────────────────────────────────────────────────────
const firestoreRules = read('firestore.rules');
// Rules file must not reference cumulativeLoggedValue (would indicate a workaround)
assert.doesNotMatch(
  firestoreRules,
  /cumulativeLoggedValue/,
  'No source-of-truth workarounds must appear in firestore.rules',
);

console.log('✅ All Phase 19A final regression guards passed.');
