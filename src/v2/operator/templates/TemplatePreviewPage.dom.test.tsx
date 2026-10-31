import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../api/apiError';
import { TemplatePreviewPage } from './TemplatePreviewPage';
import { TEMPLATE_ID, TOKEN_A, activityConfig, contentOf, detailOf, knowledge, versionOf } from './testing/fixtures';

const h = vi.hoisted(() => ({
  user: { uid: 'reader-1' } as { uid: string } | null,
  capabilities: vi.fn(), detail: vi.fn(), item: vi.fn(), create: vi.fn(), save: vi.fn(), validate: vi.fn(),
}));

vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ user: h.user }) }));
vi.mock('../../../api/operatorTemplatesApi', async (original) => ({
  ...(await original<typeof import('../../../api/operatorTemplatesApi')>()),
  fetchTemplateCapabilities: h.capabilities, fetchOperatorTemplate: h.detail,
  createTemplateDraft: h.create, saveTemplateDraft: h.save, validateTemplateDraft: h.validate,
}));
vi.mock('../../../api/knowledgeApi', async (original) => ({ ...(await original<typeof import('../../../api/knowledgeApi')>()), fetchKnowledgeById: h.item }));

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/v2/operator/templates/${TEMPLATE_ID}/preview`]}>
        <Routes>
          <Route path="/v2/operator/templates/:templateId/preview" element={<TemplatePreviewPage />} />
          <Route path="*" element={<div>elsewhere</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const rich = contentOf({ summary: 'A short race to one hundred.', focusTags: ['Strength', 'Endurance'] }, [
  activityConfig('act-1', { targetValue: 100 }),
  activityConfig('act-2', { metric: 'duration', unit: 'minutes', targetValue: 5, durationMode: 'ACCUMULATED', position: 1 }),
]);

beforeEach(() => {
  vi.stubEnv('VITE_TIIZI_API_BASE_URL', 'http://api.test');
  h.user = { uid: 'reader-1' };
  h.capabilities.mockResolvedValue({ canAuthor: false, canRead: true });
  h.detail.mockResolvedValue(detailOf([versionOf(TOKEN_A, rich)]));
  h.item.mockImplementation(async (id: string) => knowledge(id, id === 'act-1' ? 'Push-ups' : 'Plank'));
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('read-only Template preview', () => {
  it('shows a Console reader the member-style content of the saved draft', async () => {
    mount();
    const preview = await screen.findByLabelText('Template preview');
    expect(within(preview).getByRole('heading', { name: 'Hundred Rep Race' })).toBeTruthy();
    expect(within(preview).getByText('Race Challenge')).toBeTruthy();
    expect(within(preview).getByText('Race')).toBeTruthy();
    expect(within(preview).getByText('A short race to one hundred.')).toBeTruthy();
    expect(within(within(preview).getByLabelText('Interests')).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Strength', 'Endurance']);
    expect(within(preview).getByText('14 days')).toBeTruthy();
    expect(within(preview).getByText(/Members can choose: 7 days, 14 days/)).toBeTruthy();
    expect(screen.getByText('Saved draft, version 1')).toBeTruthy();
  });

  it('shows each Activity with its target, unit and counting settings, in stored order', async () => {
    mount();
    const list = await screen.findByLabelText('Activities in this Template');
    const cards = list.querySelectorAll('[data-preview-activity]');
    expect([...cards].map((c) => c.getAttribute('data-preview-activity'))).toEqual(['act-1', 'act-2']);
    expect(within(cards[0] as HTMLElement).getByText('Push-ups')).toBeTruthy();
    expect(within(cards[0] as HTMLElement).getByText(/Reps in reps · target 100 reps/)).toBeTruthy();
    expect(within(cards[1] as HTMLElement).getByText(/Time in minutes · target 5 minutes/)).toBeTruthy();
    expect(within(cards[1] as HTMLElement).getByText('How the time counts: Added up across the day')).toBeTruthy();
    expect(screen.getByText(/Everyone who reaches the target is ranked/)).toBeTruthy();
  });

  it('is read-only: no editing, saving, validation or creation control or call', async () => {
    mount();
    await screen.findByLabelText('Template preview');
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText(/Save and check|Save draft|Join|Publish/)).toBeNull();
    expect(h.create).not.toHaveBeenCalled();
    expect(h.save).not.toHaveBeenCalled();
    expect(h.validate).not.toHaveBeenCalled();
    expect(screen.getByRole('note').textContent).toMatch(/no Challenge, no participation/);
  });

  it('keeps previewing when an Activity name cannot be read, and says so', async () => {
    h.item.mockRejectedValue(new Error('gone'));
    mount();
    expect((await screen.findAllByText(/Activity \(name unavailable\)/)).length).toBe(2);
  });

  it('lists what is still missing from an incomplete draft', async () => {
    h.detail.mockResolvedValue(detailOf([versionOf(TOKEN_A, contentOf({ summary: null, durationDays: null }, []))]));
    mount();
    const missing = await screen.findByLabelText('Still missing');
    expect(within(missing).getByText('No summary yet')).toBeTruthy();
    expect(within(missing).getByText('No Activities yet')).toBeTruthy();
  });

  it('denies a member with no Console or authoring standing, without reading the Template', async () => {
    h.capabilities.mockResolvedValue({ canAuthor: false, canRead: false });
    mount();
    expect(await screen.findByText(/do not have access to preview Templates/)).toBeTruthy();
    expect(h.detail).not.toHaveBeenCalled();
  });

  it('shows distinct states for a missing Template, a 403 and a network failure', async () => {
    h.detail.mockRejectedValue(new ApiError(404, 'template_not_found', 'x'));
    mount();
    expect(await screen.findByText('This Template does not exist.')).toBeTruthy();
    cleanup();
    h.detail.mockRejectedValue(new ApiError(403, 'operator_console_access_required', 'x'));
    mount();
    expect(await screen.findByText('You do not have access to this Template.')).toBeTruthy();
    cleanup();
    h.detail.mockRejectedValue(new ApiError(503, 'api_unreachable', 'x'));
    mount();
    expect(await screen.findByText(/preview could not be loaded/)).toBeTruthy();
  });

  it('reports a capability failure instead of an empty or denied page', async () => {
    h.capabilities.mockRejectedValue(new ApiError(503, 'api_unreachable', 'x'));
    mount();
    expect(await screen.findByText(/could not confirm your access/)).toBeTruthy();
  });

  it('is also available to an author, and previews a published version when no draft is open', async () => {
    h.capabilities.mockResolvedValue({ canAuthor: true, canRead: true });
    h.detail.mockResolvedValue(detailOf([versionOf(null, rich)]));
    mount();
    expect(await screen.findByText('Published version 1')).toBeTruthy();
  });
});
