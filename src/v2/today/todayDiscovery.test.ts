import { describe, expect, it } from 'vitest';
import { recommendedChallenges, recommendedGroups, recommendationReason, showTodayDiscoveryRecommendations } from './todayDiscovery';
import type { V2DiscoverableChallenge } from '../../api/challengeDiscoveryApi';
import type { V2DiscoverableGroup } from '../../api/groupsApi';

const group = (id: string, relationship: V2DiscoverableGroup['viewerRelationship'], relevance: V2DiscoverableGroup['relevance'] = { interests: [], goals: [] }): V2DiscoverableGroup => ({
  id, name: id, description: '', tagline: '', coverId: null, location: '', focusTags: [], goals: [], memberCount: 1,
  admissionMode: 'approval', viewerRelationship: relationship, relevance,
});
const challenge = (id: string, relevance: V2DiscoverableChallenge['relevance']): V2DiscoverableChallenge => ({
  challengeId: id, title: id, groupId: 'g', groupName: 'Group', activities: [], description: '', challengeType: 'collective', status: 'active',
  startDate: '2026-10-01', endDate: '2026-12-01', timezone: 'UTC', governingToday: '2026-11-04', finalized: false,
  currentConfigVersion: 1, goalValue: null, goalUnit: null, collectiveTotal: 0, collectiveGoalReached: false, completionsCount: 0, myParticipation: null,
  host: { groupId: 'g', groupName: 'Group', admissionMode: 'approval', viewerRelationship: 'none' }, relevance,
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
  it('explains recommendations only using actual matched labels', () => {
    expect(recommendationReason({ interests: ['Strength'], goals: [], domains: [] })).toBe('Suggested because it matches your interest: Strength.');
    expect(recommendationReason({ interests: [], goals: [], domains: [] })).toBeNull();
  });
  it('shows discovery only when the server reports no active Challenges', () => {
    expect(showTodayDiscoveryRecommendations(0)).toBe(true);
    expect(showTodayDiscoveryRecommendations(1)).toBe(false);
  });
});
