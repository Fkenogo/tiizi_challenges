import { addDoc, collection, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { WellnessTemplate } from '../types';

export type WellnessTemplateStatus = 'draft' | 'published' | 'archived' | 'deleted';
type WellnessDifficulty = WellnessTemplate['difficulty'] | 'all';
type WellnessCategory = WellnessTemplate['category'] | 'all';

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

function toDifficulty(value: unknown): WellnessTemplate['difficulty'] {
  const normalized = String(value ?? '').toLowerCase();
  if (normalized === 'intermediate' || normalized === 'advanced' || normalized === 'expert') return normalized;
  return 'beginner';
}

function toCategory(value: unknown): WellnessTemplate['category'] {
  const normalized = String(value ?? '').toLowerCase();
  if (
    normalized === 'fasting'
    || normalized === 'hydration'
    || normalized === 'sleep'
    || normalized === 'mindfulness'
    || normalized === 'nutrition'
    || normalized === 'habits'
    || normalized === 'stress'
    || normalized === 'social'
    || normalized === 'movement'
    || normalized === 'health-monitoring'
  ) {
    return normalized;
  }
  return 'habits';
}

// Derive lifecycle status from isPublished for documents without an explicit status field.
function deriveStatus(data: Record<string, unknown>): WellnessTemplateStatus {
  if (data.status === 'draft' || data.status === 'published' || data.status === 'archived' || data.status === 'deleted') {
    return data.status as WellnessTemplateStatus;
  }
  return data.isPublished !== false ? 'published' : 'draft';
}

function fromDoc(id: string, raw: Record<string, unknown>): WellnessTemplate {
  const activities = Array.isArray(raw.activities)
    ? raw.activities.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    : [];
  const activityBenefits = activities.flatMap((item) => (Array.isArray(item.benefits) ? item.benefits.map((line) => String(line)) : []));
  const activityGuidelines = activities.flatMap((item) => (Array.isArray(item.guidelines) ? item.guidelines.map((line) => String(line)) : []));
  const activityWarnings = activities.flatMap((item) => (Array.isArray(item.warnings) ? item.warnings.map((line) => String(line)) : []));
  const templateBenefits = Array.isArray(raw.benefits) ? raw.benefits.map((item) => String(item)) : [];
  const templateGuidelines = Array.isArray(raw.guidelines) ? raw.guidelines.map((item) => String(item)) : [];
  const templateWarnings = Array.isArray(raw.warnings) ? raw.warnings.map((item) => String(item)) : [];
  const status = deriveStatus(raw);

  return {
    id,
    category: toCategory(raw.category),
    name: String(raw.name ?? 'Wellness challenge'),
    description: String(raw.description ?? ''),
    difficulty: toDifficulty(raw.difficulty),
    type: (raw.type as WellnessTemplate['type']) ?? 'streak',
    duration: Number(raw.duration ?? 21),
    coverImage: raw.coverImage ? String(raw.coverImage) : undefined,
    icon: raw.icon ? String(raw.icon) : undefined,
    color: raw.color ? String(raw.color) : undefined,
    activities: activities.map((item, index) => ({
      activityId: String(item.activityId ?? `activity-${index + 1}`),
      order: Number(item.order ?? index + 1),
      activityType: String(item.activityType ?? 'wellness'),
      name: String(item.name ?? 'Activity'),
      description: item.description ? String(item.description) : undefined,
      category: item.category ? String(item.category) : undefined,
      difficulty: item.difficulty ? String(item.difficulty) : undefined,
      icon: item.icon ? String(item.icon) : undefined,
      instructions: Array.isArray(item.instructions) ? item.instructions.map((line) => String(line)) : undefined,
      protocolSteps: Array.isArray(item.protocolSteps) ? item.protocolSteps.map((line) => String(line)) : undefined,
      benefits: Array.isArray(item.benefits) ? item.benefits.map((line) => String(line)) : undefined,
      guidelines: Array.isArray(item.guidelines) ? item.guidelines.map((line) => String(line)) : undefined,
      warnings: Array.isArray(item.warnings) ? item.warnings.map((line) => String(line)) : undefined,
      metricUnit: String(item.metricUnit ?? 'count'),
      targetValue: Number(item.targetValue ?? 1),
      targetType: item.targetType === 'daily' || item.targetType === 'cumulative' ? item.targetType : undefined,
      frequency: (item.frequency ? String(item.frequency) : 'daily') as WellnessTemplate['activities'][number]['frequency'],
      dailyFrequency: Number(item.dailyFrequency ?? 1),
      pointsPerCompletion: Number(item.pointsPerCompletion ?? 10),
    })),
    benefits: templateBenefits.length > 0 ? templateBenefits : Array.from(new Set(activityBenefits)),
    guidelines: templateGuidelines.length > 0 ? templateGuidelines : Array.from(new Set(activityGuidelines)),
    warnings: templateWarnings.length > 0 ? templateWarnings : Array.from(new Set(activityWarnings)),
    isPublished: status === 'published',
    isFeatured: raw.isFeatured === true,
    featuredAt: raw.featuredAt ? String(raw.featuredAt) : undefined,
    featuredBy: raw.featuredBy ? String(raw.featuredBy) : undefined,
    // Engine-specific fields
    groupCumulativeTarget: raw.groupCumulativeTarget != null ? Number(raw.groupCumulativeTarget) : undefined,
    autoCompleteOnGroupTarget: raw.autoCompleteOnGroupTarget != null ? Boolean(raw.autoCompleteOnGroupTarget) : undefined,
    requiredConsecutiveDays: raw.requiredConsecutiveDays != null ? Number(raw.requiredConsecutiveDays) : undefined,
    streakResetOnMiss: raw.streakResetOnMiss != null ? Boolean(raw.streakResetOnMiss) : undefined,
    // Lifecycle fields
    status,
    version: Number(raw.version ?? 1),
    usageCount: Number(raw.usageCount ?? 0),
    createdAt: raw.createdAt ? String(raw.createdAt) : undefined,
    updatedAt: raw.updatedAt ? String(raw.updatedAt) : undefined,
    publishedAt: raw.publishedAt ? String(raw.publishedAt) : undefined,
    archivedAt: raw.archivedAt ? String(raw.archivedAt) : undefined,
    createdBy: raw.createdBy ? String(raw.createdBy) : undefined,
    updatedBy: raw.updatedBy ? String(raw.updatedBy) : undefined,
  };
}

function isFirestoreReadError(error: unknown): boolean {
  const code = String((error as { code?: string } | null)?.code ?? '');
  return (
    code.includes('permission-denied')
    || code.includes('unauthenticated')
    || code.includes('failed-precondition')
    || code.includes('unavailable')
  );
}

export type CreateWellnessTemplateInput = Omit<WellnessTemplate, 'id' | 'status' | 'version' | 'usageCount' | 'createdAt' | 'updatedAt' | 'publishedAt' | 'archivedAt' | 'updatedBy'>;
export type UpdateWellnessTemplateInput = Partial<CreateWellnessTemplateInput>;

class WellnessTemplateService {
  private readonly collectionName = 'wellnessTemplates';

  // User-facing: published templates only, sourced from admin.
  async getTemplates(filters?: { category?: WellnessCategory; difficulty?: WellnessDifficulty }): Promise<WellnessTemplate[]> {
    const applyFilters = (templates: WellnessTemplate[]) =>
      templates
        .filter((item) => item.status === 'published')
        .filter((item) => (filters?.category && filters.category !== 'all' ? item.category === filters.category : true))
        .filter((item) => (filters?.difficulty && filters.difficulty !== 'all' ? item.difficulty === filters.difficulty : true))
        .sort((a, b) => {
          if (a.isFeatured && !b.isFeatured) return -1;
          if (!a.isFeatured && b.isFeatured) return 1;
          return a.name.localeCompare(b.name);
        });

    try {
      const snap = await getDocs(collection(db, this.collectionName));
      const templates: WellnessTemplate[] = [];
      for (const item of snap.docs) {
        try {
          const raw = item.data() as Record<string, unknown>;
          if (String(raw.templateSource ?? '') !== 'admin') continue;
          templates.push(fromDoc(item.id, raw));
        } catch (parseError) {
          console.warn(`Skipping invalid wellness template doc: ${item.id}`, parseError);
        }
      }
      if (templates.length > 0) return applyFilters(templates);
    } catch (error) {
      if (!isFirestoreReadError(error)) {
        console.warn('Wellness templates read failed.', error);
      } else {
        console.warn('Wellness templates Firestore read failed.', error);
      }
    }
    return [];
  }

  // Admin: all non-deleted templates.
  async getAllTemplatesAdmin(): Promise<WellnessTemplate[]> {
    const snap = await getDocs(collection(db, this.collectionName));
    return snap.docs
      .map((item) => {
        try {
          const raw = item.data() as Record<string, unknown>;
          if (String(raw.templateSource ?? '') !== 'admin') return null;
          return fromDoc(item.id, raw);
        } catch {
          return null;
        }
      })
      .filter((item): item is WellnessTemplate => item !== null && item.status !== 'deleted')
      .sort((a, b) => (b.updatedAt ?? b.createdAt ?? '').localeCompare(a.updatedAt ?? a.createdAt ?? ''));
  }

  async getTemplateById(templateId: string): Promise<WellnessTemplate | null> {
    try {
      const snap = await getDoc(doc(db, this.collectionName, templateId));
      if (!snap.exists()) return null;
      const raw = snap.data() as Record<string, unknown>;
      if (String(raw.templateSource ?? '') !== 'admin') return null;
      try {
        const template = fromDoc(snap.id, raw);
        if (template.status === 'deleted') return null;
        return template;
      } catch (parseError) {
        console.warn(`Invalid wellness template payload for ${templateId}.`, parseError);
        return null;
      }
    } catch (error) {
      if (!isFirestoreReadError(error)) {
        console.warn('Wellness template detail read failed.', error);
      } else {
        console.warn('Wellness template detail Firestore read failed.', error);
      }
      return null;
    }
  }

  async createTemplate(payload: CreateWellnessTemplateInput): Promise<string> {
    const now = new Date().toISOString();
    const isPublished = payload.isPublished ?? false;
    const status: WellnessTemplateStatus = isPublished ? 'published' : 'draft';
    const result = await addDoc(collection(db, this.collectionName), stripUndefinedDeep({
      ...payload,
      templateSource: 'admin',
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

  async updateTemplate(templateId: string, actorUid: string, payload: UpdateWellnessTemplateInput): Promise<void> {
    const now = new Date().toISOString();
    const ref = doc(db, this.collectionName, templateId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error(`Wellness template ${templateId} not found`);
    const existing = snap.data() as Record<string, unknown>;
    const nextVersion = Number(existing.version ?? 1) + 1;
    await updateDoc(ref, stripUndefinedDeep({
      ...payload,
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

  // Soft delete — document retained, status set to deleted.
  async deleteTemplate(templateId: string, actorUid: string): Promise<void> {
    const now = new Date().toISOString();
    await updateDoc(doc(db, this.collectionName, templateId), {
      status: 'deleted',
      isPublished: false,
      updatedAt: now,
      updatedBy: actorUid,
    });
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

  async duplicateTemplate(templateId: string, actorUid: string): Promise<string> {
    const source = await this.getTemplateById(templateId);
    if (!source) throw new Error(`Wellness template ${templateId} not found`);
    const now = new Date().toISOString();
    const { id: _id, status: _s, isPublished: _p, publishedAt: _pa, archivedAt: _aa, usageCount: _uc, createdAt: _ca, updatedAt: _ua, createdBy: _cb, updatedBy: _ub, version: _v, ...rest } = source;
    const result = await addDoc(collection(db, this.collectionName), stripUndefinedDeep({
      ...rest,
      name: `${source.name} (Copy)`,
      templateSource: 'admin',
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

  async incrementUsageCount(templateId: string): Promise<void> {
    const snap = await getDoc(doc(db, this.collectionName, templateId));
    await updateDoc(doc(db, this.collectionName, templateId), {
      usageCount: Number(snap.data()?.usageCount ?? 0) + 1,
    });
  }
}

export const wellnessTemplateService = new WellnessTemplateService();
export type { WellnessDifficulty, WellnessCategory };
