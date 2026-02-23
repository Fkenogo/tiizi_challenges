import { addDoc, collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

export type SuggestedChallengeTemplate = {
  id: string;
  name: string;
  description: string;
  challengeType: 'collective' | 'competitive' | 'streak';
  durationDays: number;
  difficultyLevel: 'beginner' | 'intermediate' | 'advanced';
  coverImageUrl?: string;
  tag?: string;
  popularityText?: string;
  activityCount: number;
  activities: Array<{
    exerciseId?: string;
    exerciseName: string;
    targetValue: number;
    unit: string;
  }>;
  donation?: {
    enabled: boolean;
    causeDescription?: string;
    targetAmount?: number;
  };
  isPublished: boolean;
  version: number;
};

export type CreateSuggestedChallengeTemplateInput = {
  name: string;
  description: string;
  challengeType: 'collective' | 'competitive' | 'streak';
  durationDays: number;
  difficultyLevel: 'beginner' | 'intermediate' | 'advanced';
  coverImageUrl?: string;
  tag?: string;
  popularityText?: string;
  activities: Array<{
    exerciseId?: string;
    exerciseName: string;
    targetValue: number;
    unit: string;
  }>;
  donation?: {
    enabled: boolean;
    causeDescription?: string;
    targetAmount?: number;
  };
  isPublished?: boolean;
};

class ChallengeTemplateService {
  private collectionName = 'challengeTemplates';

  private fromDoc(id: string, data: Record<string, unknown>): SuggestedChallengeTemplate {
    return {
      id,
      name: String(data.name ?? 'Untitled template'),
      description: String(data.description ?? ''),
      challengeType: (data.challengeType as SuggestedChallengeTemplate['challengeType']) ?? 'collective',
      durationDays: Number(data.durationDays ?? 30),
      difficultyLevel: (data.difficultyLevel as SuggestedChallengeTemplate['difficultyLevel']) ?? 'beginner',
      coverImageUrl: data.coverImageUrl ? String(data.coverImageUrl) : undefined,
      tag: data.tag ? String(data.tag) : undefined,
      popularityText: data.popularityText ? String(data.popularityText) : undefined,
      activityCount: Number(data.activityCount ?? 0),
      activities: Array.isArray(data.activities)
        ? (data.activities as Array<Record<string, unknown>>).map((item) => ({
            exerciseId: item.exerciseId ? String(item.exerciseId) : undefined,
            exerciseName: String(item.exerciseName ?? 'Activity'),
            targetValue: Number(item.targetValue ?? 0),
            unit: String(item.unit ?? 'Reps'),
          }))
        : [],
      donation: data.donation
        ? {
            enabled: Boolean((data.donation as { enabled?: boolean }).enabled),
            causeDescription: (data.donation as { causeDescription?: string }).causeDescription,
            targetAmount: (data.donation as { targetAmount?: number }).targetAmount,
          }
        : undefined,
      isPublished: data.isPublished !== false,
      version: Number(data.version ?? 1),
    };
  }

  async getPublishedTemplates(): Promise<SuggestedChallengeTemplate[]> {
    const snap = await getDocs(collection(db, this.collectionName));
    return snap.docs
      .map((item) => this.fromDoc(item.id, item.data() as Record<string, unknown>))
      .filter((template) => template.isPublished !== false)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getTemplateById(templateId: string): Promise<SuggestedChallengeTemplate | null> {
    const snap = await getDoc(doc(db, this.collectionName, templateId));
    if (!snap.exists()) return null;
    return this.fromDoc(snap.id, snap.data() as Record<string, unknown>);
  }

  async createTemplate(payload: CreateSuggestedChallengeTemplateInput): Promise<string> {
    const createdAt = new Date().toISOString();
    const result = await addDoc(collection(db, this.collectionName), {
      ...payload,
      activityCount: payload.activities.length,
      isPublished: payload.isPublished ?? true,
      version: 1,
      createdAt,
      updatedAt: createdAt,
    });
    return result.id;
  }
}

export const challengeTemplateService = new ChallengeTemplateService();
