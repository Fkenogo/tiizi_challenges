/**
 * Guard script: static analysis verifying movementType UI wiring is in place.
 * Run: npx tsx scripts/testExerciseMovementTypeUiGuards.ts
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

const detail       = read('src/features/Exercises/ExerciseDetailScreen.tsx');
const library      = read('src/features/Exercises/ExerciseLibraryScreen.tsx');
const wizard       = read('src/features/Challenges/CreateChallengeWizard.tsx');
const activitySec  = read('src/features/Challenges/components/ChallengeActivitySection.tsx');
const adminCreate  = read('src/features/Admin/Challenges/CreateChallengeScreen.tsx');
const adminEdit    = read('src/features/Admin/Challenges/EditChallengeTemplateScreen.tsx');

// ── Guard 1: ExerciseDetailScreen renders movementType ──────────────────────
console.log('\n[1] ExerciseDetailScreen: movementType pills');
assert('renders isometric pill',  detail.includes("movementType === 'isometric'"));
assert('renders isotonic pill',   detail.includes("movementType === 'isotonic'"));
assert('renders hold-based pill', detail.includes("holdBased === true"));
assert('does not hardcode exercise IDs', !detail.includes("'plank-forearm-plank'"));

// ── Guard 2: ExerciseDetailScreen reads recommendedVolume ───────────────────
console.log('\n[2] ExerciseDetailScreen: recommendedVolume from data');
assert('reads recommendedVolume.intermediate', detail.includes('recommendedVolume?.intermediate'));
assert('no hardcoded "10-20"', !detail.includes('"10-20"'));

// ── Guard 3: ExerciseDetailScreen: Hold Duration label ─────────────────────
console.log('\n[3] ExerciseDetailScreen: Hold Duration label for isometric');
assert('shows "Hold Duration" when holdBased', detail.includes('Hold Duration'));

// ── Guard 4: ExerciseLibraryScreen: movementType filter chips ──────────────
console.log('\n[4] ExerciseLibraryScreen: movement type filter chips');
assert('has isometric filter chip', library.includes("'isometric'") || library.includes('"isometric"'));
assert('has isotonic filter chip',  library.includes("'isotonic'")  || library.includes('"isotonic"'));
assert('movementTypeFilter state exists', library.includes('movementTypeFilter'));

// ── Guard 5: ExerciseLibraryScreen: filter uses movementType/tags ──────────
console.log('\n[5] ExerciseLibraryScreen: filter logic reads movementType and tags');
assert('filter reads ex.movementType', library.includes('ex.movementType'));
assert('filter reads ex.tags',         library.includes('ex.tags'));
assert('no hardcoded exercise IDs in library filter', !library.includes("'plank-forearm-plank'"));

// ── Guard 6: ExerciseLibraryScreen URL-param path: capitalized unit ─────────
console.log('\n[6] ExerciseLibraryScreen URL-param: unit is capitalized for isometric');
assert("URL-param path resolves 'Seconds' (capital S)", library.includes("'Seconds'"));
assert("URL-param path resolves 'Minutes' (capital M)", library.includes("'Minutes'"));
assert('URL-param path does not emit lowercase seconds', !library.includes("? 'seconds'"));

// ── Guard 7: ChallengeActivitySection picker: filter chips ──────────────────
console.log('\n[7] ChallengeActivitySection picker: movement type filter chips');
assert('picker has isometric chip',              activitySec.includes("'isometric'") || activitySec.includes('"isometric"'));
assert('picker has isotonic chip',               activitySec.includes("'isotonic'")  || activitySec.includes('"isotonic"'));
assert('picker filter state fitnessPickerMovementType', activitySec.includes('fitnessPickerMovementType'));
assert('picker filter reads ex.movementType',    activitySec.includes('ex.movementType'));
assert('picker filter reads ex.tags',            activitySec.includes('ex.tags'));
assert('no hardcoded exercise IDs in picker',    !activitySec.includes("'plank-forearm-plank'"));

// ── Guard 8: resolveExerciseUnit is exported and capitalized ─────────────────
console.log('\n[8] ChallengeActivitySection: resolveExerciseUnit is exported and returns capitalized units');
assert('resolveExerciseUnit is exported',           activitySec.includes('export function resolveExerciseUnit'));
assert("returns 'Seconds' (capital S) for isometric", activitySec.includes("'Seconds'"));
assert("returns 'Minutes' (capital M) for isometric", activitySec.includes("'Minutes'"));
assert('does not return lowercase seconds',          !activitySec.includes("? 'seconds'"));
assert('does not return lowercase minutes for iso',  !activitySec.includes("? 'minutes'"));

// ── Guard 9: resolveExerciseUnit is CALLED inside the picker onClick ─────────
console.log('\n[9] ChallengeActivitySection: resolveExerciseUnit called in picker onClick');
assert('resolveExerciseUnit(exercise) is called in onClick', activitySec.includes('resolveExerciseUnit(exercise)'));
assert('onUpdateActivity called with resolved unit in onClick',
  activitySec.includes('onUpdateActivity(fitnessPickerIndex') || activitySec.includes('onUpdateActivity(fitnessPickerIndex,'));

// ── Guard 10: CreateChallengeWizard: isometric → capitalized Seconds ─────────
console.log('\n[10] CreateChallengeWizard: holdBased/isometric defaults to Seconds (capital)');
assert('wizard reads holdBased',                  wizard.includes('holdBased'));
assert('wizard reads movementType',               wizard.includes('movementType'));
assert("wizard resolves 'Seconds' (capital S)",   wizard.includes("'Seconds'"));
assert("wizard resolves 'Minutes' (capital M)",   wizard.includes("'Minutes'"));
assert('no lowercase seconds in wizard pick path', !wizard.includes("? 'seconds'"));

// ── Guard 11: Admin CreateChallengeScreen: isometric → capitalized Seconds ───
console.log('\n[11] Admin CreateChallengeScreen: holdBased/isometric defaults to Seconds');
assert('admin create reads holdBased',      adminCreate.includes('holdBased'));
assert('admin create reads movementType',   adminCreate.includes('movementType'));
assert("admin create resolves 'Seconds'",   adminCreate.includes("'Seconds'"));
assert('no lowercase seconds in admin create', !adminCreate.includes("? 'seconds'"));
assert('isIsometric check present',         adminCreate.includes('isIsometric'));

// ── Guard 12: Admin EditChallengeTemplateScreen: isometric → capitalized Seconds
console.log('\n[12] Admin EditChallengeTemplateScreen: holdBased/isometric defaults to Seconds');
assert('admin edit reads holdBased',      adminEdit.includes('holdBased'));
assert('admin edit reads movementType',   adminEdit.includes('movementType'));
assert("admin edit resolves 'Seconds'",   adminEdit.includes("'Seconds'"));
assert('no lowercase seconds in admin edit', !adminEdit.includes("? 'seconds'"));
assert('isIsometric check present',       adminEdit.includes('isIsometric'));

// ── Guard 13: Unit select options match resolved unit values ─────────────────
console.log('\n[13] ChallengeActivitySection: select options use same casing as resolved units');
assert('select has option value="Reps"',    activitySec.includes('value="Reps"'));
assert('select has option value="Seconds"', activitySec.includes('value="Seconds"'));
assert('select has option value="Minutes"', activitySec.includes('value="Minutes"'));

// ── Guard 14: ExerciseDetailScreen all original sections still present ────────
console.log('\n[14] ExerciseDetailScreen: all original sections still present');
assert('Benefits section present',        detail.includes('Benefits'));
assert('Metric Unit section present',     detail.includes('Metric Unit'));
assert('Recommended section present',     detail.includes('Recommended'));
assert('Instructions section present',    detail.includes('Instructions'));
assert('Cues section present',            detail.includes('Cues'));
assert('Common Mistakes section present', detail.includes('Common Mistakes'));
assert('Safety First section present',    detail.includes('Safety First'));

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.error(`\n❌ ${failed} guard(s) failed.`);
  process.exit(1);
} else {
  console.log('\n✅ All UI movement type guards passed.');
}
