import { logger } from 'firebase-functions';
import { FieldValue, Timestamp, type Firestore, type WriteBatch } from 'firebase-admin/firestore';

type RecordData = Record<string, unknown>;

type ChallengeDoc = {
  groupId?: string;
  name?: string;
  coverImageUrl?: string;
  status?: string;
  challengeType?: string;
  startDate?: string;
  endDate?: string;
  groupCumulativeTarget?: number;
  activities?: Array<{ unit?: string; targetValue?: number; dailyTarget?: number }>;
};

type UserDoc = {
  displayName?: string;
  email?: string;
  photoURL?: string;
  profile?: {
    personalInfo?: {
      fullName?: string;
      displayName?: string;
    };
  };
};

type GroupMemberDoc = {
  groupId?: string;
  userId?: string;
  role?: string;
  status?: string;
  createdAt?: unknown;
};

type ChallengeMemberDoc = {
  challengeId?: string;
  userId?: string;
  groupId?: string;
  status?: string;
  currentStreak?: number;
  lastLogDate?: string;
  cumulativeLoggedValue?: number;
};

type ActivitySummaryInput = {
  activityId: string;
  source: 'workout' | 'wellness';
  userId: string;
  groupId: string;
  challengeId: string;
  activityLabel: string;
  value: number;
  unit: string;
  score: number;
  scoringVersion: 'v2' | 'legacy';
  lastScoringMethod?: string;
  story?: string;
  createdAt: Timestamp;
};

type FeedProgressSnapshot = {
  challengeType: string;
  unit?: string;
  loggedValue?: number;
  userCumulativeValue?: number;
  teamCumulativeValue?: number;
  targetValue?: number;
  remainingValue?: number;
  percentComplete?: number;
  daysRemaining?: number;
  streakDay?: number;
  dailyTarget?: number;
  leaderName?: string;
  leaderValue?: number;
  leaderDelta?: number;
  leadingBy?: number;
  isLeading?: boolean;
  label: string;
};

type SnapshotResult = {
  snapshot: FeedProgressSnapshot;
};

const ACTIVITY_SUMMARY_LIMITS = {
  // 1_000_000 covers all plausible human athletic values (e.g. steps, meters, reps, calories).
  // The previous cap of 10_000 silently truncated step logs above that threshold, causing the
  // Group Feed to show 10,000 steps for any log above that value (Phase 19A-10K fix).
  // Score is kept separate and still capped at maxActivityScore.
  maxActivityValue: 1_000_000,
  maxActivityScore: 1000,
  maxFutureSkewMs: 10 * 60 * 1000,
  maxPastAgeMs: 7 * 24 * 60 * 60 * 1000,
} as const;

function stringValue(row: RecordData, key: string): string {
  const value = row[key];
  return typeof value === 'string' ? value : '';
}

function numberValue(row: RecordData, key: string): number {
  const value = row[key];
  const parsed = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

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

function fmtNum(n: number): string {
  return Number.isInteger(n) ? n.toLocaleString('en-US') : n.toLocaleString('en-US', { maximumFractionDigits: 1 });
}

function isActiveStatus(status: unknown): boolean {
  const normalized = String(status ?? '').toLowerCase();
  return normalized === 'active' || normalized === 'joined';
}

function isActiveChallenge(challenge: ChallengeDoc | null): boolean {
  return String(challenge?.status ?? '').toLowerCase() === 'active';
}

function isReasonableActivityTime(createdAt: Timestamp): boolean {
  const deltaMs = Date.now() - createdAt.toMillis();
  return deltaMs <= ACTIVITY_SUMMARY_LIMITS.maxPastAgeMs
    && deltaMs >= -ACTIVITY_SUMMARY_LIMITS.maxFutureSkewMs;
}

function daysRemainingFor(endDate?: string): number | undefined {
  if (!endDate) return undefined;
  const diff = Math.ceil((Date.parse(endDate) - Date.now()) / (1000 * 60 * 60 * 24));
  return diff >= 0 ? diff : undefined;
}

async function loadChallenge(db: Firestore, challengeId: string): Promise<ChallengeDoc | null> {
  const snap = await db.collection('challenges').doc(challengeId).get();
  return snap.exists ? (snap.data() as ChallengeDoc) : null;
}

async function loadUser(db: Firestore, userId: string): Promise<UserDoc | undefined> {
  const snap = await db.collection('users').doc(userId).get();
  return snap.exists ? (snap.data() as UserDoc) : undefined;
}

async function canSummarizeActivity(db: Firestore, input: ActivitySummaryInput): Promise<boolean> {
  const [groupMemberSnap, challengeMemberSnap] = await Promise.all([
    db.collection('groupMembers').doc(`${input.groupId}_${input.userId}`).get(),
    db.collection('challengeMembers').doc(`${input.challengeId}_${input.userId}`).get(),
  ]);

  const groupMember = groupMemberSnap.data() as GroupMemberDoc | undefined;
  const challengeMember = challengeMemberSnap.data() as ChallengeMemberDoc | undefined;
  return groupMemberSnap.exists
    && challengeMemberSnap.exists
    && isActiveStatus(groupMember?.status)
    && String(groupMember?.groupId ?? '') === input.groupId
    && String(groupMember?.userId ?? '') === input.userId
    && isActiveStatus(challengeMember?.status)
    && String(challengeMember?.groupId ?? '') === input.groupId
    && String(challengeMember?.challengeId ?? '') === input.challengeId
    && String(challengeMember?.userId ?? '') === input.userId;
}

// Builds a feedProgressSnapshot by reading the current (post-log) Firestore state.
//
// Data source ownership:
//   challengeActivitySummaries.totalValue — CF-owned, PRE-log here; we add input.value.
//   challengeMembers.cumulativeLoggedValue — client-engine-owned, POST-log by the time
//     the CF trigger fires (client wrote it in the same atomic batch as the workout doc).
//   challengeMembers.currentStreak / lastLogDate — streakEngine-owned, POST-log same reason.
//   challengeLeaderboards — CF-owned, PRE-log here; used for prevScore only.
//
// The CF must NOT write cumulativeLoggedValue / currentStreak / lastLogDate to
// challengeMembers — those are owned by the client engines to avoid double-counting.
async function buildFeedProgressSnapshot(
  db: Firestore,
  input: ActivitySummaryInput,
  challenge: ChallengeDoc | null,
  displayName: string,
): Promise<SnapshotResult | undefined> {
  const type = challenge?.challengeType;
  if (!type || !['collective', 'competitive', 'streak'].includes(type)) return undefined;

  const unit = challenge?.activities?.[0]?.unit ?? input.unit ?? '';
  const unitStr = unit ? ` ${unit}` : '';
  const dailyTarget = challenge?.activities?.[0]?.dailyTarget ?? challenge?.activities?.[0]?.targetValue;
  const daysRemaining = daysRemainingFor(challenge?.endDate);

  // ── Collective ──────────────────────────────────────────────────────────────
  if (type === 'collective') {
    const summarySnap = await db.collection('challengeActivitySummaries').doc(input.challengeId).get();
    const prevTotal = summarySnap.exists ? numberValue(summarySnap.data() as RecordData, 'totalValue') : 0;
    const newTotal = prevTotal + Math.max(0, input.value);
    const groupTarget = challenge?.groupCumulativeTarget;
    const remaining = groupTarget !== undefined ? Math.max(0, groupTarget - newTotal) : undefined;
    const pct = groupTarget ? Math.min(100, Math.round((newTotal / groupTarget) * 100)) : undefined;
    const label = groupTarget
      ? `Team progress: ${fmtNum(newTotal)} / ${fmtNum(groupTarget)}${unitStr}`
      : `Team progress: ${fmtNum(newTotal)}${unitStr}`;
    return {
      snapshot: {
        challengeType: 'collective',
        unit: unit || undefined,
        loggedValue: input.value,
        teamCumulativeValue: newTotal,
        targetValue: groupTarget,
        remainingValue: remaining,
        percentComplete: pct,
        daysRemaining,
        label,
      },
    };
  }

  // ── Competitive ─────────────────────────────────────────────────────────────
  if (type === 'competitive') {
    const posterLbRef = db.collection('challengeLeaderboards').doc(`${input.challengeId}_${input.userId}`);

    const [posterLbSnap, memberSnap, leaderSnaps] = await Promise.all([
      // PRE-log leaderboard — used only for prevScore to compute newScore
      posterLbRef.get(),
      // POST-log challengeMembers — cumulativeLoggedValue already updated by client engine
      db.collection('challengeMembers').doc(`${input.challengeId}_${input.userId}`).get(),
      // PRE-log leader query
      db.collection('challengeLeaderboards')
        .where('challengeId', '==', input.challengeId)
        .where('groupId', '==', input.groupId)
        .orderBy('score', 'desc')
        .limit(2)
        .get(),
    ]);

    const isNewParticipant = !posterLbSnap.exists;

    // Post-log cumulative from challengeMembers (client already wrote it)
    const newCumulative = memberSnap.exists
      ? Math.max(numberValue(memberSnap.data() as RecordData, 'cumulativeLoggedValue'), Math.max(0, input.value))
      : Math.max(0, input.value);

    // prevScore from leaderboard (PRE-log) to compute newScore for leadership ranking
    const prevScore = posterLbSnap.exists ? numberValue(posterLbSnap.data() as RecordData, 'score') : 0;
    const newScore = prevScore + input.score;

    const perPersonTarget = challenge?.activities?.[0]?.targetValue;

    let leaderName: string | undefined;
    let leaderValue: number | undefined;
    let isLeading = false;
    let leaderDelta: number | undefined;
    let leadingBy: number | undefined;

    if (!leaderSnaps.empty) {
      const topDoc = leaderSnaps.docs[0];
      const topData = topDoc.data() as RecordData;
      const topUserId = typeof topData.userId === 'string' ? topData.userId : '';
      // If poster was already #1 pre-log, compare against second place
      const otherDoc = topUserId === input.userId && leaderSnaps.docs.length > 1
        ? leaderSnaps.docs[1]
        : topDoc;
      const otherData = otherDoc.data() as RecordData;
      const otherScore = numberValue(otherData, 'score');
      leaderName = typeof otherData.displayName === 'string' ? otherData.displayName : undefined;
      // Only use cumulativeLoggedValue when it's been explicitly set (> 0)
      const rawOther = numberValue(otherData, 'cumulativeLoggedValue');
      leaderValue = rawOther > 0 ? rawOther : undefined;

      isLeading = newScore >= otherScore || topUserId === input.userId;

      if (isLeading && leaderValue !== undefined) {
        leadingBy = Math.max(0, newCumulative - leaderValue);
      } else if (!isLeading && leaderValue !== undefined) {
        const delta = leaderValue - newCumulative;
        // Only set leaderDelta when it's a genuine gap; 0 means tied.
        // Never fall back to score-based comparison — score and value use different units.
        leaderDelta = delta >= 0 ? delta : 0;
      }
      // If leaderValue is undefined: show no numeric delta, avoiding the "0 behind" bug.
    } else {
      isLeading = true; // sole participant
    }

    let label: string;
    if (isNewParticipant) {
      label = perPersonTarget
        ? `Progress: ${fmtNum(newCumulative)} / ${fmtNum(perPersonTarget)}${unitStr}`
        : `Started with ${fmtNum(newCumulative)}${unitStr}`;
    } else if (isLeading) {
      if (leadingBy !== undefined && leadingBy > 0) {
        label = `Leading by ${fmtNum(leadingBy)}${unitStr}`;
      } else if (leadingBy === 0 && leaderName) {
        label = `Tied for the lead with ${leaderName}`;
      } else {
        label = `${displayName} is leading with ${fmtNum(newCumulative)}${unitStr}`;
      }
    } else if (leaderDelta !== undefined) {
      label = leaderDelta === 0
        ? (leaderName ? `Tied for the lead with ${leaderName}` : 'Tied for the lead')
        : `${fmtNum(leaderDelta)}${unitStr} behind ${leaderName ?? 'the leader'}`;
    } else {
      // No reliable delta — show progress vs target or raw total
      label = perPersonTarget
        ? `Progress: ${fmtNum(newCumulative)} / ${fmtNum(perPersonTarget)}${unitStr}`
        : `${displayName} has ${fmtNum(newCumulative)}${unitStr}`;
    }

    return {
      snapshot: {
        challengeType: 'competitive',
        unit: unit || undefined,
        loggedValue: input.value,
        userCumulativeValue: newCumulative,
        targetValue: perPersonTarget,
        daysRemaining,
        leaderName,
        leaderValue,
        leaderDelta,
        leadingBy,
        isLeading,
        label,
      },
    };
  }

  // ── Streak ──────────────────────────────────────────────────────────────────
  if (type === 'streak') {
    // challengeMembers.currentStreak is POST-log (streakEngine wrote it before CF trigger)
    const memberSnap = await db.collection('challengeMembers').doc(`${input.challengeId}_${input.userId}`).get();
    const memberData = memberSnap.exists ? (memberSnap.data() as RecordData) : {};
    // Default to 1 on race (member doc not yet written when very first log triggers CF)
    const streakDay = typeof memberData.currentStreak === 'number' && memberData.currentStreak > 0
      ? memberData.currentStreak
      : 1;

    const phrases = ['keep it up', 'keep the fire burning', 'on a roll', 'unstoppable', 'incredible consistency'];
    const phrase = phrases[(streakDay - 1) % phrases.length];
    const label = `Day ${streakDay} streak — ${phrase}`;

    return {
      snapshot: {
        challengeType: 'streak',
        unit: unit || undefined,
        loggedValue: input.value,
        streakDay,
        dailyTarget,
        daysRemaining,
        label,
      },
    };
  }

  return undefined;
}

function queueActivitySummaryWrites(
  db: Firestore,
  batch: WriteBatch,
  input: ActivitySummaryInput,
  challenge: ChallengeDoc | null,
  displayName: string,
  userPhotoURL?: string,
  feedProgressSnapshot?: FeedProgressSnapshot,
) {
  const challengeName = challenge?.name || 'group challenge';
  const valueLabel = formatValue(input.value, input.unit);
  const groupUserId = `${input.groupId}_${input.userId}`;
  const challengeUserId = `${input.challengeId}_${input.userId}`;
  const payloadBase = {
    groupId: input.groupId,
    userId: input.userId,
    displayName,
    activityCount: FieldValue.increment(1),
    score: FieldValue.increment(input.score),
    lastActivityAt: input.createdAt,
    updatedAt: FieldValue.serverTimestamp(),
  };
  const challengeLeaderboardPayload: Record<string, unknown> = {
    challengeId: input.challengeId,
    groupId: input.groupId,
    userId: input.userId,
    displayName,
    activityCount: FieldValue.increment(1),
    score: FieldValue.increment(input.score),
    lastActivityAt: input.createdAt,
    lastScoringVersion: input.scoringVersion,
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (input.lastScoringMethod) {
    challengeLeaderboardPayload.lastScoringMethod = input.lastScoringMethod;
  }

  const feedDoc: Record<string, unknown> = {
    groupId: input.groupId,
    challengeId: input.challengeId,
    userId: input.userId,
    authorName: displayName,
    challengeName,
    challengeCoverImageUrl: challenge?.coverImageUrl ?? null,
    challengeType: challenge?.challengeType ?? null,
    challengeStartDate: challenge?.startDate ?? null,
    challengeEndDate: challenge?.endDate ?? null,
    activityLabel: input.activityLabel,
    valueLabel,
    value: input.value,
    score: input.score,
    scoringVersion: input.scoringVersion,
    text: `Completed ${valueLabel} in ${challengeName}.`,
    source: input.source,
    feedItemType: 'activity_log',
    createdAt: input.createdAt,
  };
  if (userPhotoURL) feedDoc.userPhotoURL = userPhotoURL;
  if (input.story) feedDoc.story = input.story;
  if (feedProgressSnapshot) feedDoc.feedProgressSnapshot = feedProgressSnapshot;

  batch.set(db.collection('groupActivityFeed').doc(input.activityId), feedDoc, { merge: true });

  batch.set(db.collection('groupMemberStats').doc(groupUserId), {
    ...payloadBase,
    role: 'Member',
  }, { merge: true });

  batch.set(db.collection('groupLeaderboards').doc(groupUserId), payloadBase, { merge: true });

  batch.set(db.collection('challengeLeaderboards').doc(challengeUserId), challengeLeaderboardPayload, { merge: true });

  batch.set(db.collection('challengeActivitySummaries').doc(input.challengeId), {
    challengeId: input.challengeId,
    groupId: input.groupId,
    totalLogs: FieldValue.increment(1),
    totalScore: FieldValue.increment(input.score),
    totalValue: FieldValue.increment(Math.max(0, input.value)),
    uniqueParticipantIds: FieldValue.arrayUnion(input.userId),
    lastActivityAt: input.createdAt,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  // NOTE: challengeMembers is intentionally NOT written here.
  // cumulativeLoggedValue, currentStreak, and lastLogDate are owned by the client
  // challenge engines (competitiveEngine, streakEngine, collectiveEngine) which write
  // them in the same atomic batch as the workout/wellness document. Writing them again
  // in the CF would double-count values.
}

const COLLECTIVE_THRESHOLDS = [
  { pct: 25,  type: 'collective_25',       text: 'Team reached 25% of the goal!' },
  { pct: 50,  type: 'collective_50',       text: 'Team reached halfway to the goal!' },
  { pct: 75,  type: 'collective_75',       text: 'Team reached 75% of the goal!' },
  { pct: 100, type: 'collective_complete', text: 'Team completed the challenge goal!' },
] as const;

async function checkAndQueueMilestones(
  db: Firestore,
  batch: WriteBatch,
  input: ActivitySummaryInput,
  challenge: ChallengeDoc | null,
  displayName: string,
  userPhotoURL?: string,
): Promise<void> {
  const challengeName = challenge?.name || 'group challenge';
  const milestoneBase = (text: string, milestoneType: string): Record<string, unknown> => ({
    groupId: input.groupId,
    challengeId: input.challengeId,
    userId: input.userId,
    authorName: displayName,
    challengeName,
    challengeType: challenge?.challengeType ?? null,
    challengeStartDate: challenge?.startDate ?? null,
    challengeEndDate: challenge?.endDate ?? null,
    feedItemType: 'milestone',
    milestoneType,
    text,
    source: input.source,
    createdAt: input.createdAt,
    ...(userPhotoURL ? { userPhotoURL } : {}),
  });

  const milestoneChecks: Promise<void>[] = [];

  // ── first_log: true when user has no prior challengeLeaderboards doc ─────
  milestoneChecks.push((async () => {
    const leaderRef = db.collection('challengeLeaderboards').doc(`${input.challengeId}_${input.userId}`);
    const milestoneRef = db.collection('groupActivityFeed').doc(`milestone_${input.challengeId}_${input.userId}_first_log`);
    const [leaderSnap, milestoneSnap] = await Promise.all([leaderRef.get(), milestoneRef.get()]);
    if (!leaderSnap.exists && !milestoneSnap.exists) {
      batch.set(milestoneRef, milestoneBase('First activity logged in the challenge!', 'first_log'));
    }
  })());

  // ── collective_25/50/75/100: only for collective with a numeric target ───
  if (challenge?.challengeType === 'collective') {
    const target = challenge.groupCumulativeTarget;
    if (typeof target === 'number' && Number.isFinite(target) && target > 0) {
      milestoneChecks.push((async () => {
        const summarySnap = await db.collection('challengeActivitySummaries').doc(input.challengeId).get();
        const prevTotal = summarySnap.exists ? numberValue(summarySnap.data() as RecordData, 'totalValue') : 0;
        const newTotal = prevTotal + Math.max(0, input.value);
        const prevPct = (prevTotal / target) * 100;
        const newPct  = (newTotal  / target) * 100;

        for (const { pct, type, text } of COLLECTIVE_THRESHOLDS) {
          if (prevPct < pct && newPct >= pct) {
            const milestoneRef = db.collection('groupActivityFeed').doc(`milestone_${input.challengeId}_${type}`);
            const milestoneSnap = await milestoneRef.get();
            if (!milestoneSnap.exists) {
              batch.set(milestoneRef, milestoneBase(text, type));
            }
          }
        }
      })());
    }
  }

  await Promise.all(milestoneChecks);
}

export async function summarizeWorkoutCreated(db: Firestore, workoutId: string, data: RecordData) {
  const userId = stringValue(data, 'userId');
  const challengeId = stringValue(data, 'challengeId');
  if (!userId || !challengeId) {
    logger.warn('summarizeWorkoutCreated skipped missing user/challenge', { workoutId });
    return;
  }
  const challenge = await loadChallenge(db, challengeId);
  if (!isActiveChallenge(challenge)) {
    logger.warn('summarizeWorkoutCreated skipped inactive challenge', { workoutId, challengeId });
    return;
  }
  const groupId = challenge?.groupId || stringValue(data, 'groupId');
  if (!groupId || (challenge?.groupId && stringValue(data, 'groupId') && stringValue(data, 'groupId') !== challenge.groupId)) {
    logger.warn('summarizeWorkoutCreated skipped missing group', { workoutId, challengeId });
    return;
  }
  const value = clampNumber(numberValue(data, 'value'), 0, ACTIVITY_SUMMARY_LIMITS.maxActivityValue);
  const createdAt = toTimestamp(data.createdAt ?? data.loggedAt ?? data.completedAt ?? data.date);
  if (!isReasonableActivityTime(createdAt)) {
    logger.warn('summarizeWorkoutCreated skipped unreasonable timestamp', { workoutId, challengeId, userId });
    return;
  }
  const isV2 = stringValue(data, 'scoringVersion') === 'v2';
  const storedPoints = numberValue(data, 'points');
  const score = isV2
    ? clampNumber(storedPoints, 0, ACTIVITY_SUMMARY_LIMITS.maxActivityScore)
    : clampNumber(Math.round(value), 1, ACTIVITY_SUMMARY_LIMITS.maxActivityScore);
  const scoringMethod = isV2 ? (stringValue(data, 'scoringMethod') || undefined) : undefined;
  const input: ActivitySummaryInput = {
    activityId: workoutId,
    source: 'workout',
    userId,
    groupId,
    challengeId,
    activityLabel: stringValue(data, 'exerciseName') || stringValue(data, 'exerciseId') || 'Workout',
    value,
    unit: stringValue(data, 'unit'),
    score,
    scoringVersion: isV2 ? 'v2' : 'legacy',
    lastScoringMethod: scoringMethod,
    story: stringValue(data, 'notes').trim().slice(0, 280) || undefined,
    createdAt,
  };
  if (!(await canSummarizeActivity(db, input))) {
    logger.warn('summarizeWorkoutCreated skipped invalid membership', { workoutId, userId, groupId, challengeId });
    return;
  }
  const user = await loadUser(db, userId);
  const displayName = displayNameFor(userId, user);

  const snapshotResult = await buildFeedProgressSnapshot(db, input, challenge, displayName);

  const batch = db.batch();
  queueActivitySummaryWrites(db, batch, input, challenge, displayName, user?.photoURL, snapshotResult?.snapshot);
  await checkAndQueueMilestones(db, batch, input, challenge, displayName, user?.photoURL);
  await batch.commit();
  logger.info('summarizeWorkoutCreated completed', { workoutId, userId, groupId, challengeId });
}

export async function summarizeWellnessLogCreated(db: Firestore, logId: string, data: RecordData) {
  const userId = stringValue(data, 'userId');
  const challengeId = stringValue(data, 'challengeId');
  if (!userId || !challengeId) {
    logger.warn('summarizeWellnessLogCreated skipped missing user/challenge', { logId });
    return;
  }
  const challenge = await loadChallenge(db, challengeId);
  if (!isActiveChallenge(challenge)) {
    logger.warn('summarizeWellnessLogCreated skipped inactive challenge', { logId, challengeId });
    return;
  }
  const groupId = challenge?.groupId || stringValue(data, 'groupId');
  if (!groupId || (challenge?.groupId && stringValue(data, 'groupId') && stringValue(data, 'groupId') !== challenge.groupId)) {
    logger.warn('summarizeWellnessLogCreated skipped missing group', { logId, challengeId });
    return;
  }
  const value = clampNumber(numberValue(data, 'value'), 0, ACTIVITY_SUMMARY_LIMITS.maxActivityValue);
  const createdAt = toTimestamp(data.createdAt ?? data.loggedAt ?? data.completedAt ?? data.date);
  if (!isReasonableActivityTime(createdAt)) {
    logger.warn('summarizeWellnessLogCreated skipped unreasonable timestamp', { logId, challengeId, userId });
    return;
  }
  const isV2 = stringValue(data, 'scoringVersion') === 'v2';
  const storedPoints = numberValue(data, 'points');
  const score = isV2
    ? clampNumber(storedPoints, 0, ACTIVITY_SUMMARY_LIMITS.maxActivityScore)
    : clampNumber(Math.round(storedPoints || value || 1), 1, ACTIVITY_SUMMARY_LIMITS.maxActivityScore);
  const scoringMethod = isV2 ? (stringValue(data, 'scoringMethod') || undefined) : undefined;
  const input: ActivitySummaryInput = {
    activityId: logId,
    source: 'wellness',
    userId,
    groupId,
    challengeId,
    activityLabel: stringValue(data, 'activityId') || stringValue(data, 'logType') || 'Wellness activity',
    value,
    unit: stringValue(data, 'unit'),
    score,
    scoringVersion: isV2 ? 'v2' : 'legacy',
    lastScoringMethod: scoringMethod,
    story: stringValue(data, 'notes').trim().slice(0, 280) || undefined,
    createdAt,
  };
  if (!(await canSummarizeActivity(db, input))) {
    logger.warn('summarizeWellnessLogCreated skipped invalid membership', { logId, userId, groupId, challengeId });
    return;
  }
  const user = await loadUser(db, userId);
  const displayName = displayNameFor(userId, user);

  const snapshotResult = await buildFeedProgressSnapshot(db, input, challenge, displayName);

  const batch = db.batch();
  queueActivitySummaryWrites(db, batch, input, challenge, displayName, user?.photoURL, snapshotResult?.snapshot);
  await checkAndQueueMilestones(db, batch, input, challenge, displayName, user?.photoURL);
  await batch.commit();
  logger.info('summarizeWellnessLogCreated completed', { logId, userId, groupId, challengeId });
}

export async function summarizeGroupMemberCreated(db: Firestore, membershipId: string, data: RecordData) {
  const groupId = stringValue(data, 'groupId');
  const userId = stringValue(data, 'userId');
  if (!groupId || !userId || !isActiveStatus(data.status)) return;
  const displayName = displayNameFor(userId, await loadUser(db, userId));
  const role = data.role === 'owner' || data.role === 'admin' ? 'Coach' : 'Member';
  const summaryId = `${groupId}_${userId}`;
  const payload = {
    groupId,
    userId,
    displayName,
    role,
    activityCount: 0,
    score: 0,
    joinedAt: data.createdAt ?? FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  const batch = db.batch();
  batch.set(db.collection('groupMemberStats').doc(summaryId), payload, { merge: true });
  batch.set(db.collection('groupLeaderboards').doc(summaryId), payload, { merge: true });
  await batch.commit();
  logger.info('summarizeGroupMemberCreated completed', { membershipId, groupId, userId });
}

export async function summarizeChallengeMemberCreated(db: Firestore, membershipId: string, data: RecordData) {
  const challengeId = stringValue(data, 'challengeId');
  const userId = stringValue(data, 'userId');
  const groupId = stringValue(data, 'groupId');
  if (!challengeId || !userId || !groupId) return;
  await db.collection('challengeActivitySummaries').doc(challengeId).set({
    challengeId,
    groupId,
    participantCount: FieldValue.increment(1),
    uniqueParticipantIds: FieldValue.arrayUnion(userId),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  logger.info('summarizeChallengeMemberCreated completed', { membershipId, challengeId, groupId, userId });
}
