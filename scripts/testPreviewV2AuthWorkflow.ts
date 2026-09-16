/**
 * TIIZI S1 CORR-003 — preview identity workflow safety tests
 * (run: npm run test:preview-v2-auth-workflow).
 *
 * Spins a stub Auth emulator on the REAL loopback target
 * (127.0.0.1:9099) implementing the verified emulator protocol
 * (client-style Identity Toolkit v1 calls + owner-scoped admin
 * calls; fake hashes embed password material like the real
 * emulator) and proves the reset/list workflow against it:
 *
 * - non-loopback targets refused; production mode refused;
 * - missing/short password fails;
 * - the expected emulator project namespace is used (and isolated);
 * - a stale designated account is replaced deterministically;
 * - the resulting account exists and authenticates with the new password;
 * - project drift fails closed instead of splitting identity;
 * - the password (including hash-embedded material) never reaches
 *   logs, listings, or the reset report;
 * - V2 browser emulator mode stays explicit opt-in; production builds
 *   cannot activate it; the dev-only binding diagnostic stays gated.
 *
 * No real Firebase project is touched: the stub only binds loopback.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AUTH_EMULATOR_HOST,
  AUTH_EMULATOR_PORT,
  listPreviewAccounts,
  resolveEmulatorTarget,
  resolveProjectId,
  resetPreviewAccount,
  V2_PREVIEW_EMAIL,
} from './previewV2Auth.js';
import {
  AUTH_EMULATOR_URL,
  resolveAuthEmulatorMode,
} from '../src/lib/firebaseEmulators.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string): string => readFileSync(join(root, rel), 'utf8');

let failures = 0;
function check(name: string, condition: boolean, detail = ''): void {
  if (condition) {
    console.log(`  ok: ${name}`);
  } else {
    failures += 1;
    console.error(`  FAIL: ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function expectThrow(name: string, fn: () => unknown): Promise<void> {
  return (async () => {
    try {
      await fn();
    } catch (error) {
      console.log(`  ok: ${name} (${(error as Error).message.split(':')[0]})`);
      return;
    }
    failures += 1;
    console.error(`  FAIL: ${name} — expected throw, completed normally`);
  })();
}

// ─── Stub Auth emulator (loopback only, real-protocol shape) ─────────────────
type StubUser = { localId: string; email: string; password: string; disabled: boolean };
const namespaces = new Map<string, Map<string, StubUser>>();
let clientNamespace = 'stub-proof-project';
let uidCounter = 0;

function usersOf(project: string): Map<string, StubUser> {
  let users = namespaces.get(project);
  if (!users) {
    users = new Map();
    namespaces.set(project, users);
  }
  return users;
}

function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let raw = '';
    request.on('data', (chunk: Buffer) => { raw += chunk.toString(); });
    request.on('end', () => {
      try {
        resolve(JSON.parse(raw) as Record<string, unknown>);
      } catch {
        resolve({});
      }
    });
  });
}

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}

/** Raw record exactly as the emulator admin API returns it (hash embeds password). */
function rawRecord(user: StubUser): Record<string, unknown> {
  return {
    localId: user.localId,
    email: user.email,
    disabled: user.disabled,
    salt: 'fake-salt',
    passwordHash: `fakeHash:password=${user.password}`,
  };
}

function isOwner(request: IncomingMessage): boolean {
  return request.headers.authorization === 'Bearer owner';
}

const server: Server = createServer((request, response) => {
  void (async () => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1:9099');
    if (request.method === 'GET' && url.pathname === '/') {
      send(response, 200, { authEmulator: true });
      return;
    }
    // Client-style calls land in the emulator default namespace.
    if (request.method === 'POST' && url.pathname === '/identitytoolkit.googleapis.com/v1/accounts:signUp') {
      const body = await readJson(request);
      const email = String(body.email ?? '').toLowerCase();
      const password = String(body.password ?? '');
      const users = usersOf(clientNamespace);
      const exists = [...users.values()].some((user) => user.email === email);
      if (exists) {
        send(response, 400, { error: { message: 'EMAIL_EXISTS' } });
        return;
      }
      if (password.length < 6) {
        send(response, 400, { error: { message: 'WEAK_PASSWORD' } });
        return;
      }
      uidCounter += 1;
      const user: StubUser = { localId: `stub-uid-${uidCounter}`, email, password, disabled: false };
      users.set(user.localId, user);
      send(response, 200, { localId: user.localId, email });
      return;
    }
    if (request.method === 'POST' && url.pathname === '/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword') {
      const body = await readJson(request);
      const email = String(body.email ?? '').toLowerCase();
      const existing = [...usersOf(clientNamespace).values()].find((user) => user.email === email);
      if (!existing) {
        send(response, 400, { error: { message: 'EMAIL_NOT_FOUND' } });
        return;
      }
      if (existing.password !== String(body.password ?? '')) {
        send(response, 400, { error: { message: 'INVALID_PASSWORD' } });
        return;
      }
      send(response, 200, { localId: existing.localId, email });
      return;
    }
    // Owner-scoped admin calls are namespaced by path project.
    // batchGet is GET-only on the real emulator (POST -> 405).
    const admin = request.method === 'POST'
      ? url.pathname.match(/^\/identitytoolkit\.googleapis\.com\/v1\/projects\/([^/]+)\/(accounts:lookup|accounts:delete)$/)
      : url.pathname.match(/^\/identitytoolkit\.googleapis\.com\/v1\/projects\/([^/]+)\/(accounts:batchGet)$/);
    if (admin) {
      if (!isOwner(request)) {
        send(response, 400, { error: { message: 'INSUFFICIENT_PERMISSION' } });
        return;
      }
      const project = decodeURIComponent(admin[1]);
      const action = admin[2];
      const users = usersOf(project);
      if (action === 'accounts:lookup') {
        const body = await readJson(request);
        const wanted = new Set((body.email as string[] | undefined ?? []).map((e) => String(e).toLowerCase()));
        send(response, 200, { users: [...users.values()].filter((u) => wanted.has(u.email)).map(rawRecord) });
        return;
      }
      if (action === 'accounts:delete') {
        const body = await readJson(request);
        const deleted = users.delete(String(body.localId ?? ''));
        send(response, deleted ? 200 : 404, deleted ? {} : { error: { message: 'NOT_FOUND' } });
        return;
      }
      // accounts:batchGet (GET only).
      send(response, 200, { users: [...users.values()].map(rawRecord) });
      return;
    }
    send(response, 404, { error: { message: 'NOT_FOUND' } });
  })();
});

async function signInRest(email: string, password: string): Promise<number> {
  const response = await fetch(
    'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=local-preview',
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }) },
  );
  return response.status;
}

const PROOF_PROJECT = 'stub-proof-project';
const target = { host: AUTH_EMULATOR_HOST, port: AUTH_EMULATOR_PORT, url: `http://${AUTH_EMULATOR_HOST}:${AUTH_EMULATOR_PORT}` };

await new Promise<void>((resolve, reject) => {
  server.on('error', (error: unknown) => reject(new Error(`stub emulator could not bind 127.0.0.1:9099: ${(error as Error).message}`)));
  server.listen(9099, '127.0.0.1', () => resolve());
});

try {
  console.log('safety: target and mode refusal');
  await expectThrow('non-loopback host refused', () => resolveEmulatorTarget({ host: '10.0.0.5' }));
  await expectThrow('public hostname refused', () => resolveEmulatorTarget({ host: 'example.com' }));
  await expectThrow('wrong port refused', () => resolveEmulatorTarget({ port: 9098 }));
  await expectThrow('production mode refused', () => resolveEmulatorTarget({ nodeEnv: 'production' }));
  await expectThrow('missing password fails', () => resetPreviewAccount({ projectId: PROOF_PROJECT, target, password: undefined as unknown as string }));
  await expectThrow('blank password fails', () => resetPreviewAccount({ projectId: PROOF_PROJECT, target, password: '   ' }));
  await expectThrow('short password fails', () => resetPreviewAccount({ projectId: PROOF_PROJECT, target, password: '12345' }));

  console.log('project resolution prefers the browser variable');
  check(
    'VITE_ variable wins for browser consistency',
    resolveProjectId({ env: { VITE_FIREBASE_PROJECT_ID: 'browser-project', FIREBASE_PROJECT_ID: 'other' }, cwd: '/nonexistent' }) === 'browser-project',
  );
  await expectThrow('missing project fails closed', () => resolveProjectId({ env: {}, cwd: '/nonexistent' }));

  console.log('deterministic reset against stub emulator');
  // Stale account with an UNKNOWN old password and different uid.
  usersOf(PROOF_PROJECT).set('stale-uid-1', { localId: 'stale-uid-1', email: V2_PREVIEW_EMAIL, password: 'Forgotten-Old-Pw', disabled: false });

  const NEW_PASSWORD = 'NoLeak-7qZ!xP';
  const captured: string[] = [];
  const realLog = console.log;
  console.log = (...args: unknown[]) => { captured.push(args.map(String).join(' ')); };
  let report: Awaited<ReturnType<typeof resetPreviewAccount>>;
  let listed: Awaited<ReturnType<typeof listPreviewAccounts>>;
  try {
    report = await resetPreviewAccount({ projectId: PROOF_PROJECT, target, password: NEW_PASSWORD });
    listed = await listPreviewAccounts({ projectId: PROOF_PROJECT, target });
    console.log(`listed: ${listed.map((a) => `${a.email}/${a.uid}/${a.disabled}`).join(',')}`);
  } finally {
    console.log = realLog;
  }
  const transcript = captured.join('\n');

  check('stale account was replaced', report!.replaced === true);
  check('new uid differs from stale uid', report!.uid !== 'stale-uid-1');
  check('report carries email/project/target', report!.email === V2_PREVIEW_EMAIL && report!.projectId === PROOF_PROJECT && report!.target === target.url);
  check('report carries no password', !JSON.stringify(report).includes(NEW_PASSWORD));
  check('password never logged (even hash-embedded)', !transcript.includes(NEW_PASSWORD));
  check('no raw hashes/tokens in safe listing', !/fakeHash|fake-salt|idToken/.test(transcript));
  check('exactly one preview account exists', listed!.length === 1 && listed![0].email === V2_PREVIEW_EMAIL);
  check('account uid matches report', listed![0].uid === report!.uid);
  check('new password authenticates', (await signInRest(V2_PREVIEW_EMAIL, NEW_PASSWORD)) === 200);
  check('old password rejected', (await signInRest(V2_PREVIEW_EMAIL, 'Forgotten-Old-Pw')) === 400);

  // The raw admin response DOES carry password material: proves the filter strips something real.
  const raw = await fetch(
    `http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/${PROOF_PROJECT}/accounts:batchGet?pageSize=100`,
    { headers: { authorization: 'Bearer owner' } },
  ).then((r) => r.text());
  check('raw admin response carries password material (filter has work to do)', raw.includes(NEW_PASSWORD));

  console.log('second reset is idempotent (replace again, still exactly one)');
  const again = await resetPreviewAccount({ projectId: PROOF_PROJECT, target, password: 'Second-Pw-456' });
  const afterAgain = await listPreviewAccounts({ projectId: PROOF_PROJECT, target });
  check('replaced again', again.replaced === true);
  check('still exactly one account', afterAgain.length === 1);
  check('uid rotated', afterAgain[0].uid !== report!.uid);

  console.log('project namespaces stay isolated; drift fails closed');
  const other = await listPreviewAccounts({ projectId: 'other-project', target });
  check('other namespace untouched', other.length === 0);
  clientNamespace = 'drifted-project';
  await expectThrow('drift fails closed instead of splitting identity', () => resetPreviewAccount({ projectId: PROOF_PROJECT, target, password: 'Drift-New-Pw-0' }));
  clientNamespace = PROOF_PROJECT;

  console.log('browser emulator mode stays explicit opt-in; prod cannot activate');
  check('dev + flag enables', resolveAuthEmulatorMode({ DEV: true, VITE_USE_FIREBASE_EMULATORS: 'true' }) === true);
  check('prod + flag stays off', resolveAuthEmulatorMode({ DEV: false, VITE_USE_FIREBASE_EMULATORS: 'true' }) === false);
  check('script/app endpoint constants agree', `http://${AUTH_EMULATOR_HOST}:${AUTH_EMULATOR_PORT}` === AUTH_EMULATOR_URL);
  const helper = read('src/lib/firebaseEmulators.ts');
  check('DEV gate precedes SDK connect', helper.indexOf('env.DEV !== true') < helper.indexOf('connectAuthEmulator(auth,'));
  check('dev-only binding diagnostic present and gated', helper.includes('console.info') && helper.indexOf('isAuthEmulatorModeEnabled()') < helper.indexOf('console.info'));
} finally {
  server.close();
}

if (failures > 0) {
  console.error(`\nPreview V2 auth workflow tests: ${failures} failure(s).`);
  process.exit(1);
}
console.log('\nPreview V2 auth workflow tests: all passing.');
