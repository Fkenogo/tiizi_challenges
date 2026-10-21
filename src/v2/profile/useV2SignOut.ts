/**
 * MC-2C-2 — V2 sign-out.
 *
 * Cancels and drops identity-scoped Profile and Today caches before Firebase
 * sign-out, so an in-flight read cannot land in the next session's cache and
 * no member-specific projection survives on the device. Sign-out itself stays
 * owned by the existing Auth context.
 */
import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { V2_TODAY_SCOPE } from '../today/todayQueryKeys';
import { clearV2MemberIdentity } from './memberIdentityQuery';

export function useV2SignOut() {
  const { logout } = useAuth();
  const queryClient = useQueryClient();

  return useCallback(async () => {
    await clearV2MemberIdentity(queryClient);
    await queryClient.cancelQueries({ queryKey: [V2_TODAY_SCOPE] });
    queryClient.removeQueries({ queryKey: [V2_TODAY_SCOPE] });
    await logout();
  }, [logout, queryClient]);
}
