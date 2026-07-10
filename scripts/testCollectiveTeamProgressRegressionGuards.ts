/**
 * Phase 19A-10J — Regression guards for collective team progress (all log screens).
 *
 * Verifies:
 *   1. Resolver uses activitySummaryFloor as first (highest-priority) term
 *   2. Resolver uses optimisticTeamFloor (from priorTeamTotal) as the legacy floor —
 *      a team-level value — NOT userContribFloor (individual user's cumulative value)
 *   3. Resolver does NOT include storedGroupTotal or userContribFloor in collective Math.max
 *   4. buildChallengeProgress accepts and forwards activitySummaryTotal + priorTeamTotal
 *   5. Home reads challengeActivitySummaries.totalValue AND passes priorTeamTotal (groupCurrentTotal)
 *   6. WorkoutLoggedScreen passes both activitySummaryTotal and priorTeamTotal to resolver
 *   7. ChallengeDetail / SelectActivity / ChallengeCompleted still pass activitySummaryTotal (10G)
 *   8. Home does NOT raw-sum workouts/wellnessLogs for progress
 *   9. LogWorkoutScreen passes activitySummaryTotal + priorTeamTotal (10J)
 *  10. LogWellnessActivityScreen passes activitySummaryTotal + priorTeamTotal (10J)
 *
 * Run: npx tsx scripts/testCollectiveTeamProgressRegressionGuards.ts
 */
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

const resolver          = read('src/features/Challenges/challengeProgressResolver.ts');
const progressDisplay   = read('src/features/Challenges/challengeProgressDisplay.ts');
const homeScreen        = read('src/features/Home/useHomeScreen.ts');
const workoutLogged     = read('src/features/Workouts/WorkoutLoggedScreen.tsx');
const logWorkout        = read('src/features/Workouts/LogWorkoutScreen.tsx');
const logWellness       = read('src/features/Workouts/LogWellnessActivityScreen.tsx');
const selectActivity    = read('src/features/Workouts/SelectChallengeActivityScreen.tsx');
const challengeDetail   = read('src/features/Challenges/ChallengeDetailScreen.tsx');
const challengeCompleted = read('src/features/Challenges/ChallengeCompletedScreen.tsx');

// ─────────────────────────────────────────────────────────────────────────────
// RULE: Resolver uses activitySummaryFloor as first (highest-priority) term
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  resolver,
  /Math\.max\(activitySummaryFloor/,
  '10I: resolver collective groupTotal must start with activitySummaryFloor',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: Resolver defines and uses optimisticTeamFloor (from priorTeamTotal)
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  resolver,
  /priorTeamTotal/,
  '10I: resolver ProgressInput must accept priorTeamTotal',
);
assert.match(
  resolver,
  /optimisticTeamFloor/,
  '10I: resolver must define optimisticTeamFloor from priorTeamTotal',
);
assert.match(
  resolver,
  /Math\.max\(activitySummaryFloor[\s\S]{0,200}optimisticTeamFloor/,
  '10I: resolver collective Math.max must include optimisticTeamFloor',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: Resolver does NOT use individual user cumulative value as team floor
// ─────────────────────────────────────────────────────────────────────────────
assert.doesNotMatch(
  resolver,
  /userContribFloor/,
  '10I: resolver must NOT define userContribFloor — individual user total must never be the team floor',
);
assert.doesNotMatch(
  resolver,
  /Math\.max\(activitySummaryFloor[\s\S]{0,200}cumulativeLoggedValue/,
  '10I: resolver collective Math.max must NOT include cumulativeLoggedValue (individual user total)',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: challenges.groupCurrentTotal (storedGroupTotal) NOT in collective Math.max directly
// ─────────────────────────────────────────────────────────────────────────────
assert.doesNotMatch(
  resolver,
  /Math\.max\(activitySummaryFloor[\s\S]{0,200}storedGroupTotal/,
  '10I: resolver collective groupTotal must NOT include storedGroupTotal directly',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: buildChallengeProgress shim accepts and forwards both activitySummaryTotal + priorTeamTotal
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  progressDisplay,
  /activitySummaryTotal\?/,
  '10I: buildChallengeProgress must accept optional activitySummaryTotal',
);
assert.match(
  progressDisplay,
  /priorTeamTotal\?/,
  '10I: buildChallengeProgress must accept optional priorTeamTotal',
);
assert.match(
  progressDisplay,
  /resolveChallengeProgress[\s\S]{0,150}priorTeamTotal/,
  '10I: buildChallengeProgress must forward priorTeamTotal to resolveChallengeProgress',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: Home reads challengeActivitySummaries.totalValue for all member challenges
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  homeScreen,
  /memberActivitySummaryMap/,
  '10I: Home must build memberActivitySummaryMap from challengeActivitySummaries',
);
assert.match(
  homeScreen,
  /totalValue/,
  '10I: Home must read totalValue from challengeActivitySummaries',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: Home passes priorTeamTotal (groupCurrentTotal) to buildChallengeProgress
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  homeScreen,
  /buildChallengeProgress[\s\S]{0,200}groupCurrentTotal/,
  '10I: Home must pass groupCurrentTotal as priorTeamTotal to buildChallengeProgress',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: Home does NOT raw-sum workouts/wellnessLogs for progress
// ─────────────────────────────────────────────────────────────────────────────
assert.doesNotMatch(
  homeScreen,
  /collection\(db,\s*['"]wellnessLogs['"]\)[\s\S]{0,300}progressValue/,
  '10I: Home must NOT query wellnessLogs to compute progressValue',
);
assert.doesNotMatch(
  homeScreen,
  /collection\(db,\s*['"]workouts['"]\)[\s\S]{0,300}progressValue/,
  '10I: Home must NOT query workouts to compute progressValue',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: WorkoutLoggedScreen passes both activitySummaryTotal + priorTeamTotal
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  workoutLogged,
  /useChallengeSummary/,
  '10I: WorkoutLoggedScreen must use useChallengeSummary hook',
);
assert.match(
  workoutLogged,
  /activitySummaryTotal.*challengeSummary/,
  '10I: WorkoutLoggedScreen must pass activitySummaryTotal from challengeSummary',
);
assert.match(
  workoutLogged,
  /priorTeamTotal.*groupCurrentTotal/,
  '10I: WorkoutLoggedScreen must pass priorTeamTotal from challenge.groupCurrentTotal',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: ChallengeDetail / SelectActivity / ChallengeCompleted still pass activitySummaryTotal
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  challengeDetail,
  /activitySummaryTotal.*challengeSummary/,
  '10I: ChallengeDetailScreen must still pass activitySummaryTotal (10G continuity)',
);
assert.match(
  selectActivity,
  /activitySummaryTotal.*challengeSummary/,
  '10I: SelectChallengeActivityScreen must still pass activitySummaryTotal (10G continuity)',
);
assert.match(
  challengeCompleted,
  /activitySummaryTotal.*challengeSummary/,
  '10I: ChallengeCompletedScreen must still pass activitySummaryTotal (10G continuity)',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: Home uses cumulativeLoggedValue for USER contribution (not team total)
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  homeScreen,
  /cumulativeLoggedValue/,
  '10I: Home must reference cumulativeLoggedValue from membership for user contribution',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE (10J): LogWorkoutScreen uses useChallengeSummary + passes correct team inputs
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  logWorkout,
  /useChallengeSummary/,
  '10J: LogWorkoutScreen must import and use useChallengeSummary',
);
assert.match(
  logWorkout,
  /activitySummaryTotal.*challengeSummary/,
  '10J: LogWorkoutScreen must pass activitySummaryTotal from challengeSummary to resolver',
);
assert.match(
  logWorkout,
  /priorTeamTotal.*groupCurrentTotal/,
  '10J: LogWorkoutScreen must pass priorTeamTotal from challenge.groupCurrentTotal to resolver',
);
assert.doesNotMatch(
  logWorkout,
  /resolveChallengeProgress\(\s*\{\s*challenge[^}]{0,200}membership[^}]{0,50}\}\s*\)/,
  '10J: LogWorkoutScreen resolver call must not omit activitySummaryTotal and priorTeamTotal',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE (10J): LogWellnessActivityScreen uses useChallengeSummary + passes correct team inputs
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  logWellness,
  /useChallengeSummary/,
  '10J: LogWellnessActivityScreen must import and use useChallengeSummary',
);
assert.match(
  logWellness,
  /activitySummaryTotal.*challengeSummary/,
  '10J: LogWellnessActivityScreen must pass activitySummaryTotal from challengeSummary to resolver',
);
assert.match(
  logWellness,
  /priorTeamTotal.*groupCurrentTotal/,
  '10J: LogWellnessActivityScreen must pass priorTeamTotal from challenge.groupCurrentTotal to resolver',
);

console.log('✅ All Phase 19A-10J collective team progress regression guards passed.');
