import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { V2DiscoverableChallenge } from '../../api/challengeDiscoveryApi';
import type { V2DiscoverableGroup } from '../../api/groupsApi';

const mocks = vi.hoisted(() => ({ groups: {} as any, challenges: {} as any }));
vi.mock('../groups/useV2Groups', () => ({ useV2GroupDiscovery: () => mocks.groups }));
vi.mock('../challenges/useChallengeDiscovery', () => ({ useV2ChallengeDiscovery: () => mocks.challenges }));

import { V2TodayDiscoveryRecommendations } from './V2TodayDiscoveryRecommendations';

const group = (id: string, relevance: NonNullable<V2DiscoverableGroup['relevance']> = { interests: [], goals: [] }): V2DiscoverableGroup => ({ id, name: id, description: '', tagline: '', coverId: null, location: '', focusTags: [], goals: [], memberCount: 2, admissionMode: 'approval', viewerRelationship: 'none', relevance });
const challenge = (id: string, status: 'active' | 'establishment' = 'active', relevance: V2DiscoverableChallenge['relevance'] = { interests: [], goals: [], domains: [] }): V2DiscoverableChallenge => ({
  challengeId: id, groupId: 'g', groupName: 'Host Group', activities: [{ name: 'Walk', domain: 'fitness' as const, category: 'Movement', subcategory: '' }], title: id, description: 'A safe summary.', challengeType: 'collective' as const, status, startDate: '2026-11-10', endDate: '2026-11-20', timezone: 'UTC', governingToday: '2026-11-04', finalized: false, currentConfigVersion: 1, goalValue: null, goalUnit: null, collectiveTotal: 0, collectiveGoalReached: false, completionsCount: 0, myParticipation: null,
  host: { groupId: 'g', groupName: 'Host Group', admissionMode: 'approval' as const, viewerRelationship: 'none' as const }, relevance,
});
function setLoaded(groups: any[], challenges: any[]) {
  mocks.groups = { data: { pages: [{ groups }] }, isLoading: false, isError: false, isSuccess: true };
  mocks.challenges = { data: { pages: [{ challenges }] }, isLoading: false, isError: false, isSuccess: true };
}
afterEach(() => cleanup());

describe('Today discovery recommendations', () => {
  it('shows matched results, approval requirements, upcoming status, and safe detail links', () => {
    setLoaded([group('Matched Group', { interests: ['Walking'], goals: [] }), group('Unmatched Group')], [challenge('Matched Challenge', 'establishment', { interests: ['Walking'], goals: [], domains: [] })]);
    render(<MemoryRouter><V2TodayDiscoveryRecommendations /></MemoryRouter>);
    expect(screen.getByText('Matched Group')).toBeTruthy();
    expect(screen.queryByText('Unmatched Group')).toBeNull();
    expect(screen.getByText(/Request to join; the Group must approve/)).toBeTruthy();
    expect(screen.getByText('Upcoming')).toBeTruthy();
    expect(screen.getByText(/approval is required before taking part/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'View Challenge' })).toBeTruthy();
  });
  it('falls back to general discovery when there are no exact matches', () => {
    setLoaded([group('General Group')], [challenge('General Challenge')]);
    render(<MemoryRouter><V2TodayDiscoveryRecommendations /></MemoryRouter>);
    expect(screen.getByText('General Group')).toBeTruthy();
    expect(screen.getByText('General Challenge')).toBeTruthy();
    expect(screen.queryByText(/Suggested because/)).toBeNull();
  });
  it('reports independent loading and service errors', () => {
    mocks.groups = { isLoading: true };
    mocks.challenges = { isLoading: false, isError: true, isSuccess: false };
    render(<MemoryRouter><V2TodayDiscoveryRecommendations /></MemoryRouter>);
    expect(screen.getByText('Finding Groups…')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('Challenge suggestions');
  });
});
