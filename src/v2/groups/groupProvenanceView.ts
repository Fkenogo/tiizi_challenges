import type { V2GroupDetail } from '../../api/groupsApi';
import { memberLabel } from '../members/memberLabel';

/**
 * TIIZI-FER-P4A-001 — how Group Details presents who ESTABLISHED the Group and
 * who is the CURRENT Steward. Presentation only: both identities arrive from the
 * server (the creator from recorded provenance, the Steward from live authority)
 * and nothing is inferred here — an unrecorded creator is "Not recorded", never
 * the Steward, never the earliest member.
 */
export interface GroupProvenanceView {
  creatorLabel: string;
  creatorIsSteward: boolean;
  /** Shown only when the recorded creator is NOT the current Steward. */
  showSteward: boolean;
  stewardLabel: string;
}

export const NOT_RECORDED_LABEL = 'Not recorded';

export function groupProvenanceView(
  detail: Pick<V2GroupDetail, 'originalCreator' | 'steward'>,
  rosterSteward: { memberId: string; displayName: string | null } | null,
  viewerMemberId: string | null,
): GroupProvenanceView | null {
  // Absent = the viewer is not authorized to see provenance: render nothing.
  if (detail.originalCreator === undefined) return null;
  if (detail.originalCreator === null) {
    return { creatorLabel: NOT_RECORDED_LABEL, creatorIsSteward: false, showSteward: false, stewardLabel: '' };
  }
  const creator = detail.originalCreator;
  const currentStewardMemberId = detail.steward?.memberId ?? null;
  const creatorIsSteward = currentStewardMemberId !== null && currentStewardMemberId === creator.memberId;
  const isViewer = (id: string | null) => id !== null && viewerMemberId !== null && id === viewerMemberId;
  return {
    creatorLabel: isViewer(creator.memberId) ? 'You' : memberLabel(creator.displayName, 'A Group member'),
    creatorIsSteward,
    showSteward: !creatorIsSteward && currentStewardMemberId !== null,
    stewardLabel: isViewer(currentStewardMemberId) ? 'You' : memberLabel(rosterSteward?.displayName, 'The Accountable Steward'),
  };
}
