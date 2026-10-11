import { apiFetch, apiPath } from './apiClient';

/** MC-1 explicit member bootstrap response. Minimal by contract. */
export interface MemberBootstrapResult {
  memberId: string;
  created: boolean;
}

/**
 * Explicitly establishes (or resolves) the caller's canonical Tiizi member.
 * The actor is the verified bearer token only. The one optional body field is
 * `displayName` (the Firebase user's real display name, never derived), used
 * by the server insert-only on first creation. Idempotent: an already-mapped
 * member is returned unchanged and never renamed.
 */
export function bootstrapMember(displayName?: string | null): Promise<MemberBootstrapResult> {
  const name = displayName?.trim();
  return apiFetch<MemberBootstrapResult>(apiPath('/members/bootstrap'), {
    method: 'POST',
    ...(name ? { body: { displayName: name } } : {}),
  });
}
