import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { WellnessActivity, WellnessCategory, WellnessDifficulty, WellnessActivityType } from '../types/wellnessActivity';

export type AdminWellnessActivityInput = Omit<WellnessActivity, 'id' | 'createdAt' | 'updatedAt'>;

const categoryOptions = new Set<WellnessCategory>([
  'fasting',
  'hydration',
  'sleep',
  'mindfulness',
  'nutrition',
  'habits',
  'stress',
  'social',
]);

const difficultyOptions = new Set<WellnessDifficulty>(['beginner', 'intermediate', 'advanced', 'expert']);
const activityTypeOptions = new Set<WellnessActivityType>(['fasting', 'water', 'sleep', 'meditation', 'food', 'habit', 'breathing', 'social']);

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);
}

class AdminWellnessActivityService {
  private collectionName = 'wellnessActivities';

  private validateInput(input: AdminWellnessActivityInput): string[] {
    const errors: string[] = [];
    if (!input.name?.trim()) errors.push('Name is required.');
    if (!categoryOptions.has(input.category)) errors.push(`Invalid category: ${input.category}`);
    if (!difficultyOptions.has(input.difficulty)) errors.push(`Invalid difficulty: ${input.difficulty}`);
    if (!activityTypeOptions.has(input.activityType)) errors.push(`Invalid activity type: ${input.activityType}`);
    if (!input.defaultMetricUnit?.trim()) errors.push('Metric unit is required.');
    if (!Number.isFinite(input.defaultTargetValue) || input.defaultTargetValue < 0) errors.push('Default target value must be >= 0.');
    if (!Number.isFinite(input.suggestedFrequency) || input.suggestedFrequency < 1) errors.push('Suggested frequency must be >= 1.');
    if (!Array.isArray(input.benefits) || input.benefits.length === 0) errors.push('Add at least one benefit.');
    if (!Array.isArray(input.guidelines) || input.guidelines.length === 0) errors.push('Add at least one guideline.');
    return errors;
  }

  async getActivityById(id: string): Promise<WellnessActivity | null> {
    const snap = await getDoc(doc(db, this.collectionName, id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as Omit<WellnessActivity, 'id'>) };
  }

  async getAdminWellnessActivities(): Promise<WellnessActivity[]> {
    const snap = await getDocs(query(collection(db, this.collectionName)));
    return snap.docs
      .map((item) => ({ id: item.id, ...(item.data() as Omit<WellnessActivity, 'id'>) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async createActivity(input: AdminWellnessActivityInput): Promise<string> {
    const errors = this.validateInput(input);
    if (errors.length > 0) throw new Error(errors.join(' '));

    const idBase = slugify(input.name) || 'wellness-activity';
    const existing = await getDocs(query(collection(db, this.collectionName)));
    const existingIds = new Set(existing.docs.map((item) => item.id));
    let candidate = idBase;
    let suffix = 1;
    while (existingIds.has(candidate)) {
      suffix += 1;
      candidate = `${idBase}-${suffix}`;
    }

    const payload = { ...input, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await setDoc(doc(db, this.collectionName, candidate), payload);
    return candidate;
  }

  async updateActivity(documentId: string, input: AdminWellnessActivityInput): Promise<void> {
    const errors = this.validateInput(input);
    if (errors.length > 0) throw new Error(errors.join(' '));
    await updateDoc(doc(db, this.collectionName, documentId), { ...input, updatedAt: new Date().toISOString() });
  }

  async deleteActivity(documentId: string): Promise<void> {
    await deleteDoc(doc(db, this.collectionName, documentId));
  }
}

export const adminWellnessActivityService = new AdminWellnessActivityService();
