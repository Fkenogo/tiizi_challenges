/**
 * TIIZI-FER-P1B-001 — UID-scoped cache for the member's own preferences.
 * The authenticated uid is part of the key, so one member's selections can
 * never be served to another; the cache is in-memory only (nothing persisted
 * to storage) and is removed on account change and cleared on sign-out.
 */
import type { QueryClient } from '@tanstack/react-query';

export const V2_MEMBER_PREFERENCES_SCOPE = 'v2-member-preferences';

export function v2MemberPreferencesKey(uid: string | undefined | null): [string, string | undefined | null] {
  return [V2_MEMBER_PREFERENCES_SCOPE, uid];
}

export async function removeV2MemberPreferences(queryClient: QueryClient, uid: string | undefined | null): Promise<void> {
  if (!uid) return;
  await queryClient.cancelQueries({ queryKey: v2MemberPreferencesKey(uid) });
  queryClient.removeQueries({ queryKey: v2MemberPreferencesKey(uid) });
}
