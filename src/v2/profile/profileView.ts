/**
 * MC-2C-1 — presentation helpers for the own-member Profile.
 *
 * These helpers are deliberately presentation-only:
 * - initials are derived for display and never stored or persisted;
 * - name validation mirrors the transport bound so the member gets immediate
 *   feedback, while the server remains the authority that accepts or rejects;
 * - the active/history split comes from the server's derived `bucket`. No
 *   lifecycle, finalization, participation or progress truth is computed here.
 */
import type { V2Profile, V2ProfileChallengeItem } from '../../api/profileApi';

export const PROFILE_DISPLAY_NAME_MAX = 120;

export interface DisplayNameValidation {
  ok: boolean;
  value: string;
  message: string | null;
}

/** Initials for the image-unavailable fallback; never a stored identity. */
export function initialsFor(displayName: string | null | undefined): string {
  const words = (displayName ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const first = Array.from(words[0])[0] ?? '';
  const last = words.length > 1 ? Array.from(words[words.length - 1])[0] ?? '' : '';
  return `${first}${last}`.toUpperCase();
}

/** Client-side mirror of the server bound (trimmed, 1–120 code points). */
export function validateDisplayName(raw: string): DisplayNameValidation {
  const value = raw.trim();
  const length = Array.from(value).length;
  if (length === 0) {
    return { ok: false, value, message: 'Enter a display name.' };
  }
  if (length > PROFILE_DISPLAY_NAME_MAX) {
    return {
      ok: false,
      value,
      message: `Use ${PROFILE_DISPLAY_NAME_MAX} characters or fewer.`,
    };
  }
  if (/\p{Cc}/u.test(value)) {
    return { ok: false, value, message: 'Use letters, numbers, and ordinary punctuation.' };
  }
  return { ok: true, value, message: null };
}

export interface BucketedChallenges {
  active: V2ProfileChallengeItem[];
  history: V2ProfileChallengeItem[];
}

/**
 * Group served episodes by the server's derived bucket, preserving server
 * order. Items are keyed by participationId, so a withdrawal and a rejoin of
 * the same Challenge remain two distinct rows; nothing is deduplicated.
 */
export function bucketProfileChallenges(
  items: readonly V2ProfileChallengeItem[],
): BucketedChallenges {
  const active: V2ProfileChallengeItem[] = [];
  const history: V2ProfileChallengeItem[] = [];
  for (const item of items) {
    if (item.bucket === 'active') active.push(item);
    else history.push(item);
  }
  return { active, history };
}

/**
 * Member-facing label derived only from the server's status + bucket. An
 * active participation in a finalized Challenge arrives as `bucket: 'history'`
 * and is presented as finished; the stored status is never rewritten here.
 */
export function challengeStatusLabel(item: V2ProfileChallengeItem): string {
  if (item.status === 'withdrawn') return 'Withdrawn';
  if (item.status === 'removed') return 'Removed';
  if (item.bucket === 'history') return 'Finished';
  return 'Active';
}

/**
 * Merge the identity fields returned by a name save into the profile already
 * on screen. Loaded summary pages and their continuation cursors are kept:
 * a name edit does not invalidate them, and the PATCH response only carries
 * the default first page.
 */
export function mergeProfileIdentity(current: V2Profile, next: V2Profile): V2Profile {
  return {
    ...current,
    memberId: next.memberId,
    displayName: next.displayName,
    profileImage: next.profileImage,
  };
}

/** Presented Group role; the canonical role value stays untouched. */
export function groupRoleLabel(role: string): string {
  const normalised = role.trim().toLowerCase();
  if (normalised === 'owner') return 'Steward';
  if (normalised === 'admin') return 'Admin';
  return 'Member';
}
