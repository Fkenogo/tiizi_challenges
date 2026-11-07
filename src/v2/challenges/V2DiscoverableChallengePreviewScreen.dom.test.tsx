import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { V2DiscoverableChallenge } from '../../api/challengeDiscoveryApi';

const h = vi.hoisted(() => ({ query: {} as any }));
vi.mock('./useChallengeDiscovery', () => ({ useV2ChallengeDiscovery: () => h.query }));

import { V2DiscoverableChallengePreviewScreen } from './V2DiscoverableChallengePreviewScreen';

function challenge(overrides: Partial<V2DiscoverableChallenge> = {}): V2DiscoverableChallenge {
  return {
    challengeId: 'challenge-1', groupId: 'group-1', groupName: 'Public Group', activities: [{ name: 'Walk', domain: 'fitness', category: 'Movement', subcategory: '' }], title: 'Morning Walk', description: 'Walk together.', challengeType: 'collective', status: 'establishment', startDate: '2026-11-10', endDate: '2026-11-20', timezone: 'UTC', governingToday: '2026-11-04', finalized: false, currentConfigVersion: 1, goalValue: null, goalUnit: null, collectiveTotal: 0, collectiveGoalReached: false, completionsCount: 0, myParticipation: null,
    host: { groupId: 'group-1', groupName: 'Public Group', admissionMode: 'approval', viewerRelationship: 'none' }, relevance: { interests: [], goals: [], domains: [] }, ...overrides,
  };
}
function Probe() { const location = useLocation(); return <div data-testid="location">{location.pathname}</div>; }
function tree() { return <MemoryRouter initialEntries={['/v2/challenges/discovery/challenge-1']}><Probe /><Routes><Route path="/v2/challenges/discovery/:challengeId" element={<V2DiscoverableChallengePreviewScreen />} /><Route path="/v2/groups/:groupId" element={<p>Governed Group detail</p>} /></Routes></MemoryRouter>; }
afterEach(() => cleanup());

describe('discoverable Challenge preview route', () => {
  it('resolves a direct URL by fetching authorized discovery pages and links to Group detail', async () => {
    const fetchNextPage = vi.fn();
    h.query = { data: { pages: [{ challenges: [challenge({ challengeId: 'earlier' })], nextCursor: 'cursor' }] }, isLoading: false, isError: false, hasNextPage: true, isFetchingNextPage: false, fetchNextPage, refetch: vi.fn() };
    const view = render(tree());
    await waitFor(() => expect(fetchNextPage).toHaveBeenCalled());
    h.query = { data: { pages: [{ challenges: [challenge({ challengeId: 'earlier' })] }, { challenges: [challenge()] }] }, isLoading: false, isError: false, hasNextPage: false, isFetchingNextPage: false, fetchNextPage, refetch: vi.fn() };
    view.rerender(tree());
    expect(await screen.findByRole('heading', { name: 'Morning Walk' })).toBeTruthy();
    expect(screen.getByText('Upcoming')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'View hosting Group' }));
    expect(screen.getByText('Governed Group detail')).toBeTruthy();
  });

  it('shows a truthful pending-approval state and keeps the hosting Group action available', () => {
    h.query = { data: { pages: [{ challenges: [challenge({ host: { groupId: 'group-1', groupName: 'Public Group', admissionMode: 'approval', viewerRelationship: 'pending' } })] }] }, isLoading: false, isError: false, hasNextPage: false, isFetchingNextPage: false, fetchNextPage: vi.fn(), refetch: vi.fn() };
    render(tree());
    expect(screen.getByRole('status').textContent).toContain('pending approval');
    expect(screen.getByRole('button', { name: 'View hosting Group' })).toBeTruthy();
  });

  it('does not disclose records absent from the complete authorized discovery set', () => {
    h.query = { data: { pages: [{ challenges: [] }] }, isLoading: false, isError: false, hasNextPage: false, isFetchingNextPage: false, fetchNextPage: vi.fn(), refetch: vi.fn() };
    render(tree());
    expect(screen.getByText(/no longer available/)).toBeTruthy();
    expect(screen.queryByText('Morning Walk')).toBeNull();
  });
});
