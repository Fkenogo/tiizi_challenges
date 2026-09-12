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
import { createDbKnowledgeEligibilityResolver } from './knowledgeEligibility.js';

async function main(): Promise<void> {
  const db = createPool(databaseUrl());
  const reader = createAdminFirestoreReader();
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
      store: createAdminGroupMutationStore(),
    },
    challengeCreation: {
      creationAuthority: createFirestoreChallengeCreationAuthority(db, reader),
      eligibilityFor: async (kind, key) => createDbKnowledgeEligibilityResolver(db, kind)(key),
    },
  });
  const port = Number(process.env.PORT ?? 4000);
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`tiizi-api listening on :${port}`);
}

const invokedAsCli =
  process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js');
if (invokedAsCli) void main();
