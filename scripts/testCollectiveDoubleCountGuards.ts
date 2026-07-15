/**
 * Phase 19A-10G — Guards for collective challenge double-counting fix.
 *
 * Verifies that:
 *   1. challengeProgressResolver accepts activitySummaryTotal and uses it as the canonical collective source
 *   2. challenges.groupCurrentTotal is NOT used as a floor in collective groupTotal computation
 *   3. All collective screens pass activitySummaryTotal from useChallengeSummary
 *   4. useChallengeSummary hook exists in useChallenges.ts
 *   5. Both log mutations invalidate ['challenge-activity-summary'] after each log
 *
 * Run: npx tsx scripts/testCollectiveDoubleCountGuards.ts
 */
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

const resolver      = read('src/features/Challenges/challengeProgressResolver.ts');
const useChallenges = read('src/hooks/useChallenges.ts');
const useWorkouts   = read('src/hooks/useWorkouts.ts');
const workoutLogged = read('src/features/Workouts/WorkoutLoggedScreen.tsx');
const selectActivity = read('src/features/Workouts/SelectChallengeActivityScreen.tsx');
const challengeDetail = read('src/features/Challenges/ChallengeDetailScreen.tsx');
const challengeCompleted = read('src/features/Challenges/ChallengeCompletedScreen.tsx');

// ─────────────────────────────────────────────────────────────────────────────
// RULE: Resolver accepts activitySummaryTotal and uses it as canonical collective source
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  resolver,
  /activitySummaryTotal\?: number/,
  '10G: resolver must accept activitySummaryTotal? parameter',
);
assert.match(
  resolver,
  /activitySummaryFloor/,
  '10G: resolver must compute activitySummaryFloor from activitySummaryTotal',
);
assert.match(
  resolver,
  /Math\.max\(activitySummaryFloor/,
  '10G: resolver groupTotal must prefer activitySummaryFloor',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: challenges.groupCurrentTotal NOT used as a floor in collective groupTotal
// The resolver must not include storedGroupTotal in the collective Math.max call
// ─────────────────────────────────────────────────────────────────────────────
assert.doesNotMatch(
  resolver,
  /Math\.max\(activitySummaryFloor[\s\S]{0,100}storedGroupTotal/,
  '10G: resolver collective groupTotal must NOT include storedGroupTotal',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: useChallengeSummary hook exists and reads challengeActivitySummaries
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  useChallenges,
  /export function useChallengeSummary/,
  '10G: useChallenges must export useChallengeSummary hook',
);
assert.match(
  useChallenges,
  /challengeActivitySummaries/,
  '10G: useChallengeSummary must read from challengeActivitySummaries collection',
);
assert.match(
  useChallenges,
  /challenge-activity-summary/,
  '10G: useChallengeSummary must use challenge-activity-summary query key',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: Both log mutations invalidate challenge-activity-summary after each log
// ─────────────────────────────────────────────────────────────────────────────
const activitySummaryInvalidationCount = (useWorkouts.match(/challenge-activity-summary/g) ?? []).length;
assert.ok(
  activitySummaryInvalidationCount >= 2,
  `10G: useWorkouts must invalidate challenge-activity-summary in both useLogWorkout and useLogWellnessActivity (found ${activitySummaryInvalidationCount})`,
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: All collective screens import and use useChallengeSummary + pass activitySummaryTotal
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  workoutLogged,
  /useChallengeSummary/,
  '10G: WorkoutLoggedScreen must use useChallengeSummary hook',
);
assert.match(
  workoutLogged,
  /activitySummaryTotal.*challengeSummary/,
  '10G: WorkoutLoggedScreen must pass activitySummaryTotal from challengeSummary to resolver',
);

assert.match(
  selectActivity,
  /useChallengeSummary/,
  '10G: SelectChallengeActivityScreen must use useChallengeSummary hook',
);
assert.match(
  selectActivity,
  /activitySummaryTotal.*challengeSummary/,
  '10G: SelectChallengeActivityScreen must pass activitySummaryTotal from challengeSummary to resolver',
);

assert.match(
  challengeDetail,
  /useChallengeSummary/,
  '10G: ChallengeDetailScreen must use useChallengeSummary hook',
);
assert.match(
  challengeDetail,
  /activitySummaryTotal.*challengeSummary/,
  '10G: ChallengeDetailScreen must pass activitySummaryTotal from challengeSummary to resolver',
);

assert.match(
  challengeCompleted,
  /useChallengeSummary/,
  '10G: ChallengeCompletedScreen must use useChallengeSummary hook',
);
assert.match(
  challengeCompleted,
  /activitySummaryTotal.*challengeSummary/,
  '10G: ChallengeCompletedScreen must pass activitySummaryTotal from challengeSummary to resolver',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: CF still writes totalValue to challengeActivitySummaries (canonical source)
// ─────────────────────────────────────────────────────────────────────────────
const cf = read('functions/src/memberActivitySummaries.ts');
assert.match(
  cf,
  /challengeActivitySummaries[\s\S]{0,200}totalValue/,
  '10G: CF must still write totalValue to challengeActivitySummaries',
);
assert.match(
  cf,
  /FieldValue\.increment[\s\S]{0,50}totalValue|totalValue[\s\S]{0,50}FieldValue\.increment/,
  '10G: CF must use FieldValue.increment for totalValue (atomic, no double-counting)',
);
assert.doesNotMatch(
  cf,
  /challenges.*groupCurrentTotal.*FieldValue\.increment|FieldValue\.increment.*groupCurrentTotal/,
  '10G: CF must NOT write groupCurrentTotal to challenges collection',
);

console.log('✅ All Phase 19A-10G collective double-count guards passed.');
