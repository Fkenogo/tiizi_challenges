import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { CatalogExercise, Challenge } from '../types';

export type AdminExerciseInput = Omit<CatalogExercise, 'id'>;

export type AdminExerciseRow = CatalogExercise & {
  usageCount: number;
};

export type BulkImportResult = {
  validCount: number;
  importedCount: number;
  errors: string[];
};

const tier1Options = new Set(['Core', 'Upper Body', 'Lower Body', 'Full Body']);
const tier2Options = new Set(['Strength', 'Cardio', 'Balance', 'Mobility', 'Power']);
const difficultyOptions = new Set(['Beginner', 'Intermediate', 'Advanced']);

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);
}

class AdminExerciseService {
  private collectionName = 'catalogExercises';

  private validateInput(input: AdminExerciseInput): string[] {
    const errors: string[] = [];
    if (!input.name?.trim()) errors.push('Name is required.');
    if (!tier1Options.has(input.tier_1)) errors.push(`Invalid tier_1: ${input.tier_1}`);
    if (!tier2Options.has(input.tier_2)) errors.push(`Invalid tier_2: ${input.tier_2}`);
    if (!difficultyOptions.has(input.difficulty)) errors.push(`Invalid difficulty: ${input.difficulty}`);
    if (!input.metric?.type || !input.metric?.unit) errors.push('Metric type and unit are required.');
    if (!Array.isArray(input.setup) || input.setup.length === 0) errors.push('At least one setup instruction is required.');
    if (!Array.isArray(input.execution) || input.execution.length === 0) errors.push('At least one execution instruction is required.');
    if (!Array.isArray(input.formCues) || input.formCues.length === 0) errors.push('At least one form cue is required.');
    if (!Array.isArray(input.musclesTargeted) || input.musclesTargeted.length === 0) errors.push('At least one muscle target is required.');
    if (!Array.isArray(input.equipment) || input.equipment.length === 0) errors.push('At least one equipment value is required.');
    return errors;
  }

  async getExerciseById(id: string): Promise<CatalogExercise | null> {
    const snap = await getDoc(doc(db, this.collectionName, id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as Omit<CatalogExercise, 'id'>) };
  }

  async getAdminExercises(): Promise<AdminExerciseRow[]> {
    const [exerciseSnap, challengeSnap] = await Promise.all([
      getDocs(collection(db, this.collectionName)),
      getDocs(collection(db, 'challenges')),
    ]);

    const exercises = exerciseSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CatalogExercise, 'id'>) }));
    const challenges = challengeSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Challenge, 'id'>) }));
    const usageCountByExercise = new Map<string, number>();
    challenges.forEach((challenge) => {
      (challenge.exerciseIds ?? []).forEach((exerciseId) => {
        usageCountByExercise.set(exerciseId, (usageCountByExercise.get(exerciseId) ?? 0) + 1);
      });
    });

    return exercises.map((exercise) => ({
      ...exercise,
      usageCount: usageCountByExercise.get(exercise.id) ?? 0,
    }));
  }

  async createExercise(input: AdminExerciseInput): Promise<string> {
    const errors = this.validateInput(input);
    if (errors.length > 0) throw new Error(errors.join(' '));

    const idBase = slugify(input.name) || 'exercise';
    const existing = await getDocs(query(collection(db, this.collectionName)));
    const existingIds = new Set(existing.docs.map((d) => d.id));
    let candidate = idBase;
    let suffix = 1;
    while (existingIds.has(candidate)) {
      suffix += 1;
      candidate = `${idBase}-${suffix}`;
    }

    await setDoc(doc(db, this.collectionName, candidate), { ...input, id: candidate });
    return candidate;
  }

  async updateExercise(documentId: string, input: AdminExerciseInput): Promise<void> {
    const errors = this.validateInput(input);
    if (errors.length > 0) throw new Error(errors.join(' '));
    await updateDoc(doc(db, this.collectionName, documentId), { ...input });
  }

  async deleteExercise(documentId: string): Promise<void> {
    await deleteDoc(doc(db, this.collectionName, documentId));
  }

  validateBulkImport(input: unknown): { valid: AdminExerciseInput[]; errors: string[] } {
    if (!Array.isArray(input)) return { valid: [], errors: ['JSON must be an array of exercises.'] };
    const valid: AdminExerciseInput[] = [];
    const errors: string[] = [];
    input.forEach((item, idx) => {
      const candidate = item as AdminExerciseInput;
      const rowErrors = this.validateInput(candidate);
      if (rowErrors.length > 0) {
        errors.push(`Row ${idx + 1}: ${rowErrors.join(' ')}`);
      } else {
        valid.push(candidate);
      }
    });
    return { valid, errors };
  }

  async bulkImportExercises(exercises: AdminExerciseInput[]): Promise<BulkImportResult> {
    const errors: string[] = [];
    let importedCount = 0;
    for (let i = 0; i < exercises.length; i += 1) {
      try {
        await this.createExercise(exercises[i]);
        importedCount += 1;
      } catch (error) {
        errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    return {
      validCount: exercises.length,
      importedCount,
      errors,
    };
  }

  async getExerciseAdminStats(): Promise<{
    totalExercises: number;
    byTier1: Record<string, number>;
    byDifficulty: Record<string, number>;
    mostUsedInChallenges: Array<{ id: string; name: string; usageCount: number }>;
  }> {
    const rows = await this.getAdminExercises();
    const byTier1: Record<string, number> = {};
    const byDifficulty: Record<string, number> = {};
    rows.forEach((row) => {
      byTier1[row.tier_1] = (byTier1[row.tier_1] ?? 0) + 1;
      byDifficulty[row.difficulty] = (byDifficulty[row.difficulty] ?? 0) + 1;
    });
    const mostUsedInChallenges = [...rows]
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 10)
      .map((row) => ({ id: row.id, name: row.name, usageCount: row.usageCount }));
    return {
      totalExercises: rows.length,
      byTier1,
      byDifficulty,
      mostUsedInChallenges,
    };
  }
}

export const adminExerciseService = new AdminExerciseService();
