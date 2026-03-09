import { addDoc, collection, getDoc, getDocs, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { WellnessTemplate } from '../types';

type WellnessDifficulty = WellnessTemplate['difficulty'] | 'all';
type WellnessCategory = WellnessTemplate['category'] | 'all';
type WellnessFrequency = 'daily' | 'weekly' | '3x-week' | 'custom';

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
  ) {
    return normalized;
  }
  return 'habits';
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
      frequency: (item.frequency ? String(item.frequency) : 'daily') as WellnessFrequency,
      dailyFrequency: Number(item.dailyFrequency ?? 1),
      pointsPerCompletion: Number(item.pointsPerCompletion ?? 10),
    })),
    benefits: templateBenefits.length > 0 ? templateBenefits : Array.from(new Set(activityBenefits)),
    guidelines: templateGuidelines.length > 0 ? templateGuidelines : Array.from(new Set(activityGuidelines)),
    warnings: templateWarnings.length > 0 ? templateWarnings : Array.from(new Set(activityWarnings)),
    isPublished: raw.isPublished !== false,
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

class WellnessTemplateService {
  private readonly collectionName = 'wellnessTemplates';

  async getTemplates(filters?: { category?: WellnessCategory; difficulty?: WellnessDifficulty }): Promise<WellnessTemplate[]> {
    const applyFilters = (templates: WellnessTemplate[]) =>
      templates
        .filter((item) => item.isPublished !== false)
        .filter((item) => (filters?.category && filters.category !== 'all' ? item.category === filters.category : true))
        .filter((item) => (filters?.difficulty && filters.difficulty !== 'all' ? item.difficulty === filters.difficulty : true))
        .sort((a, b) => a.name.localeCompare(b.name));

    try {
      const ref = collection(db, this.collectionName);
      const snap = await getDocs(ref);
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
        console.warn('Wellness templates read failed for non-Firestore reason. Falling back to local seeded templates.', error);
      } else {
        console.warn('Wellness templates Firestore read failed. Falling back to local seeded templates.', error);
      }
    }

    return [];
  }

  async getTemplateById(templateId: string): Promise<WellnessTemplate | null> {
    try {
      const snap = await getDoc(doc(db, this.collectionName, templateId));
      if (!snap.exists()) return null;
      const raw = snap.data() as Record<string, unknown>;
      if (String(raw.templateSource ?? '') !== 'admin') return null;
      let template: WellnessTemplate;
      try {
        template = fromDoc(snap.id, raw);
      } catch (parseError) {
        console.warn(`Invalid wellness template payload for ${templateId}.`, parseError);
        return null;
      }
      if (template.isPublished === false) return null;
      return template;
    } catch (error) {
      if (!isFirestoreReadError(error)) {
        console.warn('Wellness template detail read failed for non-Firestore reason. Falling back to local seed.', error);
      } else {
        console.warn('Wellness template detail Firestore read failed. Falling back to local seed.', error);
      }
      return null;
    }
  }

  async createTemplate(payload: Omit<WellnessTemplate, 'id'>): Promise<string> {
    const createdAt = new Date().toISOString();
    const result = await addDoc(collection(db, this.collectionName), stripUndefinedDeep({
      ...payload,
      templateSource: 'admin',
      isPublished: payload.isPublished ?? true,
      createdAt,
      updatedAt: createdAt,
    }));
    return result.id;
  }
}

export const wellnessTemplateService = new WellnessTemplateService();
export type { WellnessDifficulty, WellnessCategory };
