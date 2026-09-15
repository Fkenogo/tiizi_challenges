/** One-time local fixture command for PF-05 Challenge Creation component review. */
import 'dotenv/config';
import { createPool, databaseUrl } from './db.js';
import { createAdminGroupMutationStore } from './firestoreGroupMutationStore.js';
import { findMemberByAuth } from './members.js';
import {
  assertLocalPreviewComponentRuntime,
  ensurePreviewComponentGroup,
} from './previewComponentGroup.js';

async function main(): Promise<void> {
  assertLocalPreviewComponentRuntime();
  const db = createPool(databaseUrl());
  try {
    const firebaseUid = 'preview-founder-01';
    const member = await findMemberByAuth(db, 'firebase', firebaseUid);
    if (!member) {
      throw new Error('preview component fixture requires the preview Founder Member seed');
    }
    const group = await ensurePreviewComponentGroup(
      db,
      createAdminGroupMutationStore(),
      { memberId: member.memberId, firebaseUid },
    );
    console.log(`preview:component-group: ${group.status} ${group.legacyId} ${group.id}`);
  } finally {
    await db.close();
  }
}

const invokedAsCli = process.argv[1]?.endsWith('previewComponentGroupFixtureCli.ts')
  || process.argv[1]?.endsWith('previewComponentGroupFixtureCli.js');
if (invokedAsCli) {
  main().catch((error: unknown) => {
    console.error(`preview:component-group: failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
