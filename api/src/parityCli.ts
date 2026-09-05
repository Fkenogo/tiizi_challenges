import 'dotenv/config';
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createPool, databaseUrl, type Db } from './db.js';
import {
  compareMembershipParity,
  parityMatches,
  type ParityDifference,
  type ParitySide,
} from './parity.js';

interface PgMembershipRow {
  auth_subject: string;
  legacy_firestore_id: string;
  role: string;
  status: string;
}

/**
 * Read-only parity check: compares Firestore group memberships against the
 * PostgreSQL shadow per Firebase UID. Writes nothing on either side and
 * never switches authority.
 */
export async function runParityCheck(db: Db): Promise<{
  usersCompared: number;
  firestoreMemberships: number;
  apiMemberships: number;
  differences: ParityDifference[];
}> {
  const fs = getFirestore();
  const [fsMembersSnap, pgRows] = await Promise.all([
    fs.collection('groupMembers').get(),
    db.query<PgMembershipRow>(
      `SELECT m.auth_subject, g.legacy_firestore_id, gm.role, gm.status
       FROM group_memberships gm
       JOIN members m ON m.member_id = gm.member_id
       JOIN groups g ON g.group_id = gm.group_id
       WHERE m.auth_provider = 'firebase'`,
    ),
  ]);

  const byUser = new Map<string, { firestore: ParitySide[]; api: ParitySide[] }>();
  const get = (uid: string) => {
    let entry = byUser.get(uid);
    if (!entry) {
      entry = { firestore: [], api: [] };
      byUser.set(uid, entry);
    }
    return entry;
  };

  let firestoreMemberships = 0;
  for (const doc of fsMembersSnap.docs) {
    const data = doc.data() as Record<string, unknown>;
    const uid = typeof data.userId === 'string' ? data.userId : '';
    const groupId = typeof data.groupId === 'string' ? data.groupId : '';
    if (!uid || !groupId) continue;
    get(uid).firestore.push({
      groupKey: groupId,
      role: typeof data.role === 'string' ? data.role : 'member',
      status: typeof data.status === 'string' ? data.status : 'active',
    });
    firestoreMemberships += 1;
  }
  for (const row of pgRows.rows) {
    if (!row.legacy_firestore_id) continue;
    get(row.auth_subject).api.push({
      groupKey: row.legacy_firestore_id,
      role: row.role,
      status: row.status,
    });
  }

  const differences: ParityDifference[] = [];
  for (const [uid, sides] of byUser) {
    differences.push(...compareMembershipParity(uid, sides.firestore, sides.api));
  }
  return {
    usersCompared: byUser.size,
    firestoreMemberships,
    apiMemberships: pgRows.rows.length,
    differences,
  };
}

async function main(): Promise<void> {
  if (getApps().length === 0) {
    initializeApp({ credential: applicationDefault() });
  }
  const db = createPool(databaseUrl());
  try {
    const report = await runParityCheck(db);
    console.log(
      JSON.stringify({ ...report, match: parityMatches(report) }, null, 2),
    );
    if (!parityMatches(report)) process.exitCode = 1;
  } finally {
    await db.close();
  }
}

const invokedAsCli =
  process.argv[1]?.endsWith('parityCli.ts') || process.argv[1]?.endsWith('parityCli.js');
if (invokedAsCli) void main();
