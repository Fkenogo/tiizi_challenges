import { addDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Workout } from '../types';

export type CreateWorkoutInput = {
  userId: string;
  challengeId: string;
  exerciseId: string;
  value: number;
  unit: string;
  notes?: string;
  groupId?: string;
};

class WorkoutService {
  private collectionName = 'workouts';

  async createWorkout(input: CreateWorkoutInput): Promise<Workout> {
    const payload: Omit<Workout, 'id'> = {
      userId: input.userId,
      challengeId: input.challengeId,
      exerciseId: input.exerciseId,
      value: input.value,
      unit: input.unit,
      notes: input.notes?.trim() ? input.notes.trim() : undefined,
      groupId: input.groupId,
      completedAt: new Date().toISOString(),
    };
    const ref = await addDoc(collection(db, this.collectionName), payload);
    return { id: ref.id, ...payload };
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
