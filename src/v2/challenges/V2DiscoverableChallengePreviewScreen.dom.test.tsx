import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { V2DiscoverableChallenge } from '../../api/challengeDiscoveryApi';

const h = vi.hoisted(() => ({ query: {} as unknown, join: vi.fn(), joinPending: false, joinSuccess: false, joinError: false, detail: { isLoading: false, data: undefined } as unknown, group: { data: undefined } as unknown }));
vi.mock('./useChallengeDiscovery', () => ({ useV2ChallengeDiscovery: () => h.query }));
vi.mock('./useChallengeCreation', () => ({ useChallengeDetailV2: () => h.detail, useJoinChallengeV2: () => ({ isPending: h.joinPending, isSuccess: h.joinSuccess, isError: h.joinError, mutate: h.join }) }));
vi.mock('../groups/useV2Groups', () => ({ useV2GroupDetail: () => h.group }));

import { V2DiscoverableChallengePreviewScreen } from './V2DiscoverableChallengePreviewScreen';

function challenge(overrides: Partial<V2DiscoverableChallenge> = {}): V2DiscoverableChallenge {
  return {
    challengeId: 'challenge-1', groupId: 'group-1', groupName: 'Public Group', activities: [{ name: 'Walk', domain: 'fitness', category: 'Movement', subcategory: '' }], title: 'Morning Walk', description: 'Walk together.', challengeType: 'collective', status: 'establishment', startDate: '2026-11-10', endDate: '2026-11-20', timezone: 'UTC', governingToday: '2026-11-04', finalized: false, currentConfigVersion: 1, goalValue: null, goalUnit: null, collectiveTotal: 0, collectiveGoalReached: false, completionsCount: 0, myParticipation: null,
    host: { groupId: 'group-1', groupName: 'Public Group', admissionMode: 'approval', viewerRelationship: 'none' }, relevance: { interests: [], goals: [], domains: [] }, ...overrides,
  };
}
function Probe() { const location = useLocation(); return <div data-testid="location">{location.pathname}</div>; }
function tree() { return <MemoryRouter initialEntries={['/v2/challenges/discovery/challenge-1']}><Probe /><Routes><Route path="/v2/challenges/discovery/:challengeId" element={<V2DiscoverableChallengePreviewScreen />} /><Route path="/v2/groups/:groupId" element={<p>Governed Group detail</p>} /></Routes></MemoryRouter>; }
afterEach(() => { cleanup(); h.detail = { isLoading: false, data: undefined }; h.group = { data: undefined }; h.join.mockReset(); h.joinPending = false; h.joinSuccess = false; h.joinError = false; });

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
    expect(screen.queryByRole('button', { name: 'Join Challenge' })).toBeNull();
    expect(h.join).not.toHaveBeenCalled();
  });

  it('does not offer joining to a non-member', () => {
    h.query = { data: { pages: [{ challenges: [challenge()] }] }, isLoading: false, isError: false, hasNextPage: false, isFetchingNextPage: false, fetchNextPage: vi.fn(), refetch: vi.fn() };
    render(tree());
    expect(screen.queryByRole('button', { name: 'Join Challenge' })).toBeNull();
    expect(h.join).not.toHaveBeenCalled();
  });

  it('opens confirmation without a join request; Not now and Close both cancel', async () => {
    h.query = { data: { pages: [{ challenges: [challenge({ host: { groupId: 'group-1', groupName: 'Public Group', admissionMode: 'open', viewerRelationship: 'member' } })] }] }, isLoading: false, isError: false, hasNextPage: false, isFetchingNextPage: false, fetchNextPage: vi.fn(), refetch: vi.fn() };
    render(tree());
    await userEvent.click(screen.getByRole('button', { name: 'Join Challenge' }));
    expect(screen.getByRole('dialog', { name: 'Join Morning Walk?' })).toBeTruthy();
    expect(h.join).not.toHaveBeenCalled();
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Not now' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Join Challenge' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(h.join).not.toHaveBeenCalled();
  });

  it.each(['member', 'steward'] as const)('requires explicit confirmation for a %s', async (viewerRelationship) => {
    h.query = { data: { pages: [{ challenges: [challenge({ host: { groupId: 'group-1', groupName: 'Public Group', admissionMode: 'open', viewerRelationship } })] }] }, isLoading: false, isError: false, hasNextPage: false, isFetchingNextPage: false, fetchNextPage: vi.fn(), refetch: vi.fn() };
    const view = render(tree());
    await userEvent.click(screen.getByRole('button', { name: 'Join Challenge' }));
    expect(h.join).not.toHaveBeenCalled();
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Join Challenge' }));
    expect(h.join).toHaveBeenCalledTimes(1);
    expect(h.join).toHaveBeenCalledWith('challenge-1');
    h.joinSuccess = true;
    view.rerender(tree());
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('status').textContent).toContain('You joined this Challenge.');
  });

  it('keeps retry feedback available when the authorized join request fails', async () => {
    h.query = { data: { pages: [{ challenges: [challenge({ host: { groupId: 'group-1', groupName: 'Public Group', admissionMode: 'open', viewerRelationship: 'member' } })] }] }, isLoading: false, isError: false, hasNextPage: false, isFetchingNextPage: false, fetchNextPage: vi.fn(), refetch: vi.fn() };
    h.join.mockImplementationOnce(() => { h.joinError = true; }).mockImplementationOnce(() => { h.joinError = false; });
    const view = render(tree());
    await userEvent.click(screen.getByRole('button', { name: 'Join Challenge' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Join Challenge' }));
    view.rerender(tree());
    expect(screen.getByRole('alert').textContent).toContain('Please try again.');
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Join Challenge' }));
    view.rerender(tree());
    expect(h.join).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('offers a separate Challenge join after Group membership, but only after confirmation', async () => {
    h.query = { data: { pages: [{ challenges: [challenge({ host: { groupId: 'group-1', groupName: 'Public Group', admissionMode: 'open', viewerRelationship: 'member' } })] }] }, isLoading: false, isError: false, hasNextPage: false, isFetchingNextPage: false, fetchNextPage: vi.fn(), refetch: vi.fn() };
    render(tree());
    await userEvent.click(screen.getByRole('button', { name: 'Join Challenge' }));
    expect(h.join).not.toHaveBeenCalled();
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Join Challenge' }));
    expect(h.join).toHaveBeenCalledWith('challenge-1');
  });

  it('uses the authorized member detail after Group join removes the Challenge from outsider discovery', async () => {
    h.query = { data: { pages: [{ challenges: [] }] }, isLoading: false, isError: false, hasNextPage: false, isFetchingNextPage: false, fetchNextPage: vi.fn(), refetch: vi.fn() };
    h.detail = { isLoading: false, data: { ...challenge({ status: 'active', startDate: '2026-11-11', endDate: '2026-12-02', governingToday: '2026-11-16' }), instructions: '', activatedAt: null, endedAt: null, finalizedAt: null, finalResult: null } };
    h.group = { data: { name: 'Public Group', requireAdminApproval: false, viewerRelationship: 'member' } };
    render(tree());
    expect(await screen.findByRole('heading', { name: 'Morning Walk' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'View hosting Group' })).toBeTruthy();
    expect(screen.queryByText(/Join the hosting Group to view/)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Join Challenge' }));
    expect(h.join).not.toHaveBeenCalled();
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Join Challenge' }));
    expect(h.join).toHaveBeenCalledWith('challenge-1');
  });

  it('keeps a loading state while authorized Group membership details are resolving', () => {
    h.query = { data: { pages: [{ challenges: [] }] }, isLoading: false, isError: false, hasNextPage: false, isFetchingNextPage: false, fetchNextPage: vi.fn(), refetch: vi.fn() };
    h.detail = { isLoading: false, data: { ...challenge(), instructions: '', activatedAt: null, endedAt: null, finalizedAt: null, finalResult: null } };
    h.group = { isLoading: true, data: undefined };
    render(tree());
    expect(screen.getByText('Checking your Group access…')).toBeTruthy();
    expect(screen.queryByText(/no longer available/i)).toBeNull();
  });

  it('does not disclose records absent from the complete authorized discovery set', () => {
    h.query = { data: { pages: [{ challenges: [] }] }, isLoading: false, isError: false, hasNextPage: false, isFetchingNextPage: false, fetchNextPage: vi.fn(), refetch: vi.fn() };
    render(tree());
    expect(screen.getByText(/no longer available/)).toBeTruthy();
    expect(screen.queryByText('Morning Walk')).toBeNull();
  });
});
