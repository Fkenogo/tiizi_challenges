/**
 * MC-2C-2 — canonical, UID-scoped member identity projection.
 *
 * One React Query cache family for the cross-screen account identity. The
 * authenticated uid is the second key segment, so a projection fetched for
 * one member can never be served to another. Only identity fields are exposed
 * to consumers; Group and Challenge summaries remain owned by the Profile
 * screen's paginated read.
 *
 * The cache is in-memory only. Nothing here is persisted to localStorage,
 * sessionStorage or IndexedDB, and the server remains the authority for the
 * display name on every read.
 */
import type { QueryClient } from '@tanstack/react-query';
import type { V2Profile } from '../../api/profileApi';

export const V2_MEMBER_IDENTITY_SCOPE = 'v2-member-identity';

export interface V2MemberIdentity {
  memberId: string;
  displayName: string | null;
  profileImage: V2Profile['profileImage'];
}

/** Canonical key for one member's identity projection. */
export function v2MemberIdentityKey(uid: string | undefined): [string, string | undefined] {
  return [V2_MEMBER_IDENTITY_SCOPE, uid];
}

/** The only fields consumers may read from the identity projection. */
export function selectV2MemberIdentity(profile: V2Profile): V2MemberIdentity {
  return {
    memberId: profile.memberId,
    displayName: profile.displayName,
    profileImage: profile.profileImage,
  };
}

/**
 * Read the identity projection without loading summary pages. The transport
 * still goes through the governed `/api/me` read; the one-row summary pages
 * are not presented and no cursor is consumed.
 */
export async function fetchV2MemberIdentity(): Promise<V2Profile> {
  // Loaded on demand so the pure cache contract can be imported by guards
  // without initialising the Firebase-backed transport.
  const { fetchV2Profile } = await import('../../api/profileApi');
  return fetchV2Profile({ groupsLimit: 1, challengesLimit: 1 });
}

/** Current cached identity for one member, or undefined when absent. */
export function readV2MemberIdentity(
  queryClient: QueryClient,
  uid: string | undefined,
): V2MemberIdentity | undefined {
  if (!uid) return undefined;
  const profile = queryClient.getQueryData<V2Profile>(v2MemberIdentityKey(uid));
  return profile ? selectV2MemberIdentity(profile) : undefined;
}

/** Write a canonical server projection into one member's cache slot. */
export function setV2MemberIdentity(
  queryClient: QueryClient,
  uid: string | undefined,
  profile: V2Profile,
): void {
  if (!uid) return;
  // A read that started before this canonical write must not land afterwards
  // and restore the superseded name.
  void queryClient.cancelQueries({ queryKey: v2MemberIdentityKey(uid) });
  queryClient.setQueryData(v2MemberIdentityKey(uid), profile);
}

/**
 * Mark one member's identity stale so the next read re-proves it from the
 * server. Called after a governed display-name mutation.
 */
export async function invalidateV2MemberIdentity(
  queryClient: QueryClient,
  uid: string | undefined,
): Promise<void> {
  if (!uid) return;
  await queryClient.invalidateQueries({ queryKey: v2MemberIdentityKey(uid) });
}

/**
 * Cancel and drop one member's identity projection. Used on an account switch
 * or sign-out. Only the named member's slot is touched: a query already
 * starting for the next member is left alone.
 */
export async function removeV2MemberIdentity(
  queryClient: QueryClient,
  uid: string | undefined | null,
): Promise<void> {
  if (!uid) return;
  await queryClient.cancelQueries({ queryKey: v2MemberIdentityKey(uid) });
  queryClient.removeQueries({ queryKey: v2MemberIdentityKey(uid) });
}

/** Cancel and drop every member's identity projection (explicit sign-out). */
export async function clearV2MemberIdentity(queryClient: QueryClient): Promise<void> {
  await queryClient.cancelQueries({ queryKey: [V2_MEMBER_IDENTITY_SCOPE] });
  queryClient.removeQueries({ queryKey: [V2_MEMBER_IDENTITY_SCOPE] });
}
