import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createPool, databaseUrl } from './db.js';
import { reconcileGroupAuthority, applyGroupAuthorityReconciliation, type ReconciliationSource } from './groupAuthorityReconciliation.js';

async function main() {
  const apply = process.argv.includes('--apply');
  const outputArg = process.argv.find(v => v.startsWith('--output='))?.slice('--output='.length);
  const output = resolve(outputArg ?? `/private/tmp/tiizi-group-authority-reconciliation-${new Date().toISOString().replace(/[:.]/g,'-')}.json`);
  const db = createPool(databaseUrl());
  try {
    const {getFirestore}=await import('firebase-admin/firestore');
    const {ensureFirebaseAdmin}=await import('./auth.js');
    const firestore=getFirestore(ensureFirebaseAdmin());
    const source:ReconciliationSource={
      async listGroups(){const snap=await firestore.collection('groups').get();return snap.docs.map(d=>({id:d.id,data:d.data() as Record<string,unknown>}));},
      async listMemberships(){const snap=await firestore.collection('groupMembers').get();return snap.docs.map(d=>({id:d.id,data:d.data() as Record<string,unknown>}));},
    };
    const report=await reconcileGroupAuthority(db,source);
    let applied:{groups:number;memberships:number}|null=null;
    if(apply){if(!report.safeToApply)throw new Error('dry-run found unresolved conflicts; apply was refused');applied=await applyGroupAuthorityReconciliation(db,source,report);}
    await mkdir(dirname(output),{recursive:true});
    await writeFile(output,JSON.stringify({report,applied},null,2),'utf8');
    const summary=[`Group reconciliation ${apply?'APPLY':'DRY-RUN'}`,`Groups: ${report.groups.total} Firestore / ${report.groups.matched} matched / ${report.groups.firestoreOnly.length} Firestore-only / ${report.groups.postgresOnly.length} PostgreSQL-only`,`Memberships: ${report.memberships.firestoreTotal} Firestore / ${report.memberships.matched} matched / ${report.memberships.postgresOnly.length} PostgreSQL-only`,`Conflicts: duplicate mappings ${report.groups.duplicateMappings.length}; owner mapping ${report.groups.ownerMappingFailures.length}; owner conflicts ${report.groups.multipleOrNoOwnerConflicts.length}; missing members ${report.memberships.missingMemberMappings.length}; orphan memberships ${report.memberships.orphanGroups.length}; unreconciled Challenge refs ${report.challengeReferences.unreconciled.length}`,`Safe to apply: ${report.safeToApply}`,`Artifact: ${output}`].join('\n');
    console.log(summary);
    if(!report.safeToApply)process.exitCode=2;
  } finally {await db.close();}
}

const invoked=process.argv[1]?.endsWith('groupAuthorityReconciliationCli.ts')||process.argv[1]?.endsWith('groupAuthorityReconciliationCli.js');
if(invoked)main().catch(e=>{console.error(`group-reconciliation: ${e instanceof Error?e.message:String(e)}`);process.exitCode=1;});
