/**
 * MC-2C-2 — ownership and reconciliation rules for the Profile write path.
 *
 * A response belongs to the identity that issued the request, not to whoever
 * is signed in when it arrives. These helpers make that rule explicit and
 * testable, and keep an uncertain PATCH outcome from being presented as a
 * definitive success or failure.
 */
import type { QueryClient } from '@tanstack/react-query';
import { ApiError } from '../../api/apiError';
import type { V2Profile } from '../../api/profileApi';
import {
  setV2MemberIdentity,
  type V2MemberIdentity,
} from './memberIdentityQuery';
import { mergeProfileIdentity } from './profileView';

export interface ProfileResponseOwner {
  responseUid: string;
  activeUid: string | null;
  responseSeq: number;
  activeSeq: number;
}

/** A response is usable only by the same identity and the same request. */
export function profileResponseIsCurrent(owner: ProfileResponseOwner): boolean {
  return owner.activeUid === owner.responseUid && owner.activeSeq === owner.responseSeq;
}

/**
 * A transport failure is uncertain when the request may have reached the
 * server and committed: 5xx, timeout, or a network failure with no status.
 * A 4xx response is a definitive rejection and is never reconciled as if the
 * write might have succeeded.
 */
export function isUncertainProfileWriteFailure(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.status >= 500 || error.status === 408;
  }
  return true;
}

/**
 * Write a member's identity only when the response still belongs to the
 * active identity and request. Returns null when the response was superseded;
 * in that case nothing is written and no other member's cache is touched.
 */
export function writeOwnedV2MemberIdentity(
  queryClient: QueryClient,
  params: ProfileResponseOwner & { profile: V2Profile },
): V2MemberIdentity | null {
  if (!profileResponseIsCurrent(params)) return null;
  setV2MemberIdentity(queryClient, params.responseUid, params.profile);
  return {
    memberId: params.profile.memberId,
    displayName: params.profile.displayName,
    profileImage: params.profile.profileImage,
  };
}

/**
 * Reconcile an uncertain save through a fresh canonical read. The read result
 * replaces identity fields only; summary pages and continuation cursors
 * already loaded by the Profile screen are preserved.
 */
export async function reconcileProfileIdentity(input: {
  current: V2Profile | null;
  readCanonical: () => Promise<V2Profile>;
}): Promise<V2Profile> {
  const canonical = await input.readCanonical();
  return input.current ? mergeProfileIdentity(input.current, canonical) : canonical;
}

/**
 * Thrown when the PATCH outcome could not be confirmed. `reconciled` records
 * whether a canonical read succeeded afterwards; it never asserts that the
 * submitted name was committed.
 */
export class ProfileSaveUncertainError extends Error {
  readonly reconciled: boolean;
  readonly writeError: unknown;

  constructor(writeError: unknown, reconciled: boolean) {
    super('The display name update could not be confirmed.');
    this.name = 'ProfileSaveUncertainError';
    this.reconciled = reconciled;
    this.writeError = writeError;
  }
}
