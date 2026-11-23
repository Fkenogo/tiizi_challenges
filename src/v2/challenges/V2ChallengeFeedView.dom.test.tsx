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
    isPending: boolean;
    isFetching: boolean;
    refetch: () => unknown;
  },
  history: {} as {
    data?: { pages: ChallengeFeedPage[] };
    isLoading: boolean;
    isError: boolean;
    isSuccess: boolean;
    isPending: boolean;
    isFetching: boolean;
    hasNextPage?: boolean;
    isFetchingNextPage?: boolean;
    fetchNextPage: () => unknown;
    refetch: () => unknown;
  },
  withdraw: {} as { error: unknown; mutate: ReturnType<typeof vi.fn>; isPending: boolean },
  kudos: {} as { error: unknown; mutate: ReturnType<typeof vi.fn>; isPending: boolean },
}));

vi.mock('./challengeFeedQuery', () => ({
  useV2ChallengeFeedPreview: () => h.preview,
  useV2ChallengeFeedHistory: () => h.history,
  useV2WithdrawActivityShare: () => h.withdraw,
  useV2ToggleKudos: () => h.kudos,
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
    kudosCount: 2,
    viewerKudos: false,
    ...overrides,
  };
}

function page(items: ChallengeFeedItem[], nextCursor: string | null = null): ChallengeFeedPage {
  return { challengeId: '00000000-0000-4000-8000-000000000002', items, nextCursor };
}

const CHALLENGE_ID = '00000000-0000-4000-8000-000000000002';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('V2ChallengeFeedSection', () => {
  it('renders shared entries with the member display name and View all link', () => {
    h.preview = { data: page([item()]), isLoading: false, isPending: false, isFetching: false, isError: false, isSuccess: true, refetch: vi.fn() };
    h.kudos = { error: null, mutate: vi.fn(), isPending: false };
    h.withdraw = { error: null, mutate: vi.fn(), isPending: false };
    render(<MemoryRouter><V2ChallengeFeedSection challengeId={CHALLENGE_ID} /></MemoryRouter>);

    expect(screen.getByRole('heading', { name: 'Challenge activity' })).toBeTruthy();
    expect(screen.getByText('Amara Test')).toBeTruthy();
    expect(screen.getByText(/shared Push-Up/)).toBeTruthy();
    expect(screen.getByText(/25 reps/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'View all Challenge activity' }).getAttribute('href'))
      .toBe(`/v2/challenges/${CHALLENGE_ID}/feed`);
  });

  it('shows the fallback identity only for a genuinely unavailable name', () => {
    h.preview = { data: page([item({ sharerDisplayName: null })]), isLoading: false, isPending: false, isFetching: false, isError: false, isSuccess: true, refetch: vi.fn() };
    h.kudos = { error: null, mutate: vi.fn(), isPending: false };
    h.withdraw = { error: null, mutate: vi.fn(), isPending: false };
    render(<MemoryRouter><V2ChallengeFeedSection challengeId={CHALLENGE_ID} /></MemoryRouter>);

    expect(screen.getByText('Tiizi member')).toBeTruthy();
    expect(screen.queryByText('A member')).toBeNull();
  });

  it('shows the honest empty state and never fabricates Feed content', () => {
    h.preview = { data: page([]), isLoading: false, isPending: false, isFetching: false, isError: false, isSuccess: true, refetch: vi.fn() };
    h.kudos = { error: null, mutate: vi.fn(), isPending: false };
    h.withdraw = { error: null, mutate: vi.fn(), isPending: false };
    render(<MemoryRouter><V2ChallengeFeedSection challengeId={CHALLENGE_ID} /></MemoryRouter>);

    expect(screen.getByText(/No shared Challenge activity yet/)).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'View all Challenge activity' })).toBeNull();
  });
});

describe('V2ChallengeFeedScreen', () => {
  function renderScreen() {
    return render(
      <MemoryRouter initialEntries={[`/v2/challenges/${CHALLENGE_ID}/feed`]}>
        <Routes>
          <Route
            path="/v2/challenges/:challengeId/feed"
            element={<V2ChallengeFeedScreen />}
          />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('toggles Kudos through the governed mutation and shows the count', async () => {
    const own = item({ ownShare: false, viewerKudos: false, kudosCount: 2 });
    h.history = {
      data: { pages: [page([own])] },
      isLoading: false, isPending: false, isFetching: false, isError: false, isSuccess: true, hasNextPage: false,
      isFetchingNextPage: false, fetchNextPage: vi.fn(), refetch: vi.fn(),
    };
    h.withdraw = { error: null, mutate: vi.fn(), isPending: false };
    h.kudos = { error: null, mutate: vi.fn(), isPending: false };
    renderScreen();

    const kudosButton = screen.getByRole('button', { name: /Kudos/ });
    expect(screen.getByText('2')).toBeTruthy();

    expect(kudosButton.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(kudosButton);
    await waitFor(() => expect(h.kudos.mutate).toHaveBeenCalledWith(
      { feedItemId: own.feedItemId, active: false },
    ));
  });

  it('exposes the viewer Kudos toggle state to assistive technology', () => {
    h.history = {
      data: { pages: [page([item({ viewerKudos: true, kudosCount: 3 })])] },
      isLoading: false, isPending: false, isFetching: false, isError: false, isSuccess: true, hasNextPage: false,
      isFetchingNextPage: false, fetchNextPage: vi.fn(), refetch: vi.fn(),
    };
    h.withdraw = { error: null, mutate: vi.fn(), isPending: false };
    h.kudos = { error: null, mutate: vi.fn(), isPending: false };
    renderScreen();

    const kudosButton = screen.getByRole('button', { name: /Kudos/ });
    expect(kudosButton.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('keeps the Share fallback open with selectable text when the clipboard is denied', async () => {
    h.history = {
      data: { pages: [page([item()])] },
      isLoading: false, isPending: false, isFetching: false, isError: false, isSuccess: true, hasNextPage: false,
      isFetchingNextPage: false, fetchNextPage: vi.fn(), refetch: vi.fn(),
    };
    h.withdraw = { error: null, mutate: vi.fn(), isPending: false };
    h.kudos = { error: null, mutate: vi.fn(), isPending: false };
    const writeText = vi.fn(async () => { throw new Error('clipboard denied'); });
    Object.assign(navigator, { clipboard: { writeText } });
    renderScreen();

    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy text' }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(screen.getByRole('alert').textContent).toContain("Couldn't copy automatically");
    expect(screen.getByText(/Amara Test shared 25 reps/)).toBeTruthy();
    // The menu stays open — nothing was silently dismissed.
    expect(screen.getByRole('link', { name: 'Share on WhatsApp' })).toBeTruthy();
  });

  it('never offers Kudos or Withdraw mutations on the publishing member own card', async () => {
    h.history = {
      data: { pages: [page([item({ ownShare: true, viewerKudos: false })])] },
      isLoading: false, isPending: false, isFetching: false, isError: false, isSuccess: true, hasNextPage: false,
      isFetchingNextPage: false, fetchNextPage: vi.fn(), refetch: vi.fn(),
    };
    h.withdraw = {
      error: null,
      mutate: vi.fn((activityEventId: string, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.()),
      isPending: false,
    };
    h.kudos = { error: null, mutate: vi.fn(), isPending: false };
    renderScreen();

    // No self-Kudos action on the own card — only the count display.
    expect(screen.queryByRole('button', { name: /Kudos/ })).toBeNull();
    expect(screen.getByText(/2 Kudos/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Withdraw' }));
    await waitFor(() =>
      expect(h.withdraw.mutate).toHaveBeenCalledWith('00000000-0000-4000-8000-000000000001', expect.anything()));
    const notice = await screen.findByRole('status');
    expect(notice.textContent).toContain('Share removed.');
    expect(document.activeElement).toBe(notice);
  });

  it('offers WhatsApp and Copy from the external Share menu (text-only)', () => {
    const shared = item();
    h.history = {
      data: { pages: [page([shared])] },
      isLoading: false, isPending: false, isFetching: false, isError: false, isSuccess: true, hasNextPage: false,
      isFetchingNextPage: false, fetchNextPage: vi.fn(), refetch: vi.fn(),
    };
    h.withdraw = { error: null, mutate: vi.fn(), isPending: false };
    h.kudos = { error: null, mutate: vi.fn(), isPending: false };
    renderScreen();

    fireEvent.click(screen.getByRole('button', { name: /Share/ }));
    const whatsapp = screen.getByRole('link', { name: 'Share on WhatsApp' });
    const expected = `https://wa.me/?text=${encodeURIComponent(`Amara Test shared 25 reps of Push-Up on Tiizi 🎉`)}`;
    expect(whatsapp.getAttribute('href')).toBe(expected);
    expect(screen.getByRole('button', { name: 'Copy text' })).toBeTruthy();
  });

  it('never renders cached entries after a failed read', () => {
    h.history = {
      data: { pages: [page([item()])] },
      isLoading: false, isPending: false, isFetching: false, isError: true, isSuccess: false, hasNextPage: false,
      isFetchingNextPage: false, fetchNextPage: vi.fn(), refetch: vi.fn(),
    };
    h.withdraw = { error: null, mutate: vi.fn(), isPending: false };
    h.kudos = { error: null, mutate: vi.fn(), isPending: false };
    renderScreen();

    expect(screen.getByText(/Shared Challenge activity is unavailable/)).toBeTruthy();
    expect(screen.queryByText(/shared Push-Up/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Withdraw' })).toBeNull();
  });

  it('offers Load more only while a signed cursor page remains', () => {
    h.history = {
      data: { pages: [page([item()], 'signed-cursor')] },
      isLoading: false, isPending: false, isFetching: false, isError: false, isSuccess: true, hasNextPage: true,
      isFetchingNextPage: false, fetchNextPage: vi.fn(), refetch: vi.fn(),
    };
    h.withdraw = { error: null, mutate: vi.fn(), isPending: false };
    h.kudos = { error: null, mutate: vi.fn(), isPending: false };
    renderScreen();

    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(h.history.fetchNextPage).toHaveBeenCalledTimes(1);
  });
});
