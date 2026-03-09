import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminWellnessActivityService, type AdminWellnessActivityInput } from '../services/adminWellnessActivityService';

export function useAdminWellnessActivities() {
  return useQuery({
    queryKey: ['admin-wellness-activities'],
    queryFn: () => adminWellnessActivityService.getAdminWellnessActivities(),
    staleTime: 30 * 1000,
  });
}

export function useAdminWellnessActivity(id: string | undefined) {
  return useQuery({
    queryKey: ['admin-wellness-activity', id],
    queryFn: () => (id ? adminWellnessActivityService.getActivityById(id) : Promise.resolve(null)),
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

export function useCreateAdminWellnessActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AdminWellnessActivityInput) => adminWellnessActivityService.createActivity(input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-wellness-activities'] }),
        queryClient.invalidateQueries({ queryKey: ['wellness-activities'] }),
      ]);
    },
  });
}

export function useUpdateAdminWellnessActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: AdminWellnessActivityInput }) =>
      adminWellnessActivityService.updateActivity(id, input),
    onSuccess: async (_data, vars) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-wellness-activities'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-wellness-activity', vars.id] }),
        queryClient.invalidateQueries({ queryKey: ['wellness-activities'] }),
      ]);
    },
  });
}

export function useDeleteAdminWellnessActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminWellnessActivityService.deleteActivity(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-wellness-activities'] }),
        queryClient.invalidateQueries({ queryKey: ['wellness-activities'] }),
      ]);
    },
  });
}
