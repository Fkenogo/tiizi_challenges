import { addDoc, collection, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export type TemplateStatus = 'draft' | 'published' | 'archived' | 'deleted';

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
  // Lifecycle
  status: TemplateStatus;
  isPublished: boolean;
  isFeatured?: boolean;
  featuredAt?: string;
  featuredBy?: string;
  version: number;
  usageCount: number;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string;
  archivedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  // Engine-specific fields (v2 engines)
  requiredConsecutiveDays?: number;
  streakResetOnMiss?: boolean;
  groupCumulativeTarget?: number;
  autoCompleteOnGroupTarget?: boolean;
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
    frequency?: 'daily' | 'weekly' | '2x-week' | '3x-week' | '5x-week' | 'custom';
    targetValue: number;
    unit: string;
    targetType?: 'daily' | 'cumulative';
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
    currency?: string;
  };
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
  // Engine-specific fields (v2 engines)
  requiredConsecutiveDays?: number;
  streakResetOnMiss?: boolean;
  groupCumulativeTarget?: number;
  autoCompleteOnGroupTarget?: boolean;
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
    frequency?: 'daily' | 'weekly' | '2x-week' | '3x-week' | '5x-week' | 'custom';
    targetValue: number;
    unit: string;
    targetType?: 'daily' | 'cumulative';
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
  createdBy?: string;
};

export type UpdateTemplateInput = Partial<Omit<CreateSuggestedChallengeTemplateInput, 'createdBy'>>;

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

// Derive status from legacy isPublished if explicit status field is absent.
function deriveStatus(data: Record<string, unknown>): TemplateStatus {
  if (data.status === 'draft' || data.status === 'published' || data.status === 'archived' || data.status === 'deleted') {
    return data.status as TemplateStatus;
  }
  return data.isPublished !== false ? 'published' : 'draft';
}

class ChallengeTemplateService {
  private collectionName = 'challengeTemplates';

  private fromDoc(id: string, data: Record<string, unknown>): SuggestedChallengeTemplate {
    const status = deriveStatus(data);
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
      status,
      isPublished: status === 'published',
      isFeatured: data.isFeatured === true,
      featuredAt: data.featuredAt ? String(data.featuredAt) : undefined,
      featuredBy: data.featuredBy ? String(data.featuredBy) : undefined,
      version: Number(data.version ?? 1),
      usageCount: Number(data.usageCount ?? 0),
      createdAt: data.createdAt ? String(data.createdAt) : undefined,
      updatedAt: data.updatedAt ? String(data.updatedAt) : undefined,
      publishedAt: data.publishedAt ? String(data.publishedAt) : undefined,
      archivedAt: data.archivedAt ? String(data.archivedAt) : undefined,
      createdBy: data.createdBy ? String(data.createdBy) : undefined,
      updatedBy: data.updatedBy ? String(data.updatedBy) : undefined,
      requiredConsecutiveDays: data.requiredConsecutiveDays != null ? Number(data.requiredConsecutiveDays) : undefined,
      streakResetOnMiss: data.streakResetOnMiss != null ? Boolean(data.streakResetOnMiss) : undefined,
      groupCumulativeTarget: data.groupCumulativeTarget != null ? Number(data.groupCumulativeTarget) : undefined,
      autoCompleteOnGroupTarget: data.autoCompleteOnGroupTarget != null ? Boolean(data.autoCompleteOnGroupTarget) : undefined,
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
            frequency: item.frequency ? String(item.frequency) as 'daily' | 'weekly' | '2x-week' | '3x-week' | '5x-week' | 'custom' : undefined,
            targetValue: Number(item.targetValue ?? 0),
            unit: String(item.unit ?? 'Reps'),
            targetType: item.targetType === 'daily' || item.targetType === 'cumulative' ? item.targetType : undefined,
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
            currency: (data.donation as { currency?: string }).currency,
          }
        : undefined,
    };
  }

  // User-facing: published templates only (backward-compatible).
  async getPublishedTemplates(category: 'fitness' | 'wellness' | 'all' = 'fitness'): Promise<SuggestedChallengeTemplate[]> {
    const snap = await getDocs(collection(db, this.collectionName));
    return snap.docs
      .map((item) => this.fromDoc(item.id, item.data() as Record<string, unknown>))
      .filter((template) => template.status === 'published')
      .filter((template) => (category === 'all' ? true : (template.category ?? 'fitness') === category))
      .sort((a, b) => {
        if (a.isFeatured && !b.isFeatured) return -1;
        if (!a.isFeatured && b.isFeatured) return 1;
        return a.name.localeCompare(b.name);
      });
  }

  // Admin: all non-deleted templates.
  async getAllTemplatesAdmin(): Promise<SuggestedChallengeTemplate[]> {
    const snap = await getDocs(collection(db, this.collectionName));
    return snap.docs
      .map((item) => this.fromDoc(item.id, item.data() as Record<string, unknown>))
      .filter((template) => template.status !== 'deleted')
      .sort((a, b) => {
        const aTime = a.updatedAt ?? a.createdAt ?? '';
        const bTime = b.updatedAt ?? b.createdAt ?? '';
        return bTime.localeCompare(aTime);
      });
  }

  async getTemplateById(templateId: string): Promise<SuggestedChallengeTemplate | null> {
    const snap = await getDoc(doc(db, this.collectionName, templateId));
    if (!snap.exists()) return null;
    return this.fromDoc(snap.id, snap.data() as Record<string, unknown>);
  }

  async createTemplate(payload: CreateSuggestedChallengeTemplateInput): Promise<string> {
    const now = new Date().toISOString();
    const isPublished = payload.isPublished ?? false;
    const status: TemplateStatus = isPublished ? 'published' : 'draft';
    const result = await addDoc(collection(db, this.collectionName), stripUndefinedDeep({
      ...payload,
      category: payload.category ?? 'fitness',
      activityCount: payload.activities.length,
      status,
      isPublished,
      ...(isPublished ? { publishedAt: now } : {}),
      version: 1,
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
    }));
    return result.id;
  }

  async updateTemplate(templateId: string, actorUid: string, payload: UpdateTemplateInput): Promise<void> {
    const now = new Date().toISOString();
    const ref = doc(db, this.collectionName, templateId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error(`Template ${templateId} not found`);
    const existing = snap.data() as Record<string, unknown>;
    const nextVersion = Number(existing.version ?? 1) + 1;
    await updateDoc(ref, stripUndefinedDeep({
      ...payload,
      ...(payload.activities != null ? { activityCount: payload.activities.length } : {}),
      updatedAt: now,
      updatedBy: actorUid,
      version: nextVersion,
    }));
  }

  async publishTemplate(templateId: string, actorUid: string): Promise<void> {
    const now = new Date().toISOString();
    await updateDoc(doc(db, this.collectionName, templateId), {
      status: 'published',
      isPublished: true,
      publishedAt: now,
      updatedAt: now,
      updatedBy: actorUid,
    });
  }

  async unpublishTemplate(templateId: string, actorUid: string): Promise<void> {
    const now = new Date().toISOString();
    await updateDoc(doc(db, this.collectionName, templateId), {
      status: 'draft',
      isPublished: false,
      updatedAt: now,
      updatedBy: actorUid,
    });
  }

  async archiveTemplate(templateId: string, actorUid: string): Promise<void> {
    const now = new Date().toISOString();
    await updateDoc(doc(db, this.collectionName, templateId), {
      status: 'archived',
      isPublished: false,
      archivedAt: now,
      updatedAt: now,
      updatedBy: actorUid,
    });
  }

  async restoreTemplate(templateId: string, actorUid: string): Promise<void> {
    const now = new Date().toISOString();
    await updateDoc(doc(db, this.collectionName, templateId), {
      status: 'draft',
      isPublished: false,
      archivedAt: null,
      updatedAt: now,
      updatedBy: actorUid,
    });
  }

  // Soft delete — sets status to deleted. Document is retained in Firestore.
  async deleteTemplate(templateId: string, actorUid: string): Promise<void> {
    const now = new Date().toISOString();
    await updateDoc(doc(db, this.collectionName, templateId), {
      status: 'deleted',
      isPublished: false,
      updatedAt: now,
      updatedBy: actorUid,
    });
  }

  async duplicateTemplate(templateId: string, actorUid: string): Promise<string> {
    const source = await this.getTemplateById(templateId);
    if (!source) throw new Error(`Template ${templateId} not found`);
    const now = new Date().toISOString();
    const { id: _id, status: _status, isPublished: _pub, publishedAt: _pa, archivedAt: _aa, usageCount: _uc, createdAt: _ca, updatedAt: _ua, createdBy: _cb, updatedBy: _ub, ...rest } = source;
    const result = await addDoc(collection(db, this.collectionName), stripUndefinedDeep({
      ...rest,
      name: `${source.name} (Copy)`,
      status: 'draft',
      isPublished: false,
      version: 1,
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
      createdBy: actorUid,
      updatedBy: actorUid,
    }));
    return result.id;
  }

  async featureTemplate(templateId: string, actorUid: string): Promise<void> {
    const now = new Date().toISOString();
    await updateDoc(doc(db, this.collectionName, templateId), {
      isFeatured: true,
      featuredAt: now,
      featuredBy: actorUid,
      updatedAt: now,
      updatedBy: actorUid,
    });
  }

  async unfeatureTemplate(templateId: string, actorUid: string): Promise<void> {
    const now = new Date().toISOString();
    await updateDoc(doc(db, this.collectionName, templateId), {
      isFeatured: false,
      featuredAt: null,
      featuredBy: null,
      updatedAt: now,
      updatedBy: actorUid,
    });
  }

  async incrementUsageCount(templateId: string): Promise<void> {
    await updateDoc(doc(db, this.collectionName, templateId), {
      usageCount: Number((await getDoc(doc(db, this.collectionName, templateId))).data()?.usageCount ?? 0) + 1,
    });
  }
}

export const challengeTemplateService = new ChallengeTemplateService();
