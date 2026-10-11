import { ProtectedRoute } from '../../components/Auth/ProtectedRoute';
import { V2MemberBootstrapGate } from './V2MemberBootstrapGate';
import { v2AuthEntryHints } from './v2NextPath';

/**
 * TIIZI S1 CORR-001 — V2 authentication boundary.
 *
 * Session truth comes from the shared neutral infrastructure
 * (ProtectedRoute session check). The unauthenticated entry is the
 * NEW V2 sign-in experience: an unauthenticated V2 route lands on
 * the V2 sign-in screen and returns to the requested V2 route after
 * sign-in. No V1 login, no V1 onboarding gates, no group
 * prerequisites, no operator authority checks.
 *
 * MC-1: once a session exists, the explicit member bootstrap runs before
 * the authenticated V2 experience renders (V2MemberBootstrapGate).
 */

export const V2_SIGN_IN_PATH = '/v2/sign-in';

export function V2Authenticated({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute
      loginPath={V2_SIGN_IN_PATH}
      loginQuery={(requestedPath) => v2AuthEntryHints(requestedPath, import.meta.env.DEV)}
    >
      <V2MemberBootstrapGate>{children}</V2MemberBootstrapGate>
    </ProtectedRoute>
  );
}
