/**
 * Phase C3B V2 Challenge feature boundary (frontend).
 *
 * Single explicit flag: V2 Challenge flows are OFF by default and run only
 * when VITE_TIIZI_V2_CHALLENGES_ENABLED === 'true'. The flag gates access to
 * CLEAN V2 Challenge flows; it never reinterprets a Firestore/V1 Challenge
 * as a V2 Challenge.
 *
 * V1/V2 identity separation: a V2 Challenge is identified SOLELY by the V2
 * API/domain identity (Tiizi UUID returned from the V2 Challenge API) and a
 * successful V2 API/domain lookup. The UUID-shape check is a routing
 * convenience, NOT a security/domain invariant — a Firestore document id
 * could theoretically be UUID-shaped. V1 and V2 Challenges are never
 * deduplicated or matched heuristically.
 *
 * Pure env parsing (no Firebase) so the boundary is unit-testable.
 */

export function resolveV2ChallengesEnabled(env: Record<string, string | undefined>): boolean {
  return (env.VITE_TIIZI_V2_CHALLENGES_ENABLED ?? '').trim().toLowerCase() === 'true';
}

/** V2 Challenge flows run only when explicitly enabled. Default OFF. */
export function isV2ChallengesEnabled(): boolean {
  if (typeof import.meta === 'undefined' || !import.meta.env) return false;
  return resolveV2ChallengesEnabled(import.meta.env as Record<string, string | undefined>);
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * UUID-shape routing convenience only (NOT a security invariant): a
 * Firestore document id could theoretically be UUID-shaped, so this check
 * alone does not establish V2 identity. The real boundary is the explicit
 * V2 flow (isV2ChallengeAction) plus a successful V2 API/domain lookup.
 */
export function isV2ChallengeId(id: string | undefined | null): boolean {
  return typeof id === 'string' && UUID_RE.test(id);
}

/**
 * A screen may take the V2 path only when ALL hold: the feature boundary is
 * enabled, the navigation explicitly marks the V2 flow, and the challenge id
 * is a V2 identity. Any one missing means the V1 path (or an error) — never
 * a reinterpreted V1 Challenge.
 */
export function isV2ChallengeAction(
  challengeId: string | undefined | null,
  v2Param: string | undefined | null,
): boolean {
  return isV2ChallengesEnabled() && v2Param === '1' && isV2ChallengeId(challengeId);
}
