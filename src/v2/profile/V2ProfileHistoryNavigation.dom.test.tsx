import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { V2Profile } from '../../api/profileApi';

const h = vi.hoisted(() => ({
  profileState: undefined as unknown,
  activityHistory: undefined as unknown,
  activityPreview: undefined as unknown,
  remove: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'member-1', email: 'member@example.test' } }),
}));
vi.mock('./useV2Profile', () => ({ useV2Profile: () => h.profileState }));
vi.mock('./useV2SignOut', () => ({ useV2SignOut: () => h.signOut }));
vi.mock('../media/useLocalImagePreview', () => ({
  LOCAL_IMAGE_ACCEPT: 'image/jpeg,image/png,image/webp',
  useLocalImagePreview: () => ({ remove: h.remove }),
}));
vi.mock('../media/V2LocalImagePicker', () => ({ V2LocalImagePicker: () => null }));
vi.mock('../preferences/ProfilePreferencesSection', () => ({ ProfilePreferencesSection: () => null }));
vi.mock('../support/V2SupportTiiziCard', () => ({ V2SupportTiiziCard: () => null }));
vi.mock('../member/recentActivityQuery', () => ({
  useV2RecentActivityHistory: () => h.activityHistory,
  useV2RecentActivityPreview: () => h.activityPreview,
}));

import { V2RecentActivityScreen } from '../member/V2RecentActivityScreen';
import { V2ProfileChallengeHistoryScreen } from './V2ProfileChallengeHistoryScreen';
import { V2ProfileScreen } from './V2ProfileScreen';

function createProfile(): V2Profile {
  return {
    memberId: 'member-1',
    displayName: 'Amara',
    profileImage: { status: 'not_configured' },
    groups: { count: 0, items: [], nextCursor: null },
    challenges: {
      activeCount: 0,
      historyCount: 1,
      totalCount: 1,
      items: [{
        challengeId: 'challenge-1',
        participationId: 'participation-1',
        title: 'Spring Challenge',
        status: 'withdrawn',
        challengeStatus: 'ended',
        bucket: 'history',
        joinedAt: '2026-06-01T12:00:00.000Z',
        exitedAt: '2026-06-05T12:00:00.000Z',
      }],
      nextCursor: null,
    },
  };
}

function renderProfileRoutes() {
  return render(
    <MemoryRouter initialEntries={['/v2/profile']}>
      <Routes>
        <Route path="/v2/profile" element={<V2ProfileScreen />} />
        <Route path="/v2/profile/challenges" element={<V2ProfileChallengeHistoryScreen />} />
        <Route path="/v2/activity" element={<V2RecentActivityScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  h.profileState = {
    profile: createProfile(),
    isLoading: false,
    error: null,
    isSaving: false,
    saveDisplayName: vi.fn(),
    applyProfileImage: vi.fn(),
    reload: vi.fn(),
    loadMoreGroups: vi.fn(),
    loadMoreChallenges: vi.fn(),
    isLoadingGroups: false,
    isLoadingChallenges: false,
    pageError: null,
  };
  h.activityHistory = {
    data: { pages: [{ items: [], nextCursor: null }] },
    isLoading: false,
    isError: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    isFetchNextPageError: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
  };
  h.activityPreview = { data: { items: [] }, isLoading: false, isError: false, refetch: vi.fn() };
  h.remove.mockReset();
  h.signOut.mockReset();
  h.signOut.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe('Profile history navigation', () => {
  it('opens the same owner Recent Activity screen from Activity History', () => {
    renderProfileRoutes();

    const link = screen.getByRole('link', { name: 'View Activity History' });
    expect(link.getAttribute('href')).toBe('/v2/activity');
    fireEvent.click(link);

    expect(screen.getByRole('heading', { name: 'Recent Activity' })).toBeTruthy();
  });

  it('keeps Challenge History separate and opens participation history', () => {
    renderProfileRoutes();

    const link = screen.getByRole('link', { name: 'View Challenge History' });
    expect(link.getAttribute('href')).toBe('/v2/profile/challenges');
    fireEvent.click(link);

    expect(screen.getByRole('heading', { name: 'Challenge history' })).toBeTruthy();
    expect(screen.getByText('Spring Challenge')).toBeTruthy();
  });
});
