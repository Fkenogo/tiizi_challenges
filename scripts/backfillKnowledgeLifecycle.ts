/**
 * P1-3 / P1-4 — Canonical Knowledge lifecycle + version backfill.
 *
 * Stamps missing governance fields on canonical catalogue documents:
 *   - lifecycleStatus: 'published' (legacy records predate the lifecycle;
 *     treating them as published keeps the existing catalogue visible)
 *   - knowledgeVersion: 1 (legacy records predate version tracking)
 *
 * Bounded and safe:
 *   - only documents MISSING a field are touched; existing values are never
 *     overwritten;
 *   - dry-run by default — pass --apply to write;
 *   - refuses production writes unless CONFIRM_PROJECT_ID matches.
 *
 * Run: npx tsx scripts/backfillKnowledgeLifecycle.ts [--apply]
 */
import 'dotenv/config';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { isLifecycleStatus, normalizeKnowledgeVersion } from '../src/utils/knowledgeLifecycle';

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

const COLLECTIONS = ['catalogExercises', 'wellnessActivities'] as const;

async function run() {
  let scanned = 0;
  let stamped = 0;
  const perCollection: Record<string, { scanned: number; stamped: number }> = {};

  for (const collectionName of COLLECTIONS) {
    const snap = await db.collection(collectionName).get();
    let collectionStamped = 0;
    for (const docSnap of snap.docs) {
      scanned += 1;
      const data = docSnap.data() as Record<string, unknown>;
      const update: Record<string, unknown> = {};
      if (!isLifecycleStatus(data.lifecycleStatus)) {
        update.lifecycleStatus = 'published';
      }
      const version = data.knowledgeVersion;
      if (!(typeof version === 'number' && Number.isFinite(version) && version >= 1)) {
        update.knowledgeVersion = normalizeKnowledgeVersion(version);
      }
      if (Object.keys(update).length > 0) {
        collectionStamped += 1;
        stamped += 1;
        if (applyMode) {
          await docSnap.ref.update(update);
        } else {
          console.log(`[dry-run] ${collectionName}/${docSnap.id} would set ${JSON.stringify(update)}`);
        }
      }
    }
    perCollection[collectionName] = { scanned: snap.size, stamped: collectionStamped };
  }

  console.log(`Knowledge lifecycle backfill ${applyMode ? 'APPLIED' : 'DRY-RUN'}: scanned=${scanned} stamped=${stamped}`);
  for (const [name, stats] of Object.entries(perCollection)) {
    console.log(`  ${name}: scanned=${stats.scanned} stamped=${stats.stamped}`);
  }
}

run().catch((error) => {
  console.error('Knowledge lifecycle backfill failed:', error);
  process.exit(1);
});
