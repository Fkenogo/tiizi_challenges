import { describe, expect, it } from 'vitest';
import type { Db } from '../src/db.js';
import type { GroupMutationStore } from '../src/groupMutations.js';
import {
  assertLocalPreviewComponentRuntime,
  ensurePreviewComponentGroup,
  findPreviewComponentGroup,
  PREVIEW_COMPONENT_GROUP_NAME,
} from '../src/previewComponentGroup.js';

class FixtureDb implements Db {
  groupId: string | null = null;
  legacyId: string | null = null;

  async query<T = Record<string, unknown>>(text: string): Promise<{ rows: T[] }> {
    if (text.includes('SELECT g.group_id')) {
      return this.groupId && this.legacyId
        ? { rows: [{ group_id: this.groupId, legacy_firestore_id: this.legacyId }] as T[] }
        : { rows: [] };
    }
    if (text.includes('INSERT INTO groups')) {
      this.groupId = '11111111-1111-4111-8111-111111111111';
      return { rows: [{ group_id: this.groupId }] as T[] };
    }
    if (text.includes('INSERT INTO group_memberships')) return { rows: [] };
    throw new Error(`unexpected query: ${text}`);
  }

  async transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> { return fn(this); }
  async close(): Promise<void> {}
}

function fixtureStore(): GroupMutationStore & { creates: number; memberships: Map<string, Record<string, unknown>> } {
  const groups = new Map<string, Record<string, unknown>>();
  const memberships = new Map<string, Record<string, unknown>>();
  let creates = 0;
  return {
    get creates() { return creates; },
    memberships,
    async createGroupWithOwner(group, ownerUid, ownerMembership) {
      creates += 1;
      const id = 'preview-component-group';
      groups.set(id, group);
      memberships.set(`${id}:${ownerUid}`, { ...ownerMembership, groupId: id });
      return id;
    },
    async getGroup(id) { return groups.get(id) ?? null; },
    async updateGroupCounter() {},
    async getMembership(groupId, uid) { return memberships.get(`${groupId}:${uid}`) ?? null; },
    async setMembership(groupId, uid, data) { memberships.set(`${groupId}:${uid}`, data); },
    async updateMembership(groupId, uid, patch) {
      memberships.set(`${groupId}:${uid}`, { ...memberships.get(`${groupId}:${uid}`), ...patch });
    },
  };
}

describe('PF-05 Challenge Creation component preview fixture', () => {
  it('refuses every non-demo or non-emulator runtime', () => {
    expect(() => assertLocalPreviewComponentRuntime({
      FIREBASE_PROJECT_ID: 'tiizi-challenges',
      FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
      FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
    })).toThrow(/demo/i);
  });

  it('creates one governed live owner Group and reuses it idempotently', async () => {
    const db = new FixtureDb();
    const store = fixtureStore();
    const actor = { memberId: 'member-preview-founder', firebaseUid: 'preview-founder-01' };

    const first = await ensurePreviewComponentGroup(db, store, actor);
    db.legacyId = first.legacyId;
    const second = await ensurePreviewComponentGroup(db, store, actor);

    expect(first).toMatchObject({
      status: 'created',
      name: PREVIEW_COMPONENT_GROUP_NAME,
      legacyId: 'preview-component-group',
    });
    expect(second).toMatchObject({ status: 'existing', legacyId: 'preview-component-group' });
    expect(store.creates).toBe(1);
    expect(store.memberships.get('preview-component-group:preview-founder-01')).toMatchObject({
      role: 'owner', status: 'active', userId: 'preview-founder-01',
    });
  });

  it('fails closed when a PG shadow fixture lacks live owner membership', async () => {
    const db = new FixtureDb();
    db.groupId = '11111111-1111-4111-8111-111111111111';
    db.legacyId = 'shadow-only-group';
    const store = fixtureStore();
    await store.createGroupWithOwner({ name: PREVIEW_COMPONENT_GROUP_NAME }, 'different-owner', {});

    await expect(ensurePreviewComponentGroup(
      db,
      store,
      { memberId: 'member-preview-founder', firebaseUid: 'preview-founder-01' },
    )).rejects.toThrow(/live owner membership/i);
  });

  it('returns no preview context before the governed fixture exists', async () => {
    await expect(findPreviewComponentGroup(
      new FixtureDb(),
      fixtureStore(),
      { memberId: 'member-preview-founder', firebaseUid: 'preview-founder-01' },
    )).resolves.toBeNull();
  });
});
