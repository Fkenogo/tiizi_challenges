import 'dotenv/config';
import { applicationDefault, getApps, initializeApp as initializeAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { initializeApp as initializeClientApp, deleteApp as deleteClientApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signOut } from 'firebase/auth';
import {
  collection,
  doc,
  getFirestore,
  increment,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';

const challengeId = argValue('--challengeId') ?? 'K4eBvaSLKe4yi1taOWCc';
const groupId = argValue('--groupId') ?? 'seed_group_early_birds';
const uid = argValue('--uid') ?? 'sMfC7PsPp7cpGwnr3tGvsKSEOB32';
const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.VITE_FIREBASE_PROJECT_ID;
const projectNumber = process.env.VITE_FIREBASE_MESSAGING_SENDER_ID;
const tokenSignerServiceAccount = process.env.DIAG_TOKEN_SIGNER_SERVICE_ACCOUNT
  ?? (projectId ? `firebase-adminsdk-fbsvc@${projectId}.iam.gserviceaccount.com` : undefined);
const runId = `diag_activity_session_${Date.now()}`;

if (!projectId) throw new Error('Missing FIREBASE_PROJECT_ID or VITE_FIREBASE_PROJECT_ID.');

function argValue(name) {
  const arg = process.argv.find((item) => item.startsWith(`${name}=`));
  return arg?.slice(name.length + 1);
}

function firebaseConfig() {
  return {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
  };
}

function toPlainData(snap) {
  return snap.exists ? snap.data() : undefined;
}

function scrubPayload(payload) {
  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => {
      if (key === 'notes') return [key, value ? '[redacted-note]' : value];
      if (value && typeof value === 'object' && value.constructor?.name === 'ServerTimestampFieldValueImpl') {
        return [key, '[serverTimestamp]'];
      }
      if (value && typeof value === 'object' && value.constructor?.name === 'NumericIncrementFieldValueImpl') {
        return [key, '[increment]'];
      }
      return [key, value];
    }),
  );
}

function logPayload(label, path, payload) {
  console.log(JSON.stringify({
    label,
    path,
    keys: Object.keys(payload).sort(),
    payload: scrubPayload(payload),
  }, null, 2));
}

function stableActivityIdFor(activity, activityIndex, fallbackExerciseId) {
  return activity.id
    || activity.activityId
    || fallbackExerciseId
    || activity.exerciseId
    || `${challengeId}_${activityIndex}`;
}

function todayIsoDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function buildWorkouts(challenge, challengeMember) {
  const activities = Array.isArray(challenge.activities) && challenge.activities.length > 0
    ? challenge.activities
    : Array.isArray(challenge.exerciseIds)
      ? challenge.exerciseIds.map((exerciseId) => ({ exerciseId, exerciseName: exerciseId, unit: 'reps' }))
      : [];
  const date = todayIsoDate();
  return activities.slice(0, 2).map((activity, index) => {
    const exerciseId = activity.exerciseId || `${challengeId}_${index}`;
    const unit = activity.unit || 'reps';
    const value = unit.toLowerCase() === 'seconds' ? 30 : 10;
    return {
      path: `workouts/${runId}_workout_${index + 1}`,
      payload: {
        userId: uid,
        challengeId,
        groupId,
        activityId: stableActivityIdFor(activity, index, exerciseId),
        exerciseId,
        exerciseName: activity.exerciseName || exerciseId,
        value,
        unit,
        date,
        completedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        loggedAt: serverTimestamp(),
      },
      points: Math.max(1, Math.min(1000, Number(activity.pointsPerCompletion ?? 10))),
    };
  });
}

function buildProgressUpdate(challenge, challengeMember, entryCount, totalPoints) {
  const configuredActivities = Array.isArray(challenge.activities) ? challenge.activities.length : 0;
  const configuredExerciseIds = Array.isArray(challenge.exerciseIds) ? challenge.exerciseIds.length : 0;
  const totalActivities = Math.max(1, configuredActivities, configuredExerciseIds, Number(challengeMember.totalActivities ?? 1));
  const nextCompleted = Math.min(Number(challengeMember.activitiesCompleted ?? 0) + entryCount, totalActivities);
  const nextRate = Math.min(100, Math.round((nextCompleted / totalActivities) * 100));
  const payload = {
    activitiesCompleted: nextCompleted,
    totalPoints: increment(totalPoints),
    lastActivityAt: serverTimestamp(),
    completionRate: nextRate,
  };
  if (nextRate >= 100 && challengeMember.status !== 'completed') {
    payload.status = 'completed';
    payload.completedAt = serverTimestamp();
  }
  return {
    path: `challengeMembers/${challengeId}_${uid}`,
    payload,
    nextCompleted,
    totalActivities,
  };
}

async function restoreDoc(adminDb, path, snapshotData) {
  const ref = adminDb.doc(path);
  if (snapshotData === undefined) {
    await ref.delete().catch(() => undefined);
  } else {
    await ref.set(snapshotData);
  }
}

async function cleanup(adminDb, snapshots, createdWorkoutPaths) {
  await new Promise((resolve) => setTimeout(resolve, 4000));
  const pathsToRestore = Object.keys(snapshots);
  await Promise.all([
    ...createdWorkoutPaths.map((path) => adminDb.doc(path).delete().catch(() => undefined)),
    ...createdWorkoutPaths.map((path) => adminDb.doc(`groupActivityFeed/${path.split('/')[1]}`).delete().catch(() => undefined)),
    ...pathsToRestore.map((path) => restoreDoc(adminDb, path, snapshots[path])),
  ]);
}

async function runTest(label, writeFn, cleanupFn) {
  console.log(`\n=== ${label} ===`);
  try {
    await writeFn();
    console.log(JSON.stringify({ label, status: 'PASS' }, null, 2));
    return { label, status: 'PASS' };
  } catch (error) {
    console.log(JSON.stringify({
      label,
      status: 'FAIL',
      code: error?.code,
      message: error?.message,
      name: error?.name,
    }, null, 2));
    return { label, status: 'FAIL', code: error?.code, message: error?.message };
  } finally {
    await cleanupFn?.();
  }
}

async function run() {
  const adminApp = getApps().length
    ? getApps()[0]
    : initializeAdminApp({
      credential: applicationDefault(),
      projectId,
      serviceAccountId: tokenSignerServiceAccount,
    });
  const adminDb = getAdminFirestore(adminApp);
  const adminAuth = getAdminAuth(adminApp);

  const [challengeSnap, groupMemberSnap, challengeMemberSnap] = await Promise.all([
    adminDb.doc(`challenges/${challengeId}`).get(),
    adminDb.doc(`groupMembers/${groupId}_${uid}`).get(),
    adminDb.doc(`challengeMembers/${challengeId}_${uid}`).get(),
  ]);
  if (!challengeSnap.exists) throw new Error(`Missing challenge ${challengeId}`);
  if (!challengeMemberSnap.exists) throw new Error(`Missing challengeMembers/${challengeId}_${uid}`);

  const challenge = challengeSnap.data();
  const challengeMember = challengeMemberSnap.data();
  const workouts = buildWorkouts(challenge, challengeMember);
  if (workouts.length < 2) throw new Error('Challenge does not have two diagnostic activities.');
  const totalPoints = workouts.reduce((sum, item) => sum + item.points, 0);
  const progress = buildProgressUpdate(challenge, challengeMember, workouts.length, totalPoints);

  const restorePaths = [
    progress.path,
    `challengeActivitySummaries/${challengeId}`,
    `groupMemberStats/${groupId}_${uid}`,
    `groupLeaderboards/${groupId}_${uid}`,
    `challengeLeaderboards/${challengeId}_${uid}`,
  ];
  const restoreSnaps = await Promise.all(restorePaths.map((path) => adminDb.doc(path).get()));
  const snapshots = Object.fromEntries(restorePaths.map((path, index) => [path, toPlainData(restoreSnaps[index])]));
  const createdWorkoutPaths = workouts.map((item) => item.path);

  console.log(JSON.stringify({
    source: 'PRODUCTION diagnostic: client SDK writes as target uid via custom token; Admin SDK cleanup restores touched docs.',
    projectId,
    projectNumber,
    tokenSignerServiceAccount,
    challengeId,
    groupId,
    uid,
    runId,
    productionDocs: {
      challenge: {
        status: challenge.status,
        groupId: challenge.groupId,
        activitiesCount: Array.isArray(challenge.activities) ? challenge.activities.length : 0,
        exerciseIdsCount: Array.isArray(challenge.exerciseIds) ? challenge.exerciseIds.length : 0,
      },
      groupMember: groupMemberSnap.exists ? {
        status: groupMemberSnap.data()?.status,
        groupId: groupMemberSnap.data()?.groupId,
        userId: groupMemberSnap.data()?.userId,
      } : { exists: false },
      challengeMember: {
        status: challengeMember.status,
        activitiesCompleted: challengeMember.activitiesCompleted,
        totalActivities: challengeMember.totalActivities,
        totalPoints: challengeMember.totalPoints,
        completionRate: challengeMember.completionRate,
      },
    },
  }, null, 2));
  workouts.forEach((workout, index) => logPayload(`workout create ${index + 1}`, workout.path, workout.payload));
  logPayload('challengeMembers progress update', progress.path, progress.payload);

  const clientApp = initializeClientApp(firebaseConfig(), `prod-diag-${Date.now()}`);
  const clientAuth = getAuth(clientApp);
  const clientDb = getFirestore(clientApp);
  const token = await adminAuth.createCustomToken(uid, { diagnostic: 'activity-session' });
  await signInWithCustomToken(clientAuth, token);
  console.log(JSON.stringify({
    authenticatedAs: clientAuth.currentUser?.uid,
    customTokenUidMatchesTarget: clientAuth.currentUser?.uid === uid,
  }, null, 2));

  const results = [];
  const cleanupAll = () => cleanup(adminDb, snapshots, createdWorkoutPaths);

  results.push(await runTest('1. workout create for activity 1 only', async () => {
    await setDoc(doc(clientDb, workouts[0].path), workouts[0].payload);
  }, cleanupAll));

  results.push(await runTest('2. workout create for activity 2 only', async () => {
    await setDoc(doc(clientDb, workouts[1].path), workouts[1].payload);
  }, cleanupAll));

  results.push(await runTest('3. two workout creates in one batch without challengeMembers update', async () => {
    const batch = writeBatch(clientDb);
    workouts.forEach((workout) => batch.set(doc(clientDb, workout.path), workout.payload));
    await batch.commit();
  }, cleanupAll));

  results.push(await runTest('4. challengeMembers progress update only', async () => {
    const batch = writeBatch(clientDb);
    batch.set(doc(clientDb, progress.path), progress.payload, { merge: true });
    await batch.commit();
  }, cleanupAll));

  results.push(await runTest('5. full batch: two workout creates + challengeMembers update', async () => {
    const batch = writeBatch(clientDb);
    workouts.forEach((workout) => batch.set(doc(clientDb, workout.path), workout.payload));
    batch.set(doc(clientDb, progress.path), progress.payload, { merge: true });
    await batch.commit();
  }, cleanupAll));

  await cleanupAll();
  await signOut(clientAuth).catch(() => undefined);
  await deleteClientApp(clientApp);

  console.log(JSON.stringify({
    summary: results,
    cleanup: {
      restored: restorePaths,
      deletedDiagnosticWorkouts: createdWorkoutPaths,
      note: 'Cloud Function summary docs are snapshotted/restored after each successful write window.',
    },
  }, null, 2));
}

run().catch((error) => {
  console.error('Production activity session diagnostic failed:', {
    code: error?.code,
    message: error?.message,
    stack: error?.stack,
  });
  process.exit(1);
});
