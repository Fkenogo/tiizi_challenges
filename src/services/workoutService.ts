import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { challengeService } from './challengeService';
import { isGroupActive } from '../utils/groupLifecycle';
import { ChallengeMember, Workout } from '../types';
import { computeActivityScore, type ChallengeType } from './scoringConfig';
import { computeRequiredLogs, deriveDailyTargetValue } from './challengeCompletion';
import { selectEngine, type ChallengeContext, type MembershipSnapshot, type LogEvent } from './challengeEngine';
import { atomicCollectiveGroupUpdate } from './collectiveGroupUpdate';
import { toLocalIsoDate } from '../utils/dateUtils';

export type CreateWorkoutInput = {
  userId: string;
  challengeId: string;
  exerciseId: string;
  value: number;
  unit: string;
  notes?: string;
  groupId?: string;
};

function removeUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => removeUndefinedDeep(item)) as T;
  }

  if (value && typeof value === 'object') {
    const cleaned = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, removeUndefinedDeep(item)]);
    return Object.fromEntries(cleaned) as T;
  }

  return value;
}

class WorkoutService {
  private collectionName = 'workouts';
  private challengeMembersCollection = 'challengeMembers';

  async createWorkout(input: CreateWorkoutInput): Promise<Workout> {
    const challengeRef = doc(db, 'challenges', input.challengeId);
    const challengeSnap = await getDoc(challengeRef);
    if (!challengeSnap.exists()) {
      throw new Error('Challenge not found');
    }
    const challengeData = challengeSnap.data() as {
      startDate?: string;
      endDate?: string;
      durationDays?: number;
      activities?: Array<{ exerciseId?: string; activityId?: string; targetValue?: number; targetType?: 'daily' | 'cumulative' }>;
      challengeType?: string;
      engineVersion?: string;
      groupCumulativeTarget?: number;
      autoCompleteOnGroupTarget?: boolean;
      groupCurrentTotal?: number;
      requiredConsecutiveDays?: number;
      streakResetOnMiss?: boolean;
    };
    const currentTime = new Date();
    const startAt = challengeData.startDate ? new Date(challengeData.startDate) : null;
    const endAt = challengeData.endDate ? new Date(challengeData.endDate) : null;
    if (startAt && currentTime < startAt) {
      throw new Error('Challenge has not started yet.');
    }
    if (endAt && currentTime > endAt) {
      throw new Error('Challenge has already ended.');
    }

    const now = new Date();
    const completedAt = now.toISOString();
    const date = toLocalIsoDate(now);

    const payload: Omit<Workout, 'id'> = {
      userId: input.userId,
      challengeId: input.challengeId,
      exerciseId: input.exerciseId,
      value: input.value,
      unit: input.unit,
      notes: input.notes?.trim() ? input.notes.trim() : undefined,
      groupId: input.groupId,
      completedAt,
      date,
    };

    const workoutRef = doc(collection(db, this.collectionName));
    const membershipId = `${input.challengeId}_${input.userId}`;
    const membershipRef = doc(db, this.challengeMembersCollection, membershipId);
    const groupMemberId = input.groupId ? `${input.groupId}_${input.userId}` : null;

    if (input.groupId) {
      const groupSnap = await getDoc(doc(db, 'groups', input.groupId));
      if (!isGroupActive(groupSnap.exists() ? (groupSnap.data() as { status?: string }) : null)) {
        throw new Error('Activity logging is not available — this group has been deactivated.');
      }
    }

    const [initialMembershipSnap, groupMemberSnap] = await Promise.all([
      getDoc(membershipRef),
      groupMemberId ? getDoc(doc(db, 'groupMembers', groupMemberId)) : Promise.resolve(null),
    ]);

    // Validate active group membership when this is a group challenge.
    if (groupMemberId && groupMemberSnap) {
      const groupMember = groupMemberSnap.exists()
        ? (groupMemberSnap.data() as { userId?: string; status?: string })
        : null;
      if (
        !groupMember ||
        groupMember.userId !== input.userId ||
        !['active', 'joined'].includes(groupMember.status ?? '')
      ) {
        throw new Error('Not an active group member.');
      }
    }

    let membershipSnap = initialMembershipSnap;
    if (!membershipSnap.exists()) {
      // Attempt self-heal when challenge was created but auto-join membership didn't persist.
      await challengeService.joinChallenge(input.userId, input.challengeId);
      membershipSnap = await getDoc(membershipRef);
      if (!membershipSnap.exists()) {
        throw new Error('Join challenge before logging workouts');
      }
    }

    const membership = membershipSnap.data() as ChallengeMember;

    if (membership.status === 'completed') {
      throw new Error('Challenge already completed.');
    }

    const activityCount = Math.max(1, challengeData.activities?.length ?? 1);
    const totalActivities = computeRequiredLogs(challengeData.durationDays, activityCount);

    if (totalActivities <= 0) {
      throw new Error('Challenge is not fully configured. Please contact your group admin.');
    }

    const activityConfig = challengeData.activities?.find(
      (a) => a.exerciseId === input.exerciseId || a.activityId === input.exerciseId,
    );
    const rawTargetValue = activityConfig?.targetValue ?? 0;
    const effectiveTargetValue = deriveDailyTargetValue(rawTargetValue, challengeData.durationDays, challengeData.challengeType ?? 'collective', activityConfig?.targetType);
    const scoring = computeActivityScore({
      value: input.value,
      targetValue: effectiveTargetValue,
      challengeType: (challengeData.challengeType ?? 'collective') as ChallengeType,
    });

    const membershipSnapshot: MembershipSnapshot = {
      userId: input.userId,
      challengeId: input.challengeId,
      status: membership.status,
      activitiesCompleted: membership.activitiesCompleted ?? 0,
      totalActivities,   // freshly computed — not stale membership doc value
      completionRate: membership.completionRate ?? 0,
      totalPoints: membership.totalPoints ?? 0,
      currentStreak: membership.currentStreak,
      longestStreak: membership.longestStreak,
      lastLogDate: membership.lastLogDate,
      cumulativeLoggedValue: membership.cumulativeLoggedValue,
      cumulativeValues: membership.cumulativeValues,
    };

    const logEvent: LogEvent = {
      userId: input.userId,
      challengeId: input.challengeId,
      activityId: input.exerciseId,
      value: input.value,
      unit: input.unit,
      date,
      loggedAt: now,
      pointsEarned: scoring.pointsEarned,
    };

    const context: ChallengeContext = {
      challengeId: input.challengeId,
      challengeType: (challengeData.challengeType ?? 'collective') as 'collective' | 'competitive' | 'streak',
      engineVersion: challengeData.engineVersion === 'v2' ? 'v2' : 'v1',
      targetType: activityConfig?.targetType ?? 'daily',
      durationDays: challengeData.durationDays ?? 1,
      activities: (challengeData.activities ?? []).map((a) => ({
        exerciseId: a.exerciseId,
        activityId: a.activityId,
        targetValue: a.targetValue ?? 0,
        unit: '',
      })),
      startDate: challengeData.startDate ?? '',
      endDate: challengeData.endDate ?? '',
      groupCumulativeTarget: challengeData.groupCumulativeTarget,
      autoCompleteOnGroupTarget: challengeData.autoCompleteOnGroupTarget,
      requiredConsecutiveDays: challengeData.requiredConsecutiveDays,
      streakResetOnMiss: challengeData.streakResetOnMiss,
    };

    const engine = selectEngine(challengeData);
    const challengeSnapshot = { groupCurrentTotal: challengeData.groupCurrentTotal };
    const engineResult = engine.computeUpdate(context, membershipSnapshot, logEvent, challengeSnapshot);

    const batch = writeBatch(db);
    const sanitizedPayload = removeUndefinedDeep(payload);

    batch.set(workoutRef, {
      ...sanitizedPayload,
      loggedAt: Timestamp.now(),
      verified: false,
      points: scoring.pointsEarned,
      scoringVersion: 'v2',
    });

    batch.set(
      doc(db, 'users', input.userId),
      {
        stats: {
          totalWorkouts: increment(1),
        },
        lastWorkoutAt: Timestamp.now(),
      },
      { merge: true },
    );

    // Spread all engine fields (handles v2-specific fields like currentStreak, longestStreak,
    // lastLogDate, engineVersion), then override with Firestore-compatible atomic values.
    const membershipUpdate: Record<string, unknown> = {
      ...engineResult.membershipUpdate,
      totalPoints: increment(scoring.pointsEarned),  // atomic FieldValue, not absolute number
      lastActivityAt: Timestamp.now(),               // Firestore Timestamp, not Date
    };
    delete membershipUpdate['status'];
    delete membershipUpdate['completedAt'];

    // Collective completion is determined by the atomic transaction below — not the engine's
    // optimistic estimate — so we suppress the status write in the batch for collective challenges.
    const isCollective = !!engineResult.challengeUpdate;
    if (engineResult.isCompleted && !isCollective) {
      membershipUpdate.status = 'completed';
      membershipUpdate.completedAt = Timestamp.now();
    }

    batch.set(membershipRef, membershipUpdate, { merge: true });
    // Note: for collective challenges the challenge doc is NOT updated in this batch.
    // atomicCollectiveGroupUpdate (below) owns that write via a Firestore transaction.

    await batch.commit();

    // Collective-only: atomically increment groupCurrentTotal and trigger exactly-one
    // completion cascade. Uses runTransaction so concurrent logs cannot both miss the
    // threshold (BUG-001 fix).
    if (isCollective) {
      await atomicCollectiveGroupUpdate(
        input.challengeId,
        engineResult.challengeUpdate!.groupCurrentTotalDelta,
        membershipRef,
      );
    }

    return { id: workoutRef.id, ...sanitizedPayload };
  }

  async getWorkoutsByChallenge(challengeId: string): Promise<Workout[]> {
    const q = query(collection(db, this.collectionName), where('challengeId', '==', challengeId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Workout, 'id'>) }));
  }

  async getWorkoutsByUser(userId: string): Promise<Workout[]> {
    const q = query(collection(db, this.collectionName), where('userId', '==', userId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Workout, 'id'>) }));
  }

  async getWorkoutsByUserSince(userId: string, sinceDate: string): Promise<Workout[]> {
    const q = query(
      collection(db, this.collectionName),
      where('userId', '==', userId),
      where('date', '>=', sinceDate),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Workout, 'id'>) }));
  }
}

export const workoutService = new WorkoutService();
