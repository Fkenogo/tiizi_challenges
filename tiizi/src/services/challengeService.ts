import { addDoc, collection, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Challenge } from '../types';

type CreateChallengeInput = {
  name: string;
  description: string;
  createdBy: string;
  startDate?: string;
  endDate?: string;
  durationDays?: number;
  groupId?: string;
  challengeType?: 'collective' | 'competitive' | 'streak';
  coverImageUrl?: string;
  exerciseIds?: string[];
  activities?: Array<{
    exerciseId: string;
    exerciseName?: string;
    targetValue: number;
    unit: string;
  }>;
  donation?: {
    enabled: boolean;
    causeDescription?: string;
    targetAmount?: number;
  };
};

class ChallengeService {
  private collectionName = 'challenges';

  async getChallenges(): Promise<Challenge[]> {
    const snap = await getDocs(collection(db, this.collectionName));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Challenge, 'id'>) }));
  }

  async getChallengeById(id: string): Promise<Challenge | null> {
    const snap = await getDoc(doc(db, this.collectionName, id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as Omit<Challenge, 'id'>) };
  }

  async getChallengesByGroup(groupId: string): Promise<Challenge[]> {
    const q = query(collection(db, this.collectionName), where('groupId', '==', groupId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Challenge, 'id'>) }));
  }

  async createChallenge(input: CreateChallengeInput): Promise<Challenge> {
    const startDate = input.startDate ? new Date(input.startDate) : new Date();
    const endDate = input.endDate
      ? new Date(input.endDate)
      : (() => {
          const next = new Date(startDate);
          next.setDate(startDate.getDate() + (input.durationDays ?? 14));
          return next;
        })();

    const payload: Omit<Challenge, 'id'> = {
      name: input.name,
      description: input.description,
      groupId: input.groupId,
      exerciseIds: input.exerciseIds ?? [],
      challengeType: input.challengeType ?? 'collective',
      coverImageUrl: input.coverImageUrl,
      activities: input.activities ?? [],
      donation: input.donation,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      createdBy: input.createdBy,
      status: 'active',
    };
    const ref = await addDoc(collection(db, this.collectionName), payload);
    return { id: ref.id, ...payload };
  }

  async updateChallengeStatus(id: string, status: Challenge['status']): Promise<void> {
    await updateDoc(doc(db, this.collectionName, id), { status });
  }
}

export const challengeService = new ChallengeService();
export type { CreateChallengeInput };
