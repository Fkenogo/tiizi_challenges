import 'dotenv/config';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type WriteBatch } from 'firebase-admin/firestore';
import { WELLNESS_ACTIVITIES_CATALOG } from '../src/data/wellnessActivitiesCatalog';

const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.VITE_FIREBASE_PROJECT_ID;

if (!projectId) {
  throw new Error('Missing FIREBASE_PROJECT_ID (or fallback VITE_FIREBASE_PROJECT_ID) env var.');
}

// GOOGLE_APPLICATION_CREDENTIALS is optional when Application Default Credentials
// (ADC) are already configured via `gcloud auth application-default login`.
// applicationDefault() finds ADC automatically in either case.

if (!getApps().length) {
  initializeApp({
    credential: applicationDefault(),
    projectId,
  });
}

const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

type Op = (batch: WriteBatch) => void;

async function commitOps(ops: Op[]): Promise<void> {
  const BATCH_SIZE = 499; // Firestore max is 500 ops per batch
  for (let i = 0; i < ops.length; i += BATCH_SIZE) {
    const batch = db.batch();
    ops.slice(i, i + BATCH_SIZE).forEach((op) => op(batch));
    await batch.commit();
    console.log(`  committed batch [${i + 1}–${Math.min(i + BATCH_SIZE, ops.length)}] of ${ops.length} total ops`);
  }
}

async function run() {
  // 1. Read all current Firestore documents
  const allSnapshot = await db.collection('wellnessActivities').get();
  const allCurrentIds = new Set(allSnapshot.docs.map((d) => d.id));
  const catalogIds = new Set(WELLNESS_ACTIVITIES_CATALOG.map((a) => a.id));

  // 2. Identify retired docs to delete (in Firestore but not in the new catalog)
  const toDelete = [...allCurrentIds].filter((id) => !catalogIds.has(id));

  // 3. Identify which catalog docs already exist (update) vs are new (create)
  const existingIds = new Set([...allCurrentIds].filter((id) => catalogIds.has(id)));

  const nowIso = new Date().toISOString();
  const ops: Op[] = [];
  let createdCount = 0;
  let updatedCount = 0;
  const deletedCount = toDelete.length;

  // Queue deletions first
  for (const id of toDelete) {
    const ref = db.collection('wellnessActivities').doc(id);
    ops.push((batch) => batch.delete(ref));
  }

  // Queue upserts
  for (const activity of WELLNESS_ACTIVITIES_CATALOG) {
    const ref = db.collection('wellnessActivities').doc(activity.id);
    if (existingIds.has(activity.id)) {
      updatedCount += 1;
    } else {
      createdCount += 1;
    }
    const payload = {
      ...activity,
      createdAt: activity.createdAt ?? nowIso,
      updatedAt: nowIso,
    };
    ops.push((batch) => batch.set(ref, payload, { merge: true }));
  }

  console.log(`\nWellness Activities Seed — ${new Date().toISOString()}`);
  console.log(`  Deletions queued : ${deletedCount}`);
  console.log(`  Creates queued   : ${createdCount}`);
  console.log(`  Updates queued   : ${updatedCount}`);
  console.log(`  Total ops        : ${ops.length}`);

  await commitOps(ops);

  // Post-seed count
  const snapshot = await db.collection('wellnessActivities').get();
  const countsByCategory = snapshot.docs.reduce<Record<string, number>>((acc, item) => {
    const category = String((item.data() as { category?: string }).category ?? 'unknown');
    acc[category] = (acc[category] ?? 0) + 1;
    return acc;
  }, {});

  console.log(
    JSON.stringify(
      {
        projectId,
        seededActivities: WELLNESS_ACTIVITIES_CATALOG.length,
        createdCount,
        updatedCount,
        deletedCount,
        totalActivitiesInCollection: snapshot.size,
        countsByCategory,
      },
      null,
      2,
    ),
  );
}

run().catch((error) => {
  console.error('Wellness activity seed failed:', error);
  process.exit(1);
});
