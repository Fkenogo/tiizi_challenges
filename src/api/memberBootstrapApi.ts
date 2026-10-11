import { apiFetch, apiPath } from './apiClient';

/** MC-1 explicit member bootstrap response. Minimal by contract. */
export interface MemberBootstrapResult {
  memberId: string;
  created: boolean;
}

/**
 * Explicitly establishes (or resolves) the caller's canonical Tiizi member.
 * The actor is the verified bearer token only — nothing is sent in the body.
 * Idempotent: an already-mapped member is returned unchanged.
 */
export function bootstrapMember(): Promise<MemberBootstrapResult> {
  return apiFetch<MemberBootstrapResult>(apiPath('/members/bootstrap'), { method: 'POST' });
}
