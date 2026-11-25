import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { V2ChallengeCreationWizard } from './V2ChallengeCreationWizard';
import { createChallengeWizardRouteState, createInitialWizardState } from './challengeCreationDraft';

const h = vi.hoisted(() => ({
  previewChallengeDefinition: vi.fn(),
  fetchActivityOptions: vi.fn(),
  establishMutateAsync: vi.fn(),
  saveChallengeCoverImage: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => h.navigate,
  };
});

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'uid-founder' } }),
}));

vi.mock('../../api/challengeCreationApi', async () => {
  const actual = await vi.importActual<typeof import('../../api/challengeCreationApi')>('../../api/challengeCreationApi');
  return {
    ...actual,
    previewChallengeDefinition: h.previewChallengeDefinition,
    fetchActivityOptions: h.fetchActivityOptions,
  };
});

vi.mock('./useChallengeCreation', () => ({
  useEstablishChallenge: () => ({ mutateAsync: h.establishMutateAsync }),
  useV2Memberships: () => ({
    isLoading: false,
    isError: false,
    data: {
      memberships: [
        {
          groupId: '11111111-1111-4111-8111-111111111111',
          role: 'owner',
          group: { name: 'Morning Club', allowMemberChallenges: true },
        },
      ],
    },
  }),
}));

vi.mock('../../api/mediaApi', () => ({
  saveChallengeCoverImage: h.saveChallengeCoverImage,
  removeChallengeCoverImage: vi.fn(),
}));

function makeStaleStreakRouteState() {
  const base = createInitialWizardState();
  return createChallengeWizardRouteState(
    {
      ...base,
      groupId: '11111111-1111-4111-8111-111111111111',
      groupName: 'Morning Club',
      challengeType: 'streak',
      title: '7-Day Breathing Practice',
      description: 'Daily breathing habit',
      durationDays: 7,
      startDate: '2026-11-25',
      endDate: '2026-12-01',
      activities: [
        {
          activity: '22222222-2222-4222-8222-222222222222',
          observedVersion: 1,
          name: 'Breathing Practice',
          kind: 'wellness',
          metric: 'duration',
          unit: 'minutes',
          targetValue: '10',
          durationMode: 'ACCUMULATED',
          completionOccurrence: '',
          loadBasis: '',
          options: {
            knowledgeId: '22222222-2222-4222-8222-222222222222',
            activityCode: 'breathing',
            kind: 'wellness',
            currentVersion: 1,
            primaryMetrics: ['duration'],
            secondaryMetrics: [],
            compatibleUnits: ['minutes'],
            components: [],
            supportedLoadBases: [],
            unitsByMetric: { duration: ['minutes'] },
          },
        },
      ],
      templateRef: { templateId: 'tpl-breathing', version: 1, title: '7-Day Breathing Practice' },
    },
    6,
  );
}

function renderWizard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[{ pathname: '/v2/challenges/new', state: makeStaleStreakRouteState() }]}>
        <V2ChallengeCreationWizard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('V2ChallengeCreationWizard stale activity explicit refresh', () => {
  beforeEach(() => {
    h.previewChallengeDefinition.mockReset();
    h.fetchActivityOptions.mockReset();
    h.establishMutateAsync.mockReset();
    h.saveChallengeCoverImage.mockReset();
    h.navigate.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('requires explicit review and refresh for stale activity v1->v2, supports decline, and creates once after acceptance', async () => {
    h.previewChallengeDefinition.mockImplementation(async (draft: { activities: Array<{ observedVersion: number }> }) => {
      if (draft.activities[0].observedVersion === 1) {
        return {
          ok: false,
          issues: [
            {
              code: 'STALE_ACTIVITY',
              activityIndex: 0,
              field: 'activities[].observedVersion',
              message: "composer: activity '22222222-2222-4222-8222-222222222222' observed v1 but current is v2 (explicit refresh required; silent upgrade is never performed)",
            },
          ],
        };
      }
      return { ok: true, definition: {} };
    });

    h.fetchActivityOptions.mockResolvedValue({
      knowledgeId: '22222222-2222-4222-8222-222222222222',
      activityCode: 'breathing',
      kind: 'wellness',
      currentVersion: 2,
      primaryMetrics: ['duration'],
      secondaryMetrics: [],
      compatibleUnits: ['minutes'],
      components: [],
      supportedLoadBases: [],
      unitsByMetric: { duration: ['minutes'] },
    });

    h.establishMutateAsync.mockResolvedValue({
      challengeId: '33333333-3333-4333-8333-333333333333',
      groupId: '11111111-1111-4111-8111-111111111111',
    });

    renderWizard();

    // 1. Shows friendly non-UUID message and Review & refresh activity button; Create stays disabled
    await waitFor(() => {
      expect(screen.getByText(/updated guide version/i)).toBeTruthy();
    });
    expect(screen.queryByText(/22222222-2222-4222-8222-222222222222/)).toBeNull();
    const createBtn = screen.getByRole('button', { name: 'Create Challenge' }) as HTMLButtonElement;
    expect(createBtn.disabled).toBe(true);

    // 2. Review and decline keeps v1 and keeps creation blocked
    fireEvent.click(screen.getByRole('button', { name: 'Review & refresh activity' }));
    await waitFor(() => {
      expect(screen.getByText(/Review update for Breathing Practice/i)).toBeTruthy();
    });
    expect(screen.getByText(/version 1 to version 2/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Keep current' }));
    expect(screen.queryByText(/Review update for Breathing Practice/i)).toBeNull();
    expect((screen.getByRole('button', { name: 'Create Challenge' }) as HTMLButtonElement).disabled).toBe(true);

    // 3. Review and accept upgrades to v2, revalidates, and allows single Challenge creation
    fireEvent.click(screen.getByRole('button', { name: 'Review & refresh activity' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Accept & refresh/i })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: /Accept & refresh/i }));

    await waitFor(() => {
      expect(screen.getByText(/Everything checks out/i)).toBeTruthy();
    });
    expect((screen.getByRole('button', { name: 'Create Challenge' }) as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Create Challenge' }));
    await waitFor(() => {
      expect(h.establishMutateAsync).toHaveBeenCalledTimes(1);
    });
    expect(h.navigate).toHaveBeenCalledWith('/v2/challenges/33333333-3333-4333-8333-333333333333', { replace: true });
  });

  it('shows a safe error if loading updated activity details fails, and stays blocked if revalidation still fails', async () => {
    h.previewChallengeDefinition.mockResolvedValue({
      ok: false,
      issues: [
        {
          code: 'STALE_ACTIVITY',
          activityIndex: 0,
          field: 'activities[].observedVersion',
          message: "composer: activity '22222222-2222-4222-8222-222222222222' observed v1 but current is v2 (explicit refresh required; silent upgrade is never performed)",
        },
      ],
    });
    h.fetchActivityOptions.mockRejectedValueOnce(new Error('network error'));

    renderWizard();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Review & refresh activity' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Review & refresh activity' }));
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Breathing Practice');
    });
    expect((screen.getByRole('button', { name: 'Create Challenge' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
