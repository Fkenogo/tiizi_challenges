import type { V2GroupDetail } from '../../api/groupsApi';
import { memberLabel } from '../members/memberLabel';
import type { GroupProvenanceView } from './groupProvenanceView';

/**
 * TIIZI-FER-P4-001 — read-only facts for the About sheet, derived only from
 * fields the Group detail read already authorizes. Nothing is invented: a
 * missing or unparseable value yields null and the row is simply not shown.
 */

export function establishedLabel(createdAt: string | null | undefined): string | null {
  if (!createdAt) return null;
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
}

export function memberCountLabel(memberCount: number | null | undefined): string | null {
  if (typeof memberCount !== 'number' || !Number.isFinite(memberCount) || memberCount < 0) return null;
  return `${memberCount} ${memberCount === 1 ? 'member' : 'members'}`;
}

/**
 * The current Steward's name for the Stewardship block when the P4a provenance
 * rows do not already show it. Names are only known to authorized members
 * (provenance present); the creator is never used as the Steward.
 */
export function standaloneStewardLabel(
  detail: Pick<V2GroupDetail, 'steward'>,
  rosterSteward: { displayName: string | null } | null,
  provenance: GroupProvenanceView | null,
  viewerMemberId: string | null,
): string | null {
  if (!provenance || provenance.showSteward || provenance.creatorIsSteward) return null;
  const currentStewardMemberId = detail.steward?.memberId ?? null;
  if (currentStewardMemberId === null) return null;
  if (viewerMemberId !== null && currentStewardMemberId === viewerMemberId) return 'You';
  return memberLabel(rosterSteward?.displayName, 'The Accountable Steward');
}
