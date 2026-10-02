import 'dotenv/config';
import { createFirebaseVerifier } from './auth.js';
import { buildApp } from './app.js';
import { createPool, databaseUrl } from './db.js';
import { createPostgresGroupMembershipAuthority, createPostgresChallengeCreationAuthority } from './postgresGroupAuthority.js';
import { createDbKnowledgeIdentityResolver } from './knowledgePins.js';
import { createDbKnowledgeEligibilityResolverByIdentity } from './knowledgeEligibility.js';
import { createPostgresSocialCauseReviewerAuthority } from './socialCauseApprovalAuthority.js';

async function main(): Promise<void> {
  const db = createPool(databaseUrl());
  const app = buildApp({
    db,
    verifier: createFirebaseVerifier(),
    challengeActivity: {
      groupMembershipAuthority: createPostgresGroupMembershipAuthority(db),
    },
    challengeCreation: {
      creationAuthority: createPostgresChallengeCreationAuthority(db),
      // PF-01-CORR-001: normal runtime establishment resolves canonical
      // Knowledge by immutable identity (UUID / Activity Code) — never by
      // exact display name. The legacy name seam stays available only where
      // explicitly injected for historical compatibility/tests.
      eligibilityFor: async (kind, key) => createDbKnowledgeEligibilityResolverByIdentity(db, kind)(key),
      pinsFor: async (kind, key) => createDbKnowledgeIdentityResolver(db, kind)(key),
    },
    socialCauseApproval: createPostgresSocialCauseReviewerAuthority(db),
  });
  const port = Number(process.env.PORT ?? 4000);
  const host = process.env.HOST ?? '0.0.0.0';
  await app.listen({ port, host });
  console.log(`tiizi-api listening on :${port}`);
}

const invokedAsCli =
  process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js');
if (invokedAsCli) void main();
