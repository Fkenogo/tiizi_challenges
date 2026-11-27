import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createRefreshTracker, flattenDiscoveryPages } from '../challenges/discoveryRelevance';
import { useV2ChallengeDiscovery } from '../challenges/useChallengeDiscovery';
import { V2DiscoverChallengeRow } from '../challenges/V2DiscoverChallengeRow';
import { V2DiscoverGroupRow } from '../groups/V2GroupDiscoveryPanel';
import { useV2GroupDiscovery } from '../groups/useV2Groups';
import {
  recommendedChallenges,
  recommendedGroups,
  TODAY_DISCOVERY_LIMIT,
} from './todayDiscovery';

/**
 * TIIZI-V2-UX-008-VISUAL-CORR-001 — Today discovery sections for members
 * without active Challenges.
 *
 * Renders up to TWO discoverable Challenges and up to TWO discoverable Groups
 * using the canonical Challenge and Group card components (`V2DiscoverChallengeRow`
 * and `V2DiscoverGroupRow`), placed in dedicated non-participation discovery
 * areas after the normal Today empty/ongoing-challenges structure.
 */
export function V2TodayDiscoverySections() {
  const navigate = useNavigate();
  const groups = useV2GroupDiscovery('', 'relevance');
  const challenges = useV2ChallengeDiscovery('relevance', true);
  const refreshTracker = useRef(createRefreshTracker());
  const challengeUpdatedAt = refreshTracker.current.observe(challenges.dataUpdatedAt, challenges.isFetchingNextPage);

  const groupPages = groups.data?.pages ?? [];
  const challengePages = challenges.data?.pages ?? [];
  const groupRows = recommendedGroups(groupPages.flatMap((page) => page.groups)).slice(0, TODAY_DISCOVERY_LIMIT);
  const challengeRows = recommendedChallenges(flattenDiscoveryPages(challenges.data?.pages)).slice(0, TODAY_DISCOVERY_LIMIT);

  const nextChallengeCursor = challengePages[challengePages.length - 1]?.nextCursor ?? null;
  const requestedChallengeCursors = challenges.data?.pageParams ?? [];
  const repeatedChallengeCursor = nextChallengeCursor !== null && requestedChallengeCursors.includes(nextChallengeCursor);
  const insufficientChallenges = challengeRows.length < TODAY_DISCOVERY_LIMIT;
  const challengePaginationStalled = insufficientChallenges && challenges.hasNextPage
    && !challenges.isLoading && !challenges.isError && !challenges.isFetchingNextPage && !challenges.isFetchNextPageError
    && (!nextChallengeCursor || repeatedChallengeCursor);

  const nextGroupCursor = groupPages[groupPages.length - 1]?.nextCursor ?? null;
  const requestedGroupCursors = groups.data?.pageParams ?? [];
  const repeatedGroupCursor = nextGroupCursor !== null && requestedGroupCursors.includes(nextGroupCursor);
  const insufficientGroups = groupRows.length < TODAY_DISCOVERY_LIMIT;
  const groupPaginationStalled = insufficientGroups && groups.hasNextPage
    && !groups.isLoading && !groups.isError && !groups.isFetchingNextPage && !groups.isFetchNextPageError
    && (!nextGroupCursor || repeatedGroupCursor);

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

  const challengesLoading = challenges.isLoading && challengeRows.length === 0;
  const challengesFailed = challenges.isError && !challenges.data;
  const challengesEmpty = challenges.isSuccess && challengeRows.length === 0
    && !challenges.hasNextPage && !challenges.isFetchingNextPage && !challengePaginationStalled;

  const groupsLoading = groups.isLoading && groupRows.length === 0;
  const groupsFailed = groups.isError && !groups.data;
  const groupsEmpty = groups.isSuccess && groupRows.length === 0
    && !groups.hasNextPage && !groups.isFetchingNextPage && !groupPaginationStalled;

  return (
    <div className="mt-6 space-y-6">
      <section aria-labelledby="today-discover-challenges">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="today-discover-challenges" className="text-base font-black text-slate-900">Discover Challenges</h2>
          <button type="button" onClick={() => navigate('/v2/challenges')} className="text-sm font-bold text-primary underline">Browse Challenges</button>
        </div>
        {challengesLoading && <p role="status" className="mt-3 text-sm text-slate-500">Finding Challenges…</p>}
        {challenges.isFetchingNextPage && <p role="status" className="mt-3 text-sm text-slate-500">Finding more Challenges…</p>}
        {challengesFailed && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            We couldn’t load discoverable Challenges right now. You can browse Challenges at any time.
          </p>
        )}
        {(challenges.isFetchNextPageError || challengePaginationStalled) && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            We couldn’t continue loading Challenges. Showing what is available now.
          </p>
        )}
        {challengesEmpty && (
          <p className="mt-3 text-sm text-slate-600">No discoverable Challenges to show right now.</p>
        )}
        {challengeRows.length > 0 && (
          <ul aria-label="Discover Challenges" className="mt-3 space-y-3">
            {challengeRows.map((challenge) => (
              <V2DiscoverChallengeRow
                key={challenge.challengeId}
                challenge={challenge}
                discoveryUpdatedAt={challengeUpdatedAt}
              />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="today-discover-groups">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="today-discover-groups" className="text-base font-black text-slate-900">Discover Groups</h2>
          <button type="button" onClick={() => navigate('/v2/groups?tab=discover')} className="text-sm font-bold text-primary underline">Browse Groups</button>
        </div>
        {groupsLoading && <p role="status" className="mt-3 text-sm text-slate-500">Finding Groups…</p>}
        {groups.isFetchingNextPage && <p role="status" className="mt-3 text-sm text-slate-500">Finding more Groups…</p>}
        {groupsFailed && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            We couldn’t load discoverable Groups right now. You can browse Groups at any time.
          </p>
        )}
        {(groups.isFetchNextPageError || groupPaginationStalled) && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            We couldn’t continue loading Groups. Showing what is available now.
          </p>
        )}
        {groupsEmpty && (
          <p className="mt-3 text-sm text-slate-600">No discoverable Groups to show right now.</p>
        )}
        {groupRows.length > 0 && (
          <ul aria-label="Discover Groups" className="mt-3 space-y-3">
            {groupRows.map((group) => (
              <V2DiscoverGroupRow
                key={group.id}
                group={group}
                onOpen={(id) => navigate(`/v2/groups/${id}`)}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
