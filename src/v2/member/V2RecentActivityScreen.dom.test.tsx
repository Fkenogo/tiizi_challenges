import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { MemberRecentActivityItem } from '../../api/memberRecentActivityApi';

interface MockHistoryState {
  data?: { pages: Array<{ items: MemberRecentActivityItem[]; nextCursor: string | null }> };
  isLoading: boolean;
  isError: boolean;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  isFetchNextPageError?: boolean;
  fetchNextPage: () => unknown;
  refetch: () => unknown;
}

interface MockPreviewState {
  data?: { items: MemberRecentActivityItem[] };
  isLoading: boolean;
  isError: boolean;
  refetch: () => unknown;
}

const h = vi.hoisted(() => ({
  history: {} as MockHistoryState,
  preview: {} as MockPreviewState,
}));

vi.mock('./recentActivityQuery', () => ({
  useV2RecentActivityHistory: () => h.history,
  useV2RecentActivityPreview: () => h.preview,
}));

import { V2RecentActivityPreview, V2RecentActivityScreen } from './V2RecentActivityScreen';

const current: MemberRecentActivityItem = {
  activityId: '00000000-0000-4000-8000-000000000001',
  activityName: 'Push-Up',
  value: 25,
  unit: 'reps',
  occurredAt: '2026-06-10T12:00:00.000Z',
  recordedAt: '2026-06-10T12:05:00.000Z',
  acceptedAt: '2026-06-10T12:05:00.000Z',
  displayTimezone: 'America/New_York',
  revisionState: 'current',
  challenge: { id: '00000000-0000-4000-8000-000000000002', title: 'Summer Challenge' },
};

const reversed: MemberRecentActivityItem = {
  ...current,
  activityId: '00000000-0000-4000-8000-000000000003',
  revisionState: 'reversed',
};
const second: MemberRecentActivityItem = {
  ...current,
  activityId: '00000000-0000-4000-8000-000000000004',
  activityName: 'Walk',
  value: 2,
  unit: 'km',
  occurredAt: '2026-06-09T12:00:00.000Z',
  recordedAt: '2026-06-09T12:05:00.000Z',
  acceptedAt: '2026-06-09T12:05:00.000Z',
};

const third: MemberRecentActivityItem = {
  ...current,
  activityId: '00000000-0000-4000-8000-000000000005',
  activityName: 'Plank',
  value: 60,
  unit: 'seconds',
  occurredAt: '2026-06-08T12:00:00.000Z',
  recordedAt: '2026-06-08T12:05:00.000Z',
  acceptedAt: '2026-06-08T12:05:00.000Z',
};

function setHistory(items: MemberRecentActivityItem[] = [current]) {
  h.history = {
    data: { pages: [{ items, nextCursor: items.length ? 'next-cursor' : null }] },
    isLoading: false,
    isError: false,
    hasNextPage: true,
    isFetchingNextPage: false,
    isFetchNextPageError: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
  };
  h.preview = { data: { items: [current] }, isLoading: false, isError: false, refetch: vi.fn() };
}

beforeEach(() => setHistory([current, reversed]));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('Personal Recent Activity presentation', () => {
  it('shows performed and recorded times, timezone, truthful reversal state and safe Challenge links', () => {
    render(<MemoryRouter><V2RecentActivityScreen /></MemoryRouter>);

    expect(screen.getByRole('heading', { name: 'Recent Activity' })).toBeTruthy();
    expect(screen.getAllByText('Performed')).toHaveLength(2);
    expect(screen.getAllByText('Recorded')).toHaveLength(2);
    expect(screen.getAllByText('Times shown in America/New_York')).toHaveLength(2);
    expect(screen.getByText('Reversed')).toBeTruthy();
    const challengeLinks = screen.getAllByRole('link', { name: 'View Challenge details: Summer Challenge' });
    expect(challengeLinks).toHaveLength(2);
    expect(challengeLinks[0].getAttribute('href'))
      .toBe('/v2/challenges/00000000-0000-4000-8000-000000000002');
    expect(screen.getByText(/do not count as active progress/)).toBeTruthy();
  });

  it('requests the next page only when the member selects Load more', () => {
    render(<MemoryRouter><V2RecentActivityScreen /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(h.history.fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it('shows the accepted timeline preview on Today with a link to full history', () => {
    render(
      <MemoryRouter initialEntries={['/v2/today']}>
        <Routes>
          <Route path="/v2/today" element={<V2RecentActivityPreview />} />
          <Route path="/v2/activity" element={<V2RecentActivityScreen />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Recent Activity' })).toBeTruthy();
    expect(screen.getByText(/Activity logged/)).toBeTruthy();
    const link = screen.getByRole('link', { name: 'View all activity' });
    expect(link.getAttribute('href')).toBe('/v2/activity');
    fireEvent.click(link);
    expect(screen.getByRole('heading', { name: 'Recent Activity' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Load more' })).toBeTruthy();
  });

  it('limits Today to two server-ordered entries without truncating full history', () => {
    h.preview = { ...h.preview, data: { items: [current, second, third] } };
    const today = render(<MemoryRouter><V2RecentActivityPreview /></MemoryRouter>);
    const previewRows = today.container.querySelectorAll('ol > li');
    expect(previewRows).toHaveLength(2);
    expect(previewRows[0].textContent).toContain('Push-Up');
    expect(previewRows[1].textContent).toContain('Walk');
    expect(screen.queryByText(/Plank/)).toBeNull();

    today.unmount();
    setHistory([current, second, third]);
    const history = render(<MemoryRouter><V2RecentActivityScreen /></MemoryRouter>);
    expect(history.container.querySelectorAll('ol > li')).toHaveLength(3);
    expect(screen.getByText(/Plank/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Load more' })).toBeTruthy();
  });

  it('renders an honest empty state when no accepted Activities exist', () => {
    setHistory([]);
    render(<MemoryRouter><V2RecentActivityScreen /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'No Activity logged yet' })).toBeTruthy();
    expect(screen.getByText(/not automatically shared to a Feed/)).toBeTruthy();
  });

  it('shows a refresh warning when cached history is empty and refetch fails', () => {
    const refetch = vi.fn();
    h.history = {
      data: { pages: [{ items: [], nextCursor: null }] },
      isLoading: false,
      isError: true,
      hasNextPage: false,
      isFetchingNextPage: false,
      isFetchNextPageError: false,
      fetchNextPage: vi.fn(),
      refetch,
    };
    render(<MemoryRouter><V2RecentActivityScreen /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'No Activity logged yet' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: "We couldn't refresh Recent Activity" })).toBeTruthy();
    expect(screen.getByText(/history shown may be out of date/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('renders loading and retryable error states', () => {
    h.history = { data: undefined, isLoading: true, isError: false, fetchNextPage: vi.fn(), refetch: vi.fn() };
    const loading = render(<MemoryRouter><V2RecentActivityScreen /></MemoryRouter>);
    expect(screen.getByRole('status', { name: 'Loading your Recent Activity…' })).toBeTruthy();
    loading.unmount();

    h.history = { data: undefined, isLoading: false, isError: true, fetchNextPage: vi.fn(), refetch: vi.fn() };
    render(<MemoryRouter><V2RecentActivityScreen /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: "We couldn't load Recent Activity" })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(h.history.refetch).toHaveBeenCalledTimes(1);
  });
});
