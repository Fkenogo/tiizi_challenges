import { Navigate, useLocation } from 'react-router-dom';
import { getStoredActiveGroupId, setActiveGroupId } from '../../hooks/useActiveGroup';
import { useGroupMembershipStatus } from '../../hooks/useGroups';
import { useAuth } from '../../hooks/useAuth';
import { LoadingSpinner } from '../Mobile';

export function RequireGroupRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user } = useAuth();
  const params = new URLSearchParams(location.search);
  const groupId = params.get('groupId') ?? getStoredActiveGroupId();
  const { data: membershipStatus, isLoading } = useGroupMembershipStatus(groupId);

  if (!groupId) {
    return <Navigate to="/app/groups" replace />;
  }

  if (!params.get('groupId')) {
    const next = new URLSearchParams(location.search);
    next.set('groupId', groupId);
    return <Navigate to={`${location.pathname}?${next.toString()}`} replace />;
  }

  if (user && isLoading) {
    return <LoadingSpinner fullScreen label="Checking group access..." />;
  }

  if (membershipStatus && membershipStatus !== 'joined') {
    return <Navigate to={`/app/group/${groupId}`} replace />;
  }

  setActiveGroupId(groupId);

  return <>{children}</>;
}
