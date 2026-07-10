import 'dotenv/config';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { rebuildAdminMetrics } from '../functions/src/adminMetricsCore';

const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.VITE_FIREBASE_PROJECT_ID;
const requiredEnvKeys = ['GOOGLE_APPLICATION_CREDENTIALS'] as const;
const applyMode = process.argv.includes('--apply');
const productionProjectIds = new Set(['tiizi-challenges']);

if (!projectId) {
  throw new Error('Missing FIREBASE_PROJECT_ID (or fallback VITE_FIREBASE_PROJECT_ID) env var.');
}
for (const key of requiredEnvKeys) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
}
if (applyMode && productionProjectIds.has(projectId) && process.env.CONFIRM_PROJECT_ID !== projectId) {
  throw new Error(`Refusing to write to production project "${projectId}" unless CONFIRM_PROJECT_ID=${projectId}.`);
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
  const result = await rebuildAdminMetrics(db, { apply: applyMode, generatedBy: 'script' });

  console.log(JSON.stringify({ ...result, projectId }, null, 2));

  if (!applyMode) {
    console.log('Dry-run only. Re-run with --apply to write adminMetrics documents.');
  } else {
    console.log(JSON.stringify({
      mode: result.mode,
      projectId,
      wrote: ['adminMetrics/overview', 'adminMetrics/engagement', 'adminMetrics/revenue', 'adminMetrics/userGrowth'],
    }, null, 2));
  }
}

run().catch((error) => {
  console.error('Admin metrics rebuild failed:', error);
  process.exit(1);
});
