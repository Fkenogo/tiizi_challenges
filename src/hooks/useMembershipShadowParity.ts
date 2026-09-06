import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { isTiiziApiEnabled } from '../api/apiClient';
import { fetchMyMemberships } from '../api/membershipsApi';
import { resolveTiiziGroupIds } from '../api/groupIdentityBridge';
import { useAuth } from './useAuth';

export type ShadowParityStatus =
  | 'disabled'
  | 'loading'
  | 'error'
  | 'match'
  | 'mismatch';

export interface ShadowParityMismatch {
  kind: 'missing_in_api' | 'missing_in_firestore';
  legacyGroupId: string;
}

export interface MembershipShadowParity {
  status: ShadowParityStatus;
  firestoreCount: number;
  apiCount: number;
  mismatches: ShadowParityMismatch[];
  message?: string;
}

/**
 * Phase A2 operational proof slice: read-only shadow comparison of the
 * Firestore "my groups" read against the Tiizi API (PostgreSQL) read for the
 * current user. Translation between legacy Firestore ids and Tiizi UUIDs goes
 * through the identity bridge — screens never learn both systems.
 *
 * Compares membership SETS only. Role/status parity is covered server-side by
 * `npm run parity:memberships` in the api package (it reads the Firestore
 * groupMembers collection, which carries roles — the UI list does not).
 *
 * Disabled (and query-free) unless VITE_TIIZI_API_ENABLED=true. Firestore
 * remains authoritative; this hook changes no behaviour, it only reports.
 */
export function useMembershipShadowParity(firestoreGroupIds: string[]): MembershipShadowParity {
  const { user } = useAuth();
  const enabled = isTiiziApiEnabled() && !!user?.uid;

  const apiQuery = useQuery({
    queryKey: ['api-memberships', user?.uid],
    queryFn: fetchMyMemberships,
    enabled,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });

  const sortedIds = useMemo(() => [...new Set(firestoreGroupIds)].sort(), [firestoreGroupIds.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  const bridgeQuery = useQuery({
    queryKey: ['group-identity-bridge', sortedIds],
    queryFn: async () => {
      const mapping = await resolveTiiziGroupIds(sortedIds);
      return [...mapping.entries()];
    },
    enabled: enabled && sortedIds.length > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });

  return useMemo<MembershipShadowParity>(() => {
    if (!enabled) return { status: 'disabled', firestoreCount: 0, apiCount: 0, mismatches: [] };
    if (apiQuery.isPending || (sortedIds.length > 0 && bridgeQuery.isPending)) {
      return {
        status: 'loading',
        firestoreCount: sortedIds.length,
        apiCount: apiQuery.data?.memberships.length ?? 0,
        mismatches: [],
      };
    }
    if (apiQuery.isError || bridgeQuery.isError) {
      return {
        status: 'error',
        firestoreCount: sortedIds.length,
        apiCount: 0,
        mismatches: [],
        message: 'Tiizi API shadow read failed; Firestore view unaffected.',
      };
    }

    const uuidByLegacy = new Map(bridgeQuery.data ?? []);
    const legacyByUuid = new Map<string, string>();
    for (const [legacyId, uuid] of uuidByLegacy) legacyByUuid.set(uuid, legacyId);
    const firestoreIds = new Set(sortedIds);

    const mismatches: ShadowParityMismatch[] = [];
    for (const legacyId of sortedIds) {
      const uuid = uuidByLegacy.get(legacyId);
      const apiMembership = uuid
        ? (apiQuery.data?.memberships ?? []).find((membership) => membership.groupId === uuid)
        : undefined;
      if (!apiMembership) mismatches.push({ kind: 'missing_in_api', legacyGroupId: legacyId });
    }
    for (const membership of apiQuery.data?.memberships ?? []) {
      const legacyId = legacyByUuid.get(membership.groupId);
      if (!legacyId || !firestoreIds.has(legacyId)) {
        mismatches.push({ kind: 'missing_in_firestore', legacyGroupId: legacyId ?? membership.group.id });
      }
    }

    return {
      status: mismatches.length === 0 ? 'match' : 'mismatch',
      firestoreCount: sortedIds.length,
      apiCount: apiQuery.data?.memberships.length ?? 0,
      mismatches,
    };
  }, [enabled, apiQuery, bridgeQuery, sortedIds]);
}
