import { Navigate, useLocation } from 'react-router-dom';
import { LoadingSpinner } from '../Mobile';
import { useAuth } from '../../hooks/useAuth';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isReady } = useAuth();
  const location = useLocation();

  if (!isReady) {
    return <LoadingSpinner fullScreen label="Loading session..." />;
  }

  if (!isAuthenticated) {
    const requestedPath = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/app/login?next=${encodeURIComponent(requestedPath)}`} replace />;
  }

  return <>{children}</>;
}
