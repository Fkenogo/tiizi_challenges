import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../../api/apiClient';
import {
  decideSocialCause,
  fetchPendingSocialCauses,
  fetchSocialCauseReview,
  type SocialCauseDecision,
} from '../../api/socialCauseReviewApi';
import { useAuth } from '../../hooks/useAuth';
import {
  V2Button,
  V2Card,
  V2EmptyState,
  V2ErrorState,
  V2LoadingState,
  V2Page,
  V2SectionHeader,
  V2TextArea,
} from '../components/V2Primitives';

function dateOnly(value: string): string {
  return value.slice(0, 10);
}

function approvalLabel(status: string): string {
  if (status === 'approved') return 'Approved';
  if (status === 'revision_required') return 'Revision required';
  if (status === 'removed') return 'Removed';
  return 'Pending approval';
}

export function SocialCauseReviewPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedChallengeId, setSelectedChallengeId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const queue = useQuery({
    queryKey: ['operator-social-cause-pending', user?.uid],
    queryFn: fetchPendingSocialCauses,
    enabled: !!user?.uid,
    staleTime: 0,
  });
  const detail = useQuery({
    queryKey: ['operator-social-cause-review', user?.uid, selectedChallengeId],
    queryFn: () => fetchSocialCauseReview(selectedChallengeId!),
    enabled: !!user?.uid && !!selectedChallengeId,
    staleTime: 0,
  });
  const decision = useMutation({
    mutationFn: ({ value }: { value: SocialCauseDecision }) =>
      decideSocialCause(selectedChallengeId!, value, reason.trim()),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['operator-social-cause-pending', user?.uid] }),
        queryClient.invalidateQueries({ queryKey: ['operator-social-cause-review', user?.uid, selectedChallengeId] }),
      ]);
      setReason('');
    },
  });
  const apiConfigured = typeof import.meta.env.VITE_TIIZI_API_BASE_URL === 'string'
    && import.meta.env.VITE_TIIZI_API_BASE_URL.trim().length > 0;
  const cause = detail.data;
  const pending = queue.data ?? [];
  const decisionReady = reason.trim().length > 0 && reason.trim().length <= 1000 && cause?.approvalStatus === 'pending_approval';

  return (
    <V2Page wide>
      <V2SectionHeader
        eyebrow="Platform Operator · Review & Attention"
        title="Social Cause approval"
        description="Review the Cause and its beneficiary-owned payment destination before deciding whether it may be enabled on its Challenge. This review does not handle payments."
      />
      {!apiConfigured ? (
        <V2ErrorState title="Review is unavailable" message="The Development API is not configured for this preview." />
      ) : queue.isLoading ? (
        <V2LoadingState label="Loading pending Causes…" />
      ) : queue.isError ? (
        <>
          <V2ErrorState
            title={queue.error instanceof ApiError && queue.error.status === 403 ? 'Platform Operator access required' : 'Pending Causes could not load'}
            message={queue.error instanceof ApiError && queue.error.status === 403
              ? 'This signed-in account is not authorized to review Social Causes.'
              : 'Please check the Development API and try again.'}
            onRetry={() => void queue.refetch()}
          />
          {import.meta.env.DEV && queue.error instanceof ApiError && queue.error.status === 403 && (
            <p className="mt-3 text-sm text-slate-600">
              Founder preview? <Link className="font-bold text-primary underline" to="/v2/sign-in?next=%2Fv2%2Foperator%2Freview&operatorPreview=1">Enter Operator preview / sign in as authorized Development Operator</Link>.
            </p>
          )}
        </>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.5fr)]">
          <section aria-label="Pending Social Causes" className="space-y-2">
            <h2 className="text-sm font-black text-slate-800">Awaiting decision ({pending.length})</h2>
            {pending.length === 0 ? (
              <V2EmptyState title="No Causes awaiting a decision" message="Newly submitted Social Causes will appear here." />
            ) : pending.map((item) => (
              <button
                key={item.challengeId}
                type="button"
                aria-pressed={selectedChallengeId === item.challengeId}
                onClick={() => { setSelectedChallengeId(item.challengeId); setReason(''); decision.reset(); }}
                className={`w-full rounded-xl border p-3 text-left ${selectedChallengeId === item.challengeId ? 'border-orange-500 bg-orange-50 ring-2 ring-orange-200' : 'border-slate-200 bg-white hover:border-slate-300'}`}
              >
                <span className="block text-sm font-bold text-slate-900">{item.title}</span>
                <span className="mt-1 block text-xs text-slate-600">{item.challengeTitle} · {item.groupName}</span>
                <span className="mt-1 block text-[11px] font-semibold text-amber-800">{approvalLabel(item.approvalStatus)}</span>
              </button>
            ))}
          </section>

          <section aria-label="Cause review details">
            {!selectedChallengeId ? (
              <V2EmptyState title="Choose a Cause to review" message="Select an item from the pending queue to inspect its governed details." />
            ) : detail.isLoading ? (
              <V2LoadingState label="Loading Cause details…" />
            ) : detail.isError || !cause ? (
              <V2ErrorState title="Cause details could not load" message="Refresh the queue and try again." onRetry={() => void detail.refetch()} />
            ) : (
              <V2Card>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Challenge</p>
                    <h2 className="mt-1 text-lg font-black">{cause.challengeTitle}</h2>
                    <p className="mt-1 text-sm text-slate-600">{cause.groupName} · {dateOnly(cause.startDate)} – {dateOnly(cause.endDate)}</p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">{approvalLabel(cause.approvalStatus)}</span>
                </div>
                <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div><dt className="text-xs font-bold text-slate-500">Cause title</dt><dd className="mt-1 text-sm font-semibold">{cause.title}</dd></div>
                  <div><dt className="text-xs font-bold text-slate-500">Beneficiary</dt><dd className="mt-1 text-sm font-semibold">{cause.beneficiary}</dd></div>
                  <div className="sm:col-span-2"><dt className="text-xs font-bold text-slate-500">Description</dt><dd className="mt-1 whitespace-pre-wrap text-sm leading-6">{cause.description}</dd></div>
                  <div><dt className="text-xs font-bold text-slate-500">Purpose</dt><dd className="mt-1 text-sm">{cause.purpose}</dd></div>
                  <div><dt className="text-xs font-bold text-slate-500">Destination ownership</dt><dd className="mt-1 text-sm">{cause.destinationOwner}</dd></div>
                  <div className="sm:col-span-2"><dt className="text-xs font-bold text-slate-500">Beneficiary payment destination reference</dt><dd className="mt-1 break-all font-mono text-sm">{cause.paymentDestinationReference}</dd></div>
                </dl>
                <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">Tiizi does not hold or escrow these funds. Approval records the Cause decision only; participant payment execution is not part of this review.</p>

                {cause.approvalStatus === 'pending_approval' && (
                  <div className="mt-5 border-t border-slate-200 pt-4">
                    <label className="block text-sm font-bold">Decision reason
                      <V2TextArea value={reason} onChange={setReason} maxLength={1000} placeholder="Record what you reviewed and why you are approving or requesting revision." />
                    </label>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <V2Button disabled={!decisionReady || decision.isPending} onClick={() => decision.mutate({ value: 'approved' })}>Approve Cause</V2Button>
                      <V2Button variant="secondary" disabled={!decisionReady || decision.isPending} onClick={() => decision.mutate({ value: 'revision_required' })}>Request revision</V2Button>
                    </div>
                    {decision.isError && <p role="alert" className="mt-2 text-sm text-red-700">The decision could not be saved. {decision.error.message}</p>}
                  </div>
                )}

                {cause.decisions.length > 0 && (
                  <section className="mt-5 border-t border-slate-200 pt-4" aria-label="Decision audit">
                    <h3 className="text-sm font-black">Decision audit</h3>
                    <ol className="mt-2 space-y-2">
                      {cause.decisions.map((item, index) => (
                        <li key={`${item.decidedAt}-${index}`} className="rounded-lg bg-slate-50 p-3 text-xs">
                          <p className="font-bold">{approvalLabel(item.decision)} · {item.decidedAt.slice(0, 10)}</p>
                          <p className="mt-1">Reason: {item.reason}</p>
                          <p className="mt-1 font-mono text-slate-500">Operator member {item.authorityMemberId}</p>
                        </li>
                      ))}
                    </ol>
                  </section>
                )}
              </V2Card>
            )}
          </section>
        </div>
      )}
    </V2Page>
  );
}
