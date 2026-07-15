import 'dotenv/config';
import { createHash } from 'node:crypto';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore, type Firestore } from 'firebase-admin/firestore';

type GroupInviteCodeRow = {
  groupId: string;
  name: string;
  inviteCode: string;
  isPrivate: boolean;
  visibility: string;
  status: string;
  ownerId: string;
};

type ProposedInviteRecord = {
  documentId: string;
  groupId: string;
  groupName: string;
  sourceInviteCode: string;
  isPrivate: boolean;
  status: 'active';
  type: 'multi_use';
  maxUses: number;
  useCount: 0;
  expiresAt: string;
  tokenHash: string;
  note: string;
};

export type ExistingInviteRecord = {
  inviteId: string;
  groupId: string;
  tokenHash: string;
  migratedFrom?: string;
  status?: string;
};

type SkippedInviteRecord = {
  groupId: string;
  groupName: string;
  documentId: string;
  existingInviteId: string;
  reason: 'deterministic_id_exists' | 'legacy_mapping_exists' | 'token_hash_exists';
};

type InviteMigrationCollision = {
  groupId: string;
  groupName: string;
  documentId: string;
  existingInviteId: string;
  field: 'documentId' | 'groupId' | 'tokenHash';
  existingGroupId: string;
};

export type InviteCodeMigrationPlan = {
  groupsRead: number;
  groupsWithInviteCode: number;
  privateGroupsWithInviteCode: number;
  publicGroupsWithInviteCode: number;
  proposedInvites: ProposedInviteRecord[];
  skippedExisting: SkippedInviteRecord[];
  collisions: InviteMigrationCollision[];
  writesPlanned: number;
};

const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.VITE_FIREBASE_PROJECT_ID;
const applyMode = process.argv.includes('--apply');
const productionProjectIds = new Set(['tiizi-challenges']);

function stringValue(data: Record<string, unknown>, key: string): string {
  const value = data[key];
  return typeof value === 'string' ? value : '';
}

function hashInviteCode(inviteCode: string): string {
  return createHash('sha256').update(inviteCode).digest('hex');
}

export function legacyInviteDocumentId(groupId: string): string {
  const safeGroupId = groupId.trim().replace(/[^A-Za-z0-9_-]/g, '_');
  return `legacy_${safeGroupId}`;
}

function isSameLegacyMapping(existing: ExistingInviteRecord, groupId: string, tokenHash: string): boolean {
  return existing.groupId === groupId
    && existing.tokenHash === tokenHash
    && existing.migratedFrom === 'groups.inviteCode';
}

export function buildInviteCodeMigrationPlan(
  groups: GroupInviteCodeRow[],
  existingInvites: ExistingInviteRecord[] = [],
  now = new Date(),
): InviteCodeMigrationPlan {
  const expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();
  const groupsWithInviteCode = groups.filter((group) => group.inviteCode.trim().length > 0);
  const proposedInvites: ProposedInviteRecord[] = [];
  const skippedExisting: SkippedInviteRecord[] = [];
  const collisions: InviteMigrationCollision[] = [];

  groupsWithInviteCode.forEach((group) => {
    const documentId = legacyInviteDocumentId(group.groupId);
    const tokenHash = hashInviteCode(group.inviteCode);
    const existingById = existingInvites.find((invite) => invite.inviteId === documentId);
    const existingByGroup = existingInvites.find((invite) =>
      invite.groupId === group.groupId && invite.migratedFrom === 'groups.inviteCode');
    const existingByHash = existingInvites.find((invite) => invite.tokenHash === tokenHash);

    if (existingById) {
      if (isSameLegacyMapping(existingById, group.groupId, tokenHash)) {
        skippedExisting.push({
          groupId: group.groupId,
          groupName: group.name,
          documentId,
          existingInviteId: existingById.inviteId,
          reason: 'deterministic_id_exists',
        });
        return;
      }
      collisions.push({
        groupId: group.groupId,
        groupName: group.name,
        documentId,
        existingInviteId: existingById.inviteId,
        field: 'documentId',
        existingGroupId: existingById.groupId,
      });
      return;
    }

    if (existingByGroup) {
      if (isSameLegacyMapping(existingByGroup, group.groupId, tokenHash)) {
        skippedExisting.push({
          groupId: group.groupId,
          groupName: group.name,
          documentId,
          existingInviteId: existingByGroup.inviteId,
          reason: 'legacy_mapping_exists',
        });
        return;
      }
      collisions.push({
        groupId: group.groupId,
        groupName: group.name,
        documentId,
        existingInviteId: existingByGroup.inviteId,
        field: 'groupId',
        existingGroupId: existingByGroup.groupId,
      });
      return;
    }

    if (existingByHash) {
      if (isSameLegacyMapping(existingByHash, group.groupId, tokenHash)) {
        skippedExisting.push({
          groupId: group.groupId,
          groupName: group.name,
          documentId,
          existingInviteId: existingByHash.inviteId,
          reason: 'token_hash_exists',
        });
        return;
      }
      collisions.push({
        groupId: group.groupId,
        groupName: group.name,
        documentId,
        existingInviteId: existingByHash.inviteId,
        field: 'tokenHash',
        existingGroupId: existingByHash.groupId,
      });
      return;
    }

    proposedInvites.push({
      documentId,
      groupId: group.groupId,
      groupName: group.name,
      sourceInviteCode: group.inviteCode,
      isPrivate: group.isPrivate,
      status: 'active' as const,
      type: 'multi_use' as const,
      maxUses: 10000,
      useCount: 0 as const,
      expiresAt,
      tokenHash,
      note: 'Migrated from legacy groups.inviteCode. Original group field preserved.',
    });
  });

  return {
    groupsRead: groups.length,
    groupsWithInviteCode: groupsWithInviteCode.length,
    privateGroupsWithInviteCode: groupsWithInviteCode.filter((group) => group.isPrivate).length,
    publicGroupsWithInviteCode: groupsWithInviteCode.filter((group) => !group.isPrivate).length,
    proposedInvites,
    skippedExisting,
    collisions,
    writesPlanned: proposedInvites.length,
  };
}

async function loadGroups(db: Firestore): Promise<GroupInviteCodeRow[]> {
  const snap = await db.collection('groups').get();
  return snap.docs.map((doc) => {
    const data = doc.data();
    const visibility = stringValue(data, 'visibility') || (data.isPrivate === true ? 'private' : 'public');
    return {
      groupId: doc.id,
      name: stringValue(data, 'name'),
      inviteCode: stringValue(data, 'inviteCode'),
      isPrivate: data.isPrivate === true || visibility === 'private',
      visibility,
      status: stringValue(data, 'status'),
      ownerId: stringValue(data, 'ownerId'),
    };
  });
}

async function loadExistingInvites(db: Firestore): Promise<ExistingInviteRecord[]> {
  const snap = await db.collection('groupInvites').get();
  return snap.docs.map((doc) => {
    const data = doc.data();
    return {
      inviteId: doc.id,
      groupId: stringValue(data, 'groupId'),
      tokenHash: stringValue(data, 'tokenHash'),
      migratedFrom: stringValue(data, 'migratedFrom') || undefined,
      status: stringValue(data, 'status') || undefined,
    };
  });
}

async function applyMigration(db: Firestore, plan: InviteCodeMigrationPlan) {
  if (plan.collisions.length > 0) {
    throw new Error(`Refusing to apply migration with ${plan.collisions.length} invite collision(s).`);
  }

  let writesApplied = 0;
  for (let index = 0; index < plan.proposedInvites.length; index += 450) {
    const batch = db.batch();
    plan.proposedInvites.slice(index, index + 450).forEach((invite) => {
      const ref = db.collection('groupInvites').doc(invite.documentId);
      batch.set(ref, {
        groupId: invite.groupId,
        createdBy: 'migration',
        createdAt: FieldValue.serverTimestamp(),
        expiresAt: invite.expiresAt,
        revokedAt: null,
        status: invite.status,
        type: invite.type,
        maxUses: invite.maxUses,
        useCount: invite.useCount,
        tokenHash: invite.tokenHash,
        lastUsedAt: null,
        note: invite.note,
        migratedFrom: 'groups.inviteCode',
        migratedAt: FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
    writesApplied += Math.min(450, plan.proposedInvites.length - index);
  }
  return writesApplied;
}

async function run() {
  if (!projectId) {
    throw new Error('Missing FIREBASE_PROJECT_ID (or fallback VITE_FIREBASE_PROJECT_ID) env var.');
  }
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error('Missing required env var: GOOGLE_APPLICATION_CREDENTIALS');
  }
  if (applyMode && productionProjectIds.has(projectId) && process.env.CONFIRM_PROJECT_ID !== projectId) {
    throw new Error(`Refusing to write to production project "${projectId}" unless CONFIRM_PROJECT_ID=${projectId}.`);
  }

  if (!getApps().length) {
    initializeApp({
      credential: applicationDefault(),
      projectId,
    });
  }

  const db = getFirestore();
  db.settings({ ignoreUndefinedProperties: true });

  const groups = await loadGroups(db);
  const existingInvites = await loadExistingInvites(db);
  const plan = buildInviteCodeMigrationPlan(groups, existingInvites);
  const writesApplied = applyMode ? await applyMigration(db, plan) : 0;

  console.log(JSON.stringify({
    mode: applyMode ? 'apply' : 'dry-run',
    projectId,
    existingInvitesRead: existingInvites.length,
    ...plan,
    writesApplied,
    preservesOriginalInviteCodeField: true,
  }, null, 2));

  if (!applyMode) {
    console.log('Dry-run only. Re-run with --apply and CONFIRM_PROJECT_ID to create groupInvites.');
  }
}

if (process.argv[1]?.endsWith('migrateInviteCodes.ts')) {
  run().catch((error) => {
    console.error('Invite code migration failed:', error);
    process.exit(1);
  });
}
