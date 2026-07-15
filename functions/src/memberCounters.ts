import { logger } from 'firebase-functions';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';

type CounterDoc = Record<string, unknown> | undefined;

const ACTIVE_MEMBER_STATUSES = new Set(['active', 'joined', 'completed']);
const ACTIVE_CHALLENGE_STATUSES = new Set(['active']);

function stringValue(data: CounterDoc, key: string): string {
  const value = data?.[key];
  return typeof value === 'string' ? value : '';
}

function isActiveMemberStatus(status: unknown): boolean {
  return ACTIVE_MEMBER_STATUSES.has(String(status ?? '').toLowerCase());
}

function isActiveChallengeStatus(status: unknown): boolean {
  return ACTIVE_CHALLENGE_STATUSES.has(String(status ?? '').toLowerCase());
}

function transitionDelta(beforeActive: boolean, afterActive: boolean): number {
  if (!beforeActive && afterActive) return 1;
  if (beforeActive && !afterActive) return -1;
  return 0;
}

async function incrementGroupCounter(db: Firestore, groupId: string, field: 'memberCount' | 'activeChallenges', delta: number) {
  if (!groupId || delta === 0) return;
  await db.collection('groups').doc(groupId).set({
    [field]: FieldValue.increment(delta),
    countersUpdatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  logger.info('Group counter updated', { groupId, field, delta });
}

async function incrementChallengeCounter(db: Firestore, challengeId: string, field: 'participantCount', delta: number) {
  if (!challengeId || delta === 0) return;
  await db.collection('challenges').doc(challengeId).set({
    [field]: FieldValue.increment(delta),
    countersUpdatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  logger.info('Challenge counter updated', { challengeId, field, delta });
}

export async function updateGroupMemberCountForCreate(db: Firestore, data: CounterDoc) {
  const groupId = stringValue(data, 'groupId');
  const delta = transitionDelta(false, isActiveMemberStatus(data?.status));
  await incrementGroupCounter(db, groupId, 'memberCount', delta);
}

export async function updateGroupMemberCountForUpdate(db: Firestore, before: CounterDoc, after: CounterDoc) {
  const beforeGroupId = stringValue(before, 'groupId');
  const afterGroupId = stringValue(after, 'groupId');
  const beforeActive = isActiveMemberStatus(before?.status);
  const afterActive = isActiveMemberStatus(after?.status);

  if (beforeGroupId && afterGroupId && beforeGroupId !== afterGroupId) {
    await Promise.all([
      incrementGroupCounter(db, beforeGroupId, 'memberCount', beforeActive ? -1 : 0),
      incrementGroupCounter(db, afterGroupId, 'memberCount', afterActive ? 1 : 0),
    ]);
    return;
  }

  const delta = transitionDelta(beforeActive, afterActive);
  await incrementGroupCounter(db, afterGroupId || beforeGroupId, 'memberCount', delta);
}

export async function updateGroupMemberCountForDelete(db: Firestore, data: CounterDoc) {
  const groupId = stringValue(data, 'groupId');
  const delta = transitionDelta(isActiveMemberStatus(data?.status), false);
  await incrementGroupCounter(db, groupId, 'memberCount', delta);
}

export async function updateActiveChallengeCountForCreate(db: Firestore, data: CounterDoc) {
  const groupId = stringValue(data, 'groupId');
  const delta = transitionDelta(false, isActiveChallengeStatus(data?.status));
  await incrementGroupCounter(db, groupId, 'activeChallenges', delta);
}

export async function updateActiveChallengeCountForUpdate(db: Firestore, before: CounterDoc, after: CounterDoc) {
  const beforeGroupId = stringValue(before, 'groupId');
  const afterGroupId = stringValue(after, 'groupId');
  const beforeActive = isActiveChallengeStatus(before?.status);
  const afterActive = isActiveChallengeStatus(after?.status);

  if (beforeGroupId && afterGroupId && beforeGroupId !== afterGroupId) {
    await Promise.all([
      incrementGroupCounter(db, beforeGroupId, 'activeChallenges', beforeActive ? -1 : 0),
      incrementGroupCounter(db, afterGroupId, 'activeChallenges', afterActive ? 1 : 0),
    ]);
    return;
  }

  const delta = transitionDelta(beforeActive, afterActive);
  await incrementGroupCounter(db, afterGroupId || beforeGroupId, 'activeChallenges', delta);
}

export async function updateActiveChallengeCountForDelete(db: Firestore, data: CounterDoc) {
  const groupId = stringValue(data, 'groupId');
  const delta = transitionDelta(isActiveChallengeStatus(data?.status), false);
  await incrementGroupCounter(db, groupId, 'activeChallenges', delta);
}

export async function updateParticipantCountForCreate(db: Firestore, data: CounterDoc) {
  const challengeId = stringValue(data, 'challengeId');
  const delta = transitionDelta(false, isActiveMemberStatus(data?.status));
  await incrementChallengeCounter(db, challengeId, 'participantCount', delta);
}

export async function updateParticipantCountForUpdate(db: Firestore, before: CounterDoc, after: CounterDoc) {
  const beforeChallengeId = stringValue(before, 'challengeId');
  const afterChallengeId = stringValue(after, 'challengeId');
  const beforeActive = isActiveMemberStatus(before?.status);
  const afterActive = isActiveMemberStatus(after?.status);

  if (beforeChallengeId && afterChallengeId && beforeChallengeId !== afterChallengeId) {
    await Promise.all([
      incrementChallengeCounter(db, beforeChallengeId, 'participantCount', beforeActive ? -1 : 0),
      incrementChallengeCounter(db, afterChallengeId, 'participantCount', afterActive ? 1 : 0),
    ]);
    return;
  }

  const delta = transitionDelta(beforeActive, afterActive);
  await incrementChallengeCounter(db, afterChallengeId || beforeChallengeId, 'participantCount', delta);
}

export async function updateParticipantCountForDelete(db: Firestore, data: CounterDoc) {
  const challengeId = stringValue(data, 'challengeId');
  const delta = transitionDelta(isActiveMemberStatus(data?.status), false);
  await incrementChallengeCounter(db, challengeId, 'participantCount', delta);
}
