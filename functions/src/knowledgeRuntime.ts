import { defineSecret, defineString } from 'firebase-functions/params';

/**
 * Phase B production bridge: PostgreSQL Knowledge authority runtime for the
 * two challenge-creation callables only.
 *
 * - DATABASE_URL arrives via Secret Manager binding (never committed, never
 *   exposed to unrelated functions). At runtime secrets are injected as
 *   environment variables, which createKnowledgeAuthorityFromEnv() reads.
 * - TIIZI_DB_SERVER_CA_PEM carries the Cloud SQL server CA (PEM) the same
 *   way. The authority reader (same verified-TLS contract as the API, see
 *   dbSsl.ts) materializes it to a 0600 temp file and enforces
 *   sslmode=verify-ca; without it the reader refuses to connect.
 * - TIIZI_KNOWLEDGE_AUTHORITY_MODE is a non-secret string param. Default is
 *   `transition` (safe); production cutover sets it to `postgres`.
 * - TIIZI_FUNCTIONS_VPC_CONNECTOR names the Serverless VPC Access connector
 *   (us-central1, tiizi-prod-vpc) providing the private path to Cloud SQL.
 *   Empty (default) attaches no VPC configuration.
 */
export const KNOWLEDGE_DATABASE_URL_SECRET_NAME = 'DATABASE_URL';

export const knowledgeDatabaseUrlSecret = defineSecret(KNOWLEDGE_DATABASE_URL_SECRET_NAME);

/** Secret Manager name for the Cloud SQL server CA (PEM trust material). */
export const KNOWLEDGE_SERVER_CA_SECRET_NAME = 'TIIZI_DB_SERVER_CA_PEM';

export const knowledgeServerCaSecret = defineSecret(KNOWLEDGE_SERVER_CA_SECRET_NAME);

export const knowledgeAuthorityModeParam = defineString('TIIZI_KNOWLEDGE_AUTHORITY_MODE', {
  default: 'transition',
  description:
    'Canonical Knowledge authority: firestore (legacy), transition (PG-first with fallback), postgres (PG-only, fail-closed).',
  input: {
    text: {
      validationRegex: '^(firestore|transition|postgres)$',
      validationErrorMessage: 'Expected firestore, transition, or postgres.',
    },
  },
});

export const functionsVpcConnectorParam = defineString('TIIZI_FUNCTIONS_VPC_CONNECTOR', {
  default: '',
  description:
    'Serverless VPC Access connector for private Cloud SQL access (us-central1, tiizi-prod-vpc). Empty means no VPC attachment.',
});

/** Egress restricted to private ranges: no public DB path by construction. */
export const KNOWLEDGE_VPC_EGRESS = 'PRIVATE_RANGES_ONLY' as const;

export interface KnowledgeCallableOptions {
  region: 'us-central1';
  secrets: [typeof knowledgeDatabaseUrlSecret, typeof knowledgeServerCaSecret];
  vpcConnector?: string;
  vpcConnectorEgressSettings?: typeof KNOWLEDGE_VPC_EGRESS;
}

/**
 * Shared options for the two PostgreSQL-authority callables. Region stays
 * pinned; both secrets are always bound; the connector attaches only when
 * configured (unset in non-production environments).
 */
export function knowledgeCallableOptions(): KnowledgeCallableOptions {
  const connector = functionsVpcConnectorParam.value().trim();
  return {
    region: 'us-central1',
    secrets: [knowledgeDatabaseUrlSecret, knowledgeServerCaSecret],
    ...(connector
      ? { vpcConnector: connector, vpcConnectorEgressSettings: KNOWLEDGE_VPC_EGRESS }
      : {}),
  };
}
