/**
 * CRIT-3 Step 2 — Repair 7 Category A premature-completion memberships.
 *
 * Run dry-run first (default):
 *   npx tsx scripts/repairCategoryAMemberships.ts
 *
 * Apply writes:
 *   DRY_RUN=false npx tsx scripts/repairCategoryAMemberships.ts
 *
 * Only the 7 document IDs listed in REPAIR_PAYLOADS are touched.
 * Zero other records are modified.
 */
import 'dotenv/config';
import { getApps, initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.VITE_FIREBASE_PROJECT_ID;
if (!projectId) throw new Error('Missing FIREBASE_PROJECT_ID');
if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

const DRY_RUN = process.env.DRY_RUN !== 'false';

// Exact 7 validated payloads from docs/reports/member-phase-10c-p6h-task4c-repair-payload-validation.md
// Each payload writes exactly 4 fields; all other fields are untouched (merge: true).
const REPAIR_PAYLOADS: Array<{
  docId: string;
  challengeId: string;
  payload: { status: string; completedAt: null; totalActivities: number; completionRate: number };
}> = [
  {
    docId: '1S7cXHuHkwAONHhtSgLD_sMfC7PsPp7cpGwnr3tGvsKSEOB32',
    challengeId: '1S7cXHuHkwAONHhtSgLD',
    payload: { status: 'active', completedAt: null, totalActivities: 30, completionRate: 3 },
  },
  {
    docId: 'K4eBvaSLKe4yi1taOWCc_0gO19swmbYMrbUoQaHTfzpIr6H42',
    challengeId: 'K4eBvaSLKe4yi1taOWCc',
    payload: { status: 'active', completedAt: null, totalActivities: 60, completionRate: 3 },
  },
  {
    docId: 'K4eBvaSLKe4yi1taOWCc_sMfC7PsPp7cpGwnr3tGvsKSEOB32',
    challengeId: 'K4eBvaSLKe4yi1taOWCc',
    payload: { status: 'active', completedAt: null, totalActivities: 60, completionRate: 3 },
  },
  {
    docId: 'Uqx8beHESmfbyelkkmZ0_OAKeNrvRkbPOMPjwdKAjqC0tWQK2',
    challengeId: 'Uqx8beHESmfbyelkkmZ0',
    payload: { status: 'active', completedAt: null, totalActivities: 42, completionRate: 5 },
  },
  {
    docId: 'Uqx8beHESmfbyelkkmZ0_aBYTQvEAIVgkSy621mUg77FyX652',
    challengeId: 'Uqx8beHESmfbyelkkmZ0',
    payload: { status: 'active', completedAt: null, totalActivities: 42, completionRate: 5 },
  },
  {
    docId: 'Uqx8beHESmfbyelkkmZ0_sMfC7PsPp7cpGwnr3tGvsKSEOB32',
    challengeId: 'Uqx8beHESmfbyelkkmZ0',
    payload: { status: 'active', completedAt: null, totalActivities: 42, completionRate: 5 },
  },
  {
    docId: 'bIMrgnrblJ0ajQaVtcnF_sMfC7PsPp7cpGwnr3tGvsKSEOB32',
    challengeId: 'bIMrgnrblJ0ajQaVtcnF',
    payload: { status: 'active', completedAt: null, totalActivities: 14, completionRate: 7 },
  },
];

async function run() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`CRIT-3 Step 2 — Category A Membership Repair`);
  console.log(`Mode: ${DRY_RUN ? 'DRY-RUN (zero writes)' : '⚡ LIVE — writes will be applied'}`);
  console.log('═══════════════════════════════════════════════════════════════');

  // ── Phase 1: Read current state ───────────────────────────────────────────
  console.log('\n─── Current state (before repair) ───────────────────────────────');

  const snaps = await Promise.all(
    REPAIR_PAYLOADS.map(({ docId }) => db.collection('challengeMembers').doc(docId).get()),
  );

  type Row = {
    docId: string;
    exists: boolean;
    status: string;
    completedAt: unknown;
    totalActivities: number;
    activitiesCompleted: number;
    completionRate: number;
    proposedPayload: typeof REPAIR_PAYLOADS[0]['payload'];
  };

  const rows: Row[] = [];

  for (let i = 0; i < REPAIR_PAYLOADS.length; i++) {
    const { docId, payload } = REPAIR_PAYLOADS[i];
    const snap = snaps[i];
    if (!snap.exists) {
      console.log(`  ✗ NOT FOUND: ${docId}`);
      rows.push({
        docId, exists: false, status: 'NOT_FOUND', completedAt: undefined,
        totalActivities: -1, activitiesCompleted: -1, completionRate: -1,
        proposedPayload: payload,
      });
      continue;
    }
    const data = snap.data() as Record<string, unknown>;
    const row: Row = {
      docId,
      exists: true,
      status: String(data.status ?? ''),
      completedAt: data.completedAt,
      totalActivities: Number(data.totalActivities ?? -1),
      activitiesCompleted: Number(data.activitiesCompleted ?? 0),
      completionRate: Number(data.completionRate ?? 0),
      proposedPayload: payload,
    };
    rows.push(row);

    console.log(`\n  Doc: ${docId}`);
    console.log(`    status:               ${row.status}`);
    console.log(`    completedAt:          ${row.completedAt ? 'Timestamp(set)' : 'null'}`);
    console.log(`    totalActivities:      ${row.totalActivities}`);
    console.log(`    activitiesCompleted:  ${row.activitiesCompleted}`);
    console.log(`    completionRate:       ${row.completionRate}%`);
    console.log(`    → PROPOSED:           status=active  completedAt=null  totalActivities=${payload.totalActivities}  completionRate=${payload.completionRate}%`);
  }

  // ── Phase 2: Confirm scope ────────────────────────────────────────────────
  const notFound = rows.filter(r => !r.exists);
  if (notFound.length > 0) {
    console.error(`\n✗ ABORT: ${notFound.length} document(s) not found in Firestore. Aborting before any write.`);
    for (const r of notFound) console.error(`    Missing: ${r.docId}`);
    process.exit(1);
  }

  const alreadyActive = rows.filter(r => r.status === 'active');
  if (alreadyActive.length > 0) {
    console.log(`\n  ℹ ${alreadyActive.length} record(s) already have status=active (may have been repaired already):`);
    for (const r of alreadyActive) console.log(`    ${r.docId}`);
  }

  console.log(`\n  Total records to update: ${rows.length}`);
  console.log('  Zero other records will be touched.');

  // ── Phase 3: Apply (or skip for dry-run) ─────────────────────────────────
  if (DRY_RUN) {
    console.log('\n─── DRY-RUN: no writes performed ────────────────────────────────');
    console.log('  To apply: DRY_RUN=false npx tsx scripts/repairCategoryAMemberships.ts');
  } else {
    console.log('\n─── Applying batch write ─────────────────────────────────────────');
    const batch = db.batch();
    for (const { docId, payload } of REPAIR_PAYLOADS) {
      const ref = db.collection('challengeMembers').doc(docId);
      // completedAt must be written as null (FieldValue.delete() would remove the field;
      // null keeps the field present but cleared, which the service checks for).
      batch.set(ref, {
        status: payload.status,
        completedAt: null,
        totalActivities: payload.totalActivities,
        completionRate: payload.completionRate,
      }, { merge: true });
    }
    await batch.commit();
    console.log(`  ✓ Batch committed — ${REPAIR_PAYLOADS.length} documents updated.`);

    // ── Phase 4: Post-write verification ─────────────────────────────────────
    console.log('\n─── Post-repair verification ─────────────────────────────────────');
    const postSnaps = await Promise.all(
      REPAIR_PAYLOADS.map(({ docId }) => db.collection('challengeMembers').doc(docId).get()),
    );

    let remainingCategoryA = 0;
    for (let i = 0; i < REPAIR_PAYLOADS.length; i++) {
      const { docId, payload } = REPAIR_PAYLOADS[i];
      const snap = postSnaps[i];
      const data = snap.data() as Record<string, unknown>;
      const statusOk = data.status === 'active';
      const completedAtOk = data.completedAt === null;
      const totalActivitiesOk = Number(data.totalActivities) === payload.totalActivities;
      const completionRateOk = Number(data.completionRate) === payload.completionRate;
      const ok = statusOk && completedAtOk && totalActivitiesOk && completionRateOk;
      if (!ok) remainingCategoryA++;
      console.log(`  ${ok ? '✓' : '✗'} ${docId}`);
      if (!ok) {
        console.log(`      status=${data.status} (want active=${statusOk})`);
        console.log(`      completedAt=${data.completedAt} (want null=${completedAtOk})`);
        console.log(`      totalActivities=${data.totalActivities} (want ${payload.totalActivities}=${totalActivitiesOk})`);
        console.log(`      completionRate=${data.completionRate} (want ${payload.completionRate}=${completionRateOk})`);
      }
    }

    console.log(`\n  Remaining Category A repair candidates: ${remainingCategoryA}`);
    if (remainingCategoryA === 0) {
      console.log('  ✓ All 7 records successfully repaired.');
    } else {
      console.error(`  ✗ ${remainingCategoryA} record(s) did not repair correctly. Manual inspection required.`);
      process.exit(1);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════\n');
}

run().catch((err) => { console.error(err); process.exit(1); });
