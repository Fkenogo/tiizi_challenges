import { V2Button, V2Card, V2ErrorState, V2LoadingState } from '../components/V2Primitives';
import { usePendingGroupApplications, useReviewGroupApplication } from './useV2Groups';

export function V2PendingApplications({ groupId }: { groupId: string }) {
  const pending = usePendingGroupApplications(groupId);
  const review = useReviewGroupApplication(groupId);
  if (pending.isLoading) return <V2LoadingState label="Loading join requests…" />;
  if (pending.isError) return <V2ErrorState title="Requests are unavailable" message="We could not load pending requests." onRetry={() => void pending.refetch()} />;
  const applicants = pending.data?.applicants ?? [];
  return <section aria-label="Pending admission requests"><V2Card><div className="flex items-center justify-between gap-2"><div><h2 className="text-base font-black text-slate-900">Join requests</h2><p className="text-xs text-slate-500">Only you, as Accountable Steward, can review these requests.</p></div><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">{applicants.length} pending</span></div>
    {applicants.length === 0 ? <p className="mt-3 text-sm text-slate-500">No pending requests.</p> : <ul className="mt-3 divide-y divide-slate-100">{applicants.map((applicant) => <li key={applicant.memberId} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="text-sm font-bold text-slate-900">Tiizi member</p><p className="text-xs text-slate-500">Requested {new Date(applicant.requestedAt).toLocaleDateString()}</p></div><div className="flex gap-2"><V2Button variant="success" disabled={review.isPending} onClick={() => review.mutate({memberId: applicant.memberId, decision:'approve'})}>Approve</V2Button><V2Button variant="secondary" disabled={review.isPending} onClick={() => review.mutate({memberId: applicant.memberId, decision:'reject'})}>Reject</V2Button></div></li>)}</ul>}
    {review.isError && <p role="alert" className="mt-2 text-sm text-red-700">We could not update that request. Refresh and try again.</p>}
  </V2Card></section>;
}
