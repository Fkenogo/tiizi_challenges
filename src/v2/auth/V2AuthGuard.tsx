import { useLocation } from 'react-router-dom';
import { ProtectedRoute } from '../../components/Auth/ProtectedRoute';
import { V2MemberBootstrapGate } from './V2MemberBootstrapGate';
import { v2AuthEntryHints } from './v2NextPath';
import { hasSeenWelcome } from '../welcome/welcomeState';

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
export const V2_WELCOME_PATH = '/v2/welcome';

export function V2Authenticated({ children }: { children: React.ReactNode }) {
  // P1a: a visitor who has never seen the public welcome on this device lands
  // there first (device-scoped flag; it only chooses WHICH public screen comes
  // first and never gates sign-in, sign-up or any member feature).
  // The Operator review handoff keeps its direct sign-in entry.
  const location = useLocation();
  const entryPath = hasSeenWelcome() || location.pathname.startsWith('/v2/operator')
    ? V2_SIGN_IN_PATH
    : V2_WELCOME_PATH;
  return (
    <ProtectedRoute
      loginPath={entryPath}
      loginQuery={(requestedPath) => v2AuthEntryHints(requestedPath, import.meta.env.DEV)}
    >
      <V2MemberBootstrapGate>{children}</V2MemberBootstrapGate>
    </ProtectedRoute>
  );
}
