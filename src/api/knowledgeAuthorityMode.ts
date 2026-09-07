/**
 * Phase B canonical Knowledge authority mode (frontend mirror of the
 * functions `TIIZI_KNOWLEDGE_AUTHORITY_MODE` contract).
 *
 * - `firestore`: legacy pre-cutover behavior, Firestore paths only.
 * - `transition`: temporary migration mode. API primary; controlled
 *   Firestore fallback is allowed for by-ID reads holding legacy ids.
 *   TRANSITIONAL — remove with the last Firestore reader.
 * - `postgres`: final authority mode. API/PG only — lists, by-ID reads, and
 *   admin mutations never fall back to Firestore (API errors surface).
 *
 * Dependency-free on purpose: pure env parsing so the contract is
 * unit-testable without Firebase initialization.
 */

export type KnowledgeAuthorityMode = 'firestore' | 'transition' | 'postgres';

export function isKnowledgeAuthorityMode(value: unknown): value is KnowledgeAuthorityMode {
  return value === 'firestore' || value === 'transition' || value === 'postgres';
}

export function resolveKnowledgeAuthorityMode(
  env: Record<string, string | undefined>,
  legacyFlagEnabled: boolean,
): KnowledgeAuthorityMode {
  const raw = (env.VITE_TIIZI_KNOWLEDGE_AUTHORITY_MODE ?? '').trim().toLowerCase();
  if (!raw) return legacyFlagEnabled ? 'transition' : 'firestore';
  if (isKnowledgeAuthorityMode(raw)) return raw;
  throw new Error(
    'Invalid VITE_TIIZI_KNOWLEDGE_AUTHORITY_MODE ' +
      `"${env.VITE_TIIZI_KNOWLEDGE_AUTHORITY_MODE}". Expected firestore, transition, or postgres.`,
  );
}

/** True unless the deployment is pinned to legacy Firestore behavior. */
export function isKnowledgeApiActive(mode: KnowledgeAuthorityMode): boolean {
  return mode !== 'firestore';
}

/** Controlled Firestore fallback is allowed only in transition mode. */
export function allowsFirestoreFallback(mode: KnowledgeAuthorityMode): boolean {
  return mode === 'transition';
}
