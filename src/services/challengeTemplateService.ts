import { addDoc, collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

export type SuggestedChallengeTemplate = {
  id: string;
  category?: 'fitness' | 'wellness';
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
    activityId?: string;
    activityType?: string;
    exerciseName: string;
    description?: string;
    category?: string;
    difficulty?: string;
    icon?: string;
    protocolSteps?: string[];
    benefits?: string[];
    guidelines?: string[];
    warnings?: string[];
    frequency?: 'daily' | 'weekly' | '3x-week' | 'custom';
    targetValue: number;
    unit: string;
    instructions?: string[];
    pointsPerCompletion?: number;
    dailyFrequency?: number;
  }>;
  donation?: {
    enabled: boolean;
    causeName?: string;
    causeDescription?: string;
    targetAmountKes?: number;
    contributionStartDate?: string;
    contributionEndDate?: string;
    contributionPhoneNumber?: string;
    contributionCardUrl?: string;
    disclaimer?: string;
  };
  isPublished: boolean;
  version: number;
};

export type CreateSuggestedChallengeTemplateInput = {
  category?: 'fitness' | 'wellness';
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
    activityId?: string;
    activityType?: string;
    exerciseName: string;
    description?: string;
    category?: string;
    difficulty?: string;
    icon?: string;
    protocolSteps?: string[];
    benefits?: string[];
    guidelines?: string[];
    warnings?: string[];
    frequency?: 'daily' | 'weekly' | '3x-week' | 'custom';
    targetValue: number;
    unit: string;
    instructions?: string[];
    pointsPerCompletion?: number;
    dailyFrequency?: number;
  }>;
  donation?: {
    enabled: boolean;
    causeName?: string;
    causeDescription?: string;
    targetAmountKes?: number;
    contributionStartDate?: string;
    contributionEndDate?: string;
    contributionPhoneNumber?: string;
    contributionCardUrl?: string;
    disclaimer?: string;
  };
  isPublished?: boolean;
};

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, nested]) => {
      if (nested === undefined) return;
      out[key] = stripUndefinedDeep(nested);
    });
    return out as T;
  }
  return value;
}

class ChallengeTemplateService {
  private collectionName = 'challengeTemplates';

  private fromDoc(id: string, data: Record<string, unknown>): SuggestedChallengeTemplate {
    return {
      id,
      category: (data.category as SuggestedChallengeTemplate['category']) ?? 'fitness',
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
            activityId: item.activityId ? String(item.activityId) : undefined,
            activityType: item.activityType ? String(item.activityType) : undefined,
            exerciseName: String(item.exerciseName ?? 'Activity'),
            description: item.description ? String(item.description) : undefined,
            category: item.category ? String(item.category) : undefined,
            difficulty: item.difficulty ? String(item.difficulty) : undefined,
            icon: item.icon ? String(item.icon) : undefined,
            protocolSteps: Array.isArray(item.protocolSteps) ? item.protocolSteps.map((line) => String(line)) : undefined,
            benefits: Array.isArray(item.benefits) ? item.benefits.map((line) => String(line)) : undefined,
            guidelines: Array.isArray(item.guidelines) ? item.guidelines.map((line) => String(line)) : undefined,
            warnings: Array.isArray(item.warnings) ? item.warnings.map((line) => String(line)) : undefined,
            frequency: item.frequency ? String(item.frequency) as 'daily' | 'weekly' | '3x-week' | 'custom' : undefined,
            targetValue: Number(item.targetValue ?? 0),
            unit: String(item.unit ?? 'Reps'),
            instructions: Array.isArray(item.instructions) ? item.instructions.map((line) => String(line)) : undefined,
            pointsPerCompletion: item.pointsPerCompletion ? Number(item.pointsPerCompletion) : undefined,
            dailyFrequency: item.dailyFrequency ? Number(item.dailyFrequency) : undefined,
          }))
        : [],
      donation: data.donation
        ? {
            enabled: Boolean((data.donation as { enabled?: boolean }).enabled),
            causeName: (data.donation as { causeName?: string }).causeName,
            causeDescription: (data.donation as { causeDescription?: string }).causeDescription,
            targetAmountKes:
              (data.donation as { targetAmountKes?: number; targetAmount?: number }).targetAmountKes
              ?? (data.donation as { targetAmount?: number }).targetAmount,
            contributionStartDate: (data.donation as { contributionStartDate?: string }).contributionStartDate,
            contributionEndDate: (data.donation as { contributionEndDate?: string }).contributionEndDate,
            contributionPhoneNumber: (data.donation as { contributionPhoneNumber?: string }).contributionPhoneNumber,
            contributionCardUrl: (data.donation as { contributionCardUrl?: string }).contributionCardUrl,
            disclaimer: (data.donation as { disclaimer?: string }).disclaimer,
          }
        : undefined,
      isPublished: data.isPublished !== false,
      version: Number(data.version ?? 1),
    };
  }

  async getPublishedTemplates(category: 'fitness' | 'wellness' | 'all' = 'fitness'): Promise<SuggestedChallengeTemplate[]> {
    const snap = await getDocs(collection(db, this.collectionName));
    return snap.docs
      .map((item) => this.fromDoc(item.id, item.data() as Record<string, unknown>))
      .filter((template) => template.isPublished !== false)
      .filter((template) => (category === 'all' ? true : (template.category ?? 'fitness') === category))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getTemplateById(templateId: string): Promise<SuggestedChallengeTemplate | null> {
    const snap = await getDoc(doc(db, this.collectionName, templateId));
    if (!snap.exists()) return null;
    return this.fromDoc(snap.id, snap.data() as Record<string, unknown>);
  }

  async createTemplate(payload: CreateSuggestedChallengeTemplateInput): Promise<string> {
    const createdAt = new Date().toISOString();
    const result = await addDoc(collection(db, this.collectionName), stripUndefinedDeep({
      ...payload,
      category: payload.category ?? 'fitness',
      activityCount: payload.activities.length,
      isPublished: payload.isPublished ?? true,
      version: 1,
      createdAt,
      updatedAt: createdAt,
    }));
    return result.id;
  }
}

export const challengeTemplateService = new ChallengeTemplateService();
