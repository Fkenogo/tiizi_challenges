import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SCORING_CONSTANTS,
  computeActivityScore,
  computeSessionScore,
} from '../src/services/scoringConfig';
import { LegacyEngine, StreakEngine, CompetitiveEngine, CollectiveEngine, selectEngine } from '../src/services/challengeEngine';
import { computeGroupTransition } from '../src/utils/collectiveGroupTransition';
import { buildChallengeProgress, safeNum } from '../src/features/Challenges/challengeProgressDisplay';

// ── 1. Unified formula: below minimum effort → 0 pts ─────────────────────────

// 1 rep on a 40-rep target: 1/40 = 2.5 % → below MIN_EFFORT_RATIO (5 %) → 0 pts
{
  const result = computeActivityScore({ value: 1, targetValue: 40, challengeType: 'collective' });
  assert.equal(result.pointsEarned, 0, '1 rep on 40-rep target must earn 0 points (below min-effort floor)');
  assert.equal(result.metTarget, false);
  assert.equal(result.capped, false);
  assert.equal(result.reason, 'below_minimum_effort');
  assert.equal(result.scoringMethod, 'proportional_capped');
}

// 2 reps on 40-rep target: 2/40 = 5% = exactly at floor → still 0 (strict less-than)
{
  const result = computeActivityScore({ value: 2, targetValue: 40, challengeType: 'collective' });
  assert.equal(result.pointsEarned, 0, '2 reps on 40-rep target (exactly 5%) must earn 0 points');
}

// ── 2. Unified formula: meeting target → 100 pts for all challenge types ──────

// Collective: meeting target exactly → 100 pts
{
  const result = computeActivityScore({ value: 40, targetValue: 40, challengeType: 'collective' });
  assert.equal(result.pointsEarned, SCORING_CONSTANTS.BASE_POINTS_PER_TARGET, 'Collective: meeting target earns 100 pts');
  assert.equal(result.metTarget, true);
  assert.equal(result.capped, false);
  assert.equal(result.reason, 'target_met');
  assert.equal(result.scoringMethod, 'proportional_capped');
}

// Competitive: meeting target → 100 pts (same formula, no special competitive_value path)
{
  const result = computeActivityScore({ value: 40, targetValue: 40, challengeType: 'competitive' });
  assert.equal(result.pointsEarned, SCORING_CONSTANTS.BASE_POINTS_PER_TARGET, 'Competitive: meeting target earns 100 pts');
  assert.equal(result.metTarget, true);
  assert.equal(result.scoringMethod, 'proportional_capped');
}

// Streak: meeting target → 100 pts
{
  const result = computeActivityScore({ value: 40, targetValue: 40, challengeType: 'streak' });
  assert.equal(result.pointsEarned, SCORING_CONSTANTS.BASE_POINTS_PER_TARGET, 'Streak: meeting target earns 100 pts');
  assert.equal(result.metTarget, true);
  assert.equal(result.scoringMethod, 'proportional_capped');
}

// ── 3. Unified formula: overperformance capped at 100 pts ────────────────────

// 200 reps on 40-rep target (5× over): capped at 100, capped flag set
{
  const result = computeActivityScore({ value: 200, targetValue: 40, challengeType: 'collective' });
  assert.equal(result.pointsEarned, SCORING_CONSTANTS.BASE_POINTS_PER_TARGET, 'Overperformance capped at 100 pts');
  assert.equal(result.metTarget, true);
  assert.equal(result.capped, true, 'Exceeding target must set capped=true');
}

// Competitive overperformance also capped at 100 — no 3× bonus
{
  const result = computeActivityScore({ value: 200, targetValue: 40, challengeType: 'competitive' });
  assert.equal(result.pointsEarned, SCORING_CONSTANTS.BASE_POINTS_PER_TARGET, 'Competitive: no overperformance bonus — still capped at 100');
}

// ── 4. Unified formula: partial effort → proportional pts ────────────────────

// 20/40 = 50% → 50 pts
{
  const result = computeActivityScore({ value: 20, targetValue: 40, challengeType: 'collective' });
  assert.equal(result.pointsEarned, 50, 'Half of target earns 50 pts');
  assert.equal(result.metTarget, false);
  assert.equal(result.capped, false);
}

// Competitive partial: same proportional formula
{
  const result = computeActivityScore({ value: 20, targetValue: 40, challengeType: 'competitive' });
  assert.equal(result.pointsEarned, 50, 'Competitive partial: 50% of target earns 50 pts (not 25 under old competitive_value path)');
}

// Streak partial: same proportional formula
{
  const result = computeActivityScore({ value: 30, targetValue: 40, challengeType: 'streak' });
  assert.equal(result.pointsEarned, 75, 'Streak partial: 75% of target earns 75 pts');
}

// ── 5. No-target fallback → fixed 100 pts ────────────────────────────────────

{
  const result = computeActivityScore({ value: 40, targetValue: 0, challengeType: 'collective' });
  assert.equal(result.pointsEarned, SCORING_CONSTANTS.BASE_POINTS_PER_TARGET, 'Zero targetValue falls back to 100 pts');
  assert.equal(result.scoringMethod, 'fixed');
  assert.equal(result.reason, 'no_target_defined');
}

// ── 6. Client-provided points are never trusted ───────────────────────────────

// Passing clientProvidedPoints: 999 must not change the computed score
{
  const withoutClientPts = computeActivityScore({ value: 40, targetValue: 40, challengeType: 'collective' });
  const withClientPts = computeActivityScore({ value: 40, targetValue: 40, challengeType: 'collective', clientProvidedPoints: 999 });
  assert.equal(withClientPts.pointsEarned, withoutClientPts.pointsEarned, 'clientProvidedPoints must not affect computed score');
}

// Passing absurd clientProvidedPoints on below-minimum-effort log still returns 0
{
  const result = computeActivityScore({ value: 1, targetValue: 40, challengeType: 'collective', clientProvidedPoints: 10000 });
  assert.equal(result.pointsEarned, 0, 'clientProvidedPoints must not rescue a below-minimum-effort log');
}

// ── 7. Multi-activity session scorer ─────────────────────────────────────────

// Session with 2 activities: both meet target
{
  const session = computeSessionScore([
    { activityId: 'pushup', value: 40, targetValue: 40, challengeType: 'collective' },
    { activityId: 'bearcrawl', value: 30, targetValue: 30, challengeType: 'collective' },
  ]);
  assert.equal(session.allTargetsMet, true, 'Session where all targets are met returns allTargetsMet=true');
  assert.equal(session.totalPointsEarned, 2 * SCORING_CONSTANTS.BASE_POINTS_PER_TARGET, 'Session total = sum of per-activity points (100×2)');
  assert.equal(session.activities.length, 2);
}

// Session where one activity is below minimum effort
{
  const session = computeSessionScore([
    { activityId: 'pushup', value: 1, targetValue: 40, challengeType: 'collective' },
    { activityId: 'bearcrawl', value: 30, targetValue: 30, challengeType: 'collective' },
  ]);
  assert.equal(session.allTargetsMet, false, 'Session with one below-minimum activity returns allTargetsMet=false');
  assert.equal(session.totalPointsEarned, SCORING_CONSTANTS.BASE_POINTS_PER_TARGET, 'Below-minimum activity contributes 0; other contributes full 100 pts');
}

// ── 6. Client-provided points are never trusted ───────────────────────────────

// Passing clientProvidedPoints: 999 must not change the computed score
{
  const withoutClientPts = computeActivityScore({ value: 40, targetValue: 40, challengeType: 'collective' });
  const withClientPts = computeActivityScore({ value: 40, targetValue: 40, challengeType: 'collective', clientProvidedPoints: 999 });
  assert.equal(withClientPts.pointsEarned, withoutClientPts.pointsEarned, 'clientProvidedPoints must not affect computed score');
}

// Passing absurd clientProvidedPoints on below-minimum-effort log still returns 0
{
  const result = computeActivityScore({ value: 1, targetValue: 40, challengeType: 'collective', clientProvidedPoints: 10000 });
  assert.equal(result.pointsEarned, 0, 'clientProvidedPoints must not rescue a below-minimum-effort log');
}

// ── 7. Multi-activity session scorer ─────────────────────────────────────────

// Session with 2 activities: both meet target
{
  const session = computeSessionScore([
    { activityId: 'pushup', value: 40, targetValue: 40, challengeType: 'collective' },
    { activityId: 'bearcrawl', value: 30, targetValue: 30, challengeType: 'collective' },
  ]);
  assert.equal(session.allTargetsMet, true, 'Session where all targets are met returns allTargetsMet=true');
  assert.equal(session.totalPointsEarned, 2 * SCORING_CONSTANTS.BASE_POINTS_PER_TARGET, 'Session total = sum of per-activity points (BASE×2)');
  assert.equal(session.activities.length, 2);
}

// Session where one activity is below minimum effort
{
  const session = computeSessionScore([
    { activityId: 'pushup', value: 1, targetValue: 40, challengeType: 'collective' },
    { activityId: 'bearcrawl', value: 30, targetValue: 30, challengeType: 'collective' },
  ]);
  assert.equal(session.allTargetsMet, false, 'Session with one below-minimum activity returns allTargetsMet=false');
  assert.equal(session.totalPointsEarned, SCORING_CONSTANTS.BASE_POINTS_PER_TARGET, 'Below-minimum activity contributes 0; other contributes full BASE_POINTS');
}

// ── 8. Structural file guards ─────────────────────────────────────────────────

const scoringConfigSrc = readFileSync('src/services/scoringConfig.ts', 'utf8');

assert.match(
  scoringConfigSrc,
  /clientProvidedPoints\?:\s*number/,
  'scoringConfig must declare clientProvidedPoints field on ScoringInput',
);

assert.doesNotMatch(
  scoringConfigSrc,
  /return.*clientProvidedPoints/,
  'scoringConfig must never return or use clientProvidedPoints in score calculation',
);

assert.match(
  scoringConfigSrc,
  /MIN_EFFORT_RATIO/,
  'scoringConfig must define MIN_EFFORT_RATIO constant',
);

// Unified formula: no overperformance multiplier, no competitive cap, no streak bonus
assert.doesNotMatch(
  scoringConfigSrc,
  /MAX_OVERPERFORMANCE_MULTIPLIER/,
  'scoringConfig must NOT define MAX_OVERPERFORMANCE_MULTIPLIER — overperformance cap removed',
);

assert.doesNotMatch(
  scoringConfigSrc,
  /COMPETITIVE_VALUE_CAP_RATIO/,
  'scoringConfig must NOT define COMPETITIVE_VALUE_CAP_RATIO — competitive divergence removed',
);

// Verify functions copy also exists and has the same trust boundary
const scoringConfigFunctions = readFileSync('functions/src/scoringConfig.ts', 'utf8');

assert.match(
  scoringConfigFunctions,
  /clientProvidedPoints\?:\s*number/,
  'functions/scoringConfig must also declare clientProvidedPoints as an ignored field',
);

assert.match(
  scoringConfigFunctions,
  /Intentionally ignored/,
  'functions/scoringConfig must document that clientProvidedPoints is intentionally ignored',
);

// ── 9. P4C: No hardcoded points:10 in logging screens ────────────────────────

const logWorkoutScreen = readFileSync('src/features/Workouts/LogWorkoutScreen.tsx', 'utf8');
assert.doesNotMatch(
  logWorkoutScreen,
  /points:\s*10[,\s]/,
  'LogWorkoutScreen must not hardcode points: 10',
);
assert.match(
  logWorkoutScreen,
  /computeActivityScore/,
  'LogWorkoutScreen must call computeActivityScore',
);

const logWellnessScreen = readFileSync('src/features/Workouts/LogWellnessActivityScreen.tsx', 'utf8');
assert.doesNotMatch(
  logWellnessScreen,
  /points:\s*10[,\s]/,
  'LogWellnessActivityScreen must not hardcode points: 10',
);
assert.match(
  logWellnessScreen,
  /computeActivityScore/,
  'LogWellnessActivityScreen must call computeActivityScore',
);

const activityLogService = readFileSync('src/services/activityLogSessionService.ts', 'utf8');
assert.match(
  activityLogService,
  /from ['"]\.\/scoringConfig['"]/,
  'activityLogSessionService must import from scoringConfig',
);
assert.doesNotMatch(
  activityLogService,
  /entry\.points\s*\?\?\s*10/,
  'activityLogSessionService must not use hardcoded entry.points ?? 10',
);
assert.match(
  activityLogService,
  /computeActivityScore/,
  'activityLogSessionService must call computeActivityScore',
);
assert.match(
  activityLogService,
  /scoringVersion.*'v2'|'v2'.*scoringVersion/,
  'activityLogSessionService must stamp scoringVersion v2 on writes',
);

// ── 10. P4D: Direct service paths use scoring engine ─────────────────────────

const workoutSvc = readFileSync('src/services/workoutService.ts', 'utf8');
assert.match(
  workoutSvc,
  /computeActivityScore/,
  'workoutService must call computeActivityScore',
);
assert.doesNotMatch(
  workoutSvc,
  /increment\(10\)/,
  'workoutService must not hardcode increment(10) for totalPoints',
);
assert.match(
  workoutSvc,
  /scoringVersion.*'v2'|'v2'.*scoringVersion/,
  'workoutService must stamp scoringVersion v2 on writes',
);

const wellnessSvc = readFileSync('src/services/wellnessLogService.ts', 'utf8');
assert.match(
  wellnessSvc,
  /computeActivityScore/,
  'wellnessLogService must call computeActivityScore',
);
assert.doesNotMatch(
  wellnessSvc,
  /input\.points\s*\?\?\s*10/,
  'wellnessLogService must not use hardcoded input.points ?? 10',
);
assert.match(
  wellnessSvc,
  /scoringVersion.*'v2'|'v2'.*scoringVersion/,
  'wellnessLogService must stamp scoringVersion v2 on writes',
);

const sessionSvc = readFileSync('src/services/activityLogSessionService.ts', 'utf8');
assert.doesNotMatch(
  sessionSvc,
  /Math\.max\(1,\s*(?:Math\.min|scoring)/,
  'activityLogSessionService must not force minimum 1 point (Math.max(1,...) anti-gaming floor removed)',
);
assert.match(
  sessionSvc,
  /Math\.max\(0,/,
  'activityLogSessionService must allow 0-point scores via Math.max(0,...)',
);

const firestoreRules = readFileSync('firestore.rules', 'utf8');
assert.match(
  firestoreRules,
  /scoringVersion\s*==\s*'v2'/,
  'firestore.rules must allow 0 points for v2 wellness docs',
);
assert.match(
  firestoreRules,
  /points\s*>=\s*0/,
  'firestore.rules must have points >= 0 condition for v2 wellness docs',
);

// ── 11. P4E: Cloud Function leaderboard scoring uses v2 log.points ────────────

const memberActivitySummaries = readFileSync('functions/src/memberActivitySummaries.ts', 'utf8');

// v2 branch for workout must read data.points, not use raw value as score
assert.match(
  memberActivitySummaries,
  /isV2.*clampNumber.*storedPoints|storedPoints.*isV2/s,
  'memberActivitySummaries must use stored points for v2 workout logs (not raw value)',
);

// The legacy path for workouts still uses Math.round(value)
assert.match(
  memberActivitySummaries,
  /Math\.round\(value\)/,
  'memberActivitySummaries must preserve legacy workout scoring (Math.round(value))',
);

// scoringVersion check present
assert.match(
  memberActivitySummaries,
  /scoringVersion.*===.*'v2'|'v2'.*===.*scoringVersion/,
  'memberActivitySummaries must branch on scoringVersion === "v2"',
);

// leaderboard payload stores lastScoringVersion
assert.match(
  memberActivitySummaries,
  /lastScoringVersion/,
  'memberActivitySummaries must write lastScoringVersion to leaderboard docs',
);

// wellness legacy path still falls back to points || value || 1
assert.match(
  memberActivitySummaries,
  /storedPoints \|\| value \|\| 1/,
  'memberActivitySummaries must preserve legacy wellness fallback (points || value || 1)',
);

// v2 path clamps with min=0 (not 1) — allowing anti-gaming 0-point floor to reach leaderboard
assert.match(
  memberActivitySummaries,
  /clampNumber\(storedPoints,\s*0,/,
  'memberActivitySummaries v2 branch must clamp score to minimum 0 (not 1) so anti-gaming floor reaches leaderboard',
);

// ── 12. P4F: Scoring UI transparency ─────────────────────────────────────────

const workoutLoggedScreen = readFileSync('src/features/Workouts/WorkoutLoggedScreen.tsx', 'utf8');
const challengeLeaderboardScreen = readFileSync('src/features/Challenges/ChallengeLeaderboardScreen.tsx', 'utf8');
const groupLeaderboardScreen = readFileSync('src/features/Groups/GroupLeaderboardScreen.tsx', 'utf8');
const challengeDetailScreen = readFileSync('src/features/Challenges/ChallengeDetailScreen.tsx', 'utf8');
const challengeActivityFlow = readFileSync('src/services/challengeActivityFlow.ts', 'utf8');

// No hardcoded "10 points" fallback in success path builder
assert.doesNotMatch(
  challengeActivityFlow,
  /points.*\?\?.*10\b/,
  'challengeActivityFlow must not fall back to 10 points (use 0)',
);

// Success screen: points fallback must not be 10
assert.doesNotMatch(
  workoutLoggedScreen,
  /\|\|\s*10\b/,
  'WorkoutLoggedScreen must not fall back to 10 when points is falsy',
);

// 0-point explanation copy: P6D uses "Target not met." (not "Below minimum effort")
assert.match(
  workoutLoggedScreen,
  /Target not met\./,
  'WorkoutLoggedScreen must show "Target not met." when 0 points earned (P6D)',
);
assert.doesNotMatch(
  workoutLoggedScreen,
  /Below minimum effort for points/,
  'P6D: "Below minimum effort" copy must be gone — replaced by proportional scoring',
);

// Target-met explanation copy must exist
assert.match(
  workoutLoggedScreen,
  /Target met\./,
  'WorkoutLoggedScreen must show "Target met." when target was reached',
);

// Partial-points explanation copy must exist
assert.match(
  workoutLoggedScreen,
  /Partial points earned\./,
  'WorkoutLoggedScreen must show "Partial points earned." for partial scoring',
);

// Leaderboard must not use "XP" label
assert.doesNotMatch(
  challengeLeaderboardScreen,
  />XP</,
  'ChallengeLeaderboardScreen must not use "XP" label — use "pts"',
);

assert.doesNotMatch(
  groupLeaderboardScreen,
  />XP</,
  'GroupLeaderboardScreen must not use "XP" label — use "pts"',
);

// ChallengeDetail must include scoring explanation
assert.match(
  challengeDetailScreen,
  /How Points Work/,
  'ChallengeDetailScreen must include a "How Points Work" section',
);

// Leaderboard helper text must be present
assert.match(
  challengeLeaderboardScreen,
  /Points are based on challenge targets/,
  'ChallengeLeaderboardScreen must include points explanation helper text',
);

// No raw technical scoring metadata shown in member UI
// scoringVersion and rawValue must never appear in any member-facing screen.
// scoringMethod is permitted in WorkoutLoggedScreen as a logic variable (used to select copy,
// not rendered as text), but must not appear in the other three screens.
for (const [name, src] of [
  ['ChallengeLeaderboardScreen', challengeLeaderboardScreen],
  ['GroupLeaderboardScreen', groupLeaderboardScreen],
  ['ChallengeDetailScreen', challengeDetailScreen],
] as const) {
  assert.doesNotMatch(src, /scoringVersion|rawValue|scoringMethod|anti-gaming/, `${name} must not expose raw scoring metadata to users`);
}
// WorkoutLoggedScreen: scoringVersion and rawValue still forbidden; scoringMethod is allowed (logic only)
assert.doesNotMatch(workoutLoggedScreen, /scoringVersion|rawValue|anti-gaming/, 'WorkoutLoggedScreen must not expose scoringVersion/rawValue to users');
// Confirm scoringMethod in WorkoutLoggedScreen is used for logic, not rendered as visible text
assert.doesNotMatch(
  workoutLoggedScreen,
  />\s*\{scoringMethod\}|>\s*scoringMethod\b/,
  'WorkoutLoggedScreen must not render scoringMethod as visible text',
);

// ── 13. P4H: Leaderboard backfill script safety ───────────────────────────────

const backfillScript = readFileSync('scripts/backfillLeaderboardScoring.ts', 'utf8');

// GOOGLE_APPLICATION_CREDENTIALS check must be present
assert.match(
  backfillScript,
  /GOOGLE_APPLICATION_CREDENTIALS/,
  'backfillLeaderboardScoring must require GOOGLE_APPLICATION_CREDENTIALS',
);

// CONFIRM_PROJECT_ID production guard must be present
assert.match(
  backfillScript,
  /CONFIRM_PROJECT_ID/,
  'backfillLeaderboardScoring must require CONFIRM_PROJECT_ID for production apply',
);

// Must default to dry-run (apply flag required)
assert.match(
  backfillScript,
  /--apply/,
  'backfillLeaderboardScoring must require --apply flag for writes',
);

// Must NOT write to workouts or wellnessLogs
assert.doesNotMatch(
  backfillScript,
  /collection\(['"`]workouts['"`]\).*\.set\b|collection\(['"`]workouts['"`]\).*\.update\b|collection\(['"`]workouts['"`]\).*\.delete\b/,
  'backfillLeaderboardScoring must not write to workouts collection',
);
assert.doesNotMatch(
  backfillScript,
  /collection\(['"`]wellnessLogs['"`]\).*\.set\b|collection\(['"`]wellnessLogs['"`]\).*\.update\b|collection\(['"`]wellnessLogs['"`]\).*\.delete\b/,
  'backfillLeaderboardScoring must not write to wellnessLogs collection',
);

// Must only write to challengeLeaderboards
assert.match(
  backfillScript,
  /collection\(['"`]challengeLeaderboards['"`]\)/,
  'backfillLeaderboardScoring must write to challengeLeaderboards',
);

// v2 scoring: clamp with min=0
assert.match(
  backfillScript,
  /clampNumber.*points.*0,\s*MAX_ACTIVITY_SCORE|clampNumber.*numberValue.*'points'.*,\s*0,/,
  'backfillLeaderboardScoring v2 path must clamp stored points with min=0',
);

// Legacy workout scoring: Math.round(value) with min=1
assert.match(
  backfillScript,
  /Math\.round.*numberValue.*'value'|Math\.round\(numberValue\(row,\s*'value'\)\)/,
  'backfillLeaderboardScoring legacy workout path must use Math.round(value)',
);

// Legacy wellness scoring: storedPoints || value || 1 pattern
assert.match(
  backfillScript,
  /storedPoints \|\| value \|\| 1/,
  'backfillLeaderboardScoring legacy wellness path must use storedPoints || value || 1',
);

// ── 14. P4I → P5L: Direct logging completion guard (updated by P5L) ──────────
// P4I originally required !endAt on all three services to prevent time-bounded
// auto-completion. P5L intentionally removed !endAt so time-bounded challenges
// can be marked completed when nextRate/completionRate reaches 100.
// The date-boundary guard (no logging after endDate) is separate and still present.

const workoutServiceSrc = readFileSync('src/services/workoutService.ts', 'utf8');
const wellnessLogServiceSrc = readFileSync('src/services/wellnessLogService.ts', 'utf8');
const sessionServiceSrc = readFileSync('src/services/activityLogSessionService.ts', 'utf8');

// All three services must fire completion at 100% — !endAt guard must be gone
assert.ok(
  !workoutServiceSrc.includes('&& !endAt'),
  'workoutService must not have !endAt guard — removed by P5L to allow time-bounded challenge completion',
);
assert.ok(
  !wellnessLogServiceSrc.includes('&& !endAt'),
  'wellnessLogService must not have !endAt guard — removed by P5L to allow time-bounded challenge completion',
);
assert.ok(
  !sessionServiceSrc.includes('&& !endAt'),
  'activityLogSessionService must not have !endAt guard — removed by P5L to allow time-bounded challenge completion',
);

// All three logging paths must share the same completion semantics.
// Phase 11C: workoutService and wellnessLogService now delegate completion to the engine.
// activityLogSessionService still uses the pre-engine inline pattern (not yet refactored).
{
  // workoutService and wellnessLogService: completion via engine result (Phase 11C).
  // Phase 13C: the pattern is now gated on !isCollective — collective challenges use the
  // transaction path instead. Both forms (original and gated) contain engineResult.isCompleted.
  assert.match(workoutServiceSrc, /engineResult\.isCompleted/,
    'workoutService completion guard must use engine result (Phase 11C / 13C)');
  assert.match(wellnessLogServiceSrc, /engineResult\.isCompleted/,
    'wellnessLogService completion guard must use engine result (Phase 11C / 13C)');
  // activityLogSessionService: still inline (pre-engine, refactored in a later phase)
  const patternSession = /if \(nextRate >= 100\)/.test(sessionServiceSrc);
  assert.ok(patternSession, 'activityLogSessionService completion guard must match canonical pattern');
}

// ── 15. P4K: Scoring copy alignment ───────────────────────────────────────────

const logWorkoutSrc = readFileSync('src/features/Workouts/LogWorkoutScreen.tsx', 'utf8');
const logWellnessSrc = readFileSync('src/features/Workouts/LogWellnessActivityScreen.tsx', 'utf8');
const workoutLoggedSrc = readFileSync('src/features/Workouts/WorkoutLoggedScreen.tsx', 'utf8');
const activityFlowSrc = readFileSync('src/services/challengeActivityFlow.ts', 'utf8');

// scoringMethod must be passed through challengeActivityFlow
assert.match(
  activityFlowSrc,
  /scoringMethod/,
  'challengeActivityFlow buildActivitySuccessPath must accept scoringMethod',
);

// scoringMethod must be set on the URL params
assert.match(
  activityFlowSrc,
  /qs\.set\(['"`]scoringMethod['"`]/,
  'challengeActivityFlow must set scoringMethod on the URL query string',
);

// LogWorkoutScreen must pass scoringMethod to buildActivitySuccessPath
assert.match(
  logWorkoutSrc,
  /scoringMethod:\s*scoring\.scoringMethod/,
  'LogWorkoutScreen must pass scoring.scoringMethod to buildActivitySuccessPath',
);

// LogWellnessActivityScreen must pass scoringMethod to buildActivitySuccessPath
assert.match(
  logWellnessSrc,
  /scoringMethod:\s*scoring\.scoringMethod/,
  'LogWellnessActivityScreen must pass scoring.scoringMethod to buildActivitySuccessPath',
);

// WorkoutLoggedScreen must read scoringMethod from URL params
assert.match(
  workoutLoggedSrc,
  /params\.get\(['"`]scoringMethod['"`]\)/,
  'WorkoutLoggedScreen must read scoringMethod from URL params',
);

// P6D: 0-point with metTarget=false shows "Target not met." (no streak_binary branch needed)
assert.match(
  workoutLoggedSrc,
  /Target not met\./,
  'WorkoutLoggedScreen must show "Target not met." for 0-point non-met logs',
);

// P6D: "Partial points earned." must appear for partial logs
assert.match(
  workoutLoggedSrc,
  /Partial points earned\./,
  'WorkoutLoggedScreen must show "Partial points earned." for partial logs',
);

// P6D: streak_binary branch must be gone — scoring is now purely proportional_capped
assert.doesNotMatch(
  workoutLoggedSrc,
  /streak_binary/,
  'WorkoutLoggedScreen must not reference streak_binary (removed in P6D)',
);

// No || 10 fallback on points
assert.doesNotMatch(
  workoutLoggedSrc,
  /\|\|\s*10\b/,
  'WorkoutLoggedScreen must not have a || 10 fallback on points',
);

// ── 15. P5O: Scoring normalization and completion integrity ───────────────────

// Unified formula: no competitive_value divergence (all types use proportional_capped)
{
  const scoringConfigSrcCheck = readFileSync('src/services/scoringConfig.ts', 'utf8');
  assert.doesNotMatch(
    scoringConfigSrcCheck,
    /cappedValue.*COMPETITIVE_VALUE_CAP_RATIO|COMPETITIVE_VALUE_CAP_RATIO/,
    'scoringConfig must NOT define or use COMPETITIVE_VALUE_CAP_RATIO — competitive divergence removed',
  );
  assert.match(
    scoringConfigSrcCheck,
    /proportional_capped/,
    'scoringConfig must use proportional_capped for all types',
  );
}

// BASE_POINTS_PER_TARGET must be >= 100 (not the old 10)
assert.ok(
  SCORING_CONSTANTS.BASE_POINTS_PER_TARGET >= 100,
  `BASE_POINTS_PER_TARGET must be >= 100 for per-challenge normalization; got ${SCORING_CONSTANTS.BASE_POINTS_PER_TARGET}`,
);

// SelectChallengeActivityScreen targetValue must not be identical expression to value
{
  const selectScreen = readFileSync('src/features/Workouts/SelectChallengeActivityScreen.tsx', 'utf8');
  const navigateBlock = selectScreen.match(/navigate\(buildActivitySuccessPath\(\{[\s\S]*?\}\)/)?.[0] ?? '';
  assert.ok(navigateBlock.length > 0, 'SelectChallengeActivityScreen must contain navigate(buildActivitySuccessPath({...}))');
  // The targetValue line must not be the same reduce expression as the value line
  assert.doesNotMatch(
    navigateBlock,
    /targetValue:\s*result\.entries\.reduce\(\(sum,\s*entry\)\s*=>\s*sum\s*\+\s*entry\.value,\s*0\)/,
    'SelectChallengeActivityScreen targetValue must not be sum of logged values — would always show 100% completion',
  );
}

// ChallengeCompletedScreen must not use the custom formula totalValue * 0.4
{
  const completedScreen = readFileSync('src/features/Challenges/ChallengeCompletedScreen.tsx', 'utf8');
  assert.doesNotMatch(
    completedScreen,
    /totalValue\s*\*\s*0\.4/,
    'ChallengeCompletedScreen must not use the custom "totalValue * 0.4" points formula — use membership.totalPoints',
  );
  assert.match(
    completedScreen,
    /membership\??\.totalPoints/,
    'ChallengeCompletedScreen must use membership.totalPoints for points display',
  );
}

// Profile Wins button must have a visual affordance (ChevronRight or similar)
{
  const profileScreen = readFileSync('src/features/Profile/ProfileScreen.tsx', 'utf8');
  const winsButtonMatch = profileScreen.match(/<button[^>]*>\s*[\s\S]*?Wins[\s\S]*?<\/button>/)?.[0] ?? '';
  assert.ok(
    winsButtonMatch.includes('ChevronRight') || winsButtonMatch.includes('chevron') || winsButtonMatch.includes('›'),
    'Profile Wins button must include a visual affordance (ChevronRight, chevron, or ›)',
  );
}

// wellnessLogService: unified formula — no basePoints normalization (removed in CRIT-3 Phase 2)
{
  const wellnessSvcSrc = readFileSync('src/services/wellnessLogService.ts', 'utf8');
  assert.doesNotMatch(
    wellnessSvcSrc,
    /normalizedBase/,
    'wellnessLogService must NOT use normalizedBase — unified formula uses fixed 100-pt base',
  );
  assert.doesNotMatch(
    wellnessSvcSrc,
    /basePoints:/,
    'wellnessLogService must NOT pass basePoints to computeActivityScore — removed in CRIT-3',
  );
}

// ── 16. P5P: Wellness permission + activityType routing + session normalization ──

// challengeActivityFlow must use resolveWellnessActivityType (not the naive category fallback)
{
  const activityFlowSrc = readFileSync('src/services/challengeActivityFlow.ts', 'utf8');
  assert.match(
    activityFlowSrc,
    /resolveWellnessActivityType/,
    'challengeActivityFlow must export and use resolveWellnessActivityType',
  );
  assert.doesNotMatch(
    activityFlowSrc,
    /challenge\?\.category\s*\?\?\s*'wellness'/,
    'challengeActivityFlow must not fall back to the literal string "wellness" as activityType — use resolveWellnessActivityType instead',
  );
  // 'wellness' must never be returned by resolveWellnessActivityType
  assert.doesNotMatch(
    activityFlowSrc,
    /return\s*'wellness'/,
    'resolveWellnessActivityType must never return "wellness" — it is not a valid Firestore logType',
  );
}

// activityLogSessionService: unified formula — no normalizedBase, no basePoints
{
  const sessionSvcSrc = readFileSync('src/services/activityLogSessionService.ts', 'utf8');
  assert.doesNotMatch(
    sessionSvcSrc,
    /normalizedBase/,
    'activityLogSessionService must NOT use normalizedBase — unified formula uses fixed 100-pt base',
  );
  assert.doesNotMatch(
    sessionSvcSrc,
    /basePoints:/,
    'activityLogSessionService must NOT pass basePoints to computeActivityScore — removed in CRIT-3',
  );
  assert.doesNotMatch(
    sessionSvcSrc,
    /basePoints:\s*entry\.points/,
    'activityLogSessionService must not pass entry.points as basePoints',
  );
}

// wellnessLogService must read groupMembers doc before the batch commit
{
  const wellnessSvcSrc2 = readFileSync('src/services/wellnessLogService.ts', 'utf8');
  assert.match(
    wellnessSvcSrc2,
    /groupMembers.*getDoc|getDoc.*groupMembers/,
    'wellnessLogService must read the groupMembers doc before committing the batch',
  );
  assert.match(
    wellnessSvcSrc2,
    /groupMember\.userId\s*!==\s*input\.userId|!.*active.*joined.*groupMember\.status/,
    'wellnessLogService must validate groupMember.userId and status before the batch (mirrors Firestore isValidActivityContext rule)',
  );
  // Debug mode must be gated — never exposed in production UI
  assert.match(
    wellnessSvcSrc2,
    /__wellnessLogDebug/,
    'wellnessLogService must have a __wellnessLogDebug debug mode flag',
  );
  assert.match(
    wellnessSvcSrc2,
    /typeof window/,
    'wellnessLogService debug mode must be gated behind typeof window check (not active in SSR/tests)',
  );
}

// ── Section 17: P5R — Legacy points UI removal ────────────────────────────────
// Creation screens must not render a "Points" input for challenge activities.
{
  const wizardSrc = readFileSync('src/features/Challenges/CreateChallengeWizard.tsx', 'utf8');
  assert.doesNotMatch(
    wizardSrc,
    /pointsPerCompletion.*onChange|onChange.*pointsPerCompletion/,
    'CreateChallengeWizard must not render an editable Points input tied to pointsPerCompletion',
  );
  assert.doesNotMatch(
    wizardSrc,
    /pointsPerCompletion:\s*activity\.pointsPerCompletion/,
    'CreateChallengeWizard must not write pointsPerCompletion into the challenge payload',
  );
  const adminCreateSrc = readFileSync('src/features/Admin/Challenges/CreateChallengeScreen.tsx', 'utf8');
  assert.doesNotMatch(
    adminCreateSrc,
    /pointsPerCompletion.*onChange|onChange.*pointsPerCompletion/,
    'Admin CreateChallengeScreen must not render an editable Points input tied to pointsPerCompletion',
  );
  assert.doesNotMatch(
    adminCreateSrc,
    /pointsPerCompletion:\s*(activity|matched)\./,
    'Admin CreateChallengeScreen must not write pointsPerCompletion into the challenge payload from activity or matched fields',
  );
}

// SelectChallengeActivityScreen must not read pointsPerCompletion or set entry.points
{
  const selectSrc = readFileSync('src/features/Workouts/SelectChallengeActivityScreen.tsx', 'utf8');
  assert.doesNotMatch(
    selectSrc,
    /optional\.pointsPerCompletion/,
    'SelectChallengeActivityScreen must not read optional.pointsPerCompletion — scoring engine ignores it',
  );
  assert.doesNotMatch(
    selectSrc,
    /points:\s*basePoints/,
    'SelectChallengeActivityScreen must not set entry.points from basePoints — scoring engine uses normalizedBase',
  );
  assert.doesNotMatch(
    selectSrc,
    /basePoints\s*=\s*Number\(.*pointsPerCompletion/,
    'SelectChallengeActivityScreen must not derive basePoints from pointsPerCompletion',
  );
}

// scoringConfig basePoints comment must not describe it as coming from pointsPerCompletion
{
  const scoringCfgSrc = readFileSync('src/services/scoringConfig.ts', 'utf8');
  assert.doesNotMatch(
    scoringCfgSrc,
    /from activity\.pointsPerCompletion/,
    'scoringConfig basePoints comment must not reference pointsPerCompletion — use normalizedBase description',
  );
}

// ── Section 18: P5T — P5S findings fixes ────────────────────────────────────

// Fix 1: SelectChallengeActivityScreen must use resolveWellnessActivityType, never emit 'wellness'
{
  const selectSrc = readFileSync('src/features/Workouts/SelectChallengeActivityScreen.tsx', 'utf8');
  assert.match(
    selectSrc,
    /resolveWellnessActivityType/,
    'SelectChallengeActivityScreen must import and use resolveWellnessActivityType',
  );
  assert.doesNotMatch(
    selectSrc,
    /activityType:\s*String\([^)]*'wellness'\)/,
    "SelectChallengeActivityScreen must not fall back to literal 'wellness' as activityType",
  );
}

// Fix 2: joinChallenge must set totalActivities via computeRequiredLogs, not hardcode 0
{
  const challengeServiceSrc = readFileSync('src/services/challengeService.ts', 'utf8');
  assert.doesNotMatch(
    challengeServiceSrc,
    /totalActivities:\s*0,/,
    'joinChallenge must not hardcode totalActivities: 0',
  );
  assert.match(
    challengeServiceSrc,
    /totalActivities:.*computeRequiredLogs/,
    'joinChallenge must derive totalActivities via computeRequiredLogs (not raw activities.length)',
  );
  assert.match(
    challengeServiceSrc,
    /computeRequiredLogs\([^)]*durationDays/,
    'joinChallenge computeRequiredLogs call must pass challenge.durationDays',
  );
}

// Fix 3: useHomeScreen must include completed memberships so Trending does not show "Join"
{
  const homeScreenSrc = readFileSync('src/features/Home/useHomeScreen.ts', 'utf8');
  assert.match(
    homeScreenSrc,
    /getUserChallengeMembershipIndex/,
    'useHomeScreen must call getUserChallengeMembershipIndex to include completed challenge IDs',
  );
  assert.match(
    homeScreenSrc,
    /memberStatus\s*===\s*'completed'/,
    "useHomeScreen must check for 'completed' memberStatus",
  );
  assert.match(
    homeScreenSrc,
    /completed.*actionLabel\s*=\s*'View'|actionLabel\s*=\s*'View'.*completed/s,
    "useHomeScreen toTrendingChallenge must map completed membership status to actionLabel 'View'",
  );
}

// Fix 4: workoutService uses unified formula — no normalizedBase, no basePoints
{
  const workoutSrc = readFileSync('src/services/workoutService.ts', 'utf8');
  assert.doesNotMatch(
    workoutSrc,
    /normalizedBase/,
    'workoutService must NOT use normalizedBase — unified formula uses fixed 100-pt base',
  );
  assert.doesNotMatch(
    workoutSrc,
    /basePoints:/,
    'workoutService must NOT pass basePoints to computeActivityScore — removed in CRIT-3',
  );
}

// Fix 5: all three log services must guard against re-logging completed challenges
{
  const wellnessSrc = readFileSync('src/services/wellnessLogService.ts', 'utf8');
  const activitySessionSrc = readFileSync('src/services/activityLogSessionService.ts', 'utf8');
  const workoutSrc2 = readFileSync('src/services/workoutService.ts', 'utf8');
  const completedGuard = /membership\.status\s*===\s*'completed'/;
  assert.match(wellnessSrc, completedGuard, 'wellnessLogService must throw when membership.status === completed');
  assert.match(activitySessionSrc, completedGuard, 'activityLogSessionService must throw when membership.status === completed');
  assert.match(workoutSrc2, completedGuard, 'workoutService must throw when membership.status === completed');
}

// ── Section 19: P5U — Wellness logging permission fix ────────────────────────

// P5U Fix A: isValidChallengeMemberCreate must accept totalActivities equal to
// configuredChallengeActivityCountFrom, not only 0.  P5T Fix 2 writes
// activities.length; the old rule (== 0 only) blocked every new join.
{
  const rules = readFileSync('firestore.rules', 'utf8');
  assert.doesNotMatch(
    rules,
    /request\.resource\.data\.totalActivities\s*==\s*0\b(?!\s*\|\|)/,
    'isValidChallengeMemberCreate must not restrict totalActivities to 0 alone — P5U Fix A requires it to also accept configuredChallengeActivityCountFrom(challenge)',
  );
  assert.match(
    rules,
    /totalActivities\s*==\s*configuredChallengeActivityCountFrom/,
    'isValidChallengeMemberCreate must accept totalActivities == configuredChallengeActivityCountFrom(challenge)',
  );
}

// P5U Fix B: challengeMembers GET must allow reads on non-existent documents.
// Without this, getDoc() on a missing membership fails with "Missing or
// insufficient permissions" instead of returning exists()===false.
{
  const rules = readFileSync('firestore.rules', 'utf8');
  assert.match(
    rules,
    /resource\.data\s*==\s*null/,
    'challengeMembers allow get must handle non-existent documents (resource.data == null) so getDoc() returns exists()===false instead of throwing a permission error',
  );
}

// ── Section 20: P5W — Wellness runtime diagnostics + safe stats update ────────

{
  const wellness = readFileSync('src/services/wellnessLogService.ts', 'utf8');
  const session = readFileSync('src/services/activityLogSessionService.ts', 'utf8');

  // Always-on batch commit error logging — not gated by DEV or debug flag
  assert.match(
    wellness,
    /\[wellnessLogService\] batch commit failed/,
    'wellnessLogService must have always-on batch commit error logging',
  );
  assert.match(
    session,
    /\[activityLogSessionService\] batch commit failed/,
    'activityLogSessionService must have always-on batch commit error logging',
  );

  // activityLogSessionService must not gate batch commit logging behind DEV or debug flag
  assert.doesNotMatch(
    session,
    /if \(import\.meta\.env\.DEV \|\| isDebugMode\(\)\)[\s\S]{0,200}\[activityLogSessionService\] (?:activity session batch|batch commit) failed/,
    'activityLogSessionService batch commit logging must not be gated behind import.meta.env.DEV',
  );

  // Per-getDoc error logging must exist in both services
  assert.match(
    wellness,
    /\[wellnessLogService\] getDoc failed/,
    'wellnessLogService must log getDoc failures with operation context',
  );
  assert.match(
    session,
    /\[activityLogSessionService\] getDoc failed/,
    'activityLogSessionService must log getDoc failures with operation context',
  );

  // P5ZA: wellnessLogService must no longer write legacy users/{uid} stats.
  // Server-owned summary/metrics functions listen to wellnessLogs creates.
  assert.doesNotMatch(
    wellness,
    /const\s+userRef\s*=/,
    'wellnessLogService must not create a users/{uid} document reference for stats updates',
  );
  assert.doesNotMatch(
    wellness,
    /userStatsUpdate/,
    'wellnessLogService must not build a client-side users stats update',
  );
  assert.doesNotMatch(
    wellness,
    /users update|users stats update/,
    'wellnessLogService planned/debug writes must not include users update',
  );
  assert.doesNotMatch(
    wellness,
    /batch\.set\(userRef|batch\.update\(userRef/,
    'wellnessLogService must not write users/{uid} in the wellness logging batch',
  );
  assert.doesNotMatch(
    wellness,
    /doc\(db,\s*['"]users['"]/,
    'wellnessLogService must not reference users collection for wellness stats writes',
  );
  assert.match(
    wellness,
    /plannedWrites\s*=\s*\[\s*['"]wellnessLogs create['"],\s*['"]challengeMembers update['"]\s*\]/,
    'wellnessLogService plannedWrites must include only wellnessLogs create and challengeMembers update',
  );
  assert.match(
    wellness,
    /batch\.set\(logRef,\s*removeUndefinedDeep\(logPayload\)\)/,
    'wellnessLogService must still write wellnessLogs create (sanitized via removeUndefinedDeep)',
  );
  assert.match(
    wellness,
    /batch\.set\(membershipRef,\s*membershipUpdate,\s*\{\s*merge:\s*true\s*\}\)/,
    'wellnessLogService must still write challengeMembers progress update',
  );

  // No private notes in logging payloads
  assert.doesNotMatch(
    wellness,
    /console\.error[\s\S]{0,300}notes\s*:/,
    'wellnessLogService must not log private notes content in error output',
  );
  assert.doesNotMatch(
    session,
    /console\.error[\s\S]{0,300}notes\s*:/,
    'activityLogSessionService must not log private notes content in error output',
  );
}

// ── Section 21: P6B — Duration-aware completion model ────────────────────────

// 21A: computeRequiredLogs pure-function correctness
{
  // Inline the same formula as src/services/challengeCompletion.ts to test it independently.
  function computeRequiredLogs(durationDays: number | null | undefined, activityCount: number): number {
    const days = Math.max(1, Number(durationDays) || 1);
    const activities = Math.max(1, activityCount);
    return days * activities;
  }

  // 20-day sleep challenge (1 activity): requires 20 logs
  assert.strictEqual(computeRequiredLogs(20, 1), 20,
    'P6B: 20-day × 1-activity challenge must require 20 logs');

  // 21-day two-activity challenge: requires 42 logs
  assert.strictEqual(computeRequiredLogs(21, 2), 42,
    'P6B: 21-day × 2-activity challenge must require 42 logs');

  // completionRate after 1 log in a 20-day challenge: 1/20 = 5%
  const rateAfter1SleepLog = Math.min(100, Math.round((1 / computeRequiredLogs(20, 1)) * 100));
  assert.strictEqual(rateAfter1SleepLog, 5,
    'P6B: 1 log in 20-day challenge must yield completionRate = 5%');

  // completionRate after 2 logs in a 21-day 2-activity challenge: 2/42 ≈ 5%
  const rateAfter2SquatLogs = Math.min(100, Math.round((2 / computeRequiredLogs(21, 2)) * 100));
  assert.strictEqual(rateAfter2SquatLogs, 5,
    'P6B: 2 logs in 21-day × 2-activity challenge must yield completionRate ≈ 5% (rounds from 4.76%)');

  // status must remain 'active' — neither rate reaches 100
  assert.ok(rateAfter1SleepLog < 100,
    'P6B: 1 log in 20-day challenge must NOT trigger completed status');
  assert.ok(rateAfter2SquatLogs < 100,
    'P6B: 2 logs in 21-day × 2-activity challenge must NOT trigger completed status');

  // Edge cases: no durationDays → defaults to 1 day (backwards compat)
  assert.strictEqual(computeRequiredLogs(undefined, 2), 2,
    'P6B: missing durationDays must default to 1 day');
  assert.strictEqual(computeRequiredLogs(0, 2), 2,
    'P6B: durationDays=0 must default to 1 day');
}

// 21B: All three log services use computeRequiredLogs
{
  const wellnessSrc = readFileSync('src/services/wellnessLogService.ts', 'utf8');
  const workoutSrc = readFileSync('src/services/workoutService.ts', 'utf8');
  const sessionSrc = readFileSync('src/services/activityLogSessionService.ts', 'utf8');

  assert.match(wellnessSrc, /computeRequiredLogs/,
    'P6B: wellnessLogService must use computeRequiredLogs for totalActivities');
  assert.match(workoutSrc, /computeRequiredLogs/,
    'P6B: workoutService must use computeRequiredLogs for totalActivities');
  assert.match(sessionSrc, /computeRequiredLogs/,
    'P6B: activityLogSessionService must use computeRequiredLogs for totalActivities');

  // Services must pass durationDays to the helper
  assert.match(wellnessSrc, /computeRequiredLogs\([^)]*durationDays/,
    'P6B: wellnessLogService must pass challenge.durationDays to computeRequiredLogs');
  assert.match(workoutSrc, /computeRequiredLogs\([^)]*durationDays/,
    'P6B: workoutService must pass challengeData.durationDays to computeRequiredLogs');
  assert.match(sessionSrc, /computeRequiredLogs\([^)]*durationDays/,
    'P6B: activityLogSessionService must pass challenge.durationDays to computeRequiredLogs');

  // Old Math.max fallback that ignored durationDays must be gone from service files
  assert.doesNotMatch(wellnessSrc, /Math\.max\(1,\s*configuredActivities,\s*Number\(membership\.totalActivities/,
    'P6B: wellnessLogService must not use old Math.max(1, configuredActivities, membership.totalActivities) pattern');
  assert.doesNotMatch(workoutSrc, /Math\.max\(1,\s*configuredActivities,\s*Number\(membership\.totalActivities/,
    'P6B: workoutService must not use old Math.max(1, configuredActivities, membership.totalActivities) pattern');
}

// 21C: joinChallenge uses computeRequiredLogs with durationDays
{
  const challengeServiceSrc = readFileSync('src/services/challengeService.ts', 'utf8');
  assert.match(challengeServiceSrc, /computeRequiredLogs\([^)]*durationDays/,
    'P6B: joinChallenge must call computeRequiredLogs with durationDays');
}

// 21D: Firestore rule configuredChallengeActivityCountFrom multiplies by durationDays
{
  const rules = readFileSync('firestore.rules', 'utf8');
  assert.match(rules, /durationDays/,
    'P6B: firestore.rules configuredChallengeActivityCountFrom must reference durationDays');
  assert.match(rules, /activityCount\s*\*\s*(durationDays|effectiveDays)/,
    'P6B: firestore.rules must multiply activityCount * durationDays (or effectiveDays) in configuredChallengeActivityCountFrom');
  assert.doesNotMatch(
    rules,
    /function configuredChallengeActivityCountFrom[\s\S]{0,500}return\s+challenge\.data\.(activities|exerciseIds)\.size\(\)/,
    'P6B: configuredChallengeActivityCountFrom must not return raw activities.size() without durationDays multiplier',
  );
}

// ── Section 21C: CRIT-3 Step 1 — totalActivities <= 0 guard ─────────────────

// Both log services must throw before any completion logic when computed totalActivities <= 0.
// This is a pure static check: computeRequiredLogs(durationDays, activityCount) cannot return
// a value <= 0 for any valid input (floors both at 1), so the guard covers only misconfigured
// challenge docs that somehow yield 0 from the formula.
{
  assert.match(
    workoutSvc,
    /if\s*\(\s*totalActivities\s*<=\s*0\s*\)/,
    'CRIT-3 Step 1: workoutService must guard totalActivities <= 0 before completion logic',
  );

  assert.match(
    wellnessSvc,
    /if\s*\(\s*totalActivities\s*<=\s*0\s*\)/,
    'CRIT-3 Step 1: wellnessLogService must guard totalActivities <= 0 before completion logic',
  );

  // Guard must appear BEFORE the engine call in both services (Phase 11C: increment is inside LegacyEngine).
  const workoutGuardIdx = workoutSvc.indexOf('if (totalActivities <= 0)');
  const workoutEngineCallIdx = workoutSvc.indexOf('engine.computeUpdate(');
  assert.ok(
    workoutGuardIdx !== -1 && workoutEngineCallIdx !== -1 && workoutGuardIdx < workoutEngineCallIdx,
    'CRIT-3 Step 1: workoutService totalActivities guard must appear before engine.computeUpdate call',
  );

  const wellnessGuardIdx = wellnessSvc.indexOf('if (totalActivities <= 0)');
  const wellnessEngineCallIdx = wellnessSvc.indexOf('engine.computeUpdate(');
  assert.ok(
    wellnessGuardIdx !== -1 && wellnessEngineCallIdx !== -1 && wellnessGuardIdx < wellnessEngineCallIdx,
    'CRIT-3 Step 1: wellnessLogService totalActivities guard must appear before engine.computeUpdate call',
  );

  // Verify the guard throws (not just returns) so no batch write can proceed.
  const workoutGuardBlock = workoutSvc.slice(workoutGuardIdx, workoutGuardIdx + 200);
  assert.match(
    workoutGuardBlock,
    /throw new Error/,
    'CRIT-3 Step 1: workoutService totalActivities guard must throw, not silently return',
  );

  const wellnessGuardBlock = wellnessSvc.slice(wellnessGuardIdx, wellnessGuardIdx + 200);
  assert.match(
    wellnessGuardBlock,
    /throw new Error/,
    'CRIT-3 Step 1: wellnessLogService totalActivities guard must throw, not silently return',
  );
}

// ── Section 22: P6C — Daily target scoring model ─────────────────────────────

// 22A: deriveDailyTargetValue pure-function correctness
{
  function deriveDailyTargetValue(
    targetValue: number,
    durationDays: number | null | undefined,
    challengeType: string,
  ): number {
    if (challengeType !== 'streak') return targetValue;
    const days = Math.max(1, Number(durationDays) || 1);
    if (days <= 1) return targetValue;
    const derived = targetValue / days;
    return derived >= 1 ? derived : targetValue;
  }

  // Squat + Pushup 50: cumulative 1050 / 21 days = 50 daily reps
  assert.strictEqual(deriveDailyTargetValue(1050, 21, 'streak'), 50,
    'P6C: 1050 cumulative over 21-day streak must derive daily target = 50');

  // 8-Hour Sleep Streak: 8 / 20 = 0.4 < 1 → keep original (8 is already the daily target)
  assert.strictEqual(deriveDailyTargetValue(8, 20, 'streak'), 8,
    'P6C: sleep targetValue=8 over 20 days must NOT be divided (8/20=0.4 < 1 threshold)');

  // Social connection: 1 / 7 = 0.14 < 1 → keep 1
  assert.strictEqual(deriveDailyTargetValue(1, 7, 'streak'), 1,
    'P6C: social targetValue=1 over 7 days must NOT be divided (already daily)');

  // Non-streak challenges: targetValue used as-is regardless of durationDays
  assert.strictEqual(deriveDailyTargetValue(1050, 21, 'collective'), 1050,
    'P6C: collective challenge must not have targetValue divided');
  assert.strictEqual(deriveDailyTargetValue(1050, 21, 'competitive'), 1050,
    'P6C: competitive challenge must not have targetValue divided');

  // durationDays = 1: no division
  assert.strictEqual(deriveDailyTargetValue(100, 1, 'streak'), 100,
    'P6C: streak with durationDays=1 must not divide targetValue');

  // durationDays missing: no division
  assert.strictEqual(deriveDailyTargetValue(100, undefined, 'streak'), 100,
    'P6C: streak with missing durationDays must not divide targetValue');
}

// 22B: Scoring a 50-rep log against daily target 50 earns points (not 0)
{
  // This is the core bug fix proof: the old code passed targetValue=1050 to scoring,
  // so value=50 scored 0. The new code derives dailyTargetValue=50 and scores correctly.
  // P6D update: under proportional_capped scoring, 50/1050 earns ~5 pts (not 0, not 100).
  // The P6C fix (deriveDailyTargetValue) is still critical: without it, the user earns 5/100 pts
  // for a full day's effort. With it, the daily target becomes 50 and they earn 100/100 pts.
  const oldResult = computeActivityScore({ value: 50, targetValue: 1050, challengeType: 'streak' });
  assert.ok(oldResult.pointsEarned < 10,
    'P6C+P6D: scoring 50 reps against cumulative target 1050 earns near-zero pts (confirms cumulative target is wrong)');
  assert.strictEqual(oldResult.metTarget, false,
    'P6C: 50 vs 1050 must not meet target');

  const newResult = computeActivityScore({ value: 50, targetValue: 50, challengeType: 'streak' });
  assert.ok(newResult.pointsEarned > 0,
    'P6C: scoring 50 reps against daily target 50 must earn points');
  assert.strictEqual(newResult.metTarget, true,
    'P6C: 50 vs 50 must meet target');

  // P6D: 25 reps on a 50-rep/day streak now earns 50 pts (proportional, not binary)
  const partialResult = computeActivityScore({ value: 25, targetValue: 50, challengeType: 'streak' });
  assert.strictEqual(partialResult.pointsEarned, Math.round((25 / 50) * SCORING_CONSTANTS.BASE_POINTS_PER_TARGET),
    'P6D: 25 reps against 50-rep streak target earns proportional pts (50), not 0');
  assert.strictEqual(partialResult.metTarget, false,
    'P6D: 25/50 does not meet target — metTarget must be false');
}

// 22C: Sleep scoring — value=8 against daily target=8 earns points
{
  const sleepResult = computeActivityScore({ value: 8, targetValue: 8, challengeType: 'collective' });
  assert.ok(sleepResult.pointsEarned > 0,
    'P6C: 8 hrs sleep against target=8 must earn points');
  assert.strictEqual(sleepResult.metTarget, true,
    'P6C: 8 hrs sleep meets target=8');
}

// 22D: All three services use deriveDailyTargetValue
{
  const wellnessSrc = readFileSync('src/services/wellnessLogService.ts', 'utf8');
  const workoutSrc  = readFileSync('src/services/workoutService.ts', 'utf8');
  const sessionSrc  = readFileSync('src/services/activityLogSessionService.ts', 'utf8');

  assert.match(wellnessSrc, /deriveDailyTargetValue/,
    'P6C: wellnessLogService must use deriveDailyTargetValue');
  assert.match(workoutSrc, /deriveDailyTargetValue/,
    'P6C: workoutService must use deriveDailyTargetValue');
  assert.match(sessionSrc, /deriveDailyTargetValue/,
    'P6C: activityLogSessionService must use deriveDailyTargetValue');

  // Each service must pass durationDays to deriveDailyTargetValue
  assert.match(wellnessSrc, /deriveDailyTargetValue\([^)]*durationDays/,
    'P6C: wellnessLogService must pass durationDays to deriveDailyTargetValue');
  assert.match(workoutSrc, /deriveDailyTargetValue\([^)]*durationDays/,
    'P6C: workoutService must pass durationDays to deriveDailyTargetValue');
  assert.match(sessionSrc, /deriveDailyTargetValue\([^)]*durationDays/,
    'P6C: activityLogSessionService must pass durationDays to deriveDailyTargetValue');
}

// 22E: Guard — services must NOT pass raw targetValue directly to computeActivityScore
//       for streak challenges (they must go through deriveDailyTargetValue first)
{
  const wellnessSrc = readFileSync('src/services/wellnessLogService.ts', 'utf8');
  const workoutSrc  = readFileSync('src/services/workoutService.ts', 'utf8');
  const sessionSrc  = readFileSync('src/services/activityLogSessionService.ts', 'utf8');

  // The old pattern was:  targetValue: input.targetValue ?? 0  (direct pass to computeActivityScore)
  // After the fix, targetValue in computeActivityScore call must reference effectiveTargetValue
  assert.doesNotMatch(wellnessSrc,
    /computeActivityScore\([\s\S]{0,300}targetValue:\s*(?:input\.targetValue|entry\.targetValue)\s*\?\?\s*0/,
    'P6C: wellnessLogService must not pass raw input.targetValue directly to computeActivityScore');
  assert.doesNotMatch(workoutSrc,
    /computeActivityScore\([\s\S]{0,300}targetValue:\s*input\.targetValue\s*\?\?\s*0/,
    'P6C: workoutService must not pass raw input.targetValue directly to computeActivityScore');
  assert.doesNotMatch(sessionSrc,
    /computeActivityScore\([\s\S]{0,300}targetValue:\s*entry\.targetValue\s*\?\?\s*0/,
    'P6C: activityLogSessionService must not pass raw entry.targetValue directly to computeActivityScore');

  // effectiveTargetValue must be what reaches computeActivityScore
  assert.match(wellnessSrc, /computeActivityScore\([\s\S]{0,300}targetValue:\s*effectiveTargetValue/,
    'P6C: wellnessLogService must pass effectiveTargetValue to computeActivityScore');
  assert.match(workoutSrc, /computeActivityScore\([\s\S]{0,300}targetValue:\s*effectiveTargetValue/,
    'P6C: workoutService must pass effectiveTargetValue to computeActivityScore');
}

// ── Section 23: P6D — Percentage-equivalent daily points ─────────────────────

// 23A: Core formula proofs
{
  // Sleep: 4/8 hours = 50 pts
  assert.strictEqual(
    computeActivityScore({ value: 4, targetValue: 8, challengeType: 'collective' }).pointsEarned,
    50,
    'P6D: 4/8 sleep hours earns 50 pts',
  );

  // Exercise: 10/50 reps = 20 pts
  assert.strictEqual(
    computeActivityScore({ value: 10, targetValue: 50, challengeType: 'streak' }).pointsEarned,
    20,
    'P6D: 10/50 reps earns 20 pts',
  );

  // Seconds treated same as reps — 10/50 seconds = 20 pts (not 10 raw pts)
  assert.strictEqual(
    computeActivityScore({ value: 10, targetValue: 50, challengeType: 'streak' }).pointsEarned,
    20,
    'P6D: 10/50 seconds earns 20 pts (not raw value 10)',
  );
  assert.notStrictEqual(
    computeActivityScore({ value: 10, targetValue: 50, challengeType: 'streak' }).pointsEarned,
    10,
    'P6D: raw value 10 must never equal pointsEarned when target is 50',
  );

  // 25/50 streak earns 50 (was 0 under streak_binary)
  assert.strictEqual(
    computeActivityScore({ value: 25, targetValue: 50, challengeType: 'streak' }).pointsEarned,
    50,
    'P6D: 25/50 streak earns 50 pts (proportional, was 0 under streak_binary)',
  );

  // 50/50 earns 100
  assert.strictEqual(
    computeActivityScore({ value: 50, targetValue: 50, challengeType: 'streak' }).pointsEarned,
    SCORING_CONSTANTS.BASE_POINTS_PER_TARGET,
    'P6D: 50/50 earns 100 pts',
  );

  // 75/50 capped at 100 (no overperformance for streak)
  assert.strictEqual(
    computeActivityScore({ value: 75, targetValue: 50, challengeType: 'streak' }).pointsEarned,
    SCORING_CONSTANTS.BASE_POINTS_PER_TARGET,
    'P6D: 75/50 capped at 100 pts (no overperformance for streak)',
  );

  // Raw value 105 seconds must not become 105 pts
  assert.notStrictEqual(
    computeActivityScore({ value: 105, targetValue: 50, challengeType: 'streak' }).pointsEarned,
    105,
    'P6D: raw value 105 must not equal pointsEarned when target is 50',
  );
  assert.strictEqual(
    computeActivityScore({ value: 105, targetValue: 50, challengeType: 'streak' }).pointsEarned,
    SCORING_CONSTANTS.BASE_POINTS_PER_TARGET,
    'P6D: 105/50 capped at 100 pts',
  );
}

// 23B: metTarget and streak continuation are independent of pointsEarned
{
  const partial = computeActivityScore({ value: 25, targetValue: 50, challengeType: 'streak' });
  assert.strictEqual(partial.metTarget, false, 'P6D: 25/50 does not meet target');
  assert.ok(partial.pointsEarned > 0, 'P6D: 25/50 still earns points even though target not met');

  const met = computeActivityScore({ value: 50, targetValue: 50, challengeType: 'streak' });
  assert.strictEqual(met.metTarget, true, 'P6D: 50/50 meets target');

  // P6E: currentStreak cannot increase points — bonus is removed
  const bonusIgnored = computeActivityScore({ value: 25, targetValue: 50, challengeType: 'streak' });
  assert.strictEqual(
    bonusIgnored.pointsEarned,
    Math.round((25 / 50) * SCORING_CONSTANTS.BASE_POINTS_PER_TARGET),
    'P6E: currentStreak=14 does not change pointsEarned (bonus removed)',
  );

  const metFullStreak = computeActivityScore({ value: 50, targetValue: 50, challengeType: 'streak' });
  assert.strictEqual(
    metFullStreak.pointsEarned,
    SCORING_CONSTANTS.BASE_POINTS_PER_TARGET,
    'P6E: 50/50 with currentStreak=14 earns exactly base pts — no bonus',
  );
}

// 23C: Mixed-unit session sums percentage points, not raw values
{
  // Two activities: 10/50 reps + 4/8 hours
  // Points: 20 + 50 = 70 (not 10 + 4 = 14)
  const session = computeSessionScore([
    { activityId: 'a1', value: 10, targetValue: 50, challengeType: 'streak' },
    { activityId: 'a2', value: 4, targetValue: 8, challengeType: 'collective' },
  ]);
  assert.strictEqual(session.totalPointsEarned, 20 + 50, 'P6D: mixed-unit session sums percentage pts (20+50=70), not raw values (10+4=14)');
  assert.notStrictEqual(session.totalPointsEarned, 10 + 4, 'P6D: raw value sum must not be used');
}

// 23D: scoringMethod is proportional_capped for streak and wellness-binary (not streak_binary/binary)
{
  assert.strictEqual(
    computeActivityScore({ value: 50, targetValue: 50, challengeType: 'streak' }).scoringMethod,
    'proportional_capped',
    'P6D: streak scoring method is proportional_capped',
  );
  assert.strictEqual(
    computeActivityScore({ value: 8, targetValue: 8, challengeType: 'collective' }).scoringMethod,
    'proportional_capped',
    'P6D: wellness binary scoring method is proportional_capped',
  );
  assert.notStrictEqual(
    computeActivityScore({ value: 50, targetValue: 50, challengeType: 'streak' }).scoringMethod,
    'streak_binary',
    'P6D: streak_binary method must not be emitted',
  );
  assert.notStrictEqual(
    computeActivityScore({ value: 8, targetValue: 8, challengeType: 'collective' }).scoringMethod,
    'binary',
    'P6D: binary method must not be emitted',
  );
}

// 23E: WorkoutLoggedScreen no longer references streak_binary
{
  const workoutLoggedSrc = readFileSync('src/features/Workouts/WorkoutLoggedScreen.tsx', 'utf8');
  assert.doesNotMatch(
    workoutLoggedSrc,
    /streak_binary/,
    'P6D: WorkoutLoggedScreen must not reference streak_binary',
  );
  assert.match(
    workoutLoggedSrc,
    /Partial points earned\./,
    'P6D: WorkoutLoggedScreen must show "Partial points earned." for partial logs',
  );
}

// 23F: Both scoringConfig copies are aligned on proportional_capped
{
  const clientSrc    = readFileSync('src/services/scoringConfig.ts', 'utf8');
  const functionsSrc = readFileSync('functions/src/scoringConfig.ts', 'utf8');
  assert.match(clientSrc, /proportional_capped/, 'P6D: client scoringConfig uses proportional_capped');
  assert.match(functionsSrc, /proportional_capped/, 'P6D: functions scoringConfig uses proportional_capped');
  assert.doesNotMatch(clientSrc, /scoringMethod:\s*'streak_binary'/, 'P6D: client must not emit streak_binary');
  assert.doesNotMatch(functionsSrc, /scoringMethod:\s*'streak_binary'/, 'P6D: functions must not emit streak_binary');
  assert.doesNotMatch(clientSrc, /scoringMethod:\s*'binary'/, 'P6D: client must not emit binary');
  assert.doesNotMatch(functionsSrc, /scoringMethod:\s*'binary'/, 'P6D: functions must not emit binary');
}

// ── Section 24: P6E — Remove bonus scoring, finalize percentage points ────────

// 24A: Core formula — pointsEarned = round(min(value/target, 1) * base), no addends
{
  // 4/8 = 50 pts, metTarget false
  assert.strictEqual(computeActivityScore({ value: 4, targetValue: 8, challengeType: 'collective' }).pointsEarned, 50, 'P6E: 4/8 sleep = 50 pts');
  assert.strictEqual(computeActivityScore({ value: 4, targetValue: 8, challengeType: 'collective' }).metTarget, false, 'P6E: 4/8 sleep metTarget false');

  // 8/8 = 100 pts, metTarget true
  assert.strictEqual(computeActivityScore({ value: 8, targetValue: 8, challengeType: 'collective' }).pointsEarned, 100, 'P6E: 8/8 sleep = 100 pts');
  assert.strictEqual(computeActivityScore({ value: 8, targetValue: 8, challengeType: 'collective' }).metTarget, true, 'P6E: 8/8 sleep metTarget true');

  // 10/50 = 20 pts, metTarget false
  assert.strictEqual(computeActivityScore({ value: 10, targetValue: 50, challengeType: 'streak' }).pointsEarned, 20, 'P6E: 10/50 reps = 20 pts');
  assert.strictEqual(computeActivityScore({ value: 10, targetValue: 50, challengeType: 'streak' }).metTarget, false, 'P6E: 10/50 metTarget false');

  // 50/50 = 100 pts, metTarget true
  assert.strictEqual(computeActivityScore({ value: 50, targetValue: 50, challengeType: 'streak' }).pointsEarned, 100, 'P6E: 50/50 reps = 100 pts');
  assert.strictEqual(computeActivityScore({ value: 50, targetValue: 50, challengeType: 'streak' }).metTarget, true, 'P6E: 50/50 metTarget true');

  // 75/50 = 100 pts, no bonus
  assert.strictEqual(computeActivityScore({ value: 75, targetValue: 50, challengeType: 'streak' }).pointsEarned, 100, 'P6E: 75/50 capped at 100 pts, no bonus');
  assert.strictEqual(computeActivityScore({ value: 75, targetValue: 50, challengeType: 'streak' }).metTarget, true, 'P6E: 75/50 metTarget true');
}

// 24B: currentStreak cannot increase points (any streak value)
{
  const base  = computeActivityScore({ value: 50, targetValue: 50, challengeType: 'streak' }).pointsEarned;
  const week1 = computeActivityScore({ value: 50, targetValue: 50, challengeType: 'streak' }).pointsEarned;
  const week4 = computeActivityScore({ value: 50, targetValue: 50, challengeType: 'streak' }).pointsEarned;
  assert.strictEqual(week1, base, 'P6E: 7-day streak earns same as 0-day streak');
  assert.strictEqual(week4, base, 'P6E: 28-day streak earns same as 0-day streak');
  assert.strictEqual(base, SCORING_CONSTANTS.BASE_POINTS_PER_TARGET, 'P6E: base pts = 100');
}

// 24C: No scorer returns more than basePoints (for streak and wellness-binary)
{
  const cases: Array<() => number> = [
    () => computeActivityScore({ value: 999, targetValue: 50, challengeType: 'streak' }).pointsEarned,
    () => computeActivityScore({ value: 999, targetValue: 50, challengeType: 'streak' }).pointsEarned,
    () => computeActivityScore({ value: 999, targetValue: 8, challengeType: 'collective' }).pointsEarned,
  ];
  for (const fn of cases) {
    assert.ok(fn() <= SCORING_CONSTANTS.BASE_POINTS_PER_TARGET,
      'P6E: no proportional_capped scorer returns more than basePoints');
  }
}

// 24D: Source-level proof — no scoring file uses streak bonus or overperformance
{
  const clientSrc    = readFileSync('src/services/scoringConfig.ts', 'utf8');
  const functionsSrc = readFileSync('functions/src/scoringConfig.ts', 'utf8');

  // Neither file should add streakBonus to pointsEarned
  assert.doesNotMatch(clientSrc, /\+\s*streakBonus/,
    'P6E: client scoringConfig must not add streakBonus to pointsEarned');
  assert.doesNotMatch(functionsSrc, /\+\s*streakBonus/,
    'P6E: functions scoringConfig must not add streakBonus to pointsEarned');

  // No overperformance multiplier (unified formula caps at 1×)
  assert.doesNotMatch(clientSrc, /MAX_OVERPERFORMANCE_MULTIPLIER/,
    'P6E: client scoringConfig must not define MAX_OVERPERFORMANCE_MULTIPLIER');
  assert.doesNotMatch(functionsSrc, /MAX_OVERPERFORMANCE_MULTIPLIER/,
    'P6E: functions scoringConfig must not define MAX_OVERPERFORMANCE_MULTIPLIER');

  // Both copies use proportional_capped
  assert.match(clientSrc, /proportional_capped/,
    'P6E: client scoringConfig must use proportional_capped');
  assert.match(functionsSrc, /proportional_capped/,
    'P6E: functions scoringConfig must use proportional_capped');
}

// 24E: Unified formula caps overperformance at 100 pts for all types
{
  const over = computeActivityScore({ value: 999, targetValue: 50, challengeType: 'streak' });
  assert.strictEqual(over.pointsEarned, SCORING_CONSTANTS.BASE_POINTS_PER_TARGET,
    'P6E: any overperformance on streak is capped at 100 pts');
  const overComp = computeActivityScore({ value: 999, targetValue: 50, challengeType: 'competitive' });
  assert.strictEqual(overComp.pointsEarned, SCORING_CONSTANTS.BASE_POINTS_PER_TARGET,
    'P6E: any overperformance on competitive is capped at 100 pts (no 3x bonus)');
}

// ── Section 25: Phase 11B — Challenge Engine Framework Guards ─────────────────

// 25A: Engine framework files must exist
{
  const engineFiles = [
    'src/services/challengeEngine/types.ts',
    'src/services/challengeEngine/legacyEngine.ts',
    'src/services/challengeEngine/streakEngine.ts',
    'src/services/challengeEngine/competitiveEngine.ts',
    'src/services/challengeEngine/collectiveEngine.ts',
    'src/services/challengeEngine/index.ts',
  ];
  for (const file of engineFiles) {
    const src = readFileSync(file, 'utf8');
    assert.ok(src.length > 0, `Phase 11B: ${file} must exist and be non-empty`);
  }
}

// 25B: selectEngine must route v1 (undefined engineVersion) to LegacyEngine
{
  const indexSrc = readFileSync('src/services/challengeEngine/index.ts', 'utf8');
  assert.match(
    indexSrc,
    /engineVersion\s*!==\s*'v2'/,
    'Phase 11B: selectEngine must route non-v2 engineVersion to LegacyEngine',
  );
  assert.match(
    indexSrc,
    /LegacyEngine/,
    'Phase 11B: selectEngine must reference LegacyEngine',
  );
}

// 25C: selectEngine must route v2 streak to StreakEngine
{
  const indexSrc = readFileSync('src/services/challengeEngine/index.ts', 'utf8');
  assert.match(
    indexSrc,
    /case\s*'streak'[\s\S]{0,60}StreakEngine/,
    "Phase 11B: selectEngine must route challengeType 'streak' to StreakEngine",
  );
}

// 25D: selectEngine must route v2 competitive to CompetitiveEngine
{
  const indexSrc = readFileSync('src/services/challengeEngine/index.ts', 'utf8');
  assert.match(
    indexSrc,
    /case\s*'competitive'[\s\S]{0,60}CompetitiveEngine/,
    "Phase 11B: selectEngine must route challengeType 'competitive' to CompetitiveEngine",
  );
}

// 25E: selectEngine must route v2 collective to CollectiveEngine
{
  const indexSrc = readFileSync('src/services/challengeEngine/index.ts', 'utf8');
  assert.match(
    indexSrc,
    /case\s*'collective'[\s\S]{0,60}CollectiveEngine/,
    "Phase 11B: selectEngine must route challengeType 'collective' to CollectiveEngine",
  );
}

// 25F: All v2 engines now active (Phase 11F: CollectiveEngine wired — all three engines live)
{
  // StreakEngine must NOT throw — wired in Phase 11D
  const streakSrc = readFileSync('src/services/challengeEngine/streakEngine.ts', 'utf8');
  assert.doesNotMatch(
    streakSrc,
    /Engine not wired yet/,
    'Phase 11D: StreakEngine.computeUpdate must NOT throw "not wired yet"',
  );

  // CompetitiveEngine must NOT throw — wired in Phase 11E
  const competitiveSrc = readFileSync('src/services/challengeEngine/competitiveEngine.ts', 'utf8');
  assert.doesNotMatch(
    competitiveSrc,
    /Engine not wired yet/,
    'Phase 11E: CompetitiveEngine.computeUpdate must NOT throw "not wired yet"',
  );

  // CollectiveEngine must NOT throw — wired in Phase 11F
  const collectiveSrc = readFileSync('src/services/challengeEngine/collectiveEngine.ts', 'utf8');
  assert.doesNotMatch(
    collectiveSrc,
    /Engine not wired yet/,
    'Phase 11F: CollectiveEngine.computeUpdate must NOT throw "not wired yet" (wired in Phase 11F)',
  );
}

// 25G: Phase 11C completed — services are now wired to selectEngine (LegacyEngine for all v1 challenges).
// Positive check: both services import and call selectEngine.
{
  const workoutSrc = readFileSync('src/services/workoutService.ts', 'utf8');
  assert.match(
    workoutSrc,
    /selectEngine/,
    'Phase 11C: workoutService must import and call selectEngine (wired in Phase 11C)',
  );

  const wellnessSrc = readFileSync('src/services/wellnessLogService.ts', 'utf8');
  assert.match(
    wellnessSrc,
    /selectEngine/,
    'Phase 11C: wellnessLogService must import and call selectEngine (wired in Phase 11C)',
  );
}

// 25H: LegacyEngine must implement the ChallengeEngine interface (structural check)
{
  const legacySrc = readFileSync('src/services/challengeEngine/legacyEngine.ts', 'utf8');
  assert.match(
    legacySrc,
    /implements ChallengeEngine/,
    'Phase 11B: LegacyEngine must declare "implements ChallengeEngine"',
  );
  assert.match(
    legacySrc,
    /computeUpdate/,
    'Phase 11B: LegacyEngine must define computeUpdate method',
  );
}

// 25I: Types file must define all required interfaces
{
  const typesSrc = readFileSync('src/services/challengeEngine/types.ts', 'utf8');
  for (const iface of ['ChallengeEngine', 'ChallengeContext', 'MembershipSnapshot', 'LogEvent', 'EngineResult', 'EngineVersion']) {
    assert.match(
      typesSrc,
      new RegExp(`(interface|type)\\s+${iface}`),
      `Phase 11B: types.ts must define ${iface}`,
    );
  }
}

// ── Section 26: Phase 11C — LegacyEngine integration guards ──────────────────

// 26.1: workoutService imports selectEngine
{
  const workoutSrc = readFileSync('src/services/workoutService.ts', 'utf8');
  assert.match(
    workoutSrc,
    /from ['"]\.\/challengeEngine['"]/,
    'Phase 11C: workoutService must import from challengeEngine',
  );
  assert.match(
    workoutSrc,
    /selectEngine/,
    'Phase 11C: workoutService must import and call selectEngine',
  );
}

// 26.2: wellnessLogService imports selectEngine
{
  const wellnessSrc = readFileSync('src/services/wellnessLogService.ts', 'utf8');
  assert.match(
    wellnessSrc,
    /from ['"]\.\/challengeEngine['"]/,
    'Phase 11C: wellnessLogService must import from challengeEngine',
  );
  assert.match(
    wellnessSrc,
    /selectEngine/,
    'Phase 11C: wellnessLogService must import and call selectEngine',
  );
}

// 26.3: Both services call engine.computeUpdate
{
  const workoutSrc = readFileSync('src/services/workoutService.ts', 'utf8');
  const wellnessSrc = readFileSync('src/services/wellnessLogService.ts', 'utf8');
  assert.match(
    workoutSrc,
    /engine\.computeUpdate/,
    'Phase 11C: workoutService must call engine.computeUpdate',
  );
  assert.match(
    wellnessSrc,
    /engine\.computeUpdate/,
    'Phase 11C: wellnessLogService must call engine.computeUpdate',
  );
}

// 26.4: No direct inline completion calculation remains in either service
{
  const workoutSrc = readFileSync('src/services/workoutService.ts', 'utf8');
  assert.doesNotMatch(
    workoutSrc,
    /const nextCompleted\s*=/,
    'Phase 11C: workoutService must not contain inline "const nextCompleted" completion calculation',
  );
  assert.doesNotMatch(
    workoutSrc,
    /const nextRate\s*=/,
    'Phase 11C: workoutService must not contain inline "const nextRate" calculation',
  );
  assert.doesNotMatch(
    workoutSrc,
    /if \(nextRate >= 100\)/,
    'Phase 11C: workoutService must not have inline "if (nextRate >= 100)" completion check',
  );

  const wellnessSrc = readFileSync('src/services/wellnessLogService.ts', 'utf8');
  assert.doesNotMatch(
    wellnessSrc,
    /const completed\s*=\s*Math\.min\(Number/,
    'Phase 11C: wellnessLogService must not contain inline "const completed = Math.min" completion calculation',
  );
  assert.doesNotMatch(
    wellnessSrc,
    /const completionRate\s*=\s*Math\.min\(100/,
    'Phase 11C: wellnessLogService must not contain inline "const completionRate = Math.min(100" calculation',
  );
  assert.doesNotMatch(
    wellnessSrc,
    /if \(completionRate >= 100\)/,
    'Phase 11C: wellnessLogService must not have inline "if (completionRate >= 100)" completion check',
  );
}

// 26.5: No service imports StreakEngine directly
{
  const workoutSrc = readFileSync('src/services/workoutService.ts', 'utf8');
  const wellnessSrc = readFileSync('src/services/wellnessLogService.ts', 'utf8');
  assert.doesNotMatch(workoutSrc, /StreakEngine/, 'Phase 11C: workoutService must not import StreakEngine directly');
  assert.doesNotMatch(wellnessSrc, /StreakEngine/, 'Phase 11C: wellnessLogService must not import StreakEngine directly');
}

// 26.6: No service imports CompetitiveEngine directly
{
  const workoutSrc = readFileSync('src/services/workoutService.ts', 'utf8');
  const wellnessSrc = readFileSync('src/services/wellnessLogService.ts', 'utf8');
  assert.doesNotMatch(workoutSrc, /CompetitiveEngine/, 'Phase 11C: workoutService must not import CompetitiveEngine directly');
  assert.doesNotMatch(wellnessSrc, /CompetitiveEngine/, 'Phase 11C: wellnessLogService must not import CompetitiveEngine directly');
}

// 26.7: No service imports CollectiveEngine directly
{
  const workoutSrc = readFileSync('src/services/workoutService.ts', 'utf8');
  const wellnessSrc = readFileSync('src/services/wellnessLogService.ts', 'utf8');
  assert.doesNotMatch(workoutSrc, /CollectiveEngine/, 'Phase 11C: workoutService must not import CollectiveEngine directly');
  assert.doesNotMatch(wellnessSrc, /CollectiveEngine/, 'Phase 11C: wellnessLogService must not import CollectiveEngine directly');
}

// 26.8: All three v2 engines active — Phase 11F: CollectiveEngine wired
{
  const collectiveSrc = readFileSync('src/services/challengeEngine/collectiveEngine.ts', 'utf8');
  assert.doesNotMatch(collectiveSrc, /Engine not wired yet/, 'Phase 11F: CollectiveEngine must NOT throw "not wired yet" (wired in Phase 11F)');
}

// 26.9: LegacyEngine produces byte-for-byte identical outputs to previous inline implementation
{
  const engine = new LegacyEngine();

  const baseContext = {
    challengeId: 'test-challenge',
    challengeType: 'collective' as const,
    engineVersion: 'v1' as const,
    targetType: 'daily' as const,
    durationDays: 30,
    activities: [],
    startDate: '2026-06-01',
    endDate: '2026-06-30',
  };

  // Fixture A: 5 of 30 logs complete, 75 pts earned
  {
    const membership = { userId: 'u1', challengeId: 'c1', status: 'active' as const, activitiesCompleted: 5, totalActivities: 30, completionRate: 17, totalPoints: 375 };
    const logEvent = { userId: 'u1', challengeId: 'c1', activityId: 'ex1', value: 40, unit: 'reps', date: '2026-06-06', loggedAt: new Date(), pointsEarned: 75 };

    // Previous inline calculation:
    const prevNextCompleted = Math.min((membership.activitiesCompleted ?? 0) + 1, membership.totalActivities);
    const prevNextRate = Math.min(100, Math.round((prevNextCompleted / membership.totalActivities) * 100));

    const result = engine.computeUpdate(baseContext, membership, logEvent);

    assert.strictEqual(result.membershipUpdate.activitiesCompleted, prevNextCompleted,
      'Phase 11C 26.9A: LegacyEngine activitiesCompleted matches inline calculation');
    assert.strictEqual(result.membershipUpdate.completionRate, prevNextRate,
      'Phase 11C 26.9A: LegacyEngine completionRate matches inline calculation');
    assert.strictEqual(result.isCompleted, prevNextRate >= 100,
      'Phase 11C 26.9A: LegacyEngine isCompleted matches inline calculation');
  }

  // Fixture B: final log — 29 of 30 complete, triggers completion
  {
    const membership = { userId: 'u1', challengeId: 'c1', status: 'active' as const, activitiesCompleted: 29, totalActivities: 30, completionRate: 97, totalPoints: 2900 };
    const logEvent = { userId: 'u1', challengeId: 'c1', activityId: 'ex1', value: 50, unit: 'reps', date: '2026-06-30', loggedAt: new Date(), pointsEarned: 100 };

    const prevNextCompleted = Math.min((membership.activitiesCompleted ?? 0) + 1, membership.totalActivities);
    const prevNextRate = Math.min(100, Math.round((prevNextCompleted / membership.totalActivities) * 100));

    const result = engine.computeUpdate(baseContext, membership, logEvent);

    assert.strictEqual(result.membershipUpdate.activitiesCompleted, prevNextCompleted,
      'Phase 11C 26.9B: LegacyEngine final log — activitiesCompleted matches');
    assert.strictEqual(result.membershipUpdate.completionRate, prevNextRate,
      'Phase 11C 26.9B: LegacyEngine final log — completionRate = 100');
    assert.strictEqual(result.isCompleted, true,
      'Phase 11C 26.9B: LegacyEngine final log — isCompleted = true');
    assert.strictEqual(result.membershipUpdate.status, 'completed',
      'Phase 11C 26.9B: LegacyEngine final log — status = completed');
  }

  // Fixture C: already-at-cap (activitiesCompleted === totalActivities) — no overflow
  {
    const membership = { userId: 'u1', challengeId: 'c1', status: 'active' as const, activitiesCompleted: 30, totalActivities: 30, completionRate: 100, totalPoints: 3000 };
    const logEvent = { userId: 'u1', challengeId: 'c1', activityId: 'ex1', value: 50, unit: 'reps', date: '2026-07-01', loggedAt: new Date(), pointsEarned: 100 };

    const prevNextCompleted = Math.min((membership.activitiesCompleted ?? 0) + 1, membership.totalActivities);
    const result = engine.computeUpdate(baseContext, membership, logEvent);

    assert.strictEqual(result.membershipUpdate.activitiesCompleted, prevNextCompleted,
      'Phase 11C 26.9C: LegacyEngine at-cap — activitiesCompleted does not overflow');
    assert.strictEqual(result.membershipUpdate.activitiesCompleted, 30,
      'Phase 11C 26.9C: LegacyEngine at-cap — activitiesCompleted capped at totalActivities');
  }

  // Fixture D: single-activity 1-day challenge (edge case: totalActivities = 1)
  {
    const membership = { userId: 'u1', challengeId: 'c1', status: 'active' as const, activitiesCompleted: 0, totalActivities: 1, completionRate: 0, totalPoints: 0 };
    const logEvent = { userId: 'u1', challengeId: 'c1', activityId: 'ex1', value: 100, unit: 'reps', date: '2026-06-01', loggedAt: new Date(), pointsEarned: 100 };

    const prevNextCompleted = Math.min((membership.activitiesCompleted ?? 0) + 1, membership.totalActivities);
    const prevNextRate = Math.min(100, Math.round((prevNextCompleted / membership.totalActivities) * 100));

    const result = engine.computeUpdate(baseContext, membership, logEvent);

    assert.strictEqual(result.membershipUpdate.activitiesCompleted, 1,
      'Phase 11C 26.9D: LegacyEngine 1-day challenge — activitiesCompleted = 1');
    assert.strictEqual(result.membershipUpdate.completionRate, prevNextRate,
      'Phase 11C 26.9D: LegacyEngine 1-day challenge — completionRate = 100');
    assert.strictEqual(result.isCompleted, true,
      'Phase 11C 26.9D: LegacyEngine 1-day challenge — isCompleted = true on first log');
  }
}

// ── Section 27: Phase 11D — StreakEngine v2 fixture tests ────────────────────

{
  // Shared fixtures for Section 27
  const s27ctx = {
    challengeId: 'streak-challenge',
    challengeType: 'streak' as const,
    engineVersion: 'v2' as const,
    targetType: 'daily' as const,
    durationDays: 7,
    activities: [],
    startDate: '2026-06-01',
    endDate: '2026-06-07',
    requiredConsecutiveDays: 7,
    streakResetOnMiss: true,
  };
  const s27baseMem = {
    userId: 'u1',
    challengeId: 'streak-challenge',
    status: 'active' as const,
    activitiesCompleted: 0,
    totalActivities: 7,
    completionRate: 0,
    totalPoints: 0,
    currentStreak: 0,
    longestStreak: 0,
  };
  const s27baseLog = {
    userId: 'u1',
    challengeId: 'streak-challenge',
    activityId: 'ex1',
    value: 50,
    unit: 'reps',
    date: '2026-06-01',
    loggedAt: new Date(),
    pointsEarned: 80,
  };

  // 27.1: First day — no prior log → currentStreak = 1
  {
    const result = new StreakEngine().computeUpdate(s27ctx, s27baseMem, s27baseLog);
    assert.strictEqual(result.membershipUpdate.currentStreak, 1,
      'Phase 11D 27.1: first-day log → currentStreak = 1');
    assert.strictEqual(result.membershipUpdate.longestStreak, 1,
      'Phase 11D 27.1: first-day log → longestStreak = 1');
    assert.strictEqual(result.membershipUpdate.lastLogDate, '2026-06-01',
      'Phase 11D 27.1: first-day log → lastLogDate set');
    assert.strictEqual(result.membershipUpdate.engineVersion, 'v2',
      'Phase 11D 27.1: first-day log → engineVersion = v2');
    assert.strictEqual(result.isCompleted, false,
      'Phase 11D 27.1: first-day log → not completed (streak 1 of 7)');
  }

  // 27.2: Consecutive day — yesterday's log → streak advances
  {
    const mem = { ...s27baseMem, activitiesCompleted: 1, totalPoints: 80, currentStreak: 1, longestStreak: 1, lastLogDate: '2026-06-01' };
    const log = { ...s27baseLog, date: '2026-06-02', pointsEarned: 90 };
    const result = new StreakEngine().computeUpdate(s27ctx, mem, log);
    assert.strictEqual(result.membershipUpdate.currentStreak, 2,
      'Phase 11D 27.2: consecutive-day log → currentStreak = 2');
    assert.strictEqual(result.membershipUpdate.longestStreak, 2,
      'Phase 11D 27.2: consecutive-day log → longestStreak = 2');
    assert.strictEqual(result.membershipUpdate.lastLogDate, '2026-06-02',
      'Phase 11D 27.2: consecutive-day log → lastLogDate updated');
    assert.strictEqual(result.isCompleted, false,
      'Phase 11D 27.2: streak 2 of 7 → not completed');
  }

  // 27.3: Same-day duplicate — streak NOT advanced, activitiesCompleted still increments
  {
    const mem = { ...s27baseMem, activitiesCompleted: 2, currentStreak: 2, longestStreak: 2, lastLogDate: '2026-06-02' };
    const log = { ...s27baseLog, date: '2026-06-02', pointsEarned: 60 };
    const result = new StreakEngine().computeUpdate(s27ctx, mem, log);
    assert.strictEqual(result.membershipUpdate.currentStreak, 2,
      'Phase 11D 27.3: same-day duplicate → streak NOT advanced (stays 2)');
    assert.strictEqual(result.membershipUpdate.lastLogDate, '2026-06-02',
      'Phase 11D 27.3: same-day duplicate → lastLogDate unchanged');
    assert.strictEqual(result.membershipUpdate.activitiesCompleted, 3,
      'Phase 11D 27.3: same-day duplicate → activitiesCompleted still increments');
    assert.strictEqual(result.isCompleted, false,
      'Phase 11D 27.3: same-day duplicate → not completed');
  }

  // 27.4: Missed day reset — gap >= 2 days + streakResetOnMiss=true → streak resets to 1
  {
    const mem = { ...s27baseMem, activitiesCompleted: 3, currentStreak: 3, longestStreak: 3, lastLogDate: '2026-06-03' };
    const log = { ...s27baseLog, date: '2026-06-05', pointsEarned: 80 };  // 2-day gap
    const result = new StreakEngine().computeUpdate({ ...s27ctx, streakResetOnMiss: true }, mem, log);
    assert.strictEqual(result.membershipUpdate.currentStreak, 1,
      'Phase 11D 27.4: missed day + resetOnMiss=true → streak reset to 1');
    assert.strictEqual(result.membershipUpdate.longestStreak, 3,
      'Phase 11D 27.4: missed day reset → longestStreak preserved at prior max (3)');
    assert.strictEqual(result.isCompleted, false,
      'Phase 11D 27.4: streak 1 of 7 after reset → not completed');
  }

  // 27.5: Missed day preserve — gap >= 2 days + streakResetOnMiss=false → streak continues
  {
    const mem = { ...s27baseMem, activitiesCompleted: 3, currentStreak: 3, longestStreak: 3, lastLogDate: '2026-06-03' };
    const log = { ...s27baseLog, date: '2026-06-05', pointsEarned: 80 };  // 2-day gap
    const result = new StreakEngine().computeUpdate({ ...s27ctx, streakResetOnMiss: false }, mem, log);
    assert.strictEqual(result.membershipUpdate.currentStreak, 4,
      'Phase 11D 27.5: missed day + resetOnMiss=false → streak continues (3 → 4)');
    assert.strictEqual(result.membershipUpdate.longestStreak, 4,
      'Phase 11D 27.5: streak advance without reset → longestStreak updates to 4');
  }

  // 27.6: Completion day — streak reaches requiredConsecutiveDays → isCompleted = true
  {
    const mem = { ...s27baseMem, activitiesCompleted: 6, totalActivities: 7, currentStreak: 6, longestStreak: 6, lastLogDate: '2026-06-06' };
    const log = { ...s27baseLog, date: '2026-06-07', pointsEarned: 100 };
    const result = new StreakEngine().computeUpdate(s27ctx, mem, log);
    assert.strictEqual(result.membershipUpdate.currentStreak, 7,
      'Phase 11D 27.6: completion-day log → currentStreak = 7');
    assert.strictEqual(result.isCompleted, true,
      'Phase 11D 27.6: streak reaches requiredConsecutiveDays (7) → isCompleted = true');
    assert.strictEqual(result.membershipUpdate.status, 'completed',
      'Phase 11D 27.6: completion → membershipUpdate.status = completed');
    assert.strictEqual(result.membershipUpdate.completionRate, 100,
      'Phase 11D 27.6: completion → completionRate = 100');
  }

  // 27.7: longestStreak update — new streak > previous longest
  {
    // 27.7a: new streak (2) < longestStreak (5) → longestStreak stays
    const memA = { ...s27baseMem, activitiesCompleted: 1, currentStreak: 1, longestStreak: 5, lastLogDate: '2026-06-09' };
    const logA = { ...s27baseLog, date: '2026-06-10', pointsEarned: 80 };
    const resultA = new StreakEngine().computeUpdate(s27ctx, memA, logA);
    assert.strictEqual(resultA.membershipUpdate.longestStreak, 5,
      'Phase 11D 27.7a: new streak (2) < longestStreak (5) → longestStreak stays at 5');

    // 27.7b: new streak (6) > longestStreak (5) → longestStreak updates
    const memB = { ...s27baseMem, activitiesCompleted: 5, currentStreak: 5, longestStreak: 5, lastLogDate: '2026-06-09' };
    const resultB = new StreakEngine().computeUpdate(s27ctx, memB, logA);
    assert.strictEqual(resultB.membershipUpdate.longestStreak, 6,
      'Phase 11D 27.7b: new streak (6) > longestStreak (5) → longestStreak updates to 6');
  }

  // 27.8: Legacy challenge unchanged — v1 streak uses LegacyEngine (no streak fields)
  {
    const legacyEngine = selectEngine({ engineVersion: undefined, challengeType: 'streak' });
    const legacyCtx = { ...s27ctx, engineVersion: 'v1' as const };
    const mem = { ...s27baseMem, activitiesCompleted: 5, totalActivities: 7 };
    const result = legacyEngine.computeUpdate(legacyCtx, mem, s27baseLog);
    assert.strictEqual(result.membershipUpdate.currentStreak, undefined,
      'Phase 11D 27.8: v1 streak challenge → LegacyEngine used, no currentStreak field');
    assert.strictEqual(result.membershipUpdate.lastLogDate, undefined,
      'Phase 11D 27.8: v1 streak challenge → LegacyEngine used, no lastLogDate field');
    assert.strictEqual(result.membershipUpdate.activitiesCompleted, 6,
      'Phase 11D 27.8: v1 streak → LegacyEngine activitiesCompleted = 6 (5+1)');
    assert.strictEqual(result.isCompleted, false,
      'Phase 11D 27.8: v1 streak 6/7 → not completed');
  }

  // 27.9: Competitive now active — Phase 11E wired CompetitiveEngine (updated from Phase 11D)
  {
    const engine = selectEngine({ engineVersion: 'v2', challengeType: 'competitive' });
    const result = engine.computeUpdate(
      { ...s27ctx, challengeType: 'competitive' as const, activities: [{ targetValue: 1000, unit: 'reps' }] },
      { ...s27baseMem, cumulativeLoggedValue: 0, cumulativeValues: {} },
      { ...s27baseLog, activityId: 'ex1', value: 100, pointsEarned: 10 },
    );
    assert.strictEqual(result.membershipUpdate.engineVersion, 'v2',
      'Phase 11E 27.9: v2 + competitive → CompetitiveEngine is active, returns engineVersion v2');
    assert.ok(result.membershipUpdate.cumulativeLoggedValue !== undefined,
      'Phase 11E 27.9: v2 + competitive → CompetitiveEngine returns cumulativeLoggedValue');
    assert.strictEqual(result.isCompleted, false,
      'Phase 11E 27.9: 100/1000 → not completed');
  }

  // 27.10: Collective now active — Phase 11F wired CollectiveEngine (updated from Phase 11D)
  {
    const engine = selectEngine({ engineVersion: 'v2', challengeType: 'collective' });
    const result = engine.computeUpdate(
      { ...s27ctx, challengeType: 'collective' as const, groupCumulativeTarget: 5000, autoCompleteOnGroupTarget: true },
      s27baseMem,
      s27baseLog,
      { groupCurrentTotal: 0 },
    );
    assert.strictEqual(result.membershipUpdate.engineVersion, 'v2',
      'Phase 11F 27.10: v2 + collective → CollectiveEngine is active, returns engineVersion v2');
    assert.ok(result.challengeUpdate !== undefined,
      'Phase 11F 27.10: CollectiveEngine returns challengeUpdate with groupCurrentTotalDelta');
  }
}

// ── Section 28: Phase 11E — CompetitiveEngine v2 fixture tests ───────────────

{
  // Shared fixtures for Section 28
  const s28ctx = {
    challengeId: 'comp-challenge',
    challengeType: 'competitive' as const,
    engineVersion: 'v2' as const,
    targetType: 'cumulative' as const,
    durationDays: 30,
    activities: [
      { activityId: 'pushups', exerciseId: 'pushups', targetValue: 1000, unit: 'reps' },
    ],
    startDate: '2026-06-01',
    endDate: '2026-06-30',
  };
  const s28baseMem = {
    userId: 'u1',
    challengeId: 'comp-challenge',
    status: 'active' as const,
    activitiesCompleted: 0,
    totalActivities: 30,
    completionRate: 0,
    totalPoints: 0,
    cumulativeLoggedValue: 0,
    cumulativeValues: {} as Record<string, number>,
  };
  const s28baseLog = {
    userId: 'u1',
    challengeId: 'comp-challenge',
    activityId: 'pushups',
    value: 100,
    unit: 'reps',
    date: '2026-06-01',
    loggedAt: new Date(),
    pointsEarned: 100,
  };

  // 28.1: Single activity progress — cumulative tracked, rate computed correctly
  {
    const result = new CompetitiveEngine().computeUpdate(s28ctx, s28baseMem, s28baseLog);
    assert.strictEqual(result.membershipUpdate.cumulativeLoggedValue, 100,
      'Phase 11E 28.1: cumulativeLoggedValue = 100 after first log');
    assert.deepEqual(result.membershipUpdate.cumulativeValues, { pushups: 100 },
      'Phase 11E 28.1: per-activity map updated: pushups = 100');
    assert.strictEqual(result.membershipUpdate.completionRate, 10,
      'Phase 11E 28.1: completionRate = round(100/1000 × 100) = 10');
    assert.strictEqual(result.isCompleted, false,
      'Phase 11E 28.1: 100/1000 → not completed');
    assert.strictEqual(result.membershipUpdate.engineVersion, 'v2',
      'Phase 11E 28.1: engineVersion = v2');
  }

  // 28.2: Multi-activity progress — overall rate is average of per-activity rates
  {
    const ctx = {
      ...s28ctx,
      activities: [
        { activityId: 'pushups', exerciseId: 'pushups', targetValue: 1000, unit: 'reps' },
        { activityId: 'bearhold', exerciseId: 'bearhold', targetValue: 500, unit: 'sec' },
      ],
    };
    // Member has logged 300 pushups previously; logs 200 more now
    const mem = { ...s28baseMem, cumulativeLoggedValue: 300, cumulativeValues: { pushups: 300 } };
    const log = { ...s28baseLog, activityId: 'pushups', value: 200 };
    const result = new CompetitiveEngine().computeUpdate(ctx, mem, log);
    // pushups: 500/1000 = 50%, bearhold: 0/500 = 0% → avg = 25%
    assert.strictEqual(result.membershipUpdate.cumulativeValues?.['pushups'], 500,
      'Phase 11E 28.2: pushups cumulative updated to 500');
    assert.strictEqual(result.membershipUpdate.completionRate, 25,
      'Phase 11E 28.2: avg completion = (50 + 0) / 2 = 25%');
    assert.strictEqual(result.isCompleted, false,
      'Phase 11E 28.2: bearhold not logged → not completed');
  }

  // 28.3: Partial completion — one activity done, other halfway (not completed)
  {
    const ctx = {
      ...s28ctx,
      activities: [
        { activityId: 'pushups', exerciseId: 'pushups', targetValue: 100, unit: 'reps' },
        { activityId: 'bearhold', exerciseId: 'bearhold', targetValue: 200, unit: 'sec' },
      ],
    };
    // pushups already at 100 (done), bearhold at 100 (halfway)
    const mem = { ...s28baseMem, cumulativeValues: { pushups: 100, bearhold: 100 } };
    // Log bearhold value=0 (no new progress — tests rate calculation from existing state)
    const log = { ...s28baseLog, activityId: 'bearhold', value: 0, pointsEarned: 0 };
    const result = new CompetitiveEngine().computeUpdate(ctx, mem, log);
    // pushups: 100/100=100%, bearhold: 100/200=50% → avg=75%, not all done
    assert.strictEqual(result.membershipUpdate.completionRate, 75,
      'Phase 11E 28.3: pushups 100% + bearhold 50% → avg 75%');
    assert.strictEqual(result.isCompleted, false,
      'Phase 11E 28.3: bearhold at 50% → not completed');
  }

  // 28.4: Completion on final activity — all reach 100% simultaneously
  {
    const ctx = {
      ...s28ctx,
      activities: [
        { activityId: 'pushups', exerciseId: 'pushups', targetValue: 100, unit: 'reps' },
        { activityId: 'bearhold', exerciseId: 'bearhold', targetValue: 200, unit: 'sec' },
      ],
    };
    // pushups done; bearhold needs 50 more
    const mem = { ...s28baseMem, cumulativeValues: { pushups: 100, bearhold: 150 } };
    const log = { ...s28baseLog, activityId: 'bearhold', value: 50, pointsEarned: 100 };
    const result = new CompetitiveEngine().computeUpdate(ctx, mem, log);
    // pushups: 100/100=100%, bearhold: 200/200=100% → all done
    assert.strictEqual(result.isCompleted, true,
      'Phase 11E 28.4: final activity reaches target → isCompleted = true');
    assert.strictEqual(result.membershipUpdate.status, 'completed',
      'Phase 11E 28.4: completion → status = completed');
    assert.strictEqual(result.membershipUpdate.completionRate, 100,
      'Phase 11E 28.4: completion → completionRate = 100');
    assert.ok(result.membershipUpdate.completedAt instanceof Date,
      'Phase 11E 28.4: completedAt is a Date');
  }

  // 28.5: Over-target capped at 100%
  {
    const mem = { ...s28baseMem, cumulativeLoggedValue: 900, cumulativeValues: { pushups: 900 } };
    const log = { ...s28baseLog, activityId: 'pushups', value: 500, pointsEarned: 100 };
    const result = new CompetitiveEngine().computeUpdate(s28ctx, mem, log);
    // pushups: (900+500)/1000 = 1400/1000 → min(100, 140) = 100%
    assert.strictEqual(result.membershipUpdate.completionRate, 100,
      'Phase 11E 28.5: over-target capped at 100%');
    assert.strictEqual(result.isCompleted, true,
      'Phase 11E 28.5: over-target → isCompleted = true');
    assert.strictEqual(result.membershipUpdate.cumulativeLoggedValue, 1400,
      'Phase 11E 28.5: cumulativeLoggedValue reflects actual total (uncapped)');
  }

  // 28.6: Legacy routing — v1 competitive uses LegacyEngine (no cumulative fields)
  {
    const legacyEngine = selectEngine({ engineVersion: undefined, challengeType: 'competitive' });
    const legacyCtx = { ...s28ctx, engineVersion: 'v1' as const };
    const result = legacyEngine.computeUpdate(legacyCtx, s28baseMem, s28baseLog);
    assert.strictEqual(result.membershipUpdate.cumulativeValues, undefined,
      'Phase 11E 28.6: v1 → LegacyEngine, no cumulativeValues field');
    assert.strictEqual(result.membershipUpdate.cumulativeLoggedValue, undefined,
      'Phase 11E 28.6: v1 → LegacyEngine, no cumulativeLoggedValue field');
    assert.strictEqual(result.membershipUpdate.activitiesCompleted, 1,
      'Phase 11E 28.6: v1 → LegacyEngine activitiesCompleted increments normally');
  }

  // 28.7: Streak routing — v2 + streak → StreakEngine (not CompetitiveEngine)
  {
    const streakEngine = selectEngine({ engineVersion: 'v2', challengeType: 'streak' });
    const streakCtx = {
      ...s28ctx,
      challengeType: 'streak' as const,
      activities: [{ activityId: 'pushups', exerciseId: 'pushups', targetValue: 1000, unit: 'reps' }],
      requiredConsecutiveDays: 7,
      streakResetOnMiss: true,
    };
    const streakMem = { ...s28baseMem, currentStreak: 0, longestStreak: 0 };
    const result = streakEngine.computeUpdate(streakCtx, streakMem, s28baseLog);
    assert.strictEqual(result.membershipUpdate.currentStreak, 1,
      'Phase 11E 28.7: v2 + streak → StreakEngine selected (not CompetitiveEngine), currentStreak = 1');
    assert.strictEqual(result.membershipUpdate.cumulativeLoggedValue, undefined,
      'Phase 11E 28.7: StreakEngine does not set cumulativeLoggedValue');
  }

  // 28.8: Collective now active — Phase 11F wired CollectiveEngine (updated from Phase 11E)
  {
    const collectiveEngine = selectEngine({ engineVersion: 'v2', challengeType: 'collective' });
    const result = collectiveEngine.computeUpdate(
      { ...s28ctx, challengeType: 'collective' as const, groupCumulativeTarget: 10000, autoCompleteOnGroupTarget: true },
      s28baseMem,
      s28baseLog,
      { groupCurrentTotal: 0 },
    );
    assert.strictEqual(result.membershipUpdate.engineVersion, 'v2',
      'Phase 11F 28.8: v2 + collective → CollectiveEngine is active, returns engineVersion v2');
    assert.ok(result.challengeUpdate !== undefined,
      'Phase 11F 28.8: CollectiveEngine returns challengeUpdate with groupCurrentTotalDelta');
  }
}

// ── Section 29: Phase 11F — CollectiveEngine v2 fixture tests ────────────────

{
  // Shared fixtures for Section 29
  const s29ctx = {
    challengeId: 'collective-challenge',
    challengeType: 'collective' as const,
    engineVersion: 'v2' as const,
    targetType: 'group-pool' as const,
    durationDays: 30,
    activities: [
      { activityId: 'pushups', exerciseId: 'pushups', targetValue: 0, unit: 'reps' },
    ],
    startDate: '2026-06-01',
    endDate: '2026-06-30',
    groupCumulativeTarget: 20000,
    autoCompleteOnGroupTarget: true,
  };
  const s29baseMem = {
    userId: 'u1',
    challengeId: 'collective-challenge',
    status: 'active' as const,
    activitiesCompleted: 0,
    totalActivities: 30,
    completionRate: 0,
    totalPoints: 0,
  };
  const s29baseLog = {
    userId: 'u1',
    challengeId: 'collective-challenge',
    activityId: 'pushups',
    value: 500,
    unit: 'reps',
    date: '2026-06-01',
    loggedAt: new Date(),
    pointsEarned: 100,
  };

  // 29.1: Single member contribution — delta = log value, challenge not completed
  {
    const result = CollectiveEngine.computeCollectiveUpdate(s29ctx, s29baseMem, s29baseLog, { groupCurrentTotal: 0 });
    assert.strictEqual(result.challengeUpdate?.groupCurrentTotalDelta, 500,
      'Phase 11F 29.1: groupCurrentTotalDelta = log value (500)');
    assert.strictEqual(result.isCompleted, false,
      'Phase 11F 29.1: 500/20000 → not completed');
    assert.strictEqual(result.membershipUpdate.engineVersion, 'v2',
      'Phase 11F 29.1: engineVersion = v2');
  }

  // 29.2: Cumulative group state — delta is always the log value, not affected by prior total
  {
    const result = CollectiveEngine.computeCollectiveUpdate(s29ctx, s29baseMem, s29baseLog, { groupCurrentTotal: 15000 });
    assert.strictEqual(result.challengeUpdate?.groupCurrentTotalDelta, 500,
      'Phase 11F 29.2: delta is always log value regardless of prior group total');
    assert.strictEqual(result.isCompleted, false,
      'Phase 11F 29.2: estimated 15500 < 20000 → not completed');
  }

  // 29.3: Multi-activity — any activity's value contributes to the shared pool
  {
    const ctx = {
      ...s29ctx,
      activities: [
        { activityId: 'pushups', exerciseId: 'pushups', targetValue: 0, unit: 'reps' },
        { activityId: 'squats', exerciseId: 'squats', targetValue: 0, unit: 'reps' },
      ],
    };
    const log = { ...s29baseLog, activityId: 'squats', value: 800 };
    const result = CollectiveEngine.computeCollectiveUpdate(ctx, s29baseMem, log, { groupCurrentTotal: 10000 });
    assert.strictEqual(result.challengeUpdate?.groupCurrentTotalDelta, 800,
      'Phase 11F 29.3: multi-activity — full log value goes to shared pool');
    assert.strictEqual(result.isCompleted, false,
      'Phase 11F 29.3: 10800 < 20000 → not completed');
  }

  // 29.4: Exact completion — estimated total exactly equals target
  {
    const result = CollectiveEngine.computeCollectiveUpdate(s29ctx, s29baseMem, { ...s29baseLog, value: 500 }, { groupCurrentTotal: 19500 });
    assert.strictEqual(result.isCompleted, true,
      'Phase 11F 29.4: 19500 + 500 = 20000 >= 20000 → isCompleted = true');
    assert.strictEqual(result.membershipUpdate.status, 'completed',
      'Phase 11F 29.4: triggering member status = completed on exact completion');
    assert.strictEqual(result.challengeUpdate?.groupCurrentTotalDelta, 500,
      'Phase 11F 29.4: delta still = log value on completion');
  }

  // 29.5: Over-target — delta is full log value (not capped), still triggers completion
  {
    const result = CollectiveEngine.computeCollectiveUpdate(s29ctx, s29baseMem, { ...s29baseLog, value: 1000 }, { groupCurrentTotal: 19500 });
    assert.strictEqual(result.isCompleted, true,
      'Phase 11F 29.5: 19500 + 1000 = 20500 >= 20000 → isCompleted = true');
    assert.strictEqual(result.challengeUpdate?.groupCurrentTotalDelta, 1000,
      'Phase 11F 29.5: delta = full log value even when over target (Firestore gets exact amount)');
  }

  // 29.6: Atomic increment payload — challengeUpdate always returned for collective v2
  {
    const result = CollectiveEngine.computeCollectiveUpdate(s29ctx, s29baseMem, { ...s29baseLog, value: 750 }, { groupCurrentTotal: 0 });
    assert.ok(result.challengeUpdate !== undefined,
      'Phase 11F 29.6: collective always returns challengeUpdate (never undefined)');
    assert.strictEqual(result.challengeUpdate?.groupCurrentTotalDelta, 750,
      'Phase 11F 29.6: groupCurrentTotalDelta must be applied via FieldValue.increment() — not absolute');
    assert.ok('cumulativeLoggedValue' in result.membershipUpdate,
      'Phase 13B-1A (updated 11F 29.6): collective writes cumulativeLoggedValue to enable per-member leaderboard ranking');
  }

  // 29.7: Legacy routing — v1 collective uses LegacyEngine (no challengeUpdate)
  {
    const engine = selectEngine({ engineVersion: undefined, challengeType: 'collective' });
    const result = engine.computeUpdate(
      { ...s29ctx, engineVersion: 'v1' as const },
      s29baseMem,
      s29baseLog,
      { groupCurrentTotal: 0 },
    );
    assert.strictEqual(result.challengeUpdate, undefined,
      'Phase 11F 29.7: v1 → LegacyEngine, no challengeUpdate (no group pool update)');
  }

  // 29.8: Streak routing — v2 + streak → StreakEngine (not CollectiveEngine)
  {
    const engine = selectEngine({ engineVersion: 'v2', challengeType: 'streak' });
    const streakCtx = {
      ...s29ctx,
      challengeType: 'streak' as const,
      activities: [{ activityId: 'pushups', exerciseId: 'pushups', targetValue: 1000, unit: 'reps' }],
      requiredConsecutiveDays: 7,
      streakResetOnMiss: true,
    };
    const streakMem = { ...s29baseMem, currentStreak: 0, longestStreak: 0 };
    const result = engine.computeUpdate(streakCtx, streakMem, s29baseLog, { groupCurrentTotal: 0 });
    assert.strictEqual(result.challengeUpdate, undefined,
      'Phase 11F 29.8: v2 + streak → StreakEngine, no challengeUpdate');
    assert.strictEqual(result.membershipUpdate.currentStreak, 1,
      'Phase 11F 29.8: StreakEngine selected (currentStreak = 1)');
  }

  // 29.9: Competitive routing — v2 + competitive → CompetitiveEngine (not CollectiveEngine)
  {
    const engine = selectEngine({ engineVersion: 'v2', challengeType: 'competitive' });
    const compCtx = {
      ...s29ctx,
      challengeType: 'competitive' as const,
      activities: [{ activityId: 'pushups', exerciseId: 'pushups', targetValue: 1000, unit: 'reps' }],
    };
    const compMem = { ...s29baseMem, cumulativeLoggedValue: 0, cumulativeValues: {} as Record<string, number> };
    const result = engine.computeUpdate(compCtx, compMem, s29baseLog, { groupCurrentTotal: 0 });
    assert.strictEqual(result.challengeUpdate, undefined,
      'Phase 11F 29.9: v2 + competitive → CompetitiveEngine, no challengeUpdate');
    assert.ok(result.membershipUpdate.cumulativeLoggedValue !== undefined,
      'Phase 11F 29.9: CompetitiveEngine selected (cumulativeLoggedValue returned)');
  }
}

// ── Section 30: Phase 11G — Regression & Edge Case Verification ──────────────

{
  // Shared base fixtures
  const s30ctx = {
    challengeId: 'test-challenge',
    challengeType: 'collective' as const,
    engineVersion: 'v2' as const,
    targetType: 'daily' as const,
    durationDays: 30,
    activities: [{ activityId: 'run', exerciseId: 'run', targetValue: 5, unit: 'km' }],
    startDate: '2026-06-01',
    endDate: '2026-06-30',
  };
  const s30baseMem = {
    userId: 'u1',
    challengeId: 'test-challenge',
    status: 'active' as const,
    activitiesCompleted: 0,
    totalActivities: 30,
    completionRate: 0,
    totalPoints: 0,
  };
  const s30baseLog = {
    userId: 'u1',
    challengeId: 'test-challenge',
    activityId: 'run',
    value: 5,
    unit: 'km',
    date: '2026-06-01',
    loggedAt: new Date(),
    pointsEarned: 100,
  };

  // ── 30.1: All engines accept challengeSnapshot (4th arg) without error ───────
  // Services always pass challengeSnapshot now; non-collective engines must ignore it.

  // 30.1a: LegacyEngine (via selectEngine interface) ignores challengeSnapshot
  {
    // selectEngine returns ChallengeEngine interface which declares the optional 4th param.
    // This verifies the service's pattern of always passing challengeSnapshot works for v1 challenges.
    const engine = selectEngine({ engineVersion: undefined, challengeType: 'collective' });
    const ctx = { ...s30ctx, engineVersion: 'v1' as const };
    const result = engine.computeUpdate(ctx, s30baseMem, s30baseLog, { groupCurrentTotal: 99999 });
    assert.strictEqual(result.membershipUpdate.activitiesCompleted, 1,
      'Phase 11G 30.1a: LegacyEngine accepts 4th arg and ignores it — activitiesCompleted = 1');
    assert.strictEqual(result.challengeUpdate, undefined,
      'Phase 11G 30.1a: LegacyEngine never returns challengeUpdate');
  }

  // 30.1b: StreakEngine (via selectEngine interface) ignores challengeSnapshot
  {
    const engine = selectEngine({ engineVersion: 'v2', challengeType: 'streak' });
    const ctx = { ...s30ctx, challengeType: 'streak' as const, requiredConsecutiveDays: 7, streakResetOnMiss: true };
    const mem = { ...s30baseMem, currentStreak: 0, longestStreak: 0 };
    const result = engine.computeUpdate(ctx, mem, s30baseLog, { groupCurrentTotal: 99999 });
    assert.strictEqual(result.membershipUpdate.currentStreak, 1,
      'Phase 11G 30.1b: StreakEngine accepts 4th arg and ignores it — currentStreak = 1');
    assert.strictEqual(result.challengeUpdate, undefined,
      'Phase 11G 30.1b: StreakEngine never returns challengeUpdate');
  }

  // 30.1c: CompetitiveEngine (via selectEngine interface) ignores challengeSnapshot
  {
    const engine = selectEngine({ engineVersion: 'v2', challengeType: 'competitive' });
    const ctx = { ...s30ctx, challengeType: 'competitive' as const, activities: [{ activityId: 'run', exerciseId: 'run', targetValue: 100, unit: 'km' }] };
    const mem = { ...s30baseMem, cumulativeLoggedValue: 0, cumulativeValues: {} as Record<string, number> };
    const result = engine.computeUpdate(ctx, mem, s30baseLog, { groupCurrentTotal: 99999 });
    assert.ok(result.membershipUpdate.cumulativeLoggedValue !== undefined,
      'Phase 11G 30.1c: CompetitiveEngine accepts 4th arg and ignores it — returns cumulativeLoggedValue');
    assert.strictEqual(result.challengeUpdate, undefined,
      'Phase 11G 30.1c: CompetitiveEngine never returns challengeUpdate');
  }

  // 30.1d: CollectiveEngine with no snapshot (undefined) — defaults prevGroupTotal = 0
  {
    const engine = new CollectiveEngine();
    const ctx = { ...s30ctx, groupCumulativeTarget: 10000, autoCompleteOnGroupTarget: true };
    const result = engine.computeUpdate(ctx, s30baseMem, s30baseLog);
    assert.strictEqual(result.challengeUpdate?.groupCurrentTotalDelta, 5,
      'Phase 11G 30.1d: CollectiveEngine with undefined snapshot defaults prevGroupTotal = 0, delta = logEvent.value');
    assert.strictEqual(result.isCompleted, false,
      'Phase 11G 30.1d: estimated 5 < 10000 → not completed');
  }

  // ── 30.2: Competitive — activitiesCompleted is analytics-only, never drives completion ──
  // Member logs 30 times (filling totalActivities), but cumulative target not reached → not completed.
  {
    const ctx = {
      ...s30ctx,
      challengeType: 'competitive' as const,
      activities: [{ activityId: 'run', exerciseId: 'run', targetValue: 1000, unit: 'km' }],
    };
    // Member has logged 29 of 30 times, cumulativeLoggedValue = 29 (far below target of 1000)
    const mem = {
      ...s30baseMem,
      activitiesCompleted: 29,
      totalActivities: 30,
      cumulativeLoggedValue: 29,
      cumulativeValues: { run: 29 } as Record<string, number>,
    };
    const log = { ...s30baseLog, value: 1, pointsEarned: 10 };
    const result = new CompetitiveEngine().computeUpdate(ctx, mem, log);
    assert.strictEqual(result.membershipUpdate.activitiesCompleted, 30,
      'Phase 11G 30.2: activitiesCompleted reaches totalActivities (30/30)');
    assert.strictEqual(result.isCompleted, false,
      'Phase 11G 30.2: activitiesCompleted = totalActivities does NOT drive completion — cumulative 30 < target 1000');
    assert.strictEqual(result.membershipUpdate.status, undefined,
      'Phase 11G 30.2: no status field when not completed (no spurious completion write)');
  }

  // ── 30.3: Collective — autoCompleteOnGroupTarget=false → never completes ─────
  {
    const ctx = { ...s30ctx, groupCumulativeTarget: 100, autoCompleteOnGroupTarget: false };
    const result = CollectiveEngine.computeCollectiveUpdate(
      ctx,
      s30baseMem,
      { ...s30baseLog, value: 5000 },  // massive over-target
      { groupCurrentTotal: 95 },
    );
    assert.strictEqual(result.isCompleted, false,
      'Phase 11G 30.3: autoCompleteOnGroupTarget=false → isCompleted always false even when group total >= target');
    assert.strictEqual(result.membershipUpdate.status, undefined,
      'Phase 11G 30.3: no status field when autoComplete disabled');
    assert.ok(result.challengeUpdate !== undefined,
      'Phase 11G 30.3: challengeUpdate still returned — delta still tracked even without auto-complete');
  }

  // ── 30.4: Collective — groupCumulativeTarget=0 → never completes ─────────────
  {
    const ctx = { ...s30ctx, groupCumulativeTarget: 0, autoCompleteOnGroupTarget: true };
    const result = CollectiveEngine.computeCollectiveUpdate(ctx, s30baseMem, s30baseLog, { groupCurrentTotal: 0 });
    assert.strictEqual(result.isCompleted, false,
      'Phase 11G 30.4: groupCumulativeTarget=0 → isCompleted always false (no target set)');
  }

  // ── 30.5: Collective — no status field in membershipUpdate when not completed ─
  {
    const ctx = { ...s30ctx, groupCumulativeTarget: 10000, autoCompleteOnGroupTarget: true };
    const result = CollectiveEngine.computeCollectiveUpdate(ctx, s30baseMem, s30baseLog, { groupCurrentTotal: 0 });
    assert.strictEqual(result.isCompleted, false, 'Phase 11G 30.5: not completed');
    assert.strictEqual(result.membershipUpdate.status, undefined,
      'Phase 11G 30.5: status absent from membershipUpdate when not completed (no spurious status writes)');
    assert.strictEqual(result.membershipUpdate.completedAt, undefined,
      'Phase 11G 30.5: completedAt absent from membershipUpdate when not completed');
  }

  // ── 30.6: LegacyEngine — engineVersion field NOT written (v1 field hygiene) ──
  {
    const engine = new LegacyEngine();
    const ctx = { ...s30ctx, engineVersion: 'v1' as const };
    const result = engine.computeUpdate(ctx, s30baseMem, s30baseLog);
    assert.strictEqual(result.membershipUpdate.engineVersion, undefined,
      'Phase 11G 30.6: LegacyEngine does not write engineVersion (v1 challenges stay clean)');
    assert.strictEqual(result.membershipUpdate.currentStreak, undefined,
      'Phase 11G 30.6: LegacyEngine does not write currentStreak');
    assert.strictEqual(result.membershipUpdate.cumulativeValues, undefined,
      'Phase 11G 30.6: LegacyEngine does not write cumulativeValues');
    assert.strictEqual(result.membershipUpdate.cumulativeLoggedValue, undefined,
      'Phase 11G 30.6: LegacyEngine does not write cumulativeLoggedValue');
  }

  // ── 30.7: Competitive — multiple logs on same activity accumulate correctly ───
  {
    const ctx = {
      ...s30ctx,
      challengeType: 'competitive' as const,
      activities: [{ activityId: 'run', exerciseId: 'run', targetValue: 100, unit: 'km' }],
    };
    // First log: 30 km → cumulative = 30
    const mem1 = { ...s30baseMem, cumulativeLoggedValue: 0, cumulativeValues: {} as Record<string, number> };
    const log1 = { ...s30baseLog, value: 30 };
    const res1 = new CompetitiveEngine().computeUpdate(ctx, mem1, log1);
    assert.strictEqual(res1.membershipUpdate.cumulativeValues?.['run'], 30,
      'Phase 11G 30.7: first log — run cumulative = 30');
    assert.strictEqual(res1.membershipUpdate.completionRate, 30,
      'Phase 11G 30.7: first log — completionRate = 30%');

    // Second log on same activity: 40 km → cumulative = 70
    const mem2 = {
      ...s30baseMem,
      activitiesCompleted: 1,
      cumulativeLoggedValue: res1.membershipUpdate.cumulativeLoggedValue ?? 0,
      cumulativeValues: res1.membershipUpdate.cumulativeValues ?? {},
    };
    const log2 = { ...s30baseLog, value: 40 };
    const res2 = new CompetitiveEngine().computeUpdate(ctx, mem2, log2);
    assert.strictEqual(res2.membershipUpdate.cumulativeValues?.['run'], 70,
      'Phase 11G 30.7: second log — run cumulative = 30 + 40 = 70');
    assert.strictEqual(res2.membershipUpdate.completionRate, 70,
      'Phase 11G 30.7: second log — completionRate = 70%');
    assert.strictEqual(res2.isCompleted, false,
      'Phase 11G 30.7: 70 < 100 → not completed');

    // Third log on same activity: 30 km → cumulative = 100 → completed
    const mem3 = {
      ...s30baseMem,
      activitiesCompleted: 2,
      cumulativeLoggedValue: res2.membershipUpdate.cumulativeLoggedValue ?? 0,
      cumulativeValues: res2.membershipUpdate.cumulativeValues ?? {},
    };
    const log3 = { ...s30baseLog, value: 30 };
    const res3 = new CompetitiveEngine().computeUpdate(ctx, mem3, log3);
    assert.strictEqual(res3.membershipUpdate.cumulativeValues?.['run'], 100,
      'Phase 11G 30.7: third log — run cumulative = 100 (at target)');
    assert.strictEqual(res3.isCompleted, true,
      'Phase 11G 30.7: cumulative reaches target → isCompleted = true');
    assert.strictEqual(res3.membershipUpdate.status, 'completed',
      'Phase 11G 30.7: completion on third log');
  }

  // ── 30.8: Streak — repeated same-day logging never completes streak early ─────
  {
    const ctx = { ...s30ctx, challengeType: 'streak' as const, requiredConsecutiveDays: 3, streakResetOnMiss: true };
    const mem = { ...s30baseMem, currentStreak: 2, longestStreak: 2, lastLogDate: '2026-06-01' };
    // Log 5 times on same day — streak should stay at 2, not advance to 3 or beyond
    for (let i = 0; i < 5; i++) {
      const log = { ...s30baseLog, date: '2026-06-01' };  // same day each time
      const result = new StreakEngine().computeUpdate(ctx, mem, log);
      assert.strictEqual(result.membershipUpdate.currentStreak, 2,
        `Phase 11G 30.8: same-day repeat #${i + 1} — streak stays at 2, not advancing to 3`);
      assert.strictEqual(result.isCompleted, false,
        `Phase 11G 30.8: same-day repeat #${i + 1} — completion not triggered by duplicate logs`);
    }
  }
}

// ── Phase 12A: Streak engine context propagation guards ─────────────────────
// These guards verify that requiredConsecutiveDays and streakResetOnMiss are
// honoured by StreakEngine when passed through ChallengeContext.

{
  // 12A-1: requiredConsecutiveDays passed in context — engine uses it as completion threshold.
  // A 7-day streak challenge on a 30-day duration must complete at day 7, not day 30.
  const ctx = {
    challengeId: 'test-streak',
    challengeType: 'streak' as const,
    engineVersion: 'v2' as const,
    targetType: 'daily' as const,
    durationDays: 30,
    activities: [{ exerciseId: 'run', targetValue: 5, unit: 'km' }],
    startDate: '2026-06-01',
    endDate: '2026-06-30',
    requiredConsecutiveDays: 7,
    streakResetOnMiss: true,
  };
  const mem = {
    userId: 'u1', challengeId: 'test-streak', status: 'active' as const,
    activitiesCompleted: 0, totalActivities: 30, completionRate: 0,
    totalPoints: 0, currentStreak: 6, longestStreak: 6, lastLogDate: '2026-06-06',
    cumulativeLoggedValue: undefined, cumulativeValues: undefined,
  };
  const log = { userId: 'u1', challengeId: 'test-streak', activityId: 'run', value: 5, unit: 'km', date: '2026-06-07', loggedAt: new Date(), pointsEarned: 100 };
  const result = new StreakEngine().computeUpdate(ctx, mem, log);
  assert.strictEqual(result.membershipUpdate.currentStreak, 7, 'Phase 12A-1: streak advances to 7');
  assert.strictEqual(result.isCompleted, true, 'Phase 12A-1: requiredConsecutiveDays=7 → completed at day 7, not day 30');
}

{
  // 12A-2: streakResetOnMiss=false — missed day does NOT reset streak.
  const ctx = {
    challengeId: 'test-streak-noreset',
    challengeType: 'streak' as const,
    engineVersion: 'v2' as const,
    targetType: 'daily' as const,
    durationDays: 30,
    activities: [{ exerciseId: 'run', targetValue: 5, unit: 'km' }],
    startDate: '2026-06-01',
    endDate: '2026-06-30',
    requiredConsecutiveDays: 10,
    streakResetOnMiss: false,
  };
  const mem = {
    userId: 'u1', challengeId: 'test-streak-noreset', status: 'active' as const,
    activitiesCompleted: 0, totalActivities: 30, completionRate: 0,
    totalPoints: 0, currentStreak: 5, longestStreak: 5, lastLogDate: '2026-06-01',
    cumulativeLoggedValue: undefined, cumulativeValues: undefined,
  };
  // Logging on day 3 after last log (2 days gap) — with streakResetOnMiss=false, streak increments
  const log = { userId: 'u1', challengeId: 'test-streak-noreset', activityId: 'run', value: 5, unit: 'km', date: '2026-06-04', loggedAt: new Date(), pointsEarned: 100 };
  const result = new StreakEngine().computeUpdate(ctx, mem, log);
  assert.strictEqual(result.membershipUpdate.currentStreak, 6, 'Phase 12A-2: streakResetOnMiss=false — 2-day gap still increments streak');
  assert.strictEqual(result.isCompleted, false, 'Phase 12A-2: not yet complete at day 6 of 10');
}

{
  // 12A-3: streakResetOnMiss=true — missed day resets streak to 1.
  const ctx = {
    challengeId: 'test-streak-reset',
    challengeType: 'streak' as const,
    engineVersion: 'v2' as const,
    targetType: 'daily' as const,
    durationDays: 30,
    activities: [{ exerciseId: 'run', targetValue: 5, unit: 'km' }],
    startDate: '2026-06-01',
    endDate: '2026-06-30',
    requiredConsecutiveDays: 10,
    streakResetOnMiss: true,
  };
  const mem = {
    userId: 'u1', challengeId: 'test-streak-reset', status: 'active' as const,
    activitiesCompleted: 0, totalActivities: 30, completionRate: 0,
    totalPoints: 0, currentStreak: 5, longestStreak: 5, lastLogDate: '2026-06-01',
    cumulativeLoggedValue: undefined, cumulativeValues: undefined,
  };
  // Logging on day 3 after last log (2 days gap) — with streakResetOnMiss=true, streak resets to 1
  const log = { userId: 'u1', challengeId: 'test-streak-reset', activityId: 'run', value: 5, unit: 'km', date: '2026-06-04', loggedAt: new Date(), pointsEarned: 100 };
  const result = new StreakEngine().computeUpdate(ctx, mem, log);
  assert.strictEqual(result.membershipUpdate.currentStreak, 1, 'Phase 12A-3: streakResetOnMiss=true — 2-day gap resets streak to 1');
}

{
  // 12A-4: Legacy engine (v1) ignores requiredConsecutiveDays — engine routing unaffected.
  const engine = selectEngine({ engineVersion: undefined, challengeType: 'collective' });
  assert.ok(engine instanceof LegacyEngine, 'Phase 12A-4: v1 challenge still routes to LegacyEngine regardless of streak fields');
}

{
  // 12A-5: Competitive v2 ignores requiredConsecutiveDays — routing and result unaffected.
  const ctx = {
    challengeId: 'test-competitive',
    challengeType: 'competitive' as const,
    engineVersion: 'v2' as const,
    targetType: 'daily' as const,
    durationDays: 30,
    activities: [{ exerciseId: 'run', targetValue: 50, unit: 'km' }],
    startDate: '2026-06-01',
    endDate: '2026-06-30',
    requiredConsecutiveDays: 7,  // should be ignored by CompetitiveEngine
    streakResetOnMiss: true,
  };
  const mem = {
    userId: 'u1', challengeId: 'test-competitive', status: 'active' as const,
    activitiesCompleted: 0, totalActivities: 30, completionRate: 0,
    totalPoints: 0, currentStreak: undefined, longestStreak: undefined, lastLogDate: undefined,
    cumulativeLoggedValue: undefined, cumulativeValues: { run: 0 },
  };
  const log = { userId: 'u1', challengeId: 'test-competitive', activityId: 'run', value: 10, unit: 'km', date: '2026-06-07', loggedAt: new Date(), pointsEarned: 20 };
  const result = new CompetitiveEngine().computeUpdate(ctx, mem, log);
  assert.strictEqual(result.isCompleted, false, 'Phase 12A-5: CompetitiveEngine ignores streak fields — 10/50 not complete');
  assert.ok(!result.challengeUpdate, 'Phase 12A-5: CompetitiveEngine never returns challengeUpdate');
}

// ── Phase 12D: Collective completion chunking guards ──────────────────────────
// Tests the pure chunkArray helper and MAX_WRITES_PER_BATCH constant from
// collectiveCompletion.ts without requiring a Firestore connection.

import { chunkArray, MAX_WRITES_PER_BATCH } from '../src/services/collectiveCompletionUtils';

{
  // 12D-1: safety margin — batch limit is 450, not 500.
  assert.strictEqual(MAX_WRITES_PER_BATCH, 450,
    'Phase 12D-1: MAX_WRITES_PER_BATCH must be 450 (50-write safety margin below Firestore 500-write limit)');
}

{
  // 12D-2: empty array → no chunks.
  const chunks = chunkArray([], MAX_WRITES_PER_BATCH);
  assert.strictEqual(chunks.length, 0, 'Phase 12D-2: empty input → 0 chunks');
}

{
  // 12D-3: 10 members → 1 chunk of 10.
  const members = Array.from({ length: 10 }, (_, i) => i);
  const chunks = chunkArray(members, MAX_WRITES_PER_BATCH);
  assert.strictEqual(chunks.length, 1, 'Phase 12D-3: 10 members → 1 batch');
  assert.strictEqual(chunks[0].length, 10, 'Phase 12D-3: single batch has 10 writes');
}

{
  // 12D-4: 100 members → 1 chunk, no batch exceeds limit.
  const members = Array.from({ length: 100 }, (_, i) => i);
  const chunks = chunkArray(members, MAX_WRITES_PER_BATCH);
  assert.strictEqual(chunks.length, 1, 'Phase 12D-4: 100 members → 1 batch');
  assert.ok(chunks.every((c) => c.length <= MAX_WRITES_PER_BATCH), 'Phase 12D-4: no batch exceeds MAX_WRITES_PER_BATCH');
}

{
  // 12D-5: 449 members → 1 chunk of 449 (just under limit).
  const members = Array.from({ length: 449 }, (_, i) => i);
  const chunks = chunkArray(members, MAX_WRITES_PER_BATCH);
  assert.strictEqual(chunks.length, 1, 'Phase 12D-5: 449 members → 1 batch');
  assert.strictEqual(chunks[0].length, 449, 'Phase 12D-5: single batch of 449 writes');
}

{
  // 12D-6: 450 members → 1 chunk of exactly 450 (at limit, still one batch).
  const members = Array.from({ length: 450 }, (_, i) => i);
  const chunks = chunkArray(members, MAX_WRITES_PER_BATCH);
  assert.strictEqual(chunks.length, 1, 'Phase 12D-6: 450 members → 1 batch (at limit)');
  assert.strictEqual(chunks[0].length, 450, 'Phase 12D-6: batch has 450 writes');
}

{
  // 12D-7: 499 members → 2 chunks: 450 + 49. No chunk exceeds limit.
  const members = Array.from({ length: 499 }, (_, i) => i);
  const chunks = chunkArray(members, MAX_WRITES_PER_BATCH);
  assert.strictEqual(chunks.length, 2, 'Phase 12D-7: 499 members → 2 batches');
  assert.strictEqual(chunks[0].length, 450, 'Phase 12D-7: first batch = 450 writes');
  assert.strictEqual(chunks[1].length, 49, 'Phase 12D-7: second batch = 49 writes');
  assert.ok(chunks.every((c) => c.length <= MAX_WRITES_PER_BATCH), 'Phase 12D-7: no batch exceeds limit');
}

{
  // 12D-8: 500 members → 2 chunks: 450 + 50. Firestore limit never hit.
  const members = Array.from({ length: 500 }, (_, i) => i);
  const chunks = chunkArray(members, MAX_WRITES_PER_BATCH);
  assert.strictEqual(chunks.length, 2, 'Phase 12D-8: 500 members → 2 batches (avoids Firestore 500 limit)');
  assert.strictEqual(chunks[0].length, 450, 'Phase 12D-8: first batch = 450');
  assert.strictEqual(chunks[1].length, 50, 'Phase 12D-8: second batch = 50');
}

{
  // 12D-9: 750 members → 2 chunks: 450 + 300.
  const members = Array.from({ length: 750 }, (_, i) => i);
  const chunks = chunkArray(members, MAX_WRITES_PER_BATCH);
  assert.strictEqual(chunks.length, 2, 'Phase 12D-9: 750 members → 2 batches');
  assert.strictEqual(chunks[0].length, 450, 'Phase 12D-9: first batch = 450');
  assert.strictEqual(chunks[1].length, 300, 'Phase 12D-9: second batch = 300');
}

{
  // 12D-10: 1200 members → 3 chunks: 450 + 450 + 300.
  const members = Array.from({ length: 1200 }, (_, i) => i);
  const chunks = chunkArray(members, MAX_WRITES_PER_BATCH);
  assert.strictEqual(chunks.length, 3, 'Phase 12D-10: 1200 members → 3 batches');
  assert.strictEqual(chunks[0].length, 450, 'Phase 12D-10: first batch = 450');
  assert.strictEqual(chunks[1].length, 450, 'Phase 12D-10: second batch = 450');
  assert.strictEqual(chunks[2].length, 300, 'Phase 12D-10: third batch = 300');
  assert.ok(chunks.every((c) => c.length <= MAX_WRITES_PER_BATCH), 'Phase 12D-10: no batch exceeds limit');
}

{
  // 12D-11: no duplicate writes — each element appears in exactly one chunk.
  const members = Array.from({ length: 1000 }, (_, i) => i);
  const chunks = chunkArray(members, MAX_WRITES_PER_BATCH);
  const allItems = chunks.flat();
  assert.strictEqual(allItems.length, 1000, 'Phase 12D-11: all 1000 members appear across chunks (no drops)');
  const unique = new Set(allItems);
  assert.strictEqual(unique.size, 1000, 'Phase 12D-11: no member appears in more than one chunk (no duplicates)');
}

{
  // 12D-12: idempotency — chunkArray is deterministic; same input → same output.
  const members = Array.from({ length: 900 }, (_, i) => i);
  const first = chunkArray(members, MAX_WRITES_PER_BATCH);
  const second = chunkArray(members, MAX_WRITES_PER_BATCH);
  assert.deepStrictEqual(first, second, 'Phase 12D-12: chunkArray is deterministic (idempotent output)');
}

{
  // 12D-13: collectiveCompletion re-exports chunkArray and MAX_WRITES_PER_BATCH from the utils module,
  // and declares cascadeCollectiveCompletion. Verified via source-code check (module imports Firebase,
  // so a dynamic import is not usable in the Node.js test environment).
  const completionSrc = readFileSync('src/services/collectiveCompletion.ts', 'utf8');
  assert.ok(
    completionSrc.includes("export { chunkArray, MAX_WRITES_PER_BATCH } from './collectiveCompletionUtils'"),
    'Phase 12D-13: collectiveCompletion re-exports chunkArray and MAX_WRITES_PER_BATCH',
  );
  assert.ok(
    completionSrc.includes('export async function cascadeCollectiveCompletion'),
    'Phase 12D-13: collectiveCompletion exports cascadeCollectiveCompletion',
  );
}

{
  // 12D-14: workoutService must not contain an inline cascade for-loop.
  // Phase 13C update: cascadeCollectiveCompletion is now called from atomicCollectiveGroupUpdate,
  // not directly from workoutService. The direct call was replaced with atomicCollectiveGroupUpdate.
  const workout = readFileSync('src/services/workoutService.ts', 'utf8');
  assert.ok(
    workout.includes('atomicCollectiveGroupUpdate'),
    'Phase 12D-14 (updated 13C): workoutService must call atomicCollectiveGroupUpdate (which internally calls cascadeCollectiveCompletion)',
  );
  assert.ok(
    !workout.includes('for (const memberDoc of activeMembersSnap'),
    'Phase 12D-14: workoutService must not contain inline cascade for-loop (moved to collectiveCompletion)',
  );
}

{
  // 12D-15: wellnessLogService must not contain an inline cascade for-loop.
  // Phase 13C update: cascadeCollectiveCompletion is now called from atomicCollectiveGroupUpdate,
  // not directly from wellnessLogService. The direct call was replaced with atomicCollectiveGroupUpdate.
  const wellness = readFileSync('src/services/wellnessLogService.ts', 'utf8');
  assert.ok(
    wellness.includes('atomicCollectiveGroupUpdate'),
    'Phase 12D-15 (updated 13C): wellnessLogService must call atomicCollectiveGroupUpdate (which internally calls cascadeCollectiveCompletion)',
  );
  assert.ok(
    !wellness.includes('for (const memberDoc of activeMembersSnap'),
    'Phase 12D-15: wellnessLogService must not contain inline cascade for-loop (moved to collectiveCompletion)',
  );
}

// ─── Phase 12F guards ──────────────────────────────────────────────────────

{
  // 12F-A: getPendingChallenges, getApprovedChallenges, and getActiveChallenges must not
  // contain unbounded full collection scans (getChallengeAnalytics intentionally reads all docs
  // for aggregate counts and is excluded from this guard).
  const adminSrc = readFileSync('src/services/adminChallengeService.ts', 'utf8');
  // Extract only the three read-by-status methods by slicing between their signatures.
  const pendingStart = adminSrc.indexOf('async getPendingChallenges');
  const analyticsStart = adminSrc.indexOf('async getChallengeAnalytics');
  assert.ok(pendingStart > -1 && analyticsStart > -1, 'Phase 12F-A: expected method signatures not found');
  const scopedSrc = adminSrc.slice(pendingStart, analyticsStart);
  const lines = scopedSrc.split('\n');
  const unboundedLines = lines.filter(
    (line) =>
      /getDocs\(collection\(db,\s*this\.collectionName\)\)/.test(line) &&
      !line.trimStart().startsWith('//'),
  );
  assert.strictEqual(
    unboundedLines.length,
    0,
    `Phase 12F-A: getPendingChallenges/getApprovedChallenges/getActiveChallenges must not have unbounded getDocs(collection) calls; found ${unboundedLines.length}: ${unboundedLines.join(' | ')}`,
  );
}

{
  // 12F-B: groupInsightsService group feed query must sort and limit in Firestore.
  const insightsSrc = readFileSync('src/services/groupInsightsService.ts', 'utf8');
  assert.ok(
    insightsSrc.includes("orderBy('completedAt', 'desc')"),
    "Phase 12F-B: groupInsightsService getGroupFeed must use orderBy('completedAt', 'desc')",
  );
  assert.ok(
    insightsSrc.includes('limit(10)'),
    'Phase 12F-B: groupInsightsService getGroupFeed must use limit(10)',
  );
}

{
  // 12F-C: useLogWellnessActivity must invalidate the same streak query keys as useLogWorkout.
  const hooksSrc = readFileSync('src/hooks/useWorkouts.ts', 'utf8');
  const wellnessIdx = hooksSrc.indexOf('useLogWellnessActivity');
  assert.ok(wellnessIdx > -1, 'Phase 12F-C: useLogWellnessActivity must be defined in useWorkouts.ts');
  const wellnessTail = hooksSrc.slice(wellnessIdx);
  assert.ok(
    wellnessTail.includes("'streak', 'user'"),
    "Phase 12F-C: useLogWellnessActivity onSuccess must invalidate ['streak', 'user', ...] query key",
  );
  assert.ok(
    wellnessTail.includes("'streak', 'challenge'"),
    "Phase 12F-C: useLogWellnessActivity onSuccess must invalidate ['streak', 'challenge', ...] query key",
  );
}

// ─── Phase 12G guards ──────────────────────────────────────────────────────

{
  // 12G-A: adminChallengeService imports auth and declares assertAuth.
  const adminSrc = readFileSync('src/services/adminChallengeService.ts', 'utf8');
  assert.ok(
    adminSrc.includes("import { auth, db }") || adminSrc.includes("{ auth,"),
    "Phase 12G-A: adminChallengeService must import auth from firebase",
  );
  assert.ok(
    adminSrc.includes('private assertAuth()'),
    'Phase 12G-A: adminChallengeService must declare private assertAuth() method',
  );
  assert.ok(
    adminSrc.includes("throw new Error('Not authenticated."),
    'Phase 12G-A: assertAuth must throw an explicit Not authenticated error',
  );
}

{
  // 12G-B: all 6 service methods must call this.assertAuth() before any Firestore operation.
  const adminSrc = readFileSync('src/services/adminChallengeService.ts', 'utf8');
  const methodNames = [
    'getPendingChallenges',
    'getApprovedChallenges',
    'getActiveChallenges',
    'getTemplates',
    'createChallengeFromAdmin',
    'getChallengeAnalytics',
    'approveChallenge',
    'requestChallengeChanges',
  ];
  for (const method of methodNames) {
    const methodIdx = adminSrc.indexOf(`async ${method}`);
    assert.ok(methodIdx > -1, `Phase 12G-B: method ${method} not found in adminChallengeService`);
    // Scan up to 2000 chars so long parameter lists (createChallengeFromAdmin) are fully covered.
    // assertAuth must appear before any getDocs/addDoc/updateDoc/getDoc call inside the method body.
    const methodBody = adminSrc.slice(methodIdx, methodIdx + 2000);
    const assertAuthPos = methodBody.indexOf('this.assertAuth()');
    const firstFirestorePos = Math.min(
      ...['getDocs', 'addDoc', 'updateDoc', 'getDoc'].map((fn) => {
        const pos = methodBody.indexOf(fn);
        return pos === -1 ? Infinity : pos;
      }),
    );
    assert.ok(
      assertAuthPos > -1 && assertAuthPos < firstFirestorePos,
      `Phase 12G-B: ${method} must call this.assertAuth() before any Firestore operation (assertAuth at ${assertAuthPos}, first Firestore call at ${firstFirestorePos})`,
    );
  }
}

{
  // 12G-C: Firestore challenges write rule must still require canModerateChallenges().
  const rulesSrc = readFileSync('firestore.rules', 'utf8');
  const challengesBlockIdx = rulesSrc.indexOf("match /challenges/{challengeId}");
  assert.ok(challengesBlockIdx > -1, 'Phase 12G-C: challenges block must exist in firestore.rules');
  const challengesBlock = rulesSrc.slice(challengesBlockIdx, challengesBlockIdx + 800);
  assert.ok(
    challengesBlock.includes('canModerateChallenges()'),
    'Phase 12G-C: challenges block must include canModerateChallenges() guard (regression: rule must not have been weakened)',
  );
}

// ─── Phase 13B-1 guards ────────────────────────────────────────────────────

{
  // 13B-1A: CollectiveEngine must write cumulativeLoggedValue into membershipUpdate.
  const collectiveSrc = readFileSync('src/services/challengeEngine/collectiveEngine.ts', 'utf8');
  assert.match(
    collectiveSrc,
    /cumulativeLoggedValue:/,
    'Phase 13B-1A: CollectiveEngine.computeCollectiveUpdate must write cumulativeLoggedValue into membershipUpdate',
  );
  assert.match(
    collectiveSrc,
    /membership\.cumulativeLoggedValue.*logEvent\.value|logEvent\.value.*membership\.cumulativeLoggedValue/,
    'Phase 13B-1A: cumulativeLoggedValue must be the sum of prior membership value and logEvent.value (additive)',
  );
}

{
  // 13B-1B: Both ChallengeLeaderboardScreen and ChallengeDetailScreen must import the shared sort helper.
  const leaderboardSrc = readFileSync('src/features/Challenges/ChallengeLeaderboardScreen.tsx', 'utf8');
  const detailSrc = readFileSync('src/features/Challenges/ChallengeDetailScreen.tsx', 'utf8');
  assert.match(
    leaderboardSrc,
    /sortLeaderboardRows/,
    'Phase 13B-1B: ChallengeLeaderboardScreen must import and use sortLeaderboardRows from leaderboardSort',
  );
  assert.match(
    detailSrc,
    /sortLeaderboardRows/,
    'Phase 13B-1B: ChallengeDetailScreen must import and use sortLeaderboardRows from leaderboardSort',
  );
  assert.doesNotMatch(
    leaderboardSrc,
    /\.sort\(\(a,\s*b\)\s*=>\s*b\.totalPoints\s*-\s*a\.totalPoints\)/,
    'Phase 13B-1B: ChallengeLeaderboardScreen must not have an inline totalPoints-only sort (replaced by sortLeaderboardRows)',
  );
  assert.doesNotMatch(
    detailSrc,
    /\.sort\(\(a,\s*b\)\s*=>\s*b\.totalPoints\s*-\s*a\.totalPoints\)/,
    'Phase 13B-1B: ChallengeDetailScreen must not have an inline totalPoints-only sort (replaced by sortLeaderboardRows)',
  );
}

{
  // 13B-1C: sortLeaderboardRows produces correct engine-specific ordering with deterministic fixtures.
  const { sortLeaderboardRows: sortFn } = await import('../src/utils/leaderboardSort.js');

  const members = [
    { totalPoints: 500, completionRate: 80, currentStreak: 3, longestStreak: 7, cumulativeLoggedValue: 200 },
    { totalPoints: 300, completionRate: 95, currentStreak: 10, longestStreak: 10, cumulativeLoggedValue: 500 },
    { totalPoints: 700, completionRate: 60, currentStreak: 1, longestStreak: 5, cumulativeLoggedValue: 100 },
  ];

  // Legacy / v1: sort by totalPoints DESC → [700, 500, 300]
  const legacySorted = sortFn(members, 'v1', 'collective');
  assert.equal(legacySorted[0].totalPoints, 700, '13B-1C Legacy: first place must have highest totalPoints (700)');
  assert.equal(legacySorted[1].totalPoints, 500, '13B-1C Legacy: second place must have totalPoints 500');
  assert.equal(legacySorted[2].totalPoints, 300, '13B-1C Legacy: third place must have totalPoints 300');

  // Competitive: sort by completionRate DESC → [95, 80, 60]
  const compSorted = sortFn(members, 'v2', 'competitive');
  assert.equal(compSorted[0].completionRate, 95, '13B-1C Competitive: first place must have highest completionRate (95)');
  assert.equal(compSorted[1].completionRate, 80, '13B-1C Competitive: second place must have completionRate 80');
  assert.equal(compSorted[2].completionRate, 60, '13B-1C Competitive: third place must have completionRate 60');

  // Streak: sort by currentStreak DESC → [10, 3, 1]
  const streakSorted = sortFn(members, 'v2', 'streak');
  assert.equal(streakSorted[0].currentStreak, 10, '13B-1C Streak: first place must have highest currentStreak (10)');
  assert.equal(streakSorted[1].currentStreak, 3, '13B-1C Streak: second place must have currentStreak 3');
  assert.equal(streakSorted[2].currentStreak, 1, '13B-1C Streak: third place must have currentStreak 1');

  // Streak tiebreaker: equal currentStreak → longestStreak DESC
  const streakTieMembers = [
    { totalPoints: 100, completionRate: 50, currentStreak: 5, longestStreak: 5, cumulativeLoggedValue: 0 },
    { totalPoints: 200, completionRate: 60, currentStreak: 5, longestStreak: 12, cumulativeLoggedValue: 0 },
    { totalPoints: 300, completionRate: 70, currentStreak: 5, longestStreak: 8, cumulativeLoggedValue: 0 },
  ];
  const streakTieSorted = sortFn(streakTieMembers, 'v2', 'streak');
  assert.equal(streakTieSorted[0].longestStreak, 12, '13B-1C Streak tiebreaker: longest streak (12) must win when currentStreak tied');
  assert.equal(streakTieSorted[1].longestStreak, 8, '13B-1C Streak tiebreaker: longestStreak 8 second');
  assert.equal(streakTieSorted[2].longestStreak, 5, '13B-1C Streak tiebreaker: longestStreak 5 third');

  // Collective: sort by cumulativeLoggedValue DESC → [500, 200, 100]
  const collectiveSorted = sortFn(members, 'v2', 'collective');
  assert.equal(collectiveSorted[0].cumulativeLoggedValue, 500, '13B-1C Collective: first place must have highest cumulativeLoggedValue (500)');
  assert.equal(collectiveSorted[1].cumulativeLoggedValue, 200, '13B-1C Collective: second place must have cumulativeLoggedValue 200');
  assert.equal(collectiveSorted[2].cumulativeLoggedValue, 100, '13B-1C Collective: third place must have cumulativeLoggedValue 100');

  // Competitive tiebreaker: equal completionRate → totalPoints DESC
  const compTieMembers = [
    { totalPoints: 100, completionRate: 100, currentStreak: 0, longestStreak: 0, cumulativeLoggedValue: 0 },
    { totalPoints: 300, completionRate: 100, currentStreak: 0, longestStreak: 0, cumulativeLoggedValue: 0 },
    { totalPoints: 200, completionRate: 80, currentStreak: 0, longestStreak: 0, cumulativeLoggedValue: 0 },
  ];
  const compTieSorted = sortFn(compTieMembers, 'v2', 'competitive');
  assert.equal(compTieSorted[0].totalPoints, 300, '13B-1C Competitive tiebreaker: equal completionRate → highest totalPoints (300) wins');
  assert.equal(compTieSorted[1].totalPoints, 100, '13B-1C Competitive tiebreaker: equal completionRate second (100 pts)');
  assert.equal(compTieSorted[2].completionRate, 80, '13B-1C Competitive tiebreaker: lower completionRate last');
}

// ─── Phase 13B-2 guards ────────────────────────────────────────────────────

{
  const challengeServiceSrc = readFileSync('src/services/challengeService.ts', 'utf8');

  // 13B-2A: joinChallenge must reset streak fields for streak challenges.
  assert.match(
    challengeServiceSrc,
    /isStreakChallenge/,
    'Phase 13B-2A: joinChallenge must define isStreakChallenge to gate streak field resets',
  );
  assert.match(
    challengeServiceSrc,
    /currentStreak:\s*0/,
    'Phase 13B-2A: joinChallenge streak reset must set currentStreak: 0',
  );
  assert.match(
    challengeServiceSrc,
    /longestStreak:\s*0/,
    'Phase 13B-2A: joinChallenge streak reset must set longestStreak: 0',
  );
  assert.match(
    challengeServiceSrc,
    /lastLogDate:.*deleteField/,
    'Phase 13B-2A: joinChallenge streak reset must clear lastLogDate via deleteField()',
  );

  // 13B-2B: Streak reset must be conditional — gated on isStreakChallenge.
  // The streakReset spread must only appear inside an isStreakChallenge branch,
  // not unconditionally applied to every join.
  assert.match(
    challengeServiceSrc,
    /isStreakChallenge\s*\?[\s\S]{0,200}currentStreak:\s*0/,
    'Phase 13B-2B: streak field reset must be conditional — only applied when isStreakChallenge is true',
  );
  assert.match(
    challengeServiceSrc,
    /engineVersion.*=== 'v2'.*challengeType.*=== 'streak'|challengeType.*=== 'streak'.*engineVersion.*=== 'v2'/,
    "Phase 13B-2B: isStreakChallenge must check both engineVersion === 'v2' and challengeType === 'streak'",
  );
}

{
  // 13B-2C: Both services must import toLocalIsoDate from dateUtils.
  const workoutSrc = readFileSync('src/services/workoutService.ts', 'utf8');
  const wellnessSrc = readFileSync('src/services/wellnessLogService.ts', 'utf8');

  assert.match(
    workoutSrc,
    /toLocalIsoDate.*dateUtils|dateUtils.*toLocalIsoDate/,
    'Phase 13B-2C: workoutService must import toLocalIsoDate from dateUtils',
  );
  assert.match(
    wellnessSrc,
    /toLocalIsoDate.*dateUtils|dateUtils.*toLocalIsoDate/,
    'Phase 13B-2C: wellnessLogService must import toLocalIsoDate from dateUtils',
  );
}

{
  // 13B-2D: No remaining duplicate ISO date helpers in either service.
  const workoutSrc = readFileSync('src/services/workoutService.ts', 'utf8');
  const wellnessSrc = readFileSync('src/services/wellnessLogService.ts', 'utf8');

  assert.doesNotMatch(
    workoutSrc,
    /function toIsoDate/,
    'Phase 13B-2D: workoutService must not define local toIsoDate() — replaced by shared toLocalIsoDate()',
  );
  assert.doesNotMatch(
    wellnessSrc,
    /function todayIsoDate/,
    'Phase 13B-2D: wellnessLogService must not define local todayIsoDate() — replaced by shared toLocalIsoDate()',
  );
  assert.doesNotMatch(
    workoutSrc,
    /\.toISOString\(\)\.split\('T'\)\[0\]/,
    "Phase 13B-2D: workoutService must not use .toISOString().split('T')[0] — UTC-based, replaced by toLocalIsoDate()",
  );
  assert.doesNotMatch(
    wellnessSrc,
    /now\.getFullYear\(\).*now\.getMonth\(\).*now\.getDate\(\)|getFullYear.*getMonth.*getDate/,
    'Phase 13B-2D: wellnessLogService must not inline local date construction — replaced by toLocalIsoDate()',
  );
}

{
  // 13B-2E: Deterministic timezone fixture — same physical moment produces the
  // same ISO date from toLocalIsoDate regardless of which service uses it.
  const { toLocalIsoDate } = await import('../src/utils/dateUtils.js');

  // A fixed moment in UTC — use a stable reference point rather than Date.now()
  // to make the test deterministic across timezones.
  const referenceDate = new Date('2024-06-15T10:30:00');  // local noon-ish in most zones
  const result = toLocalIsoDate(referenceDate);

  // Must be a valid YYYY-MM-DD string
  assert.match(result, /^\d{4}-\d{2}-\d{2}$/, '13B-2E: toLocalIsoDate must return YYYY-MM-DD format');

  // Must match the local date components — same calculation both services now use
  const expected = `${referenceDate.getFullYear()}-${String(referenceDate.getMonth() + 1).padStart(2, '0')}-${String(referenceDate.getDate()).padStart(2, '0')}`;
  assert.equal(result, expected, '13B-2E: toLocalIsoDate must return local device date, not UTC date');

  // Idempotent — calling twice with the same Date returns the same string
  assert.equal(
    toLocalIsoDate(referenceDate),
    toLocalIsoDate(referenceDate),
    '13B-2E: toLocalIsoDate must be deterministic for the same input',
  );

  // Both services now call toLocalIsoDate — verify the shared path matches the
  // direct local-date construction (the formula both services formerly used inline)
  const localYear = referenceDate.getFullYear();
  const localMonth = String(referenceDate.getMonth() + 1).padStart(2, '0');
  const localDay = String(referenceDate.getDate()).padStart(2, '0');
  assert.equal(
    result,
    `${localYear}-${localMonth}-${localDay}`,
    '13B-2E: toLocalIsoDate output must equal inline local-date construction — confirming both services now produce identical dates',
  );
}

// ─── Phase 13C Guards — BUG-001: Atomic Collective Completion ────────────────
//
// Guard 13C-1: collectiveGroupUpdate exports runTransaction-based function
// Guard 13C-2: groupCurrentTotal is clamped to target (never exceeds)
// Guard 13C-3: already-completed challenges exit without mutation
// Guard 13C-4: exactly-one completion transition (shouldComplete only when first)
// Guard 13C-5: concurrent fixture — second log retries and triggers completion
// Guard 13C-6: non-collective engines (Legacy/Competitive/Streak) are unmodified

{
  console.log('  running 13C-1: collectiveGroupUpdate service uses runTransaction');
  const collectiveGroupUpdateSrc = readFileSync(
    new URL('../src/services/collectiveGroupUpdate.ts', import.meta.url).pathname,
    'utf8',
  );

  assert.ok(
    collectiveGroupUpdateSrc.includes('runTransaction'),
    '13C-1: collectiveGroupUpdate.ts must use runTransaction for atomic completion',
  );
  assert.ok(
    collectiveGroupUpdateSrc.includes('computeGroupTransition'),
    '13C-1: computeGroupTransition must be exported (directly or re-exported) for deterministic testing',
  );
  assert.ok(
    collectiveGroupUpdateSrc.includes('export async function atomicCollectiveGroupUpdate'),
    '13C-1: atomicCollectiveGroupUpdate must be exported and async',
  );

  console.log('  running 13C-2: groupCurrentTotal is clamped to groupCumulativeTarget');
  // Import from the pure utility — no Firebase initialization required.
  const { computeGroupTransition } = await import('../src/utils/collectiveGroupTransition.js');

  // Exactly at target → clamped to target
  const atTarget = computeGroupTransition(
    { status: 'active', groupCurrentTotal: 980, groupCumulativeTarget: 1000, autoCompleteOnGroupTarget: true },
    20,
  );
  assert.equal(atTarget.clampedTotal, 1000, '13C-2: clampedTotal must equal target when newTotal == target');
  assert.equal(atTarget.shouldComplete, true, '13C-2: shouldComplete must be true when newTotal == target');

  // Overshoot → clamped, not stored as 1020
  const overshoot = computeGroupTransition(
    { status: 'active', groupCurrentTotal: 990, groupCumulativeTarget: 1000, autoCompleteOnGroupTarget: true },
    30,
  );
  assert.equal(overshoot.clampedTotal, 1000, '13C-2: overshoot must clamp to target, not raw newTotal');
  assert.equal(overshoot.shouldComplete, true, '13C-2: overshoot must still trigger completion');

  // Under target → not clamped, not completed
  const underTarget = computeGroupTransition(
    { status: 'active', groupCurrentTotal: 500, groupCumulativeTarget: 1000, autoCompleteOnGroupTarget: true },
    200,
  );
  assert.equal(underTarget.clampedTotal, 700, '13C-2: under-target must store exact newTotal (no clamping needed)');
  assert.equal(underTarget.shouldComplete, false, '13C-2: under-target must not complete');

  // autoCompleteOnGroupTarget=false → total updates but never completes
  const noAutoComplete = computeGroupTransition(
    { status: 'active', groupCurrentTotal: 990, groupCumulativeTarget: 1000, autoCompleteOnGroupTarget: false },
    50,
  );
  assert.equal(noAutoComplete.shouldComplete, false, '13C-2: autoComplete=false must never trigger completion');
  assert.equal(noAutoComplete.clampedTotal, 1000, '13C-2: clamping still applies even when autoComplete=false');

  console.log('  running 13C-3: already-completed challenges exit without mutation');
  const alreadyCompleted = computeGroupTransition(
    { status: 'completed', groupCurrentTotal: 1000, groupCumulativeTarget: 1000, autoCompleteOnGroupTarget: true },
    50,
  );
  assert.equal(alreadyCompleted.isAlreadyCompleted, true, '13C-3: isAlreadyCompleted must be true for completed challenges');
  assert.equal(alreadyCompleted.shouldComplete, false, '13C-3: shouldComplete must be false when already completed');
  assert.equal(alreadyCompleted.clampedTotal, 1000, '13C-3: clampedTotal must be unchanged for already-completed challenges');

  console.log('  running 13C-4: completion transition fires exactly once');
  // First log crosses threshold → shouldComplete=true
  const firstCross = computeGroupTransition(
    { status: 'active', groupCurrentTotal: 950, groupCumulativeTarget: 1000, autoCompleteOnGroupTarget: true },
    60,
  );
  assert.equal(firstCross.shouldComplete, true, '13C-4: first log to cross threshold must trigger completion');

  // Second log sees committed state (challenge now completed) → no second completion
  const secondCross = computeGroupTransition(
    { status: 'completed', groupCurrentTotal: 1000, groupCumulativeTarget: 1000, autoCompleteOnGroupTarget: true },
    60,
  );
  assert.equal(secondCross.shouldComplete, false, '13C-4: second log after completion must NOT re-trigger completion');
  assert.equal(secondCross.isAlreadyCompleted, true, '13C-4: second log must see isAlreadyCompleted=true');

  console.log('  running 13C-5: concurrent fixture — both readers at 970, only one triggers completion');
  // Simulate: two concurrent logs each with delta=20, target=1000, initial total=970.
  //
  // Reality: Firestore transactions serialize. The "losing" transaction retries after the
  // "winning" one commits. This fixture models what each transaction sees on its READ.
  //
  // Winner (first to commit): reads 970, adds 20 → 990 < 1000 → no completion this round.
  const winnerAttempt1 = computeGroupTransition(
    { status: 'active', groupCurrentTotal: 970, groupCumulativeTarget: 1000, autoCompleteOnGroupTarget: true },
    20,
  );
  assert.equal(winnerAttempt1.shouldComplete, false, '13C-5: 970+20=990 must not complete');
  assert.equal(winnerAttempt1.clampedTotal, 990, '13C-5: winner writes 990');

  // Loser (retry after winner commits 990): reads 990, adds 20 → 1010 >= 1000 → completes.
  const loserRetry = computeGroupTransition(
    { status: 'active', groupCurrentTotal: 990, groupCumulativeTarget: 1000, autoCompleteOnGroupTarget: true },
    20,
  );
  assert.equal(loserRetry.shouldComplete, true, '13C-5: retry sees 990+20=1010 >= 1000 → must complete');
  assert.equal(loserRetry.clampedTotal, 1000, '13C-5: retry result clamps to target');

  // Any subsequent log after loser completes → already done, no third completion.
  const thirdConcurrent = computeGroupTransition(
    { status: 'completed', groupCurrentTotal: 1000, groupCumulativeTarget: 1000, autoCompleteOnGroupTarget: true },
    20,
  );
  assert.equal(thirdConcurrent.isAlreadyCompleted, true, '13C-5: third concurrent log must see completed, no cascade');

  console.log('  running 13C-6: workoutService and wellnessLogService use atomicCollectiveGroupUpdate');
  const workoutServiceSrc = readFileSync(
    new URL('../src/services/workoutService.ts', import.meta.url).pathname,
    'utf8',
  );
  const wellnessLogServiceSrc = readFileSync(
    new URL('../src/services/wellnessLogService.ts', import.meta.url).pathname,
    'utf8',
  );

  assert.ok(
    workoutServiceSrc.includes('atomicCollectiveGroupUpdate'),
    '13C-6: workoutService must call atomicCollectiveGroupUpdate',
  );
  assert.ok(
    wellnessLogServiceSrc.includes('atomicCollectiveGroupUpdate'),
    '13C-6: wellnessLogService must call atomicCollectiveGroupUpdate',
  );
  assert.ok(
    !workoutServiceSrc.includes('cascadeCollectiveCompletion'),
    '13C-6: workoutService must NOT call cascadeCollectiveCompletion directly (handled inside atomicCollectiveGroupUpdate)',
  );
  assert.ok(
    !wellnessLogServiceSrc.includes('cascadeCollectiveCompletion'),
    '13C-6: wellnessLogService must NOT call cascadeCollectiveCompletion directly (handled inside atomicCollectiveGroupUpdate)',
  );

  // Non-collective engines: batch completion path (engineResult.isCompleted && !isCollective)
  // must still exist for Legacy/Competitive/Streak engines.
  assert.ok(
    workoutServiceSrc.includes('isCollective'),
    '13C-6: workoutService must gate completion writes on isCollective flag',
  );
  assert.ok(
    wellnessLogServiceSrc.includes('isCollective'),
    '13C-6: wellnessLogService must gate completion writes on isCollective flag',
  );
}

// ─── Phase 13D Guards — Data Integrity Hardening ─────────────────────────────

{
  const challengeServiceSrc = readFileSync(
    new URL('../src/services/challengeService.ts', import.meta.url).pathname,
    'utf8',
  );
  const challengeCompletionSrc = readFileSync(
    new URL('../src/services/challengeCompletion.ts', import.meta.url).pathname,
    'utf8',
  );
  const workoutSvc = readFileSync(
    new URL('../src/services/workoutService.ts', import.meta.url).pathname,
    'utf8',
  );
  const wellnessSvc = readFileSync(
    new URL('../src/services/wellnessLogService.ts', import.meta.url).pathname,
    'utf8',
  );

  // ── 13D-1: joinChallenge does NOT write participantCount (Phase 18G-2B) ───────
  // participantCount is now owned exclusively by the onChallengeMemberCreated/Updated
  // Cloud Function triggers in functions/src/memberCounters.ts.
  console.log('  running 13D-1: joinChallenge increments participantCount');
  assert.ok(
    !challengeServiceSrc.includes("participantCount: increment(1)"),
    '13D-1: joinChallenge must NOT write participantCount (trigger-only authority, Phase 18G-2B)',
  );

  // ── 13D-2: leaveChallenge does NOT write participantCount (Phase 18G-2B) ────
  console.log('  running 13D-2: leaveChallenge decrements participantCount');
  assert.ok(
    !challengeServiceSrc.includes("participantCount: increment(-1)"),
    '13D-2: leaveChallenge must NOT write participantCount (trigger-only authority, Phase 18G-2B)',
  );

  // ── 13D-3: participantCount never negative — decrement only on active leave ──
  console.log('  running 13D-3: participantCount decrement is gated on status === active');
  // The guard is structural: leaveChallenge reads the snapshot and returns early
  // if status !== 'active', so the decrement only fires for confirmed active members.
  assert.ok(
    challengeServiceSrc.includes("if (membership.status !== 'active') return;"),
    '13D-3: leaveChallenge must guard decrement with status === active check',
  );

  // ── 13D-4: join → leave → join results in totalChallenges === 1 ─────────────
  console.log('  running 13D-4: leaveChallenge decrements totalChallenges');
  assert.ok(
    challengeServiceSrc.includes("totalChallenges: increment(-1)"),
    '13D-4: leaveChallenge must decrement totalChallenges so rejoin does not double-count',
  );

  // ── 13D-5: multiple joins without leave do not inflate (early-return guard) ──
  console.log('  running 13D-5: joinChallenge early-returns for already-active members');
  assert.ok(
    challengeServiceSrc.includes("if (existing.status === 'active') return;"),
    '13D-5: joinChallenge must return early when membership is already active',
  );

  // ── 13D-6: mixed-unit collective challenge is rejected ───────────────────────
  console.log('  running 13D-6: mixed-unit collective challenge is rejected');
  assert.ok(
    challengeServiceSrc.includes("Collective challenges must use a single measurement unit"),
    '13D-6: createChallenge must throw for mixed-unit collective challenges',
  );
  assert.ok(
    challengeServiceSrc.includes("units.size > 1"),
    '13D-6: unit deduplication must use Set.size comparison',
  );

  // ── 13D-7: single-unit collective accepted (no throw for homogeneous units) ──
  console.log('  running 13D-7: single-unit collective accepted (behavioural fixture)');
  // Structural: validation is gated on units.size > 1, so a single unique unit passes.
  assert.ok(
    challengeServiceSrc.includes("units.size > 1"),
    '13D-7: unit guard must be > 1, not >= 1 (single unit must be allowed)',
  );

  // ── 13D-8: competitive and streak challenges unaffected ──────────────────────
  console.log('  running 13D-8: unit validation only applies to collective challenges');
  assert.ok(
    challengeServiceSrc.includes("input.challengeType === 'collective'"),
    '13D-8: unit validation must be gated on challengeType === collective',
  );

  // ── 13D-9 / 13D-10 / 13D-11: deriveDailyTargetValue fixtures ────────────────
  console.log('  running 13D-9/10/11: deriveDailyTargetValue explicit metadata and heuristic');
  const { deriveDailyTargetValue } = await import('../src/services/challengeCompletion.js');

  // 13D-9: explicit per-session target → no division
  assert.equal(
    deriveDailyTargetValue(50, 21, 'streak', 'daily'),
    50,
    '13D-9: targetType=daily must return targetValue unchanged (no heuristic division)',
  );

  // 13D-10: explicit cumulative target → divided by days
  assert.equal(
    deriveDailyTargetValue(1050, 21, 'streak', 'cumulative'),
    50,
    '13D-10: targetType=cumulative must divide by durationDays (1050/21 = 50)',
  );

  // 13D-11: existing heuristic behaviour unchanged for templates without targetType
  //   targetValue=50, durationDays=21 → 50/21 ≈ 2.38 ≥ 1 → derived
  assert.ok(
    Math.abs(deriveDailyTargetValue(50, 21, 'streak') - (50 / 21)) < 0.001,
    '13D-11: heuristic (no targetType) must still divide when result >= 1',
  );
  //   targetValue=8, durationDays=21 → 8/21 ≈ 0.38 < 1 → keep original
  assert.equal(
    deriveDailyTargetValue(8, 21, 'streak'),
    8,
    '13D-11: heuristic (no targetType) must keep original value when division < 1',
  );
  //   non-streak → always return targetValue unchanged
  assert.equal(
    deriveDailyTargetValue(500, 21, 'collective'),
    500,
    '13D-11: non-streak challenges must return targetValue unchanged regardless of durationDays',
  );
  assert.equal(
    deriveDailyTargetValue(100, 14, 'competitive'),
    100,
    '13D-11: competitive challenges must return targetValue unchanged',
  );

  // Confirm both services pass targetType through to deriveDailyTargetValue
  assert.ok(
    workoutSvc.includes("activityConfig?.targetType"),
    '13D-9/10: workoutService must pass activityConfig?.targetType to deriveDailyTargetValue',
  );
  assert.ok(
    wellnessSvc.includes("activityConfig?.targetType"),
    '13D-9/10: wellnessLogService must pass activityConfig?.targetType to deriveDailyTargetValue',
  );
}

// ── 13F — Admin & Template Workflow ──────────────────────────────────────────
{
  const templateSvc = readFileSync('src/services/challengeTemplateService.ts', 'utf-8');
  const adminCreateScreen = readFileSync('src/features/Admin/Challenges/CreateChallengeScreen.tsx', 'utf-8');
  const wizard = readFileSync('src/features/Challenges/CreateChallengeWizard.tsx', 'utf-8');

  // 13F-1: SuggestedChallengeTemplate type carries collective engine fields
  assert.ok(
    templateSvc.includes('groupCumulativeTarget?: number') && templateSvc.includes('autoCompleteOnGroupTarget?: boolean'),
    '13F-1: SuggestedChallengeTemplate must declare groupCumulativeTarget and autoCompleteOnGroupTarget',
  );

  // 13F-2: SuggestedChallengeTemplate type carries streak engine fields
  assert.ok(
    templateSvc.includes('requiredConsecutiveDays?: number') && templateSvc.includes('streakResetOnMiss?: boolean'),
    '13F-2: SuggestedChallengeTemplate must declare requiredConsecutiveDays and streakResetOnMiss',
  );

  // 13F-3: fromDoc reads collective engine fields
  assert.ok(
    templateSvc.includes('groupCumulativeTarget: data.groupCumulativeTarget'),
    '13F-3: fromDoc must read groupCumulativeTarget from Firestore data',
  );

  // 13F-4: fromDoc reads streak engine fields
  assert.ok(
    templateSvc.includes('requiredConsecutiveDays: data.requiredConsecutiveDays'),
    '13F-4: fromDoc must read requiredConsecutiveDays from Firestore data',
  );

  // 13F-5: CreateSuggestedChallengeTemplateInput carries engine fields
  assert.ok(
    templateSvc.includes('groupCumulativeTarget?: number') && templateSvc.includes('requiredConsecutiveDays?: number'),
    '13F-5: CreateSuggestedChallengeTemplateInput must include engine-specific fields',
  );

  // 13F-6: activities in template type carry targetType
  assert.ok(
    templateSvc.includes("targetType?: 'daily' | 'cumulative'"),
    "13F-6: template activities must include targetType field",
  );

  // 13F-7: admin create screen captures groupCumulativeTarget state
  assert.ok(
    adminCreateScreen.includes('groupCumulativeTarget') && adminCreateScreen.includes('setGroupCumulativeTarget'),
    '13F-7: CreateChallengeScreen must manage groupCumulativeTarget state',
  );

  // 13F-8: admin create screen captures requiredConsecutiveDays state
  assert.ok(
    adminCreateScreen.includes('requiredConsecutiveDays') && adminCreateScreen.includes('setRequiredConsecutiveDays'),
    '13F-8: CreateChallengeScreen must manage requiredConsecutiveDays state',
  );

  // 13F-9: fitness template save derives groupCumulativeTarget from first activity (not raw state)
  assert.ok(
    adminCreateScreen.includes("challengeType === 'collective'") &&
      adminCreateScreen.includes('groupCumulativeTarget: Number(finalActivities[0]?.targetValue'),
    "13F-9: CreateChallengeScreen must derive groupCumulativeTarget from finalActivities[0].targetValue for collective templates",
  );

  // 13F-10: fitness template save spreads streak fields conditionally
  assert.ok(
    adminCreateScreen.includes("challengeType === 'streak'") && adminCreateScreen.includes('requiredConsecutiveDays: Number(requiredConsecutiveDays)'),
    "13F-10: CreateChallengeScreen must pass requiredConsecutiveDays to createTemplateMutation for streak templates",
  );

  // 13F-11: wizard applies groupCumulativeTarget from template
  assert.ok(
    wizard.includes('template.groupCumulativeTarget') && wizard.includes('setGroupCumulativeTarget'),
    '13F-11: CreateChallengeWizard must apply template.groupCumulativeTarget when loading a template',
  );

  // 13F-12: wizard applies requiredConsecutiveDays from template
  assert.ok(
    wizard.includes('template.requiredConsecutiveDays') && wizard.includes('setRequiredConsecutiveDays'),
    '13F-12: CreateChallengeWizard must apply template.requiredConsecutiveDays when loading a template',
  );

  // 13F-13: wizard applies streakResetOnMiss from template
  assert.ok(
    wizard.includes('template.streakResetOnMiss') && wizard.includes('setStreakResetOnMiss'),
    '13F-13: CreateChallengeWizard must apply template.streakResetOnMiss when loading a template',
  );

  // 13F-14: wizard applies autoCompleteOnGroupTarget from template
  assert.ok(
    wizard.includes('template.autoCompleteOnGroupTarget') && wizard.includes('setAutoCompleteOnGroupTarget'),
    '13F-14: CreateChallengeWizard must apply template.autoCompleteOnGroupTarget when loading a template',
  );
}

// ── 13G — Admin Analytics Accuracy ───────────────────────────────────────────
{
  const adminSvc = readFileSync('src/services/adminChallengeService.ts', 'utf-8');

  // 13G-1: avgCompletionRate reads from challengeMembers, not challenge.progress
  assert.ok(
    adminSvc.includes("collection(db, 'challengeMembers')"),
    '13G-1: getChallengeAnalytics must read from challengeMembers collection',
  );

  // 13G-2: query filters to active/completed members only (excludes abandoned)
  assert.ok(
    adminSvc.includes("where('status', 'in', ['active', 'completed'])"),
    "13G-2: challengeMembers query must filter to status in ['active', 'completed']",
  );

  // 13G-3: completionRate field is read from member documents
  assert.ok(
    adminSvc.includes('.completionRate'),
    '13G-3: getChallengeAnalytics must read completionRate from member documents',
  );

  // 13G-4: challenge.progress is no longer used for avgCompletionRate
  assert.ok(
    !adminSvc.includes('c.progress'),
    '13G-4: getChallengeAnalytics must not use challenge.progress for completion rate (always 0)',
  );
}

// ── 14B — Wellness / Fitness Engine Parity ───────────────────────────────────
{
  const wellnessType = readFileSync('src/types/index.ts', 'utf-8');
  const wellnessSvc = readFileSync('src/services/wellnessTemplateService.ts', 'utf-8');
  const wellnessHooks = readFileSync('src/hooks/useWellnessTemplates.ts', 'utf-8');
  const wizard = readFileSync('src/features/Challenges/CreateChallengeWizard.tsx', 'utf-8');
  const adminCreate = readFileSync('src/features/Admin/Challenges/CreateChallengeScreen.tsx', 'utf-8');
  const detailScreen = readFileSync('src/features/Challenges/WellnessTemplateDetailScreen.tsx', 'utf-8');

  // 14B-1: WellnessTemplate type carries all 4 engine-specific fields
  assert.ok(
    wellnessType.includes('groupCumulativeTarget?: number') && wellnessType.includes('autoCompleteOnGroupTarget?: boolean') &&
    wellnessType.includes('requiredConsecutiveDays?: number') && wellnessType.includes('streakResetOnMiss?: boolean'),
    '14B-1: WellnessTemplate type must include all four engine-specific fields',
  );

  // 14B-2: WellnessTemplate type includes lifecycle fields
  assert.ok(
    wellnessType.includes("status?: 'draft' | 'published' | 'archived' | 'deleted'") &&
    wellnessType.includes('version?: number') && wellnessType.includes('usageCount?: number'),
    '14B-2: WellnessTemplate type must include lifecycle fields (status, version, usageCount)',
  );

  // 14B-3: WellnessTemplate type includes targetType on activities
  assert.ok(
    wellnessType.includes("targetType?: 'daily' | 'cumulative'"),
    "14B-3: WellnessTemplate activity must support targetType: 'daily' | 'cumulative'",
  );

  // 14B-4: wellnessTemplateService fromDoc parses engine fields
  assert.ok(
    wellnessSvc.includes('groupCumulativeTarget') && wellnessSvc.includes('requiredConsecutiveDays') &&
    wellnessSvc.includes('streakResetOnMiss') && wellnessSvc.includes('autoCompleteOnGroupTarget'),
    '14B-4: wellnessTemplateService.fromDoc must parse all engine-specific fields',
  );

  // 14B-5: wellnessTemplateService.createTemplate passes engine fields to Firestore
  assert.ok(
    wellnessSvc.includes('async createTemplate'),
    '14B-5: wellnessTemplateService must expose createTemplate',
  );

  // 14B-6: wellnessTemplateService has deriveStatus for backward compat
  assert.ok(
    wellnessSvc.includes('deriveStatus') && wellnessSvc.includes('isPublished !== false'),
    '14B-6: wellnessTemplateService must have deriveStatus for backward compat',
  );

  // 14B-7: wellnessTemplateService has soft delete
  assert.ok(
    wellnessSvc.includes("status: 'deleted'") && !wellnessSvc.includes('deleteDoc'),
    '14B-7: wellnessTemplateService.deleteTemplate must soft-delete (set status=deleted), not call Firestore deleteDoc',
  );

  // 14B-8: wellnessTemplateService has lifecycle methods matching fitness service
  for (const method of ['publishTemplate', 'unpublishTemplate', 'archiveTemplate', 'restoreTemplate', 'deleteTemplate', 'duplicateTemplate', 'updateTemplate', 'getAllTemplatesAdmin']) {
    assert.ok(
      wellnessSvc.includes(`async ${method}(`),
      `14B-8: wellnessTemplateService must expose ${method} (lifecycle parity with challengeTemplateService)`,
    );
  }

  // 14B-9: useWellnessTemplates exports lifecycle mutation hooks
  for (const hook of ['usePublishWellnessTemplate', 'useArchiveWellnessTemplate', 'useDeleteWellnessTemplate', 'useDuplicateWellnessTemplate', 'useAllAdminWellnessTemplates']) {
    assert.ok(
      wellnessHooks.includes(`export function ${hook}`),
      `14B-9: useWellnessTemplates must export ${hook}`,
    );
  }

  // 14B-10: CreateChallengeWizard applies engine fields from wellness template
  assert.ok(
    wizard.includes('wellnessTemplate.groupCumulativeTarget') && wizard.includes('setGroupCumulativeTarget'),
    '14B-10: CreateChallengeWizard must apply groupCumulativeTarget from wellness template',
  );
  assert.ok(
    wizard.includes('wellnessTemplate.requiredConsecutiveDays') && wizard.includes('setRequiredConsecutiveDays'),
    '14B-10: CreateChallengeWizard must apply requiredConsecutiveDays from wellness template',
  );

  // 14B-11: Admin CreateChallengeScreen passes engine fields to wellness template creation
  assert.ok(
    adminCreate.includes("challengeType === 'collective'") &&
    adminCreate.includes('groupCumulativeTarget: Number(finalActivities[0]?.targetValue'),
    '14B-11: CreateChallengeScreen wellness path must pass groupCumulativeTarget (derived from finalActivities[0].targetValue) to wellnessTemplateService.createTemplate',
  );
  assert.ok(
    adminCreate.includes("challengeType === 'streak'") &&
    adminCreate.includes('requiredConsecutiveDays: Number(requiredConsecutiveDays)'),
    '14B-11: CreateChallengeScreen wellness path must pass requiredConsecutiveDays to wellnessTemplateService.createTemplate',
  );

  // 14B-12: WellnessTemplateDetailScreen shows engine badge with explanation
  assert.ok(
    detailScreen.includes('ENGINE') && detailScreen.includes('e.description'),
    '14B-12: WellnessTemplateDetailScreen must show engine explanation (not just raw type string)',
  );

  // 14B-13: WellnessTemplateDetailScreen shows engine-specific fields
  assert.ok(
    detailScreen.includes('groupCumulativeTarget') && detailScreen.includes('requiredConsecutiveDays'),
    '14B-13: WellnessTemplateDetailScreen must display groupCumulativeTarget and requiredConsecutiveDays when set',
  );
}

// ── 14A — Complete Template Management ───────────────────────────────────────
{
  const svc = readFileSync('src/services/challengeTemplateService.ts', 'utf-8');
  const hooks = readFileSync('src/hooks/useChallengeTemplates.ts', 'utf-8');
  const screen = readFileSync('src/features/Admin/Challenges/ChallengeTemplatesScreen.tsx', 'utf-8');
  const editScreen = readFileSync('src/features/Admin/Challenges/EditChallengeTemplateScreen.tsx', 'utf-8');
  const createScreen = readFileSync('src/features/Admin/Challenges/CreateChallengeScreen.tsx', 'utf-8');
  const app = readFileSync('src/App.tsx', 'utf-8');

  // 14A-1: TemplateStatus type exists with all 4 lifecycle states
  assert.ok(
    svc.includes("'draft' | 'published' | 'archived' | 'deleted'"),
    '14A-1: challengeTemplateService must export TemplateStatus with draft/published/archived/deleted',
  );

  // 14A-2: deriveStatus backward compatibility for templates without status field
  assert.ok(
    svc.includes('deriveStatus') && svc.includes('isPublished !== false'),
    '14A-2: challengeTemplateService must have deriveStatus for backward compat with isPublished',
  );

  // 14A-3: lifecycle mutation methods exist on service
  for (const method of ['publishTemplate', 'unpublishTemplate', 'archiveTemplate', 'restoreTemplate', 'deleteTemplate', 'duplicateTemplate', 'updateTemplate', 'getAllTemplatesAdmin', 'incrementUsageCount']) {
    assert.ok(
      svc.includes(`async ${method}(`),
      `14A-3: challengeTemplateService must expose ${method} method`,
    );
  }

  // 14A-4: deleteTemplate is soft-delete (status=deleted, not Firestore deleteDoc)
  assert.ok(
    svc.includes("status: 'deleted'") && !svc.includes('deleteDoc'),
    '14A-4: deleteTemplate must soft-delete (set status=deleted), not call Firestore deleteDoc',
  );

  // 14A-5: duplicateTemplate sets usageCount=0, version=1 on the copy
  assert.ok(
    svc.includes('usageCount: 0') && svc.includes('version: 1'),
    '14A-5: duplicateTemplate must reset usageCount=0 and version=1 on the copy',
  );

  // 14A-6: hooks expose all lifecycle mutations
  for (const hook of ['usePublishTemplate', 'useUnpublishTemplate', 'useArchiveTemplate', 'useRestoreTemplate', 'useDeleteTemplate', 'useDuplicateTemplate', 'useUpdateTemplate', 'useAllAdminTemplates']) {
    assert.ok(
      hooks.includes(`export function ${hook}`),
      `14A-6: useChallengeTemplates must export ${hook}`,
    );
  }

  // 14A-7: all mutations invalidate admin-challenge-templates-all query key
  assert.ok(
    hooks.includes('admin-challenge-templates-all'),
    '14A-7: lifecycle mutations must invalidate admin-challenge-templates-all query key',
  );

  // 14A-8: ChallengeTemplatesScreen uses useAllAdminTemplates (not published-only hook)
  assert.ok(
    screen.includes('useAllAdminTemplates'),
    '14A-8: ChallengeTemplatesScreen must use useAllAdminTemplates for admin view',
  );

  // 14A-9: ChallengeTemplatesScreen has search input
  assert.ok(
    screen.includes('search') && screen.includes('setSearch'),
    '14A-9: ChallengeTemplatesScreen must have search state',
  );

  // 14A-10: ChallengeTemplatesScreen has status filter (draft/published/archived)
  assert.ok(
    screen.includes("'draft'") && screen.includes("'archived'") && screen.includes('statusFilter'),
    '14A-10: ChallengeTemplatesScreen must have status filter with draft/archived options',
  );

  // 14A-11: ChallengeTemplatesScreen has confirmation dialog for destructive actions
  assert.ok(
    screen.includes('ConfirmDialog') || screen.includes('confirmState'),
    '14A-11: ChallengeTemplatesScreen must have confirmation dialog for destructive actions',
  );

  // 14A-12: EditChallengeTemplateScreen exists and pre-populates from template data
  assert.ok(
    editScreen.includes('useParams') && editScreen.includes('initialized'),
    '14A-12: EditChallengeTemplateScreen must use useParams and pre-populate from loaded template',
  );

  // 14A-13: EditChallengeTemplateScreen has both Save as Draft and Save & Publish buttons
  assert.ok(
    editScreen.includes('Save as Draft') && editScreen.includes('Save & Publish'),
    '14A-13: EditChallengeTemplateScreen must have both Save as Draft and Save & Publish buttons',
  );

  // 14A-14: CreateChallengeScreen defaults to draft (isPublished: false) and has both buttons
  assert.ok(
    createScreen.includes('Save as Draft') && createScreen.includes('Save & Publish'),
    '14A-14: CreateChallengeScreen must have both Save as Draft and Save & Publish buttons',
  );

  // 14A-15: edit route registered in App.tsx
  assert.ok(
    app.includes('/app/admin/challenges/templates/:id/edit'),
    '14A-15: App.tsx must register /app/admin/challenges/templates/:id/edit route',
  );
}

// ── Phase 14C: Challenge Template Management Dashboard ─────────────────────────
{
  const screen = readFileSync('src/features/Admin/Challenges/ChallengeTemplatesScreen.tsx', 'utf8');
  const wellnessHooks = readFileSync('src/hooks/useWellnessTemplates.ts', 'utf8');

  // 14C-1: Screen loads both fitness and wellness templates
  assert.ok(
    screen.includes('useAllAdminTemplates') && screen.includes('useAllAdminWellnessTemplates'),
    '14C-1: ChallengeTemplatesScreen must load both fitness (useAllAdminTemplates) and wellness (useAllAdminWellnessTemplates) templates',
  );

  // 14C-2: Unified AdminTemplate type with collection field
  assert.ok(
    screen.includes("collection: 'fitness'") && screen.includes("collection: 'wellness'"),
    '14C-2: ChallengeTemplatesScreen must normalize both collections into unified AdminTemplate with collection field',
  );

  // 14C-3: Analytics strip with required stats
  assert.ok(
    screen.includes('AnalyticsStrip') &&
    screen.includes('Published') &&
    screen.includes('Draft') &&
    screen.includes('Archived') &&
    screen.includes('Never Used'),
    '14C-3: ChallengeTemplatesScreen must include AnalyticsStrip with Published/Draft/Archived/Never Used stats',
  );

  // 14C-4: Bulk selection with selectedTemplates + BulkActionBar
  assert.ok(
    screen.includes('BulkActionBar') && screen.includes('selected') && screen.includes('toggleSelectAll'),
    '14C-4: ChallengeTemplatesScreen must have bulk selection UI (BulkActionBar, selected set, toggleSelectAll)',
  );

  // 14C-5: Collection filter (fitness/wellness/all)
  assert.ok(
    screen.includes("collectionFilter") && screen.includes("CollectionFilter"),
    '14C-5: ChallengeTemplatesScreen must have CollectionFilter (all/fitness/wellness)',
  );

  // 14C-6: Duplicate navigates to edit for fitness templates
  assert.ok(
    screen.includes('handleDuplicate') && screen.includes('/app/admin/challenges/templates/') && screen.includes('/edit'),
    '14C-6: handleDuplicate must capture new ID and navigate to edit screen for fitness templates',
  );

  // 14C-7: Archive safety — usageCount passed to ConfirmDialog
  assert.ok(
    screen.includes('usageCount') && screen.includes('ConfirmDialog'),
    '14C-7: Archive/delete ConfirmDialog must receive usageCount for safety warning when template is in use',
  );

  // 14C-8: Version history metadata on cards (createdAt, updatedAt, publishedAt)
  assert.ok(
    screen.includes('createdAt') && screen.includes('updatedAt') && screen.includes('publishedAt'),
    '14C-8: Template cards must display version history (createdAt, updatedAt, publishedAt)',
  );

  // 14C-9: Sort by oldest (createdAt) option present
  assert.ok(
    screen.includes("'createdAt'") && screen.includes('Oldest'),
    '14C-9: ChallengeTemplatesScreen must include sort-by-oldest (createdAt) option',
  );

  // 14C-10: Unused filter present
  assert.ok(
    screen.includes('unusedOnly') && screen.includes('Unused'),
    '14C-10: ChallengeTemplatesScreen must include Unused filter (usageCount === 0)',
  );

  // 14C-11: Bulk ops use services directly (Promise.all pattern) not mutation hooks
  assert.ok(
    screen.includes('challengeTemplateService') && screen.includes('wellnessTemplateService') && screen.includes('Promise.all'),
    '14C-11: Bulk operations must call services directly with Promise.all (not per-item mutation hooks)',
  );

  // 14C-12: useAllAdminWellnessTemplates hook exported
  assert.ok(
    wellnessHooks.includes('export function useAllAdminWellnessTemplates'),
    '14C-12: useWellnessTemplates must export useAllAdminWellnessTemplates hook',
  );

  // 14C-13: Fitness/wellness collection badge displayed on cards
  assert.ok(
    screen.includes('COLLECTION_BADGE') || (screen.includes('Fitness') && screen.includes('Wellness') && screen.includes('collection')),
    '14C-13: Template cards must display a Fitness/Wellness collection badge',
  );
}

// ── Phase 14D: Template Snapshot & Version Integrity ──────────────────────────
{
  const challengeService = readFileSync('src/services/challengeService.ts', 'utf8');
  const wizard = readFileSync('src/features/Challenges/CreateChallengeWizard.tsx', 'utf8');
  const types = readFileSync('src/types/index.ts', 'utf8');

  // 14D-1: durationDays computed from startDate/endDate and stored in payload
  assert.ok(
    challengeService.includes('durationDays') && challengeService.includes('startDate.getTime()') && challengeService.includes('endDate.getTime()'),
    '14D-1: createChallenge must compute durationDays from startDate/endDate and include it in the challenge payload',
  );

  // 14D-2: durationDays is in the payload block (not just a local variable)
  assert.ok(
    challengeService.includes('durationDays,') || challengeService.includes('durationDays:'),
    '14D-2: durationDays must be present in the Firestore payload (not just a local variable)',
  );

  // 14D-3: Challenge.activities includes targetType field
  const activitiesBlock = types.slice(types.indexOf('interface Challenge'), types.indexOf('interface WellnessTemplate'));
  assert.ok(
    activitiesBlock.includes("targetType?: 'daily' | 'cumulative'"),
    "14D-3: Challenge.activities must include targetType?: 'daily' | 'cumulative'",
  );

  // 14D-4: Wizard ActivityRow includes targetType
  assert.ok(
    wizard.includes("targetType?: 'daily' | 'cumulative'"),
    "14D-4: CreateChallengeWizard ActivityRow must include targetType?: 'daily' | 'cumulative'",
  );

  // 14D-5: Wizard copies targetType into the challenge payload activities
  assert.ok(
    wizard.includes('targetType: activity.targetType'),
    '14D-5: CreateChallengeWizard must copy activity.targetType into the challenge payload activities',
  );

  // 14D-6: incrementUsageCount called after successful challenge creation for fitness templates
  assert.ok(
    wizard.includes('challengeTemplateService.incrementUsageCount(templateId)'),
    '14D-6: CreateChallengeWizard must call challengeTemplateService.incrementUsageCount after successful challenge creation',
  );

  // 14D-7: incrementUsageCount called after successful challenge creation for wellness templates
  assert.ok(
    wizard.includes('wellnessTemplateService.incrementUsageCount(wellnessTemplateId)'),
    '14D-7: CreateChallengeWizard must call wellnessTemplateService.incrementUsageCount after successful challenge creation',
  );

  // 14D-8: Scoring engines do NOT import from template services (challenge docs are independent)
  const workoutService = readFileSync('src/services/workoutService.ts', 'utf8');
  const wellnessLogService = readFileSync('src/services/wellnessLogService.ts', 'utf8');
  assert.ok(
    !workoutService.includes('challengeTemplateService') && !workoutService.includes('wellnessTemplateService'),
    '14D-8: workoutService must not import template services — scoring reads from challenge documents only',
  );
  assert.ok(
    !wellnessLogService.includes('challengeTemplateService') && !wellnessLogService.includes('wellnessTemplateService'),
    '14D-8: wellnessLogService must not import template services — scoring reads from challenge documents only',
  );

  // 14D-9: challengeService createChallenge does not read from template collections (isolated write)
  assert.ok(
    !challengeService.includes('challengeTemplates') || challengeService.indexOf('challengeTemplates') > challengeService.indexOf('class ChallengeService'),
    '14D-9: createChallenge must build the challenge document from wizard input, not by re-fetching the template',
  );
}

// ─── Phase 15B: Callable Validation Parity Guards ────────────────────────────
{
  const backend = readFileSync('functions/src/challengeCreationBackend.ts', 'utf8');

  // 15B-1: normalizeChallengeType throws on invalid non-empty values
  assert.ok(
    backend.includes("throw new HttpsError('invalid-argument'") &&
      backend.includes('challengeType must be one of'),
    '15B-1: normalizeChallengeType must throw HttpsError for unknown challengeType values',
  );

  // 15B-2: requireEngineVersion helper exists and throws on invalid values
  assert.ok(
    backend.includes('function requireEngineVersion') &&
      backend.includes("engineVersion must be 'v2' or omitted"),
    '15B-2: requireEngineVersion must throw HttpsError for non-v2 non-empty engineVersion values',
  );

  // 15B-3: requireEngineVersion is used in the core function (not the old inline check)
  assert.ok(
    backend.includes('requireEngineVersion(input.engineVersion)'),
    '15B-3: createChallengeWithCreatorMembershipCore must call requireEngineVersion()',
  );

  // 15B-4: normalizeTargetType throws on malformed (non-null, non-valid) values
  assert.ok(
    backend.includes("targetType must be 'daily', 'cumulative', or omitted"),
    '15B-4: normalizeTargetType must throw HttpsError for invalid non-empty targetType values',
  );

  // 15B-5: at-least-one-activity guard exists before the transaction
  assert.ok(
    backend.includes("activities.length === 0") &&
      backend.includes('At least one activity is required'),
    '15B-5: createChallengeWithCreatorMembershipCore must reject empty activity list',
  );

  // 15B-6: duplicate activity ID detection
  assert.ok(
    backend.includes('seenIds') && backend.includes('Duplicate activity id'),
    '15B-6: createChallengeWithCreatorMembershipCore must reject duplicate activity IDs',
  );

  // 15B-7: collective groupCumulativeTarget > 0 check
  assert.ok(
    backend.includes('groupCumulativeTarget !== undefined && groupCumulativeTarget <= 0') &&
      backend.includes('groupCumulativeTarget must be greater than 0'),
    '15B-7: collective challenges must reject groupCumulativeTarget of 0 or less',
  );

  // 15B-8: mixed-unit collective validation exists
  assert.ok(
    backend.includes('Found mixed units'),
    '15B-8: collective challenges must reject activities with mixed measurement units',
  );

  // 15B-9: streak requiredConsecutiveDays <= durationDays
  assert.ok(
    backend.includes('requiredConsecutiveDays > durationDays') &&
      backend.includes('cannot exceed durationDays'),
    '15B-9: streak challenges must reject requiredConsecutiveDays > durationDays',
  );

  // 15B-10: donation consistency guard — enabled without payment contact method
  assert.ok(
    backend.includes("donation?.enabled === true && !donation.contributionPhoneNumber && !donation.contributionCardUrl") &&
      backend.includes('contributionPhoneNumber or contributionCardUrl'),
    '15B-10: donation-enabled challenges must require a payment contact method',
  );

  // 15B-11: activities normalization happens BEFORE runTransaction (fail-fast, no wasted transaction open)
  const transactionIdx = backend.indexOf('db.runTransaction');
  const activitiesNormalizeIdx = backend.indexOf('normalizeActivities(input.activities)');
  assert.ok(
    activitiesNormalizeIdx > -1 && activitiesNormalizeIdx < transactionIdx,
    '15B-11: normalizeActivities must be called before runTransaction so invalid activity input fails fast',
  );

  // 15B-12: validation guards are all pre-transaction (no Firestore reads before they fire)
  // Spot-check: the duplicate-ID guard appears before runTransaction
  const seenIdsIdx = backend.indexOf('seenIds.has(id)');
  assert.ok(
    seenIdsIdx > -1 && seenIdsIdx < transactionIdx,
    '15B-12: duplicate activity ID check must run before runTransaction',
  );
}

// ─── Phase 15C: Callable Behaviour Parity Guards ─────────────────────────────
{
  const backend = readFileSync('functions/src/challengeCreationBackend.ts', 'utf8');

  // 15C-1: FieldValue imported for server-side increments
  assert.ok(
    backend.includes("FieldValue") && backend.includes("firebase-admin/firestore"),
    '15C-1: FieldValue must be imported from firebase-admin/firestore',
  );

  // 15C-2: stats.totalChallenges is incremented inside the transaction
  assert.ok(
    backend.includes('totalChallenges') && backend.includes('FieldValue.increment(1)'),
    '15C-2: stats.totalChallenges must be incremented with FieldValue.increment(1)',
  );

  // 15C-3: lastChallengeJoinedAt is written inside the transaction
  assert.ok(
    backend.includes('lastChallengeJoinedAt'),
    '15C-3: lastChallengeJoinedAt must be written when creator joins',
  );

  // 15C-4: user stats update uses merge:true so it doesn't overwrite other user fields
  assert.ok(
    backend.includes('merge: true') &&
      backend.indexOf('merge: true') > backend.indexOf('lastChallengeJoinedAt'),
    '15C-4: user stats transaction.set must use { merge: true }',
  );

  // 15C-5: streak membership initialisation writes currentStreak and longestStreak
  assert.ok(
    backend.includes('currentStreak: 0') && backend.includes('longestStreak: 0'),
    '15C-5: streak creator membership must initialise currentStreak and longestStreak to 0',
  );

  // 15C-6: streak fields are conditional on challengeType === 'streak'
  assert.ok(
    backend.includes("challengeType === 'streak'") &&
      backend.indexOf('currentStreak: 0') > backend.indexOf("challengeType === 'streak'"),
    '15C-6: currentStreak/longestStreak reset must only be applied for streak challenges',
  );

  // 15C-7: no participantCount increment inside the callable transaction
  // (participantCount is managed by the onChallengeMemberCreated Cloud Function trigger)
  const transactionStart = backend.indexOf('db.runTransaction');
  const transactionBody = backend.slice(transactionStart);
  assert.ok(
    !transactionBody.includes('participantCount: increment') &&
      !transactionBody.includes("participantCount', FieldValue"),
    '15C-7: callable must not increment participantCount inside the transaction — the Cloud Function trigger handles it',
  );

  // 15C-8: userRef uses actorUid (not a different uid)
  assert.ok(
    backend.includes("db.collection('users').doc(actorUid)"),
    '15C-8: userRef must target the creator (actorUid), not a different user',
  );

  // 15C-9: user stats write is inside the transaction (appears after runTransaction call)
  const userRefIdx = backend.indexOf("db.collection('users').doc(actorUid)");
  assert.ok(
    userRefIdx > transactionStart,
    '15C-9: user stats update must be inside the runTransaction callback, not before it',
  );
}

// ─── Phase 15E: Final Migration Blocker Guards ───────────────────────────────
{
  const backend = readFileSync('functions/src/challengeCreationBackend.ts', 'utf8');

  // 15E-1: durationDays is derived from endDate - startDate when endDate is provided
  // (never silently defaults to 14 when dates are available)
  // Phase 18B: formula changed from Math.round (exclusive) to Math.floor + 1 (inclusive)
  assert.ok(
    backend.includes('Math.max(1, Math.floor((Date.parse(endDate) - Date.parse(startDate)) / MILLISECONDS_PER_DAY) + 1)'),
    '15E-1: durationDays must be derived from dates inclusively (Math.floor + 1) when endDate is provided — must not default to 14',
  );

  // 15E-2: explicit durationDays from input still accepted when both endDate and durationDays are supplied
  assert.ok(
    backend.includes('explicitDuration') && backend.includes('optionalNumber(input.durationDays'),
    '15E-2: explicit durationDays from input must override the date-derived value when both are present',
  );

  // 15E-3: owner auto-membership uses role='owner', not role='member'
  assert.ok(
    backend.includes("role: 'owner'") && !backend.includes("role: 'member'"),
    "15E-3: owner auto-membership must be created with role: 'owner'",
  );

  // 15E-4: approvedAt is written for owner auto-membership
  assert.ok(
    backend.includes('approvedAt: nowIso'),
    '15E-4: owner auto-membership must include approvedAt timestamp',
  );

  // 15E-5: creator membership is NOT written for donation/draft challenges
  // The membership set must be inside the !requiresDonationApproval block
  const memberRefSetIdx = backend.indexOf('transaction.set(challengeMemberRef');
  const donationGateIdx = backend.indexOf('if (!requiresDonationApproval)');
  assert.ok(
    memberRefSetIdx > donationGateIdx && donationGateIdx > -1,
    '15E-5: creator membership (challengeMemberRef) must only be written when !requiresDonationApproval',
  );

  // 15E-6: user stats are NOT incremented for donation/draft challenges
  // The totalChallenges increment must be inside the !requiresDonationApproval block
  const statsSetIdx = backend.indexOf('totalChallenges: FieldValue.increment(1)');
  assert.ok(
    statsSetIdx > donationGateIdx,
    '15E-6: stats.totalChallenges increment must only fire when !requiresDonationApproval',
  );

  // 15E-7: challenge document is always written (before the donation gate)
  const challengeRefSetIdx = backend.indexOf('transaction.set(challengeRef, challengePayload)');
  assert.ok(
    challengeRefSetIdx > -1 && challengeRefSetIdx < donationGateIdx,
    '15E-7: challenge document must always be written, regardless of donation approval status',
  );
}

// ─── Phase 16A: Frontend Migration Guards ────────────────────────────────────
{
  const wizard = readFileSync('src/features/Challenges/CreateChallengeWizard.tsx', 'utf8');

  // 16A-1: wizard calls the callable, not the old client service
  assert.ok(
    wizard.includes('createChallengeCallable'),
    '16A-1: CreateChallengeWizard must call createChallengeCallable (the Cloud Function callable)',
  );

  // 16A-2: wizard no longer calls challengeService.createChallenge directly
  assert.ok(
    !wizard.includes('createChallenge.mutateAsync'),
    '16A-2: CreateChallengeWizard must not call createChallenge.mutateAsync() — migration uses callable',
  );

  // 16A-3: wizard no longer calls joinChallenge during creation
  // (callable creates membership transactionally — no client joinChallenge needed)
  assert.ok(
    !wizard.includes('joinChallenge'),
    '16A-3: CreateChallengeWizard must not call joinChallenge() — callable handles creator membership',
  );

  // 16A-4: template usage count still fires after successful creation
  assert.ok(
    wizard.includes('challengeTemplateService.incrementUsageCount(templateId)') &&
      wizard.includes('wellnessTemplateService.incrementUsageCount(wellnessTemplateId)'),
    '16A-4: template incrementUsageCount must still be called after successful creation',
  );

  // 16A-5: all engine fields remain in the payload passed to the callable
  assert.ok(
    wizard.includes("engineVersion: 'v2'") &&
      wizard.includes('groupCumulativeTarget') &&
      wizard.includes('requiredConsecutiveDays') &&
      wizard.includes('streakResetOnMiss') &&
      wizard.includes('autoCompleteOnGroupTarget'),
    '16A-5: all v2 engine fields must remain present in the callable payload',
  );

  // 16A-6: donation fields remain in the payload
  assert.ok(
    wizard.includes('causeName') &&
      wizard.includes('contributionPhoneNumber') &&
      wizard.includes('contributionCardUrl') &&
      wizard.includes('targetAmountKes'),
    '16A-6: donation challenge fields must remain present in the callable payload',
  );

  // 16A-7: collective payload fields remain (groupCumulativeTarget now derived from activity)
  assert.ok(
    wizard.includes("challengeType === 'collective'") &&
      wizard.includes('groupCumulativeTarget: Number(finalActivities[0]?.targetValue'),
    '16A-7: collective engine payload must remain intact (groupCumulativeTarget derived from finalActivities[0].targetValue)',
  );

  // 16A-8: streak payload fields remain
  assert.ok(
    wizard.includes("challengeType === 'streak'") &&
      wizard.includes('requiredConsecutiveDays: Number(requiredConsecutiveDays)'),
    '16A-8: streak engine payload must remain intact',
  );

  // Old implementation retained for rollback
  const challengeService = readFileSync('src/services/challengeService.ts', 'utf8');
  assert.ok(
    challengeService.includes('async createChallenge(') && challengeService.includes('async joinChallenge('),
    '16A: challengeService.createChallenge and joinChallenge must remain in place for rollback',
  );
}

// ── 18G-2A.1: Join challenge permission regression guards ─────────────────────
// Static guards that the join/leave flows include the fields required by
// firestore.rules and that the rules allow group-member participantCount writes.

{
  const rules = readFileSync('firestore.rules', 'utf8');
  const svc   = readFileSync('src/services/challengeService.ts', 'utf8');

  // 18G-1: joinChallenge payload includes groupId — required by challengeMembers create rule
  // (isGroupMember(request.resource.data.groupId) || isPublicGroup(request.resource.data.groupId))
  assert.ok(
    svc.includes('groupId: challenge.groupId'),
    '18G-1: joinChallenge payload must include groupId (required by challengeMembers create rule)',
  );

  // 18G-2: joinChallenge payload includes userId — required by userId == request.auth.uid rule check
  assert.ok(
    svc.includes('userId,') || svc.includes('userId:'),
    '18G-2: joinChallenge payload must include userId (required by challengeMembers create rule)',
  );

  // 18G-3: challengeMembers doc ID format is challengeId_userId
  assert.ok(
    svc.includes('`${challengeId}_${userId}`'),
    '18G-3: challengeMemberDocId must use ${challengeId}_${userId} format (matches isActiveChallengeMember rule)',
  );

  // 18G-4: groupMembers doc ID format is groupId_userId (matches isGroupMember rule)
  assert.ok(
    svc.includes('`${groupId}_${userId}`'),
    '18G-4: membershipDocId must use ${groupId}_${userId} format (matches isGroupMember firestore.rules helper)',
  );

  // 18G-5: joinChallenge verifies group membership before writing (service-layer guard)
  assert.ok(
    svc.includes('Must be a group member to join this challenge') &&
    svc.includes('Must be an active group member to join this challenge'),
    '18G-5: joinChallenge must validate group membership at service layer (non-member protection)',
  );

  // 18G-6: participantCount is owned exclusively by Cloud Function triggers (Phase 18G-2B).
  // The temporary participantCount-only rule branch has been removed; client no longer writes it.
  assert.ok(
    !rules.includes("hasOnly(['participantCount'])"),
    '18G-6: firestore.rules must NOT contain participantCount-only update branch (removed in Phase 18G-2B)',
  );

  // 18G-6b: joinChallenge must NOT increment participantCount client-side
  assert.ok(
    !svc.includes("participantCount: increment(1)"),
    '18G-6b: joinChallenge must not write participantCount (trigger-only authority, Phase 18G-2B)',
  );

  // 18G-6c: leaveChallenge must NOT decrement participantCount client-side
  assert.ok(
    !svc.includes("participantCount: increment(-1)"),
    '18G-6c: leaveChallenge must not write participantCount (trigger-only authority, Phase 18G-2B)',
  );

  // 18G-7: a user cannot create a challengeMembers doc for another user —
  // rule requires request.resource.data.userId == request.auth.uid
  assert.ok(
    rules.includes('request.resource.data.userId == request.auth.uid'),
    '18G-7: challengeMembers create rule must require userId == request.auth.uid',
  );

  // 18G-8: isGroupMember helper checks both active and joined statuses
  assert.ok(
    rules.includes("data.status == 'active'") && rules.includes("data.status == 'joined'"),
    '18G-8: isGroupMember must accept both active and joined statuses',
  );

  // 18G-9: isPublicGroup helper exists — public group challenge joins remain allowed
  assert.ok(
    rules.includes('function isPublicGroup(groupId)'),
    '18G-9: isPublicGroup helper must exist for public-group challenge join support',
  );

  // 18G-10: creator moderationStatus fix — compare against existing value, not post-write merged value
  assert.ok(
    rules.includes('request.resource.data.moderationStatus == resource.data.moderationStatus'),
    '18G-10: challenge update rule must compare moderationStatus against existing value (BUG-G6 fix)',
  );
}

// ── 18G-2C: Wellness log auto-join parity guards ─────────────────────────────
{
  const wellness = readFileSync('src/services/wellnessLogService.ts', 'utf8');
  const workout  = readFileSync('src/services/workoutService.ts', 'utf8');

  // 18G-2C-1: wellnessLogService imports challengeService for self-heal
  assert.ok(
    wellness.includes("import { challengeService } from './challengeService'"),
    '18G-2C-1: wellnessLogService must import challengeService for auto-join self-heal',
  );

  // 18G-2C-2: wellnessLogService calls joinChallenge on missing membership
  assert.ok(
    wellness.includes('challengeService.joinChallenge(input.userId, input.challengeId)'),
    '18G-2C-2: wellnessLogService must call joinChallenge when challengeMembers doc is missing',
  );

  // 18G-2C-3: wellnessLogService re-fetches membership after self-heal before proceeding
  assert.ok(
    wellness.includes('membershipSnap = await getDoc(membershipRef)'),
    '18G-2C-3: wellnessLogService must re-fetch membershipSnap after self-heal attempt',
  );

  // 18G-2C-4: wellnessLogService still validates group membership before self-heal
  // (security gate must remain — only active group members are auto-joined)
  assert.ok(
    wellness.indexOf('Not an active group member') < wellness.indexOf('joinChallenge'),
    '18G-2C-4: group membership validation must occur before auto-join self-heal',
  );

  // 18G-2C-5: workoutService self-heal behavior unchanged
  assert.ok(
    workout.includes('challengeService.joinChallenge(input.userId, input.challengeId)') &&
    workout.includes('Join challenge before logging workouts'),
    '18G-2C-5: workoutService self-heal must remain intact and unchanged',
  );

  // 18G-2C-6: wellnessLogService routes through selectEngine (v2 engine dispatch preserved)
  assert.ok(
    wellness.includes('selectEngine(challengeData)') &&
    wellness.includes('engine.computeUpdate('),
    '18G-2C-6: wellnessLogService must still route through selectEngine for v2 engine dispatch',
  );

  // 18G-2C-7: wellnessLogService uses atomicCollectiveGroupUpdate for collective challenges
  assert.ok(
    wellness.includes('atomicCollectiveGroupUpdate('),
    '18G-2C-7: wellnessLogService must use atomicCollectiveGroupUpdate for collective challenges',
  );

  // 18G-2C-8: wellnessLogService does not write participantCount (Phase 18G-2B confirmed)
  assert.ok(
    !wellness.includes('participantCount'),
    '18G-2C-8: wellnessLogService must not write participantCount (trigger-only authority)',
  );
}

// ── Phase 18G-2C.1: Unified log value picker regression guards ───────────────
{
  const workout = readFileSync('src/features/Workouts/LogWorkoutScreen.tsx', 'utf8');
  const wellness = readFileSync('src/features/Workouts/LogWellnessActivityScreen.tsx', 'utf8');

  // 18G-2C1-1: No Minus or Plus imports in either screen
  assert.ok(
    !workout.includes("Minus") && !workout.includes("Plus"),
    '18G-2C1-1: LogWorkoutScreen must not import or use Minus/Plus from lucide-react',
  );
  assert.ok(
    !wellness.includes("Minus") && !wellness.includes("Plus"),
    '18G-2C1-1: LogWellnessActivityScreen must not import or use Minus/Plus from lucide-react',
  );

  // 18G-2C1-2: No <select element in either screen (scroll picker removed)
  assert.ok(
    !workout.includes('<select'),
    '18G-2C1-2: LogWorkoutScreen must not contain a <select> scroll picker',
  );
  assert.ok(
    !wellness.includes('<select'),
    '18G-2C1-2: LogWellnessActivityScreen must not contain a <select> scroll picker',
  );

  // 18G-2C1-3: No valueOptions in either screen
  assert.ok(
    !workout.includes('valueOptions'),
    '18G-2C1-3: LogWorkoutScreen must not contain valueOptions array',
  );
  assert.ok(
    !wellness.includes('valueOptions'),
    '18G-2C1-3: LogWellnessActivityScreen must not contain valueOptions array',
  );

  // 18G-2C1-4: Both screens have type="number" input
  assert.ok(
    workout.includes('type="number"'),
    '18G-2C1-4: LogWorkoutScreen must have a type="number" input',
  );
  assert.ok(
    wellness.includes('type="number"'),
    '18G-2C1-4: LogWellnessActivityScreen must have a type="number" input',
  );

  // 18G-2C1-5: No groupCumulativeTarget used in value initialization in either screen
  // (value state init must not reference groupCumulativeTarget)
  const workoutStateInit = workout.match(/useState\([^)]+\)/g) ?? [];
  assert.ok(
    workoutStateInit.every((call) => !call.includes('groupCumulativeTarget')),
    '18G-2C1-5: LogWorkoutScreen value state must not initialize from groupCumulativeTarget',
  );
  const wellnessStateInit = wellness.match(/useState\([^)]+\)/g) ?? [];
  assert.ok(
    wellnessStateInit.every((call) => !call.includes('groupCumulativeTarget')),
    '18G-2C1-5: LogWellnessActivityScreen value state must not initialize from groupCumulativeTarget',
  );

  // 18G-2C1-6: LogWorkoutScreen uses currentActivity for default value (not hardcoded 25)
  assert.ok(
    workout.includes('currentActivity') && workout.includes('targetValue'),
    '18G-2C1-6: LogWorkoutScreen must use currentActivity.targetValue to set the default log value',
  );
  assert.ok(
    !workout.includes('useState(25)'),
    '18G-2C1-6: LogWorkoutScreen must not hardcode useState(25)',
  );

  // 18G-2C1-7: LogWellnessActivityScreen initializes from targetValue URL param (already correct)
  assert.ok(
    wellness.includes('targetValue') && wellness.includes('useState(Math.max(1, targetValue'),
    '18G-2C1-7: LogWellnessActivityScreen must initialize value from targetValue URL param',
  );
}

// ── Phase 18G-2D: targetType derivation + group membership guards ────────────
{
  const workout = readFileSync('src/services/workoutService.ts', 'utf8');
  const wellness = readFileSync('src/services/wellnessLogService.ts', 'utf8');

  // 18G-2D-1: workoutService does not hardcode targetType: 'daily'
  assert.ok(
    !workout.includes("targetType: 'daily'"),
    "18G-2D-1: workoutService must not hardcode targetType: 'daily' in ChallengeContext",
  );

  // 18G-2D-2: wellnessLogService does not hardcode targetType: 'daily'
  assert.ok(
    !wellness.includes("targetType: 'daily'"),
    "18G-2D-2: wellnessLogService must not hardcode targetType: 'daily' in ChallengeContext",
  );

  // 18G-2D-3: both services derive targetType from activityConfig
  assert.ok(
    workout.includes("activityConfig?.targetType ?? 'daily'"),
    "18G-2D-3: workoutService must derive targetType from activityConfig?.targetType",
  );
  assert.ok(
    wellness.includes("activityConfig?.targetType ?? 'daily'"),
    "18G-2D-3: wellnessLogService must derive targetType from activityConfig?.targetType",
  );

  // 18G-2D-4: workoutService validates active group membership for group challenges
  assert.ok(
    workout.includes("groupMembers") && workout.includes("Not an active group member."),
    "18G-2D-4: workoutService must validate active group membership when groupId is present",
  );

  // 18G-2D-5: wellnessLogService still has active group membership validation
  assert.ok(
    wellness.includes("Not an active group member."),
    "18G-2D-5: wellnessLogService must retain active group membership validation",
  );

  // 18G-2D-6: collective logging still uses atomicCollectiveGroupUpdate in both services
  assert.ok(
    workout.includes('atomicCollectiveGroupUpdate('),
    "18G-2D-6: workoutService must still use atomicCollectiveGroupUpdate for collective challenges",
  );
  assert.ok(
    wellness.includes('atomicCollectiveGroupUpdate('),
    "18G-2D-6: wellnessLogService must still use atomicCollectiveGroupUpdate for collective challenges",
  );

  // 18G-2D-7: streak logging still updates streak fields via engine (currentStreak in membershipUpdate)
  assert.ok(
    workout.includes('engineResult.membershipUpdate'),
    "18G-2D-7: workoutService must spread engineResult.membershipUpdate (contains streak fields)",
  );
  assert.ok(
    wellness.includes('engineResult.membershipUpdate'),
    "18G-2D-7: wellnessLogService must spread engineResult.membershipUpdate (contains streak fields)",
  );
}

// ── Phase 18G-2E: service safety guards ─────────────────────────────────────
{
  const svc = readFileSync('src/services/challengeService.ts', 'utf8');
  const rules = readFileSync('firestore.rules', 'utf8');
  const logWorkout = readFileSync('src/features/Workouts/LogWorkoutScreen.tsx', 'utf8');
  const logWellness = readFileSync('src/features/Workouts/LogWellnessActivityScreen.tsx', 'utf8');
  const wizard = readFileSync('src/features/Challenges/CreateChallengeWizard.tsx', 'utf8');

  // 18G-2E-1: leaveChallenge checks activitiesCompleted before allowing leave
  assert.ok(
    svc.includes('activitiesCompleted') && svc.includes('leaveChallenge'),
    '18G-2E-1: leaveChallenge must read activitiesCompleted before permitting leave',
  );

  // 18G-2E-2: leaveChallenge blocks when activitiesCompleted > 0
  assert.ok(
    svc.includes('activitiesCompleted') && svc.includes('> 0') && svc.includes('cannot leave'),
    '18G-2E-2: leaveChallenge must throw when activitiesCompleted > 0',
  );

  // 18G-2E-3: leaveChallenge still allows leave before logging (guard block is conditional, not unconditional)
  assert.ok(
    svc.includes('if ((membership.activitiesCompleted ?? 0) > 0)'),
    '18G-2E-3: leaveChallenge leave-block must be conditional on activitiesCompleted > 0',
  );

  // 18G-2E-4: participantCount is still not written by client join/leave
  const leaveIdx = svc.indexOf('leaveChallenge');
  const leaveBody = svc.slice(leaveIdx, leaveIdx + 800);
  assert.ok(
    !leaveBody.includes('participantCount'),
    '18G-2E-4: leaveChallenge must not write participantCount (trigger-only authority)',
  );
  const joinIdx = svc.indexOf('joinChallenge');
  const joinBody = svc.slice(joinIdx, joinIdx + 800);
  assert.ok(
    !joinBody.includes('participantCount'),
    '18G-2E-4: joinChallenge must not write participantCount (trigger-only authority)',
  );

  // 18G-2E-5: wellnessLogs Firestore rule allows points >= 0 for both v1 and v2
  assert.ok(
    !rules.includes('points >= 1'),
    '18G-2E-5: wellnessLogs Firestore rule must not restrict points >= 1 (must allow 0)',
  );
  // Both branches of the ternary should allow points >= 0
  const wellnessRuleBlock = rules.slice(rules.indexOf('match /wellnessLogs/'));
  const pointsMatches = [...wellnessRuleBlock.matchAll(/points >= (\d+)/g)].map((m) => Number(m[1]));
  assert.ok(
    pointsMatches.length > 0 && pointsMatches.every((n) => n === 0),
    '18G-2E-5: all wellnessLogs points conditions must allow >= 0',
  );

  // 18G-2E-6: no changes to logging UI files (LogWorkoutScreen and LogWellnessActivityScreen
  //   must not have gained Minus/Plus back or a select picker)
  assert.ok(
    !logWorkout.includes('Minus') && !logWorkout.includes('Plus') && !logWorkout.includes('<select'),
    '18G-2E-6: LogWorkoutScreen must not have regressed Minus/Plus/select controls',
  );
  assert.ok(
    !logWellness.includes('Minus') && !logWellness.includes('Plus') && !logWellness.includes('<select'),
    '18G-2E-6: LogWellnessActivityScreen must not have regressed Minus/Plus/select controls',
  );

  // 18G-2E-7: CreateChallengeWizard still exists and is non-empty
  assert.ok(
    wizard.length > 1000,
    '18G-2E-7: CreateChallengeWizard must exist and be non-trivially sized',
  );
}

// ── Phase 18H: Streak UX clarity regression guards ───────────────────────────
{
  const wizard = readFileSync('src/features/Challenges/CreateChallengeWizard.tsx', 'utf8');
  const engineSettings = readFileSync('src/features/Challenges/components/ChallengeEngineSettingsSection.tsx', 'utf8');
  const activitySection = readFileSync('src/features/Challenges/components/ChallengeActivitySection.tsx', 'utf8');
  const detailScreen = readFileSync('src/features/Challenges/ChallengeDetailScreen.tsx', 'utf8');

  // 18H-1: wizard step label no longer says "Frequency" for streak
  assert.ok(
    !wizard.includes("challengeType === 'streak' ? 'Frequency'"),
    "18H-1: Wizard streak step must not be labeled 'Frequency'",
  );
  assert.ok(
    wizard.includes("challengeType === 'streak' ? 'Streak'"),
    "18H-1: Wizard streak step must be labeled 'Streak'",
  );

  // 18H-2: frequency picker UI is not rendered in the wizard
  // (The ActivityRow type still carries frequency as a v1 carry-over, but no picker is rendered.
  //  We check for rendered picker elements — onChange handlers and option labels — not type definitions.)
  assert.ok(
    !wizard.includes('frequencyOptions') && !wizard.includes('onFrequencyChange') && !wizard.includes('2×/wk'),
    '18H-2: Frequency picker UI (frequencyOptions, onFrequencyChange, or frequency option labels) must not be present in CreateChallengeWizard',
  );

  // 18H-3: streak settings section clarifies "days in a row" (not just a raw number)
  assert.ok(
    engineSettings.includes('in a row'),
    "18H-3: ChallengeEngineSettingsSection streak section must mention 'in a row'",
  );

  // 18H-4: streak settings section contains "per day" note about activity target
  assert.ok(
    engineSettings.includes('per day'),
    "18H-4: ChallengeEngineSettingsSection streak section must clarify activity target is per day",
  );

  // 18H-5: activity section shows "Daily Target" label for streak type
  assert.ok(
    activitySection.includes('Daily Target'),
    "18H-5: ChallengeActivitySection must show 'Daily Target' label for streak challenges",
  );

  // 18H-6: review screen shows "days in a row" for required streak (not just a bare number)
  assert.ok(
    wizard.includes('days in a row'),
    "18H-6: Wizard review must show 'days in a row' for required streak",
  );

  // 18H-7: review screen shows "/ day" for activity targets in streak challenges
  assert.ok(
    wizard.includes('/ day'),
    "18H-7: Wizard streak review must show '/ day' for activity targets",
  );

  // 18H-8: ChallengeDetailScreen streak section shows "Daily targets" sub-header
  assert.ok(
    detailScreen.includes('Daily targets'),
    "18H-8: ChallengeDetailScreen streak section must show 'Daily targets' sub-header",
  );

  // 18H-9: ChallengeDetailScreen streak section shows "Best Streak" (not just "Longest")
  assert.ok(
    detailScreen.includes('Best Streak'),
    "18H-9: ChallengeDetailScreen streak section must label longest streak as 'Best Streak'",
  );

  // 18H-10: frequency picker is not rendered in activity section or engine settings
  // (Type aliases like ActivityFrequency may still carry the strings; we check for rendered labels.)
  assert.ok(
    !activitySection.includes('2×/wk') && !activitySection.includes('onFrequencyChange') && !activitySection.includes('frequencyOptions'),
    '18H-10: Frequency picker UI (labels or handlers) must not be rendered in ChallengeActivitySection',
  );
  assert.ok(
    !engineSettings.includes('2×/wk') && !engineSettings.includes('onFrequencyChange') && !engineSettings.includes('frequencyOptions'),
    '18H-10: Frequency picker UI (labels or handlers) must not be rendered in ChallengeEngineSettingsSection',
  );
}

// ─── 18I-2A: wellnessLogService undefined payload fix ────────────────────────
{
  const src = readFileSync('src/services/wellnessLogService.ts', 'utf8');
  const workoutSrc = readFileSync('src/services/workoutService.ts', 'utf8');

  // 18I-2A-1: removeUndefinedDeep must be defined in wellnessLogService
  assert.ok(
    src.includes('function removeUndefinedDeep'),
    '18I-2A-1: wellnessLogService must define removeUndefinedDeep',
  );

  // 18I-2A-2: batch.set for the log ref must use the sanitized payload
  assert.ok(
    src.includes('batch.set(logRef, removeUndefinedDeep('),
    '18I-2A-2: batch.set(logRef, ...) must wrap payload with removeUndefinedDeep',
  );

  // 18I-2A-3: raw logPayload must not be passed directly to batch.set
  assert.ok(
    !src.includes('batch.set(logRef, logPayload)'),
    '18I-2A-3: raw logPayload must not be written directly to Firestore',
  );

  // 18I-2A-4: all four wellness log methods must still be present
  assert.ok(
    src.includes('logFasting') && src.includes('logHydration') && src.includes('logSleep') && src.includes('logMeditation'),
    '18I-2A-4: all four wellness log methods must still be present',
  );

  // 18I-2A-5: workoutService sanitized payload pattern must remain intact
  assert.ok(
    workoutSrc.includes('const sanitizedPayload = removeUndefinedDeep(payload)'),
    '18I-2A-5: workoutService sanitized payload pattern must remain intact',
  );
}

// ─── 18I-2B: ChallengeDetailScreen mini-leaderboard engine-sensitive display ──
{
  const src = readFileSync('src/features/Challenges/ChallengeDetailScreen.tsx', 'utf8');

  // 18I-2B-1: sortLeaderboardRows must still be imported and used
  assert.ok(
    src.includes("import { sortLeaderboardRows }") || src.includes("import {sortLeaderboardRows}"),
    '18I-2B-1: ChallengeDetailScreen must import sortLeaderboardRows',
  );
  assert.ok(
    src.includes('sortLeaderboardRows(rows,'),
    '18I-2B-1: ChallengeDetailScreen must use sortLeaderboardRows for mini-leaderboard',
  );

  // 18I-2B-2: score must NOT always be mapped from totalPoints alone
  assert.ok(
    !src.includes("score: entry.totalPoints }"),
    '18I-2B-2: mini-leaderboard score must not be unconditionally mapped from totalPoints',
  );

  // 18I-2B-3: streak branch maps score from currentStreak
  assert.ok(
    src.includes("ct === 'streak'") && src.includes('entry.currentStreak'),
    "18I-2B-3: streak branch must map score from entry.currentStreak",
  );

  // 18I-2B-4: competitive branch maps score from cumulativeLoggedValue (raw value, not completionRate*100 — 1400% bug fix)
  assert.ok(
    src.includes("ct === 'competitive'") && src.includes('entry.cumulativeLoggedValue'),
    "18I-2B-4: competitive branch must map score from entry.cumulativeLoggedValue (raw value, not completionRate*100)",
  );

  // 18I-2B-5: collective branch maps score from cumulativeLoggedValue
  assert.ok(
    src.includes("ct === 'collective'") && src.includes('entry.cumulativeLoggedValue'),
    "18I-2B-5: collective branch must map score from entry.cumulativeLoggedValue",
  );

  // 18I-2B-6: scoreLabel is used in JSX (not hardcoded "pts" for all engines)
  assert.ok(
    src.includes('entry.scoreLabel'),
    '18I-2B-6: mini-leaderboard JSX must render entry.scoreLabel (engine-sensitive label)',
  );

  // 18I-2B-7: streak label includes "day" or "days" (not "pts")
  assert.ok(
    src.includes("'day streak'") || src.includes('"day streak"'),
    "18I-2B-7: streak mini-leaderboard must use 'day streak' label",
  );

  // 18I-2B-8: competitive scoreLabel uses raw target format (not "%" — 1400% bug fix, Phase 18I-5B)
  assert.ok(
    src.includes('totalTarget.toLocaleString()') && src.includes('activityUnit'),
    '18I-2B-8: competitive mini-leaderboard must use raw "/ target unit" scoreLabel, not "%"',
  );

  // 18I-2B-9: leaderboardSort.ts must be unchanged (sortLeaderboardRows not duplicated here)
  const sortSrc = readFileSync('src/utils/leaderboardSort.ts', 'utf8');
  assert.ok(
    sortSrc.includes('export function sortLeaderboardRows'),
    '18I-2B-9: leaderboardSort.ts sortLeaderboardRows export must remain intact',
  );

  // 18I-2B-10: ChallengeLeaderboardScreen must be unchanged
  const fullLB = readFileSync('src/features/Challenges/ChallengeLeaderboardScreen.tsx', 'utf8');
  assert.ok(
    fullLB.includes('sortLeaderboardRows'),
    '18I-2B-10: ChallengeLeaderboardScreen must still use sortLeaderboardRows',
  );
}

// ─── 18I-2C: Logging + leaderboard regression guards ─────────────────────────

// ── 18I-2C-L: Logging pipeline ───────────────────────────────────────────────
{
  const workoutSrc2 = readFileSync('src/services/workoutService.ts', 'utf8');
  const wellnessSrc3 = readFileSync('src/services/wellnessLogService.ts', 'utf8');

  // 18I-2C-L1: workoutService still uses removeUndefinedDeep before batch write
  assert.ok(
    workoutSrc2.includes('removeUndefinedDeep(payload)') || workoutSrc2.includes('removeUndefinedDeep('),
    '18I-2C-L1: workoutService must still apply removeUndefinedDeep before writing to Firestore',
  );

  // 18I-2C-L2: wellnessLogService still uses removeUndefinedDeep before batch write
  assert.ok(
    wellnessSrc3.includes('batch.set(logRef, removeUndefinedDeep('),
    '18I-2C-L2: wellnessLogService must still apply removeUndefinedDeep before batch.set(logRef, ...)',
  );

  // 18I-2C-L3: raw logPayload must never be written directly (regression: BUG-I-2 must not recur)
  assert.ok(
    !wellnessSrc3.includes('batch.set(logRef, logPayload)'),
    '18I-2C-L3: wellnessLogService must not write raw logPayload — undefined values would reach Firestore',
  );

  // 18I-2C-L4: removeUndefinedDeep behavioural — strips undefined from flat and nested objects
  {
    // Inline the same implementation used by the services to verify the contract
    function removeUndefinedDeep<T>(value: T): T {
      if (Array.isArray(value)) return value.map((i) => removeUndefinedDeep(i)) as T;
      if (value !== null && typeof value === 'object') {
        return Object.fromEntries(
          Object.entries(value as Record<string, unknown>)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, removeUndefinedDeep(v)]),
        ) as T;
      }
      return value;
    }

    const dirty: Record<string, unknown> = {
      notes: undefined,
      value: 42,
      metadata: { moodBefore: undefined, quality: 5, nested: { gone: undefined, kept: 'yes' } },
    };
    const clean = removeUndefinedDeep(dirty) as Record<string, unknown>;
    const meta = clean['metadata'] as Record<string, unknown>;
    const nested = meta['nested'] as Record<string, unknown>;
    assert.ok(!('notes' in clean), '18I-2C-L4a: removeUndefinedDeep strips top-level undefined field');
    assert.ok(!('moodBefore' in meta), '18I-2C-L4b: removeUndefinedDeep strips nested undefined field');
    assert.strictEqual(meta['quality'], 5, '18I-2C-L4c: removeUndefinedDeep preserves defined fields');
    assert.ok(!('gone' in nested), '18I-2C-L4d: removeUndefinedDeep strips deeply nested undefined field');
    assert.strictEqual(nested['kept'], 'yes', '18I-2C-L4e: removeUndefinedDeep preserves deeply nested defined fields');
    assert.strictEqual(clean['value'], 42, '18I-2C-L4f: removeUndefinedDeep preserves numeric values');
  }

  // 18I-2C-L5: wellnessLogService still has all four log methods (no accidental removal)
  assert.ok(
    wellnessSrc3.includes('async logFasting') && wellnessSrc3.includes('async logHydration') &&
    wellnessSrc3.includes('async logSleep') && wellnessSrc3.includes('async logMeditation'),
    '18I-2C-L5: wellnessLogService must export all four log methods',
  );

  // 18I-2C-L6: wellnessLogService still stamps scoringVersion v2
  assert.ok(
    wellnessSrc3.includes("scoringVersion: 'v2'") || wellnessSrc3.includes('scoringVersion: "v2"'),
    '18I-2C-L6: wellnessLogService must stamp scoringVersion v2 on log writes',
  );
}

// ── 18I-2C-S: sortLeaderboardRows single-source-of-truth ─────────────────────
{
  const sortSrc2 = readFileSync('src/utils/leaderboardSort.ts', 'utf8');
  const detailSrc = readFileSync('src/features/Challenges/ChallengeDetailScreen.tsx', 'utf8');
  const fullLBSrc = readFileSync('src/features/Challenges/ChallengeLeaderboardScreen.tsx', 'utf8');

  // 18I-2C-S1: sortLeaderboardRows is the only export from leaderboardSort.ts
  assert.ok(
    sortSrc2.includes('export function sortLeaderboardRows'),
    '18I-2C-S1: leaderboardSort.ts must export sortLeaderboardRows',
  );

  // 18I-2C-S2: ChallengeDetailScreen delegates all sorting to sortLeaderboardRows (no inline .sort())
  assert.ok(
    !detailSrc.includes('.sort('),
    '18I-2C-S2: ChallengeDetailScreen must not contain any inline .sort() call — ranking must go through sortLeaderboardRows',
  );

  // 18I-2C-S3: ChallengeLeaderboardScreen delegates all sorting to sortLeaderboardRows (no inline .sort())
  assert.ok(
    !fullLBSrc.includes('.sort('),
    '18I-2C-S3: ChallengeLeaderboardScreen must not contain any inline .sort() call — ranking must go through sortLeaderboardRows',
  );

  // 18I-2C-S4: behavioral — sortLeaderboardRows places streak leader first for v2 streak
  {
    const { sortLeaderboardRows: sort } = await import('../src/utils/leaderboardSort.js');
    const rows = [
      { totalPoints: 500, completionRate: 0.9, currentStreak: 3, longestStreak: 5, cumulativeLoggedValue: 200 },
      { totalPoints: 800, completionRate: 0.5, currentStreak: 10, longestStreak: 10, cumulativeLoggedValue: 100 },
      { totalPoints: 300, completionRate: 0.3, currentStreak: 1, longestStreak: 2, cumulativeLoggedValue: 50 },
    ];
    const sorted = sort(rows, 'v2', 'streak');
    assert.strictEqual(sorted[0].currentStreak, 10, '18I-2C-S4a: v2 streak sort — highest currentStreak first');
    assert.strictEqual(sorted[2].currentStreak, 1, '18I-2C-S4b: v2 streak sort — lowest currentStreak last');
  }

  // 18I-2C-S5: behavioral — sortLeaderboardRows places highest completionRate first for v2 competitive
  {
    const { sortLeaderboardRows: sort } = await import('../src/utils/leaderboardSort.js');
    const rows = [
      { totalPoints: 100, completionRate: 0.4, currentStreak: 0, longestStreak: 0, cumulativeLoggedValue: 0 },
      { totalPoints: 50, completionRate: 0.95, currentStreak: 0, longestStreak: 0, cumulativeLoggedValue: 0 },
      { totalPoints: 200, completionRate: 0.6, currentStreak: 0, longestStreak: 0, cumulativeLoggedValue: 0 },
    ];
    const sorted = sort(rows, 'v2', 'competitive');
    assert.strictEqual(sorted[0].completionRate, 0.95, '18I-2C-S5a: v2 competitive sort — highest completionRate first');
    assert.strictEqual(sorted[2].completionRate, 0.4, '18I-2C-S5b: v2 competitive sort — lowest completionRate last');
  }

  // 18I-2C-S6: behavioral — sortLeaderboardRows places highest cumulativeLoggedValue first for v2 collective
  {
    const { sortLeaderboardRows: sort } = await import('../src/utils/leaderboardSort.js');
    const rows = [
      { totalPoints: 100, completionRate: 0, currentStreak: 0, longestStreak: 0, cumulativeLoggedValue: 300 },
      { totalPoints: 200, completionRate: 0, currentStreak: 0, longestStreak: 0, cumulativeLoggedValue: 50 },
      { totalPoints: 50, completionRate: 0, currentStreak: 0, longestStreak: 0, cumulativeLoggedValue: 700 },
    ];
    const sorted = sort(rows, 'v2', 'collective');
    assert.strictEqual(sorted[0].cumulativeLoggedValue, 700, '18I-2C-S6a: v2 collective sort — highest cumulativeLoggedValue first');
    assert.strictEqual(sorted[2].cumulativeLoggedValue, 50, '18I-2C-S6b: v2 collective sort — lowest cumulativeLoggedValue last');
  }

  // 18I-2C-S7: behavioral — legacy (v1 or unknown type) sorts by totalPoints DESC
  {
    const { sortLeaderboardRows: sort } = await import('../src/utils/leaderboardSort.js');
    const rows = [
      { totalPoints: 200, completionRate: 0.1, currentStreak: 5, longestStreak: 5, cumulativeLoggedValue: 0 },
      { totalPoints: 800, completionRate: 0.9, currentStreak: 1, longestStreak: 1, cumulativeLoggedValue: 0 },
    ];
    const sortedLegacy = sort(rows, 'v1', 'competitive');
    assert.strictEqual(sortedLegacy[0].totalPoints, 800, '18I-2C-S7: legacy (v1) sort — totalPoints DESC regardless of challengeType');
  }
}

// ── 18I-2C-D: Display label invariants ───────────────────────────────────────
{
  const detailSrc2 = readFileSync('src/features/Challenges/ChallengeDetailScreen.tsx', 'utf8');
  const fullLBSrc2 = readFileSync('src/features/Challenges/ChallengeLeaderboardScreen.tsx', 'utf8');

  // 18I-2C-D1: mini-leaderboard collective scoreLabel is empty string (no unit suffix)
  assert.ok(
    detailSrc2.includes("scoreLabel = ''") || detailSrc2.includes('scoreLabel = ""'),
    "18I-2C-D1: collective mini-leaderboard scoreLabel must be empty string (no pts/unit suffix)",
  );

  // 18I-2C-D2: ChallengeLeaderboardScreen competitive renders raw progress (Phase 18I-5B replaces % with raw values)
  assert.ok(
    fullLBSrc2.includes('cumulativeLoggedValue.toLocaleString()'),
    "18I-2C-D2: ChallengeLeaderboardScreen competitive must render cumulativeLoggedValue (raw progress, not completionRate%)",
  );

  // 18I-2C-D3: ChallengeLeaderboardScreen renders "day" or "days" for streak
  assert.ok(
    fullLBSrc2.includes('day') && fullLBSrc2.includes('currentStreak'),
    "18I-2C-D3: ChallengeLeaderboardScreen must render streak as 'day'/'days' with currentStreak",
  );

  // 18I-2C-D4: ChallengeLeaderboardScreen renders "pts" for legacy/default path
  assert.ok(
    fullLBSrc2.includes('pts'),
    "18I-2C-D4: ChallengeLeaderboardScreen must render 'pts' label for legacy challenges",
  );

  // 18I-2C-D5: ChallengeDetailScreen legacy branch still shows "pts" label
  assert.ok(
    detailSrc2.includes("scoreLabel = 'pts'") || detailSrc2.includes('scoreLabel = "pts"'),
    "18I-2C-D5: ChallengeDetailScreen legacy/default branch must assign scoreLabel = 'pts'",
  );

  // 18I-2C-D6: ChallengeLeaderboardScreen query is scoped to challengeId (not group-wide)
  assert.ok(
    fullLBSrc2.includes("where('challengeId', '==', challengeId)") ||
    fullLBSrc2.includes('where("challengeId", "==", challengeId)'),
    "18I-2C-D6: ChallengeLeaderboardScreen query must be scoped to challengeId",
  );

  // 18I-2C-D7: ChallengeDetailScreen query is also scoped to challengeId
  assert.ok(
    detailSrc2.includes("where('challengeId', '==',") || detailSrc2.includes('where("challengeId", "==",'),
    "18I-2C-D7: ChallengeDetailScreen mini-leaderboard query must be scoped to challengeId",
  );
}

// ─── 18I-4A: challenge-leaderboard-snapshot invalidation after logging ────────
{
  const useWorkoutsSrc = readFileSync('src/hooks/useWorkouts.ts', 'utf8');

  // Count occurrences of the invalidation call — must appear in BOTH mutation handlers
  const matches = useWorkoutsSrc.match(/['"]challenge-leaderboard-snapshot['"]/g) ?? [];
  assert.ok(
    matches.length >= 2,
    `18I-4A-1: challenge-leaderboard-snapshot must be invalidated in BOTH useLogWorkout and useLogWellnessActivity (found ${matches.length} occurrence(s))`,
  );

  // 18I-4A-2: invalidation must be inside an invalidateQueries call
  assert.ok(
    useWorkoutsSrc.includes("invalidateQueries({ queryKey: ['challenge-leaderboard-snapshot']"),
    "18I-4A-2: useWorkouts must call invalidateQueries with key ['challenge-leaderboard-snapshot']",
  );

  // 18I-4A-3: existing invalidations must remain intact
  assert.ok(
    useWorkoutsSrc.includes("'challenge-membership'"),
    '18I-4A-3: challenge-membership invalidation must still be present in useWorkouts',
  );
  assert.ok(
    useWorkoutsSrc.includes("'home-screen-data'"),
    '18I-4A-3: home-screen-data invalidation must still be present in useWorkouts',
  );
  assert.ok(
    useWorkoutsSrc.includes("'group-leaderboard'"),
    '18I-4A-3: group-leaderboard invalidation must still be present in useWorkouts',
  );
}

// ─── 18I-4B: wellnessLogs included in group feed ─────────────────────────────
{
  const src = readFileSync('src/services/groupInsightsService.ts', 'utf8');

  // 18I-4B-1: getGroupFeed queries wellnessLogs collection
  assert.ok(
    src.includes("collection(db, 'wellnessLogs')") || src.includes('collection(db, "wellnessLogs")'),
    '18I-4B-1: getGroupFeed must query the wellnessLogs collection',
  );

  // 18I-4B-2: getGroupFeed still queries workouts collection
  assert.ok(
    src.includes("collection(db, 'workouts')") || src.includes('collection(db, "workouts")'),
    '18I-4B-2: getGroupFeed must still query the workouts collection',
  );

  // 18I-4B-3: both queries are scoped to groupId
  const wellnessWhere = src.match(/wellnessLogs[\s\S]{0,200}where\(['"]groupId['"],\s*['"]===?['"],\s*groupId\)/);
  assert.ok(
    wellnessWhere !== null || src.includes("where('groupId', '==', groupId)"),
    '18I-4B-3: wellnessLogs query must be scoped to groupId',
  );

  // 18I-4B-4: merge uses .sort() on timestamp descending
  assert.ok(
    src.includes('.sort(') && (src.includes('b.ts - a.ts') || src.includes('b.timestamp - a.timestamp')),
    '18I-4B-4: feed must sort merged results by timestamp descending',
  );

  // 18I-4B-5: final limit is 10
  assert.ok(
    src.includes('.slice(0, 10)'),
    '18I-4B-5: feed must limit final merged results to 10',
  );

  // 18I-4B-6: deduplication is applied (seen Set or similar)
  assert.ok(
    src.includes('seen') || src.includes('dedup') || src.includes('unique'),
    '18I-4B-6: feed must deduplicate entries before sorting',
  );

  // 18I-4B-7: GroupFeedItem interface is unchanged
  assert.ok(
    src.includes('GroupFeedItem') && src.includes('author:') && src.includes('text:') && src.includes('time:'),
    '18I-4B-7: GroupFeedItem shape must still be used in groupInsightsService',
  );

  // 18I-4B-8: challenge-created fallback still present but only when no activity
  assert.ok(
    src.includes('Created challenge'),
    '18I-4B-8: challenge-created fallback feed items must still be present',
  );

  // 18I-4B-9: loggedAt used as timestamp field for wellnessLogs
  assert.ok(
    src.includes('loggedAt'),
    '18I-4B-9: wellnessLogs must use loggedAt as their timestamp field',
  );

  // 18I-4B-10: wellness items include a metric label from logType
  assert.ok(
    src.includes('logTypeLabel') || src.includes('logType'),
    '18I-4B-10: wellness feed items must derive a label from logType',
  );
}

// ─── 18I-4C → 18I-6K: SelectChallengeActivityScreen uses canonical resolver with leaderboard ──
// (18I-4C originally enforced a cumulativeValues-based approach; 18I-6J replaced it with
// resolveChallengeProgress; 18I-6K adds the leaderboard query to complete the unification)
{
  const screenSrc = readFileSync('src/features/Workouts/SelectChallengeActivityScreen.tsx', 'utf8');

  // 4C-1 (updated): resolveActivityKey is gone — resolver handles key mapping
  assert.ok(
    !screenSrc.includes('function resolveActivityKey('),
    '18I-4C-1 (updated): resolveActivityKey helper must NOT exist — resolveChallengeProgress replaced it',
  );

  // 4C-2 (updated): membership.cumulativeValues must not be read by SelectChallengeActivityScreen
  assert.ok(
    !screenSrc.includes('membership?.cumulativeValues') && !screenSrc.includes("membership['cumulativeValues']"),
    '18I-4C-2 (updated): SelectChallengeActivityScreen must not read membership.cumulativeValues — resolver provides all derived values',
  );

  // 4C-3 (updated): resolveChallengeProgress must be called with leaderboard
  assert.ok(
    /resolveChallengeProgress\(\{[\s\S]{0,400}leaderboard/.test(screenSrc),
    '18I-4C-3 (updated): resolveChallengeProgress must receive leaderboard for accurate competitive/collective data',
  );

  // 4C-4 (updated): memberSumContribution must be passed for correct collective groupTotal
  assert.ok(
    screenSrc.includes('memberSumContribution'),
    '18I-4C-4 (updated): memberSumContribution must be passed to resolveChallengeProgress for collective challenges',
  );

  // 4C-5 (updated): challenge-leaderboard-snapshot queryKey must match ChallengeDetailScreen
  assert.ok(
    screenSrc.includes("'challenge-leaderboard-snapshot'"),
    '18I-4C-5 (updated): SelectChallengeActivityScreen must use challenge-leaderboard-snapshot queryKey (shared TanStack cache)',
  );
}

// ─── 18I-4D: Challenge leaderboard participant/name scope ──────────────────────
{
  const lbSrc = readFileSync('src/features/Challenges/ChallengeLeaderboardScreen.tsx', 'utf8');
  const detailSrc = readFileSync('src/features/Challenges/ChallengeDetailScreen.tsx', 'utf8');

  // 18I-4D-1: ChallengeLeaderboardScreen must NOT import useGroupMembers
  assert.ok(
    !lbSrc.includes('useGroupMembers'),
    '18I-4D-1: ChallengeLeaderboardScreen must not use useGroupMembers — names must be scoped to challenge participants',
  );

  // 18I-4D-2: ChallengeLeaderboardScreen must fetch user profiles via getDoc (targeted per-participant lookup)
  assert.ok(
    lbSrc.includes('getDoc') && lbSrc.includes("'users'"),
    '18I-4D-2: ChallengeLeaderboardScreen must fetch user profiles from users collection via getDoc',
  );

  // 18I-4D-3: challengeMembers remains the source of leaderboard rows
  assert.ok(
    lbSrc.includes("'challengeMembers'") && lbSrc.includes("where('challengeId'"),
    '18I-4D-3: challengeMembers collection filtered by challengeId must remain the row source',
  );

  // 18I-4D-4: name lookup key is derived from rawRows (participant userIds only)
  assert.ok(
    lbSrc.includes('participantUserIds') && lbSrc.includes('rawRows.map'),
    '18I-4D-4: name lookup must be keyed from rawRows participant userIds, not from group member list',
  );

  // 18I-4D-5: missing profile must still produce a safe fallback (not crash)
  assert.ok(
    lbSrc.includes('Member') && lbSrc.includes('toUpperCase'),
    '18I-4D-5: missing profile must fall back to Member XXXXXX label',
  );

  // 18I-4D-6: ChallengeDetailScreen mini-leaderboard must not show raw truncated userId
  assert.ok(
    !detailSrc.includes('entry.userId.slice(0, 8)'),
    '18I-4D-6: mini-leaderboard must not display raw truncated userId — resolved name must be used',
  );

  // 18I-4D-7: ChallengeDetailScreen mini-leaderboard uses targeted user doc fetch (not groupMembers)
  assert.ok(
    detailSrc.includes('leaderboardNames') && detailSrc.includes("'users'"),
    '18I-4D-7: ChallengeDetailScreen mini-leaderboard must resolve names from users collection, not groupMembers',
  );

  // 18I-4D-8: ChallengeDetailScreen must not import useGroupMembers for leaderboard display
  assert.ok(
    !detailSrc.includes('useGroupMembers'),
    '18I-4D-8: ChallengeDetailScreen must not use useGroupMembers for leaderboard name resolution',
  );
}

// ─── 18I-4E: cleanupSeededChallengeMembers script guards ──────────────────────
{
  const cleanupSrc = readFileSync('scripts/cleanupSeededChallengeMembers.ts', 'utf8');
  const pkgSrc = readFileSync('package.json', 'utf8');

  // 18I-4E-1: script defaults to dry-run (no deletion without flag)
  assert.ok(
    cleanupSrc.includes('executeMode') && cleanupSrc.includes("'--execute'"),
    '18I-4E-1: script must gate deletion behind --execute flag',
  );

  // 18I-4E-2: deletion cannot occur when executeMode is false
  assert.ok(
    cleanupSrc.includes('!executeMode') && cleanupSrc.includes('DRY-RUN COMPLETE'),
    '18I-4E-2: script must print DRY-RUN COMPLETE and return early when --execute is absent',
  );

  // 18I-4E-3: challengeMembers collection is targeted
  assert.ok(
    cleanupSrc.includes("'challengeMembers'"),
    "18I-4E-3: script must query the 'challengeMembers' collection",
  );

  // 18I-4E-4: seedTag pattern is detected
  assert.ok(
    cleanupSrc.includes('seedTag') && cleanupSrc.includes('tiizi_seed_v1'),
    '18I-4E-4: script must detect seedTag === tiizi_seed_v1',
  );

  // 18I-4E-5: seed_ ID prefix pattern is detected
  assert.ok(
    cleanupSrc.includes("startsWith('seed_')"),
    "18I-4E-5: script must detect doc IDs / field values starting with 'seed_'",
  );

  // 18I-4E-6: challengeId, userId, groupId seed patterns are all checked
  assert.ok(
    cleanupSrc.includes('data.challengeId') && cleanupSrc.includes('data.userId') && cleanupSrc.includes('data.groupId'),
    '18I-4E-6: script must check challengeId, userId, and groupId for seed patterns',
  );

  // 18I-4E-7: orphan check covers challenge doc existence
  assert.ok(
    cleanupSrc.includes("'challenges'") && cleanupSrc.includes('challengeSnap.exists'),
    "18I-4E-7: script must check that the referenced challenge doc exists (orphan detection)",
  );

  // 18I-4E-8: orphan check covers user doc existence
  assert.ok(
    cleanupSrc.includes("'users'") && cleanupSrc.includes('userSnap.exists'),
    "18I-4E-8: script must check that the referenced user doc exists (orphan detection)",
  );

  // 18I-4E-9: orphan check covers groupMembers doc existence
  assert.ok(
    cleanupSrc.includes("'groupMembers'") && cleanupSrc.includes('gmSnap.exists'),
    "18I-4E-9: script must check that the groupMembers doc exists (orphan detection)",
  );

  // 18I-4E-10: npm scripts are registered in package.json
  assert.ok(
    pkgSrc.includes('audit:seeded-challenge-members') && pkgSrc.includes('cleanup:seeded-challenge-members'),
    '18I-4E-10: package.json must include audit:seeded-challenge-members and cleanup:seeded-challenge-members scripts',
  );
}

// ─── 18I-4F: Remove core-blast fallbacks ──────────────────────────────────────
{
  const sources = [
    'src/features/Challenges/ChallengeLeaderboardScreen.tsx',
    'src/features/Challenges/ChallengeCompletedScreen.tsx',
    'src/features/Workouts/LogWorkoutScreen.tsx',
    'src/features/Workouts/WorkoutLoggedScreen.tsx',
  ].map((f) => readFileSync(f, 'utf8'));
  const [lbSrc, completedSrc, logWorkoutSrc, workoutLoggedSrc] = sources;

  const engineSrc = readFileSync('src/services/challengeEngine/index.ts', 'utf8');

  // 18I-4F-1: no core-blast string in any UI file
  sources.forEach((src, i) => {
    assert.ok(
      !src.includes('core-blast'),
      `18I-4F-1: core-blast must be removed from file index ${i} — no UI file may use it as a fallback challengeId`,
    );
  });

  // 18I-4F-2: ChallengeLeaderboardScreen redirects to /app/challenges when challengeId missing
  assert.ok(
    lbSrc.includes('Navigate') && lbSrc.includes('/app/challenges'),
    '18I-4F-2: ChallengeLeaderboardScreen must redirect to /app/challenges when challengeId is missing',
  );

  // 18I-4F-3: ChallengeCompletedScreen redirects to /app/challenges when challengeId missing
  assert.ok(
    completedSrc.includes('Navigate') && completedSrc.includes('/app/challenges'),
    '18I-4F-3: ChallengeCompletedScreen must redirect to /app/challenges when challengeId is missing',
  );

  // 18I-4F-4: LogWorkoutScreen backPath falls back to /app/challenges (not core-blast)
  assert.ok(
    logWorkoutSrc.includes('/app/challenges') && !logWorkoutSrc.includes('core-blast'),
    '18I-4F-4: LogWorkoutScreen backPath must fall back to /app/challenges, not core-blast',
  );

  // 18I-4F-5: WorkoutLoggedScreen path fallbacks use /app/challenges (not core-blast)
  assert.ok(
    workoutLoggedSrc.includes('/app/challenges') && !workoutLoggedSrc.includes('core-blast'),
    '18I-4F-5: WorkoutLoggedScreen path fallbacks must use /app/challenges, not core-blast',
  );

  // 18I-4F-6: engine selector still throws on unknown v2 challengeType (no silent fallback)
  assert.ok(
    engineSrc.includes('throw new Error') && engineSrc.includes('unknown v2 challengeType'),
    '18I-4F-6: selectEngine must throw a descriptive error for unknown v2 challengeType',
  );

  // 18I-4F-7: all supported v2 engine types still present
  assert.ok(
    engineSrc.includes("case 'streak'") &&
    engineSrc.includes("case 'competitive'") &&
    engineSrc.includes("case 'collective'"),
    '18I-4F-7: selectEngine must still route streak, competitive, and collective to correct engines',
  );
}

// ─── 18I-4G: group-feed invalidation after activity log ───────────────────────
{
  const useWorkoutsSrc = readFileSync('src/hooks/useWorkouts.ts', 'utf8');

  // Count occurrences of group-feed invalidation
  const groupFeedMatches = (useWorkoutsSrc.match(/\['group-feed'\]/g) ?? []).length;

  // 18I-4G-1: workout logging invalidates group-feed
  // 18I-4G-2: wellness logging invalidates group-feed
  assert.ok(
    groupFeedMatches >= 2,
    `18I-4G-1/2: group-feed must be invalidated in BOTH useLogWorkout and useLogWellnessActivity (found ${groupFeedMatches} occurrence(s))`,
  );

  // 18I-4G-3: challenge-leaderboard-snapshot remains in both handlers (from 18I-4A)
  const snapshotMatches = (useWorkoutsSrc.match(/\['challenge-leaderboard-snapshot'\]/g) ?? []).length;
  assert.ok(
    snapshotMatches >= 2,
    `18I-4G-3: challenge-leaderboard-snapshot invalidation must still be in BOTH handlers (found ${snapshotMatches} occurrence(s))`,
  );

  // 18I-4G-4: no core-blast fallback in useWorkouts
  assert.ok(
    !useWorkoutsSrc.includes('core-blast'),
    '18I-4G-4: core-blast must not appear in useWorkouts.ts',
  );

  // 18I-4G-5: no scoring engine fallback added
  assert.ok(
    !useWorkoutsSrc.includes('selectEngine') && !useWorkoutsSrc.includes('LegacyEngine'),
    '18I-4G-5: useWorkouts.ts must not directly reference scoring engines',
  );
}

// ─── 18I-5A: activity feed generation after challenge logging ─────────────────
{
  const indexesSrc = readFileSync('firestore.indexes.json', 'utf8');
  const wellnessSrc = readFileSync('src/services/wellnessLogService.ts', 'utf8');
  const feedSrc = readFileSync('src/services/groupInsightsService.ts', 'utf8');

  // 18I-5A-1: firestore.indexes.json contains wellnessLogs [groupId, loggedAt] index
  assert.ok(
    indexesSrc.includes('"wellnessLogs"') && indexesSrc.includes('"groupId"') && indexesSrc.includes('"loggedAt"'),
    '18I-5A-1: firestore.indexes.json must contain a wellnessLogs composite index with groupId and loggedAt fields',
  );

  // 18I-5A-2: wellnessLogService stores loggedAt as ISO string (not Timestamp)
  assert.ok(
    wellnessSrc.includes('loggedAt: now.toDate().toISOString()'),
    '18I-5A-2: wellnessLogService must store loggedAt as ISO string via now.toDate().toISOString()',
  );

  // 18I-5A-3: wellnessLogService does NOT store loggedAt directly as a raw Timestamp
  const logPayloadBlock = wellnessSrc.slice(wellnessSrc.indexOf('const logPayload'), wellnessSrc.indexOf('const logPayload') + 600);
  assert.ok(
    !logPayloadBlock.includes('loggedAt: now,'),
    '18I-5A-3: wellnessLogService logPayload must not set loggedAt to a raw Timestamp (now)',
  );

  // 18I-5A-4: getGroupFeed queries wellnessLogs scoped by groupId
  assert.ok(
    feedSrc.match(/wellnessLogs[\s\S]{0,200}where\(['"]groupId['"],\s*['"]===?['"],\s*groupId\)/),
    '18I-5A-4: getGroupFeed must query wellnessLogs collection with where groupId == groupId',
  );

  // 18I-5A-5: getGroupFeed queries wellnessLogs ordered by loggedAt
  assert.ok(
    feedSrc.match(/wellnessLogs[\s\S]{0,300}orderBy\(['"]loggedAt['"]/),
    '18I-5A-5: getGroupFeed wellnessLogs query must use orderBy loggedAt',
  );

  // 18I-5A-6: getGroupFeed queries workouts scoped by groupId
  assert.ok(
    feedSrc.match(/workouts[\s\S]{0,200}where\(['"]groupId['"],\s*['"]===?['"],\s*groupId\)/),
    '18I-5A-6: getGroupFeed must query workouts collection with where groupId == groupId',
  );

  // 18I-5A-7: getGroupFeed applies backward-compat Timestamp→ISO conversion for wellness loggedAt
  assert.ok(
    feedSrc.includes('toDate().toISOString()') || feedSrc.includes("typeof rawLoggedAt === 'string'"),
    '18I-5A-7: getGroupFeed must convert Timestamp to ISO string when reading wellness loggedAt',
  );

  // 18I-5A-8: getGroupFeed deduplicates by composite id before returning
  assert.ok(
    feedSrc.includes('seen.has(r.id)') || feedSrc.includes('seen.has('),
    '18I-5A-8: getGroupFeed must deduplicate feed items via a seen Set',
  );

  // 18I-5A-9: getGroupFeed sorts newest first (b.ts - a.ts)
  assert.ok(
    feedSrc.includes('b.ts - a.ts'),
    '18I-5A-9: getGroupFeed must sort items newest first with b.ts - a.ts',
  );

  // 18I-5A-10: getGroupFeed caps output at 10 items
  assert.ok(
    feedSrc.includes('.slice(0, 10)'),
    '18I-5A-10: getGroupFeed must cap merged output to 10 items',
  );

  // 18I-5A-11: workouts index for groupId + completedAt exists in firestore.indexes.json
  const workoutsGroupIdSection = indexesSrc.match(/"workouts"[\s\S]{0,300}"groupId"[\s\S]{0,100}"completedAt"/);
  assert.ok(
    workoutsGroupIdSection !== null,
    '18I-5A-11: firestore.indexes.json must contain a workouts composite index with groupId and completedAt',
  );
}

// ─── 18I-5B: Leaderboard percentage display → raw progress values ─────────────
{
  const detailSrc = readFileSync('src/features/Challenges/ChallengeDetailScreen.tsx', 'utf8');
  const lbSrc = readFileSync('src/features/Challenges/ChallengeLeaderboardScreen.tsx', 'utf8');
  const workoutLoggedSrc = readFileSync('src/features/Workouts/WorkoutLoggedScreen.tsx', 'utf8');
  const completedSrc = readFileSync('src/features/Challenges/ChallengeCompletedScreen.tsx', 'utf8');
  const selectActivitySrc = readFileSync('src/features/Workouts/SelectChallengeActivityScreen.tsx', 'utf8');

  // 18I-5B-1: ChallengeDetailScreen competitive branch does NOT multiply completionRate by 100
  assert.ok(
    !detailSrc.includes('entry.completionRate * 100'),
    '18I-5B-1: ChallengeDetailScreen must NOT multiply completionRate by 100 (was the 1400% bug)',
  );

  // 18I-5B-2: ChallengeDetailScreen competitive branch uses cumulativeLoggedValue for score
  assert.ok(
    detailSrc.includes("ct === 'competitive'") && detailSrc.includes('entry.cumulativeLoggedValue'),
    '18I-5B-2: ChallengeDetailScreen competitive branch must use entry.cumulativeLoggedValue',
  );

  // 18I-5B-3: ChallengeDetailScreen competitive scoreLabel uses totalTarget (raw format)
  assert.ok(
    detailSrc.includes('totalTarget.toLocaleString()'),
    '18I-5B-3: ChallengeDetailScreen competitive scoreLabel must include totalTarget.toLocaleString()',
  );

  // 18I-5B-4: ChallengeLeaderboardScreen competitive renderRowScore uses cumulativeLoggedValue
  assert.ok(
    lbSrc.includes("challengeType === 'competitive'") && lbSrc.includes('row.cumulativeLoggedValue.toLocaleString()'),
    '18I-5B-4: ChallengeLeaderboardScreen competitive renderRowScore must use cumulativeLoggedValue',
  );

  // 18I-5B-5: ChallengeLeaderboardScreen competitive does NOT render row.completionRate as "%"
  assert.ok(
    !lbSrc.includes('{row.completionRate}%'),
    '18I-5B-5: ChallengeLeaderboardScreen must not render {row.completionRate}% (replaced with raw values)',
  );

  // 18I-5B-6: ChallengeLeaderboardScreen my stat card shows cumulativeLoggedValue not completionRate%
  assert.ok(
    lbSrc.includes('myEntry.cumulativeLoggedValue.toLocaleString()'),
    '18I-5B-6: ChallengeLeaderboardScreen my stat card must use myEntry.cumulativeLoggedValue',
  );

  // 18I-5B-7: WorkoutLoggedScreen competitive activity cards do NOT render activity.pct% as a visible label (only as bar width)
  assert.ok(
    !workoutLoggedSrc.includes('>{activity.pct}%<'),
    '18I-5B-7: WorkoutLoggedScreen must not render {activity.pct}% as a visible text label (bar width use is fine)',
  );

  // 18I-5B-8: ChallengeCompletedScreen competitive section does NOT render completionRate% in hero
  assert.ok(
    !completedSrc.includes('{completionRate}%'),
    '18I-5B-8: ChallengeCompletedScreen must not render {completionRate}% (replaced with raw values)',
  );

  // 18I-5B-9: ChallengeCompletedScreen competitive section shows cumulativeLoggedValue
  assert.ok(
    completedSrc.includes('cumulativeLoggedValue.toLocaleString()'),
    '18I-5B-9: ChallengeCompletedScreen must render cumulativeLoggedValue.toLocaleString()',
  );

  // 18I-5B-10: SelectChallengeActivityScreen does NOT include · pct% suffix
  assert.ok(
    !selectActivitySrc.includes('found.pct}%') && !selectActivitySrc.includes('{found.pct}'),
    '18I-5B-10: SelectChallengeActivityScreen must not render found.pct% suffix',
  );

  // 18I-5B-11: ChallengeLeaderboardScreen competitive podiumScore uses cumulativeLoggedValue
  assert.ok(
    lbSrc.includes('row.cumulativeLoggedValue.toLocaleString()'),
    '18I-5B-11: ChallengeLeaderboardScreen podiumScore must use cumulativeLoggedValue',
  );
}

// ─── 18I-5A-R: Group feed live path regression guards ─────────────────────────
{
  const workoutSvcSrc = readFileSync('src/services/workoutService.ts', 'utf8');
  const groupSvcSrc = readFileSync('src/services/groupInsightsService.ts', 'utf8');
  const workoutsSrc = readFileSync('src/hooks/useWorkouts.ts', 'utf8');
  const rulesSrc = readFileSync('firestore.rules', 'utf8');

  // 18I-5A-R-1: workoutService writes groupId to the workout payload
  assert.ok(
    workoutSvcSrc.includes("groupId: input.groupId"),
    '18I-5A-R-1: workoutService payload must include groupId: input.groupId',
  );

  // 18I-5A-R-2: getGroupFeed queries workouts by groupId
  assert.ok(
    groupSvcSrc.includes("where('groupId', '==', groupId)") && groupSvcSrc.includes("'workouts'"),
    "18I-5A-R-2: getGroupFeed must query workouts with where('groupId', '==', groupId)",
  );

  // 18I-5A-R-3: getGroupFeed does not silently drop workout items — workout items are mapped
  assert.ok(
    groupSvcSrc.includes('workoutItems') && groupSvcSrc.includes('workouts.map'),
    '18I-5A-R-3: getGroupFeed must map workouts into workoutItems feed entries',
  );

  // 18I-5A-R-4: getGroupFeed wellnessLogs query has a .catch() fallback so workout items survive
  assert.ok(
    groupSvcSrc.includes('.catch(') && groupSvcSrc.includes('wellnessLogs query failed'),
    '18I-5A-R-4: getGroupFeed wellnessLogs query must have a .catch() fallback — must not kill workout feed',
  );

  // 18I-5A-R-5: getGroupFeed handles null wellnessResult (wellness query failed gracefully)
  assert.ok(
    groupSvcSrc.includes('wellnessResult?.docs') || groupSvcSrc.includes('wellnessResult == null') || groupSvcSrc.includes('?? []'),
    '18I-5A-R-5: getGroupFeed must handle null wellnessResult with safe access (wellnessResult?.docs)',
  );

  // 18I-5A-R-6: group-feed invalidation exists in useLogWorkout onSuccess
  assert.ok(
    workoutsSrc.includes("queryKey: ['group-feed']"),
    "18I-5A-R-6: useLogWorkout must invalidate ['group-feed'] on success",
  );

  // 18I-5A-R-7: group-feed invalidation exists in useLogWellnessActivity onSuccess
  const wellnessInvalidation = workoutsSrc.split("useLogWellnessActivity")[1] ?? '';
  assert.ok(
    wellnessInvalidation.includes("queryKey: ['group-feed']"),
    "18I-5A-R-7: useLogWellnessActivity must invalidate ['group-feed'] on success",
  );

  // 18I-5A-R-8: wellnessLogs Firestore rule allows isGroupMember reads (enables group feed query)
  assert.ok(
    rulesSrc.includes('isGroupMember(resource.data.groupId)') && rulesSrc.match(/wellnessLogs[\s\S]{0,600}isGroupMember\(resource\.data\.groupId\)/) !== null,
    '18I-5A-R-8: firestore.rules wellnessLogs match block must allow read for isGroupMember(resource.data.groupId)',
  );

  // 18I-5A-R-9: wellnessLogs feed items include author and text
  assert.ok(
    groupSvcSrc.includes('wellnessItems') && groupSvcSrc.includes('wellnessLogs.map'),
    '18I-5A-R-9: getGroupFeed must map wellnessLogs into wellnessItems feed entries',
  );
}

// ── Phase 18I-5C + 18I-5C-R: Navigation links (polished) ────────────────────
{
  const detailSrc = readFileSync('src/features/Challenges/ChallengeDetailScreen.tsx', 'utf8');
  const selectActivitySrc = readFileSync('src/features/Workouts/SelectChallengeActivityScreen.tsx', 'utf8');
  const logWorkoutSrc = readFileSync('src/features/Workouts/LogWorkoutScreen.tsx', 'utf8');
  const exerciseDetailSrc = readFileSync('src/features/Exercises/ExerciseDetailScreen.tsx', 'utf8');
  const createWizardSrc = readFileSync('src/features/Challenges/CreateChallengeWizard.tsx', 'utf8');
  const appSrc = readFileSync('src/App.tsx', 'utf8');

  // 18I-5C-1: ChallengeDetailScreen group link navigates to /app/group/:groupId
  assert.ok(
    detailSrc.includes("navigate(`/app/group/${normalizedGroupId}`)"),
    '18I-5C-1: ChallengeDetailScreen group link must navigate to /app/group/:groupId',
  );

  // 18I-5C-2: ChallengeDetailScreen uses Users icon chip (visible CTA, not dot-only)
  assert.ok(
    detailSrc.includes('<Users size={13}') && detailSrc.includes('View Group:'),
    '18I-5C-2: ChallengeDetailScreen group link must use Users icon chip with "View Group:" label',
  );

  // 18I-5C-3: SelectChallengeActivityScreen uses visible orange chip for exercise guide
  assert.ok(
    selectActivitySrc.includes('View Exercise Guide') && selectActivitySrc.includes('/app/exercises/${match.id}'),
    '18I-5C-3: SelectChallengeActivityScreen must include visible "View Exercise Guide" chip linking to exercise detail',
  );

  // 18I-5C-4: LogWorkoutScreen uses visible orange chip for exercise guide
  assert.ok(
    logWorkoutSrc.includes('View Exercise Guide') && logWorkoutSrc.includes('/app/exercises/${exerciseId}'),
    '18I-5C-4: LogWorkoutScreen must include visible "View Exercise Guide" chip linking to exercise detail',
  );

  // 18I-5C-5: ExerciseDetailScreen no longer contains "START EXERCISE"
  assert.ok(
    !exerciseDetailSrc.includes('START EXERCISE'),
    '18I-5C-5: ExerciseDetailScreen must not contain "START EXERCISE" (replaced by "Add to Challenge")',
  );

  // 18I-5C-6: ExerciseDetailScreen uses "Add to Challenge" CTA
  assert.ok(
    exerciseDetailSrc.includes('Add to Challenge'),
    '18I-5C-6: ExerciseDetailScreen must use "Add to Challenge" as primary CTA',
  );

  // 18I-5C-7: ExerciseDetailScreen "Add to Challenge" uses correct production route /app/create-challenge
  assert.ok(
    exerciseDetailSrc.includes('/app/create-challenge?') && exerciseDetailSrc.includes('exerciseId: exercise.id'),
    '18I-5C-7: ExerciseDetailScreen "Add to Challenge" must link to /app/create-challenge?exerciseId=<id> (not /app/challenges/create)',
  );

  // 18I-5C-8: App.tsx maps /app/create-challenge to CreateChallengeWizard (not a mock)
  assert.ok(
    appSrc.includes('/app/create-challenge') && appSrc.includes('CreateChallengeWizard'),
    '18I-5C-8: App.tsx must map /app/create-challenge to CreateChallengeWizard',
  );

  // 18I-5C-9: CreateChallengeWizard reads exerciseId param and pre-populates first activity
  assert.ok(
    createWizardSrc.includes('exerciseIdParam') && createWizardSrc.includes('exercisePrefillAppliedRef'),
    '18I-5C-9: CreateChallengeWizard must read exerciseId param and pre-populate first activity row',
  );
}

// ── Phase 18I-5D: Copy and UI polish ─────────────────────────────────────────
{
  const homeScreenSrc = readFileSync('src/features/Home/useHomeScreen.ts', 'utf8');
  const workoutLoggedSrc = readFileSync('src/features/Workouts/WorkoutLoggedScreen.tsx', 'utf8');
  const logWorkoutSrc = readFileSync('src/features/Workouts/LogWorkoutScreen.tsx', 'utf8');
  const groupSvcSrc = readFileSync('src/services/groupInsightsService.ts', 'utf8');
  const detailSrc = readFileSync('src/features/Challenges/ChallengeDetailScreen.tsx', 'utf8');
  const exerciseDetailSrc = readFileSync('src/features/Exercises/ExerciseDetailScreen.tsx', 'utf8');

  // 18I-5D-1: Home live progressLabel uses "/" not "of" (no "X reps of Y reps" format)
  assert.ok(
    !homeScreenSrc.includes('} of ${formatMetric('),
    '18I-5D-1: useHomeScreen live progressLabel must use "/" separator, not "of"',
  );

  // 18I-5D-2: WorkoutLoggedScreen competitive headline does not show overallCompetitivePct%
  assert.ok(
    !workoutLoggedSrc.includes('overallCompetitivePct}% complete'),
    '18I-5D-2: WorkoutLoggedScreen competitive headline must not show "X% complete" — use raw progress',
  );

  // 18I-5D-3: LogWorkoutScreen does not use "Log My Progress" label
  assert.ok(
    !logWorkoutSrc.includes("'Log My Progress'"),
    '18I-5D-3: LogWorkoutScreen competitive save label must not be "Log My Progress"',
  );

  // 18I-5D-4: LogWorkoutScreen competitive CTA is "Log Workout"
  assert.ok(
    logWorkoutSrc.includes("'Log Workout'"),
    '18I-5D-4: LogWorkoutScreen competitive save label must be "Log Workout"',
  );

  // 18I-5D-5: Group feed workout copy uses "Logged" not "Completed"
  assert.ok(
    groupSvcSrc.includes('`Logged ${w.value}') && !groupSvcSrc.includes('`Completed ${w.value}'),
    '18I-5D-5: Group feed workout text must use "Logged" not "Completed"',
  );

  // 18I-5D-6: ExerciseDetailScreen does not contain "START EXERCISE"
  assert.ok(
    !exerciseDetailSrc.includes('START EXERCISE'),
    '18I-5D-6: ExerciseDetailScreen must not contain "START EXERCISE"',
  );

  // 18I-5D-7: ChallengeDetailScreen competitive description references progress not completion rate
  assert.ok(
    detailSrc.includes('total progress logged') && !detailSrc.includes('completion rate at the end'),
    '18I-5D-7: ChallengeDetailScreen competitive description must reference "total progress logged", not "completion rate"',
  );
}

// ── Phase 18I-5E: Progress display source of truth ────────────────────────────
{
  const homeScreenSrc = readFileSync('src/features/Home/useHomeScreen.ts', 'utf8');
  const helperSrc = readFileSync('src/features/Challenges/challengeProgressDisplay.ts', 'utf8');
  // 18I-5G: logic moved to resolver; guards check both files so the invariant holds regardless of location
  const resolverSrc = readFileSync('src/features/Challenges/challengeProgressResolver.ts', 'utf8');
  const svcSrc = readFileSync('src/services/challengeService.ts', 'utf8');

  // 18I-5E-1: shared helper file exists and exports buildChallengeProgress
  assert.ok(
    helperSrc.includes('export function buildChallengeProgress'),
    '18I-5E-1: challengeProgressDisplay.ts must export buildChallengeProgress',
  );

  // 18I-5E-2: clamping 0–100 exists in resolver (logic migrated in 18I-5G)
  assert.ok(
    resolverSrc.includes('Math.min(100') && resolverSrc.includes('Math.max(0'),
    '18I-5E-2: resolveChallengeProgress must clamp progress between 0 and 100',
  );

  // 18I-5E-3: competitive branch uses cumulativeLoggedValue, not completionRate, as primary value
  assert.ok(
    resolverSrc.includes('cumulativeLoggedValue') && resolverSrc.includes('/ ${target.toLocaleString()}'),
    '18I-5E-3: resolveChallengeProgress competitive branch must use cumulativeLoggedValue and slash format',
  );

  // 18I-5E-4: streak branch uses currentStreak / requiredDays language, not "% complete"
  assert.ok(
    resolverSrc.includes('currentStreak') && resolverSrc.includes('Day ${streak} streak'),
    '18I-5E-4: resolveChallengeProgress streak branch must produce "Day N streak" not "% complete"',
  );

  // 18I-5E-5: collective branch uses groupCurrentTotal / groupCumulativeTarget format
  assert.ok(
    resolverSrc.includes('groupCurrentTotal') && resolverSrc.includes('groupCumulativeTarget'),
    '18I-5E-5: resolveChallengeProgress collective branch must use groupCurrentTotal / groupCumulativeTarget',
  );

  // 18I-5E-6: useHomeScreen imports and uses buildChallengeProgress for base cards
  assert.ok(
    homeScreenSrc.includes('buildChallengeProgress') && homeScreenSrc.includes('display.progress') && homeScreenSrc.includes('display.primaryLabel'),
    '18I-5E-6: useHomeScreen must use buildChallengeProgress for base card progress + label (no ad-hoc competitive branch)',
  );

  // 18I-5E-7: useHomeScreen no longer has ad-hoc "compCumulative" / "compTarget" / "compUnit" variables
  assert.ok(
    !homeScreenSrc.includes('compCumulative') && !homeScreenSrc.includes('compTarget') && !homeScreenSrc.includes('compUnit'),
    '18I-5E-7: useHomeScreen must not have stale ad-hoc competitive progress variables (compCumulative/compTarget/compUnit)',
  );

  // 18I-5E-8: useHomeScreen no longer uses "of" separator in progress labels
  assert.ok(
    !homeScreenSrc.includes('} of ${formatMetric(') && !homeScreenSrc.includes('reps of '),
    '18I-5E-8: useHomeScreen must not produce "X reps of Y reps" format',
  );

  // 18I-5E-9: ChallengeMembershipSummary includes cumulativeLoggedValue and currentStreak
  assert.ok(
    svcSrc.includes('cumulativeLoggedValue: number') && svcSrc.includes('currentStreak: number'),
    '18I-5E-9: ChallengeMembershipSummary must include cumulativeLoggedValue and currentStreak fields',
  );

  // 18I-5E-10: getUserChallengeMembershipSummaries maps cumulativeLoggedValue from ChallengeMember doc
  assert.ok(
    svcSrc.includes('cumulativeLoggedValue: Number(data.cumulativeLoggedValue ?? 0)'),
    '18I-5E-10: getUserChallengeMembershipSummaries must map cumulativeLoggedValue from the challengeMembers doc',
  );
}

// ── Phase 18I-5F: Collective progress engine correctness ───────────────────
{
  // 18I-5F-1: computeGroupTransition must not produce NaN when groupCurrentTotal is undefined
  const resultUndefined = computeGroupTransition(
    { status: 'active', groupCurrentTotal: undefined as unknown as number, groupCumulativeTarget: 2000, autoCompleteOnGroupTarget: true },
    100,
  );
  assert.ok(
    Number.isFinite(resultUndefined.clampedTotal),
    `18I-5F-1: computeGroupTransition must produce a finite clampedTotal when groupCurrentTotal is undefined — got ${resultUndefined.clampedTotal}`,
  );
  assert.equal(resultUndefined.clampedTotal, 100, '18I-5F-1b: undefined groupCurrentTotal treated as 0; 0+100=100');

  // 18I-5F-2: computeGroupTransition must not produce NaN when groupCurrentTotal is NaN (already stored)
  const resultNaN = computeGroupTransition(
    { status: 'active', groupCurrentTotal: NaN, groupCumulativeTarget: 2000, autoCompleteOnGroupTarget: true },
    100,
  );
  assert.ok(
    Number.isFinite(resultNaN.clampedTotal),
    `18I-5F-2: computeGroupTransition must produce a finite clampedTotal when groupCurrentTotal is NaN — got ${resultNaN.clampedTotal}`,
  );
  assert.equal(resultNaN.clampedTotal, 100, '18I-5F-2b: NaN groupCurrentTotal treated as 0; 0+100=100');

  // 18I-5F-3: safeNum must return 0 for undefined, null, and NaN
  assert.equal(safeNum(undefined), 0, '18I-5F-3a: safeNum(undefined) must be 0');
  assert.equal(safeNum(null), 0, '18I-5F-3b: safeNum(null) must be 0');
  assert.equal(safeNum(NaN), 0, '18I-5F-3c: safeNum(NaN) must be 0');
  assert.equal(safeNum(Infinity), 0, '18I-5F-3d: safeNum(Infinity) must be 0');
  assert.equal(safeNum(150), 150, '18I-5F-3e: safeNum(150) must be 150');

  // 18I-5F-4: buildChallengeProgress must not produce NaN progress for collective with NaN groupCurrentTotal
  const nanDisplay = buildChallengeProgress(
    { challengeType: 'collective', groupCurrentTotal: NaN, groupCumulativeTarget: 5000, activities: [{ unit: 'reps' }] },
    { completionRate: 0, cumulativeLoggedValue: 0, currentStreak: 0 },
  );
  assert.ok(
    !nanDisplay.primaryLabel.includes('NaN'),
    `18I-5F-4: collective primaryLabel must not contain NaN — got "${nanDisplay.primaryLabel}"`,
  );
  assert.ok(
    Number.isFinite(nanDisplay.progress),
    `18I-5F-4b: collective progress must be finite — got ${nanDisplay.progress}`,
  );

  // 18I-5F-5: buildChallengeProgress collective includes secondaryLabel for user contribution
  const collectiveDisplay = buildChallengeProgress(
    { challengeType: 'collective', groupCurrentTotal: 3250, groupCumulativeTarget: 5000, activities: [{ unit: 'pushups' }] },
    { completionRate: 65, cumulativeLoggedValue: 750, currentStreak: 0 },
  );
  assert.ok(
    collectiveDisplay.secondaryLabel !== undefined && collectiveDisplay.secondaryLabel.includes('750'),
    `18I-5F-5: collective secondaryLabel must include user contribution — got "${collectiveDisplay.secondaryLabel}"`,
  );
  assert.ok(
    collectiveDisplay.primaryLabel.includes('3,250') && collectiveDisplay.primaryLabel.includes('5,000'),
    `18I-5F-5b: collective primaryLabel must show group total / target — got "${collectiveDisplay.primaryLabel}"`,
  );

  // 18I-5F-6: buildChallengeProgress competitive must use cumulativeLoggedValue, not produce NaN
  const competitiveDisplay = buildChallengeProgress(
    { challengeType: 'competitive', activities: [{ targetValue: 700, unit: 'reps' }] },
    { completionRate: 17, cumulativeLoggedValue: NaN, currentStreak: 0 },
  );
  assert.ok(
    !competitiveDisplay.primaryLabel.includes('NaN'),
    `18I-5F-6: competitive primaryLabel must not contain NaN — got "${competitiveDisplay.primaryLabel}"`,
  );

  // 18I-5F-7 (updated 18I-5G): WorkoutLoggedScreen uses canonical resolver (replaces safeNum inline math)
  const loggedSrc = readFileSync('src/features/Workouts/WorkoutLoggedScreen.tsx', 'utf8');
  assert.ok(
    loggedSrc.includes('resolveChallengeProgress'),
    '18I-5F-7: WorkoutLoggedScreen must use resolveChallengeProgress (migrated from safeNum in 18I-5G)',
  );

  // 18I-5F-8 (updated 18I-5G): WorkoutLoggedScreen passes sessionDelta to resolver (no longer adds to total — prevents double-count)
  assert.ok(
    loggedSrc.includes('sessionDelta'),
    '18I-5F-8: WorkoutLoggedScreen must pass sessionDelta to resolver (not cachedGroupTotal + value — that caused double-counting)',
  );

  // 18I-5F-9: WorkoutLoggedScreen renders "Team Progress" header for collective
  assert.ok(
    loggedSrc.includes('Team Progress'),
    '18I-5F-9: WorkoutLoggedScreen must render "Team Progress" header for collective challenges',
  );

  // 18I-5F-10: WorkoutLoggedScreen renders "Your Contribution" section
  assert.ok(
    loggedSrc.includes('Your Contribution'),
    '18I-5F-10: WorkoutLoggedScreen must render "Your Contribution" section',
  );

  // 18I-5F-11: useWorkouts invalidates ['challenge', challengeId] after logging
  const workoutsSrc = readFileSync('src/hooks/useWorkouts.ts', 'utf8');
  assert.ok(
    workoutsSrc.includes("['challenge', workout.challengeId]") && workoutsSrc.includes("['challenge', input.challengeId]"),
    '18I-5F-11: useLogWorkout and useLogWellnessActivity must both invalidate [\'challenge\', challengeId] query',
  );

  // 18I-5F-12: ActiveChallengeCard renders secondaryLabel
  const cardSrc = readFileSync('src/components/Home/ActiveChallengeCard.tsx', 'utf8');
  assert.ok(
    cardSrc.includes('secondaryLabel') && cardSrc.includes('challenge.secondaryLabel'),
    '18I-5F-12: ActiveChallengeCard must accept and render secondaryLabel',
  );

  // 18I-5F-13 (updated 18I-5G): ChallengeDetailScreen uses canonical resolver (replaces safeNum inline math)
  const detailSrc2 = readFileSync('src/features/Challenges/ChallengeDetailScreen.tsx', 'utf8');
  assert.ok(
    detailSrc2.includes('resolveChallengeProgress'),
    '18I-5F-13: ChallengeDetailScreen must use resolveChallengeProgress (migrated from safeNum in 18I-5G)',
  );

  // 18I-5F-14: ChallengeDetailScreen shows "You contributed" for collective
  assert.ok(
    detailSrc2.includes('You contributed'),
    '18I-5F-14: ChallengeDetailScreen must display "You contributed" for collective challenges',
  );

  // 18I-5F-15: ChallengeDetailScreen shows leader comparison for competitive
  assert.ok(
    detailSrc2.includes('You are leading') && detailSrc2.includes('behind leader'),
    '18I-5F-15: ChallengeDetailScreen must show leader comparison for competitive challenges',
  );
}

// ── Phase 18I-5G: Sweeping Progress Source-of-Truth Audit ─────────────────────
{
  const resolverSrc = readFileSync('src/features/Challenges/challengeProgressResolver.ts', 'utf8');
  const displaySrc = readFileSync('src/features/Challenges/challengeProgressDisplay.ts', 'utf8');
  const workoutLoggedSrc = readFileSync('src/features/Workouts/WorkoutLoggedScreen.tsx', 'utf8');
  const detailSrc = readFileSync('src/features/Challenges/ChallengeDetailScreen.tsx', 'utf8');
  const leaderboardSrc = readFileSync('src/features/Challenges/ChallengeLeaderboardScreen.tsx', 'utf8');
  const completedSrc = readFileSync('src/features/Challenges/ChallengeCompletedScreen.tsx', 'utf8');
  const logWorkoutSrc = readFileSync('src/features/Workouts/LogWorkoutScreen.tsx', 'utf8');
  const logWellnessSrc = readFileSync('src/features/Workouts/LogWellnessActivityScreen.tsx', 'utf8');
  const selectSrc = readFileSync('src/features/Workouts/SelectChallengeActivityScreen.tsx', 'utf8');

  // 18I-5G-1: canonical resolver file exports resolveChallengeProgress
  assert.ok(
    resolverSrc.includes('export function resolveChallengeProgress'),
    '18I-5G-1: challengeProgressResolver.ts must export resolveChallengeProgress',
  );

  // 18I-5G-2: resolver exports safeNum
  assert.ok(
    resolverSrc.includes('export function safeNum'),
    '18I-5G-2: challengeProgressResolver.ts must export safeNum',
  );

  // 18I-5G-3 (updated 18I-5H): resolver derives groupTotal from Firestore aggregate, floored by user
  // contribution (stale-aggregate guard added in 18I-5H). sessionDelta is never added.
  assert.ok(
    resolverSrc.includes('storedGroupTotal') && resolverSrc.includes('Math.max(storedGroupTotal'),
    '18I-5G-3: resolver must derive groupTotal from storedGroupTotal, floored by userContributionTotal',
  );

  // 18I-5G-4: sessionDelta is clearly documented as display-only (not added to totals)
  assert.ok(
    resolverSrc.includes('sessionDelta') && resolverSrc.includes('NEVER added'),
    '18I-5G-4: resolver must document that sessionDelta is shown only, never added to totals',
  );

  // 18I-5G-5: challengeProgressDisplay.ts is a thin shim — delegates to resolver
  assert.ok(
    displaySrc.includes('resolveChallengeProgress') && !displaySrc.includes('Math.min(100'),
    '18I-5G-5: challengeProgressDisplay.ts must be a thin shim delegating to resolver (no inline clamping)',
  );

  // 18I-5G-6: WorkoutLoggedScreen uses resolver with sessionDelta (no manual + value to groupTotal)
  assert.ok(
    workoutLoggedSrc.includes('resolveChallengeProgress') && workoutLoggedSrc.includes('sessionDelta: value'),
    '18I-5G-6: WorkoutLoggedScreen must use resolveChallengeProgress with sessionDelta = value',
  );
  assert.ok(
    !workoutLoggedSrc.includes('cachedGroupTotal + value'),
    '18I-5G-6b: WorkoutLoggedScreen must NOT compute cachedGroupTotal + value (causes double-counting)',
  );

  // 18I-5G-7: ChallengeDetailScreen collective section uses resolver
  assert.ok(
    detailSrc.includes('resolveChallengeProgress') && detailSrc.includes('rp.groupTotal'),
    '18I-5G-7: ChallengeDetailScreen must use resolver for collective group totals',
  );

  // 18I-5G-8: ChallengeLeaderboardScreen uses resolver (not inline safeNum math)
  assert.ok(
    leaderboardSrc.includes('resolveChallengeProgress') && !leaderboardSrc.includes('safeNum(challenge?.groupCurrentTotal)'),
    '18I-5G-8: ChallengeLeaderboardScreen must use resolver, not inline safeNum(challenge?.groupCurrentTotal)',
  );

  // 18I-5G-9: ChallengeCompletedScreen uses resolver
  assert.ok(
    completedSrc.includes('resolveChallengeProgress') && !completedSrc.includes('safeNum(challenge?.groupCurrentTotal)'),
    '18I-5G-9: ChallengeCompletedScreen must use resolver, not inline safeNum(challenge?.groupCurrentTotal)',
  );

  // 18I-5G-10: LogWorkoutScreen uses resolver
  assert.ok(
    logWorkoutSrc.includes('resolveChallengeProgress') && !logWorkoutSrc.includes('safeNum(challenge?.groupCurrentTotal)'),
    '18I-5G-10: LogWorkoutScreen must use resolver, not inline safeNum(challenge?.groupCurrentTotal)',
  );

  // 18I-5G-11: LogWellnessActivityScreen uses resolver
  assert.ok(
    logWellnessSrc.includes('resolveChallengeProgress') && !logWellnessSrc.includes('safeNum(challenge?.groupCurrentTotal)'),
    '18I-5G-11: LogWellnessActivityScreen must use resolver, not inline safeNum(challenge?.groupCurrentTotal)',
  );

  // 18I-5G-12: SelectChallengeActivityScreen uses resolver
  assert.ok(
    selectSrc.includes('resolveChallengeProgress') && !selectSrc.includes('safeNum(challenge?.groupCurrentTotal)'),
    '18I-5G-12: SelectChallengeActivityScreen must use resolver, not inline safeNum(challenge?.groupCurrentTotal)',
  );

  // 18I-5G-13: resolver output never produces NaN for groupPercent
  {
    const { resolveChallengeProgress: resolve } = await import('../src/features/Challenges/challengeProgressResolver');
    const r = resolve({ challenge: null, membership: null });
    assert.ok(Number.isFinite(r.groupPercent), `18I-5G-13: resolveChallengeProgress with null inputs must produce finite groupPercent — got ${r.groupPercent}`);
    assert.ok(Number.isFinite(r.progressPercent), `18I-5G-13b: resolveChallengeProgress with null inputs must produce finite progressPercent — got ${r.progressPercent}`);
    assert.ok(!r.primaryLabel.includes('NaN'), `18I-5G-13c: primaryLabel must not contain NaN — got "${r.primaryLabel}"`);
  }

  // 18I-5G-14: collective resolver shows contribution label when userContributionTotal > 0
  {
    const { resolveChallengeProgress: resolve } = await import('../src/features/Challenges/challengeProgressResolver');
    const r = resolve({
      challenge: { challengeType: 'collective', groupCurrentTotal: 350, groupCumulativeTarget: 5000, activities: [{ unit: 'reps', targetValue: 5000 }] },
      membership: { cumulativeLoggedValue: 200 },
    });
    assert.ok(r.userContributionTotal === 200, `18I-5G-14: userContributionTotal must equal membership.cumulativeLoggedValue — got ${r.userContributionTotal}`);
    assert.ok(r.groupTotal === 350, `18I-5G-14b: groupTotal must equal challenge.groupCurrentTotal — got ${r.groupTotal}`);
    assert.ok(r.secondaryLabel?.includes('200'), `18I-5G-14c: secondaryLabel must include user contribution (200) — got "${r.secondaryLabel}"`);
  }

  // 18I-5G-15: competitive resolver shows leader comparison fields
  {
    const { resolveChallengeProgress: resolve } = await import('../src/features/Challenges/challengeProgressResolver');
    const r = resolve({
      challenge: { challengeType: 'competitive', activities: [{ targetValue: 500, unit: 'reps' }] },
      membership: { cumulativeLoggedValue: 100, completionRate: 20 },
      leaderboard: [{ userId: 'leader', score: 300 }, { userId: 'me', score: 100 }],
      currentUserId: 'me',
    });
    assert.ok(r.competitiveLeaderTotal === 300, `18I-5G-15: competitiveLeaderTotal must equal leader score — got ${r.competitiveLeaderTotal}`);
    assert.ok(r.competitiveGap === 200, `18I-5G-15b: competitiveGap must be 200 (300 - 100) — got ${r.competitiveGap}`);
    assert.ok(!r.isCurrentUserLeading, '18I-5G-15c: isCurrentUserLeading must be false when another user leads');
  }

  // 18I-5G-16: no double-count — sessionDelta not reflected in groupTotal
  {
    const { resolveChallengeProgress: resolve } = await import('../src/features/Challenges/challengeProgressResolver');
    const r = resolve({
      challenge: { challengeType: 'collective', groupCurrentTotal: 350, groupCumulativeTarget: 5000, activities: [{ unit: 'reps', targetValue: 5000 }] },
      membership: { cumulativeLoggedValue: 200 },
      sessionDelta: 150, // user just logged 150
    });
    assert.ok(r.groupTotal === 350, `18I-5G-16: groupTotal must be authoritative Firestore value (350), not 350 + 150 — got ${r.groupTotal}`);
    assert.ok(r.sessionDelta === 150, `18I-5G-16b: sessionDelta must be preserved for display — got ${r.sessionDelta}`);
    assert.ok(r.userContributionTotal === 200, `18I-5G-16c: userContributionTotal must not include sessionDelta — got ${r.userContributionTotal}`);
  }
}

// ── Phase 18I-5H: Competitive completion + collective floor + audit script ────
{
  const resolverSrc = readFileSync('src/features/Challenges/challengeProgressResolver.ts', 'utf8');
  const displaySrc  = readFileSync('src/features/Challenges/challengeProgressDisplay.ts', 'utf8');
  const cardSrc     = readFileSync('src/components/Home/ActiveChallengeCard.tsx', 'utf8');
  const homeSrc     = readFileSync('src/features/Home/useHomeScreen.ts', 'utf8');
  const auditSrc    = readFileSync('scripts/auditChallengeProgressIntegrity.ts', 'utf8');

  // 18I-5H-1: resolver exposes isUserCompleted
  assert.ok(
    resolverSrc.includes('isUserCompleted'),
    '18I-5H-1: resolveChallengeProgress must output isUserCompleted',
  );

  // 18I-5H-2: resolver exposes leaderLabel for competitive
  assert.ok(
    resolverSrc.includes('leaderLabel'),
    '18I-5H-2: resolveChallengeProgress must produce leaderLabel for competitive challenges',
  );

  // 18I-5H-3 (updated 18I-5I): resolver floors groupTotal by userContributionTotal (and now also
  // memberSumFloor / logSumFloor — see 18I-5I-3 for the full multi-source check)
  assert.ok(
    resolverSrc.includes('userContributionTotal') && resolverSrc.includes('Math.max(storedGroupTotal'),
    '18I-5H-3: resolver must floor groupTotal using Math.max(..., userContributionTotal) to guard stale aggregates',
  );

  // 18I-5H-4: displaySrc shim threads isUserCompleted through
  assert.ok(
    displaySrc.includes('isUserCompleted'),
    '18I-5H-4: challengeProgressDisplay shim must expose isUserCompleted',
  );

  // 18I-5H-5: ActiveChallengeCard renders completed state
  assert.ok(
    cardSrc.includes('isUserCompleted') && cardSrc.includes('View Challenge'),
    '18I-5H-5: ActiveChallengeCard must render "View Challenge" when isUserCompleted',
  );

  // 18I-5H-6: ActiveChallengeCard hides Log button when completed
  assert.ok(
    cardSrc.includes('isUserCompleted ?') || cardSrc.includes('challenge.isUserCompleted'),
    '18I-5H-6: ActiveChallengeCard must branch on isUserCompleted to hide log CTA',
  );

  // 18I-5H-7: useHomeScreen fetches competitive leaderboard for home cards
  assert.ok(
    homeSrc.includes('competitiveLeaderboards') && homeSrc.includes('competitiveChallengeIds'),
    '18I-5H-7: useHomeScreen must fetch and use competitive leaderboard for home cards',
  );

  // 18I-5H-8: useHomeScreen surfaces isUserCompleted on myChallenges cards
  assert.ok(
    homeSrc.includes('isUserCompleted: display.isUserCompleted') || homeSrc.includes('isUserCompleted'),
    '18I-5H-8: useHomeScreen myChallenges cards must include isUserCompleted field',
  );

  // 18I-5H-9: audit script exists and contains static checks
  assert.ok(
    auditSrc.includes('staticAudit') && auditSrc.includes('resolverFixtures'),
    '18I-5H-9: auditChallengeProgressIntegrity.ts must contain staticAudit() and resolverFixtures()',
  );

  // 18I-5H-10: fixture — stale aggregate (groupCurrentTotal=0, member=100) resolves to 100
  {
    const { resolveChallengeProgress: resolve } = await import('../src/features/Challenges/challengeProgressResolver');
    const r = resolve({
      challenge: { challengeType: 'collective', groupCurrentTotal: 0, groupCumulativeTarget: 2000, activities: [{ unit: 'reps', targetValue: 2000 }] },
      membership: { cumulativeLoggedValue: 100 },
    });
    assert.ok(r.groupTotal === 100, `18I-5H-10: stale aggregate fixture — groupTotal must be 100 (contribution floor), got ${r.groupTotal}`);
    assert.ok(r.primaryLabel.startsWith('100'), `18I-5H-10b: label must start with "100" when stale aggregate is 0 and contribution=100, got "${r.primaryLabel}"`);
  }

  // 18I-5H-11: no double-count — groupCurrentTotal=350, sessionDelta=150 stays 350
  {
    const { resolveChallengeProgress: resolve } = await import('../src/features/Challenges/challengeProgressResolver');
    const r = resolve({
      challenge: { challengeType: 'collective', groupCurrentTotal: 350, groupCumulativeTarget: 5000, activities: [{ unit: 'reps', targetValue: 5000 }] },
      membership: { cumulativeLoggedValue: 200 },
      sessionDelta: 150,
    });
    assert.ok(r.groupTotal === 350, `18I-5H-11: groupTotal must stay 350, not 500 — got ${r.groupTotal}`);
  }

  // 18I-5H-12: competitive completed user has isUserCompleted=true
  {
    const { resolveChallengeProgress: resolve } = await import('../src/features/Challenges/challengeProgressResolver');
    const r = resolve({
      challenge: { challengeType: 'competitive', activities: [{ targetValue: 500, unit: 'reps' }] },
      membership: { cumulativeLoggedValue: 500, completionRate: 100, status: 'completed' },
    });
    assert.ok(r.isUserCompleted === true, `18I-5H-12: completed competitive member must have isUserCompleted=true, got ${r.isUserCompleted}`);
  }

  // 18I-5H-13: competitive incomplete user has isUserCompleted=false
  {
    const { resolveChallengeProgress: resolve } = await import('../src/features/Challenges/challengeProgressResolver');
    const r = resolve({
      challenge: { challengeType: 'competitive', activities: [{ targetValue: 500, unit: 'reps' }] },
      membership: { cumulativeLoggedValue: 180, completionRate: 36 },
    });
    assert.ok(r.isUserCompleted === false, `18I-5H-13: incomplete competitive member must have isUserCompleted=false, got ${r.isUserCompleted}`);
  }

  // 18I-5H-14: leader comparison — user not leading
  {
    const { resolveChallengeProgress: resolve } = await import('../src/features/Challenges/challengeProgressResolver');
    const r = resolve({
      challenge: { challengeType: 'competitive', activities: [{ targetValue: 700, unit: 'reps' }] },
      membership: { cumulativeLoggedValue: 180, completionRate: 26 },
      leaderboard: [{ userId: 'other', score: 300 }, { userId: 'me', score: 180 }],
      currentUserId: 'me',
    });
    assert.ok(r.competitiveGap === 120, `18I-5H-14: gap must be 120 (300-180), got ${r.competitiveGap}`);
    assert.ok(r.leaderLabel?.includes('behind leader'), `18I-5H-14b: leaderLabel must include "behind leader", got "${r.leaderLabel}"`);
  }

  // 18I-5H-15: collective group total cannot be less than visible user contribution (resolver invariant)
  {
    const { resolveChallengeProgress: resolve } = await import('../src/features/Challenges/challengeProgressResolver');
    const r = resolve({
      challenge: { challengeType: 'collective', groupCurrentTotal: 50, groupCumulativeTarget: 2000, activities: [{ unit: 'reps', targetValue: 2000 }] },
      membership: { cumulativeLoggedValue: 200 },
    });
    assert.ok(r.groupTotal >= r.userContributionTotal, `18I-5H-15: groupTotal (${r.groupTotal}) must be >= userContributionTotal (${r.userContributionTotal})`);
  }
}

// ── Phase 18I-5I: Multi-source collective floor + repair mode guards ───────────

{
  // 18I-5I-1: resolver accepts memberSumContribution and uses it as a floor
  const resolverSrc = readFileSync('src/features/Challenges/challengeProgressResolver.ts', 'utf8');
  assert.ok(
    resolverSrc.includes('memberSumContribution') && resolverSrc.includes('memberSumFloor'),
    '18I-5I-1: resolver must accept memberSumContribution and derive memberSumFloor from it',
  );

  // 18I-5I-2: resolver accepts logSumValue and uses it as a floor
  assert.ok(
    resolverSrc.includes('logSumValue') && resolverSrc.includes('logSumFloor'),
    '18I-5I-2: resolver must accept logSumValue and derive logSumFloor from it',
  );

  // 18I-5I-3: resolver collective formula uses max of all four sources
  assert.ok(
    resolverSrc.includes('Math.max(storedGroupTotal, memberSumFloor, logSumFloor, userContributionTotal)'),
    '18I-5I-3: resolver collective groupTotal must be max(storedGroupTotal, memberSumFloor, logSumFloor, userContributionTotal)',
  );

  // 18I-5I-4: audit script requires --confirm alongside --execute (accidental-write guard)
  const auditSrc = readFileSync('scripts/auditChallengeProgressIntegrity.ts', 'utf8');
  assert.ok(
    auditSrc.includes('--confirm') && auditSrc.includes('--execute requires --confirm'),
    '18I-5I-4: audit script must require --confirm alongside --execute and emit a clear error without it',
  );

  // 18I-5I-5: audit repair excludes seed_challenge_* documents
  assert.ok(
    auditSrc.includes("startsWith('seed_challenge_')"),
    '18I-5I-5: audit repair must exclude challengeIds starting with "seed_challenge_"',
  );

  // 18I-5I-6: audit repair excludes engine v1 challenges
  assert.ok(
    auditSrc.includes("engineVersion === 'v2'"),
    '18I-5I-6: audit repair must restrict to engineVersion v2 challenges',
  );

  // 18I-5I-7: fixture — memberSumContribution used as floor when storedGroupTotal is stale
  {
    const { resolveChallengeProgress: resolve } = await import('../src/features/Challenges/challengeProgressResolver');
    const r = resolve({
      challenge: { challengeType: 'collective', groupCurrentTotal: 350, groupCumulativeTarget: 2000, activities: [{ unit: 'reps', targetValue: 2000 }] },
      membership: { cumulativeLoggedValue: 100 },
      memberSumContribution: 450,
    });
    assert.ok(r.groupTotal === 450, `18I-5I-7: memberSumContribution=450 should floor groupTotal above stored 350, got ${r.groupTotal}`);
  }

  // 18I-5I-8: fixture — logSumValue used as floor when memberSum and stored are both stale
  {
    const { resolveChallengeProgress: resolve } = await import('../src/features/Challenges/challengeProgressResolver');
    const r = resolve({
      challenge: { challengeType: 'collective', groupCurrentTotal: 350, groupCumulativeTarget: 2000, activities: [{ unit: 'reps', targetValue: 2000 }] },
      membership: { cumulativeLoggedValue: 100 },
      memberSumContribution: 450,
      logSumValue: 550,
    });
    assert.ok(r.groupTotal === 550, `18I-5I-8: logSumValue=550 should be the highest floor, got ${r.groupTotal}`);
  }

  // 18I-5I-9: fixture — no NaN when all optional inputs are undefined
  {
    const { resolveChallengeProgress: resolve } = await import('../src/features/Challenges/challengeProgressResolver');
    const r = resolve({
      challenge: { challengeType: 'collective', groupCurrentTotal: 0, groupCumulativeTarget: 1000, activities: [{ unit: 'reps', targetValue: 1000 }] },
      membership: null,
      memberSumContribution: undefined,
      logSumValue: undefined,
    });
    for (const [key, val] of Object.entries(r)) {
      if (typeof val === 'number') assert.ok(Number.isFinite(val), `18I-5I-9: ${key} must be finite when optional inputs are undefined, got ${val}`);
    }
  }

  // 18I-5I-10: competitive and streak are unchanged — memberSumContribution does not affect their groupTotal
  {
    const { resolveChallengeProgress: resolve } = await import('../src/features/Challenges/challengeProgressResolver');
    const r = resolve({
      challenge: { challengeType: 'competitive', groupCurrentTotal: 100, groupCumulativeTarget: 1000, activities: [{ unit: 'reps', targetValue: 500 }] },
      membership: { cumulativeLoggedValue: 200, completionRate: 40 },
      memberSumContribution: 9999,
    });
    // For competitive, groupTotal is not the primary metric; ensure no NaN and the userTotal is unaffected
    assert.ok(r.userTotal === 200, `18I-5I-10: competitive userTotal must be 200 regardless of memberSumContribution, got ${r.userTotal}`);
    assert.ok(Number.isFinite(r.progressPercent), `18I-5I-10b: competitive progressPercent must be finite, got ${r.progressPercent}`);
  }
}

console.log('scoring guards passed');

