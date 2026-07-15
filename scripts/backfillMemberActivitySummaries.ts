import 'dotenv/config';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, Timestamp, getFirestore, type WriteBatch } from 'firebase-admin/firestore';

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

type ChallengeDoc = {
  groupId?: string;
  name?: string;
  coverImageUrl?: string;
};

type MembershipDoc = {
  groupId?: string;
  userId?: string;
  role?: string;
  status?: string;
  createdAt?: unknown;
};

type UserDoc = {
  displayName?: string;
  email?: string;
  profile?: {
    personalInfo?: {
      fullName?: string;
      displayName?: string;
    };
  };
};

type ActivityRecord = {
  id: string;
  source: 'workout' | 'wellness';
  userId: string;
  groupId: string;
  challengeId: string;
  activityLabel: string;
  value: number;
  unit: string;
  score: number;
  createdAt: Timestamp;
};

type UserGroupAccumulator = {
  groupId: string;
  userId: string;
  role: 'Coach' | 'Member';
  joinedAt?: unknown;
  activityCount: number;
  score: number;
  lastActivityAt?: Timestamp;
};

type ChallengeAccumulator = {
  challengeId: string;
  groupId: string;
  totalLogs: number;
  totalScore: number;
  totalValue: number;
  uniqueParticipantIds: Set<string>;
  lastActivityAt?: Timestamp;
};

type ChallengeLeaderboardAccumulator = {
  challengeId: string;
  groupId: string;
  userId: string;
  activityCount: number;
  score: number;
  lastActivityAt?: Timestamp;
};

function toTimestamp(value: unknown): Timestamp {
  if (value instanceof Timestamp) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return Timestamp.fromDate(new Date(parsed));
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Timestamp.fromMillis(value);
  }
  if (value && typeof value === 'object') {
    const maybe = value as { toDate?: () => Date; seconds?: number };
    if (typeof maybe.toDate === 'function') return Timestamp.fromDate(maybe.toDate());
    if (typeof maybe.seconds === 'number') return Timestamp.fromMillis(maybe.seconds * 1000);
  }
  return Timestamp.now();
}

function displayNameFor(uid: string, user?: UserDoc): string {
  return user?.profile?.personalInfo?.displayName
    || user?.profile?.personalInfo?.fullName
    || user?.displayName
    || user?.email?.split('@')[0]
    || `Member ${uid.slice(0, 6).toUpperCase()}`;
}

function formatValue(value: number, unit: string): string {
  const normalized = Number.isInteger(value) ? String(value) : value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  return `${normalized} ${unit}`.trim();
}

function newer(a?: Timestamp, b?: Timestamp): Timestamp | undefined {
  if (!a) return b;
  if (!b) return a;
  return a.toMillis() >= b.toMillis() ? a : b;
}

async function commitInChunks(writes: Array<(batch: WriteBatch) => void>) {
  let committed = 0;
  for (let i = 0; i < writes.length; i += 450) {
    const batch = db.batch();
    writes.slice(i, i + 450).forEach((write) => write(batch));
    await batch.commit();
    committed += Math.min(450, writes.length - i);
  }
  return committed;
}

async function run() {
  const startedAt = Date.now();
  const [usersSnap, groupsSnap, challengesSnap, membershipsSnap, workoutsSnap, wellnessSnap] = await Promise.all([
    db.collection('users').get(),
    db.collection('groups').get(),
    db.collection('challenges').get(),
    db.collection('groupMembers').get(),
    db.collection('workouts').get(),
    db.collection('wellnessLogs').get(),
  ]);

  const users = new Map<string, UserDoc>();
  usersSnap.docs.forEach((docSnap) => users.set(docSnap.id, docSnap.data() as UserDoc));

  const challenges = new Map<string, ChallengeDoc>();
  challengesSnap.docs.forEach((docSnap) => challenges.set(docSnap.id, docSnap.data() as ChallengeDoc));

  const userGroupStats = new Map<string, UserGroupAccumulator>();
  membershipsSnap.docs.forEach((docSnap) => {
    const data = docSnap.data() as MembershipDoc;
    if (!data.groupId || !data.userId) return;
    const status = String(data.status ?? '').toLowerCase();
    if (status !== 'active' && status !== 'joined') return;
    const key = `${data.groupId}_${data.userId}`;
    userGroupStats.set(key, {
      groupId: data.groupId,
      userId: data.userId,
      role: data.role === 'owner' || data.role === 'admin' ? 'Coach' : 'Member',
      joinedAt: data.createdAt,
      activityCount: 0,
      score: 0,
    });
  });

  const challengeSummaries = new Map<string, ChallengeAccumulator>();
  const challengeLeaderboards = new Map<string, ChallengeLeaderboardAccumulator>();
  const activities: ActivityRecord[] = [];

  workoutsSnap.docs.forEach((docSnap) => {
    const data = docSnap.data() as Record<string, unknown>;
    const userId = String(data.userId ?? '');
    const challengeId = String(data.challengeId ?? '');
    const challenge = challenges.get(challengeId);
    const groupId = String(data.groupId ?? challenge?.groupId ?? '');
    if (!userId || !challengeId || !groupId) return;
    const value = Math.max(0, Number(data.value ?? 0));
    activities.push({
      id: docSnap.id,
      source: 'workout',
      userId,
      groupId,
      challengeId,
      activityLabel: String(data.exerciseName ?? data.exerciseId ?? 'Workout'),
      value,
      unit: String(data.unit ?? ''),
      score: Math.max(1, Math.round(value)),
      createdAt: toTimestamp(data.completedAt ?? data.loggedAt ?? data.date),
    });
  });

  wellnessSnap.docs.forEach((docSnap) => {
    const data = docSnap.data() as Record<string, unknown>;
    const userId = String(data.userId ?? '');
    const challengeId = String(data.challengeId ?? '');
    const challenge = challenges.get(challengeId);
    const groupId = String(data.groupId ?? challenge?.groupId ?? '');
    if (!userId || !challengeId || !groupId) return;
    const value = Math.max(0, Number(data.value ?? 0));
    activities.push({
      id: docSnap.id,
      source: 'wellness',
      userId,
      groupId,
      challengeId,
      activityLabel: String(data.activityId ?? data.logType ?? 'Wellness activity'),
      value,
      unit: String(data.unit ?? ''),
      score: Math.max(1, Math.round(Number(data.points ?? value ?? 1))),
      createdAt: toTimestamp(data.loggedAt ?? data.date),
    });
  });

  activities.forEach((activity) => {
    const groupUserKey = `${activity.groupId}_${activity.userId}`;
    const existing = userGroupStats.get(groupUserKey) ?? {
      groupId: activity.groupId,
      userId: activity.userId,
      role: 'Member' as const,
      activityCount: 0,
      score: 0,
    };
    existing.activityCount += 1;
    existing.score += activity.score;
    existing.lastActivityAt = newer(existing.lastActivityAt, activity.createdAt);
    userGroupStats.set(groupUserKey, existing);

    const existingChallenge = challengeSummaries.get(activity.challengeId) ?? {
      challengeId: activity.challengeId,
      groupId: activity.groupId,
      totalLogs: 0,
      totalScore: 0,
      totalValue: 0,
      uniqueParticipantIds: new Set<string>(),
    };
    existingChallenge.totalLogs += 1;
    existingChallenge.totalScore += activity.score;
    existingChallenge.totalValue += activity.value;
    existingChallenge.uniqueParticipantIds.add(activity.userId);
    existingChallenge.lastActivityAt = newer(existingChallenge.lastActivityAt, activity.createdAt);
    challengeSummaries.set(activity.challengeId, existingChallenge);

    const challengeUserKey = `${activity.challengeId}_${activity.userId}`;
    const existingChallengeLeaderboard = challengeLeaderboards.get(challengeUserKey) ?? {
      challengeId: activity.challengeId,
      groupId: activity.groupId,
      userId: activity.userId,
      activityCount: 0,
      score: 0,
    };
    existingChallengeLeaderboard.activityCount += 1;
    existingChallengeLeaderboard.score += activity.score;
    existingChallengeLeaderboard.lastActivityAt = newer(existingChallengeLeaderboard.lastActivityAt, activity.createdAt);
    challengeLeaderboards.set(challengeUserKey, existingChallengeLeaderboard);
  });

  const writes: Array<(batch: WriteBatch) => void> = [];
  activities.forEach((activity) => {
    const challenge = challenges.get(activity.challengeId);
    const authorName = displayNameFor(activity.userId, users.get(activity.userId));
    const valueLabel = formatValue(activity.value, activity.unit);
    writes.push((batch) => batch.set(db.collection('groupActivityFeed').doc(activity.id), {
      groupId: activity.groupId,
      challengeId: activity.challengeId,
      userId: activity.userId,
      authorName,
      challengeName: challenge?.name ?? 'group challenge',
      challengeCoverImageUrl: challenge?.coverImageUrl,
      activityLabel: activity.activityLabel,
      valueLabel,
      value: activity.value,
      score: activity.score,
      text: `Completed ${valueLabel} in ${challenge?.name ?? 'group challenge'}.`,
      source: activity.source,
      createdAt: activity.createdAt,
    }, { merge: true }));
  });

  userGroupStats.forEach((stat, id) => {
    const displayName = displayNameFor(stat.userId, users.get(stat.userId));
    const payload = {
      groupId: stat.groupId,
      userId: stat.userId,
      displayName,
      role: stat.role,
      activityCount: stat.activityCount,
      score: stat.score,
      joinedAt: stat.joinedAt,
      lastActivityAt: stat.lastActivityAt,
      updatedAt: FieldValue.serverTimestamp(),
    };
    writes.push((batch) => {
      batch.set(db.collection('groupMemberStats').doc(id), payload, { merge: true });
      batch.set(db.collection('groupLeaderboards').doc(id), payload, { merge: true });
    });
  });

  challengeSummaries.forEach((summary) => {
    writes.push((batch) => batch.set(db.collection('challengeActivitySummaries').doc(summary.challengeId), {
      challengeId: summary.challengeId,
      groupId: summary.groupId,
      totalLogs: summary.totalLogs,
      totalScore: summary.totalScore,
      totalValue: summary.totalValue,
      uniqueParticipantIds: Array.from(summary.uniqueParticipantIds),
      participantCount: summary.uniqueParticipantIds.size,
      lastActivityAt: summary.lastActivityAt,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true }));
  });

  challengeLeaderboards.forEach((entry, id) => {
    writes.push((batch) => batch.set(db.collection('challengeLeaderboards').doc(id), {
      challengeId: entry.challengeId,
      groupId: entry.groupId,
      userId: entry.userId,
      displayName: displayNameFor(entry.userId, users.get(entry.userId)),
      activityCount: entry.activityCount,
      score: entry.score,
      lastActivityAt: entry.lastActivityAt,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true }));
  });

  const committedWrites = applyMode ? await commitInChunks(writes) : 0;
  const summary = {
    mode: applyMode ? 'apply' : 'dry-run',
    projectId,
    durationMs: Date.now() - startedAt,
    readCounts: {
      users: usersSnap.size,
      groups: groupsSnap.size,
      challenges: challengesSnap.size,
      groupMembers: membershipsSnap.size,
      workouts: workoutsSnap.size,
      wellnessLogs: wellnessSnap.size,
    },
    pendingWriteCounts: {
      groupActivityFeed: activities.length,
      groupMemberStats: userGroupStats.size,
      groupLeaderboards: userGroupStats.size,
      challengeLeaderboards: challengeLeaderboards.size,
      challengeActivitySummaries: challengeSummaries.size,
      totalWriteOperations: writes.length,
    },
    committedWriteOperations: committedWrites,
  };

  console.log(JSON.stringify(summary, null, 2));
  if (!applyMode) {
    console.log('Dry-run only. Re-run with --apply to write member activity summary documents.');
  }
}

run().catch((error) => {
  console.error('Member activity summary backfill failed:', error);
  process.exit(1);
});
