/**
 * MC-2C-2 — the authenticated member's canonical identity for presentation.
 *
 * UID-scoped: the query key carries the signed-in uid, and the query is
 * disabled while signed out. An account switch therefore selects a different
 * cache slot rather than reusing the previous member's name, and the route
 * scope clears the slot left behind.
 */
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import {
  fetchV2MemberIdentity,
  selectV2MemberIdentity,
  v2MemberIdentityKey,
  type V2MemberIdentity,
} from './memberIdentityQuery';

export function useV2MemberIdentity() {
  const { user } = useAuth();
  const uid = user?.uid;

  const query = useQuery({
    queryKey: v2MemberIdentityKey(uid),
    queryFn: fetchV2MemberIdentity,
    select: selectV2MemberIdentity,
    enabled: Boolean(uid),
    staleTime: 30_000,
  });

  return {
    identity: query.data ?? null,
    displayName: query.data?.displayName ?? null,
    profileImage: query.data?.profileImage,
    isLoading: Boolean(uid) && query.isPending,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  } satisfies {
    identity: V2MemberIdentity | null;
    displayName: string | null;
    profileImage: V2MemberIdentity['profileImage'] | undefined;
    isLoading: boolean;
    isError: boolean;
    error: unknown;
    refetch: typeof query.refetch;
  };
}
