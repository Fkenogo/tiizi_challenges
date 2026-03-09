import 'dotenv/config';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

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
const applyMode = process.argv.includes('--apply');
const keepAuth = process.argv.includes('--keep-auth');
const mode = applyMode ? 'apply' : 'dry-run';

if (!getApps().length) {
  initializeApp({
    credential: applicationDefault(),
    projectId,
  });
}

const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });
const auth = getAuth();

const collectionsToReset = [
  'users',
  'admins',
  'groups',
  'groupMembers',
  'challenges',
  'challengeMembers',
  'workouts',
  'dailyGoals',
  'wellnessTemplates',
  'wellnessActivities',
  'wellnessLogs',
  'challengeTemplates',
  'exerciseInterests',
  'wellnessGoals',
  'onboardingContent',
  'notificationTemplates',
  'notifications',
  'supportTickets',
  'groupReports',
  'donationCampaigns',
  'donationTransactions',
  'supportDonations',
  'systemLogs',
  'settings',
];

async function listAllAuthUids(): Promise<string[]> {
  const uids: string[] = [];
  let pageToken: string | undefined;
  do {
    const page = await auth.listUsers(1000, pageToken);
    page.users.forEach((u) => uids.push(u.uid));
    pageToken = page.pageToken;
  } while (pageToken);
  return uids;
}

async function listCollectionRefs(collectionName: string) {
  const snap = await db.collection(collectionName).get();
  return snap.docs.map((doc) => doc.ref);
}

async function deleteRefs(refs: FirebaseFirestore.DocumentReference[]) {
  let deleted = 0;
  for (let i = 0; i < refs.length; i += 400) {
    const chunk = refs.slice(i, i + 400);
    const batch = db.batch();
    chunk.forEach((ref) => batch.delete(ref));
    await batch.commit();
    deleted += chunk.length;
  }
  return deleted;
}

async function deleteAuthUsers(uids: string[]) {
  let deleted = 0;
  for (let i = 0; i < uids.length; i += 100) {
    const chunk = uids.slice(i, i + 100);
    const result = await auth.deleteUsers(chunk);
    deleted += result.successCount;
  }
  return deleted;
}

async function run() {
  const report: Record<string, number> = {};
  const deleteQueue: FirebaseFirestore.DocumentReference[] = [];

  for (const collectionName of collectionsToReset) {
    const refs = await listCollectionRefs(collectionName);
    report[collectionName] = refs.length;
    deleteQueue.push(...refs);
  }

  const authUids = keepAuth ? [] : await listAllAuthUids();
  const unique = new Map<string, FirebaseFirestore.DocumentReference>();
  deleteQueue.forEach((ref) => unique.set(ref.path, ref));
  const firestoreRefs = Array.from(unique.values());

  console.log(
    JSON.stringify(
      {
        mode,
        projectId,
        keepAuth,
        firestoreTargets: firestoreRefs.length,
        authUsersTarget: authUids.length,
        collections: report,
      },
      null,
      2,
    ),
  );

  if (!applyMode) {
    console.log('Dry-run only. Re-run with --apply to execute full reset.');
    return;
  }

  const deletedFirestore = await deleteRefs(firestoreRefs);
  const deletedAuthUsers = keepAuth ? 0 : await deleteAuthUsers(authUids);

  console.log(
    JSON.stringify(
      {
        mode,
        keepAuth,
        deletedFirestore,
        deletedAuthUsers,
      },
      null,
      2,
    ),
  );
}

run().catch((error) => {
  console.error('Full reset failed:', error);
  process.exit(1);
});
