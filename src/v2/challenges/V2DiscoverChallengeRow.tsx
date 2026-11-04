import { useNavigate } from 'react-router-dom';
import { ApiError } from '../../api/apiClient';
import type { V2DiscoverableChallenge } from '../../api/challengeDiscoveryApi';
import { useAuth } from '../../hooks/useAuth';
import { V2Button } from '../components/V2Primitives';
import { useJoinGroup } from '../groups/useV2Groups';
import { challengeTypeLabel, formatDayRange } from './challengeCreationDraft';
import { endStateFor, statusLabelForEndState } from './challengeEndState';
import { statusTone } from './challengePresentation';
import { saveChallengeIntent } from './challengeIntent';
import { effectiveRelationship, relevanceBadges } from './discoveryRelevance';

/** Existing governed Group join action for cross-Group discovery results. */
export function V2DiscoverChallengeRow({
  challenge,
  discoveryUpdatedAt,
}: {
  challenge: V2DiscoverableChallenge;
  discoveryUpdatedAt: number;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const join = useJoinGroup(challenge.host.groupId);
  const groupName = challenge.host.groupName ?? challenge.groupName ?? 'the hosting Group';
  const relation = effectiveRelationship(
    challenge.host.viewerRelationship,
    join.isSuccess ? { status: join.status, submittedAt: join.submittedAt, resultStatus: join.data.status } : null,
    discoveryUpdatedAt,
  );
  const pending = relation === 'pending';
  const requiresApproval = challenge.host.admissionMode === 'approval';
  const endState = endStateFor(challenge);
  const badges = relevanceBadges(challenge.relevance);
  const error = join.isError && join.error instanceof ApiError && join.error.status === 503
    ? 'Tiizi is unavailable. Please try again.'
    : 'We could not send your request. Please try again.';

  const requestJoin = () => {
    saveChallengeIntent(user?.uid, {
      challengeId: challenge.challengeId,
      title: challenge.title,
      groupId: challenge.host.groupId,
      groupName,
    });
    join.mutate();
  };

  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4" data-explore-challenge={challenge.challengeId}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-primary">{challengeTypeLabel(challenge.challengeType)}</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusTone(endState)}`}>{statusLabelForEndState(challenge.status, endState)}</span>
        {badges.map((badge) => <span key={badge} className="max-w-full truncate rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800">{badge}</span>)}
      </div>
      <p className="mt-1 text-sm font-black text-slate-900">{challenge.title}</p>
      <p className="mt-0.5 text-xs text-slate-500">Hosted by {groupName} · {formatDayRange(challenge.startDate, challenge.endDate)}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {pending ? (
          <>
            <span role="status" className="rounded-full bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">Request sent — waiting for {groupName} to approve</span>
            <V2Button variant="secondary" onClick={() => navigate(`/v2/groups/${challenge.host.groupId}`)}>View Group</V2Button>
          </>
        ) : (
          <>
            <V2Button disabled={join.isPending} onClick={requestJoin}>
              {join.isPending ? 'Sending…' : requiresApproval ? `Request to join ${groupName}` : endState === 'live' ? `Join ${groupName} to take part` : `Join ${groupName}`}
            </V2Button>
            <V2Button variant="secondary" onClick={() => navigate(`/v2/groups/${challenge.host.groupId}`)}>View Group</V2Button>
          </>
        )}
      </div>
      {!pending && <p className="mt-1.5 text-[11px] text-slate-500">
        {requiresApproval
          ? 'This Group reviews requests. You will not be added to the Challenge automatically.'
          : endState === 'live'
            ? 'Joining the Group does not enroll you in the Challenge — you choose that separately.'
            : 'This Challenge has finished. Joining the Group does not enroll you in anything.'}
      </p>}
      {join.isError && <p role="alert" className="mt-1 text-[11px] text-red-700">{error}</p>}
    </li>
  );
}
