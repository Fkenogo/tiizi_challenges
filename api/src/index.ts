import 'dotenv/config';
import { createFirebaseVerifier } from './auth.js';
import { buildApp } from './app.js';
import { createPool, databaseUrl } from './db.js';
import {
  createAdminFirestoreReader,
  createFirestoreGroupMembershipAuthority,
} from './firestoreGroupAuthority.js';
import { createFirestoreChallengeCreationAuthority } from './firestoreChallengeCreationAuthority.js';
import { createAdminGroupMutationStore } from './firestoreGroupMutationStore.js';
import { createDbKnowledgeIdentityResolver } from './knowledgePins.js';
import { createDbKnowledgeEligibilityResolverByIdentity } from './knowledgeEligibility.js';
import { isLocalPreviewComponentRuntime } from './previewComponentGroup.js';

async function main(): Promise<void> {
  const db = createPool(databaseUrl());
  const reader = createAdminFirestoreReader();
  const groupMutationStore = createAdminGroupMutationStore();
  const app = buildApp({
    db,
    verifier: createFirebaseVerifier(),
    // Transitional live Group authority (read-only Firestore). Removed when
    // Group authority migrates to PostgreSQL; the domain contract is unchanged.
    challengeActivity: {
      groupMembershipAuthority: createFirestoreGroupMembershipAuthority(db, reader),
    },
    // EBC-01 governed boundaries (same live Firestore authority).
    groupMutation: {
      store: groupMutationStore,
    },
    challengeCreation: {
      creationAuthority: createFirestoreChallengeCreationAuthority(db, reader),
      // PF-01-CORR-001: normal runtime establishment resolves canonical
      // Knowledge by immutable identity (UUID / Activity Code) — never by
      // exact display name. The legacy name seam stays available only where
      // explicitly injected for historical compatibility/tests.
      eligibilityFor: async (kind, key) => createDbKnowledgeEligibilityResolverByIdentity(db, kind)(key),
      pinsFor: async (kind, key) => createDbKnowledgeIdentityResolver(db, kind)(key),
    },
    ...(isLocalPreviewComponentRuntime()
      ? {
        previewComponent: {
          store: groupMutationStore,
          firebaseUidForMember: async (memberId: string) => {
            const result = await db.query<{ auth_subject: string | null }>(
              `SELECT auth_subject FROM members WHERE member_id = $1 AND auth_provider = 'firebase'`,
              [memberId],
            );
            return result.rows[0]?.auth_subject ?? null;
          },
        },
      }
      : {}),
  });
  const port = Number(process.env.PORT ?? 4000);
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`tiizi-api listening on :${port}`);
}

const invokedAsCli =
  process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js');
if (invokedAsCli) void main();
