import 'dotenv/config';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.VITE_FIREBASE_PROJECT_ID;
const requiredEnvKeys = ['GOOGLE_APPLICATION_CREDENTIALS'] as const;

if (!projectId) {
  throw new Error('Missing FIREBASE_PROJECT_ID (or fallback VITE_FIREBASE_PROJECT_ID) env var.');
}

for (const key of requiredEnvKeys) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
}

if (!getApps().length) {
  initializeApp({
    credential: applicationDefault(),
    projectId,
  });
}

const db = getFirestore();

function stringValue(data: Record<string, unknown>, key: string): string {
  const value = data[key];
  return typeof value === 'string' ? value : '';
}

async function run() {
  const snap = await db.collection('groups').get();
  const groupsWithInviteCode = snap.docs
    .map((doc) => {
      const data = doc.data();
      const inviteCode = stringValue(data, 'inviteCode');
      const visibility = stringValue(data, 'visibility') || (data.isPrivate === true ? 'private' : 'public');
      return {
        groupId: doc.id,
        name: stringValue(data, 'name'),
        inviteCode,
        isPrivate: data.isPrivate === true || visibility === 'private',
        visibility,
        status: stringValue(data, 'status'),
      };
    })
    .filter((group) => group.inviteCode.length > 0);

  const privateGroups = groupsWithInviteCode.filter((group) => group.isPrivate);
  const publicGroups = groupsWithInviteCode.filter((group) => !group.isPrivate);

  console.log(JSON.stringify({
    mode: 'audit-only',
    projectId,
    groupsRead: snap.size,
    groupsWithInviteCode: groupsWithInviteCode.length,
    privateGroupsWithInviteCode: privateGroups.length,
    publicGroupsWithInviteCode: publicGroups.length,
    privateGroups,
    publicGroups,
    migrationRecommendation: [
      'Do not expose groups.inviteCode as the long-term private invite mechanism.',
      'Create groupInvites documents for active private invite codes during a future dry-run/apply migration.',
      'Store only tokenHash/codeHash on invite documents and use callable functions for redemption.',
      'After UI migration, remove or ignore groups.inviteCode for private invite joins.',
    ],
  }, null, 2));
}

run().catch((error) => {
  console.error('Group invite code audit failed:', error);
  process.exit(1);
});
