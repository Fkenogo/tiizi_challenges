import { describe, expect, it, vi } from 'vitest';
import {
  assertDisposableTargetSpec,
  disposableTargetSpecFromEnv,
  openGuardedDisposableDb,
  verifyDisposableMarker,
  type DisposableTargetSpec,
} from '../src/disposableDbGuard.js';
import { DISPOSABLE_DB_MARKER_PREFIX } from '../src/knowledgeDevCataloguePublish.js';
import type { Db } from '../src/db.js';

const good: DisposableTargetSpec = {
  url: 'postgresql://u:p@127.0.0.1:55779/tiizi_p5_preview_s4',
  allowedHost: '127.0.0.1',
  allowedPort: '55779',
  databaseName: 'tiizi_p5_preview_s4',
};

const fakeDb = (row: Record<string, unknown>): Db => ({
  query: async () => ({ rows: [row] }),
  transaction: async <T,>(fn: (tx: Db) => Promise<T>) => fn(fakeDb(row)),
  close: vi.fn(async () => {}),
}) as unknown as Db;

describe('disposable database guard — pre-connection rejection', () => {
  it('accepts only the exact allow-listed loopback target', () => {
    expect(assertDisposableTargetSpec(good)).toEqual({ host: '127.0.0.1', port: '55779', database: 'tiizi_p5_preview_s4' });
  });

  it('rejects unset URL, host, port or database name', () => {
    for (const patch of [{ url: undefined }, { allowedHost: undefined }, { allowedPort: undefined }, { databaseName: undefined }, { allowedHost: '' }]) {
      expect(() => assertDisposableTargetSpec({ ...good, ...patch })).toThrow(/unset/);
    }
  });

  it('rejects the persistent default port 5432 however it is supplied', () => {
    expect(() => assertDisposableTargetSpec({ ...good, allowedPort: '5432', url: 'postgresql://u@127.0.0.1:5432/tiizi_p5_preview_s4' })).toThrow(/5432/);
    expect(() => assertDisposableTargetSpec({ ...good, url: 'postgresql://u@127.0.0.1:5432/tiizi_p5_preview_s4' })).toThrow(/5432/);
    expect(() => assertDisposableTargetSpec({ ...good, url: 'postgresql://u@127.0.0.1/tiizi_p5_preview_s4' })).toThrow(/explicit port/);
  });

  it('rejects persistent, shared, remote and mismatched targets', () => {
    const cases: Array<[Partial<DisposableTargetSpec>, RegExp]> = [
      [{ url: 'postgresql://u@127.0.0.1:55779/tiizi', databaseName: 'tiizi' }, /protected/],
      [{ url: 'postgresql://u@127.0.0.1:55779/postgres', databaseName: 'postgres' }, /protected/],
      [{ url: 'postgresql://u@127.0.0.1:55779/tiizi_prod_preview', databaseName: 'tiizi_prod_preview' }, /protected/],
      [{ url: 'postgresql://u@db.example.com:55779/tiizi_p5_preview_s4' }, /not loopback/],
      [{ url: 'postgresql://u@localhost:55779/tiizi_p5_preview_s4' }, /not the allowed host/],
      [{ url: 'postgresql://u@127.0.0.1:55780/tiizi_p5_preview_s4' }, /not the allowed port/],
      [{ url: 'postgresql://u@127.0.0.1:55779/tiizi_p5_preview_other' }, /does not equal/],
      [{ url: 'postgresql://u@127.0.0.1:55779/customers', databaseName: 'customers' }, /naming pattern/],
      [{ url: 'postgresql://u@127.0.0.1:55779/tiizi_p5_preview_s4?host=db.example.com' }, /override/],
      [{ allowedPort: '80' }, /unprivileged/],
      [{ allowedPort: 'abc' }, /unprivileged/],
    ];
    for (const [patch, msg] of cases) expect(() => assertDisposableTargetSpec({ ...good, ...patch }), JSON.stringify(patch)).toThrow(msg);
  });

  it('never opens a connection for a rejected target', async () => {
    const connect = vi.fn(() => fakeDb({}));
    for (const patch of [{ allowedPort: '5432', url: 'postgresql://u@127.0.0.1:5432/tiizi_p5_preview_s4' }, { databaseName: undefined }, { url: 'postgresql://u@db.example.com:55779/tiizi_p5_preview_s4' }]) {
      await expect(openGuardedDisposableDb({ ...good, ...patch }, connect)).rejects.toThrow(/disposable target refused/);
    }
    expect(connect).not.toHaveBeenCalled();
  });

  it('reads the allow-list from the environment and fails closed when absent', () => {
    expect(() => assertDisposableTargetSpec(disposableTargetSpecFromEnv(good.url, {}))).toThrow(/unset/);
    const spec = disposableTargetSpecFromEnv(good.url, {
      TIIZI_DISPOSABLE_DB_HOST: '127.0.0.1', TIIZI_DISPOSABLE_DB_PORT: '55779', TIIZI_DISPOSABLE_DB_NAME: 'tiizi_p5_preview_s4',
    });
    expect(assertDisposableTargetSpec(spec).database).toBe('tiizi_p5_preview_s4');
  });
});

describe('disposable database guard — marker verification before mutation', () => {
  const marker = `${DISPOSABLE_DB_MARKER_PREFIX}s4`;
  const row = { db: 'tiizi_p5_preview_s4', usr: 'u', port: '55779', marker };

  it('accepts a matching identity with the marker', async () => {
    await expect(verifyDisposableMarker(fakeDb(row), good)).resolves.toMatchObject({ connectedDatabase: 'tiizi_p5_preview_s4', marker });
  });

  it('fails closed on a missing marker, wrong marker prefix, wrong database or wrong server port', async () => {
    for (const bad of [{ marker: null }, { marker: 'something-else' }, { db: 'tiizi' }, { port: '5432' }, { port: '55780' }]) {
      await expect(verifyDisposableMarker(fakeDb({ ...row, ...bad }), good), JSON.stringify(bad)).rejects.toThrow(/disposable target refused/);
    }
  });

  it('closes the connection and returns no handle when the marker check fails', async () => {
    const db = fakeDb({ ...row, marker: null });
    await expect(openGuardedDisposableDb(good, () => db)).rejects.toThrow(/marker/);
    expect(db.close).toHaveBeenCalledTimes(1);
  });

  it('returns the handle only after verification passes', async () => {
    const db = fakeDb(row);
    const out = await openGuardedDisposableDb(good, () => db);
    expect(out.db).toBe(db);
    expect(out.identity.marker).toBe(marker);
    expect(db.close).not.toHaveBeenCalled();
  });
});
