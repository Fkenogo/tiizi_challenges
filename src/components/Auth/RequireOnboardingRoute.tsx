import type { ReactNode } from 'react';
import { ProtectedRoute } from './ProtectedRoute';
import { RequireProfileSetup } from './RequireProfileSetup';

/**
 * Composes authentication (ProtectedRoute) with onboarding-step gating
 * (RequireProfileSetup mode="onboarding"). Use for the onboarding step routes
 * themselves — redirects a user who is already fully onboarded to Home, and
 * redirects a user visiting the wrong onboarding step to their actual next step.
 */
export function RequireOnboardingRoute({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <RequireProfileSetup mode="onboarding">{children}</RequireProfileSetup>
    </ProtectedRoute>
  );
}
