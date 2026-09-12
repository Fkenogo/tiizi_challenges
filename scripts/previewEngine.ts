/**
 * EBC-05 local Founder Preview runner (LOCAL ONLY).
 *
 * One command that starts the real V2 stack locally with visible logs:
 *   1. preflight: required env flags + local PostgreSQL reachability;
 *   2. spawns the Tiizi API (tsx src/index.ts) and the Vite app;
 *   3. inherits stdio so both services log to this terminal;
 *   4. Ctrl-C stops both.
 *
 * Run: npm run preview:engine
 *
 * Prerequisites (see docs/preview/TIIZI-V2-ENGINE-FOUNDER-PREVIEW.md):
 * - PostgreSQL running with migrations 001→012 applied;
 * - Firebase emulators running (auth + firestore) when
 *   VITE_FIREBASE_USE_EMULATORS=true;
 * - FIREBASE_AUTH_EMULATOR_HOST / FIRESTORE_EMULATOR_HOST exported for
 *   the API process when using emulators.
 */
import { spawn, type ChildProcess } from 'node:child_process';

function required(name: string): string {
  const value = (process.env[name] ?? '').trim();
  if (!value) {
    console.error(`preview:engine: missing required env ${name} (see docs/preview/TIIZI-V2-ENGINE-FOUNDER-PREVIEW.md)`);
    process.exit(2);
  }
  return value;
}

async function preflight(): Promise<void> {
  const v2 = process.env.VITE_TIIZI_V2_CHALLENGES_ENABLED?.trim().toLowerCase();
  if (v2 !== 'true') {
    console.error('preview:engine: VITE_TIIZI_V2_CHALLENGES_ENABLED must be true for the Founder Preview.');
    process.exit(2);
  }
  required('VITE_TIIZI_API_BASE_URL');
  const databaseUrl = required('DATABASE_URL');
  let host = '';
  try {
    host = new URL(databaseUrl).hostname.toLowerCase();
  } catch {
    console.error('preview:engine: DATABASE_URL is not a valid URL.');
    process.exit(2);
  }
  if (host !== 'localhost' && host !== '127.0.0.1' && host !== '::1') {
    console.error(`preview:engine: refusing to preview against non-localhost host (${host}).`);
    process.exit(2);
  }
  // Local PostgreSQL TCP reachability (no driver needed: the API's own
  // /ready probe confirms database access once it is up).
  const { Socket } = await import('node:net');
  const parsed = new URL(databaseUrl);
  const tcpHost = parsed.hostname;
  const tcpPort = Number(parsed.port || '5432');
  await new Promise<void>((resolve) => {
    const socket = new Socket();
    socket.setTimeout(3000);
    socket.on('connect', () => {
      console.log('preview:engine: local PostgreSQL reachable');
      socket.destroy();
      resolve();
    });
    socket.on('timeout', () => {
      console.error('preview:engine: local PostgreSQL unreachable (connection timed out).');
      socket.destroy();
      process.exit(2);
    });
    socket.on('error', (error) => {
      console.error(`preview:engine: local PostgreSQL unreachable: ${error.message}`);
      socket.destroy();
      process.exit(2);
    });
    socket.connect(tcpPort, tcpHost);
  });
}

function start(label: string, command: string, args: string[]): ChildProcess {
  console.log(`preview:engine: starting ${label}: ${command} ${args.join(' ')}`);
  const child = spawn(command, args, { stdio: 'inherit', shell: false });
  child.on('exit', (code, signal) => {
    console.error(`preview:engine: ${label} exited (code=${code} signal=${signal}) — stopping preview.`);
    process.exit(code ?? 1);
  });
  return child;
}

async function main(): Promise<void> {
  await preflight();
  const apiPort = (process.env.PORT ?? '4000').trim();
  const api = start('tiizi-api', 'npm', ['run', 'dev', '--prefix', 'api']);
  const web = start('vite-app', 'npx', ['vite', '--port', process.env.VITE_PORT ?? '5173']);
  const shutdown = () => {
    api.kill('SIGINT');
    web.kill('SIGINT');
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  console.log(`preview:engine: API → http://localhost:${apiPort} · app → http://localhost:${process.env.VITE_PORT ?? '5173'}/app/challenges/v2`);
}

void main();
