import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../../api/apiClient';
import type { V2DiscoverableChallenge } from '../../api/challengeDiscoveryApi';
import type { V2DiscoveryRank } from '../../api/groupsApi';
import { useAuth } from '../../hooks/useAuth';
import { V2Button, V2Chip, V2EmptyState, V2ErrorState, V2LoadingState } from '../components/V2Primitives';
import { useJoinGroup } from '../groups/useV2Groups';
import { challengeTypeLabel, formatDayRange } from './challengeCreationDraft';
import { endStateFor, statusLabelForEndState } from './challengeEndState';
import { statusTone } from './V2ChallengeListScreen';
import { saveChallengeIntent } from './challengeIntent';
import { discoveryCaption, relevanceBadges } from './discoveryRelevance';
import { useV2ChallengeDiscovery } from './useChallengeDiscovery';

/**
 * TIIZI-FER-P2-001 — "Explore Challenges": Challenges hosted by discoverable
 * Groups the member is not in yet, ordered by saved preferences when any
 * match. Ordering only: every discoverable Challenge stays listed.
 *
 * Journey (existing authority, nothing bypassed): the member asks to join the
 * hosting Group (immediate, or a request the Group's steward approves); once
 * they are a member the Challenge moves to their own list and they continue to
 * it; joining the Challenge itself is a separate, explicit step on its detail.
 */
export function V2ExploreChallenges() {
  const [ordering, setOrdering] = useState<V2DiscoveryRank>('relevance');
  const discovery = useV2ChallengeDiscovery(ordering);
  const challenges = discovery.data?.challenges ?? [];
  const caption = discovery.isSuccess
    ? discoveryCaption(ordering, discovery.data.ranking.applied, challenges, 'Challenges')
    : null;

  return (
    <section aria-label="Explore Challenges" className="mt-8 space-y-3">
      <div>
        <h2 className="text-base font-black text-slate-900">Explore Challenges</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Challenges hosted by Groups open to discovery. To take part, join the hosting Group first.
        </p>
      </div>
      <div role="group" aria-label="Order Challenges" className="flex flex-wrap gap-1.5">
        <V2Chip selected={ordering === 'relevance'} onClick={() => setOrdering('relevance')}>Relevant to me</V2Chip>
        <V2Chip selected={ordering === 'general'} onClick={() => setOrdering('general')}>Browse all</V2Chip>
      </div>
      {caption && <p role="status" data-discovery-caption={caption.kind} className="text-xs text-slate-600">{caption.text}</p>}

      {discovery.isLoading && <V2LoadingState label="Finding Challenges…" />}
      {discovery.isError && (
        <V2ErrorState
          title="Discovery is unavailable"
          message="We could not load more Challenges to explore. Your own Challenges above are not affected."
          onRetry={() => void discovery.refetch()}
        />
      )}
      {discovery.isSuccess && challenges.length === 0 && (
        <V2EmptyState title="Nothing to explore yet" message="When open Groups host Challenges, they will appear here." />
      )}
      <ul aria-label="Challenges to explore" className="space-y-2">
        {challenges.map((challenge) => <ExploreRow key={challenge.challengeId} challenge={challenge} />)}
      </ul>
    </section>
  );
}

function ExploreRow({ challenge }: { challenge: V2DiscoverableChallenge }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const join = useJoinGroup(challenge.host.groupId);
  const groupName = challenge.host.groupName ?? challenge.groupName ?? 'the hosting Group';
  const relation = join.isSuccess ? (join.data.status === 'pending' ? 'pending' : 'member') : challenge.host.viewerRelationship;
  const pending = relation === 'pending';
  const requiresApproval = challenge.host.admissionMode === 'approval';
  const endState = endStateFor(challenge);
  const badges = relevanceBadges(challenge.relevance);
  const error = join.isError && join.error instanceof ApiError && join.error.status === 503
    ? 'Tiizi is unavailable. Please try again.'
    : 'We could not send your request. Please try again.';

  const requestJoin = () => {
    // Return context only; the join itself is the existing governed mutation.
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
        {badges.map((badge) => (
          <span key={badge} className="max-w-full truncate rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800">{badge}</span>
        ))}
      </div>
      <p className="mt-1 text-sm font-black text-slate-900">{challenge.title}</p>
      <p className="mt-0.5 text-xs text-slate-500">
        Hosted by {groupName} · {formatDayRange(challenge.startDate, challenge.endDate)}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {pending ? (
          <>
            <span role="status" className="rounded-full bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
              Request sent — waiting for {groupName} to approve
            </span>
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
      {!pending && (
        <p className="mt-1.5 text-[11px] text-slate-500">
          {requiresApproval
            ? 'This Group reviews requests. You will not be added to the Challenge automatically.'
            : endState === 'live'
              ? 'Joining the Group does not enroll you in the Challenge — you choose that separately.'
              : 'This Challenge has finished. Joining the Group does not enroll you in anything.'}
        </p>
      )}
      {join.isError && <p role="alert" className="mt-1 text-[11px] text-red-700">{error}</p>}
    </li>
  );
}
