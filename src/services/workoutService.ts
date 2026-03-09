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
import { ChallengeMember, Workout } from '../types';

export type CreateWorkoutInput = {
  userId: string;
  challengeId: string;
  exerciseId: string;
  value: number;
  unit: string;
  notes?: string;
  groupId?: string;
};

function toIsoDate(date: Date) {
  return date.toISOString().split('T')[0];
}

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
    const challengeSnap = await getDoc(doc(db, 'challenges', input.challengeId));
    if (!challengeSnap.exists()) {
      throw new Error('Challenge not found');
    }
    const challengeData = challengeSnap.data() as { startDate?: string; endDate?: string };
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
    const date = toIsoDate(now);

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
    let membershipSnap = await getDoc(membershipRef);

    if (!membershipSnap.exists()) {
      // Attempt self-heal when challenge was created but auto-join membership didn't persist.
      await challengeService.joinChallenge(input.userId, input.challengeId);
      membershipSnap = await getDoc(membershipRef);
      if (!membershipSnap.exists()) {
        throw new Error('Join challenge before logging workouts');
      }
    }

    const membership = membershipSnap.data() as ChallengeMember;
    const nextCompleted = (membership.activitiesCompleted ?? 0) + 1;
    const totalActivities = Math.max(1, membership.totalActivities ?? 1);
    const nextRate = Math.min(100, Math.round((nextCompleted / totalActivities) * 100));

    const batch = writeBatch(db);
    const sanitizedPayload = removeUndefinedDeep(payload);

    batch.set(workoutRef, {
      ...sanitizedPayload,
      loggedAt: Timestamp.now(),
      verified: false,
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

    const membershipUpdate: Record<string, unknown> = {
      activitiesCompleted: increment(1),
      totalPoints: increment(10),
      lastActivityAt: Timestamp.now(),
      completionRate: nextRate,
    };

    if (nextRate >= 100 && membership.status !== 'completed') {
      membershipUpdate.status = 'completed';
      membershipUpdate.completedAt = Timestamp.now();
    }

    batch.set(membershipRef, membershipUpdate, { merge: true });

    await batch.commit();

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
}

export const workoutService = new WorkoutService();
