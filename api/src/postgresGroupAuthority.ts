import { randomBytes } from 'node:crypto';
import type { Db } from './db.js';
import type { GroupMembershipAuthority, GroupMembershipAuthorityStatus } from './groupMembershipAuthority.js';
import type { ChallengeCreationAuthority, ChallengeCreationAuthorityStatus } from './challengeCreationAuthority.js';
import type { CreateGroupTerms, GroupMutationActor } from './groupMutations.js';
import { GroupMutationError } from './groupErrors.js';

const eligible = new Set(['active', 'joined']);
const active = (status: string) => status === 'active';
function fail(code: string, message: string, status = 422): never { throw new GroupMutationError(status, code, message); }
const INVITE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Human-enterable TIZI-XXXX-XXXX-XXXX code: 12 uniform Crockford Base32
 * symbols provide 60 bits of cryptographic entropy. */
export function generateGroupInviteCode(): string {
  let bits = randomBytes(8).readBigUInt64BE() >> 4n;
  const symbols = Array.from({ length: 12 }, () => {
    const symbol = INVITE_ALPHABET[Number(bits & 31n)];
    bits >>= 5n;
    return symbol;
  }).reverse();
  return `TIZI-${symbols.slice(0, 4).join('')}-${symbols.slice(4, 8).join('')}-${symbols.slice(8).join('')}`;
}

export function normalizeGroupInviteCode(input: string): string | null {
  const compact = input.trim().toUpperCase().replace(/[\s-]/g, '');
  if (!/^TIZI[0-9A-HJKMNP-TV-Z]{12}$/.test(compact)) return null;
  return `TIZI-${compact.slice(4, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}`;
}

/** Update only the bounded S4d settings allowlist under PostgreSQL authority. */
export async function updateGovernedGroupSettings(db: Db, memberId: string, groupId: string, patch: Record<string, unknown>) {
  const columns: Record<string, string> = {
    name: 'name', description: 'description', tagline: 'tagline', location: 'location',
    focusTags: 'focus_tags', coverId: 'cover_id', isPrivate: 'is_private',
    requireAdminApproval: 'require_admin_approval', allowMemberChallenges: 'allow_member_challenges',
  };
  const covers = new Set(['cover-1','cover-2','cover-3','cover-4','cover-5','cover-6','cover-7','cover-8']);
  try {
    return await db.transaction(async tx => {
      const locked = await tx.query<{ status: string; steward_member_id: string; invite_code: string | null }>(
        `SELECT status, steward_member_id, invite_code FROM groups WHERE group_id=$1 FOR UPDATE`, [groupId]);
      const group = locked.rows[0];
      if (!group || group.status !== 'active') fail('group_not_found','Group not found',404);
      if (group.steward_member_id !== memberId) fail('forbidden','Only the Accountable Steward may update Group settings',403);
      if ('name' in patch && (typeof patch.name !== 'string' || !patch.name.trim() || patch.name.trim().length > 200)) fail('invalid_group','name must contain 1..200 characters',400);
      if ('description' in patch && (typeof patch.description !== 'string' || patch.description.length > 2000)) fail('invalid_group','description must be a string up to 2000 characters',400);
      if ('tagline' in patch && (typeof patch.tagline !== 'string' || patch.tagline.trim().length > 140)) fail('invalid_group','tagline must be a string up to 140 characters',400);
      if ('location' in patch && (typeof patch.location !== 'string' || patch.location.trim().length > 120)) fail('invalid_group','location must be a string up to 120 characters',400);
      if ('focusTags' in patch && (!Array.isArray(patch.focusTags) || patch.focusTags.length > 8 || patch.focusTags.some(value => typeof value !== 'string' || value.length > 30))) fail('invalid_group','focusTags must contain at most 8 strings of at most 30 characters',400);
      if ('coverId' in patch && patch.coverId !== null && (typeof patch.coverId !== 'string' || !covers.has(patch.coverId))) fail('invalid_group','coverId must be a curated catalogue key',400);
      for (const field of ['isPrivate','requireAdminApproval','allowMemberChallenges'] as const) if (field in patch && typeof patch[field] !== 'boolean') fail('invalid_group',`${field} must be boolean`,400);
      const normalized: Record<string, unknown> = { ...patch };
      if ('name' in patch) normalized.name = (patch.name as string).trim();
      if ('tagline' in patch) normalized.tagline = (patch.tagline as string).trim();
      if ('location' in patch) normalized.location = (patch.location as string).trim();
      const assignments: string[] = [];
      const values: unknown[] = [];
      for (const [field, column] of Object.entries(columns)) if (field in normalized) {
        values.push(normalized[field]); assignments.push(`${column}=$${values.length}`);
      }
      values.push(new Date().toISOString()); assignments.push(`updated_at=$${values.length}`);
      values.push(groupId);
      await tx.query(`UPDATE groups SET ${assignments.join(',')} WHERE group_id=$${values.length}`, values);
      const result = await tx.query<Record<string, unknown>>(
        `SELECT group_id AS id, name, COALESCE(description,'') AS description, is_private AS "isPrivate",
          require_admin_approval AS "requireAdminApproval", allow_member_challenges AS "allowMemberChallenges",
          cover_id AS "coverId", COALESCE(tagline,'') AS tagline, COALESCE(location,'') AS location,
          COALESCE(focus_tags,ARRAY[]::text[]) AS "focusTags", status, steward_member_id AS "stewardMemberId",
          invite_code AS "inviteCode", created_at AS "createdAt", updated_at AS "updatedAt"
         FROM groups WHERE group_id=$1`, [groupId]);
      return result.rows[0];
    });
  } catch (error) {
    if (error instanceof GroupMutationError) throw error;
    throw new GroupMutationError(503,'group_store_unavailable','PostgreSQL Group settings authority unavailable');
  }
}

export function createPostgresGroupMembershipAuthority(db: Db): GroupMembershipAuthority {
  return { async resolveGroupMembershipAuthority(groupId, memberId): Promise<GroupMembershipAuthorityStatus | null> {
    const result = await db.query<{ group_status: string; membership_status: string | null }>(
      `SELECT g.status AS group_status, gm.status AS membership_status
       FROM groups g LEFT JOIN group_memberships gm
         ON gm.group_id=g.group_id AND gm.member_id=$2
       WHERE g.group_id=$1`, [groupId, memberId]);
    const row = result.rows[0]; if (!row) return null;
    const status = row.membership_status ?? 'none';
    return { status, eligible: row.group_status === 'active' && eligible.has(status) };
  } };
}

export function createPostgresChallengeCreationAuthority(db: Db): ChallengeCreationAuthority {
  return { async resolveChallengeCreationAuthority(groupId, memberId): Promise<ChallengeCreationAuthorityStatus | null> {
    const result = await db.query<{ status: string; allow_member_challenges: boolean; role: string | null; membership_status: string | null; is_steward: boolean }>(
      `SELECT g.status, g.allow_member_challenges, gm.role, gm.status AS membership_status,
              (g.steward_member_id=$2) AS is_steward
       FROM groups g LEFT JOIN group_memberships gm ON gm.group_id=g.group_id AND gm.member_id=$2
       WHERE g.group_id=$1`, [groupId, memberId]);
    const row = result.rows[0]; if (!row) return null;
    const role = row.role?.toLowerCase() ?? null;
    const memberStatus = row.membership_status;
    let reason: ChallengeCreationAuthorityStatus['reason'] = null;
    if (row.status !== 'active') reason = 'group_inactive';
    else if (!memberStatus || !eligible.has(memberStatus.toLowerCase())) reason = memberStatus ? 'membership_inactive' : 'no_membership';
    else if (!row.allow_member_challenges && !row.is_steward) reason = 'charter_restricted';
    return { permitted: reason === null, reason, groupStatus: row.status, allowMemberChallenges: row.allow_member_challenges, memberRole: role, memberStatus };
  } };
}

export async function createGovernedGroup(db: Db, actor: GroupMutationActor, terms: CreateGroupTerms) {
  if (typeof terms.name !== 'string' || !terms.name.trim() || terms.name.trim().length > 200) fail('invalid_group','name is required (1..200 chars)',400);
  const name = (terms.name as string).trim();
  if (terms.description !== undefined && (typeof terms.description !== 'string' || terms.description.length > 2000)) fail('invalid_group','description must be a string up to 2000 chars when present',400);
  const covers=['cover-1','cover-2','cover-3','cover-4','cover-5','cover-6','cover-7','cover-8'];
  if (terms.coverId !== undefined && (typeof terms.coverId !== 'string' || !covers.includes(terms.coverId))) fail('invalid_group','coverId must be a curated catalogue key',400);
  for(const [field,max] of [['tagline',140],['location',120]] as const) if(terms[field]!==undefined && (typeof terms[field]!=='string'||terms[field].length>max)) fail('invalid_group',`${field} must be a string up to ${max} chars`,400);
  for(const [field,maxCount,maxLen] of [['focusTags',8,30],['rules',5,200]] as const){const v=terms[field];if(v!==undefined&&(!Array.isArray(v)||v.length>maxCount||v.some(x=>typeof x!=='string'||x.length>maxLen)))fail('invalid_group',`${field} contains invalid values`,400);}
  const now = new Date().toISOString();
  try {
    return await db.transaction(async tx => {
      let result: { rows: Array<{ group_id: string }> } = { rows: [] };
      // A collision is cryptographically unlikely, but the unique normalized
      // index remains the final arbiter. Retry only that insertion collision.
      for (let attempt = 0; attempt < 4 && result.rows.length === 0; attempt += 1) {
        const code = generateGroupInviteCode();
        result = await tx.query<{ group_id: string }>(
          `INSERT INTO groups (name, description, is_private, status, require_admin_approval, allow_member_challenges, steward_member_id, invite_code, cover_id, tagline, location, focus_tags, rules, created_at, updated_at)
           VALUES ($1,$2,$3,'active',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13)
           ON CONFLICT ((upper(btrim(invite_code)))) WHERE invite_code IS NOT NULL DO NOTHING
           RETURNING group_id`,
          [name, typeof terms.description==='string'?terms.description:'', terms.isPrivate===true, terms.requireAdminApproval===true, terms.allowMemberChallenges!==false, actor.memberId, code, typeof terms.coverId==='string'?terms.coverId:null, typeof terms.tagline==='string'?terms.tagline.trim():'', typeof terms.location==='string'?terms.location.trim():'', Array.isArray(terms.focusTags)?terms.focusTags:[], Array.isArray(terms.rules)?terms.rules:[], now]);
      }
      if (result.rows.length === 0) throw new Error('Unable to allocate a unique Group invite code');
      const id = result.rows[0].group_id;
      await tx.query(`INSERT INTO group_memberships(group_id,member_id,role,status,joined_at,created_at,updated_at,requested_at,approved_at,approved_by_member_id) VALUES($1,$2,'owner','active',$3,$3,$3,$3,$3,$2)`, [id, actor.memberId, now]);
      return { id: String(id), legacyId: String(id), name, isPrivate: terms.isPrivate===true, role:'owner', status:'active' };
    });
  } catch (error) { if (error instanceof GroupMutationError) throw error; throw new GroupMutationError(503,'group_store_unavailable','PostgreSQL Group authority unavailable during creation'); }
}

export async function joinGovernedGroup(db: Db, actor: GroupMutationActor, groupId: string) {
  try { return await db.transaction(async tx => {
    const result = await tx.query<{status:string;is_private:boolean;require_admin_approval:boolean;steward_member_id:string|null}>(`SELECT status,is_private,require_admin_approval,steward_member_id FROM groups WHERE group_id=$1 FOR UPDATE`,[groupId]);
    const group=result.rows[0]; if(!group) fail('unknown_group','Group not found',404); if(group.status!=='active') fail('group_inactive','This group is no longer active and cannot be joined');
    const prior=await tx.query<{status:string;role:string}>(`SELECT status,role FROM group_memberships WHERE group_id=$1 AND member_id=$2 FOR UPDATE`,[groupId,actor.memberId]);
    const existing=prior.rows[0]; if(existing && eligible.has(existing.status)) return {id:groupId,legacyId:groupId,status:'joined' as const,role:existing.role};
    if(existing?.status==='pending') return {id:groupId,legacyId:groupId,status:'pending' as const,role:existing.role};
    const needsApproval=group.is_private||group.require_admin_approval; const status=needsApproval?'pending':'active'; const now=new Date().toISOString();
    await tx.query(`INSERT INTO group_memberships(group_id,member_id,role,status,joined_at,created_at,updated_at,requested_at,approved_at)
      VALUES($1,$2,'member',$3,$4,$4,$4,$4,CASE WHEN $3='active' THEN $4::timestamptz ELSE NULL END)
      ON CONFLICT(group_id,member_id) DO UPDATE SET role='member',status=EXCLUDED.status,joined_at=CASE WHEN EXCLUDED.status='active' THEN EXCLUDED.joined_at ELSE group_memberships.joined_at END,requested_at=EXCLUDED.requested_at,approved_at=EXCLUDED.approved_at,approved_by_member_id=NULL,rejected_at=NULL,rejected_by_member_id=NULL,left_at=NULL`,[groupId,actor.memberId,status,now]);
    return {id:groupId,legacyId:groupId,status:status==='active'?'joined' as const:'pending' as const,role:'member'};
  }); } catch(error) { if(error instanceof GroupMutationError) throw error; throw new GroupMutationError(503,'group_store_unavailable','PostgreSQL Group authority unavailable during join'); }
}

export async function leaveGovernedGroup(db: Db, actor: GroupMutationActor, groupId: string) {
  try { return await db.transaction(async tx => {
    const group=await tx.query<{steward_member_id:string|null}>(`SELECT steward_member_id FROM groups WHERE group_id=$1 FOR UPDATE`,[groupId]);
    if(!group.rows[0]) fail('unknown_group','Group not found',404);
    if(group.rows[0].steward_member_id===actor.memberId) fail('owner_cannot_leave','The Accountable Steward cannot leave while responsible for this Group.',403);
    const current=await tx.query<{status:string}>(`SELECT status FROM group_memberships WHERE group_id=$1 AND member_id=$2 FOR UPDATE`,[groupId,actor.memberId]);
    if(!current.rows[0]||!eligible.has(current.rows[0].status)) return {id:groupId,legacyId:groupId,status:'none' as const};
    await tx.query(`UPDATE group_memberships SET status='left',left_at=now() WHERE group_id=$1 AND member_id=$2`,[groupId,actor.memberId]);
    return {id:groupId,legacyId:groupId,status:'left' as const};
  }); } catch(error) { if(error instanceof GroupMutationError) throw error; throw new GroupMutationError(503,'group_store_unavailable','PostgreSQL Group authority unavailable during leave'); }
}

export async function reviewPendingMembership(
  db: Db,
  actorMemberId: string,
  groupId: string,
  targetMemberId: string,
  decision: 'approve' | 'reject',
) {
  try {
    return await db.transaction(async (tx) => {
      const groupResult = await tx.query<{ status: string; steward_member_id: string | null }>(
        `SELECT status, steward_member_id FROM groups WHERE group_id=$1 FOR UPDATE`, [groupId],
      );
      const group = groupResult.rows[0];
      if (!group || group.status !== 'active') fail('unknown_group', 'Group not found', 404);
      if (group.steward_member_id !== actorMemberId) fail('steward_required', 'Only the Accountable Steward may review admission requests', 403);

      const currentResult = await tx.query<{ status: string; approved_by_member_id: string | null; rejected_by_member_id: string | null }>(
        `SELECT status, approved_by_member_id, rejected_by_member_id
         FROM group_memberships WHERE group_id=$1 AND member_id=$2 FOR UPDATE`,
        [groupId, targetMemberId],
      );
      const current = currentResult.rows[0];
      if (!current) fail('application_not_found', 'Pending application not found', 404);
      const target = decision === 'approve' ? 'active' : 'rejected';
      if (current.status === target && (decision === 'approve' ? current.approved_by_member_id : current.rejected_by_member_id) === actorMemberId) {
        return { groupId, memberId: targetMemberId, status: target, idempotent: true };
      }
      if (current.status !== 'pending') fail('application_not_pending', 'Pending application not found', 404);
      if (decision === 'approve') {
        await tx.query(
          `UPDATE group_memberships SET status='active', role='member', joined_at=now(),
           approved_at=now(), approved_by_member_id=$3, rejected_at=NULL, rejected_by_member_id=NULL, left_at=NULL
           WHERE group_id=$1 AND member_id=$2 AND status='pending'`,
          [groupId, targetMemberId, actorMemberId],
        );
      } else {
        await tx.query(
          `UPDATE group_memberships SET status='rejected', approved_at=NULL, approved_by_member_id=NULL,
           rejected_at=now(), rejected_by_member_id=$3
           WHERE group_id=$1 AND member_id=$2 AND status='pending'`,
          [groupId, targetMemberId, actorMemberId],
        );
      }
      return { groupId, memberId: targetMemberId, status: target, idempotent: false };
    });
  } catch (error) {
    if (error instanceof GroupMutationError) throw error;
    throw new GroupMutationError(503, 'group_store_unavailable', 'PostgreSQL Group authority unavailable during admission review');
  }
}
