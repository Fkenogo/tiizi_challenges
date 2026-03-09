import 'dotenv/config';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Query } from 'firebase-admin/firestore';

const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.VITE_FIREBASE_PROJECT_ID;
if (!projectId) {
  throw new Error('Missing FIREBASE_PROJECT_ID (or fallback VITE_FIREBASE_PROJECT_ID) in environment.');
}

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  throw new Error('Missing GOOGLE_APPLICATION_CREDENTIALS. Set it to the service-account JSON path.');
}

if (!getApps().length) {
  initializeApp({
    credential: applicationDefault(),
    projectId,
  });
}

const db = getFirestore();
const collectionName = 'groupMembers';
const seedTag = process.env.SEED_TAG ?? 'tiizi_seed_v1';
const args = new Set(process.argv.slice(2));
const shouldApply = args.has('--apply');

type GroupMembership = {
  groupId?: string;
  userId?: string;
  status?: string;
  seedTag?: string;
};

async function getQueryCount(queryRef: Query): Promise<number> {
  const snap = await queryRef.get();
  return snap.size;
}

async function deleteInBatches(docIds: string[]): Promise<number> {
  let deleted = 0;
  const chunkSize = 400;

  for (let i = 0; i < docIds.length; i += chunkSize) {
    const chunk = docIds.slice(i, i + chunkSize);
    const batch = db.batch();
    chunk.forEach((id) => {
      batch.delete(db.collection(collectionName).doc(id));
    });
    await batch.commit();
    deleted += chunk.length;
  }

  return deleted;
}

async function main() {
  const exactSeedQuery = db.collection(collectionName).where('seedTag', '==', seedTag);
  const exactSeedSnap = await exactSeedQuery.get();

  const legacySnap = await db.collection(collectionName).where('seedTag', '!=', null).get();
  const legacyOtherIds = legacySnap.docs
    .filter((doc) => {
      const data = doc.data() as GroupMembership;
      return typeof data.seedTag === 'string' && data.seedTag !== seedTag;
    })
    .map((doc) => doc.id);

  const totalGroupMembers = await getQueryCount(db.collection(collectionName));

  console.log(JSON.stringify({
    mode: shouldApply ? 'apply' : 'dry-run',
    projectId,
    collection: collectionName,
    totalGroupMembers,
    seedTag,
    targetDeleteCount: exactSeedSnap.size + legacyOtherIds.length,
    matches: {
      exactSeedTag: exactSeedSnap.size,
      legacyOtherSeedTags: legacyOtherIds.length,
    },
  }, null, 2));

  if (!shouldApply) {
    console.log('Dry-run only. Re-run with --apply to delete matching docs.');
    return;
  }

  const toDelete = [...exactSeedSnap.docs.map((doc) => doc.id), ...legacyOtherIds];
  if (toDelete.length === 0) {
    console.log('No seeded group memberships found. Nothing to delete.');
    return;
  }

  const deleted = await deleteInBatches(toDelete);
  const remaining = await getQueryCount(db.collection(collectionName));
  console.log(JSON.stringify({ deleted, remaining }, null, 2));
}

main().catch((error) => {
  console.error('Cleanup failed:', error);
  process.exit(1);
});
