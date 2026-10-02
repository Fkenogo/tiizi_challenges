import { Navigate, useLocation } from 'react-router-dom';
import { LoadingSpinner } from '../Mobile';
import { useAuth } from '../../hooks/useAuth';

/**
 * Neutral session gate (Class C: neutral infrastructure with a
 * configurable experience entry).
 *
 * The session check itself (useAuth readiness + isAuthenticated) is
 * neutral and reusable. The unauthenticated entry point is NOT neutral and
 * is therefore REQUIRED: each product generation supplies its own sign-in
 * entry, so a V2 journey can never route into archived Product V1
 * experience. There is deliberately no default login path — a default would
 * point one product generation at the other product's shell. The archived
 * Product V1 shell supplies `/app/login` at its own call sites.
 */
export function ProtectedRoute({
  children,
  loginPath,
  loginQuery,
}: {
  children: React.ReactNode;
  /** Unauthenticated entry route. Required: no cross-generation default. */
  loginPath: string;
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
