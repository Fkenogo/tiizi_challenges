/**
 * Deterministic Firebase Auth emulator seed for the local PF-05 preview.
 *
 * This module refuses every non-loopback target and only runs when the
 * emulator host is explicitly set. Passwords arrive through
 * TIIZI_PREVIEW_PASSWORD and are never logged or persisted in source.
 */
import 'dotenv/config';
import { getAuth } from 'firebase-admin/auth';
import { ensureFirebaseAdmin } from './auth.js';

export const PREVIEW_AUTH_USERS = [
  { uid: 'preview-founder-01', email: 'founder1@tiizi.local' },
  { uid: 'preview-founder-02', email: 'founder2@tiizi.local' },
] as const;

interface PreviewAuthUser {
  uid: string;
  email?: string;
}

export interface PreviewAuthAdmin {
  getUser(uid: string): Promise<PreviewAuthUser>;
  getUserByEmail(email: string): Promise<PreviewAuthUser>;
  createUser(input: { uid: string; email: string; emailVerified: boolean; password: string }): Promise<PreviewAuthUser>;
}

function isUserNotFound(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && (error as { code?: string }).code === 'auth/user-not-found';
}

export function assertLocalAuthEmulatorHost(rawHost: string | undefined): string {
  const value = rawHost?.trim();
  if (!value) throw new Error('preview auth seed requires an Auth emulator host (FIREBASE_AUTH_EMULATOR_HOST)');
  let parsed: URL;
  try {
    parsed = new URL(`http://${value}`);
  } catch {
    throw new Error('preview auth seed requires a valid localhost Auth emulator host');
  }
  const isLoopback = parsed.hostname === '127.0.0.1'
    || parsed.hostname === 'localhost'
    || parsed.hostname === '::1';
  if (!isLoopback || parsed.port !== '9099' || parsed.pathname !== '/') {
    throw new Error('preview auth seed refuses a non-localhost Auth emulator target');
  }
  return `http://${parsed.host}`;
}

export async function seedPreviewAuthUsers(
  admin: PreviewAuthAdmin,
  password: string,
): Promise<Array<{ uid: string; status: 'created' | 'existing' }>> {
  if (!password) throw new Error('preview auth seed requires TIIZI_PREVIEW_PASSWORD');
  const results: Array<{ uid: string; status: 'created' | 'existing' }> = [];
  for (const previewUser of PREVIEW_AUTH_USERS) {
    try {
      await admin.getUser(previewUser.uid);
      results.push({ uid: previewUser.uid, status: 'existing' });
      continue;
    } catch (error) {
      if (!isUserNotFound(error)) throw error;
    }
    try {
      await admin.createUser({ ...previewUser, emailVerified: true, password });
      results.push({ uid: previewUser.uid, status: 'created' });
    } catch (error) {
      if (!isUserNotFound(error) && (error as { code?: string }).code !== 'auth/email-already-exists') {
        throw error;
      }
      const existing = await admin.getUserByEmail(previewUser.email);
      if (existing.uid !== previewUser.uid) {
        throw new Error(`preview auth seed email is already linked to a different local UID: ${previewUser.email}`);
      }
      results.push({ uid: previewUser.uid, status: 'existing' });
    }
  }
  return results;
}

async function main(): Promise<void> {
  assertLocalAuthEmulatorHost(process.env.FIREBASE_AUTH_EMULATOR_HOST);
  const password = process.env.TIIZI_PREVIEW_PASSWORD ?? '';
  const results = await seedPreviewAuthUsers(getAuth(ensureFirebaseAdmin()), password);
  for (const result of results) console.log(`preview:auth: ${result.uid} ${result.status}`);
}

const invokedAsCli = process.argv[1]?.endsWith('previewAuthSeedCli.ts')
  || process.argv[1]?.endsWith('previewAuthSeedCli.js');
if (invokedAsCli) {
  main().catch((error: unknown) => {
    console.error(`preview:auth: failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
