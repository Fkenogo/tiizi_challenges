import type { Db } from './db.js';
import type { GroupReadStore } from './groupReads.js';

/** Read projection adapter for the stable S4a/S4b response contracts. The
 * UUID remains the domain key; legacy Firestore ids are never consulted. */
export function createPostgresGroupReadStore(db: Db): GroupReadStore {
  const resolveId = async (id: string) => {
    const result = await db.query<{ group_id: string }>(`SELECT group_id FROM groups WHERE group_id::text=$1 OR legacy_firestore_id=$1`, [id]);
    return result.rows[0]?.group_id ?? null;
  };
  return {
    async getGroup(id) {
      const uuid = await resolveId(id); if (!uuid) return null;
      const result = await db.query<Record<string, unknown>>(
        `SELECT g.*, owner.auth_subject AS owner_uid,
          (SELECT count(*)::int FROM group_memberships gm WHERE gm.group_id=g.group_id AND gm.status IN ('active','joined')) AS member_count
         FROM groups g LEFT JOIN members owner ON owner.member_id=g.steward_member_id WHERE g.group_id=$1`, [uuid]);
      const row = result.rows[0]; if (!row) return null;
      return { name: row.name, description: row.description, ownerId: row.owner_uid,
        isPrivate: row.is_private, requireAdminApproval: row.require_admin_approval,
        allowMemberChallenges: row.allow_member_challenges, status: row.status,
        memberCount: Number(row.member_count), createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
        coverId: row.cover_id, tagline: row.tagline, location: row.location,
        focusTags: row.focus_tags, rules: row.rules };
    },
    async getMembership(id, firebaseUid) {
      const uuid = await resolveId(id); if (!uuid) return null;
      const result = await db.query<Record<string, unknown>>(
        `SELECT gm.*, m.auth_subject AS user_id FROM group_memberships gm JOIN members m ON m.member_id=gm.member_id
         WHERE gm.group_id=$1 AND m.auth_provider='firebase' AND m.auth_subject=$2`, [uuid, firebaseUid]);
      const row=result.rows[0]; return row ? {userId:row.user_id, status:row.status, role:row.role,
        createdAt:row.joined_at instanceof Date?row.joined_at.toISOString():String(row.joined_at),
        approvedAt:row.approved_at?String(row.approved_at):undefined} : null;
    },
    async listMemberships(id) {
      const uuid=await resolveId(id); if(!uuid) return [];
      const result=await db.query<Record<string,unknown>>(
        `SELECT gm.*,m.auth_subject AS user_id FROM group_memberships gm JOIN members m ON m.member_id=gm.member_id
         WHERE gm.group_id=$1 AND m.auth_provider='firebase'`,[uuid]);
      return result.rows.map(row=>({userId:row.user_id,status:row.status,role:row.role,
        createdAt:row.joined_at instanceof Date?row.joined_at.toISOString():String(row.joined_at),
        approvedAt:row.approved_at?String(row.approved_at):undefined}));
    },
  };
}
