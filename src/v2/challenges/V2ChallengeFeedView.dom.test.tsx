import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ChallengeFeedItem, ChallengeFeedPage } from '../../api/challengeFeedApi';

const h = vi.hoisted(() => ({
  preview: {} as {
    data?: ChallengeFeedPage;
    isLoading: boolean;
    isError: boolean;
    isSuccess: boolean;
    refetch: () => unknown;
  },
  history: {} as {
    data?: { pages: ChallengeFeedPage[] };
    isLoading: boolean;
    isError: boolean;
    isSuccess: boolean;
    hasNextPage?: boolean;
    isFetchingNextPage?: boolean;
    fetchNextPage: () => unknown;
    refetch: () => unknown;
  },
  withdraw: {} as { mutate: ReturnType<typeof vi.fn>; isPending: boolean },
}));

vi.mock('./challengeFeedQuery', () => ({
  useV2ChallengeFeedPreview: () => h.preview,
  useV2ChallengeFeedHistory: () => h.history,
  useV2WithdrawActivityShare: () => h.withdraw,
}));

import { V2ChallengeFeedSection, V2ChallengeFeedScreen } from './V2ChallengeFeedView';

function item(overrides?: Partial<ChallengeFeedItem>): ChallengeFeedItem {
  return {
    feedItemId: '00000000-0000-4000-8000-0000000000aa',
    kind: 'activity_share',
    activityEventId: '00000000-0000-4000-8000-000000000001',
    sharerDisplayName: 'Amara Test',
    activityName: 'Push-Up',
    value: 25,
    unit: 'reps',
    publishedAt: '2026-06-10T12:10:00.000Z',
    ownShare: false,
    ...overrides,
  };
}

function page(items: ChallengeFeedItem[], nextCursor: string | null = null): ChallengeFeedPage {
  return { challengeId: '00000000-0000-4000-8000-000000000002', items, nextCursor };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('V2ChallengeFeedSection', () => {
  it('renders shared entries with a View all link', () => {
    h.preview = { data: page([item()]), isLoading: false, isError: false, isSuccess: true, refetch: vi.fn() };
    render(<MemoryRouter><V2ChallengeFeedSection challengeId="00000000-0000-4000-8000-000000000002" /></MemoryRouter>);

    expect(screen.getByRole('heading', { name: 'Challenge activity' })).toBeTruthy();
    expect(screen.getByText(/Amara Test shared Push-Up/)).toBeTruthy();
    expect(screen.getByText('25 reps · Push-Up')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'View all Challenge activity' }).getAttribute('href'))
      .toBe('/v2/challenges/00000000-0000-4000-8000-000000000002/feed');
  });

  it('shows the honest empty state and never fabricates Feed content', () => {
    h.preview = { data: page([]), isLoading: false, isError: false, isSuccess: true, refetch: vi.fn() };
    render(<MemoryRouter><V2ChallengeFeedSection challengeId="00000000-0000-4000-8000-000000000002" /></MemoryRouter>);

    expect(screen.getByText(/No shared Challenge activity yet/)).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'View all Challenge activity' })).toBeNull();
  });
});

describe('V2ChallengeFeedScreen', () => {
  function renderScreen() {
    return render(
      <MemoryRouter initialEntries={['/v2/challenges/00000000-0000-4000-8000-000000000002/feed']}>
        <Routes>
          <Route
            path="/v2/challenges/:challengeId/feed"
            element={<V2ChallengeFeedScreen />}
          />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('lists authorized entries, withdraws only the viewer own Share, and announces the outcome', async () => {
    h.history = {
      data: { pages: [page([item({ ownShare: true }), item({ feedItemId: '00000000-0000-4000-8000-0000000000bb', sharerDisplayName: 'Fellow Member' })])] },
      isLoading: false, isError: false, isSuccess: true, hasNextPage: false,
      isFetchingNextPage: false, fetchNextPage: vi.fn(), refetch: vi.fn(),
    };
    h.withdraw = {
      mutate: vi.fn((activityEventId: string, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.()),
      isPending: false,
    };
    renderScreen();

    expect(screen.getByRole('heading', { name: 'Challenge activity' })).toBeTruthy();
    expect(screen.getByText(/Amara Test shared Push-Up/)).toBeTruthy();
    expect(screen.getByText(/Fellow Member shared Push-Up/)).toBeTruthy();
    // Only the viewer's own Share exposes withdrawal.
    expect(screen.getAllByRole('button', { name: 'Withdraw Share' })).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Withdraw Share' }));
    await waitFor(() =>
      expect(h.withdraw.mutate).toHaveBeenCalledWith('00000000-0000-4000-8000-000000000001', expect.anything()));
    // The outcome is announced and takes focus (the focused button is gone).
    const notice = await screen.findByRole('status');
    expect(notice.textContent).toContain('Your Share is withdrawn.');
    expect(document.activeElement).toBe(notice);
  });

  it('never renders cached entries after a failed read', () => {
    h.history = {
      data: { pages: [page([item()])] },
      isLoading: false, isError: true, isSuccess: false, hasNextPage: false,
      isFetchingNextPage: false, fetchNextPage: vi.fn(), refetch: vi.fn(),
    };
    h.withdraw = { mutate: vi.fn(), isPending: false };
    renderScreen();

    expect(screen.getByText(/Shared Challenge activity is unavailable/)).toBeTruthy();
    // A stale cached page must not keep presenting entries or controls.
    expect(screen.queryByText(/shared Push-Up/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Withdraw Share' })).toBeNull();
  });

  it('offers Load more only while a signed cursor page remains', () => {
    h.history = {
      data: { pages: [page([item()], 'signed-cursor')] },
      isLoading: false, isError: false, isSuccess: true, hasNextPage: true,
      isFetchingNextPage: false, fetchNextPage: vi.fn(), refetch: vi.fn(),
    };
    h.withdraw = { mutate: vi.fn(), isPending: false };
    renderScreen();

    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(h.history.fetchNextPage).toHaveBeenCalledTimes(1);
  });
});
