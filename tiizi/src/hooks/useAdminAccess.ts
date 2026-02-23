import { useAdminPermissions } from './useAdminPermissions';

export function useAdminAccess(uid: string | undefined) {
  const query = useAdminPermissions(uid);
  return { ...query, isAdmin: query.permissions.canAccessAdmin };
}
