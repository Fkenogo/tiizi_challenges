import { addDoc, collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Challenge } from '../types';

export type ModerationStatus = 'pending' | 'approved' | 'needs_changes';

export type AdminChallenge = Challenge & {
  moderationStatus?: ModerationStatus;
  moderatedBy?: string;
  moderatedAt?: string;
  moderationNote?: string;
};

export type ChallengeTemplate = {
  id: string;
  name: string;
  description: string;
  durationDays: number;
  challengeType: 'collective' | 'competitive' | 'streak';
  difficultyLevel: 'beginner' | 'intermediate' | 'advanced';
  activityCount: number;
  version: number;
  isPublished: boolean;
};

export type ChallengeAnalytics = {
  totalChallenges: number;
  activeChallenges: number;
  completedChallenges: number;
  avgParticipants: number;
  avgCompletionRate: number;
  byType: Record<string, number>;
};

class AdminChallengeService {
  private collectionName = 'challenges';
  private templatesCollection = 'challengeTemplates';

  async getPendingChallenges(): Promise<AdminChallenge[]> {
    const snap = await getDocs(collection(db, this.collectionName));
    const all = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AdminChallenge, 'id'>) }));
    return all
      .filter((c) => {
        const normalized = c.moderationStatus ?? (c.status === 'active' ? 'approved' : 'pending');
        return normalized === 'pending' || normalized === 'needs_changes';
      })
      .sort((a, b) => Date.parse(b.startDate) - Date.parse(a.startDate));
  }

  async getApprovedChallenges(): Promise<AdminChallenge[]> {
    const snap = await getDocs(collection(db, this.collectionName));
    const all = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AdminChallenge, 'id'>) }));
    return all
      .filter((c) => c.moderationStatus === 'approved' || c.status === 'active')
      .sort((a, b) => Date.parse(b.startDate) - Date.parse(a.startDate));
  }

  async getActiveChallenges(): Promise<AdminChallenge[]> {
    const snap = await getDocs(collection(db, this.collectionName));
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<AdminChallenge, 'id'>) }))
      .filter((c) => c.status === 'active')
      .sort((a, b) => Date.parse(b.startDate) - Date.parse(a.startDate));
  }

  async getTemplates(): Promise<ChallengeTemplate[]> {
    const snap = await getDocs(collection(db, this.templatesCollection));
    return snap.docs
      .map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          name: String(data.name ?? 'Untitled template'),
          description: String(data.description ?? ''),
          durationDays: Number(data.durationDays ?? 30),
          challengeType: (data.challengeType as ChallengeTemplate['challengeType']) ?? 'collective',
          difficultyLevel: (data.difficultyLevel as ChallengeTemplate['difficultyLevel']) ?? 'beginner',
          activityCount: Number(data.activityCount ?? 0),
          version: Number(data.version ?? 1),
          isPublished: data.isPublished !== false,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async createChallengeFromAdmin(payload: {
    name: string;
    description: string;
    challengeType: 'collective' | 'competitive' | 'streak';
    startDate: string;
    endDate: string;
    createdBy: string;
  }): Promise<string> {
    const createdAt = new Date().toISOString();
    const result = await addDoc(collection(db, this.collectionName), {
      ...payload,
      status: 'active',
      progress: 0,
      participantCount: 0,
      moderationStatus: 'approved',
      createdAt,
    });
    return result.id;
  }

  async getChallengeAnalytics(): Promise<ChallengeAnalytics> {
    const snap = await getDocs(collection(db, this.collectionName));
    const all = snap.docs.map((d) => d.data() as Record<string, unknown>);
    const totalChallenges = all.length;
    const activeChallenges = all.filter((c) => c.status === 'active').length;
    const completedChallenges = all.filter((c) => c.status === 'completed').length;
    const withParticipants = all.map((c) => Number(c.participantCount ?? 0));
    const withCompletion = all.map((c) => Number(c.progress ?? 0));
    const avgParticipants = withParticipants.length
      ? Number((withParticipants.reduce((sum, value) => sum + value, 0) / withParticipants.length).toFixed(2))
      : 0;
    const avgCompletionRate = withCompletion.length
      ? Number((withCompletion.reduce((sum, value) => sum + value, 0) / withCompletion.length).toFixed(2))
      : 0;
    const byType = all.reduce<Record<string, number>>((acc, row) => {
      const key = String(row.challengeType ?? 'unknown');
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    return {
      totalChallenges,
      activeChallenges,
      completedChallenges,
      avgParticipants,
      avgCompletionRate,
      byType,
    };
  }

  async approveChallenge(challengeId: string, moderatorUid: string): Promise<void> {
    await updateDoc(doc(db, this.collectionName, challengeId), {
      moderationStatus: 'approved',
      status: 'active',
      moderatedBy: moderatorUid,
      moderatedAt: new Date().toISOString(),
      moderationNote: '',
    });
  }

  async requestChallengeChanges(challengeId: string, moderatorUid: string, note: string): Promise<void> {
    await updateDoc(doc(db, this.collectionName, challengeId), {
      moderationStatus: 'needs_changes',
      status: 'draft',
      moderatedBy: moderatorUid,
      moderatedAt: new Date().toISOString(),
      moderationNote: note.trim(),
    });
  }
}

export const adminChallengeService = new AdminChallengeService();
