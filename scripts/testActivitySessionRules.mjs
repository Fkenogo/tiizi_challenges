import { deleteApp as deleteAdminApp, initializeApp as initializeAdminApp } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { deleteApp as deleteClientApp, initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
} from 'firebase/auth';
import {
  connectFirestoreEmulator,
  collection,
  doc,
  getFirestore,
  increment,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';

const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'demo-tiizi-rules';
const challengeId = 'rules_multi_activity_challenge';
const groupId = 'rules_group';

function splitHostPort(value, fallbackPort) {
  const normalized = String(value || `127.0.0.1:${fallbackPort}`).replace(/^https?:\/\//, '');
  const [host, port] = normalized.split(':');
  return { host, port: Number(port || fallbackPort) };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function expectPermissionDenied(label, action) {
  try {
    await action();
  } catch (error) {
    if (error?.code === 'permission-denied') {
      console.log(`${label}: rejected as expected`);
      return;
    }
    throw error;
  }
  throw new Error(`${label}: expected permission-denied, but write succeeded`);
}

function workoutPayload(uid, activityId, exerciseName, value, unit, override = {}) {
  return {
    userId: uid,
    challengeId,
    groupId,
    activityId,
    exerciseId: activityId,
    exerciseName,
    value,
    unit,
    date: '2026-06-08',
    completedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    loggedAt: serverTimestamp(),
    ...override,
  };
}

async function seed(adminDb, uid) {
  await Promise.all([
    adminDb.collection('challenges').doc(challengeId).set({
      name: 'Rules Multi Activity Challenge',
      groupId,
      status: 'active',
      activities: [
        { exerciseId: 'modified-push-up', exerciseName: 'Modified Push-Up', unit: 'reps', targetValue: 1200 },
        { exerciseId: 'bear-crawl-hold', exerciseName: 'Bear Crawl Hold', unit: 'seconds', targetValue: 1000 },
      ],
      exerciseIds: ['modified-push-up', 'bear-crawl-hold'],
    }),
    adminDb.collection('groups').doc(groupId).set({
      name: 'Rules Group',
      status: 'active',
      isPrivate: false,
    }),
    adminDb.collection('groupMembers').doc(`${groupId}_${uid}`).set({
      groupId,
      userId: uid,
      status: 'joined',
      role: 'member',
    }),
    adminDb.collection('challengeMembers').doc(`${challengeId}_${uid}`).set({
      challengeId,
      groupId,
      userId: uid,
      status: 'active',
      activitiesCompleted: 0,
      totalActivities: 2,
      totalPoints: 0,
      completionRate: 0,
    }),
  ]);
}

async function run() {
  const adminApp = initializeAdminApp({ projectId });
  const adminDb = getAdminFirestore();

  const app = initializeApp({
    projectId,
    apiKey: 'demo-key',
    appId: 'demo-app',
  }, `rules-test-${Date.now()}`);
  const auth = getAuth(app);
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
  connectAuthEmulator(auth, `http://${authHost}`, { disableWarnings: true });

  const clientDb = getFirestore(app);
  const firestoreHost = splitHostPort(process.env.FIRESTORE_EMULATOR_HOST, 8080);
  connectFirestoreEmulator(clientDb, firestoreHost.host, firestoreHost.port);

  const email = `rules-${Date.now()}@example.test`;
  const credential = await createUserWithEmailAndPassword(auth, email, 'Password123!');
  const uid = credential.user.uid;
  await seed(adminDb, uid);

  const singleBatch = writeBatch(clientDb);
  singleBatch.set(doc(collection(clientDb, 'workouts')), workoutPayload(uid, 'modified-push-up', 'Modified Push-Up', 10, 'reps'));
  await singleBatch.commit();
  console.log('single workout create: passed');

  const multiBatch = writeBatch(clientDb);
  multiBatch.set(doc(collection(clientDb, 'workouts')), workoutPayload(uid, 'modified-push-up', 'Modified Push-Up', 10, 'reps'));
  multiBatch.set(doc(collection(clientDb, 'workouts')), workoutPayload(uid, 'bear-crawl-hold', 'Bear Crawl Hold', 30, 'seconds'));
  multiBatch.set(doc(clientDb, 'challengeMembers', `${challengeId}_${uid}`), {
    activitiesCompleted: 2,
    totalPoints: increment(20),
    lastActivityAt: serverTimestamp(),
    completionRate: 100,
    status: 'completed',
    completedAt: serverTimestamp(),
  }, { merge: true });
  await multiBatch.commit();
  console.log('two workouts + challengeMembers update batch: passed');

  await expectPermissionDenied('invalid group workout create', async () => {
    const invalidBatch = writeBatch(clientDb);
    invalidBatch.set(doc(collection(clientDb, 'workouts')), workoutPayload(uid, 'modified-push-up', 'Modified Push-Up', 10, 'reps', {
      groupId: 'wrong_group',
    }));
    await invalidBatch.commit();
  });

  const updated = await adminDb.collection('challengeMembers').doc(`${challengeId}_${uid}`).get();
  assert(updated.data()?.activitiesCompleted === 2, 'challengeMembers activitiesCompleted was not updated to 2');
  console.log(JSON.stringify({
    projectId,
    uid,
    checks: {
      singleWorkoutCreate: 'passed',
      multiWorkoutBatch: 'passed',
      invalidGroupCreate: 'rejected',
      challengeMemberActivitiesCompleted: updated.data()?.activitiesCompleted,
    },
  }, null, 2));
  await auth.signOut().catch(() => undefined);
  await deleteClientApp(app);
  await deleteAdminApp(adminApp);
}

run().catch((error) => {
  console.error('Activity session rules emulator test failed:', error);
  process.exit(1);
});
