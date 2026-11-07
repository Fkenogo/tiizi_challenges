/**
 * Start a fully local Founder Preview using the real V2 app, API, Auth
 * Emulator and an ephemeral PostgreSQL cluster. Every process and database
 * directory belongs to this invocation; no existing service is stopped.
 */
import { randomBytes } from 'node:crypto';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { rmSync } from 'node:fs';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import { resolveEmulatorTarget, resetPreviewAccount } from './previewV2Auth.js';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DATABASE_NAME = 'tiizi_founder_preview';
const EMAIL = 'amara@tiizi.local';
const PASSWORD = randomBytes(18).toString('base64url');
const API_PORTS = [4019, 4020, 4021];
const WEB_PORTS = [5178, 5179, 5180];
const AUTH_PORTS = [19099, 9099];

type Service = { name: string; child: ChildProcess };
const services: Service[] = [];
let dataDir = '';
let pgCtl = '';
let pgStarted = false;
let stopping: Promise<void> | undefined;

function localEnv(extra: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env = { ...process.env, ...extra };
  for (const key of [
    'GOOGLE_APPLICATION_CREDENTIALS', 'GCLOUD_PROJECT', 'FIREBASE_CONFIG',
    'DATABASE_URL', 'TIIZI_DB_SERVER_CA_PEM', 'CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE',
  ]) delete env[key];
  Object.assign(env, extra);
  return env;
}

function assertDevelopmentInvocation(): void {
  if (process.env.NODE_ENV === 'production') throw new Error('Founder Preview refuses NODE_ENV=production.');
  if (!process.env.CI && process.env.FIREBASE_CONFIG) {
    throw new Error('Founder Preview refuses inherited Firebase project configuration.');
  }
}

async function portIsFree(port: number): Promise<boolean> {
  return new Promise((resolvePort) => {
    const server = net.createServer();
    server.once('error', () => resolvePort(false));
    server.listen(port, '127.0.0.1', () => server.close(() => resolvePort(true)));
  });
}

async function choosePort(candidates: number[]): Promise<number> {
  for (const port of candidates) if (await portIsFree(port)) return port;
  throw new Error(`No free preview port in ${candidates.join(', ')}. Existing services were left untouched.`);
}

async function freePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') return reject(new Error('Could not allocate local port.'));
      server.close((error) => error ? reject(error) : resolvePort(address.port));
    });
  });
}

function run(command: string, args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}): Promise<void> {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { cwd: options.cwd ?? ROOT, env: options.env, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code, signal) => code === 0
      ? resolveRun()
      : reject(new Error(`${command} exited with ${signal ?? code}.`)));
  });
}

function runDetached(command: string, args: string[]): Promise<void> {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { cwd: ROOT, stdio: 'ignore', detached: process.platform !== 'win32' });
    child.once('error', reject);
    child.once('exit', (code, signal) => code === 0
      ? resolveRun()
      : reject(new Error(`${command} exited with ${signal ?? code}.`)));
  });
}

function startService(name: string, command: string, args: string[], env: NodeJS.ProcessEnv): ChildProcess {
  const child = spawn(command, args, { cwd: ROOT, env, stdio: 'inherit', detached: process.platform !== 'win32' });
  services.push({ name, child });
  child.once('error', (error) => console.error(`${name} failed to start: ${error.message}`));
  child.once('exit', (code, signal) => {
    if (!stopping) {
      console.error(`${name} stopped unexpectedly (${signal ?? code}).`);
      void stop(1);
    }
  });
  return child;
}

async function waitFor(url: string, label: string, child?: ChildProcess): Promise<void> {
  const deadline = Date.now() + 60_000;
  let lastError = 'not ready';
  while (Date.now() < deadline) {
    if (child?.exitCode !== null && child?.exitCode !== undefined) throw new Error(`${label} exited before becoming ready.`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1_500) });
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 400));
  }
  throw new Error(`${label} did not become ready at ${url}: ${lastError}`);
}

async function stop(exitCode = 0): Promise<void> {
  if (stopping) return stopping;
  stopping = (async () => {
    for (const { child } of services) {
      if (child.exitCode !== null) continue;
      try {
        if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, 'SIGINT');
        else child.kill('SIGINT');
      } catch { /* already stopped */ }
    }
    await Promise.all(services.map(({ child }) => new Promise<void>((done) => {
      if (child.exitCode !== null) return done();
      const timer = setTimeout(() => {
        try {
          if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, 'SIGTERM');
          else child.kill('SIGTERM');
        } catch { /* already stopped */ }
        done();
      }, 4_000);
      child.once('exit', () => { clearTimeout(timer); done(); });
    })));
    if (pgStarted && pgCtl && dataDir) {
      spawnSync(pgCtl, ['-D', join(dataDir, 'data'), '-m', 'fast', '-w', 'stop'], { stdio: 'ignore' });
      pgStarted = false;
    }
    if (dataDir) {
      await rm(dataDir, { recursive: true, force: true });
      dataDir = '';
    }
    console.log('Founder Preview stopped; only this run’s processes and temporary database were removed.');
    process.exitCode = exitCode;
  })();
  return stopping;
}

async function main(): Promise<void> {
  assertDevelopmentInvocation();
  console.log('Founder Preview: checking loopback ports and local PostgreSQL tools…');
  const apiPort = await choosePort(API_PORTS);
  const webPort = await choosePort(WEB_PORTS);
  const authPort = await choosePort(AUTH_PORTS);
  const postgresPort = await freePort();
  const hubPort = await freePort();
  const loggingPort = await freePort();
  const projectId = `demo-tiizi-founder-${process.pid}-${randomBytes(4).toString('hex')}`;
  const authUrl = `http://127.0.0.1:${authPort}`;
  const webOrigin = `http://127.0.0.1:${webPort}`;
  const apiTarget = `http://127.0.0.1:${apiPort}`;
  const generated = await mkdtemp(join(tmpdir(), 'tiizi-founder-preview-'));
  dataDir = generated;
  console.log(`Founder Preview: using API ${apiPort}, web ${webPort}, Auth Emulator ${authPort}, PostgreSQL ${postgresPort}.`);

  const pgConfig = spawnSync('pg_config', ['--bindir'], { encoding: 'utf8' });
  if (pgConfig.status !== 0 || !pgConfig.stdout.trim()) throw new Error('PostgreSQL tools (pg_config) are required for the local disposable preview database.');
  const pgBin = pgConfig.stdout.trim();
  pgCtl = join(pgBin, 'pg_ctl');
  const initdb = join(pgBin, 'initdb');
  const createdb = join(pgBin, 'createdb');
  const psql = join(pgBin, 'psql');
  const dbData = join(generated, 'data');
  const dbSocket = join(generated, 'socket');
  await mkdir(dbSocket, { mode: 0o700 });
  const initialized = spawnSync(initdb, ['-D', dbData, '-U', 'tiizi_preview', '--auth=trust', '--no-locale', '--encoding=UTF8'], { encoding: 'utf8' });
  if (initialized.status !== 0) throw new Error(`Could not initialize isolated PostgreSQL: ${(initialized.stderr || initialized.stdout).trim().slice(-1200)}`);
  const pgLog = join(generated, 'postgres.log');
  try {
    await runDetached(pgCtl, ['-D', dbData, '-l', pgLog, '-o', `-h 127.0.0.1 -p ${postgresPort} -k ${dbSocket}`, '-w', 'start']);
  } catch {
    const details = await readFile(pgLog, 'utf8').catch(() => 'no PostgreSQL startup log available');
    throw new Error(`Could not start isolated PostgreSQL: ${details.trim().slice(-1200)}`);
  }
  pgStarted = true;
  console.log('Founder Preview: isolated PostgreSQL cluster started.');
  const dbArgs = ['-h', '127.0.0.1', '-p', String(postgresPort), '-U', 'tiizi_preview'];
  const created = spawnSync(createdb, [...dbArgs, DATABASE_NAME], { encoding: 'utf8' });
  if (created.status !== 0) throw new Error(`Could not create the preview database: ${created.stderr.trim()}`);
  const dbMarker = `tiizi-disposable-preview:founder-preview:${generated.split('/').pop()}`;
  const marked = spawnSync(psql, [...dbArgs, '-d', DATABASE_NAME, '-v', 'ON_ERROR_STOP=1', '-c', `COMMENT ON DATABASE ${DATABASE_NAME} IS '${dbMarker}'`], { encoding: 'utf8' });
  if (marked.status !== 0) throw new Error(`Could not mark the preview database disposable: ${marked.stderr.trim()}`);
  const markerCheck = spawnSync(psql, [...dbArgs, '-d', DATABASE_NAME, '-tA', '-v', 'ON_ERROR_STOP=1', '-c', `SELECT shobj_description((SELECT oid FROM pg_database WHERE datname = current_database()), 'pg_database')`], { encoding: 'utf8' });
  if (markerCheck.status !== 0 || markerCheck.stdout.trim() !== dbMarker) throw new Error('The temporary PostgreSQL database did not return its expected disposable marker.');
  const databaseUrl = `postgresql://tiizi_preview@127.0.0.1:${postgresPort}/${DATABASE_NAME}`;
  const firebaseConfig = join(generated, 'firebase.json');
  await writeFile(firebaseConfig, JSON.stringify({ emulators: {
    auth: { host: '127.0.0.1', port: authPort },
    hub: { host: '127.0.0.1', port: hubPort },
    logging: { host: '127.0.0.1', port: loggingPort },
    ui: { enabled: false },
  } }));

  const baseEnv = localEnv({ NODE_ENV: 'development', FIREBASE_PROJECT_ID: projectId, VITE_FIREBASE_PROJECT_ID: projectId });
  console.log('Starting an isolated Founder Preview (local V2 + real API; no production credentials).');
  console.log(`  PostgreSQL: 127.0.0.1:${postgresPort}/${DATABASE_NAME} (temporary cluster, disposable marker verified)`);
  await run(process.execPath, ['--import', 'tsx', 'api/src/migrateCli.ts'], { env: localEnv({ ...baseEnv, DATABASE_URL: databaseUrl }) });

  const auth = startService('Firebase Auth Emulator', 'firebase', [
    'emulators:start', '--only', 'auth', '--project', projectId, '--config', firebaseConfig,
  ], localEnv({ ...baseEnv, FIREBASE_AUTH_EMULATOR_HOST: `127.0.0.1:${authPort}` }));
  await waitFor(`${authUrl}/`, 'Firebase Auth Emulator', auth);
  const authTarget = resolveEmulatorTarget({ host: '127.0.0.1', port: authPort, nodeEnv: 'development' });
  await resetPreviewAccount({ projectId, target: authTarget, password: PASSWORD });

  // Existing governed Development fixture path: fictional Amara, Group and
  // Challenges are written only into this run's disposable PostgreSQL cluster.
  await run(process.execPath, ['--import', 'tsx', 'scripts/previewS5bSeed.ts'], {
    env: localEnv({
      ...baseEnv,
      DATABASE_URL: databaseUrl,
      FIREBASE_AUTH_EMULATOR_HOST: `127.0.0.1:${authPort}`,
      TIIZI_FOUNDER_AUTH_EMULATOR_URL: authUrl,
      TIIZI_S5B_PREVIEW_PASSWORD: PASSWORD,
    }),
  });
  const identityCheck = await fetch(`${authUrl}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=local-preview`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true }),
  });
  if (!identityCheck.ok) throw new Error('The fictional Founder Preview identity could not authenticate with the local Auth Emulator.');
  const identity = await identityCheck.json() as { idToken?: string };
  if (!identity.idToken) throw new Error('The Auth Emulator did not issue a local ID token for the preview identity.');
  const bootstrapSignIn = await fetch(`${authUrl}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=local-preview`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'founder1@tiizi.local', password: PASSWORD, returnSecureToken: true }),
  });
  if (!bootstrapSignIn.ok) throw new Error('The fresh bootstrap test identity could not authenticate with the local Auth Emulator.');
  const bootstrapIdentity = await bootstrapSignIn.json() as { idToken?: string };
  if (!bootstrapIdentity.idToken) throw new Error('The Auth Emulator did not issue a token for the fresh bootstrap test identity.');

  const api = startService('Tiizi API', process.execPath, ['--import', 'tsx', 'api/src/index.ts'], localEnv({
    ...baseEnv,
    DATABASE_URL: databaseUrl,
    FIREBASE_AUTH_EMULATOR_HOST: `127.0.0.1:${authPort}`,
    HOST: '127.0.0.1',
    PORT: String(apiPort),
    TIIZI_ALLOWED_ORIGINS: '',
  }));
  await waitFor(`${apiTarget}/ready`, 'Tiizi API', api);

  const vite = startService('Vite V2 frontend', process.execPath, [
    join(ROOT, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(webPort), '--strictPort',
  ], localEnv({
    ...baseEnv,
    TIIZI_FOUNDER_PREVIEW: '1',
    TIIZI_FOUNDER_API_TARGET: apiTarget,
    VITE_TIIZI_API_ENABLED: 'true',
    VITE_TIIZI_API_BASE_URL: webOrigin,
    VITE_TIIZI_KNOWLEDGE_API_ENABLED: 'true',
    VITE_USE_FIREBASE_EMULATORS: 'true',
    VITE_FIREBASE_AUTH_EMULATOR_URL: authUrl,
    VITE_FIREBASE_API_KEY: 'local-emulator-only',
    VITE_FIREBASE_AUTH_DOMAIN: '127.0.0.1',
    VITE_FIREBASE_MESSAGING_SENDER_ID: '0',
    VITE_FIREBASE_APP_ID: '1:0:web:founder-preview',
  }));
  await waitFor(webOrigin, 'V2 frontend', vite);
  const bootstrap = await fetch(`${webOrigin}/api/members/bootstrap`, {
    method: 'POST',
    headers: { authorization: `Bearer ${identity.idToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ displayName: 'Amara' }),
  });
  if (!bootstrap.ok) {
    const body = await bootstrap.json().catch(() => ({})) as { error?: { code?: string } };
    throw new Error(`Synthetic account bootstrap failed through the same-origin proxy (HTTP ${bootstrap.status}, ${body.error?.code ?? 'unknown'}).`);
  }
  const createdBootstrap = await fetch(`${webOrigin}/api/members/bootstrap`, {
    method: 'POST',
    headers: { authorization: `Bearer ${bootstrapIdentity.idToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ displayName: 'Preview Member' }),
  });
  const createdMember = await createdBootstrap.json().catch(() => ({})) as { created?: boolean; error?: { code?: string } };
  if (!createdBootstrap.ok || createdMember.created !== true) {
    throw new Error(`Fresh synthetic member bootstrap did not create a member through the same-origin proxy (HTTP ${createdBootstrap.status}, ${createdMember.error?.code ?? 'created=false'}).`);
  }

  console.log('\nFounder Preview is ready.');
  console.log(`  Today: ${webOrigin}/v2/today`);
  console.log(`  Sign in: ${EMAIL}`);
  console.log('  Fresh bootstrap test identity: founder1@tiizi.local');
  console.log(`  Local-only password: ${PASSWORD}`);
  console.log(`  Auth emulator: ${authUrl} (${projectId})`);
  console.log(`  API: same-origin /api proxy to ${apiTarget}; CORS is not relaxed`);
  console.log(`  Bootstrap: Amara idempotent HTTP ${bootstrap.status}; founder1 created=true HTTP ${createdBootstrap.status}`);
  console.log('  Operator Template routes retain their real API authorization and may show a restricted state for this member.');
  console.log('  Press Ctrl-C to stop only this preview and remove its temporary PostgreSQL cluster.');
}

process.once('SIGINT', () => { void stop(130); });
process.once('SIGTERM', () => { void stop(143); });
process.on('uncaughtException', (error) => { console.error(error); void stop(1); });
process.on('unhandledRejection', (error) => { console.error(error); void stop(1); });
process.on('exit', () => {
  if (pgStarted && pgCtl && dataDir) {
    spawnSync(pgCtl, ['-D', join(dataDir, 'data'), '-m', 'fast', '-w', 'stop'], { stdio: 'ignore' });
    pgStarted = false;
  }
  if (dataDir) rmSync(dataDir, { recursive: true, force: true });
});

main().catch(async (error: unknown) => {
  console.error(`Founder Preview startup failed: ${error instanceof Error ? error.message : String(error)}`);
  await stop(1);
});
