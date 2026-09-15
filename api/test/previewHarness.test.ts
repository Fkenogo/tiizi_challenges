import { describe, expect, it } from 'vitest';
import {
  assertLocalAuthEmulatorHost,
  seedPreviewAuthUsers,
} from '../src/previewAuthSeedCli.js';
import {
  assertLocalPreviewDatabaseUrl,
  PREVIEW_MEMBER_UIDS,
  seedPreviewMembers,
} from '../src/previewMemberSeedCli.js';
import { findMemberByAuth } from '../src/members.js';
import type { Db } from '../src/db.js';

class PreviewMemberDb implements Db {
  readonly members = new Map<string, string>();
  readonly writes: string[] = [];

  async query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: T[] }> {
    const uid = String(params?.[params.length - 1] ?? '');
    if (text.includes('SELECT member_id FROM members')) {
      const memberId = this.members.get(uid);
      return { rows: memberId ? [{ member_id: memberId }] as T[] : [] };
    }
    if (text.includes('INSERT INTO members')) {
      const memberId = `member-${this.members.size + 1}`;
      this.members.set(uid, memberId);
      this.writes.push(uid);
      return { rows: [{ member_id: memberId }] as T[] };
    }
    throw new Error(`unexpected query: ${text}`);
  }

  async transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
    return fn(this);
  }

  async close(): Promise<void> {}
}

describe('local preview safety harness', () => {
  it('refuses an Auth seed target that is not the local Auth emulator', () => {
    expect(() => assertLocalAuthEmulatorHost(undefined)).toThrow(/Auth emulator/i);
    expect(() => assertLocalAuthEmulatorHost('auth.example.com:9099')).toThrow(/localhost/i);
  });

  it('creates each deterministic Auth UID once and is idempotent', async () => {
    const users = new Map<string, { uid: string; email: string }>();
    const admin = {
      async getUser(uid: string) {
        const user = users.get(uid);
        if (!user) throw Object.assign(new Error('not found'), { code: 'auth/user-not-found' });
        return user;
      },
      async getUserByEmail(email: string) {
        const user = [...users.values()].find((entry) => entry.email === email);
        if (!user) throw Object.assign(new Error('not found'), { code: 'auth/user-not-found' });
        return user;
      },
      async createUser(input: { uid: string; email: string }) {
        const user = { uid: input.uid, email: input.email };
        users.set(input.uid, user);
        return user;
      },
    };

    await seedPreviewAuthUsers(admin, 'preview-password-from-environment');
    await seedPreviewAuthUsers(admin, 'preview-password-from-environment');

    expect([...users.values()]).toEqual([
      { uid: 'preview-founder-01', email: 'founder1@tiizi.local' },
      { uid: 'preview-founder-02', email: 'founder2@tiizi.local' },
    ]);
  });

  it('dry-runs the member seed by default', async () => {
    const db = new PreviewMemberDb();

    const result = await seedPreviewMembers(db, false);

    expect(result.created).toEqual([]);
    expect(result.wouldCreate).toEqual([...PREVIEW_MEMBER_UIDS]);
    expect(db.writes).toEqual([]);
  });

  it('refuses a non-local PostgreSQL target', () => {
    expect(() => assertLocalPreviewDatabaseUrl('postgresql://theo@db.example.com:5432/tiizi')).toThrow(/localhost/i);
  });

  it('creates two Firebase UID to Member mappings when --apply is selected', async () => {
    const db = new PreviewMemberDb();

    const result = await seedPreviewMembers(db, true);

    expect(result.created).toEqual([...PREVIEW_MEMBER_UIDS]);
    expect(db.members.get('preview-founder-01')).toBe('member-1');
    expect(db.members.get('preview-founder-02')).toBe('member-2');
  });

  it('keeps repeated member seed applies idempotent and findable', async () => {
    const db = new PreviewMemberDb();
    await seedPreviewMembers(db, true);
    const repeated = await seedPreviewMembers(db, true);

    expect(repeated.created).toEqual([]);
    expect(repeated.existing).toEqual([...PREVIEW_MEMBER_UIDS]);
    await expect(findMemberByAuth(db, 'firebase', 'preview-founder-01')).resolves.toEqual({ memberId: 'member-1' });
    await expect(findMemberByAuth(db, 'firebase', 'preview-founder-02')).resolves.toEqual({ memberId: 'member-2' });
  });
});
