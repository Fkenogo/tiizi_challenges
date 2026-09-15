import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import type { Db } from '../src/db.js';
import type { GroupMutationStore } from '../src/groupMutations.js';
import { registerPreviewComponentRoutes } from '../src/previewComponentRoutes.js';

class ContextDb implements Db {
  async query<T = Record<string, unknown>>(text: string): Promise<{ rows: T[] }> {
    if (text.includes('SELECT g.group_id')) {
      return {
        rows: [{
          group_id: '11111111-1111-4111-8111-111111111111',
          legacy_firestore_id: 'preview-component-group',
        }] as T[],
      };
    }
    throw new Error(`unexpected query: ${text}`);
  }
  async transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> { return fn(this); }
  async close(): Promise<void> {}
}

function liveStore(hasMembership = true): GroupMutationStore {
  return {
    async createGroupWithOwner() { throw new Error('context route must not create Groups'); },
    async getGroup() { return { name: 'Tiizi PF-05 Challenge Creation Preview', status: 'active' }; },
    async updateGroupCounter() {},
    async getMembership() {
      return hasMembership
        ? { userId: 'preview-founder-01', role: 'owner', status: 'active' }
        : null;
    },
    async setMembership() {},
    async updateMembership() {},
  };
}

describe('PF-05 component preview context route', () => {
  it('returns only a live governed Group context and never creates a Group', async () => {
    const app = Fastify();
    app.addHook('onRequest', async (request) => {
      request.member = { memberId: 'member-preview-founder' };
    });
    registerPreviewComponentRoutes(app, new ContextDb(), { store: liveStore(), firebaseUidForMember: async () => 'preview-founder-01' });

    const response = await app.inject({ method: 'GET', url: '/v1/preview/challenge-creation/context' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      groupId: '11111111-1111-4111-8111-111111111111',
      legacyGroupId: 'preview-component-group',
      groupName: 'Tiizi PF-05 Challenge Creation Preview',
    });
  });

  it('fails closed when the shadow row has no live membership', async () => {
    const app = Fastify();
    app.addHook('onRequest', async (request) => {
      request.member = { memberId: 'member-preview-founder' };
    });
    registerPreviewComponentRoutes(app, new ContextDb(), { store: liveStore(false), firebaseUidForMember: async () => 'preview-founder-01' });

    const response = await app.inject({ method: 'GET', url: '/v1/preview/challenge-creation/context' });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: { code: 'preview_context_unavailable' } });
  });
});
