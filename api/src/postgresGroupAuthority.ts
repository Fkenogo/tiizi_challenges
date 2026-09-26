import { randomBytes } from 'node:crypto';
import type { Db } from './db.js';
import type { GroupMembershipAuthority, GroupMembershipAuthorityStatus } from './groupMembershipAuthority.js';
import type { ChallengeCreationAuthority, ChallengeCreationAuthorityStatus } from './challengeCreationAuthority.js';
import type { CreateGroupTerms, GroupMutationActor } from './groupMutations.js';
import { GroupMutationError } from './groupErrors.js';

const eligible = new Set(['active', 'joined']);
const active = (status: string) => status === 'active';
function fail(code: string, message: string, status = 422): never { throw new GroupMutationError(status, code, message); }
function inviteCode(name: string) { const base = name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '-').replace(/-+/g, '-').slice(0, 12) || 'GROUP'; return `${base}-${randomBytes(3).toString('hex').toUpperCase()}`; }

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
    const result = await db.query<{ status: string; allow_member_challenges: boolean; role: string | null; membership_status: string | null }>(
      `SELECT g.status, g.allow_member_challenges, gm.role, gm.status AS membership_status
       FROM groups g LEFT JOIN group_memberships gm ON gm.group_id=g.group_id AND gm.member_id=$2
       WHERE g.group_id=$1`, [groupId, memberId]);
    const row = result.rows[0]; if (!row) return null;
    const role = row.role?.toLowerCase() ?? null;
    const memberStatus = row.membership_status;
    let reason: ChallengeCreationAuthorityStatus['reason'] = null;
    if (row.status !== 'active') reason = 'group_inactive';
    else if (!memberStatus || !eligible.has(memberStatus.toLowerCase())) reason = memberStatus ? 'membership_inactive' : 'no_membership';
    else if (!row.allow_member_challenges && role !== 'owner' && role !== 'admin') reason = 'charter_restricted';
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
  const code = inviteCode(name);
  try {
    return await db.transaction(async tx => {
      const result = await tx.query<{ group_id: string }>(
        `INSERT INTO groups (name, description, is_private, status, require_admin_approval, allow_member_challenges, steward_member_id, invite_code, cover_id, tagline, location, focus_tags, rules, created_at, updated_at)
         VALUES ($1,$2,$3,'active',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13) RETURNING group_id`,
        [name, typeof terms.description==='string'?terms.description:'', terms.isPrivate===true, terms.requireAdminApproval===true, terms.allowMemberChallenges!==false, actor.memberId, code, typeof terms.coverId==='string'?terms.coverId:null, typeof terms.tagline==='string'?terms.tagline.trim():'', typeof terms.location==='string'?terms.location.trim():'', Array.isArray(terms.focusTags)?terms.focusTags:[], Array.isArray(terms.rules)?terms.rules:[], now]);
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
