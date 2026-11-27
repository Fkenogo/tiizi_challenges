import { describe, expect, it } from 'vitest';
import {
  buildSuggestions,
  recommendedChallenges,
  recommendedGroups,
  showTodayDiscoveryRecommendations,
  suggestionCaption,
} from './todayDiscovery';
import type { V2DiscoverableChallenge } from '../../api/challengeDiscoveryApi';
import type { V2DiscoverableGroup } from '../../api/groupsApi';

const group = (id: string, relationship: V2DiscoverableGroup['viewerRelationship'], relevance: V2DiscoverableGroup['relevance'] = { interests: [], goals: [] }): V2DiscoverableGroup => ({
  id, name: id, description: '', tagline: '', coverId: null, location: '', focusTags: [], goals: [], memberCount: 1,
  admissionMode: 'approval', viewerRelationship: relationship, relevance,
});
const challenge = (
  id: string,
  relevance: V2DiscoverableChallenge['relevance'],
  lifecycle: Partial<Pick<V2DiscoverableChallenge, 'status' | 'finalized' | 'governingToday' | 'startDate' | 'endDate'>> = {},
): V2DiscoverableChallenge => ({
  challengeId: id, title: id, groupId: 'g', groupName: 'Group', activities: [], description: '', challengeType: 'collective', status: 'active',
  startDate: '2026-10-01', endDate: '2026-12-01', timezone: 'UTC', governingToday: '2026-11-04', finalized: false,
  currentConfigVersion: 1, goalValue: null, goalUnit: null, collectiveTotal: 0, collectiveGoalReached: false, completionsCount: 0, myParticipation: null,
  host: { groupId: 'g', groupName: 'Group', admissionMode: 'approval', viewerRelationship: 'none' }, relevance,
  ...lifecycle,
});

describe('Today discovery selection', () => {
  it('uses exact saved preference matches when present', () => {
    expect(recommendedGroups([group('match', 'none', { interests: ['Fitness'], goals: [] }), group('other', 'none')]).map((x) => x.id)).toEqual(['match']);
    expect(recommendedChallenges([challenge('match', { interests: [], goals: ['Build strength'], domains: [] }), challenge('other', { interests: [], goals: [], domains: [] })]).map((x) => x.challengeId)).toEqual(['match']);
  });
  it('falls back to general discovery when preferences or exact matches are absent', () => {
    expect(recommendedGroups([group('one', 'none'), group('two', 'none')]).map((x) => x.id)).toEqual(['one', 'two']);
    expect(recommendedChallenges([challenge('one', { interests: [], goals: [], domains: [] })]).map((x) => x.challengeId)).toEqual(['one']);
  });
  it('excludes joined and steward Groups while preserving pending approval status', () => {
    expect(recommendedGroups([group('joined', 'member'), group('steward', 'steward'), group('pending', 'pending')]).map((x) => x.id)).toEqual(['pending']);
  });
  it('deduplicates eligible Groups across discovery pages while preserving server order', () => {
    expect(recommendedGroups([
      group('first', 'none'),
      group('joined', 'member'),
      group('first', 'pending'),
      group('second', 'none'),
    ]).map((x) => x.id)).toEqual(['first', 'second']);
  });
  it('uses actionable unmatched Challenges when all preference matches are closed', () => {
    const matched = { interests: ['Walking'], goals: [], domains: [] };
    const unmatched = { interests: [], goals: [], domains: [] };
    expect(recommendedChallenges([
      challenge('ended-match', matched, { status: 'ended' }),
      challenge('finalized-match', matched, { finalized: true }),
      challenge('expired-match', matched, { governingToday: '2026-12-02' }),
      challenge('actionable-unmatched', unmatched),
    ]).map((x) => x.challengeId)).toEqual(['actionable-unmatched']);
  });
  it('states the matching basis once for the section instead of once per card', () => {
    const matched = buildSuggestions(
      [group('match', 'none', { interests: ['Strength'], goals: [] })],
      [challenge('match', { interests: [], goals: ['Build strength'], domains: [] })],
    );
    expect(suggestionCaption(matched, { groups: true, challenges: true })).toEqual({
      kind: 'matched',
      text: 'Group and Challenge suggestions are ranked by your interests and goals. You can browse everything at any time.',
    });
    expect(suggestionCaption(matched, { groups: true, challenges: false }).kind).toBe('no-preferences');
    // An unknown ranking state never becomes a "nothing matched" claim.
    expect(suggestionCaption(matched, { groups: undefined, challenges: undefined }).kind).toBe('no-preferences');
    expect(suggestionCaption(matched, {}).kind).toBe('no-preferences');
    expect(suggestionCaption(
      buildSuggestions([group('other', 'none')], [challenge('other', { interests: [], goals: [], domains: [] })]),
      { groups: true, challenges: true },
    ).kind).toBe('unmatched');
  });
  it('combines Groups and Challenges into one list without changing either order', () => {
    const suggestions = buildSuggestions(
      [group('g1', 'none'), group('g2', 'none')],
      [challenge('c1', { interests: [], goals: [], domains: [] }), challenge('c2', { interests: [], goals: [], domains: [] })],
    );
    expect(suggestions.map((suggestion) => suggestion.kind === 'group' ? suggestion.group.id : suggestion.challenge.challengeId))
      .toEqual(['c1', 'g1', 'c2', 'g2']);
  });
  it('bounds the section so Today never becomes a directory', () => {
    const suggestions = buildSuggestions(
      Array.from({ length: 9 }, (_, index) => group(`g${index}`, 'none')),
      Array.from({ length: 9 }, (_, index) => challenge(`c${index}`, { interests: [], goals: [], domains: [] })),
    );
    expect(suggestions).toHaveLength(6);
  });
  it('shows discovery only when the server reports no active Challenges', () => {
    expect(showTodayDiscoveryRecommendations(0)).toBe(true);
    expect(showTodayDiscoveryRecommendations(1)).toBe(false);
  });
});
