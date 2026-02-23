import { db } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc,
  QueryConstraint 
} from 'firebase/firestore';
import { CatalogExercise } from '../types';
import catalogExercisesSource from '../../catalogExercises_CLEAN.json';

/**
 * Exercise Service - Single source of truth for exercise data
 * All exercise queries go through this service
 * 
 * Benefits:
 * - Centralized data access
 * - Consistent error handling
 * - Data validation
 * - Easy to test and mock
 * - Caching optimization
 * 
 * @example
 * import { exerciseService } from './services/exerciseService';
 * 
 * // Get all exercises
 * const exercises = await exerciseService.getExercises();
 * 
 * // Get filtered exercises
 * const coreExercises = await exerciseService.getExercises({ tier1: 'Core' });
 * 
 * // Get single exercise
 * const pushUps = await exerciseService.getExerciseById('push-ups');
 */
class ExerciseService {
  private collectionName = 'catalogExercises';
  private fallbackCollections = ['exercises', 'catalog_exercises'];

  private titleCaseFromId(value: string): string {
    return value
      .replace(/[-_]+/g, ' ')
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  private normalizeExercise(raw: any, docId: string): CatalogExercise {
    const musclesTargeted = Array.isArray(raw?.musclesTargeted)
      ? raw.musclesTargeted
      : Array.isArray(raw?.muscles)
      ? raw.muscles
      : [];

    const equipment = Array.isArray(raw?.equipment)
      ? raw.equipment
      : Array.isArray(raw?.equipmentRequired)
      ? raw.equipmentRequired
      : [];

    const metricType = raw?.metric?.type ?? raw?.metricType ?? 'reps';
    const metricUnit = raw?.metric?.unit ?? raw?.metricUnit ?? 'Reps';
    const allowCustomUnit = Boolean(raw?.metric?.allowCustomUnit ?? false);

    const derivedName =
      raw?.name ??
      raw?.exerciseName ??
      raw?.title ??
      this.titleCaseFromId(String(raw?.id ?? docId));

    return {
      id: String(raw?.id ?? docId),
      name: String(derivedName ?? '').trim(),
      tier_1: String(raw?.tier_1 ?? raw?.tier1 ?? 'General'),
      tier_2: String(raw?.tier_2 ?? raw?.tier2 ?? 'General'),
      difficulty: String(raw?.difficulty ?? 'Beginner'),
      musclesTargeted: musclesTargeted.map((item: unknown) => String(item)),
      equipment: equipment.map((item: unknown) => String(item)),
      trainingGoals: Array.isArray(raw?.trainingGoals) ? raw.trainingGoals.map((item: unknown) => String(item)) : [],
      metric: {
        type: String(metricType),
        unit: String(metricUnit),
        allowCustomUnit,
      },
      description: String(raw?.description ?? ''),
      setup: Array.isArray(raw?.setup) ? raw.setup.map((item: unknown) => String(item)) : [],
      execution: Array.isArray(raw?.execution) ? raw.execution.map((item: unknown) => String(item)) : [],
      breathing: Array.isArray(raw?.breathing)
        ? raw.breathing.map((item: unknown) => String(item))
        : typeof raw?.breathing === 'object' && raw?.breathing
        ? Object.values(raw.breathing).map((item: unknown) => String(item))
        : [],
      formCues: Array.isArray(raw?.formCues) ? raw.formCues.map((item: unknown) => String(item)) : [],
      commonMistakes: Array.isArray(raw?.commonMistakes) ? raw.commonMistakes.map((item: unknown) => String(item)) : [],
      progressions: Array.isArray(raw?.progressions) ? raw.progressions.map((item: unknown) => String(item)) : [],
      advancedVariations: Array.isArray(raw?.advancedVariations) ? raw.advancedVariations.map((item: unknown) => String(item)) : [],
      safetyNotes: Array.isArray(raw?.safetyNotes) ? raw.safetyNotes.map((item: unknown) => String(item)) : [],
      recommendedVolume: {
        beginner: String(raw?.recommendedVolume?.beginner ?? ''),
        intermediate: String(raw?.recommendedVolume?.intermediate ?? ''),
        advanced: String(raw?.recommendedVolume?.advanced ?? ''),
      },
    };
  }

  private getBundledCatalogExercises(): CatalogExercise[] {
    const rows = Array.isArray((catalogExercisesSource as { documents?: unknown[] })?.documents)
      ? ((catalogExercisesSource as { documents: unknown[] }).documents as Record<string, unknown>[])
      : [];
    return rows
      .map((row) => this.normalizeExercise(row, String((row as { id?: string }).id ?? '')))
      .filter((ex) => this.validateExercise(ex));
  }
  
  /**
   * Validate exercise data against schema
   * Ensures all fetched exercises match TypeScript interface
   * 
   * @param data - Exercise data from Firestore
   * @returns boolean - true if valid
   */
  private validateExercise(data: any): data is CatalogExercise {
    if (!data?.id) {
      console.warn('Invalid exercise data:', data?.id, 'Missing id');
      return false;
    }

    // Validate metric structure
    if (!data.metric?.type || !data.metric?.unit) {
      console.warn('Invalid metric structure:', data?.id);
      return false;
    }

    return true;
  }
  
  /**
   * Get all exercises with optional filters
   * 
   * @param filters - Optional filters for tier_1, tier_2, difficulty
   * @returns Promise<CatalogExercise[]>
   * 
   * @example
   * // All exercises
   * const all = await exerciseService.getExercises();
   * 
   * // Core exercises only
   * const core = await exerciseService.getExercises({ tier1: 'Core' });
   * 
   * // Beginner core strength exercises
   * const filtered = await exerciseService.getExercises({
   *   tier1: 'Core',
   *   tier2: 'Strength',
   *   difficulty: 'Beginner'
   * });
   */
  async getExercises(filters?: {
    tier1?: string;
    tier2?: string;
    difficulty?: string;
  }): Promise<CatalogExercise[]> {
    try {
      const constraints: QueryConstraint[] = [];

      if (filters?.tier1 && filters.tier1 !== 'All') constraints.push(where('tier_1', '==', filters.tier1));
      if (filters?.tier2 && filters.tier2 !== 'All') constraints.push(where('tier_2', '==', filters.tier2));
      if (filters?.difficulty && filters.difficulty !== 'All') constraints.push(where('difficulty', '==', filters.difficulty));

      const fetchCollection = async (collectionName: string) => {
        const q = constraints.length > 0
          ? query(collection(db, collectionName), ...constraints)
          : collection(db, collectionName);
        const snapshot = await getDocs(q);
        return snapshot.docs
          .map((item) => this.normalizeExercise(item.data(), item.id))
          .filter((ex) => this.validateExercise(ex));
      };

      let exercises = await fetchCollection(this.collectionName);
      if (exercises.length === 0) {
        for (const fallback of this.fallbackCollections) {
          const fallbackRows = await fetchCollection(fallback);
          if (fallbackRows.length > 0) {
            exercises = fallbackRows;
            break;
          }
        }
      }
      
      if (exercises.length === 0) {
        exercises = this.getBundledCatalogExercises();
      }

      const filteredExercises = exercises.filter((exercise) => {
        const tier1Match = !filters?.tier1 || filters.tier1 === 'All' || exercise.tier_1 === filters.tier1;
        const tier2Match = !filters?.tier2 || filters.tier2 === 'All' || exercise.tier_2 === filters.tier2;
        const difficultyMatch =
          !filters?.difficulty || filters.difficulty === 'All' || exercise.difficulty === filters.difficulty;
        return tier1Match && tier2Match && difficultyMatch;
      });

      // Sort by name for consistent ordering
      return filteredExercises.sort((a, b) => a.name.localeCompare(b.name));
      
    } catch (error) {
      console.error('Error fetching exercises:', error);
      const fallbackRows = this.getBundledCatalogExercises();
      if (fallbackRows.length > 0) {
        return fallbackRows.sort((a, b) => a.name.localeCompare(b.name));
      }
      throw new Error(`Failed to fetch exercises: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Get single exercise by ID
   * 
   * @param id - Exercise ID (slug format, e.g., 'push-ups')
   * @returns Promise<CatalogExercise | null>
   * 
   * @example
   * const exercise = await exerciseService.getExerciseById('push-ups');
   * if (exercise) {
   *   console.log(exercise.name); // "Push-Ups"
   * }
   */
  async getExerciseById(id: string): Promise<CatalogExercise | null> {
    try {
      const collectionNames = [this.collectionName, ...this.fallbackCollections];
      for (const collectionName of collectionNames) {
        const snapshot = await getDoc(doc(db, collectionName, id));
        if (snapshot.exists()) {
          const data = this.normalizeExercise(snapshot.data(), snapshot.id);
          return this.validateExercise(data) ? data : null;
        }
      }

      const bundledMatch = this
        .getBundledCatalogExercises()
        .find((exercise) => exercise.id === id || this.normalizeSearchKey(exercise.name) === this.normalizeSearchKey(id));
      if (bundledMatch) {
        return bundledMatch;
      }

      console.warn('Exercise not found:', id);
      return null;
      
    } catch (error) {
      console.error('Error fetching exercise:', id, error);
      return null;
    }
  }

  private normalizeSearchKey(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]/g, '');
  }
  
  /**
   * Get exercises by IDs (batch fetch)
   * Used in challenge creation to snapshot exercise data
   * 
   * @param ids - Array of exercise IDs
   * @returns Promise<CatalogExercise[]>
   * 
   * @example
   * const ids = ['push-ups', 'squats', 'plank'];
   * const exercises = await exerciseService.getExercisesByIds(ids);
   * console.log(exercises.length); // 3 (if all found)
   */
  async getExercisesByIds(ids: string[]): Promise<CatalogExercise[]> {
    try {
      if (ids.length === 0) return [];
      
      // Fetch all exercises in parallel
      const promises = ids.map(id => this.getExerciseById(id));
      const results = await Promise.all(promises);
      
      // Filter out nulls (exercises not found or invalid)
      return results.filter((ex): ex is CatalogExercise => ex !== null);
      
    } catch (error) {
      console.error('Error fetching exercises by IDs:', error);
      return [];
    }
  }
  
  /**
   * Search exercises by name or tags
   * Client-side search (Firestore doesn't support full-text search)
   * 
   * @param searchTerm - Search query
   * @returns Promise<CatalogExercise[]>
   * 
   * @example
   * const results = await exerciseService.searchExercises('push');
   * // Returns: Push-Ups, Push-Up Hold, Modified Push-Up, etc.
   */
  async searchExercises(searchTerm: string): Promise<CatalogExercise[]> {
    try {
      if (searchTerm.length < 2) {
        return [];
      }
      
      // Fetch all exercises (cached by React Query)
      const allExercises = await this.getExercises();
      const term = searchTerm.toLowerCase();
      
      // Client-side fuzzy search
      return allExercises.filter(ex => 
        ex.name.toLowerCase().includes(term) ||
        ex.tier_1.toLowerCase().includes(term) ||
        ex.tier_2.toLowerCase().includes(term) ||
        ex.musclesTargeted.some(muscle => muscle.toLowerCase().includes(term)) ||
        ex.equipment.some(eq => eq.toLowerCase().includes(term))
      );
      
    } catch (error) {
      console.error('Error searching exercises:', error);
      return [];
    }
  }
  
  /**
   * Get exercise statistics
   * Used for analytics and admin dashboard
   * 
   * @returns Promise with distribution stats
   * 
   * @example
   * const stats = await exerciseService.getExerciseStats();
   * console.log(stats.total); // 113
   * console.log(stats.byTier1); // { Core: 58, 'Upper Body': 11, ... }
   */
  async getExerciseStats(): Promise<{
    total: number;
    byTier1: Record<string, number>;
    byTier2: Record<string, number>;
    byDifficulty: Record<string, number>;
    byEquipment: Record<string, number>;
  }> {
    try {
      const exercises = await this.getExercises();
      
      const stats = {
        total: exercises.length,
        byTier1: {} as Record<string, number>,
        byTier2: {} as Record<string, number>,
        byDifficulty: {} as Record<string, number>,
        byEquipment: {} as Record<string, number>
      };
      
      exercises.forEach(ex => {
        // Count tier_1 distribution
        stats.byTier1[ex.tier_1] = (stats.byTier1[ex.tier_1] || 0) + 1;
        
        // Count tier_2 distribution
        stats.byTier2[ex.tier_2] = (stats.byTier2[ex.tier_2] || 0) + 1;
        
        // Count difficulty distribution
        stats.byDifficulty[ex.difficulty] = (stats.byDifficulty[ex.difficulty] || 0) + 1;
        
        // Count equipment usage
        ex.equipment.forEach(eq => {
          stats.byEquipment[eq] = (stats.byEquipment[eq] || 0) + 1;
        });
      });
      
      return stats;
      
    } catch (error) {
      console.error('Error getting exercise stats:', error);
      throw error;
    }
  }
  
  /**
   * Get filter options for UI
   * Returns available values for each filter dimension
   * 
   * @returns Promise with filter options
   * 
   * @example
   * const options = await exerciseService.getFilterOptions();
   * console.log(options.tier1); // ['Core', 'Upper Body', 'Lower Body', 'Full Body']
   */
  async getFilterOptions(): Promise<{
    tier1: string[];
    tier2: string[];
    difficulty: string[];
    equipment: string[];
  }> {
    try {
      const exercises = await this.getExercises();
      
      const tier1Set = new Set<string>();
      const tier2Set = new Set<string>();
      const difficultySet = new Set<string>();
      const equipmentSet = new Set<string>();
      
      exercises.forEach(ex => {
        tier1Set.add(ex.tier_1);
        tier2Set.add(ex.tier_2);
        difficultySet.add(ex.difficulty);
        ex.equipment.forEach(eq => equipmentSet.add(eq));
      });
      
      return {
        tier1: Array.from(tier1Set).sort(),
        tier2: Array.from(tier2Set).sort(),
        difficulty: ['Beginner', 'Intermediate', 'Advanced'], // Fixed order
        equipment: Array.from(equipmentSet).sort()
      };
      
    } catch (error) {
      console.error('Error getting filter options:', error);
      return {
        tier1: [],
        tier2: [],
        difficulty: [],
        equipment: []
      };
    }
  }
}

// Export singleton instance
export const exerciseService = new ExerciseService();
