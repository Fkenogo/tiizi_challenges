import 'dotenv/config';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type DocumentReference, type WriteBatch } from 'firebase-admin/firestore';

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

function normalizedGroupStatus(data: Record<string, unknown>): 'active' | 'deactivated' | 'suspended' | 'archived' {
  const moderationStatus = String(data.moderationStatus ?? '').toLowerCase();
  if (moderationStatus === 'deactivated') return 'deactivated';
  return 'active';
}

function normalizedVisibility(data: Record<string, unknown>): 'public' | 'private' {
  return data.visibility === 'private' || data.isPrivate === true ? 'private' : 'public';
}

function queueUpdate(batch: WriteBatch, ref: DocumentReference, payload: Record<string, unknown>) {
  batch.set(ref, payload, { merge: true });
}

async function run() {
  const startedAt = Date.now();
  const groupsSnap = await db.collection('groups').get();
  const challengesSnap = await db.collection('challenges').get();
  const batch = db.batch();
  const groupUpdates: Array<{ id: string; fields: Record<string, unknown> }> = [];
  const challengeUpdates: Array<{ id: string; fields: Record<string, unknown> }> = [];
  const groupVisibilityById = new Map<string, 'public' | 'private'>();

  groupsSnap.docs.forEach((docSnap) => {
    const data = docSnap.data();
    const fields: Record<string, unknown> = {};
    if (!data.status) fields.status = normalizedGroupStatus(data);
    if (typeof data.isPrivate !== 'boolean') fields.isPrivate = false;
    if (data.visibility !== 'public' && data.visibility !== 'private') {
      fields.visibility = normalizedVisibility(data);
    }
    if (!data.reviewStatus && typeof data.moderationStatus === 'string') fields.reviewStatus = data.moderationStatus;
    groupVisibilityById.set(docSnap.id, normalizedVisibility({ ...data, ...fields }));
    if (Object.keys(fields).length === 0) return;
    groupUpdates.push({ id: docSnap.id, fields });
    queueUpdate(batch, docSnap.ref, fields);
  });

  challengesSnap.docs.forEach((docSnap) => {
    const data = docSnap.data();
    const fields: Record<string, unknown> = {};
    const groupId = typeof data.groupId === 'string' ? data.groupId : '';
    const groupVisibility = groupVisibilityById.get(groupId) ?? 'public';
    if (!data.status) fields.status = 'active';
    if (!data.createdAt && data.startDate) fields.createdAt = data.startDate;
    if (data.groupVisibility !== 'public' && data.groupVisibility !== 'private') {
      fields.groupVisibility = groupVisibility;
    }
    if (data.visibility !== 'public' && data.visibility !== 'private') {
      fields.visibility = groupVisibility;
    }
    if (Object.keys(fields).length === 0) return;
    challengeUpdates.push({ id: docSnap.id, fields });
    queueUpdate(batch, docSnap.ref, fields);
  });

  if (applyMode && (groupUpdates.length > 0 || challengeUpdates.length > 0)) {
    await batch.commit();
  }

  console.log(JSON.stringify({
    mode: applyMode ? 'apply' : 'dry-run',
    projectId,
    durationMs: Date.now() - startedAt,
    readCounts: {
      groups: groupsSnap.size,
      challenges: challengesSnap.size,
    },
    writeCounts: {
      groups: applyMode ? groupUpdates.length : 0,
      challenges: applyMode ? challengeUpdates.length : 0,
    },
    pendingUpdates: {
      groups: groupUpdates,
      challenges: challengeUpdates,
    },
  }, null, 2));

  if (!applyMode) {
    console.log('Dry-run only. Re-run with --apply to write discovery backfill fields.');
  }
}

run().catch((error) => {
  console.error('Discovery field backfill failed:', error);
  process.exit(1);
});
