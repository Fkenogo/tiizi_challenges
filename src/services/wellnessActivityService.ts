import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { WELLNESS_ACTIVITIES_CATALOG } from '../data/wellnessActivitiesCatalog';
import { db } from '../lib/firebase';
import type { WellnessActivity, WellnessCategory } from '../types/wellnessActivity';

function isFirestoreReadError(error: unknown): boolean {
  const code = String((error as { code?: string } | null)?.code ?? '');
  return (
    code.includes('permission-denied')
    || code.includes('failed-precondition')
    || code.includes('unavailable')
    || code.includes('unauthenticated')
  );
}

function fromDoc(id: string, raw: Record<string, unknown>): WellnessActivity {
  return {
    id,
    category: String(raw.category ?? 'habits') as WellnessCategory,
    name: String(raw.name ?? 'Wellness Activity'),
    shortName: String(raw.shortName ?? raw.name ?? 'Activity'),
    description: String(raw.description ?? ''),
    difficulty: String(raw.difficulty ?? 'beginner') as WellnessActivity['difficulty'],
    icon: String(raw.icon ?? '✨'),
    coverImage: raw.coverImage ? String(raw.coverImage) : undefined,
    activityType: String(raw.activityType ?? 'habit') as WellnessActivity['activityType'],
    defaultMetricUnit: String(raw.defaultMetricUnit ?? 'count'),
    defaultTargetValue: Number(raw.defaultTargetValue ?? 1),
    suggestedFrequency: Number(raw.suggestedFrequency ?? 1),
    protocolSteps: Array.isArray(raw.protocolSteps) ? raw.protocolSteps.map((step) => String(step)) : [],
    fastingProtocol: raw.fastingProtocol as WellnessActivity['fastingProtocol'],
    hydrationProtocol: raw.hydrationProtocol as WellnessActivity['hydrationProtocol'],
    sleepProtocol: raw.sleepProtocol as WellnessActivity['sleepProtocol'],
    benefits: Array.isArray(raw.benefits) ? raw.benefits.map((item) => String(item)) : [],
    benefitsTimeline: raw.benefitsTimeline as WellnessActivity['benefitsTimeline'],
    guidelines: Array.isArray(raw.guidelines) ? raw.guidelines.map((item) => String(item)) : [],
    warnings: Array.isArray(raw.warnings) ? raw.warnings.map((item) => String(item)) : undefined,
    contraindications: Array.isArray(raw.contraindications) ? raw.contraindications.map((item) => String(item)) : undefined,
    bodyResponse: raw.bodyResponse as WellnessActivity['bodyResponse'],
    defaultPoints: Number(raw.defaultPoints ?? 10),
    bonusConditions: Array.isArray(raw.bonusConditions)
      ? raw.bonusConditions.map((item) => ({
        condition: String((item as { condition?: string }).condition ?? ''),
        points: Number((item as { points?: number }).points ?? 0),
      }))
      : [],
    popular: Boolean(raw.popular ?? false),
    medicalSupervisionRequired: Boolean(raw.medicalSupervisionRequired ?? false),
    prerequisite: raw.prerequisite ? String(raw.prerequisite) : undefined,
    tags: Array.isArray(raw.tags) ? raw.tags.map((item) => String(item)) : [],
    createdAt: raw.createdAt ? String(raw.createdAt) : undefined,
    updatedAt: raw.updatedAt ? String(raw.updatedAt) : undefined,
  };
}

class WellnessActivityService {
  private readonly collectionName = 'wellnessActivities';

  private async fromFirestore(): Promise<WellnessActivity[]> {
    const snapshot = await getDocs(collection(db, this.collectionName));
    return snapshot.docs.map((item) => fromDoc(item.id, item.data() as Record<string, unknown>));
  }

  private fallbackCatalog(): WellnessActivity[] {
    return [...WELLNESS_ACTIVITIES_CATALOG];
  }

  async getAllActivities(): Promise<WellnessActivity[]> {
    try {
      const items = await this.fromFirestore();
      if (items.length > 0) {
        return items.sort((a, b) => a.name.localeCompare(b.name));
      }
    } catch (error) {
      if (!isFirestoreReadError(error)) throw error;
      console.warn('wellnessActivities read failed, using local catalog fallback.', error);
    }
    return this.fallbackCatalog().sort((a, b) => a.name.localeCompare(b.name));
  }

  async getActivitiesByCategory(category: WellnessCategory): Promise<WellnessActivity[]> {
    const all = await this.getAllActivities();
    return all.filter((item) => item.category === category);
  }

  async searchActivities(searchTerm: string): Promise<WellnessActivity[]> {
    const term = searchTerm.trim().toLowerCase();
    const all = await this.getAllActivities();
    if (!term) return all;
    return all.filter((item) =>
      item.name.toLowerCase().includes(term)
      || item.description.toLowerCase().includes(term)
      || item.shortName.toLowerCase().includes(term)
      || item.tags.some((tag) => tag.toLowerCase().includes(term)));
  }

  async getPopularActivities(maxResults = 12): Promise<WellnessActivity[]> {
    const all = await this.getAllActivities();
    return all.filter((item) => item.popular).slice(0, maxResults);
  }

  async getActivityById(id: string): Promise<WellnessActivity | null> {
    try {
      const snapshot = await getDoc(doc(db, this.collectionName, id));
      if (snapshot.exists()) {
        return fromDoc(snapshot.id, snapshot.data() as Record<string, unknown>);
      }
    } catch (error) {
      if (!isFirestoreReadError(error)) throw error;
      console.warn('wellness activity detail read failed, using fallback.', error);
    }
    return this.fallbackCatalog().find((item) => item.id === id) ?? null;
  }
}

export const wellnessActivityService = new WellnessActivityService();

