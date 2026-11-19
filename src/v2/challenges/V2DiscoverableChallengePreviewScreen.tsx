import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { V2Button, V2ErrorState, V2LoadingState, V2Page, V2Sheet } from '../components/V2Primitives';
import { useV2GroupDetail } from '../groups/useV2Groups';
import { useV2ChallengeDiscovery } from './useChallengeDiscovery';
import { flattenDiscoveryPages, relevanceBadges } from './discoveryRelevance';
import { challengeTypeLabel, formatDayRange } from './challengeCreationDraft';
import { endStateFor, statusLabelForEndState } from './challengeEndState';
import { statusTone } from './challengePresentation';
import { lifecycleBucket } from './challengeDiscovery';
import { useChallengeDetailV2, useJoinChallengeV2 } from './useChallengeCreation';

/** Safe outsider preview. The participant-only detail API remains membership-gated. */
export function V2DiscoverableChallengePreviewScreen() {
  const { challengeId } = useParams();
  const navigate = useNavigate();
  const joinChallenge = useJoinChallengeV2();
  const [joinOpen, setJoinOpen] = useState(false);
  useEffect(() => {
    if (joinChallenge.isSuccess) setJoinOpen(false);
  }, [joinChallenge.isSuccess]);
  const discovery = useV2ChallengeDiscovery('relevance');
  const rows = flattenDiscoveryPages(discovery.data?.pages);
  const discoveredChallenge = rows.find((item) => item.challengeId === challengeId);
  const lastPage = discovery.data?.pages.at(-1);
  const nextCursor = lastPage?.nextCursor ?? null;
  const requestedCursors = discovery.data?.pageParams ?? [];
  const repeatedCursor = nextCursor !== null && requestedCursors.includes(nextCursor);
  const paginationStalled = !discoveredChallenge && discovery.hasNextPage && !discovery.isLoading
    && !discovery.isError && !discovery.isFetchingNextPage && !discovery.isFetchNextPageError
    && (!nextCursor || repeatedCursor);
  useEffect(() => {
    if (!discoveredChallenge && discovery.hasNextPage && nextCursor && !repeatedCursor
      && !discovery.isLoading && !discovery.isFetchingNextPage && !discovery.isError && !discovery.isFetchNextPageError) {
      void discovery.fetchNextPage();
    }
  }, [discoveredChallenge, discovery.hasNextPage, discovery.isLoading, discovery.isFetchingNextPage, discovery.isFetchNextPageError, discovery.isError, discovery.fetchNextPage, nextCursor, repeatedCursor]);
  // Joining an open Group removes its Challenges from outsider discovery. The
  // regular detail read provides the member preview and keeps requireChallengeVisible
  // as the server authorization boundary.
  const discoveryComplete = !discovery.isLoading && !discovery.isError && !discovery.hasNextPage && !discovery.isFetchingNextPage;
  const detail = useChallengeDetailV2(challengeId, discoveryComplete && !discoveredChallenge);
  const hostGroup = useV2GroupDetail(detail.data?.groupId ?? null);
  const challenge = discoveredChallenge ?? (detail.data && hostGroup.data ? {
    ...detail.data,
    host: {
      groupId: detail.data.groupId,
      groupName: detail.data.groupName ?? hostGroup.data.name,
      admissionMode: hostGroup.data.requireAdminApproval ? 'approval' as const : 'open' as const,
      viewerRelationship: hostGroup.data.viewerRelationship,
    },
    relevance: { interests: [], goals: [], domains: [] as Array<'fitness' | 'wellness'> },
  } : undefined);
  if (discovery.isLoading) return <V2Page><V2LoadingState label="Loading Challenge…" /></V2Page>;
  if (discovery.isFetchNextPageError) return <V2Page><V2ErrorState title="We couldn’t finish checking this Challenge" message="Please try again." onRetry={() => void discovery.fetchNextPage()} /></V2Page>;
  if (discovery.isError) return <V2Page><V2ErrorState title="We couldn’t load this Challenge" message="Please try again." onRetry={() => void discovery.refetch()} /></V2Page>;
  if (!challenge && discovery.isFetchingNextPage) return <V2Page><V2LoadingState label="Finding this Challenge…" /></V2Page>;
  if (!challenge && paginationStalled) return <V2Page><V2ErrorState title="We couldn’t finish checking this Challenge" message="Please try again." onRetry={() => void discovery.refetch()} /></V2Page>;
  if (!challenge && (detail.isLoading || (Boolean(detail.data?.groupId) && hostGroup.isLoading))) {
    return <V2Page><V2LoadingState label="Checking your Group access…" /></V2Page>;
  }
  if (!challenge) return <V2Page><V2ErrorState title="This Challenge is no longer available" message="It may no longer be open to discovery. Explore current Challenges to see what is available." /></V2Page>;
  const state = endStateFor(challenge);
  const lifecycle = lifecycleBucket(challenge);
  const statusLabel = lifecycle === 'upcoming' ? 'Upcoming' : statusLabelForEndState(challenge.status, state);
  const joinSucceededForCurrentChallenge = joinChallenge.isSuccess && joinChallenge.variables === challenge.challengeId;
  const joinFailedForCurrentChallenge = joinChallenge.isError && joinChallenge.variables === challenge.challengeId;
  return <V2Page>
    <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Challenge preview</p>
    <h1 className="mt-1 text-2xl font-black text-slate-900">{challenge.title}</h1>
    <p className="mt-2 text-sm text-slate-600">Hosted by {challenge.host.groupName ?? challenge.groupName ?? 'a Group'}</p>
    <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
      <span className="rounded-full bg-orange-50 px-2 py-1 text-primary">{challengeTypeLabel(challenge.challengeType)}</span>
      <span className={`rounded-full px-2 py-1 ${statusTone(state)}`}>{statusLabel}</span>
    </div>
    <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">{challenge.description || 'No description provided.'}</p>
    <p className="mt-3 text-sm text-slate-600">{formatDayRange(challenge.startDate, challenge.endDate)}</p>
    <h2 className="mt-5 font-bold text-slate-900">Activities</h2>
    <ul className="mt-2 list-inside list-disc text-sm text-slate-700">{challenge.activities.map((activity, index) => <li key={`${activity.name}-${index}`}>{activity.name} · {activity.domain === 'wellness' ? 'Wellness' : 'Fitness'}{activity.category ? ` · ${activity.category}` : ''}</li>)}</ul>
    {relevanceBadges(challenge.relevance).map((badge) => <p key={badge} className="mt-2 text-xs text-emerald-800">{badge}</p>)}
    {(challenge.host.viewerRelationship === 'none' || challenge.host.viewerRelationship === 'pending') && <p className="mt-5 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
      {challenge.host.viewerRelationship === 'pending'
        ? 'Your request to join the hosting Group is awaiting approval.'
        : challenge.host.admissionMode === 'approval'
          ? 'You need the hosting Group’s approval before you can view participation details or take part.'
          : 'Join the hosting Group to view participation details. Joining a Group does not enroll you in this Challenge.'}
    </p>}
    {challenge.host.viewerRelationship === 'pending' && <p role="status" className="mt-3 text-sm font-semibold text-amber-800">Your Group membership request is pending approval. The Challenge remains unavailable for participation until the Group approves you.</p>}
    <div className="mt-5">
      <V2Button variant="secondary" onClick={() => navigate(`/v2/groups/${challenge.host.groupId}`, { state: { returnTo: `/v2/challenges/discovery/${challenge.challengeId}` } })}>View hosting Group</V2Button>
      {(challenge.host.viewerRelationship === 'member' || challenge.host.viewerRelationship === 'steward') && state === 'live' && (
        <div className="mt-3">
          {joinSucceededForCurrentChallenge ? (
            <p role="status" className="text-sm font-semibold text-emerald-800">You joined this Challenge.</p>
          ) : challenge.myParticipation?.status === 'active' ? (
            <p role="status" className="text-sm font-semibold text-slate-700">You’re already taking part in this Challenge.</p>
          ) : (
            <>
              <V2Button disabled={joinChallenge.isPending} onClick={() => setJoinOpen(true)}>
                {joinChallenge.isPending ? 'Joining Challenge…' : 'Join Challenge'}
              </V2Button>
              {joinFailedForCurrentChallenge && !joinOpen && <p role="alert" className="mt-2 text-sm text-red-700">We couldn’t join this Challenge. Please try again.</p>}
              <V2Sheet open={joinOpen} onClose={() => setJoinOpen(false)} title={`Join ${challenge.title}?`} variant="member">
                <p className="text-sm leading-6 text-slate-600">
                  Joining starts your participation in this Challenge. Membership in {challenge.host.groupName ?? challenge.groupName ?? 'the hosting Group'} does not join you automatically — this is your explicit choice.
                </p>
                {joinFailedForCurrentChallenge && <p role="alert" className="mt-2 text-xs font-bold text-red-600">We couldn’t join this Challenge. Please try again.</p>}
                <div className="mt-4 flex justify-end gap-2">
                  <V2Button variant="ghost" onClick={() => setJoinOpen(false)}>Not now</V2Button>
                  <V2Button disabled={joinChallenge.isPending} onClick={() => joinChallenge.mutate(challenge.challengeId)}>
                    {joinChallenge.isPending ? 'Joining…' : 'Join Challenge'}
                  </V2Button>
                </div>
              </V2Sheet>
            </>
          )}
        </div>
      )}
    </div>
  </V2Page>;
}
