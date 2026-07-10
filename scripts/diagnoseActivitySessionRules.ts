import 'dotenv/config';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { ACTIVITY_WRITE_LIMITS, maxWorkoutValueForUnit } from '../src/services/activityWriteGuards';

const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.VITE_FIREBASE_PROJECT_ID;
const challengeId = process.argv.find((arg) => arg.startsWith('--challengeId='))?.split('=')[1] ?? 'K4eBvaSLKe4yi1taOWCc';
const groupId = process.argv.find((arg) => arg.startsWith('--groupId='))?.split('=')[1] ?? 'seed_group_early_birds';
const uid = process.argv.find((arg) => arg.startsWith('--uid='))?.split('=')[1] ?? 'sMfC7PsPp7cpGwnr3tGvsKSEOB32';

if (!projectId) {
  throw new Error('Missing FIREBASE_PROJECT_ID or VITE_FIREBASE_PROJECT_ID.');
}

if (!getApps().length) {
  initializeApp({
    credential: applicationDefault(),
    projectId,
  });
}

const db = getFirestore();

type ChallengeActivity = {
  id?: string;
  activityId?: string;
  exerciseId?: string;
  exerciseName?: string;
  unit?: string;
  pointsPerCompletion?: number;
};

function stableActivityIdFor(activity: ChallengeActivity, activityIndex: number, fallbackExerciseId?: string): string {
  return activity.id
    || activity.activityId
    || fallbackExerciseId
    || activity.exerciseId
    || `${challengeId}_${activityIndex}`;
}

function allowedStatus(status: unknown) {
  return status === 'active' || status === 'joined' || status === 'completed';
}

function hasOnly(keys: string[], allowed: string[]) {
  return keys.every((key) => allowed.includes(key));
}

function validateWorkoutCreate(
  payload: Record<string, unknown>,
  challenge: Record<string, unknown>,
  groupMember: Record<string, unknown> | undefined,
  challengeMember: Record<string, unknown> | undefined,
) {
  const allowedFields = [
    'userId',
    'challengeId',
    'groupId',
    'activityId',
    'exerciseId',
    'exerciseName',
    'value',
    'unit',
    'notes',
    'date',
    'completedAt',
    'createdAt',
    'loggedAt',
  ];
  const failures: string[] = [];
  if (!hasOnly(Object.keys(payload), allowedFields)) failures.push('payload has fields outside workoutClientCreateFields');
  if (payload.userId !== uid) failures.push('userId does not match auth uid');
  if (challenge.status !== 'active') failures.push('challenge.status is not active');
  if (payload.groupId !== challenge.groupId) failures.push('payload.groupId does not match challenge.groupId');
  if (!groupMember) failures.push('groupMembers doc missing');
  if (groupMember && !['active', 'joined'].includes(String(groupMember.status))) failures.push(`groupMembers.status ${String(groupMember.status)} is not active/joined`);
  if (!challengeMember) failures.push('challengeMembers doc missing');
  if (challengeMember?.userId !== uid) failures.push('challengeMembers.userId mismatch');
  if (challengeMember?.challengeId !== challengeId) failures.push('challengeMembers.challengeId mismatch');
  if (challengeMember?.groupId !== groupId) failures.push('challengeMembers.groupId mismatch');
  if (!allowedStatus(challengeMember?.status)) failures.push(`challengeMembers.status ${String(challengeMember?.status)} is not allowed`);
  if (typeof payload.activityId !== 'string' || payload.activityId.length === 0) failures.push('activityId missing/empty');
  if (typeof payload.exerciseId !== 'string' || payload.exerciseId.length === 0) failures.push('exerciseId missing/empty');
  if (typeof payload.value !== 'number' || payload.value <= 0 || payload.value > 10000) failures.push('value outside workout rule bounds');
  if (typeof payload.unit !== 'string' || payload.unit.length === 0) failures.push('unit missing/empty');
  if (typeof payload.notes === 'string' && payload.notes.length > ACTIVITY_WRITE_LIMITS.maxNotesLength) failures.push('notes too long');
  return failures;
}

function validateChallengeMemberUpdate(
  before: Record<string, unknown>,
  activityCount: number,
  points: number,
  configuredCount: number,
) {
  const failures: string[] = [];
  const existingCompleted = Number(before.activitiesCompleted ?? 0);
  const existingPoints = Number(before.totalPoints ?? 0);
  const nextCompleted = Math.min(existingCompleted + activityCount, configuredCount);
  const nextPoints = existingPoints + points;
  const completionRate = Math.min(100, Math.round((nextCompleted / configuredCount) * 100));
  if (nextCompleted < existingCompleted) failures.push('activitiesCompleted would decrease');
  if (nextCompleted > configuredCount) failures.push('activitiesCompleted exceeds configured activity count');
  if (nextCompleted > existingCompleted + configuredCount) failures.push('activitiesCompleted increment exceeds configured activity count');
  if (nextPoints > existingPoints + (configuredCount * 1000)) failures.push('totalPoints increment exceeds configured activity count * 1000');
  if (completionRate < 0 || completionRate > 100) failures.push('completionRate outside 0-100');
  return {
    failures,
    update: {
      activitiesCompleted: nextCompleted,
      totalPoints: nextPoints,
      completionRate,
      status: completionRate >= 100 && before.status !== 'completed' ? 'completed' : before.status,
      completedAt: completionRate >= 100 && before.status !== 'completed' ? '[request.time]' : undefined,
      lastActivityAt: '[request.time]',
    },
  };
}

async function run() {
  const [challengeSnap, groupMemberSnap, challengeMemberSnap] = await Promise.all([
    db.collection('challenges').doc(challengeId).get(),
    db.collection('groupMembers').doc(`${groupId}_${uid}`).get(),
    db.collection('challengeMembers').doc(`${challengeId}_${uid}`).get(),
  ]);

  if (!challengeSnap.exists) throw new Error(`Missing challenge ${challengeId}`);
  const challenge = challengeSnap.data() ?? {};
  const groupMember = groupMemberSnap.exists ? groupMemberSnap.data() : undefined;
  const challengeMember = challengeMemberSnap.exists ? challengeMemberSnap.data() : undefined;
  const activities = Array.isArray(challenge.activities) && challenge.activities.length > 0
    ? challenge.activities as ChallengeActivity[]
    : Array.isArray(challenge.exerciseIds)
      ? (challenge.exerciseIds as string[]).map((exerciseId) => ({ exerciseId, exerciseName: exerciseId, unit: 'reps' }))
      : [];

  const plannedWorkouts = activities.map((activity, index) => {
    const exerciseId = activity.exerciseId || `${challengeId}_${index}`;
    const unit = activity.unit || 'reps';
    return {
      userId: uid,
      challengeId,
      groupId,
      activityId: stableActivityIdFor(activity, index, exerciseId),
      exerciseId,
      exerciseName: activity.exerciseName || exerciseId,
      value: Math.min(maxWorkoutValueForUnit(unit), unit.toLowerCase() === 'seconds' ? 30 : 10),
      unit,
      date: '2026-06-08',
      completedAt: '[request.time]',
      createdAt: '[request.time]',
      loggedAt: '[request.time]',
    };
  });
  const workoutResults = plannedWorkouts.map((payload, index) => ({
    path: `workouts/{auto-${index + 1}}`,
    payload,
    failures: validateWorkoutCreate(payload, challenge, groupMember, challengeMember),
  }));
  const configuredCount = Math.max(1, activities.length, Array.isArray(challenge.exerciseIds) ? challenge.exerciseIds.length : 0, Number(challengeMember?.totalActivities ?? 1));
  const progressResult = challengeMember
    ? validateChallengeMemberUpdate(challengeMember, plannedWorkouts.length, plannedWorkouts.length * 10, configuredCount)
    : { failures: ['challengeMembers doc missing'], update: undefined };

  console.log(JSON.stringify({
    projectId,
    challengeId,
    groupId,
    uid,
    source: 'dry-run diagnostics only; no writes attempted',
    documents: {
      challenge: {
        exists: challengeSnap.exists,
        status: challenge.status,
        groupId: challenge.groupId,
        activitiesCount: activities.length,
        exerciseIdsCount: Array.isArray(challenge.exerciseIds) ? challenge.exerciseIds.length : 0,
      },
      groupMember: groupMember ? { exists: true, status: groupMember.status, userId: groupMember.userId, groupId: groupMember.groupId } : { exists: false },
      challengeMember: challengeMember ? {
        exists: true,
        status: challengeMember.status,
        userId: challengeMember.userId,
        groupId: challengeMember.groupId,
        challengeId: challengeMember.challengeId,
        activitiesCompleted: challengeMember.activitiesCompleted,
        totalActivities: challengeMember.totalActivities,
        totalPoints: challengeMember.totalPoints,
      } : { exists: false },
    },
    checks: {
      workoutCreates: workoutResults,
      challengeMembersUpdate: progressResult,
      usersUpdate: {
        planned: false,
        reason: 'Unified activity session no longer writes users/{uid}; user stats should be server-derived.',
      },
    },
  }, null, 2));
}

run().catch((error) => {
  console.error('Activity session diagnostics failed:', error);
  process.exit(1);
});
