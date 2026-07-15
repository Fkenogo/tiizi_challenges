import 'dotenv/config';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { rebuildSupportDonationSummary } from '../functions/src/supportDonationSummary';

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
  initializeApp({
    credential: applicationDefault(),
    projectId,
  });
}

const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

async function run() {
  const result = await rebuildSupportDonationSummary(db, {
    apply: applyMode,
    generatedBy: 'script',
  });

  console.log(JSON.stringify({ ...result, projectId }, null, 2));

  if (!applyMode) {
    console.log('Dry-run only. Re-run with CONFIRM_PROJECT_ID=tiizi-challenges npm run backfill:support-summary:apply to write supportDonationSummary/current.');
  }
}

run().catch((error) => {
  console.error('Support donation summary backfill failed:', error);
  process.exit(1);
});
