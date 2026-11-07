import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './apiError';
import { createTemplateDraft, fetchTemplateCapabilities, fetchTemplateMemberReadiness, publishTemplateVersion, retireTemplate, reviseTemplate, saveTemplateDraft, validateTemplateDraft, type TemplateDraftBody } from './operatorTemplatesApi';


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

  it('validates a saved version with a bare POST to the validate endpoint and returns the server issues unchanged', async () => {
    const issues = [{ code: 'MISSING_FIELD', field: 'title', message: 'title is required to publish' }];
    fetchMock.mockResolvedValue(reply(200, { ok: false, issues }));
    await expect(validateTemplateDraft('t/1', 3)).resolves.toEqual({ ok: false, issues });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/api/operator/templates/t%2F1/versions/3/validate');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer id-token-123');
    expect(init.headers['If-Match']).toBeUndefined();
  });

  it('surfaces a 403 from validation as a typed ApiError', async () => {
    fetchMock.mockResolvedValue(reply(403, { error: { code: 'template_author_required', message: 'no' } }));
    await expect(validateTemplateDraft('t', 1)).rejects.toMatchObject({ status: 403, code: 'template_author_required' });
  });

  it('publishes the validated revision with the quoted If-Match token', async () => {
    fetchMock.mockResolvedValue(reply(200, { templateId: 't/1', version: 2 }));
    await expect(publishTemplateVersion('t/1', 2, TOKEN)).resolves.toEqual({ templateId: 't/1', version: 2 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/api/operator/templates/t%2F1/versions/2/publish');
    expect(init.method).toBe('POST');
    expect(init.headers['If-Match']).toBe(`"${TOKEN}"`);
  });

  it('revises through the existing revisions endpoint', async () => {
    fetchMock.mockResolvedValue(reply(201, { templateId: 't/1', version: 3 }));
    await expect(reviseTemplate('t/1')).resolves.toEqual({ templateId: 't/1', version: 3 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/api/operator/templates/t%2F1/revisions');
    expect(init.method).toBe('POST');
  });

  it('retires without sending an empty reason, and trims a supplied reason', async () => {
    fetchMock.mockResolvedValue(reply(200, { templateId: 't', lifecycle: 'retired' }));
    await retireTemplate('t', '  ');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({});
    fetchMock.mockResolvedValue(reply(200, { templateId: 't', lifecycle: 'retired' }));
    await retireTemplate('t', '  reviewed  ');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ reason: 'reviewed' });
  });

  it('uses the existing authenticated member read for readiness', async () => {
    fetchMock.mockResolvedValue(reply(200, { templateId: 't/1', version: 2, adoptable: false, unavailableReason: 'STALE_ACTIVITY' }));
    await expect(fetchTemplateMemberReadiness('t/1')).resolves.toMatchObject({ adoptable: false, unavailableReason: 'STALE_ACTIVITY' });
    expect(fetchMock.mock.calls[0][0]).toBe('http://api.test/api/challenge-templates/t%2F1');
    expect(fetchMock.mock.calls[0][1].method).toBe('GET');
  });
});
