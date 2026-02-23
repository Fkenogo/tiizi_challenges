import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { exerciseService } from '../services/exerciseService';
import { CatalogExercise } from '../types';

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
  return useQuery<CatalogExercise[], Error>({
    queryKey: ['exercises', filters],
    queryFn: () => exerciseService.getExercises(filters),
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
  return useQuery<CatalogExercise | null, Error>({
    queryKey: ['exercise', id],
    queryFn: () => id ? exerciseService.getExerciseById(id) : Promise.resolve(null),
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
  return useQuery<CatalogExercise[], Error>({
    queryKey: ['exercises', 'search', searchTerm],
    queryFn: () => exerciseService.searchExercises(searchTerm),
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
