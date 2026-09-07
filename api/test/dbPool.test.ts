import { afterEach, describe, expect, it } from 'vitest';
import {
  createPool,
  DB_POOL_MAX_ENV,
  DEFAULT_DB_POOL_MAX,
  MAX_DB_POOL_MAX,
  resolveDbPoolMax,
} from '../src/db.js';

const DUMMY_URL = 'postgresql://tiizi:tiizi@localhost:5432/tiizi';

afterEach(() => {
  delete process.env[DB_POOL_MAX_ENV];
});

describe('resolveDbPoolMax', () => {
  it(`defaults to ${DEFAULT_DB_POOL_MAX} when unset, empty, or blank`, () => {
    expect(resolveDbPoolMax(undefined)).toBe(DEFAULT_DB_POOL_MAX);
    expect(resolveDbPoolMax('')).toBe(DEFAULT_DB_POOL_MAX);
    expect(resolveDbPoolMax('   ')).toBe(DEFAULT_DB_POOL_MAX);
    delete process.env[DB_POOL_MAX_ENV];
    expect(resolveDbPoolMax()).toBe(DEFAULT_DB_POOL_MAX);
  });

  it('honors a valid configured size', () => {
    expect(resolveDbPoolMax('1')).toBe(1);
    expect(resolveDbPoolMax('10')).toBe(10);
    expect(resolveDbPoolMax(String(MAX_DB_POOL_MAX))).toBe(MAX_DB_POOL_MAX);
  });

  it('rejects non-integers, out-of-range values, and non-numbers', () => {
    for (const bad of ['0', '-3', '1.5', 'abc', '', `${MAX_DB_POOL_MAX + 1}`, '1000000']) {
      if (bad === '') continue;
      expect(() => resolveDbPoolMax(bad), bad).toThrow(
        new RegExp(`${DB_POOL_MAX_ENV} must be an integer between 1 and ${MAX_DB_POOL_MAX}`),
      );
    }
  });
});

describe('createPool wiring', () => {
  it('fails fast when the configured pool size is invalid', () => {
    process.env[DB_POOL_MAX_ENV] = 'bogus';
    expect(() => createPool(DUMMY_URL)).toThrow(/TIIZI_DB_POOL_MAX/);
  });

  it('lets an explicit option bypass the environment', () => {
    process.env[DB_POOL_MAX_ENV] = 'bogus';
    const db = createPool(DUMMY_URL, { max: 3 });
    expect(db).toBeDefined();
    return db.close();
  });

  it('constructs and closes without opening connections eagerly', async () => {
    const db = createPool(DUMMY_URL);
    await db.close();
  });
});
