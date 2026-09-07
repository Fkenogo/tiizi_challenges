import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { isTiiziKnowledgeApiEnabled } from '../api/apiClient';
import { fetchKnowledgeById, fetchPublishedKnowledge, mapApiItemToExercise } from '../api/knowledgeApi';
import { exerciseService } from '../services/exerciseService';
import { CatalogExercise } from '../types';

/**
 * Phase B: when the Knowledge API flag is on, runtime lists come from the
 * Tiizi API (PostgreSQL authority, published-only enforced server-side) and
 * ids are Tiizi UUIDs. Otherwise the legacy Firestore service runs unchanged.
 */
async function getExercisesFromApi(filters?: {
  tier1?: string;
  tier2?: string;
  difficulty?: string;
}): Promise<CatalogExercise[]> {
  const items = await fetchPublishedKnowledge('fitness');
  return items
    .map(mapApiItemToExercise)
    .filter((ex) => (filters?.tier1 && filters.tier1 !== 'All' ? ex.tier_1 === filters.tier1 : true))
    .filter((ex) => (filters?.tier2 && filters.tier2 !== 'All' ? ex.tier_2 === filters.tier2 : true))
    .filter((ex) => (filters?.difficulty && filters.difficulty !== 'All'
      ? ex.difficulty === filters.difficulty
      : true));
}

/**
 * React Query Hooks for Exercise Data
 * 
 * These hooks provide a clean API for accessing exercise data with:
 * - Automatic caching (5-30 min depending on hook)
 * - Background refetching
 * - Error handling
 * - Loading states
 * - TypeScript type safety
 */

/**
 * Hook to fetch all exercises with optional filters
 * 
 * @example Basic usage
 * const { data: exercises, isLoading, error } = useExercises();
 * 
 * @example With filters
 * const { data: exercises } = useExercises({ tier1: 'Core', difficulty: 'Beginner' });
 */
export function useExercises(filters?: {
  tier1?: string;
  tier2?: string;
  difficulty?: string;
}): UseQueryResult<CatalogExercise[], Error> {
  const apiEnabled = isTiiziKnowledgeApiEnabled();
  return useQuery<CatalogExercise[], Error>({
    queryKey: ['exercises', apiEnabled ? 'api' : 'firestore', filters],
    queryFn: () => (apiEnabled ? getExercisesFromApi(filters) : exerciseService.getExercises(filters)),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 2,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to fetch single exercise by ID
 * 
 * @example
 * const { data: exercise } = useExercise('push-ups');
 */
export function useExercise(id: string | undefined): UseQueryResult<CatalogExercise | null, Error> {
  const apiEnabled = isTiiziKnowledgeApiEnabled();
  return useQuery<CatalogExercise | null, Error>({
    queryKey: ['exercise', apiEnabled ? 'api' : 'firestore', id],
    queryFn: async () => {
      if (!id) return null;
      if (!apiEnabled) return exerciseService.getExerciseById(id);
      // Phase B by-ID: API primary (historical resolution preserved
      // server-side), Firestore fallback for legacy slug ids held by older
      // screens/caches during transition. Remove fallback with the last
      // Firestore reader.
      try {
        const item = await fetchKnowledgeById(id);
        return item.kind === 'fitness' ? mapApiItemToExercise(item) : null;
      } catch {
        return exerciseService.getExerciseById(id);
      }
    },
    enabled: !!id,
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
  });
}

/**
 * Hook to search exercises
 * Only runs if search term >= 2 characters
 * 
 * @example
 * const [searchTerm, setSearchTerm] = useState('');
 * const { data: results } = useExerciseSearch(searchTerm);
 */
export function useExerciseSearch(searchTerm: string): UseQueryResult<CatalogExercise[], Error> {
  const apiEnabled = isTiiziKnowledgeApiEnabled();
  return useQuery<CatalogExercise[], Error>({
    queryKey: ['exercises', 'search', apiEnabled ? 'api' : 'firestore', searchTerm],
    queryFn: async () => {
      if (!apiEnabled) return exerciseService.searchExercises(searchTerm);
      if (searchTerm.length < 2) return [];
      const items = await fetchPublishedKnowledge('fitness', searchTerm);
      const term = searchTerm.toLowerCase();
      return items.map(mapApiItemToExercise).filter((ex) =>
        ex.name.toLowerCase().includes(term) ||
        ex.tier_1.toLowerCase().includes(term) ||
        ex.tier_2.toLowerCase().includes(term) ||
        ex.musclesTargeted.some((muscle) => muscle.toLowerCase().includes(term)) ||
        ex.equipment.some((eq) => eq.toLowerCase().includes(term)));
    },
    enabled: searchTerm.length >= 2,
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 1,
  });
}

/**
 * Hook to fetch exercise statistics
 * 
 * @example
 * const { data: stats } = useExerciseStats();
 * console.log(stats.total); // 113
 * console.log(stats.byTier1); // { Core: 58, ... }
 */
export function useExerciseStats() {
  return useQuery({
    queryKey: ['exercises', 'stats'],
    queryFn: () => exerciseService.getExerciseStats(),
    staleTime: 30 * 60 * 1000, // 30 minutes
    retry: 2,
  });
}

/**
 * Hook to get filter options
 * 
 * @example
 * const { data: options } = useExerciseFilterOptions();
 * console.log(options.tier1); // ['Core', 'Upper Body', ...]
 */
export function useExerciseFilterOptions() {
  return useQuery({
    queryKey: ['exercises', 'filterOptions'],
    queryFn: () => exerciseService.getFilterOptions(),
    staleTime: 60 * 60 * 1000, // 1 hour
    retry: 2,
  });
}
