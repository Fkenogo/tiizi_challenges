import 'dotenv/config';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { rebuildUserMetricsForUser } from '../functions/src/memberUserMetrics';

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

function addCounts(target: Record<string, number>, source: Record<string, number>) {
  Object.entries(source).forEach(([key, value]) => {
    target[key] = (target[key] ?? 0) + value;
  });
}

async function run() {
  const startedAt = Date.now();
  const usersSnap = await db.collection('users').get();
  const aggregateReadCounts: Record<string, number> = { users: usersSnap.size };
  const aggregateWriteCounts: Record<string, number> = {};
  const samples: Array<Record<string, unknown>> = [];

  for (const userDoc of usersSnap.docs) {
    const result = await rebuildUserMetricsForUser(db, userDoc.id, {
      apply: applyMode,
      generatedBy: 'backfill-script',
      serverTimestamp: () => FieldValue.serverTimestamp(),
      timestampFromMillis: (ms) => Timestamp.fromMillis(ms),
    });
    addCounts(aggregateReadCounts, result.readCounts);
    addCounts(aggregateWriteCounts, result.writeCounts);
    if (samples.length < 5) {
      samples.push({
        userId: userDoc.id,
        totalActivitiesLogged: result.userMetrics.totalActivitiesLogged,
        activeChallengesCount: result.userMetrics.activeChallengesCount,
        joinedGroupsCount: result.userMetrics.joinedGroupsCount,
        hasPrimaryActiveChallenge: Boolean(result.memberHome.primaryActiveChallenge),
      });
    }
  }

  console.log(JSON.stringify({
    mode: applyMode ? 'apply' : 'dry-run',
    projectId,
    durationMs: Date.now() - startedAt,
    usersProcessed: usersSnap.size,
    targetDocs: {
      userMetrics: usersSnap.size,
      memberHome: usersSnap.size,
    },
    readCounts: aggregateReadCounts,
    writeCounts: applyMode ? aggregateWriteCounts : {},
    samples,
  }, null, 2));

  if (!applyMode) {
    console.log('Dry-run only. Re-run with CONFIRM_PROJECT_ID=tiizi-challenges npm run backfill:user-metrics:apply to write userMetrics/memberHome documents.');
  }
}

run().catch((error) => {
  console.error('User metrics backfill failed:', error);
  process.exit(1);
});
