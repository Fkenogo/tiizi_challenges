import type { CatalogExercise } from '../types/index.js';
import {
  isKnowledgeApiActive,
  type KnowledgeAuthorityMode,
} from './knowledgeAuthorityMode.js';

/**
 * Phase B canonical aggregates for the Exercise Library. In firestore mode
 * the legacy service computes these from Firestore; in transition/postgres
 * modes they are derived from the already-fetched canonical API list
 * (published-only, PostgreSQL authority) — no new endpoint needed for
 * these small client-side aggregates, and no Firestore read in postgres
 * mode. Shapes mirror exerciseService.getExerciseStats/getFilterOptions
 * exactly so callers are unaffected.
 */

export interface ExerciseStats {
  total: number;
  byTier1: Record<string, number>;
  byTier2: Record<string, number>;
  byDifficulty: Record<string, number>;
  byEquipment: Record<string, number>;
}

export interface ExerciseFilterOptions {
  tier1: string[];
  tier2: string[];
  difficulty: string[];
  equipment: string[];
}

export function deriveExerciseStats(exercises: CatalogExercise[]): ExerciseStats {
  const stats: ExerciseStats = {
    total: exercises.length,
    byTier1: {},
    byTier2: {},
    byDifficulty: {},
    byEquipment: {},
  };
  for (const ex of exercises) {
    stats.byTier1[ex.tier_1] = (stats.byTier1[ex.tier_1] || 0) + 1;
    stats.byTier2[ex.tier_2] = (stats.byTier2[ex.tier_2] || 0) + 1;
    stats.byDifficulty[ex.difficulty] = (stats.byDifficulty[ex.difficulty] || 0) + 1;
    for (const eq of ex.equipment) {
      stats.byEquipment[eq] = (stats.byEquipment[eq] || 0) + 1;
    }
  }
  return stats;
}

export function deriveExerciseFilterOptions(
  exercises: CatalogExercise[],
): ExerciseFilterOptions {
  const tier1Set = new Set<string>();
  const tier2Set = new Set<string>();
  const equipmentSet = new Set<string>();
  for (const ex of exercises) {
    tier1Set.add(ex.tier_1);
    tier2Set.add(ex.tier_2);
    ex.equipment.forEach((eq) => equipmentSet.add(eq));
  }
  return {
    tier1: [...tier1Set].sort(),
    tier2: [...tier2Set].sort(),
    // Fixed order, mirroring the legacy service exactly.
    difficulty: ['Beginner', 'Intermediate', 'Advanced'],
    equipment: [...equipmentSet].sort(),
  };
}

export interface ExerciseAggregateSources<T> {
  fetchApiExercises(): Promise<CatalogExercise[]>;
  fetchLegacy(): Promise<T>;
}

/**
 * Authority-mode source selection shared by the stats/filter hooks.
 * firestore → legacy helper; transition/postgres → API-derived (API errors
 * propagate, Firestore never consulted).
 */
export async function exerciseStatsSource(
  mode: KnowledgeAuthorityMode,
  sources: ExerciseAggregateSources<ExerciseStats>,
): Promise<ExerciseStats> {
  if (!isKnowledgeApiActive(mode)) return sources.fetchLegacy();
  return deriveExerciseStats(await sources.fetchApiExercises());
}

export async function exerciseFilterOptionsSource(
  mode: KnowledgeAuthorityMode,
  sources: ExerciseAggregateSources<ExerciseFilterOptions>,
): Promise<ExerciseFilterOptions> {
  if (!isKnowledgeApiActive(mode)) return sources.fetchLegacy();
  return deriveExerciseFilterOptions(await sources.fetchApiExercises());
}
