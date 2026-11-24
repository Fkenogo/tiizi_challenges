import { createServer, type Socket } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { attachPoolErrorHandler, createPool, sanitizePoolError, type PoolIdleErrorInfo } from '../src/db.js';
import { EventEmitter } from 'node:events';

function pgFrame(type: string, body: Buffer): Buffer {
  const out = Buffer.alloc(1 + 4 + body.length);
  out.write(type, 0, 1, 'ascii');
  out.writeInt32BE(4 + body.length, 1);
  body.copy(out, 5);
  return out;
}

const AUTH_OK = pgFrame('R', Buffer.alloc(4)); // AuthenticationOk (0)
const READY_FOR_QUERY = pgFrame('Z', Buffer.from('I', 'ascii'));
const COMMAND_COMPLETE = pgFrame('C', Buffer.from('SELECT 1\0', 'utf8'));
const ROW_DESC = (() => {
  const name = Buffer.from('ok\0', 'utf8');
  const buf = Buffer.alloc(2 + name.length + 18);
  buf.writeInt16BE(1, 0);
  name.copy(buf, 2);
  buf.writeInt32BE(23, 2 + name.length + 6); // int4 oid
  buf.writeInt16BE(4, 2 + name.length + 10);
  buf.writeInt32BE(-1, 2 + name.length + 12);
  return pgFrame('T', buf);
})();
const DATA_ROW = (() => {
  const val = Buffer.from('1', 'utf8');
  const buf = Buffer.alloc(2 + 4 + val.length);
  buf.writeInt16BE(1, 0);
  buf.writeInt32BE(val.length, 2);
  val.copy(buf, 6);
  return pgFrame('D', buf);
})();

function startMinimalPgServer(options: { failQueries?: boolean } = {}) {
  const sockets = new Set<Socket>();
  let connectionCount = 0;
  const server = createServer((socket) => {
    connectionCount += 1;
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    let greeted = false;
    socket.on('data', (chunk) => {
      if (!greeted) {
        greeted = true;
        socket.write(Buffer.concat([AUTH_OK, READY_FOR_QUERY]));
        return;
      }
      const msgType = String.fromCharCode(chunk[0]);
      if (msgType === 'X') {
        socket.end();
        return;
      }
      if (msgType === 'Q' || msgType === 'P') {
        if (options.failQueries) {
          socket.resetAndDestroy();
          return;
        }
        socket.write(Buffer.concat([ROW_DESC, DATA_ROW, COMMAND_COMPLETE, READY_FOR_QUERY]));
      }
    });
  });

  return new Promise<{
    port: number;
    sockets: Set<Socket>;
    connectionCount: () => number;
    close: () => Promise<void>;
  }>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({
        port: typeof addr === 'object' && addr ? addr.port : 0,
        sockets,
        connectionCount: () => connectionCount,
        close: async () => {
          for (const s of sockets) s.destroy();
          await new Promise<void>((res) => server.close(() => res()));
        },
      });
    });
  });
}

describe('PostgreSQL pool idle error & reliability', () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    while (cleanups.length > 0) {
      await cleanups.pop()!();
    }
  });

  it('maps allowlisted idle pool errors to static credential-safe diagnostics and drops arbitrary messages/codes', () => {
    const err = Object.assign(
      new Error('read ETIMEDOUT postgresql://tiizi_runtime:super-secret@ep-x.neon.tech:5432/tiizi'),
      { code: 'ETIMEDOUT', client: { password: 'super-secret' } },
    );
    const info = sanitizePoolError(err);
    expect(info).toEqual({
      code: 'ETIMEDOUT',
      message: 'Idle PostgreSQL client connection timed out',
    });
    expect(JSON.stringify(info)).not.toContain('super-secret');
    expect(JSON.stringify(info)).not.toContain('ep-x.neon.tech');

    expect(sanitizePoolError(Object.assign(new Error('socket hang up'), { errno: 'econnreset' }))).toEqual({
      code: 'ECONNRESET',
      message: 'Idle PostgreSQL client connection reset by peer',
    });

    expect(sanitizePoolError(Object.assign(new Error('terminating connection'), { code: '57P01' }))).toEqual({
      code: '57P01',
      message: 'PostgreSQL server terminated connection (admin shutdown)',
    });

    const arbitraryErr = Object.assign(
      new Error('password=plain-secret Bearer tok_12345 host=db.internal'),
      {
        code: 'SECRET_CODE_LEAK_tok_999',
        token: 'tok_999',
        client: { connectionString: 'postgres://user:pass@host/db' },
      },
    );
    const arbitraryInfo = sanitizePoolError(arbitraryErr);
    expect(arbitraryInfo).toEqual({
      code: 'UNKNOWN',
      message: 'Idle PostgreSQL client connection failed',
    });
    expect(JSON.stringify(arbitraryInfo)).not.toContain('plain-secret');
    expect(JSON.stringify(arbitraryInfo)).not.toContain('tok_12345');
    expect(JSON.stringify(arbitraryInfo)).not.toContain('SECRET_CODE_LEAK');
    expect(JSON.stringify(arbitraryInfo)).not.toContain('db.internal');

    expect(sanitizePoolError(null)).toEqual({
      code: 'UNKNOWN',
      message: 'Idle PostgreSQL client connection failed',
    });
    expect(sanitizePoolError('postgres://user:pass@host/db')).toEqual({
      code: 'UNKNOWN',
      message: 'Idle PostgreSQL client connection failed',
    });
  });

  it('handles idle pool errors without crashing, discards the dead socket, and reconnects on next query', async () => {
    const pgServer = await startMinimalPgServer();
    cleanups.push(() => pgServer.close());

    const idleErrors: PoolIdleErrorInfo[] = [];
    const db = createPool(`postgresql://tiizi:tiizi@127.0.0.1:${pgServer.port}/tiizi`, {
      max: 2,
      onIdleError: (info) => idleErrors.push(info),
    });
    cleanups.push(() => db.close());

    // 1. Initial query establishes an idle pool client
    const r1 = await db.query<{ ok: number }>('SELECT 1');
    expect(r1.rows).toEqual([{ ok: 1 }]);
    expect(pgServer.connectionCount()).toBe(1);
    expect(pgServer.sockets.size).toBe(1);

    // 2. Abruptly reset the idle socket (simulates Neon idle compute timeout / ECONNRESET)
    for (const sock of pgServer.sockets) {
      sock.resetAndDestroy();
    }
    await new Promise((r) => setTimeout(r, 80));

    // Process did not crash and idle error was captured safely
    expect(idleErrors.length).toBeGreaterThanOrEqual(1);
    expect(pgServer.sockets.size).toBe(0);

    // 3. Subsequent query discards dead client and opens a fresh connection
    const r2 = await db.query<{ ok: number }>('SELECT 1');
    expect(r2.rows).toEqual([{ ok: 1 }]);
    expect(pgServer.connectionCount()).toBe(2);
  });

  it('still propagates active query errors and fails /ready during an actual outage', async () => {
    const pgServer = await startMinimalPgServer({ failQueries: true });
    cleanups.push(() => pgServer.close());

    const db = createPool(`postgresql://tiizi:tiizi@127.0.0.1:${pgServer.port}/tiizi`, {
      max: 1,
      onIdleError: () => {},
    });
    cleanups.push(() => db.close());

    await expect(db.query('SELECT 1')).rejects.toThrow();

    const app = buildApp({
      db,
      verifier: { verify: async () => ({ uid: 'u1' }) },
    });
    cleanups.push(() => app.close());

    const readyRes = await app.inject({ method: 'GET', url: '/ready' });
    expect(readyRes.statusCode).toBe(503);
    expect(readyRes.json()).toEqual({
      error: { code: 'not_ready', message: 'Database unavailable' },
    });
  });

  it('attaches error handler to arbitrary pool emitters and closes cleanly without leaking connections', async () => {
    const fakePool = new EventEmitter();
    const captured: PoolIdleErrorInfo[] = [];
    attachPoolErrorHandler(fakePool as never, (info) => captured.push(info));
    fakePool.emit('error', Object.assign(new Error('read ETIMEDOUT'), { code: 'ETIMEDOUT' }));
    expect(captured).toEqual([
      { code: 'ETIMEDOUT', message: 'Idle PostgreSQL client connection timed out' },
    ]);

    const pgServer = await startMinimalPgServer();
    cleanups.push(() => pgServer.close());
    const db = createPool(`postgresql://tiizi:tiizi@127.0.0.1:${pgServer.port}/tiizi`, {
      max: 2,
      onIdleError: () => {},
    });
    await db.query('SELECT 1');
    expect(pgServer.sockets.size).toBe(1);
    await db.close();
    await new Promise((r) => setTimeout(r, 50));
    expect(pgServer.sockets.size).toBe(0);
  });
});
