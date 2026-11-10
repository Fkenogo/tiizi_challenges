import { afterEach, describe, expect, it, vi } from 'vitest';
const apiClientMock = vi.hoisted(() => ({ apiFetch: vi.fn(async () => ({ templates: [], nextCursor: null })) }));
vi.mock('./apiClient', () => ({ API_PREFIX: '/api', apiFetch: apiClientMock.apiFetch }));
import { fetchMemberTemplate, fetchMemberTemplates } from './challengeTemplatesApi';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('member Template API scope', () => {
  it('does not contact a Template service outside the local Founder Preview', async () => {
    vi.stubEnv('VITE_TIIZI_FOUNDER_PREVIEW', '0');
    apiClientMock.apiFetch.mockClear();

    const page = await fetchMemberTemplates();
    expect(apiClientMock.apiFetch).not.toHaveBeenCalled();
    expect(page).toEqual({ templates: [], nextCursor: null });
    await fetchMemberTemplate('founder-preview-push-up-together').catch(() => undefined);
    expect(apiClientMock.apiFetch).not.toHaveBeenCalled();
  });
});
