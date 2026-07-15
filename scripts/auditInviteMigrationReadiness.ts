import 'dotenv/config';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

type LegacyGroupInviteRow = {
  groupId: string;
  name: string;
  inviteCode: string;
  isPrivate: boolean;
};

type MigratedInviteRow = {
  inviteId: string;
  groupId: string;
  status: string;
  migratedFrom?: string;
};

export type InviteMigrationReadinessInput = {
  groups: LegacyGroupInviteRow[];
  invites: MigratedInviteRow[];
};

export type InviteMigrationReadinessReport = {
  mode: 'audit-only';
  legacyInviteCodes: number;
  migratedInviteRecords: number;
  privateLegacyInviteCodes: number;
  publicLegacyInviteCodes: number;
  missingMappings: LegacyGroupInviteRow[];
  orphanedInviteRecords: MigratedInviteRow[];
};

const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.VITE_FIREBASE_PROJECT_ID;

function stringValue(data: Record<string, unknown>, key: string): string {
  const value = data[key];
  return typeof value === 'string' ? value : '';
}

export function buildInviteMigrationReadinessReport(input: InviteMigrationReadinessInput): InviteMigrationReadinessReport {
  const groupsWithCodes = input.groups.filter((group) => group.inviteCode.trim().length > 0);
  const groupIds = new Set(input.groups.map((group) => group.groupId));
  const migratedGroupIds = new Set(input.invites.map((invite) => invite.groupId).filter(Boolean));

  return {
    mode: 'audit-only',
    legacyInviteCodes: groupsWithCodes.length,
    migratedInviteRecords: input.invites.length,
    privateLegacyInviteCodes: groupsWithCodes.filter((group) => group.isPrivate).length,
    publicLegacyInviteCodes: groupsWithCodes.filter((group) => !group.isPrivate).length,
    missingMappings: groupsWithCodes.filter((group) => !migratedGroupIds.has(group.groupId)),
    orphanedInviteRecords: input.invites.filter((invite) => !groupIds.has(invite.groupId)),
  };
}

async function run() {
  if (!projectId) {
    throw new Error('Missing FIREBASE_PROJECT_ID (or fallback VITE_FIREBASE_PROJECT_ID) env var.');
  }
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error('Missing required env var: GOOGLE_APPLICATION_CREDENTIALS');
  }

  if (!getApps().length) {
    initializeApp({
      credential: applicationDefault(),
      projectId,
    });
  }

  const db = getFirestore();
  const [groupsSnap, invitesSnap] = await Promise.all([
    db.collection('groups').get(),
    db.collection('groupInvites').get(),
  ]);

  const groups = groupsSnap.docs.map((doc) => {
    const data = doc.data();
    const visibility = stringValue(data, 'visibility') || (data.isPrivate === true ? 'private' : 'public');
    return {
      groupId: doc.id,
      name: stringValue(data, 'name'),
      inviteCode: stringValue(data, 'inviteCode'),
      isPrivate: data.isPrivate === true || visibility === 'private',
    };
  });

  const invites = invitesSnap.docs.map((doc) => {
    const data = doc.data();
    return {
      inviteId: doc.id,
      groupId: stringValue(data, 'groupId'),
      status: stringValue(data, 'status'),
      migratedFrom: stringValue(data, 'migratedFrom') || undefined,
    };
  });

  console.log(JSON.stringify({
    projectId,
    ...buildInviteMigrationReadinessReport({ groups, invites }),
  }, null, 2));
}

if (process.argv[1]?.endsWith('auditInviteMigrationReadiness.ts')) {
  run().catch((error) => {
    console.error('Invite migration readiness audit failed:', error);
    process.exit(1);
  });
}
