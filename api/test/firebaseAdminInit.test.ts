import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('firebase-admin/app', () => ({
  getApps: vi.fn(),
  initializeApp: vi.fn(),
  applicationDefault: vi.fn(),
}));

vi.mock('firebase-admin/auth', () => ({
  getAuth: vi.fn(),
}));

import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import {
  AuthError,
  createFirebaseVerifier,
  ensureFirebaseAdmin,
  FirebaseAdminInitError,
  requireAuth,
} from '../src/auth.js';
import type { Db } from '../src/db.js';

const mockGetApps = vi.mocked(getApps);
const mockInitializeApp = vi.mocked(initializeApp);
const mockApplicationDefault = vi.mocked(applicationDefault);
const mockGetAuth = vi.mocked(getAuth);

function fakeApp(name = '[DEFAULT]'): unknown {
  return { name };
}

function fakeDbWithMember(memberId: string): Db {
  const db: Db = {
    async query() {
      return { rows: [{ member_id: memberId }] };
    },
    async transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
      return fn(db);
    },
    async close() {},
  } as unknown as Db;
  return db;
}

describe('firebase admin initialization seam', () => {
  const envBackup: Record<string, string | undefined> = {};

  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of ['FIREBASE_PROJECT_ID', 'GOOGLE_APPLICATION_CREDENTIALS'] as const) {
      envBackup[key] = process.env[key];
      delete process.env[key];
    }
    mockApplicationDefault.mockReturnValue({ __mockCredential: true } as never);
    mockGetAuth.mockReturnValue({
      verifyIdToken: vi.fn(async () => ({ uid: 'mock-uid' })),
    } as never);
  });

  it('creates the default app once and reuses it idempotently', () => {
    const app = fakeApp();
    mockGetApps.mockReturnValueOnce([] as never).mockReturnValue([app] as never);
    mockInitializeApp.mockReturnValue(app as never);

    const first = ensureFirebaseAdmin();
    const second = ensureFirebaseAdmin();

    expect(mockInitializeApp).toHaveBeenCalledTimes(1);
    expect(first).toBe(app);
    expect(second).toBe(app);
  });

  it('repeated verifier creation does not attempt duplicate default-app creation', async () => {
    const app = fakeApp();
    // First factory call sees no app and creates it; every later getApps() reuses it.
    mockGetApps.mockImplementation(() => (mockInitializeApp.mock.calls.length > 0 ? [app] : []) as never);
    mockInitializeApp.mockReturnValue(app as never);

    const first = createFirebaseVerifier();
    const second = createFirebaseVerifier();
    await first.verify('token-a');
    await second.verify('token-b');

    expect(mockInitializeApp).toHaveBeenCalledTimes(1);
    expect(mockGetApps).toHaveBeenCalled();
  });

  it('honors FIREBASE_PROJECT_ID when explicitly configured', () => {
    process.env.FIREBASE_PROJECT_ID = 'test-project-123';
    const app = fakeApp();
    mockGetApps.mockReturnValue([] as never);
    mockInitializeApp.mockReturnValue(app as never);

    ensureFirebaseAdmin();

    expect(mockInitializeApp).toHaveBeenCalledTimes(1);
    const options = mockInitializeApp.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(options.projectId).toBe('test-project-123');
    expect(options.credential).toBeDefined();
  });

  it('omits projectId when FIREBASE_PROJECT_ID is not configured', () => {
    const app = fakeApp();
    mockGetApps.mockReturnValue([] as never);
    mockInitializeApp.mockReturnValue(app as never);

    ensureFirebaseAdmin();

    const options = mockInitializeApp.mock.calls[0]?.[0] as Record<string, unknown>;
    expect('projectId' in options).toBe(false);
  });

  it('keeps existing TokenVerifier behavior for valid, invalid, and subject-less tokens', async () => {
    const app = fakeApp();
    mockGetApps.mockReturnValue([app] as never);
    const verifyIdToken = vi.fn(async (token: string) => {
      if (token === 'good') return { uid: 'uid-1' };
      if (token === 'no-subject') return {} as { uid: string };
      throw new Error('auth/id-token-expired');
    });
    mockGetAuth.mockReturnValue({ verifyIdToken } as never);

    const verifier = createFirebaseVerifier();
    await expect(verifier.verify('good')).resolves.toEqual({ uid: 'uid-1' });
    await expect(verifier.verify('bad')).rejects.toMatchObject({
      statusCode: 401,
      code: 'invalid_token',
    });
    await expect(verifier.verify('no-subject')).rejects.toMatchObject({
      statusCode: 401,
      code: 'invalid_token',
    });
    expect(mockGetAuth).toHaveBeenCalledWith(app);
  });

  it('fails clearly on init failure without mapping it to invalid_token or leaking secrets', async () => {
    process.env.FIREBASE_PROJECT_ID = 'test-project-123';
    process.env.GOOGLE_APPLICATION_CREDENTIALS = '/tmp/fake-super-secret-service-account.json';
    const failure = new Error('credential file not found');
    mockGetApps.mockReturnValue([] as never);
    mockInitializeApp.mockImplementation(() => {
      throw failure;
    });

    let thrown: unknown;
    try {
      createFirebaseVerifier();
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(FirebaseAdminInitError);
    const message = String((thrown as Error).message);
    expect(message).toMatch(/initialization failed/i);
    expect(message).not.toContain('/tmp/fake-super-secret-service-account.json');
    expect(message).not.toContain('super-secret');

    // A verifier created before the outage must surface init failures as-is,
    // never as a successful auth or as invalid_token.
    const app = fakeApp();
    mockGetApps.mockReturnValue([app] as never);
    mockGetAuth.mockReturnValue({
      verifyIdToken: vi.fn(async () => ({ uid: 'uid-1' })),
    } as never);
    const verifier = createFirebaseVerifier();
    mockGetApps.mockReturnValue([] as never);
    mockInitializeApp.mockImplementation(() => {
      throw failure;
    });
    await expect(verifier.verify('good')).rejects.toBeInstanceOf(FirebaseAdminInitError);
    await expect(verifier.verify('good')).rejects.not.toMatchObject({ code: 'invalid_token' });
  });

  it('never leaks Firebase UID into Tiizi domain identity', async () => {
    const app = fakeApp();
    mockGetApps.mockReturnValue([app] as never);
    mockGetAuth.mockReturnValue({
      verifyIdToken: vi.fn(async () => ({ uid: 'firebase-uid-abc' })),
    } as never);

    const verifier = createFirebaseVerifier();
    const request = { headers: { authorization: 'Bearer good' } } as never;
    await requireAuth(fakeDbWithMember('internal-member-uuid-1'), verifier)(
      request as never,
      {} as never,
    );

    const member = (request as { member?: Record<string, unknown> }).member;
    expect(member).toEqual({ memberId: 'internal-member-uuid-1' });
    expect(member).not.toHaveProperty('uid');
    expect(JSON.stringify(member)).not.toContain('firebase-uid-abc');
  });

  it('exposes init failures as 500-class errors, distinct from AuthError 401s', () => {
    const error = new FirebaseAdminInitError('boom');
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe('firebase_admin_init_failed');
    expect(error.statusCode).toBe(500);
    expect(new AuthError(401, 'invalid_token', 'x').statusCode).toBe(401);
  });
});
