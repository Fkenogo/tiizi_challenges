/**
 * Guard script: Phase 5 — legacy v1 challenge engine removal.
 *
 * Verifies:
 *   - legacyEngine.ts no longer exists; no source file references LegacyEngine
 *   - selectEngine() throws for non-v2 engineVersion, never silently falls back
 *   - workoutService/wellnessLogService reject non-v2 challenges before building
 *     an engine context (no silent legacy calculation)
 *   - no v1/legacy rendering branch remains in ChallengeDetailScreen,
 *     ChallengeCompletedScreen, ChallengeLeaderboardScreen, WorkoutLoggedScreen
 *   - ChallengeCompletedScreen has exactly the three v2 recap paths (collective,
 *     competitive, streak) plus a not-supported fallback — no legacy recap
 *   - no legacy points-explanation UI remains
 *   - sortLeaderboardRows no longer computes a legacy totalPoints ranking
 *   - challengeService list methods exclude non-v2 challenges from user-facing lists
 *   - EngineVersion type is v2-only
 *
 * Run: npx tsx scripts/testLegacyChallengeRemovalGuards.ts
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function exists(rel: string): boolean {
  return fs.existsSync(path.join(root, rel));
}

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, details?: string) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label}${details ? ` — ${details}` : ''}`);
    failed++;
  }
}

const engineIndex = read('src/services/challengeEngine/index.ts');
const engineTypes = read('src/services/challengeEngine/types.ts');
const workoutService = read('src/services/workoutService.ts');
const wellnessLogService = read('src/services/wellnessLogService.ts');
const challengeDetailScreen = read('src/features/Challenges/ChallengeDetailScreen.tsx');
const challengeCompletedScreen = read('src/features/Challenges/ChallengeCompletedScreen.tsx');
const challengeLeaderboardScreen = read('src/features/Challenges/ChallengeLeaderboardScreen.tsx');
const workoutLoggedScreen = read('src/features/Workouts/WorkoutLoggedScreen.tsx');
const leaderboardSort = read('src/utils/leaderboardSort.ts');
const challengeService = read('src/services/challengeService.ts');

// ── 1: LegacyEngine fully removed ─────────────────────────────────────────────
console.log('\n[1] LegacyEngine removed');
assert('legacyEngine.ts no longer exists', !exists('src/services/challengeEngine/legacyEngine.ts'));
for (const [label, src] of [
  ['challengeEngine/index.ts', engineIndex],
  ['workoutService.ts', workoutService],
  ['wellnessLogService.ts', wellnessLogService],
] as const) {
  assert(`${label} does not reference LegacyEngine`, !src.includes('LegacyEngine'));
}

// ── 2: selectEngine throws for non-v2, never silently falls back ─────────────
console.log('\n[2] selectEngine rejects non-v2 challenges');
assert(
  'selectEngine checks engineVersion !== \'v2\'',
  /engineVersion\s*!==\s*'v2'/.test(engineIndex),
);
assert(
  'selectEngine throws (not "return new ...Engine()") for non-v2',
  /engineVersion\s*!==\s*'v2'\)\s*\{\s*throw/.test(engineIndex),
);

// ── 3: EngineVersion type is v2-only ──────────────────────────────────────────
console.log('\n[3] EngineVersion type is v2-only');
assert(
  "EngineVersion type does not include 'v1'",
  !/EngineVersion\s*=\s*'v1'/.test(engineTypes),
);
assert(
  "EngineVersion type is exactly 'v2'",
  /export type EngineVersion = 'v2';/.test(engineTypes),
);

// ── 4: workoutService/wellnessLogService reject non-v2 before building context ─
console.log('\n[4] Log services reject non-v2 challenges early (no silent legacy calc)');
assert(
  'workoutService checks engineVersion !== \'v2\' and throws',
  /engineVersion\s*!==\s*'v2'\)\s*\{\s*throw/.test(workoutService),
);
assert(
  'wellnessLogService checks engineVersion !== \'v2\' and throws',
  /engineVersion\s*!==\s*'v2'\)\s*\{\s*throw/.test(wellnessLogService),
);
assert(
  'workoutService context no longer derives engineVersion from a v1 ternary',
  !/engineVersion:\s*challengeData\.engineVersion === 'v2' \? 'v2' : 'v1'/.test(workoutService),
);
assert(
  'wellnessLogService context no longer derives engineVersion from a v1 ternary',
  !/engineVersion:\s*challengeData\.engineVersion === 'v2' \? 'v2' : 'v1'/.test(wellnessLogService),
);

// ── 5: No v1/legacy rendering branch remains in challenge screens ────────────
console.log('\n[5] No legacy rendering branches remain');
assert(
  'ChallengeDetailScreen has no "Legacy / v1" comment block',
  !/Legacy \/ v1/.test(challengeDetailScreen),
);
assert(
  'ChallengeDetailScreen has no "How Points Work" legacy section',
  !/How Points Work/.test(challengeDetailScreen),
);
assert(
  'ChallengeDetailScreen shows a "no longer supported" state for !isV2',
  /!isV2[\s\S]{0,400}no longer supported/i.test(challengeDetailScreen),
);
assert(
  'WorkoutLoggedScreen has no legacy completion bar UI',
  !/legacyCompletion|legacyTarget/.test(workoutLoggedScreen),
);
assert(
  'WorkoutLoggedScreen has no "Level Up!" legacy badge',
  !/Level Up!/.test(workoutLoggedScreen),
);
assert(
  'ChallengeLeaderboardScreen shows a "no longer supported" state for !isV2',
  /!isV2[\s\S]{0,400}no longer supported/i.test(challengeLeaderboardScreen),
);

// ── 6: ChallengeCompletedScreen has only the three v2 recap paths ────────────
console.log('\n[6] ChallengeCompletedScreen has exactly collective/competitive/streak + fallback');
assert(
  'No "Legacy v1 completion" block remains',
  !/Legacy v1 completion/.test(challengeCompletedScreen),
);
assert(
  'No legacyCompletionPct / tier / intensity legacy variables remain',
  !/legacyCompletionPct|const tier =|const intensity =/.test(challengeCompletedScreen),
);
const recapBranches = (challengeCompletedScreen.match(/if \(isV2 && challengeType === '(collective|competitive|streak)'\)/g) ?? []).length;
assert(
  'Exactly 3 v2 recap branches present (collective, competitive, streak)',
  recapBranches === 3,
  `found ${recapBranches}`,
);
assert(
  'ChallengeCompletedScreen has a !isV2 not-supported early return',
  /if \(!isV2\)/.test(challengeCompletedScreen),
);
const recapNavActionsUsages = (challengeCompletedScreen.match(/<RecapNavActions/g) ?? []).length;
assert(
  'RecapNavActions (Share Achievement) used by all 3 v2 recap types',
  recapNavActionsUsages >= 3,
  `found ${recapNavActionsUsages}`,
);

// ── 7: No legacy points-explanation UI remains anywhere ──────────────────────
console.log('\n[7] No legacy points-explanation copy remains');
for (const [label, src] of [
  ['WorkoutLoggedScreen', workoutLoggedScreen],
  ['ChallengeDetailScreen', challengeDetailScreen],
] as const) {
  assert(`${label} has no "Target not met." legacy copy`, !/Target not met\./.test(src));
  assert(`${label} has no "Partial points earned." legacy copy`, !/Partial points earned\./.test(src));
}

// ── 8: sortLeaderboardRows no longer computes a legacy totalPoints ranking ───
console.log('\n[8] Leaderboard sort has no legacy fallback ranking');
assert(
  'sortLeaderboardRows returns rows unchanged (not totalPoints-sorted) for non-v2',
  /return rows;\s*\}/.test(leaderboardSort),
);
assert(
  'sortLeaderboardRows does not end with a bare totalPoints DESC sort',
  !/return \[\.\.\.rows\]\.sort\(\(a, b\) => b\.totalPoints - a\.totalPoints\);\s*\}/.test(leaderboardSort),
);

// ── 9: challengeService excludes non-v2 challenges from user-facing lists ────
console.log('\n[9] Obsolete challenges excluded from lists (not just detail screens)');
assert(
  'challengeService defines isSupportedChallengeEngine helper',
  /function isSupportedChallengeEngine/.test(challengeService),
);
const supportedFilterUsages = (challengeService.match(/\.filter\(isSupportedChallengeEngine\)/g) ?? []).length;
assert(
  'isSupportedChallengeEngine filter applied to multiple list methods',
  supportedFilterUsages >= 5,
  `found ${supportedFilterUsages} usages`,
);

// ── 10: v2 source-of-truth calculations remain intact (regression guard) ─────
console.log('\n[10] v2 calculations untouched — spot checks');
assert(
  'challengeProgressResolver still derives groupTotal via Math.max floor sources',
  /const groupTotal = Math\.max\(activitySummaryFloor, memberSumFloor, logSumFloor, optimisticTeamFloor, userContributionTotal\)/.test(
    read('src/features/Challenges/challengeProgressResolver.ts'),
  ),
);
assert(
  'CollectiveEngine still exports computeCollectiveUpdate (v2 collective calc untouched)',
  /static computeCollectiveUpdate/.test(read('src/services/challengeEngine/collectiveEngine.ts')),
);
assert(
  'StreakEngine still exists and is exported from challengeEngine/index.ts',
  /export \{ StreakEngine \}/.test(engineIndex),
);
assert(
  'CompetitiveEngine still exists and is exported from challengeEngine/index.ts',
  /export \{ CompetitiveEngine \}/.test(engineIndex),
);

// ── Summary ────────────────────────────────────────────────────────────────────
console.log(`\n────────────────────────────────────────`);
console.log(`  ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error(`\n  ✗ Guard checks failed — fix the issues above.`);
  process.exit(1);
} else {
  console.log(`\n  ✓ All legacy v1 challenge removal guards passed.`);
}
