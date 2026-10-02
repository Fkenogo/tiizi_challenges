import { Navigate, useLocation } from 'react-router-dom';
import { LoadingSpinner } from '../Mobile';
import { useAuth } from '../../hooks/useAuth';

/**
 * Neutral session gate (Class C: neutral infrastructure with a
 * configurable experience entry).
 *
 * The session check itself (useAuth readiness + isAuthenticated) is
 * neutral and reusable. The unauthenticated entry point is NOT
 * neutral: it defaults to the frozen V1 login experience and must be
 * supplied explicitly by any non-V1 composition. V2 passes its own
 * sign-in entry so a V2 journey can never route into V1 experience.
 */
export function ProtectedRoute({
  children,
  loginPath = '/app/login',
  loginQuery,
}: {
  children: React.ReactNode;
  /** Unauthenticated entry route. V1 default preserved; V2 supplies its own. */
  loginPath?: string;
  /** Optional entry hints for the requested path; never affects session authority. */
  loginQuery?: (requestedPath: string) => Record<string, string>;
}) {
  const { isAuthenticated, isReady } = useAuth();
  const location = useLocation();

  if (!isReady) {
    return <LoadingSpinner fullScreen label="Loading session..." />;
  }

  if (!isAuthenticated) {
    const requestedPath = `${location.pathname}${location.search}${location.hash}`;
    const query = new URLSearchParams({ next: requestedPath, ...(loginQuery?.(requestedPath) ?? {}) });
    return <Navigate to={`${loginPath}?${query.toString()}`} replace />;
  }

  return <>{children}</>;
}
