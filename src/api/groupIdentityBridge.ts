import { apiFetch } from './apiClient';

export interface GroupIdentityMapping {
  /** Transitional Firestore document id (lookup key only, never a domain id). */
  legacyId: string;
  /** Authoritative Tiizi group UUID. */
  id: string;
}

interface GroupIdentityResponse {
  mappings: GroupIdentityMapping[];
}

const legacyToUuid = new Map<string, string>();
const uuidToLegacy = new Map<string, string>();
const pending = new Map<string, Promise<void>>();

function remember(mappings: GroupIdentityMapping[]): void {
  for (const mapping of mappings) {
    legacyToUuid.set(mapping.legacyId, mapping.id);
    uuidToLegacy.set(mapping.id, mapping.legacyId);
  }
}

function buildQuery(legacyIds: string[], uuids: string[]): string {
  const params = new URLSearchParams();
  for (const legacyId of legacyIds) params.append('legacyId', legacyId);
  for (const uuid of uuids) params.append('id', uuid);
  return `/v1/compat/group-ids?${params.toString()}`;
}

async function fetchUncached(legacyIds: string[], uuids: string[]): Promise<void> {
  const key = `L:${legacyIds.join(',')}|U:${uuids.join(',')}`;
  let inFlight = pending.get(key);
  if (!inFlight) {
    inFlight = apiFetch<GroupIdentityResponse>(buildQuery(legacyIds, uuids))
      .then((response) => {
        remember(response.mappings);
      })
      .finally(() => {
        pending.delete(key);
      });
    pending.set(key, inFlight);
  }
  await inFlight;
}

/**
 * Transitional identity bridge (strangler-migration seam).
 *
 * PostgreSQL owns Tiizi UUID identity; Firestore document ids survive here
 * only as lookup keys so existing screens can translate the identity they
 * already hold. Callers must keep using the Tiizi UUID as the domain `id`
 * and must never persist or route on a Firestore id obtained from this
 * module as if it were canonical. Remove with the last Firestore reader.
 */
export async function resolveTiiziGroupIds(legacyIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(legacyIds.filter((id) => id))];
  const missing = unique.filter((id) => !legacyToUuid.has(id));
  if (missing.length > 0) await fetchUncached(missing, []);
  const result = new Map<string, string>();
  for (const legacyId of unique) {
    const uuid = legacyToUuid.get(legacyId);
    if (uuid) result.set(legacyId, uuid);
  }
  return result;
}

export async function resolveLegacyGroupIds(uuids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(uuids.filter((id) => id))];
  const missing = unique.filter((id) => !uuidToLegacy.has(id));
  if (missing.length > 0) await fetchUncached([], missing);
  const result = new Map<string, string>();
  for (const uuid of unique) {
    const legacyId = uuidToLegacy.get(uuid);
    if (legacyId) result.set(uuid, legacyId);
  }
  return result;
}

export async function resolveTiiziGroupId(legacyId: string): Promise<string | null> {
  if (!legacyId) return null;
  const found = await resolveTiiziGroupIds([legacyId]);
  return found.get(legacyId) ?? null;
}

export async function resolveLegacyGroupId(uuid: string): Promise<string | null> {
  if (!uuid) return null;
  const found = await resolveLegacyGroupIds([uuid]);
  return found.get(uuid) ?? null;
}

/** Test/flag-off support: drops all cached translations. */
export function clearGroupIdentityCache(): void {
  legacyToUuid.clear();
  uuidToLegacy.clear();
}
