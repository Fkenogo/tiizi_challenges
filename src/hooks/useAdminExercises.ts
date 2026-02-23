import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminExerciseService, type AdminExerciseInput } from '../services/adminExerciseService';

export function useAdminExercises() {
  return useQuery({
    queryKey: ['admin-exercises'],
    queryFn: () => adminExerciseService.getAdminExercises(),
    staleTime: 30 * 1000,
  });
}

export function useAdminExercise(id: string | undefined) {
  return useQuery({
    queryKey: ['admin-exercise', id],
    queryFn: () => (id ? adminExerciseService.getExerciseById(id) : Promise.resolve(null)),
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

export function useAdminExerciseStats() {
  return useQuery({
    queryKey: ['admin-exercise-stats'],
    queryFn: () => adminExerciseService.getExerciseAdminStats(),
    staleTime: 30 * 1000,
  });
}

export function useCreateAdminExercise() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AdminExerciseInput) => adminExerciseService.createExercise(input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-exercises'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-exercise-stats'] }),
        queryClient.invalidateQueries({ queryKey: ['exercises'] }),
      ]);
    },
  });
}

export function useUpdateAdminExercise() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: AdminExerciseInput }) => adminExerciseService.updateExercise(id, input),
    onSuccess: async (_data, vars) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-exercises'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-exercise-stats'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-exercise', vars.id] }),
        queryClient.invalidateQueries({ queryKey: ['exercises'] }),
      ]);
    },
  });
}

export function useDeleteAdminExercise() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminExerciseService.deleteExercise(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-exercises'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-exercise-stats'] }),
        queryClient.invalidateQueries({ queryKey: ['exercises'] }),
      ]);
    },
  });
}

export function useBulkImportAdminExercises() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AdminExerciseInput[]) => adminExerciseService.bulkImportExercises(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-exercises'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-exercise-stats'] }),
        queryClient.invalidateQueries({ queryKey: ['exercises'] }),
      ]);
    },
  });
}

