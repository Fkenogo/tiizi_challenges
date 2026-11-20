import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
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
    render(<MemoryRouter><V2RecentActivityPreview /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Recent Activity' })).toBeTruthy();
    expect(screen.getByText(/Activity logged/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'View history' }).getAttribute('href')).toBe('/v2/activity');
  });

  it('renders an honest empty state when no accepted Activities exist', () => {
    setHistory([]);
    render(<MemoryRouter><V2RecentActivityScreen /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'No Activity logged yet' })).toBeTruthy();
    expect(screen.getByText(/not automatically shared to a Feed/)).toBeTruthy();
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
