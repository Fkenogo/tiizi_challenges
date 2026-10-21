/**
 * MC-2C-2 — V2 sign-out.
 *
 * Cancels every in-flight query and clears the shared query cache before
 * Firebase sign-out. Authentication caches are not all UID-keyed (for example
 * operator-console queries), so clearing only Profile and Today would let the
 * next member read data cached for the previous member. Sign-out itself stays
 * owned by the existing Auth context.
 */
import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';

export function useV2SignOut() {
  const { logout } = useAuth();
  const queryClient = useQueryClient();

  return useCallback(async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await logout();
  }, [logout, queryClient]);
}
