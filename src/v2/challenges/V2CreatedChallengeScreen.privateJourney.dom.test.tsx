import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const h = vi.hoisted(() => ({
  detail: { isLoading: false, isError: false, data: null as unknown },
  memberships: { data: { memberships: [] as unknown[] } },
  navigate: vi.fn(),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const router = await importOriginal();
  return { ...router, useNavigate: () => h.navigate };
});
vi.mock('./useChallengeCreation', () => ({
  useChallengeDetailV2: () => h.detail,
  useV2Memberships: () => h.memberships,
}));
vi.mock('./challengeEndState', () => ({
  endStateFor: () => 'live',
  loggingAvailableForEndState: () => true,
  participationMutableForEndState: () => true,
  statusLabelForEndState: () => 'Running',
}));
vi.mock('./loggingView', () => ({ loggingViewFor: () => ({ kind: 'loggable', choices: [] }) }));
vi.mock('./challengeReturnPath', () => ({ challengeReturnPath: () => '/v2/challenges' }));
vi.mock('./V2ChallengeHero', () => ({
  V2ChallengeHero: ({ onLogActivity }: { onLogActivity: () => void }) => (
    <button type="button" onClick={onLogActivity}>Log activity</button>
  ),
}));
vi.mock('./V2LoggingSection', () => ({
  V2LogActivityDialog: ({ open, onClose, onKeepPrivate }: {
    open: boolean;
    onClose: () => void;
    onKeepPrivate?: () => void;
  }) => open ? (
    <div role="dialog" aria-label="Activity privacy choice">
      <button type="button" onClick={() => { onClose(); onKeepPrivate?.(); }}>Keep private</button>
    </div>
  ) : null,
}));
vi.mock('./V2ParticipationSection', () => ({
  participationViewFor: () => ({ kind: 'joined' }),
  V2LeaveChallengeDialog: () => null,
  V2ParticipationSection: () => null,
}));
vi.mock('./V2ProgressSection', () => ({ V2ProgressSection: () => null }));
vi.mock('./V2ChallengeResults', () => ({ V2ChallengeResults: () => null }));
vi.mock('./V2LatestChallengeContribution', () => ({ V2LatestChallengeContribution: () => null }));

import { V2CreatedChallengeScreen } from './V2CreatedChallengeScreen';

const detail = {
  challengeId: 'challenge-1',
  groupId: 'group-1',
  title: 'Reps Race',
  description: '',
  challengeType: 'race',
  status: 'active',
  startDate: '2026-11-01',
  endDate: '2026-11-30',
  timezone: 'UTC',
  myParticipation: { status: 'active' },
};
const originState = { returnTo: '/v2/groups/group-1', source: 'group-activity' };

function tree() {
  return (
    <MemoryRouter initialEntries={[{
      pathname: '/v2/challenges/challenge-1?via=group#activity',
      state: originState,
    }]}>
      <Routes>
        <Route path="/v2/challenges/:challengeId" element={<V2CreatedChallengeScreen />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  h.detail = { isLoading: false, isError: false, data: detail };
  h.memberships = { data: { memberships: [] } };
  h.navigate.mockReset();
});
afterEach(() => cleanup());

describe('Challenge Details post-log private journey', () => {
  it('returns Keep private to the same Challenge Details URL and preserves its return context', () => {
    render(tree());
    fireEvent.click(screen.getByRole('button', { name: 'Log activity' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep private' }));

    expect(h.navigate).toHaveBeenCalledWith(
      '/v2/challenges/challenge-1?via=group#activity',
      { replace: true, state: originState },
    );
  });
});
