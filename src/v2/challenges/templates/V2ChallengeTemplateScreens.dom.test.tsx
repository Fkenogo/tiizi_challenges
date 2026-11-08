import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const previewApi = vi.hoisted(() => ({ template: null as any }));
vi.mock('../../../api/challengeTemplatesApi', () => ({
  fetchMemberTemplate: vi.fn(async () => previewApi.template),
  fetchMemberTemplates: vi.fn(async () => ({ templates: [previewApi.template], nextCursor: null })),
}));
vi.mock('../../../api/knowledgeApi', () => ({
  fetchKnowledgeById: vi.fn(async () => ({ id: '11111111-1111-4111-8111-111111111111', activityCode: 'FIT-STR-001', name: 'Push-Up', kind: 'fitness', category: 'Strength', subcategory: 'Push', imageUrl: '' })),
}));
vi.mock('../../../api/challengeCreationApi', () => ({
  fetchActivityOptions: vi.fn(async () => ({ knowledgeId: '11111111-1111-4111-8111-111111111111', activityCode: 'FIT-STR-001', kind: 'fitness', currentVersion: 1, primaryMetrics: ['repetitions'], secondaryMetrics: [], compatibleUnits: ['reps'], components: [], supportedLoadBases: [], unitsByMetric: { repetitions: ['reps'] } })),
}));

import { V2ChallengeStartScreen, V2ChallengeTemplatePreview } from './V2ChallengeTemplateScreens';

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}|{JSON.stringify(location.state)}</output>;
}

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('approved Challenge entry choices', () => {
  it('sends From scratch into the existing seven-step wizard route', async () => {
    render(<MemoryRouter initialEntries={['/v2/challenges/start']}><LocationProbe /><Routes>
      <Route path="/v2/challenges/start" element={<V2ChallengeStartScreen />} />
      <Route path="/v2/challenges/new" element={<p>Existing seven-step wizard</p>} />
    </Routes></MemoryRouter>);
    await userEvent.click(screen.getByRole('button', { name: /Start from scratch/ }));
    expect(screen.getByText('Existing seven-step wizard')).toBeTruthy();
    expect(screen.getByTestId('location').textContent).toBe('/v2/challenges/new|{}');
  });

  it('sends From template into the approved member Template Library route', async () => {
    render(<MemoryRouter initialEntries={['/v2/challenges/start']}><LocationProbe /><Routes>
      <Route path="/v2/challenges/start" element={<V2ChallengeStartScreen />} />
      <Route path="/v2/challenges/templates" element={<p>Member Template Library</p>} />
    </Routes></MemoryRouter>);
    await userEvent.click(screen.getByRole('button', { name: /Use a template/ }));
    expect(screen.getByText('Member Template Library')).toBeTruthy();
    expect(screen.getByTestId('location').textContent).toBe('/v2/challenges/templates|{}');
  });

  it('uses the approved read-only Template journey to prefill the existing wizard', async () => {
    previewApi.template = {
      templateId: 'founder-preview-push-up-together', version: 1, title: '30-Day Push-Up Together Challenge',
      summary: 'The whole Group adds Push-Ups towards one shared total.',
      description: 'Reach 3,000 together within 30 days.', challengeType: 'collective', durationDays: 30,
      durationPresetDays: [14, 30], coverId: 'challenge-5', focusTags: ['Strength'], publishedAt: null,
      adoptable: true, unavailableReason: null, simulatedPublication: true,
      composer: { draftKind: 'pf04-v1', mode: 'CHALLENGE', challengeType: 'collective', activities: [
        { activity: '11111111-1111-4111-8111-111111111111', observedVersion: 1, kind: 'fitness', metric: 'repetitions', unit: 'reps', targetValue: 3000, position: 0 },
      ] },
    };
    const queryClient = makeQueryClient();
    render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={['/v2/challenges/templates/founder-preview-push-up-together']}>
      <LocationProbe /><Routes>
        <Route path="/v2/challenges/templates/:templateId" element={<V2ChallengeTemplatePreview />} />
        <Route path="/v2/challenges/new" element={<p>Existing seven-step wizard</p>} />
      </Routes>
    </MemoryRouter></QueryClientProvider>);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Use this template' })).toBeTruthy());
    await userEvent.click(screen.getByRole('button', { name: 'Use this template' }));
    expect(screen.getByText('Existing seven-step wizard')).toBeTruthy();
    const route = JSON.parse(screen.getByTestId('location').textContent!.split('|')[1]);
    expect(route.challengeStepIndex).toBe(1);
    expect(route.challengeDraft).toMatchObject({
      challengeType: 'collective', groupId: null, title: '30-Day Push-Up Together Challenge',
      description: 'Reach 3,000 together within 30 days.', coverId: 'challenge-5', durationDays: 30,
      activities: [{ activityCode: 'FIT-STR-001', metric: 'repetitions', unit: 'reps', targetValue: '3000' }],
    });
  });
});
