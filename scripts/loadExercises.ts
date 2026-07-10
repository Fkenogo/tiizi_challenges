import 'dotenv/config';
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import exercisesData from '../catalogExercises_CLEAN.json';

const isDryRun = process.argv.includes('--dry-run');
const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.VITE_FIREBASE_PROJECT_ID;
const requiredEnvKeys = ['GOOGLE_APPLICATION_CREDENTIALS'] as const;

if (!isDryRun) {
  if (!projectId) {
    throw new Error('Missing FIREBASE_PROJECT_ID (or fallback VITE_FIREBASE_PROJECT_ID) env var.');
  }
  for (const key of requiredEnvKeys) {
    if (!process.env[key]) {
      throw new Error(`Missing required env var: ${key}`);
    }
  }
}

type ExerciseDocument = { id: string; name: string; tags?: string[]; movementType?: string; holdBased?: boolean } & Record<string, unknown>;

async function loadExercises() {
  const documents = exercisesData.documents as ExerciseDocument[];
  const isometric = documents.filter((d) => d.movementType === 'isometric');
  const isotonic = documents.filter((d) => d.movementType === 'isotonic');
  const untagged = documents.filter((d) => !d.movementType);

  console.log(`\n📋 Exercise Catalog Summary`);
  console.log(`   Total:     ${documents.length}`);
  console.log(`   Isometric: ${isometric.length}`);
  console.log(`   Isotonic:  ${isotonic.length}`);
  console.log(`   Untagged:  ${untagged.length}`);

  if (isDryRun) {
    console.log('\n🔍 DRY RUN — no Firestore writes will be made.\n');
    console.log('Isometric exercises:');
    isometric.forEach((d) => console.log(`  ✓ [${d.id}] ${d.name}`));
    console.log('\nIsotonic exercises:');
    isotonic.forEach((d) => console.log(`  ✓ [${d.id}] ${d.name}`));
    console.log('\nUntagged exercises (not yet classified):');
    untagged.forEach((d) => console.log(`  - [${d.id}] ${d.name}`));
    console.log('\nDry run complete. Pass --apply to write to Firestore.');
    return;
  }

  if (!getApps().length) {
    initializeApp({
      credential: applicationDefault(),
      projectId,
    });
  }

  const db = getFirestore();
  console.log(`\nLoading ${documents.length} exercises to Firestore...`);

  const batchSize = 100;
  for (let i = 0; i < documents.length; i += batchSize) {
    const chunk = documents.slice(i, i + batchSize);
    const batch = db.batch();
    for (const exercise of chunk) {
      const ref = db.collection('catalogExercises').doc(exercise.id);
      batch.set(ref, exercise);
    }
    await batch.commit();
    console.log(`Loaded ${Math.min(i + batchSize, documents.length)}/${documents.length}`);
  }

  console.log('All exercises loaded successfully.');
}

loadExercises().catch((error) => {
  console.error('Error loading exercises:', error);
  process.exit(1);
});
