/**
 * P4J smoke test — read-only Firestore document inspector.
 * Uses application default credentials via gcloud SDK credential.
 * No writes.
 */

import 'dotenv/config';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.VITE_FIREBASE_PROJECT_ID ?? 'tiizi-challenges';

if (!getApps().length) {
  // Use applicationDefault which picks up gcloud user ADC
  const { applicationDefault } = await import('firebase-admin/app');
  initializeApp({ credential: applicationDefault(), projectId });
}

const db = getFirestore();

async function sampleCollection(name: string, limit = 6) {
  const snap = await db.collection(name).orderBy('createdAt', 'desc').limit(limit).get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id.slice(0, 10) + '…',
      userId: (String(data.userId ?? '')).slice(0, 8) + '…',
      challengeId: (String(data.challengeId ?? '')).slice(0, 8) + '…',
      scoringVersion: data.scoringVersion ?? '[absent]',
      points: data.points ?? '[absent]',
      rawValue: data.rawValue ?? '[absent]',
      targetValue: data.targetValue ?? '[absent]',
      metTarget: data.metTarget ?? '[absent]',
      scoringMethod: data.scoringMethod ?? '[absent]',
      capped: data.capped ?? '[absent]',
      value: data.value,
    };
  });
}

async function sampleLeaderboards(limit = 6) {
  const snap = await db.collection('challengeLeaderboards').limit(limit).get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id.slice(0, 12) + '…',
      userId: (String(data.userId ?? '')).slice(0, 8) + '…',
      score: data.score,
      activityCount: data.activityCount,
      lastScoringVersion: data.lastScoringVersion ?? '[absent]',
    };
  });
}

async function sampleChallengeMembers(limit = 5) {
  const snap = await db.collection('challengeMembers').limit(limit).get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id.slice(0, 14) + '…',
      status: data.status,
      completionRate: data.completionRate,
      totalPoints: data.totalPoints,
    };
  });
}

async function checkTimeBoundedEarlyCompletion() {
  const challengesSnap = await db.collection('challenges')
    .where('status', '==', 'active')
    .limit(30)
    .get();

  const timeBounded = challengesSnap.docs.filter((d) => d.data().endDate).slice(0, 5);
  const results: Record<string, unknown>[] = [];

  for (const ch of timeBounded) {
    const endDate = ch.data().endDate as string;
    const endMs = Date.parse(endDate);
    const isExpired = endMs < Date.now();
    const membersSnap = await db.collection('challengeMembers')
      .where('challengeId', '==', ch.id)
      .where('status', '==', 'completed')
      .limit(5)
      .get();
    results.push({
      challengeId: ch.id.slice(0, 10) + '…',
      endDate,
      expired: isExpired,
      completedMemberCount: membersSnap.size,
    });
  }
  return results;
}

async function run() {
  console.log(`[inspect] project=${projectId}\n`);

  const [workouts, wellness, leaderboards, members, timeBounded] = await Promise.all([
    sampleCollection('workouts'),
    sampleCollection('wellnessLogs'),
    sampleLeaderboards(),
    sampleChallengeMembers(),
    checkTimeBoundedEarlyCompletion(),
  ]);

  const v2Workouts = workouts.filter((w) => w.scoringVersion === 'v2');
  const v2Wellness = wellness.filter((w) => w.scoringVersion === 'v2');

  const SCORING_FIELDS = ['points', 'rawValue', 'targetValue', 'metTarget', 'scoringMethod'];
  const allFieldsPresent = (arr: typeof workouts) =>
    arr.every((w) => SCORING_FIELDS.every((f) => (w as Record<string, unknown>)[f] !== '[absent]'));

  const report = {
    workouts: {
      sampled: workouts.length,
      v2: v2Workouts.length,
      legacy: workouts.length - v2Workouts.length,
      allV2HaveScoringFields: allFieldsPresent(v2Workouts),
      sample: workouts,
    },
    wellnessLogs: {
      sampled: wellness.length,
      v2: v2Wellness.length,
      legacy: wellness.length - v2Wellness.length,
      allV2HaveScoringFields: allFieldsPresent(v2Wellness),
      sample: wellness,
    },
    challengeLeaderboards: { sampled: leaderboards.length, sample: leaderboards },
    challengeMembers: { sampled: members.length, sample: members },
    timeBoundedEarlyCompletion: {
      note: 'completed members on non-expired time-bounded challenges = P4I risk',
      sample: timeBounded,
    },
  };

  console.log(JSON.stringify(report, null, 2));
}

run().catch((err) => {
  console.error('[inspect] Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
