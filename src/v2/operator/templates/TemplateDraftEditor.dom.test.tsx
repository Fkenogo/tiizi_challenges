import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../api/apiError';
import { TemplateDraftEditor } from './TemplateDraftEditor';
import { readRecovery, writeRecovery } from './templateDraftRecovery';
import { bodyFromContent } from './templateAuthoringModel';
import { CATALOGUE, TEMPLATE_ID, TOKEN_A, TOKEN_B, TOKEN_C, activityConfig, contentOf, detailOf, knowledge, optionsFor, versionOf } from './testing/fixtures';

const h = vi.hoisted(() => ({
  user: { uid: 'author-1' } as { uid: string } | null,
  capabilities: vi.fn(), detail: vi.fn(), create: vi.fn(), save: vi.fn(), options: vi.fn(), catalogue: vi.fn(), item: vi.fn(),
  versions: {} as Record<string, number>,
}));

vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ user: h.user }) }));
vi.mock('../../../api/operatorTemplatesApi', async (original) => ({
  ...(await original<typeof import('../../../api/operatorTemplatesApi')>()),
  fetchTemplateCapabilities: h.capabilities, fetchOperatorTemplate: h.detail, createTemplateDraft: h.create, saveTemplateDraft: h.save,
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
          <Route path="*" element={<div>elsewhere</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const serverDraft = (token = TOKEN_A, content = contentOf(), over = {}) => detailOf([versionOf(token, content, over)]);
const save = () => screen.getByRole('button', { name: /^(Save|Create) draft$/ });
const step = async (name: RegExp) => userEvent.click(await screen.findByRole('button', { name }));
const bodyOf = (call: unknown[]) => call.find((arg) => typeof arg === 'object' && arg !== null && 'composer' in (arg as object)) as ReturnType<typeof bodyFromContent>;

beforeEach(() => {
  sessionStorage.clear();
  vi.stubEnv('VITE_TIIZI_API_BASE_URL', 'http://api.test');
  h.user = { uid: 'author-1' };
  h.versions = {};
  h.capabilities.mockResolvedValue({ canAuthor: true, canRead: true });
  h.detail.mockResolvedValue(serverDraft());
  h.options.mockImplementation(async (id: string) => optionsFor(id, h.versions[id] ?? 3));
  h.item.mockImplementation(async (id: string) => knowledge(id, id === 'act-1' ? 'Push-ups' : id === 'act-2' ? 'Plank' : id));
  h.catalogue.mockResolvedValue(CATALOGUE);
  h.create.mockResolvedValue({ templateId: TEMPLATE_ID, version: 1 });
  h.save.mockResolvedValue({ templateId: TEMPLATE_ID, version: 1, revisionToken: TOKEN_B });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('authorization', () => {
  it('shows a reader (not an author) a read-only explanation and never loads or edits a draft', async () => {
    h.capabilities.mockResolvedValue({ canAuthor: false, canRead: true });
    mount();
    expect(await screen.findByText(/Template authoring access required/)).toBeTruthy();
    expect(screen.getByText(/you are not a Template author/)).toBeTruthy();
    expect(h.detail).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /Save draft/ })).toBeNull();
  });

  it('treats a user with neither capability as denied', async () => {
    h.capabilities.mockResolvedValue({ canAuthor: false, canRead: false });
    mount('/v2/operator/templates/new');
    expect(await screen.findByText(/do not have access to author Templates/)).toBeTruthy();
  });

  it('a 403 on save switches editing off immediately and keeps the work', async () => {
    h.save.mockRejectedValue(new ApiError(403, 'template_author_required', 'no'));
    // The server also stops reporting the capability, as it does for a real revocation.
    h.capabilities.mockResolvedValueOnce({ canAuthor: true, canRead: true }).mockResolvedValue({ canAuthor: false, canRead: true });
    mount();
    const user = userEvent.setup();
    await screen.findByRole('navigation', { name: 'Editor steps' });
    await step(/Template details/);
    await user.clear(screen.getByLabelText('Template summary'));
    await user.type(screen.getByLabelText('Template summary'), 'Kept summary');
    await user.click(save());
    expect(await screen.findByText(/authoring access was removed/)).toBeTruthy();
    expect(screen.getByLabelText('Template summary').closest('fieldset')?.disabled).toBe(true);
    expect((screen.getByLabelText('Template summary') as HTMLTextAreaElement).value).toBe('Kept summary');
    expect((save() as HTMLButtonElement).disabled).toBe(true);
    expect(readRecovery('author-1', { templateId: TEMPLATE_ID, version: 1 })?.body.summary).toBe('Kept summary');
  });
});

describe('creating a draft', () => {
  it('walks the steps, picks an Activity in place, creates, reads the token back, then moves to the edit route', async () => {
    const user = userEvent.setup();
    // The server stores what it was sent, so the read-back after create echoes the created body.
    h.create.mockImplementation(async (body: ReturnType<typeof bodyFromContent>) => {
      h.detail.mockResolvedValue(serverDraft(TOKEN_A, body as unknown as ReturnType<typeof contentOf>));
      return { templateId: TEMPLATE_ID, version: 1 };
    });
    mount('/v2/operator/templates/new');
    await screen.findByRole('navigation', { name: 'Editor steps' });
    expect((save() as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getAllByRole('button', { name: /Race/ })[0]);
    await user.click(screen.getByRole('button', { name: /2\. Name & appearance/ }));
    await user.type(screen.getByLabelText('Challenge title'), 'Hundred Rep Race');
    await user.click(screen.getByRole('button', { name: /3\. Activities/ }));
    await user.click(await screen.findByRole('button', { name: 'Add Push-ups' }));
    expect(await screen.findByRole('button', { name: 'Push-ups is already added' })).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Selected activities' })).getByText('Push-ups')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /5\. Template details/ }));
    await user.type(screen.getByLabelText('Template summary'), 'S');
    await user.type(screen.getByLabelText('Duration in days'), '14');
    await user.click(save());

    await waitFor(() => expect(h.create).toHaveBeenCalledTimes(1));
    const sent = bodyOf(h.create.mock.calls[0]);
    expect(sent).toMatchObject({ summary: 'S', durationDays: 14, composer: { mode: 'TEMPLATE_AUTHORING', challengeType: 'competitive', title: 'Hundred Rep Race' } });
    expect(sent.composer.activities).toHaveLength(1);
    expect(sent.composer.activities[0]).toMatchObject({ activity: 'act-1', observedVersion: 3, kind: 'fitness' });
    expect(JSON.stringify(sent)).not.toMatch(/startDate|endDate|timezone|goalValue|requiredConsecutiveDays/);
    await waitFor(() => expect(h.detail).toHaveBeenCalledWith(TEMPLATE_ID));
    expect(await screen.findByText(/Draft created/)).toBeTruthy();
    expect(readRecovery('author-1', 'new')).toBeNull();
  });

  it('removes a chosen Activity and configures the target', async () => {
    const user = userEvent.setup();
    mount('/v2/operator/templates/new');
    await screen.findByRole('navigation', { name: 'Editor steps' });
    await user.click(screen.getAllByRole('button', { name: /Race/ })[0]);
    await user.click(screen.getByRole('button', { name: /3\. Activities/ }));
    await user.click(await screen.findByRole('button', { name: 'Add Push-ups' }));
    await user.click(await screen.findByRole('button', { name: 'Add Plank' }));
    // Race is single-activity: the second pick replaces the first.
    expect(within(screen.getByRole('region', { name: 'Selected activities' })).queryByText('Push-ups')).toBeNull();
    await user.click(screen.getByRole('button', { name: /4\. What counts/ }));
    const target = screen.getByLabelText(/Target to reach/) as HTMLInputElement;
    await user.clear(target); await user.type(target, '250');
    await user.click(screen.getByRole('button', { name: /3\. Activities/ }));
    await user.click(within(screen.getByRole('region', { name: 'Selected activities' })).getByRole('button', { name: 'Remove' }));
    expect(screen.queryByRole('region', { name: 'Selected activities' })).toBeNull();
    await user.click(screen.getByRole('button', { name: /4\. What counts/ }));
    expect(screen.getByText(/No activities chosen yet/)).toBeTruthy();
  });

  it('keeps entered work when step navigation moves back and forth', async () => {
    const user = userEvent.setup();
    mount('/v2/operator/templates/new');
    await screen.findByRole('navigation', { name: 'Editor steps' });
    await user.click(screen.getByRole('button', { name: /2\. Name & appearance/ }));
    await user.type(screen.getByLabelText('Challenge title'), 'Keep me');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect((screen.getByLabelText('Challenge title') as HTMLInputElement).value).toBe('Keep me');
    expect(screen.getByRole('button', { name: /2\. Name & appearance/ }).getAttribute('aria-current')).toBe('step');
  });
});

describe('editing and saving', () => {
  it('loads the draft, saves with the quoted token source, and chains the returned token', async () => {
    const user = userEvent.setup();
    mount();
    await step(/Template details/);
    expect((await screen.findByLabelText('Template summary') as HTMLTextAreaElement).value).toBe('A short race.');
    expect((save() as HTMLButtonElement).disabled).toBe(true);
    await user.type(screen.getByLabelText('Template summary'), ' More.');
    await user.click(save());
    await waitFor(() => expect(h.save).toHaveBeenCalledTimes(1));
    const [id, version, body, token] = h.save.mock.calls[0];
    expect([id, version, token]).toEqual([TEMPLATE_ID, 1, TOKEN_A]);
    expect(body.summary).toBe('A short race. More.');
    expect(body.sortOrder).toBe(7);
    expect(await screen.findByText('Draft saved.')).toBeTruthy();
    await user.type(screen.getByLabelText('Template summary'), '!');
    await user.click(save());
    await waitFor(() => expect(h.save).toHaveBeenCalledTimes(2));
    expect(h.save.mock.calls[1][3]).toBe(TOKEN_B);
  });

  it('shows the server message for a 400 and keeps the edit', async () => {
    h.save.mockRejectedValue(new ApiError(400, 'invalid_template_request', 'composer activities[0] is not a known Activity'));
    const user = userEvent.setup();
    mount();
    await step(/Template details/);
    await user.type(await screen.findByLabelText('Template summary'), ' x');
    await user.click(save());
    const alert = await screen.findByText(/did not accept/);
    expect(alert.closest('[data-failure]')?.getAttribute('data-failure')).toBe('invalid');
    expect(screen.getByText(/not a known Activity/)).toBeTruthy();
    expect((screen.getByLabelText('Template summary') as HTMLTextAreaElement).value).toBe('A short race. x');
  });

  it.each([
    [401, 'signin', /Sign in again/],
    [428, 'precondition', /lost track of the draft version/],
    [503, 'unavailable', /unreachable/],
  ])('keeps %i distinct', async (status, kind, text) => {
    h.save.mockRejectedValue(new ApiError(status as number, status === 503 ? 'api_unreachable' : 'x', 'x'));
    const user = userEvent.setup();
    mount();
    await step(/Template details/);
    await user.type(await screen.findByLabelText('Template summary'), ' x');
    await user.click(save());
    const box = await screen.findByText(text as RegExp);
    expect(box.closest('[data-failure]')?.getAttribute('data-failure')).toBe(kind);
  });

  it('blocks saving a draft that breaks a hard limit and says why', async () => {
    const user = userEvent.setup();
    mount();
    await step(/Template details/);
    const summary = await screen.findByLabelText('Template summary');
    await user.clear(summary);
    await user.click(summary);
    await user.paste('x'.repeat(281));
    expect((save() as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByText(/at most 280 characters/).length).toBeGreaterThan(0);
    expect(h.save).not.toHaveBeenCalled();
  });

  it('refuses to edit when the Template has no open draft', async () => {
    h.detail.mockResolvedValue(detailOf([versionOf(null)]));
    mount();
    expect(await screen.findByText(/no open draft to edit/)).toBeTruthy();
  });
});

describe('conflict reconciliation', () => {
  const theirs = (over = {}, activities = [activityConfig('act-1')]) => contentOf({ summary: 'Theirs', ...over }, activities);
  const conflictError = (content = theirs(), token = TOKEN_B) => new ApiError(409, 'template_draft_changed', 'changed', {
    current: { revisionToken: token, content, lastEditedByMemberId: 'member-other', lastEditedAt: '2026-10-30T09:00:00Z' },
  });

  async function editAndSaveIntoConflict(user: ReturnType<typeof userEvent.setup>, error = conflictError()) {
    h.save.mockRejectedValueOnce(error);
    mount();
    await step(/Template details/);
    const summary = await screen.findByLabelText('Template summary');
    await user.clear(summary); await user.type(summary, 'Mine');
    await user.click(save());
    return screen.findByRole('alert', { name: /changed while you were editing/ });
  }

  it('preserves the author\'s work, shows the latest server draft and last editor, and disables further edits', async () => {
    const user = userEvent.setup();
    const panel = await editAndSaveIntoConflict(user);
    expect(within(panel).getByText(/member member-o/)).toBeTruthy();
    expect(panel.textContent).toContain('Mine');
    expect(within(panel).getByText('Theirs')).toBeTruthy();
    expect((screen.getByLabelText('Template summary') as HTMLTextAreaElement).value).toBe('Mine');
    expect(screen.getByLabelText('Template summary').closest('fieldset')?.disabled).toBe(true);
  });

  it('offers no one-click overwrite: saving and applying stay blocked until every real conflict is decided', async () => {
    const user = userEvent.setup();
    const panel = await editAndSaveIntoConflict(user);
    expect(screen.queryByRole('button', { name: /overwrite|force|keep mine and save/i })).toBeNull();
    expect((save() as HTMLButtonElement).disabled).toBe(true);
    const apply = within(panel).getByRole('button', { name: 'Apply my decisions' }) as HTMLButtonElement;
    expect(apply.disabled).toBe(true);
    expect(within(panel).getByText(/1 difference needs your decision/)).toBeTruthy();
    await user.click(within(panel).getByRole('radio', { name: 'Summary: keep mine' }));
    expect(apply.disabled).toBe(false);
    expect(h.save).toHaveBeenCalledTimes(1);
  });

  it('a reconciled save uses the current server token', async () => {
    const user = userEvent.setup();
    const panel = await editAndSaveIntoConflict(user);
    await user.click(within(panel).getByRole('radio', { name: 'Summary: keep mine' }));
    await user.click(within(panel).getByRole('button', { name: 'Apply my decisions' }));
    expect(await screen.findByText(/Review the combined draft, then save/)).toBeTruthy();
    h.save.mockResolvedValueOnce({ templateId: TEMPLATE_ID, version: 1, revisionToken: TOKEN_C });
    await user.click(save());
    await waitFor(() => expect(h.save).toHaveBeenCalledTimes(2));
    expect(h.save.mock.calls[1][3]).toBe(TOKEN_B);
    expect(h.save.mock.calls[1][2].summary).toBe('Mine');
  });

  it('a second conflict returns to reconciliation without losing the author\'s work', async () => {
    const user = userEvent.setup();
    const panel = await editAndSaveIntoConflict(user);
    await user.click(within(panel).getByRole('radio', { name: 'Summary: keep mine' }));
    await user.click(within(panel).getByRole('button', { name: 'Apply my decisions' }));
    h.save.mockRejectedValueOnce(conflictError(theirs({ summary: 'Third' }), TOKEN_C));
    await user.click(save());
    const again = await screen.findByRole('alert', { name: /changed while you were editing/ });
    expect(within(again).getByText('Third')).toBeTruthy();
    expect((screen.getByLabelText('Template summary') as HTMLTextAreaElement).value).toBe('Mine');
  });

  it('identifies added, removed and modified Activities and takes only explicitly chosen sides', async () => {
    const user = userEvent.setup();
    h.detail.mockResolvedValue(serverDraft(TOKEN_A, contentOf({}, [activityConfig('act-1'), activityConfig('act-2', { position: 1 })]), {}));
    const error = conflictError(contentOf({}, [activityConfig('act-1', { targetValue: 200 }), activityConfig('act-2', { position: 1 })]));
    h.save.mockRejectedValueOnce(error);
    mount();
    await user.click(await screen.findByRole('button', { name: /4\. What counts/ }));
    const target = screen.getAllByLabelText(/Target to reach/)[0] as HTMLInputElement;
    await user.clear(target); await user.type(target, '150');
    await user.click(save());
    const panel = await screen.findByRole('alert', { name: /changed while you were editing/ });
    const row = panel.querySelector('[data-conflict-key="activity:act-1"]') as HTMLElement;
    expect(within(row).getByText('Changed')).toBeTruthy();
    expect(within(row).getByText(/150/)).toBeTruthy();
    expect(within(row).getByText(/200/)).toBeTruthy();
    await user.click(within(row).getByRole('radio', { name: 'Push-ups: keep theirs' }));
    await user.click(within(panel).getByRole('button', { name: 'Apply my decisions' }));
    // Choosing theirs for the only difference leaves nothing of the author's to save: the reconciled
    // draft equals the server's, so Save stays off and the server's value is what the editor shows.
    expect((save() as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getAllByLabelText(/Target to reach/)[0] as HTMLInputElement).value).toBe('200');
    expect(h.save).toHaveBeenCalledTimes(1);
    expect(readRecovery('author-1', { templateId: TEMPLATE_ID, version: 1 })).toBeNull();
  });

  it('discarding needs a confirmation and then shows the saved draft', async () => {
    const user = userEvent.setup();
    const panel = await editAndSaveIntoConflict(user);
    await user.click(within(panel).getByRole('button', { name: /Discard my changes/ }));
    expect(screen.getByRole('group', { name: 'Confirm discard' })).toBeTruthy();
    expect((screen.getByLabelText('Template summary') as HTMLTextAreaElement).value).toBe('Mine');
    await user.click(screen.getByRole('button', { name: 'Keep reconciling' }));
    expect(screen.queryByRole('group', { name: 'Confirm discard' })).toBeNull();
    await user.click(within(panel).getByRole('button', { name: /Discard my changes/ }));
    await user.click(screen.getByRole('button', { name: 'Yes, discard mine' }));
    expect((await screen.findByLabelText('Template summary') as HTMLTextAreaElement).value).toBe('Theirs');
    expect(readRecovery('author-1', { templateId: TEMPLATE_ID, version: 1 })).toBeNull();
  });
});

describe('Activity versions', () => {
  it('shows the mismatch, changes nothing on its own, and refreshes only on request', async () => {
    const user = userEvent.setup();
    h.detail.mockResolvedValue(serverDraft(TOKEN_A, contentOf({}, [activityConfig('act-1', { observedVersion: 2 })])));
    h.versions['act-1'] = 5;
    mount();
    await user.click(await screen.findByRole('button', { name: /3\. Activities/ }));
    const notice = await screen.findByText(/written against Activity Guide version 2; the current version is 5/);
    expect(notice).toBeTruthy();
    const inspect = screen.getByRole('link', { name: 'Inspect current version' });
    expect(inspect.getAttribute('target')).toBe('_blank');
    expect(inspect.getAttribute('href')).toBe('/v2/guide/act-1');
    expect((save() as HTMLButtonElement).disabled).toBe(true); // nothing was upgraded silently
    await user.click(screen.getByRole('button', { name: /Refresh Push-ups to version 5/ }));
    expect(screen.queryByText(/written against Activity Guide version 2/)).toBeNull();
    await user.click(save());
    await waitFor(() => expect(h.save).toHaveBeenCalled());
    expect(h.save.mock.calls[0][2].composer.activities[0]).toMatchObject({ observedVersion: 5, metric: 'repetitions', unit: 'reps', targetValue: 100 });
  });

  it('flags settings the current version cannot keep after a refresh', async () => {
    const user = userEvent.setup();
    h.detail.mockResolvedValue(serverDraft(TOKEN_A, contentOf({}, [activityConfig('act-1', { observedVersion: 2, metric: 'distance', unit: 'metres', targetValue: 5 })])));
    h.versions['act-1'] = 5;
    mount();
    await user.click(await screen.findByRole('button', { name: /3\. Activities/ }));
    await user.click(await screen.findByRole('button', { name: /Refresh Push-ups to version 5/ }));
    expect(await screen.findByText(/Some settings could not be kept/)).toBeTruthy();
    expect(screen.getAllByText(/no longer offered/).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.queryByText(/Some settings could not be kept/)).toBeNull();
  });

  it('keeps an Activity whose governed details cannot be loaded and says so', async () => {
    h.options.mockRejectedValue(new ApiError(404, 'x', 'gone'));
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('button', { name: /3\. Activities/ }));
    expect(await screen.findByText(/governed details could not be loaded/)).toBeTruthy();
  });
});

describe('session recovery', () => {
  const identity = { templateId: TEMPLATE_ID, version: 1 };
  const mine = (summary = 'Recovered') => bodyFromContent(contentOf({ summary }));

  it('restores unsaved work when its base is still the server draft', async () => {
    writeRecovery('author-1', identity, { baseToken: TOKEN_A, baseBody: mine('A short race.'), body: mine() });
    const user = userEvent.setup();
    mount();
    expect(await screen.findByText(/Restored your unsaved work/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Template details/ }));
    expect((screen.getByLabelText('Template summary') as HTMLTextAreaElement).value).toBe('Recovered');
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
  });

  it('opens reconciliation instead of restoring when the draft moved on while the work was away', async () => {
    writeRecovery('author-1', identity, { baseToken: TOKEN_C, baseBody: mine('A short race.'), body: mine() });
    h.detail.mockResolvedValue(serverDraft(TOKEN_A, contentOf({ summary: 'Changed elsewhere' })));
    mount();
    const panel = await screen.findByRole('alert', { name: /changed while you were editing/ });
    expect(within(panel).getByText('Recovered')).toBeTruthy();
    expect(within(panel).getByText('Changed elsewhere')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Apply my decisions' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('a concurrent edit during recovery re-enters reconciliation on the next save, keeping the recovered work', async () => {
    const user = userEvent.setup();
    writeRecovery('author-1', identity, { baseToken: TOKEN_A, baseBody: mine('A short race.'), body: mine() });
    h.save.mockRejectedValueOnce(new ApiError(409, 'template_draft_changed', 'changed', {
      current: { revisionToken: TOKEN_B, content: contentOf({ summary: 'Concurrent' }), lastEditedByMemberId: 'member-other', lastEditedAt: '2026-10-30T09:00:00Z' },
    }));
    mount();
    await screen.findByText(/Restored your unsaved work/);
    await user.click(save());
    const panel = await screen.findByRole('alert', { name: /changed while you were editing/ });
    expect(within(panel).getByText('Recovered')).toBeTruthy();
    expect(within(panel).getByText('Concurrent')).toBeTruthy();
    expect(readRecovery('author-1', identity)?.body.summary).toBe('Recovered');
  });

  it('writes recovery on edit and clears it after a successful save', async () => {
    const user = userEvent.setup();
    mount();
    await step(/Template details/);
    await user.type(await screen.findByLabelText('Template summary'), '!');
    await waitFor(() => expect(readRecovery('author-1', identity)?.baseToken).toBe(TOKEN_A));
    await user.click(save());
    await screen.findByText('Draft saved.');
    await waitFor(() => expect(readRecovery('author-1', identity)).toBeNull());
  });

  it('never restores another account\'s work and removes it', async () => {
    writeRecovery('someone-else', identity, { baseToken: TOKEN_A, baseBody: mine('A short race.'), body: mine('Not yours') });
    mount();
    await screen.findByRole('navigation', { name: 'Editor steps' });
    await step(/Template details/);
    expect((screen.getByLabelText('Template summary') as HTMLTextAreaElement).value).toBe('A short race.');
    expect(sessionStorage.length).toBe(0);
  });

  it('clears the account\'s recovery on sign-out', async () => {
    const view = mount();
    await screen.findByRole('navigation', { name: 'Editor steps' });
    writeRecovery('author-1', identity, { baseToken: TOKEN_A, baseBody: mine(), body: mine('Left behind') });
    h.user = null;
    view.rerender(<div />);
    cleanup();
    h.user = { uid: 'author-1' };
    const second = mount();
    await screen.findByRole('navigation', { name: 'Editor steps' });
    second.unmount();
    h.user = null;
    mount();
    await screen.findByText(/Sign in required/);
  });
});
