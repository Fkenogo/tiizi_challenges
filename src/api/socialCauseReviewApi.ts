import { API_PREFIX, apiFetch } from './apiClient';

export type SocialCauseDecision = 'approved' | 'revision_required';

export interface SocialCauseReviewItem {
  challengeId: string;
  challengeTitle: string;
  challengeType: string;
  challengeStatus: 'establishment' | 'active' | 'ended';
  supportTiiziEnabled: boolean;
  groupName: string;
  startDate: string;
  endDate: string;
  title: string;
  description: string;
  purpose: string;
  beneficiary: string;
  paymentDestinationReference: string;
  destinationOwner: string;
  approvalStatus: 'pending_approval' | 'approved' | 'revision_required' | 'removed';
  approvalAuthority: string | null;
  createdAt: string;
  decisionAt: string | null;
  decisionReason: string | null;
  currentOperatorMemberId?: string;
  decisions: Array<{
    decision: SocialCauseDecision;
    authorityMemberId: string;
    reason: string;
    decidedAt: string;
  }>;
}

export async function fetchPendingSocialCauses(): Promise<SocialCauseReviewItem[]> {
  const response = await apiFetch<{ causes: SocialCauseReviewItem[] }>(`${API_PREFIX}/operator/social-causes/pending`);
  return response.causes;
}

export function fetchSocialCauseReview(challengeId: string): Promise<SocialCauseReviewItem> {
  return apiFetch<SocialCauseReviewItem>(`${API_PREFIX}/operator/social-causes/${encodeURIComponent(challengeId)}`);
}

export function decideSocialCause(
  challengeId: string,
  decision: SocialCauseDecision,
  reason: string,
): Promise<{ challengeId: string; decision: SocialCauseDecision }> {
  return apiFetch(`${API_PREFIX}/challenges/${encodeURIComponent(challengeId)}/social-cause/decision`, {
    method: 'POST',
    body: { decision, reason },
  });
}
