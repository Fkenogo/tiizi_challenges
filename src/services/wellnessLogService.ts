import { collection, doc, getDoc, getDocs, increment, query, Timestamp, where, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { challengeService } from './challengeService';
import type { ChallengeMember } from '../types';
import { computeActivityScore, type ChallengeType } from './scoringConfig';
import { computeRequiredLogs, deriveDailyTargetValue } from './challengeCompletion';
import { selectEngine, type ChallengeContext, type MembershipSnapshot, type LogEvent } from './challengeEngine';
import { atomicCollectiveGroupUpdate } from './collectiveGroupUpdate';
import { toLocalIsoDate } from '../utils/dateUtils';

const __wellnessLogDebug = typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).__wellnessLogDebug === true;

type BaseWellnessLogInput = {
  userId: string;
  challengeId: string;
  groupId: string;
  activityId: string;
  value: number;
  unit: string;
  notes?: string;
  points?: number;
  metadata?: Record<string, unknown>;
};

type FastingLogInput = BaseWellnessLogInput & {
  startTime?: string;
  endTime?: string;
};

type HydrationLogInput = BaseWellnessLogInput & {
  intakeMl?: number;
};

type SleepLogInput = BaseWellnessLogInput & {
  bedtime?: string;
  wakeTime?: string;
  quality?: number;
};

type MeditationLogInput = BaseWellnessLogInput & {
  moodBefore?: string;
  moodAfter?: string;
};

function removeUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => removeUndefinedDeep(item)) as T;
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .map(([key, item]) => [key, removeUndefinedDeep(item)]),
    ) as T;
  }
  return value;
}

class WellnessLogService {
  private readonly logsCollection = 'wellnessLogs';
  private readonly challengeMembersCollection = 'challengeMembers';

  private async writeLog(
    logType: 'fasting' | 'hydration' | 'sleep' | 'meditation',
    input: BaseWellnessLogInput,
  ) {
    const plannedWrites = ['wellnessLogs create', 'challengeMembers update'];
    const membershipId = `${input.challengeId}_${input.userId}`;
    const membershipRef = doc(db, this.challengeMembersCollection, membershipId);

    const groupMemberId = `${input.groupId}_${input.userId}`;
    const challengeRef = doc(db, 'challenges', input.challengeId);
    let membershipSnap;
    let challengeSnap;
    let groupMemberSnap;
    try {
      [membershipSnap, challengeSnap, groupMemberSnap] = await Promise.all([
        getDoc(membershipRef),
        getDoc(challengeRef),
        getDoc(doc(db, 'groupMembers', groupMemberId)),
      ]);
    } catch (err) {
      console.error('[wellnessLogService] getDoc failed', { op: 'parallel reads', challengeId: input.challengeId, message: (err as Error).message });
      throw err;
    }

    const groupMember = groupMemberSnap.exists() ? (groupMemberSnap.data() as { userId?: string; status?: string }) : null;
    if (!groupMember || groupMember.userId !== input.userId || !['active', 'joined'].includes(groupMember.status ?? '')) {
      if (__wellnessLogDebug) console.warn('[wellnessLogDebug] groupMember validation failed', groupMember);
      throw new Error('Not an active group member.');
    }

    if (!membershipSnap.exists()) {
      // Self-heal: attempt auto-join when group member hasn't joined the challenge yet.
      // Group membership was already validated above — only active group members reach here.
      await challengeService.joinChallenge(input.userId, input.challengeId);
      membershipSnap = await getDoc(membershipRef);
      if (!membershipSnap.exists()) {
        throw new Error('Join challenge before logging wellness activity.');
      }
    }
    const membership = membershipSnap.data() as ChallengeMember;

    if (membership.status === 'completed') {
      throw new Error('Challenge already completed.');
    }

    const challengeData = challengeSnap.exists()
      ? (challengeSnap.data() as {
          durationDays?: number;
          activities?: Array<{ activityId?: string; exerciseId?: string; targetValue?: number; targetType?: 'daily' | 'cumulative' }>;
          challengeType?: string;
          engineVersion?: string;
          startDate?: string;
          endDate?: string;
          groupCumulativeTarget?: number;
          autoCompleteOnGroupTarget?: boolean;
          groupCurrentTotal?: number;
          requiredConsecutiveDays?: number;
          streakResetOnMiss?: boolean;
        })
      : {};

    if (challengeData.engineVersion !== 'v2') {
      throw new Error('This challenge is no longer supported and cannot accept new activity logs.');
    }

    const activityCount = Math.max(1, challengeData.activities?.length ?? 1);
    const totalActivities = computeRequiredLogs(challengeData.durationDays, activityCount);

    if (totalActivities <= 0) {
      throw new Error('Challenge is not fully configured. Please contact your group admin.');
    }

    const activityConfig = challengeData.activities?.find(
      (a) => a.activityId === input.activityId || a.exerciseId === input.activityId,
    );
    const rawTargetValue = activityConfig?.targetValue ?? input.value;
    const effectiveTargetValue = deriveDailyTargetValue(rawTargetValue, challengeData.durationDays, challengeData.challengeType ?? 'collective', activityConfig?.targetType);

    const scoring = computeActivityScore({
      value: input.value,
      targetValue: effectiveTargetValue,
      challengeType: (challengeData.challengeType ?? 'collective') as ChallengeType,
    });
    const points = scoring.pointsEarned;

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
      dailyCompletedActivities: membership.dailyCompletedActivities,
      dailyTargetDate: membership.dailyTargetDate,
      cumulativeLoggedValue: membership.cumulativeLoggedValue,
      cumulativeValues: membership.cumulativeValues,
    };

    const logEvent: LogEvent = {
      userId: input.userId,
      challengeId: input.challengeId,
      activityId: input.activityId,
      value: input.value,
      unit: input.unit,
      date: toLocalIsoDate(new Date()),
      loggedAt: new Date(),
      pointsEarned: points,
    };

    const context: ChallengeContext = {
      challengeId: input.challengeId,
      challengeType: (challengeData.challengeType ?? 'collective') as 'collective' | 'competitive' | 'streak',
      engineVersion: 'v2',
      targetType: activityConfig?.targetType ?? 'daily',
      durationDays: challengeData.durationDays ?? 1,
      activities: (challengeData.activities ?? []).map((a) => ({
        activityId: a.activityId,
        exerciseId: a.exerciseId,
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

    const logRef = doc(collection(db, this.logsCollection));
    const now = Timestamp.now();

    const logPayload = {
      userId: input.userId,
      groupId: input.groupId,
      challengeId: input.challengeId,
      activityId: input.activityId,
      logType,
      value: input.value,
      unit: input.unit,
      points,
      notes: input.notes?.trim() || undefined,
      date: toLocalIsoDate(new Date()),
      loggedAt: now.toDate().toISOString(),
      metadata: input.metadata ?? {},
      scoringVersion: 'v2',
    };

    // Spread all engine fields (handles v2-specific fields like currentStreak, longestStreak,
    // lastLogDate, engineVersion), then override with Firestore-compatible atomic values.
    const membershipUpdate: Record<string, unknown> = {
      ...engineResult.membershipUpdate,
      totalPoints: increment(points),  // atomic FieldValue, not absolute number
      lastActivityAt: now,             // Firestore Timestamp, not Date
    };
    delete membershipUpdate['status'];
    delete membershipUpdate['completedAt'];

    // Collective completion is determined by the atomic transaction below — not the engine's
    // optimistic estimate — so we suppress the status write in the batch for collective challenges.
    const isCollective = !!engineResult.challengeUpdate;
    if (engineResult.isCompleted && !isCollective) {
      membershipUpdate.status = 'completed';
      membershipUpdate.completedAt = now;
    }

    const batch = writeBatch(db);
    batch.set(logRef, removeUndefinedDeep(logPayload));
    batch.set(membershipRef, membershipUpdate, { merge: true });
    // Note: for collective challenges the challenge doc is NOT updated in this batch.
    // atomicCollectiveGroupUpdate (below) owns that write via a Firestore transaction.

    try {
      await batch.commit();
    } catch (err) {
      console.error('[wellnessLogService] batch commit failed', { plannedWrites, challengeId: input.challengeId, message: (err as Error).message });
      throw err;
    }

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
  }

  async logFasting(input: FastingLogInput): Promise<void> {
    await this.writeLog('fasting', {
      ...input,
      metadata: {
        ...input.metadata,
        startTime: input.startTime,
        endTime: input.endTime,
      },
    });
  }

  async logHydration(input: HydrationLogInput): Promise<void> {
    await this.writeLog('hydration', {
      ...input,
      metadata: {
        ...input.metadata,
        intakeMl: input.intakeMl,
      },
    });
  }

  async logSleep(input: SleepLogInput): Promise<void> {
    await this.writeLog('sleep', {
      ...input,
      metadata: {
        ...input.metadata,
        bedtime: input.bedtime,
        wakeTime: input.wakeTime,
        quality: input.quality,
      },
    });
  }

  async logMeditation(input: MeditationLogInput): Promise<void> {
    await this.writeLog('meditation', {
      ...input,
      metadata: {
        ...input.metadata,
        moodBefore: input.moodBefore,
        moodAfter: input.moodAfter,
      },
    });
  }
}

export const wellnessLogService = new WellnessLogService();
export type { FastingLogInput, HydrationLogInput, SleepLogInput, MeditationLogInput };
