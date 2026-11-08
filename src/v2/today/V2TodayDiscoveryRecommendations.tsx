import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useV2ChallengeDiscovery } from '../challenges/useChallengeDiscovery';
import { flattenDiscoveryPages, relevanceBadges } from '../challenges/discoveryRelevance';
import { challengeTypeLabel, formatDayRange } from '../challenges/challengeCreationDraft';
import { endStateFor, statusLabelForEndState } from '../challenges/challengeEndState';
import { statusTone } from '../challenges/challengePresentation';
import { useV2GroupDiscovery } from '../groups/useV2Groups';
import { V2Button } from '../components/V2Primitives';
import { recommendedChallenges, recommendedGroups, recommendationReason } from './todayDiscovery';

export function V2TodayDiscoveryRecommendations() {
  const navigate = useNavigate();
  const groups = useV2GroupDiscovery('', 'relevance');
  const challenges = useV2ChallengeDiscovery('relevance');
  const groupPages = groups.data?.pages ?? [];
  const groupRows = recommendedGroups(groupPages.flatMap((page) => page.groups)).slice(0, 3);
  const challengeRows = recommendedChallenges(flattenDiscoveryPages(challenges.data?.pages)).slice(0, 3);
  const challengePages = challenges.data?.pages ?? [];
  const lastChallengePage = challengePages[challengePages.length - 1];
  const nextChallengeCursor = lastChallengePage?.nextCursor ?? null;
  const requestedChallengeCursors = challenges.data?.pageParams ?? [];
  const repeatedChallengeCursor = nextChallengeCursor !== null && requestedChallengeCursors.includes(nextChallengeCursor);
  const insufficientChallenges = challengeRows.length < 3;
  const challengePaginationStalled = insufficientChallenges && challenges.hasNextPage
    && !challenges.isLoading && !challenges.isError && !challenges.isFetchingNextPage && !challenges.isFetchNextPageError
    && (!nextChallengeCursor || repeatedChallengeCursor);
  const lastGroupPage = groupPages[groupPages.length - 1];
  const nextGroupCursor = lastGroupPage?.nextCursor ?? null;
  const requestedGroupCursors = groups.data?.pageParams ?? [];
  const repeatedGroupCursor = nextGroupCursor !== null && requestedGroupCursors.includes(nextGroupCursor);
  const insufficientGroups = groupRows.length < 3;
  const groupPaginationStalled = insufficientGroups && repeatedGroupCursor;

  useEffect(() => {
    if (!insufficientChallenges || !challenges.hasNextPage || !nextChallengeCursor || repeatedChallengeCursor
      || challenges.isLoading || challenges.isError || challenges.isFetchingNextPage || challenges.isFetchNextPageError) return;
    void challenges.fetchNextPage();
  }, [
    challenges.fetchNextPage,
    challenges.hasNextPage,
    challenges.isError,
    challenges.isFetchNextPageError,
    challenges.isFetchingNextPage,
    challenges.isLoading,
    insufficientChallenges,
    nextChallengeCursor,
    repeatedChallengeCursor,
  ]);

  useEffect(() => {
    if (!insufficientGroups || !groups.hasNextPage || !nextGroupCursor || repeatedGroupCursor
      || groups.isLoading || groups.isError || groups.isFetchingNextPage || groups.isFetchNextPageError) return;
    void groups.fetchNextPage();
  }, [
    groups.fetchNextPage,
    groups.hasNextPage,
    groups.isError,
    groups.isFetchNextPageError,
    groups.isFetchingNextPage,
    groups.isLoading,
    insufficientGroups,
    nextGroupCursor,
    repeatedGroupCursor,
  ]);

  return (
    <section aria-labelledby="today-discover" className="mt-6 space-y-5">
      <div>
        <h2 id="today-discover" className="text-base font-black text-slate-900">Discover what fits you</h2>
        <p className="mt-1 text-sm text-slate-600">Based on your interests and goals when they match. You can explore more at any time.</p>
      </div>
      <section aria-labelledby="today-discover-groups">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 id="today-discover-groups" className="font-bold text-slate-900">Groups to explore</h3>
          <button type="button" onClick={() => navigate('/v2/groups')} className="text-sm font-bold text-primary underline">Explore all</button>
        </div>
        {groups.isLoading && <p role="status" className="text-sm text-slate-500">Finding Groups…</p>}
        {groups.isFetchingNextPage && <p role="status" className="text-sm text-slate-500">Finding more Groups…</p>}
        {groups.isError && !groups.data && <p role="alert" className="text-sm text-red-700">We couldn’t load Group suggestions. You can explore Groups now or try again later.</p>}
        {groups.isFetchNextPageError && <p role="alert" className="text-sm text-red-700">We couldn’t load more Group suggestions. Showing the Groups already available. You can explore Groups now or try again later.</p>}
        {groupPaginationStalled && <p role="alert" className="text-sm text-red-700">We couldn’t continue loading Group suggestions. Showing the Groups already available. You can explore Groups now or try again later.</p>}
        {groups.isSuccess && groupRows.length === 0 && !groups.hasNextPage && !groups.isFetchingNextPage && !groups.isFetchNextPageError && !groupPaginationStalled && <p className="text-sm text-slate-600">No discoverable Groups are available right now. Check back later.</p>}
        <ul className="space-y-2">
          {groupRows.map((group) => {
            const reason = recommendationReason(group.relevance);
            return <li key={group.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="font-bold text-slate-900">{group.name}</p>
              {group.tagline && <p className="mt-1 text-sm text-slate-600">{group.tagline}</p>}
              {reason && <p className="mt-1 text-xs text-emerald-800">{reason}</p>}
              <p className="mt-2 text-xs text-slate-500">{group.admissionMode === 'approval' ? 'Request to join; the Group must approve.' : 'Open to join.'}{group.viewerRelationship === 'pending' ? ' Your request is awaiting approval.' : ''}</p>
              <V2Button variant="secondary" className="mt-3" onClick={() => navigate(`/v2/groups/${group.id}`)}>View Group</V2Button>
            </li>;
          })}
        </ul>
      </section>
      <section aria-labelledby="today-discover-challenges">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 id="today-discover-challenges" className="font-bold text-slate-900">Challenges to explore</h3>
          <button type="button" onClick={() => navigate('/v2/challenges')} className="text-sm font-bold text-primary underline">Explore all</button>
        </div>
        {challenges.isLoading && <p role="status" className="text-sm text-slate-500">Finding Challenges…</p>}
        {challenges.isFetchingNextPage && <p role="status" className="text-sm text-slate-500">Finding more Challenges…</p>}
        {challenges.isError && !challenges.data && <p role="alert" className="text-sm text-red-700">We couldn’t load Challenge suggestions. You can explore Challenges now or try again later.</p>}
        {challenges.isFetchNextPageError && <p role="alert" className="text-sm text-red-700">We couldn’t load more Challenge suggestions. Showing the Challenges already available. You can explore Challenges now or try again later.</p>}
        {challengePaginationStalled && <p role="alert" className="text-sm text-red-700">We couldn’t continue loading Challenge suggestions. Showing the Challenges already available. You can explore Challenges now or try again later.</p>}
        {challenges.isSuccess && challengeRows.length === 0 && !challenges.hasNextPage && !challenges.isFetchingNextPage && !challenges.isFetchNextPageError && !challengePaginationStalled && <p className="text-sm text-slate-600">No eligible Challenges are available right now. Check back later.</p>}
        <ul className="space-y-2">
          {challengeRows.map((challenge) => {
            const endState = endStateFor(challenge);
            const reason = recommendationReason(challenge.relevance);
            return <li key={challenge.challengeId} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap gap-2 text-xs font-bold">
                <span className="rounded-full bg-orange-50 px-2 py-1 text-primary">{challengeTypeLabel(challenge.challengeType)}</span>
                <span className={`rounded-full px-2 py-1 ${statusTone(endState)}`}>{challenge.status === 'establishment' ? 'Upcoming' : statusLabelForEndState(challenge.status, endState)}</span>
              </div>
              <p className="mt-2 font-bold text-slate-900">{challenge.title}</p>
              <p className="mt-1 text-xs text-slate-500">Hosted by {challenge.host.groupName ?? challenge.groupName ?? 'a Group'} · {formatDayRange(challenge.startDate, challenge.endDate)}</p>
              {reason && <p className="mt-1 text-xs text-emerald-800">{reason}</p>}
              <p className="mt-2 text-xs text-slate-500">{challenge.host.viewerRelationship === 'pending' ? 'Your Group request is awaiting approval.' : challenge.host.admissionMode === 'approval' ? 'Request Group membership; approval is required before taking part.' : 'Join the Group to view participation details and choose whether to join this Challenge.'}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <V2Button onClick={() => navigate(`/v2/challenges/discovery/${challenge.challengeId}`)}>View Challenge</V2Button>
                <V2Button variant="secondary" onClick={() => navigate(`/v2/groups/${challenge.host.groupId}`)}>View Group</V2Button>
              </div>
            </li>;
          })}
        </ul>
      </section>
    </section>
  );
}
