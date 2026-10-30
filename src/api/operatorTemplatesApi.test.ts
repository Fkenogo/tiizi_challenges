import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './apiError';
import { createTemplateDraft, fetchTemplateCapabilities, saveTemplateDraft, type TemplateDraftBody } from './operatorTemplatesApi';

vi.mock('../lib/firebaseAuth', () => ({ auth: { currentUser: { getIdToken: async () => 'id-token-123' } } }));

const BODY: TemplateDraftBody = {
  summary: 'S', focusTags: [], sortOrder: 0, coverId: null, durationDays: 14, durationPresetDays: null,
  composer: { draftKind: 'pf04-v1', mode: 'TEMPLATE_AUTHORING', activities: [] },
};
const TOKEN = 'ab'.repeat(32);
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('Template draft client (real transport, stubbed fetch)', () => {
  const fetchMock = vi.fn();
  beforeEach(() => { vi.stubEnv('VITE_TIIZI_API_BASE_URL', 'http://api.test'); vi.stubGlobal('fetch', fetchMock); });
  afterEach(() => { fetchMock.mockReset(); vi.unstubAllGlobals(); });

  it('sends the quoted revision token as If-Match on PUT, with the bearer and JSON body', async () => {
    fetchMock.mockResolvedValue(reply(200, { templateId: 't', version: 2, revisionToken: 'x' }));
    await saveTemplateDraft('t/1', 2, BODY, TOKEN);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/api/operator/templates/t%2F1/versions/2');
    expect(init.method).toBe('PUT');
    expect(init.headers['If-Match']).toBe(`"${TOKEN}"`);
    expect(init.headers.Authorization).toBe('Bearer id-token-123');
    expect(JSON.parse(init.body)).toEqual(BODY);
  });

  it('a caller header can never replace Authorization', async () => {
    fetchMock.mockResolvedValue(reply(200, {}));
    const { apiFetch } = await import('./apiClient');
    await apiFetch('/api/x', { method: 'PUT', body: {}, headers: { Authorization: 'Bearer evil', 'If-Match': '"t"' } });
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer id-token-123');
  });

  it('creates with a real JSON body on the /api namespace', async () => {
    fetchMock.mockResolvedValue(reply(201, { templateId: 't', version: 1 }));
    await expect(createTemplateDraft(BODY)).resolves.toEqual({ templateId: 't', version: 1 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/api/operator/templates');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('reads the caller-scoped capability', async () => {
    fetchMock.mockResolvedValue(reply(200, { canAuthor: true, canRead: true }));
    await expect(fetchTemplateCapabilities()).resolves.toEqual({ canAuthor: true, canRead: true });
    expect(fetchMock.mock.calls[0][0]).toBe('http://api.test/api/operator/templates/capabilities');
  });

  it('surfaces a 409 conflict with its details intact', async () => {
    const details = { current: { revisionToken: TOKEN, content: {}, lastEditedByMemberId: 'm', lastEditedAt: 'now' } };
    fetchMock.mockResolvedValue(reply(409, { error: { code: 'template_draft_changed', message: 'changed', details } }));
    const error = await saveTemplateDraft('t', 1, BODY, TOKEN).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: 'template_draft_changed', details });
  });

  it.each([[428, 'if_match_required'], [403, 'template_author_required'], [400, 'invalid_template_request']])('keeps %i and its code', async (status, code) => {
    fetchMock.mockResolvedValue(reply(status, { error: { code, message: 'm' } }));
    await expect(saveTemplateDraft('t', 1, BODY, TOKEN)).rejects.toMatchObject({ status, code });
  });
});
