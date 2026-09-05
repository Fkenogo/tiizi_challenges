import { describe, expect, it } from 'vitest';
import type { Db } from '../src/db.js';
import {
  runShadowImport,
  type FirestoreSource,
} from '../src/shadowImport.js';
import { testDb } from './helpers.js';

function fakeSource(): FirestoreSource {
  return {
    async listGroups() {
      return [
        { firestoreId: 'g1', name: 'Runners', description: 'Run club', isPrivate: false, status: 'active' },
        { firestoreId: 'g2', name: 'Private', isPrivate: true, status: 'active' },
      ];
    },
    async listGroupMembers() {
      return [
        { firestoreId: 'm1', groupFirestoreId: 'g1', userId: 'u1', role: 'owner', status: 'active' },
        { firestoreId: 'm2', groupFirestoreId: 'g1', userId: 'u2', role: 'member', status: 'joined' },
        { firestoreId: 'm3', groupFirestoreId: 'g2', userId: 'u1', role: 'member', status: 'pending' },
        // Malformed rows must be skipped, never crash the import.
        { firestoreId: 'm4', groupFirestoreId: '', userId: 'u3', role: 'member', status: 'active' },
        { firestoreId: 'm5', groupFirestoreId: 'missing-group', userId: 'u3', role: 'member', status: 'active' },
      ];
    },
  };
}

async function counts(db: Db) {
  const members = await db.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM members`,
  );
  const groups = await db.query<{ count: string }>(`SELECT COUNT(*) AS count FROM groups`);
  const memberships = await db.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM group_memberships`,
  );
  return {
    members: Number(members.rows[0].count),
    groups: Number(groups.rows[0].count),
    memberships: Number(memberships.rows[0].count),
  };
}

describe('shadow importer', () => {
  it('dry-run reads the source but writes nothing', async () => {
    const db = testDb();
    const report = await runShadowImport(db, fakeSource(), { dryRun: true });
    expect(report.dryRun).toBe(true);
    expect(report.membersSeen).toBe(3);
    expect(report.groupsSeen).toBe(2);
    expect(report.membershipsSeen).toBe(5);
    expect(await counts(db)).toEqual({ members: 0, groups: 0, memberships: 0 });
  });

  it('apply populates members, groups and memberships deterministically', async () => {
    const db = testDb();
    const report = await runShadowImport(db, fakeSource(), { dryRun: false });
    expect(report.dryRun).toBe(false);
    expect(report.membersWritten).toBe(3);
    expect(report.groupsWritten).toBe(2);
    // 5th row references an unknown group and joins nothing; 4th is malformed.
    expect(report.membershipsWritten).toBe(3);

    const legacy = await db.query<{ legacy_firestore_id: string }>(
      `SELECT legacy_firestore_id FROM groups ORDER BY legacy_firestore_id`,
    );
    expect(legacy.rows.map((r) => r.legacy_firestore_id)).toEqual(['g1', 'g2']);
  });

  it('is idempotent: a second apply changes nothing', async () => {
    const db = testDb();
    await runShadowImport(db, fakeSource(), { dryRun: false });
    const before = await counts(db);
    const report = await runShadowImport(db, fakeSource(), { dryRun: false });
    expect(await counts(db)).toEqual(before);
    expect(report.membersWritten).toBe(before.members);
    expect(report.groupsWritten).toBe(before.groups);
    expect(report.membershipsWritten).toBe(before.memberships);
  });
});
