import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { V2ChallengeCreationWizard } from './V2ChallengeCreationWizard';
import { createChallengeWizardRouteState, createInitialWizardState, isWizardComplete } from './challengeCreationDraft';
import { isRefreshPlanFresh, planActivityRefresh } from './wizardSteps/activityRefresh';

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

function makeStaleStreakDraft() {
  const base = createInitialWizardState();
  return {
    ...base,
    groupId: '11111111-1111-4111-8111-111111111111',
    groupName: 'Morning Club',
    challengeType: 'streak' as const,
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
        kind: 'wellness' as const,
        metric: 'duration',
        unit: 'minutes',
        targetValue: '10',
        durationMode: 'ACCUMULATED',
        completionOccurrence: '',
        loadBasis: '',
        options: {
          knowledgeId: '22222222-2222-4222-8222-222222222222',
          activityCode: 'breathing',
          kind: 'wellness' as const,
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
  };
}

function makeStaleStreakRouteState() {
  return createChallengeWizardRouteState(makeStaleStreakDraft(), 6);
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

  it('invalidates a pending refresh proposal when the member goes back and changes the activity target, preserving the newer edit', async () => {
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

    renderWizard();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Review & refresh activity' })).toBeTruthy();
    });

    // Open refresh proposal
    fireEvent.click(screen.getByRole('button', { name: 'Review & refresh activity' }));
    await waitFor(() => {
      expect(screen.getByText(/Review update for Breathing Practice/i)).toBeTruthy();
    });

    // Go back to What counts, change target from 10 to 25, then return to Review
    fireEvent.click(screen.getByRole('button', { name: 'Back' })); // Step 6 -> Step 5 (Schedule)
    fireEvent.click(screen.getByRole('button', { name: 'Back' })); // Step 5 -> Step 4 (What counts)
    const targetInput = screen.getByLabelText(/Daily requirement/i) as HTMLInputElement;
    fireEvent.change(targetInput, { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' })); // -> Schedule
    fireEvent.click(screen.getByRole('button', { name: 'Continue' })); // -> Review

    // Old proposal was invalidated and member sees clear prompt to review again
    await waitFor(() => {
      expect(screen.queryByText(/Review update for Breathing Practice/i)).toBeNull();
      expect(screen.getByText(/Review the update again/i)).toBeTruthy();
    });

    // Re-review and accept: newer target 25 is preserved!
    fireEvent.click(screen.getByRole('button', { name: 'Review & refresh activity' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Accept & refresh/i })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: /Accept & refresh/i }));
    await waitFor(() => {
      expect(screen.getByText(/Everything checks out/i)).toBeTruthy();
    });
    expect(screen.getAllByText(/25 .*Breathing Practice/i).length).toBeGreaterThan(0);
  });

  it('reconciles fallback to duration with CONTINUOUS durationMode, flags newly required completionOccurrence, and tracks source identity across index shifts', () => {
    const baseDraft = makeStaleStreakDraft();
    const baseActivity = baseDraft.activities[0];

    // 1. Fallback from repetitions (empty durationMode) to duration initializes durationMode='CONTINUOUS'
    const repActivity = {
      ...baseActivity,
      metric: 'repetitions',
      unit: 'reps',
      durationMode: '',
    };
    const durationPlan = planActivityRefresh(
      repActivity,
      {
        knowledgeId: repActivity.activity,
        activityCode: 'breathing',
        kind: 'wellness',
        currentVersion: 2,
        primaryMetrics: ['duration'],
        secondaryMetrics: [],
        compatibleUnits: ['minutes'],
        components: [],
        supportedLoadBases: [],
        unitsByMetric: { duration: ['minutes'] },
      },
      'streak',
    );
    expect(durationPlan.updated.metric).toBe('duration');
    expect(durationPlan.updated.durationMode).toBe('CONTINUOUS');
    expect(durationPlan.missingRequiredFields).toEqual([]);
    const stateAfterDuration = {
      ...baseDraft,
      activities: [durationPlan.updated],
    };
    expect(isWizardComplete(stateAfterDuration)).toBe(true);

    // 2. Fallback to completion flags missing completionOccurrence explicitly
    const completionPlan = planActivityRefresh(
      repActivity,
      {
        knowledgeId: repActivity.activity,
        activityCode: 'breathing',
        kind: 'wellness',
        currentVersion: 2,
        primaryMetrics: ['completion'],
        secondaryMetrics: [],
        compatibleUnits: ['sessions'],
        components: [],
        supportedLoadBases: [],
        unitsByMetric: { completion: ['sessions'] },
      },
      'streak',
    );
    expect(completionPlan.missingRequiredFields).toContain('completionOccurrence');

    // 3. Index shift when an earlier activity is removed still resolves by sourceActivityId, while replacing/removing rejects
    const earlierActivity = { ...baseActivity, activity: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Warmup' };
    const planAtEnd = planActivityRefresh(
      baseActivity,
      { ...baseActivity.options, currentVersion: 2 },
      'streak',
    );
    expect(isRefreshPlanFresh(planAtEnd, { activities: [baseActivity], challengeType: 'streak' })).toEqual({
      fresh: true,
      currentIndex: 0,
      reason: 'ok',
    });
    expect(isRefreshPlanFresh(planAtEnd, { activities: [earlierActivity], challengeType: 'streak' })).toEqual({
      fresh: false,
      currentIndex: -1,
      reason: 'removed',
    });
  });
});
