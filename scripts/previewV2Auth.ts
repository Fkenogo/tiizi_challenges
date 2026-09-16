/**
 * TIIZI S1 CORR-003 — deterministic local V2 preview identity (library).
 *
 * LOCAL DEVELOPMENT INFRASTRUCTURE ONLY. Operates against the Firebase
 * Auth emulator on loopback and NOTHING else:
 *
 * - target must be the loopback Auth emulator (host 127.0.0.1/localhost,
 *   port 9099) — anything else throws;
 * - refuses to run under NODE_ENV=production;
 * - never touches production Auth (no admin credentials, no service
 *   accounts; the emulator owner scope exists only on loopback);
 * - project ID resolution prefers the SAME variable the V2 browser
 *   build reads (VITE_FIREBASE_PROJECT_ID), so seeder and browser
 *   land in the same emulator namespace by construction;
 * - the password travels from TIIZI_V2_PREVIEW_PASSWORD to the
 *   emulator only and is NEVER printed, logged, or returned;
 * - project drift is detected at runtime: if the account created
 *   through the client path is not visible under the requested
 *   project namespace, the reset fails instead of leaving a split
 *   identity (fix: restart the emulator with the same --project).
 *
 * Protocol (verified against the installed firebase-tools Auth
 * emulator): client-style Identity Toolkit v1 calls for sign-up /
 * sign-in (the same calls the browser SDK makes), plus emulator
 * owner-scoped admin calls for lookup/delete/list. No existing
 * neutral seeder covers Auth accounts (seedAppData seeds Firestore
 * docs; resetAllData is a destructive whole-project wipe requiring
 * admin credentials), so this minimal emulator-REST workflow stands
 * alone for the S1 preview identity.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseDotenv } from 'dotenv';

/** Recognisable local-only V2 preview identity (never a real address). */
export const V2_PREVIEW_EMAIL = 'founder1@tiizi.local';

/** Fixed loopback Auth emulator endpoint (mirrors CORR-002 app wiring). */
export const AUTH_EMULATOR_HOST = '127.0.0.1';
export const AUTH_EMULATOR_PORT = 9099;

/** Emulator owner scope: valid on loopback only, never a real credential. */
const OWNER_AUTH_HEADER = 'Bearer owner';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

export type EnvLike = Record<string, string | undefined>;

export type EmulatorTarget = { host: string; port: number; url: string };

/**
 * Resolve and validate the emulator target. Throws unless the target
 * is explicitly the loopback Auth emulator. Production mode refuses.
 */
export function resolveEmulatorTarget(opts: {
  host?: string;
  port?: string | number;
  nodeEnv?: string;
}): EmulatorTarget {
  if (opts.nodeEnv === 'production') {
    throw new Error('Refusing: preview identity workflow must not run with NODE_ENV=production.');
  }
  const host = (opts.host ?? AUTH_EMULATOR_HOST).trim();
  const port = Number(opts.port ?? AUTH_EMULATOR_PORT);
  if (!LOOPBACK_HOSTS.has(host.toLowerCase())) {
    throw new Error(`Refusing non-loopback Auth target: ${host}. Only the local Auth emulator may be reset.`);
  }
  if (!Number.isInteger(port) || port !== AUTH_EMULATOR_PORT) {
    throw new Error(`Refusing Auth target port ${opts.port ?? '(default)'}: only ${AUTH_EMULATOR_PORT} is allowed.`);
  }
  return { host, port, url: `http://${host}:${port}` };
}

function dotenvProjectId(cwd: string, file: string): string {
  const path = join(cwd, file);
  if (!existsSync(path)) return '';
  const parsed = parseDotenv(readFileSync(path, 'utf8'));
  return (parsed.VITE_FIREBASE_PROJECT_ID ?? parsed.FIREBASE_PROJECT_ID ?? '').trim();
}

/**
 * Resolve the emulator project namespace. Prefers the SAME variable
 * the V2 browser build reads so seeder and browser share one
 * namespace: CLI --project > VITE_FIREBASE_PROJECT_ID (env, then
 * .env.local) > FIREBASE_PROJECT_ID (env, then .env.local/.env).
 * Only public client configuration is read — never secrets.
 */
export function resolveProjectId(opts: { cliProject?: string; env?: EnvLike; cwd?: string }): string {
  const env = opts.env ?? process.env;
  const cwd = opts.cwd ?? process.cwd();
  const candidates = [
    opts.cliProject?.trim(),
    env.VITE_FIREBASE_PROJECT_ID?.trim(),
    dotenvProjectId(cwd, '.env.local'),
    env.FIREBASE_PROJECT_ID?.trim(),
    dotenvProjectId(cwd, '.env'),
  ];
  const projectId = candidates.find((value) => value) ?? '';
  if (!projectId) {
    throw new Error(
      'Missing project: pass --project <id> or set VITE_FIREBASE_PROJECT_ID (same value as the V2 frontend .env.local).',
    );
  }
  return projectId;
}

/** Password policy: Firebase minimum, presence enforced, value never echoed. */
export function requirePreviewPassword(password: string | undefined): string {
  if (!password || !password.trim()) {
    throw new Error('Missing password: export TIIZI_V2_PREVIEW_PASSWORD before running the reset.');
  }
  if (password.length < 6) {
    throw new Error('Invalid password: TIIZI_V2_PREVIEW_PASSWORD must be at least 6 characters.');
  }
  return password;
}

type FetchImpl = typeof fetch;

async function postJson(
  url: string,
  payload: Record<string, unknown>,
  fetchImpl: FetchImpl,
  ownerScope = false,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (ownerScope) headers.authorization = OWNER_AUTH_HEADER;
  let response: Response;
  try {
    response = await fetchImpl(url, { method: 'POST', headers, body: JSON.stringify(payload) });
  } catch {
    throw new Error(`Auth emulator unreachable: start it first (Terminal 1 of the Founder procedure).`);
  }
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: response.status, body };
}

function toolkitError(body: Record<string, unknown>, status: number): string {
  const message = (body?.error as { message?: string } | undefined)?.message;
  return message ?? `HTTP ${status}`;
}

type AdminUser = { localId: string; email?: string; disabled?: boolean };

/** Owner-scoped lookup by email (loopback emulator only). */
async function lookupByEmail(
  target: string,
  projectId: string,
  email: string,
  fetchImpl: FetchImpl,
): Promise<AdminUser | null> {
  const { status, body } = await postJson(
    `${target}/identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/accounts:lookup`,
    { email: [email] },
    fetchImpl,
    true,
  );
  if (status === 400 || status === 401 || status === 403) {
    throw new Error(
      'Emulator owner lookup rejected: upgrade firebase-tools and ensure the Auth emulator is running.',
    );
  }
  if (status !== 200) throw new Error(`Emulator account lookup failed: ${toolkitError(body, status)}.`);
  const users = (body.users as AdminUser[] | undefined) ?? [];
  return users.find((user) => user.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

/** Owner-scoped delete by localId (loopback emulator only). */
async function deleteByLocalId(
  target: string,
  projectId: string,
  localId: string,
  fetchImpl: FetchImpl,
): Promise<void> {
  const { status, body } = await postJson(
    `${target}/identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/accounts:delete`,
    { localId },
    fetchImpl,
    true,
  );
  if (status !== 200) throw new Error(`Could not remove stale preview account: ${toolkitError(body, status)}.`);
}

export type ResetReport = {
  email: string;
  uid: string;
  projectId: string;
  target: string;
  replaced: boolean;
};

function driftError(projectId: string): Error {
  return new Error(
    `Project drift: the preview account is not visible under project ${projectId}. ` +
      `Restart the Auth emulator with --project ${projectId} (same VITE_FIREBASE_PROJECT_ID as the V2 frontend), then reset again.`,
  );
}

/**
 * Deterministic reset: remove the designated preview identity if it
 * is visible under the requested project, create it fresh with the
 * supplied password through the same client call the browser uses,
 * then verify it by authenticating (sign-in) with the new password.
 * Returns email/uid/project/target for the preview report. The
 * password is accepted but never included in the result.
 */
export async function resetPreviewAccount(opts: {
  projectId: string;
  target: EmulatorTarget;
  password: string | undefined;
  fetchImpl?: FetchImpl;
}): Promise<ResetReport> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const password = requirePreviewPassword(opts.password);
  const { projectId, target } = opts;

  let reachable: Response;
  try {
    reachable = await fetchImpl(`${target.url}/`);
  } catch {
    throw new Error(`Auth emulator unreachable at ${target.url}: start it first (Terminal 1 of the Founder procedure).`);
  }
  if (!reachable.ok) throw new Error(`Auth emulator unhealthy at ${target.url} (HTTP ${reachable.status}).`);

  const stale = await lookupByEmail(target.url, projectId, V2_PREVIEW_EMAIL, fetchImpl);
  if (stale) {
    await deleteByLocalId(target.url, projectId, stale.localId, fetchImpl);
  }

  const created = await postJson(
    `${target.url}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=local-preview`,
    { email: V2_PREVIEW_EMAIL, password, returnSecureToken: true },
    fetchImpl,
  );
  const createdUid =
    created.status === 200 ? (created.body.localId as string | undefined) : undefined;
  if (!createdUid) {
    if (toolkitError(created.body, created.status).includes('EMAIL_EXISTS')) throw driftError(projectId);
    throw new Error(`Preview account creation failed: ${toolkitError(created.body, created.status)}.`);
  }

  // Verify: the fresh account must authenticate AND be visible under
  // the requested project. Either check failing means drift.
  const signedIn = await postJson(
    `${target.url}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=local-preview`,
    { email: V2_PREVIEW_EMAIL, password, returnSecureToken: true },
    fetchImpl,
  );
  const verified = await lookupByEmail(target.url, projectId, V2_PREVIEW_EMAIL, fetchImpl);
  if (signedIn.status !== 200 || !verified || verified.localId !== createdUid) {
    throw driftError(projectId);
  }
  return { email: V2_PREVIEW_EMAIL, uid: createdUid, projectId, target: target.url, replaced: stale !== null };
}

export type ListedAccount = { email: string; uid: string; disabled: boolean };

/**
 * Safe inspection: email/uid/disabled only. Hashes (which can embed
 * password material on the emulator), salts, tokens and secrets from
 * the admin response are stripped here and can never reach output.
 */
export async function listPreviewAccounts(opts: {
  projectId: string;
  target: EmulatorTarget;
  fetchImpl?: FetchImpl;
}): Promise<ListedAccount[]> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(
      `${opts.target.url}/identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(opts.projectId)}/accounts:batchGet?pageSize=100`,
      { headers: { authorization: OWNER_AUTH_HEADER } },
    );
  } catch {
    throw new Error(`Auth emulator unreachable: start it first (Terminal 1 of the Founder procedure).`);
  }
  if (response.status !== 200) {
    throw new Error(`Emulator account list failed: HTTP ${response.status}.`);
  }
  const body = (await response.json().catch(() => ({}))) as { users?: AdminUser[] };
  const users = body.users ?? [];
  return users
    .filter((account) => typeof account.email === 'string')
    .map((account) => ({
      email: account.email as string,
      uid: account.localId,
      disabled: account.disabled === true,
    }));
}
