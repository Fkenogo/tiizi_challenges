import type { V2ChallengeDetail } from '../../api/v2ChallengeApi';

/**
 * S3a — participation view derivation (pure, React-free so it is directly
 * testable — same convention as `challengeCreationDraft.ts`).
 *
 * Derives the member-facing participation view ONLY from the authoritative
 * read model (`detail.myParticipation?.status`, `detail.status`,
 * `detail.finalized`). Never infers participation from unrelated fields;
 * never manufactures canonical state.
 */
export type S3aParticipationView =
  | { kind: 'joined' }
  | { kind: 'not-joined'; previouslyEnded: boolean }
  | { kind: 'read-only'; reason: 'ended' | 'finalized' };

export function participationViewFor(detail: V2ChallengeDetail): S3aParticipationView {
  if (detail.status === 'ended' || detail.finalized) {
    // Ended/finalized Challenges are read-only regardless of episode state.
    // An active episode on an ended Challenge stays visible history; no
    // further join/withdraw CTA is offered.
    return { kind: 'read-only', reason: detail.finalized ? 'finalized' : 'ended' };
  }
  // CORR-001: an active-status Challenge whose governed server day is past
  // endDate is ended-pending (window expired, not yet processed). Joining and
  // leaving are closed under the same server-authoritative rule the backend
  // enforces; never the device clock.
  if (detail.status === 'active' && detail.governingToday > detail.endDate) {
    return { kind: 'read-only', reason: 'ended' };
  }
  if (detail.myParticipation?.status === 'active') return { kind: 'joined' };
  return {
    kind: 'not-joined',
    previouslyEnded: detail.myParticipation != null,
  };
}
