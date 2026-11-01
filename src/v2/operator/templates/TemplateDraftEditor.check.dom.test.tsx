import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../api/apiError';
import { TemplateDraftEditor } from './TemplateDraftEditor';
import { readRecovery } from './templateDraftRecovery';
import { bodyFromContent } from './templateAuthoringModel';
import { CATALOGUE, TEMPLATE_ID, TOKEN_A, TOKEN_B, TOKEN_C, contentOf, detailOf, knowledge, optionsFor, versionOf } from './testing/fixtures';

/** Slice 4: "Save and check" over the existing save contract and the server's validation endpoint. */
const h = vi.hoisted(() => ({
  user: { uid: 'author-1' } as { uid: string } | null,
  capabilities: vi.fn(), detail: vi.fn(), create: vi.fn(), save: vi.fn(), validate: vi.fn(), publish: vi.fn(), options: vi.fn(), catalogue: vi.fn(), item: vi.fn(),
  order: [] as string[],
}));

vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ user: h.user }) }));
vi.mock('../../../api/operatorTemplatesApi', async (original) => ({
  ...(await original<typeof import('../../../api/operatorTemplatesApi')>()),
  fetchTemplateCapabilities: h.capabilities, fetchOperatorTemplate: h.detail, createTemplateDraft: h.create,
  saveTemplateDraft: h.save, validateTemplateDraft: h.validate, publishTemplateVersion: h.publish,
}));
vi.mock('../../../api/challengeCreationApi', async (original) => ({
  ...(await original<typeof import('../../../api/challengeCreationApi')>()),
  fetchActivityOptions: h.options, fetchComposerSelectableKnowledge: h.catalogue,
}));
vi.mock('../../../api/knowledgeApi', async (original) => ({ ...(await original<typeof import('../../../api/knowledgeApi')>()), fetchKnowledgeById: h.item }));

const EDIT = `/v2/operator/templates/${TEMPLATE_ID}/edit`;

function mount(path = EDIT) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/v2/operator/templates/new" element={<TemplateDraftEditor />} />
          <Route path="/v2/operator/templates/:templateId/edit" element={<TemplateDraftEditor />} />
          <Route path="/v2/operator/templates/:templateId/preview" element={<div>preview page</div>} />
          <Route path="*" element={<div>elsewhere</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const serverDraft = (token = TOKEN_A, content = contentOf()) => detailOf([versionOf(token, content)]);
const checkButton = () => screen.getByRole('button', { name: /Save and check|Checking/ }) as HTMLButtonElement;
const step = async (name: RegExp) => userEvent.click(await screen.findByRole('button', { name }));
async function editSummary(text: string) {
  const user = userEvent.setup();
  await screen.findByRole('navigation', { name: 'Editor steps' });
  await step(/Template details/);
  await user.clear(screen.getByLabelText('Template summary'));
  await user.type(screen.getByLabelText('Template summary'), text);
  return user;
}
const ISSUES = [
  { code: 'MISSING_FIELD', field: 'title', message: 'title is required to publish' },
  { code: 'MISSING_FIELD', field: 'summary', message: 'a short member-facing summary is required to publish' },
  { code: 'ACTIVITY_NOT_ELIGIBLE', activityIndex: 0, field: 'activities[].activity', message: 'Activity is not published' },
  { code: 'INCOMPATIBLE_MEASUREMENT', activityIndex: 0, message: 'unit not compatible with metric' },
];

beforeEach(() => {
  sessionStorage.clear();
  vi.stubEnv('VITE_TIIZI_API_BASE_URL', 'http://api.test');
  h.user = { uid: 'author-1' };
  h.order = [];
  h.capabilities.mockResolvedValue({ canAuthor: true, canRead: true });
  h.detail.mockResolvedValue(serverDraft());
  h.options.mockImplementation(async (id: string) => optionsFor(id, 3));
  h.item.mockImplementation(async (id: string) => knowledge(id, id === 'act-1' ? 'Push-ups' : id));
  h.catalogue.mockResolvedValue(CATALOGUE);
  h.create.mockResolvedValue({ templateId: TEMPLATE_ID, version: 1 });
  h.save.mockImplementation(async () => { h.order.push('save'); return { templateId: TEMPLATE_ID, version: 1, revisionToken: TOKEN_B }; });
  h.validate.mockImplementation(async () => { h.order.push('validate'); return { ok: true, issues: [] }; });
  h.publish.mockResolvedValue({ templateId: TEMPLATE_ID, version: 1 });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('Save and check', () => {
  it('saves through the conditional contract first, then validates the saved version once', async () => {
    h.detail.mockResolvedValueOnce(serverDraft()).mockResolvedValue(serverDraft(TOKEN_B, contentOf({ summary: 'Checked summary' })));
    mount();
    const user = await editSummary('Checked summary');
    await user.click(checkButton());
    expect(await screen.findByText(/passed the server check/)).toBeTruthy();
    expect(h.order).toEqual(['save', 'validate']);
    expect(h.save).toHaveBeenCalledWith(TEMPLATE_ID, 1, expect.objectContaining({ summary: 'Checked summary' }), TOKEN_A);
    expect(h.validate).toHaveBeenCalledWith(TEMPLATE_ID, 1);
    expect(h.validate).toHaveBeenCalledTimes(1);
  });

  it('states when the validation actually happened, not when the draft was saved or opened', async () => {
    mount();
    await screen.findByRole('navigation', { name: 'Editor steps' });
    await userEvent.click(checkButton());
    const note = await screen.findByText(/passed the server check when it was checked, at /);
    expect(note.textContent).not.toMatch(/saved or opened/);
  });

  it('validates an unchanged saved draft without writing', async () => {
    mount();
    await screen.findByRole('navigation', { name: 'Editor steps' });
    await userEvent.click(checkButton());
    expect(await screen.findByText(/passed the server check/)).toBeTruthy();
    expect(h.save).not.toHaveBeenCalled();
    expect(h.validate).toHaveBeenCalledTimes(1);
  });

  it('does not validate when the save fails, and shows the save failure instead', async () => {
    h.save.mockRejectedValue(new ApiError(400, 'invalid_template_request', 'summary is too long'));
    mount();
    const user = await editSummary('x');
    await user.click(checkButton());
    expect(await screen.findByText(/did not accept this draft/)).toBeTruthy();
    expect(h.validate).not.toHaveBeenCalled();
  });

  it('after creating a new draft, checks it once the first revision token is read back', async () => {
    h.create.mockImplementation(async (body: ReturnType<typeof bodyFromContent>) => {
      h.detail.mockResolvedValue(serverDraft(TOKEN_A, body as unknown as ReturnType<typeof contentOf>));
      return { templateId: TEMPLATE_ID, version: 1 };
    });
    mount('/v2/operator/templates/new');
    const user = userEvent.setup();
    await screen.findByRole('navigation', { name: 'Editor steps' });
    await user.click(screen.getAllByRole('button', { name: /Race/ })[0]);
    await user.click(screen.getByRole('button', { name: /2\. Name & appearance/ }));
    await user.type(screen.getByLabelText('Challenge title'), 'T');
    await user.click(checkButton());
    expect(await screen.findByText(/passed the server check/)).toBeTruthy();
    expect(h.create).toHaveBeenCalledTimes(1);
    expect(h.validate).toHaveBeenCalledTimes(1);
    expect(h.validate).toHaveBeenCalledWith(TEMPLATE_ID, 1);
  });
});

describe('Publish', () => {
  it('requires a fresh passing server check, confirms the named version, then sends that check token', async () => {
    mount();
    await screen.findByRole('navigation', { name: 'Editor steps' });
    const publish = screen.getByRole('button', { name: 'Publish' }) as HTMLButtonElement;
    expect(publish.disabled).toBe(true);
    await userEvent.click(checkButton());
    expect(await screen.findByText(/passed the server check/)).toBeTruthy();
    expect(publish.disabled).toBe(false);
    await userEvent.click(publish);
    expect(screen.getByRole('dialog', { name: 'Publish Template?' })).toBeTruthy();
    expect(screen.getByText(/Hundred Rep Race.*version 1.*immutable/)).toBeTruthy();
    expect(h.publish).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Confirm publish' }));
    expect(h.publish).toHaveBeenCalledWith(TEMPLATE_ID, 1, TOKEN_A);
    expect(await screen.findByRole('heading', { name: 'Published Template' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Preview published Template' })).toBeTruthy();
  });

  it('disables publishing when the checked draft has unsaved edits', async () => {
    mount();
    await screen.findByRole('navigation', { name: 'Editor steps' });
    await userEvent.click(checkButton());
    await screen.findByText(/passed the server check/);
    await editSummary('changed after check');
    expect((screen.getByRole('button', { name: 'Publish' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/last check no longer matches this draft/)).toBeTruthy();
    expect(h.publish).not.toHaveBeenCalled();
  });

  it('switches read-only when the server reports that author access was revoked', async () => {
    h.publish.mockRejectedValue(new ApiError(403, 'template_author_required', 'revoked'));
    mount();
    await screen.findByRole('navigation', { name: 'Editor steps' });
    await userEvent.click(checkButton());
    await screen.findByText(/passed the server check/);
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm publish' }));
    expect(await screen.findByText(/Template authoring access was removed/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Publish' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('rereads after an unknown transport outcome before leaving another publish attempt available', async () => {
    h.publish.mockRejectedValue(new ApiError(503, 'api_unreachable', 'unknown'));
    mount();
    await screen.findByRole('navigation', { name: 'Editor steps' });
    await userEvent.click(checkButton());
    await screen.findByText(/passed the server check/);
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm publish' }));
    expect(await screen.findByText(/publish result could not be confirmed.*reread/i)).toBeTruthy();
    expect(h.detail).toHaveBeenCalledTimes(3);
    expect((screen.getByRole('button', { name: 'Publish' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('maps the publish 422 invalid_template issues into the existing server validation panel', async () => {
    h.publish.mockRejectedValue(new ApiError(422, 'invalid_template', 'Template does not validate for publication', {
      issues: [{ code: 'ACTIVITY_NOT_ELIGIBLE', field: 'activities[].activity', activityIndex: 0, stage: 'ACTIVITIES', message: 'Activity is no longer published' }],
    }));
    mount();
    await screen.findByRole('navigation', { name: 'Editor steps' });
    await userEvent.click(checkButton());
    await screen.findByText(/passed the server check/);
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm publish' }));
    const panel = await screen.findByRole('alert', { name: 'Check results' });
    expect(within(panel).getByText('Activities')).toBeTruthy();
    expect(within(panel).getByText('Push-ups: Activity is no longer published')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Published Template' })).toBeNull();
    expect((screen.getByRole('button', { name: 'Publish' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('routes a publish revision-token conflict into the existing reconciliation flow', async () => {
    h.publish.mockRejectedValue(new ApiError(409, 'template_draft_changed', 'changed', {
      current: { revisionToken: TOKEN_B, content: contentOf({ summary: 'Changed on server' }), lastEditedByMemberId: 'member-other', lastEditedAt: '2026-10-30T09:00:00Z' },
    }));
    mount();
    await screen.findByRole('navigation', { name: 'Editor steps' });
    await userEvent.click(checkButton());
    await screen.findByText(/passed the server check/);
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm publish' }));
    expect(await screen.findByRole('alert', { name: /changed while you were editing/i })).toBeTruthy();
    expect(screen.getByText(/Changed on server/)).toBeTruthy();
  });

  it.each([
    ['immutable version', new ApiError(409, 'template_immutable', 'already published')],
    ['retired Template', new ApiError(409, 'template_retired', 'retired')],
    ['missing Template', new ApiError(404, 'template_not_found', 'gone')],
  ])('surfaces the %s publish outcome without claiming success', async (_label, error) => {
    h.publish.mockRejectedValue(error);
    mount();
    await screen.findByRole('navigation', { name: 'Editor steps' });
    await userEvent.click(checkButton());
    await screen.findByText(/passed the server check/);
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm publish' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Published Template' })).toBeNull();
  });
});

describe('validation issues and step mapping', () => {
  async function checkedWithIssues() {
    h.validate.mockResolvedValue({ ok: false, issues: ISSUES });
    mount();
    await screen.findByRole('navigation', { name: 'Editor steps' });
    await userEvent.click(checkButton());
    return screen.findByRole('alert', { name: 'Check results' });
  }

  it('lists the server issues, grouped by the editor step that fixes them', async () => {
    const panel = await checkedWithIssues();
    expect(within(panel).getByText(/found 4 issues/)).toBeTruthy();
    for (const label of ['Name & appearance', 'Template details', 'Activities', 'What counts']) expect(within(panel).getByText(label)).toBeTruthy();
    expect(within(panel).getByText(/title is required/)).toBeTruthy();
  });

  it('shows each issue on its own step with a count, naming the Activity it concerns', async () => {
    await checkedWithIssues();
    const nav = screen.getByRole('navigation', { name: 'Editor steps' });
    for (const label of [/2\. Name & appearance/, /3\. Activities/, /4\. What counts/, /5\. Template details/]) {
      expect(within(within(nav).getByRole('button', { name: label })).getByText('(1 server check issue)')).toBeTruthy();
    }
    expect(within(nav).getAllByText('(1 server check issue)')).toHaveLength(4);
    await step(/Activities/);
    const activitiesIssues = screen.getByLabelText('Server check issues for this step');
    expect(within(activitiesIssues).getByText('Push-ups: Activity is not published')).toBeTruthy();
    expect(within(activitiesIssues).queryByText(/title is required/)).toBeNull();
    await step(/What counts/);
    expect(within(screen.getByLabelText('Server check issues for this step')).getByText(/unit not compatible/)).toBeTruthy();
    await step(/Template details/);
    expect(within(screen.getByLabelText('Server check issues for this step')).getByText(/summary is required/)).toBeTruthy();
  });

  it('"Go to step" opens the step that holds the issue', async () => {
    const panel = await checkedWithIssues();
    await userEvent.click(within(panel).getAllByRole('button', { name: 'Go to step' })[0]);
    expect(screen.getByRole('button', { name: /Name & appearance/ }).getAttribute('aria-current')).toBe('step');
  });

  it('shows an unmapped issue under "Other checks" rather than dropping it', async () => {
    h.validate.mockResolvedValue({ ok: false, issues: [{ code: 'PF03_SEMANTIC', message: 'semantic problem' }] });
    mount();
    await screen.findByRole('navigation', { name: 'Editor steps' });
    await userEvent.click(checkButton());
    const panel = await screen.findByRole('alert', { name: 'Check results' });
    expect(within(panel).getByText('Other checks')).toBeTruthy();
    expect(within(panel).getByText('semantic problem')).toBeTruthy();
  });
});

describe('stale results', () => {
  async function checkedOk() {
    mount();
    await screen.findByRole('navigation', { name: 'Editor steps' });
    await userEvent.click(checkButton());
    await screen.findByText(/passed the server check/);
  }

  it('a local edit invalidates the result and withholds the verdict', async () => {
    await checkedOk();
    await step(/Template details/);
    await userEvent.type(screen.getByLabelText('Template summary'), '!');
    expect(await screen.findByText(/no longer matches this draft/)).toBeTruthy();
    expect(screen.queryByText(/passed the server check/)).toBeNull();
  });

  it('a stale issue list is withdrawn from the steps too', async () => {
    h.validate.mockResolvedValue({ ok: false, issues: ISSUES });
    mount();
    await screen.findByRole('navigation', { name: 'Editor steps' });
    await userEvent.click(checkButton());
    await screen.findByRole('alert', { name: 'Check results' });
    await step(/Template details/);
    await userEvent.type(screen.getByLabelText('Template summary'), '!');
    expect(await screen.findByText(/no longer matches this draft/)).toBeTruthy();
    expect(screen.queryByLabelText('Server check issues for this step')).toBeNull();
    expect(screen.queryByText('(1 server check issue)')).toBeNull();
  });

  it('a plain save moves the server token, so the earlier result no longer applies', async () => {
    await checkedOk();
    await step(/Template details/);
    await userEvent.type(screen.getByLabelText('Template summary'), '!');
    h.save.mockResolvedValue({ templateId: TEMPLATE_ID, version: 1, revisionToken: TOKEN_C });
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await screen.findByText('Draft saved.');
    expect(screen.getByText(/no longer matches this draft/)).toBeTruthy();
    expect(screen.queryByText(/passed the server check/)).toBeNull();
  });

  it('a concurrent change that surfaces as a save conflict also invalidates it', async () => {
    await checkedOk();
    await step(/Template details/);
    await userEvent.type(screen.getByLabelText('Template summary'), '!');
    h.save.mockRejectedValue(new ApiError(409, 'template_draft_changed', 'changed', {
      current: { revisionToken: TOKEN_C, content: contentOf({ summary: 'Theirs' }), lastEditedByMemberId: 'other', lastEditedAt: '2026-10-30T09:00:00Z' },
    }));
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText(/no longer matches this draft/)).toBeTruthy();
    expect(screen.queryByText(/passed the server check/)).toBeNull();
  });

  it('if the stored draft moved on while it was being checked, the result is not presented and the conflict is reconciled', async () => {
    h.detail.mockResolvedValueOnce(serverDraft()).mockResolvedValue(serverDraft(TOKEN_C, contentOf({ summary: 'Changed by someone else' })));
    mount();
    await screen.findByRole('navigation', { name: 'Editor steps' });
    await userEvent.click(checkButton());
    expect(await screen.findByText(/changed by someone else while it was being checked/)).toBeTruthy();
    expect(screen.queryByText(/passed the server check/)).toBeNull();
    expect(screen.queryByRole('alert', { name: 'Check results' })).toBeNull();
    await waitFor(() => expect(screen.getByRole('button', { name: /Apply/ })).toBeTruthy());
  });
});

describe('review findings', () => {
  it('a version published by someone else during the check is not presented as a pass; editing is switched off', async () => {
    h.detail.mockResolvedValueOnce(serverDraft()).mockResolvedValue(detailOf([versionOf(null, contentOf())]));
    mount();
    await screen.findByRole('navigation', { name: 'Editor steps' });
    await userEvent.click(checkButton());
    expect(await screen.findByText(/stopped being an open draft/)).toBeTruthy();
    expect(screen.queryByText(/passed the server check/)).toBeNull();
    expect((screen.getByRole('button', { name: 'Save draft' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('Save draft is disabled while a check is running', async () => {
    let release: (value: { ok: boolean; issues: [] }) => void = () => undefined;
    h.validate.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    h.detail.mockResolvedValueOnce(serverDraft()).mockResolvedValue(serverDraft(TOKEN_B, contentOf({ summary: 'Pending' })));
    mount();
    const user = await editSummary('Pending');
    await user.click(checkButton());
    await waitFor(() => expect((screen.getByRole('button', { name: 'Save draft' }) as HTMLButtonElement).disabled).toBe(true));
    release({ ok: true, issues: [] });
    await screen.findByText(/passed the server check/);
  });

  it('places a missing metric and unit on What counts without a duplicate stage line', async () => {
    h.validate.mockResolvedValue({ ok: false, issues: [
      { code: 'MISSING_FIELD', field: 'activities[].metric+unit', stage: 'MEASUREMENT', message: 'composer: stage MEASUREMENT is missing activities[].metric+unit' },
      { code: 'STAGE_INCOMPLETE', stage: 'MEASUREMENT', message: 'composer: stage MEASUREMENT is incomplete' },
    ] });
    mount();
    await screen.findByRole('navigation', { name: 'Editor steps' });
    await userEvent.click(checkButton());
    const panel = await screen.findByRole('alert', { name: 'Check results' });
    expect(within(panel).getByText(/found 1 issue/)).toBeTruthy();
    expect(within(panel).queryByText('Other checks')).toBeNull();
    expect(within(screen.getByRole('button', { name: /4\. What counts/ })).getByText('(1 server check issue)')).toBeTruthy();
  });
});

describe('conflict hydration and Template switching (final review)', () => {
  it('edits made while the conflicting draft is still hydrating are kept, not replaced by an older snapshot', async () => {
    let slow = false;
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    h.options.mockImplementation(async (id: string) => { if (slow) await gate; return optionsFor(id, 3); });
    h.detail.mockResolvedValueOnce(serverDraft()).mockResolvedValue(serverDraft(TOKEN_C, contentOf({ summary: 'Changed by someone else' })));
    mount();
    const user = userEvent.setup();
    await screen.findByRole('navigation', { name: 'Editor steps' });
    await step(/Template details/);
    slow = true;
    await user.click(checkButton());
    // The check finished and the conflict is hydrating (Activity lookups are held). The author keeps typing.
    await waitFor(() => expect(h.detail).toHaveBeenCalledTimes(2));
    const summary = screen.getByLabelText('Template summary') as HTMLTextAreaElement;
    await user.clear(summary);
    await user.type(summary, 'Typed during hydration');
    release();
    expect(await screen.findByText(/changed by someone else while it was being checked/)).toBeTruthy();
    expect((screen.getByLabelText('Template summary') as HTMLTextAreaElement).value).toBe('Typed during hydration');
    expect(readRecovery('author-1', { templateId: TEMPLATE_ID, version: 1 })?.body.summary).toBe('Typed during hydration');
  });

  it('switching to another Template while a check is running never shows or applies the old Template\'s result', async () => {
    const OTHER = '22222222-2222-4222-8222-222222222222';
    let release: (value: { ok: boolean; issues: [] }) => void = () => undefined;
    h.validate.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    h.detail.mockImplementation(async (id: string) => (id === OTHER
      ? { ...serverDraft(TOKEN_C, contentOf({ summary: 'Other draft' })), templateId: OTHER }
      : serverDraft()));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    function Jump() { const go = useNavigate(); return <button type="button" onClick={() => go(`/v2/operator/templates/${OTHER}/edit`)}>jump</button>; }
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[EDIT]}>
          <Jump />
          <Routes><Route path="/v2/operator/templates/:templateId/edit" element={<TemplateDraftEditor />} /></Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await screen.findByRole('navigation', { name: 'Editor steps' });
    await userEvent.click(checkButton());
    await screen.findByText('Checking…');
    await userEvent.click(screen.getByRole('button', { name: 'jump' }));
    await waitFor(() => expect(h.detail).toHaveBeenCalledWith(OTHER));
    release({ ok: true, issues: [] });
    await step(/Template details/);
    expect((screen.getByLabelText('Template summary') as HTMLTextAreaElement).value).toBe('Other draft');
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(screen.queryByText(/passed the server check/)).toBeNull();
    expect(screen.queryByText(/changed by someone else while it was being checked/)).toBeNull();
    expect(screen.queryByText('Checking…')).toBeNull();
  });

  it('an Activity whose add finishes after a conflict opened is refused with a message, not silently dropped', async () => {
    let slowFor: string | null = null;
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    h.options.mockImplementation(async (id: string) => { if (id === slowFor) await gate; return optionsFor(id, 3); });
    h.detail.mockResolvedValueOnce(serverDraft()).mockResolvedValue(serverDraft(TOKEN_C, contentOf({ summary: 'Changed by someone else' })));
    mount();
    const user = userEvent.setup();
    await screen.findByRole('navigation', { name: 'Editor steps' });
    await step(/3\. Activities/);
    slowFor = 'act-2';
    await user.click(await screen.findByRole('button', { name: 'Add Plank' }));
    await user.click(checkButton());
    expect(await screen.findByText(/changed by someone else while it was being checked/)).toBeTruthy();
    release();
    expect(await screen.findByText(/changed while that Activity was loading/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Plank is already added' })).toBeNull();
  });

  it('moving in place to another draft carries no conflict or read-only state over', async () => {
    const OTHER = '22222222-2222-4222-8222-222222222222';
    h.detail.mockImplementation(async (id: string) => (id === OTHER ? { ...serverDraft(TOKEN_C, contentOf({ summary: 'Other draft' })), templateId: OTHER } : serverDraft()));
    h.save.mockRejectedValue(new ApiError(409, 'template_draft_changed', 'changed', {
      current: { revisionToken: TOKEN_C, content: contentOf({ summary: 'Theirs' }), lastEditedByMemberId: 'other', lastEditedAt: '2026-10-30T09:00:00Z' },
    }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    function Jump() { const go = useNavigate(); return <button type="button" onClick={() => go(`/v2/operator/templates/${OTHER}/edit`)}>jump</button>; }
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[EDIT]}>
          <Jump />
          <Routes><Route path="/v2/operator/templates/:templateId/edit" element={<TemplateDraftEditor />} /></Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const user = await editSummary('Mine');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await screen.findByRole('button', { name: /Apply/ });
    await user.click(screen.getByRole('button', { name: 'jump' }));
    await waitFor(() => expect(h.detail).toHaveBeenCalledWith(OTHER));
    await step(/Template details/);
    expect((screen.getByLabelText('Template summary') as HTMLTextAreaElement).value).toBe('Other draft');
    expect(screen.queryByRole('button', { name: /Apply/ })).toBeNull();
    expect((screen.getByLabelText('Template summary').closest('fieldset') as HTMLFieldSetElement).disabled).toBe(false);
  });
});

describe('authorization and failures', () => {
  it('a 403 from validation switches editing off, keeps the work, and shows no verdict', async () => {
    h.validate.mockRejectedValue(new ApiError(403, 'template_author_required', 'no'));
    h.capabilities.mockResolvedValueOnce({ canAuthor: true, canRead: true }).mockResolvedValue({ canAuthor: false, canRead: true });
    mount();
    const user = await editSummary('Kept');
    await user.click(checkButton());
    expect(await screen.findByText(/authoring access was removed/)).toBeTruthy();
    expect(screen.getByText(/do not have Template authoring access/)).toBeTruthy();
    expect((screen.getByLabelText('Template summary') as HTMLTextAreaElement).value).toBe('Kept');
    expect(screen.queryByText(/passed the server check/)).toBeNull();
  });

  it('an unreachable API is reported as not checked, with the draft saved', async () => {
    h.validate.mockRejectedValue(new ApiError(503, 'api_unreachable', 'down'));
    mount();
    await screen.findByRole('navigation', { name: 'Editor steps' });
    await userEvent.click(checkButton());
    const alert = await screen.findByText(/Tiizi is unreachable/);
    expect(alert.closest('[data-validation-failure]')?.getAttribute('data-validation-failure')).toBe('unavailable');
    expect(screen.queryByText(/passed the server check/)).toBeNull();
  });

  it('a server error is a distinct failure, never a pass or an issue list', async () => {
    h.validate.mockRejectedValue(new ApiError(500, 'internal_error', 'boom'));
    mount();
    await screen.findByRole('navigation', { name: 'Editor steps' });
    await userEvent.click(checkButton());
    const alert = await screen.findByText(/could not be completed/);
    expect(alert.closest('[data-validation-failure]')?.getAttribute('data-validation-failure')).toBe('failed');
    expect(screen.queryByRole('alert', { name: 'Check results' })).toBeNull();
  });

  it('a Console reader who is not an author gets no check control and no validation call', async () => {
    h.capabilities.mockResolvedValue({ canAuthor: false, canRead: true });
    mount();
    expect(await screen.findByText(/Template authoring access required/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Save and check/ })).toBeNull();
    expect(h.validate).not.toHaveBeenCalled();
    expect(h.save).not.toHaveBeenCalled();
  });

  it('the check control is unavailable while there are client-side content errors (early feedback only)', async () => {
    mount();
    const user = await editSummary('x'.repeat(300));
    expect(checkButton().disabled).toBe(true);
    expect(screen.getByLabelText('Fix before saving')).toBeTruthy();
    await user.clear(screen.getByLabelText('Template summary'));
    await user.type(screen.getByLabelText('Template summary'), 'ok');
    expect(checkButton().disabled).toBe(false);
  });
});
