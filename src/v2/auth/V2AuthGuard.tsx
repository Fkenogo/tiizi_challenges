import { ProtectedRoute } from '../../components/Auth/ProtectedRoute';

/**
 * TIIZI S1 CORR-001 — V2 authentication boundary.
 *
 * Session truth comes from the shared neutral infrastructure
 * (ProtectedRoute session check). The unauthenticated entry is the
 * NEW V2 sign-in experience: an unauthenticated V2 route lands on
 * the V2 sign-in screen and returns to the requested V2 route after
 * sign-in. No V1 login, no V1 onboarding gates, no group
 * prerequisites, no operator authority checks.
 */

export const V2_SIGN_IN_PATH = '/v2/sign-in';

export function V2Authenticated({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute loginPath={V2_SIGN_IN_PATH}>{children}</ProtectedRoute>;
}
