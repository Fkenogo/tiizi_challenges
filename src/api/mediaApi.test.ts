import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './apiError';
import {
  saveChallengeCoverImage,
  saveGroupCoverImage,
  saveOwnProfileImage,
} from './mediaApi';

const mockGetIdToken = vi.fn<() => Promise<string>>();

vi.mock('../lib/firebaseAuth', () => ({
  auth: {
    get currentUser() {
      return mockCurrentUser;
    },
  },
}));

let mockCurrentUser: { getIdToken: () => Promise<string> } | null = {
  getIdToken: mockGetIdToken,
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('mediaApi + real shared apiClient transport', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubEnv('VITE_TIIZI_API_BASE_URL', 'http://127.0.0.1:4001');
    mockCurrentUser = { getIdToken: mockGetIdToken };
    mockGetIdToken.mockReset();
    mockGetIdToken.mockResolvedValue('firebase-test-token');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it('sends JSON object intent, raw binary File bytes, and structured JSON bind for profile_image, group_cover, and challenge_cover', async () => {
    const cases = [
      {
        purpose: 'profile_image' as const,
        invoke: (file: File) => saveOwnProfileImage(file),
        expectedIntentScope: undefined,
        expectedBindPath: '/api/me/profile-image',
        expectedBindBody: { intentId: 'intent-1' },
        responseKey: 'profileImage',
      },
      {
        purpose: 'group_cover' as const,
        invoke: (file: File) => saveGroupCoverImage('group-123', file),
        expectedIntentScope: 'group-123',
        expectedBindPath: '/api/groups/group-123/cover-image',
        expectedBindBody: { intentId: 'intent-1' },
        responseKey: 'coverImage',
      },
      {
        purpose: 'challenge_cover' as const,
        invoke: (file: File) =>
          saveChallengeCoverImage('chal-456', file, { initialBind: true, groupId: 'group-123' }),
        expectedIntentScope: 'group-123',
        expectedBindPath: '/api/challenges/chal-456/cover-image',
        expectedBindBody: { intentId: 'intent-1', initialBind: true, groupId: 'group-123' },
        responseKey: 'coverImage',
      },
    ];

    for (const c of cases) {
      const calls: Array<{ url: string; init: RequestInit }> = [];
      globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        calls.push({ url, init: init ?? {} });
        if (url.endsWith('/api/media/intents')) {
          return jsonResponse(201, {
            intentId: 'intent-1',
            status: 'open',
            expiresAt: '2026-11-24T18:00:00Z',
          });
        }
        if (url.endsWith('/api/media/intents/intent-1/content')) {
          return jsonResponse(200, {
            intentId: 'intent-1',
            assetId: 'asset-99',
            status: 'uploaded',
          });
        }
        if (url.endsWith(c.expectedBindPath)) {
          return jsonResponse(200, {
            [c.responseKey]: {
              status: 'ready',
              assetId: 'asset-99',
              url: 'https://r2.example.invalid/signed.webp',
              contentType: 'image/webp',
              width: 16,
              height: 16,
            },
          });
        }
        return jsonResponse(404, { error: { code: 'not_found', message: 'unexpected url' } });
      }) as typeof fetch;

      const bytes = new Uint8Array([137, 80, 78, 71, 1, 2, 3, 4]);
      const file = new File([bytes], 'photo.png', { type: 'image/png' });
      const result = await c.invoke(file);

      expect(result).toMatchObject({ status: 'ready', assetId: 'asset-99' });
      expect(calls).toHaveLength(3);

      // 1. Intent creation sends an object (not double-stringified JSON)
      const intentHeaders = calls[0].init.headers as Record<string, string>;
      expect(intentHeaders.Authorization).toBe('Bearer firebase-test-token');
      expect(intentHeaders['Content-Type']).toBe('application/json');
      const parsedIntent = JSON.parse(String(calls[0].init.body));
      expect(parsedIntent).toMatchObject({
        purpose: c.purpose,
        ...(c.expectedIntentScope ? { targetScopeId: c.expectedIntentScope } : {}),
      });
      expect(typeof parsedIntent.idempotencyKey).toBe('string');

      // 2. Binary content upload sends the actual File/Blob bytes (never "{}")
      const uploadHeaders = calls[1].init.headers as Record<string, string>;
      expect(uploadHeaders.Authorization).toBe('Bearer firebase-test-token');
      expect(uploadHeaders['Content-Type']).toBe('image/png');
      expect(calls[1].init.body).toBeInstanceOf(Blob);
      const sentBytes = new Uint8Array(await (calls[1].init.body as Blob).arrayBuffer());
      expect(Array.from(sentBytes)).toEqual(Array.from(bytes));

      // 3. Binding request sends a structured JSON object (not double-stringified)
      const bindHeaders = calls[2].init.headers as Record<string, string>;
      expect(bindHeaders.Authorization).toBe('Bearer firebase-test-token');
      expect(bindHeaders['Content-Type']).toBe('application/json');
      expect(JSON.parse(String(calls[2].init.body))).toEqual(c.expectedBindBody);
    }
  });

  it('throws ApiError for missing auth, invalid content, expired intents, unauthorized mutations, and unreachable API', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'bad.png', { type: 'image/png' });

    // Missing auth
    mockCurrentUser = null;
    await expect(saveOwnProfileImage(file)).rejects.toMatchObject({
      status: 401,
      code: 'not_signed_in',
    });

    mockCurrentUser = { getIdToken: mockGetIdToken };

    // Invalid content (400)
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/api/media/intents')) {
        return jsonResponse(201, { intentId: 'intent-bad', status: 'open', expiresAt: '2026-11-24T18:00:00Z' });
      }
      return jsonResponse(400, { error: { code: 'invalid_image', message: 'Invalid image payload' } });
    }) as typeof fetch;
    await expect(saveOwnProfileImage(file)).rejects.toMatchObject({
      status: 400,
      code: 'invalid_image',
    });

    // Expired intent (410)
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/api/media/intents')) {
        return jsonResponse(201, { intentId: 'intent-exp', status: 'open', expiresAt: '2026-11-24T18:00:00Z' });
      }
      return jsonResponse(410, { error: { code: 'intent_expired', message: 'Upload intent expired' } });
    }) as typeof fetch;
    await expect(saveGroupCoverImage('g1', file)).rejects.toMatchObject({
      status: 410,
      code: 'intent_expired',
    });

    // Unauthorized mutation (403)
    globalThis.fetch = vi.fn(async () =>
      jsonResponse(403, { error: { code: 'forbidden', message: 'Steward access required' } }),
    ) as typeof fetch;
    await expect(saveGroupCoverImage('g1', file)).rejects.toMatchObject({
      status: 403,
      code: 'forbidden',
    });

    // Network/provider failure (503)
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError('network down');
    }) as typeof fetch;
    await expect(saveChallengeCoverImage('c1', file)).rejects.toBeInstanceOf(ApiError);
  });
});
