import type { Db } from './db.js';

export interface SourceGroup {
  firestoreId: string;
  name: string;
  description?: string;
  isPrivate?: boolean;
  status?: string;
}

export interface SourceMembership {
  firestoreId: string;
  groupFirestoreId: string;
  userId: string;
  role?: string;
  status?: string;
  joinedAt?: string;
}

export interface FirestoreSource {
  listGroups(): Promise<SourceGroup[]>;
  listGroupMembers(): Promise<SourceMembership[]>;
}

export interface ShadowImportReport {
  dryRun: boolean;
  membersSeen: number;
  membersWritten: number;
  groupsSeen: number;
  groupsWritten: number;
  membershipsSeen: number;
  membershipsWritten: number;
}

const VALID_ROLES = new Set(['owner', 'admin', 'member']);
const VALID_STATUSES = new Set(['joined', 'active', 'pending', 'rejected', 'left']);

function normalizeRole(role: string | undefined): string {
  return role && VALID_ROLES.has(role) ? role : 'member';
}

function normalizeStatus(status: string | undefined): string {
  return status && VALID_STATUSES.has(status) ? status : 'active';
}

export async function runShadowImport(
  db: Db,
  source: FirestoreSource,
  options: { dryRun: boolean },
): Promise<ShadowImportReport> {
  const [groups, memberships] = await Promise.all([
    source.listGroups(),
    source.listGroupMembers(),
  ]);

  const memberSubjects = new Map<string, void>();
  for (const m of memberships) {
    if (m.userId) memberSubjects.set(m.userId);
  }

  const report: ShadowImportReport = {
    dryRun: options.dryRun,
    membersSeen: memberSubjects.size,
    membersWritten: 0,
    groupsSeen: groups.length,
    groupsWritten: 0,
    membershipsSeen: memberships.length,
    membershipsWritten: 0,
  };

  if (options.dryRun) return report;

  await db.transaction(async (tx) => {
    // Written counts are recounted deterministically after commit (see below),
    // keeping the Db seam minimal (no driver rowCount leakage).
    for (const subject of memberSubjects.keys()) {
      await tx.query(
        `INSERT INTO members (auth_provider, auth_subject)
         VALUES ('firebase', $1)
         ON CONFLICT (auth_provider, auth_subject) DO NOTHING`,
        [subject],
      );
    }
    for (const group of groups) {
      await tx.query(
        `INSERT INTO groups (legacy_firestore_id, name, description, is_private, status)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (legacy_firestore_id) DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           is_private = EXCLUDED.is_private,
           status = EXCLUDED.status,
           updated_at = now()`,
        [
          group.firestoreId,
          group.name,
          group.description ?? '',
          group.isPrivate ?? false,
          group.status ?? 'active',
        ],
      );
    }
    for (const membership of memberships) {
      if (!membership.userId || !membership.groupFirestoreId) continue;
      await tx.query(
        `INSERT INTO group_memberships (group_id, member_id, role, status, joined_at)
         SELECT g.group_id, m.member_id, $3, $4, $5
         FROM groups g, members m
         WHERE g.legacy_firestore_id = $1
           AND m.auth_provider = 'firebase' AND m.auth_subject = $2
         ON CONFLICT (group_id, member_id) DO UPDATE SET
           role = EXCLUDED.role,
           status = EXCLUDED.status,
           joined_at = EXCLUDED.joined_at,
           updated_at = now()`,
        [
          membership.groupFirestoreId,
          membership.userId,
          normalizeRole(membership.role),
          normalizeStatus(membership.status),
          membership.joinedAt ?? new Date().toISOString(),
        ],
      );
    }
  });

  const counts = await db.query<{ count: string }>(
    `SELECT (SELECT COUNT(*) FROM members WHERE auth_provider = 'firebase') AS count`,
  );
  report.membersWritten = Number(counts.rows[0].count);
  const groupCounts = await db.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM groups WHERE legacy_firestore_id IS NOT NULL`,
  );
  report.groupsWritten = Number(groupCounts.rows[0].count);
  const membershipCounts = await db.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM group_memberships`,
  );
  report.membershipsWritten = Number(membershipCounts.rows[0].count);
  return report;
}

/** Production Firestore reader. Read-only: get() calls only, never writes. */
export function createAdminFirestoreSource(): FirestoreSource {
  return {
    async listGroups(): Promise<SourceGroup[]> {
      const { getFirestore } = await import('firebase-admin/firestore');
      const snap = await getFirestore().collection('groups').get();
      return snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          firestoreId: d.id,
          name: String(data.name ?? d.id),
          description: typeof data.description === 'string' ? data.description : '',
          isPrivate: data.isPrivate === true,
          status: typeof data.status === 'string' ? data.status : 'active',
        };
      });
    },
    async listGroupMembers(): Promise<SourceMembership[]> {
      const { getFirestore } = await import('firebase-admin/firestore');
      const snap = await getFirestore().collection('groupMembers').get();
      return snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          firestoreId: d.id,
          groupFirestoreId: typeof data.groupId === 'string' ? data.groupId : '',
          userId: typeof data.userId === 'string' ? data.userId : '',
          role: typeof data.role === 'string' ? data.role : undefined,
          status: typeof data.status === 'string' ? data.status : undefined,
          joinedAt:
            typeof data.createdAt === 'string'
              ? data.createdAt
              : typeof data.approvedAt === 'string'
                ? data.approvedAt
                : undefined,
        };
      });
    },
  };
}
