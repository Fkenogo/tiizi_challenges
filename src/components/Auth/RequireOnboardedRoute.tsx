import type { ReactNode } from 'react';
import { ProtectedRoute } from './ProtectedRoute';
import { RequireProfileSetup } from './RequireProfileSetup';

/**
 * Composes authentication (ProtectedRoute) with onboarding-completion gating
 * (RequireProfileSetup mode="completed"). Use for every normal authenticated
 * app route so an authenticated-but-not-yet-onboarded user is redirected to
 * their next required onboarding step instead of reaching Home/Groups/
 * Challenges/etc. directly.
 *
 * Do not use this for onboarding routes themselves — see RequireOnboardingRoute.
 */
export function RequireOnboardedRoute({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <RequireProfileSetup mode="completed">{children}</RequireProfileSetup>
    </ProtectedRoute>
  );
}
