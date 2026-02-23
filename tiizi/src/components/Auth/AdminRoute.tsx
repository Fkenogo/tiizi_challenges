import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Card, LoadingSpinner } from '../Mobile';
import { Screen, Section } from '../Layout';
import { useAuth } from '../../hooks/useAuth';
import { useAdminPermissions } from '../../hooks/useAdminPermissions';

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isReady, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { permissions, isLoading } = useAdminPermissions(user?.uid);

  if (!isReady) {
    return <LoadingSpinner fullScreen label="Loading session..." />;
  }

  if (!isAuthenticated) {
    const requestedPath = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/app/login?next=${encodeURIComponent(requestedPath)}`} replace />;
  }

  if (isLoading) {
    return <LoadingSpinner fullScreen label="Checking admin access..." />;
  }

  if (!permissions.canAccessAdmin) {
    return (
      <Screen>
        <Section title="Access Restricted">
          <Card>
            <p className="text-sm text-slate-700">This section is only available to admin accounts.</p>
            <button
              className="mt-4 w-full h-11 rounded-xl bg-primary text-white text-sm font-bold"
              onClick={() => navigate('/app/home', { replace: true })}
            >
              Return Home
            </button>
          </Card>
        </Section>
      </Screen>
    );
  }

  return <>{children}</>;
}
