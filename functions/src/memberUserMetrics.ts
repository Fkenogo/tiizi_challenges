import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';

type RecordData = Record<string, unknown>;

type BuildOptions = {
  apply?: boolean;
  generatedBy?: string;
  now?: Date;
  serverTimestamp?: () => unknown;
  timestampFromMillis?: (ms: number) => unknown;
  log?: (message: string, data?: Record<string, unknown>) => void;
};

type PrimaryChallengeSummary = {
  id: string;
  name: string;
  season: string;
  level: string;
  progress: number;
  progressLabel: string;
  day: number;
  totalDays: number;
  groupId?: string;
  challengeType: 'collective' | 'competitive' | 'streak';
  actionLabel: 'Log Workout' | 'Log Activity';
} | null;

type UserMetricDocs = {
  userMetrics: RecordData;
  memberHome: RecordData;
  readCounts: Record<string, number>;
  writeCounts: Record<string, number>;
};

function stringValue(row: RecordData | undefined, key: string): string {
  const value = row?.[key];
  return typeof value === 'string' ? value : '';
}

function numberValue(row: RecordData | undefined, key: string): number {
  const value = row?.[key];
  const parsed = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function timestampMillis(value: unknown): number | null {
  if (value instanceof Timestamp) return value.toMillis();
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (value && typeof value === 'object') {
    const candidate = value as { toDate?: () => Date; seconds?: number; nanoseconds?: number };
    if (typeof candidate.toDate === 'function') return candidate.toDate().getTime();
    if (typeof candidate.seconds === 'number') return candidate.seconds * 1000 + Math.floor((candidate.nanoseconds ?? 0) / 1_000_000);
  }
  return null;
}

function activityMillis(row: RecordData): number | null {
  return timestampMillis(row.completedAt)
    ?? timestampMillis(row.loggedAt)
    ?? timestampMillis(row.createdAt)
    ?? timestampMillis(row.date);
}

function toDateKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function isWithin(ms: number | null, days: number, nowMs: number): boolean {
  if (ms === null) return false;
  const delta = nowMs - ms;
  return delta >= 0 && delta <= days * 24 * 60 * 60 * 1000;
}

function isActiveMembership(status: unknown): boolean {
  const normalized = String(status ?? '').toLowerCase();
  return normalized === 'active' || normalized === 'joined';
}

function isCompletedMembership(status: unknown): boolean {
  return String(status ?? '').toLowerCase() === 'completed';
}

function calculateStreaks(activityTimes: number[], now: Date) {
  const dates = Array.from(new Set(activityTimes.map(toDateKey))).sort().reverse();
  if (dates.length === 0) return { currentStreak: 0, longestStreak: 0 };

  const today = now.toISOString().slice(0, 10);
  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = yesterdayDate.toISOString().slice(0, 10);

  let currentStreak = 0;
  let cursor = dates[0] === today ? today : yesterday;

  for (const date of dates) {
    if (date === cursor) {
      currentStreak += 1;
      const prev = new Date(`${cursor}T00:00:00.000Z`);
      prev.setUTCDate(prev.getUTCDate() - 1);
      cursor = prev.toISOString().slice(0, 10);
    } else if (date < cursor) {
      break;
    }
  }

  let longestStreak = Math.max(1, currentStreak);
  let run = 1;
  for (let i = 1; i < dates.length; i += 1) {
    const prev = Date.parse(`${dates[i - 1]}T00:00:00.000Z`);
    const curr = Date.parse(`${dates[i]}T00:00:00.000Z`);
    const diffDays = Math.round((prev - curr) / (24 * 60 * 60 * 1000));
    if (diffDays === 1) {
      run += 1;
      longestStreak = Math.max(longestStreak, run);
    } else {
      run = 1;
    }
  }

  return { currentStreak, longestStreak };
}

function dayDiff(startMs: number | null, endMs: number | null): number {
  if (startMs === null || endMs === null) return 1;
  return Math.max(1, Math.ceil((endMs - startMs) / (24 * 60 * 60 * 1000)) + 1);
}

function currentDay(startMs: number | null, totalDays: number, nowMs: number): number {
  if (startMs === null) return 1;
  const elapsed = Math.floor((nowMs - startMs) / (24 * 60 * 60 * 1000)) + 1;
  return Math.min(totalDays, Math.max(1, elapsed));
}

function formatMetric(value: number, unit: string): string {
  const rounded = Number.isInteger(value) ? value : Number(value.toFixed(1));
  return `${rounded} ${unit || 'units'}`;
}

function buildPrimaryChallenge(
  challengeId: string,
  challenge: RecordData | undefined,
  membership: RecordData,
  nowMs: number,
): PrimaryChallengeSummary {
  if (!challenge) return null;
  const startMs = timestampMillis(challenge.startDate);
  const endMs = timestampMillis(challenge.endDate);
  const totalDays = dayDiff(startMs, endMs);
  const challengeType = stringValue(challenge, 'challengeType');
  const safeChallengeType = challengeType === 'competitive' || challengeType === 'streak' ? challengeType : 'collective';
  const activities = Array.isArray(challenge.activities) ? (challenge.activities as RecordData[]) : [];
  const primaryActivity = activities[0];
  const unit = stringValue(primaryActivity, 'unit') || 'units';
  const targetValue = Math.max(0, numberValue(primaryActivity, 'targetValue'));
  const completionRate = Math.max(0, Math.min(100, Math.round(numberValue(membership, 'completionRate'))));
  const progressValue = Math.max(0, numberValue(membership, 'activitiesCompleted'));
  const memberTotalActivities = Math.max(1, numberValue(membership, 'totalActivities'));
  const progress = Math.min(100, Math.round((progressValue / memberTotalActivities) * 100));

  return {
    id: challengeId,
    name: stringValue(challenge, 'name') || 'Active challenge',
    season: safeChallengeType ? `${safeChallengeType} challenge` : 'Group challenge',
    level: stringValue(challenge, 'status') === 'active' ? 'Active' : 'Open',
    progress,
    progressLabel: `${progressValue} of ${memberTotalActivities} sessions`,
    day: currentDay(startMs, totalDays, nowMs),
    totalDays,
    groupId: stringValue(challenge, 'groupId') || stringValue(membership, 'groupId') || undefined,
    challengeType: safeChallengeType,
    actionLabel: stringValue(challenge, 'category') && stringValue(challenge, 'category') !== 'fitness' ? 'Log Activity' : 'Log Workout',
  };
}

export async function rebuildUserMetricsForUser(
  db: Firestore,
  uid: string,
  options: BuildOptions = {},
): Promise<UserMetricDocs> {
  const now = options.now ?? new Date();
  const nowMs = now.getTime();
  const serverTimestamp = options.serverTimestamp ?? (() => FieldValue.serverTimestamp());
  const timestampFromMillis = options.timestampFromMillis ?? ((ms: number) => Timestamp.fromMillis(ms));
  const readCounts: Record<string, number> = {};
  const writeCounts: Record<string, number> = {};

  const [workoutsSnap, wellnessSnap, challengeMembersSnap, groupMembersSnap] = await Promise.all([
    db.collection('workouts').where('userId', '==', uid).get(),
    db.collection('wellnessLogs').where('userId', '==', uid).get(),
    db.collection('challengeMembers').where('userId', '==', uid).get(),
    db.collection('groupMembers').where('userId', '==', uid).get(),
  ]);

  readCounts.workouts = workoutsSnap.size;
  readCounts.wellnessLogs = wellnessSnap.size;
  readCounts.challengeMembers = challengeMembersSnap.size;
  readCounts.groupMembers = groupMembersSnap.size;

  const workoutTimes = workoutsSnap.docs.map((doc) => activityMillis(doc.data())).filter((ms): ms is number => ms !== null);
  const wellnessTimes = wellnessSnap.docs.map((doc) => activityMillis(doc.data())).filter((ms): ms is number => ms !== null);
  const allActivityTimes = [...workoutTimes, ...wellnessTimes];
  const lastActivityMs = allActivityTimes.length > 0 ? Math.max(...allActivityTimes) : null;
  const streaks = calculateStreaks(allActivityTimes, now);

  const activeChallengeDocs = challengeMembersSnap.docs.filter((doc) => isActiveMembership(doc.data().status));
  const completedChallengeDocs = challengeMembersSnap.docs.filter((doc) => isCompletedMembership(doc.data().status));
  const joinedGroupDocs = groupMembersSnap.docs.filter((doc) => isActiveMembership(doc.data().status));

  let primaryActiveChallenge: PrimaryChallengeSummary = null;
  for (const membershipDoc of activeChallengeDocs) {
    const membership = membershipDoc.data();
    const challengeId = stringValue(membership, 'challengeId') || membershipDoc.id.split('_')[0];
    if (!challengeId) continue;
    const challengeSnap = await db.collection('challenges').doc(challengeId).get();
    readCounts.challenges = (readCounts.challenges ?? 0) + 1;
    const challenge = challengeSnap.exists ? challengeSnap.data() : undefined;
    if (challenge && stringValue(challenge, 'status') === 'active') {
      primaryActiveChallenge = buildPrimaryChallenge(challengeId, challenge, membership, nowMs);
      break;
    }
  }

  const userMetrics = {
    userId: uid,
    totalWorkouts: workoutsSnap.size,
    totalWellnessLogs: wellnessSnap.size,
    totalActivitiesLogged: workoutsSnap.size + wellnessSnap.size,
    workouts7d: workoutTimes.filter((ms) => isWithin(ms, 7, nowMs)).length,
    workouts30d: workoutTimes.filter((ms) => isWithin(ms, 30, nowMs)).length,
    wellness7d: wellnessTimes.filter((ms) => isWithin(ms, 7, nowMs)).length,
    wellness30d: wellnessTimes.filter((ms) => isWithin(ms, 30, nowMs)).length,
    currentStreak: streaks.currentStreak,
    longestStreak: streaks.longestStreak,
    activeChallengesCount: activeChallengeDocs.length,
    completedChallengesCount: completedChallengeDocs.length,
    joinedGroupsCount: joinedGroupDocs.length,
    lastActivityAt: lastActivityMs === null ? null : timestampFromMillis(lastActivityMs),
    updatedAt: serverTimestamp(),
    generatedBy: options.generatedBy ?? 'function',
    sourceVersion: 'member-phase-7-v1',
  };

  const memberHome = {
    userId: uid,
    primaryActiveChallenge,
    activeChallengeCount: activeChallengeDocs.length,
    completedChallengeCount: completedChallengeDocs.length,
    joinedGroupCount: joinedGroupDocs.length,
    recentActivityCount: allActivityTimes.filter((ms) => isWithin(ms, 7, nowMs)).length,
    generatedAt: serverTimestamp(),
    generatedBy: options.generatedBy ?? 'function',
    sourceVersion: 'member-phase-7-v1',
  };

  if (options.apply) {
    const batch = db.batch();
    batch.set(db.collection('userMetrics').doc(uid), userMetrics, { merge: true });
    batch.set(db.collection('memberHome').doc(uid), memberHome, { merge: true });
    await batch.commit();
    writeCounts.userMetrics = 1;
    writeCounts.memberHome = 1;
  }

  options.log?.('rebuildUserMetricsForUser completed', { uid, readCounts, writeCounts });
  return { userMetrics, memberHome, readCounts, writeCounts };
}

export async function refreshUserMetricsFromRecord(db: Firestore, data: RecordData | undefined | null) {
  const uid = stringValue(data ?? undefined, 'userId');
  if (!uid) return null;
  return rebuildUserMetricsForUser(db, uid, { apply: true, generatedBy: 'trigger' });
}
