import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { V2DiscoverableChallenge } from '../../api/challengeDiscoveryApi';
import type { V2DiscoverableGroup } from '../../api/groupsApi';
import { useV2ChallengeDiscovery } from '../challenges/useChallengeDiscovery';
import { flattenDiscoveryPages } from '../challenges/discoveryRelevance';
import { challengeTypeLabel, formatDayRange } from '../challenges/challengeCreationDraft';
import { endStateFor, statusLabelForEndState } from '../challenges/challengeEndState';
import { statusTone } from '../challenges/challengePresentation';
import { useV2GroupDiscovery } from '../groups/useV2Groups';
import { V2Button } from '../components/V2Primitives';
import { V2ChallengeCover } from '../challenges/V2ChallengeCover';
import { V2GroupCover } from '../groups/V2GroupCover';
import {
  buildSuggestions,
  recommendedChallenges,
  recommendedGroups,
  relevanceOf,
  suggestionCaption,
  type TodaySuggestion,
} from './todayDiscovery';

/**
 * TIIZI-V2-UX-008 — the new-member Today experience.
 *
 * Founder direction (26 November 2026): the Today screen for a member without
 * active Challenges was too text-heavy and spent its space on detailed
 * discovery explanations. This section is one compact "Suggested for you"
 * presentation:
 *
 * - Groups and Challenges share ONE list, so the member sees one coherent set
 *   of suggestions instead of two disconnected sections;
 * - a card carries a cover image when a persisted, authorized cover exists,
 *   the name, the entity type, concise context, and ONE clear next action;
 * - the interest/goal matching basis is explained ONCE for the section; cards
 *   carry label-level badges, never a repeated per-card matching sentence;
 * - full Group and Challenge Discovery stays reachable from the section;
 * - no cover is ever invented: a card with no persisted cover renders the
 *   governed fallback, never substitute photography;
 * - joining is never offered here: the Challenge projection asserts
 *   `joinability: 'not_asserted'`, so a card opens the governed surface.
 */
export function V2TodaySuggestedForYou() {
  const navigate = useNavigate();
  const groups = useV2GroupDiscovery('', 'relevance');
  // Covers are part of the suggestion card (UX-008), so the Challenge
  // discovery projection must carry its media projection.
  const challenges = useV2ChallengeDiscovery('relevance', true);
  const groupPages = groups.data?.pages ?? [];
  const challengePages = challenges.data?.pages ?? [];
  const groupRows = recommendedGroups(groupPages.flatMap((page) => page.groups)).slice(0, 3);
  const challengeRows = recommendedChallenges(flattenDiscoveryPages(challenges.data?.pages)).slice(0, 3);
  const suggestions = buildSuggestions(groupRows, challengeRows);

  const nextChallengeCursor = challengePages[challengePages.length - 1]?.nextCursor ?? null;
  const requestedChallengeCursors = challenges.data?.pageParams ?? [];
  const repeatedChallengeCursor = nextChallengeCursor !== null && requestedChallengeCursors.includes(nextChallengeCursor);
  const insufficientChallenges = challengeRows.length < 3;
  const challengePaginationStalled = insufficientChallenges && challenges.hasNextPage
    && !challenges.isLoading && !challenges.isError && !challenges.isFetchingNextPage && !challenges.isFetchNextPageError
    && (!nextChallengeCursor || repeatedChallengeCursor);

  const nextGroupCursor = groupPages[groupPages.length - 1]?.nextCursor ?? null;
  const requestedGroupCursors = groups.data?.pageParams ?? [];
  const repeatedGroupCursor = nextGroupCursor !== null && requestedGroupCursors.includes(nextGroupCursor);
  const insufficientGroups = groupRows.length < 3;
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

  const caption = suggestionCaption(suggestions, {
    groups: groupPages[0]?.ranking?.applied,
    challenges: challengePages[0]?.ranking?.applied,
  });
  const loading = (groups.isLoading && groupRows.length === 0) || (challenges.isLoading && challengeRows.length === 0);
  const failed = (groups.isError && !groups.data) || (challenges.isError && !challenges.data);
  const exhausted = groups.isSuccess && challenges.isSuccess && suggestions.length === 0
    && !groups.hasNextPage && !challenges.hasNextPage
    && !groups.isFetchingNextPage && !challenges.isFetchingNextPage
    && !groupPaginationStalled && !challengePaginationStalled;

  return (
    <section aria-labelledby="today-suggested" className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="today-suggested" className="text-base font-black text-slate-900">Suggested for you</h2>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => navigate('/v2/groups')} className="text-sm font-bold text-primary underline">Browse Groups</button>
          <button type="button" onClick={() => navigate('/v2/challenges')} className="text-sm font-bold text-primary underline">Browse Challenges</button>
        </div>
      </div>
      <p className="mt-1 text-sm text-slate-600">{caption.text}</p>

      {loading && <p role="status" className="mt-3 text-sm text-slate-500">Finding suggestions…</p>}
      {failed && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          We couldn’t load all suggestions. You can browse Groups and Challenges now or try again later.
        </p>
      )}
      {(groups.isFetchNextPageError || challenges.isFetchNextPageError || groupPaginationStalled || challengePaginationStalled) && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          We couldn’t continue loading suggestions. Showing what is available now. You can browse Groups and Challenges at any time.
        </p>
      )}
      {exhausted && (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-bold text-slate-900">Nothing to suggest right now</p>
          <p className="mt-1 text-sm text-slate-600">
            There are no Groups or Challenges to suggest yet. Browse everything and check back later.
          </p>
        </div>
      )}

      {suggestions.length > 0 && (
        <ul className="mt-3 space-y-2">
          {suggestions.map((suggestion) => (
            <li key={suggestion.kind === 'group' ? `group-${suggestion.group.id}` : `challenge-${suggestion.challenge.challengeId}`}>
              {suggestion.kind === 'group'
                ? <GroupSuggestionCard group={suggestion.group} onOpen={() => navigate(`/v2/groups/${suggestion.group.id}`)} />
                : <ChallengeSuggestionCard challenge={suggestion.challenge} onOpenChallenge={() => navigate(`/v2/challenges/discovery/${suggestion.challenge.challengeId}`)} onOpenGroup={() => navigate(`/v2/groups/${suggestion.challenge.host.groupId}`, { state: { returnTo: `/v2/challenges/discovery/${suggestion.challenge.challengeId}` } })} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * TIIZI-V2-UX-008 — label-level match markers, not explanations.
 *
 * The section caption states the matching basis once. A card carries only the
 * matched labels as compact chips, so the detailed per-card matching
 * sentence is never repeated on every card.
 */
function MatchBadges({ suggestion }: { suggestion: TodaySuggestion }) {
  const relevance = relevanceOf(suggestion);
  if (!relevance) return null;
  const chips: Array<{ key: string; label: string; title: string }> = [
    ...relevance.interests.map((interest) => ({
      key: `interest-${interest}`,
      label: interest,
      title: `Matches your saved interest: ${interest}`,
    })),
    ...relevance.goals.map((goal) => ({
      key: `goal-${goal}`,
      label: goal,
      title: `Matches your saved goal: ${goal}`,
    })),
    ...(relevance.domains ?? []).map((domain) => ({
      key: `domain-${domain}`,
      label: domain === 'wellness' ? 'Wellness activity' : 'Fitness activity',
      title: `Matches your saved ${domain === 'wellness' ? 'wellness' : 'fitness'} interests`,
    })),
  ];
  if (chips.length === 0) return null;
  return (
    <p className="mt-1 flex flex-wrap gap-1.5 text-[11px] font-semibold text-emerald-800">
      {chips.map((chip) => (
        <span key={chip.key} title={chip.title} className="rounded-full bg-emerald-50 px-2 py-0.5">{chip.label}</span>
      ))}
    </p>
  );
}

function GroupSuggestionCard({ group, onOpen }: { group: V2DiscoverableGroup; onOpen: () => void }) {
  const admission = group.admissionMode === 'approval'
    ? 'Request to join; the Group must approve.'
    : 'Open to join.';
  const pending = group.viewerRelationship === 'pending' ? ' Your request is awaiting approval.' : '';
  const context = group.tagline || group.location || `${group.memberCount} member${group.memberCount === 1 ? '' : 's'}`;
  return (
    <article className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3">
      <V2GroupCover
        groupId={group.id}
        title={group.name}
        coverId={group.coverId}
        coverImage={group.coverImage}
        heightClass="h-20"
        className="w-20 shrink-0 rounded-lg"
        overlay={false}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">Group</span>
        </div>
        <p className="mt-1 font-bold text-slate-900">{group.name}</p>
        <p className="mt-0.5 text-xs text-slate-600">{context}</p>
        <MatchBadges suggestion={{ kind: 'group', group }} />
        <p className="mt-1 text-xs text-slate-500">{admission}{pending}</p>
        <V2Button className="mt-2" variant="secondary" onClick={onOpen}>View Group</V2Button>
      </div>
    </article>
  );
}

function ChallengeSuggestionCard({
  challenge,
  onOpenChallenge,
  onOpenGroup,
}: {
  challenge: V2DiscoverableChallenge;
  onOpenChallenge: () => void;
  onOpenGroup: () => void;
}) {
  const endState = endStateFor(challenge);
  const groupName = challenge.host.groupName ?? challenge.groupName ?? 'a Group';
  const participation = challenge.host.viewerRelationship === 'pending'
    ? 'Your Group request is awaiting approval.'
    : challenge.host.admissionMode === 'approval'
      ? 'Request Group membership; approval is required before taking part.'
      : 'Join the Group to view participation details and choose whether to join this Challenge.';
  return (
    <article className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3">
      <V2ChallengeCover
        challengeId={challenge.challengeId}
        title={challenge.title}
        coverId={challenge.coverId ?? null}
        coverImage={challenge.coverImage}
        heightClass="h-20"
        className="w-20 shrink-0 rounded-lg"
        overlay={false}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
          <span className="rounded-full bg-orange-50 px-2 py-0.5 text-primary">Challenge</span>
          <span className="rounded-full bg-orange-50 px-2 py-0.5 text-primary">{challengeTypeLabel(challenge.challengeType)}</span>
          <span className={`rounded-full px-2 py-0.5 ${statusTone(endState)}`}>
            {challenge.status === 'establishment' ? 'Upcoming' : statusLabelForEndState(challenge.status, endState)}
          </span>
        </div>
        <p className="mt-1 font-bold text-slate-900">{challenge.title}</p>
        <p className="mt-0.5 text-xs text-slate-600">Hosted by {groupName} · {formatDayRange(challenge.startDate, challenge.endDate)}</p>
        <MatchBadges suggestion={{ kind: 'challenge', challenge }} />
        <p className="mt-1 text-xs text-slate-500">{participation}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <V2Button onClick={onOpenChallenge}>View Challenge</V2Button>
          <V2Button variant="secondary" onClick={onOpenGroup}>View Group</V2Button>
        </div>
      </div>
    </article>
  );
}
