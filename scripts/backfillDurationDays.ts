import 'dotenv/config';
import { getApps, initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, type WriteBatch, type Firestore } from 'firebase-admin/firestore';

const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.VITE_FIREBASE_PROJECT_ID;
const applyMode = process.argv.includes('--apply');
const productionProjectIds = new Set(['tiizi-challenges']);

if (!projectId) {
  throw new Error('Missing FIREBASE_PROJECT_ID (or fallback VITE_FIREBASE_PROJECT_ID) env var.');
}

if (applyMode && productionProjectIds.has(projectId) && process.env.CONFIRM_PROJECT_ID !== projectId) {
  throw new Error(`Refusing to write to production project "${projectId}" unless CONFIRM_PROJECT_ID=${projectId}.`);
}

if (!getApps().length) {
  initializeApp({ credential: applicationDefault(), projectId });
}

const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

// --- Pure helper — tested by inline assertions below ---

/**
 * Compute durationDays inclusively from ISO date strings.
 * "2024-06-01" to "2024-06-07" = 7 days (not 6).
 * Returns null if either date is missing or unparseable.
 */
function calcDurationDays(startDate: unknown, endDate: unknown): number | null {
  if (typeof startDate !== 'string' || typeof endDate !== 'string') return null;
  const startMs = Date.parse(startDate);
  const endMs = Date.parse(endDate);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return null;
  if (endMs < startMs) return null;
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.round((endMs - startMs) / oneDay) + 1;
}

// --- Inline assertions (run on every invocation, including dry-run) ---

function runAssertions() {
  const assert = (condition: boolean, msg: string) => {
    if (!condition) throw new Error(`Assertion failed: ${msg}`);
  };

  // Inclusive: same-day = 1
  assert(calcDurationDays('2024-06-01', '2024-06-01') === 1, 'same-day = 1');
  // Inclusive: 7-day span
  assert(calcDurationDays('2024-06-01', '2024-06-07') === 7, 'June 1–7 = 7');
  // Inclusive: 30-day span
  assert(calcDurationDays('2024-06-01', '2024-06-30') === 30, 'June 1–30 = 30');
  // Missing dates → null
  assert(calcDurationDays(null, '2024-06-07') === null, 'null startDate → null');
  assert(calcDurationDays('2024-06-01', null) === null, 'null endDate → null');
  assert(calcDurationDays('', '2024-06-07') === null, 'empty startDate → null');
  assert(calcDurationDays('not-a-date', '2024-06-07') === null, 'invalid startDate → null');
  // End before start → null
  assert(calcDurationDays('2024-06-07', '2024-06-01') === null, 'end before start → null');

  console.log('✅ Assertions passed');
}

async function commitInChunks(dbRef: Firestore, queue: Array<(batch: WriteBatch) => void>) {
  let writes = 0;
  for (let i = 0; i < queue.length; i += 450) {
    const batch = dbRef.batch();
    queue.slice(i, i + 450).forEach((fn) => fn(batch));
    await batch.commit();
    writes += Math.min(450, queue.length - i);
  }
  return writes;
}

async function run() {
  runAssertions();

  console.log(`\n🔍 backfillDurationDays — project: ${projectId} — mode: ${applyMode ? '✏️  APPLY' : '🔎 DRY-RUN'}\n`);

  const snap = await db.collection('challenges').get();
  console.log(`Fetched ${snap.size} challenge documents.\n`);

  type Row = {
    id: string;
    name: string;
    status: string;
    challengeType: string;
    groupId: string;
    startDate: string;
    endDate: string;
    currentDurationDays: number | null;
    calcDuration: number | null;
    action: 'UPDATE' | 'SKIP_CORRECT' | 'SKIP_INVALID_DATES' | 'SKIP_NO_CHANGE';
    skipReason?: string;
  };

  const rows: Row[] = [];
  const writeQueue: Array<(batch: WriteBatch) => void> = [];

  for (const doc of snap.docs) {
    const data = doc.data() as Record<string, unknown>;
    const startDate = typeof data.startDate === 'string' ? data.startDate : '';
    const endDate = typeof data.endDate === 'string' ? data.endDate : '';
    const currentDurationDays = typeof data.durationDays === 'number' ? data.durationDays : null;
    const calc = calcDurationDays(startDate || null, endDate || null);

    const row: Row = {
      id: doc.id,
      name: typeof data.name === 'string' ? data.name : '(unnamed)',
      status: typeof data.status === 'string' ? data.status : '(unknown)',
      challengeType: typeof data.challengeType === 'string' ? data.challengeType : '(unknown)',
      groupId: typeof data.groupId === 'string' ? data.groupId : '',
      startDate: startDate || '(missing)',
      endDate: endDate || '(missing)',
      currentDurationDays,
      calcDuration: calc,
      action: 'SKIP_NO_CHANGE',
    };

    if (calc === null) {
      row.action = 'SKIP_INVALID_DATES';
      row.skipReason = !startDate || !endDate ? 'missing date(s)' : 'unparseable or end < start';
    } else if (currentDurationDays === calc) {
      row.action = 'SKIP_CORRECT';
      row.skipReason = `already ${calc}`;
    } else {
      row.action = 'UPDATE';
      writeQueue.push((batch) => {
        batch.update(doc.ref, { durationDays: calc });
      });
    }

    rows.push(row);
  }

  // --- Report ---

  const toUpdate = rows.filter((r) => r.action === 'UPDATE');
  const skipCorrect = rows.filter((r) => r.action === 'SKIP_CORRECT');
  const skipInvalid = rows.filter((r) => r.action === 'SKIP_INVALID_DATES');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('CHALLENGES TO UPDATE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (toUpdate.length === 0) {
    console.log('  (none — all challenges already have correct durationDays)');
  } else {
    console.table(
      toUpdate.map((r) => ({
        id: r.id.slice(0, 12),
        name: r.name.slice(0, 32),
        status: r.status,
        type: r.challengeType,
        startDate: r.startDate,
        endDate: r.endDate,
        currentDurationDays: r.currentDurationDays ?? '(none)',
        willSetTo: r.calcDuration,
      })),
    );
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`SKIPPED — already correct (${skipCorrect.length})`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (skipCorrect.length > 0) {
    console.table(
      skipCorrect.map((r) => ({
        id: r.id.slice(0, 12),
        name: r.name.slice(0, 32),
        status: r.status,
        durationDays: r.currentDurationDays,
        reason: r.skipReason,
      })),
    );
  } else {
    console.log('  (none)');
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`SKIPPED — invalid/missing dates (${skipInvalid.length})`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (skipInvalid.length > 0) {
    console.table(
      skipInvalid.map((r) => ({
        id: r.id.slice(0, 12),
        name: r.name.slice(0, 32),
        status: r.status,
        startDate: r.startDate,
        endDate: r.endDate,
        reason: r.skipReason,
      })),
    );
  } else {
    console.log('  (none)');
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Total challenges:        ${snap.size}`);
  console.log(`  Will update:             ${toUpdate.length}`);
  console.log(`  Already correct:         ${skipCorrect.length}`);
  console.log(`  Skipped (invalid dates): ${skipInvalid.length}`);

  if (!applyMode) {
    console.log('\n🔎 DRY-RUN complete — zero writes performed.');
    console.log('   To apply: CONFIRM_PROJECT_ID=tiizi-challenges npx tsx scripts/backfillDurationDays.ts --apply');
    return;
  }

  // --- Apply ---
  if (writeQueue.length === 0) {
    console.log('\n✅ Nothing to write.');
    return;
  }
  const written = await commitInChunks(db, writeQueue);
  console.log(`\n✅ Applied ${written} write(s).`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
