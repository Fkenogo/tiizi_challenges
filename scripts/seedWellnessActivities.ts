import 'dotenv/config';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { WELLNESS_ACTIVITIES_CATALOG } from '../src/data/wellnessActivitiesCatalog';

const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.VITE_FIREBASE_PROJECT_ID;
const requiredEnvKeys = ['GOOGLE_APPLICATION_CREDENTIALS'] as const;

if (!projectId) {
  throw new Error('Missing FIREBASE_PROJECT_ID (or fallback VITE_FIREBASE_PROJECT_ID) env var.');
}
for (const key of requiredEnvKeys) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
}

if (!getApps().length) {
  initializeApp({
    credential: applicationDefault(),
    projectId,
  });
}

const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

async function run() {
  const refs = WELLNESS_ACTIVITIES_CATALOG.map((activity) => db.collection('wellnessActivities').doc(activity.id));
  const existing = await db.getAll(...refs);
  const existingIds = new Set(existing.filter((item) => item.exists).map((item) => item.id));

  const nowIso = new Date().toISOString();
  const batch = db.batch();
  let createdCount = 0;
  let updatedCount = 0;

  for (const activity of WELLNESS_ACTIVITIES_CATALOG) {
    const ref = db.collection('wellnessActivities').doc(activity.id);
    if (existingIds.has(activity.id)) {
      updatedCount += 1;
    } else {
      createdCount += 1;
    }
    batch.set(
      ref,
      {
        ...activity,
        createdAt: activity.createdAt ?? nowIso,
        updatedAt: nowIso,
      },
      { merge: true },
    );
  }

  await batch.commit();

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
