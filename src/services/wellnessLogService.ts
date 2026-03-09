import { collection, doc, getDoc, increment, setDoc, Timestamp, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { ChallengeMember } from '../types';

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

function todayIsoDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

class WellnessLogService {
  private readonly logsCollection = 'wellnessLogs';
  private readonly challengeMembersCollection = 'challengeMembers';

  private async writeLog(
    logType: 'fasting' | 'hydration' | 'sleep' | 'meditation',
    input: BaseWellnessLogInput,
  ) {
    const points = Number(input.points ?? 10);
    const membershipId = `${input.challengeId}_${input.userId}`;
    const membershipRef = doc(db, this.challengeMembersCollection, membershipId);
    const membershipSnap = await getDoc(membershipRef);
    if (!membershipSnap.exists()) {
      throw new Error('Join challenge before logging wellness activity.');
    }
    const membership = membershipSnap.data() as ChallengeMember;
    const completed = Number(membership.activitiesCompleted ?? 0) + 1;
    const totalActivities = Math.max(1, Number(membership.totalActivities ?? 1));
    const completionRate = Math.min(100, Math.round((completed / totalActivities) * 100));

    const logRef = doc(collection(db, this.logsCollection));
    const now = Timestamp.now();
    const batch = writeBatch(db);
    batch.set(logRef, {
      userId: input.userId,
      groupId: input.groupId,
      challengeId: input.challengeId,
      activityId: input.activityId,
      logType,
      value: input.value,
      unit: input.unit,
      points,
      notes: input.notes?.trim() || undefined,
      date: todayIsoDate(),
      loggedAt: now,
      metadata: input.metadata ?? {},
    });
    batch.set(
      membershipRef,
      {
        activitiesCompleted: increment(1),
        totalPoints: increment(points),
        lastActivityAt: now,
        completionRate,
      },
      { merge: true },
    );
    batch.set(
      doc(db, 'users', input.userId),
      {
        stats: {
          totalPoints: increment(points),
          totalWorkouts: increment(1),
        },
        lastWorkoutAt: now,
      },
      { merge: true },
    );
    await batch.commit();
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
