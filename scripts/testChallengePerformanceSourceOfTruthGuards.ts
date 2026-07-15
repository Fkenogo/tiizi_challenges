/**
 * Phase 19A-10A — Challenge Performance Source-of-Truth guards.
 * Run: npx tsx scripts/testChallengePerformanceSourceOfTruthGuards.ts
 */
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

const sessionSvc  = read('src/services/activityLogSessionService.ts');
const workoutSvc  = read('src/services/workoutService.ts');
const wellnessSvc = read('src/services/wellnessLogService.ts');
const cf          = read('functions/src/memberActivitySummaries.ts');
const feedCard    = read('src/features/Groups/FeedCard.tsx');

// ── 1. activityLogSessionService writes cumulativeLoggedValue ─────────────────
assert.match(
  sessionSvc,
  /cumulativeLoggedValue/,
  'activityLogSessionService must include cumulativeLoggedValue in the membership update',
);

// ── 2. It computes nextCumulative from previous value + session total ──────────
assert.match(
  sessionSvc,
  /nextCumulativeLoggedValue/,
  'activityLogSessionService must define nextCumulativeLoggedValue',
);
assert.match(
  sessionSvc,
  /membership\.cumulativeLoggedValue[\s\S]{0,50}sessionContributionTotal|sessionContributionTotal[\s\S]{0,50}membership\.cumulativeLoggedValue/,
  'activityLogSessionService must compute nextCumulativeLoggedValue from membership.cumulativeLoggedValue + sessionContributionTotal',
);
assert.match(
  sessionSvc,
  /sessionContributionTotal.*summaryEntries|summaryEntries.*sessionContributionTotal/,
  'activityLogSessionService must derive sessionContributionTotal from summaryEntries',
);

// ── 3. Must NOT use FieldValue.increment for cumulativeLoggedValue ─────────────
// Absolute write is required so that client-engine-owned fields stay consistent
// with workoutService.ts and wellnessLogService.ts.
assert.doesNotMatch(
  sessionSvc,
  /increment[\s\S]{0,30}cumulativeLoggedValue|cumulativeLoggedValue[\s\S]{0,30}increment\(/,
  'activityLogSessionService must NOT use FieldValue.increment for cumulativeLoggedValue (must be absolute)',
);

// ── 4. workoutService still writes challengeMembers.cumulativeLoggedValue ──────
assert.match(
  workoutSvc,
  /cumulativeLoggedValue/,
  'workoutService must still write cumulativeLoggedValue to challengeMembers',
);

// ── 5. wellnessLogService still writes challengeMembers.cumulativeLoggedValue ──
assert.match(
  wellnessSvc,
  /cumulativeLoggedValue/,
  'wellnessLogService must still write cumulativeLoggedValue to challengeMembers',
);

// ── 6. No UI files modified in this phase ────────────────────────────────────
// FeedCard must still reference feedProgressSnapshot (unchanged from 8D)
assert.match(
  feedCard,
  /feedProgressSnapshot/,
  'FeedCard must be unchanged — feedProgressSnapshot still present',
);
assert.match(
  feedCard,
  /SnapshotProgress/,
  'FeedCard must be unchanged — SnapshotProgress component still present',
);

// ── 7. CF still writes feedProgressSnapshot, still not touching challengeMembers ──
assert.match(
  cf,
  /feedProgressSnapshot/,
  'CF memberActivitySummaries must still write feedProgressSnapshot',
);
assert.doesNotMatch(
  cf,
  /batch\.set[\s\S]{0,30}challengeMembers/,
  'CF must NOT batch.set on challengeMembers (8D rule preserved)',
);

// ── 8. Phase 19A-10B: CF does NOT write cumulativeLoggedValue to challengeLeaderboards ──
assert.doesNotMatch(
  cf,
  /challengeLeaderboardPayload[\s\S]{0,300}cumulativeLoggedValue/,
  'CF challengeLeaderboardPayload must NOT contain cumulativeLoggedValue (10B rule)',
);

// ── 9. Phase 19A-10B: feedLiveStatsService reads cumulativeLoggedValue from challengeMembers ──
const feedLiveSvc = read('src/services/feedLiveStatsService.ts');

assert.match(
  feedLiveSvc,
  /challengeMembers/,
  'feedLiveStatsService must fetch from challengeMembers collection',
);
assert.match(
  feedLiveSvc,
  /cumulativeLoggedValue/,
  'feedLiveStatsService must reference cumulativeLoggedValue',
);

// feedLiveStatsService must NOT read cumulativeLoggedValue from challengeLeaderboards
// (score is still read from challengeLeaderboards for ranking — that is correct)
assert.doesNotMatch(
  feedLiveSvc,
  /challengeLeaderboards[\s\S]{0,100}cumulativeLoggedValue/,
  'feedLiveStatsService must NOT read cumulativeLoggedValue from challengeLeaderboards',
);

// challengeLeaderboards is still used for score/rank ordering
assert.match(
  feedLiveSvc,
  /challengeLeaderboards/,
  'feedLiveStatsService must still use challengeLeaderboards for score/rank ordering',
);

// ── 10. Phase 19A-10C: Home screen does NOT raw-sum workouts/wellnessLogs for first-card progress ──
const homeScreen = read('src/features/Home/useHomeScreen.ts');

// Must not query wellnessLogs for progress summing
assert.doesNotMatch(
  homeScreen,
  /collection\(db,\s*['"]wellnessLogs['"]\)[\s\S]{0,300}progressValue/,
  'useHomeScreen must NOT query wellnessLogs to compute progressValue for the first card',
);

// Must not query workouts for progress summing
assert.doesNotMatch(
  homeScreen,
  /collection\(db,\s*['"]workouts['"]\)[\s\S]{0,300}progressValue/,
  'useHomeScreen must NOT query workouts to compute progressValue for the first card',
);

// Must use challengeMembers.cumulativeLoggedValue for user progress
assert.match(
  homeScreen,
  /membership\?\.cumulativeLoggedValue/,
  'useHomeScreen must use membership.cumulativeLoggedValue for first-card user progress',
);

// challengeActivitySummaries still read (for mostActiveOngoing ranking)
assert.match(
  homeScreen,
  /challengeActivitySummaries/,
  'useHomeScreen must still read challengeActivitySummaries (for mostActiveOngoing)',
);

// ── 11. Phase 19A-10D: ChallengeCompletedScreen does not display raw workout sum as user total ──
const completedScreen = read('src/features/Challenges/ChallengeCompletedScreen.tsx');

// Must NOT render totalValue.toLocaleString() as a displayed total
assert.doesNotMatch(
  completedScreen,
  /totalValue\.toLocaleString/,
  'ChallengeCompletedScreen must NOT display raw totalValue (workout sum) as the user total',
);

// Must use cumulativeLoggedValue for user completed total
assert.match(
  completedScreen,
  /cumulativeLoggedValue/,
  'ChallengeCompletedScreen must use cumulativeLoggedValue for user completed total',
);

// Must still import useChallengeMembership (completion UI still reads membership)
assert.match(
  completedScreen,
  /useChallengeMembership/,
  'ChallengeCompletedScreen must still import and use useChallengeMembership',
);

// Must NOT reduce raw workouts into a "my total" to display as challenge progress
// (totalValue is still allowed as a helper for non-total derived values like intensity)
assert.doesNotMatch(
  completedScreen,
  />\s*\{totalValue/,
  'ChallengeCompletedScreen must NOT render totalValue directly as JSX content',
);

// ── 12. Phase 19A-10E: post-log cache invalidation for challenge-leaderboard-snapshot ──
const useWorkouts = read('src/hooks/useWorkouts.ts');

// useWorkouts references the cache key
assert.match(
  useWorkouts,
  /challenge-leaderboard-snapshot/,
  'useWorkouts must reference challenge-leaderboard-snapshot cache key',
);

// Both useLogWorkout and useLogWellnessActivity must each have their own invalidation —
// assert the key appears at least twice (once per mutation).
const snapshotInvalidationCount = (useWorkouts.match(/challenge-leaderboard-snapshot/g) ?? []).length;
assert.ok(
  snapshotInvalidationCount >= 2,
  `useWorkouts must invalidate challenge-leaderboard-snapshot in both useLogWorkout and useLogWellnessActivity (found ${snapshotInvalidationCount} occurrence(s))`,
);

// challenge-membership invalidation still present
assert.match(
  useWorkouts,
  /challenge-membership/,
  'useWorkouts must still invalidate challenge-membership',
);

// No Cloud Function files modified in this phase (CF still writes feedProgressSnapshot, not challengeMembers)
assert.match(
  cf,
  /feedProgressSnapshot/,
  '10E must not remove feedProgressSnapshot from CF (no CF changes in this phase)',
);
assert.doesNotMatch(
  cf,
  /batch\.set[\s\S]{0,30}challengeMembers/,
  '10E must not add challengeMembers writes to CF',
);

console.log('✅ All challenge performance source-of-truth guards passed.');
