/**
 * Guard script: verifies isometric/isotonic tagging integrity in catalogExercises_CLEAN.json.
 * Run: npx tsx scripts/testExerciseLibraryIsometricGuards.ts
 */
import exercisesData from '../catalogExercises_CLEAN.json';

type ExerciseDoc = {
  id: string;
  name: string;
  tags?: string[];
  movementType?: string;
  holdBased?: boolean;
  metric?: { type: string; unit: string };
  recommendedVolume?: { beginner: string; intermediate: string; advanced: string };
};

const docs = exercisesData.documents as ExerciseDoc[];
const byId = new Map(docs.map((d) => [d.id, d]));

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

// ── Guard 1: known isometric IDs have correct tags ───────────────────────────
console.log('\n[1] Known isometric exercises have movementType, tags, holdBased');

// plank-and-reach is a reps-based dynamic exercise with isometric stabilization;
// it's tagged isometric but holdBased=false (not a pure static hold).
const KNOWN_ISOMETRIC_HOLDS = [
  'plank-forearm-plank', 'side-plank-left', 'side-plank-right',
  'kneeling-side-plank-left', 'kneeling-side-plank-right',
  'leg-up-side-plank-left', 'leg-up-side-plank-right',
  'left-side-plank-with-arm-raised', 'right-side-plank-with-arm-raised',
  'side-plank-with-left-leg-raised', 'side-plank-with-right-leg-raised',
  'knee-plank', 'straight-arm-knee-plank', 'straight-arm-plank-high-plank',
  'wide-arm-plank', 'plank-with-left-arm-lift', 'plank-with-right-arm-lift',
  'single-left-leg-plank', 'single-right-leg-plank',
  'leg-raised-plank-left', 'leg-raised-plank-right',
  'diagonal-plank-hold-left', 'diagonal-plank-hold-right',
  'reverse-plank', 'reverse-plank-with-left-leg-raised', 'reverse-plank-with-right-leg-raised',
  'push-up-hold', 'modified-push-up-low-hold', 'wall-sit',
  'hollow-body-hold', 'superman-hold', 'bear-crawl-hold',
];

const KNOWN_ISOMETRIC_DYNAMIC = [
  'plank-and-reach-left', 'plank-and-reach-right',
];

for (const id of [...KNOWN_ISOMETRIC_HOLDS, ...KNOWN_ISOMETRIC_DYNAMIC]) {
  const ex = byId.get(id);
  assert(
    `${id}: movementType=isometric`,
    !!ex && ex.movementType === 'isometric',
    ex ? `actual movementType=${ex.movementType}` : 'NOT FOUND',
  );
  assert(
    `${id}: tags includes "isometric"`,
    !!ex && (ex.tags ?? []).includes('isometric'),
    ex ? `actual tags=${JSON.stringify(ex.tags)}` : 'NOT FOUND',
  );
}

for (const id of KNOWN_ISOMETRIC_HOLDS) {
  const ex = byId.get(id);
  assert(
    `${id}: holdBased=true`,
    !!ex && ex.holdBased === true,
    ex ? `actual holdBased=${ex.holdBased}` : 'NOT FOUND',
  );
}

// ── Guard 2: holdBased=true exercises use metric.unit=seconds ────────────────
console.log('\n[2] holdBased=true exercises use metric.unit=seconds');

const holdBasedDocs = docs.filter((d) => d.holdBased === true);
for (const ex of holdBasedDocs) {
  assert(
    `${ex.id}: metric.unit=seconds`,
    ex.metric?.unit === 'seconds',
    `actual unit=${ex.metric?.unit}`,
  );
}

// ── Guard 3: new isometric exercises are present ──────────────────────────────
console.log('\n[3] New isometric exercises are present');

const NEW_ISOMETRIC_IDS = [
  'bird-dog-hold-left', 'bird-dog-hold-right',
  'dead-bug-hold-left', 'dead-bug-hold-right',
  'v-sit-hold', 'hollow-rock-hold',
  'star-plank-hold-left', 'star-plank-hold-right',
  'copenhagen-plank-hold-left', 'copenhagen-plank-hold-right',
  'glute-bridge-hold',
  'single-leg-glute-bridge-hold-left', 'single-leg-glute-bridge-hold-right',
  'clamshell-hold-left', 'clamshell-hold-right',
  'fire-hydrant-hold-left', 'fire-hydrant-hold-right',
  'standing-hip-abduction-hold-left', 'standing-hip-abduction-hold-right',
  'single-leg-wall-sit-left', 'single-leg-wall-sit-right',
  'static-lunge-hold-left', 'static-lunge-hold-right',
  'static-squat-hold', 'sumo-squat-hold', 'calf-raise-hold',
  'single-leg-calf-raise-hold-left', 'single-leg-calf-raise-hold-right',
  'pistol-squat-hold-left', 'pistol-squat-hold-right',
  'isometric-push-up-hold-top', 'isometric-push-up-hold-mid',
  'wall-push-isometric-hold', 'doorway-chest-press-hold',
  'chair-dip-hold-bottom', 'handstand-hold-wall-supported',
  'reverse-snow-angel-hold', 'overhead-arm-hold',
  'bear-hold', 'crab-hold', 'low-squat-hold-malasana',
];

for (const id of NEW_ISOMETRIC_IDS) {
  const ex = byId.get(id);
  assert(`${id}: exists`, !!ex);
  assert(`${id}: movementType=isometric`, !!ex && ex.movementType === 'isometric');
  assert(`${id}: holdBased=true`, !!ex && ex.holdBased === true);
}

// ── Guard 4: no metric.type=time with metric.unit=reps ───────────────────────
console.log('\n[4] No exercises have metric.type=time and metric.unit=reps');

const timRepsExercises = docs.filter(
  (d) => d.metric?.type === 'time' && d.metric?.unit === 'reps',
);
assert(
  `0 exercises with time/reps metric (found ${timRepsExercises.length})`,
  timRepsExercises.length === 0,
  timRepsExercises.map((d) => d.id).join(', '),
);

// ── Guard 5: holdBased=true exercises do not recommend reps ──────────────────
console.log('\n[5] holdBased=true exercises have no reps language in recommendedVolume');

for (const ex of holdBasedDocs) {
  const rv = ex.recommendedVolume ?? { beginner: '', intermediate: '', advanced: '' };
  const volStr = Object.values(rv).join(' ').toLowerCase();
  const hasRepsLanguage = /\d+\s*rep|\bsets of \d/.test(volStr);
  assert(
    `${ex.id}: no reps language in recommendedVolume`,
    !hasRepsLanguage,
    hasRepsLanguage ? `volume="${volStr.slice(0, 80)}"` : undefined,
  );
}

// ── Guard 6: core rep-based exercises are classified isotonic ─────────────────
console.log('\n[6] Core rep-based exercises are classified isotonic');

const CORE_ISOTONIC = ['push-ups', 'squats', 'burpees', 'lunges', 'sit-ups', 'jumping-jacks'];
for (const id of CORE_ISOTONIC) {
  const ex = byId.get(id);
  assert(`${id}: exists`, !!ex);
  assert(
    `${id}: movementType=isotonic`,
    !!ex && ex.movementType === 'isotonic',
    ex ? `actual=${ex.movementType}` : 'NOT FOUND',
  );
  assert(
    `${id}: not tagged isometric`,
    !!ex && ex.movementType !== 'isometric',
    ex ? `actual=${ex.movementType}` : 'NOT FOUND',
  );
}

// ── Guard 7: no duplicate IDs ─────────────────────────────────────────────────
console.log('\n[7] No duplicate IDs');

const ids = docs.map((d) => d.id);
const uniqueIds = new Set(ids);
assert(`all ${ids.length} IDs are unique`, ids.length === uniqueIds.size,
  ids.length !== uniqueIds.size ? `found ${ids.length - uniqueIds.size} duplicate(s)` : '');

// ── Guard 8: no duplicate names ───────────────────────────────────────────────
console.log('\n[8] No duplicate exercise names');

const names = docs.map((d) => d.name.toLowerCase());
const uniqueNames = new Set(names);
assert(`all ${names.length} names are unique`, names.length === uniqueNames.size,
  names.length !== uniqueNames.size ? `found ${names.length - uniqueNames.size} duplicate(s)` : '');

// ── Guard 9: catalog size ─────────────────────────────────────────────────────
console.log('\n[9] Catalog size');

assert(`total exercises >= 154`, docs.length >= 154, `actual: ${docs.length}`);

// ── Summary ───────────────────────────────────────────────────────────────────
const isometricCount = docs.filter((d) => d.movementType === 'isometric').length;
const isotonicCount = docs.filter((d) => d.movementType === 'isotonic').length;
const unclassifiedCount = docs.filter((d) => !d.movementType).length;

console.log(`\n${'─'.repeat(50)}`);
console.log(`Catalog: ${docs.length} total — ${isometricCount} isometric, ${isotonicCount} isotonic, ${unclassifiedCount} unclassified`);
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.error(`\n❌ ${failed} guard(s) failed.`);
  process.exit(1);
} else {
  console.log(`\n✅ All guards passed.`);
}
