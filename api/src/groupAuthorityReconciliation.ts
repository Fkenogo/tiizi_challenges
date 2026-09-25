import type { Db } from './db.js';

export interface ReconciliationSource { listGroups():Promise<Array<{id:string;data:Record<string,unknown>}>>; listMemberships():Promise<Array<{id:string;data:Record<string,unknown>}>> }
export interface GroupAuthorityReport {
  mode:'dry-run'; safeToApply:boolean; groups:{total:number;matched:number;firestoreOnly:string[];postgresOnly:string[];duplicateMappings:string[];duplicateInviteCodes:string[];missingLegacyIds:string[];invalidStates:string[];ownerMappingFailures:string[];multipleOrNoOwnerConflicts:string[];fieldDifferences:Array<{legacyId:string;field:string;firestore:unknown;postgres:unknown}>};
  memberships:{firestoreTotal:number;postgresTotal:number;matched:number;postgresOnly:string[];missingMemberMappings:string[];reviewerMappingFailures:string[];orphanGroups:string[];duplicates:string[];statusDifferences:string[];timestampDifferences:string[];roleDifferences:string[];unsupported:string[]};
  challengeReferences:{total:number;unreconciled:string[]};
}
const val=(data:Record<string,unknown>,key:string, fallback:unknown=null)=>data[key]===undefined?fallback:data[key];
const normalizeStatus=(v:unknown)=>String(v??'active').toLowerCase();
const effectiveGroupStatus=(d:Record<string,unknown>)=>normalizeStatus(d.status)==='active'&&String(d.moderationStatus??'active').toLowerCase()==='deactivated'?'inactive':normalizeStatus(d.status);
const timestamp=(v:unknown):string|null=>{try{if(v instanceof Date)return v.toISOString();if(v&&typeof v==='object'&&'toDate'in v&&typeof (v as {toDate:unknown}).toDate==='function')return ((v as {toDate:()=>Date}).toDate()).toISOString();if(typeof v==='string'&&v)return new Date(v).toISOString();return null;}catch{return null;}};

export async function reconcileGroupAuthority(db:Db, source:ReconciliationSource):Promise<GroupAuthorityReport> {
  const [fsGroups,fsMembers,pgGroups,pgMembers,challengeRows]=await Promise.all([
    source.listGroups(),source.listMemberships(),
    db.query<Record<string,unknown>>(`SELECT * FROM groups`),
    db.query<Record<string,unknown>>(`SELECT gm.*,g.legacy_firestore_id,m.auth_subject FROM group_memberships gm JOIN groups g USING(group_id) JOIN members m USING(member_id) WHERE m.auth_provider='firebase'`),
    db.query<{group_id:string}>(`SELECT DISTINCT group_id FROM challenges`),
  ]);
  const byLegacy=new Map<string,Record<string,unknown>[]>(); for(const row of pgGroups.rows){const k=String(row.legacy_firestore_id??'');if(k){const a=byLegacy.get(k)??[];a.push(row);byLegacy.set(k,a);}}
  const fsg=new Map(fsGroups.map(x=>[x.id,x]));
  const inviteCodes=new Map<string,string[]>();for(const g of fsGroups){const code=typeof g.data.inviteCode==='string'?g.data.inviteCode.trim().toUpperCase():'';if(code){const ids=inviteCodes.get(code)??[];ids.push(g.id);inviteCodes.set(code,ids);}}
  const duplicateInviteCodes=[...inviteCodes].filter(([,ids])=>ids.length>1).map(([code])=>code);
  const missingLegacyIds=pgGroups.rows.filter(r=>!r.legacy_firestore_id).map(r=>String(r.group_id));
  const duplicateMappings=[...byLegacy].filter(([,v])=>v.length>1).map(([k])=>k);
  const firestoreOnly:string[]=[],matchedIds=new Set<string>(),invalidStates:string[]=[],ownerMappingFailures:string[]=[],multipleOrNoOwnerConflicts:string[]=[],fieldDifferences:GroupAuthorityReport['groups']['fieldDifferences']=[];
  for(const item of fsGroups){const rows=byLegacy.get(item.id)??[];
    const status=effectiveGroupStatus(item.data);if(!['active','inactive'].includes(status)) invalidStates.push(`${item.id}:${status}`);
    const ownerUid=typeof item.data.ownerId==='string'?item.data.ownerId:null;
    const member=ownerUid?await db.query<{member_id:string}>(`SELECT member_id FROM members WHERE auth_provider='firebase' AND auth_subject=$1`,[ownerUid]):{rows:[] as Array<{member_id:string}>};
    if(!ownerUid||!member.rows[0])ownerMappingFailures.push(item.id);
    const ownerMemberships=fsMembers.filter(m=>m.data.groupId===item.id && m.data.role==='owner' && ['active','joined'].includes(normalizeStatus(m.data.status)));
    if(ownerMemberships.length!==1||!ownerUid||ownerMemberships[0]?.data.userId!==ownerUid)multipleOrNoOwnerConflicts.push(`${item.id}:${ownerMemberships.length===0?'no-owner':'multiple-or-mismatched-owner'}`);
    if(!rows.length){firestoreOnly.push(item.id);continue;} if(rows.length!==1)continue; const pg=rows[0];matchedIds.add(String(pg.group_id));
    if(effectiveGroupStatus(item.data)!==normalizeStatus(pg.status))fieldDifferences.push({legacyId:item.id,field:'status/liveness',firestore:effectiveGroupStatus(item.data),postgres:pg.status});
    for(const [f,p] of [['name','name'],['description','description'],['isPrivate','is_private'],['requireAdminApproval','require_admin_approval'],['allowMemberChallenges','allow_member_challenges'],['inviteCode','invite_code'],['coverId','cover_id'],['tagline','tagline'],['location','location'],['focusTags','focus_tags'],['rules','rules']] as const){
      const fire=val(item.data,f, f==='description'?'':f==='isPrivate'?false:f==='requireAdminApproval'?false:f==='allowMemberChallenges'?true:f==='tagline'||f==='location'?'':f==='focusTags'||f==='rules'?[]:null);
      const pgval=pg[p]??(p==='description'?'':p==='is_private'||p==='require_admin_approval'?false:p==='allow_member_challenges'?true:p==='tagline'||p==='location'?'':p==='focus_tags'||p==='rules'?[]:null);
      const left=f==='inviteCode'&&typeof fire==='string'?fire.trim().toUpperCase():fire;const right=f==='inviteCode'&&typeof pgval==='string'?pgval.trim().toUpperCase():pgval;
      if(JSON.stringify(left)!==JSON.stringify(right))fieldDifferences.push({legacyId:item.id,field:f,firestore:fire,postgres:pgval});
    }
    if(member.rows[0]&&String(pg.steward_member_id??'')!==String(member.rows[0].member_id))fieldDifferences.push({legacyId:item.id,field:'stewardMemberId',firestore:ownerUid,postgres:pg.steward_member_id??null});
    for(const [f,p] of [['createdAt','created_at'],['updatedAt','updated_at']] as const){const fire=timestamp(item.data[f]);const pgtime=timestamp(pg[p]);if(fire&&pgtime&&fire!==pgtime)fieldDifferences.push({legacyId:item.id,field:f,firestore:fire,postgres:pgtime});}
  }
  const postgresOnly=pgGroups.rows.filter(r=>r.legacy_firestore_id&&!fsg.has(String(r.legacy_firestore_id))).map(r=>String(r.legacy_firestore_id));
  const pgMembershipKeys=new Set(pgMembers.rows.map(r=>`${r.legacy_firestore_id}\0${r.auth_subject}`));
  const fsKeys=new Set<string>(),duplicates:string[]=[],missingMemberMappings:string[]=[],reviewerMappingFailures:string[]=[],orphanGroups:string[]=[],statusDifferences:string[]=[],timestampDifferences:string[]=[],roleDifferences:string[]=[],unsupported:string[]=[];let matched=0;
  for(const m of fsMembers){const gid=String(m.data.groupId??'');const uid=String(m.data.userId??'');const key=`${gid}\0${uid}`;if(fsKeys.has(key)){duplicates.push(key);continue;}fsKeys.add(key);if(!uid||!gid){unsupported.push(m.id);continue;}if(!['active','joined','pending','rejected','left'].includes(normalizeStatus(m.data.status))||!['owner','admin','member'].includes(String(m.data.role??'member'))||(m.data.approvedAt&&m.data.rejectedAt)||(m.data.approvedBy&&!m.data.approvedAt)||(m.data.rejectedBy&&!m.data.rejectedAt))unsupported.push(m.id);if(!fsg.has(gid)){orphanGroups.push(m.id);continue;}const mapping=await db.query(`SELECT 1 FROM members WHERE auth_provider='firebase' AND auth_subject=$1`,[uid]);if(!mapping.rows.length)missingMemberMappings.push(m.id);for(const field of ['approvedBy','rejectedBy']){const reviewer=m.data[field];if(typeof reviewer==='string'){const found=await db.query(`SELECT 1 FROM members WHERE auth_provider='firebase' AND auth_subject=$1`,[reviewer]);if(!found.rows.length)reviewerMappingFailures.push(`${m.id}:${field}`);}}if(pgMembershipKeys.has(key)){matched++;continue;} }
  const challengeGroups=new Set(challengeRows.rows.map(r=>String(r.group_id)));const reconciledIds=new Set(pgGroups.rows.filter(r=>r.legacy_firestore_id).map(r=>String(r.group_id)));const unreconciled=[...challengeGroups].filter(id=>!reconciledIds.has(id));
  for(const pg of pgMembers.rows){const fs=fsMembers.find(m=>m.data.groupId===pg.legacy_firestore_id&&m.data.userId===pg.auth_subject);if(!fs)continue; if(normalizeStatus(fs.data.status)!==normalizeStatus(pg.status))statusDifferences.push(fs.id); if(String(fs.data.role??'member')!==String(pg.role))roleDifferences.push(fs.id);const fst=timestamp(fs.data.approvedAt??fs.data.createdAt);const pst=timestamp(pg.approved_at??pg.joined_at);if(fst&&pst&&fst!==pst)timestampDifferences.push(fs.id);}
  const postgresOnlyMemberships=pgMembers.rows.filter(r=>!fsKeys.has(`${r.legacy_firestore_id}\0${r.auth_subject}`)).map(r=>`${r.legacy_firestore_id}:${r.auth_subject}`);
  const safeToApply=duplicateMappings.length===0&&duplicateInviteCodes.length===0&&missingLegacyIds.length===0&&postgresOnly.length===0&&postgresOnlyMemberships.length===0&&invalidStates.length===0&&ownerMappingFailures.length===0&&multipleOrNoOwnerConflicts.length===0&&missingMemberMappings.length===0&&reviewerMappingFailures.length===0&&orphanGroups.length===0&&duplicates.length===0&&unsupported.length===0&&unreconciled.length===0;
  return {mode:'dry-run',safeToApply,groups:{total:fsGroups.length,matched:matchedIds.size,firestoreOnly:firestoreOnly.sort(),postgresOnly:postgresOnly.sort(),duplicateMappings,duplicateInviteCodes,missingLegacyIds,invalidStates,ownerMappingFailures,multipleOrNoOwnerConflicts,fieldDifferences},memberships:{firestoreTotal:fsMembers.length,postgresTotal:pgMembers.rows.length,matched,postgresOnly:postgresOnlyMemberships,missingMemberMappings,reviewerMappingFailures,orphanGroups,duplicates,statusDifferences,timestampDifferences,roleDifferences,unsupported},challengeReferences:{total:challengeGroups.size,unreconciled}};
}

/** Explicit, gated, idempotent reconciliation. Never called by API runtime. */
export async function applyGroupAuthorityReconciliation(db:Db,source:ReconciliationSource,report:GroupAuthorityReport):Promise<{groups:number;memberships:number}> {
  if(!report.safeToApply) throw new Error('Group authority reconciliation has unresolved conflicts; apply refused');
  const [groups,memberships]=await Promise.all([source.listGroups(),source.listMemberships()]);let groupCount=0,memberCount=0;
  await db.transaction(async tx=>{
    await tx.query(`SELECT set_config('tiizi.group_reconciliation','on',true)`);
    for(const item of groups){const d=item.data;const ownerUid=typeof d.ownerId==='string'?d.ownerId:null;const owner=ownerUid?await tx.query<{member_id:string}>(`SELECT member_id FROM members WHERE auth_provider='firebase' AND auth_subject=$1`,[ownerUid]):{rows:[] as Array<{member_id:string}>};
      const prior=await tx.query<{group_id:string}>(`SELECT group_id FROM groups WHERE legacy_firestore_id=$1`,[item.id]);
      if(prior.rows[0]){const id=prior.rows[0].group_id;await tx.query(`UPDATE groups SET name=$2,description=$3,is_private=$4,status=$5,require_admin_approval=$6,allow_member_challenges=$7,steward_member_id=$8,invite_code=$9,cover_id=$10,tagline=$11,location=$12,focus_tags=$13,rules=$14,created_at=COALESCE($15,created_at),updated_at=COALESCE($16,updated_at) WHERE group_id=$1`,[id,String(d.name??item.id),String(d.description??''),d.isPrivate===true,effectiveGroupStatus(d),d.requireAdminApproval===true,d.allowMemberChallenges!==false,owner.rows[0]?.member_id??null,typeof d.inviteCode==='string'?d.inviteCode.toUpperCase().trim():null,typeof d.coverId==='string'?d.coverId:null,String(d.tagline??''),String(d.location??''),Array.isArray(d.focusTags)?d.focusTags:[],Array.isArray(d.rules)?d.rules:[],timestamp(d.createdAt),timestamp(d.updatedAt)]);}
      else {await tx.query(`INSERT INTO groups(legacy_firestore_id,name,description,is_private,status,require_admin_approval,allow_member_challenges,steward_member_id,invite_code,cover_id,tagline,location,focus_tags,rules,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,COALESCE($15,now()),COALESCE($16,now()))`,[item.id,String(d.name??item.id),String(d.description??''),d.isPrivate===true,effectiveGroupStatus(d),d.requireAdminApproval===true,d.allowMemberChallenges!==false,owner.rows[0]?.member_id??null,typeof d.inviteCode==='string'?d.inviteCode.toUpperCase().trim():null,typeof d.coverId==='string'?d.coverId:null,String(d.tagline??''),String(d.location??''),Array.isArray(d.focusTags)?d.focusTags:[],Array.isArray(d.rules)?d.rules:[],timestamp(d.createdAt),timestamp(d.updatedAt)]);} groupCount++;
    }
    for(const m of memberships){const d=m.data;const uid=String(d.userId??'');const gid=String(d.groupId??'');const mr=await tx.query<{member_id:string}>(`SELECT member_id FROM members WHERE auth_provider='firebase' AND auth_subject=$1`,[uid]);if(!mr.rows[0])continue;
      const actor=async(field:string)=>{const subject=d[field];if(typeof subject!=='string')return null;const r=await tx.query<{member_id:string}>(`SELECT member_id FROM members WHERE auth_provider='firebase' AND auth_subject=$1`,[subject]);return r.rows[0]?.member_id??null;};
      const approvedBy=await actor('approvedBy'),rejectedBy=await actor('rejectedBy');
      await tx.query(`INSERT INTO group_memberships(group_id,member_id,role,status,joined_at,created_at,updated_at,requested_at,approved_at,approved_by_member_id,rejected_at,rejected_by_member_id,left_at) SELECT g.group_id,$2,$3,$4,COALESCE($5,now()),COALESCE($6,now()),COALESCE($7,now()),$8,$9,$10,$11,$12,$13 FROM groups g WHERE g.legacy_firestore_id=$1 ON CONFLICT(group_id,member_id) DO UPDATE SET role=EXCLUDED.role,status=EXCLUDED.status,joined_at=EXCLUDED.joined_at,created_at=EXCLUDED.created_at,updated_at=EXCLUDED.updated_at,requested_at=EXCLUDED.requested_at,approved_at=EXCLUDED.approved_at,approved_by_member_id=EXCLUDED.approved_by_member_id,rejected_at=EXCLUDED.rejected_at,rejected_by_member_id=EXCLUDED.rejected_by_member_id,left_at=EXCLUDED.left_at`,[gid,mr.rows[0].member_id,String(d.role??'member'),normalizeStatus(d.status),timestamp(d.joinedAt??d.createdAt??d.approvedAt),timestamp(d.createdAt),timestamp(d.updatedAt),timestamp(d.requestedAt??(d.status==='pending'?d.createdAt:null)),timestamp(d.approvedAt),approvedBy,timestamp(d.rejectedAt),rejectedBy,timestamp(d.leftAt)]);memberCount++;
    }
  }); return {groups:groupCount,memberships:memberCount};
}
