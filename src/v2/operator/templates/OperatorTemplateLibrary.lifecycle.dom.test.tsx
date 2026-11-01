import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../api/apiError';
import { OperatorTemplateLibrary } from './OperatorTemplateLibrary';
import { TEMPLATE_ID, TOKEN_A, contentOf, detailOf, versionOf } from './testing/fixtures';

const h = vi.hoisted(() => ({
  capabilities: vi.fn(), list: vi.fn(), detail: vi.fn(), adoption: vi.fn(), readiness: vi.fn(), revise: vi.fn(), retire: vi.fn(),
}));

vi.mock('./useTemplateCapabilities', () => ({ useTemplateCapabilities: () => ({ data: h.capabilities() }) }));
vi.mock('../../../api/operatorTemplatesApi', async (original) => ({
  ...(await original<typeof import('../../../api/operatorTemplatesApi')>()),
  fetchOperatorTemplatePage: h.list, fetchOperatorTemplate: h.detail, fetchTemplateAdoption: h.adoption,
  fetchTemplateMemberReadiness: h.readiness, reviseTemplate: h.revise, retireTemplate: h.retire,
}));

function publishedDetail(withDraft = false) {
  const published = versionOf(null, contentOf(), { version: 1, state: 'published', publishedAt: '2026-10-30T09:00:00Z', publishedByMemberId: 'author' });
  const versions = withDraft ? [published, versionOf(TOKEN_A, contentOf({ summary: 'Open revision' }), { version: 2 })] : [published];
  return { ...detailOf(versions), lifecycle: 'published' as const, latestPublishedVersion: 1, latestPublishedAt: published.publishedAt };
}

const summary = {
  templateId: TEMPLATE_ID, lifecycle: 'draft' as const, createdByMemberId: 'author', createdAt: '2026-10-30T08:00:00Z',
  latestPublishedVersion: null, latestVersion: 1, openDraftVersion: 1, title: 'Hundred Rep Race', summary: 'A short race.',
  challengeType: 'competitive' as const, durationDays: 14, focusTags: ['Strength'],
};

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/v2/operator/templates']}>
        <Routes>
          <Route path="/v2/operator/templates" element={<OperatorTemplateLibrary />} />
          <Route path="/v2/operator/templates/:templateId/edit" element={<div>existing draft editor</div>} />
          <Route path="*" element={<div>elsewhere</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  h.capabilities.mockReturnValue({ canAuthor: true, canRead: true });
  h.list.mockResolvedValue({ templates: [summary], nextCursor: null });
  h.detail.mockResolvedValue(detailOf([versionOf(TOKEN_A)]));
  h.adoption.mockResolvedValue([]);
  h.readiness.mockResolvedValue({ templateId: TEMPLATE_ID, version: 1, adoptable: true, unavailableReason: null });
  h.revise.mockResolvedValue({ templateId: TEMPLATE_ID, version: 2 });
  h.retire.mockImplementation(async () => {
    h.detail.mockResolvedValue({ ...detailOf([versionOf(TOKEN_A)]), lifecycle: 'retired', retiredAt: '2026-11-01T08:00:00Z', retiredReason: null });
    return { templateId: TEMPLATE_ID, lifecycle: 'retired' };
  });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('Operator Template lifecycle actions', () => {
  it('lets an author discard an unpublished draft only after confirmation; blank reason is allowed', async () => {
    mount();
    const discard = await screen.findByRole('button', { name: 'Discard this unpublished Template' });
    await userEvent.click(discard);
    expect(screen.getByRole('dialog', { name: 'Discard this unpublished Template?' })).toBeTruthy();
    await userEvent.clear(screen.getByLabelText(/Reason/));
    expect(h.retire).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog', { name: 'Discard this unpublished Template?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Discard this unpublished Template' }));
    await waitFor(() => expect(h.retire).toHaveBeenCalledWith(TEMPLATE_ID, undefined));
    expect(await screen.findByText(/Template retired/)).toBeTruthy();
  });

  it('Cancel closes the confirmation without calling the retirement endpoint', async () => {
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Discard this unpublished Template' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(h.retire).not.toHaveBeenCalled();
  });

  it('revises a published Template using the existing endpoint and opens its draft editor', async () => {
    h.detail.mockResolvedValue(publishedDetail());
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Revise' }));
    expect(await screen.findByText('existing draft editor')).toBeTruthy();
    expect(h.revise).toHaveBeenCalledWith(TEMPLATE_ID);
  });

  it('opens an already-created draft after a concurrent revise response', async () => {
    h.detail.mockResolvedValueOnce(publishedDetail()).mockResolvedValue(publishedDetail(true));
    h.revise.mockRejectedValue(new ApiError(409, 'template_draft_open', 'draft already exists'));
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Revise' }));
    expect(await screen.findByText('existing draft editor')).toBeTruthy();
    expect(h.revise).toHaveBeenCalledWith(TEMPLATE_ID);
  });

  it('shows Needs revision from the member endpoint response and does not derive eligibility', async () => {
    h.detail.mockResolvedValue(publishedDetail());
    h.readiness.mockResolvedValue({ templateId: TEMPLATE_ID, version: 1, adoptable: false, unavailableReason: 'STALE_ACTIVITY' });
    mount();
    expect(await screen.findByText('Needs revision · STALE_ACTIVITY')).toBeTruthy();
    expect(h.readiness).toHaveBeenCalledWith(TEMPLATE_ID);
  });

  it('omits the indicator for member-read 404 and keeps an unavailable read non-blocking', async () => {
    h.detail.mockResolvedValue(publishedDetail());
    h.readiness.mockRejectedValue(new ApiError(404, 'template_not_found', 'gone'));
    mount();
    await screen.findByRole('button', { name: 'Revise' });
    expect(screen.queryByText(/Needs revision/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Revise' })).toBeTruthy();
  });

  it('shows the retirement warning for an open revision and trims an optional reason', async () => {
    h.detail.mockResolvedValue(publishedDetail(true));
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Retire Template' }));
    expect(screen.getByText(/open draft will remain.*no longer be saved or published/i)).toBeTruthy();
    await userEvent.type(screen.getByLabelText(/Reason/), '  obsolete content  ');
    expect((screen.getByLabelText(/Reason/) as HTMLTextAreaElement).maxLength).toBe(500);
    const dialog = screen.getByRole('dialog', { name: 'Retire Template?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Retire Template' }));
    await waitFor(() => expect(h.retire).toHaveBeenCalledWith(TEMPLATE_ID, '  obsolete content  '));
  });

  it('allows a supplied reason of exactly 500 characters', async () => {
    h.detail.mockResolvedValue(publishedDetail());
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Retire Template' }));
    const reason = screen.getByLabelText(/Reason/) as HTMLTextAreaElement;
    const value = 'x'.repeat(500);
    fireEvent.change(reason, { target: { value } });
    expect(reason.value).toHaveLength(500);
    const dialog = screen.getByRole('dialog', { name: 'Retire Template?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Retire Template' }));
    await waitFor(() => expect(h.retire).toHaveBeenCalledWith(TEMPLATE_ID, value));
  });

  it('confirms a published Template retirement and rereads to resolve an unknown write outcome', async () => {
    h.detail.mockResolvedValueOnce(publishedDetail()).mockResolvedValueOnce({ ...publishedDetail(), lifecycle: 'retired', retiredAt: '2026-11-01T08:00:00Z', retiredReason: null });
    h.retire.mockRejectedValue(new ApiError(503, 'api_unreachable', 'unknown result'));
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Retire Template' }));
    const dialog = screen.getByRole('dialog', { name: 'Retire Template?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Retire Template' }));
    expect(await screen.findByText('Template retired. Existing Challenges are unchanged.')).toBeTruthy();
    expect(h.retire).toHaveBeenCalledWith(TEMPLATE_ID, undefined);
    expect(h.detail.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('shows a retirement error in the confirmation and removes the write action after revocation', async () => {
    h.detail.mockResolvedValue(publishedDetail());
    h.retire.mockRejectedValue(new ApiError(403, 'template_author_required', 'revoked'));
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Retire Template' }));
    const dialog = screen.getByRole('dialog', { name: 'Retire Template?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Retire Template' }));
    expect(await within(dialog).findByRole('alert')).toBeTruthy();
    expect(within(dialog).queryByRole('button', { name: 'Retire Template' })).toBeNull();
    expect((within(dialog).getByLabelText(/Reason/) as HTMLTextAreaElement).disabled).toBe(true);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('refreshes server readiness after the detail panel is closed and reopened', async () => {
    const secondId = '22222222-2222-4222-8222-222222222222';
    h.list.mockResolvedValue({
      templates: [summary, { ...summary, templateId: secondId, title: 'Other Template' }], nextCursor: null,
    });
    h.detail.mockImplementation(async (id: string) => publishedDetail().templateId === id
      ? publishedDetail()
      : { ...publishedDetail(), templateId: secondId });
    h.readiness.mockResolvedValue({ templateId: TEMPLATE_ID, version: 1, adoptable: false, unavailableReason: 'STALE_ACTIVITY' });
    mount();
    await screen.findByText('Needs revision · STALE_ACTIVITY');
    await userEvent.click(screen.getByRole('button', { name: /Other Template/ }));
    await screen.findByText('Other Template');
    await userEvent.click(screen.getByRole('button', { name: /Hundred Rep Race/ }));
    await screen.findByText('Needs revision · STALE_ACTIVITY');
    expect(h.readiness).toHaveBeenCalledTimes(3);
  });

  it('shows no lifecycle actions to a Console reader and reports ordinary-member denial distinctly', async () => {
    h.capabilities.mockReturnValue({ canAuthor: false, canRead: true });
    h.detail.mockResolvedValue(detailOf([versionOf(TOKEN_A)]));
    mount();
    expect(await screen.findByText('Hundred Rep Race')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Revise|Retire Template|Discard this unpublished/ })).toBeNull();

    cleanup();
    h.list.mockRejectedValue(new ApiError(403, 'operator_console_access_required', 'denied'));
    h.capabilities.mockReturnValue({ canAuthor: false, canRead: false });
    mount();
    expect(await screen.findByText('Template Library access denied')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Revise|Retire Template|Discard this unpublished/ })).toBeNull();
  });
});
