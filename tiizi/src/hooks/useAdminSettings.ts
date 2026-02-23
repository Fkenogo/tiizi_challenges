import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminSettingsService, type AdminUserRecord, type AppConfig } from '../services/adminSettingsService';

export function useAppConfig() {
  return useQuery({
    queryKey: ['admin-settings-app-config'],
    queryFn: () => adminSettingsService.getAppConfig(),
    staleTime: 30 * 1000,
  });
}

export function useSaveAppConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ config, actorUid }: { config: AppConfig; actorUid: string }) => adminSettingsService.saveAppConfig(config, actorUid),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-settings-app-config'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-settings-system-logs'] });
    },
  });
}

export function useAdminUsersConfig() {
  return useQuery({
    queryKey: ['admin-settings-admin-users'],
    queryFn: () => adminSettingsService.getAdminUsers(),
    staleTime: 30 * 1000,
  });
}

export function useUpsertAdminUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ payload, actorUid }: { payload: AdminUserRecord; actorUid: string }) =>
      adminSettingsService.upsertAdminUser(payload, actorUid),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-settings-admin-users'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-settings-system-logs'] });
    },
  });
}

export function useSystemLogs(limitCount = 100) {
  return useQuery({
    queryKey: ['admin-settings-system-logs', limitCount],
    queryFn: () => adminSettingsService.getSystemLogs(limitCount),
    staleTime: 15 * 1000,
  });
}

