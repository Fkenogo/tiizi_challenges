import 'dotenv/config';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore, type Firestore, type WriteBatch } from 'firebase-admin/firestore';

type Row = Record<string, unknown>;

const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.VITE_FIREBASE_PROJECT_ID;
const applyMode = process.argv.includes('--apply');
const productionProjectIds = new Set(['tiizi-challenges']);
const activeMemberStatuses = new Set(['active', 'joined', 'completed']);
const activeChallengeStatuses = new Set(['active']);

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

function stringValue(row: Row, key: string): string {
  const value = row[key];
  return typeof value === 'string' ? value : '';
}

function numberValue(row: Row, key: string): number {
  const value = row[key];
  const parsed = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function incrementMap(map: Map<string, number>, key: string) {
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + 1);
}

async function commitInChunks(dbRef: Firestore, queue: Array<(batch: WriteBatch) => void>) {
  let writes = 0;
  for (let index = 0; index < queue.length; index += 450) {
    const batch = dbRef.batch();
    queue.slice(index, index + 450).forEach((applyWrite) => applyWrite(batch));
    await batch.commit();
    writes += Math.min(450, queue.length - index);
  }
  return writes;
}

async function run() {
  const startedAt = Date.now();
  const [groupsSnap, groupMembersSnap, challengesSnap, challengeMembersSnap] = await Promise.all([
    db.collection('groups').get(),
    db.collection('groupMembers').get(),
    db.collection('challenges').get(),
    db.collection('challengeMembers').get(),
  ]);

  const activeMembersByGroup = new Map<string, number>();
  groupMembersSnap.docs.forEach((doc) => {
    const data = doc.data();
    if (activeMemberStatuses.has(stringValue(data, 'status').toLowerCase())) {
      incrementMap(activeMembersByGroup, stringValue(data, 'groupId'));
    }
  });

  const activeChallengesByGroup = new Map<string, number>();
  challengesSnap.docs.forEach((doc) => {
    const data = doc.data();
    if (activeChallengeStatuses.has(stringValue(data, 'status').toLowerCase())) {
      incrementMap(activeChallengesByGroup, stringValue(data, 'groupId'));
    }
  });

  const activeParticipantsByChallenge = new Map<string, number>();
  challengeMembersSnap.docs.forEach((doc) => {
    const data = doc.data();
    if (activeMemberStatuses.has(stringValue(data, 'status').toLowerCase())) {
      incrementMap(activeParticipantsByChallenge, stringValue(data, 'challengeId'));
    }
  });

  const groupCorrections: Array<Record<string, unknown>> = [];
  const challengeCorrections: Array<Record<string, unknown>> = [];
  const writes: Array<(batch: WriteBatch) => void> = [];

  groupsSnap.docs.forEach((doc) => {
    const data = doc.data();
    const expectedMemberCount = activeMembersByGroup.get(doc.id) ?? 0;
    const expectedActiveChallenges = activeChallengesByGroup.get(doc.id) ?? 0;
    const currentMemberCount = numberValue(data, 'memberCount');
    const currentActiveChallenges = numberValue(data, 'activeChallenges');
    const patch: Record<string, unknown> = {};

    if (currentMemberCount !== expectedMemberCount) {
      patch.memberCount = expectedMemberCount;
    }
    if (currentActiveChallenges !== expectedActiveChallenges) {
      patch.activeChallenges = expectedActiveChallenges;
    }
    if (Object.keys(patch).length === 0) return;

    groupCorrections.push({
      groupId: doc.id,
      currentMemberCount,
      expectedMemberCount,
      currentActiveChallenges,
      expectedActiveChallenges,
    });
    writes.push((batch) => batch.set(doc.ref, {
      ...patch,
      countersBackfilledAt: FieldValue.serverTimestamp(),
    }, { merge: true }));
  });

  challengesSnap.docs.forEach((doc) => {
    const data = doc.data();
    const expectedParticipantCount = activeParticipantsByChallenge.get(doc.id) ?? 0;
    const currentParticipantCount = numberValue(data, 'participantCount');
    if (currentParticipantCount === expectedParticipantCount) return;

    challengeCorrections.push({
      challengeId: doc.id,
      groupId: stringValue(data, 'groupId'),
      currentParticipantCount,
      expectedParticipantCount,
    });
    writes.push((batch) => batch.set(doc.ref, {
      participantCount: expectedParticipantCount,
      countersBackfilledAt: FieldValue.serverTimestamp(),
    }, { merge: true }));
  });

  const writeCount = applyMode ? await commitInChunks(db, writes) : 0;

  console.log(JSON.stringify({
    mode: applyMode ? 'apply' : 'dry-run',
    projectId,
    durationMs: Date.now() - startedAt,
    collectionsRead: {
      groups: groupsSnap.size,
      groupMembers: groupMembersSnap.size,
      challenges: challengesSnap.size,
      challengeMembers: challengeMembersSnap.size,
    },
    groupsProcessed: groupsSnap.size,
    challengesProcessed: challengesSnap.size,
    memberCountCorrections: groupCorrections.filter((item) => item.currentMemberCount !== item.expectedMemberCount).length,
    activeChallengesCorrections: groupCorrections.filter((item) => item.currentActiveChallenges !== item.expectedActiveChallenges).length,
    participantCountCorrections: challengeCorrections.length,
    writesPlanned: writes.length,
    writesApplied: writeCount,
    sampleGroupCorrections: groupCorrections.slice(0, 10),
    sampleChallengeCorrections: challengeCorrections.slice(0, 10),
  }, null, 2));

  if (!applyMode) {
    console.log('Dry-run only. Re-run with CONFIRM_PROJECT_ID=tiizi-challenges npm run backfill:group-counts:apply to write server-owned counters.');
  }
}

run().catch((error) => {
  console.error('Group/challenge counter backfill failed:', error);
  process.exit(1);
});
