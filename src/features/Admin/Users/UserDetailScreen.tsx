import { useNavigate, useParams } from 'react-router-dom';
import { Card, EmptyState, LoadingSpinner } from '../../../components/Mobile';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../hooks/useAuth';
import { useAdminPermissions } from '../../../hooks/useAdminPermissions';
import { useAdminUser, useSetAdminUserStatus } from '../../../hooks/useAdminUsers';
import { AdminLayout } from '../layout/AdminLayout';

function UserDetailScreen() {
  const navigate = useNavigate();
  const { uid } = useParams<{ uid: string }>();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { permissions } = useAdminPermissions(user?.uid);
  const { data, isLoading } = useAdminUser(uid);
  const setStatus = useSetAdminUserStatus();

  const onSetStatus = async (status: 'active' | 'suspended') => {
    if (!uid || !user?.uid) return;
    try {
      await setStatus.mutateAsync({ uid, status, adminUid: user.uid });
      showToast(`User ${status === 'active' ? 'activated' : 'suspended'}.`, 'success');
    } catch {
      showToast('Could not update user status.', 'error');
    }
  };

  if (isLoading) return <LoadingSpinner fullScreen label="Loading user details..." />;

  if (!data) {
    return (
      <EmptyState
        icon={<span>👤</span>}
        title="User not found"
        message="The requested user could not be loaded."
        action={(
          <button className="h-11 px-4 rounded-xl bg-primary text-white text-sm font-bold" onClick={() => navigate('/app/admin/users')}>
            Back to Users
          </button>
        )}
      />
    );
  }

  return (
    <AdminLayout title={`User Detail: ${data.displayName}`} permissions={permissions}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card variant="flat">
          <p className="text-xs font-bold uppercase text-slate-500">Profile</p>
          <p className="text-sm font-semibold text-slate-900 mt-2">Name: {data.displayName}</p>
          <p className="text-sm text-slate-700 mt-1">Email: {data.email || '-'}</p>
          <p className="text-sm text-slate-700 mt-1">Status: {data.accountStatus}</p>
          <p className="text-sm text-slate-700 mt-1">Joined: {data.createdAt ? new Date(data.createdAt).toLocaleString() : '-'}</p>
          <p className="text-sm text-slate-700 mt-1">Last Active: {data.lastActiveAt ? new Date(data.lastActiveAt).toLocaleString() : '-'}</p>
        </Card>

        <Card variant="flat">
          <p className="text-xs font-bold uppercase text-slate-500">Activity Stats</p>
          <p className="text-sm text-slate-700 mt-2">Workouts: <span className="font-bold">{data.stats.workoutCount}</span></p>
          <p className="text-sm text-slate-700 mt-1">Challenges Created: <span className="font-bold">{data.stats.challengeCount}</span></p>
          <p className="text-sm text-slate-700 mt-1">Groups Owned: <span className="font-bold">{data.stats.groupCount}</span></p>
        </Card>
      </div>

      <Card className="mt-3">
        <p className="text-xs font-bold uppercase text-slate-500">Admin Actions</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {data.accountStatus === 'active' ? (
            <button className="h-10 px-4 rounded-lg bg-red-600 text-white text-sm font-bold disabled:opacity-50" disabled={!permissions.canSuspendUsers || setStatus.isPending} onClick={() => onSetStatus('suspended')}>
              Suspend Account
            </button>
          ) : (
            <button className="h-10 px-4 rounded-lg bg-green-600 text-white text-sm font-bold disabled:opacity-50" disabled={!permissions.canSuspendUsers || setStatus.isPending} onClick={() => onSetStatus('active')}>
              Activate Account
            </button>
          )}
          <button className="h-10 px-4 rounded-lg bg-slate-100 text-slate-700 text-sm font-bold" onClick={() => navigate('/app/admin/users')}>
            Back to Users
          </button>
        </div>
      </Card>
    </AdminLayout>
  );
}

export default UserDetailScreen;
