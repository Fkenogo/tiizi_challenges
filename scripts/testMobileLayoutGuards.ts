/**
 * Guard script: static analysis verifying mobile layout correctness.
 * Run: npx tsx scripts/testMobileLayoutGuards.ts
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

// ── Screens to audit ─────────────────────────────────────────────────────────
const home           = read('src/features/Home/HomeScreen.tsx');
const challenges     = read('src/features/Challenges/ChallengesScreen.tsx');
const browse         = read('src/features/Challenges/BrowseChallengesScreen.tsx');
const challengeDetail = read('src/features/Challenges/ChallengeDetailScreen.tsx');
const leaderboard    = read('src/features/Challenges/ChallengeLeaderboardScreen.tsx');
const completed      = read('src/features/Challenges/ChallengeCompletedScreen.tsx');
const selectActivity = read('src/features/Workouts/SelectChallengeActivityScreen.tsx');
const logWorkout     = read('src/features/Workouts/LogWorkoutScreen.tsx');
const groups         = read('src/features/Groups/GroupsScreen.tsx');
const groupDetail    = read('src/features/Groups/GroupDetailScreen.tsx');
const exerciseLib    = read('src/features/Exercises/ExerciseLibraryScreen.tsx');
const exerciseDetail = read('src/features/Exercises/ExerciseDetailScreen.tsx');
const profile        = read('src/features/Profile/ProfileScreen.tsx');
const activitySec    = read('src/features/Challenges/components/ChallengeActivitySection.tsx');
const bottomNav      = read('src/components/Layout/BottomNav.tsx');

// ── Guard 1: BottomNav container uses max-w-mobile ───────────────────────────
console.log('\n[1] BottomNav: constrained to mobile width');
assert('BottomNav uses max-w-mobile', bottomNav.includes('max-w-mobile'));
assert('BottomNav is fixed at bottom', bottomNav.includes('fixed') && bottomNav.includes('bottom-0'));

// ── Guard 2: All main content screens have BottomNav bottom padding ──────────
console.log('\n[2] Screens with BottomNav: have adequate bottom padding');
const PB_PATTERN = /pb-\[9[0-9]px\]|pb-\[1[0-3][0-9]px\]|pb-24|pb-28|pb-32/;
assert('HomeScreen has bottom nav clearance',        PB_PATTERN.test(home));
assert('ChallengesScreen has bottom nav clearance',  PB_PATTERN.test(challenges));
assert('BrowseChallengesScreen has bottom nav clearance', PB_PATTERN.test(browse));
assert('ChallengeDetailScreen has bottom nav clearance',  PB_PATTERN.test(challengeDetail));
assert('ChallengeLeaderboardScreen has bottom nav clearance', PB_PATTERN.test(leaderboard));
assert('ChallengeCompletedScreen has bottom nav clearance', PB_PATTERN.test(completed));
assert('SelectChallengeActivityScreen has bottom nav clearance', PB_PATTERN.test(selectActivity));
assert('LogWorkoutScreen has bottom nav clearance',  PB_PATTERN.test(logWorkout));
assert('GroupsScreen has bottom nav clearance',      PB_PATTERN.test(groups));
assert('GroupDetailScreen has bottom nav clearance', PB_PATTERN.test(groupDetail));
assert('ExerciseLibraryScreen has bottom nav clearance', PB_PATTERN.test(exerciseLib));
assert('ExerciseDetailScreen has bottom nav clearance',  PB_PATTERN.test(exerciseDetail));
assert('ProfileScreen has bottom nav clearance',     PB_PATTERN.test(profile));

// ── Guard 3: Content containers use responsive width constraint ──────────────
// Either via explicit class OR via <Screen> wrapper (root-level max-width applies).
console.log('\n[3] Screens: content constrained to mobile width (class or Screen wrapper)');
const WIDTH_PATTERN = /max-w-mobile|st-form-max|st-frame/;
const SCREEN_WRAPPER = /<Screen[\s>]/;
function hasWidthConstraint(src: string): boolean {
  return WIDTH_PATTERN.test(src) || SCREEN_WRAPPER.test(src);
}
assert('HomeScreen constrains content width',         hasWidthConstraint(home));
assert('ChallengesScreen constrains content width',   hasWidthConstraint(challenges));
assert('ChallengeDetailScreen constrains content width', hasWidthConstraint(challengeDetail));
assert('ChallengeLeaderboardScreen constrains content width', hasWidthConstraint(leaderboard));
assert('SelectChallengeActivityScreen constrains content width', hasWidthConstraint(selectActivity));
assert('GroupsScreen constrains content width',       hasWidthConstraint(groups));
assert('GroupDetailScreen constrains content width',  hasWidthConstraint(groupDetail));
assert('ExerciseLibraryScreen constrains content width', hasWidthConstraint(exerciseLib));
assert('ExerciseDetailScreen constrains content width', hasWidthConstraint(exerciseDetail));
assert('ProfileScreen constrains content width',      hasWidthConstraint(profile));

// ── Guard 4: Filter chip rows use overflow-x-auto (scroll-safe) ─────────────
console.log('\n[4] Filter chip rows: use overflow-x-auto for scroll safety');
assert('ExerciseLibraryScreen chip row is scroll-safe', exerciseLib.includes('overflow-x-auto'));
assert('ChallengesScreen chip row is scroll-safe',      challenges.includes('overflow-x-auto'));
assert('BrowseChallengesScreen chip row is scroll-safe', browse.includes('overflow-x-auto'));
assert('ChallengeActivitySection picker chips are scroll-safe', activitySec.includes('overflow-x-auto'));

// ── Guard 5: No runaway font sizes in body content ───────────────────────────
console.log('\n[5] Body content: no font size >= 32px on non-heading elements');
// Screens known to use large headlines for intentional impact (celebration):
// ChallengeCompletedScreen uses text-[36px] for hero headline (OK — celebration heading)
// ExerciseDetailScreen uses text-[24px] for exercise name (OK — title)
// Leaderboard uses text-[22px] for stat numbers (OK — data callouts)
// Excluded celebration screen; everything else should stay <= 28px for body
const LARGE_FONT = /text-\[3[2-9]px\]|text-\[4[0-9]px\]|text-\[5[0-9]px\]/;
assert('HomeScreen: no runaway body font >= 32px',           !LARGE_FONT.test(home));
assert('ChallengesScreen: no runaway body font >= 32px',     !LARGE_FONT.test(challenges));
assert('ChallengeDetailScreen: no runaway body font >= 32px', !LARGE_FONT.test(challengeDetail));
assert('SelectChallengeActivityScreen: no runaway body font >= 32px', !LARGE_FONT.test(selectActivity.replace(/text-\[40px\]/g, ''))); // 40px is the log-value input, intentional
assert('LogWorkoutScreen: no runaway body font >= 32px',     !LARGE_FONT.test(logWorkout.replace(/text-\[40px\]/g, ''))); // 40px is the log-value input, intentional
assert('GroupsScreen: no runaway body font >= 32px',         !LARGE_FONT.test(groups));
assert('GroupDetailScreen: no runaway body font >= 32px',    !LARGE_FONT.test(groupDetail));
assert('ExerciseLibraryScreen: no runaway body font >= 32px', !LARGE_FONT.test(exerciseLib));
assert('ProfileScreen: no runaway body font >= 32px',        !LARGE_FONT.test(profile));

// ── Guard 6: No stacked duplicate page headers ────────────────────────────────
console.log('\n[6] Screens: no duplicate stacked <header> elements');
function countHeaders(src: string): number {
  return (src.match(/<header\b/g) ?? []).length;
}
assert('HomeScreen: at most 1 <header>',            countHeaders(home) <= 1);
assert('ChallengesScreen: at most 1 <header>',      countHeaders(challenges) <= 1);
assert('ChallengeDetailScreen: at most 1 <header>', countHeaders(challengeDetail) <= 1);
assert('ExerciseLibraryScreen: at most 1 <header>', countHeaders(exerciseLib) <= 1);
assert('GroupDetailScreen: at most 1 <header>',     countHeaders(groupDetail) <= 1);
assert('GroupsScreen: at most 1 <header>',          countHeaders(groups) <= 1);

// ── Guard 7: ExerciseDetailScreen fixed CTA clears BottomNav ────────────────
console.log('\n[7] ExerciseDetailScreen: fixed CTA positioned above BottomNav');
// BottomNav is ~64px; CTA must be > 64px from bottom
assert('ExerciseDetail fixed CTA at bottom-[92px] (>64px clearance)',
  exerciseDetail.includes('bottom-[92px]') || exerciseDetail.includes('bottom-24') || exerciseDetail.includes('bottom-[80px]'));
assert('ExerciseDetail does not use bottom-0 for CTA', !exerciseDetail.includes('fixed bottom-0'));

// ── Guard 8: Picker modals have filter chips and are scroll-safe ─────────────
console.log('\n[8] ChallengeActivitySection picker: movement type chips exist and scroll-safe');
assert('Picker has movement type chip row',           activitySec.includes('fitnessPickerMovementType'));
assert('Picker chip row is scroll-safe',              activitySec.includes('overflow-x-auto'));
assert('Picker has All/Isometric/Isotonic chips',
  activitySec.includes("'isometric'") && activitySec.includes("'isotonic'"));

// ── Guard 9: No fixed CTA that sits behind BottomNav (bottom-0 patterns) ────
console.log('\n[9] Screens: no fixed CTA at bottom-0 (which would sit behind BottomNav)');
function hasFixedBottomZero(src: string): boolean {
  return /fixed[^"]*bottom-0|bottom-0[^"]*fixed/.test(src);
}
assert('SelectChallengeActivity: no fixed CTA at bottom-0', !hasFixedBottomZero(selectActivity));
assert('LogWorkout: no fixed CTA at bottom-0',              !hasFixedBottomZero(logWorkout));
assert('ChallengeDetail: no fixed CTA at bottom-0',        !hasFixedBottomZero(challengeDetail));
assert('ChallengeCompleted: no fixed CTA at bottom-0',     !hasFixedBottomZero(completed));
assert('ExerciseDetail: no fixed CTA at bottom-0',         !hasFixedBottomZero(exerciseDetail));

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.error(`\n❌ ${failed} guard(s) failed.`);
  process.exit(1);
} else {
  console.log('\n✅ All mobile layout guards passed.');
}
