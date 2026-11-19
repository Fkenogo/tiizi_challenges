import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { V2GroupDetail, V2ViewerRelationship } from '../../api/groupsApi';
import type { V2ChallengeSummary } from '../../api/v2ChallengeApi';

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  locationState: null as unknown,
  detail: {} as any,
  hosted: {} as any,
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => h.navigate,
    useLocation: () => ({ pathname: '/v2/groups/group-1', state: h.locationState, search: '', hash: '' }),
  };
});

vi.mock('../group/V2GroupScope', () => ({ useV2GroupId: () => 'group-1' }));

vi.mock('./useV2Groups', () => ({
  useV2GroupDetail: () => h.detail,
  useV2GroupChallenges: () => h.hosted,
  useV2GroupRoster: () => ({ data: { members: [] }, isLoading: false, isError: false, isSuccess: true }),
  useV2Groups: () => ({ data: { memberId: 'member-1' }, isLoading: false, isError: false, isSuccess: true }),
  useJoinGroup: () => ({ mutate: vi.fn(), isPending: false, isError: false, error: null }),
  useLeaveV2Group: () => ({ mutate: vi.fn(), isPending: false, isError: false, error: null }),
  usePendingGroupApplications: () => ({ data: [], isLoading: false, isError: false }),
  useReviewGroupApplication: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('./useV2GroupFeed', () => ({
  useV2GroupFeed: () => ({ data: { pages: [] }, isLoading: false, isError: false }),
}));

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { uid: 'uid-1' } }) }));

vi.mock('../challenges/useChallengeCreation', () => ({
  useChallengeContributorsV2: () => ({ data: { contributors: [] }, isLoading: false, isError: false }),
  useCompetitiveLeaderboardV2: () => ({ data: { entries: [] }, isLoading: false, isError: false }),
}));

import { V2GroupHomeScreen } from './V2GroupHomeScreen';

const CHALLENGE_ID = '11111111-2222-3333-4444-555555555555';

function detail(viewerRelationship: V2ViewerRelationship): V2GroupDetail {
  return {
    id: 'group-1',
    name: 'KILIMANJARO — S5b Today Preview',
    description: 'Local Development preview Group for the S5b Today experience.',
    isPrivate: false,
    requireAdminApproval: false,
    allowMemberChallenges: true,
    memberCount: 1,
    steward: { memberId: 'member-1' },
    viewerMembership: viewerRelationship === 'none' ? null : { status: 'active', role: 'member' },
    viewerRelationship,
    createdAt: '2026-11-01T00:00:00.000Z',
    coverId: null,
    tagline: 'Move together, every day.',
    location: 'Local preview',
    focusTags: ['Strength'],
    goalIds: ['build_strength'],
    goals: ['Build strength'],
    customGoal: null,
    communityNormIds: null,
    communityNorms: null,
    customCommunityNorm: null,
    rules: null,
  };
}

function hostedChallenge(): V2ChallengeSummary {
  return {
    challengeId: CHALLENGE_ID,
    groupId: 'group-1',
    title: 'Morning Momentum',
    description: 'Two short activities, every single day.',
    challengeType: 'streak',
    status: 'active',
    startDate: '2026-11-04',
    endDate: '2026-12-02',
    timezone: 'UTC',
    governingToday: '2026-11-18',
    finalized: false,
    currentConfigVersion: 1,
    goalValue: null,
    goalUnit: null,
    collectiveTotal: 0,
    collectiveGoalReached: false,
    completionsCount: 0,
    myParticipation: null,
    activities: [],
  } as unknown as V2ChallengeSummary;
}

function renderHome() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <V2GroupHomeScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AEC-DISC-02 — Group Home hosted-Challenge routing', () => {
  beforeEach(() => {
    h.navigate.mockClear();
    h.locationState = null;
    h.detail = { data: detail('none'), isLoading: false, isError: false, isSuccess: true };
    h.hosted = {
      data: { memberId: 'member-1', groupId: 'group-1', challenges: [hostedChallenge()] },
      isLoading: false,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    };
  });

  afterEach(() => {
    cleanup();
  });

  it('sends a NON-MEMBER (none) to the authorized discovery preview', async () => {
    h.detail = { data: detail('none'), isLoading: false, isError: false, isSuccess: true };
    renderHome();
    const card = await screen.findByRole('button', { name: `Open Morning Momentum` });
    card.click();
    expect(h.navigate).toHaveBeenCalledWith(`/v2/challenges/discovery/${CHALLENGE_ID}`);
  });

  it('never offers a hosted Challenge to a PENDING applicant (the read is gated upstream)', async () => {
    // `useV2GroupChallenges` is disabled while the viewer's relationship is
    // 'pending', so a pending applicant is never shown a hosted Challenge and
    // therefore cannot reach either route from Group Home.
    h.detail = { data: detail('pending'), isLoading: false, isError: false, isSuccess: true };
    renderHome();
    await screen.findByRole('heading', { name: /KILIMANJARO/ });
    expect(screen.queryByRole('button', { name: `Open Morning Momentum` })).toBeNull();
    expect(h.navigate).not.toHaveBeenCalled();
  });

  it('keeps a MEMBER on the existing member Challenge route', async () => {
    h.detail = { data: detail('member'), isLoading: false, isError: false, isSuccess: true };
    renderHome();
    const card = await screen.findByRole('button', { name: `Open Morning Momentum` });
    card.click();
    expect(h.navigate).toHaveBeenCalledWith(`/v2/challenges/${CHALLENGE_ID}`);
  });

  it('keeps a STEWARD on the existing member Challenge route', async () => {
    h.detail = { data: detail('steward'), isLoading: false, isError: false, isSuccess: true };
    renderHome();
    const card = await screen.findByRole('button', { name: `Open Morning Momentum` });
    card.click();
    expect(h.navigate).toHaveBeenCalledWith(`/v2/challenges/${CHALLENGE_ID}`);
  });

  it('never sends a non-member to the member route', async () => {
    for (const relationship of ['none'] as V2ViewerRelationship[]) {
      h.navigate.mockClear();
      h.detail = { data: detail(relationship), isLoading: false, isError: false, isSuccess: true };
      cleanup();
      renderHome();
      const card = await screen.findByRole('button', { name: `Open Morning Momentum` });
      card.click();
      expect(h.navigate).not.toHaveBeenCalledWith(`/v2/challenges/${CHALLENGE_ID}`);
    }
  });
});
