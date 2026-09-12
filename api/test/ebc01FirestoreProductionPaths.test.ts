/**
 * EBC-01 production Firestore path tests (mocked firebase-admin).
 *
 * The Firestore emulator cannot run in this environment, so these tests
 * execute the PRODUCTION Admin SDK modules — group mutation store,
 * read-only authority reader, and charter-aware creation authority —
 * against a mocked firebase-admin Firestore. They prove the production
 * wiring the seam-contract tests assume:
 * - group creation commits the group + owner membership as ONE batched
 *   write with the V1 document identity (`{groupId}_{uid}`) and the group
 *   id stamped onto the membership;
 * - reads target the exact V1 collections/docs; counters use increment;
 * - the creation authority enforces live group + membership + Charter
 *   through the production reader, and outages propagate (fail closed).
 *
 * Mock precedent follows test/firebaseAdminInit.test.ts. No network.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('firebase-admin/app', () => ({
  getApps: vi.fn(),
  initializeApp: vi.fn(),
  applicationDefault: vi.fn(),
}));

const docs = new Map<string, Record<string, unknown> | null>();
const calls: Array<{ op: string; path?: string; data?: unknown }> = [];

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    increment: (n: number) => ({ __increment: n }),
  },
  getFirestore: vi.fn(() => ({
    collection: (name: string) => ({
      doc: (id?: string) => {
        const docId = id ?? `auto-${calls.length}`;
        const path = `${name}/${docId}`;
        return {
          id: docId,
          __path: path,
          get: async () => {
            calls.push({ op: 'get', path });
            const data = docs.get(path);
            return { exists: data != null, data: () => (data == null ? undefined : { ...data }) };
          },
          set: async (data: unknown) => {
            calls.push({ op: 'set', path, data });
            docs.set(path, { ...(data as Record<string, unknown>) });
          },
          update: async (data: unknown) => {
            calls.push({ op: 'update', path, data });
            const existing = docs.get(path);
            if (existing == null) throw new Error('not-found');
            docs.set(path, { ...existing, ...(data as Record<string, unknown>) });
          },
        };
      },
    }),
    batch: () => {
      const writes: Array<() => void> = [];
      return {
        set: (ref: { id: string; _path?: string }, data: unknown) => {
          const path = (ref as unknown as { __path: string }).__path ?? ref.id;
          writes.push(() => docs.set(path, { ...(data as Record<string, unknown>) }));
          calls.push({ op: 'batch-set', path, data });
        },
        commit: async () => {
          calls.push({ op: 'batch-commit' });
          for (const write of writes) write();
        },
      };
    },
  })),
}));

import { getApps } from 'firebase-admin/app';
import { testDb, seedMember, seedGroup } from './helpers.js';
import { createAdminGroupMutationStore } from '../src/firestoreGroupMutationStore.js';
import {
  createAdminFirestoreReader,
  createFirestoreGroupMembershipAuthority,
} from '../src/firestoreGroupAuthority.js';
import { createFirestoreChallengeCreationAuthority } from '../src/firestoreChallengeCreationAuthority.js';

const mockGetApps = vi.mocked(getApps);

beforeEach(async () => {
  docs.clear();
  calls.length = 0;
  mockGetApps.mockReturnValue([{ name: '[DEFAULT]' }] as never);
  await testDb().query(
    'TRUNCATE challenge_derived_state, challenge_participation_derived, challenge_activity_records, challenge_activity_configs, challenge_config_versions, challenge_participations, challenges, challenge_establishment_keys, member_activity_events, activity_submission_intents',
  );
});

describe('production group mutation store', () => {
  it('creates group + owner membership in one batch with V1 identities', async () => {
    const store = createAdminGroupMutationStore();
    const legacyId = await store.createGroupWithOwner(
      { name: 'Prod', ownerId: 'uid-1', status: 'active' },
      'uid-1',
      { userId: 'uid-1', role: 'owner', status: 'active' },
    );

    expect(calls.filter((c) => c.op === 'batch-set')).toHaveLength(2);
    expect(calls.map((c) => c.op)).toContain('batch-commit');
    const group = await store.getGroup(legacyId);
    expect(group).toMatchObject({ name: 'Prod', ownerId: 'uid-1' });
    const membership = await store.getMembership(legacyId, 'uid-1');
    expect(membership).toMatchObject({ userId: 'uid-1', role: 'owner', groupId: legacyId });
  });

  it('counters use increment; reads hit V1 collection paths', async () => {
    const store = createAdminGroupMutationStore();
    docs.set('groups/g9', { memberCount: 1 });
    docs.set('groupMembers/g9_uid-9', { status: 'active' });

    await store.updateGroupCounter('g9', 1);
    const counterCall = calls.find((c) => c.op === 'update' && c.path === 'groups/g9');
    expect(counterCall?.data).toEqual({ memberCount: { __increment: 1 } });

    await store.setMembership('g9', 'uid-9', { status: 'pending' });
    expect(calls.some((c) => c.op === 'set' && c.path === 'groupMembers/g9_uid-9')).toBe(true);
    await store.updateMembership('g9', 'uid-9', { status: 'active' });
    expect((await store.getMembership('g9', 'uid-9'))?.status).toBe('active');
    expect(await store.getGroup('missing')).toBeNull();
  });
});

describe('production authority over the admin reader', () => {
  it('membership authority and charter authority decide through live docs', async () => {
    const db = testDb();
    const memberId = await seedMember(db, 'prod-uid');
    const groupId = await seedGroup(db, { legacyId: 'prod-g', name: 'Prod Group' });
    docs.set('groups/prod-g', { status: 'active', allowMemberChallenges: false });
    docs.set('groupMembers/prod-g_prod-uid', { status: 'active', role: 'member' });

    const reader = createAdminFirestoreReader();
    const membership = createFirestoreGroupMembershipAuthority(db, reader);
    expect(await membership.resolveGroupMembershipAuthority(groupId, memberId)).toMatchObject({
      eligible: true,
    });

    const creation = createFirestoreChallengeCreationAuthority(db, reader);
    expect(await creation.resolveChallengeCreationAuthority(groupId, memberId)).toMatchObject({
      permitted: false,
      reason: 'charter_restricted',
    });
    expect(calls.filter((c) => c.op === 'get').map((c) => c.path)).toEqual(
      expect.arrayContaining(['groups/prod-g', 'groupMembers/prod-g_prod-uid']),
    );
  });

  it('reader outage propagates so callers fail closed', async () => {
    const { getFirestore } = await import('firebase-admin/firestore');
    vi.mocked(getFirestore).mockImplementationOnce(() => {
      throw new Error('transport down');
    });
    const db = testDb();
    const memberId = await seedMember(db, 'out-uid');
    const groupId = await seedGroup(db, { legacyId: 'out-g', name: 'Out Group' });
    const reader = createAdminFirestoreReader();
    const creation = createFirestoreChallengeCreationAuthority(db, reader);
    await expect(creation.resolveChallengeCreationAuthority(groupId, memberId)).rejects.toThrow(
      'transport down',
    );
  });
});
