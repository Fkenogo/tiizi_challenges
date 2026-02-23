import 'dotenv/config';
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import exercisesData from '../catalogExercises_CLEAN.json';

const requiredEnvKeys = [
  'VITE_FIREBASE_PROJECT_ID',
  'GOOGLE_APPLICATION_CREDENTIALS',
] as const;

for (const key of requiredEnvKeys) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
}

const projectId = process.env.VITE_FIREBASE_PROJECT_ID as string;

if (!getApps().length) {
  initializeApp({
    credential: applicationDefault(),
    projectId,
  });
}

const db = getFirestore();

type ExerciseDocument = { id: string; name: string } & Record<string, unknown>;

async function loadExercises() {
  const documents = exercisesData.documents as ExerciseDocument[];
  console.log(`Loading ${documents.length} exercises...`);

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
