import { apiFetch, apiPath } from './apiClient';

/** MC-1 explicit member bootstrap response. Minimal by contract. */
export interface MemberBootstrapResult {
  memberId: string;
  created: boolean;
}

/**
 * Explicitly establishes (or resolves) a canonical Tiizi member for the
 * Firebase user that OWNS `token`. The caller passes the token it obtained from
 * the exact Firebase user whose name it is supplying; this function never
 * looks at the global `auth.currentUser`. The server derives the actor from the
 * verified token only; no UID is sent. The one optional body field is
 * `displayName`, used insert-only on first creation. Idempotent.
 */
export function bootstrapMemberWithToken(
  token: string,
  displayName?: string | null,
): Promise<MemberBootstrapResult> {
  const name = displayName?.trim();
  return apiFetch<MemberBootstrapResult>(apiPath('/members/bootstrap'), {
    method: 'POST',
    bearerToken: token,
    ...(name ? { body: { displayName: name } } : {}),
  });
}
